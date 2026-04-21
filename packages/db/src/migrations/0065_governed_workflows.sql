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

-- All subsequent DDL added in later tasks of this plan.
