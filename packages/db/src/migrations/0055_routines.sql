-- Routines: recurring task definitions that create issues on trigger
CREATE TABLE IF NOT EXISTS "routines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "goal_id" uuid REFERENCES "goals"("id"),
  "parent_issue_id" uuid REFERENCES "issues"("id"),
  "title" text NOT NULL,
  "description" text,
  "assignee_agent_id" uuid NOT NULL REFERENCES "agents"("id"),
  "priority" text NOT NULL DEFAULT 'medium',
  "status" text NOT NULL DEFAULT 'active',
  "concurrency_policy" text NOT NULL DEFAULT 'coalesce_if_active',
  "catch_up_policy" text NOT NULL DEFAULT 'skip_missed',
  "variables" jsonb DEFAULT '[]'::jsonb,
  "created_by_agent_id" uuid REFERENCES "agents"("id"),
  "created_by_user_id" text,
  "updated_by_agent_id" uuid REFERENCES "agents"("id"),
  "updated_by_user_id" text,
  "last_triggered_at" timestamp with time zone,
  "last_enqueued_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "routines_company_status_idx" ON "routines" ("company_id", "status");
CREATE INDEX IF NOT EXISTS "routines_company_assignee_idx" ON "routines" ("company_id", "assignee_agent_id");
CREATE INDEX IF NOT EXISTS "routines_company_project_idx" ON "routines" ("company_id", "project_id");

-- Routine triggers: schedule (cron), webhook (signed HTTP), or api (manual)
CREATE TABLE IF NOT EXISTS "routine_triggers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "routine_id" uuid NOT NULL REFERENCES "routines"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "label" text,
  "enabled" boolean NOT NULL DEFAULT true,
  -- Schedule fields
  "cron_expression" text,
  "timezone" text,
  "next_run_at" timestamp with time zone,
  -- Webhook fields
  "public_id" text,
  "secret_hash" text,
  "signing_mode" text,
  "replay_window_sec" integer DEFAULT 300,
  "last_rotated_at" timestamp with time zone,
  -- Common
  "last_fired_at" timestamp with time zone,
  "last_result" text,
  "created_by_agent_id" uuid REFERENCES "agents"("id"),
  "created_by_user_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "routine_triggers_company_routine_idx" ON "routine_triggers" ("company_id", "routine_id");
CREATE INDEX IF NOT EXISTS "routine_triggers_next_run_at_idx" ON "routine_triggers" ("next_run_at") WHERE "next_run_at" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "routine_triggers_public_id_idx" ON "routine_triggers" ("public_id") WHERE "public_id" IS NOT NULL;

-- Routine runs: each execution of a routine
CREATE TABLE IF NOT EXISTS "routine_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "routine_id" uuid NOT NULL REFERENCES "routines"("id") ON DELETE CASCADE,
  "trigger_id" uuid REFERENCES "routine_triggers"("id") ON DELETE SET NULL,
  "source" text NOT NULL,
  "status" text NOT NULL DEFAULT 'received',
  "triggered_at" timestamp with time zone NOT NULL DEFAULT now(),
  "idempotency_key" text,
  "trigger_payload" jsonb DEFAULT '{}'::jsonb,
  "linked_issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "coalesced_into_run_id" uuid REFERENCES "routine_runs"("id"),
  "failure_reason" text,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "routine_runs_company_routine_idx" ON "routine_runs" ("company_id", "routine_id");
CREATE INDEX IF NOT EXISTS "routine_runs_linked_issue_idx" ON "routine_runs" ("linked_issue_id") WHERE "linked_issue_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "routine_runs_idempotency_idx" ON "routine_runs" ("company_id", "routine_id", "trigger_id", "source", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;
