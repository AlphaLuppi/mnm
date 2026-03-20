/**
 * A2A-S01: a2a_messages table — Agent-to-Agent communication bus
 *
 * Stores structured messages between AI agents within a company.
 * Supports request/response patterns with TTL, chain tracking,
 * and cycle detection.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

// a2a-s01-schema-table
export const a2aMessages = pgTable(
  "a2a_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    chainId: uuid("chain_id").notNull(),
    senderId: uuid("sender_id").notNull().references(() => agents.id),
    receiverId: uuid("receiver_id").notNull().references(() => agents.id),
    replyToId: uuid("reply_to_id"),
    messageType: text("message_type").notNull(), // request, response, notification, error
    status: text("status").notNull().default("pending"), // pending, completed, expired, cancelled, error
    content: jsonb("content").notNull().$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    chainDepth: integer("chain_depth").notNull().default(0),
    ttlSeconds: integer("ttl_seconds").notNull().default(300),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // a2a-s01-schema-indexes
  (table) => ({
    companyIdx: index("a2a_messages_company_idx").on(table.companyId),
    senderIdx: index("a2a_messages_sender_idx").on(table.companyId, table.senderId),
    receiverIdx: index("a2a_messages_receiver_idx").on(table.companyId, table.receiverId),
    chainIdx: index("a2a_messages_chain_idx").on(table.chainId),
    statusIdx: index("a2a_messages_status_idx").on(table.companyId, table.status),
    expiresIdx: index("a2a_messages_expires_idx").on(table.status, table.expiresAt),
  }),
);
