-- Nuke the legacy workflows feature. Governed Workflows becomes the sole workflow
-- abstraction in MnM. Spec: docs/superpowers/specs/2026-04-24-governed-workflows-ui-design.md
-- Depends on: 0065 (governed workflow tables already exist).
-- Note: MnM is pre-deployment, so we accept full data loss on legacy workflow rows.
--
-- Audit findings (U1.1):
--   traces.workflow_instance_id  — nullable uuid FK → workflow_instances.id
--   traces.stage_instance_id     — nullable uuid FK → stage_instances.id
--   compaction_snapshots.workflow_instance_id — uuid NOT NULL (no FK constraint)
--   compaction_snapshots.stage_id             — uuid NOT NULL (no FK constraint)

-- 1. Release traces FKs to legacy workflow rows, then drop the columns.
ALTER TABLE "traces" ALTER COLUMN "stage_instance_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "traces" SET "workflow_instance_id" = NULL, "stage_instance_id" = NULL;--> statement-breakpoint
ALTER TABLE "traces" DROP COLUMN IF EXISTS "workflow_instance_id";--> statement-breakpoint
ALTER TABLE "traces" DROP COLUMN IF EXISTS "stage_instance_id";--> statement-breakpoint

-- 2. Clean up compaction_snapshots — plain UUID columns without FK constraints.
ALTER TABLE "compaction_snapshots" DROP COLUMN IF EXISTS "workflow_instance_id";--> statement-breakpoint
ALTER TABLE "compaction_snapshots" DROP COLUMN IF EXISTS "stage_id";--> statement-breakpoint

-- 3. Drop the 5 legacy tables. CASCADE releases any remaining FK/index dependency.
DROP TABLE IF EXISTS "stage_instances" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_stage_config_layers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_template_stage_layers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_instances" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_templates" CASCADE;--> statement-breakpoint

-- 4. Optional enums — drop if they exist, ignore if absent.
DROP TYPE IF EXISTS "workflow_stage_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "workflow_instance_status" CASCADE;--> statement-breakpoint

-- 5. Add archived_at to governed_workflow_definitions + partial index.
ALTER TABLE "governed_workflow_definitions" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "governed_workflow_definitions_company_enabled_active_idx"
  ON "governed_workflow_definitions" ("company_id", "enabled")
  WHERE "archived_at" IS NULL;--> statement-breakpoint
