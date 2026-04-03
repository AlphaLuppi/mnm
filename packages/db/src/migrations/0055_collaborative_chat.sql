-- COLLABORATIVE CHAT: Documents, Artifacts, Folders, Shares, Context Links
-- ===============================================================
-- 0. EXTENSIONS
-- ===============================================================

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not available — RAG vector search disabled, chunk text fallback will be used';
END
$$;--> statement-breakpoint

-- ===============================================================
-- 1. NEW TABLES
-- ===============================================================

CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "asset_id" uuid REFERENCES "assets"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" integer,
  "page_count" integer,
  "token_count" integer,
  "ingestion_status" text NOT NULL DEFAULT 'pending',
  "ingestion_error" text,
  "summary" text,
  "extracted_text" text,
  "metadata" jsonb,
  "created_by_user_id" text,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "documents_company_created_idx" ON "documents"("company_id", "created_at");--> statement-breakpoint
CREATE INDEX "documents_company_status_idx" ON "documents"("company_id", "ingestion_status");--> statement-breakpoint
CREATE INDEX "documents_asset_idx" ON "documents"("asset_id");--> statement-breakpoint

CREATE TABLE "document_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "token_count" integer,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "document_chunks_document_idx" ON "document_chunks"("document_id", "chunk_index");--> statement-breakpoint
CREATE INDEX "document_chunks_company_idx" ON "document_chunks"("company_id");--> statement-breakpoint

-- Add vector column + HNSW index only if pgvector is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE "document_chunks" ADD COLUMN "embedding" vector(1536);
    CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
  ELSE
    ALTER TABLE "document_chunks" ADD COLUMN "embedding" text;
    RAISE NOTICE 'Using text column for embedding (pgvector not available)';
  END IF;
END
$$;--> statement-breakpoint

CREATE TABLE "artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "title" text NOT NULL,
  "artifact_type" text NOT NULL DEFAULT 'markdown',
  "language" text,
  "current_version_id" uuid,
  "source_channel_id" uuid REFERENCES "chat_channels"("id") ON DELETE SET NULL,
  "source_message_id" uuid REFERENCES "chat_messages"("id") ON DELETE SET NULL,
  "created_by_user_id" text,
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "artifacts_company_created_idx" ON "artifacts"("company_id", "created_at");--> statement-breakpoint
CREATE INDEX "artifacts_company_type_idx" ON "artifacts"("company_id", "artifact_type");--> statement-breakpoint
CREATE INDEX "artifacts_source_channel_idx" ON "artifacts"("source_channel_id");--> statement-breakpoint

CREATE TABLE "artifact_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "artifact_id" uuid NOT NULL REFERENCES "artifacts"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "content" text NOT NULL,
  "change_summary" text,
  "created_by_user_id" text,
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_versions_artifact_version_uq" ON "artifact_versions"("artifact_id", "version_number");--> statement-breakpoint
CREATE INDEX "artifact_versions_artifact_created_idx" ON "artifact_versions"("artifact_id", "created_at");--> statement-breakpoint

-- FK from artifacts.current_version_id -> artifact_versions(id)
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_current_version_fk" FOREIGN KEY ("current_version_id") REFERENCES "artifact_versions"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE TABLE "folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "description" text,
  "icon" text,
  "visibility" text NOT NULL DEFAULT 'private',
  "owner_user_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "folders_company_owner_idx" ON "folders"("company_id", "owner_user_id");--> statement-breakpoint
CREATE INDEX "folders_company_visibility_idx" ON "folders"("company_id", "visibility");--> statement-breakpoint

CREATE TABLE "folder_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "folder_id" uuid NOT NULL REFERENCES "folders"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "item_type" text NOT NULL,
  "artifact_id" uuid REFERENCES "artifacts"("id") ON DELETE CASCADE,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE CASCADE,
  "channel_id" uuid REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  "display_name" text,
  "added_by_user_id" text,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  CHECK (
    ("item_type" = 'artifact' AND "artifact_id" IS NOT NULL AND "document_id" IS NULL AND "channel_id" IS NULL) OR
    ("item_type" = 'document' AND "document_id" IS NOT NULL AND "artifact_id" IS NULL AND "channel_id" IS NULL) OR
    ("item_type" = 'channel' AND "channel_id" IS NOT NULL AND "artifact_id" IS NULL AND "document_id" IS NULL)
  )
);--> statement-breakpoint
CREATE INDEX "folder_items_folder_idx" ON "folder_items"("folder_id");--> statement-breakpoint
CREATE INDEX "folder_items_company_idx" ON "folder_items"("company_id");--> statement-breakpoint

CREATE TABLE "chat_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "channel_id" uuid NOT NULL REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  "shared_by_user_id" text NOT NULL,
  "share_token" text NOT NULL,
  "permission" text NOT NULL DEFAULT 'read',
  "expires_at" timestamptz,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "chat_shares_token_uq" ON "chat_shares"("share_token");--> statement-breakpoint
CREATE INDEX "chat_shares_channel_idx" ON "chat_shares"("channel_id");--> statement-breakpoint
CREATE INDEX "chat_shares_company_idx" ON "chat_shares"("company_id");--> statement-breakpoint

CREATE TABLE "chat_context_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" uuid NOT NULL REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "link_type" text NOT NULL,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE CASCADE,
  "artifact_id" uuid REFERENCES "artifacts"("id") ON DELETE CASCADE,
  "folder_id" uuid REFERENCES "folders"("id") ON DELETE CASCADE,
  "linked_channel_id" uuid REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  "added_by_user_id" text,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  CHECK (
    ("link_type" = 'document' AND "document_id" IS NOT NULL AND "artifact_id" IS NULL AND "folder_id" IS NULL AND "linked_channel_id" IS NULL) OR
    ("link_type" = 'artifact' AND "artifact_id" IS NOT NULL AND "document_id" IS NULL AND "folder_id" IS NULL AND "linked_channel_id" IS NULL) OR
    ("link_type" = 'folder' AND "folder_id" IS NOT NULL AND "document_id" IS NULL AND "artifact_id" IS NULL AND "linked_channel_id" IS NULL) OR
    ("link_type" = 'channel' AND "linked_channel_id" IS NOT NULL AND "document_id" IS NULL AND "artifact_id" IS NULL AND "folder_id" IS NULL)
  )
);--> statement-breakpoint
CREATE INDEX "chat_context_links_channel_idx" ON "chat_context_links"("channel_id");--> statement-breakpoint
CREATE INDEX "chat_context_links_company_idx" ON "chat_context_links"("company_id");--> statement-breakpoint

-- ===============================================================
-- 2. ALTER EXISTING TABLES
-- ===============================================================

ALTER TABLE "chat_channels" ADD COLUMN "folder_id" uuid REFERENCES "folders"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD COLUMN "forked_from_channel_id" uuid REFERENCES "chat_channels"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD COLUMN "fork_point_message_id" uuid REFERENCES "chat_messages"("id") ON DELETE SET NULL;--> statement-breakpoint

ALTER TABLE "chat_messages" ADD COLUMN "artifact_id" uuid REFERENCES "artifacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "document_id" uuid REFERENCES "documents"("id") ON DELETE SET NULL;--> statement-breakpoint

-- ===============================================================
-- 3. RLS ON ALL NEW TABLES
-- ===============================================================

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "documents" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_chunks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "document_chunks" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artifacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "artifacts" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "artifact_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artifact_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "artifact_versions" AS RESTRICTIVE FOR ALL USING (
  "artifact_id" IN (SELECT "id" FROM "artifacts" WHERE "company_id" = current_setting('app.current_company_id', true)::uuid)
);--> statement-breakpoint

ALTER TABLE "folders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "folders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "folders" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "folder_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "folder_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "folder_items" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "chat_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_shares" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "chat_shares" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "chat_context_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_context_links" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "chat_context_links" AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid);
