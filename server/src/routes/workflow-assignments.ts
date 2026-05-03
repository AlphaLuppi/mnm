/**
 * WORKFLOW-ASSIGNMENTS T3.4 — REST route.
 *
 * Single endpoint, parity with the MCP tool `list_my_pending_work` :
 *   GET /companies/:companyId/inbox/pending-workflow-steps
 *
 * Mounted under the company-scoped api prefix in app.ts so
 * assertCompanyMembership + tenantContextMiddleware + tagScopeMiddleware
 * already wrap every call. The principalId resolves from `req.actor`
 * (userId for board users, agentId for agent JWTs).
 */
import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { requirePermission } from "../middleware/require-permission.js";
import type { GovernedWorkflowsAssignmentsService } from "../services/governed-workflows-assignments.js";
import { badRequest, forbidden } from "../errors.js";

const querySchema = z.object({
  /**
   * Optional state filter — comma-separated ('pending,running'). When
   * absent, defaults to ['pending','running'] in the service layer
   * (matches the partial index added in migration 0082).
   */
  status: z.string().optional(),
  limit: z
    .preprocess(
      (v) => (typeof v === "string" ? Number.parseInt(v, 10) : v),
      z.number().int().positive().max(500),
    )
    .optional(),
});

export function workflowAssignmentsRoutes(
  db: Db,
  assignments: GovernedWorkflowsAssignmentsService,
) {
  const router = Router();

  router.get(
    "/companies/:companyId/inbox/pending-workflow-steps",
    requirePermission(db, PERMISSIONS.WORKFLOWS_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const principalId = req.actor.userId ?? req.actor.agentId;
      if (!principalId) {
        throw forbidden("Actor identity required");
      }

      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        throw badRequest(parsed.error.message);
      }

      const statusList = parsed.data.status
        ? parsed.data.status
            .split(",")
            .map((s) => s.trim())
            .filter((s): s is "pending" | "running" =>
              s === "pending" || s === "running",
            )
        : undefined;

      // SEC P4 (HIGH #6) — apply tag-scope filter at the service layer.
      // When the caller is tag-restricted (`!bypassTagFilter`), pass the
      // tag set so the service narrows results to assignments whose
      // principal carries at least one matching tag. Bypass callers
      // (admins, local_implicit) skip the filter entirely.
      const tagIds =
        req.tagScope && !req.tagScope.bypassTagFilter
          ? Array.from(req.tagScope.tagIds)
          : undefined;

      const rows = await assignments.listPendingWorkFor({
        companyId,
        principalId,
        ...(statusList && statusList.length > 0
          ? { status: statusList }
          : {}),
        ...(parsed.data.limit ? { limit: parsed.data.limit } : {}),
        ...(tagIds !== undefined ? { tagIds } : {}),
      });

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

      res.json({ items });
    },
  );

  return router;
}
