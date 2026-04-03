# Chat Collaboratif Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing 1-1 chat (user <-> agent) into a collaboration platform with document management, first-class artifacts, reusable Folders, and sharing/forking between team members.

**Architecture:** Extend existing `chat_channels` + `chat_messages` + WebSocket infra. Add 8 new DB tables (documents, document_chunks with pgvector, artifacts, artifact_versions, folders, folder_items, chat_shares, chat_context_links). ALTER 2 existing tables. BullMQ for async document ingestion. RAG via pgvector cosine similarity. Split-panel chat UI with artifact rendering.

**Tech Stack:** React 18, Express, PostgreSQL + pgvector, Drizzle ORM, BullMQ (via existing Redis), pdf-parse, TanStack Query, WebSocket (existing infra)

**Spec:** `docs/superpowers/specs/2026-04-03-collaborative-chat-design.md`

---

## File Structure

### New files to CREATE

**Database Schema (packages/db/src/schema/):**
- `documents.ts` — documents table
- `document_chunks.ts` — document_chunks table (pgvector)
- `artifacts.ts` — artifacts table
- `artifact_versions.ts` — artifact_versions table
- `folders.ts` — folders table
- `folder_items.ts` — folder_items table (polymorphic join)
- `chat_shares.ts` — chat_shares table
- `chat_context_links.ts` — chat_context_links table

**Migration:**
- `packages/db/src/migrations/0055_collaborative_chat.sql` — All new tables + ALTERs + pgvector

**Shared Types (packages/shared/src/):**
- `types/documents.ts` — Document types
- `types/artifacts.ts` — Artifact types
- `types/folders.ts` — Folder types
- `types/chat-sharing.ts` — Share + context link types
- `validators/documents.ts` — Zod schemas for document API
- `validators/artifacts.ts` — Zod schemas for artifact API
- `validators/folders.ts` — Zod schemas for folder API
- `validators/chat-sharing.ts` — Zod schemas for sharing API

**Server Services (server/src/services/):**
- `document.ts` — Document CRUD + ingestion orchestration
- `document-ingestion.ts` — BullMQ worker for extraction + chunking + embedding
- `rag.ts` — RAG retrieval (vector search + context injection)
- `artifact.ts` — Artifact CRUD + versioning
- `folder.ts` — Folder CRUD + item management + visibility
- `chat-sharing.ts` — Share links + fork
- `chat-context-link.ts` — Context link management

**Server Routes (server/src/routes/):**
- `documents.ts` — Document API routes
- `artifacts.ts` — Artifact API routes
- `folders.ts` — Folder API routes
- `chat-sharing.ts` — Share + fork routes
- `chat-context-links.ts` — Context link routes

**UI API (ui/src/api/):**
- `documents.ts` — Document API client
- `artifacts.ts` — Artifact API client
- `folders.ts` — Folder API client
- `chat-sharing.ts` — Sharing API client

**UI Components (ui/src/components/chat/):**
- `ArtifactPanel.tsx` — Right panel (1/3) for artifact display/edit
- `ArtifactRenderer.tsx` — Type-specific rendering (markdown, code, table)
- `ArtifactVersionHistory.tsx` — Version list with diff
- `DocumentDropZone.tsx` — Drag & drop file upload
- `DocumentStatusBadge.tsx` — Ingestion progress badge
- `DocumentModeSelector.tsx` — "Resume rapide" vs "Deep dive"
- `SlashCommandAutocomplete.tsx` — "/" command autocomplete popup
- `AgentMentionAutocomplete.tsx` — "@" mention autocomplete popup
- `ContextLinkBar.tsx` — Bar showing linked docs/artifacts/folders
- `ChatShareDialog.tsx` — Share dialog with read/fork options
- `ForkBanner.tsx` — Banner on forked chats

**UI Components (ui/src/components/folders/):**
- `FolderCard.tsx` — Folder card in grid/list
- `FolderItemList.tsx` — Items inside a folder
- `FolderPicker.tsx` — Folder selector modal
- `FolderAttachButton.tsx` — Button to attach folder to chat

**UI Pages (ui/src/pages/):**
- `Folders.tsx` — Folders list page
- `FolderDetail.tsx` — Single folder with items
- `SharedChat.tsx` — Read-only shared chat view

### Existing files to MODIFY

- `packages/db/src/schema/index.ts` — Add exports for 8 new tables
- `packages/db/src/schema/chat_channels.ts` — Add folder_id, forked_from_channel_id, fork_point_message_id
- `packages/db/src/schema/chat_messages.ts` — Add artifact_id, document_id
- `packages/shared/src/types/chat-ws.ts` — Add new WS message types
- `packages/shared/src/constants.ts` — Add new live event types
- `server/src/services/permission-seed.ts` — Add 13 new permissions
- `server/src/services/chat-ws-manager.ts` — Handle new message types
- `server/src/routes/chat.ts` — Mount sharing/context sub-routes
- `server/src/index.ts` — Mount new route modules
- `ui/src/lib/queryKeys.ts` — Add query key namespaces
- `ui/src/api/chat.ts` — Extend with new types
- `ui/src/pages/Chat.tsx` — Refactor to split-panel layout
- `ui/src/components/AgentChatPanel.tsx` — Add drop zone, context bar, autocomplete
- `ui/src/components/Sidebar.tsx` — Add Folders nav item
- `ui/src/App.tsx` — Add new routes

---

## Task 1: Database Schema — New Tables + Migration

**Files:**
- Create: `packages/db/src/schema/documents.ts`
- Create: `packages/db/src/schema/document_chunks.ts`
- Create: `packages/db/src/schema/artifacts.ts`
- Create: `packages/db/src/schema/artifact_versions.ts`
- Create: `packages/db/src/schema/folders.ts`
- Create: `packages/db/src/schema/folder_items.ts`
- Create: `packages/db/src/schema/chat_shares.ts`
- Create: `packages/db/src/schema/chat_context_links.ts`
- Modify: `packages/db/src/schema/chat_channels.ts`
- Modify: `packages/db/src/schema/chat_messages.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/migrations/0055_collaborative_chat.sql`

### Steps

- [ ] **Step 1: Create documents.ts schema**

```typescript
// packages/db/src/schema/documents.ts
import { pgTable, uuid, text, timestamp, integer, bigint, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { assets } from "./assets.js";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    assetId: uuid("asset_id").references(() => assets.id),
    title: text("title").notNull(),
    mimeType: text("mime_type"),
    byteSize: bigint("byte_size", { mode: "number" }),
    pageCount: integer("page_count"),
    tokenCount: integer("token_count"),
    ingestionStatus: text("ingestion_status").notNull().default("pending"),
    ingestionError: text("ingestion_error"),
    summary: text("summary"),
    extractedText: text("extracted_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdByUserId: text("created_by_user_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("documents_company_created_idx").on(table.companyId, table.createdAt),
    companyStatusIdx: index("documents_company_status_idx").on(table.companyId, table.ingestionStatus),
    createdByIdx: index("documents_created_by_idx").on(table.createdByUserId),
  }),
);
```

- [ ] **Step 2: Create document_chunks.ts schema**

```typescript
// packages/db/src/schema/document_chunks.ts
import { pgTable, uuid, text, timestamp, integer, jsonb, index, customType } from "drizzle-orm/pg-core";
import { documents } from "./documents.js";
import { companies } from "./companies.js";

// pgvector custom type
const vector = customType<{ data: number[]; dpiType: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]) {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown) {
    if (typeof value === "string") return JSON.parse(value);
    return value as number[];
  },
});

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    embedding: vector("embedding"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    docChunkIdx: index("document_chunks_doc_chunk_idx").on(table.documentId, table.chunkIndex),
    companyIdx: index("document_chunks_company_idx").on(table.companyId),
  }),
);
```

- [ ] **Step 3: Create artifacts.ts schema**

```typescript
// packages/db/src/schema/artifacts.ts
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatChannels } from "./chat_channels.js";
import { chatMessages } from "./chat_messages.js";
import { agents } from "./agents.js";

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    title: text("title").notNull(),
    artifactType: text("artifact_type").notNull().default("markdown"),
    language: text("language"),
    currentVersionId: uuid("current_version_id"), // FK added after artifact_versions table
    sourceChannelId: uuid("source_channel_id").references(() => chatChannels.id, { onDelete: "set null" }),
    sourceMessageId: uuid("source_message_id").references(() => chatMessages.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("artifacts_company_created_idx").on(table.companyId, table.createdAt),
    sourceChannelIdx: index("artifacts_source_channel_idx").on(table.sourceChannelId),
    createdByUserIdx: index("artifacts_created_by_user_idx").on(table.createdByUserId),
    createdByAgentIdx: index("artifacts_created_by_agent_idx").on(table.createdByAgentId),
  }),
);
```

- [ ] **Step 4: Create artifact_versions.ts schema**

```typescript
// packages/db/src/schema/artifact_versions.ts
import { pgTable, uuid, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { artifacts } from "./artifacts.js";
import { agents } from "./agents.js";

export const artifactVersions = pgTable(
  "artifact_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactId: uuid("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    content: text("content").notNull(),
    changeSummary: text("change_summary"),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    artifactVersionUq: uniqueIndex("artifact_versions_artifact_version_uq").on(table.artifactId, table.versionNumber),
  }),
);
```

- [ ] **Step 5: Create folders.ts schema**

```typescript
// packages/db/src/schema/folders.ts
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    visibility: text("visibility").notNull().default("private"),
    ownerUserId: text("owner_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOwnerIdx: index("folders_company_owner_idx").on(table.companyId, table.ownerUserId),
    companyVisibilityIdx: index("folders_company_visibility_idx").on(table.companyId, table.visibility),
  }),
);
```

- [ ] **Step 6: Create folder_items.ts schema**

```typescript
// packages/db/src/schema/folder_items.ts
import { pgTable, uuid, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { folders } from "./folders.js";
import { companies } from "./companies.js";
import { artifacts } from "./artifacts.js";
import { documents } from "./documents.js";
import { chatChannels } from "./chat_channels.js";
import { sql } from "drizzle-orm";

export const folderItems = pgTable(
  "folder_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    itemType: text("item_type").notNull(), // artifact | document | chat_link
    artifactId: uuid("artifact_id").references(() => artifacts.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => chatChannels.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    addedByUserId: text("added_by_user_id"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    folderTypeIdx: index("folder_items_folder_type_idx").on(table.folderId, table.itemType),
    artifactIdx: index("folder_items_artifact_idx").on(table.artifactId),
    documentIdx: index("folder_items_document_idx").on(table.documentId),
    channelIdx: index("folder_items_channel_idx").on(table.channelId),
    itemTypeCheck: check("folder_items_type_check", sql`
      (item_type = 'artifact' AND artifact_id IS NOT NULL AND document_id IS NULL AND channel_id IS NULL) OR
      (item_type = 'document' AND document_id IS NOT NULL AND artifact_id IS NULL AND channel_id IS NULL) OR
      (item_type = 'chat_link' AND channel_id IS NOT NULL AND artifact_id IS NULL AND document_id IS NULL)
    `),
  }),
);
```

- [ ] **Step 7: Create chat_shares.ts schema**

```typescript
// packages/db/src/schema/chat_shares.ts
import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatChannels } from "./chat_channels.js";

export const chatShares = pgTable(
  "chat_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    channelId: uuid("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
    sharedByUserId: text("shared_by_user_id").notNull(),
    shareToken: text("share_token").notNull(),
    permission: text("permission").notNull().default("read"), // read | fork
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenUq: uniqueIndex("chat_shares_token_uq").on(table.shareToken),
    channelIdx: index("chat_shares_channel_idx").on(table.channelId),
    companyUserIdx: index("chat_shares_company_user_idx").on(table.companyId, table.sharedByUserId),
  }),
);
```

- [ ] **Step 8: Create chat_context_links.ts schema**

```typescript
// packages/db/src/schema/chat_context_links.ts
import { pgTable, uuid, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatChannels } from "./chat_channels.js";
import { documents } from "./documents.js";
import { artifacts } from "./artifacts.js";
import { folders } from "./folders.js";
import { sql } from "drizzle-orm";

export const chatContextLinks = pgTable(
  "chat_context_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    linkType: text("link_type").notNull(), // document | artifact | folder | chat
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
    artifactId: uuid("artifact_id").references(() => artifacts.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "cascade" }),
    linkedChannelId: uuid("linked_channel_id").references(() => chatChannels.id, { onDelete: "cascade" }),
    addedByUserId: text("added_by_user_id").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelTypeIdx: index("chat_context_links_channel_type_idx").on(table.channelId, table.linkType),
    documentIdx: index("chat_context_links_document_idx").on(table.documentId),
    artifactIdx: index("chat_context_links_artifact_idx").on(table.artifactId),
    folderIdx: index("chat_context_links_folder_idx").on(table.folderId),
    linkTypeCheck: check("chat_context_links_type_check", sql`
      (link_type = 'document' AND document_id IS NOT NULL AND artifact_id IS NULL AND folder_id IS NULL AND linked_channel_id IS NULL) OR
      (link_type = 'artifact' AND artifact_id IS NOT NULL AND document_id IS NULL AND folder_id IS NULL AND linked_channel_id IS NULL) OR
      (link_type = 'folder' AND folder_id IS NOT NULL AND document_id IS NULL AND artifact_id IS NULL AND linked_channel_id IS NULL) OR
      (link_type = 'chat' AND linked_channel_id IS NOT NULL AND document_id IS NULL AND artifact_id IS NULL AND folder_id IS NULL)
    `),
  }),
);
```

- [ ] **Step 9: Modify chat_channels.ts — add 3 columns**

Add to the existing `chatChannels` table definition:

```typescript
// Add these columns to the existing chatChannels pgTable definition:
folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
forkedFromChannelId: uuid("forked_from_channel_id").references((): AnyPgColumn => chatChannels.id, { onDelete: "set null" }),
forkPointMessageId: uuid("fork_point_message_id").references(() => chatMessages.id, { onDelete: "set null" }),
```

Import `folders` from `"./folders.js"` and `chatMessages` from `"./chat_messages.js"`. Use `AnyPgColumn` for the self-reference.

- [ ] **Step 10: Modify chat_messages.ts — add 2 columns**

Add to the existing `chatMessages` pgTable definition:

```typescript
// Add these columns:
artifactId: uuid("artifact_id"), // FK added in SQL migration since artifacts table is new
documentId: uuid("document_id"), // FK added in SQL migration since documents table is new
```

- [ ] **Step 11: Update schema/index.ts — export new tables**

Add these exports after the existing chat exports:

```typescript
// Collaborative chat (Phase 1)
export { documents } from "./documents.js";
export { documentChunks } from "./document_chunks.js";
export { artifacts } from "./artifacts.js";
export { artifactVersions } from "./artifact_versions.js";
export { folders } from "./folders.js";
export { folderItems } from "./folder_items.js";
export { chatShares } from "./chat_shares.js";
export { chatContextLinks } from "./chat_context_links.js";
```

- [ ] **Step 12: Write SQL migration 0055_collaborative_chat.sql**

```sql
-- 0055_collaborative_chat.sql
-- Collaborative Chat: Documents, Artifacts, Folders, Sharing

-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

-- documents table
CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "asset_id" uuid REFERENCES "assets"("id"),
  "title" text NOT NULL,
  "mime_type" text,
  "byte_size" bigint,
  "page_count" integer,
  "token_count" integer,
  "ingestion_status" text NOT NULL DEFAULT 'pending',
  "ingestion_error" text,
  "summary" text,
  "extracted_text" text,
  "metadata" jsonb,
  "created_by_user_id" text,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "documents_company_created_idx" ON "documents"("company_id", "created_at");
CREATE INDEX "documents_company_status_idx" ON "documents"("company_id", "ingestion_status");
CREATE INDEX "documents_created_by_idx" ON "documents"("created_by_user_id");
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_rls" ON "documents" AS RESTRICTIVE FOR ALL USING ("company_id" = current_setting('app.company_id', true)::uuid);
--> statement-breakpoint

-- document_chunks table (pgvector)
CREATE TABLE "document_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "token_count" integer,
  "embedding" vector(1536),
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "document_chunks_doc_chunk_idx" ON "document_chunks"("document_id", "chunk_index");
CREATE INDEX "document_chunks_company_idx" ON "document_chunks"("company_id");
CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_chunks_rls" ON "document_chunks" AS RESTRICTIVE FOR ALL USING ("company_id" = current_setting('app.company_id', true)::uuid);
--> statement-breakpoint

-- artifacts table
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
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "artifacts_company_created_idx" ON "artifacts"("company_id", "created_at");
CREATE INDEX "artifacts_source_channel_idx" ON "artifacts"("source_channel_id");
CREATE INDEX "artifacts_created_by_user_idx" ON "artifacts"("created_by_user_id");
CREATE INDEX "artifacts_created_by_agent_idx" ON "artifacts"("created_by_agent_id");
ALTER TABLE "artifacts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "artifacts_rls" ON "artifacts" AS RESTRICTIVE FOR ALL USING ("company_id" = current_setting('app.company_id', true)::uuid);
--> statement-breakpoint

-- artifact_versions table
CREATE TABLE "artifact_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "artifact_id" uuid NOT NULL REFERENCES "artifacts"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "content" text NOT NULL,
  "change_summary" text,
  "created_by_user_id" text,
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "artifact_versions_artifact_version_uq" ON "artifact_versions"("artifact_id", "version_number");
--> statement-breakpoint

-- Add FK from artifacts.current_version_id to artifact_versions
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_current_version_fk" FOREIGN KEY ("current_version_id") REFERENCES "artifact_versions"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- folders table
CREATE TABLE "folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "description" text,
  "icon" text,
  "visibility" text NOT NULL DEFAULT 'private',
  "owner_user_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "folders_company_owner_idx" ON "folders"("company_id", "owner_user_id");
CREATE INDEX "folders_company_visibility_idx" ON "folders"("company_id", "visibility");
ALTER TABLE "folders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folders_rls" ON "folders" AS RESTRICTIVE FOR ALL USING ("company_id" = current_setting('app.company_id', true)::uuid);
--> statement-breakpoint

-- folder_items table
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
  "added_at" timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (
    (item_type = 'artifact' AND artifact_id IS NOT NULL AND document_id IS NULL AND channel_id IS NULL) OR
    (item_type = 'document' AND document_id IS NOT NULL AND artifact_id IS NULL AND channel_id IS NULL) OR
    (item_type = 'chat_link' AND channel_id IS NOT NULL AND artifact_id IS NULL AND document_id IS NULL)
  )
);
CREATE INDEX "folder_items_folder_type_idx" ON "folder_items"("folder_id", "item_type");
CREATE INDEX "folder_items_artifact_idx" ON "folder_items"("artifact_id");
CREATE INDEX "folder_items_document_idx" ON "folder_items"("document_id");
CREATE INDEX "folder_items_channel_idx" ON "folder_items"("channel_id");
ALTER TABLE "folder_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folder_items_rls" ON "folder_items" AS RESTRICTIVE FOR ALL USING ("company_id" = current_setting('app.company_id', true)::uuid);
--> statement-breakpoint

-- chat_shares table
CREATE TABLE "chat_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "channel_id" uuid NOT NULL REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  "shared_by_user_id" text NOT NULL,
  "share_token" text NOT NULL,
  "permission" text NOT NULL DEFAULT 'read',
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "chat_shares_token_uq" ON "chat_shares"("share_token");
CREATE INDEX "chat_shares_channel_idx" ON "chat_shares"("channel_id");
CREATE INDEX "chat_shares_company_user_idx" ON "chat_shares"("company_id", "shared_by_user_id");
ALTER TABLE "chat_shares" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_shares_rls" ON "chat_shares" AS RESTRICTIVE FOR ALL USING ("company_id" = current_setting('app.company_id', true)::uuid);
--> statement-breakpoint

-- chat_context_links table
CREATE TABLE "chat_context_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" uuid NOT NULL REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "link_type" text NOT NULL,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE CASCADE,
  "artifact_id" uuid REFERENCES "artifacts"("id") ON DELETE CASCADE,
  "folder_id" uuid REFERENCES "folders"("id") ON DELETE CASCADE,
  "linked_channel_id" uuid REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  "added_by_user_id" text NOT NULL,
  "added_at" timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (
    (link_type = 'document' AND document_id IS NOT NULL AND artifact_id IS NULL AND folder_id IS NULL AND linked_channel_id IS NULL) OR
    (link_type = 'artifact' AND artifact_id IS NOT NULL AND document_id IS NULL AND folder_id IS NULL AND linked_channel_id IS NULL) OR
    (link_type = 'folder' AND folder_id IS NOT NULL AND document_id IS NULL AND artifact_id IS NULL AND linked_channel_id IS NULL) OR
    (link_type = 'chat' AND linked_channel_id IS NOT NULL AND document_id IS NULL AND artifact_id IS NULL AND folder_id IS NULL)
  )
);
CREATE INDEX "chat_context_links_channel_type_idx" ON "chat_context_links"("channel_id", "link_type");
CREATE INDEX "chat_context_links_document_idx" ON "chat_context_links"("document_id");
CREATE INDEX "chat_context_links_artifact_idx" ON "chat_context_links"("artifact_id");
CREATE INDEX "chat_context_links_folder_idx" ON "chat_context_links"("folder_id");
ALTER TABLE "chat_context_links" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_context_links_rls" ON "chat_context_links" AS RESTRICTIVE FOR ALL USING ("company_id" = current_setting('app.company_id', true)::uuid);
--> statement-breakpoint

-- ALTER chat_channels: add folder_id, forked_from, fork_point
ALTER TABLE "chat_channels" ADD COLUMN "folder_id" uuid REFERENCES "folders"("id") ON DELETE SET NULL;
ALTER TABLE "chat_channels" ADD COLUMN "forked_from_channel_id" uuid REFERENCES "chat_channels"("id") ON DELETE SET NULL;
ALTER TABLE "chat_channels" ADD COLUMN "fork_point_message_id" uuid REFERENCES "chat_messages"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- ALTER chat_messages: add artifact_id, document_id
ALTER TABLE "chat_messages" ADD COLUMN "artifact_id" uuid REFERENCES "artifacts"("id") ON DELETE SET NULL;
ALTER TABLE "chat_messages" ADD COLUMN "document_id" uuid REFERENCES "documents"("id") ON DELETE SET NULL;
```

- [ ] **Step 13: Commit**

```bash
git add packages/db/src/schema/documents.ts packages/db/src/schema/document_chunks.ts packages/db/src/schema/artifacts.ts packages/db/src/schema/artifact_versions.ts packages/db/src/schema/folders.ts packages/db/src/schema/folder_items.ts packages/db/src/schema/chat_shares.ts packages/db/src/schema/chat_context_links.ts packages/db/src/schema/chat_channels.ts packages/db/src/schema/chat_messages.ts packages/db/src/schema/index.ts packages/db/src/migrations/0055_collaborative_chat.sql
git commit -m "feat(db): add 8 tables for collaborative chat — documents, artifacts, folders, sharing"
```

---

## Task 2: Shared Types + Validators

**Files:**
- Create: `packages/shared/src/types/documents.ts`
- Create: `packages/shared/src/types/artifacts.ts`
- Create: `packages/shared/src/types/folders.ts`
- Create: `packages/shared/src/types/chat-sharing.ts`
- Create: `packages/shared/src/validators/documents.ts`
- Create: `packages/shared/src/validators/artifacts.ts`
- Create: `packages/shared/src/validators/folders.ts`
- Create: `packages/shared/src/validators/chat-sharing.ts`
- Modify: `packages/shared/src/types/chat-ws.ts`
- Modify: `packages/shared/src/constants.ts`

### Steps

- [ ] **Step 1: Create documents types + validators**

```typescript
// packages/shared/src/types/documents.ts
export type IngestionStatus = "pending" | "extracting" | "chunking" | "ready" | "error";
export type DocumentMode = "summary" | "deep_dive";

export interface Document {
  id: string;
  companyId: string;
  assetId: string | null;
  title: string;
  mimeType: string | null;
  byteSize: number | null;
  pageCount: number | null;
  tokenCount: number | null;
  ingestionStatus: IngestionStatus;
  ingestionError: string | null;
  summary: string | null;
  extractedText: string | null;
  metadata: Record<string, unknown> | null;
  createdByUserId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  metadata: Record<string, unknown> | null;
}
```

```typescript
// packages/shared/src/validators/documents.ts
import { z } from "zod";

export const uploadDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  channelId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
});

export const summarizeDocumentSchema = z.object({
  mode: z.enum(["summary", "deep_dive"]).default("summary"),
});

export type UploadDocument = z.infer<typeof uploadDocumentSchema>;
export type SummarizeDocument = z.infer<typeof summarizeDocumentSchema>;
```

- [ ] **Step 2: Create artifacts types + validators**

```typescript
// packages/shared/src/types/artifacts.ts
export type ArtifactType = "markdown" | "code" | "table" | "diagram" | "image" | "structured";

export interface Artifact {
  id: string;
  companyId: string;
  title: string;
  artifactType: ArtifactType;
  language: string | null;
  currentVersionId: string | null;
  sourceChannelId: string | null;
  sourceMessageId: string | null;
  createdByUserId: string | null;
  createdByAgentId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  currentVersion?: ArtifactVersion;
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  versionNumber: number;
  content: string;
  changeSummary: string | null;
  createdByUserId: string | null;
  createdByAgentId: string | null;
  createdAt: string;
}
```

```typescript
// packages/shared/src/validators/artifacts.ts
import { z } from "zod";

export const ARTIFACT_TYPES = ["markdown", "code", "table", "diagram", "image", "structured"] as const;

export const createArtifactSchema = z.object({
  title: z.string().min(1).max(255),
  artifactType: z.enum(ARTIFACT_TYPES).default("markdown"),
  language: z.string().max(50).optional().nullable(),
  content: z.string().min(1),
  sourceChannelId: z.string().uuid().optional().nullable(),
  sourceMessageId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateArtifactSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  changeSummary: z.string().max(500).optional(),
});

export type CreateArtifact = z.infer<typeof createArtifactSchema>;
export type UpdateArtifact = z.infer<typeof updateArtifactSchema>;
```

- [ ] **Step 3: Create folders types + validators**

```typescript
// packages/shared/src/types/folders.ts
export type FolderVisibility = "private" | "shared";
export type FolderItemType = "artifact" | "document" | "chat_link";

export interface Folder {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  icon: string | null;
  visibility: FolderVisibility;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  itemCount?: number;
}

export interface FolderItem {
  id: string;
  folderId: string;
  itemType: FolderItemType;
  artifactId: string | null;
  documentId: string | null;
  channelId: string | null;
  displayName: string | null;
  addedByUserId: string | null;
  addedAt: string;
  // Joined entity
  artifact?: import("./artifacts").Artifact;
  document?: import("./documents").Document;
}
```

```typescript
// packages/shared/src/validators/folders.ts
import { z } from "zod";

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  visibility: z.enum(["private", "shared"]).default("private"),
});

export const updateFolderSchema = createFolderSchema.partial();

export const addFolderItemSchema = z.object({
  itemType: z.enum(["artifact", "document", "chat_link"]),
  artifactId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  displayName: z.string().max(255).optional(),
});

export type CreateFolder = z.infer<typeof createFolderSchema>;
export type UpdateFolder = z.infer<typeof updateFolderSchema>;
export type AddFolderItem = z.infer<typeof addFolderItemSchema>;
```

- [ ] **Step 4: Create chat-sharing types + validators**

```typescript
// packages/shared/src/types/chat-sharing.ts
export type SharePermission = "read" | "fork";
export type ContextLinkType = "document" | "artifact" | "folder" | "chat";

export interface ChatShare {
  id: string;
  companyId: string;
  channelId: string;
  sharedByUserId: string;
  shareToken: string;
  permission: SharePermission;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ChatContextLink {
  id: string;
  channelId: string;
  linkType: ContextLinkType;
  documentId: string | null;
  artifactId: string | null;
  folderId: string | null;
  linkedChannelId: string | null;
  addedByUserId: string;
  addedAt: string;
  // Joined
  document?: import("./documents").Document;
  artifact?: import("./artifacts").Artifact;
  folder?: import("./folders").Folder;
}
```

```typescript
// packages/shared/src/validators/chat-sharing.ts
import { z } from "zod";

export const createShareSchema = z.object({
  permission: z.enum(["read", "fork"]).default("read"),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const addContextLinkSchema = z.object({
  linkType: z.enum(["document", "artifact", "folder", "chat"]),
  documentId: z.string().uuid().optional(),
  artifactId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
  linkedChannelId: z.string().uuid().optional(),
});

export type CreateShare = z.infer<typeof createShareSchema>;
export type AddContextLink = z.infer<typeof addContextLinkSchema>;
```

- [ ] **Step 5: Extend chat-ws.ts — add new WS message types**

Add to `ChatClientPayload` union:

```typescript
export interface ChatClientSlashCommand {
  type: "slash_command";
  command: string;
  args?: string;
}
export interface ChatClientMentionAgent {
  type: "mention_agent";
  agentName: string;
  message: string;
}
export interface ChatClientUploadComplete {
  type: "upload_complete";
  documentId: string;
}
```

Add to `ChatServerPayload` union:

```typescript
export interface ChatServerArtifactCreated {
  type: "artifact_created";
  artifactId: string;
  title: string;
  artifactType: string;
}
export interface ChatServerArtifactUpdated {
  type: "artifact_updated";
  artifactId: string;
  versionNumber: number;
}
export interface ChatServerDocumentStatus {
  type: "document_status";
  documentId: string;
  status: string;
  error?: string;
}
export interface ChatServerAgentDelegating {
  type: "agent_delegating";
  fromAgent: string;
  toAgent: string;
  task: string;
}
export interface ChatServerContextAdded {
  type: "context_added";
  linkType: string;
  itemId: string;
}
export interface ChatServerCommandResult {
  type: "command_result";
  command: string;
  success: boolean;
  error?: string;
}
```

Add `"artifact_reference" | "document_upload" | "skill_invocation" | "agent_delegation"` to `ChatMessageType`.

- [ ] **Step 6: Add live event types to constants.ts**

Add these event types to the existing `LIVE_EVENT_TYPES` array:

```typescript
"document.uploaded",
"document.ingestion_complete",
"document.ingestion_error",
"artifact.created",
"artifact.updated",
"artifact.deleted",
"folder.created",
"folder.updated",
"folder.deleted",
"chat.shared",
"chat.forked",
"chat.context_linked",
```

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/types/documents.ts packages/shared/src/types/artifacts.ts packages/shared/src/types/folders.ts packages/shared/src/types/chat-sharing.ts packages/shared/src/validators/documents.ts packages/shared/src/validators/artifacts.ts packages/shared/src/validators/folders.ts packages/shared/src/validators/chat-sharing.ts packages/shared/src/types/chat-ws.ts packages/shared/src/constants.ts
git commit -m "feat(shared): add types and validators for collaborative chat entities"
```

---

## Task 3: Permission Seed — 13 New Permissions

**Files:**
- Modify: `server/src/services/permission-seed.ts`

### Steps

- [ ] **Step 1: Add 13 new permissions to SEED_PERMISSIONS**

Add these entries to the existing `SEED_PERMISSIONS` array in `permission-seed.ts`:

```typescript
// Chat collaboration
{ slug: "chat:share", description: "Partager un chat" },
{ slug: "chat:fork", description: "Fork un chat partagé" },
// Documents
{ slug: "documents:upload", description: "Upload des documents" },
{ slug: "documents:read", description: "Voir les documents" },
{ slug: "documents:delete", description: "Supprimer des documents" },
// Artifacts
{ slug: "artifacts:read", description: "Voir les artefacts" },
{ slug: "artifacts:edit", description: "Éditer des artefacts" },
{ slug: "artifacts:delete", description: "Supprimer des artefacts" },
// Folders
{ slug: "folders:create", description: "Créer des folders" },
{ slug: "folders:read", description: "Voir les folders" },
{ slug: "folders:edit", description: "Modifier ses folders" },
{ slug: "folders:delete", description: "Supprimer ses folders" },
{ slug: "folders:share", description: "Partager des folders" },
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/permission-seed.ts
git commit -m "feat(permissions): add 13 permissions for chat collaboration, documents, artifacts, folders"
```

---

## Task 4: Document Service + Routes

**Files:**
- Create: `server/src/services/document.ts`
- Create: `server/src/services/document-ingestion.ts`
- Create: `server/src/services/rag.ts`
- Create: `server/src/routes/documents.ts`
- Modify: `server/src/index.ts` — mount document routes

### Steps

- [ ] **Step 1: Create document service**

`server/src/services/document.ts` — Factory pattern matching existing services (`documentService(db)`). Methods:

- `create(companyId, assetId, { title, mimeType, byteSize, createdByUserId })` → Document
- `getById(companyId, documentId)` → Document | null
- `list(companyId, opts?: { createdByUserId?, status?, limit?, offset? })` → { documents, total }
- `softDelete(companyId, documentId)` → Document
- `updateIngestionStatus(documentId, status, opts?: { error?, tokenCount?, pageCount?, summary?, extractedText? })` → Document

Each method uses Drizzle ORM queries with `db.select()`, `db.insert()`, `db.update()`. Follow the pattern from `server/src/services/chat.ts`. Publish live events on create/delete.

- [ ] **Step 2: Create document ingestion worker**

`server/src/services/document-ingestion.ts` — BullMQ worker using existing Redis connection. Pattern:

```typescript
import { Queue, Worker } from "bullmq";
import type { Db } from "@mnm/db";

export function createIngestionQueue(redisConnection: any) {
  return new Queue("document-ingestion", { connection: redisConnection });
}

export function createIngestionWorker(db: Db, redisConnection: any, opts: { embeddingFn: (text: string) => Promise<number[]> }) {
  return new Worker("document-ingestion", async (job) => {
    const { documentId, companyId } = job.data;
    // 1. Update status to "extracting"
    // 2. Fetch asset, extract text based on mime_type
    //    - application/pdf → pdf-parse
    //    - text/*, json, yaml → direct read
    //    - Other → skip extraction
    // 3. Estimate token_count
    // 4. If token_count > 100_000 → chunk + embed
    //    - Semantic chunking (by headings/paragraphs, fallback sliding window 1000 tokens, overlap 200)
    //    - Embed each chunk via opts.embeddingFn
    //    - INSERT document_chunks
    // 5. If token_count <= 100_000 → store extracted_text on document
    // 6. Update status to "ready"
    // 7. Broadcast WS notification via live-events
  }, { connection: redisConnection, concurrency: 3 });
}
```

For Phase 1, implement PDF + text extraction. Image OCR and XLSX can be stubs that skip extraction.

- [ ] **Step 3: Create RAG retrieval service**

`server/src/services/rag.ts`:

```typescript
export function ragService(db: Db) {
  return {
    async searchChunks(companyId: string, documentIds: string[], queryEmbedding: number[], opts?: { topK?: number; threshold?: number; maxTokens?: number }) {
      // SELECT id, content, token_count, metadata,
      //   1 - (embedding <=> $queryEmbedding) as similarity
      // FROM document_chunks
      // WHERE document_id = ANY($documentIds) AND company_id = $companyId
      // ORDER BY embedding <=> $queryEmbedding
      // LIMIT $topK
      // Filter by threshold
      // Accumulate until maxTokens reached
    },

    async buildContextFromLinks(companyId: string, channelId: string, queryText: string, embeddingFn: (text: string) => Promise<number[]>) {
      // 1. Get all chat_context_links for this channel
      // 2. For documents with chunks → RAG search
      // 3. For small documents → include extracted_text
      // 4. For artifacts → include current version content
      // 5. For folders → include all items' content (recursively)
      // 6. Return assembled context string
    },
  };
}
```

Use raw SQL via `db.execute(sql`...`)` for the pgvector cosine distance operator `<=>`.

- [ ] **Step 4: Create document routes**

`server/src/routes/documents.ts`:

```typescript
import { Router } from "express";
import multer from "multer";
import type { Db } from "@mnm/db";

export function documentRoutes(db: Db): Router {
  const router = Router({ mergeParams: true });
  const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

  // POST /api/companies/:companyId/documents/upload
  // - Permission: documents:upload
  // - Multipart file upload
  // - Create asset via existing asset service
  // - Create document record
  // - Enqueue ingestion job
  // - Return document with status "pending"

  // GET /api/companies/:companyId/documents
  // - Permission: documents:read
  // - Query: status?, limit?, offset?
  // - Filter out deletedAt IS NOT NULL

  // GET /api/companies/:companyId/documents/:id
  // - Permission: documents:read

  // GET /api/companies/:companyId/documents/:id/content
  // - Permission: documents:read
  // - Proxy to asset storage (download)

  // DELETE /api/companies/:companyId/documents/:id
  // - Permission: documents:delete
  // - Soft delete (set deletedAt)

  // POST /api/companies/:companyId/documents/:id/summarize
  // - Permission: documents:read
  // - Trigger summarization via LLM

  // GET /api/companies/:companyId/documents/:id/chunks
  // - Permission: documents:read
  // - Debug endpoint: list chunks

  return router;
}
```

Follow the exact pattern from `server/src/routes/chat.ts` for middleware, permission checks, error handling.

- [ ] **Step 5: Mount routes in server/src/index.ts**

Add `app.use(documentRoutes(db))` alongside existing route mounts. Follow the same pattern as `chatRoutes(db)`.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/document.ts server/src/services/document-ingestion.ts server/src/services/rag.ts server/src/routes/documents.ts server/src/index.ts
git commit -m "feat(documents): add document service, ingestion pipeline, RAG, and routes"
```

---

## Task 5: Artifact Service + Routes

**Files:**
- Create: `server/src/services/artifact.ts`
- Create: `server/src/routes/artifacts.ts`
- Modify: `server/src/index.ts` — mount artifact routes

### Steps

- [ ] **Step 1: Create artifact service**

`server/src/services/artifact.ts` — Factory `artifactService(db)`. Methods:

- `create(companyId, input: CreateArtifact, creatorInfo: { userId?: string; agentId?: string })` → Artifact
  - Creates artifact row + first artifact_version (version_number=1)
  - Sets current_version_id
  - Returns artifact with currentVersion joined
- `getById(companyId, artifactId)` → Artifact with currentVersion | null
- `list(companyId, opts?: { channelId?, folderId?, artifactType?, createdByUserId?, limit?, offset? })` → { artifacts, total }
- `update(companyId, artifactId, input: UpdateArtifact, creatorInfo)` → Artifact
  - Creates new artifact_version with incremented version_number
  - Updates current_version_id on artifact
- `delete(companyId, artifactId)` → void
- `getVersions(companyId, artifactId, opts?: { limit?, offset? })` → ArtifactVersion[]
- `getVersion(companyId, artifactId, versionId)` → ArtifactVersion | null
- `detectType(content: string)` → ArtifactType
  - Contains ``` → "code"
  - Contains markdown headers → "markdown"
  - Contains | columns → "table"
  - Valid JSON/YAML → "structured"
  - Fallback → "markdown"

Publish live events: `artifact.created`, `artifact.updated`, `artifact.deleted`.

- [ ] **Step 2: Create artifact routes**

`server/src/routes/artifacts.ts`:

```
POST   /api/companies/:companyId/artifacts         — Create (artifacts:edit)
GET    /api/companies/:companyId/artifacts          — List (artifacts:read)
GET    /api/companies/:companyId/artifacts/:id      — Detail (artifacts:read)
PATCH  /api/companies/:companyId/artifacts/:id      — Update = new version (artifacts:edit)
DELETE /api/companies/:companyId/artifacts/:id       — Delete (artifacts:delete)
GET    /api/companies/:companyId/artifacts/:id/versions        — Version history (artifacts:read)
GET    /api/companies/:companyId/artifacts/:id/versions/:vid   — Single version (artifacts:read)
```

- [ ] **Step 3: Mount routes + commit**

```bash
git add server/src/services/artifact.ts server/src/routes/artifacts.ts server/src/index.ts
git commit -m "feat(artifacts): add artifact service with versioning and routes"
```

---

## Task 6: Folder Service + Routes

**Files:**
- Create: `server/src/services/folder.ts`
- Create: `server/src/routes/folders.ts`
- Modify: `server/src/index.ts`

### Steps

- [ ] **Step 1: Create folder service**

`server/src/services/folder.ts` — Factory `folderService(db)`. Methods:

- `create(companyId, input: CreateFolder, ownerUserId: string)` → Folder
- `getById(companyId, folderId, requestingUserId: string)` → Folder | null (with visibility check)
- `list(companyId, requestingUserId: string, opts?: { visibility?, limit?, offset? })` → { folders, total }
  - Returns: owned folders + shared folders visible via tags (same pattern as `listConfigLayersFiltered`)
  - Use tag-based visibility: join `tag_assignments` to find shared tags between folder owner and requesting user
- `update(companyId, folderId, input: UpdateFolder, requestingUserId: string)` → Folder (ownership check)
- `delete(companyId, folderId, requestingUserId: string)` → void (detaches items, does NOT delete underlying artifacts/docs)
- `addItem(companyId, folderId, input: AddFolderItem, addedByUserId: string)` → FolderItem
- `removeItem(companyId, folderId, itemId: string)` → void
- `getItems(companyId, folderId, opts?: { itemType?, limit?, offset? })` → FolderItem[] (with joined entity data)

**Tag-based visibility pattern** (from `tag-filter.ts`):
```typescript
// For "shared" folders: check if requesting user shares at least 1 tag with folder owner
// SELECT f.* FROM folders f
// WHERE f.company_id = $companyId AND (
//   f.owner_user_id = $requestingUserId  -- own folders
//   OR (f.visibility = 'shared' AND EXISTS (
//     SELECT 1 FROM tag_assignments ta1
//     JOIN tag_assignments ta2 ON ta1.tag_id = ta2.tag_id
//     WHERE ta1.entity_type = 'user' AND ta1.entity_id = f.owner_user_id
//       AND ta2.entity_type = 'user' AND ta2.entity_id = $requestingUserId
//   ))
// )
```

- [ ] **Step 2: Create folder routes**

```
POST   /api/companies/:companyId/folders             — Create (folders:create)
GET    /api/companies/:companyId/folders              — List (folders:read)
GET    /api/companies/:companyId/folders/:id          — Detail with items (folders:read)
PATCH  /api/companies/:companyId/folders/:id          — Update (folders:edit, ownership check)
DELETE /api/companies/:companyId/folders/:id           — Delete (folders:delete, ownership check)
POST   /api/companies/:companyId/folders/:id/items    — Add item (folders:edit)
DELETE /api/companies/:companyId/folders/:id/items/:itemId — Remove item (folders:edit)
```

- [ ] **Step 3: Mount + commit**

```bash
git add server/src/services/folder.ts server/src/routes/folders.ts server/src/index.ts
git commit -m "feat(folders): add folder service with tag-based visibility and routes"
```

---

## Task 7: Chat Sharing Service + Routes

**Files:**
- Create: `server/src/services/chat-sharing.ts`
- Create: `server/src/routes/chat-sharing.ts`
- Modify: `server/src/routes/chat.ts` — mount sharing sub-routes

### Steps

- [ ] **Step 1: Create chat sharing service**

`server/src/services/chat-sharing.ts` — Factory `chatSharingService(db)`. Methods:

- `createShare(companyId, channelId, sharedByUserId, input: CreateShare)` → ChatShare
  - Generate `share_token` via `crypto.randomBytes(32).toString("base64url")`
  - Returns share with URL-ready token
- `getShareByToken(token: string)` → ChatShare | null
  - Check not expired, not revoked
- `revokeShare(companyId, shareId: string)` → ChatShare
- `listSharesForChannel(companyId, channelId)` → ChatShare[]
- `forkChat(companyId, token: string, forkingUserId: string, agentId: string)` → ChatChannel
  - Verify share token is valid + permission = "fork"
  - Create new channel with forkedFromChannelId + forkPointMessageId
  - Copy all messages up to fork point (new UUIDs, update channelId)
  - Copy chat_context_links from original channel
  - Return new channel
- `getSharedChatMessages(token: string, opts?: { before?, limit? })` → { channel, messages, hasMore }
  - Verify token validity (same company as authenticated user)
  - Return read-only view of messages

- [ ] **Step 2: Create sharing routes**

```
POST   /api/companies/:companyId/chat/channels/:id/share     — Create share (chat:share)
GET    /api/companies/:companyId/chat/channels/:id/shares     — List shares (chat:share)
DELETE /api/companies/:companyId/chat/shares/:shareId          — Revoke (chat:share)
GET    /api/companies/:companyId/shared/chat/:token            — Access shared chat (authenticated, same company)
POST   /api/companies/:companyId/shared/chat/:token/fork       — Fork (chat:fork)
```

The shared chat route requires authentication but NOT the specific `chat:agent` permission — just company membership.

- [ ] **Step 3: Mount + commit**

```bash
git add server/src/services/chat-sharing.ts server/src/routes/chat-sharing.ts server/src/routes/chat.ts
git commit -m "feat(sharing): add chat share links, fork, and shared chat access"
```

---

## Task 8: Context Link Service + Routes

**Files:**
- Create: `server/src/services/chat-context-link.ts`
- Create: `server/src/routes/chat-context-links.ts`
- Modify: `server/src/routes/chat.ts` — mount context link sub-routes

### Steps

- [ ] **Step 1: Create context link service**

`server/src/services/chat-context-link.ts` — Factory `chatContextLinkService(db)`. Methods:

- `addLink(companyId, channelId, input: AddContextLink, addedByUserId: string)` → ChatContextLink
  - Validate the referenced entity exists and user has access
  - Create the link
  - Broadcast WS: `context_added`
- `getLinksForChannel(companyId, channelId)` → ChatContextLink[] (with joined entities)
- `removeLink(companyId, channelId, linkId: string)` → void

- [ ] **Step 2: Create routes**

```
POST   /api/companies/:companyId/chat/channels/:id/context           — Add link
GET    /api/companies/:companyId/chat/channels/:id/context           — List links
DELETE /api/companies/:companyId/chat/channels/:id/context/:linkId   — Remove link
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/chat-context-link.ts server/src/routes/chat-context-links.ts server/src/routes/chat.ts
git commit -m "feat(context-links): add context link service for chat document/artifact/folder imports"
```

---

## Task 9: WebSocket Extensions + Slash Commands + @Mentions

**Files:**
- Modify: `server/src/services/chat-ws-manager.ts` — handle new message types
- Create: `server/src/services/slash-command-resolver.ts`
- Create: `server/src/services/agent-mention-handler.ts`

### Steps

- [ ] **Step 1: Create slash command resolver**

`server/src/services/slash-command-resolver.ts`:

```typescript
export function slashCommandResolver(db: Db) {
  const builtInCommands: Record<string, (args: string, context: CommandContext) => Promise<CommandResult>> = {
    help: async () => ({ type: "text", content: "Available commands: /summarize, /summarize-doc, /deep-dive, /export, /save, /help" }),
    summarize: async (_args, ctx) => {
      // Summarize chat history or linked docs
      // Return artifact with summary
    },
    "summarize-doc": async (args, ctx) => {
      // Parse @doc reference from args
      // Trigger document summarization
    },
    "deep-dive": async (args, ctx) => {
      // Activate RAG mode for referenced document
    },
    save: async (args, ctx) => {
      // Parse @folder reference
      // Save current artifact to folder
    },
    export: async (_args, ctx) => {
      // Export current artifact as downloadable file
    },
  };

  return {
    async resolve(command: string, args: string, context: CommandContext): Promise<CommandResult> {
      // 1. Check built-in commands
      if (builtInCommands[command]) return builtInCommands[command](args, context);
      // 2. Check skills from agent's config layers (via resolveConfigForRun)
      // 3. Return error if not found
    },
    listAvailable(agentId: string): Promise<{ name: string; description: string }[]>,
  };
}
```

- [ ] **Step 2: Create agent mention handler**

`server/src/services/agent-mention-handler.ts`:

```typescript
export function agentMentionHandler(db: Db) {
  return {
    async handleMention(companyId: string, channelId: string, mentionedAgentName: string, message: string, senderUserId: string) {
      // 1. Find agent by name in company (with tag isolation check)
      // 2. If not found → return error
      // 3. Route message via A2A bus (sendMessage)
      // 4. Subscribe to response
      // 5. When response arrives, post as message in chat channel
      //    with senderType: "agent", senderId: agent.id
    },
  };
}
```

- [ ] **Step 3: Extend chat-ws-manager.ts**

In the `handleMessage` method, add handling for new message types:

```typescript
case "slash_command": {
  const { command, args } = payload;
  const result = await slashResolver.resolve(command, args ?? "", context);
  // Send command_result to client
  // If result produced an artifact, send artifact_created
  break;
}
case "mention_agent": {
  const { agentName, message } = payload;
  await mentionHandler.handleMention(companyId, channelId, agentName, message, actorId);
  break;
}
case "upload_complete": {
  const { documentId } = payload;
  // Broadcast document_status to all channel clients
  break;
}
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/slash-command-resolver.ts server/src/services/agent-mention-handler.ts server/src/services/chat-ws-manager.ts
git commit -m "feat(chat): add slash command resolver, @mention handler, and WS extensions"
```

---

## Task 10: UI API Clients + Query Keys

**Files:**
- Create: `ui/src/api/documents.ts`
- Create: `ui/src/api/artifacts.ts`
- Create: `ui/src/api/folders.ts`
- Create: `ui/src/api/chat-sharing.ts`
- Modify: `ui/src/lib/queryKeys.ts`
- Modify: `ui/src/api/chat.ts`

### Steps

- [ ] **Step 1: Create document API client**

```typescript
// ui/src/api/documents.ts
import { api } from "./client";
import type { Document, DocumentChunk } from "@mnm/shared";

export const documentsApi = {
  upload: (companyId: string, file: File, opts?: { title?: string; channelId?: string; folderId?: string }) => {
    const formData = new FormData();
    formData.append("file", file);
    if (opts?.title) formData.append("title", opts.title);
    if (opts?.channelId) formData.append("channelId", opts.channelId);
    if (opts?.folderId) formData.append("folderId", opts.folderId);
    return api.postForm<Document>(`/api/companies/${companyId}/documents/upload`, formData);
  },
  list: (companyId: string, opts?: { status?: string; limit?: number; offset?: number }) =>
    api.get<{ documents: Document[]; total: number }>(`/api/companies/${companyId}/documents`, opts),
  getById: (companyId: string, id: string) =>
    api.get<Document>(`/api/companies/${companyId}/documents/${id}`),
  getContentUrl: (companyId: string, id: string) =>
    `/api/companies/${companyId}/documents/${id}/content`,
  delete: (companyId: string, id: string) =>
    api.delete(`/api/companies/${companyId}/documents/${id}`),
  summarize: (companyId: string, id: string, mode: "summary" | "deep_dive" = "summary") =>
    api.post(`/api/companies/${companyId}/documents/${id}/summarize`, { mode }),
  getChunks: (companyId: string, id: string) =>
    api.get<DocumentChunk[]>(`/api/companies/${companyId}/documents/${id}/chunks`),
};
```

- [ ] **Step 2: Create artifact API client**

```typescript
// ui/src/api/artifacts.ts
import { api } from "./client";
import type { Artifact, ArtifactVersion } from "@mnm/shared";

export const artifactsApi = {
  create: (companyId: string, input: any) =>
    api.post<Artifact>(`/api/companies/${companyId}/artifacts`, input),
  list: (companyId: string, opts?: { channelId?: string; artifactType?: string; limit?: number; offset?: number }) =>
    api.get<{ artifacts: Artifact[]; total: number }>(`/api/companies/${companyId}/artifacts`, opts),
  getById: (companyId: string, id: string) =>
    api.get<Artifact>(`/api/companies/${companyId}/artifacts/${id}`),
  update: (companyId: string, id: string, input: any) =>
    api.patch<Artifact>(`/api/companies/${companyId}/artifacts/${id}`, input),
  delete: (companyId: string, id: string) =>
    api.delete(`/api/companies/${companyId}/artifacts/${id}`),
  getVersions: (companyId: string, id: string) =>
    api.get<ArtifactVersion[]>(`/api/companies/${companyId}/artifacts/${id}/versions`),
  getVersion: (companyId: string, id: string, versionId: string) =>
    api.get<ArtifactVersion>(`/api/companies/${companyId}/artifacts/${id}/versions/${versionId}`),
};
```

- [ ] **Step 3: Create folder API client**

```typescript
// ui/src/api/folders.ts
import { api } from "./client";
import type { Folder, FolderItem } from "@mnm/shared";

export const foldersApi = {
  create: (companyId: string, input: any) =>
    api.post<Folder>(`/api/companies/${companyId}/folders`, input),
  list: (companyId: string, opts?: { visibility?: string }) =>
    api.get<{ folders: Folder[]; total: number }>(`/api/companies/${companyId}/folders`, opts),
  getById: (companyId: string, id: string) =>
    api.get<Folder & { items: FolderItem[] }>(`/api/companies/${companyId}/folders/${id}`),
  update: (companyId: string, id: string, input: any) =>
    api.patch<Folder>(`/api/companies/${companyId}/folders/${id}`, input),
  delete: (companyId: string, id: string) =>
    api.delete(`/api/companies/${companyId}/folders/${id}`),
  addItem: (companyId: string, folderId: string, input: any) =>
    api.post<FolderItem>(`/api/companies/${companyId}/folders/${folderId}/items`, input),
  removeItem: (companyId: string, folderId: string, itemId: string) =>
    api.delete(`/api/companies/${companyId}/folders/${folderId}/items/${itemId}`),
};
```

- [ ] **Step 4: Create chat sharing API client**

```typescript
// ui/src/api/chat-sharing.ts
import { api } from "./client";
import type { ChatShare, ChatContextLink } from "@mnm/shared";

export const chatSharingApi = {
  createShare: (companyId: string, channelId: string, input: any) =>
    api.post<ChatShare>(`/api/companies/${companyId}/chat/channels/${channelId}/share`, input),
  listShares: (companyId: string, channelId: string) =>
    api.get<ChatShare[]>(`/api/companies/${companyId}/chat/channels/${channelId}/shares`),
  revokeShare: (companyId: string, shareId: string) =>
    api.delete(`/api/companies/${companyId}/chat/shares/${shareId}`),
  getSharedChat: (companyId: string, token: string) =>
    api.get<any>(`/api/companies/${companyId}/shared/chat/${token}`),
  forkChat: (companyId: string, token: string, agentId: string) =>
    api.post<any>(`/api/companies/${companyId}/shared/chat/${token}/fork`, { agentId }),
  // Context links
  addContextLink: (companyId: string, channelId: string, input: any) =>
    api.post<ChatContextLink>(`/api/companies/${companyId}/chat/channels/${channelId}/context`, input),
  getContextLinks: (companyId: string, channelId: string) =>
    api.get<ChatContextLink[]>(`/api/companies/${companyId}/chat/channels/${channelId}/context`),
  removeContextLink: (companyId: string, channelId: string, linkId: string) =>
    api.delete(`/api/companies/${companyId}/chat/channels/${channelId}/context/${linkId}`),
};
```

- [ ] **Step 5: Add query keys**

Add to `ui/src/lib/queryKeys.ts`:

```typescript
documents: {
  list: (companyId: string) => ["documents", companyId] as const,
  detail: (companyId: string, id: string) => ["documents", companyId, id] as const,
  chunks: (companyId: string, id: string) => ["documents", companyId, id, "chunks"] as const,
},
artifacts: {
  list: (companyId: string, channelId?: string) => ["artifacts", companyId, { channelId }] as const,
  detail: (companyId: string, id: string) => ["artifacts", companyId, id] as const,
  versions: (companyId: string, id: string) => ["artifacts", companyId, id, "versions"] as const,
},
folders: {
  list: (companyId: string) => ["folders", companyId] as const,
  detail: (companyId: string, id: string) => ["folders", companyId, id] as const,
},
chatSharing: {
  shares: (companyId: string, channelId: string) => ["chatShares", companyId, channelId] as const,
  shared: (companyId: string, token: string) => ["sharedChat", companyId, token] as const,
  contextLinks: (companyId: string, channelId: string) => ["contextLinks", companyId, channelId] as const,
},
```

- [ ] **Step 6: Commit**

```bash
git add ui/src/api/documents.ts ui/src/api/artifacts.ts ui/src/api/folders.ts ui/src/api/chat-sharing.ts ui/src/lib/queryKeys.ts ui/src/api/chat.ts
git commit -m "feat(ui): add API clients and query keys for documents, artifacts, folders, sharing"
```

---

## Task 11: UI — Chat View Refactor + Artifact Panel + Drop Zone

**Files:**
- Modify: `ui/src/pages/Chat.tsx` — split-panel layout
- Modify: `ui/src/components/AgentChatPanel.tsx` — integrate new components
- Create: `ui/src/components/chat/ArtifactPanel.tsx`
- Create: `ui/src/components/chat/ArtifactRenderer.tsx`
- Create: `ui/src/components/chat/DocumentDropZone.tsx`
- Create: `ui/src/components/chat/ContextLinkBar.tsx`
- Create: `ui/src/components/chat/DocumentStatusBadge.tsx`
- Create: `ui/src/components/chat/DocumentModeSelector.tsx`
- Create: `ui/src/components/chat/ForkBanner.tsx`

### Steps

- [ ] **Step 1: Create ArtifactRenderer**

Renders artifact content based on type:
- `markdown` → react-markdown with syntax highlighting
- `code` → `<pre><code>` with language class for highlighting
- `table` → parse markdown table into `<table>`
- `structured` → JSON/YAML pretty print
- `diagram` → placeholder (future mermaid integration)

Props: `{ content: string; artifactType: ArtifactType; language?: string }`

- [ ] **Step 2: Create ArtifactPanel**

Split panel (1/3 right side). Props: `{ companyId, channelId, artifactId, onClose }`.

Features:
- Fetch artifact detail + current version
- Render with ArtifactRenderer
- Action buttons: Copy, Download, Save to Folder (opens FolderPicker), View History, Edit
- Edit mode: textarea/code editor, save creates new version
- Version history: drawer/tab showing versions with version_number + change_summary
- Tabs if multiple artifacts in the channel

- [ ] **Step 3: Create DocumentDropZone**

Drag & drop overlay on the chat area. Props: `{ companyId, channelId, onUpload }`.

- Intercepts drag events on the parent container
- Shows overlay with "Drop files here" when dragging
- On drop: calls `documentsApi.upload()` with the file
- Shows upload progress
- On completion: creates a chat_message with `message_type: "document_upload"` and `document_id`
- Shows DocumentStatusBadge for ingestion progress

- [ ] **Step 4: Create ContextLinkBar**

Horizontal bar below the chat header showing linked context. Props: `{ companyId, channelId }`.

- Fetches context links via `chatSharingApi.getContextLinks()`
- Renders chips: document icon + title, artifact icon + title, folder icon + name, chat icon + name
- Each chip: click to preview, X button to remove link
- "+" button to add new context (opens picker)

- [ ] **Step 5: Create DocumentStatusBadge + DocumentModeSelector**

`DocumentStatusBadge`: Shows ingestion progress (`pending` → `extracting` → `chunking` → `ready`). Animated spinner for in-progress states.

`DocumentModeSelector`: After doc is "ready", show dialog with 2 buttons:
- "Resume rapide" → triggers `/summarize-doc`
- "Deep dive" → enables RAG mode, stores preference on the context link

- [ ] **Step 6: Create ForkBanner**

If `channel.forkedFromChannelId` is set, show a banner: "This conversation was forked from [original chat name]. [View original]"

- [ ] **Step 7: Refactor AgentChatPanel.tsx**

Integrate all new components:
1. Wrap in a flex container: chat area (flex-[2]) + artifact panel (flex-1, conditional)
2. Add DocumentDropZone as wrapper around message area
3. Add ContextLinkBar below the header
4. Add ForkBanner if forked
5. Update MessageBubble to handle new message types:
   - `artifact_reference` → clickable card that opens ArtifactPanel
   - `document_upload` → card showing document title + status badge
   - `skill_invocation` → styled system message
   - `agent_delegation` → styled delegation indicator
6. Listen for new WS events: `artifact_created`, `artifact_updated`, `document_status`, `context_added`

- [ ] **Step 8: Commit**

```bash
git add ui/src/pages/Chat.tsx ui/src/components/AgentChatPanel.tsx ui/src/components/chat/
git commit -m "feat(ui): refactor chat with split artifact panel, document drop zone, and context bar"
```

---

## Task 12: UI — Slash Command + @Mention Autocomplete

**Files:**
- Create: `ui/src/components/chat/SlashCommandAutocomplete.tsx`
- Create: `ui/src/components/chat/AgentMentionAutocomplete.tsx`
- Modify: `ui/src/components/AgentChatPanel.tsx` — integrate autocomplete

### Steps

- [ ] **Step 1: Create SlashCommandAutocomplete**

Popup that appears when user types "/" in the chat input.

- Props: `{ inputValue, cursorPosition, agentId, companyId, onSelect, onDismiss }`
- Fetch available commands: built-in list + agent's custom skills
- Filter by typed text after "/"
- Render popup anchored below the input cursor position
- Arrow keys + Enter to select, Escape to dismiss
- On select: replace "/" prefix with full command in input

Built-in command list (hardcoded):
```typescript
const BUILT_IN_COMMANDS = [
  { name: "summarize", description: "Résume le contexte courant" },
  { name: "summarize-doc", description: "Résume un document spécifique" },
  { name: "deep-dive", description: "Active le mode RAG sur un document" },
  { name: "export", description: "Exporte l'artefact courant" },
  { name: "save", description: "Sauve l'artefact dans un Folder" },
  { name: "help", description: "Liste les commandes disponibles" },
];
```

- [ ] **Step 2: Create AgentMentionAutocomplete**

Popup that appears when user types "@" in the chat input.

- Props: `{ inputValue, cursorPosition, companyId, onSelect, onDismiss }`
- Fetch visible agents via existing `agentsApi.list(companyId)` (already tag-filtered)
- Filter by typed text after "@"
- Same keyboard navigation as slash commands
- On select: replace "@" prefix with `@agent-name` in input

- [ ] **Step 3: Integrate in AgentChatPanel**

In the textarea `onChange` handler:
- Detect "/" at start of line → show SlashCommandAutocomplete
- Detect "@" → show AgentMentionAutocomplete
- On Enter with active autocomplete → select item instead of sending message

On send:
- If message starts with "/" → send as `slash_command` WS type instead of `chat_message`
- If message contains "@agentName" → send as `mention_agent` WS type

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/chat/SlashCommandAutocomplete.tsx ui/src/components/chat/AgentMentionAutocomplete.tsx ui/src/components/AgentChatPanel.tsx
git commit -m "feat(ui): add slash command and @mention autocomplete in chat"
```

---

## Task 13: UI — Folders Page + Detail + Shared Chat Page

**Files:**
- Create: `ui/src/pages/Folders.tsx`
- Create: `ui/src/pages/FolderDetail.tsx`
- Create: `ui/src/pages/SharedChat.tsx`
- Create: `ui/src/components/folders/FolderCard.tsx`
- Create: `ui/src/components/folders/FolderItemList.tsx`
- Create: `ui/src/components/folders/FolderPicker.tsx`
- Create: `ui/src/components/folders/FolderAttachButton.tsx`
- Create: `ui/src/components/chat/ChatShareDialog.tsx`
- Modify: `ui/src/App.tsx` — add routes
- Modify: `ui/src/components/Sidebar.tsx` — add Folders nav

### Steps

- [ ] **Step 1: Create FolderCard + FolderItemList**

`FolderCard`: Card showing folder name, icon, visibility badge, item count.
`FolderItemList`: Table/list of items in a folder with type icon, title, added date. Actions: remove item.

- [ ] **Step 2: Create Folders page**

Grid of FolderCards. Header: "Folders" + "New Folder" button. Visibility filter (All, Private, Shared).
Create dialog: name, description, visibility selector.
Click card → navigate to `/folders/:id`.

- [ ] **Step 3: Create FolderDetail page**

Header: folder name + edit button + delete button. Visibility badge.
FolderItemList below with drag & drop to add items.
"Add item" button → picker for existing artifacts/documents/chats.

- [ ] **Step 4: Create FolderPicker**

Modal dialog for "Save to Folder" action. Shows list of user's folders. Click to select. "New Folder" button at bottom.
Used from ArtifactPanel's "Save to Folder" button.

- [ ] **Step 5: Create FolderAttachButton**

Button in the chat header area. Opens dropdown with user's folders. Select to attach folder to current channel.
Calls `PATCH /api/chat/channels/:id` with `folder_id`.

- [ ] **Step 6: Create ChatShareDialog**

Dialog with:
- Permission selector: "Read Only" / "Read + Fork"
- Optional expiration date
- "Generate Link" button → calls createShare API
- Shows generated URL with copy button
- List of existing shares for this channel with revoke buttons

- [ ] **Step 7: Create SharedChat page**

Route: `/shared/chat/:token`.
Read-only view of a shared chat. Shows messages but no input area.
If permission = "fork": shows "Continue this conversation" button → fork dialog (select agent) → creates fork → navigates to new chat.

- [ ] **Step 8: Add routes to App.tsx**

```typescript
// In boardRoutes:
<Route path="folders" element={<Folders />} />
<Route path="folders/:folderId" element={<FolderDetail />} />
<Route path="shared/chat/:token" element={<SharedChat />} />
```

- [ ] **Step 9: Add Folders to Sidebar**

In the "Work" section of `Sidebar.tsx`, add after "Chat":
```typescript
{ to: "/folders", icon: FolderOpen, label: "Folders", permission: "folders:read" },
```

Import `FolderOpen` from lucide-react.

- [ ] **Step 10: Commit**

```bash
git add ui/src/pages/Folders.tsx ui/src/pages/FolderDetail.tsx ui/src/pages/SharedChat.tsx ui/src/components/folders/ ui/src/components/chat/ChatShareDialog.tsx ui/src/App.tsx ui/src/components/Sidebar.tsx
git commit -m "feat(ui): add Folders page, shared chat page, folder picker, and chat share dialog"
```

---

## Self-Review Checklist

### Spec coverage
- [x] Documents: upload, ingestion, RAG, chunking — Task 4
- [x] Artifacts: CRUD, versioning, type detection, side panel — Tasks 5, 11
- [x] Folders: CRUD, items, visibility, attach to chat — Tasks 6, 13
- [x] Sharing: share links, fork, shared view — Tasks 7, 13
- [x] Context links: add/remove/list — Task 8
- [x] Slash commands: built-in + custom skills — Task 9
- [x] @Mentions: agent lookup + A2A routing — Task 9
- [x] Auto-delegation: transparent sub-agent — Task 9
- [x] WebSocket extensions: 6 new server→client types — Tasks 2, 9
- [x] Permissions: 13 new permissions — Task 3
- [x] DB: 8 new tables + 2 ALTER — Task 1
- [x] UI: split panel, drop zone, autocomplete, folders page, share dialog — Tasks 11-13

### Type consistency
- Document → `documents` table → `documentService` → `documentRoutes` → `documentsApi` → `queryKeys.documents`
- Artifact → `artifacts` table → `artifactService` → `artifactRoutes` → `artifactsApi` → `queryKeys.artifacts`
- Folder → `folders` table → `folderService` → `folderRoutes` → `foldersApi` → `queryKeys.folders`
- ChatShare → `chat_shares` table → `chatSharingService` → share routes → `chatSharingApi` → `queryKeys.chatSharing`
- ChatContextLink → `chat_context_links` table → `chatContextLinkService` → context routes → `chatSharingApi` → `queryKeys.chatSharing.contextLinks`

### No placeholders
All tasks include concrete code. BullMQ worker has real extraction logic (pdf-parse for PDF, direct read for text). RAG uses real pgvector SQL. Folder visibility uses real tag-based query.
