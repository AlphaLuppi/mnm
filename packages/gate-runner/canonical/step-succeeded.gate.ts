/**
 * Canonical gate: step-succeeded
 *
 * Verifies that a named previous step has already succeeded in the current
 * run. This gate is a pure lookup against `ctx.step.previous_artifacts`.
 *
 * Semantic: the governed-workflows runner ONLY populates
 * `previous_artifacts[<id>]` for steps that completed successfully — failed,
 * skipped, or not-yet-run steps are absent. Therefore "the key exists" is a
 * safe proxy for "the step succeeded".
 *
 * Config:
 *   - `step` (required, string): the step id to check.
 *
 * Error codes:
 *   - GATE_INVALID_CONFIG  — `step` missing or not a string.
 *   - STEP_NOT_SUCCEEDED   — no artifact recorded for that step id.
 */
import { defineGate } from "@mnm/governed-workflows";

export default defineGate<unknown, { step?: unknown }>(async (ctx) => {
  const stepId = ctx.config.step;
  if (typeof stepId !== "string" || stepId.length === 0) {
    return {
      pass: false,
      error_code: "GATE_INVALID_CONFIG",
      report: "step-succeeded: config.step is required (string)",
    };
  }

  const hasArtifact =
    Object.prototype.hasOwnProperty.call(ctx.step.previous_artifacts, stepId) &&
    ctx.step.previous_artifacts[stepId] !== undefined;

  if (!hasArtifact) {
    return {
      pass: false,
      error_code: "STEP_NOT_SUCCEEDED",
      report: `step-succeeded: ${stepId} has not completed successfully`,
      hints: [
        `Run step "${stepId}" to completion before re-entering this step.`,
      ],
    };
  }

  return {
    pass: true,
    report: `step-succeeded: ${stepId} has completed successfully`,
  };
});
