-- Fix trace vision schema mismatches found by architecture + adversarial reviews
-- Aligns SQL with Drizzle schema (source of truth)

-- C2 Fix: traces.tags should be jsonb not text[]
ALTER TABLE traces ALTER COLUMN tags TYPE jsonb USING CASE
  WHEN tags IS NULL THEN NULL
  ELSE to_jsonb(tags)
END;

-- C2 Fix: trace_observations.level should be text not integer
ALTER TABLE trace_observations ALTER COLUMN level TYPE text USING level::text;
ALTER TABLE trace_observations ALTER COLUMN level DROP NOT NULL;
ALTER TABLE trace_observations ALTER COLUMN level DROP DEFAULT;

-- C2 Fix: trace_lens_results.trace_id should be nullable (for workflow-level analyses)
ALTER TABLE trace_lens_results ALTER COLUMN trace_id DROP NOT NULL;

-- C2 Fix: add missing workflow_instance_id to trace_lens_results
ALTER TABLE trace_lens_results ADD COLUMN IF NOT EXISTS workflow_instance_id uuid REFERENCES workflow_instances(id);
CREATE INDEX IF NOT EXISTS trace_lens_results_lens_workflow_idx ON trace_lens_results(lens_id, workflow_instance_id);

-- Add phases JSONB column for silver enrichment (PIPE-02)
ALTER TABLE traces ADD COLUMN IF NOT EXISTS phases jsonb;

-- C1 Fix: RLS with FORCE for table owner bypass
-- The heartbeat service runs as the DB owner, so we need FORCE ROW LEVEL SECURITY
-- to ensure RLS applies even for the table owner
ALTER TABLE traces FORCE ROW LEVEL SECURITY;
ALTER TABLE trace_observations FORCE ROW LEVEL SECURITY;
ALTER TABLE trace_lenses FORCE ROW LEVEL SECURITY;
ALTER TABLE trace_lens_results FORCE ROW LEVEL SECURITY;
