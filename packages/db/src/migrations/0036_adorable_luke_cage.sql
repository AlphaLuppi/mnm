ALTER TABLE "container_instances" ADD COLUMN "network_id" text;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN "credential_proxy_port" integer;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN "mounted_paths" jsonb;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN "health_check_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN "restart_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN "last_health_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN "labels" jsonb;--> statement-breakpoint
ALTER TABLE "container_instances" ADD COLUMN "log_stream_url" text;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN "docker_image" text;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN "max_containers" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN "credential_proxy_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN "allowed_mount_paths" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN "network_mode" text DEFAULT 'isolated' NOT NULL;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN "max_disk_iops" integer;--> statement-breakpoint
ALTER TABLE "container_profiles" ADD COLUMN "labels" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
CREATE INDEX "container_instances_health_idx" ON "container_instances" USING btree ("company_id","health_check_status");--> statement-breakpoint
CREATE INDEX "container_instances_restart_idx" ON "container_instances" USING btree ("company_id","restart_count");--> statement-breakpoint
CREATE INDEX "container_profiles_company_default_idx" ON "container_profiles" USING btree ("company_id","is_default");