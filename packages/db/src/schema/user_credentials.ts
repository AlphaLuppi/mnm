import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { configLayerItems } from "./config_layer_items.js";

export const userCredentials = pgTable(
  "user_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    itemId: uuid("item_id").notNull().references(() => configLayerItems.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    material: jsonb("material").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    statusMessage: text("status_message"),
    maxTtlAt: timestamp("max_ttl_at", { withTimezone: true }),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCompanyItemUq: uniqueIndex("user_credentials_user_company_item_uq")
      .on(table.userId, table.companyId, table.itemId),
    userCompanyIdx: index("user_credentials_user_company_idx")
      .on(table.userId, table.companyId),
    expiringIdx: index("user_credentials_expiring_idx")
      .on(table.expiresAt)
      .where(sql`status = 'connected' AND expires_at IS NOT NULL`),
    providerCheck: check(
      "user_credentials_provider_check",
      sql`provider IN ('oauth2', 'api_key', 'bearer', 'pat', 'custom')`,
    ),
    statusCheck: check(
      "user_credentials_status_check",
      sql`status IN ('pending', 'connected', 'expired', 'revoked', 'error')`,
    ),
  }),
);
