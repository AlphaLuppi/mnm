import { createHash } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  governedWorkflowDefinitions,
  governedWorkflowRuns,
  governedStepExecutions,
  gateResults,
  agents,
  type Db,
} from "@mnm/db";
import {
  workflowDefinitionSchema,
  WORKFLOW_ERROR_CODES,
  type WorkflowDefinition,
  type GateContext,
  type GateBlock,
} from "@mnm/governed-workflows";
import { GitProviderError } from "@mnm/git-provider";
import type { GitProvider, ShaCache } from "@mnm/git-provider";
import type { AuditActorType, MergedConfigItem } from "@mnm/shared";
import { runGateBlock, CompiledCache } from "@mnm/gate-runner";
import { makeResolveSource } from "./governed-workflows-source-resolver.js";
import { buildGateHelpers } from "./governed-workflows-helpers.js";
import { resolveResourcePath, type ProviderWithPaths } from "./git-resource-path.js";
import { listRuns as listRunsExt, type ListRunsArgs, type ListRunsResult } from "./governed-workflows-extensions.js";
import { configLayerConflictService } from "./config-layer-conflict.js";
import { publishLiveEvent } from "./live-events.js";
import {
  emitStepUpdated,
  emitGateEvaluated,
} from "../realtime/emitters/governed-run-events.js";

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
 */
export class GovernedWorkflowError extends Error {
  constructor(
    public readonly code: (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES],
    message: string,
    public readonly hints: string[] = [],
    /**
     * Optional structured data to include in the MCP error response. Used
     * for AGENTS_STALE (fresh content) and MISSING_TOOLS (which tools).
     */
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GovernedWorkflowError";
  }
}

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
}

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
  agentName: string;
  promptContext: Record<string, unknown>;
  subagentType: string;
}

export interface CompleteStepArgs {
  companyId: string;
  runId: string;
  stepId: string;
  artifact: unknown;
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
  agentsProvisioned: string[];
  pluginVersion: string;
  userId?: string | null;
}

/**
 * Payload the harness should persist to
 * `${CLAUDE_PLUGIN_DATA}/last-session.json` — read by the SessionStart hook.
 */
export interface PushLocalStatePayload {
  lastSyncedSha: string;
  syncedAt: string;
  agentNames: string[];
  pendingRuns: number;
  openIssues: number;
  lastPluginVersion: string;
}

export interface PushLocalStateResult {
  /** Relative path under `${CLAUDE_PLUGIN_DATA}/` the harness should write to. */
  targetRelativePath: string;
  content: PushLocalStatePayload;
}

/**
 * Domain service for Governed Workflows. All reads are RLS-scoped — the
 * caller must have set `app.current_company_id` via `setTenantContext`
 * before invoking. Writes take `companyId` explicitly and include it in
 * INSERT / WHERE clauses for defense-in-depth.
 */
export function governedWorkflowService(db: Db, deps: GovernedWorkflowServiceDeps) {
  const { resolveGitProvider, shaCache } = deps;

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
          startedAt: new Date(),
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
      await tx.insert(governedStepExecutions).values(
        parsed.workflow.steps.map((s, idx) => ({
          companyId: args.companyId,
          runId: run.id,
          stepIdInJson: s.id,
          state: "pending" as const,
          createdAt: new Date(baseTime + idx),
        })),
      );

      return {
        runId: run.id,
        firstStep: firstStep.id,
        gitTag: parsed.gitTag,
        gitSha: parsed.gitSha,
      };
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

    // ── T6 self-correction: detect stale local agents ──────────────────
    // Every step references exactly one agent (step.agent). Compare its
    // canonical sha against what the harness reports in currentAgents.
    // Mismatch -> short-circuit with AGENTS_STALE; harness writes the
    // updated content and retries.
    if (args.currentAgents !== undefined) {
      const required = step.agent;
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
    const params = await fetchRunParams(args.companyId, args.runId);
    const previousArtifacts = await fetchSucceededArtifacts(db, args.runId);
    const promptContext = interpolatePromptContext(
      step.prompt_context,
      { variables: params, steps: previousArtifacts },
    );

    return {
      agentName: step.agent,
      promptContext,
      subagentType: `mnm--${step.agent}`,
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
   * Very small interpolation: walks the prompt_context tree, replaces any
   * string value matching `{{variables.<key>}}` or `{{steps.<id>.artifact.<path>}}`
   * with the resolved value. Unknown placeholders remain as literal
   * strings — a zod-style runtime validator catches this upstream at
   * complete_step time if the author expected a value.
   */
  function interpolatePromptContext(
    template: Record<string, unknown>,
    scope: { variables: Record<string, unknown>; steps: Record<string, unknown> },
  ): Record<string, unknown> {
    const walk = (v: unknown): unknown => {
      if (typeof v === "string") {
        return v.replace(
          // Allow `-` in identifiers — workflow step IDs use kebab-case
          // (`tech-design`, `merge-tag`). Without this, any path containing
          // a step ID with a hyphen returned the literal `{{...}}`.
          /\{\{\s*([a-zA-Z0-9_.\-]+)\s*\}\}/g,
          (_, path: string) => {
            const parts = path.split(".");
            let cur: any = scope;
            for (const p of parts) {
              cur = cur?.[p];
              if (cur === undefined) return `{{${path}}}`;
            }
            return typeof cur === "string" || typeof cur === "number" ? String(cur) : JSON.stringify(cur);
          },
        );
      }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") {
        return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, walk(val)]));
      }
      return v;
    };
    return walk(template) as Record<string, unknown>;
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
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${"mnm:complete:" + args.runId + ":" + args.stepId}))`,
      );

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

      // Persist artifact immediately (even before gate eval). If gate
      // fails we'll still have the last attempt's artifact on the step
      // execution for audit.
      await tx
        .update(governedStepExecutions)
        .set({
          state: step.gates?.exit ? "gate_eval" : "running",
          artifactsJson: args.artifact as Record<string, unknown>,
        })
        .where(eq(governedStepExecutions.id, stepExec.id));

      // Emit step_updated to notify UI of the artifact + state change.
      emitStepUpdated({
        publish: publishLiveEvent,
        companyId: args.companyId,
        runId: args.runId,
        stepExecId: stepExec.id,
      });

      const exitBlock = step.gates?.exit as GateBlock | undefined;
      if (exitBlock && exitBlock.length > 0) {
        const gitProvider = await resolveGitProvider({
          companyId: args.companyId,
          userId: args.actor.type === "user" ? args.actor.id : null,
          resourceType: "workflow",
        });
        const helpers = buildGateHelpers({ db, companyId: args.companyId, resolveGitProvider });
        const previousArtifacts = await fetchSucceededArtifacts(tx as unknown as Db, args.runId);
        const context: GateContext = {
          artifact: args.artifact,
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
      await tx
        .update(governedStepExecutions)
        .set({ state: "succeeded", completedAt: new Date() })
        .where(eq(governedStepExecutions.id, stepExec.id));

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
      if (allDone) {
        await tx
          .update(governedWorkflowRuns)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(governedWorkflowRuns.id, args.runId));
      }

      return {
        stepState: "succeeded" as const,
        runStatus: allDone ? ("completed" as const) : ("active" as const),
      };
    });
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
      out[r.stepId] = { artifact: r.artifacts };
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
   * `lastSyncedSha` is the syncEnvironment sha recomputed so the hook knows
   * whether remote state drifted since the last tool call. `pendingRuns`
   * and `openIssues` are counted from the DB at call time.
   */
  async function pushLocalState(args: PushLocalStateArgs): Promise<PushLocalStateResult> {
    const sync = await syncEnvironment({ companyId: args.companyId, userId: args.userId ?? null });

    const pendingRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(governedWorkflowRuns)
      .where(
        and(
          eq(governedWorkflowRuns.companyId, args.companyId),
          eq(governedWorkflowRuns.status, "active"),
        ),
      );
    const pendingRuns = Number(pendingRows[0]?.count ?? 0);

    // `openIssues` is out of scope for T6 MVP — issues aren't modelled in the
    // governed-workflows surface yet. Return 0 as a stable placeholder.
    const openIssues = 0;

    return {
      targetRelativePath: "last-session.json",
      content: {
        lastSyncedSha: sync.newSha,
        syncedAt: new Date().toISOString(),
        agentNames: args.agentsProvisioned,
        pendingRuns,
        openIssues,
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
  };
}

export type GovernedWorkflowService = ReturnType<typeof governedWorkflowService>;
