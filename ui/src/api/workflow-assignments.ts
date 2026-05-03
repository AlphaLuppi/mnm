/**
 * WORKFLOW-ASSIGNMENTS T3.5 — UI client for the inbox feed.
 *
 * Mirrors the snake_case payload shipped by the REST route
 * `GET /companies/:companyId/inbox/pending-workflow-steps` (T3.4) so the
 * Inbox page can reuse the same shape that powers the MCP tool
 * `list_my_pending_work` (Python harness friendliness).
 */
import { api } from "./client";

export interface PendingWorkflowStep {
  step_execution_id: string;
  step_name: string;
  run_id: string;
  run_status: string;
  workflow_name: string;
  workflow_git_tag: string | null;
  parent_step_execution_id: string | null;
  assigned_at: string;
  assignment_reason: string;
  has_artifacts: boolean;
  deps_completed: boolean;
}

export interface PendingWorkflowStepsResponse {
  items: PendingWorkflowStep[];
}

export const workflowAssignmentsApi = {
  listPending(
    companyId: string,
    filters?: { status?: ReadonlyArray<"pending" | "running">; limit?: number },
  ) {
    const params = new URLSearchParams();
    if (filters?.status && filters.status.length > 0) {
      params.set("status", filters.status.join(","));
    }
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return api.get<PendingWorkflowStepsResponse>(
      `/companies/${companyId}/inbox/pending-workflow-steps${qs ? `?${qs}` : ""}`,
    );
  },
};
