-- PIPE-08: Workflow-level gold enrichment
-- Adds gold JSONB column to workflow_instances for aggregated trace analysis
ALTER TABLE "workflow_instances" ADD COLUMN "gold" jsonb;
