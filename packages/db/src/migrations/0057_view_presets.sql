-- VIEW-PRESETS: Persona-based dashboard & navigation
-- 1 new table + 2 columns. Zero breaking change.

CREATE TABLE IF NOT EXISTS "view_presets" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"  UUID NOT NULL REFERENCES "companies"("id"),
  "slug"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "icon"        TEXT,
  "color"       TEXT,
  "layout"      JSONB NOT NULL DEFAULT '{}',
  "is_default"  BOOLEAN NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("company_id", "slug")
);

-- Link roles → presets (M:1 — multiple roles can share a preset)
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "view_preset_id" UUID REFERENCES "view_presets"("id") ON DELETE SET NULL;

-- User overrides — sparse JSONB patches on existing company_memberships
ALTER TABLE "company_memberships" ADD COLUMN IF NOT EXISTS "layout_overrides" JSONB;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS "view_presets_company_idx" ON "view_presets"("company_id");
CREATE INDEX IF NOT EXISTS "view_presets_company_default_idx" ON "view_presets"("company_id") WHERE "is_default" = true;
