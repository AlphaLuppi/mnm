-- ORCH-S01: State Machine XState — Enrichir stage_instances et workflow_instances

-- Enrichir stage_instances pour la state machine
ALTER TABLE stage_instances
  ADD COLUMN IF NOT EXISTS machine_state TEXT NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS last_actor_type TEXT,
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS transition_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS machine_context JSONB;

-- Index sur machine_state pour les queries par etat
CREATE INDEX IF NOT EXISTS stage_instances_machine_state_idx
  ON stage_instances (company_id, machine_state);

-- Migrer les status existants vers machine_state
UPDATE stage_instances SET machine_state = CASE
  WHEN status = 'pending' THEN 'created'
  WHEN status = 'running' THEN 'in_progress'
  WHEN status = 'review' THEN 'validating'
  WHEN status = 'done' THEN 'completed'
  WHEN status = 'failed' THEN 'failed'
  WHEN status = 'skipped' THEN 'skipped'
  ELSE 'created'
END;

-- Enrichir workflow_instances
ALTER TABLE workflow_instances
  ADD COLUMN IF NOT EXISTS workflow_state TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS last_actor_type TEXT;

-- Index sur workflow_state
CREATE INDEX IF NOT EXISTS workflow_instances_workflow_state_idx
  ON workflow_instances (company_id, workflow_state);

-- Migrer les status existants vers workflow_state
UPDATE workflow_instances SET workflow_state = CASE
  WHEN status = 'active' THEN 'active'
  WHEN status = 'completed' THEN 'completed'
  ELSE 'draft'
END;
