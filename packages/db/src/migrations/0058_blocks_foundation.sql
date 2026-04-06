-- BLOCKS-PLATFORM: user_widgets table (F2) + issue_comments.content_blocks (F3)

-- ── F2: User dashboard widgets (AI-generated custom widgets) ──
CREATE TABLE IF NOT EXISTS "user_widgets" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"          UUID NOT NULL REFERENCES "companies"("id"),
  "user_id"             TEXT NOT NULL,
  "title"               TEXT NOT NULL,
  "description"         TEXT,
  "blocks"              JSONB NOT NULL,
  "data_source"         JSONB,
  "position"            INTEGER NOT NULL DEFAULT 0,
  "span"                INTEGER NOT NULL DEFAULT 2,
  "created_by_agent_id" UUID REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_user_widgets_company_user"
  ON "user_widgets"("company_id", "user_id");

-- ── F3: Content blocks on issue comments ──
ALTER TABLE "issue_comments"
  ADD COLUMN IF NOT EXISTS "content_blocks" JSONB;
