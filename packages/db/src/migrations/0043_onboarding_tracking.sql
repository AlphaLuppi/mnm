-- ONB-S01: Add onboarding tracking columns to companies table
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "onboarding_step" integer NOT NULL DEFAULT 0;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "onboarding_data" jsonb;
