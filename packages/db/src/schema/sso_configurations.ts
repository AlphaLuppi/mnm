import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

// sso-s01-schema-id, sso-s01-schema-company-id, sso-s01-schema-provider
// sso-s01-schema-display-name, sso-s01-schema-config, sso-s01-schema-enabled
// sso-s01-schema-email-domain, sso-s01-schema-metadata-url, sso-s01-schema-entity-id
// sso-s01-schema-certificate, sso-s01-schema-status, sso-s01-schema-verified-at
// sso-s01-schema-last-sync-at, sso-s01-schema-last-sync-error
// sso-s01-schema-created-by, sso-s01-schema-created-at, sso-s01-schema-updated-at
export const ssoConfigurations = pgTable(
  "sso_configurations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    provider: text("provider").notNull(), // "saml" | "oidc"
    displayName: text("display_name"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(false),
    // sso-s01-schema-email-domain — email domain for auto-detection (e.g. "acme.com")
    emailDomain: text("email_domain"),
    // sso-s01-schema-metadata-url — SAML metadata URL or OIDC discovery URL
    metadataUrl: text("metadata_url"),
    // sso-s01-schema-entity-id — SAML entity ID or OIDC client ID
    entityId: text("entity_id"),
    // sso-s01-schema-certificate — X.509 certificate (PEM) for SAML
    certificate: text("certificate"),
    // sso-s01-schema-status — configuration lifecycle status
    status: text("status").notNull().default("draft"), // "draft" | "verified" | "error"
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    // sso-s01-schema-last-sync-at — last metadata sync timestamp
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    // sso-s01-schema-last-sync-error — last sync error message
    lastSyncError: text("last_sync_error"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // sso-s01-idx-unique
    companyProviderUniqueIdx: uniqueIndex("sso_configurations_company_provider_unique_idx").on(
      table.companyId,
      table.provider,
    ),
    // sso-s01-idx-enabled
    companyEnabledIdx: index("sso_configurations_company_enabled_idx").on(
      table.companyId,
      table.enabled,
    ),
    // sso-s01-idx-email-domain
    emailDomainIdx: index("sso_configurations_email_domain_idx").on(
      table.emailDomain,
    ),
  }),
);
