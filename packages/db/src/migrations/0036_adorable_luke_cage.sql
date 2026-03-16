ALTER TABLE "container_instances" ADD COLUMN IF NOT EXISTS "network_id" text;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN IF NOT EXISTS "credential_proxy_port" integer;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN IF NOT EXISTS "mounted_paths" jsonb;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN IF NOT EXISTS "health_check_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN IF NOT EXISTS "restart_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN IF NOT EXISTS "last_health_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN IF NOT EXISTS "labels" jsonb;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN IF NOT EXISTS "log_stream_url" text;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN IF NOT EXISTS "docker_image" text;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN IF NOT EXISTS "max_containers" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN IF NOT EXISTS "credential_proxy_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN IF NOT EXISTS "allowed_mount_paths" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN IF NOT EXISTS "network_mode" text DEFAULT 'isolated' NOT NULL;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN IF NOT EXISTS "max_disk_iops" integer;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN IF NOT EXISTS "labels" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "container_instances_health_idx" ON "container_instances" USING btree ("company_id","health_check_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "container_instances_restart_idx" ON "container_instances" USING btree ("company_id","restart_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "container_profiles_company_default_idx" ON "container_profiles" USING btree ("company_id","is_default");