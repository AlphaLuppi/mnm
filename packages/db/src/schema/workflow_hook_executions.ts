import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { workflowHooksConfig } from "./workflow_hooks_config.js";
import { governedStepExecutions } from "./governed_step_executions.js";
import { governedWorkflowRuns } from "./governed_workflow_runs.js";
import { authUsers } from "./auth.js";

export const WORKFLOW_HOOK_PHASES = [
  "before_run",
  "before_step",
  "after_step",
  "after_run",
] as const;
export type WorkflowHookPhase = (typeof WORKFLOW_HOOK_PHASES)[number];

export const WORKFLOW_HOOK_EXECUTION_STATUSES = [
  "pending",
  "success",
  "failed",
  "timeout",
] as const;
export type WorkflowHookExecutionStatus =
  (typeof WORKFLOW_HOOK_EXECUTION_STATUSES)[number];

/**
 * Runtime audit log — one row per hook invocation. Inserted as `pending`
 * BEFORE the hook is called (TDD invariant for ordering), then updated
 * with status + duration + error_code on completion.
 *
 * `actor_user_id` carries the §1.7 human-traceability requirement : every
 * hook executes under the identity of the user who triggered the run/step.
 */
export const workflowHookExecutions = pgTable(
  "workflow_hook_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    configId: uuid("config_id").references(() => workflowHooksConfig.id, {
      onDelete: "set null",
    }),
    hookRef: text("hook_ref").notNull(),
    stepExecutionId: uuid("step_execution_id").references(
      () => governedStepExecutions.id,
      { onDelete: "set null" },
    ),
    runId: uuid("run_id").references(() => governedWorkflowRuns.id, {
      onDelete: "set null",
    }),
    phase: text("phase").$type<WorkflowHookPhase>().notNull(),
    status: text("status")
      .$type<WorkflowHookExecutionStatus>()
      .notNull()
      .default("pending"),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms"),
    resultSummary: text("result_summary"),
    httpCallsCount: integer("http_calls_count").notNull().default(0),
    llmTokensIn: integer("llm_tokens_in").notNull().default(0),
    llmTokensOut: integer("llm_tokens_out").notNull().default(0),
    actorUserId: text("actor_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyRunIdx: index("workflow_hook_executions_company_run_idx").on(
      table.companyId,
      table.runId,
      table.createdAt,
    ),
    companyStatusIdx: index("workflow_hook_executions_company_status_idx").on(
      table.companyId,
      table.status,
      table.createdAt,
    ),
    statusCheck: check(
      "workflow_hook_executions_status_check",
      sql`${table.status} IN ('pending','success','failed','timeout')`,
    ),
    phaseCheck: check(
      "workflow_hook_executions_phase_check",
      sql`${table.phase} IN ('before_run','before_step','after_step','after_run')`,
    ),
  }),
);

export type WorkflowHookExecutionRow =
  typeof workflowHookExecutions.$inferSelect;
export type NewWorkflowHookExecution = typeof workflowHookExecutions.$inferInsert;
