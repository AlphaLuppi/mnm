-- Phase 3 — port of upstream PR #4297 (BETA Environments)
-- Adapted for MnM (no execution_workspaces table; reference issues + heartbeat_runs only).
-- Adds the `environments` table: company-scoped, driver-typed (local|ssh|sandbox|plugin),
-- status state machine. RLS-enforced (tenant isolation).

CREATE TABLE IF NOT EXISTS "environments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "driver" text NOT NULL DEFAULT 'local',
  "status" text NOT NULL DEFAULT 'active',
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "environments_driver_check" CHECK ("driver" IN ('local', 'ssh', 'sandbox', 'plugin')),
  CONSTRAINT "environments_status_check" CHECK ("status" IN ('active', 'archived'))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "environments_company_status_idx"
  ON "environments" USING btree ("company_id", "status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environments_company_driver_idx"
  ON "environments" USING btree ("company_id", "driver");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "environments_company_name_idx"
  ON "environments" USING btree ("company_id", "name");--> statement-breakpoint

ALTER TABLE "environments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "environments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "environments" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
