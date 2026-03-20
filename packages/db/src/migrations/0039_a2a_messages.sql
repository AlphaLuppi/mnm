-- A2A-S01: a2a_messages table — Agent-to-Agent communication bus
CREATE TABLE IF NOT EXISTS "a2a_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "chain_id" uuid NOT NULL,
  "sender_id" uuid NOT NULL REFERENCES "agents"("id"),
  "receiver_id" uuid NOT NULL REFERENCES "agents"("id"),
  "reply_to_id" uuid,
  "message_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "content" jsonb NOT NULL,
  "metadata" jsonb,
  "chain_depth" integer NOT NULL DEFAULT 0,
  "ttl_seconds" integer NOT NULL DEFAULT 300,
  "expires_at" timestamp with time zone NOT NULL,
  "responded_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "a2a_messages_company_idx" ON "a2a_messages" ("company_id");
CREATE INDEX IF NOT EXISTS "a2a_messages_sender_idx" ON "a2a_messages" ("company_id", "sender_id");
CREATE INDEX IF NOT EXISTS "a2a_messages_receiver_idx" ON "a2a_messages" ("company_id", "receiver_id");
CREATE INDEX IF NOT EXISTS "a2a_messages_chain_idx" ON "a2a_messages" ("chain_id");
CREATE INDEX IF NOT EXISTS "a2a_messages_status_idx" ON "a2a_messages" ("company_id", "status");
CREATE INDEX IF NOT EXISTS "a2a_messages_expires_idx" ON "a2a_messages" ("status", "expires_at");

-- RLS policy (same pattern as other tenant tables)
ALTER TABLE "a2a_messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "a2a_messages_tenant_isolation" ON "a2a_messages"
  USING ("company_id"::text = current_setting('app.current_company_id', true));
