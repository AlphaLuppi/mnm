import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { assets } from "./assets.js";
import { folders } from "./folders.js";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size"),
    pageCount: integer("page_count"),
    tokenCount: integer("token_count"),
    ingestionStatus: text("ingestion_status").notNull().default("pending"),
    ingestionError: text("ingestion_error"),
    summary: text("summary"),
    extractedText: text("extracted_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdByUserId: text("created_by_user_id"),
    ownedByFolderId: uuid("owned_by_folder_id").references(() => folders.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("documents_company_created_idx").on(table.companyId, table.createdAt),
    companyStatusIdx: index("documents_company_status_idx").on(table.companyId, table.ingestionStatus),
    assetIdx: index("documents_asset_idx").on(table.assetId),
    ownedFolderIdx: index("documents_owned_folder_idx").on(table.ownedByFolderId),
  }),
);
