/**
 * Schedule tick for `workflow_triggers` (kind='schedule').
 *
 * Split out from `workflow-triggers.ts` so the main service module can
 * stay focused on CRUD + the synchronous webhook fire path. The tick
 * runs from a setInterval in `server/src/index.ts` (default every 30s,
 * tunable via `MNM_WORKFLOW_TRIGGER_TICK_MS`, kill switch
 * `MNM_DISABLE_AUTO_TRIGGERS=1`).
 *
 * **V0 single-instance** — there is no advisory-xact lock yet. The tick
 * scans + dispatches in a single pass; deployments running multiple
 * Express instances must either set `MNM_DISABLE_AUTO_TRIGGERS=1` on
 * all-but-one node, or wait for the multi-instance promotion (TODO V1
 * `pg_advisory_xact_lock(hashtext('mnm:workflow-trigger-tick'))` inside
 * a transaction so the lock survives the dispatch loop).
 *
 * Per-fire side effects mirror `verifyAndFire`:
 *   - dispatch into Governed Workflows (launch_run / launch_step / complete_step)
 *   - audit row in `workflow_trigger_audit` (outcome=ok | error:<msg>)
 *   - update `workflow_triggers.lastFiredAt` + `lastResult`
 *   - publishLiveEvent so the Studio UI sees the trigger fire live.
 */
import { and, eq, lte } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { workflowTriggers, workflowTriggerAudit, type WorkflowTriggerRow } from "@mnm/db";
import { publishLiveEvent } from "./live-events.js";
import { nextCronTick } from "./_cron.js";
import {
  workflowTriggersService,
  type WorkflowTriggersService,
} from "./workflow-triggers.js";
import type { GovernedWorkflowService } from "./governed-workflows.js";

export interface TickResult {
  triggerId: string;
  workflowDefRef: string;
  outcome: "ok" | "error";
  runId: string | null;
  errorMessage: string | null;
}

export async function tickWorkflowTriggers(
  db: Db,
  governed: GovernedWorkflowService,
  now: Date = new Date(),
): Promise<TickResult[]> {
  const svc: WorkflowTriggersService = workflowTriggersService(db, { governed });
  const internals = svc._internals;

  const due = await db
    .select()
    .from(workflowTriggers)
    .where(
      and(
        eq(workflowTriggers.kind, "schedule"),
        eq(workflowTriggers.enabled, true),
        lte(workflowTriggers.nextRunAt, now),
      ),
    );

  const results: TickResult[] = [];

  for (const trigger of due) {
    let outcome: TickResult["outcome"] = "ok";
    let runId: string | null = null;
    let errorMessage: string | null = null;

    // Recompute nextRunAt FIRST so a slow dispatch doesn't re-pick the
    // same trigger on the very next tick. If parsing the cron fails we
    // skip dispatch entirely and audit the parse error.
    let next: Date;
    try {
      next = nextCronTick(trigger.cronExpression!, trigger.timezone ?? "UTC", now);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      await auditAndMark({
        db,
        trigger,
        outcome: `error:cron-parse:${errorMessage}`.slice(0, 256),
        runId: null,
        now,
      });
      results.push({
        triggerId: trigger.id,
        workflowDefRef: trigger.workflowDefRef,
        outcome: "error",
        runId: null,
        errorMessage,
      });
      continue;
    }

    await db
      .update(workflowTriggers)
      .set({ nextRunAt: next, lastFiredAt: now, updatedAt: now })
      .where(eq(workflowTriggers.id, trigger.id));

    try {
      const dispatched = await internals.dispatch({ trigger, body: {} });
      runId = dispatched.runId;

      await internals.insertAudit({
        companyId: trigger.companyId,
        triggerId: trigger.id,
        workflowDefRef: trigger.workflowDefRef,
        action: trigger.action,
        outcome: "ok",
        runId,
        stepExecutionId: dispatched.stepExecutionId,
        idempotencyKey: null,
        payload: {},
        actorUserId: trigger.createdByUserId,
      });
      await internals.markFired(trigger.id, "ok");

      publishLiveEvent({
        companyId: trigger.companyId,
        type: "workflow_trigger.fired",
        payload: {
          triggerId: trigger.id,
          workflowDefRef: trigger.workflowDefRef,
          action: trigger.action,
          runId,
        },
        visibility: { scope: "company-wide" },
      });
    } catch (err) {
      outcome = "error";
      errorMessage = err instanceof Error ? err.message : String(err);
      await auditAndMark({
        db,
        trigger,
        outcome: `error:${errorMessage}`.slice(0, 256),
        runId: null,
        now,
      });
    }

    results.push({
      triggerId: trigger.id,
      workflowDefRef: trigger.workflowDefRef,
      outcome,
      runId,
      errorMessage,
    });
  }

  return results;
}

async function auditAndMark(args: {
  db: Db;
  trigger: WorkflowTriggerRow;
  outcome: string;
  runId: string | null;
  now: Date;
}): Promise<void> {
  await args.db.insert(workflowTriggerAudit).values({
    companyId: args.trigger.companyId,
    triggerId: args.trigger.id,
    workflowDefRef: args.trigger.workflowDefRef,
    action: args.trigger.action,
    outcome: args.outcome,
    runId: args.runId,
    stepExecutionId: null,
    idempotencyKey: null,
    payload: {},
    actorUserId: args.trigger.createdByUserId,
  });
  await args.db
    .update(workflowTriggers)
    .set({ lastResult: args.outcome, updatedAt: args.now })
    .where(eq(workflowTriggers.id, args.trigger.id));
}
