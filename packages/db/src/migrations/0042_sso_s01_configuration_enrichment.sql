-- SSO-S01: Enrich sso_configurations table with SSO-specific columns
-- sso-s01-migration

-- Add SSO-specific columns
ALTER TABLE "sso_configurations" ADD COLUMN IF NOT EXISTS "email_domain" text;
ALTER TABLE "sso_configurations" ADD COLUMN IF NOT EXISTS "metadata_url" text;
ALTER TABLE "sso_configurations" ADD COLUMN IF NOT EXISTS "entity_id" text;
ALTER TABLE "sso_configurations" ADD COLUMN IF NOT EXISTS "certificate" text;
ALTER TABLE "sso_configurations" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'draft';
ALTER TABLE "sso_configurations" ADD COLUMN IF NOT EXISTS "last_sync_at" timestamp with time zone;
ALTER TABLE "sso_configurations" ADD COLUMN IF NOT EXISTS "last_sync_error" text;

-- Create index on email_domain for login flow lookups
CREATE INDEX IF NOT EXISTS "sso_configurations_email_domain_idx" ON "sso_configurations" ("email_domain");
