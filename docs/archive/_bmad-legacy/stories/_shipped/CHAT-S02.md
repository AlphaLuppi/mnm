# CHAT-S02 : Tables Chat -- Enrichissement Schema et Service

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CHAT-S02 |
| **Titre** | Tables chat -- enrichissement schema, colonnes, contraintes et service |
| **Epic** | Epic CHAT -- Chat Temps Reel |
| **Sprint** | Sprint 3 (Batch 6) |
| **Effort** | S (2 SP, 1j) |
| **Priorite** | P0 -- Prerequis CHAT-S03, CHAT-S04 |
| **Assignation** | Tom (backend) |
| **Bloque par** | TECH-06 (10 nouvelles tables -- DONE), CHAT-S01 (WebSocket bidirectionnel -- DONE) |
| **Debloque** | CHAT-S03 (ChatService pipe stdin), CHAT-S04 (AgentChatPanel UI) |
| **ADR** | ADR-005 (Chat Temps Reel -- WebSocket Bidirectionnel) |
| **Type** | Backend (schema + service + migration) |
| **FRs couverts** | REQ-CHAT-02 (dialogue pendant execution), REQ-CHAT-04 (read-only viewer) |

---

## Description

### Contexte -- Pourquoi cette story existe

TECH-06 a cree les tables `chat_channels` et `chat_messages` avec un schema minimal. CHAT-S01 a construit le service complet de chat (WebSocket bidirectionnel, REST routes, ChatWsManager). Cependant, pour supporter les stories en aval (CHAT-S03 : pipe stdin agent, CHAT-S04 : AgentChatPanel UI), le schema et le service ont besoin d'enrichissements :

1. **`chat_channels`** manque de colonnes essentielles pour le contexte conversationnel : `projectId` (lien avec le projet en cours), `createdBy` (user qui a initie le chat), `description` (description du but de la conversation pour l'agent), et `lastMessageAt` (tri rapide par activite recente pour l'UI).
2. **`chat_messages`** manque de colonnes pour le support CHAT-S03 et CHAT-S04 : `editedAt` (edition de messages), `deletedAt` (soft-delete), `replyToId` (threading de messages), et `messageType` (distinguer `text`, `system`, `command`, `file_reference`).
3. **Drizzle migration** pour ajouter les nouvelles colonnes de maniere non-destructive (nullable, backward-compatible).
4. **Service enrichi** pour supporter les nouvelles colonnes dans les operations CRUD (query par projectId, tri par lastMessageAt, soft-delete, threading).
5. **Nouveau endpoint REST** : `PATCH /api/companies/:companyId/chat/channels/:channelId/messages/:messageId` pour editer/supprimer un message.

### Etat actuel du code

| Fichier | Etat | Role |
|---------|------|------|
| `packages/db/src/schema/chat_channels.ts` | Existe (24 lignes) | Table chat_channels : id, companyId, agentId, heartbeatRunId, name, status, closedAt, createdAt, updatedAt. 3 indexes |
| `packages/db/src/schema/chat_messages.ts` | Existe (29 lignes) | Table chat_messages : id, channelId, companyId, senderId, senderType, content, metadata, createdAt. 3 indexes |
| `server/src/services/chat.ts` | Existe (225 lignes) | Service CRUD : createChannel, getChannel, listChannels, closeChannel, createMessage, getMessages, getMessagesSince, getMessageCount |
| `server/src/services/chat-ws-manager.ts` | Existe (499 lignes) | WebSocket manager : connexions, broadcast, buffer, rate limiting, Redis pub/sub |
| `server/src/routes/chat.ts` | Existe (134 lignes) | 4 routes REST : POST channels, GET channels, GET channels/:id, GET channels/:id/messages, PATCH channels/:id |
| `server/src/realtime/chat-ws.ts` | Existe (458 lignes) | Serveur WebSocket /ws/chat/:channelId avec auth et validation |
| `server/src/validators/chat-ws.ts` | Existe (36 lignes) | Schemas Zod : chatClientPayloadSchema, createChannelSchema |
| `packages/shared/src/types/chat-ws.ts` | Existe (95 lignes) | Types protocole : ChatClientPayload, ChatServerPayload |
| `packages/db/src/schema/index.ts` | Existe | Exporte chatChannels et chatMessages |

### Ce que cette story construit

1. **Enrichissement schema `chat_channels`** -- 4 nouvelles colonnes : `projectId`, `createdBy`, `description`, `lastMessageAt`
2. **Enrichissement schema `chat_messages`** -- 4 nouvelles colonnes : `messageType`, `replyToId`, `editedAt`, `deletedAt`
3. **Nouveaux indexes** -- `chat_channels_company_project_idx`, `chat_channels_company_last_msg_idx`, `chat_messages_reply_to_idx`
4. **Drizzle migration** -- fichier de migration non-destructif (ALTER TABLE ADD COLUMN, toutes nullable)
5. **Service enrichi** -- operations `updateMessage`, `softDeleteMessage`, `getThreadReplies`, filtre `projectId` dans `listChannels`, tri par `lastMessageAt`
6. **Route REST** -- `PATCH /api/companies/:companyId/chat/channels/:channelId/messages/:messageId` (edit/soft-delete)
7. **Validator enrichi** -- schemas Zod pour `createChannelSchema` (ajout projectId, description), `updateMessageSchema`
8. **Types partages enrichis** -- `ChatMessageType` type literal dans packages/shared

### Ce que cette story ne fait PAS

- Pas de pipe vers stdin de l'agent containerise (CHAT-S03)
- Pas de composant UI React AgentChatPanel (CHAT-S04)
- Pas de modification du WebSocket protocol (CHAT-S01 reste inchange)
- Pas de resume LLM des messages (OBS-S03)
- Pas de creation de nouvelles tables (tables existent deja via TECH-06)

---

## Specification Technique

### S1 : Schema `chat_channels` enrichi

**Fichier** : `packages/db/src/schema/chat_channels.ts`

Colonnes ajoutees (toutes nullable pour backward-compatibility) :

| Colonne | Type Drizzle | Type SQL | Default | Description |
|---------|-------------|----------|---------|-------------|
| `projectId` | `uuid("project_id")` | UUID | null | FK vers `projects.id`, lie le channel a un projet pour scoping |
| `createdBy` | `text("created_by")` | TEXT | null | userId de l'utilisateur qui a cree le channel (ou "system" si auto) |
| `description` | `text("description")` | TEXT | null | Description du but de la conversation (injecte dans le contexte agent) |
| `lastMessageAt` | `timestamp("last_message_at", { withTimezone: true })` | TIMESTAMPTZ | null | Timestamp du dernier message (denormalise pour tri rapide) |

Nouveaux indexes :

| Index | Colonnes | Justification |
|-------|----------|---------------|
| `chat_channels_company_project_idx` | `(companyId, projectId)` | Filtrage des channels par projet |
| `chat_channels_company_last_msg_idx` | `(companyId, lastMessageAt)` | Tri par activite recente dans l'UI |

Reference FK : `projectId` reference `projects.id` avec `onDelete: "set null"` (si un projet est supprime, le channel reste mais perd le lien).

### S2 : Schema `chat_messages` enrichi

**Fichier** : `packages/db/src/schema/chat_messages.ts`

Colonnes ajoutees (toutes nullable pour backward-compatibility) :

| Colonne | Type Drizzle | Type SQL | Default | Description |
|---------|-------------|----------|---------|-------------|
| `messageType` | `text("message_type")` | TEXT | `"text"` | Type du message : `text`, `system`, `command`, `file_reference` |
| `replyToId` | `uuid("reply_to_id")` | UUID | null | FK self-referentielle vers `chat_messages.id` pour threading |
| `editedAt` | `timestamp("edited_at", { withTimezone: true })` | TIMESTAMPTZ | null | Timestamp de la derniere edition (null = jamais edite) |
| `deletedAt` | `timestamp("deleted_at", { withTimezone: true })` | TIMESTAMPTZ | null | Soft-delete (null = actif) |

Nouveaux indexes :

| Index | Colonnes | Justification |
|-------|----------|---------------|
| `chat_messages_reply_to_idx` | `(replyToId)` | Requete des reponses a un message parent |

Reference FK : `replyToId` reference `chatMessages.id` (self-referentiel) avec `onDelete: "set null"` (si le message parent est supprime en dur, les reponses restent orphelines). Utilise `AnyPgColumn` pour la self-reference.

### S3 : Migration Drizzle

**Fichier** : nouvelle migration generee par `pnpm db:generate`

La migration ajoute les colonnes de maniere non-destructive :

```sql
-- chat_channels enrichment
ALTER TABLE "chat_channels" ADD COLUMN "project_id" UUID REFERENCES "projects"("id") ON DELETE SET NULL;
ALTER TABLE "chat_channels" ADD COLUMN "created_by" TEXT;
ALTER TABLE "chat_channels" ADD COLUMN "description" TEXT;
ALTER TABLE "chat_channels" ADD COLUMN "last_message_at" TIMESTAMPTZ;
CREATE INDEX "chat_channels_company_project_idx" ON "chat_channels" ("company_id", "project_id");
CREATE INDEX "chat_channels_company_last_msg_idx" ON "chat_channels" ("company_id", "last_message_at");

-- chat_messages enrichment
ALTER TABLE "chat_messages" ADD COLUMN "message_type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "chat_messages" ADD COLUMN "reply_to_id" UUID REFERENCES "chat_messages"("id") ON DELETE SET NULL;
ALTER TABLE "chat_messages" ADD COLUMN "edited_at" TIMESTAMPTZ;
ALTER TABLE "chat_messages" ADD COLUMN "deleted_at" TIMESTAMPTZ;
CREATE INDEX "chat_messages_reply_to_idx" ON "chat_messages" ("reply_to_id");
```

Toutes les colonnes sont nullable ou ont un default, donc les donnees existantes ne sont pas impactees.

### S4 : Types partages enrichis

**Fichier** : `packages/shared/src/types/chat-ws.ts` (modification)

Ajout du type :

```typescript
export type ChatMessageType = "text" | "system" | "command" | "file_reference";
```

### S5 : Service chat enrichi

**Fichier** : `server/src/services/chat.ts` (modification)

Nouvelles fonctions et modifications :

```typescript
// Modification createChannel -- accepter les nouvelles colonnes
async createChannel(companyId, agentId, opts?: {
  heartbeatRunId?: string;
  name?: string;
  projectId?: string;        // NOUVEAU
  createdBy?: string;        // NOUVEAU
  description?: string;      // NOUVEAU
})

// Modification createMessage -- mettre a jour lastMessageAt du channel
async createMessage(channelId, companyId, senderId, senderType, content, opts?: {
  metadata?: Record<string, unknown>;
  messageType?: string;      // NOUVEAU
  replyToId?: string;        // NOUVEAU
})

// Modification listChannels -- filtre projectId + tri par lastMessageAt
async listChannels(companyId, filters?: {
  status?: string;
  agentId?: string;
  projectId?: string;        // NOUVEAU
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "lastMessageAt"; // NOUVEAU
})

// NOUVELLE FONCTION -- editer un message
async updateMessage(messageId: string, channelId: string, opts: {
  content?: string;
  metadata?: Record<string, unknown>;
}): Promise<ChatMessage | null>

// NOUVELLE FONCTION -- soft-delete un message
async softDeleteMessage(messageId: string, channelId: string): Promise<ChatMessage | null>

// NOUVELLE FONCTION -- obtenir les reponses a un message
async getThreadReplies(parentMessageId: string, limit?: number): Promise<ChatMessage[]>

// Modification getMessages -- exclure les messages soft-deleted
async getMessages(channelId, opts?) // ajoute isNull(chatMessages.deletedAt) au WHERE
```

### S6 : Route REST pour edit/delete message

**Fichier** : `server/src/routes/chat.ts` (modification)

Ajout de la route :

```
PATCH /api/companies/:companyId/chat/channels/:channelId/messages/:messageId
  Body: { content?: string, deleted?: boolean }
  Response: 200 { id, channelId, content, editedAt, deletedAt, ... }
  Permission: chat:agent
  Validation:
    - Le message appartient au channel
    - Le channel appartient a la company
    - Seul l'auteur du message peut l'editer/supprimer (senderId === actorId)
    - Les messages "system" ne peuvent pas etre edites/supprimes

GET /api/companies/:companyId/chat/channels/:channelId/messages/:messageId/replies
  Query: ?limit=50
  Response: 200 { replies: [...], total: number }
  Permission: chat:agent
```

### S7 : Validators enrichis

**Fichier** : `server/src/validators/chat-ws.ts` (modification)

Ajouts :

```typescript
export const createChannelSchema = z.object({
  agentId: z.string().uuid(),
  heartbeatRunId: z.string().uuid().optional(),
  name: z.string().max(255).optional(),
  projectId: z.string().uuid().optional(),        // NOUVEAU
  description: z.string().max(2000).optional(),    // NOUVEAU
});

export const updateMessageSchema = z.object({
  content: z.string().min(1).max(4096).optional(),
  deleted: z.boolean().optional(),
});
```

---

## Acceptance Criteria

### AC-1 : Schema chat_channels -- nouvelles colonnes

```
Given le schema chat_channels existant
When la migration s'execute
Then 4 nouvelles colonnes sont ajoutees : project_id (UUID nullable FK), created_by (TEXT nullable), description (TEXT nullable), last_message_at (TIMESTAMPTZ nullable)
  And les donnees existantes ne sont pas impactees (toutes les colonnes sont nullable)
  And 2 nouveaux indexes sont crees : chat_channels_company_project_idx, chat_channels_company_last_msg_idx
```

### AC-2 : Schema chat_messages -- nouvelles colonnes

```
Given le schema chat_messages existant
When la migration s'execute
Then 4 nouvelles colonnes sont ajoutees : message_type (TEXT default 'text'), reply_to_id (UUID nullable FK self-ref), edited_at (TIMESTAMPTZ nullable), deleted_at (TIMESTAMPTZ nullable)
  And les donnees existantes ont message_type = 'text' par defaut
  And 1 nouvel index est cree : chat_messages_reply_to_idx
```

### AC-3 : FK chat_channels.projectId

```
Given un channel cree avec projectId = "<uuid-projet-existant>"
When on interroge le channel
Then le projectId est present et reference bien la table projects
Given un projet supprime
When on verifie les channels qui le referenceaient
Then projectId est mis a NULL (ON DELETE SET NULL)
```

### AC-4 : FK chat_messages.replyToId (self-reference)

```
Given un message M1 existant dans un channel
When un message M2 est cree avec replyToId = M1.id
Then M2 est persiste avec replyToId = M1.id
Given M1 est supprime en dur (DELETE)
When on verifie M2
Then M2.replyToId est mis a NULL (ON DELETE SET NULL)
```

### AC-5 : createChannel enrichi

```
Given un user avec permission chat:agent
When il appelle POST /api/companies/:companyId/chat/channels avec { agentId, projectId, description: "Discussion refactoring module X" }
Then le channel est cree avec projectId et description renseignes
  And createdBy est renseigne avec l'userId de l'appelant
  And la reponse 201 inclut les nouveaux champs
```

### AC-6 : lastMessageAt mis a jour

```
Given un channel existant avec lastMessageAt = null
When un message est envoye via WebSocket ou cree via service
Then le champ lastMessageAt du channel est mis a jour avec le timestamp du message
  And les appels suivants de listChannels avec sortBy = "lastMessageAt" trient correctement
```

### AC-7 : listChannels filtre par projectId

```
Given 3 channels : 2 lies au projet P1, 1 lie au projet P2
When le client appelle GET /api/companies/:companyId/chat/channels?projectId=P1
Then la reponse contient exactement les 2 channels du projet P1
```

### AC-8 : listChannels tri par lastMessageAt

```
Given 3 channels avec des lastMessageAt differents
When le client appelle GET /api/companies/:companyId/chat/channels?sortBy=lastMessageAt
Then les channels sont tries du plus recent au plus ancien (DESC)
  And les channels avec lastMessageAt = null sont a la fin
```

### AC-9 : createMessage avec messageType

```
Given un channel open
When un message est cree avec messageType = "system"
Then le message est persiste avec messageType = "system"
When un message est cree SANS messageType
Then le message est persiste avec messageType = "text" (defaut)
```

### AC-10 : createMessage avec replyToId (threading)

```
Given un message parent M1 dans un channel
When un message M2 est cree avec replyToId = M1.id
Then M2 est persiste avec replyToId = M1.id
When on appelle getThreadReplies(M1.id)
Then la reponse contient M2 (et tout autre reply a M1)
  And les replies sont ordonnees par createdAt ASC
```

### AC-11 : Editer un message

```
Given un message M1 envoye par l'user U1
When U1 appelle PATCH /api/companies/:companyId/chat/channels/:channelId/messages/M1 avec { content: "Contenu modifie" }
Then le contenu du message est mis a jour
  And editedAt est renseigne avec le timestamp courant
  And la reponse 200 inclut le message mis a jour avec editedAt non-null
```

### AC-12 : Editer un message -- auteur uniquement

```
Given un message M1 envoye par l'user U1
When l'user U2 appelle PATCH sur M1 avec { content: "Tentative" }
Then la reponse est 403 Forbidden
  And le message n'est PAS modifie
```

### AC-13 : Soft-delete un message

```
Given un message M1 envoye par l'user U1
When U1 appelle PATCH /api/companies/:companyId/chat/channels/:channelId/messages/M1 avec { deleted: true }
Then deletedAt est renseigne avec le timestamp courant
  And le message n'est PAS supprime physiquement de la base
  And les appels subsequents a getMessages excluent M1 des resultats
  And la reponse 200 inclut le message avec deletedAt non-null
```

### AC-14 : Messages system non-editables

```
Given un message M1 avec messageType = "system"
When un user appelle PATCH sur M1 avec { content: "Tentative" }
Then la reponse est 403 Forbidden avec message "System messages cannot be edited"
  And le message n'est PAS modifie
```

### AC-15 : REST replies endpoint

```
Given un message parent M1 avec 5 reponses
When le client appelle GET /api/companies/:companyId/chat/channels/:channelId/messages/M1/replies
Then la reponse contient les 5 reponses ordonnees par createdAt ASC
  And les messages soft-deleted sont exclus des reponses
```

### AC-16 : getMessages exclut les soft-deleted

```
Given un channel avec 10 messages dont 2 soft-deleted
When le client appelle GET /api/companies/:companyId/chat/channels/:channelId/messages
Then la reponse contient exactement 8 messages (les 2 soft-deleted sont exclus)
  And hasMore est calcule correctement en tenant compte des exclusions
```

### AC-17 : Migration backward-compatible

```
Given des channels et messages existants en DB (crees par CHAT-S01)
When la migration CHAT-S02 s'execute
Then aucune donnee existante n'est perdue
  And les channels existants ont projectId = null, createdBy = null, description = null, lastMessageAt = null
  And les messages existants ont messageType = 'text', replyToId = null, editedAt = null, deletedAt = null
  And le rollback de la migration est possible (DROP COLUMN)
```

### AC-18 : TypeScript compile sans erreur

```
Given les modifications au schema et au service
When on execute pnpm typecheck
Then aucune erreur TypeScript n'est reportee
  And tous les imports/exports sont corrects dans packages/db/src/schema/index.ts
```

---

## data-test-id

### Elements Schema / Migration

| Element | data-testid | Type | Verification |
|---------|-------------|------|-------------|
| Schema chat_channels projectId column | `data-testid="chat-s02-channels-project-id"` | Schema column | `projectId: uuid("project_id")` present dans le fichier |
| Schema chat_channels createdBy column | `data-testid="chat-s02-channels-created-by"` | Schema column | `createdBy: text("created_by")` present dans le fichier |
| Schema chat_channels description column | `data-testid="chat-s02-channels-description"` | Schema column | `description: text("description")` present dans le fichier |
| Schema chat_channels lastMessageAt column | `data-testid="chat-s02-channels-last-message-at"` | Schema column | `lastMessageAt: timestamp("last_message_at")` present dans le fichier |
| Index chat_channels_company_project_idx | `data-testid="chat-s02-idx-company-project"` | Index | `index("chat_channels_company_project_idx")` present |
| Index chat_channels_company_last_msg_idx | `data-testid="chat-s02-idx-company-last-msg"` | Index | `index("chat_channels_company_last_msg_idx")` present |
| Schema chat_messages messageType column | `data-testid="chat-s02-messages-message-type"` | Schema column | `messageType: text("message_type")` avec default `"text"` |
| Schema chat_messages replyToId column | `data-testid="chat-s02-messages-reply-to-id"` | Schema column | `replyToId: uuid("reply_to_id")` avec self-reference |
| Schema chat_messages editedAt column | `data-testid="chat-s02-messages-edited-at"` | Schema column | `editedAt: timestamp("edited_at")` present |
| Schema chat_messages deletedAt column | `data-testid="chat-s02-messages-deleted-at"` | Schema column | `deletedAt: timestamp("deleted_at")` present |
| Index chat_messages_reply_to_idx | `data-testid="chat-s02-idx-reply-to"` | Index | `index("chat_messages_reply_to_idx")` present |
| Migration file exists | `data-testid="chat-s02-migration-file"` | Migration | Migration SQL file generated in packages/db/drizzle/ |
| FK projects reference | `data-testid="chat-s02-fk-projects"` | FK constraint | `.references(() => projects.id, { onDelete: "set null" })` |
| FK self-reference replyToId | `data-testid="chat-s02-fk-reply-self-ref"` | FK constraint | `.references((): AnyPgColumn => chatMessages.id, { onDelete: "set null" })` |

### Elements Service

| Element | data-testid | Type | Verification |
|---------|-------------|------|-------------|
| createChannel with projectId | `data-testid="chat-s02-create-channel-project"` | Service function | `createChannel()` accepte `projectId` option |
| createChannel with createdBy | `data-testid="chat-s02-create-channel-created-by"` | Service function | `createChannel()` accepte `createdBy` option |
| createChannel with description | `data-testid="chat-s02-create-channel-description"` | Service function | `createChannel()` accepte `description` option |
| createMessage updates lastMessageAt | `data-testid="chat-s02-last-message-at-update"` | Service logic | `createMessage()` met a jour `chatChannels.lastMessageAt` |
| createMessage with messageType | `data-testid="chat-s02-create-message-type"` | Service function | `createMessage()` accepte `messageType` option |
| createMessage with replyToId | `data-testid="chat-s02-create-message-reply"` | Service function | `createMessage()` accepte `replyToId` option |
| updateMessage function | `data-testid="chat-s02-update-message"` | Service function | `updateMessage()` existe et met a jour content + editedAt |
| softDeleteMessage function | `data-testid="chat-s02-soft-delete-message"` | Service function | `softDeleteMessage()` existe et set deletedAt |
| getThreadReplies function | `data-testid="chat-s02-get-thread-replies"` | Service function | `getThreadReplies()` existe et retourne les reponses |
| getMessages excludes deleted | `data-testid="chat-s02-get-messages-exclude-deleted"` | Service logic | `getMessages()` filtre `isNull(chatMessages.deletedAt)` |
| listChannels projectId filter | `data-testid="chat-s02-list-channels-project-filter"` | Service logic | `listChannels()` accepte `projectId` filtre |
| listChannels sortBy lastMessageAt | `data-testid="chat-s02-list-channels-sort-last-msg"` | Service logic | `listChannels()` accepte `sortBy: "lastMessageAt"` |

### Elements Routes REST

| Element | data-testid | Type | Verification |
|---------|-------------|------|-------------|
| PATCH message endpoint | `data-testid="chat-s02-patch-message"` | API endpoint | `PATCH /companies/:companyId/chat/channels/:channelId/messages/:messageId` existe |
| PATCH message author check | `data-testid="chat-s02-patch-message-author-check"` | API logic | Verifie que l'appelant est l'auteur du message |
| PATCH message system check | `data-testid="chat-s02-patch-message-system-check"` | API logic | Refuse l'edition des messages system |
| GET replies endpoint | `data-testid="chat-s02-get-replies"` | API endpoint | `GET /companies/:companyId/chat/channels/:channelId/messages/:messageId/replies` existe |

### Elements Validators

| Element | data-testid | Type | Verification |
|---------|-------------|------|-------------|
| createChannelSchema projectId | `data-testid="chat-s02-validator-channel-project"` | Zod schema | `projectId: z.string().uuid().optional()` dans createChannelSchema |
| createChannelSchema description | `data-testid="chat-s02-validator-channel-description"` | Zod schema | `description: z.string().max(2000).optional()` dans createChannelSchema |
| updateMessageSchema | `data-testid="chat-s02-validator-update-message"` | Zod schema | `updateMessageSchema` exporte avec content/deleted |

### Elements Types Partages

| Element | data-testid | Type | Verification |
|---------|-------------|------|-------------|
| ChatMessageType type | `data-testid="chat-s02-chat-message-type"` | TypeScript type | `ChatMessageType` exporte depuis `packages/shared/src/types/chat-ws.ts` |

---

## Cas de Test pour QA (Playwright)

### Groupe 1 : Schema chat_channels -- nouvelles colonnes

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T01 | chat_channels.ts contient la colonne `projectId` avec uuid("project_id") | chat-s02-channels-project-id | File-content |
| T02 | chat_channels.ts contient la colonne `createdBy` avec text("created_by") | chat-s02-channels-created-by | File-content |
| T03 | chat_channels.ts contient la colonne `description` avec text("description") | chat-s02-channels-description | File-content |
| T04 | chat_channels.ts contient la colonne `lastMessageAt` avec timestamp("last_message_at") | chat-s02-channels-last-message-at | File-content |
| T05 | chat_channels.ts contient l'index `chat_channels_company_project_idx` sur (companyId, projectId) | chat-s02-idx-company-project | File-content |
| T06 | chat_channels.ts contient l'index `chat_channels_company_last_msg_idx` sur (companyId, lastMessageAt) | chat-s02-idx-company-last-msg | File-content |
| T07 | chat_channels.ts reference `projects.id` avec `onDelete: "set null"` | chat-s02-fk-projects | File-content |

### Groupe 2 : Schema chat_messages -- nouvelles colonnes

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T08 | chat_messages.ts contient la colonne `messageType` avec text("message_type") et default "text" | chat-s02-messages-message-type | File-content |
| T09 | chat_messages.ts contient la colonne `replyToId` avec uuid("reply_to_id") | chat-s02-messages-reply-to-id | File-content |
| T10 | chat_messages.ts contient la colonne `editedAt` avec timestamp("edited_at") | chat-s02-messages-edited-at | File-content |
| T11 | chat_messages.ts contient la colonne `deletedAt` avec timestamp("deleted_at") | chat-s02-messages-deleted-at | File-content |
| T12 | chat_messages.ts contient l'index `chat_messages_reply_to_idx` sur (replyToId) | chat-s02-idx-reply-to | File-content |
| T13 | chat_messages.ts contient la FK self-referentielle avec AnyPgColumn et onDelete: "set null" | chat-s02-fk-reply-self-ref | File-content |

### Groupe 3 : Migration

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T14 | Un fichier migration existe dans packages/db/drizzle/ contenant ALTER TABLE chat_channels ADD COLUMN | chat-s02-migration-file | File-content |
| T15 | La migration contient ALTER TABLE chat_messages ADD COLUMN | chat-s02-migration-file | File-content |
| T16 | La migration contient CREATE INDEX chat_channels_company_project_idx | chat-s02-migration-file | File-content |
| T17 | La migration contient CREATE INDEX chat_channels_company_last_msg_idx | chat-s02-migration-file | File-content |
| T18 | La migration contient CREATE INDEX chat_messages_reply_to_idx | chat-s02-migration-file | File-content |

### Groupe 4 : Service -- createChannel enrichi

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T19 | chat.ts createChannel accepte et persiste le parametre projectId | chat-s02-create-channel-project | File-content |
| T20 | chat.ts createChannel accepte et persiste le parametre createdBy | chat-s02-create-channel-created-by | File-content |
| T21 | chat.ts createChannel accepte et persiste le parametre description | chat-s02-create-channel-description | File-content |

### Groupe 5 : Service -- createMessage enrichi

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T22 | chat.ts createMessage met a jour chatChannels.lastMessageAt apres chaque message | chat-s02-last-message-at-update | File-content |
| T23 | chat.ts createMessage accepte et persiste le parametre messageType | chat-s02-create-message-type | File-content |
| T24 | chat.ts createMessage accepte et persiste le parametre replyToId | chat-s02-create-message-reply | File-content |

### Groupe 6 : Service -- nouvelles fonctions

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T25 | chat.ts exporte la fonction updateMessage | chat-s02-update-message | File-content |
| T26 | chat.ts updateMessage met a jour content et set editedAt | chat-s02-update-message | File-content |
| T27 | chat.ts exporte la fonction softDeleteMessage | chat-s02-soft-delete-message | File-content |
| T28 | chat.ts softDeleteMessage set deletedAt sans supprimer physiquement | chat-s02-soft-delete-message | File-content |
| T29 | chat.ts exporte la fonction getThreadReplies | chat-s02-get-thread-replies | File-content |
| T30 | chat.ts getThreadReplies filtre par replyToId et ordonne par createdAt | chat-s02-get-thread-replies | File-content |

### Groupe 7 : Service -- filtrage enrichi

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T31 | chat.ts getMessages filtre les messages avec deletedAt non-null (isNull check) | chat-s02-get-messages-exclude-deleted | File-content |
| T32 | chat.ts listChannels accepte le filtre projectId | chat-s02-list-channels-project-filter | File-content |
| T33 | chat.ts listChannels accepte le parametre sortBy avec option "lastMessageAt" | chat-s02-list-channels-sort-last-msg | File-content |

### Groupe 8 : Routes REST

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T34 | chat.ts routes contient PATCH /companies/:companyId/chat/channels/:channelId/messages/:messageId | chat-s02-patch-message | File-content |
| T35 | chat.ts routes verifie que l'appelant est l'auteur du message (senderId check) | chat-s02-patch-message-author-check | File-content |
| T36 | chat.ts routes refuse l'edition des messages avec messageType "system" | chat-s02-patch-message-system-check | File-content |
| T37 | chat.ts routes contient GET /companies/:companyId/chat/channels/:channelId/messages/:messageId/replies | chat-s02-get-replies | File-content |

### Groupe 9 : Validators

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T38 | chat-ws.ts createChannelSchema contient projectId optional uuid | chat-s02-validator-channel-project | File-content |
| T39 | chat-ws.ts createChannelSchema contient description optional max 2000 | chat-s02-validator-channel-description | File-content |
| T40 | chat-ws.ts exporte updateMessageSchema avec content et deleted | chat-s02-validator-update-message | File-content |

### Groupe 10 : Types partages

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T41 | chat-ws.ts dans packages/shared exporte le type ChatMessageType | chat-s02-chat-message-type | File-content |
| T42 | ChatMessageType inclut "text", "system", "command", "file_reference" | chat-s02-chat-message-type | File-content |

### Groupe 11 : Barrel exports

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T43 | packages/db/src/schema/index.ts exporte toujours chatChannels | chat-s02-channels-project-id | File-content |
| T44 | packages/db/src/schema/index.ts exporte toujours chatMessages | chat-s02-messages-message-type | File-content |
| T45 | packages/shared/src/types/index.ts re-exporte ChatMessageType | chat-s02-chat-message-type | File-content |

### Groupe 12 : TypeScript et backward-compatibility

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T46 | pnpm typecheck passe sans erreur (verification TypeScript globale) | chat-s02-channels-project-id | Build |
| T47 | chat-ws-manager.ts compile toujours sans erreur (backward compat) | chat-s02-update-message | Build |
| T48 | realtime/chat-ws.ts compile toujours sans erreur (backward compat) | chat-s02-patch-message | Build |

---

## Edge Cases et Scenarios d'Erreur

### E1 : replyToId vers un message inexistant

```
Given un channel avec des messages
When un message est cree avec replyToId = "<uuid-inexistant>"
Then la FK constraint PostgreSQL rejette l'insertion
  And le service retourne une erreur 400 "Referenced message not found"
```

### E2 : replyToId vers un message d'un AUTRE channel

```
Given un message M1 dans le channel C1
  And un channel C2 different
When un message est cree dans C2 avec replyToId = M1.id
Then le message est techniquement insere (la FK ne verifie que l'existence)
  And le service DOIT verifier cote applicatif que le parent est dans le meme channel
  And si le parent n'est pas dans le meme channel, retourner 400 "Reply must target a message in the same channel"
```

### E3 : Edition d'un message deja soft-deleted

```
Given un message M1 avec deletedAt non-null
When l'auteur tente de l'editer via PATCH avec { content: "Nouveau" }
Then la reponse est 400 "Cannot edit a deleted message"
  And le message n'est PAS modifie
```

### E4 : Soft-delete d'un message qui a des replies

```
Given un message M1 avec 3 reponses (M2, M3, M4)
When M1 est soft-deleted
Then M1 est marque comme supprime (deletedAt set)
  And les reponses M2, M3, M4 restent visibles (replyToId pointe toujours vers M1)
  And getThreadReplies(M1.id) retourne toujours les 3 reponses (meme si le parent est supprime)
```

### E5 : lastMessageAt avec messages concurrents

```
Given un channel avec lastMessageAt = T1
When deux messages sont envoyes quasi-simultanement (T2 et T3, T3 > T2)
Then lastMessageAt doit etre T3 (le plus recent gagne)
  And il n'y a pas de race condition (UPDATE SET lastMessageAt = GREATEST(lastMessageAt, $newTs) ou transaction)
```

### E6 : createChannel avec projectId invalide

```
Given un projectId qui n'existe pas dans la table projects
When POST /chat/channels avec { agentId: "...", projectId: "<invalid>" }
Then la FK constraint PostgreSQL rejette l'insertion
  And le service retourne 400 "Referenced project not found"
```

### E7 : listChannels avec sortBy = "lastMessageAt" et channels sans messages

```
Given 5 channels : 3 avec lastMessageAt non-null, 2 avec lastMessageAt = null
When listChannels avec sortBy = "lastMessageAt"
Then les 3 channels avec lastMessageAt sont tries DESC en premier
  And les 2 channels sans messages sont a la fin (NULLS LAST)
```

---

## Notes Techniques d'Implementation

### Structure des fichiers crees/modifies

| Fichier | Action | Description |
|---------|--------|-------------|
| `packages/db/src/schema/chat_channels.ts` | Modifier | 4 nouvelles colonnes + 2 indexes + import projects |
| `packages/db/src/schema/chat_messages.ts` | Modifier | 4 nouvelles colonnes + 1 index + import AnyPgColumn |
| `packages/db/drizzle/XXXX_*.sql` | Creer (genere) | Migration Drizzle ALTER TABLE + CREATE INDEX |
| `server/src/services/chat.ts` | Modifier | 3 nouvelles fonctions + enrichissement 3 existantes |
| `server/src/routes/chat.ts` | Modifier | 2 nouvelles routes (PATCH message, GET replies) |
| `server/src/validators/chat-ws.ts` | Modifier | Enrichir createChannelSchema + ajouter updateMessageSchema |
| `packages/shared/src/types/chat-ws.ts` | Modifier | Ajouter ChatMessageType type |
| `packages/shared/src/types/index.ts` | Modifier | Re-export ChatMessageType |
| `packages/shared/src/index.ts` | Modifier | Re-export ChatMessageType (si necessaire) |

### Conventions de code

- **Self-reference FK** : utiliser `AnyPgColumn` de `drizzle-orm/pg-core` comme dans `agents.ts` (pattern existant pour `reportsTo`)
- **Nullable columns** : toutes les nouvelles colonnes sont nullable ou ont un default pour backward-compat
- **Import pattern** : `import type` pour les types, `import` pour les valeurs
- **Logger** : reutiliser le pattern existant dans chat.ts (pas de logger dedier, erreurs via throws)
- **Errors** : reutiliser les helpers `badRequest()`, `notFound()`, `forbidden()` de `server/src/errors.ts`
- **DB** : Drizzle ORM, pas de raw SQL

### Performance considerations

- **lastMessageAt denormalise** : evite un JOIN + MAX(createdAt) sur chat_messages a chaque listChannels
- **Race condition lastMessageAt** : utiliser `GREATEST(COALESCE(last_message_at, '1970-01-01'), $new)` ou SQL raw `SET last_message_at = CASE WHEN last_message_at IS NULL OR last_message_at < $new THEN $new ELSE last_message_at END` si Drizzle ne supporte pas GREATEST
- **Soft-delete** : le filtre `isNull(deletedAt)` est ajoute au WHERE existant, l'index `chat_messages_channel_created_idx` reste performant car la colonne deletedAt est peu peuplee (majorite NULL)
- **getThreadReplies** : l'index `chat_messages_reply_to_idx` supporte la requete directement

### Dependances

Aucune nouvelle dependance a installer. Tout repose sur Drizzle ORM et les packages existants.

### Pattern de reference : self-referencing FK

Le pattern pour la self-reference `replyToId` est identique a `agents.reportsTo` (packages/db/src/schema/agents.ts:24) :

```typescript
import { type AnyPgColumn } from "drizzle-orm/pg-core";

replyToId: uuid("reply_to_id").references((): AnyPgColumn => chatMessages.id, { onDelete: "set null" }),
```

---

## Definition of Done

- [ ] Schema chat_channels enrichi avec 4 nouvelles colonnes (projectId, createdBy, description, lastMessageAt)
- [ ] Schema chat_messages enrichi avec 4 nouvelles colonnes (messageType, replyToId, editedAt, deletedAt)
- [ ] FK projectId reference projects.id avec ON DELETE SET NULL
- [ ] FK replyToId self-reference avec ON DELETE SET NULL (pattern AnyPgColumn)
- [ ] 3 nouveaux indexes crees (company_project, company_last_msg, reply_to)
- [ ] Migration Drizzle generee et fonctionnelle (ALTER TABLE non-destructif)
- [ ] Service createChannel accepte projectId, createdBy, description
- [ ] Service createMessage met a jour lastMessageAt du channel
- [ ] Service createMessage accepte messageType et replyToId
- [ ] Service updateMessage cree et fonctionnel (met a jour content + editedAt)
- [ ] Service softDeleteMessage cree et fonctionnel (set deletedAt)
- [ ] Service getThreadReplies cree et fonctionnel
- [ ] Service getMessages exclut les messages soft-deleted
- [ ] Service listChannels filtre par projectId et trie par lastMessageAt
- [ ] Route PATCH message ajoutee avec controle d'auteur et check system
- [ ] Route GET replies ajoutee
- [ ] Validators enrichis (createChannelSchema, updateMessageSchema)
- [ ] ChatMessageType type exporte depuis packages/shared
- [ ] Backward-compatibility totale (donnees existantes non impactees)
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
- [ ] Tests existants passent toujours (`pnpm test:run`)
