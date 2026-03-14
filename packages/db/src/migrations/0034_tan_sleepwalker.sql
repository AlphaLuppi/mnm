ALTER TABLE "chat_channels" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD COLUMN "last_message_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "message_type" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "reply_to_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "invitation_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN "machine_state" text DEFAULT 'created' NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN "max_retries" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN "last_actor_id" text;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN "last_actor_type" text;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN "feedback" text;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN "transition_history" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN "machine_context" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD COLUMN "workflow_state" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD COLUMN "terminated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD COLUMN "last_actor_id" text;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD COLUMN "last_actor_type" text;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_id_chat_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_channels_company_project_idx" ON "chat_channels" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "chat_channels_company_last_msg_idx" ON "chat_channels" USING btree ("company_id","last_message_at");--> statement-breakpoint
CREATE INDEX "chat_messages_reply_to_idx" ON "chat_messages" USING btree ("reply_to_id");--> statement-breakpoint
CREATE INDEX "stage_instances_machine_state_idx" ON "stage_instances" USING btree ("company_id","machine_state");--> statement-breakpoint
CREATE INDEX "workflow_instances_workflow_state_idx" ON "workflow_instances" USING btree ("company_id","workflow_state");