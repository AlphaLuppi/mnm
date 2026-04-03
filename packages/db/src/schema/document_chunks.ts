import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { documents } from "./documents.js";

const vector = customType<{ data: number[]; dpiType: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]) {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown) {
    if (typeof value === "string") return JSON.parse(value);
    return value as number[];
  },
});

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    embedding: vector("embedding"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentChunkIdx: index("document_chunks_document_idx").on(table.documentId, table.chunkIndex),
    companyIdx: index("document_chunks_company_idx").on(table.companyId),
  }),
);
