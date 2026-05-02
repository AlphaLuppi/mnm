import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";
import { oauthConnectors } from "./oauth_connectors.js";

export const userApiKeys = pgTable(
  "user_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id").notNull().references(() => oauthConnectors.id, { onDelete: "cascade" }),

    keyIv: text("key_iv").notNull(),
    keyCiphertext: text("key_ciphertext").notNull(),
    keyTag: text("key_tag").notNull(),

    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userConnectorUq: uniqueIndex("user_api_keys_user_connector_idx").on(
      table.userId,
      table.connectorId,
    ),
    companyUserIdx: index("user_api_keys_company_user_idx").on(
      table.companyId,
      table.userId,
    ),
  }),
);
