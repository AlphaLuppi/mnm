-- BLOCKS-PLATFORM: inbox_items table (F4)

CREATE TABLE IF NOT EXISTS "inbox_items" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"        UUID NOT NULL REFERENCES "companies"("id"),
  "recipient_id"      TEXT NOT NULL,
  "sender_agent_id"   UUID REFERENCES "agents"("id") ON DELETE SET NULL,
  "sender_user_id"    TEXT,
  "title"             TEXT NOT NULL,
  "body"              TEXT,
  "content_blocks"    JSONB,
  "category"          TEXT NOT NULL DEFAULT 'notification',
  "priority"          TEXT NOT NULL DEFAULT 'normal',
  "status"            TEXT NOT NULL DEFAULT 'unread',
  "action_taken"      JSONB,
  "related_issue_id"  UUID REFERENCES "issues"("id") ON DELETE SET NULL,
  "related_agent_id"  UUID REFERENCES "agents"("id") ON DELETE SET NULL,
  "expires_at"        TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_inbox_items_recipient"
  ON "inbox_items"("company_id", "recipient_id", "status");
CREATE INDEX IF NOT EXISTS "idx_inbox_items_created"
  ON "inbox_items"("company_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_inbox_items_category"
  ON "inbox_items"("company_id", "recipient_id", "category");
