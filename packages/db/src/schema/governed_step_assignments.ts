import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { governedStepExecutions } from "./governed_step_executions.js";

/**
 * Snapshot of which principals are assigned to a given step execution.
 *
 * Created by `governedWorkflowsAssignmentsService.snapshotStepAssignments` at
 * `launchRun` time (initial resolution) and re-evaluated at `launchStep`
 * time when the step's `assignment` declaration drifts vs the live tags/roles
 * graph (delta INSERT, never deletion — assignments are append-only audit
 * trail).
 *
 * `principal_id` is `text` (no FK) following the same convention as
 * `tag_assignments.target_id` and `workflow_hooks_config_principals.principal_id`
 * — principals are a virtual concept (user|agent) and have no real DB table.
 */
export const governedStepAssignments = pgTable(
  "governed_step_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    stepExecutionId: uuid("step_execution_id")
      .notNull()
      .references(() => governedStepExecutions.id, { onDelete: "cascade" }),
    principalId: text("principal_id").notNull(),
    /**
     * Human-readable explanation of WHY this principal got assigned —
     * "matched tag(s) [a,b]", "expanded from role engineer", "explicit
     * principal", "delta-launchStep tag was added"…
     */
    reason: text("reason").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    stepPrincipalUq: uniqueIndex(
      "governed_step_assignments_step_principal_uq",
    ).on(table.stepExecutionId, table.principalId),
    principalSnapshotIdx: index(
      "governed_step_assignments_principal_snapshot_idx",
    ).on(table.companyId, table.principalId, table.snapshotAt),
  }),
);

export type GovernedStepAssignmentRow =
  typeof governedStepAssignments.$inferSelect;
export type NewGovernedStepAssignment =
  typeof governedStepAssignments.$inferInsert;
