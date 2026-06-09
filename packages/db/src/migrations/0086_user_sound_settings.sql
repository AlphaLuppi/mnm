CREATE TABLE IF NOT EXISTS "user_sound_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "volume" integer NOT NULL DEFAULT 70,
  "tones" jsonb NOT NULL DEFAULT '{"info":"none","success":"none","warn":"none","error":"none"}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_sound_settings_volume_range" CHECK ("volume" >= 0 AND "volume" <= 100)
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "user_sound_settings_company_user_uq"
  ON "user_sound_settings" ("company_id", "user_id");
--> statement-breakpoint

ALTER TABLE "user_sound_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_sound_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "user_sound_settings";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "user_sound_settings" AS PERMISSIVE FOR ALL
  USING (true);
--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation" ON "user_sound_settings";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_sound_settings" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint
