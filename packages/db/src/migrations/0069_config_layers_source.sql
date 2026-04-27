-- 0069_config_layers_source.sql
-- Spec: docs/superpowers/specs/2026-04-27-cc-plugin-import-config-layers-design.md §4.1
-- Track imported CC plugins on config_layers : where they came from, what
-- commit was cloned, which kind of source, and which MnM commit materialized
-- the import locally.

ALTER TABLE "config_layers"
  ADD COLUMN IF NOT EXISTS "source_url" text,
  ADD COLUMN IF NOT EXISTS "source_sha" text,
  ADD COLUMN IF NOT EXISTS "source_kind" text NOT NULL DEFAULT 'inline',
  ADD COLUMN IF NOT EXISTS "mnm_import_commit_sha" text;

ALTER TABLE "config_layers"
  ADD CONSTRAINT "config_layers_source_kind_check"
  CHECK ("source_kind" IN ('inline', 'cc-plugin', 'cc-marketplace'));
