ALTER TABLE "activity_log" ADD COLUMN IF NOT EXISTS "ip_address" text;--> statement-breakpoint
ALTER TABLE "activity_log" ADD COLUMN IF NOT EXISTS "user_agent" text;--> statement-breakpoint
ALTER TABLE "activity_log" ADD COLUMN IF NOT EXISTS "severity" text DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "container_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "isolation_mode" text DEFAULT 'process' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "sso_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "max_users" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "parent_company_id" uuid;--> statement-breakpoint
ALTER TABLE "company_memberships" ADD COLUMN IF NOT EXISTS "business_role" text DEFAULT 'contributor' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_container_profile_id_container_profiles_id_fk" FOREIGN KEY ("container_profile_id") REFERENCES "public"."container_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_company_id_companies_id_fk" FOREIGN KEY ("parent_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_log_company_severity_idx" ON "activity_log" USING btree ("company_id","severity");