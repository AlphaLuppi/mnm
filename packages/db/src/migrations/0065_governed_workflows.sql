-- GOVERNED-WORKFLOWS: T2 — schema for governed workflow runs, steps, gate results
-- Spec: docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md §2
-- Depends on: migration 0052 (config_layer_items), 0062 (item_type CHECK)
-- Follow-on migrations will land with T4/T5 (runtime code).

-- ===============================================================
-- 1. EXTEND existing tables
-- ===============================================================

-- 1a. agents: attach git metadata + toggle
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "latest_git_tag" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "enabled" boolean NOT NULL DEFAULT true;--> statement-breakpoint

-- 1b. config_layer_items: extend item_type CHECK with 'env_ref'.
-- 'env_ref' is a required-env-var marker surfaced to the SessionStart hook so
-- the user knows which secrets must exist in their shell env for a given agent
-- or workflow to run (spec §5 — required_secrets in .mnm-managed.json).
-- NOTE: the existing 'mcp' item_type is reused for user-side MCP entries too
-- (decision 2026-04-21) — no new values introduced beyond env_ref.
-- Keeping 'hook' and 'setting' unchanged (already allowed since migration 0052).
ALTER TABLE config_layer_items DROP CONSTRAINT IF EXISTS config_layer_items_item_type_check;--> statement-breakpoint
ALTER TABLE config_layer_items ADD CONSTRAINT config_layer_items_item_type_check
  CHECK (item_type IN ('mcp', 'skill', 'hook', 'setting', 'git_provider', 'credential', 'env_ref'));--> statement-breakpoint

-- ===============================================================
-- 2. NEW TABLES
-- ===============================================================

-- 2a. governed_workflow_definitions — metadata only. No parsed workflow.json
-- cached here; the server fetches by git_sha on demand (spec §2 fetch-on-demand).
CREATE TABLE "governed_workflow_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "description" text,
  "latest_git_tag" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "governed_workflow_definitions_company_name_uq"
  ON "governed_workflow_definitions"("company_id", "name");--> statement-breakpoint

ALTER TABLE "governed_workflow_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "governed_workflow_definitions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "governed_workflow_definitions" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 2b. governed_workflow_runs — one per launchWorkflow call. workflow_git_tag/sha
-- are the immutable ref captured at trigger time (spec §2).
-- initiated_by_actor_type aligns to AUDIT_ACTOR_TYPES canonical tuple.
-- status uses text + CHECK (no pgEnum in this codebase).
CREATE TABLE "governed_workflow_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "workflow_def_id" uuid NOT NULL REFERENCES "governed_workflow_definitions"("id"),
  "workflow_git_tag" text NOT NULL,
  "workflow_git_sha" text NOT NULL,
  "initiated_by_actor_type" text NOT NULL CHECK ("initiated_by_actor_type" IN ('user', 'agent', 'system')),
  "initiated_by_actor_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'active', 'completed', 'failed')),
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "params_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "governed_workflow_runs_company_status_idx"
  ON "governed_workflow_runs"("company_id", "status");--> statement-breakpoint
CREATE INDEX "governed_workflow_runs_def_started_idx"
  ON "governed_workflow_runs"("workflow_def_id", "started_at" DESC);--> statement-breakpoint

ALTER TABLE "governed_workflow_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "governed_workflow_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "governed_workflow_runs" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- All subsequent DDL added in later tasks of this plan.
