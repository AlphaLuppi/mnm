-- SECURITY-AUDIT-2026-04-29: SEC-T8-07 — agent_api_keys.expires_at
-- Agent API keys had no expiry, making them effectively permanent once issued.
-- Add expires_at column with a 90-day default from creation date.
-- Existing keys (NULL) are treated as expired-never for backwards compat:
--   the application layer enforces non-null going forward via createApiKey().

ALTER TABLE "agent_api_keys"
  ADD COLUMN "expires_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint

-- Back-fill existing keys: set their expiry to 90 days from their creation date
-- so they are not immediately invalidated but will naturally expire.
UPDATE "agent_api_keys"
  SET "expires_at" = created_at + INTERVAL '90 days'
  WHERE "expires_at" IS NULL;--> statement-breakpoint

-- Index to support efficient expiry sweeps / validation queries
CREATE INDEX IF NOT EXISTS "agent_api_keys_expires_at_idx"
  ON "agent_api_keys" ("expires_at")
  WHERE "expires_at" IS NOT NULL AND "revoked_at" IS NULL;--> statement-breakpoint
