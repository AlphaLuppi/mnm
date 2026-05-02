-- WORKFLOW-HOOKS T2.5 — DB foundation for hook configs + execution audit log.
--
-- ─── What this migration does ────────────────────────────────────────────────
-- 5 tables :
--   1. workflow_hooks_config           — declared hook (canonical/shared/local
--                                        ref + default_config + visibility +
--                                        enabled / enforced flags).
--   2. workflow_hooks_config_tags      — tier-2a sharing join (`visibility=tags`).
--   3. workflow_hooks_config_principals — tier-2b sharing join (`visibility=principals`).
--   4. workflow_hooks_config_audit     — admin trail for enforced flips, deletes,
--                                        enable toggles.
--   5. workflow_hook_executions        — runtime audit row per hook invocation
--                                        (1 row per phase per (run, step) — see
--                                        §1.7 traçabilité humaine, actor_user_id
--                                        is mandatory).
--
-- Decision NOT to create a `workflow_hooks_providers_whitelist` : the existing
-- `oauth_connectors` registry already encodes which providers a company has
-- enabled. The hook helper layer reuses that registry verbatim — adding a
-- second whitelist would just create a drift risk between the two.
--
-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Every table is multi-tenant and uses the post-0080 double-policy pattern :
--   * PERMISSIVE  "tenant_baseline_permissive"  USING (true)        — unblocks default-deny.
--   * RESTRICTIVE "tenant_isolation"            USING (company_id =
--                                                  current_setting('app.current_company_id', true)::uuid)
-- Combined with FORCE ROW LEVEL SECURITY, the effective predicate is
-- (true) AND (company_id = <ctx>) — secure even against table owner.
--
-- ─── principal_id / actor_user_id typing ────────────────────────────────────
-- Principals (user|agent virtual concept) are stored as `text` (mirrors
-- tag_assignments.target_id) — there is no real `principals` table. We
-- intentionally do NOT add a FK on principal_id (target_type is implicit:
-- only board users can be hook config owners + sharees in V0).
-- actor_user_id always references "user"(id) (BetterAuth, text PK) per
-- the §1.7 human traceability invariant.

-- ─── Table 1 : workflow_hooks_config ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "workflow_hooks_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "hook_ref" text NOT NULL,
  "default_config_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "visibility" text NOT NULL DEFAULT 'private',
  "created_by_principal_id" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "enforced" boolean NOT NULL DEFAULT false,
  "enforced_phases" text[] NOT NULL DEFAULT '{}'::text[],
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workflow_hooks_config_visibility_check"
    CHECK ("visibility" IN ('private','tags','principals','company')),
  CONSTRAINT "workflow_hooks_config_hook_ref_check"
    CHECK ("hook_ref" ~ '^(canonical|shared|local):[a-z0-9][a-z0-9-]*$')
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_hooks_config_company_name_idx"
  ON "workflow_hooks_config"("company_id", "name");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_hooks_config_company_enforced_idx"
  ON "workflow_hooks_config"("company_id", "enforced", "enabled")
  WHERE "enforced" = true;
--> statement-breakpoint

ALTER TABLE "workflow_hooks_config" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_hooks_config" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "workflow_hooks_config";
--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "workflow_hooks_config"
  AS PERMISSIVE FOR ALL USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "workflow_hooks_config";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hooks_config"
  AS RESTRICTIVE FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- ─── Table 2 : workflow_hooks_config_tags (tier 2a) ─────────────────────────
CREATE TABLE IF NOT EXISTS "workflow_hooks_config_tags" (
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "config_id" uuid NOT NULL REFERENCES "workflow_hooks_config"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("config_id", "tag_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_hooks_config_tags_company_tag_idx"
  ON "workflow_hooks_config_tags"("company_id", "tag_id");
--> statement-breakpoint

ALTER TABLE "workflow_hooks_config_tags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_hooks_config_tags" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "workflow_hooks_config_tags";
--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "workflow_hooks_config_tags"
  AS PERMISSIVE FOR ALL USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "workflow_hooks_config_tags";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hooks_config_tags"
  AS RESTRICTIVE FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- ─── Table 3 : workflow_hooks_config_principals (tier 2b) ───────────────────
CREATE TABLE IF NOT EXISTS "workflow_hooks_config_principals" (
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "config_id" uuid NOT NULL REFERENCES "workflow_hooks_config"("id") ON DELETE CASCADE,
  "principal_id" text NOT NULL,
  PRIMARY KEY ("config_id", "principal_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_hooks_config_principals_company_principal_idx"
  ON "workflow_hooks_config_principals"("company_id", "principal_id");
--> statement-breakpoint

ALTER TABLE "workflow_hooks_config_principals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_hooks_config_principals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "workflow_hooks_config_principals";
--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "workflow_hooks_config_principals"
  AS PERMISSIVE FOR ALL USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "workflow_hooks_config_principals";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hooks_config_principals"
  AS RESTRICTIVE FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- ─── Table 4 : workflow_hooks_config_audit ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "workflow_hooks_config_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "config_id" uuid REFERENCES "workflow_hooks_config"("id") ON DELETE SET NULL,
  "actor_principal_id" text,
  "action" text NOT NULL,
  "diff_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workflow_hooks_config_audit_action_check"
    CHECK ("action" IN (
      'created','updated','deleted',
      'enforced_on','enforced_off',
      'enabled_on','enabled_off'
    ))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_hooks_config_audit_company_config_idx"
  ON "workflow_hooks_config_audit"("company_id", "config_id", "created_at" DESC);
--> statement-breakpoint

ALTER TABLE "workflow_hooks_config_audit" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_hooks_config_audit" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "workflow_hooks_config_audit";
--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "workflow_hooks_config_audit"
  AS PERMISSIVE FOR ALL USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "workflow_hooks_config_audit";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hooks_config_audit"
  AS RESTRICTIVE FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- ─── Table 5 : workflow_hook_executions (runtime audit) ─────────────────────
-- §1.7 human traceability : actor_user_id is the user who triggered the
-- run/step that caused this hook to fire. Even when the hook code itself
-- runs inside an isolate, the identity behind the execution is auditable.
CREATE TABLE IF NOT EXISTS "workflow_hook_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "config_id" uuid REFERENCES "workflow_hooks_config"("id") ON DELETE SET NULL,
  "hook_ref" text NOT NULL,
  "step_execution_id" uuid REFERENCES "governed_step_executions"("id") ON DELETE SET NULL,
  "run_id" uuid REFERENCES "governed_workflow_runs"("id") ON DELETE SET NULL,
  "phase" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "error_code" text,
  "duration_ms" integer,
  "result_summary" text,
  "http_calls_count" integer NOT NULL DEFAULT 0,
  "llm_tokens_in" integer NOT NULL DEFAULT 0,
  "llm_tokens_out" integer NOT NULL DEFAULT 0,
  "actor_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workflow_hook_executions_status_check"
    CHECK ("status" IN ('pending','success','failed','timeout')),
  CONSTRAINT "workflow_hook_executions_phase_check"
    CHECK ("phase" IN ('before_run','before_step','after_step','after_run'))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_hook_executions_company_run_idx"
  ON "workflow_hook_executions"("company_id", "run_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_hook_executions_company_status_idx"
  ON "workflow_hook_executions"("company_id", "status", "created_at" DESC);
--> statement-breakpoint

ALTER TABLE "workflow_hook_executions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_hook_executions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "workflow_hook_executions";
--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "workflow_hook_executions"
  AS PERMISSIVE FOR ALL USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "workflow_hook_executions";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hook_executions"
  AS RESTRICTIVE FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- ─── Permissions seed (2 per company) ───────────────────────────────────────
-- Idempotent on (company_id, slug) — onboarding adds these to relevant roles.
INSERT INTO "permissions" ("company_id", "slug", "description", "category", "is_custom")
SELECT c.id, p.slug, p.description, 'hooks', false
FROM "companies" c
CROSS JOIN (VALUES
  ('hooks:manage',  'CRUD on workflow hook configs'),
  ('hooks:enforce', 'Toggle enforced=true on a workflow hook config (admin)')
) AS p(slug, description)
ON CONFLICT ("company_id", "slug") DO NOTHING;
