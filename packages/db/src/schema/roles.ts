import { type AnyPgColumn, pgTable, uuid, text, integer, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { viewPresets } from "./view_presets.js";

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    hierarchyLevel: integer("hierarchy_level").notNull().default(100),
    inheritsFromId: uuid("inherits_from_id").references((): AnyPgColumn => roles.id),
    bypassTagFilter: boolean("bypass_tag_filter").notNull().default(false),
    isSystem: boolean("is_system").notNull().default(false),
    color: text("color"),
    icon: text("icon"),
    viewPresetId: uuid("view_preset_id").references(() => viewPresets.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugIdx: uniqueIndex("roles_company_slug_idx").on(table.companyId, table.slug),
    companyLevelIdx: index("roles_company_level_idx").on(table.companyId, table.hierarchyLevel),
  }),
);
