-- COMP-S02: compaction_snapshots table — Kill+Relance recovery snapshots
-- comp-s02-migration
CREATE TABLE IF NOT EXISTS "compaction_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "workflow_instance_id" uuid NOT NULL,
  "stage_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "stage_order" integer NOT NULL,
  "detected_at" timestamp with time zone NOT NULL DEFAULT now(),
  "detection_pattern" text NOT NULL,
  "detection_message" text NOT NULL,
  "previous_artifacts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "pre_prompts_injected" jsonb,
  "output_artifacts_so_far" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "strategy" text NOT NULL DEFAULT 'kill_relaunch',
  "status" text NOT NULL DEFAULT 'pending',
  "resolved_at" timestamp with time zone,
  "relaunch_count" integer NOT NULL DEFAULT 0,
  "max_relaunch_count" integer NOT NULL DEFAULT 3,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
-- comp-s02-idx-company
CREATE INDEX IF NOT EXISTS "idx_compaction_snapshots_company_id" ON "compaction_snapshots" ("company_id");
-- comp-s02-idx-agent-stage
CREATE INDEX IF NOT EXISTS "idx_compaction_snapshots_agent_stage" ON "compaction_snapshots" ("agent_id", "stage_id");
-- comp-s02-idx-status
CREATE INDEX IF NOT EXISTS "idx_compaction_snapshots_status" ON "compaction_snapshots" ("status");

-- RLS policy (same pattern as other tenant tables)
ALTER TABLE "compaction_snapshots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compaction_snapshots_tenant_isolation" ON "compaction_snapshots"
  USING ("company_id"::text = current_setting('app.current_company_id', true));
