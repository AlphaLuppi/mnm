-- WORKFLOW-COMPOSITE T5.1 — meta-workflow `uses:` linking columns.
--
-- ─── What this migration does ────────────────────────────────────────────────
-- Adds three nullable, self-referencing columns on governed_step_executions
-- so a step of type "composite" can launch a sub-run and the orchestrator can
-- walk the parent/child + root chain without scanning the whole table.
--
--   * parent_step_execution_id → the step in the parent run that triggered
--     this composite expansion (NULL for non-composite/leaf or root run steps)
--   * composite_run_id        → the sub-run launched by this step (set on the
--     parent step row pointing to its child run; NULL otherwise)
--   * root_run_id             → top-most run in the chain (= the run launched
--     by the human actor). Propagated downward so we can cap fan-out per root
--     in O(1) (security M4 — `enforceFanoutCap`).
--
-- All three are ON DELETE SET NULL so a forensic delete of an upstream run
-- never cascades into orphan history.
--
-- ─── Index ──────────────────────────────────────────────────────────────────
-- Partial index on (company_id, root_run_id) WHERE root_run_id IS NOT NULL —
-- only composite chains pay the index storage cost; lookups for "all sub-runs
-- under this root" stay company-scoped (RLS-friendly).
--
-- ─── RLS ────────────────────────────────────────────────────────────────────
-- governed_step_executions already has RLS enabled (0030 + 0080 baseline).
-- No new policy needed — the new columns inherit the existing tenant filter.

ALTER TABLE "governed_step_executions"
  ADD COLUMN IF NOT EXISTS "parent_step_execution_id" uuid
    REFERENCES "governed_step_executions"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "composite_run_id" uuid
    REFERENCES "governed_workflow_runs"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "root_run_id" uuid
    REFERENCES "governed_workflow_runs"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "governed_step_executions_root_run_idx"
  ON "governed_step_executions"("company_id","root_run_id")
  WHERE "root_run_id" IS NOT NULL;
--> statement-breakpoint
