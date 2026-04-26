-- P3: add archived_at to agents for soft-delete / Git-first agent lifecycle.
-- Spec: docs/superpowers/specs/2026-04-26-mnm-git-first-agents-design.md §6.1 (amended).
-- Depends on: 0065 (agents table with latest_git_tag + enabled columns).
-- NOTE: do NOT run db:migrate yet — that is M0 (ops phase, post-review).

ALTER TABLE "agents" ADD COLUMN "archived_at" timestamptz;
--> statement-breakpoint
CREATE INDEX "agents_company_active_idx" ON "agents" ("company_id") WHERE "archived_at" IS NULL;
