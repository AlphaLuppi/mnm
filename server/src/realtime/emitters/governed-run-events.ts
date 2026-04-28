import type { AuditActorType, LiveEventType } from "@mnm/shared";

/**
 * Minimal publish contract. Matches the signature of `publishLiveEvent` from
 * `server/src/services/live-events.ts` so callers can pass it directly or
 * substitute a test double.
 */
export interface PublishFn {
  (event: { companyId: string; type: LiveEventType; payload?: Record<string, unknown> }): void;
}

/**
 * Emit a `governed_run.step_updated` event.
 *
 * Call this after any `governedStepExecutions` state transition (running,
 * succeeded, failed) so the UI can invalidate the runDetail query.
 */
export function emitStepUpdated(args: {
  publish: PublishFn;
  companyId: string;
  runId: string;
  stepExecId: string;
}): void {
  args.publish({
    companyId: args.companyId,
    type: "governed_run.step_updated",
    payload: { runId: args.runId, stepExecId: args.stepExecId },
  });
}

/**
 * Emit a `governed_run.gate_evaluated` event.
 *
 * Call this after a `gate_results` row is inserted so the UI can refresh
 * the gate result panel without polling.
 */
export function emitGateEvaluated(args: {
  publish: PublishFn;
  companyId: string;
  runId: string;
  stepExecId: string;
  gateResultId: string;
}): void {
  args.publish({
    companyId: args.companyId,
    type: "governed_run.gate_evaluated",
    payload: {
      runId: args.runId,
      stepExecId: args.stepExecId,
      gateResultId: args.gateResultId,
    },
  });
}

/**
 * Emit a `governed_run.cancelled` event.
 *
 * Call this after a run is cancelled (status transitions to `cancelled` and
 * pending step executions are marked cancelled) so the UI can refresh the
 * run detail view without polling.
 */
export function emitRunCancelled(args: {
  publish: PublishFn;
  companyId: string;
  runId: string;
  cancelledAt: Date;
  cancelledByActorId: string;
  cancelledByActorType: AuditActorType;
  reason: string;
  cancelledStepIds: string[];
}): void {
  args.publish({
    companyId: args.companyId,
    type: "governed_run.cancelled",
    payload: {
      runId: args.runId,
      cancelledAt: args.cancelledAt.toISOString(),
      cancelledByActorId: args.cancelledByActorId,
      cancelledByActorType: args.cancelledByActorType,
      reason: args.reason,
      cancelledStepIds: args.cancelledStepIds,
    },
  });
}

/**
 * Emit a `governed_run.reactivated` event.
 *
 * Call this after a cancelled run is reactivated (status reset and the
 * cancelled step executions become pending again) so the UI can refresh
 * the run detail view without polling.
 */
export function emitRunReactivated(args: {
  publish: PublishFn;
  companyId: string;
  runId: string;
  reactivatedByActorId: string;
  reactivatedByActorType: AuditActorType;
  reactivatedStepIds: string[];
}): void {
  args.publish({
    companyId: args.companyId,
    type: "governed_run.reactivated",
    payload: {
      runId: args.runId,
      reactivatedByActorId: args.reactivatedByActorId,
      reactivatedByActorType: args.reactivatedByActorType,
      reactivatedStepIds: args.reactivatedStepIds,
    },
  });
}
