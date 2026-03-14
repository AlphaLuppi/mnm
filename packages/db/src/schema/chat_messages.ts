import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { chatChannels } from "./chat_channels.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    senderId: text("sender_id").notNull(),
    senderType: text("sender_type").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelCreatedIdx: index("chat_messages_channel_created_idx").on(
      table.channelId,
      table.createdAt,
    ),
    companyCreatedIdx: index("chat_messages_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
    senderIdx: index("chat_messages_sender_idx").on(table.senderId, table.senderType),
  }),
);
