import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import type { GovernedWorkflowsAssignmentsService } from "../../services/governed-workflows-assignments.js";

/**
 * WORKFLOW-ASSIGNMENTS T3.4 — single MCP tool: `list_my_pending_work`.
 *
 * Returns the pending workflow steps assigned to the current actor (user
 * or agent). Filtered by tag scope handled at the actor layer (the service
 * already RLS-scopes by company; the caller's principalId is what narrows
 * the result to "my" work).
 *
 * REST parity (T3.4) :
 *   GET /companies/:companyId/inbox/pending-workflow-steps
 */

const inputSchema = z.object({
  /**
   * Optional company override. When omitted, the tool uses
   * `actor.companyId` (the binding from the MCP wrap layer). Provided so
   * future cross-company scenarios (rare) can target a different tenant
   * without re-binding the actor — the wrap layer still RLS-scopes
   * the query, so a request with a wrong companyId returns [] rather
   * than leaking.
   */
  company_id: z
    .string()
    .uuid()
    .optional()
    .describe("Optional company override (defaults to actor.companyId)"),
  /**
   * Filter on the underlying step state. Default = ['pending','running']
   * — the partial index added in migration 0082 supports this exact pair.
   */
  status: z
    .array(z.enum(["pending", "running"]))
    .optional()
    .describe("Step state filter (defaults to ['pending','running'])"),
  limit: z.number().int().positive().max(500).optional(),
});

export default defineMcpTools(({ tool, services }) => {
  tool("list_my_pending_work", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Workflow Assignments] List the pending workflow steps assigned to the current actor.\n" +
      "Returns one row per (step_execution, assignment) pair. Cancelled runs are excluded.\n" +
      "Each row carries the workflow + run metadata, the human-readable assignment reason\n" +
      "(tag-intersection / role-expansion / explicit / delta-launchStep), and two boolean\n" +
      "flags `has_artifacts` (artifact bundle present on the step) and `deps_completed`\n" +
      "(true when all step deps are succeeded).",
    input: inputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    handler: async ({ input, actor }) => {
      const companyId = input.company_id ?? actor.companyId;
      const principalId = actor.userId ?? actor.agentId ?? "";
      const svc =
        services.workflowAssignments as GovernedWorkflowsAssignmentsService;
      const rows = await svc.listPendingWorkFor({
        companyId,
        principalId,
        status: input.status,
        limit: input.limit,
      });
      // Map snake_case for the wire (the service returns camelCase domain
      // objects ; MCP DTO contracts use snake_case for Python harness
      // friendliness — matches the rest of the MCP surface).
      const items = rows.map((r) => ({
        step_execution_id: r.stepExecutionId,
        step_name: r.stepName,
        run_id: r.runId,
        run_status: r.runStatus,
        workflow_name: r.workflowName,
        workflow_git_tag: r.workflowGitTag,
        parent_step_execution_id: r.parentStepExecutionId,
        assigned_at: r.assignedAt,
        assignment_reason: r.assignmentReason,
        has_artifacts: r.hasArtifacts,
        deps_completed: r.depsCompleted,
      }));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ items }) },
        ],
      };
    },
  });
});
