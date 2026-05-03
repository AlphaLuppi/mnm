-- CONNECTORS-PLATFORM (plan v2 — docs/superpowers/plans/2026-05-02-mnm-connectors-platform.md)
-- Hub d'identité OAuth user-level (Jira, ClickUp, GitHub, ..., + API keys OpenAI, Anthropic, ...)
-- 4 tables : oauth_connectors (per-company OAuth/api_key configs), connector_tokens (user OAuth tokens chiffrés inline),
-- user_api_keys (user API keys chiffrés inline), oauth_connectors_audit (audit log).
-- Tokens & secrets chiffrés AES-256-GCM via inline columns (iv/ciphertext/tag) — clé MNM_SECRETS_KEY,
-- pattern partagé secret-crypto.ts (extrait de credential.ts). RLS RESTRICTIVE FORCE sur toutes les tables.

-- =============================================================================
-- 1. oauth_connectors — admin-managed OAuth + API key connectors per-company
-- =============================================================================

CREATE TABLE IF NOT EXISTS "oauth_connectors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "provider_slug" text NOT NULL,
  "display_name" text NOT NULL,
  "type" text NOT NULL,

  -- OAuth 2.0 fields (NULL pour type=api_key)
  "authorization_url" text,
  "token_url" text,
  "userinfo_url" text,
  "scopes" text[] NOT NULL DEFAULT '{}',
  "redirect_uri" text,
  "client_id" text,

  -- Inline AES-256-GCM (cohérent avec credential.ts pattern)
  "client_secret_iv" text,
  "client_secret_ciphertext" text,
  "client_secret_tag" text,

  "refresh_supported" boolean NOT NULL DEFAULT true,

  -- API Key fields (NULL pour type=oauth2)
  "api_key_label" text,

  "enabled" boolean NOT NULL DEFAULT true,
  "created_by_user_id" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "oauth_connectors_type_check" CHECK (type IN ('oauth2', 'api_key')),
  CONSTRAINT "oauth_connectors_type_shape_check" CHECK (
    (type = 'oauth2' AND authorization_url IS NOT NULL AND token_url IS NOT NULL
      AND client_id IS NOT NULL AND client_secret_iv IS NOT NULL
      AND client_secret_ciphertext IS NOT NULL AND client_secret_tag IS NOT NULL)
    OR
    (type = 'api_key' AND api_key_label IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_connectors_company_provider_idx"
  ON "oauth_connectors" ("company_id", "provider_slug");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "oauth_connectors_company_enabled_idx"
  ON "oauth_connectors" ("company_id", "enabled");
--> statement-breakpoint

ALTER TABLE "oauth_connectors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_connectors" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "oauth_connectors";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "oauth_connectors" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- =============================================================================
-- 2. connector_tokens — OAuth user tokens chiffrés AES-256-GCM inline (MnM-owned, NOT BetterAuth account)
--    Lève le risque "tokens en clair en DB" + permet RLS multi-tenant.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "connector_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "connector_id" uuid NOT NULL REFERENCES "oauth_connectors"("id") ON DELETE CASCADE,

  "access_token_iv" text NOT NULL,
  "access_token_ciphertext" text NOT NULL,
  "access_token_tag" text NOT NULL,

  "refresh_token_iv" text,
  "refresh_token_ciphertext" text,
  "refresh_token_tag" text,

  "expires_at" timestamp with time zone,
  "scopes_granted" text[] NOT NULL DEFAULT '{}',

  "last_used_at" timestamp with time zone,
  "last_refresh_at" timestamp with time zone,
  "last_refresh_failed_at" timestamp with time zone,

  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "connector_tokens_user_connector_idx"
  ON "connector_tokens" ("user_id", "connector_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "connector_tokens_company_user_idx"
  ON "connector_tokens" ("company_id", "user_id");
--> statement-breakpoint

ALTER TABLE "connector_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connector_tokens" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "connector_tokens";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "connector_tokens" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- =============================================================================
-- 3. user_api_keys — API keys user-level chiffrés AES-256-GCM inline
-- =============================================================================

CREATE TABLE IF NOT EXISTS "user_api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "connector_id" uuid NOT NULL REFERENCES "oauth_connectors"("id") ON DELETE CASCADE,

  "key_iv" text NOT NULL,
  "key_ciphertext" text NOT NULL,
  "key_tag" text NOT NULL,

  "last_used_at" timestamp with time zone,

  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "user_api_keys_user_connector_idx"
  ON "user_api_keys" ("user_id", "connector_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_api_keys_company_user_idx"
  ON "user_api_keys" ("company_id", "user_id");
--> statement-breakpoint

ALTER TABLE "user_api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_api_keys" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "user_api_keys";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_api_keys" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- =============================================================================
-- 4. oauth_connectors_audit — audit log avec `actor_user_id` pour traçabilité humaine §1.7
-- =============================================================================

CREATE TABLE IF NOT EXISTS "oauth_connectors_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "connector_id" uuid REFERENCES "oauth_connectors"("id") ON DELETE SET NULL,
  "actor_user_id" text REFERENCES "user"("id"),
  "action" text NOT NULL,
  "diff_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "oauth_connectors_audit_action_check" CHECK (
    action IN (
      'connector_created','connector_updated','connector_deleted','connector_enabled','connector_disabled',
      'user_connected','user_disconnected','user_refresh_failed','user_token_revoked',
      'token_used','redirect_after_rejected'
    )
  )
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "oauth_connectors_audit_company_action_idx"
  ON "oauth_connectors_audit" ("company_id", "action", "created_at");
--> statement-breakpoint

ALTER TABLE "oauth_connectors_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_connectors_audit" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "oauth_connectors_audit";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "oauth_connectors_audit" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- =============================================================================
-- 5. Permissions seeded by company (idempotent)
-- =============================================================================

INSERT INTO "permissions" ("company_id", "slug", "description", "category", "is_custom")
SELECT c.id, p.slug, p.description, 'connectors', false
FROM "companies" c
CROSS JOIN (VALUES
  ('connectors:manage',  'CRUD on OAuth connectors and API key connectors'),
  ('connectors:audit',   'Read audit log of connector changes')
) AS p(slug, description)
ON CONFLICT ("company_id", "slug") DO NOTHING;
--> statement-breakpoint
