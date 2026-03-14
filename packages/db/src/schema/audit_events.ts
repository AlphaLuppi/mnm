import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    severity: text("severity").notNull().default("info"),
    prevHash: text("prev_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("audit_events_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
    companyActorIdx: index("audit_events_company_actor_idx").on(
      table.companyId,
      table.actorId,
      table.actorType,
    ),
    companyActionIdx: index("audit_events_company_action_idx").on(table.companyId, table.action),
    companyTargetIdx: index("audit_events_company_target_idx").on(
      table.companyId,
      table.targetType,
      table.targetId,
    ),
    companySeverityIdx: index("audit_events_company_severity_idx").on(
      table.companyId,
      table.severity,
      table.createdAt,
    ),
  }),
);
