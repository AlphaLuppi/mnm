/**
 * Uniform error codes returned by the gate runner (server-side).
 * Exposed via gate_results.error_code in DB and in MCP error payloads.
 */
export const GATE_ERROR_CODES = Object.freeze({
  GATE_TIMEOUT: "GATE_TIMEOUT",
  GATE_EXCEPTION: "GATE_EXCEPTION",
  GATE_INVALID_OUTPUT: "GATE_INVALID_OUTPUT",
  GATE_SANDBOX_CRASH: "GATE_SANDBOX_CRASH",
} as const);

export type GateErrorCode = (typeof GATE_ERROR_CODES)[keyof typeof GATE_ERROR_CODES];

/**
 * Uniform error codes returned by the workflow orchestrator (MCP tools).
 * Exposed to the Claude Code harness as `error_code` in MCP error payloads.
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
