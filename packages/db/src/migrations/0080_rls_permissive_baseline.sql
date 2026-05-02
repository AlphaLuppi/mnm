-- NEW-S1: Repair the RLS default-deny across 73 tenant-scoped tables.
-- Discovered during Connectors Sprint 1 Phase 4 runtime testing
-- (server/src/__tests__/connector-tokens.rls.e2e.test.ts).
--
-- ─── The bug ─────────────────────────────────────────────────────────────────
-- Migration 0030 (and every subsequent RLS migration through 0079) created a
-- single RESTRICTIVE policy named "tenant_isolation" on each tenant-scoped
-- table. PostgreSQL RLS semantics require AT LEAST ONE PERMISSIVE policy for
-- a row to be visible — a RESTRICTIVE-only setup is default-deny and returns
-- zero rows for any role that respects RLS. The cluster has been hiding the
-- bug because the application user (`mnm` / `postgres`) is SUPERUSER and
-- BYPASSRLS, which short-circuits RLS entirely. In practice the multi-tenant
-- isolation has been carried 100% by the application-level Drizzle filters
-- (`eq(table.companyId, …)`); the "fail-closed last line of defense"
-- documented in middleware-chain.md and database.md has been a no-op.
--
-- ─── What this migration does ────────────────────────────────────────────────
-- For every tenant-scoped table that uses the RESTRICTIVE+FORCE pattern, we
-- add a second policy `tenant_baseline_permissive AS PERMISSIVE FOR ALL
-- USING (true)`. Combined with the existing RESTRICTIVE filter, the effective
-- predicate becomes `(true) AND (company_id = current_setting(...))` — the
-- baseline simply unblocks the default-deny; the tenant filter is unchanged.
-- Idempotent: each policy is preceded by `DROP POLICY IF EXISTS` so the
-- migration is safe to replay.
--
-- ─── What this migration DOES NOT do ─────────────────────────────────────────
-- It does NOT make RLS effective against the current application user, which
-- still has BYPASSRLS=true. Switching to a non-bypass user is an orthogonal
-- runbook (touches connection strings, migration runner permissions, embedded
-- pg dev mode) and is tracked separately.
--
-- ─── Tables NOT covered (9) ──────────────────────────────────────────────────
-- The following tables already have a PERMISSIVE policy that filters by
-- company_id directly. Adding a second PERMISSIVE `USING (true)` would
-- collapse the predicate to `true` and break tenant isolation. They are
-- intentionally skipped here and will be normalized to the RESTRICTIVE
-- pattern in a follow-up migration:
--   a2a_messages (0039), compaction_snapshots (0040),
--   traces, trace_observations, trace_lenses, trace_lens_results (0045),
--   gold_prompts (0047), user_pods, artifact_deployments (0048).
--
-- Sprint 1 Connectors tables (oauth_connectors, connector_tokens, user_api_keys,
-- oauth_connectors_audit, all from 0079) are also covered below.

-- ─── Group 1: 0030 baseline tables (37) ──────────────────────────────────────

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "agents";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "agents" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "agent_api_keys";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "agent_api_keys" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "agent_config_revisions";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "agent_config_revisions" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "agent_runtime_state";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "agent_runtime_state" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "agent_task_sessions";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "agent_task_sessions" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "agent_wakeup_requests";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "agent_wakeup_requests" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "activity_log";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "activity_log" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "approvals";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "approvals" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "approval_comments";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "approval_comments" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "company_memberships";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "company_memberships" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "company_secrets";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "company_secrets" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "cost_events";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "cost_events" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "goals";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "goals" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "heartbeat_runs";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "heartbeat_runs" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "heartbeat_run_events";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "heartbeat_run_events" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "invites";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "invites" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "issues";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "issues" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "issue_approvals";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "issue_approvals" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "issue_attachments";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "issue_attachments" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "issue_comments";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "issue_comments" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "issue_labels";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "issue_labels" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "issue_read_states";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "issue_read_states" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "join_requests";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "join_requests" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "labels";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "labels" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "projects";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "projects" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "project_workspaces";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "project_workspaces" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "project_goals";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "project_goals" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "project_memberships";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "project_memberships" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "automation_cursors";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "automation_cursors" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "chat_channels";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "chat_channels" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "chat_messages";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "chat_messages" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "container_profiles";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "container_profiles" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "container_instances";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "container_instances" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "credential_proxy_rules";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "credential_proxy_rules" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "audit_events";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "audit_events" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "sso_configurations";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "sso_configurations" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "import_jobs";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "import_jobs" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

-- ─── Group 2: 0049 RBAC tables (4) ───────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "permissions";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "permissions" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "roles";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "roles" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "tags";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "tags" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "tag_assignments";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "tag_assignments" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

-- ─── Group 3: 0052 config layers (6, post-0066-drops, post-0061-rename) ──────

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "config_layers";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "config_layers" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "config_layer_items";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "config_layer_items" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "config_layer_files";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "config_layer_files" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "config_layer_revisions";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "config_layer_revisions" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "agent_config_layers";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "agent_config_layers" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "user_credentials";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "user_credentials" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

-- ─── Group 4: 0055 collaborative chat (8) ────────────────────────────────────

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "documents";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "documents" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "document_chunks";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "document_chunks" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "artifacts";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "artifacts" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "artifact_versions";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "artifact_versions" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "folders";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "folders" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "folder_items";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "folder_items" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "chat_shares";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "chat_shares" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "chat_context_links";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "chat_context_links" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

-- ─── Group 5: 0065 governed workflows (4) ────────────────────────────────────

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "governed_workflow_definitions";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "governed_workflow_definitions" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "governed_workflow_runs";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "governed_workflow_runs" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "governed_step_executions";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "governed_step_executions" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "gate_results";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "gate_results" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

-- ─── Group 6: 0071 RLS hardening — additions only (11 net new) ───────────────
-- invites already covered in Group 1; agent_permissions and role_permissions
-- filter via FK chain (agent_id / role_id) in their existing RESTRICTIVE — the
-- PERMISSIVE baseline below only unblocks default-deny; the FK chain remains.

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "routines";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "routines" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "routine_triggers";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "routine_triggers" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "routine_runs";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "routine_runs" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "feedback_votes";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "feedback_votes" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "folder_shares";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "folder_shares" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "view_presets";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "view_presets" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "user_widgets";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "user_widgets" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "inbox_items";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "inbox_items" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "oauth_refresh_tokens";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "oauth_refresh_tokens" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "agent_permissions";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "agent_permissions" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "role_permissions";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "role_permissions" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

-- ─── Group 7: 0074 / 0075 / 0076 — recent additions (3) ──────────────────────

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "thread_interactions";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "thread_interactions" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "environments";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "environments" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "environment_leases";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "environment_leases" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

-- ─── Group 8: 0079 connectors platform (4) ───────────────────────────────────

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "oauth_connectors";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "oauth_connectors" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "connector_tokens";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "connector_tokens" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "user_api_keys";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "user_api_keys" AS PERMISSIVE FOR ALL USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "oauth_connectors_audit";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "oauth_connectors_audit" AS PERMISSIVE FOR ALL USING (true);
