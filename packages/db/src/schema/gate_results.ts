import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { governedWorkflowRuns } from "./governed_workflow_runs.js";
import { governedStepExecutions } from "./governed_step_executions.js";

// NOTE: text[] columns with defaults require sql`'{}'::text[]` in Drizzle 0.38.
// This is the ONLY place where sql`` is used for defaults — all other types use .default().

export const gateResults = pgTable(
  "gate_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    // runId is denormalized: cascade-delete from governed_workflow_runs would already cascade
    // via step_exec_id → governed_step_executions → run_id, but keeping the direct FK + cascade
    // enables run-scoped gate queries (per-run aggregate reports) without a 2-table join.
    runId: uuid("run_id").notNull().references(() => governedWorkflowRuns.id, { onDelete: "cascade" }),
    stepExecId: uuid("step_exec_id").notNull().references(() => governedStepExecutions.id, { onDelete: "cascade" }),
    gateIdInJson: text("gate_id_in_json").notNull(),
    kind: text("kind").notNull(),
    pass: boolean("pass").notNull(),
    report: text("report").notNull(),
    errorCode: text("error_code"),
    hints: text("hints").array().notNull().default(sql`'{}'::text[]`),
    gateGitSha: text("gate_git_sha").notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // DESC on evaluated_at lives only in the SQL (see governed_workflow_runs comment).
    stepKindEvaluatedIdx: index("gate_results_step_kind_evaluated_idx")
      .on(table.stepExecId, table.kind, table.evaluatedAt),
    companyKindIdx: index("gate_results_company_kind_idx")
      .on(table.companyId, table.kind),
  }),
);
