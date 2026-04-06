import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";

export const inboxItems = pgTable(
  "inbox_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    recipientId: text("recipient_id").notNull(),
    senderAgentId: uuid("sender_agent_id").references(() => agents.id, { onDelete: "set null" }),
    senderUserId: text("sender_user_id"),
    title: text("title").notNull(),
    body: text("body"),
    contentBlocks: jsonb("content_blocks"),
    category: text("category").notNull().default("notification"),
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull().default("unread"),
    actionTaken: jsonb("action_taken"),
    relatedIssueId: uuid("related_issue_id").references(() => issues.id, { onDelete: "set null" }),
    relatedAgentId: uuid("related_agent_id").references(() => agents.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recipientIdx: index("idx_inbox_items_recipient").on(table.companyId, table.recipientId, table.status),
    createdIdx: index("idx_inbox_items_created").on(table.companyId, table.createdAt),
    categoryIdx: index("idx_inbox_items_category").on(table.companyId, table.recipientId, table.category),
  }),
);
