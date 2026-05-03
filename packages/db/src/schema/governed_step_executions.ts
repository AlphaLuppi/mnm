import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { AuditActorType } from "@mnm/shared";
import { companies } from "./companies.js";
import { governedWorkflowRuns } from "./governed_workflow_runs.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const GOVERNED_STEP_STATES = [
  "pending",
  "running",
  "gate_eval",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type GovernedStepState = (typeof GOVERNED_STEP_STATES)[number];

export const governedStepExecutions = pgTable(
  "governed_step_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    runId: uuid("run_id").notNull().references(() => governedWorkflowRuns.id, { onDelete: "cascade" }),
    stepIdInJson: text("step_id_in_json").notNull(),
    state: text("state").$type<GovernedStepState>().notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    artifactsJson: jsonb("artifacts_json").$type<Record<string, unknown>>(),
    launchedByActorType: text("launched_by_actor_type").$type<AuditActorType>(),
    launchedByActorId: text("launched_by_actor_id"),
    heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    // WORKFLOW-COMPOSITE T5.1 — meta-workflow `uses:` linking columns. NULL
    // for non-composite (leaf agent) steps. See migration 0083 header for
    // semantics + cap-the-fanout rationale.
    parentStepExecutionId: uuid("parent_step_execution_id").references((): AnyPgColumn => governedStepExecutions.id, { onDelete: "set null" }),
    compositeRunId: uuid("composite_run_id").references(() => governedWorkflowRuns.id, { onDelete: "set null" }),
    rootRunId: uuid("root_run_id").references(() => governedWorkflowRuns.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runStepUq: uniqueIndex("governed_step_executions_run_step_uq")
      .on(table.runId, table.stepIdInJson),
    runStateIdx: index("governed_step_executions_run_state_idx")
      .on(table.runId, table.state),
    heartbeatRunIdx: index("governed_step_executions_heartbeat_run_id_idx")
      .on(table.heartbeatRunId),
    rootRunIdx: index("governed_step_executions_root_run_idx")
      .on(table.companyId, table.rootRunId),
  }),
);
