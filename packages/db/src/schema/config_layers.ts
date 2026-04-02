import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";

export const configLayers = pgTable(
  "config_layers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    scope: text("scope").notNull(),
    enforced: boolean("enforced").notNull().default(false),
    isBaseLayer: boolean("is_base_layer").notNull().default(false),
    createdByUserId: text("created_by_user_id").notNull(),
    ownerType: text("owner_type").notNull().default("user"),
    visibility: text("visibility").notNull().default("private"),
    promotionStatus: text("promotion_status"),
    promotionContentHash: text("promotion_content_hash"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyScopeIdx: index("config_layers_company_scope_idx")
      .on(table.companyId, table.scope)
      .where(sql`archived_at IS NULL`),
    companyEnforcedIdx: index("config_layers_company_enforced_idx")
      .on(table.companyId)
      .where(sql`enforced = true AND archived_at IS NULL`),
    ownerIdx: index("config_layers_owner_idx")
      .on(table.companyId, table.createdByUserId),
    companyOwnerNameUq: uniqueIndex("config_layers_company_owner_name_uq")
      .on(table.companyId, table.createdByUserId, table.name),
    companyNameScopeUq: uniqueIndex("config_layers_company_name_scope_uq")
      .on(table.companyId, table.name)
      .where(sql`scope = 'company' AND archived_at IS NULL`),
  }),
);
