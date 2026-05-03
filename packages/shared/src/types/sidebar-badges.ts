export interface SidebarBadges {
  inbox: number;
  approvals: number;
  failedRuns: number;
  joinRequests: number;
  /**
   * Workflow-step assignments (T3.5). Count of pending|running step
   * executions where the current principal sits in the
   * `governed_step_assignments` table. Computed by
   * `governedWorkflowsAssignmentsService.countPendingWorkFor` and rolled
   * into the aggregated `inbox` total above so the sidebar dot reflects
   * "I have something to act on right now" across every category.
   */
  pendingWorkflowSteps: number;
}
