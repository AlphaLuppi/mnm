-- packages/db/src/migrations/0069_workflow_run_cancellation.sql
-- Cancel/Reactivate governed workflow runs.
-- Spec: docs/superpowers/specs/2026-04-27-cancel-governed-workflow-runs-design.md §1.
-- Idempotent: IF NOT EXISTS guards on column adds and index; DROP IF EXISTS on the CHECK.
-- This codebase uses text + CHECK (no pgEnum) — see 0065 lines 21-23 for the pattern.

ALTER TABLE "governed_workflow_runs"
  ADD COLUMN IF NOT EXISTS "cancelled_at"            timestamptz,
  ADD COLUMN IF NOT EXISTS "cancelled_by_actor_id"   text,
  ADD COLUMN IF NOT EXISTS "cancelled_by_actor_type" text,
  ADD COLUMN IF NOT EXISTS "cancellation_reason"     text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "governed_workflow_runs_cancelled_at_idx"
  ON "governed_workflow_runs" ("company_id", "cancelled_at")
  WHERE "cancelled_at" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "governed_step_executions"
  DROP CONSTRAINT IF EXISTS "governed_step_executions_state_check";
--> statement-breakpoint

ALTER TABLE "governed_step_executions"
  ADD CONSTRAINT "governed_step_executions_state_check"
  CHECK ("state" IN ('pending', 'running', 'gate_eval', 'succeeded', 'failed', 'cancelled'));
