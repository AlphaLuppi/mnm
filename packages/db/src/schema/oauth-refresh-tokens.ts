import { pgTable, text, uuid, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { oauthClients } from "./oauth-clients.js";

export const oauthRefreshTokens = pgTable(
  "oauth_refresh_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    clientId: uuid("client_id").notNull().references(() => oauthClients.clientId, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id").notNull(),
    scopes: jsonb("scopes").notNull().default([]),
    permissions: jsonb("permissions").default([]),
    resource: text("resource"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    expiresIdx: index("oauth_refresh_tokens_expires_idx").on(table.expiresAt),
  }),
);
