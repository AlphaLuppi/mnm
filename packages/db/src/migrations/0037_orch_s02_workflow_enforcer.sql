-- ORCH-S02: WorkflowEnforcer — enforcement_results + pre_prompts_injected columns
ALTER TABLE stage_instances
  ADD COLUMN enforcement_results jsonb,
  ADD COLUMN pre_prompts_injected jsonb;
