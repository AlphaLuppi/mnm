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
} from "@mnm/governed-workflows";
import type { GitProvider, ShaCache } from "@mnm/git-provider";
import type { AuditActorType } from "@mnm/shared";

// Constant providerId for ShaCache (providerId, path, sha) tuple.
const PROVIDER_ID = "mnm-workflows";

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

  // Further methods land in Task 7/8/9 (launchStep, completeStep,
  // syncEnvironment).

  return {
    listDefinitions,
    getDefinition,
    getWorkflowParsed,
    launchWorkflow,
    getRun,
  };
}

export type GovernedWorkflowService = ReturnType<typeof governedWorkflowService>;
