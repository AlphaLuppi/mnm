-- GITHUB-PROVIDER Phase 1 (plan docs/superpowers/plans/2026-05-04-github-provider.md)
-- Per-company GitHub App credentials + per-org installations.
--
-- D1: each company creates its own GitHub App and pastes appId + privateKey
-- (.pem). The App's private key is encrypted AES-256-GCM via secret-crypto.ts
-- (same pattern as Sprint 1 — iv/ciphertext/tag bytea triple). No service
-- account: `created_by_user_id` traces to the company admin who registered
-- the App (§1.7 traceability).
--
-- D6: an App is OPTIONAL on a `github` connector — at most one per
-- connector_id (UNIQUE). Absence ⇒ resolver falls back to user OAuth mode.
-- Presence + matching installation on the target repo owner ⇒ resolver
-- dispatches to app-installation mode.
--
-- RLS pattern (database.md §2 + Sprint 1 NEW-S1) : PERMISSIVE baseline +
-- RESTRICTIVE tenant filter + FORCE. The PERMISSIVE baseline is required to
-- unlock postgres' default-deny when the app user does NOT have BYPASSRLS
-- (chantier RLS post-Sprint 2 will move us off the superuser app role).

-- =============================================================================
-- 1. github_apps — per-company App credentials (encrypted private key)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "github_apps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "connector_id" uuid NOT NULL REFERENCES "oauth_connectors"("id") ON DELETE CASCADE,
  "app_id" text NOT NULL,
  "app_slug" text,

  -- AES-256-GCM-encrypted private key (PEM). Hex-encoded text triple matches
  -- secret-crypto.ts EncryptedMaterial { iv, ciphertext, tag } — same column
  -- shape as oauth_connectors.client_secret_* and connector_tokens.access_token_*
  -- so a single helper can read/write both.
  "private_key_iv" text NOT NULL,
  "private_key_ciphertext" text NOT NULL,
  "private_key_tag" text NOT NULL,

  -- Optional webhook secret (V0 not consumed — webhook ingestion is a
  -- follow-up tracked in the plan §Open follow-ups). Stored encrypted in
  -- case the admin already supplies it during App creation.
  "webhook_secret_iv" text,
  "webhook_secret_ciphertext" text,
  "webhook_secret_tag" text,

  "created_by_user_id" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at" timestamp with time zone,

  CONSTRAINT "github_apps_connector_unique" UNIQUE ("connector_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_github_apps_company"
  ON "github_apps" ("company_id");
--> statement-breakpoint

ALTER TABLE "github_apps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "github_apps" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "github_apps";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "github_apps" AS PERMISSIVE FOR ALL
  USING (true);
--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation" ON "github_apps";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "github_apps" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- =============================================================================
-- 2. github_app_installations — per-org installations (synced from GitHub)
-- =============================================================================
-- company_id is denormalized so the RLS policy can filter by tenant without
-- joining github_apps (cheap planner check on every read).

CREATE TABLE IF NOT EXISTS "github_app_installations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "github_app_id" uuid NOT NULL REFERENCES "github_apps"("id") ON DELETE CASCADE,
  "installation_id" text NOT NULL,
  "account_login" text NOT NULL,
  "account_type" text NOT NULL,
  "account_id" bigint,
  "repository_selection" text,
  "suspended_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "github_app_installations_account_type_check"
    CHECK (account_type IN ('User','Organization')),
  CONSTRAINT "github_app_installations_repo_selection_check"
    CHECK (repository_selection IS NULL OR repository_selection IN ('all','selected')),
  CONSTRAINT "github_app_installations_app_install_unique"
    UNIQUE ("github_app_id", "installation_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_github_app_installations_company"
  ON "github_app_installations" ("company_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_github_app_installations_app"
  ON "github_app_installations" ("github_app_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_github_app_installations_account"
  ON "github_app_installations" ("account_login");
--> statement-breakpoint

ALTER TABLE "github_app_installations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "github_app_installations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "github_app_installations";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "github_app_installations" AS PERMISSIVE FOR ALL
  USING (true);
--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation" ON "github_app_installations";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "github_app_installations" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint
