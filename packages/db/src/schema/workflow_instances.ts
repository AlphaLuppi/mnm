import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";
import { workflowTemplates } from "./workflow_templates.js";

export const workflowInstances = pgTable(
  "workflow_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    templateId: uuid("template_id").notNull().references(() => workflowTemplates.id),
    projectId: uuid("project_id").references(() => projects.id),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // ORCH-S01: State machine columns
    workflowState: text("workflow_state").notNull().default("draft"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    lastActorId: text("last_actor_id"),
    lastActorType: text("last_actor_type"),
  },
  (table) => ({
    companyStatusIdx: index("workflow_instances_company_status_idx").on(table.companyId, table.status),
    companyProjectIdx: index("workflow_instances_company_project_idx").on(table.companyId, table.projectId),
    workflowStateIdx: index("workflow_instances_workflow_state_idx").on(table.companyId, table.workflowState),
  }),
);
