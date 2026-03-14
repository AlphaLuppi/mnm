import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const automationCursors = pgTable(
  "automation_cursors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    level: text("level").notNull(),
    targetId: uuid("target_id"),
    position: text("position").notNull().default("assisted"),
    ceiling: text("ceiling").notNull().default("auto"),
    setByUserId: text("set_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyLevelTargetUniqueIdx: uniqueIndex(
      "automation_cursors_company_level_target_unique_idx",
    ).on(table.companyId, table.level, table.targetId),
    companyLevelIdx: index("automation_cursors_company_level_idx").on(
      table.companyId,
      table.level,
    ),
  }),
);
