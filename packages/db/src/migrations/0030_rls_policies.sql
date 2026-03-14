-- TECH-05: Row-Level Security (RLS) for all 41 tenant-scoped tables
-- Each table gets:
--   1. ALTER TABLE ... ENABLE ROW LEVEL SECURITY
--   2. ALTER TABLE ... FORCE ROW LEVEL SECURITY
--   3. A RESTRICTIVE policy using app.current_company_id session variable

-- 1. agents
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "agents" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 2. agent_api_keys
ALTER TABLE "agent_api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_api_keys" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "agent_api_keys" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 3. agent_config_revisions
ALTER TABLE "agent_config_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_config_revisions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "agent_config_revisions" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 4. agent_runtime_state
ALTER TABLE "agent_runtime_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_runtime_state" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "agent_runtime_state" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 5. agent_task_sessions
ALTER TABLE "agent_task_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_task_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "agent_task_sessions" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 6. agent_wakeup_requests
ALTER TABLE "agent_wakeup_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "agent_wakeup_requests" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 7. activity_log
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activity_log" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "activity_log" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 8. approvals
ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approvals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "approvals" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 9. approval_comments
ALTER TABLE "approval_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approval_comments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "approval_comments" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 10. company_memberships
ALTER TABLE "company_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "company_memberships" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 11. company_secrets
ALTER TABLE "company_secrets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_secrets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "company_secrets" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 12. cost_events
ALTER TABLE "cost_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cost_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "cost_events" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 13. goals
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "goals" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 14. heartbeat_runs
ALTER TABLE "heartbeat_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "heartbeat_runs" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 15. heartbeat_run_events
ALTER TABLE "heartbeat_run_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "heartbeat_run_events" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 16. invites (NULLABLE company_id — special policy: allow NULL company_id rows)
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invites" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "invites" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid OR company_id IS NULL);--> statement-breakpoint

-- 17. issues
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "issues" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "issues" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 18. issue_approvals
ALTER TABLE "issue_approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "issue_approvals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "issue_approvals" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 19. issue_attachments
ALTER TABLE "issue_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "issue_attachments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "issue_attachments" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 20. issue_comments
ALTER TABLE "issue_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "issue_comments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "issue_comments" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 21. issue_labels
ALTER TABLE "issue_labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "issue_labels" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "issue_labels" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 22. issue_read_states
ALTER TABLE "issue_read_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "issue_read_states" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "issue_read_states" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 23. join_requests
ALTER TABLE "join_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "join_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "join_requests" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 24. labels
ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "labels" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "labels" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 25. principal_permission_grants
ALTER TABLE "principal_permission_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "principal_permission_grants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "principal_permission_grants" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 26. projects
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "projects" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 27. project_workspaces
ALTER TABLE "project_workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_workspaces" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "project_workspaces" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 28. project_goals
ALTER TABLE "project_goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_goals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "project_goals" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 29. workflow_templates
ALTER TABLE "workflow_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_templates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_templates" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 30. workflow_instances
ALTER TABLE "workflow_instances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_instances" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_instances" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 31. stage_instances
ALTER TABLE "stage_instances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stage_instances" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "stage_instances" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 32. project_memberships
ALTER TABLE "project_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "project_memberships" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 33. automation_cursors
ALTER TABLE "automation_cursors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "automation_cursors" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "automation_cursors" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 34. chat_channels
ALTER TABLE "chat_channels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_channels" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "chat_channels" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 35. chat_messages
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "chat_messages" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 36. container_profiles
ALTER TABLE "container_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "container_profiles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "container_profiles" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 37. container_instances
ALTER TABLE "container_instances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "container_instances" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "container_instances" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 38. credential_proxy_rules
ALTER TABLE "credential_proxy_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credential_proxy_rules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "credential_proxy_rules" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 39. audit_events
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "audit_events" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 40. sso_configurations
ALTER TABLE "sso_configurations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sso_configurations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sso_configurations" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 41. import_jobs
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "import_jobs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "import_jobs" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);
