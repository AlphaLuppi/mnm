-- CONFIG-LAYERS: MCP / Skills / Hooks / Settings layer system
-- ===============================================================
-- 1. NEW TABLES
-- ===============================================================

CREATE TABLE "config_layers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "description" text,
  "icon" text,
  "scope" text NOT NULL CHECK ("scope" IN ('company', 'shared', 'private')),
  "enforced" boolean NOT NULL DEFAULT false,
  "is_base_layer" boolean NOT NULL DEFAULT false,
  "created_by_user_id" text NOT NULL,
  "owner_type" text NOT NULL DEFAULT 'user' CHECK ("owner_type" IN ('user', 'system')),
  "visibility" text NOT NULL DEFAULT 'private' CHECK ("visibility" IN ('public', 'team', 'private')),
  "promotion_status" text CHECK ("promotion_status" IN ('proposed', 'approved', 'rejected')),
  "promotion_content_hash" text,
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CHECK ("enforced" = false OR "scope" = 'company'),
  CHECK (("scope" = 'private' AND "visibility" = 'private') OR ("scope" = 'shared' AND "visibility" IN ('team', 'public')) OR ("scope" = 'company' AND "visibility" = 'public')),
  CHECK ("is_base_layer" = false OR ("scope" = 'private' AND "visibility" = 'private'))
);--> statement-breakpoint
CREATE INDEX "config_layers_company_scope_idx" ON "config_layers"("company_id", "scope") WHERE "archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "config_layers_company_enforced_idx" ON "config_layers"("company_id") WHERE "enforced" = true AND "archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "config_layers_owner_idx" ON "config_layers"("company_id", "created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "config_layers_company_owner_name_uq" ON "config_layers"("company_id", "created_by_user_id", "name");--> statement-breakpoint
CREATE UNIQUE INDEX "config_layers_company_name_scope_uq" ON "config_layers"("company_id", "name") WHERE "scope" = 'company' AND "archived_at" IS NULL;--> statement-breakpoint

CREATE TABLE "config_layer_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "layer_id" uuid NOT NULL REFERENCES "config_layers"("id") ON DELETE CASCADE,
  "item_type" text NOT NULL CHECK ("item_type" IN ('mcp', 'skill', 'hook', 'setting')),
  "name" text NOT NULL,
  "display_name" text,
  "description" text,
  "config_json" jsonb NOT NULL,
  "source_type" text NOT NULL DEFAULT 'inline' CHECK ("source_type" IN ('inline', 'url', 'git')),
  "source_url" text,
  "source_content_hash" text,
  "source_fetched_at" timestamptz,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CHECK ("source_type" = 'inline' OR "source_url" IS NOT NULL),
  CHECK (octet_length("config_json"::text) <= 262144)
);--> statement-breakpoint
CREATE UNIQUE INDEX "config_layer_items_layer_name_uq" ON "config_layer_items"("layer_id", "item_type", "name");--> statement-breakpoint
CREATE INDEX "config_layer_items_layer_enabled_idx" ON "config_layer_items"("layer_id", "item_type", "name") WHERE "enabled" = true;--> statement-breakpoint

CREATE TABLE "config_layer_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "item_id" uuid NOT NULL REFERENCES "config_layer_items"("id") ON DELETE CASCADE,
  "path" text NOT NULL,
  "content" text NOT NULL,
  "content_hash" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CHECK ("path" !~ '^/' AND "path" !~ '\.\.' AND "path" ~ '^[a-zA-Z0-9_\-][a-zA-Z0-9_\-\/\.]*$'),
  CHECK (octet_length("content") <= 1048576)
);--> statement-breakpoint
CREATE UNIQUE INDEX "config_layer_files_item_path_uq" ON "config_layer_files"("item_id", "path");--> statement-breakpoint
CREATE INDEX "config_layer_files_item_idx" ON "config_layer_files"("item_id");--> statement-breakpoint

CREATE TABLE "config_layer_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "layer_id" uuid NOT NULL REFERENCES "config_layers"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "changed_keys" jsonb NOT NULL,
  "after_snapshot" jsonb NOT NULL,
  "changed_by" text NOT NULL,
  "change_source" text NOT NULL CHECK ("change_source" IN ('ui', 'api', 'import', 'promotion', 'system', 'migration')),
  "change_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "config_layer_revisions_layer_version_uq" ON "config_layer_revisions"("layer_id", "version");--> statement-breakpoint
CREATE INDEX "config_layer_revisions_layer_version_idx" ON "config_layer_revisions"("layer_id", "version" DESC);--> statement-breakpoint
CREATE INDEX "config_layer_revisions_layer_created_idx" ON "config_layer_revisions"("layer_id", "created_at" DESC);--> statement-breakpoint

-- ===============================================================
-- 2. JOIN TABLES
-- ===============================================================

CREATE TABLE "agent_config_layers" (
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "layer_id" uuid NOT NULL REFERENCES "config_layers"("id") ON DELETE CASCADE,
  "priority" integer NOT NULL DEFAULT 0 CHECK ("priority" >= 0 AND "priority" <= 498),
  "attached_by" text NOT NULL,
  "attached_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("agent_id", "layer_id")
);--> statement-breakpoint

CREATE TABLE "workflow_template_stage_layers" (
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "template_id" uuid NOT NULL REFERENCES "workflow_templates"("id") ON DELETE CASCADE,
  "stage_order" integer NOT NULL CHECK ("stage_order" >= 0),
  "layer_id" uuid NOT NULL REFERENCES "config_layers"("id") ON DELETE CASCADE,
  "priority" integer NOT NULL DEFAULT 0 CHECK ("priority" >= 0 AND "priority" <= 498),
  "attached_by" text NOT NULL,
  "attached_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("template_id", "stage_order", "layer_id")
);--> statement-breakpoint

CREATE TABLE "workflow_stage_config_layers" (
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "stage_instance_id" uuid NOT NULL REFERENCES "stage_instances"("id") ON DELETE CASCADE,
  "layer_id" uuid NOT NULL REFERENCES "config_layers"("id") ON DELETE CASCADE,
  "priority" integer NOT NULL DEFAULT 0 CHECK ("priority" >= 0 AND "priority" <= 498),
  "attached_by" text NOT NULL,
  "attached_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("stage_instance_id", "layer_id")
);--> statement-breakpoint

-- ===============================================================
-- 3. CREDENTIALS
-- ===============================================================

CREATE TABLE "user_mcp_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "item_id" uuid NOT NULL REFERENCES "config_layer_items"("id") ON DELETE CASCADE,
  "provider" text NOT NULL CHECK ("provider" IN ('oauth2', 'api_key', 'bearer', 'custom')),
  "material" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'connected', 'expired', 'revoked', 'error')),
  "status_message" text,
  "max_ttl_at" timestamptz,
  "connected_at" timestamptz,
  "expires_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "user_mcp_credentials_user_company_item_uq" ON "user_mcp_credentials"("user_id", "company_id", "item_id");--> statement-breakpoint
CREATE INDEX "user_mcp_credentials_user_company_idx" ON "user_mcp_credentials"("user_id", "company_id");--> statement-breakpoint
CREATE INDEX "user_mcp_credentials_expiring_idx" ON "user_mcp_credentials"("expires_at") WHERE "status" = 'connected' AND "expires_at" IS NOT NULL;--> statement-breakpoint

-- ===============================================================
-- 4. RLS ON ALL NEW TABLES
-- ===============================================================

ALTER TABLE "config_layers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "config_layers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "config_layers" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "config_layer_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "config_layer_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "config_layer_items" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "config_layer_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "config_layer_files" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "config_layer_files" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "config_layer_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "config_layer_revisions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "config_layer_revisions" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "agent_config_layers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_config_layers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "agent_config_layers" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "workflow_template_stage_layers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_template_stage_layers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_template_stage_layers" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "workflow_stage_config_layers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_stage_config_layers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_stage_config_layers" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "user_mcp_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_mcp_credentials" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_mcp_credentials" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint
