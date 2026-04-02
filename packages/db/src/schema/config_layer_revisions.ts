import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { configLayers } from "./config_layers.js";

export const configLayerRevisions = pgTable(
  "config_layer_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    layerId: uuid("layer_id").notNull().references(() => configLayers.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    changedKeys: jsonb("changed_keys").$type<string[]>().notNull(),
    afterSnapshot: jsonb("after_snapshot").$type<Record<string, unknown>>().notNull(),
    changedBy: text("changed_by").notNull(),
    changeSource: text("change_source").notNull(),
    changeMessage: text("change_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    layerVersionUq: uniqueIndex("config_layer_revisions_layer_version_uq")
      .on(table.layerId, table.version),
    layerVersionIdx: index("config_layer_revisions_layer_version_idx")
      .on(table.layerId, table.version),
    layerCreatedIdx: index("config_layer_revisions_layer_created_idx")
      .on(table.layerId, table.createdAt),
  }),
);
