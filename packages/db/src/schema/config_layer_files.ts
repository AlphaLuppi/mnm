import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { configLayerItems } from "./config_layer_items.js";

export const configLayerFiles = pgTable(
  "config_layer_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    itemId: uuid("item_id").notNull().references(() => configLayerItems.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    itemPathUq: uniqueIndex("config_layer_files_item_path_uq")
      .on(table.itemId, table.path),
    itemIdx: index("config_layer_files_item_idx")
      .on(table.itemId),
  }),
);
