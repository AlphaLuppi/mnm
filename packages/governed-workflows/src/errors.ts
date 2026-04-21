/**
 * Fail-closed error codes produced by the gate runner (`@mnm/gate-runner`) when
 * a gate invocation cannot produce a user-authored verdict. These appear in
 * `gate_results.error_code` (DB) and surface to the Claude Code harness as
 * part of the `GateEvaluationResult`:
 *
 * - `GATE_TIMEOUT` — isolate exceeded `RunnerOptions.timeoutMs` (default 5 s).
 * - `GATE_EXCEPTION` — user code threw, OR the esbuild transform of the source
 *   failed.
 * - `GATE_INVALID_OUTPUT` — gate returned, but the value did not match
 *   `gateOutputSchema` (missing `pass`/`report`, wrong types, or unrecognised
 *   keys — strict mode enforced).
 * - `GATE_SANDBOX_CRASH` — isolated-vm disposed the isolate mid-run (typically
 *   memory-limit breach or native addon fault). Retried once by the runner;
 *   a second crash surfaces this code.
 *
 * These codes are produced ONLY by the gate runner. Do not emit them from
 * other parts of the workflow orchestrator — use `WORKFLOW_ERROR_CODES` below.
 */
export const GATE_ERROR_CODES = Object.freeze({
  GATE_TIMEOUT: "GATE_TIMEOUT",
  GATE_EXCEPTION: "GATE_EXCEPTION",
  GATE_INVALID_OUTPUT: "GATE_INVALID_OUTPUT",
  GATE_SANDBOX_CRASH: "GATE_SANDBOX_CRASH",
} as const);

export type GateErrorCode = (typeof GATE_ERROR_CODES)[keyof typeof GATE_ERROR_CODES];

/**
 * Business error codes produced by the workflow orchestrator (MCP tools layer,
 * T5). These appear in MCP tool error payloads (`{ isError: true, error_code,
 * message, hints }`) returned to the Claude Code harness — NOT in
 * `gate_results.error_code`:
 *
 * - `WORKFLOW_NOT_FOUND` — `getWorkflow` / `launchWorkflow` with an unknown
 *   name (or unknown `git_tag` at that name).
 * - `WORKFLOW_DEPENDENCY_UNMET` — `launchStep` called on a step whose `deps`
 *   are not all `succeeded`.
 * - `WORKFLOW_STEP_NOT_FOUND` — `launchStep` / `completeStep` with a `stepId`
 *   not in the run's parsed workflow.
 * - `WORKFLOW_INVALID_ARTIFACT` — `completeStep` called with an artifact the
 *   step's exit-gate block flagged as invalid in a deterministic pre-check
 *   (distinct from a gate verdict — this is malformed data, not a failed
 *   business rule).
 * - `WORKFLOW_ALREADY_COMPLETED` — mutation attempted on a run already in
 *   `completed` or `failed` status.
 *
 * These codes are produced ONLY by the orchestrator. Gate runner code must
 * use `GATE_ERROR_CODES` instead.
 */
export const WORKFLOW_ERROR_CODES = Object.freeze({
  WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
  WORKFLOW_DEPENDENCY_UNMET: "WORKFLOW_DEPENDENCY_UNMET",
  WORKFLOW_STEP_NOT_FOUND: "WORKFLOW_STEP_NOT_FOUND",
  WORKFLOW_INVALID_ARTIFACT: "WORKFLOW_INVALID_ARTIFACT",
  WORKFLOW_ALREADY_COMPLETED: "WORKFLOW_ALREADY_COMPLETED",
} as const);

export type WorkflowErrorCode =
  (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES];
