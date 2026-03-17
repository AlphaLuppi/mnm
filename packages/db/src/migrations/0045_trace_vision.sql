-- Trace Vision tables (TRACE-01 + TRACE-07)
-- 4 tables: traces, trace_observations, trace_lenses, trace_lens_results

CREATE TABLE IF NOT EXISTS "traces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "heartbeat_run_id" uuid,
  "workflow_instance_id" uuid,
  "stage_instance_id" uuid,
  "agent_id" uuid,
  "parent_trace_id" uuid,
  "name" text NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "total_duration_ms" integer,
  "total_tokens_in" integer DEFAULT 0 NOT NULL,
  "total_tokens_out" integer DEFAULT 0 NOT NULL,
  "total_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
  "metadata" jsonb,
  "tags" text[],
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "trace_observations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trace_id" uuid NOT NULL,
  "parent_observation_id" uuid,
  "company_id" uuid NOT NULL,
  "type" text NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "level" integer DEFAULT 0 NOT NULL,
  "status_message" text,
  "input" jsonb,
  "output" jsonb,
  "input_tokens" integer,
  "output_tokens" integer,
  "total_tokens" integer,
  "cost_usd" numeric(10, 6),
  "model" text,
  "model_parameters" jsonb,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "trace_lenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "prompt" text NOT NULL,
  "scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_template" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "trace_lens_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lens_id" uuid NOT NULL,
  "trace_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "result_markdown" text NOT NULL,
  "result_structured" jsonb,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "model_used" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "cost_usd" numeric(10, 6),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "traces_company_date_idx" ON "traces" ("company_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "traces_agent_idx" ON "traces" ("agent_id");
CREATE INDEX IF NOT EXISTS "traces_status_idx" ON "traces" ("status");
CREATE INDEX IF NOT EXISTS "traces_workflow_idx" ON "traces" ("workflow_instance_id");
CREATE INDEX IF NOT EXISTS "traces_parent_idx" ON "traces" ("parent_trace_id");
CREATE INDEX IF NOT EXISTS "traces_heartbeat_idx" ON "traces" ("heartbeat_run_id");

CREATE INDEX IF NOT EXISTS "obs_trace_idx" ON "trace_observations" ("trace_id");
CREATE INDEX IF NOT EXISTS "obs_company_idx" ON "trace_observations" ("company_id");
CREATE INDEX IF NOT EXISTS "obs_parent_idx" ON "trace_observations" ("parent_observation_id");
CREATE INDEX IF NOT EXISTS "obs_type_idx" ON "trace_observations" ("type");

CREATE INDEX IF NOT EXISTS "lenses_company_user_idx" ON "trace_lenses" ("company_id", "user_id");
CREATE INDEX IF NOT EXISTS "lenses_template_idx" ON "trace_lenses" ("is_template");

CREATE INDEX IF NOT EXISTS "lens_results_lens_trace_idx" ON "trace_lens_results" ("lens_id", "trace_id");
CREATE INDEX IF NOT EXISTS "lens_results_company_idx" ON "trace_lens_results" ("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lens_results_unique_idx" ON "trace_lens_results" ("lens_id", "trace_id");

-- Foreign keys
ALTER TABLE "traces" ADD CONSTRAINT "traces_parent_fk" FOREIGN KEY ("parent_trace_id") REFERENCES "traces" ("id") ON DELETE SET NULL;
ALTER TABLE "trace_observations" ADD CONSTRAINT "obs_trace_fk" FOREIGN KEY ("trace_id") REFERENCES "traces" ("id") ON DELETE CASCADE;
ALTER TABLE "trace_observations" ADD CONSTRAINT "obs_parent_fk" FOREIGN KEY ("parent_observation_id") REFERENCES "trace_observations" ("id") ON DELETE SET NULL;
ALTER TABLE "trace_lens_results" ADD CONSTRAINT "lens_results_lens_fk" FOREIGN KEY ("lens_id") REFERENCES "trace_lenses" ("id") ON DELETE CASCADE;
ALTER TABLE "trace_lens_results" ADD CONSTRAINT "lens_results_trace_fk" FOREIGN KEY ("trace_id") REFERENCES "traces" ("id") ON DELETE CASCADE;

-- RLS policies (same pattern as all other B2B tables)
ALTER TABLE "traces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trace_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trace_lenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trace_lens_results" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traces_rls" ON "traces" USING (company_id::text = current_setting('app.current_company_id', true));
CREATE POLICY "obs_rls" ON "trace_observations" USING (company_id::text = current_setting('app.current_company_id', true));
CREATE POLICY "lenses_rls" ON "trace_lenses" USING (company_id::text = current_setting('app.current_company_id', true));
CREATE POLICY "lens_results_rls" ON "trace_lens_results" USING (company_id::text = current_setting('app.current_company_id', true));
