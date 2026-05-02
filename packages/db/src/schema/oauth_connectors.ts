import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";

export const oauthConnectors = pgTable(
  "oauth_connectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    providerSlug: text("provider_slug").notNull(),
    displayName: text("display_name").notNull(),
    type: text("type").notNull(),

    authorizationUrl: text("authorization_url"),
    tokenUrl: text("token_url"),
    userinfoUrl: text("userinfo_url"),
    scopes: text("scopes").array().notNull().default(sql`'{}'`),
    redirectUri: text("redirect_uri"),
    clientId: text("client_id"),

    clientSecretIv: text("client_secret_iv"),
    clientSecretCiphertext: text("client_secret_ciphertext"),
    clientSecretTag: text("client_secret_tag"),

    refreshSupported: boolean("refresh_supported").notNull().default(true),

    apiKeyLabel: text("api_key_label"),

    enabled: boolean("enabled").notNull().default(true),
    createdByUserId: text("created_by_user_id").notNull().references(() => authUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProviderUq: uniqueIndex("oauth_connectors_company_provider_idx").on(
      table.companyId,
      table.providerSlug,
    ),
    companyEnabledIdx: index("oauth_connectors_company_enabled_idx").on(
      table.companyId,
      table.enabled,
    ),
    typeCheck: check(
      "oauth_connectors_type_check",
      sql`type IN ('oauth2', 'api_key')`,
    ),
    typeShapeCheck: check(
      "oauth_connectors_type_shape_check",
      sql`(
        (type = 'oauth2' AND authorization_url IS NOT NULL AND token_url IS NOT NULL
          AND client_id IS NOT NULL AND client_secret_iv IS NOT NULL
          AND client_secret_ciphertext IS NOT NULL AND client_secret_tag IS NOT NULL)
        OR
        (type = 'api_key' AND api_key_label IS NOT NULL)
      )`,
    ),
  }),
);
