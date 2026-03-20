import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    source: text("source").notNull(),
    status: text("status").notNull().default("pending"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    progressTotal: integer("progress_total").notNull().default(0),
    progressDone: integer("progress_done").notNull().default(0),
    error: text("error"),
    startedByUserId: text("started_by_user_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("import_jobs_company_status_idx").on(table.companyId, table.status),
    companySourceIdx: index("import_jobs_company_source_idx").on(table.companyId, table.source),
    companyCreatedIdx: index("import_jobs_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
  }),
);
