import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const driftReports = pgTable(
  "drift_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    sourceDoc: text("source_doc").notNull(),
    targetDoc: text("target_doc").notNull(),
    driftCount: integer("drift_count").notNull().default(0),
    scanScope: text("scan_scope"),
    status: text("status").notNull().default("completed"),
    errorMessage: text("error_message"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    companyProjectIdx: index("drift_reports_company_project_idx").on(table.companyId, table.projectId),
    companyCheckedIdx: index("drift_reports_company_checked_idx").on(table.companyId, table.checkedAt),
    projectStatusIdx: index("drift_reports_project_status_idx").on(table.companyId, table.projectId, table.status),
  }),
);
