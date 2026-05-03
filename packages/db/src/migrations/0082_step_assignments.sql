-- WORKFLOW-ASSIGNMENTS T3.1 — snapshot table for step assignments + indexes for inbox hot path.
--
-- ─── What this migration does ────────────────────────────────────────────────
-- Single new table: governed_step_assignments (one row per (step_execution, principal)).
-- Two indexes:
--   * governed_step_assignments_principal_snapshot_idx
--       (company_id, principal_id, snapshot_at DESC) — ranks "my pending work"
--       chronologically per principal, per tenant.
--   * governed_step_executions_company_state_partial_idx
--       partial index on (company_id, state) WHERE state IN ('pending','running')
--       — speeds up the join executed by listPendingWorkFor().
--
-- ─── principal_id typing — no FK ────────────────────────────────────────────
-- Following the same convention as `workflow_hooks_config_principals` and
-- `tag_assignments.target_id`, principal_id is `text` (NOT uuid) and carries
-- NO foreign key. Principals are a virtual concept (user|agent) and there
-- is no real `principals` table. Tying to `user`(id) (text) would be too
-- narrow — agents must also be addressable as principals in the future.
--
-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Post-0080 double-policy pattern (PERMISSIVE baseline + RESTRICTIVE tenant)
-- combined with FORCE ROW LEVEL SECURITY.

CREATE TABLE IF NOT EXISTS "governed_step_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "step_execution_id" uuid NOT NULL REFERENCES "governed_step_executions"("id") ON DELETE CASCADE,
  "principal_id" text NOT NULL,
  "reason" text NOT NULL,
  "snapshot_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "governed_step_assignments_step_principal_uq"
    UNIQUE ("step_execution_id", "principal_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "governed_step_assignments_principal_snapshot_idx"
  ON "governed_step_assignments"("company_id","principal_id","snapshot_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "governed_step_executions_company_state_partial_idx"
  ON "governed_step_executions"("company_id", "state")
  WHERE "state" IN ('pending','running');
--> statement-breakpoint

ALTER TABLE "governed_step_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "governed_step_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "governed_step_assignments";
--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "governed_step_assignments"
  AS PERMISSIVE FOR ALL USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "governed_step_assignments";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "governed_step_assignments"
  AS RESTRICTIVE FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint
