-- ORCH-S02: WorkflowEnforcer — enforcement_results + pre_prompts_injected columns
ALTER TABLE stage_instances
  ADD COLUMN IF NOT EXISTS enforcement_results jsonb,
  ADD COLUMN IF NOT EXISTS pre_prompts_injected jsonb;
