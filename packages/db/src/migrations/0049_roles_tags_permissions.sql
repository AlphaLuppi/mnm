-- ROLES+TAGS: Dynamic permissions and organizational tags
-- Sprint 1 — SCHEMA-01 through SCHEMA-05

-- ═══════════════════════════════════════════════════════════════
-- 1. NEW TABLES
-- ═══════════════════════════════════════════════════════════════

-- Permissions registry (dynamic, seeded at onboarding)
CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "slug" text NOT NULL,
  "description" text NOT NULL,
  "category" text NOT NULL,
  "is_custom" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_company_slug_idx" ON "permissions"("company_id", "slug");--> statement-breakpoint
CREATE INDEX "permissions_company_category_idx" ON "permissions"("company_id", "category");--> statement-breakpoint

-- Roles (custom, hierarchical, with tag filter bypass)
CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "hierarchy_level" integer NOT NULL DEFAULT 100,
  "inherits_from_id" uuid REFERENCES "roles"("id"),
  "bypass_tag_filter" boolean NOT NULL DEFAULT false,
  "is_system" boolean NOT NULL DEFAULT false,
  "color" text,
  "icon" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CHECK ("inherits_from_id" IS NULL OR "inherits_from_id" != "id")
);--> statement-breakpoint
CREATE UNIQUE INDEX "roles_company_slug_idx" ON "roles"("company_id", "slug");--> statement-breakpoint
CREATE INDEX "roles_company_level_idx" ON "roles"("company_id", "hierarchy_level");--> statement-breakpoint

-- Role↔Permission join table
CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("role_id", "permission_id")
);--> statement-breakpoint

-- Tags (organizational, no permissions)
CREATE TABLE "tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "color" text,
  "icon" text,
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "tags_company_slug_idx" ON "tags"("company_id", "slug");--> statement-breakpoint
CREATE INDEX "tags_archived_idx" ON "tags"("company_id", "archived_at");--> statement-breakpoint

-- Tag assignments (user↔tag, agent↔tag)
CREATE TABLE "tag_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id"),
  "assigned_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "tag_assignments_unique_idx" ON "tag_assignments"("company_id", "target_type", "target_id", "tag_id");--> statement-breakpoint
CREATE INDEX "tag_assignments_target_idx" ON "tag_assignments"("company_id", "target_type", "target_id");--> statement-breakpoint
CREATE INDEX "tag_assignments_tag_idx" ON "tag_assignments"("company_id", "tag_id");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════
-- 2. RLS on new tables
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "permissions" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "roles" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- role_permissions: no company_id column — RLS enforced via FK chain (role→company)
-- No RLS policy needed on join table

ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tags" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tags" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "tag_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tag_assignments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tag_assignments" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════
-- 3. MODIFY existing tables
-- ═══════════════════════════════════════════════════════════════

-- company_memberships: add role_id, drop business_role
ALTER TABLE "company_memberships" ADD COLUMN "role_id" uuid REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "company_memberships" DROP COLUMN IF EXISTS "business_role";--> statement-breakpoint

-- agents: drop role column, add created_by_user_id
ALTER TABLE "agents" DROP COLUMN IF EXISTS "role";--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint

-- issues: add assignee_tag_id
ALTER TABLE "issues" ADD COLUMN "assignee_tag_id" uuid REFERENCES "tags"("id");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════
-- 4. DROP legacy table
-- ═══════════════════════════════════════════════════════════════

-- Drop RLS policy first, then table
DROP POLICY IF EXISTS "tenant_isolation" ON "principal_permission_grants";--> statement-breakpoint
DROP TABLE IF EXISTS "principal_permission_grants";--> statement-breakpoint
