ALTER TABLE "invites" ADD COLUMN "target_email" text;--> statement-breakpoint
CREATE INDEX "invites_company_email_pending_idx" ON "invites" USING btree ("company_id","target_email");