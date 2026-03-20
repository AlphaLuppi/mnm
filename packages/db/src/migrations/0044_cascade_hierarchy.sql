-- ONB-S02: Add invited_by column to company_memberships for cascade hierarchy tracking
ALTER TABLE "company_memberships" ADD COLUMN IF NOT EXISTS "invited_by" text;

-- Index for efficient cascade chain lookups
CREATE INDEX IF NOT EXISTS "company_memberships_invited_by_idx"
  ON "company_memberships" ("invited_by")
  WHERE "invited_by" IS NOT NULL;
