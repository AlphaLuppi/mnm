import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { githubApps } from "./github_apps.js";

/**
 * GITHUB-PROVIDER Phase 1 — per-org GitHub App installations.
 *
 * Synced from GitHub via `GET /app/installations` (App-JWT signed call).
 * `company_id` is denormalized so the RLS policy can filter by tenant
 * without joining github_apps on every read.
 *
 * `installation_id` is GitHub's opaque id (string in their API even though
 * numeric internally). `account_login` lets the resolver match a target
 * `repoOwner` to the right installation when dispatching App vs OAuth.
 *
 * `repository_selection`: `"all"` ⇒ App installed on every repo of the
 * org; `"selected"` ⇒ admin picked a subset (the App's installation token
 * is still valid for those subsets only).
 *
 * `suspended_at`: GitHub does not push us a webhook in V0 (open
 * follow-up), so this gets populated lazily by the service when an API
 * call returns 401/403 with the App-suspended marker (R3 in plan).
 */
export const githubAppInstallations = pgTable(
  "github_app_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    githubAppId: uuid("github_app_id")
      .notNull()
      .references(() => githubApps.id, { onDelete: "cascade" }),
    installationId: text("installation_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    accountId: bigint("account_id", { mode: "bigint" }),
    repositorySelection: text("repository_selection"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    appInstallUq: unique("github_app_installations_app_install_unique").on(
      table.githubAppId,
      table.installationId,
    ),
    companyIdx: index("idx_github_app_installations_company").on(table.companyId),
    appIdx: index("idx_github_app_installations_app").on(table.githubAppId),
    accountIdx: index("idx_github_app_installations_account").on(
      table.accountLogin,
    ),
    accountTypeCheck: check(
      "github_app_installations_account_type_check",
      sql`account_type IN ('User','Organization')`,
    ),
    repoSelectionCheck: check(
      "github_app_installations_repo_selection_check",
      sql`repository_selection IS NULL OR repository_selection IN ('all','selected')`,
    ),
  }),
);
