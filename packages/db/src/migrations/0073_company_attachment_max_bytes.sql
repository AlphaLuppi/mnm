-- v2026.428.0 — per-company attachment size cap (port of upstream PR #4700,
-- migration 0073_shiny_salo). Process-level env MNM_ATTACHMENT_MAX_BYTES
-- still wins as the final ceiling at upload time.

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "attachment_max_bytes" integer NOT NULL DEFAULT 10485760;
