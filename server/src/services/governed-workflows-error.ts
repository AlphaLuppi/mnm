/**
 * server/src/services/governed-workflows-error.ts
 *
 * Standalone module for `GovernedWorkflowError` so satellite services
 * (workflows-composite, future workflows-X) can throw the canonical error
 * type WITHOUT pulling in the full `governed-workflows.ts` dependency
 * graph (which would create a cycle for any module the main service
 * imports). Mirrors `WORKFLOW_ERROR_CODES` from `@mnm/governed-workflows`.
 */
import { type WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";

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
