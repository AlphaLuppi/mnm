-- ORCH-S03: HITL Validation — hitl_decision + hitl_history columns
ALTER TABLE stage_instances
  ADD COLUMN hitl_decision jsonb,
  ADD COLUMN hitl_history jsonb DEFAULT '[]'::jsonb;
