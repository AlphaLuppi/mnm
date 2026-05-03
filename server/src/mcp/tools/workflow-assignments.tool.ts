import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import type { GovernedWorkflowsAssignmentsService } from "../../services/governed-workflows-assignments.js";
import {
  setTenantContext,
  clearTenantContext,
} from "../../middleware/tenant-context.js";

/**
 * WORKFLOW-ASSIGNMENTS T3.4 — single MCP tool: `list_my_pending_work`.
 *
 * Returns the pending workflow steps assigned to the current actor (user
 * or agent). The tool ALWAYS uses `actor.companyId` from the authenticated
 * MCP session — there is no `company_id` input field, so no caller can
 * cross-tenant by guessing a UUID (SEC P4 — CRITICAL #3).
 *
 * The handler sets the RLS tenant context with `setTenantContext` and
 * clears it in `finally` so the pooled connection cannot leak the value
 * to a subsequent request (mirrors the `wrap()` helper used by the
 * governed-workflows MCP tools — SEC P4 — CRITICAL #2).
 *
 * REST parity (T3.4) :
 *   GET /companies/:companyId/inbox/pending-workflow-steps
 */

const inputSchema = z.object({
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
      "Always scoped to the authenticated session's company — no cross-tenant override is accepted.\n" +
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
      // SEC P4 (CRITICAL #3) — always derive companyId from the
      // authenticated actor; the tool intentionally has no `company_id`
      // input field to prevent cross-tenant inbox reads.
      const companyId = actor.companyId;
      const principalId = actor.userId ?? actor.agentId ?? "";
      const svc =
        services.workflowAssignments as GovernedWorkflowsAssignmentsService;

      // SEC P4 (CRITICAL #2) — set RLS tenant context for the duration of
      // this handler and ALWAYS clear it on return. Otherwise the pooled
      // connection runs with `app.current_company_id` unset → RLS filters
      // every row in fail-closed mode, and (worse) BYPASSRLS connections
      // would leak across tenants. Pattern mirrors `wrap()` in
      // governed-workflows.tool.ts.
      await setTenantContext(services.db, companyId);
      try {
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
      } finally {
        await clearTenantContext(services.db).catch(() => {});
      }
    },
  });
});
