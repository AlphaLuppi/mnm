CREATE TABLE IF NOT EXISTS "inbox_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"item_key" text NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "scoped_to_workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inbox_dismissals" ADD CONSTRAINT "inbox_dismissals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_dismissals_company_user_idx" ON "inbox_dismissals" USING btree ("company_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbox_dismissals_unique_idx" ON "inbox_dismissals" USING btree ("company_id","user_id","item_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_scoped_workspace_idx" ON "agents" USING btree ("company_id","scoped_to_workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_workspace_idx" ON "issues" USING btree ("company_id","workspace_id");
