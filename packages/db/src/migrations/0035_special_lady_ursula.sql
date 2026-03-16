CREATE TABLE IF NOT EXISTS "drift_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"severity" text NOT NULL,
	"drift_type" text NOT NULL,
	"confidence" real NOT NULL,
	"description" text NOT NULL,
	"recommendation" text NOT NULL,
	"source_excerpt" text,
	"target_excerpt" text,
	"source_doc" text NOT NULL,
	"target_doc" text NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"remediation_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drift_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source_doc" text NOT NULL,
	"target_doc" text NOT NULL,
	"drift_count" integer DEFAULT 0 NOT NULL,
	"scan_scope" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN IF NOT EXISTS "enforcement_results" jsonb;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN IF NOT EXISTS "pre_prompts_injected" jsonb;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN IF NOT EXISTS "hitl_decision" jsonb;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD COLUMN IF NOT EXISTS "hitl_history" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "drift_items" ADD CONSTRAINT "drift_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drift_items" ADD CONSTRAINT "drift_items_report_id_drift_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."drift_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drift_reports" ADD CONSTRAINT "drift_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drift_reports" ADD CONSTRAINT "drift_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drift_items_report_idx" ON "drift_items" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drift_items_company_severity_idx" ON "drift_items" USING btree ("company_id","severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drift_items_company_decision_idx" ON "drift_items" USING btree ("company_id","decision");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drift_items_company_report_severity_idx" ON "drift_items" USING btree ("company_id","report_id","severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drift_reports_company_project_idx" ON "drift_reports" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drift_reports_company_checked_idx" ON "drift_reports" USING btree ("company_id","checked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drift_reports_project_status_idx" ON "drift_reports" USING btree ("company_id","project_id","status");