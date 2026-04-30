-- PAPERCLIP-PHASE2: Inbox Interactive — port of upstream PRs #4244 + #4381
--
-- Structured agent <-> user thread interactions:
--   - kind: suggest_tasks | ask_questions | request_confirmation
--   - status: pending | accepted | rejected | answered | expired | superseded
--   - continuation_policy: wake_assignee | manual (decides whether resolve wakes the assignee)
--   - idempotency_key: per (company, issue) — UNIQUE — protects against double-create on retries
--   - resume_token: opaque JSONB the agent stores so a resumable continuation can restart
--   - source_run_id: the heartbeat_run that produced this card (for traceability)
--
-- Multi-tenant: company_id is mandatory, RLS policy enforces tenant isolation
-- (consistent with 0030_rls_policies.sql + 0071_security_audit_rls_hardening.sql).

CREATE TABLE IF NOT EXISTS "thread_interactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "issue_id" uuid NOT NULL REFERENCES "issues"("id"),
  "kind" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "continuation_policy" text NOT NULL DEFAULT 'wake_assignee',
  "idempotency_key" text,
  "source_comment_id" uuid REFERENCES "issue_comments"("id") ON DELETE SET NULL,
  "source_run_id" uuid REFERENCES "heartbeat_runs"("id") ON DELETE SET NULL,
  "title" text,
  "summary" text,
  "created_by_agent_id" uuid REFERENCES "agents"("id"),
  "created_by_user_id" text,
  "resolved_by_agent_id" uuid REFERENCES "agents"("id"),
  "resolved_by_user_id" text,
  "payload" jsonb NOT NULL,
  "result" jsonb,
  "resume_token" jsonb,
  "resolved_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "thread_interactions_issue_idx"
  ON "thread_interactions" ("issue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thread_interactions_company_issue_created_at_idx"
  ON "thread_interactions" ("company_id", "issue_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thread_interactions_company_issue_status_idx"
  ON "thread_interactions" ("company_id", "issue_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thread_interactions_source_comment_idx"
  ON "thread_interactions" ("source_comment_id");
--> statement-breakpoint

-- Idempotency: at most one interaction per (company, issue, idempotency_key) when key is set.
CREATE UNIQUE INDEX IF NOT EXISTS "thread_interactions_company_issue_idempotency_uq"
  ON "thread_interactions" ("company_id", "issue_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint

-- RLS — tenant isolation (matches the project-wide pattern from 0030).
ALTER TABLE "thread_interactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "thread_interactions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "thread_interactions"
  AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint
