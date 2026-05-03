import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  governedWorkflowDefinitions,
  governedWorkflowRuns,
  governedStepExecutions,
  governedStepAssignments,
  gateResults,
  agents,
  auditEvents,
  authUsers,
  heartbeatRuns,
  type Db,
} from "@mnm/db";
import {
  workflowDefinitionSchema,
  WORKFLOW_ERROR_CODES,
  type WorkflowDefinition,
  type GateContext,
  type GateBlock,
  type HookBlock,
} from "@mnm/governed-workflows";
import {
  launchCompositeStep,
  completeCompositeStep,
  parseCompositeUses,
} from "./governed-workflows-composite.js";
import type {
  HookContext as WorkflowHookCtx,
  HookEvaluationResult,
} from "@mnm/workflow-hooks";
import type {
  ResolvedHookForStep,
  WorkflowHooksService,
} from "./workflow-hooks.js";
import type { GovernedWorkflowsAssignmentsService } from "./governed-workflows-assignments.js";
import { GitProviderError } from "@mnm/git-provider";
import type { GitProvider, ShaCache } from "@mnm/git-provider";
import type { ArtifactInput, ArtifactPersisted, AuditActorType, Handoff, MergedConfigItem, OutputPersisted } from "@mnm/shared";
import { PERMISSIONS } from "@mnm/shared";
import { runGateBlock, CompiledCache } from "@mnm/gate-runner";
import {
  commitHandoffArtifacts,
  resolveCommitAuthor,
  runBranchName,
  buildHandoffsForStep,
  mergeRunBranch,
} from "./governed-workflows-artifacts.js";
import { makeResolveSource } from "./governed-workflows-source-resolver.js";
import { buildGateHelpers } from "./governed-workflows-helpers.js";
import { resolveResourcePath, type ProviderWithPaths } from "./git-resource-path.js";
import { listRuns as listRunsExt, type ListRunsArgs, type ListRunsResult } from "./governed-workflows-extensions.js";
import { configLayerConflictService } from "./config-layer-conflict.js";
import { accessService } from "./access.js";
import { publishLiveEvent } from "./live-events.js";
import {
  emitStepUpdated,
  emitGateEvaluated,
  emitRunCancelled,
  emitRunReactivated,
  type PublishFn,
} from "../realtime/emitters/governed-run-events.js";
import {
  finalizeClientRun,
  getCaptureConfig,
  type FinalizeDeps,
  type SessionFileInput,
} from "./session-bundle/index.js";

// Constant providerId for ShaCache (providerId, path, sha) tuple.
const PROVIDER_ID = "mnm-workflows";

// One process-wide compiled cache. Entries are keyed by (gitSha, path),
// which are immutable once a tag is pushed, so entries never need to be
// invalidated — only evicted under memory pressure (ReadyCache FIFO,
// cf. T4).
const compiledCache = new CompiledCache();

/**
 * Domain error raised by the governed workflow service. Mapped to the MCP
 * uniform error contract by the tool layer. `code` is always a member of
 * `WORKFLOW_ERROR_CODES`.
 *
 * The class itself lives in `./governed-workflows-error.ts` so satellite
 * modules (T5 composite resolver, future workflows-X services) can throw
 * the canonical error type WITHOUT importing the full main service —
 * which would create a cycle for any module the main service depends on.
 */
export { GovernedWorkflowError } from "./governed-workflows-error.js";
import { GovernedWorkflowError } from "./governed-workflows-error.js";

export interface GovernedWorkflowServiceDeps {
  /**
   * Per-company (or per-user) GitProvider resolver. The service caches nothing
   * itself — the resolver owns the instance cache (see build-mcp-services.ts).
   *
   * Pass `userId` when the calling actor is a board user in `authenticated`
   * mode: the resolver will prefer the user's GitLab OAuth token over the
   * company-level PAT, giving commits a per-user GitLab identity.
   * Pass `resourceType` to enable path-prefix resolution via resolveResourcePath.
   */
  resolveGitProvider: (args: { companyId: string; userId?: string | null; resourceType?: import("./git-resource-path.js").ResourceType }) => Promise<GitProvider>;
  shaCache: ShaCache;
  /**
   * Optional. When provided, steps that declare the canonical
   * session-file-bundled gate in their exit block will spawn a client-mode
   * heartbeat_run at launchStep and finalize it (parse bundle → trace +
   * observations) at completeStep. If absent, the session-bundle feature is
   * silently disabled (V1 backward compat for callers that don't wire it).
   */
  heartbeat?: {
    createClientRun: (opts: {
      companyId: string;
      agentId: string;
      invocationSource?: string;
      triggerDetail?: string;
      contextSnapshot?: Record<string, unknown>;
    }) => Promise<{ id: string }>;
  };
  /** Optional. Required (paired with `heartbeat`) for the session-bundle finalize path. */
  traceService?: {
    create(
      companyId: string,
      input: {
        heartbeatRunId: string;
        agentId: string;
        name: string;
        metadata?: Record<string, unknown>;
        tags?: string[];
      },
    ): Promise<{ id: string }>;
    addObservation(
      companyId: string,
      traceId: string,
      input: Record<string, unknown>,
    ): Promise<{ id: string }>;
    completeTrace(
      companyId: string,
      traceId: string,
      input: { status: "completed" | "failed" },
    ): Promise<unknown>;
  };
  /**
   * Optional workflow-hooks service (T2.7 wire). When provided, the
   * orchestrator runs `before_run` / `before_step` / `after_step` /
   * `after_run` hooks at the standard insertion points. When omitted
   * (e.g. tests, or before T2.7 is wired up via DI in app.ts), hook
   * execution is a no-op — backward compatible.
   *
   * Fail-modes (per phase):
   *  - `before_run` fail → run state="failed", error HOOK_FAILED:<ref>
   *  - `before_step` fail → step state="failed" (run cascades)
   *  - `after_step` fail → step retro-fails (artifact already committed)
   *  - `after_run` fail → run stays "completed", we log + audit (no
   *    cascade; cleanup_failed flag would require a schema change V1)
   *  - `inject` total > 100 KB → `HOOK_INJECT_TOO_LARGE`, step fail
   *  - hook timeout 30 s → step fail (same as fail)
   */
  workflowHooks?: WorkflowHooksService;
  /**
   * Optional workflow-assignments service (T3.3 wire). When provided, the
   * orchestrator snapshots step assignments at `launchWorkflow` time
   * (initial resolution for every step in the DAG) and re-evaluates at
   * `launchStep` time (delta INSERT — assignments are append-only).
   *
   * When omitted (e.g. early dev / tests), assignment is a no-op and the
   * inbox stays empty — backward compatible.
   */
  workflowAssignments?: GovernedWorkflowsAssignmentsService;
}

/**
 * Maximum total bytes of `inject.context_md` from `before_step` /
 * `before_run` hooks merged into `prompt_context.injected_by_hooks`.
 * Sized so a malicious or runaway hook cannot DoS the next step's LLM
 * call by stuffing the prompt context with megabytes of text.
 */
const MAX_INJECT_TOTAL_BYTES = 100 * 1024;

export interface GetWorkflowParsedResult {
  workflow: WorkflowDefinition;
  gitTag: string;
  gitSha: string;
  /** Repo-relative path to the workflow.json in the workflows repo. */
  workflowRepoPath: string;
}

export interface LaunchWorkflowArgs {
  companyId: string;
  name: string;
  gitTag?: string;
  params: Record<string, unknown>;
  actor: { type: AuditActorType; id: string };
}

export interface LaunchWorkflowResult {
  runId: string;
  firstStep: string;
  gitTag: string;
  gitSha: string;
}

export interface RunStepSummary {
  id: string;
  state: string;
  artifactOk: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface GetRunResult {
  runId: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledByActorId: string | null;
  cancelledByActorType: AuditActorType | null;
  cancellationReason: string | null;
  steps: RunStepSummary[];
  lastGateResult: {
    gateIdInJson: string;
    kind: string;
    pass: boolean;
    report: string;
    errorCode: string | null;
    hints: string[];
    evaluatedAt: Date;
  } | null;
}

export interface LaunchStepArgs {
  companyId: string;
  runId: string;
  stepId: string;
  actor: { type: AuditActorType; id: string };
  /**
   * Map of locally-materialized agent name → content sha. Passed by the
   * harness so the server can detect stale agents and return AGENTS_STALE
   * with fresh content (see spec §T6 "self-correction").
   */
  currentAgents?: Record<string, string>;
  /**
   * List of tool names currently available in the Claude Code session. Used
   * by the entry gate to short-circuit with MISSING_TOOLS when a required
   * MCP/skill/hook is absent. Optional — undefined means "no check".
   */
  sessionTools?: string[];
}

export interface LaunchStepResult {
  // ── agent-step branch (existing) — fields are populated when the step's
  //    type is "agent" (default). The harness dispatches subagentType and
  //    consumes promptContext + handoffs.
  agentName?: string;
  promptContext?: Record<string, unknown>;
  subagentType?: string;
  handoffs?: Handoff[];
  runBranch?: string;
  /**
   * Set when the step's exit gates include the canonical
   * session-file-bundled gate. The harness MUST resolve the path_template
   * (with ${HOME}, ${CWD_DASHED}, ${SESSION_ID}) and bundle the resulting
   * .jsonl into artifact.data.session_file at completeStep.
   */
  sessionCapture?: import("./session-bundle/index.js").SessionCaptureConfig;
  // ── composite-step branch (T5.3) — populated when the step's type is
  //    "composite". The harness should treat the sub-run as the next launch
  //    target: navigate to it and call launchStep on its `firstStep`. There
  //    is no agent to dispatch on the parent run for this step.
  composite?: {
    subRunId: string;
    rootRunId: string;
    /** First step of the sub-workflow (the entry into the DAG). */
    firstStep: string;
    /** Sub-workflow git tag/sha (pinned at expansion time). */
    subWorkflowGitTag: string;
    subWorkflowGitSha: string;
  };
}

export interface CompleteStepArgs {
  companyId: string;
  runId: string;
  stepId: string;
  artifact: ArtifactInput;
  actor: { type: AuditActorType; id: string };
}

export interface CompleteStepResult {
  stepState: "succeeded";
  runStatus: "active" | "completed";
}

export interface SyncEnvironmentArgs {
  companyId: string;
  lastSyncedSha?: string;
  userId?: string | null;
}

export interface SyncedAgent {
  name: string;
  mdContent: string;
  /**
   * Merged config items partitioned by itemType. The four buckets map to
   * CONFIG_LAYER_ITEM_TYPES with two exclusions:
   *  - "skill"        — skills live as plugin artifacts, not per-agent config
   *  - "git_provider" — resolved by resolveGitProvider per-company (see T2)
   * Items within a bucket are priority-merged: one entry per `name`, winning
   * item comes from the highest-priority layer (company-enforced beats base).
   */
  configMerged: {
    mcp: MergedConfigItem[];
    hook: MergedConfigItem[];
    setting: MergedConfigItem[];
    credential: MergedConfigItem[];
  };
}

export interface SyncEnvironmentResult {
  agents: SyncedAgent[];
  newSha: string;
  hasChanges: boolean;
}

export interface SetupWorkspaceArgs {
  companyId: string;
  /**
   * The authenticated user issuing the call. Propagated to `resolveGitProvider`
   * so the per-user GitLab OAuth token (from `authAccounts`) is preferred over
   * the company-level PAT / env-var fallback. `null` is allowed for callsites
   * that genuinely have no user identity (e.g. system-initiated syncs).
   */
  userId?: string | null;
}

/**
 * Agent record returned by setupWorkspace for the harness to materialize
 * at user scope. The `name` is pre-prefixed with `mnm--` to avoid name
 * collisions with user-defined agents in `~/.claude/agents/`. `targetPath`
 * uses `~` placeholder — the harness is responsible for resolving home.
 */
export interface SetupWorkspaceAgent {
  /** Namespaced agent name, e.g. "mnm--greeter". */
  name: string;
  /** Full agent.md content (frontmatter + body). */
  content: string;
  /** Git sha of the content for stale-detection on subsequent launchStep calls. */
  sha: string;
  /** Instruction-style path hint: `~/.claude/agents/mnm--<name>.md`. */
  targetPath: string;
}

export interface SetupWorkspaceResult {
  agents: SetupWorkspaceAgent[];
  /**
   * Human-readable directive for the harness. The harness should Write each
   * `agent.content` to `agent.targetPath`. Emitted as a plain string so the
   * MCP tool can bubble it to the Claude Code session.
   */
  instructions: string;
}

export interface PushLocalStateArgs {
  companyId: string;
  pluginVersion: string;
}

/**
 * Payload the harness should persist to
 * `${CLAUDE_PLUGIN_DATA}/last-session.json` — read by the SessionStart hook.
 *
 * Scope is intentionally narrow: only the plugin version, used by the hook
 * to detect upgrades and prompt re-sync. Live DB state (active runs, open
 * issues) is NOT cached here — the hook has no network access, so any
 * cached counter goes stale and silently misleads the model. Active state
 * is discovered on demand via `list_governed_workflow_runs`.
 */
export interface PushLocalStatePayload {
  lastPluginVersion: string;
}

export interface PushLocalStateResult {
  /** Relative path under `${CLAUDE_PLUGIN_DATA}/` the harness should write to. */
  targetRelativePath: string;
  content: PushLocalStatePayload;
}

/**
 * Actor shape consumed by mutation methods (cancelRun, reactivateRun). Matches
 * the existing `{ type: AuditActorType; id: string }` pattern used by
 * launchWorkflow/launchStep/completeStep so callsites don't need to translate.
 */
export type Actor = { type: AuditActorType; id: string };

export interface CancelRunArgs {
  runId: string;
  companyId: string;
  actor: Actor;
  reason: string;
  /**
   * SSE/WS publisher. Injected (rather than imported as a module-level
   * default) so unit tests can substitute a `vi.fn()` and assert the
   * `governed_run.cancelled` payload without mocking the live-events
   * singleton.
   */
  publishLiveEvent: PublishFn;
}

export interface CancelRunResult {
  runId: string;
  cancelledAt: Date;
  cancelledStepIds: string[];
}

export interface ReactivateRunArgs {
  runId: string;
  companyId: string;
  actor: Actor;
  /**
   * SSE/WS publisher. Injected (rather than imported as a module-level
   * default) so unit tests can substitute a `vi.fn()` and assert the
   * `governed_run.reactivated` payload without mocking the live-events
   * singleton.
   */
  publishLiveEvent: PublishFn;
}

export interface ReactivateRunResult {
  runId: string;
  reactivatedStepIds: string[];
}

/**
 * Walks the prompt_context template tree and replaces `{{path}}` placeholders
 * with resolved values from `scope`. When the resolved leaf is an
 * OutputPersisted (has a `kind` field), applies kind-specific eager resolution:
 *   - git_file  → fetches blob content from Git (text inlined)
 *   - git_folder → placeholder string  (folders shouldn't be inlined)
 *   - external_url → inlines the URL string
 *
 * Unknown placeholders are left as literal `{{path}}` strings so that
 * downstream validators can report them clearly.
 *
 * Exported at module level so it can be unit-tested independently of the
 * service factory.
 */
export async function interpolatePromptContext(
  template: Record<string, unknown>,
  scope: { variables: Record<string, unknown>; steps: Record<string, unknown> },
  gitProvider: GitProvider,
): Promise<Record<string, unknown>> {
  const walk = async (v: unknown): Promise<unknown> => {
    if (typeof v === "string") {
      // Allow `-` in identifiers — workflow step IDs use kebab-case
      // (`tech-design`, `merge-tag`). Without this, any path containing
      // a step ID with a hyphen returned the literal `{{...}}`.
      const regex = /\{\{\s*([a-zA-Z0-9_.\-]+)\s*\}\}/g;
      const matches = [...v.matchAll(regex)];
      if (matches.length === 0) return v;

      const replacements = await Promise.all(
        matches.map(async (m) => {
          const path = m[1]!;
          const parts = path.split(".");
          let cur: any = scope;
          for (const p of parts) {
            cur = cur?.[p];
            if (cur === undefined) return `{{${path}}}`;
          }
          // If the resolved leaf is an OutputPersisted, apply kind-specific
          // eager resolution so downstream agents receive content, not JSON.
          if (cur && typeof cur === "object" && "kind" in cur) {
            const output = cur as OutputPersisted;
            if (output.kind === "git_file") {
              return await gitProvider.fetchBlob({ ref: output.git_sha, path: output.path });
            }
            if (output.kind === "external_url") {
              return output.url;
            }
            if (output.kind === "git_folder") {
              return `<folder: ${output.path}, ${(output.files ?? []).length} files>`;
            }
          }
          return typeof cur === "string" || typeof cur === "number"
            ? String(cur)
            : JSON.stringify(cur);
        }),
      );

      // Rebuild the string by substituting each match in order.
      let result = "";
      let lastIdx = 0;
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i]!;
        result += v.slice(lastIdx, m.index!);
        result += replacements[i];
        lastIdx = m.index! + m[0].length;
      }
      result += v.slice(lastIdx);
      return result;
    }
    if (Array.isArray(v)) return await Promise.all(v.map(walk));
    if (v && typeof v === "object") {
      const entries = await Promise.all(
        Object.entries(v).map(async ([k, val]) => [k, await walk(val)] as const),
      );
      return Object.fromEntries(entries);
    }
    return v;
  };
  return (await walk(template)) as Record<string, unknown>;
}

/**
 * Domain service for Governed Workflows. All reads are RLS-scoped — the
 * caller must have set `app.current_company_id` via `setTenantContext`
 * before invoking. Writes take `companyId` explicitly and include it in
 * INSERT / WHERE clauses for defense-in-depth.
 */
export function governedWorkflowService(db: Db, deps: GovernedWorkflowServiceDeps) {
  const { resolveGitProvider, shaCache } = deps;
  const heartbeatDep = deps.heartbeat;
  const traceDep = deps.traceService;
  const hooksSvc = deps.workflowHooks;
  const assignmentsSvc = deps.workflowAssignments;

  // ─── Workflow hooks wire (T2.7) ─────────────────────────────────────────

  /**
   * Aggregated outcome of a hook batch (all hooks for one phase). Returned
   * to the caller (launchWorkflow / launchStep / completeStep / run
   * completion) so it can short-circuit on failure with a precise error.
   */
  interface HookBatchOutcome {
    /** Did every hook in the batch succeed (ok === true) ? */
    ok: boolean;
    /** First failure surfaced; absent when ok=true. */
    firstFailure?: {
      ref: string;
      errorCode: string;
      report: string;
    };
    /** Concatenated `inject.context_md` from successful before_* hooks. */
    injectMd: string;
    /** Per-hook trace for audit / debug. */
    evaluations: Array<{ ref: string; ok: boolean; errorCode?: string }>;
  }

  /**
   * Run the hooks for a given phase sequentially. Aggregates `inject`
   * context-md across successful before_* hooks (subject to the
   * MAX_INJECT_TOTAL_BYTES budget — anything over → HOOK_INJECT_TOO_LARGE,
   * batch fails). Returns the first failure encountered; subsequent hooks
   * are skipped.
   *
   * If `workflowHooks` was not wired at service construction, this is a
   * no-op returning ok:true (backward compat).
   */
  async function runHookPhase(args: {
    phase: "before_run" | "before_step" | "after_step" | "after_run";
    runId: string;
    stepExecutionId?: string;
    workflowGitSha: string;
    actor: { type: AuditActorType; id: string };
    companyId: string;
    workflow: WorkflowDefinition;
    step?: { id: string; hooks?: HookBlock };
    hookCtx: WorkflowHookCtx;
  }): Promise<HookBatchOutcome> {
    if (!hooksSvc) {
      return { ok: true, injectMd: "", evaluations: [] };
    }
    const principalId = args.actor.id;
    const resolved = await hooksSvc.resolveHooksForStep({
      stepHooks: args.step?.hooks,
      runHooks: args.workflow.hooks,
      phase: args.phase,
      principalId,
      companyId: args.companyId,
    });
    if (resolved.length === 0) {
      return { ok: true, injectMd: "", evaluations: [] };
    }

    const evaluations: HookBatchOutcome["evaluations"] = [];
    const injectParts: string[] = [];
    let injectBytes = 0;

    for (const r of resolved) {
      let evaluation: HookEvaluationResult;
      try {
        evaluation = await hooksSvc.executeHook(r, {
          companyId: args.companyId,
          actorUserId: principalId,
          runId: args.runId,
          stepExecutionId: args.stepExecutionId,
          workflowGitSha: args.workflowGitSha,
          hookCtx: args.hookCtx,
        });
      } catch (err) {
        // executeHook itself should not throw — but defend against
        // unexpected runtime errors (DB transient, etc.). Treat as a
        // hook failure for the batch.
        const message = err instanceof Error ? err.message : String(err);
        evaluations.push({
          ref: r.ref,
          ok: false,
          errorCode: "HOOK_EXCEPTION",
        });
        return {
          ok: false,
          firstFailure: {
            ref: r.ref,
            errorCode: "HOOK_EXCEPTION",
            report: `Hook execution threw: ${message}`,
          },
          injectMd: injectParts.join("\n\n---\n\n"),
          evaluations,
        };
      }

      evaluations.push({
        ref: r.ref,
        ok: evaluation.ok,
        ...(evaluation.error_code ? { errorCode: evaluation.error_code } : {}),
      });

      if (!evaluation.ok) {
        return {
          ok: false,
          firstFailure: {
            ref: r.ref,
            errorCode: evaluation.error_code ?? "HOOK_EXCEPTION",
            report: evaluation.report,
          },
          injectMd: injectParts.join("\n\n---\n\n"),
          evaluations,
        };
      }

      // Aggregate `inject.context_md` for before_* phases.
      if (
        (args.phase === "before_run" || args.phase === "before_step") &&
        evaluation.result?.inject?.context_md
      ) {
        const part = evaluation.result.inject.context_md;
        const partBytes = Buffer.byteLength(part, "utf8");
        if (injectBytes + partBytes > MAX_INJECT_TOTAL_BYTES) {
          return {
            ok: false,
            firstFailure: {
              ref: r.ref,
              errorCode: "HOOK_INJECT_TOO_LARGE",
              report: `Total inject bytes (${injectBytes + partBytes}) exceeds ${MAX_INJECT_TOTAL_BYTES}`,
            },
            injectMd: injectParts.join("\n\n---\n\n"),
            evaluations,
          };
        }
        injectParts.push(part);
        injectBytes += partBytes;
      }
    }

    return {
      ok: true,
      injectMd: injectParts.join("\n\n---\n\n"),
      evaluations,
    };
  }

  /**
   * Build the `HookContext` passed to `runHookPhase`. The context
   * matches `@mnm/workflow-hooks.HookContext` shape. `helpers` is filled
   * by the runner; we pass an empty placeholder — the runner overrides
   * it via `installHelpers` inside the isolate.
   */
  function buildHookCtx(args: {
    phase: "before_run" | "before_step" | "after_step" | "after_run";
    runId: string;
    workflowName: string;
    workflowGitTag: string;
    runParams: Record<string, unknown>;
    stepId?: string;
    previousArtifacts?: Record<string, unknown>;
    artifact?: unknown;
    config?: Record<string, unknown>;
  }): WorkflowHookCtx {
    return {
      artifact: args.artifact,
      run: {
        id: args.runId,
        workflow_name: args.workflowName,
        git_tag: args.workflowGitTag,
        params: args.runParams,
      },
      step: {
        id: args.stepId ?? "",
        previous_artifacts: args.previousArtifacts ?? {},
      },
      config: args.config ?? {},
      phase: args.phase,
      // Real helpers are wired by the runner via installHelpers; the
      // value here is a placeholder that satisfies the type but is
      // never read inside the isolate (the isolate's `ctx.helpers.*`
      // proxies are installed by the runner, separate from this host
      // ctx object).
      helpers: {} as never,
    };
  }

  /**
   * Detect whether a step opts into the session-bundle path by declaring
   * the canonical gate `session-file-bundled` in its exit gates. The check
   * is on the source path (workflow authors copy the canonical file into
   * their workflow repo, typically as `gates/session-file-bundled.gate.ts`).
   */
  function usesSessionBundleGate(step: { gates?: { exit?: GateBlock } }): boolean {
    const exit = step.gates?.exit;
    if (!exit || exit.length === 0) return false;
    // GateBlock entries can be a single GateItem or a GateItem[] (parallel).
    // Flatten one level and check sources.
    for (const entry of exit) {
      const items = Array.isArray(entry) ? entry : [entry];
      for (const item of items) {
        if (
          item.source.endsWith("session-file-bundled.gate.ts") ||
          item.source.endsWith("session-file-bundled.gate.js")
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Build a FinalizeDeps adapter on the fly. Needs db (for the heartbeat_runs
   * update) + the trace service. Used in completeStep when the step has a
   * client heartbeat_run linked.
   */
  function buildFinalizeDeps(): FinalizeDeps | null {
    if (!traceDep) return null;
    return {
      getRun: async (id) => {
        const row = await db
          .select({
            id: heartbeatRuns.id,
            companyId: heartbeatRuns.companyId,
            agentId: heartbeatRuns.agentId,
            status: heartbeatRuns.status,
            bundleSha256: heartbeatRuns.bundleSha256,
          })
          .from(heartbeatRuns)
          .where(eq(heartbeatRuns.id, id))
          .then((r) => r[0] ?? null);
        return row;
      },
      updateRun: async (id, patch) => {
        await db
          .update(heartbeatRuns)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(heartbeatRuns.id, id));
      },
      traceService: traceDep,
      // Cast widening : finalize types its event type as string, the real
      // publishLiveEvent is a strict literal union. We only ever publish
      // "heartbeat.run.status" which IS in the union, so this is safe.
      publishLiveEvent: publishLiveEvent as unknown as FinalizeDeps["publishLiveEvent"],
    };
  }

  // ─── Discovery ──────────────────────────────────────────────────

  async function listDefinitions(args: { companyId: string; enabled?: boolean }) {
    const conds = [
      eq(governedWorkflowDefinitions.companyId, args.companyId),
      isNull(governedWorkflowDefinitions.archivedAt),
    ];
    if (args.enabled !== undefined) {
      conds.push(eq(governedWorkflowDefinitions.enabled, args.enabled));
    }
    return db
      .select()
      .from(governedWorkflowDefinitions)
      .where(and(...conds))
      .orderBy(governedWorkflowDefinitions.name);
  }

  async function getDefinition(args: { companyId: string; name: string }) {
    const [row] = await db
      .select()
      .from(governedWorkflowDefinitions)
      .where(
        and(
          eq(governedWorkflowDefinitions.companyId, args.companyId),
          eq(governedWorkflowDefinitions.name, args.name),
        ),
      );
    return row ?? null;
  }

  /**
   * Fetch + parse a workflow at a specific tag (or the definition's
   * `latest_git_tag` if unspecified). Validates against the zod schema in
   * `@mnm/governed-workflows`. Caches by (sha, path).
   *
   * Path convention: resolveResourcePath(provider, "workflow", name, "workflow.json")
   * honours the `paths.workflows` prefix from the provider config_layer_item (§5.5).
   */
  async function getWorkflowParsed(args: {
    companyId: string;
    name: string;
    gitTag?: string;
    /**
     * Optional BetterAuth user id. When provided, the resolver prefers the
     * user's GitLab OAuth token (via Bearer auth) over the company-level PAT.
     * Without it we fall back to company config — fine for system/agent flows
     * but in `authenticated` mode the company token is often a placeholder
     * because user-token resolution is the canonical path.
     */
    userId?: string | null;
  }): Promise<GetWorkflowParsedResult> {
    const def = await getDefinition({ companyId: args.companyId, name: args.name });
    if (!def) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `No governed workflow named '${args.name}'`,
        [`Call list_governed_workflows to see available workflows`],
      );
    }

    const ref = args.gitTag ?? def.latestGitTag;
    if (!ref) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}' has no latest_git_tag and no git_tag supplied`,
        [`Pass git_tag explicitly or set the definition's latest_git_tag`],
      );
    }

    const gitProvider = await resolveGitProvider({
      companyId: args.companyId,
      userId: args.userId ?? null,
      resourceType: "workflow",
    });
    const gitSha = await gitProvider.resolveRef({ ref });
    const workflowRepoPath = resolveResourcePath(gitProvider as unknown as ProviderWithPaths, "workflow", args.name, "workflow.json");

    // ShaCache exposes get/set rather than getOrFetch — use them directly.
    const cached = shaCache.get(PROVIDER_ID, workflowRepoPath, gitSha);
    const rawJson = cached !== undefined
      ? cached
      : await (async () => {
          const blob = await gitProvider.fetchBlob({ path: workflowRepoPath, ref: gitSha });
          shaCache.set(PROVIDER_ID, workflowRepoPath, gitSha, blob);
          return blob;
        })();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}'@${ref} has invalid JSON: ${(err as Error).message}`,
      );
    }

    const result = workflowDefinitionSchema.safeParse(parsed);
    if (!result.success) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}'@${ref} failed schema validation: ${result.error.message}`,
      );
    }

    return {
      workflow: result.data,
      gitTag: ref,
      gitSha,
      workflowRepoPath,
    };
  }

  /**
   * Launch a governed workflow run. Fetches + parses the workflow at the
   * pinned tag, takes a PG advisory-xact lock keyed on the definition id
   * (to serialise concurrent launches of the same workflow — prevents
   * interleaved step inserts), and inserts one `governed_workflow_runs`
   * row + one `governed_step_executions` row per step (state=pending).
   *
   * The lock is released at TX commit/rollback. Key = hashtext of
   * 'mnm:launch:<def_id>' so the namespace is disjoint from other
   * advisory locks in the codebase.
   *
   * `firstStep` is the id of the first step with empty `deps` in parse
   * order. Workflows with multiple zero-dep steps get the FIRST one —
   * gates and/or dep ordering are the author's responsibility beyond
   * that.
   */
  async function launchWorkflow(args: LaunchWorkflowArgs): Promise<LaunchWorkflowResult> {
    const parsed = await getWorkflowParsed({
      companyId: args.companyId,
      name: args.name,
      gitTag: args.gitTag,
      userId: args.actor.type === "user" ? args.actor.id : null,
    });

    const def = await getDefinition({ companyId: args.companyId, name: args.name });
    // def cannot be null here — getWorkflowParsed already validated existence.
    if (!def) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}' vanished between parse and launch`,
      );
    }

    const firstStep = parsed.workflow.steps.find((s) => s.deps.length === 0);
    if (!firstStep) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow '${args.name}' has no step with empty deps — cannot launch`,
      );
    }

    return await db.transaction(async (tx) => {
      // Advisory lock: disambiguate namespace with a prefix so we don't
      // collide with other lock users. Scope per-definition so unrelated
      // workflows can launch concurrently.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${"mnm:launch:" + def.id}))`,
      );

      // PHASE-4: seed lastUsefulActionAt with startedAt so the liveness
      // watchdog has a baseline to compare against. Otherwise a freshly
      // launched run would have NULL lastUsefulActionAt and slip past the
      // detectStalledRuns filter forever (the watchdog skips NULLs as a
      // bootstrapping window). nextActionHint mirrors what the runtime
      // would set on its first useful tick.
      const launchedAt = new Date();
      const [run] = await tx
        .insert(governedWorkflowRuns)
        .values({
          companyId: args.companyId,
          workflowDefId: def.id,
          workflowGitTag: parsed.gitTag,
          workflowGitSha: parsed.gitSha,
          initiatedByActorType: args.actor.type,
          initiatedByActorId: args.actor.id,
          status: "active",
          startedAt: launchedAt,
          lastUsefulActionAt: launchedAt,
          nextActionHint: "run launched",
          paramsJson: args.params,
        })
        .returning({ id: governedWorkflowRuns.id });

      // Stamp createdAt with a per-step offset so ORDER BY created_at preserves
      // the workflow.json declaration order. A bulk insert with defaultNow()
      // gives every row the same microsecond, after which PG's natural row
      // order is implementation-defined — the UI then renders steps in a
      // jumbled order (merge-tag before tech-design, etc.). 1 ms per index
      // is well below human perception and below the run-level startedAt
      // granularity, so it doesn't break any audit query.
      const baseTime = Date.now();
      const insertedSteps = await tx
        .insert(governedStepExecutions)
        .values(
          parsed.workflow.steps.map((s, idx) => ({
            companyId: args.companyId,
            runId: run.id,
            stepIdInJson: s.id,
            state: "pending" as const,
            createdAt: new Date(baseTime + idx),
          })),
        )
        .returning({
          id: governedStepExecutions.id,
          stepIdInJson: governedStepExecutions.stepIdInJson,
        });

      return {
        runId: run.id,
        firstStep: firstStep.id,
        gitTag: parsed.gitTag,
        gitSha: parsed.gitSha,
        // Map of step-id-in-json → step_execution.id (uuid). Needed by the
        // T3.3 assignment snapshot below.
        stepExecIdsByName: Object.fromEntries(
          insertedSteps.map((s) => [s.stepIdInJson, s.id]),
        ) as Record<string, string>,
      };
    }).then(async (result) => {
      // ── T3.3: snapshot step assignments ──────────────────────────────────
      // Wired AFTER the launch tx commits so the (run, steps) FK targets
      // exist. For every step that declares an `assignment`, resolve the
      // principal set and persist a row per (step_execution, principal).
      // Failures are best-effort: snapshotting must not block run launch
      // (the run is already committed). We log via the live event bus
      // instead so dashboards surface the issue.
      if (assignmentsSvc) {
        for (const step of parsed.workflow.steps) {
          if (!step.assignment) continue;
          const stepExecId = result.stepExecIdsByName[step.id];
          if (!stepExecId) continue;
          try {
            const entries = await assignmentsSvc.resolveAssignment({
              companyId: args.companyId,
              assignment: step.assignment,
            });
            const inserted = await assignmentsSvc.snapshotStepAssignments({
              companyId: args.companyId,
              stepExecutionId: stepExecId,
              entries,
            });
            // Publish step.assignment.created for every fresh row so each
            // assigned principal gets a sidebar badge update in real time.
            for (const row of inserted) {
              publishLiveEvent({
                companyId: args.companyId,
                type: "step.assignment.created",
                payload: {
                  step_execution_id: row.stepExecutionId,
                  principal_id: row.principalId,
                  reason: row.reason,
                  run_id: result.runId,
                  workflow_name: parsed.workflow.name,
                  step_name: step.id,
                },
                visibility: { scope: "actor-only", actorId: row.principalId },
              });
            }
          } catch (err) {
            // Swallow: snapshotting is non-critical for the launch path.
            // eslint-disable-next-line no-console
            console.warn(
              "[governed-workflows] step assignment snapshot failed",
              { runId: result.runId, stepId: step.id, err: String(err) },
            );
          }
        }
      }


      // ── T2.7: before_run hooks ───────────────────────────────────────────
      // Wired AFTER the launch transaction commits so the run row + step
      // executions exist (so audit FKs can target them). A failure flips
      // the run to "failed" with HOOK_FAILED:<ref>. The run row is
      // committed first; on hook failure we mark it failed in a follow-up
      // tx (separate from the launch tx so audit rows survive).
      const hookOutcome = await runHookPhase({
        phase: "before_run",
        runId: result.runId,
        workflowGitSha: result.gitSha,
        actor: args.actor,
        companyId: args.companyId,
        workflow: parsed.workflow,
        hookCtx: buildHookCtx({
          phase: "before_run",
          runId: result.runId,
          workflowName: parsed.workflow.name,
          workflowGitTag: result.gitTag,
          runParams: args.params,
        }),
      });
      if (!hookOutcome.ok) {
        // Roll the run forward to "failed" and surface a typed error.
        // before_run hooks have no `inject` consumer (no step is running
        // yet), so a failure here is purely diagnostic.
        await db
          .update(governedWorkflowRuns)
          .set({
            status: "failed",
            completedAt: new Date(),
          })
          .where(eq(governedWorkflowRuns.id, result.runId));
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
          `before_run hook '${hookOutcome.firstFailure!.ref}' failed: ${hookOutcome.firstFailure!.report}`,
          [
            `Hook error_code: ${hookOutcome.firstFailure!.errorCode}`,
            "Disable / fix the hook config or remove it from workflow.json hooks.before",
          ],
          { hook_ref: hookOutcome.firstFailure!.ref, hook_error: hookOutcome.firstFailure!.errorCode },
        );
      }
      return result;
    });
  }

  /**
   * Return the state of a single run. RLS is already enforced by the
   * active tenant context, but we double-check companyId in the WHERE
   * clause for defense-in-depth. Cross-tenant lookups MUST return
   * WORKFLOW_RUN_NOT_FOUND (not a 403) so existence is never leaked.
   */
  async function getRun(args: { companyId: string; runId: string }): Promise<GetRunResult> {
    const [run] = await db
      .select()
      .from(governedWorkflowRuns)
      .where(
        and(
          eq(governedWorkflowRuns.id, args.runId),
          eq(governedWorkflowRuns.companyId, args.companyId),
        ),
      );
    if (!run) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
        `Run '${args.runId}' not found`,
        [`Verify runId via list_governed_workflows + launchWorkflow`],
      );
    }

    const steps = await db
      .select()
      .from(governedStepExecutions)
      .where(eq(governedStepExecutions.runId, args.runId))
      .orderBy(governedStepExecutions.createdAt);

    const [lastGate] = await db
      .select()
      .from(gateResults)
      .where(eq(gateResults.runId, args.runId))
      .orderBy(desc(gateResults.evaluatedAt))
      .limit(1);

    return {
      runId: run.id,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      cancelledAt: run.cancelledAt,
      cancelledByActorId: run.cancelledByActorId,
      cancelledByActorType: run.cancelledByActorType,
      cancellationReason: run.cancellationReason,
      steps: steps.map((s) => ({
        id: s.stepIdInJson,
        state: s.state,
        artifactOk: s.state === "succeeded",
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      lastGateResult: lastGate
        ? {
            gateIdInJson: lastGate.gateIdInJson,
            kind: lastGate.kind,
            pass: lastGate.pass,
            report: lastGate.report,
            errorCode: lastGate.errorCode,
            hints: lastGate.hints ?? [],
            evaluatedAt: lastGate.evaluatedAt,
          }
        : null,
    };
  }

  // ─── Step lifecycle ──────────────────────────────────────────────

  /**
   * Throws WORKFLOW_RUN_CANCELLED when the run row is in a cancelled state
   * (cancelledAt IS NOT NULL). Used by launchStep / completeStep to refuse
   * any state mutation on a cancelled run BEFORE running cheaper checks
   * (deps, step state) — the user must see "this run is cancelled" first,
   * not a misleading "step isn't in running state" that would surface once
   * the cancel cascade has moved the step to `cancelled`.
   *
   * The third arg of GovernedWorkflowError is `hints: string[]` — we pack
   * the reason and a recovery suggestion there so the harness can render
   * them next to the error message verbatim.
   */
  function assertRunNotCancelled(run: {
    cancelledAt: Date | null;
    cancellationReason: string | null;
    id: string;
  }): void {
    if (run.cancelledAt === null) return;
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_RUN_CANCELLED,
      `Run ${run.id} is cancelled (since ${run.cancelledAt.toISOString()}).`,
      [
        `Reason: ${run.cancellationReason ?? "(none)"}`,
        "Use mcp__plugin_mnm_mnm__reactivate_governed_workflow_run to resume.",
      ],
    );
  }

  /**
   * Authorize a step launch. Verifies all deps are `succeeded`, evaluates
   * the entry gate block (if any) through `runGateBlock`, persists the
   * gate_result rows, and returns the {agent, prompt_context, subagent_type}
   * triplet for the Claude Code harness.
   *
   * On gate failure, rolls the step back to `pending` and throws
   * `WORKFLOW_GATE_FAILED`. No state corruption — the step becomes
   * eligible for a later retry once the author fixes whatever the gate
   * flagged. (Retry surface is a T7+ concern; T5 only exposes the gate
   * verdict truthfully.)
   */
  async function launchStep(args: LaunchStepArgs): Promise<LaunchStepResult> {
    const run = await getRun({ companyId: args.companyId, runId: args.runId });

    // Cancelled-run guard. Runs BEFORE any state mutation (or even the
    // workflow re-parse) so that the harness gets a clear
    // WORKFLOW_RUN_CANCELLED error rather than the WORKFLOW_DEPENDENCY_UNMET
    // / WORKFLOW_STEP_NOT_FOUND it would otherwise hit on a cancelled run
    // whose steps have been cascaded to `cancelled`.
    const [runRow] = await db
      .select({
        id: governedWorkflowRuns.id,
        cancelledAt: governedWorkflowRuns.cancelledAt,
        cancellationReason: governedWorkflowRuns.cancellationReason,
      })
      .from(governedWorkflowRuns)
      .where(
        and(
          eq(governedWorkflowRuns.id, args.runId),
          eq(governedWorkflowRuns.companyId, args.companyId),
        ),
      );
    // getRun already threw WORKFLOW_RUN_NOT_FOUND if the row was missing,
    // so runRow is guaranteed defined here. Defensive guard kept in case
    // of a TOCTOU race (run deleted between getRun and this SELECT).
    if (!runRow) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
        `Run '${args.runId}' not found`,
      );
    }
    assertRunNotCancelled(runRow);

    // Re-parse the workflow at the run's pinned sha.
    const defInfo = await getDefByRun(args.companyId, args.runId);
    const parsed = await getWorkflowParsed({
      companyId: args.companyId,
      name: defInfo.name,
      gitTag: defInfo.workflowGitTag,
      userId: args.actor.type === "user" ? args.actor.id : null,
    });
    // TODO(performance): avoid re-fetching the workflow on every launchStep.
    // For MVP, the ShaCache makes this a single-map lookup after the first
    // call per run (see T3 ShaCache). Acceptable given N<<M in practice.

    const step = parsed.workflow.steps.find((s) => s.id === args.stepId);
    if (!step) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_STEP_NOT_FOUND,
        `Step '${args.stepId}' not in workflow`,
      );
    }

    // Deps check — all deps must be succeeded.
    if (step.deps.length > 0) {
      const missing = step.deps.filter((d) => {
        const s = run.steps.find((r) => r.id === d);
        return !s || s.state !== "succeeded";
      });
      if (missing.length > 0) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_DEPENDENCY_UNMET,
          `Cannot launch '${args.stepId}': missing ${missing.join(", ")}`,
          [
            `Launch ${missing[0]} first and complete it successfully`,
            `Check get_governed_workflow_run for step order`,
          ],
        );
      }
    }

    // ── T5.3 — composite branch: expand the step into a sub-run ────────
    // Composite steps don't dispatch an agent — they launch a sub-run of
    // another workflow. The harness then drives the sub-run as if it were
    // a brand-new top-level run (calling launchStep on the sub-run's
    // firstStep). The parent step row stays in `running` state until
    // completeStep is called on it (after the sub-run completes).
    if (step.type === "composite") {
      if (!step.uses) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_USES_INVALID,
          `composite step '${args.stepId}' is missing uses:`,
        );
      }
      const { name: subName, ref: subRef } = parseCompositeUses(step.uses);
      const subParsed = await getWorkflowParsed({
        companyId: args.companyId,
        name: subName,
        gitTag: subRef,
        userId: args.actor.type === "user" ? args.actor.id : null,
      });
      const subDef = await getDefinition({ companyId: args.companyId, name: subName });
      if (!subDef) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_COMPOSITE_USES_NOT_FOUND,
          `composite step '${args.stepId}' references unknown workflow '${step.uses}'`,
        );
      }
      const subFirstStep = subParsed.workflow.steps.find((s) => s.deps.length === 0);
      if (!subFirstStep) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
          `Sub-workflow '${subName}' has no step with empty deps — cannot expand composite`,
        );
      }

      // Mark parent composite step running before launching sub-run so
      // observers see the transition, not a stale "pending".
      await db
        .update(governedStepExecutions)
        .set({
          state: "running",
          startedAt: new Date(),
          launchedByActorType: args.actor.type,
          launchedByActorId: args.actor.id,
        })
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            eq(governedStepExecutions.stepIdInJson, args.stepId),
          ),
        );
      const [parentStepRow] = await db
        .select({ id: governedStepExecutions.id })
        .from(governedStepExecutions)
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            eq(governedStepExecutions.stepIdInJson, args.stepId),
          ),
        );

      const launched = await launchCompositeStep(db, {
        parentStepExecutionId: parentStepRow.id,
        parentRunId: args.runId,
        subWorkflow: subParsed.workflow,
        subWorkflowGitTag: subParsed.gitTag,
        subWorkflowGitSha: subParsed.gitSha,
        subWorkflowDefId: subDef.id,
        params: (step.params ?? {}) as Record<string, unknown>,
        actor: args.actor,
        companyId: args.companyId,
      });

      publishLiveEvent({
        companyId: args.companyId,
        type: "step.composite.launched",
        payload: {
          run_id: args.runId,
          step_id: args.stepId,
          step_execution_id: parentStepRow.id,
          sub_run_id: launched.subRunId,
          root_run_id: launched.rootRunId,
          sub_workflow_name: subName,
          sub_workflow_git_tag: subParsed.gitTag,
        },
        visibility: { scope: "company-wide" },
      });

      return {
        composite: {
          subRunId: launched.subRunId,
          rootRunId: launched.rootRunId,
          firstStep: subFirstStep.id,
          subWorkflowGitTag: subParsed.gitTag,
          subWorkflowGitSha: subParsed.gitSha,
        },
      };
    }
    // ── T6 self-correction: detect stale local agents ──────────────────
    // Every agent step references exactly one agent (step.agent). Compare
    // its canonical sha against what the harness reports in currentAgents.
    // Mismatch -> short-circuit with AGENTS_STALE; harness writes the
    // updated content and retries.
    // After this guard, step.agent is guaranteed defined (Zod superRefine
    // enforces it for type=agent).
    if (args.currentAgents !== undefined) {
      const required = step.agent!;
      const namespacedName = `mnm--${required}`;
      const canonical = await loadCanonicalAgent(
        args.companyId,
        required,
        args.actor.type === "user" ? args.actor.id : null,
      );
      const provided = args.currentAgents[namespacedName];
      if (provided !== canonical.sha) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.AGENTS_STALE,
          `Local agent '${namespacedName}' is stale; harness must update.`,
          [
            `Write the returned content to ~/.claude/agents/${namespacedName}.md`,
            // Claude Code does NOT hot-reload user-level agents; the in-session
            // subagent registry is frozen at SessionStart. After the Write, the
            // user must run /reload-plugins (or restart Claude Code) before the
            // next dispatch — see T6 hot-reload spike.
            "Run /reload-plugins in Claude Code so the new agent becomes dispatchable",
            "Re-call launchStep with the updated sha",
          ],
          {
            stale_agents: [
              {
                name: namespacedName,
                content: canonical.content,
                sha: canonical.sha,
                target_path: `~/.claude/agents/${namespacedName}.md`,
              },
            ],
          },
        );
      }
    }

    // ── T6 self-correction: detect missing session tools ───────────────
    // step.required_tools (optional) lists tool names that MUST be in the
    // harness's sessionTools. Typical values: "Task", "Write",
    // "mcp__<server>__<tool>". If any missing, short-circuit with
    // MISSING_TOOLS and hint how to install.
    if (args.sessionTools !== undefined && step.required_tools !== undefined) {
      const missing = step.required_tools.filter((t) => !args.sessionTools!.includes(t));
      if (missing.length > 0) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.MISSING_TOOLS,
          `Session missing required tools: ${missing.join(", ")}`,
          [
            "Install the associated plugins/MCPs and run /reload-plugins",
            "Then re-call launchStep",
          ],
          { required: missing },
        );
      }
    }

    // Mark step as running / gate_eval
    await db
      .update(governedStepExecutions)
      .set({
        state: step.gates?.entry ? "gate_eval" : "running",
        startedAt: new Date(),
        launchedByActorType: args.actor.type,
        launchedByActorId: args.actor.id,
      })
      .where(
        and(
          eq(governedStepExecutions.runId, args.runId),
          eq(governedStepExecutions.stepIdInJson, args.stepId),
        ),
      );

    // Resolve stepExec id once for SSE emission (used below and in gate block).
    const [launchStepExec] = await db
      .select({ id: governedStepExecutions.id })
      .from(governedStepExecutions)
      .where(
        and(
          eq(governedStepExecutions.runId, args.runId),
          eq(governedStepExecutions.stepIdInJson, args.stepId),
        ),
      );

    // ── T3.3: re-evaluate step assignment (delta INSERT) ─────────────────
    // Tags / roles may have shifted since launchWorkflow snapshotted the
    // initial set. Re-resolve and INSERT any newly matched principal.
    // Existing assignments are preserved (snapshots are append-only audit
    // — never deletion). Best-effort: failures are logged but don't block
    // the step launch.
    if (assignmentsSvc && step.assignment) {
      try {
        const fresh = await assignmentsSvc.resolveAssignment({
          companyId: args.companyId,
          assignment: step.assignment,
        });
        // Read the current snapshot to compute delta.
        const existing = await db
          .select({ principalId: governedStepAssignments.principalId })
          .from(governedStepAssignments)
          .where(
            and(
              eq(governedStepAssignments.companyId, args.companyId),
              eq(governedStepAssignments.stepExecutionId, launchStepExec.id),
            ),
          );
        const existingSet = new Set(existing.map((e) => e.principalId));
        const delta = fresh.filter((e) => !existingSet.has(e.principalId));
        if (delta.length > 0) {
          const inserted = await assignmentsSvc.snapshotStepAssignments({
            companyId: args.companyId,
            stepExecutionId: launchStepExec.id,
            entries: delta.map((e) => ({
              principalId: e.principalId,
              reason: `delta-launchStep:${e.reason}`,
            })),
          });
          for (const row of inserted) {
            publishLiveEvent({
              companyId: args.companyId,
              type: "step.assignment.created",
              payload: {
                step_execution_id: row.stepExecutionId,
                principal_id: row.principalId,
                reason: row.reason,
                run_id: args.runId,
                workflow_name: parsed.workflow.name,
                step_name: args.stepId,
              },
              visibility: { scope: "actor-only", actorId: row.principalId },
            });
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[governed-workflows] launchStep delta-assignment failed",
          {
            runId: args.runId,
            stepId: args.stepId,
            err: String(err),
          },
        );
      }
    }

    // Emit step_updated so the UI can refresh the run detail panel.
    emitStepUpdated({
      publish: publishLiveEvent,
      companyId: args.companyId,
      runId: args.runId,
      stepExecId: launchStepExec.id,
    });

    // Evaluate entry gate if present
    const entryBlock = step.gates?.entry as GateBlock | undefined;
    if (entryBlock && entryBlock.length > 0) {
      const gitProvider = await resolveGitProvider({
        companyId: args.companyId,
        userId: args.actor.type === "user" ? args.actor.id : null,
        resourceType: "workflow",
      });
      const helpers = buildGateHelpers({ db, companyId: args.companyId, resolveGitProvider });
      const previousArtifacts = await fetchSucceededArtifacts(db, args.runId);
      const context: GateContext = {
        artifact: undefined,
        run: {
          id: args.runId,
          workflow_name: parsed.workflow.name,
          git_tag: parsed.gitTag,
          params: run.steps.length > 0 ? {} : {},
        },
        step: { id: args.stepId, previous_artifacts: previousArtifacts },
        config: {},
        kind: "entry",
        helpers: {},
      };

      const blockResult = await runGateBlock(
        {
          block: entryBlock,
          kind: "entry",
          gitSha: parsed.gitSha,
          context,
          resolveSource: makeResolveSource({
            gitProvider,
            workflowGitSha: parsed.gitSha,
            workflowRepoPath: parsed.workflowRepoPath,
            shaCache,
          }),
        },
        { compiledCache, helpers },
      );

      // Persist every gate_result row (reuse launchStepExec resolved above)
      const insertedGateResults = await db
        .insert(gateResults)
        .values(
          blockResult.gate_results.map((r) => ({
            companyId: args.companyId,
            runId: args.runId,
            stepExecId: launchStepExec.id,
            gateIdInJson: r.gate_id_in_json,
            kind: r.kind,
            pass: r.pass,
            report: r.report,
            errorCode: r.error_code ?? null,
            hints: r.hints ?? [],
            gateGitSha: r.gate_git_sha,
            evaluatedAt: new Date(r.evaluated_at),
          })),
        )
        .returning({ id: gateResults.id });

      // Emit gate_evaluated for each persisted gate result.
      for (const gr of insertedGateResults) {
        emitGateEvaluated({
          publish: publishLiveEvent,
          companyId: args.companyId,
          runId: args.runId,
          stepExecId: launchStepExec.id,
          gateResultId: gr.id,
        });
      }

      if (!blockResult.pass) {
        const failed = blockResult.gate_results.find((r) => !r.pass);
        await db
          .update(governedStepExecutions)
          .set({ state: "pending", startedAt: null })
          .where(
            and(
              eq(governedStepExecutions.runId, args.runId),
              eq(governedStepExecutions.stepIdInJson, args.stepId),
            ),
          );
        // Emit step_updated to reflect the rollback to pending.
        emitStepUpdated({
          publish: publishLiveEvent,
          companyId: args.companyId,
          runId: args.runId,
          stepExecId: launchStepExec.id,
        });
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
          `Entry gate failed for step '${args.stepId}': ${failed?.report ?? "unknown"}`,
          failed?.hints ?? [],
        );
      }

      // Gate passed — transition to running
      await db
        .update(governedStepExecutions)
        .set({ state: "running" })
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            eq(governedStepExecutions.stepIdInJson, args.stepId),
          ),
        );
      // Emit step_updated for the running transition.
      emitStepUpdated({
        publish: publishLiveEvent,
        companyId: args.companyId,
        runId: args.runId,
        stepExecId: launchStepExec.id,
      });
    }

    // Interpolate prompt_context placeholders (`{{variables.name}}`,
    // `{{steps.greet.artifact.greeting}}`) against the run's params +
    // previous artifacts. Loaded async from the DB so completed-step
    // artifacts are actually substituted (see `interpolatePromptContext`).
    // gitProvider is needed for eager git_file resolution; resolve it here
    // unconditionally (it may already be resolved above inside the entry gate
    // block, but that branch is conditional so we can't rely on it).
    const launchStepGitProvider = await resolveGitProvider({
      companyId: args.companyId,
      userId: args.actor.type === "user" ? args.actor.id : null,
      resourceType: "workflow",
    });
    const params = await fetchRunParams(args.companyId, args.runId);
    const previousArtifacts = await fetchSucceededArtifacts(db, args.runId);
    const promptContext = await interpolatePromptContext(
      step.prompt_context,
      { variables: params, steps: previousArtifacts },
      launchStepGitProvider,
    );

    // ── T2.7: before_step hooks ─────────────────────────────────────────────
    // Run AFTER prompt_context interpolation and BEFORE we return to the
    // harness. inject.context_md fragments are concatenated into the
    // step's `prompt_context.injected_by_hooks` (one entry per hook).
    // Hook failure → step transitions to "failed" rétroactivement, run
    // depending on the cascade.
    if (hooksSvc) {
      const [stepExecRow] = await db
        .select({ id: governedStepExecutions.id })
        .from(governedStepExecutions)
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            eq(governedStepExecutions.stepIdInJson, args.stepId),
          ),
        );
      const beforeStepOutcome = await runHookPhase({
        phase: "before_step",
        runId: args.runId,
        stepExecutionId: stepExecRow?.id,
        workflowGitSha: parsed.gitSha,
        actor: args.actor,
        companyId: args.companyId,
        workflow: parsed.workflow,
        step: { id: step.id, hooks: step.hooks },
        hookCtx: buildHookCtx({
          phase: "before_step",
          runId: args.runId,
          workflowName: parsed.workflow.name,
          workflowGitTag: parsed.gitTag,
          runParams: params,
          stepId: step.id,
          previousArtifacts,
        }),
      });
      if (!beforeStepOutcome.ok) {
        await db
          .update(governedStepExecutions)
          .set({ state: "failed", updatedAt: new Date() })
          .where(
            and(
              eq(governedStepExecutions.runId, args.runId),
              eq(governedStepExecutions.stepIdInJson, args.stepId),
            ),
          );
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
          `before_step hook '${beforeStepOutcome.firstFailure!.ref}' failed: ${beforeStepOutcome.firstFailure!.report}`,
          [
            `Hook error_code: ${beforeStepOutcome.firstFailure!.errorCode}`,
            "Disable / fix the hook config or remove it from the step's hooks.before",
          ],
          {
            hook_ref: beforeStepOutcome.firstFailure!.ref,
            hook_error: beforeStepOutcome.firstFailure!.errorCode,
          },
        );
      }
      if (beforeStepOutcome.injectMd.length > 0) {
        // Merge inject into prompt_context. The orchestrator does NOT
        // mutate the workflow.json `step.prompt_context` template — we
        // tag-on a sibling key so the harness sees both the original
        // user prompt + the hook-injected content. The naming
        // `injected_by_hooks` matches the contract documented in
        // docs/superpowers/handoff-2026-05-02-T2-resume.md §4.
        (promptContext as Record<string, unknown>).injected_by_hooks =
          beforeStepOutcome.evaluations
            .filter((e) => e.ok)
            .map((e) => ({ hook_ref: e.ref }));
        (promptContext as Record<string, unknown>).injected_context_md =
          beforeStepOutcome.injectMd;
      }
    }

    const prevStepRows = await db
      .select({
        stepIdInJson: governedStepExecutions.stepIdInJson,
        state: governedStepExecutions.state,
        artifactsJson: governedStepExecutions.artifactsJson,
      })
      .from(governedStepExecutions)
      .where(eq(governedStepExecutions.runId, args.runId));
    const handoffs = buildHandoffsForStep(prevStepRows as any);

    // ── Session-bundle path : create the client heartbeat_run if the step
    //    declares the session-file-bundled exit gate. Failures here are
    //    logged but NEVER fail the launch — the harness can still produce
    //    the artifact, the run will just be missing a timeline. ────────
    let sessionCapture: ReturnType<typeof getCaptureConfig> | undefined;
    if (heartbeatDep && usesSessionBundleGate(step)) {
      try {
        const agentRow = await db
          .select({ id: agents.id })
          .from(agents)
          .where(and(eq(agents.companyId, args.companyId), eq(agents.name, step.agent!)))
          .then((rows) => rows[0]);

        if (agentRow) {
          const clientRun = await heartbeatDep.createClientRun({
            companyId: args.companyId,
            agentId: agentRow.id,
            invocationSource: "governed_step",
            triggerDetail: "mcp",
            contextSnapshot: {
              runId: args.runId,
              stepId: args.stepId,
              workflowName: parsed.workflow.name,
              workflowGitTag: parsed.gitTag,
            },
          });

          await db
            .update(governedStepExecutions)
            .set({ heartbeatRunId: clientRun.id, updatedAt: new Date() })
            .where(
              and(
                eq(governedStepExecutions.runId, args.runId),
                eq(governedStepExecutions.stepIdInJson, args.stepId),
              ),
            );

          sessionCapture = getCaptureConfig({ companyId: args.companyId });
        }
      } catch (err) {
        // Defensive : a client-run creation failure must not block the harness.
        // Log via console (no logger import in this module yet) and proceed
        // without sessionCapture; the gate will fail at completeStep with a
        // clear hint, telling the harness the bundle is required.
        // eslint-disable-next-line no-console
        console.warn(`[governed-workflows] Failed to spawn client run for step ${args.stepId}:`, err);
      }
    }

    return {
      agentName: step.agent!,
      promptContext,
      subagentType: `mnm--${step.agent!}`,
      handoffs,
      runBranch: runBranchName(args.runId),
      sessionCapture,
    };
  }

  // Rewrites the YAML frontmatter `name:` line so it matches the namespaced
  // filename `mnm--<bare>.md`. Without this, Claude Code registers the agent
  // under its bare name (`senior-dev`) — colliding with other plugins and
  // mismatching the server-returned `subagent_type=mnm--senior-dev`. The
  // ShaCache continues to store the raw blob; sha is computed downstream
  // on the REWRITTEN content so server and harness agree.
  function rewriteAgentFrontmatterName(content: string, mnmName: string): string {
    if (!content.startsWith("---")) return content;
    const fmEnd = content.indexOf("\n---", 3);
    if (fmEnd === -1) return content;
    const head = content.slice(0, fmEnd);
    const tail = content.slice(fmEnd);
    return head.replace(/^name:\s*.*$/m, `name: ${mnmName}`) + tail;
  }

  /**
   * Fetches the canonical agent.md content + computed sha for the given
   * company+agent-name, using the shaCache to avoid repeated git fetches.
   * Throws AGENT_NOT_REGISTERED (hard error) when the agent DB row is missing,
   * archived, or has no latestGitTag yet — never returns null (T6 git-first).
   */
  async function loadCanonicalAgent(
    companyId: string,
    agentName: string,
    userId?: string | null,
  ): Promise<{ content: string; sha: string }> {
    const [row] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.companyId, companyId),
          eq(agents.name, agentName),
          eq(agents.enabled, true),
          isNull(agents.archivedAt),
        ),
      );
    if (!row) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED,
        `Agent '${agentName}' is not registered for this company.`,
        [`Run create_agent with name='${agentName}'`],
        { sub_cause: "AGENT_ROW_MISSING" },
      );
    }
    if (!row.latestGitTag) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED,
        `Agent '${agentName}' has no published git tag yet.`,
        [`Push a version tag for '${agentName}' to the git repo`],
        { sub_cause: "AGENT_TAG_MISSING" },
      );
    }
    const gitProvider = await resolveGitProvider({
      companyId,
      userId: userId ?? null,
      resourceType: "agent",
    });
    const mdPath = resolveResourcePath(gitProvider as unknown as ProviderWithPaths, "agent", row.name, "agent.md");
    const cached = shaCache.get(PROVIDER_ID, mdPath, row.latestGitTag);
    let blob: string;
    if (cached !== undefined) {
      blob = cached;
    } else {
      blob = await gitProvider.fetchBlob({
        path: mdPath,
        ref: row.latestGitTag,
      });
      shaCache.set(PROVIDER_ID, mdPath, row.latestGitTag, blob);
    }
    const content = rewriteAgentFrontmatterName(blob, `mnm--${row.name}`);
    const sha = createHash("sha256").update(content).digest("hex");
    return { content, sha };
  }

  // Helper: the run's `paramsJson` column — not carried on `GetRunResult`
  // to keep that shape focused. Fetched lazily when needed for prompt
  // interpolation.
  async function fetchRunParams(companyId: string, runId: string): Promise<Record<string, unknown>> {
    const [row] = await db
      .select({ params: governedWorkflowRuns.paramsJson })
      .from(governedWorkflowRuns)
      .where(and(eq(governedWorkflowRuns.companyId, companyId), eq(governedWorkflowRuns.id, runId)));
    return (row?.params as Record<string, unknown>) ?? {};
  }

  // Helper: resolve a definition name + pinned tag from a runId. Private to the service.
  async function getDefByRun(companyId: string, runId: string) {
    const [row] = await db
      .select({
        name: governedWorkflowDefinitions.name,
        latestGitTag: governedWorkflowDefinitions.latestGitTag,
        workflowGitTag: governedWorkflowRuns.workflowGitTag,
      })
      .from(governedWorkflowRuns)
      .innerJoin(
        governedWorkflowDefinitions,
        eq(governedWorkflowRuns.workflowDefId, governedWorkflowDefinitions.id),
      )
      .where(
        and(
          eq(governedWorkflowRuns.id, runId),
          eq(governedWorkflowRuns.companyId, companyId),
        ),
      );
    if (!row) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
        `Run '${runId}' not found`,
      );
    }
    return row;
  }

  /**
   * Finalise a step. Persists the artifact, evaluates the exit gate block
   * (if any), and on pass transitions the step to `succeeded`. If every
   * step on the run is now `succeeded`, the run status transitions to
   * `completed`.
   *
   * Idempotency: calling on a step already in `succeeded` or `failed`
   * rejects with WORKFLOW_ALREADY_COMPLETED. This is conservative — the
   * spec does not define retry semantics, and allowing a second complete
   * would overwrite the artifact + re-run the gate, muddying audit
   * history.
   */
  async function completeStep(args: CompleteStepArgs): Promise<CompleteStepResult> {
    // Serialize per-step completion to avoid races where two harness
    // replies race on the same step.

    // Data needed for post-tx finalize of the session-bundle client run.
    // Populated inside the tx (we capture heartbeatRunId BEFORE we transition
    // the step to succeeded), then used after commit to parse the .jsonl and
    // build the trace + observations.
    const pendingFinalize: {
      data: { heartbeatRunId: string; sessionFile: SessionFileInput | undefined } | null;
    } = { data: null };

    // Data needed for post-tx mergeRunBranch — populated inside the tx and
    // used after commit so Git ops don't extend the DB transaction window.
    // Wrapped in an object so TypeScript cross-closure mutation tracking works.
    const pendingMerge: {
      data: {
        gitProvider: GitProvider;
        workflowName: string;
        startedAt: Date | null;
        completedAt: Date;
        triggeredBy: string;
        author: { name: string; email: string };
        stepsSummary: Array<{ stepId: string; state: string }>;
      } | null;
    } = { data: null };

    // T2.7: data needed for post-tx after_run hooks — populated inside the
    // tx when the run transitions to "completed", consumed below. Wrapped
    // for cross-closure mutation tracking like pendingMerge.
    const pendingAfterRun: {
      data: {
        workflow: WorkflowDefinition;
        workflowGitSha: string;
        workflowGitTag: string;
        runParams: Record<string, unknown>;
      } | null;
    } = { data: null };

    const txResult = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${"mnm:complete:" + args.runId + ":" + args.stepId}))`,
      );

      // Cancelled-run guard FIRST — fetched inside the tx so it shares the
      // advisory lock's serialization. We want WORKFLOW_RUN_CANCELLED to
      // surface BEFORE any step-state check; otherwise a step cascaded to
      // `cancelled` by cancelRun would slip past the
      // WORKFLOW_ALREADY_COMPLETED check (which only fires for
      // succeeded/failed) and hit commitHandoffArtifacts mid-tx.
      const [runRow] = await tx
        .select({
          id: governedWorkflowRuns.id,
          cancelledAt: governedWorkflowRuns.cancelledAt,
          cancellationReason: governedWorkflowRuns.cancellationReason,
        })
        .from(governedWorkflowRuns)
        .where(
          and(
            eq(governedWorkflowRuns.id, args.runId),
            eq(governedWorkflowRuns.companyId, args.companyId),
          ),
        );
      if (!runRow) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
          `Run '${args.runId}' not found`,
        );
      }
      assertRunNotCancelled(runRow);

      const [stepExec] = await tx
        .select()
        .from(governedStepExecutions)
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            eq(governedStepExecutions.stepIdInJson, args.stepId),
            eq(governedStepExecutions.companyId, args.companyId),
          ),
        );
      if (!stepExec) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_STEP_NOT_FOUND,
          `Step '${args.stepId}' not in run`,
        );
      }
      if (stepExec.state === "succeeded" || stepExec.state === "failed") {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_ALREADY_COMPLETED,
          `Step '${args.stepId}' is already ${stepExec.state}`,
        );
      }

      // Re-parse workflow for the exit gate block (cached by ShaCache).
      const def = await getDefByRun(args.companyId, args.runId);
      const parsed = await getWorkflowParsed({
        companyId: args.companyId,
        name: def.name,
        gitTag: def.workflowGitTag,
        userId: args.actor.type === "user" ? args.actor.id : null,
      });
      const step = parsed.workflow.steps.find((s) => s.id === args.stepId);
      if (!step) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_STEP_NOT_FOUND,
          `Step '${args.stepId}' not in workflow`,
        );
      }

      // ── T5.3 — composite branch: consume the sub-run's final outputs ────
      // The parent composite step has no agent and never persists a fresh
      // artifact via commitHandoffArtifacts. Instead we copy the LAST step's
      // artifactsJson from the sub-run (captures the workflow's terminal
      // output) and mark the parent step succeeded.
      //
      // This branch deliberately runs BEFORE the agent-step path (gates,
      // hooks, git commit) — none of those apply to a composite parent.
      if (step.type === "composite") {
        if (!stepExec.compositeRunId) {
          throw new GovernedWorkflowError(
            WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_INPUT,
            `composite step '${args.stepId}' has no sub-run yet (launchStep was not called or failed)`,
          );
        }
        // Read every step in the sub-run; refuse if any is not yet succeeded.
        const subSteps = await tx
          .select({
            stepIdInJson: governedStepExecutions.stepIdInJson,
            state: governedStepExecutions.state,
            artifactsJson: governedStepExecutions.artifactsJson,
            createdAt: governedStepExecutions.createdAt,
          })
          .from(governedStepExecutions)
          .where(
            and(
              eq(governedStepExecutions.runId, stepExec.compositeRunId),
              eq(governedStepExecutions.companyId, args.companyId),
            ),
          )
          .orderBy(governedStepExecutions.createdAt);
        if (subSteps.length === 0) {
          throw new GovernedWorkflowError(
            WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_INPUT,
            `composite sub-run for '${args.stepId}' has no steps`,
          );
        }
        const notSucceeded = subSteps.filter((s) => s.state !== "succeeded");
        if (notSucceeded.length > 0) {
          throw new GovernedWorkflowError(
            WORKFLOW_ERROR_CODES.WORKFLOW_DEPENDENCY_UNMET,
            `cannot complete composite step '${args.stepId}': sub-run has ${notSucceeded.length} step(s) not yet succeeded`,
            [
              `Pending sub-steps: ${notSucceeded.map((s) => s.stepIdInJson).join(", ")}`,
              "Run the sub-run to completion before completing the parent composite step.",
            ],
          );
        }
        const finalLeaf = subSteps[subSteps.length - 1];
        const finalOutputs = (finalLeaf.artifactsJson ?? {}) as Record<string, unknown>;
        await completeCompositeStep(tx as unknown as Db, {
          parentStepExecutionId: stepExec.id,
          finalOutputs,
        });
        // Bump run's last_useful_action_at so the liveness watchdog accounts
        // for this composite step closure as forward progress.
        const stepCompletedAt = new Date();
        await tx
          .update(governedWorkflowRuns)
          .set({
            lastUsefulActionAt: stepCompletedAt,
            nextActionHint: `composite step '${args.stepId}' completed`,
            updatedAt: stepCompletedAt,
          })
          .where(eq(governedWorkflowRuns.id, args.runId));

        publishLiveEvent({
          companyId: args.companyId,
          type: "step.composite.completed",
          payload: {
            run_id: args.runId,
            step_id: args.stepId,
            step_execution_id: stepExec.id,
            sub_run_id: stepExec.compositeRunId,
          },
          visibility: { scope: "company-wide" },
        });
        emitStepUpdated({
          publish: publishLiveEvent,
          companyId: args.companyId,
          runId: args.runId,
          stepExecId: stepExec.id,
        });

        // Mirror the agent path's allDone check so a composite step that is
        // the LAST step of its parent run still flips the run to "completed".
        // Skip the git mergeRunBranch / after_run capture — those are agent-
        // step concerns. If the composite was the last step, the harness
        // will see runStatus="completed" and stop.
        const pending = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(governedStepExecutions)
          .where(
            and(
              eq(governedStepExecutions.runId, args.runId),
              sql`state != 'succeeded'`,
            ),
          );
        const allDone = pending[0]!.count === 0;
        if (allDone) {
          await tx
            .update(governedWorkflowRuns)
            .set({ status: "completed", completedAt: stepCompletedAt })
            .where(eq(governedWorkflowRuns.id, args.runId));
        }
        return {
          stepState: "succeeded" as const,
          runStatus: allDone ? ("completed" as const) : ("active" as const),
        };
      }

      // Resolve commit author and git provider, then commit inline outputs to Git
      // before persisting. If git commit fails the tx rolls back, keeping the
      // step in its current state for a clean retry.
      const author = await resolveCommitAuthor({
        db: tx as unknown as Db,
        companyId: args.companyId,
        actor: args.actor,
      });
      const gitProvider = await resolveGitProvider({
        companyId: args.companyId,
        userId: args.actor.type === "user" ? args.actor.id : null,
        resourceType: "workflow",
      });
      const persistedArtifact = await commitHandoffArtifacts({
        gitProvider,
        runId: args.runId,
        stepId: args.stepId,
        input: args.artifact,
        author,
        startBranch: "master", // your organization convention; multi-tenant should source from company config later
      });

      // Persist artifact immediately (even before gate eval). If gate
      // fails we'll still have the last attempt's artifact on the step
      // execution for audit.
      await tx
        .update(governedStepExecutions)
        .set({
          state: step.gates?.exit ? "gate_eval" : "running",
          artifactsJson: persistedArtifact as unknown as Record<string, unknown>,
        })
        .where(eq(governedStepExecutions.id, stepExec.id));

      // Emit step_updated to notify UI of the artifact + state change.
      emitStepUpdated({
        publish: publishLiveEvent,
        companyId: args.companyId,
        runId: args.runId,
        stepExecId: stepExec.id,
      });

      // ── T2.7: after_step hooks ─────────────────────────────────────────
      // Run AFTER the artifact is committed + state transitioned but
      // BEFORE the exit gates evaluate. A hook failure transitions the
      // step retro-actively to "failed" — even though the artifact has
      // already been committed. Run state cascades via the post-tx
      // `allDone` check (a failed step blocks runs from completing).
      //
      // The hook executes through the OUTER `db` connection, not the
      // current `tx` (mirrors the F7 fix for gate_results: audit rows
      // must survive a tx rollback so observability stays intact when
      // the wider tx fails downstream).
      if (hooksSvc) {
        const afterStepOutcome = await runHookPhase({
          phase: "after_step",
          runId: args.runId,
          stepExecutionId: stepExec.id,
          workflowGitSha: parsed.gitSha,
          actor: args.actor,
          companyId: args.companyId,
          workflow: parsed.workflow,
          step: { id: step.id, hooks: step.hooks },
          hookCtx: buildHookCtx({
            phase: "after_step",
            runId: args.runId,
            workflowName: parsed.workflow.name,
            workflowGitTag: parsed.gitTag,
            runParams: await fetchRunParams(args.companyId, args.runId),
            stepId: step.id,
            // P1.1 fix: read previous_artifacts via the OUTER db connection,
            // NOT the in-flight `tx` snapshot. The tx snapshot includes the
            // current step's row at state="gate_eval" with the just-written
            // artifact — but those updates are uncommitted and may roll back
            // (e.g. if this very hook phase fails right after). Reading via
            // `db` returns the committed state — what gates / hooks actually
            // observe in production post-tx.
            previousArtifacts: await fetchSucceededArtifacts(db, args.runId),
            artifact: persistedArtifact,
          }),
        });
        if (!afterStepOutcome.ok) {
          // P0.1 fix: persist state="failed" via the OUTER `db` connection
          // BEFORE throwing. The throw rolls back `tx`, which would otherwise
          // wipe the state="gate_eval" row update — leaving the step stuck in
          // "running" forever. Writing via `db` survives the rollback so the
          // step is correctly marked failed, mirroring the before_step pattern
          // and the F7 gate_results / hook_executions audit-row strategy.
          await db
            .update(governedStepExecutions)
            .set({ state: "failed", completedAt: new Date() })
            .where(eq(governedStepExecutions.id, stepExec.id));
          throw new GovernedWorkflowError(
            WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
            `after_step hook '${afterStepOutcome.firstFailure!.ref}' failed: ${afterStepOutcome.firstFailure!.report}`,
            [
              `Hook error_code: ${afterStepOutcome.firstFailure!.errorCode}`,
              "Disable / fix the hook config or remove it from the step's hooks.after",
            ],
            {
              hook_ref: afterStepOutcome.firstFailure!.ref,
              hook_error: afterStepOutcome.firstFailure!.errorCode,
            },
          );
        }
      }

      const exitBlock = step.gates?.exit as GateBlock | undefined;
      if (exitBlock && exitBlock.length > 0) {
        // gitProvider already resolved above — reuse it here.
        const helpers = buildGateHelpers({ db, companyId: args.companyId, resolveGitProvider });
        const previousArtifacts = await fetchSucceededArtifacts(tx as unknown as Db, args.runId);
        const context: GateContext = {
          artifact: persistedArtifact, // gates see the persisted form (git_file/git_folder refs)
          run: {
            id: args.runId,
            workflow_name: parsed.workflow.name,
            git_tag: parsed.gitTag,
            params: await fetchRunParams(args.companyId, args.runId),
          },
          step: { id: args.stepId, previous_artifacts: previousArtifacts },
          config: {},
          kind: "exit",
          helpers: {},
        };

        const blockResult = await runGateBlock(
          {
            block: exitBlock,
            kind: "exit",
            gitSha: parsed.gitSha,
            context,
            resolveSource: makeResolveSource({
              gitProvider,
              workflowGitSha: parsed.gitSha,
              workflowRepoPath: parsed.workflowRepoPath,
              shaCache,
            }),
          },
          { compiledCache, helpers },
        );

        // F7 fix: persist gate_results via the OUTER db connection, not
        // the surrounding tx. When an exit gate fails the function below
        // throws WORKFLOW_GATE_FAILED, which rolls the tx back — taking
        // every failed gate_results row with it. Audit / observability
        // become impossible: the UI sees nothing, the dashboard can't
        // group-by error_code on KO, debug-a-posteriori is dead. Writing
        // outside the tx commits each row immediately; the step state
        // change (to "running" on fail, "succeeded" on pass) stays in
        // the tx because IT must be atomic with the run completion check.
        const insertedExitGateResults = await db
          .insert(gateResults)
          .values(
            blockResult.gate_results.map((r) => ({
              companyId: args.companyId,
              runId: args.runId,
              stepExecId: stepExec.id,
              gateIdInJson: r.gate_id_in_json,
              kind: r.kind,
              pass: r.pass,
              report: r.report,
              errorCode: r.error_code ?? null,
              hints: r.hints ?? [],
              gateGitSha: r.gate_git_sha,
              evaluatedAt: new Date(r.evaluated_at),
            })),
          )
          .returning({ id: gateResults.id });

        // Emit gate_evaluated for each exit gate result.
        for (const gr of insertedExitGateResults) {
          emitGateEvaluated({
            publish: publishLiveEvent,
            companyId: args.companyId,
            runId: args.runId,
            stepExecId: stepExec.id,
            gateResultId: gr.id,
          });
        }

        if (!blockResult.pass) {
          const failed = blockResult.gate_results.find((r) => !r.pass);
          await tx
            .update(governedStepExecutions)
            .set({ state: "running" })
            .where(eq(governedStepExecutions.id, stepExec.id));
          // Emit step_updated to reflect the rollback to running.
          emitStepUpdated({
            publish: publishLiveEvent,
            companyId: args.companyId,
            runId: args.runId,
            stepExecId: stepExec.id,
          });
          throw new GovernedWorkflowError(
            WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
            `Exit gate failed for step '${args.stepId}': ${failed?.report ?? "unknown"}`,
            failed?.hints ?? [],
          );
        }
      }

      // Transition to succeeded
      const stepCompletedAt = new Date();
      await tx
        .update(governedStepExecutions)
        .set({ state: "succeeded", completedAt: stepCompletedAt })
        .where(eq(governedStepExecutions.id, stepExec.id));

      // ── Session-bundle path : capture heartbeatRunId + bundle for the
      //    post-tx finalize. Reads from the local stepExec snapshot (set
      //    during launchStep) so we don't need an extra SELECT. ─────────
      if (stepExec.heartbeatRunId) {
        const sessionFile = (args.artifact.data as { session_file?: SessionFileInput } | null | undefined)
          ?.session_file;
        pendingFinalize.data = {
          heartbeatRunId: stepExec.heartbeatRunId,
          sessionFile,
        };
      }

      // PHASE-4: a succeeded step is by definition "useful forward progress",
      // so bump the run's last_useful_action_at + record the next-action hint
      // (the step name acts as the implicit hint). This is what the liveness
      // watchdog uses to decide a run is alive vs stalled.
      await tx
        .update(governedWorkflowRuns)
        .set({
          lastUsefulActionAt: stepCompletedAt,
          nextActionHint: `step '${args.stepId}' completed`,
          updatedAt: stepCompletedAt,
        })
        .where(eq(governedWorkflowRuns.id, args.runId));

      // Emit step_updated for the succeeded transition.
      emitStepUpdated({
        publish: publishLiveEvent,
        companyId: args.companyId,
        runId: args.runId,
        stepExecId: stepExec.id,
      });

      // Check whether the whole run is done
      const pending = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(governedStepExecutions)
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            sql`state != 'succeeded'`,
          ),
        );
      const allDone = pending[0]!.count === 0;
      const completedAt = new Date();
      if (allDone) {
        await tx
          .update(governedWorkflowRuns)
          .set({ status: "completed", completedAt })
          .where(eq(governedWorkflowRuns.id, args.runId));

        // Capture data needed for post-tx mergeRunBranch (Git ops must not
        // run inside the DB transaction — they can take seconds).
        const [runForMerge] = await tx
          .select({
            startedAt: governedWorkflowRuns.startedAt,
            paramsJson: governedWorkflowRuns.paramsJson,
            initiatedByActorId: governedWorkflowRuns.initiatedByActorId,
            initiatedByActorType: governedWorkflowRuns.initiatedByActorType,
          })
          .from(governedWorkflowRuns)
          .where(eq(governedWorkflowRuns.id, args.runId));

        const allSteps = await tx
          .select({
            stepIdInJson: governedStepExecutions.stepIdInJson,
            state: governedStepExecutions.state,
          })
          .from(governedStepExecutions)
          .where(eq(governedStepExecutions.runId, args.runId));

        let triggeredBy: string;
        if (args.actor.type === "user") {
          const [u] = await tx
            .select({ email: authUsers.email })
            .from(authUsers)
            .where(eq(authUsers.id, args.actor.id));
          triggeredBy = u?.email ?? args.actor.id;
        } else {
          triggeredBy = args.actor.id;
        }

        pendingMerge.data = {
          gitProvider,
          workflowName: def.name,
          startedAt: runForMerge?.startedAt ?? null,
          completedAt,
          triggeredBy,
          author,
          stepsSummary: allSteps.map((s) => ({ stepId: s.stepIdInJson, state: s.state })),
        };

        // T2.7: capture data for post-tx after_run hooks. We re-use the
        // already-parsed workflow + run params; the post-tx caller does
        // not need to re-fetch from DB.
        pendingAfterRun.data = {
          workflow: parsed.workflow,
          workflowGitSha: parsed.gitSha,
          workflowGitTag: parsed.gitTag,
          runParams: (runForMerge?.paramsJson as Record<string, unknown>) ?? {},
        };
      }

      return {
        stepState: "succeeded" as const,
        runStatus: allDone ? ("completed" as const) : ("active" as const),
      };
    });

    // Post-tx: merge the run branch into master (outside any DB transaction so
    // we don't hold XACT locks while git operations run). Log on failure and
    // continue — the run status is already committed.
    if (pendingMerge.data !== null) {
      const mrd = pendingMerge.data;
      const runParams = await db
        .select({ paramsJson: governedWorkflowRuns.paramsJson })
        .from(governedWorkflowRuns)
        .where(eq(governedWorkflowRuns.id, args.runId));
      const ticket = (runParams[0]?.paramsJson as Record<string, unknown> | undefined)?.ticket as string | null ?? null;
      try {
        await mergeRunBranch({
          gitProvider: mrd.gitProvider,
          runId: args.runId,
          workflowName: mrd.workflowName,
          ticket,
          status: "completed",
          stepsSummary: mrd.stepsSummary,
          startedAt: mrd.startedAt,
          completedAt: mrd.completedAt,
          triggeredBy: mrd.triggeredBy,
          author: mrd.author,
        });
      } catch (err) {
        console.error(
          `[governed-workflows] mergeRunBranch failed for run ${args.runId} (completed): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // ── T2.7: after_run hooks ───────────────────────────────────────────
    // Run AFTER the run is committed as "completed" but before the final
    // return. Failure mode: log + audit, run STAYS "completed" (the hook
    // is a "post-success cleanup" — its failure must not retro-fail the
    // run, which would surprise users since their work succeeded). The
    // audit row produced by executeHook captures the failure for ops.
    //
    // P0.2 fix: fire-and-forget via setImmediate. Previously this `await`ed
    // runHookPhase, which could block the completeStep HTTP response for up
    // to N × hook_timeout (35s default × hook count) — clients would hang
    // even though the run is already committed as "completed" in DB. Now
    // we schedule the hook phase on the next tick and return immediately.
    // The audit row written by executeHook is final — observability is
    // preserved. Errors are logged via console.warn (no logger import in
    // this module yet).
    if (pendingAfterRun.data && hooksSvc) {
      const ar = pendingAfterRun.data;
      const runId = args.runId;
      const companyId = args.companyId;
      setImmediate(() => {
        runHookPhase({
          phase: "after_run",
          runId,
          workflowGitSha: ar.workflowGitSha,
          actor: args.actor,
          companyId,
          workflow: ar.workflow,
          hookCtx: buildHookCtx({
            phase: "after_run",
            runId,
            workflowName: ar.workflow.name,
            workflowGitTag: ar.workflowGitTag,
            runParams: ar.runParams,
          }),
        })
          .then((outcome) => {
            if (!outcome.ok) {
              // eslint-disable-next-line no-console
              console.warn(
                `[governed-workflows] after_run hook '${outcome.firstFailure!.ref}' failed asynchronously for run ${runId} (company ${companyId}): ${outcome.firstFailure!.errorCode}`,
              );
            }
            return undefined;
          })
          .catch((err) => {
            // executeHook errors should never escape, but defend the path
            // so a runaway hook doesn't crash the Node process.
            // eslint-disable-next-line no-console
            console.warn(
              `[governed-workflows] after_run hook phase failed asynchronously for run ${runId} (company ${companyId}): ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      });
    }

    // ── Post-tx : finalize the client heartbeat_run if the step had one.
    //    Best-effort : finalizeClientRun catches its own errors and tags
    //    the run failed. The step is already succeeded — the finalize
    //    failure is observable via the heartbeat_run errorCode. ───────
    if (pendingFinalize.data) {
      const finalizeDeps = buildFinalizeDeps();
      if (finalizeDeps) {
        if (pendingFinalize.data.sessionFile === undefined) {
          // Should not happen — the gate would have failed. Defensive log.
          console.warn(
            `[governed-workflows] step ${args.stepId} has heartbeatRunId but no session_file in artifact — finalize skipped`,
          );
        } else {
          try {
            await finalizeClientRun(finalizeDeps, {
              runId: pendingFinalize.data.heartbeatRunId,
              sessionFile: pendingFinalize.data.sessionFile,
            });
          } catch (err) {
            // finalizeClientRun is supposed to swallow errors. If one escapes
            // (programmer error, e.g. run not found), log + drop. Don't fail
            // completeStep — the step is already succeeded in DB.
            console.error(
              `[governed-workflows] finalizeClientRun threw for run ${pendingFinalize.data.heartbeatRunId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    }

    return txResult;
  }

  async function fetchSucceededArtifacts(
    tx: Db,
    runId: string,
  ): Promise<Record<string, unknown>> {
    const rows = await tx
      .select({
        stepId: governedStepExecutions.stepIdInJson,
        artifacts: governedStepExecutions.artifactsJson,
      })
      .from(governedStepExecutions)
      .where(
        and(
          eq(governedStepExecutions.runId, runId),
          sql`state = 'succeeded'`,
        ),
      );
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      const a = r.artifacts as ArtifactPersisted | null;
      if (!a) continue;
      // Project outputs[] into a name-keyed map so that
      // `{{steps.X.artifact.outputs.design}}` resolves to a single
      // OutputPersisted object (not the whole array). The interpolation
      // walker then applies kind-specific eager resolution (git_file → blob).
      const outputsByName: Record<string, OutputPersisted> = {};
      if (Array.isArray(a.outputs)) {
        for (const o of a.outputs) {
          outputsByName[o.name] = o;
        }
      }
      out[r.stepId] = {
        artifact: {
          outputs: outputsByName,
          data: a.data ?? {},
        },
      };
    }
    return out;
  }

  /**
   * Returns the full environment payload the SessionStart hook (T6) will
   * stage in `~/.mnm/cache/<company>/` and apply to `~/.claude/`. The
   * `newSha` field is a content hash (sha256 of the sorted `<name>:<tag>`
   * pairs). `hasChanges` compares against `lastSyncedSha` for a cheap
   * short-circuit on the client.
   *
   * The method does NOT push secrets — see spec §5. `env_ref` items are
   * required-env-var markers, not values.
   */
  async function syncEnvironment(args: SyncEnvironmentArgs): Promise<SyncEnvironmentResult> {
    // 1. Read all enabled, non-archived agents for the company. Filtering on
    //    archived_at IS NULL keeps syncEnvironment in lockstep with
    //    setupWorkspace and loadCanonicalAgent — see spec §3 ("listings").
    const rows = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.companyId, args.companyId),
          eq(agents.enabled, true),
          isNull(agents.archivedAt),
        ),
      );

    // 2. Compute the content-hash sha
    const shaPayload = rows
      .map((r) => `${r.name}:${r.latestGitTag ?? ""}`)
      .sort()
      .join("\n");
    const newSha = createHash("sha256").update(shaPayload).digest("hex");

    if (args.lastSyncedSha === newSha) {
      return { agents: [], newSha, hasChanges: false };
    }

    // 3. For each agent: fetch .md + merge config_layer_items
    const gitProvider = await resolveGitProvider({ companyId: args.companyId, userId: args.userId ?? null, resourceType: "agent" });
    const synced: SyncedAgent[] = [];
    for (const a of rows) {
      if (!a.latestGitTag) continue;
      // Path symmetry: honour provider.paths.agents prefix (B-FIX-1).
      // Mirrors setupWorkspace + loadCanonicalAgent so a `paths.agents="agents"`
      // config doesn't 404 the keepalive sync path.
      const mdPath = resolveResourcePath(
        gitProvider as ProviderWithPaths,
        "agent",
        a.name,
        "agent.md",
      );
      try {
        // ShaCache exposes get/set rather than getOrFetch — use them directly.
        const cached = shaCache.get(PROVIDER_ID, mdPath, a.latestGitTag);
        const mdContent = cached !== undefined
          ? cached
          : await (async () => {
              const blob = await gitProvider.fetchBlob({ path: mdPath, ref: a.latestGitTag! });
              shaCache.set(PROVIDER_ID, mdPath, a.latestGitTag!, blob);
              return blob;
            })();
        const configMerged = await mergeAgentConfig(args.companyId, a.id);
        synced.push({ name: a.name, mdContent, configMerged });
      } catch (err) {
        // Skip-on-404 parity with setupWorkspace: one orphan must not abort
        // the entire keepalive sync. Non-404 errors (auth, network) re-throw.
        if (err instanceof GitProviderError && err.code === "not_found") {
          console.warn("[mnm.sync_environment] agent_md_missing", {
            companyId: args.companyId,
            agentId: a.id,
            agentName: a.name,
            latestGitTag: a.latestGitTag,
            providerId: (gitProvider as any).providerId ?? "unknown",
            fullPath: mdPath,
          });
          continue;
        }
        throw err;
      }
    }

    return { agents: synced, newSha, hasChanges: true };
  }

  /**
   * Returns the full set of agents this company expects a newly-bootstrapped
   * user session to have in `~/.claude/agents/`. Called once by the harness
   * when the user asks "Set me up for MnM" (onboarding flow — spec §T6).
   *
   * Agent names are prefixed with `mnm--` so they cannot collide with
   * user-defined agents. The content is fetched via the git provider and
   * cached in the shaCache. Disabled agents are skipped.
   */
  async function setupWorkspace(args: SetupWorkspaceArgs): Promise<SetupWorkspaceResult> {
    const rows = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.companyId, args.companyId),
          eq(agents.enabled, true),
          isNull(agents.archivedAt),
        ),
      );

    const gitProvider = await resolveGitProvider({
      companyId: args.companyId,
      userId: args.userId ?? null,
      resourceType: "agent",
    });
    const out: SetupWorkspaceAgent[] = [];
    for (const a of rows) {
      if (!a.latestGitTag) continue;
      const mdPath = resolveResourcePath(
        gitProvider as ProviderWithPaths,
        "agent",
        a.name,
        "agent.md",
      );
      try {
        const cached = shaCache.get(PROVIDER_ID, mdPath, a.latestGitTag);
        const blob = cached !== undefined
          ? cached
          : await (async () => {
              const fetched = await gitProvider.fetchBlob({
                path: mdPath,
                ref: a.latestGitTag!,
              });
              shaCache.set(PROVIDER_ID, mdPath, a.latestGitTag!, fetched);
              return fetched;
            })();
        const content = rewriteAgentFrontmatterName(blob, `mnm--${a.name}`);
        const sha = createHash("sha256").update(content).digest("hex");
        out.push({
          name: `mnm--${a.name}`,
          content,
          sha,
          targetPath: `~/.claude/agents/mnm--${a.name}.md`,
        });
      } catch (err) {
        if (err instanceof GitProviderError && err.code === "not_found") {
          console.warn("[mnm.setup_workspace] agent_md_missing", {
            companyId: args.companyId,
            agentId: a.id,
            agentName: a.name,
            latestGitTag: a.latestGitTag,
            providerId: (gitProvider as any).providerId ?? "unknown",
            fullPath: mdPath,
          });
          continue;
        }
        throw err;
      }
    }

    return {
      agents: out,
      instructions:
        "Write each agent.content to its targetPath (resolving ~ to the user home " +
        "directory). After all writes, tell the user to run /reload-plugins once.",
    };
  }

  /**
   * Produces the payload the SessionStart hook will read next session.
   * Scope is narrow on purpose — only the plugin version, used by the hook
   * to detect upgrades and prompt re-sync. Active DB state is NOT included
   * because the hook can't refresh it (no network access), so caching it
   * here would be a stale-data trap. Use `list_governed_workflow_runs` to
   * discover active runs at session start.
   */
  async function pushLocalState(args: PushLocalStateArgs): Promise<PushLocalStateResult> {
    return {
      targetRelativePath: "last-session.json",
      content: {
        lastPluginVersion: args.pluginVersion,
      },
    };
  }

  async function mergeAgentConfig(
    companyId: string,
    agentId: string,
  ): Promise<SyncedAgent["configMerged"]> {
    // Delegates to the canonical priority-merge path. `mergePreview` returns a
    // flat `items[]` deduplicated by (itemType, name) with the highest-priority
    // layer winning — we just partition by itemType. Items of type "skill" and
    // "git_provider" are intentionally dropped from this envelope (see the
    // SyncedAgent.configMerged JSDoc).
    const conflictService = configLayerConflictService(db);
    const { items } = await conflictService.mergePreview(companyId, agentId);

    const buckets: SyncedAgent["configMerged"] = {
      mcp: [],
      hook: [],
      setting: [],
      credential: [],
    };
    for (const item of items) {
      if (item.itemType === "mcp") buckets.mcp.push(item);
      else if (item.itemType === "hook") buckets.hook.push(item);
      else if (item.itemType === "setting") buckets.setting.push(item);
      else if (item.itemType === "credential") buckets.credential.push(item);
      // "skill" and "git_provider" fall through by design.
    }
    return buckets;
  }

  // Thin pass-through to the extensions helper so MCP tools can stay
  // consistent with the `services.governedWorkflows.xxx` mocking pattern
  // and don't have to thread `db` themselves.
  async function listRuns(args: ListRunsArgs): Promise<ListRunsResult> {
    return listRunsExt(db, args);
  }

  /**
   * Cancel an active governed-workflow run. Idempotent guard via
   * `cancelled_at IS NULL` + `status = 'active'`. Cascades step executions
   * in `pending|running|gate_eval` to `cancelled` (terminal states are
   * preserved for audit).
   *
   * Authorization (spec §4): the run's initiator can always cancel; any
   * other actor needs `workflows:cancel_run`. Cross-tenant access falls
   * through as `WORKFLOW_RUN_NOT_FOUND` (the `companyId` filter on the
   * SELECT) — never `WORKFLOW_FORBIDDEN`, so existence is not leaked.
   *
   * Atomicity: run UPDATE + step cascade + audit insert run inside a
   * single TX with `FOR UPDATE` on the run row to serialize concurrent
   * cancels. The live event is published from inside the TX after all
   * writes; if the publish itself throws, the TX rolls back and the user
   * sees a clean failure rather than half-cancelled state.
   */
  async function cancelRun(args: CancelRunArgs): Promise<CancelRunResult> {
    // Reason length check first — cheap, fail fast, no DB hit.
    if (typeof args.reason !== "string" || args.reason.trim().length < 5) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_INPUT,
        "Cancellation reason must be at least 5 characters.",
        ["Provide a clear reason explaining why the run is being cancelled."],
      );
    }

    // Data needed for post-tx mergeRunBranch — populated inside the tx.
    // Wrapped in an object so TypeScript cross-closure mutation tracking works.
    const pendingCancelMerge: {
      data: {
        gitProvider: GitProvider;
        workflowName: string;
        startedAt: Date | null;
        ticket: string | null;
        cancelledAt: Date;
        triggeredBy: string;
        author: { name: string; email: string };
        stepsSummary: Array<{ stepId: string; state: string }>;
      } | null;
    } = { data: null };

    const txResult = await db.transaction(async (tx) => {
      // Lock the run row with FOR UPDATE so concurrent cancel calls serialize
      // — the second one will see cancelledAt != null and reject cleanly.
      const [run] = await tx
        .select()
        .from(governedWorkflowRuns)
        .where(
          and(
            eq(governedWorkflowRuns.id, args.runId),
            eq(governedWorkflowRuns.companyId, args.companyId),
          ),
        )
        .for("update");

      if (!run) {
        // Cross-tenant or missing — both surface as NOT_FOUND so existence
        // is not leaked across tenants (mirrors getRun behaviour).
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
          `Run '${args.runId}' not found.`,
        );
      }

      if (run.status !== "active") {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_ACTIVE,
          `Run is '${run.status}', only active runs can be cancelled.`,
          ["Only runs with status='active' can be cancelled."],
        );
      }

      if (run.cancelledAt !== null) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_RUN_ALREADY_CANCELLED,
          `Run '${args.runId}' is already cancelled (since ${run.cancelledAt.toISOString()}).`,
        );
      }

      // Authorization: initiator OR has workflows:cancel_run. We delegate
      // permission resolution to accessService (one source of truth) and
      // reuse the `tx` connection so the check honours the same RLS scope
      // as the run lookup. accessService.hasPermission already handles
      // both 'user' and 'agent' principal types (with agent fallback to
      // direct agent_permissions rows).
      const isInitiator = args.actor.id === run.initiatedByActorId;
      let allowed = isInitiator;
      if (!allowed && (args.actor.type === "user" || args.actor.type === "agent")) {
        const access = accessService(tx as unknown as Db);
        allowed = await access.hasPermission(
          args.companyId,
          args.actor.type,
          args.actor.id,
          PERMISSIONS.WORKFLOWS_CANCEL_RUN,
        );
      }
      if (!allowed) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_FORBIDDEN,
          "You can only cancel runs you initiated, or you need the workflows:cancel_run permission.",
          [
            "Ask an admin to grant workflows:cancel_run, or have the run's initiator cancel it.",
          ],
        );
      }

      // Single Date instance reused across UPDATE / audit / live event so
      // every consumer agrees on the cancellation timestamp (no microsecond
      // drift between two `new Date()` calls).
      const cancelledAt = new Date();

      await tx
        .update(governedWorkflowRuns)
        .set({
          cancelledAt,
          cancelledByActorId: args.actor.id,
          cancelledByActorType: args.actor.type,
          cancellationReason: args.reason,
          updatedAt: cancelledAt,
        })
        .where(eq(governedWorkflowRuns.id, args.runId));

      // Cascade only touches in-flight states. Terminal states
      // (succeeded/failed) are preserved as-is for audit.
      const cascaded = await tx
        .update(governedStepExecutions)
        .set({ state: "cancelled", updatedAt: cancelledAt })
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            inArray(governedStepExecutions.state, ["pending", "running", "gate_eval"]),
          ),
        )
        .returning({ id: governedStepExecutions.id });
      const cancelledStepIds = cascaded.map((r) => r.id);

      // Audit — written directly in the TX so it's atomic with the state
      // change. We bypass auditService(db).emit() here because that helper
      // opens its own connection (for prev_hash chaining) and would commit
      // even if our TX rolls back — leaving an orphan audit row. The
      // prev_hash chain will self-heal on the next emit() since chaining
      // looks at the latest row by created_at.
      await tx.insert(auditEvents).values({
        companyId: args.companyId,
        actorId: args.actor.id,
        actorType: args.actor.type,
        action: "governed_run.cancelled",
        targetType: "workflow",
        targetId: args.runId,
        metadata: {
          runId: args.runId,
          reason: args.reason,
          cancelledStepIds,
        },
        severity: "info",
        createdAt: cancelledAt,
      });

      // Publish the live event INSIDE the TX so a failure to dispatch
      // (publisher throws) rolls the cancellation back. Acceptable because
      // PublishFn is fire-and-forget against an in-memory bus — the only
      // realistic failure is a programming error in the emitter.
      emitRunCancelled({
        publish: args.publishLiveEvent,
        companyId: args.companyId,
        runId: args.runId,
        cancelledAt,
        cancelledByActorId: args.actor.id,
        cancelledByActorType: args.actor.type,
        reason: args.reason,
        cancelledStepIds,
      });

      // Capture data for post-tx mergeRunBranch.
      try {
        const defInfo = await getDefByRun(args.companyId, args.runId);
        const allSteps = await tx
          .select({
            stepIdInJson: governedStepExecutions.stepIdInJson,
            state: governedStepExecutions.state,
          })
          .from(governedStepExecutions)
          .where(eq(governedStepExecutions.runId, args.runId));

        const gitProvider = await resolveGitProvider({
          companyId: args.companyId,
          userId: args.actor.type === "user" ? args.actor.id : null,
          resourceType: "workflow",
        });
        const author = await resolveCommitAuthor({
          db: tx as unknown as Db,
          companyId: args.companyId,
          actor: args.actor,
        });

        let triggeredBy: string;
        if (args.actor.type === "user") {
          const [u] = await tx
            .select({ email: authUsers.email })
            .from(authUsers)
            .where(eq(authUsers.id, args.actor.id));
          triggeredBy = u?.email ?? args.actor.id;
        } else {
          triggeredBy = args.actor.id;
        }

        pendingCancelMerge.data = {
          gitProvider,
          workflowName: defInfo.name,
          startedAt: run.startedAt,
          ticket: (run.paramsJson as Record<string, unknown> | undefined)?.ticket as string | null ?? null,
          cancelledAt,
          triggeredBy,
          author,
          stepsSummary: allSteps.map((s) => ({ stepId: s.stepIdInJson, state: s.state })),
        };
      } catch {
        // Non-fatal: if we can't gather merge data, skip the post-tx merge.
      }

      return { runId: args.runId, cancelledAt, cancelledStepIds };
    });

    // Post-tx: merge the run branch into master (outside any DB transaction so
    // we don't hold XACT locks while git operations run). Log on failure and
    // continue — the run status is already committed.
    if (pendingCancelMerge.data !== null) {
      const cmd = pendingCancelMerge.data;
      try {
        await mergeRunBranch({
          gitProvider: cmd.gitProvider,
          runId: args.runId,
          workflowName: cmd.workflowName,
          ticket: cmd.ticket,
          status: "cancelled",
          stepsSummary: cmd.stepsSummary,
          startedAt: cmd.startedAt,
          completedAt: cmd.cancelledAt,
          triggeredBy: cmd.triggeredBy,
          author: cmd.author,
        });
      } catch (err) {
        console.error(
          `[governed-workflows] mergeRunBranch failed for run ${args.runId} (cancelled): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return txResult;
  }

  /**
   * Reactivate a previously cancelled governed-workflow run. Mirrors
   * `cancelRun`: same TX+lock+permission pattern, same audit/event shape
   * (action `governed_run.reactivated`).
   *
   * Authorization: same rule as cancel — initiator OR
   * `workflows:cancel_run` (we deliberately reuse the cancel permission
   * rather than minting a separate `workflows:reactivate_run`; the
   * capability is symmetric and operationally always granted together).
   *
   * Step restore policy: `cancelled` step executions are restored to
   * `pending` if they never started (`started_at IS NULL`) or to
   * `running` otherwise. Two UPDATEs are clearer than a CASE expression
   * and keep the `updated_at` write consistent with the rest of the file.
   */
  async function reactivateRun(args: ReactivateRunArgs): Promise<ReactivateRunResult> {
    return await db.transaction(async (tx) => {
      // Lock the run row with FOR UPDATE so concurrent reactivate calls
      // serialize — the second one will see cancelledAt === null and
      // reject cleanly with WORKFLOW_RUN_NOT_CANCELLED.
      const [run] = await tx
        .select()
        .from(governedWorkflowRuns)
        .where(
          and(
            eq(governedWorkflowRuns.id, args.runId),
            eq(governedWorkflowRuns.companyId, args.companyId),
          ),
        )
        .for("update");

      if (!run) {
        // Cross-tenant or missing — both surface as NOT_FOUND so existence
        // is not leaked across tenants (mirrors getRun/cancelRun behaviour).
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
          `Run '${args.runId}' not found.`,
        );
      }

      if (run.cancelledAt === null) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_CANCELLED,
          `Run '${args.runId}' is not cancelled.`,
          ["Only cancelled runs can be reactivated."],
        );
      }

      // Authorization: initiator OR has workflows:cancel_run. Same logic
      // as cancelRun (kept inline rather than extracted because the
      // duplication is short, readable, and lets each method own its own
      // error message).
      const isInitiator = args.actor.id === run.initiatedByActorId;
      let allowed = isInitiator;
      if (!allowed && (args.actor.type === "user" || args.actor.type === "agent")) {
        const access = accessService(tx as unknown as Db);
        allowed = await access.hasPermission(
          args.companyId,
          args.actor.type,
          args.actor.id,
          PERMISSIONS.WORKFLOWS_CANCEL_RUN,
        );
      }
      if (!allowed) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_FORBIDDEN,
          "You can only reactivate runs you initiated, or you need the workflows:cancel_run permission.",
          [
            "Ask an admin to grant workflows:cancel_run, or have the run's initiator reactivate it.",
          ],
        );
      }

      // Single Date instance reused across UPDATE / audit / live event so
      // every consumer agrees on the reactivation timestamp.
      const reactivatedAt = new Date();

      await tx
        .update(governedWorkflowRuns)
        .set({
          cancelledAt: null,
          cancelledByActorId: null,
          cancelledByActorType: null,
          cancellationReason: null,
          updatedAt: reactivatedAt,
        })
        .where(eq(governedWorkflowRuns.id, args.runId));

      // Restore steps: cancelled → pending if never started, running otherwise.
      // Two UPDATEs (rather than a single CASE expression) — clearer intent
      // and the partition is small enough that perf doesn't matter.
      const restoredToPending = await tx
        .update(governedStepExecutions)
        .set({ state: "pending", updatedAt: reactivatedAt })
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            eq(governedStepExecutions.state, "cancelled"),
            isNull(governedStepExecutions.startedAt),
          ),
        )
        .returning({ id: governedStepExecutions.id });

      const restoredToRunning = await tx
        .update(governedStepExecutions)
        .set({ state: "running", updatedAt: reactivatedAt })
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            eq(governedStepExecutions.state, "cancelled"),
            isNotNull(governedStepExecutions.startedAt),
          ),
        )
        .returning({ id: governedStepExecutions.id });

      const reactivatedStepIds = [
        ...restoredToPending.map((r) => r.id),
        ...restoredToRunning.map((r) => r.id),
      ];

      // Audit — written directly in the TX so it's atomic with the state
      // change. We bypass auditService(db).emit() here for the same
      // prev_hash skip rationale documented on cancelRun: the chain
      // self-heals on the next emit() since chaining looks at the latest
      // row by created_at.
      await tx.insert(auditEvents).values({
        companyId: args.companyId,
        actorId: args.actor.id,
        actorType: args.actor.type,
        action: "governed_run.reactivated",
        targetType: "workflow",
        targetId: args.runId,
        metadata: {
          runId: args.runId,
          reactivatedStepIds,
        },
        severity: "info",
        createdAt: reactivatedAt,
      });

      // Publish the live event INSIDE the TX (same rationale as cancelRun).
      emitRunReactivated({
        publish: args.publishLiveEvent,
        companyId: args.companyId,
        runId: args.runId,
        reactivatedByActorId: args.actor.id,
        reactivatedByActorType: args.actor.type,
        reactivatedStepIds,
      });

      return { runId: args.runId, reactivatedStepIds };
    });
  }

  /**
   * Resume a governed workflow run from a fresh client session.
   *
   * Returns the full history of succeeded steps (with outputs + data from
   * artifactsJson) and the launch payload for the current pending/running
   * step so the harness can Task() into the right agent without calling
   * launchStep again (which would re-evaluate entry gates and mutate state).
   *
   * Choice: compute the launch payload INLINE here (no state change, no gate
   * evaluation) rather than delegating to launchStep. This avoids the
   * double-transition problem when the next step is already `running` (e.g.
   * the agent was dispatched but the client session was cleared). A TODO is
   * left for a future refactor that extracts `computeStepLaunchPayload` from
   * launchStep so the two paths share code.
   *
   * TODO(refactor): extract the prompt-context interpolation + handoff-build
   * portion of launchStep into a shared helper `computeStepLaunchPayload` so
   * resumeRun and launchStep stay in sync if the interpolation logic changes.
   */
  async function resumeRun(args: { companyId: string; runId: string }) {
    // Load the run row — same cross-tenant defense as getRun/cancelRun.
    const [runRow] = await db
      .select()
      .from(governedWorkflowRuns)
      .where(
        and(
          eq(governedWorkflowRuns.id, args.runId),
          eq(governedWorkflowRuns.companyId, args.companyId),
        ),
      );
    if (!runRow) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
        `Run '${args.runId}' not found.`,
      );
    }

    // Load all step rows ordered by creation (= workflow step order).
    const steps = await db
      .select()
      .from(governedStepExecutions)
      .where(eq(governedStepExecutions.runId, args.runId))
      .orderBy(governedStepExecutions.createdAt);

    // Build the history array from succeeded steps.
    const succeededSteps = steps.filter((s) => s.state === "succeeded");
    const history = await Promise.all(
      succeededSteps.map(async (s) => {
        // Resolve the email of the user who launched this step (null for agents).
        let completedBy: string | null = null;
        if (s.launchedByActorType === "user" && s.launchedByActorId) {
          const [userRow] = await db
            .select({ email: authUsers.email })
            .from(authUsers)
            .where(eq(authUsers.id, s.launchedByActorId));
          completedBy = userRow?.email ?? null;
        }
        const artifact = s.artifactsJson as ArtifactPersisted | null;
        return {
          step_id: s.stepIdInJson,
          state: s.state,
          outputs: artifact?.outputs ?? [],
          data: artifact?.data ?? {},
          started_at: s.startedAt?.toISOString() ?? null,
          completed_at: s.completedAt?.toISOString() ?? null,
          completed_by: completedBy,
        };
      }),
    );

    // Find the current step: first non-succeeded, non-terminal step.
    const nextStep = steps.find(
      (s) => s.state === "pending" || s.state === "running" || s.state === "gate_eval",
    );

    // Resolve the definition name (needed to re-parse the workflow JSON).
    const defInfo = await getDefByRun(args.companyId, args.runId);

    if (!nextStep) {
      // Run is fully done (all steps succeeded, or was completed/failed/cancelled).
      return {
        run_id: runRow.id,
        workflow_name: defInfo.name,
        workflow_git_tag: runRow.workflowGitTag,
        status: runRow.status,
        history,
        current_step: null,
      };
    }

    // Compute the launch payload for the current step WITHOUT mutating state
    // (no gate evaluation, no running transition). This is safe to call for
    // both pending (never launched) and running (launched but session cleared)
    // steps because we skip the entry gate — the gate was either already
    // passed (running) or will be evaluated on the next explicit launchStep.
    const parsed = await getWorkflowParsed({
      companyId: args.companyId,
      name: defInfo.name,
      gitTag: defInfo.workflowGitTag,
      userId: null, // resumeRun has no actor — use company-level git access
    });

    const stepDef = parsed.workflow.steps.find((s) => s.id === nextStep.stepIdInJson);
    if (!stepDef) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_STEP_NOT_FOUND,
        `Step '${nextStep.stepIdInJson}' not found in workflow definition.`,
      );
    }

    // Interpolate prompt_context (mirrors launchStep lines 919-924).
    // resolveGitProvider uses userId=null — resumeRun has no human actor.
    const resumeRunGitProvider = await resolveGitProvider({
      companyId: args.companyId,
      userId: null,
      resourceType: "workflow",
    });
    const params = await fetchRunParams(args.companyId, args.runId);
    const previousArtifacts = await fetchSucceededArtifacts(db, args.runId);
    const promptContext = await interpolatePromptContext(
      stepDef.prompt_context,
      { variables: params, steps: previousArtifacts },
      resumeRunGitProvider,
    );

    // Build handoffs (mirrors launchStep lines 926-934).
    const prevStepRows = await db
      .select({
        stepIdInJson: governedStepExecutions.stepIdInJson,
        state: governedStepExecutions.state,
        artifactsJson: governedStepExecutions.artifactsJson,
      })
      .from(governedStepExecutions)
      .where(eq(governedStepExecutions.runId, args.runId));
    const handoffs = buildHandoffsForStep(prevStepRows as any);

    return {
      run_id: runRow.id,
      workflow_name: defInfo.name,
      workflow_git_tag: runRow.workflowGitTag,
      status: runRow.status,
      history,
      current_step: {
        step_id: nextStep.stepIdInJson,
        state: nextStep.state,
        agent_name: stepDef.agent,
        prompt_context: promptContext,
        subagent_type: `mnm--${stepDef.agent}`,
        handoffs,
        run_branch: runBranchName(args.runId),
      },
    };
  }

  return {
    listDefinitions,
    getDefinition,
    getWorkflowParsed,
    launchWorkflow,
    getRun,
    launchStep,
    completeStep,
    syncEnvironment,
    setupWorkspace,
    pushLocalState,
    listRuns,
    cancelRun,
    reactivateRun,
    resumeRun,
  };
}

export type GovernedWorkflowService = ReturnType<typeof governedWorkflowService>;
