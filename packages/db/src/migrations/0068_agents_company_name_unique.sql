-- B-FIX-2: enforce unique (company_id, name) for non-archived agents.
-- Spec: docs/superpowers/specs/2026-04-26-mnm-git-first-agents-design.md §6.1.
-- Closes B-CR-2 (race + non-deterministic loadCanonicalAgent row pick).
-- Depends on: 0067 (archived_at column).
-- NOTE: do NOT run db:migrate yet — that is M0 (ops phase, post-review).
--
-- Partial index: archived rows are excluded so a soft-deleted agent can
-- coexist with a live recreation under the same name. Active duplicates
-- are rejected at INSERT/UPDATE time (PostgreSQL error 23505).
-- IF NOT EXISTS makes the migration safe to re-run on a partially-applied
-- state (mid-deploy crash, manual replay).

CREATE UNIQUE INDEX IF NOT EXISTS "agents_company_name_unique"
  ON "agents" ("company_id", "name")
  WHERE "archived_at" IS NULL;
