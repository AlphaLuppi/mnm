import type { LiveEventType } from "@mnm/shared";

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
