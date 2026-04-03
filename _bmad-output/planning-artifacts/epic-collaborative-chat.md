# Epic CHAT — Collaborative Chat & Document Management

> **Version** : 1.0 | **Date** : 2026-04-03 | **Statut** : DONE
> **Equipe** : Tom + Claude (1 dev humain + AI pair programming)
> **Source** : `docs/superpowers/specs/2026-04-03-collaborative-chat-design.md`
> **Sprint** : 1 session intensive (~80 SP)

---

## Vue d'ensemble

**Objectif** : Transformer le chat 1-1 existant (user <> agent) en plateforme de collaboration avec gestion documentaire, artefacts structures, Folders reutilisables, et partage entre membres.

**Phase PRD** : Phase 1 (Chat ameliore + Documents + Artefacts + Folders + Partage)

| Metrique | Valeur |
|----------|--------|
| Stories | 18 |
| Story Points | ~80 |
| Statut | 18/18 DONE |
| DB migration | 0055 (8 new tables + 2 ALTER) |
| New permissions | 13 |
| New routes | ~25 |

### Composants principaux

| Composant | Description |
|-----------|-------------|
| **Chat completion** | LLM responses via Anthropic API (streaming + tool_use) or claude CLI fallback |
| **Artifacts** | Versioned first-class entities (code, HTML, markdown, tables) with side panel preview |
| **Documents** | Upload + ingestion pipeline (BullMQ, pdf-parse, chunking) + RAG pgvector |
| **Folders** | Named spaces with tag-based visibility, item management |
| **Sharing** | Share links with read/fork permissions, chat forking |
| **Context links** | Import docs/artifacts/folders/chats as context into conversation |
| **Slash commands** | /summarize, /deep-dive, /help + @mentions with A2A routing |
| **Streaming** | Real-time token streaming via WebSocket |

---

## Stories

| ID | Story | SP | Status |
|----|-------|----|--------|
| CHAT-01 | Chat completion service | 5 | DONE |
| CHAT-02 | Artifact system | 8 | DONE |
| CHAT-03 | Document upload + ingestion pipeline | 8 | DONE |
| CHAT-04 | RAG retrieval service | 5 | DONE |
| CHAT-05 | Folders | 5 | DONE |
| CHAT-06 | Chat sharing | 5 | DONE |
| CHAT-07 | Context links | 3 | DONE |
| CHAT-08 | Slash commands + @mentions | 5 | DONE |
| CHAT-09 | WebSocket extensions | 3 | DONE |
| CHAT-10 | UI — Chat layout + message bubbles + artifact panel | 8 | DONE |
| CHAT-11 | UI — Folders page + folder detail + shared chat page | 5 | DONE |
| CHAT-12 | Permissions | 3 | DONE |
| CHAT-13 | Security fixes | 3 | DONE |
| CHAT-14 | Artifact tool_use | 5 | DONE |
| CHAT-15 | Streaming responses | 3 | DONE |
| CHAT-16 | Embedding provider + real RAG | 3 | DONE |
| CHAT-17 | Document summarization | 2 | DONE |
| CHAT-18 | Artifact preview | 3 | DONE |

**Total : ~80 SP — All DONE**

---

## Story CHAT-01 : Chat Completion Service

**Description** : Real-time LLM responses via Anthropic API (streaming + tool_use) or claude CLI fallback. System prompt construction with context injection.
**Effort** : M (5 SP)
**Bloque par** : Aucun
**Debloque** : CHAT-14, CHAT-15

**Acceptance Criteria** :
- Given a user message in a chat channel When the message is sent Then the agent responds via Anthropic API with streaming
- Given the Anthropic API is unavailable When a message is sent Then the system falls back to claude CLI (`claude -p`)
- Given a chat with context links When a completion is requested Then the system prompt includes relevant document/artifact content

**Key files** :
- `server/src/services/chat-completion.ts` — Anthropic API integration, system prompt builder, tool_use dispatch
- `server/src/services/chat.ts` — Chat message CRUD, channel management
- `server/src/routes/chat.ts` — Chat REST endpoints

---

## Story CHAT-02 : Artifact System

**Description** : Create, version, and type-detect artifacts (code, HTML, markdown, tables). DB schema with 3 tables (artifacts, artifact_versions, artifact_deployments). First-class entities independent from the chat that created them.
**Effort** : L (8 SP)
**Bloque par** : Aucun
**Debloque** : CHAT-14, CHAT-18

**Acceptance Criteria** :
- Given an artifact creation request When the type is detected (code/html/markdown/table) Then the artifact is stored with correct type metadata
- Given an existing artifact When it is edited Then a new version is created (immutable history)
- Given an artifact When queried Then all versions are retrievable with diffs

**Key files** :
- `server/src/services/artifact.ts` — Artifact CRUD, version management, type detection
- `server/src/routes/artifacts.ts` — Artifact REST endpoints
- `packages/db/src/schema/artifacts.ts` — Artifacts table schema
- `packages/db/src/schema/artifact_versions.ts` — Artifact versions table
- `packages/db/src/schema/artifact_deployments.ts` — Artifact deployments table

---

## Story CHAT-03 : Document Upload + Ingestion Pipeline

**Description** : Document upload with BullMQ-powered ingestion pipeline. PDF extraction via pdf-parse, text chunking with overlap, storage in document_chunks table.
**Effort** : L (8 SP)
**Bloque par** : Aucun
**Debloque** : CHAT-04, CHAT-16, CHAT-17

**Acceptance Criteria** :
- Given a PDF upload When the ingestion pipeline runs Then the document is parsed, chunked, and stored
- Given a large document When chunked Then chunks have configurable size with overlap
- Given an upload in progress When the user views the document Then a status badge shows ingestion progress

**Key files** :
- `server/src/services/document.ts` — Document CRUD, upload handling
- `server/src/services/document-ingestion.ts` — BullMQ pipeline, pdf-parse extraction, chunking
- `server/src/routes/documents.ts` — Document REST endpoints
- `packages/db/src/schema/documents.ts` — Documents table schema
- `packages/db/src/schema/document_chunks.ts` — Document chunks table (text + vector)

---

## Story CHAT-04 : RAG Retrieval Service

**Description** : pgvector cosine similarity search on document chunks. Context building from top-k results for injection into chat completion system prompt.
**Effort** : M (5 SP)
**Bloque par** : CHAT-03
**Debloque** : CHAT-01 (context enrichment)

**Acceptance Criteria** :
- Given a user query and linked documents When RAG search runs Then top-k relevant chunks are returned by cosine similarity
- Given retrieved chunks When injected into system prompt Then the agent response references document content accurately
- Given no relevant chunks When similarity is below threshold Then no context is injected (no hallucination)

**Key files** :
- `server/src/services/rag.ts` — Vector search, top-k retrieval, context builder
- `server/src/services/embedding.ts` — Embedding provider abstraction
- `packages/db/src/schema/document_chunks.ts` — pgvector column for embeddings

---

## Story CHAT-05 : Folders

**Description** : Named spaces (Folders) with tag-based visibility (private/public + direct tags). Items can be artifacts, documents, or chat links. CRUD operations with ownership checks.
**Effort** : M (5 SP)
**Bloque par** : Aucun
**Debloque** : CHAT-07, CHAT-11

**Acceptance Criteria** :
- Given a user When they create a folder Then it has a name, visibility (private/public), and optional tags
- Given a private folder When another user queries folders Then they do not see it
- Given a folder with tags When a user shares tags Then they can see the folder
- Given a folder When items are added/removed Then the folder_items join table is updated

**Key files** :
- `server/src/services/folder.ts` — Folder CRUD, item management, tag-based visibility
- `server/src/routes/folders.ts` — Folder REST endpoints
- `packages/db/src/schema/folders.ts` — Folders table schema
- `packages/db/src/schema/folder_items.ts` — Folder-item join table

---

## Story CHAT-06 : Chat Sharing

**Description** : Share links with read/fork permissions. Chat forking copies messages into a new channel. Token-based access for shared chats.
**Effort** : M (5 SP)
**Bloque par** : Aucun
**Debloque** : CHAT-11

**Acceptance Criteria** :
- Given a chat channel When the owner shares it Then a share link with token is generated
- Given a share link with "read" permission When accessed Then the chat is read-only
- Given a share link with "fork" permission When forked Then a new channel is created with copied messages
- Given an expired/revoked share link When accessed Then 403 is returned

**Key files** :
- `server/src/services/chat-sharing.ts` — Share link generation, token validation, fork logic
- `server/src/routes/chat-sharing.ts` — Share link REST endpoints
- `packages/db/src/schema/chat_shares.ts` — Chat shares table
- `ui/src/components/chat/ChatShareDialog.tsx` — Share dialog UI
- `ui/src/components/chat/ForkBanner.tsx` — Fork indicator

---

## Story CHAT-07 : Context Links

**Description** : Import documents, artifacts, folders, or other chats as context into a conversation. Linked content is injected into the system prompt for LLM completion.
**Effort** : S (3 SP)
**Bloque par** : CHAT-02, CHAT-03, CHAT-05
**Debloque** : CHAT-01 (richer context)

**Acceptance Criteria** :
- Given a chat When a document is linked Then its content is available for RAG retrieval
- Given a chat When an artifact is linked Then its latest version content is injected into context
- Given a chat When a folder is linked Then all folder items are available as context
- Given linked items When displayed Then a context bar shows all linked resources

**Key files** :
- `server/src/services/chat-context-link.ts` — Context link CRUD, resolution
- `server/src/routes/chat-context-links.ts` — Context link REST endpoints
- `packages/db/src/schema/chat_context_links.ts` — Context links table
- `ui/src/components/chat/ContextLinkBar.tsx` — Context bar UI

---

## Story CHAT-08 : Slash Commands + @Mentions

**Description** : Slash command resolver (/summarize, /deep-dive, /help, etc.) and @mention autocomplete with A2A routing for agent mentions.
**Effort** : M (5 SP)
**Bloque par** : CHAT-01
**Debloque** : Aucun

**Acceptance Criteria** :
- Given a message starting with /summarize When sent Then the chat is summarized via LLM
- Given a message starting with /deep-dive When sent Then a detailed analysis is produced
- Given a message with @agent-name When sent Then the mention is resolved and routed via A2A bus
- Given the user typing "/" When in the input Then an autocomplete menu shows available commands

**Key files** :
- `server/src/services/slash-command-resolver.ts` — Command parsing, dispatch
- `ui/src/components/chat/SlashCommandAutocomplete.tsx` — Slash command autocomplete UI
- `ui/src/components/chat/AgentMentionAutocomplete.tsx` — @mention autocomplete UI

---

## Story CHAT-09 : WebSocket Extensions

**Description** : New WebSocket message types for chat streaming, artifact updates, document status, typing indicators, connection status.
**Effort** : S (3 SP)
**Bloque par** : Aucun
**Debloque** : CHAT-15

**Acceptance Criteria** :
- Given a new message type When received via WS Then the client handler dispatches correctly
- Given a streaming delta When received Then it is appended to the current message in real-time
- Given a document ingestion status change When it occurs Then a WS event notifies the client

**Key files** :
- `server/src/realtime/chat-ws.ts` — WebSocket message handlers, new event types
- `server/src/services/chat-ws-manager.ts` — WS connection management, broadcasting
- `ui/src/components/chat/ConnectionStatus.tsx` — Connection status indicator
- `ui/src/components/chat/TypingIndicator.tsx` — Typing indicator
- `ui/src/components/chat/PipeStatusIndicator.tsx` — Pipeline status indicator

---

## Story CHAT-10 : UI — Chat Layout + Message Bubbles + Artifact Panel

**Description** : Full-page chat layout with resizable artifact side panel, message bubbles with role-based styling, markdown rendering, code blocks.
**Effort** : L (8 SP)
**Bloque par** : CHAT-01, CHAT-02
**Debloque** : CHAT-18

**Acceptance Criteria** :
- Given the chat page When loaded Then messages display in bubbles with user/agent distinction
- Given an artifact reference in a message When clicked Then the artifact panel opens on the right
- Given the artifact panel When open Then it is resizable and can be closed
- Given a message with code/markdown When rendered Then syntax highlighting and formatting are correct

**Key files** :
- `ui/src/pages/Chat.tsx` — Full-page chat layout, message list, input area
- `ui/src/components/chat/MessageBubble.tsx` — Message bubble component
- `ui/src/components/chat/ArtifactPanel.tsx` — Side panel for artifact preview

---

## Story CHAT-11 : UI — Folders Page + Folder Detail + Shared Chat Page

**Description** : Folders listing page with card grid, folder detail page with item list, shared chat page for external access.
**Effort** : M (5 SP)
**Bloque par** : CHAT-05, CHAT-06
**Debloque** : Aucun

**Acceptance Criteria** :
- Given the folders page When loaded Then folders display as cards with name, item count, visibility
- Given a folder card When clicked Then the folder detail page shows items (artifacts, documents, chat links)
- Given a shared chat URL When accessed Then the shared chat page renders messages in read-only mode
- Given a forked chat When displayed Then a banner indicates the fork origin

**Key files** :
- `ui/src/pages/Folders.tsx` — Folders listing page
- `ui/src/pages/FolderDetail.tsx` — Folder detail page with item list
- `ui/src/pages/SharedChat.tsx` — Shared chat read-only page
- `ui/src/components/folders/FolderCard.tsx` — Folder card component
- `ui/src/components/folders/FolderItemList.tsx` — Folder item list
- `ui/src/components/folders/FolderPicker.tsx` — Folder picker dialog
- `ui/src/components/folders/FolderAttachButton.tsx` — Attach to folder button

---

## Story CHAT-12 : Permissions

**Description** : 13 new permissions across chat, documents, artifacts, folders. Ownership checks, tag isolation on all list endpoints.
**Effort** : S (3 SP)
**Bloque par** : Aucun (leverages existing RBAC system)
**Debloque** : CHAT-13

**Acceptance Criteria** :
- Given the 13 new permissions When seeded Then they appear in the roles admin panel
- Given a user without `chat.create` permission When they try to create a chat Then 403
- Given a user without `documents.upload` permission When they try to upload Then 403
- Given folder/artifact/document list endpoints When queried Then tag isolation is enforced

**Key files** :
- `packages/db/src/migrations/0055_collaborative_chat.sql` — Permission seeds, new table schemas
- `server/src/routes/chat.ts` — Permission checks on chat routes
- `server/src/routes/documents.ts` — Permission checks on document routes
- `server/src/routes/artifacts.ts` — Permission checks on artifact routes
- `server/src/routes/folders.ts` — Permission checks on folder routes

---

## Story CHAT-13 : Security Fixes

**Description** : Company isolation on all new endpoints, tag visibility enforcement, admin bypass for tag checks, share token validation.
**Effort** : S (3 SP)
**Bloque par** : CHAT-12
**Debloque** : Aucun

**Acceptance Criteria** :
- Given a user from company A When they access company B chat/document/artifact Then 403
- Given a user with no matching tags When they query folders Then they see only public folders
- Given an admin When they query any resource Then tag isolation is bypassed
- Given an invalid share token When used Then 403 with no data leakage

**Key files** :
- `server/src/routes/chat.ts` — Company isolation middleware
- `server/src/routes/folders.ts` — Tag visibility enforcement
- `server/src/services/chat-sharing.ts` — Token validation hardening

---

## Story CHAT-14 : Artifact tool_use

**Description** : Read, edit, and create artifacts via Anthropic API tool_use. The LLM can call tools (read_artifact, edit_artifact, create_artifact) during completion, and results are rendered in the artifact panel.
**Effort** : M (5 SP)
**Bloque par** : CHAT-01, CHAT-02
**Debloque** : Aucun

**Acceptance Criteria** :
- Given a user request to create an artifact When the LLM uses `create_artifact` tool Then a new artifact is created and displayed
- Given a user request to edit an artifact When the LLM uses `edit_artifact` tool Then a new version is created
- Given a user request to read an artifact When the LLM uses `read_artifact` tool Then the content is injected into context
- Given tool_use results When received Then the artifact panel updates in real-time

**Key files** :
- `server/src/services/chat-completion.ts` — Tool definitions, tool result handling
- `server/src/services/artifact.ts` — Tool call execution (create, read, edit)

---

## Story CHAT-15 : Streaming Responses

**Description** : Real-time token streaming via WebSocket during Anthropic API completion. Progressive message rendering in the UI.
**Effort** : S (3 SP)
**Bloque par** : CHAT-01, CHAT-09
**Debloque** : Aucun

**Acceptance Criteria** :
- Given an LLM response via Anthropic API When streaming Then tokens appear progressively in the message bubble
- Given a streaming response When interrupted (user navigates away) Then the stream is properly closed
- Given the claude CLI fallback When used Then the response is delivered as a single message (non-streaming)

**Key files** :
- `server/src/services/chat-completion.ts` — Anthropic streaming API, delta emission
- `server/src/realtime/chat-ws.ts` — Streaming delta WS message type
- `ui/src/components/chat/MessageBubble.tsx` — Progressive rendering

---

## Story CHAT-16 : Embedding Provider + Real RAG

**Description** : OpenAI embeddings integration for vector search. Document chunks are embedded at ingestion time, stored in pgvector, and used for cosine similarity search.
**Effort** : S (3 SP)
**Bloque par** : CHAT-03, CHAT-04
**Debloque** : Aucun

**Acceptance Criteria** :
- Given a document chunk When ingested Then an embedding vector is computed and stored
- Given a query When RAG search runs Then pgvector cosine similarity returns relevant chunks
- Given the embedding provider When configured Then OpenAI embeddings API is used

**Key files** :
- `server/src/services/embedding.ts` — OpenAI embeddings API integration
- `server/src/services/rag.ts` — pgvector cosine similarity search
- `server/src/services/document-ingestion.ts` — Embedding at ingestion time

---

## Story CHAT-17 : Document Summarization

**Description** : /summarize endpoint using claude haiku for fast document summarization. Accessible via slash command or API.
**Effort** : S (2 SP)
**Bloque par** : CHAT-03, CHAT-08
**Debloque** : Aucun

**Acceptance Criteria** :
- Given a document When /summarize is invoked Then a concise summary is generated via claude haiku
- Given a long document When summarized Then the summary captures key points in <500 tokens
- Given the slash command /summarize When used in chat Then the summary is posted as a message

**Key files** :
- `server/src/services/slash-command-resolver.ts` — /summarize handler
- `server/src/services/document.ts` — Document content retrieval for summarization

---

## Story CHAT-18 : Artifact Preview

**Description** : HTML iframe rendering, code syntax highlighting, preview/code toggle in the artifact panel. Version history navigation.
**Effort** : S (3 SP)
**Bloque par** : CHAT-02, CHAT-10
**Debloque** : Aucun

**Acceptance Criteria** :
- Given an HTML artifact When previewed Then it renders in a sandboxed iframe
- Given a code artifact When previewed Then syntax highlighting is applied
- Given an artifact panel When toggling preview/code Then the view switches instantly
- Given an artifact with multiple versions When navigating Then version history is accessible

**Key files** :
- `ui/src/components/chat/ArtifactRenderer.tsx` — HTML iframe, code highlighting
- `ui/src/components/chat/ArtifactPanel.tsx` — Preview/code toggle
- `ui/src/components/chat/ArtifactVersionHistory.tsx` — Version history navigation
- `ui/src/components/chat/DocumentDropZone.tsx` — Document drag-and-drop upload
- `ui/src/components/chat/DocumentStatusBadge.tsx` — Ingestion status display
- `ui/src/components/chat/DocumentModeSelector.tsx` — Document mode selector

---

## Dependances entre stories

```
CHAT-01 (completion) ──→ CHAT-08 (slash/mentions)
CHAT-01 (completion) ──→ CHAT-14 (tool_use)
CHAT-01 (completion) ──→ CHAT-15 (streaming)
CHAT-02 (artifacts)  ──→ CHAT-14 (tool_use)
CHAT-02 (artifacts)  ──→ CHAT-18 (preview)
CHAT-03 (documents)  ──→ CHAT-04 (RAG)
CHAT-03 (documents)  ──→ CHAT-16 (embeddings)
CHAT-03 (documents)  ──→ CHAT-17 (summarization)
CHAT-04 (RAG)        ──→ CHAT-01 (context enrichment)
CHAT-05 (folders)    ──→ CHAT-07 (context links)
CHAT-05 (folders)    ──→ CHAT-11 (UI folders)
CHAT-06 (sharing)    ──→ CHAT-11 (UI shared chat)
CHAT-09 (WS)         ──→ CHAT-15 (streaming)
CHAT-10 (UI chat)    ──→ CHAT-18 (preview)
CHAT-12 (perms)      ──→ CHAT-13 (security)
```

---

## DB Schema (migration 0055)

### New tables (8)

| Table | Description |
|-------|-------------|
| `artifacts` | First-class versioned entities (code, HTML, markdown, table) |
| `artifact_versions` | Immutable version history for artifacts |
| `artifact_deployments` | Deployment tracking for artifacts |
| `documents` | Uploaded documents with ingestion status |
| `document_chunks` | Text chunks with pgvector embeddings |
| `folders` | Named spaces with tag-based visibility |
| `folder_items` | Join table (folder <> artifact/document/chat) |
| `chat_context_links` | Context links (chat <> document/artifact/folder/chat) |

### Altered tables (2)

| Table | Change |
|-------|--------|
| `chat_shares` | Share links with token, permissions (read/fork), expiry |
| `chat_messages` | Additional metadata for artifact references, tool_use results |

### New permissions (13)

Chat: `chat.create`, `chat.read`, `chat.share`, `chat.fork`
Documents: `documents.upload`, `documents.read`, `documents.delete`
Artifacts: `artifacts.create`, `artifacts.read`, `artifacts.edit`, `artifacts.delete`
Folders: `folders.create`, `folders.manage`
