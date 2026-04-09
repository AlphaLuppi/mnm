import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const oauthClients = pgTable("oauth_clients", {
  clientId: uuid("client_id").primaryKey().defaultRandom(),
  clientSecret: text("client_secret"),
  clientName: text("client_name").notNull(),
  redirectUris: jsonb("redirect_uris").notNull().default([]),
  grantTypes: jsonb("grant_types").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
