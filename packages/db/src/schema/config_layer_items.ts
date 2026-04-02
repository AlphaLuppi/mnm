import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { configLayers } from "./config_layers.js";

export const configLayerItems = pgTable(
  "config_layer_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    layerId: uuid("layer_id").notNull().references(() => configLayers.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    name: text("name").notNull(),
    displayName: text("display_name"),
    description: text("description"),
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull(),
    sourceType: text("source_type").notNull().default("inline"),
    sourceUrl: text("source_url"),
    sourceContentHash: text("source_content_hash"),
    sourceFetchedAt: timestamp("source_fetched_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    layerNameUq: uniqueIndex("config_layer_items_layer_name_uq")
      .on(table.layerId, table.itemType, table.name),
    layerEnabledIdx: index("config_layer_items_layer_enabled_idx")
      .on(table.layerId, table.itemType, table.name)
      .where(sql`enabled = true`),
  }),
);
