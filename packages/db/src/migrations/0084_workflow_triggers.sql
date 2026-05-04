-- WORKFLOW-TRIGGERS Phase 1 — unified autonomous triggers for Governed Workflows.
--
-- ─── What this migration does ────────────────────────────────────────────────
-- 2 tables:
--   1. workflow_triggers       — declarative trigger (kind ∈ schedule|webhook|issue,
--                                action ∈ launch_run|launch_step|complete_step).
--                                Mirrors routine_triggers but targets a Governed
--                                Workflow def-ref (text path or definition id).
--   2. workflow_trigger_audit  — append-only fire log with idempotency fence
--                                (replay-safe webhook ingestion).
--
-- Plus 1 permission seed: `workflows:manage_triggers` (per-company).
--
-- ─── §1.7 human traceability ────────────────────────────────────────────────
-- Every trigger has `created_by_user_id` text NOT NULL — every fire surfaces
-- under the identity of the user who created the trigger. There is no service
-- account, no anonymous fire path. The audit row also captures `actor_user_id`
-- (the resolved user behind a fire), which equals `trigger.created_by_user_id`
-- for autonomous channels (cron + webhook) and the actual issue actor for
-- issue-driven fires.
--
-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Both tables follow the post-0080 double-policy pattern:
--   * PERMISSIVE  "tenant_baseline_permissive"  USING (true)
--   * RESTRICTIVE "tenant_isolation"            USING (company_id = ctx)
-- Combined with FORCE ROW LEVEL SECURITY, the effective predicate is
-- (true) AND (company_id = <ctx>) — secure even against table owner.
--
-- ─── workflow_def_ref typing ────────────────────────────────────────────────
-- Kept loosely as `text` (no FK to governed_workflow_definitions) so a
-- trigger can outlive a rename / retag without an FK rewrite. Resolution is
-- performed at fire time by the service layer (workflow-triggers.ts in
-- Phase 2). Same pattern as workflow_hooks_config.hook_ref.

-- ─── Table 1 : workflow_triggers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "workflow_triggers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "workflow_def_ref" text NOT NULL,
  "kind" text NOT NULL,
  "action" text NOT NULL,
  "step_key" text,
  "allowed_step_keys" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "label" text,
  "enabled" boolean NOT NULL DEFAULT true,
  -- Schedule
  "cron_expression" text,
  "timezone" text,
  "next_run_at" timestamptz,
  -- Webhook
  "public_id" text,
  "secret_hash" text,
  "signing_mode" text,
  "replay_window_sec" integer DEFAULT 300,
  "last_rotated_at" timestamptz,
  -- Issue
  "issue_match" jsonb,
  -- Payload mapping
  "payload_template" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Common
  "last_fired_at" timestamptz,
  "last_result" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workflow_triggers_kind_check"
    CHECK ("kind" IN ('schedule','webhook','issue')),
  CONSTRAINT "workflow_triggers_action_check"
    CHECK ("action" IN ('launch_run','launch_step','complete_step')),
  CONSTRAINT "workflow_triggers_signing_mode_check"
    CHECK ("signing_mode" IS NULL OR "signing_mode" IN ('bearer','hmac_sha256'))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_triggers_company_def_idx"
  ON "workflow_triggers"("company_id", "workflow_def_ref");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_triggers_company_kind_idx"
  ON "workflow_triggers"("company_id", "kind", "enabled");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_triggers_next_run_at_idx"
  ON "workflow_triggers"("next_run_at")
  WHERE "next_run_at" IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_triggers_public_id_uq"
  ON "workflow_triggers"("public_id")
  WHERE "public_id" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "workflow_triggers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_triggers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "workflow_triggers";
--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "workflow_triggers"
  AS PERMISSIVE FOR ALL USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "workflow_triggers";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_triggers"
  AS RESTRICTIVE FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- ─── Table 2 : workflow_trigger_audit ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "workflow_trigger_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "trigger_id" uuid REFERENCES "workflow_triggers"("id") ON DELETE SET NULL,
  "workflow_def_ref" text NOT NULL,
  "action" text NOT NULL,
  "outcome" text NOT NULL,
  "run_id" uuid,
  "step_execution_id" uuid,
  "idempotency_key" text,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "actor_user_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_trigger_audit_company_trigger_idx"
  ON "workflow_trigger_audit"("company_id", "trigger_id", "created_at");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_trigger_audit_idempotency_uq"
  ON "workflow_trigger_audit"("company_id", "trigger_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "workflow_trigger_audit" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_trigger_audit" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "workflow_trigger_audit";
--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "workflow_trigger_audit"
  AS PERMISSIVE FOR ALL USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "workflow_trigger_audit";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_trigger_audit"
  AS RESTRICTIVE FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- ─── Permissions seed ────────────────────────────────────────────────────────
-- Idempotent on (company_id, slug) — onboarding adds it to admin/manager roles.
INSERT INTO "permissions" ("company_id", "slug", "description", "category", "is_custom")
SELECT c.id, 'workflows:manage_triggers', 'CRUD on workflow autonomous triggers (schedule/webhook/issue)', 'workflows', false
FROM "companies" c
ON CONFLICT ("company_id", "slug") DO NOTHING;
--> statement-breakpoint
