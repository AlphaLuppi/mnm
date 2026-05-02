import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";
import { oauthConnectors } from "./oauth_connectors.js";

export const connectorTokens = pgTable(
  "connector_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id").notNull().references(() => oauthConnectors.id, { onDelete: "cascade" }),

    accessTokenIv: text("access_token_iv").notNull(),
    accessTokenCiphertext: text("access_token_ciphertext").notNull(),
    accessTokenTag: text("access_token_tag").notNull(),

    refreshTokenIv: text("refresh_token_iv"),
    refreshTokenCiphertext: text("refresh_token_ciphertext"),
    refreshTokenTag: text("refresh_token_tag"),

    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scopesGranted: text("scopes_granted").array().notNull().default(sql`'{}'`),

    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    lastRefreshAt: timestamp("last_refresh_at", { withTimezone: true }),
    lastRefreshFailedAt: timestamp("last_refresh_failed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userConnectorUq: uniqueIndex("connector_tokens_user_connector_idx").on(
      table.userId,
      table.connectorId,
    ),
    companyUserIdx: index("connector_tokens_company_user_idx").on(
      table.companyId,
      table.userId,
    ),
  }),
);
