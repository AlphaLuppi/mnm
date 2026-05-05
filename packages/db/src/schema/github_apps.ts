import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";
import { oauthConnectors } from "./oauth_connectors.js";

/**
 * GITHUB-PROVIDER Phase 1 — per-company GitHub App credentials.
 *
 * D1 (plan 2026-05-04-github-provider.md): each company creates its own
 * App and pastes appId + privateKey (.pem). Private key is encrypted
 * AES-256-GCM via secret-crypto.ts (`{ iv, ciphertext, tag }` triple
 * stored as hex-encoded text — same column shape as oauth_connectors so
 * a single helper can read/write both).
 *
 * D6: at most one App per oauth_connectors row (UNIQUE on connector_id).
 * The App is OPTIONAL — absence ⇒ resolver falls back to user OAuth.
 *
 * §1.7 traceability: `created_by_user_id` is the company admin who
 * registered the App (no service account, audit log via
 * `oauth_connectors_audit`).
 */
export const githubApps = pgTable(
  "github_apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => oauthConnectors.id, { onDelete: "cascade" }),
    appId: text("app_id").notNull(),
    appSlug: text("app_slug"),

    privateKeyIv: text("private_key_iv").notNull(),
    privateKeyCiphertext: text("private_key_ciphertext").notNull(),
    privateKeyTag: text("private_key_tag").notNull(),

    webhookSecretIv: text("webhook_secret_iv"),
    webhookSecretCiphertext: text("webhook_secret_ciphertext"),
    webhookSecretTag: text("webhook_secret_tag"),

    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    connectorUq: unique("github_apps_connector_unique").on(table.connectorId),
    companyIdx: index("idx_github_apps_company").on(table.companyId),
  }),
);
