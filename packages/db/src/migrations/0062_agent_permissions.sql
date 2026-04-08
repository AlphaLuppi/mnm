-- Agent individual permissions: direct permission grants per agent
CREATE TABLE IF NOT EXISTS "agent_permissions" (
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  CONSTRAINT "agent_permissions_pkey" PRIMARY KEY ("agent_id", "permission_id")
);

CREATE INDEX IF NOT EXISTS "agent_permissions_agent_idx" ON "agent_permissions" ("agent_id");
