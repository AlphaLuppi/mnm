import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatChannels } from "./chat_channels.js";

export const chatShares = pgTable(
  "chat_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    sharedByUserId: text("shared_by_user_id").notNull(),
    shareToken: text("share_token").notNull(),
    permission: text("permission").notNull().default("read"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    shareTokenUq: uniqueIndex("chat_shares_token_uq").on(table.shareToken),
    channelIdx: index("chat_shares_channel_idx").on(table.channelId),
    companyIdx: index("chat_shares_company_idx").on(table.companyId),
  }),
);
