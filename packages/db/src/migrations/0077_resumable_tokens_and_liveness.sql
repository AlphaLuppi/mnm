-- packages/db/src/migrations/0077_resumable_tokens_and_liveness.sql
-- Phase 4 — Run liveness + watchdog + auto-recovery (Paperclip parity).
-- Ports concepts from upstream PRs #4083 (liveness continuations + last-useful-action),
-- #4419 (runtime lifecycle recovery + active-run watchdog), #4587 (configurable auto-recovery).
--
-- Spec: docs/superpowers/plans/2026-04-28-paperclip-upstream-merge.md §6 (Phase 4).
-- Idempotent: IF NOT EXISTS guards on column adds and indexes.
-- This codebase uses additive-only migrations (see CLAUDE.md "Architecture Decisions").

-- ── 1. Liveness columns on governed_workflow_runs ──────────────────────────
--
-- resumable_token : opaque JSONB blob populated by the agent runtime so a
--                   stalled run can be replayed with the last useful state
--                   (#4083). The shape is intentionally untyped at the DB
--                   level so different adapters (claude_local, http) can
--                   stuff their own continuation hint in it.
--
-- last_useful_action_at : last time the run made measurable forward progress
--                   (e.g., wrote an artifact, completed a step, posted a
--                   meaningful comment). Distinct from heartbeat to avoid
--                   false positives on long-but-alive runs (#4083 heuristic).
--
-- next_action_hint : human-readable handoff string ("waiting on review on
--                   PR-123", "retrying tool call after timeout"). Surfaced in
--                   the UI + auto-recovery prompt to the CAO.
ALTER TABLE "governed_workflow_runs"
  ADD COLUMN IF NOT EXISTS "resumable_token"        jsonb,
  ADD COLUMN IF NOT EXISTS "last_useful_action_at"  timestamptz,
  ADD COLUMN IF NOT EXISTS "next_action_hint"       text;
--> statement-breakpoint

-- ── 2. Recovery accounting columns ─────────────────────────────────────────
--
-- recovery_attempts : monotonic counter incremented each time the watchdog
--                   fires recoverRun on this row. Bounded by recovery_policy
--                   (default 3) — prevents the determinism loop call-out from
--                   the plan §6.4 R2.
--
-- last_recovered_at : timestamp of the last automatic recovery wake. Used in
--                   the UI badge ("auto-recovered 2m ago") and in the
--                   backoff calculation (bound by min interval).
--
-- recovery_policy_json : per-run override of the company default recovery
--                   policy. NULL = inherit. Shape:
--                   { enabled: bool, retries: int, backoff_ms: int,
--                     stall_timeout_seconds: int }.
ALTER TABLE "governed_workflow_runs"
  ADD COLUMN IF NOT EXISTS "recovery_attempts"     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_recovered_at"     timestamptz,
  ADD COLUMN IF NOT EXISTS "recovery_policy_json"  jsonb;
--> statement-breakpoint

-- ── 3. Indexes for the watchdog query ──────────────────────────────────────
--
-- The watchdog scans active runs whose `last_useful_action_at` is older than
-- `now() - timeout`. Filtering by status='active' first keeps the scan small
-- (completed/failed/cancelled runs are dead, no recovery work to do).
--
-- Partial index: only active runs with a meaningful last_useful_action_at
-- value participate in stall detection. Excluding NULLs (just-launched runs)
-- avoids waking up runs that haven't had time to do anything yet — the
-- service caller falls back to startedAt for that bootstrapping window.
CREATE INDEX IF NOT EXISTS "governed_workflow_runs_liveness_idx"
  ON "governed_workflow_runs" ("company_id", "status", "last_useful_action_at")
  WHERE "status" = 'active' AND "last_useful_action_at" IS NOT NULL;
--> statement-breakpoint

-- Recovery-attempt index: lets the auto-recovery service quickly find runs
-- already past the retries threshold and surface them to operators (CAO
-- comment + UI alert) instead of spinning recovery loops.
CREATE INDEX IF NOT EXISTS "governed_workflow_runs_recovery_attempts_idx"
  ON "governed_workflow_runs" ("company_id", "recovery_attempts")
  WHERE "status" = 'active' AND "recovery_attempts" > 0;
