CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"severity" text DEFAULT 'info' NOT NULL,
	"prev_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"level" text NOT NULL,
	"target_id" uuid,
	"position" text DEFAULT 'assisted' NOT NULL,
	"ceiling" text DEFAULT 'auto' NOT NULL,
	"set_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"heartbeat_run_id" uuid,
	"name" text,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"sender_type" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "container_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"docker_container_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"exit_code" integer,
	"error" text,
	"resource_usage" jsonb,
	"started_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "container_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cpu_millicores" integer DEFAULT 1000 NOT NULL,
	"memory_mb" integer DEFAULT 512 NOT NULL,
	"disk_mb" integer DEFAULT 1024 NOT NULL,
	"timeout_seconds" integer DEFAULT 3600 NOT NULL,
	"gpu_enabled" boolean DEFAULT false NOT NULL,
	"mount_allowlist" jsonb DEFAULT '[]'::jsonb,
	"network_policy" text DEFAULT 'isolated' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credential_proxy_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"secret_pattern" text NOT NULL,
	"allowed_agent_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proxy_endpoint" text DEFAULT 'http://credential-proxy:8090' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"progress_total" integer DEFAULT 0 NOT NULL,
	"progress_done" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_by_user_id" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"role" text DEFAULT 'contributor' NOT NULL,
	"granted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sso_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"display_name" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_cursors" ADD CONSTRAINT "automation_cursors_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_instances" ADD CONSTRAINT "container_instances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_instances" ADD CONSTRAINT "container_instances_profile_id_container_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."container_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_instances" ADD CONSTRAINT "container_instances_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD CONSTRAINT "container_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_proxy_rules" ADD CONSTRAINT "credential_proxy_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_configurations" ADD CONSTRAINT "sso_configurations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_company_created_idx" ON "audit_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_company_actor_idx" ON "audit_events" USING btree ("company_id","actor_id","actor_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_company_action_idx" ON "audit_events" USING btree ("company_id","action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_company_target_idx" ON "audit_events" USING btree ("company_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_company_severity_idx" ON "audit_events" USING btree ("company_id","severity","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_cursors_company_level_target_unique_idx" ON "automation_cursors" USING btree ("company_id","level","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_cursors_company_level_idx" ON "automation_cursors" USING btree ("company_id","level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_channels_company_agent_idx" ON "chat_channels" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_channels_company_status_idx" ON "chat_channels" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_channels_heartbeat_run_idx" ON "chat_channels" USING btree ("heartbeat_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_channel_created_idx" ON "chat_messages" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_company_created_idx" ON "chat_messages" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_sender_idx" ON "chat_messages" USING btree ("sender_id","sender_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "container_instances_company_status_idx" ON "container_instances" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "container_instances_company_agent_idx" ON "container_instances" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "container_instances_docker_container_idx" ON "container_instances" USING btree ("docker_container_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "container_instances_profile_idx" ON "container_instances" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "container_profiles_company_name_unique_idx" ON "container_profiles" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "container_profiles_company_idx" ON "container_profiles" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credential_proxy_rules_company_name_unique_idx" ON "credential_proxy_rules" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credential_proxy_rules_company_enabled_idx" ON "credential_proxy_rules" USING btree ("company_id","enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credential_proxy_rules_company_pattern_idx" ON "credential_proxy_rules" USING btree ("company_id","secret_pattern");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_jobs_company_status_idx" ON "import_jobs" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_jobs_company_source_idx" ON "import_jobs" USING btree ("company_id","source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_jobs_company_created_idx" ON "import_jobs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_memberships_company_project_user_unique_idx" ON "project_memberships" USING btree ("company_id","project_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_memberships_company_user_idx" ON "project_memberships" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_memberships_company_project_idx" ON "project_memberships" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sso_configurations_company_provider_unique_idx" ON "sso_configurations" USING btree ("company_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sso_configurations_company_enabled_idx" ON "sso_configurations" USING btree ("company_id","enabled");