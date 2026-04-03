# Chat Collaboratif + Documents + Folders — Design Spec

> **Status:** Phase 1 IMPLEMENTED (2026-04-03). All features in this spec are built and deployed.
> See `_bmad-output/planning-artifacts/epic-collaborative-chat.md` for story tracking.

> **Pour les workers agentiques :** REQUIRED SUB-SKILL: Utiliser superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour implémenter ce plan tâche par tâche.

**Goal:** Transformer le chat 1-1 existant (user ↔ agent) en plateforme de collaboration avec gestion documentaire, artefacts structurés, Folders réutilisables, et partage entre membres.

**Phases:**
- **Phase 1 (ce spec)** — Chat amélioré + Documents + Artefacts + Folders + Partage
- **Phase 2 (futur)** — Workflow integration (étapes chat interactif, validation humaine dans les workflows)

---

## 1. Architecture Overview

### Principes

- **Chat-first** : le chat existant (`chat_channels` + `chat_messages` + WebSocket) est la base — on l'étend, on ne le remplace pas.
- **Artefacts first-class** : les artefacts (PRD, code, résumé...) vivent dans leur propre table, versionnés, indépendants du chat qui les a créés.
- **Folders** : espaces nommés de docs/artefacts réutilisables entre chats, partageables par tags.
- **Stockage flexible** : abstraction provider existante (table `assets`, champ `provider`). Pas de dépendance à S3 — doit supporter l'infra CBA.
- **RAG pgvector** : embeddings en base PostgreSQL, pas de service vectoriel externe.
- **Tag-based isolation** : même modèle que le reste de MnM — les Folders, artefacts, et chats partagés respectent l'isolation par tags.
- **Pas de polling** : toutes les mises à jour temps réel via le WebSocket chat existant + live events.

### Composants

```
┌─────────────────────────────────────────────────────────────┐
│                        UI (React)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Chat View │  │ Artifact │  │ Folders  │  │ Share /    │  │
│  │ + Drop    │  │ Panel    │  │ Page     │  │ Fork UI    │  │
│  │ Zone      │  │ (split)  │  │          │  │            │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     API (Express)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Chat     │  │ Document │  │ Artifact │  │ Folder     │  │
│  │ Routes   │  │ Routes   │  │ Routes   │  │ Routes     │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Services                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Chat     │  │ Ingestion│  │ Artifact │  │ Folder     │  │
│  │ (extend) │  │ Pipeline │  │ Service  │  │ Service    │  │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├────────────┤  │
│  │ Share    │  │ RAG /    │  │ Skill    │  │ Context    │  │
│  │ Service  │  │ Retrieval│  │ Resolver │  │ Linker     │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Data (PostgreSQL)                        │
│  chat_channels | chat_messages | artifacts | documents      │
│  document_chunks (pgvector) | folders | folder_items        │
│  chat_shares | chat_context_links | artifact_versions       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model

### 2.1 Nouvelles tables

#### `documents`

Métadonnées d'un fichier uploadé, avec tracking du pipeline d'ingestion.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `company_id` | uuid FK → companies | Tenant isolation |
| `asset_id` | uuid FK → assets | Fichier brut stocké |
| `title` | text | Nom affiché (default: filename) |
| `mime_type` | text | `application/pdf`, `image/png`, etc. |
| `byte_size` | bigint | Taille en octets |
| `page_count` | int | Nombre de pages (si applicable) |
| `token_count` | int | Tokens estimés après extraction |
| `ingestion_status` | text | `pending` \| `extracting` \| `chunking` \| `ready` \| `error` |
| `ingestion_error` | text | Message d'erreur si échec |
| `summary` | text | Résumé auto-généré (si demandé) |
| `extracted_text` | text | Texte brut extrait (pour petits docs) |
| `metadata` | jsonb | Métadonnées extraites (auteur, date, langue...) |
| `created_by_user_id` | uuid FK → users | Owner |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Index :** `(company_id, created_at)`, `(company_id, ingestion_status)`, `(created_by_user_id)`

#### `document_chunks`

Chunks pour RAG avec embeddings pgvector.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `document_id` | uuid FK → documents ON DELETE CASCADE | |
| `company_id` | uuid FK → companies | Dénormalisé pour RLS |
| `chunk_index` | int | Position dans le document |
| `content` | text | Texte du chunk |
| `token_count` | int | Tokens dans ce chunk |
| `embedding` | vector(1536) | pgvector embedding |
| `metadata` | jsonb | `{ page: 5, section: "3.2", heading: "..." }` |
| `created_at` | timestamp | |

**Index :** `(document_id, chunk_index)`, index HNSW sur `embedding` pour recherche vectorielle, `(company_id)` pour RLS

#### `artifacts`

Entité first-class pour tout contenu structuré produit par un agent ou un user.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `company_id` | uuid FK → companies | |
| `title` | text | Nom de l'artefact |
| `artifact_type` | text | `markdown` \| `code` \| `table` \| `diagram` \| `image` \| `structured` |
| `language` | text | Pour `code` : langage (ts, python...). Pour `structured` : format (json, yaml) |
| `current_version_id` | uuid FK → artifact_versions | Version active |
| `source_channel_id` | uuid FK → chat_channels | Chat qui l'a produit (nullable) |
| `source_message_id` | uuid FK → chat_messages | Message qui l'a produit (nullable) |
| `created_by_user_id` | uuid FK → users | Nullable (peut être créé par agent) |
| `created_by_agent_id` | uuid FK → agents | Nullable |
| `metadata` | jsonb | Flexible (tags, labels...) |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Index :** `(company_id, created_at)`, `(source_channel_id)`, `(created_by_user_id)`, `(created_by_agent_id)`

#### `artifact_versions`

Historique des versions d'un artefact.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `artifact_id` | uuid FK → artifacts ON DELETE CASCADE | |
| `version_number` | int | Auto-incrémenté par artefact |
| `content` | text | Contenu complet de cette version |
| `change_summary` | text | Description du changement (nullable) |
| `created_by_user_id` | uuid FK → users | Qui a édité (nullable) |
| `created_by_agent_id` | uuid FK → agents | Nullable |
| `created_at` | timestamp | |

**Index :** `(artifact_id, version_number)` UNIQUE

#### `folders`

Espace nommé de docs/artefacts réutilisables.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `company_id` | uuid FK → companies | |
| `name` | text | Nom du folder |
| `description` | text | Nullable |
| `icon` | text | Emoji ou icon name (nullable) |
| `visibility` | text | `private` \| `shared` |
| `owner_user_id` | uuid FK → users | Créateur |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Index :** `(company_id, owner_user_id)`, `(company_id, visibility)`

**Visibilité :** `private` = owner uniquement. `shared` = visible par les users partageant au moins 1 tag avec le owner (même pattern que config layers).

#### `folder_items`

Join polymorphique : folder ↔ (artifact | document | chat_link).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `folder_id` | uuid FK → folders ON DELETE CASCADE | |
| `company_id` | uuid FK → companies | Dénormalisé pour RLS |
| `item_type` | text | `artifact` \| `document` \| `chat_link` |
| `artifact_id` | uuid FK → artifacts | Nullable |
| `document_id` | uuid FK → documents | Nullable |
| `channel_id` | uuid FK → chat_channels | Nullable (pour chat_link) |
| `display_name` | text | Nom affiché custom (nullable, sinon dérivé) |
| `added_by_user_id` | uuid FK → users | |
| `added_at` | timestamp | |

**Contrainte :** CHECK exactement un des 3 FK est non-null selon `item_type`.
**Index :** `(folder_id, item_type)`, `(artifact_id)`, `(document_id)`, `(channel_id)`

#### `chat_shares`

Liens de partage de conversations.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `company_id` | uuid FK → companies | |
| `channel_id` | uuid FK → chat_channels | Chat partagé |
| `shared_by_user_id` | uuid FK → users | Qui partage |
| `share_token` | text UNIQUE | Token pour l'URL de partage |
| `permission` | text | `read` \| `fork` |
| `expires_at` | timestamp | Nullable (pas d'expiration = permanent) |
| `revoked_at` | timestamp | Nullable (soft-revoke) |
| `created_at` | timestamp | |

**Index :** `(share_token)` UNIQUE, `(channel_id)`, `(company_id, shared_by_user_id)`

#### `chat_context_links`

Documents, artefacts, ou chats importés comme contexte dans un chat.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `channel_id` | uuid FK → chat_channels | Chat qui importe le contexte |
| `company_id` | uuid FK → companies | |
| `link_type` | text | `document` \| `artifact` \| `folder` \| `chat` |
| `document_id` | uuid FK → documents | Nullable |
| `artifact_id` | uuid FK → artifacts | Nullable |
| `folder_id` | uuid FK → folders | Nullable |
| `linked_channel_id` | uuid FK → chat_channels | Nullable |
| `added_by_user_id` | uuid FK → users | |
| `added_at` | timestamp | |

**Contrainte :** CHECK exactement un des 4 FK est non-null selon `link_type`.
**Index :** `(channel_id, link_type)`, `(document_id)`, `(artifact_id)`, `(folder_id)`

### 2.2 Tables existantes modifiées

#### `chat_channels`

```sql
ALTER TABLE chat_channels
  ADD COLUMN folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  ADD COLUMN forked_from_channel_id uuid REFERENCES chat_channels(id) ON DELETE SET NULL,
  ADD COLUMN fork_point_message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL;
```

- `folder_id` : folder attaché au chat (contexte auto de tous ses items)
- `forked_from_channel_id` : si ce chat est un fork, pointe vers l'original
- `fork_point_message_id` : le dernier message copié lors du fork

#### `chat_messages`

```sql
ALTER TABLE chat_messages
  ADD COLUMN artifact_id uuid REFERENCES artifacts(id) ON DELETE SET NULL,
  ADD COLUMN document_id uuid REFERENCES documents(id) ON DELETE SET NULL;
```

- `artifact_id` : si ce message est une référence à un artefact (panneau latéral)
- `document_id` : si ce message est un upload de document
- `message_type` existant déjà : on ajoute les valeurs `artifact_reference`, `document_upload`, `skill_invocation`, `agent_delegation`

---

## 3. Document Ingestion Pipeline

### 3.1 Upload flow

```
User drops file in chat or folder
  → POST /api/documents/upload (multipart)
  → Asset created (storage provider abstraction)
  → Document record created (status: "pending")
  → Ingestion job enqueued (BullMQ via Redis)
  → Response immédiate avec document.id + status "pending"
  → WS notification: { type: "document_status", documentId, status: "pending" }
```

### 3.2 Ingestion job

```
Job picks up document
  → document.status = "extracting"
  → WS notification

  1. Extraction selon mime_type:
     ├── application/pdf → pdf-parse (texte + structure par page)
     ├── image/* → Vision LLM (description textuelle) OU tesseract OCR
     ├── application/vnd.openxmlformats* (xlsx, pptx, docx) → librairies dédiées
     ├── text/*, application/json, application/yaml → direct
     └── Autre → skip extraction, fichier disponible en téléchargement brut

  2. Estimation token_count sur le texte extrait

  3. Si token_count > 100_000 (gros doc):
     → document.status = "chunking"
     → Chunking sémantique (par section/heading, fallback: sliding window 1000 tokens, overlap 200)
     → Embedding de chaque chunk (modèle configurable via env var EMBEDDING_MODEL)
     → INSERT document_chunks avec embeddings

  4. Si token_count <= 100_000 (petit doc):
     → Stocke extracted_text directement sur le document
     → Pas de chunking nécessaire (rentre en contexte)

  5. document.status = "ready"
  → WS notification: { type: "document_status", documentId, status: "ready" }
```

### 3.3 Mode d'utilisation dans le chat

Quand l'user a drop un doc et que l'ingestion est "ready", il choisit :

- **Résumé rapide** : l'agent génère un résumé hiérarchique (global + par section). Le résumé est sauvé comme artefact (`artifact_type: "markdown"`) + `document.summary`.
- **Deep dive** : mode RAG activé. À chaque message de l'user, le service fait une recherche vectorielle dans `document_chunks` (cosine similarity top-K), injecte les chunks pertinents dans le contexte de l'agent.

### 3.4 RAG Retrieval

```
User sends message in chat with RAG-enabled documents
  → Embed the user message
  → SELECT from document_chunks
      WHERE document_id IN (docs linked to this chat)
      ORDER BY embedding <=> user_embedding
      LIMIT 10
  → Inject top chunks as context prefix in agent prompt
  → Agent responds with grounded information
```

**Config :** `topK` (default 10), `similarityThreshold` (default 0.7), `maxContextTokens` (default 8000).

---

## 4. Artifacts & Side Panel

### 4.1 Artifact lifecycle

1. **Création** : l'agent génère du contenu structuré → détection automatique du type (markdown si headers/listes, code si blocs de code, table si données tabulaires, etc.)
2. **Message** : un `chat_message` est créé avec `message_type: "artifact_reference"` et `artifact_id` pointant vers l'artefact
3. **Affichage** : le panneau latéral s'ouvre automatiquement avec le rendu approprié
4. **Édition** : user ou agent peut modifier → nouvelle `artifact_version` créée, `current_version_id` mis à jour
5. **Sauvegarde** : bouton "Save to Folder" → crée un `folder_item`
6. **Réutilisation** : l'artefact peut être référencé dans d'autres chats via `chat_context_links`

### 4.2 Détection automatique du type

L'agent tag explicitement ses artefacts via un format de message structuré :

```json
{
  "type": "artifact",
  "artifactType": "markdown",
  "title": "PRD — Feature X",
  "content": "# PRD\n\n## Contexte\n..."
}
```

Si l'agent ne tag pas, heuristique côté serveur :
- Contient des blocs ``` → `code`
- Contient des headers markdown → `markdown`
- Contient des `|` en colonnes → `table`
- JSON/YAML valide → `structured`
- Fallback → `markdown`

### 4.3 Side panel UX

- **Layout** : split view — chat occupe 2/3 gauche, panneau artefact 1/3 droit (redimensionnable)
- **Rendu** : markdown rendered, code avec syntax highlighting, tables formatées
- **Actions** : Copy, Download, Save to Folder, View History (versions), Edit
- **Édition** : textarea/editor in-place, preview live. Sauvegarde crée une nouvelle version.
- **Navigation** : si le chat a produit plusieurs artefacts, tabs ou liste dans le panneau
- **Fermeture** : clic sur X ou clic dans le chat = panneau se referme

---

## 5. Skills, Slash Commands & @Mentions

### 5.1 Slash commands

**Résolution :**
```
User types "/summarize" in chat
  → Chat service intercepte (prefix "/")
  → Lookup dans: skills des config layers de l'agent + built-in commands
  → Match trouvé → exécution
  → Résultat posté comme message(s) dans le chat
  → Si le résultat est structuré → artefact créé automatiquement
```

**Built-in commands (Phase 1) :**
| Commande | Description |
|----------|-------------|
| `/summarize` | Résume le contexte courant (docs, chat history) |
| `/summarize-doc @doc` | Résume un document spécifique |
| `/deep-dive @doc` | Active le mode RAG sur un document |
| `/export` | Exporte l'artefact courant (markdown, PDF) |
| `/save @folder` | Sauve l'artefact courant dans un Folder |
| `/help` | Liste les commandes disponibles |

**Skills custom :** Les skills définies dans les config layers de l'agent sont exposées comme slash commands additionnelles. Le nom de la skill = le nom de la commande.

### 5.2 @Mentions

```
User types "@designer make a wireframe for this feature"
  → Chat service parse le @mention
  → Lookup agent "designer" dans le scope accessible (tag isolation)
  → Si trouvé et accessible:
      → Route le message via A2A bus (sendMessage)
      → L'agent mentionné reçoit le contexte du chat + le message
      → Sa réponse est postée dans le même chat channel
      → senderType: "agent", senderId: designer.id
  → Si non trouvé: message d'erreur inline
```

**Permissions :** L'user doit avoir au moins 1 tag en commun avec l'agent mentionné (tag isolation standard).

### 5.3 Auto-délégation

L'agent principal peut décider de sous-traiter automatiquement :
- Un message système discret est posté : "Délègue à @agent-name..."
- Le sub-agent travaille via A2A bus
- Le résultat remonte dans le chat comme message de l'agent principal (avec metadata indiquant la délégation)
- Transparent pour l'user mais traçable

---

## 6. Folders

### 6.1 CRUD

| Route | Description |
|-------|-------------|
| `POST /api/folders` | Créer un folder |
| `GET /api/folders` | Lister mes folders (+ shared accessibles) |
| `GET /api/folders/:id` | Détail avec items |
| `PATCH /api/folders/:id` | Update name, description, visibility |
| `DELETE /api/folders/:id` | Supprimer (soft-delete ou cascade items?) |
| `POST /api/folders/:id/items` | Ajouter un item (artifact, document, chat_link) |
| `DELETE /api/folders/:id/items/:itemId` | Retirer un item |

### 6.2 Visibilité & accès

- **private** : seul le owner voit et utilise le folder
- **shared** : visible par les users partageant au moins 1 tag avec le owner (tag-based isolation standard MnM)
- Admin voit tous les folders

### 6.3 Utilisation dans le chat

- À la création d'un chat, option "Attacher un Folder"
- `chat_channels.folder_id` est set
- L'agent a automatiquement accès à tous les items du folder comme contexte
- Pour les gros docs dans le folder : RAG activé automatiquement
- Pour les petits docs/artefacts : injectés directement dans le contexte
- On peut aussi attacher un folder en cours de conversation

### 6.4 UI

- Page "Folders" dans la sidebar (icône Folder)
- Vue grille ou liste des folders
- Clic sur un folder → vue détail avec ses items (artefacts, docs, liens chat)
- Drag & drop pour ajouter des items
- Depuis un chat : bouton "Save to Folder" sur chaque artefact/document

---

## 7. Partage

### 7.1 Partage de chat

```
User clicks "Share" on a chat
  → Choix: Read Only | Read + Fork
  → Génère un share_token unique
  → URL: /shared/chat/{share_token}
  → Le destinataire (même company, vérifié par auth) voit le chat en lecture
  → Si permission "fork": bouton "Continue this conversation" → fork
```

**Fork :**
- Crée un nouveau `chat_channel` avec `forked_from_channel_id` et `fork_point_message_id`
- Copie tous les messages jusqu'au fork point
- Copie les `chat_context_links` (docs/artefacts liés)
- Le nouveau chat appartient à l'user qui fork
- L'user peut continuer la conversation avec son propre agent

### 7.2 Partage d'artefacts

- Via Folder partagé (mécanisme principal)
- Ou lien direct : l'artefact est accessible si l'user a les permissions (tag-based)
- Un artefact dans un Folder shared est visible par tous les users qui voient le Folder

### 7.3 Import de contexte

Quand un user crée ou continue un chat, il peut :
- **Drag & drop** un fichier de son PC → upload + ingestion
- **Drag & drop** un artefact/doc depuis un Folder → `chat_context_link` créé
- **Coller un lien** de chat partagé → `chat_context_link` type "chat" → l'agent a accès à l'historique du chat lié
- **Coller un lien** d'artefact → `chat_context_link` type "artifact"

---

## 8. API Routes (nouvelles)

### Documents
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/documents/upload` | Upload fichier (multipart) |
| GET | `/api/documents` | Liste mes documents |
| GET | `/api/documents/:id` | Détail + statut ingestion |
| GET | `/api/documents/:id/content` | Télécharger le fichier brut |
| DELETE | `/api/documents/:id` | Soft-delete (garde l'asset, masque le document) |
| POST | `/api/documents/:id/summarize` | Déclencher résumé |
| GET | `/api/documents/:id/chunks` | Voir les chunks (debug) |

### Artifacts
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/artifacts` | Créer manuellement |
| GET | `/api/artifacts` | Liste (filtre par channel, folder, type) |
| GET | `/api/artifacts/:id` | Détail avec version courante |
| PATCH | `/api/artifacts/:id` | Update (crée nouvelle version) |
| DELETE | `/api/artifacts/:id` | Supprimer |
| GET | `/api/artifacts/:id/versions` | Historique des versions |
| GET | `/api/artifacts/:id/versions/:versionId` | Contenu d'une version |

### Folders
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/folders` | Créer |
| GET | `/api/folders` | Liste (mes + shared accessibles) |
| GET | `/api/folders/:id` | Détail avec items |
| PATCH | `/api/folders/:id` | Update |
| DELETE | `/api/folders/:id` | Supprimer (détache les items, ne supprime pas les artefacts/docs sous-jacents) |
| POST | `/api/folders/:id/items` | Ajouter item |
| DELETE | `/api/folders/:id/items/:itemId` | Retirer item |

### Sharing
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/chat/channels/:id/share` | Créer un lien de partage |
| GET | `/api/shared/chat/:token` | Accéder à un chat partagé |
| POST | `/api/shared/chat/:token/fork` | Fork un chat partagé |
| DELETE | `/api/chat/shares/:id` | Révoquer un partage |
| GET | `/api/chat/channels/:id/shares` | Lister les partages actifs |

### Context Links
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/chat/channels/:id/context` | Ajouter un lien de contexte |
| GET | `/api/chat/channels/:id/context` | Lister le contexte lié |
| DELETE | `/api/chat/channels/:id/context/:linkId` | Retirer un lien |

---

## 9. WebSocket Extensions

Le WebSocket chat existant (`/ws/chat/:channelId`) est étendu avec de nouveaux types de messages :

### Client → Server (nouveaux)

| Type | Payload | Description |
|------|---------|-------------|
| `slash_command` | `{ command, args }` | Invoque une slash command |
| `mention_agent` | `{ agentName, message }` | @mention un agent |
| `upload_complete` | `{ documentId }` | Notifie qu'un upload est terminé |

### Server → Client (nouveaux)

| Type | Payload | Description |
|------|---------|-------------|
| `artifact_created` | `{ artifactId, title, type }` | Un artefact a été produit |
| `artifact_updated` | `{ artifactId, versionNumber }` | Un artefact a été modifié |
| `document_status` | `{ documentId, status, error? }` | Progression ingestion |
| `agent_delegating` | `{ fromAgent, toAgent, task }` | Indication de délégation |
| `context_added` | `{ linkType, itemId }` | Un contexte a été ajouté au chat |
| `command_result` | `{ command, success, error? }` | Résultat d'une slash command |

---

## 10. UI Components (nouveaux)

### Pages

| Composant | Route | Description |
|-----------|-------|-------------|
| `FoldersPage` | `/folders` | Liste des folders avec CRUD |
| `FolderDetailPage` | `/folders/:id` | Contenu d'un folder |
| `SharedChatPage` | `/shared/chat/:token` | Vue lecture d'un chat partagé |

### Composants chat (modifiés/nouveaux)

| Composant | Description |
|-----------|-------------|
| `ChatView` | Refactor de la page Chat existante avec split panel |
| `ArtifactPanel` | Panneau latéral (1/3 droit) pour afficher/éditer artefacts |
| `ArtifactRenderer` | Rendu selon le type (markdown, code, table, diagram) |
| `ArtifactVersionHistory` | Historique des versions avec diff |
| `DocumentDropZone` | Zone de drag & drop pour upload de fichiers |
| `DocumentStatusBadge` | Badge de progression d'ingestion |
| `DocumentModeSelector` | Choix "Résumé rapide" vs "Deep dive" |
| `SlashCommandAutocomplete` | Autocomplete pour slash commands (popup au "/") |
| `AgentMentionAutocomplete` | Autocomplete pour @mentions (popup au "@") |
| `ContextLinkBar` | Barre affichant les docs/artefacts/folders liés au chat |
| `ChatShareDialog` | Dialog de partage avec options read/fork |
| `ForkBanner` | Bannière indiquant que le chat est un fork |

### Composants folders

| Composant | Description |
|-----------|-------------|
| `FolderCard` | Card d'un folder dans la liste |
| `FolderItemList` | Liste des items dans un folder |
| `FolderPicker` | Sélecteur de folder (pour "Save to Folder") |
| `FolderAttachButton` | Bouton pour attacher un folder à un chat |

---

## 11. Permissions

Nouvelles permissions (catégorie "chat" et "folders") :

| Permission | Description |
|------------|-------------|
| `chat:share` | Partager un chat |
| `chat:fork` | Fork un chat partagé |
| `documents:upload` | Upload des documents |
| `documents:read` | Voir les documents |
| `documents:delete` | Supprimer des documents |
| `artifacts:read` | Voir les artefacts |
| `artifacts:edit` | Éditer des artefacts |
| `artifacts:delete` | Supprimer des artefacts |
| `folders:create` | Créer des folders |
| `folders:read` | Voir les folders (+ shared) |
| `folders:edit` | Modifier ses folders |
| `folders:delete` | Supprimer ses folders |
| `folders:share` | Partager des folders |

---

## 12. Infrastructure & Dependencies

### Nouvelles dépendances

| Package | Usage | Côté |
|---------|-------|------|
| `pgvector` | Extension PostgreSQL pour embeddings | DB |
| `pdf-parse` ou `pdfjs-dist` | Extraction texte PDF | Server |
| `tesseract.js` | OCR images (optionnel, fallback si pas de vision LLM) | Server |
| `xlsx` | Extraction données tableurs | Server |
| `bullmq` | Queue de jobs async (ingestion pipeline) | Server |
| `@codemirror/lang-*` ou `monaco-editor` | Éditeur code dans artifact panel | UI |

### Configuration

| Env var | Description | Default |
|---------|-------------|---------|
| `EMBEDDING_MODEL` | Modèle pour les embeddings | `text-embedding-3-small` |
| `EMBEDDING_PROVIDER` | Provider (openai, local, etc.) | `openai` |
| `EMBEDDING_DIMENSIONS` | Dimension des vecteurs | `1536` |
| `RAG_TOP_K` | Nombre de chunks retournés | `10` |
| `RAG_SIMILARITY_THRESHOLD` | Seuil de similarité cosine | `0.7` |
| `RAG_MAX_CONTEXT_TOKENS` | Max tokens de contexte RAG | `8000` |
| `INGESTION_CONCURRENCY` | Workers concurrents pour ingestion | `3` |
| `MAX_UPLOAD_SIZE_MB` | Taille max d'upload | `100` |

---

## 13. Phase 2 — Vision future (hors scope)

Pour mémoire, la Phase 2 ajoutera :

- **Workflow chat steps** : nouveau type d'étape dans les workflow templates → ouvre un chat interactif avec un agent configuré, le workflow attend la complétion du chat
- **Human-in-the-loop validation** : étape de validation manuelle dans un workflow → un user doit approuver/rejeter avant que le workflow continue
- **Chat-to-ticket** : convertir le résultat d'une collaboration chat en ticket/issue MnM avec tous les artefacts attachés
- **Templates de conversation** : pré-configurer des chats avec des prompts système, des skills, et des docs pré-attachés

---

## 14. Migration Strategy

1. **Extension PostgreSQL** : `CREATE EXTENSION IF NOT EXISTS vector` (pgvector)
2. **Nouvelles tables** : migration séquentielle (documents → document_chunks → artifacts → artifact_versions → folders → folder_items → chat_shares → chat_context_links)
3. **ALTER tables existantes** : chat_channels (folder_id, forked_from_channel_id, fork_point_message_id), chat_messages (artifact_id, document_id)
4. **Permissions seed** : ajouter les 13 nouvelles permissions
5. **BullMQ setup** : réutilise le Redis existant, nouvelle queue "document-ingestion"
6. **Zero-downtime** : toutes les nouvelles colonnes sont nullable, pas de breaking change sur les routes existantes
