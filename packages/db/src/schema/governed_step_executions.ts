import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AuditActorType } from "@mnm/shared";
import { companies } from "./companies.js";
import { governedWorkflowRuns } from "./governed_workflow_runs.js";

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runStepUq: uniqueIndex("governed_step_executions_run_step_uq")
      .on(table.runId, table.stepIdInJson),
    runStateIdx: index("governed_step_executions_run_state_idx")
      .on(table.runId, table.state),
  }),
);
