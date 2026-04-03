import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { check } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatChannels } from "./chat_channels.js";
import { documents } from "./documents.js";
import { artifacts } from "./artifacts.js";
import { folders } from "./folders.js";

export const chatContextLinks = pgTable(
  "chat_context_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    linkType: text("link_type").notNull(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
    artifactId: uuid("artifact_id").references(() => artifacts.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "cascade" }),
    linkedChannelId: uuid("linked_channel_id").references(() => chatChannels.id, { onDelete: "cascade" }),
    addedByUserId: text("added_by_user_id"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelIdx: index("chat_context_links_channel_idx").on(table.channelId),
    companyIdx: index("chat_context_links_company_idx").on(table.companyId),
    linkTypeCheck: check(
      "chat_context_links_type_check",
      sql`(
        ("link_type" = 'document' AND "document_id" IS NOT NULL AND "artifact_id" IS NULL AND "folder_id" IS NULL AND "linked_channel_id" IS NULL) OR
        ("link_type" = 'artifact' AND "artifact_id" IS NOT NULL AND "document_id" IS NULL AND "folder_id" IS NULL AND "linked_channel_id" IS NULL) OR
        ("link_type" = 'folder' AND "folder_id" IS NOT NULL AND "document_id" IS NULL AND "artifact_id" IS NULL AND "linked_channel_id" IS NULL) OR
        ("link_type" = 'channel' AND "linked_channel_id" IS NOT NULL AND "document_id" IS NULL AND "artifact_id" IS NULL AND "folder_id" IS NULL)
      )`,
    ),
  }),
);
