-- SECURITY-AUDIT-2026-04-29: Batch B — RLS hardening for 12 untenanted tables
-- Findings: SEC-T2-001, SEC-T2-002, SEC-T2-014
-- SEC-T2-007 (oauth_clients) → wontfix: intentional instance-global design (see finding)
--
-- Pattern (same as 0030_rls_policies.sql): ENABLE RLS + FORCE RLS + RESTRICTIVE tenant_isolation policy

-- =============================================================================
-- SEC-T2-001: 9 tables with company_id that were added after migration 0030
-- =============================================================================

-- 1. routines
ALTER TABLE "routines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "routines";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "routines" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 2. routine_triggers
ALTER TABLE "routine_triggers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routine_triggers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "routine_triggers";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "routine_triggers" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 3. routine_runs
ALTER TABLE "routine_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routine_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "routine_runs";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "routine_runs" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 4. feedback_votes
ALTER TABLE "feedback_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedback_votes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "feedback_votes";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "feedback_votes" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 5. folder_shares
ALTER TABLE "folder_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "folder_shares" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "folder_shares";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "folder_shares" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 6. view_presets
ALTER TABLE "view_presets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "view_presets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "view_presets";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "view_presets" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 7. user_widgets
ALTER TABLE "user_widgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_widgets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "user_widgets";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_widgets" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 8. inbox_items
ALTER TABLE "inbox_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inbox_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "inbox_items";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "inbox_items" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- 9. oauth_refresh_tokens
ALTER TABLE "oauth_refresh_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "oauth_refresh_tokens";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "oauth_refresh_tokens" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- =============================================================================
-- SEC-T2-002: Join tables agent_permissions and role_permissions — FK-chain RLS
-- No company_id column; filter via parent tables which already have RLS.
-- A direct SELECT on these tables without joining parent tables is now blocked.
-- =============================================================================

-- 10. agent_permissions (FK chain: agent_permissions.agent_id -> agents.id where agents has RLS on company_id)
ALTER TABLE "agent_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "agent_permissions";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "agent_permissions" AS RESTRICTIVE FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
  );--> statement-breakpoint

-- 11. role_permissions (FK chain: role_permissions.role_id -> roles.id where roles has RLS on company_id)
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "role_permissions";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "role_permissions" AS RESTRICTIVE FOR ALL
  USING (
    role_id IN (
      SELECT id FROM roles
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
  );--> statement-breakpoint

-- =============================================================================
-- SEC-T2-014: invites RLS policy — remove OR company_id IS NULL clause
-- No code path creates invites with NULL company_id; the nullable column is
-- a schema artefact from early development. Removing the OR clause eliminates
-- the global-invite visibility leak.
-- =============================================================================

DROP POLICY IF EXISTS "tenant_isolation" ON "invites";--> statement-breakpoint
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invites" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "invites";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "invites" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- =============================================================================
-- SEC-T2-007: oauth_clients — WONTFIX (instance-global by design)
-- oauth_clients is intentionally instance-scoped: one MCP client registration
-- is shared across all companies (Claude Desktop / MCP SDK). The consent flow
-- in mcp-consent.ts enforces company isolation at the token layer via company_id
-- in oauth_refresh_tokens (which now has RLS, see entry 9 above).
-- No company_id column is added; the table is correctly NOT tenant-scoped.
-- =============================================================================
