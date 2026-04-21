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

-- All subsequent DDL added in later tasks of this plan.
