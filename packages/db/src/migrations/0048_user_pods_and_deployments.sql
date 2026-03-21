-- POD-02 + DEPLOY-01: Per-User Pods + Artifact Deployments
-- Creates user_pods and artifact_deployments tables with RLS

-- ============================================================================
-- user_pods: One persistent Docker pod per user per company
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_pods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  docker_container_id text,
  docker_image text NOT NULL DEFAULT 'mnm-agent:latest',
  status text NOT NULL DEFAULT 'provisioning',
  volume_name text,
  workspace_volume text,
  cpu_millicores integer NOT NULL DEFAULT 1000,
  memory_mb integer NOT NULL DEFAULT 1024,
  last_active_at timestamptz,
  claude_auth_status text NOT NULL DEFAULT 'unknown',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_pods_company_user_idx ON user_pods(company_id, user_id);
CREATE INDEX IF NOT EXISTS user_pods_status_idx ON user_pods(status);
CREATE INDEX IF NOT EXISTS user_pods_last_active_idx ON user_pods(last_active_at);

-- RLS
ALTER TABLE user_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pods FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_pods_rls' AND tablename = 'user_pods') THEN
    CREATE POLICY user_pods_rls ON user_pods USING (company_id::text = current_setting('app.current_company_id', true));
  END IF;
END $$;

-- ============================================================================
-- artifact_deployments: Ephemeral preview containers for agent artifacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS artifact_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id text NOT NULL REFERENCES "user"(id),
  issue_id uuid REFERENCES issues(id),
  run_id uuid REFERENCES heartbeat_runs(id),
  agent_id uuid REFERENCES agents(id),
  project_id uuid REFERENCES projects(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'building',
  project_type text NOT NULL DEFAULT 'unknown',
  docker_container_id text,
  port integer,
  source_path text NOT NULL,
  build_log text,
  ttl_seconds integer NOT NULL DEFAULT 86400,
  pinned boolean NOT NULL DEFAULT false,
  share_token text,
  url text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artifact_deployments_company_status_idx ON artifact_deployments(company_id, status);
CREATE INDEX IF NOT EXISTS artifact_deployments_expires_at_idx ON artifact_deployments(expires_at);
CREATE INDEX IF NOT EXISTS artifact_deployments_issue_id_idx ON artifact_deployments(issue_id);
CREATE INDEX IF NOT EXISTS artifact_deployments_share_token_idx ON artifact_deployments(share_token);

-- RLS
ALTER TABLE artifact_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_deployments FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'artifact_deployments_rls' AND tablename = 'artifact_deployments') THEN
    CREATE POLICY artifact_deployments_rls ON artifact_deployments USING (company_id::text = current_setting('app.current_company_id', true));
  END IF;
END $$;
