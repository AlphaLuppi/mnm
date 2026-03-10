-- Scoped agents: agents can be scoped to a specific workspace (not visible globally)
ALTER TABLE "agents" ADD COLUMN "scoped_to_workspace_id" uuid REFERENCES "project_workspaces"("id");
CREATE INDEX "agents_scoped_workspace_idx" ON "agents"("company_id", "scoped_to_workspace_id");

-- Issues can belong to a specific workspace (nullable, more specific than projectId)
ALTER TABLE "issues" ADD COLUMN "workspace_id" uuid REFERENCES "project_workspaces"("id");
CREATE INDEX "issues_workspace_idx" ON "issues"("company_id", "workspace_id");
