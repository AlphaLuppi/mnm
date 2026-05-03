-- Phase 3 — port of upstream PR #4297 (BETA Environments — leases).
-- Adapted for MnM: drop `execution_workspaces` FK (no such table here) and
-- keep references to issues + heartbeat_runs. Lease lifecycle = ephemeral
-- by default; status state machine = active|released|expired|failed.

CREATE TABLE IF NOT EXISTS "environment_leases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "environment_id" uuid NOT NULL REFERENCES "environments"("id") ON DELETE CASCADE,
  "issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "heartbeat_run_id" uuid REFERENCES "heartbeat_runs"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'active',
  "lease_policy" text NOT NULL DEFAULT 'ephemeral',
  "provider" text,
  "provider_lease_id" text,
  "acquired_at" timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz,
  "released_at" timestamptz,
  "failure_reason" text,
  "cleanup_status" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "environment_leases_status_check" CHECK ("status" IN ('active', 'released', 'expired', 'failed')),
  CONSTRAINT "environment_leases_policy_check" CHECK ("lease_policy" IN ('ephemeral', 'pinned')),
  CONSTRAINT "environment_leases_cleanup_check" CHECK ("cleanup_status" IS NULL OR "cleanup_status" IN ('pending', 'success', 'failed'))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "environment_leases_company_environment_status_idx"
  ON "environment_leases" USING btree ("company_id", "environment_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "environment_leases_company_issue_idx"
  ON "environment_leases" USING btree ("company_id", "issue_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "environment_leases_heartbeat_run_idx"
  ON "environment_leases" USING btree ("heartbeat_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "environment_leases_company_last_used_idx"
  ON "environment_leases" USING btree ("company_id", "last_used_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "environment_leases_provider_lease_idx"
  ON "environment_leases" USING btree ("provider_lease_id");--> statement-breakpoint

ALTER TABLE "environment_leases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "environment_leases" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "environment_leases";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "environment_leases" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
