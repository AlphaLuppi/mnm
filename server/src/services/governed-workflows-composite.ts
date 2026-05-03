/**
 * server/src/services/governed-workflows-composite.ts
 *
 * Meta-workflow composite resolver (T5.2). A `composite` step in
 * `workflow.json` references another workflow via `uses: workflows/<name>@<ref>`
 * and, at run time, expands into a brand-new sub-run whose final outputs
 * become the parent step's artifact when it completes.
 *
 * This module is the single owner of:
 *
 *  - **`detectCycle(workflow, deps)`** — STATIC pre-flight walk over the
 *    `uses:` graph at launch time. Refuses any DAG that would close a cycle
 *    (A → B → A). `deps` is a function returning the parsed sub-workflow
 *    given a `workflows/<name>@<ref>` ref; it lets callers inject their own
 *    fetch + cache (the resolver doesn't reach git itself — keeps the
 *    module unit-testable).
 *
 *  - **`enforceFanoutCap(db, rootRunId)`** — RUNTIME guard checked before
 *    every `launchCompositeStep`. Counts step_executions for the chain
 *    rooted at `rootRunId` and refuses if > cap (default 1000). Mitigates
 *    M4 (denial-of-wallet via runaway sub-run expansion).
 *
 *  - **`launchCompositeStep`** — creates the sub-run row + its step
 *    executions, and links them back to the parent step
 *    (`parent_step_execution_id`, `composite_run_id`, `root_run_id`).
 *    Note: the **outer step row** of the composite step lives in the
 *    PARENT run — its `compositeRunId` points at the brand-new sub-run.
 *
 *  - **`completeCompositeStep`** — marks the parent composite step as
 *    succeeded once the sub-run completes, copying the sub-run's leaf-step
 *    outputs into the parent's artifact.
 *
 *  - **`fetchSucceededArtifactsRecursive`** — drop-in replacement for
 *    `fetchSucceededArtifacts(runId)` that also descends through composite
 *    sub-runs so `previous_artifacts` keeps working across run boundaries
 *    (cf. plan §5.2.3).
 *
 * Human traceability §1.7 — every composite expansion records the
 * launching actor (user or agent) on the new sub-run + step rows. There
 * is no "synthetic" or "system" actor : the human who triggered the root
 * run is the human attributed to every descendant.
 */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  governedStepExecutions,
  governedWorkflowDefinitions,
  governedWorkflowRuns,
} from "@mnm/db";
import {
  COMPOSITE_USES_REGEX,
  WORKFLOW_ERROR_CODES,
  type WorkflowDefinition,
  type WorkflowStep,
} from "@mnm/governed-workflows";
import { GovernedWorkflowError } from "./governed-workflows-error.js";
import type { AuditActorType } from "@mnm/shared";

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Maximum number of step_executions that may exist in a single root-run
 * chain (root + every descendant composite expansion). Prevents a runaway
 * meta-workflow from issuing 10⁶ sub-runs (M4 — denial-of-wallet).
 */
export const COMPOSITE_FANOUT_CAP = 1000;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParseUsesResult {
  /** Workflow name part of `workflows/<name>@<ref>`. */
  name: string;
  /** Git ref (tag, branch, sha) part. */
  ref: string;
}

/**
 * Resolver injected into `detectCycle`. Returns the parsed sub-workflow
 * for a given `uses:` ref, or null if the workflow is unknown. Callers
 * are expected to use ShaCache + workflow registry; the resolver here
 * stays I/O-free.
 */
export type CompositeWorkflowResolver = (
  ref: string,
) => Promise<WorkflowDefinition | null>;

export interface DetectCycleArgs {
  /** Root workflow being launched (the one user just kicked off). */
  workflow: WorkflowDefinition;
  /** Resolver for sub-workflows referenced via `uses:`. */
  resolveWorkflow: CompositeWorkflowResolver;
  /** Maximum walk depth — guard against unbounded recursion. */
  maxDepth?: number;
}

export interface LaunchCompositeStepArgs {
  parentStepExecutionId: string;
  /**
   * The current run's `id`. We use this as `rootRunId` for the new sub-run
   * iff the parent run is itself a root (i.e. its steps have no
   * `rootRunId` set yet). Otherwise we propagate the existing `rootRunId`.
   */
  parentRunId: string;
  /** Resolved sub-workflow definition (already parsed by caller). */
  subWorkflow: WorkflowDefinition;
  /** Git tag and sha the sub-workflow was loaded at — pinned on the sub-run. */
  subWorkflowGitTag: string;
  subWorkflowGitSha: string;
  /** Resolved governedWorkflowDefinitions.id for the sub-workflow. */
  subWorkflowDefId: string;
  /** Variables passed to the sub-run (the composite step's `params`). */
  params: Record<string, unknown>;
  /** Human actor — propagated as `initiatedBy` on the sub-run. */
  actor: { type: AuditActorType; id: string };
  companyId: string;
}

export interface LaunchCompositeStepResult {
  subRunId: string;
  rootRunId: string;
  /** Map of stepId-in-json → step_execution.id for the sub-run's pending rows. */
  stepExecIdsByName: Record<string, string>;
}

export interface CompleteCompositeStepArgs {
  parentStepExecutionId: string;
  /** Final outputs from the sub-run's last leaf step. Will be persisted
   *  as the parent step's `artifactsJson`. */
  finalOutputs: Record<string, unknown>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse `workflows/<name>@<ref>` into its components. Throws
 * `WORKFLOW_USES_INVALID` if the ref doesn't match the canonical regex.
 */
export function parseCompositeUses(uses: string): ParseUsesResult {
  if (!COMPOSITE_USES_REGEX.test(uses)) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_USES_INVALID,
      `composite step \`uses\` must match workflows/<name>@<ref>; got '${uses}'`,
    );
  }
  // Slice past the `workflows/` prefix, then split on the first `@`.
  const after = uses.slice("workflows/".length);
  const at = after.indexOf("@");
  return { name: after.slice(0, at), ref: after.slice(at + 1) };
}

function compositeStepsOf(workflow: WorkflowDefinition): WorkflowStep[] {
  return workflow.steps.filter((s) => s.type === "composite" && !!s.uses);
}

// ─── Cycle detection (static, launch-time) ──────────────────────────────────

/**
 * Walk the `uses:` graph rooted at `workflow` and refuse any cycle.
 *
 * Algorithm: classic DFS with three sets — `visiting` (current stack) and
 * `visited` (fully explored). Hitting a node already in `visiting` ⇒ cycle.
 * `visited` short-circuits diamond shapes (A → B, A → C, both → D — D is
 * walked exactly once).
 *
 * `maxDepth` is a belt-and-braces against malicious unbounded resolvers
 * (the regex already constrains shape; this caps walk cost).
 */
export async function detectCycle(args: DetectCycleArgs): Promise<void> {
  const maxDepth = args.maxDepth ?? 32;
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  async function walk(
    wf: WorkflowDefinition,
    selfRef: string,
    depth: number,
  ): Promise<void> {
    if (depth > maxDepth) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_COMPOSITE_DEPTH_EXCEEDED,
        `composite uses chain exceeds max depth ${maxDepth} at '${selfRef}'`,
        [`Chain: ${stack.concat(selfRef).join(" → ")}`],
      );
    }
    if (visited.has(selfRef)) return;
    if (visiting.has(selfRef)) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_COMPOSITE_CYCLE,
        `composite uses cycle detected: ${stack.concat(selfRef).join(" → ")}`,
      );
    }
    visiting.add(selfRef);
    stack.push(selfRef);

    for (const step of compositeStepsOf(wf)) {
      const childRef = step.uses!;
      const child = await args.resolveWorkflow(childRef);
      if (!child) {
        // Unknown sub-workflow at static-analysis time isn't a cycle —
        // surface a distinct error so the operator gets actionable feedback.
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_COMPOSITE_USES_NOT_FOUND,
          `composite step '${step.id}' references unknown workflow '${childRef}'`,
        );
      }
      await walk(child, childRef, depth + 1);
    }

    visiting.delete(selfRef);
    stack.pop();
    visited.add(selfRef);
  }

  // The root has no `uses:` — synthesise one so we can detect a cycle that
  // closes back on the root (A → B → A pattern).
  const rootRef = `workflows/${args.workflow.name}@__root__`;
  await walk(args.workflow, rootRef, 0);
}

// ─── Fan-out cap (runtime, every launchCompositeStep) ──────────────────────

/**
 * Counts the total number of step_executions belonging to the chain rooted
 * at `rootRunId` (= step rows whose root_run_id matches OR whose runId is
 * the root itself). Throws `WORKFLOW_COMPOSITE_FANOUT_EXCEEDED` if the
 * count is at or above `cap`.
 *
 * Multi-tenant safe: scoped by `companyId` (RLS belt + Drizzle braces).
 */
export async function enforceFanoutCap(args: {
  db: Db;
  companyId: string;
  rootRunId: string;
  cap?: number;
}): Promise<void> {
  const cap = args.cap ?? COMPOSITE_FANOUT_CAP;
  // Count rows where root_run_id = rootRunId OR run_id = rootRunId (the
  // root itself). PostgreSQL evaluates this against the partial index
  // (company_id, root_run_id) for the first leg + the regular run index
  // for the second.
  const [{ n }] = await args.db.execute<{ n: number }>(
    sql`SELECT COUNT(*)::int AS n
        FROM governed_step_executions
        WHERE company_id = ${args.companyId}
          AND (root_run_id = ${args.rootRunId} OR run_id = ${args.rootRunId})`,
  );
  if (n >= cap) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_COMPOSITE_FANOUT_EXCEEDED,
      `composite chain rooted at ${args.rootRunId} reached fan-out cap ${cap} (current=${n})`,
      [
        `Inspect the chain: SELECT * FROM governed_step_executions WHERE root_run_id = '${args.rootRunId}'`,
        "Reduce sub-workflow recursion or split the run into independent root runs.",
      ],
    );
  }
}

// ─── Recursive previous_artifacts (cross-run) ──────────────────────────────

interface SuccArtifactRow {
  stepId: string;
  artifacts: Record<string, unknown> | null;
  compositeRunId: string | null;
}

/**
 * Variant of the orchestrator's `fetchSucceededArtifacts` that descends
 * through composite sub-runs. Used so a downstream step inside a composite
 * sub-run can see `{{ steps.<parent_step>.artifact.outputs.X }}` as if the
 * artifact were a leaf, even when the parent step is itself a composite
 * expansion of yet another workflow.
 *
 * Strategy: BFS from `runId`, accumulating each succeeded step's artifact.
 * When a step row has `compositeRunId`, recurse into that sub-run too.
 * Visited set on `runId` guards against pathological cases (a sub-run
 * being referenced from two different parents — shouldn't happen, but
 * cheap defence).
 */
export async function fetchSucceededArtifactsRecursive(
  db: Db,
  rootRunId: string,
): Promise<Record<string, unknown>> {
  const visited = new Set<string>();
  const queue: string[] = [rootRunId];
  const out: Record<string, unknown> = {};

  while (queue.length > 0) {
    const runId = queue.shift()!;
    if (visited.has(runId)) continue;
    visited.add(runId);

    const rows = await db
      .select({
        stepId: governedStepExecutions.stepIdInJson,
        artifacts: governedStepExecutions.artifactsJson,
        compositeRunId: governedStepExecutions.compositeRunId,
      })
      .from(governedStepExecutions)
      .where(
        and(
          eq(governedStepExecutions.runId, runId),
          sql`${governedStepExecutions.state} = 'succeeded'`,
        ),
      ) as SuccArtifactRow[];

    for (const r of rows) {
      // Don't overwrite — first writer wins. Conceptually root-run steps
      // override descendant ones since they were enqueued first.
      if (r.artifacts && !(r.stepId in out)) {
        out[r.stepId] = r.artifacts;
      }
      if (r.compositeRunId && !visited.has(r.compositeRunId)) {
        queue.push(r.compositeRunId);
      }
    }
  }

  return out;
}

// ─── Launch / complete a composite step ────────────────────────────────────

/**
 * Launches a sub-run as the expansion of a composite parent step.
 *
 * Effects (single transaction):
 *   1. enforceFanoutCap on the chain → throws if at cap.
 *   2. INSERT governed_workflow_runs row for the sub-run.
 *   3. INSERT one governed_step_executions row per step in the sub-workflow.
 *      Every row carries `parentStepExecutionId` (the parent composite step)
 *      AND `rootRunId` (propagated from parent or set to parent run id if
 *      parent is itself the root).
 *   4. UPDATE the parent step row: set `compositeRunId` (so the UI can
 *      navigate parent → child) and ensure `rootRunId` is set.
 *
 * The parent step state is NOT changed here — it stays `running` /
 * `gate_eval` until `completeCompositeStep` consumes the sub-run outputs.
 */
export async function launchCompositeStep(
  db: Db,
  args: LaunchCompositeStepArgs,
): Promise<LaunchCompositeStepResult> {
  // Determine the root run id. Read the parent step row; if it already
  // carries `rootRunId`, propagate it. Otherwise the parent run *is* the
  // root → use parentRunId.
  const [parentStep] = await db
    .select({
      id: governedStepExecutions.id,
      runId: governedStepExecutions.runId,
      rootRunId: governedStepExecutions.rootRunId,
      companyId: governedStepExecutions.companyId,
    })
    .from(governedStepExecutions)
    .where(
      and(
        eq(governedStepExecutions.id, args.parentStepExecutionId),
        eq(governedStepExecutions.companyId, args.companyId),
      ),
    );
  if (!parentStep) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_STEP_NOT_FOUND,
      `composite parent step '${args.parentStepExecutionId}' not found`,
    );
  }
  const rootRunId = parentStep.rootRunId ?? parentStep.runId;

  // Fan-out cap check (runtime — every launchCompositeStep counts).
  await enforceFanoutCap({
    db,
    companyId: args.companyId,
    rootRunId,
    cap: COMPOSITE_FANOUT_CAP,
  });

  return await db.transaction(async (tx) => {
    const launchedAt = new Date();
    const [subRun] = await tx
      .insert(governedWorkflowRuns)
      .values({
        companyId: args.companyId,
        workflowDefId: args.subWorkflowDefId,
        workflowGitTag: args.subWorkflowGitTag,
        workflowGitSha: args.subWorkflowGitSha,
        initiatedByActorType: args.actor.type,
        initiatedByActorId: args.actor.id,
        status: "active",
        startedAt: launchedAt,
        lastUsefulActionAt: launchedAt,
        nextActionHint: "composite sub-run launched",
        paramsJson: args.params,
      })
      .returning({ id: governedWorkflowRuns.id });

    const baseTime = Date.now();
    const insertedSteps = await tx
      .insert(governedStepExecutions)
      .values(
        args.subWorkflow.steps.map((s, idx) => ({
          companyId: args.companyId,
          runId: subRun.id,
          stepIdInJson: s.id,
          state: "pending" as const,
          createdAt: new Date(baseTime + idx),
          parentStepExecutionId: args.parentStepExecutionId,
          rootRunId,
        })),
      )
      .returning({
        id: governedStepExecutions.id,
        stepIdInJson: governedStepExecutions.stepIdInJson,
      });

    // Link the parent composite step → child sub-run (so UI can navigate
    // and `fetchSucceededArtifactsRecursive` can descend). Also stamp the
    // root_run_id on the parent if it wasn't set yet (first composite
    // expansion in the chain).
    await tx
      .update(governedStepExecutions)
      .set({ compositeRunId: subRun.id, rootRunId })
      .where(eq(governedStepExecutions.id, args.parentStepExecutionId));

    return {
      subRunId: subRun.id,
      rootRunId,
      stepExecIdsByName: Object.fromEntries(
        insertedSteps.map((s) => [s.stepIdInJson, s.id]),
      ) as Record<string, string>,
    };
  });
}

/**
 * Marks the parent composite step as succeeded, copying the sub-run's
 * final outputs into its `artifactsJson`. Caller (the wired completeStep)
 * is responsible for ensuring the sub-run reached `completed` first.
 */
export async function completeCompositeStep(
  db: Db,
  args: CompleteCompositeStepArgs,
): Promise<void> {
  await db
    .update(governedStepExecutions)
    .set({
      state: "succeeded",
      completedAt: new Date(),
      artifactsJson: args.finalOutputs,
    })
    .where(eq(governedStepExecutions.id, args.parentStepExecutionId));
}

// Internal helper kept here for build/test convenience.
export const __test = {
  compositeStepsOf,
};
