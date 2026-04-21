-- GOVERNED-WORKFLOWS: T2 — schema for governed workflow runs, steps, gate results
-- Spec: docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md §2
-- Depends on: migration 0052 (config_layer_items), 0062 (item_type CHECK)
-- Follow-on migrations will land with T4/T5 (runtime code).

-- T2.2: Extend agents with latest_git_tag + enabled
ALTER TABLE agents ADD COLUMN latest_git_tag TEXT;
ALTER TABLE agents ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;

-- All subsequent DDL added in later tasks of this plan.
