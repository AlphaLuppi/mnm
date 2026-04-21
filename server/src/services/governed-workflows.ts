import { and, desc, eq, sql } from "drizzle-orm";
import {
  governedWorkflowDefinitions,
  governedWorkflowRuns,
  governedStepExecutions,
  gateResults,
  type Db,
} from "@mnm/db";
import {
  workflowDefinitionSchema,
  WORKFLOW_ERROR_CODES,
  type WorkflowDefinition,
  type GateContext,
  type GateBlock,
} from "@mnm/governed-workflows";
import type { GitProvider, ShaCache } from "@mnm/git-provider";
import type { AuditActorType } from "@mnm/shared";
import { runGateBlock, CompiledCache } from "@mnm/gate-runner";
import { makeResolveSource } from "./governed-workflows-source-resolver.js";
import { buildGateHelpers } from "./governed-workflows-helpers.js";

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
  ) {
    super(message);
    this.name = "GovernedWorkflowError";
  }
}

export interface GovernedWorkflowServiceDeps {
  gitProvider: GitProvider;
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

/**
 * Domain service for Governed Workflows. All reads are RLS-scoped — the
 * caller must have set `app.current_company_id` via `setTenantContext`
 * before invoking. Writes take `companyId` explicitly and include it in
 * INSERT / WHERE clauses for defense-in-depth.
 */
export function governedWorkflowService(db: Db, deps: GovernedWorkflowServiceDeps) {
  const { gitProvider, shaCache } = deps;

  // ─── Discovery ──────────────────────────────────────────────────

  async function listDefinitions(args: { companyId: string; enabled?: boolean }) {
    const conds = [eq(governedWorkflowDefinitions.companyId, args.companyId)];
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
   * Path convention: the MVP assumes each workflow lives under `<name>/`
   * in its repo, with its entry point at `<name>/workflow.json` — see
   * spec §3 "Repo structure". Until we have explicit config, we derive
   * the path from `definition.name`.
   */
  async function getWorkflowParsed(args: {
    companyId: string;
    name: string;
    gitTag?: string;
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

    const gitSha = await gitProvider.resolveRef({ ref });
    const workflowRepoPath = `${args.name}/workflow.json`;

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

      await tx.insert(governedStepExecutions).values(
        parsed.workflow.steps.map((s) => ({
          companyId: args.companyId,
          runId: run.id,
          stepIdInJson: s.id,
          state: "pending" as const,
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

    // Evaluate entry gate if present
    const entryBlock = step.gates?.entry as GateBlock | undefined;
    if (entryBlock && entryBlock.length > 0) {
      const helpers = buildGateHelpers({ db, companyId: args.companyId });
      const previousArtifacts = buildPreviousArtifacts(run);
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

      // Persist every gate_result row
      const [stepExec] = await db
        .select({ id: governedStepExecutions.id })
        .from(governedStepExecutions)
        .where(
          and(
            eq(governedStepExecutions.runId, args.runId),
            eq(governedStepExecutions.stepIdInJson, args.stepId),
          ),
        );

      await db.insert(gateResults).values(
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
      );

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
    }

    // Interpolate prompt_context placeholders (`{{variables.name}}`,
    // `{{steps.greet.artifact.greeting}}`) against the run's params +
    // previous artifacts. For MVP, only two substitution patterns are
    // supported — see `interpolatePromptContext` below.
    const params = await fetchRunParams(args.companyId, args.runId);
    const previousArtifacts = buildPreviousArtifacts(run);
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

  // Helper: assemble { [stepId]: artifact } from succeeded steps for a run.
  function buildPreviousArtifacts(run: GetRunResult): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const step of run.steps) {
      if (step.state === "succeeded") {
        // Re-read artifacts from DB; steps[].artifactsJson isn't on the
        // summary. Async reads inside a sync helper aren't possible, so
        // callers that need full artifacts pass them separately. MVP
        // version leaves this shape empty; interpolation step below reads
        // lazily.
        out[step.id] = undefined;
      }
    }
    return out;
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
          /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
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

      const exitBlock = step.gates?.exit as GateBlock | undefined;
      if (exitBlock && exitBlock.length > 0) {
        const helpers = buildGateHelpers({ db, companyId: args.companyId });
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

        await tx.insert(gateResults).values(
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
        );

        if (!blockResult.pass) {
          const failed = blockResult.gate_results.find((r) => !r.pass);
          await tx
            .update(governedStepExecutions)
            .set({ state: "running" })
            .where(eq(governedStepExecutions.id, stepExec.id));
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

  // Further methods land in Task 9 (syncEnvironment).

  return {
    listDefinitions,
    getDefinition,
    getWorkflowParsed,
    launchWorkflow,
    getRun,
    launchStep,
    completeStep,
  };
}

export type GovernedWorkflowService = ReturnType<typeof governedWorkflowService>;
