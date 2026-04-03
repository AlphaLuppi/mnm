import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { check } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { folders } from "./folders.js";
import { artifacts } from "./artifacts.js";
import { documents } from "./documents.js";
import { chatChannels } from "./chat_channels.js";

export const folderItems = pgTable(
  "folder_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    itemType: text("item_type").notNull(),
    artifactId: uuid("artifact_id").references(() => artifacts.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => chatChannels.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    addedByUserId: text("added_by_user_id"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    folderIdx: index("folder_items_folder_idx").on(table.folderId),
    companyIdx: index("folder_items_company_idx").on(table.companyId),
    itemTypeCheck: check(
      "folder_items_type_check",
      sql`(
        ("item_type" = 'artifact' AND "artifact_id" IS NOT NULL AND "document_id" IS NULL AND "channel_id" IS NULL) OR
        ("item_type" = 'document' AND "document_id" IS NOT NULL AND "artifact_id" IS NULL AND "channel_id" IS NULL) OR
        ("item_type" = 'channel' AND "channel_id" IS NOT NULL AND "artifact_id" IS NULL AND "document_id" IS NULL)
      )`,
    ),
  }),
);
