-- ORCH-S03: HITL Validation — hitl_decision + hitl_history columns
ALTER TABLE stage_instances
  ADD COLUMN IF NOT EXISTS hitl_decision jsonb,
  ADD COLUMN IF NOT EXISTS hitl_history jsonb DEFAULT '[]'::jsonb;
