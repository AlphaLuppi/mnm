import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const userWidgets = pgTable(
  "user_widgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    blocks: jsonb("blocks").notNull(),
    dataSource: jsonb("data_source"),
    position: integer("position").notNull().default(0),
    span: integer("span").notNull().default(2),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserIdx: index("idx_user_widgets_company_user").on(table.companyId, table.userId),
  }),
);
