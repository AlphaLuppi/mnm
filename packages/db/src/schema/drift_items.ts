import { pgTable, uuid, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { driftReports } from "./drift_reports.js";

export const driftItems = pgTable(
  "drift_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    reportId: uuid("report_id").notNull().references(() => driftReports.id, { onDelete: "cascade" }),
    severity: text("severity").notNull(),
    driftType: text("drift_type").notNull(),
    confidence: real("confidence").notNull(),
    description: text("description").notNull(),
    recommendation: text("recommendation").notNull(),
    sourceExcerpt: text("source_excerpt"),
    targetExcerpt: text("target_excerpt"),
    sourceDoc: text("source_doc").notNull(),
    targetDoc: text("target_doc").notNull(),
    decision: text("decision").notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: text("decided_by"),
    remediationNote: text("remediation_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    reportIdx: index("drift_items_report_idx").on(table.reportId),
    companySeverityIdx: index("drift_items_company_severity_idx").on(table.companyId, table.severity),
    companyDecisionIdx: index("drift_items_company_decision_idx").on(table.companyId, table.decision),
    companyReportSeverityIdx: index("drift_items_company_report_severity_idx").on(table.companyId, table.reportId, table.severity),
  }),
);
