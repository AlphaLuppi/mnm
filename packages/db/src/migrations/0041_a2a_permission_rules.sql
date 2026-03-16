-- A2A-S02: a2a_permission_rules table + companies.a2a_default_policy column
-- Granular permission control for agent-to-agent communication

-- Add default policy column to companies
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "a2a_default_policy" text NOT NULL DEFAULT 'allow';

-- Create permission rules table
CREATE TABLE IF NOT EXISTS "a2a_permission_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "source_agent_id" uuid REFERENCES "agents"("id") ON DELETE CASCADE,
  "source_agent_role" text,
  "target_agent_id" uuid REFERENCES "agents"("id") ON DELETE CASCADE,
  "target_agent_role" text,
  "allowed" boolean NOT NULL DEFAULT true,
  "bidirectional" boolean NOT NULL DEFAULT false,
  "priority" integer NOT NULL DEFAULT 0,
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "a2a_perm_rules_company_idx" ON "a2a_permission_rules" ("company_id");
CREATE INDEX IF NOT EXISTS "a2a_perm_rules_source_role_idx" ON "a2a_permission_rules" ("company_id", "source_agent_role");
CREATE INDEX IF NOT EXISTS "a2a_perm_rules_target_role_idx" ON "a2a_permission_rules" ("company_id", "target_agent_role");
CREATE INDEX IF NOT EXISTS "a2a_perm_rules_priority_idx" ON "a2a_permission_rules" ("company_id", "priority");
