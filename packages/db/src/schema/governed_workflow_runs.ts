import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AuditActorType } from "@mnm/shared";
import { companies } from "./companies.js";
import { governedWorkflowDefinitions } from "./governed_workflow_definitions.js";

export const GOVERNED_RUN_STATUSES = ["draft", "active", "completed", "failed"] as const;
export type GovernedRunStatus = (typeof GOVERNED_RUN_STATUSES)[number];

export const governedWorkflowRuns = pgTable(
  "governed_workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    workflowDefId: uuid("workflow_def_id").notNull().references(() => governedWorkflowDefinitions.id),
    workflowGitTag: text("workflow_git_tag").notNull(),
    workflowGitSha: text("workflow_git_sha").notNull(),
    initiatedByActorType: text("initiated_by_actor_type").$type<AuditActorType>().notNull(),
    initiatedByActorId: text("initiated_by_actor_id").notNull(),
    status: text("status").$type<GovernedRunStatus>().notNull().default("draft"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    paramsJson: jsonb("params_json").$type<Record<string, unknown>>().notNull().default({}),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByActorId: text("cancelled_by_actor_id"),
    cancelledByActorType: text("cancelled_by_actor_type").$type<AuditActorType>(),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("governed_workflow_runs_company_status_idx")
      .on(table.companyId, table.status),
    // Note: DESC on started_at lives only in the SQL (source of truth for migrations).
    // Drizzle 0.38's per-column `.desc()` helper isn't used elsewhere in this codebase —
    // keep the TS index declaration ascending.
    defStartedIdx: index("governed_workflow_runs_def_started_idx")
      .on(table.workflowDefId, table.startedAt),
    cancelledAtIdx: index("governed_workflow_runs_cancelled_at_idx")
      .on(table.companyId, table.cancelledAt)
      .where(sql`${table.cancelledAt} IS NOT NULL`),
  }),
);
