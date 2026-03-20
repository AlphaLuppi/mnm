# CHAT-S01 : WebSocket Bidirectionnel -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CHAT-S01 |
| **Titre** | WebSocket Bidirectionnel humain-agent |
| **Epic** | Epic CHAT -- Chat Temps Reel |
| **Sprint** | Sprint 3 (Batch 6) |
| **Effort** | L (8 SP, 5-7j) |
| **Priorite** | P0 -- Prerequis chat temps reel |
| **Assignation** | Tom (backend) |
| **Bloque par** | TECH-04 (Redis setup -- DONE) |
| **Debloque** | CHAT-S03 (ChatService pipe stdin), CHAT-S04 (AgentChatPanel UI), DASH-S03 (Dashboard temps reel) |
| **ADR** | ADR-005 (Chat Temps Reel -- WebSocket Bidirectionnel) |
| **Type** | Backend (service + routes + realtime protocol) |
| **FRs couverts** | REQ-CHAT-01, REQ-CHAT-03, REQ-CHAT-04, REQ-CHAT-05 |
| **Dette technique** | DT3 -- live-events.ts WebSocket unidirectionnel |

---

## Description

### Contexte -- Pourquoi cette story est critique

Le chat bidirectionnel est le "moment emotionnel de la demo" (epics-b2b.md, impact 7/10). Aujourd'hui, `live-events-ws.ts` est strictement unidirectionnel : le serveur pousse des LiveEvents vers les clients, mais les clients ne peuvent rien envoyer en retour. Pour la demo CBA, un dev doit pouvoir taper "Utilise le pattern Repository" dans un chat et voir l'agent s'adapter en temps reel.

Cette story transforme le systeme realtime de MnM : d'un flux unidirectionnel (serveur -> client) vers un protocole bidirectionnel type (client <-> serveur) avec authentification WebSocket, routage par channelId, persistance des messages, reconnexion avec rattrapage, et rate limiting.

### Etat actuel du code

| Fichier | Etat | Role |
|---------|------|------|
| `server/src/realtime/live-events-ws.ts` | Existe (274 lignes) | WebSocket unidirectionnel, auth par token/session, routing par companyId. Path: `/api/companies/:companyId/events/ws` |
| `server/src/services/live-events.ts` | Existe (41 lignes) | EventEmitter interne, `publishLiveEvent()`, `subscribeCompanyLiveEvents()` |
| `server/src/redis.ts` | Existe (TECH-04 DONE) | Client Redis avec graceful degradation, `createRedisClient()`, `pingRedis()`, `disconnectRedis()` |
| `server/src/middleware/rate-limit.ts` | Existe (TECH-04 DONE) | `createRateLimiter()` avec fallback in-memory |
| `packages/db/src/schema/chat_channels.ts` | Existe (TECH-06 DONE) | Table `chat_channels` (id, companyId, agentId, heartbeatRunId, name, status, closedAt, createdAt, updatedAt) |
| `packages/db/src/schema/chat_messages.ts` | Existe (TECH-06 DONE) | Table `chat_messages` (id, channelId, companyId, senderId, senderType, content, metadata, createdAt) |
| `packages/shared/src/constants.ts` | Existe | `LIVE_EVENT_TYPES` array, `LiveEventType` type |
| `server/src/middleware/require-permission.ts` | Existe (RBAC-S04 DONE) | `requirePermission()` et `assertCompanyPermission()` |
| `packages/shared/src/types/live.ts` | Existe | `LiveEvent` interface |

### Ce que cette story construit

1. **Protocole WebSocket bidirectionnel** (`server/src/realtime/chat-ws.ts`) -- nouveau serveur WebSocket sur path `/ws/chat/:channelId`, protocole de messages type JSON, auth WebSocket avec verification `chat.agent` permission
2. **ChatWebSocketManager** (`server/src/services/chat-ws-manager.ts`) -- gestion des connexions, routage des messages par channelId, reconnexion buffer 30s, rate limiting 10 msg/min
3. **Routes REST de support** -- `GET /api/companies/:companyId/chat/channels` (lister), `POST /api/companies/:companyId/chat/channels` (creer), `GET /api/companies/:companyId/chat/channels/:channelId/messages` (historique), `GET /api/companies/:companyId/chat/channels/:channelId` (detail)
4. **Redis pub/sub pour scaling** -- utilise Redis pub/sub quand disponible pour distribuer les messages WebSocket entre instances (graceful degradation vers EventEmitter si Redis absent)
5. **Extension LiveEventType** -- ajouter `chat.message_sent` et `chat.channel_created` aux LiveEventTypes existants
6. **Types partages** -- interfaces WebSocket message types dans `packages/shared`

### Ce que cette story ne fait PAS (scope)

- Pas de pipe vers stdin de l'agent containerise (CHAT-S03)
- Pas de composant UI React AgentChatPanel (CHAT-S04)
- Pas de creation/migration de tables chat (deja fait dans TECH-06)
- Pas de logique de resume LLM des messages (OBS-S03)
- Pas de dashboard temps reel des messages (DASH-S03)

---

## Architecture du Protocole WebSocket

### Path WebSocket

```
ws(s)://host/ws/chat/:channelId
```

Separe du WebSocket LiveEvents existant (`/api/companies/:companyId/events/ws`) pour :
- Eviter de polluer le flux LiveEvents avec des messages chat
- Permettre un rate limiting specifique par channel
- Simplifier le routage (un channel = un WebSocket)
- Le LiveEvents existant reste inchange (backward compatible)

### Authentification WebSocket

Le chat WebSocket reutilise le meme mecanisme d'auth que `live-events-ws.ts` :
1. **Token Bearer** en header `Authorization: Bearer <token>` (agent API key ou JWT)
2. **Query param** `?token=<token>` (fallback pour les clients qui ne supportent pas les headers WS)
3. **Session cookie** (pour les users board en mode `authenticated`)
4. **local_trusted** mode : pas de token requis (board implicit)

Apres authentication, le serveur verifie :
- L'acteur a la permission `chat.agent` dans la company associee au channel
- Le channel existe et est `open`
- L'acteur est soit un user (board) de la company, soit un agent associe au channel

### Format des Messages (Client -> Serveur)

```typescript
// Client envoie un message au channel
interface ChatClientMessage {
  type: "chat_message";
  content: string;          // texte du message, max 4096 chars
  metadata?: Record<string, unknown>; // optionnel, pour context additionnel
  clientMessageId?: string; // ID client-side pour dedup/ack, uuid v4
}

// Client signale qu'il tape
interface ChatClientTyping {
  type: "typing_start" | "typing_stop";
}

// Client demande les messages manques (reconnexion)
interface ChatClientSync {
  type: "sync_request";
  lastMessageId: string;    // dernier message recu par le client
}

// Client envoie un ping applicatif
interface ChatClientPing {
  type: "ping";
}

type ChatClientPayload =
  | ChatClientMessage
  | ChatClientTyping
  | ChatClientSync
  | ChatClientPing;
```

### Format des Messages (Serveur -> Client)

```typescript
// Message chat recu (broadcast a tous les connectes du channel)
interface ChatServerMessage {
  type: "chat_message";
  id: string;               // UUID du message en DB
  channelId: string;
  senderId: string;
  senderType: "user" | "agent";
  senderName?: string;       // nom affichable
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;         // ISO 8601
}

// Ack apres envoi reussi
interface ChatServerAck {
  type: "message_ack";
  clientMessageId: string;   // echo du clientMessageId envoye
  messageId: string;         // UUID du message persiste en DB
  createdAt: string;
}

// Indicateur de frappe
interface ChatServerTyping {
  type: "typing_indicator";
  senderId: string;
  senderType: "user" | "agent";
  senderName?: string;
  isTyping: boolean;
}

// Reponse sync (reconnexion)
interface ChatServerSync {
  type: "sync_response";
  messages: ChatServerMessage[];  // messages depuis lastMessageId
  hasMore: boolean;               // si > 100 messages manques
}

// Erreur
interface ChatServerError {
  type: "error";
  code: string;              // "RATE_LIMITED" | "INVALID_MESSAGE" | "CHANNEL_CLOSED" | "UNAUTHORIZED" | "MESSAGE_TOO_LONG"
  message: string;
  retryAfter?: number;       // secondes, pour RATE_LIMITED
}

// Pong applicatif
interface ChatServerPong {
  type: "pong";
}

// Channel ferme
interface ChatServerChannelClosed {
  type: "channel_closed";
  channelId: string;
  reason: string;            // "agent_terminated" | "manual_close" | "timeout"
}

type ChatServerPayload =
  | ChatServerMessage
  | ChatServerAck
  | ChatServerTyping
  | ChatServerSync
  | ChatServerError
  | ChatServerPong
  | ChatServerChannelClosed;
```

### Reconnexion et Buffer

- Le serveur maintient un buffer de 30 secondes (en memoire) des messages recents par channel
- Quand un client envoie `sync_request` avec `lastMessageId`, le serveur :
  1. Cherche les messages depuis `lastMessageId` dans le buffer en memoire
  2. Si pas trouves en memoire, fait un `SELECT` sur `chat_messages` WHERE `id > lastMessageId` LIMIT 100
  3. Envoie `sync_response` avec les messages manques
- Si plus de 100 messages manques, `hasMore: true` et le client peut paginer via la REST API

### Rate Limiting WebSocket

- 10 messages `chat_message` par minute par user/channel
- Compteur en Redis si disponible (cle `rl:chat:{userId}:{channelId}`), sinon in-memory
- Quand la limite est depassee, le serveur envoie `{ type: "error", code: "RATE_LIMITED", retryAfter: <seconds> }`
- Les messages `typing_start`/`typing_stop`/`ping`/`sync_request` ne sont PAS rate-limites

### Redis Pub/Sub pour Scaling

Quand Redis est disponible :
- Chaque instance MnM subscribe au channel Redis `chat:{channelId}`
- Quand un message est recu sur une instance, il est publie sur le channel Redis
- Toutes les instances connectees au meme channel recoivent le message et le broadcast a leurs clients WebSocket locaux
- Si Redis est indisponible, le fallback utilise l'EventEmitter local (single-instance seulement)

Pattern :
```
Client A (Instance 1) -> WebSocket -> Persist DB -> Publish Redis chat:{channelId}
                                                      |
                                                      v
                                              Redis Pub/Sub
                                                      |
                                                      v
Client B (Instance 2) <- WebSocket <- Subscribe Redis chat:{channelId}
```

---

## Taches d'Implementation

### T1 : Ajouter les types WebSocket chat dans packages/shared

**Fichier** : `packages/shared/src/types/chat-ws.ts` (nouveau)

Creer les interfaces TypeScript pour le protocole WebSocket chat :
- `ChatClientPayload` (union des 4 types client)
- `ChatServerPayload` (union des 7 types serveur)
- `ChatChannelStatus` type literal ("open" | "closed")
- `ChatSenderType` type literal ("user" | "agent")

Exporter dans `packages/shared/src/types/index.ts` et `packages/shared/src/index.ts`.

### T2 : Ajouter les LiveEventTypes chat dans packages/shared

**Fichier** : `packages/shared/src/constants.ts` (modification)

Ajouter dans le tableau `LIVE_EVENT_TYPES` :
- `"chat.message_sent"`
- `"chat.channel_created"`
- `"chat.channel_closed"`

### T3 : Creer le ChatWebSocketManager

**Fichier** : `server/src/services/chat-ws-manager.ts` (nouveau)

Service qui gere :
- Registry des connexions WebSocket par channelId (`Map<channelId, Set<WsSocket>>`)
- Broadcast d'un message a tous les connectes d'un channel
- Buffer de reconnexion (Map<channelId, CircularBuffer<ChatServerMessage>>, taille 100, TTL 30s)
- Rate limiting par user/channel (10 msg/min)
- Integration Redis pub/sub quand disponible
- Cleanup des connexions fermees
- `sendToChannel(channelId, message)` -- broadcast local + publish Redis
- `handleIncomingMessage(channelId, actorContext, payload)` -- validation, persistence, broadcast
- `handleSyncRequest(channelId, lastMessageId)` -- buffer + DB fallback
- `subscribe(channelId)` / `unsubscribe(channelId)` -- Redis pub/sub

Dependencies : `@mnm/db`, `ioredis` (optionnel via RedisState), `server/src/services/live-events.ts`

### T4 : Creer le serveur WebSocket chat

**Fichier** : `server/src/realtime/chat-ws.ts` (nouveau)

Serveur WebSocket sur path `/ws/chat/:channelId` :

1. **Parsing du path** : extraire `channelId` de l'URL
2. **Auth** : reutiliser le pattern de `live-events-ws.ts` (token/session/local_trusted)
3. **Permission check** : verifier `chat.agent` via `accessService.canUser()` ou `accessService.hasPermission()`
4. **Channel validation** : verifier que le channel existe dans `chat_channels` et est `open`, extraire le `companyId`
5. **Connection** : ajouter au registry du ChatWebSocketManager
6. **Message handling** :
   - Parse JSON
   - Valider le type avec un discriminator sur `payload.type`
   - Router vers le handler approprie du ChatWebSocketManager
7. **Cleanup** : retirer du registry on close/error
8. **Heartbeat** : ping/pong toutes les 30s (comme live-events-ws.ts)

Integration dans `server/src/index.ts` via `setupChatWebSocketServer(server, db, opts)`.

**Important** : Le routing HTTP upgrade doit differencier :
- `/api/companies/:companyId/events/ws` -> live-events WebSocket (existant, ne pas toucher)
- `/ws/chat/:channelId` -> chat WebSocket (nouveau)

Le `server.on("upgrade")` dans `live-events-ws.ts` utilise `parseCompanyId()` qui retourne `null` si le path ne matche pas `/api/companies/:companyId/events/ws`. On ajoute un second handler `upgrade` dans `chat-ws.ts` qui matche `/ws/chat/:channelId`. L'ordre d'enregistrement importe : si le premier handler ne reconnait pas le path, il laisse le socket intact (appel `socket.destroy()` seulement). Le nouveau handler doit etre plus defensif : verifier le path AVANT de faire quoi que ce soit.

### T5 : Creer les routes REST chat

**Fichier** : `server/src/routes/chat.ts` (nouveau)

4 routes REST pour le support du chat (pour la pagination d'historique et la gestion des channels) :

```
POST   /companies/:companyId/chat/channels
  Body: { agentId: string, heartbeatRunId?: string, name?: string }
  Response: 201 { id, companyId, agentId, heartbeatRunId, name, status, createdAt }
  Permission: chat.agent
  Validation: agentId exists and belongs to companyId

GET    /companies/:companyId/chat/channels
  Query: ?status=open&agentId=<uuid>&limit=50&offset=0
  Response: 200 { channels: [...], total: number }
  Permission: chat.agent (viewer: read-only via viewer permission)

GET    /companies/:companyId/chat/channels/:channelId
  Response: 200 { id, companyId, agentId, heartbeatRunId, name, status, createdAt, updatedAt, messageCount }
  Permission: chat.agent

GET    /companies/:companyId/chat/channels/:channelId/messages
  Query: ?before=<messageId>&limit=50
  Response: 200 { messages: [...], hasMore: boolean }
  Permission: chat.agent (viewer: read-only)
```

Monter dans `server/src/app.ts` sur le router API : `api.use(chatRoutes(db))`.

### T6 : Service de persistance chat

**Fichier** : `server/src/services/chat.ts` (nouveau)

Service CRUD pour les channels et messages :

```typescript
export function chatService(db: Db) {
  return {
    createChannel(companyId, agentId, opts?): Promise<ChatChannel>
    getChannel(channelId): Promise<ChatChannel | null>
    listChannels(companyId, filters?): Promise<{ channels, total }>
    closeChannel(channelId, reason): Promise<void>

    createMessage(channelId, companyId, senderId, senderType, content, metadata?): Promise<ChatMessage>
    getMessages(channelId, opts?): Promise<{ messages, hasMore }>
    getMessagesSince(channelId, afterMessageId, limit?): Promise<ChatMessage[]>
    getMessageCount(channelId): Promise<number>
  }
}
```

Utilise Drizzle ORM pour les queries. Toutes les operations respectent le RLS (companyId dans le filtre).

### T7 : Integrer dans le startup serveur

**Fichier** : `server/src/index.ts` (modification)

Apres `setupLiveEventsWebSocketServer(server, db, ...)`, ajouter :

```typescript
import { setupChatWebSocketServer } from "./realtime/chat-ws.js";

setupChatWebSocketServer(server, db, {
  deploymentMode: config.deploymentMode,
  resolveSessionFromHeaders,
  redisState,
});
```

### T8 : Validation Zod pour les payloads WebSocket

**Fichier** : `server/src/validators/chat-ws.ts` (nouveau)

Schemas Zod pour valider les messages entrants :

```typescript
const chatClientMessageSchema = z.object({
  type: z.literal("chat_message"),
  content: z.string().min(1).max(4096),
  metadata: z.record(z.unknown()).optional(),
  clientMessageId: z.string().uuid().optional(),
});

const chatClientTypingSchema = z.object({
  type: z.enum(["typing_start", "typing_stop"]),
});

const chatClientSyncSchema = z.object({
  type: z.literal("sync_request"),
  lastMessageId: z.string().uuid(),
});

const chatClientPingSchema = z.object({
  type: z.literal("ping"),
});

const chatClientPayloadSchema = z.discriminatedUnion("type", [
  chatClientMessageSchema,
  chatClientTypingSchema,
  chatClientSyncSchema,
  chatClientPingSchema,
]);
```

---

## Acceptance Criteria

### AC-1 : Connexion WebSocket chat -- authentification reussie

```
Given un user board avec la permission chat.agent dans la company
  And un channel chat "open" existant pour cette company
When le client ouvre une connexion WebSocket sur /ws/chat/:channelId
  And il s'authentifie via session cookie (mode authenticated)
Then la connexion WebSocket est etablie (HTTP 101 Switching Protocols)
  And le serveur enregistre la connexion dans le registry du channel
```

### AC-2 : Connexion WebSocket chat -- refus sans permission

```
Given un user viewer SANS la permission chat.agent
  And un channel chat existant
When le client tente une connexion WebSocket sur /ws/chat/:channelId
Then la connexion est refusee avec HTTP 403 Forbidden
  And le socket est ferme
```

### AC-3 : Connexion WebSocket chat -- channel inexistant

```
Given un user authentifie avec permission chat.agent
  And un channelId qui n'existe pas en base
When le client tente une connexion WebSocket sur /ws/chat/:channelId
Then la connexion est refusee avec HTTP 404 Not Found
  And le socket est ferme
```

### AC-4 : Connexion WebSocket chat -- channel ferme

```
Given un channel avec status "closed"
When le client tente une connexion WebSocket sur /ws/chat/:channelId
Then la connexion est refusee avec HTTP 410 Gone
  And le socket est ferme
```

### AC-5 : Envoi de message -- succes

```
Given un client connecte au WebSocket /ws/chat/:channelId
When le client envoie { type: "chat_message", content: "Utilise le pattern Repository", clientMessageId: "abc-123" }
Then le message est persiste dans la table chat_messages
  And le client recoit un ack : { type: "message_ack", clientMessageId: "abc-123", messageId: "<uuid>", createdAt: "<iso>" }
  And tous les autres clients connectes au meme channel recoivent { type: "chat_message", id: "<uuid>", channelId, senderId, senderType: "user", content: "Utilise le pattern Repository", createdAt }
  And un LiveEvent "chat.message_sent" est emis pour la company
```

### AC-6 : Envoi de message -- rate limited

```
Given un client connecte au WebSocket /ws/chat/:channelId
When le client envoie 11 messages chat_message en moins de 60 secondes
Then les 10 premiers messages sont traites normalement
  And le 11eme recoit : { type: "error", code: "RATE_LIMITED", message: "Rate limit exceeded (10/min)", retryAfter: <seconds> }
  And le message rate-limite n'est PAS persiste en DB
```

### AC-7 : Envoi de message -- contenu invalide

```
Given un client connecte au WebSocket /ws/chat/:channelId
When le client envoie { type: "chat_message", content: "" }
Then le client recoit { type: "error", code: "INVALID_MESSAGE", message: "Content must be between 1 and 4096 characters" }

When le client envoie { type: "chat_message", content: "<string de 5000 chars>" }
Then le client recoit { type: "error", code: "MESSAGE_TOO_LONG", message: "Content must be between 1 and 4096 characters" }
```

### AC-8 : Indicateur de frappe

```
Given deux clients (Alice et Bob) connectes au meme channel
When Alice envoie { type: "typing_start" }
Then Bob recoit { type: "typing_indicator", senderId: "<alice-id>", senderType: "user", isTyping: true }
When Alice envoie { type: "typing_stop" }
Then Bob recoit { type: "typing_indicator", senderId: "<alice-id>", senderType: "user", isTyping: false }
  And Alice ne recoit PAS ses propres typing_indicator (pas de loop-back)
```

### AC-9 : Reconnexion avec sync

```
Given un client qui a recu des messages jusqu'a messageId "msg-42"
  And 5 nouveaux messages ont ete envoyes pendant sa deconnexion
When le client se reconnecte et envoie { type: "sync_request", lastMessageId: "msg-42" }
Then le serveur repond { type: "sync_response", messages: [5 messages], hasMore: false }
  And les messages sont ordonnes par createdAt ASC
```

### AC-10 : REST API -- creer un channel

```
Given un user avec permission chat.agent
When il appelle POST /api/companies/:companyId/chat/channels avec { agentId: "<uuid>" }
Then un nouveau channel est cree en DB avec status "open"
  And la reponse est 201 avec le channel cree
  And un LiveEvent "chat.channel_created" est emis
```

### AC-11 : REST API -- lister les channels

```
Given 3 channels open et 2 channels closed dans la company
When le client appelle GET /api/companies/:companyId/chat/channels?status=open
Then la reponse contient les 3 channels open avec total: 3
```

### AC-12 : REST API -- historique des messages

```
Given un channel avec 150 messages
When le client appelle GET /api/companies/:companyId/chat/channels/:channelId/messages?limit=50
Then la reponse contient les 50 messages les plus recents
  And hasMore: true
  And les messages sont ordonnes par createdAt DESC (plus recents en premier)
```

### AC-13 : Redis pub/sub -- multi-instance

```
Given deux instances MnM connectees au meme Redis
  And un client sur Instance A et un client sur Instance B connectes au meme channelId
When le client sur Instance A envoie un message chat
Then le client sur Instance B recoit le message via Redis pub/sub
  And le message est persiste une seule fois en DB (par Instance A)
```

### AC-14 : Viewer read-only (REQ-CHAT-04)

```
Given un user viewer (sans permission chat.agent)
When il appelle GET /api/companies/:companyId/chat/channels/:channelId/messages
Then il peut voir les messages (read-only) si il a la permission audit.view
When il tente de se connecter au WebSocket /ws/chat/:channelId
Then la connexion est refusee (pas de chat.agent permission)
```

### AC-15 : Channel ferme -- notification

```
Given 3 clients connectes au WebSocket d'un channel
When le channel est ferme (agent termine, close manuel)
Then tous les clients recoivent { type: "channel_closed", channelId, reason: "agent_terminated" }
  And les connexions WebSocket sont fermees proprement (close code 1000)
  And le status du channel passe a "closed" en DB
  And un LiveEvent "chat.channel_closed" est emis
```

### AC-16 : Ping/Pong applicatif

```
Given un client connecte au WebSocket /ws/chat/:channelId
When le client envoie { type: "ping" }
Then le serveur repond { type: "pong" }
  And le ping/pong n'est PAS rate-limite
```

### AC-17 : Backward compatibility LiveEvents

```
Given le WebSocket LiveEvents existant sur /api/companies/:companyId/events/ws
When un client s'y connecte
Then il continue de fonctionner exactement comme avant
  And il recoit les nouveaux LiveEvent types (chat.message_sent, chat.channel_created, chat.channel_closed)
  And il ne recoit PAS les messages chat individuels (ceux-ci passent uniquement par /ws/chat/:channelId)
```

---

## data-test-id

### Elements API / Endpoints

| Element | data-testid | Type | Verification |
|---------|-------------|------|-------------|
| WebSocket chat endpoint | `data-testid="chat-s01-ws-endpoint"` | WebSocket path | `/ws/chat/:channelId` repond aux connexions |
| REST create channel | `data-testid="chat-s01-create-channel"` | API endpoint | POST retourne 201 |
| REST list channels | `data-testid="chat-s01-list-channels"` | API endpoint | GET retourne array |
| REST channel detail | `data-testid="chat-s01-channel-detail"` | API endpoint | GET retourne objet |
| REST message history | `data-testid="chat-s01-message-history"` | API endpoint | GET retourne array + hasMore |

### Elements Protocole WebSocket

| Element | data-testid | Type | Verification |
|---------|-------------|------|-------------|
| Message chat envoi | `data-testid="chat-s01-send-message"` | WS message type | `type: "chat_message"` traite et persiste |
| Message ack | `data-testid="chat-s01-message-ack"` | WS message type | `type: "message_ack"` avec clientMessageId echo |
| Message broadcast | `data-testid="chat-s01-message-broadcast"` | WS message type | `type: "chat_message"` recu par les autres clients |
| Typing indicator | `data-testid="chat-s01-typing-indicator"` | WS message type | `type: "typing_indicator"` broadcast sans loop-back |
| Sync request | `data-testid="chat-s01-sync-request"` | WS message type | `type: "sync_request"` declenche sync_response |
| Sync response | `data-testid="chat-s01-sync-response"` | WS message type | `type: "sync_response"` avec messages[] |
| Error rate limit | `data-testid="chat-s01-error-rate-limit"` | WS message type | `type: "error"`, `code: "RATE_LIMITED"` |
| Error invalid | `data-testid="chat-s01-error-invalid"` | WS message type | `type: "error"`, `code: "INVALID_MESSAGE"` |
| Error channel closed | `data-testid="chat-s01-channel-closed-event"` | WS message type | `type: "channel_closed"` avec reason |
| Ping/Pong | `data-testid="chat-s01-ping-pong"` | WS message type | `type: "pong"` en reponse a `type: "ping"` |

### Elements Auth / Securite

| Element | data-testid | Type | Verification |
|---------|-------------|------|-------------|
| WS auth success | `data-testid="chat-s01-ws-auth-success"` | Upgrade response | HTTP 101 Switching Protocols |
| WS auth denied | `data-testid="chat-s01-ws-auth-denied"` | Upgrade response | HTTP 403 Forbidden |
| WS channel not found | `data-testid="chat-s01-ws-channel-not-found"` | Upgrade response | HTTP 404 Not Found |
| WS channel closed | `data-testid="chat-s01-ws-channel-gone"` | Upgrade response | HTTP 410 Gone |
| REST permission denied | `data-testid="chat-s01-rest-permission-denied"` | HTTP response | 403 avec `requiredPermission: "chat.agent"` |

### Elements Redis / Scaling

| Element | data-testid | Type | Verification |
|---------|-------------|------|-------------|
| Redis pub/sub active | `data-testid="chat-s01-redis-pubsub"` | Internal | Messages distribues entre instances via Redis |
| Redis pub/sub fallback | `data-testid="chat-s01-redis-fallback"` | Internal | EventEmitter local quand Redis absent |
| Rate limit Redis key | `data-testid="chat-s01-rate-limit-key"` | Redis key | `rl:chat:{userId}:{channelId}` |

### Elements LiveEvent

| Element | data-testid | Type | Verification |
|---------|-------------|------|-------------|
| LiveEvent chat.message_sent | `data-testid="chat-s01-live-event-message"` | LiveEvent | Emis quand un message est persiste |
| LiveEvent chat.channel_created | `data-testid="chat-s01-live-event-channel-created"` | LiveEvent | Emis quand un channel est cree |
| LiveEvent chat.channel_closed | `data-testid="chat-s01-live-event-channel-closed"` | LiveEvent | Emis quand un channel est ferme |

---

## Cas de Test pour QA (Playwright)

### Groupe 1 : Connexion WebSocket

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T01 | Connexion WS reussie avec session cookie (mode authenticated) | chat-s01-ws-auth-success | Integration |
| T02 | Connexion WS reussie avec bearer token (agent) | chat-s01-ws-auth-success | Integration |
| T03 | Connexion WS reussie en mode local_trusted (sans token) | chat-s01-ws-auth-success | Integration |
| T04 | Connexion WS refusee sans permission chat.agent | chat-s01-ws-auth-denied | Integration |
| T05 | Connexion WS refusee channel inexistant | chat-s01-ws-channel-not-found | Integration |
| T06 | Connexion WS refusee channel ferme | chat-s01-ws-channel-gone | Integration |
| T07 | Connexion WS refusee sans authentification (mode authenticated) | chat-s01-ws-auth-denied | Integration |
| T08 | Connexion WS refusee cross-company (user company A, channel company B) | chat-s01-ws-auth-denied | Securite |

### Groupe 2 : Envoi et reception de messages

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T09 | Envoi message chat recu par les autres clients du channel | chat-s01-message-broadcast | Fonctionnel |
| T10 | Ack recu avec clientMessageId echo | chat-s01-message-ack | Fonctionnel |
| T11 | Message persiste en DB avec senderId, senderType, content | chat-s01-send-message | Integration |
| T12 | Message vide rejete (content: "") | chat-s01-error-invalid | Validation |
| T13 | Message trop long rejete (>4096 chars) | chat-s01-error-invalid | Validation |
| T14 | JSON invalide rejete | chat-s01-error-invalid | Validation |
| T15 | Type de message inconnu rejete | chat-s01-error-invalid | Validation |
| T16 | L'emetteur recoit l'ack mais PAS le broadcast de son propre message | chat-s01-message-ack | Fonctionnel |

### Groupe 3 : Rate limiting

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T17 | 10 messages en 60s acceptes | chat-s01-send-message | Fonctionnel |
| T18 | 11eme message en 60s rate-limite | chat-s01-error-rate-limit | Fonctionnel |
| T19 | Apres expiration fenetre, les messages sont a nouveau acceptes | chat-s01-send-message | Fonctionnel |
| T20 | typing_start/typing_stop non rate-limites | chat-s01-typing-indicator | Fonctionnel |
| T21 | ping non rate-limite | chat-s01-ping-pong | Fonctionnel |

### Groupe 4 : Typing indicator

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T22 | typing_start broadcast aux autres clients | chat-s01-typing-indicator | Fonctionnel |
| T23 | typing_stop broadcast aux autres clients | chat-s01-typing-indicator | Fonctionnel |
| T24 | Emetteur ne recoit pas son propre typing_indicator | chat-s01-typing-indicator | Fonctionnel |

### Groupe 5 : Reconnexion et sync

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T25 | sync_request retourne les messages manques depuis lastMessageId | chat-s01-sync-response | Fonctionnel |
| T26 | sync_response avec hasMore=false quand tous les messages sont retournes | chat-s01-sync-response | Fonctionnel |
| T27 | sync_response avec hasMore=true quand >100 messages manques | chat-s01-sync-response | Fonctionnel |
| T28 | sync_request avec lastMessageId invalide retourne une erreur | chat-s01-error-invalid | Validation |

### Groupe 6 : REST API channels

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T29 | POST /chat/channels cree un channel | chat-s01-create-channel | Integration |
| T30 | POST /chat/channels avec agentId invalide retourne 400 | chat-s01-create-channel | Validation |
| T31 | POST /chat/channels sans permission retourne 403 | chat-s01-rest-permission-denied | Securite |
| T32 | GET /chat/channels retourne la liste filtree par status | chat-s01-list-channels | Integration |
| T33 | GET /chat/channels/:channelId retourne le detail avec messageCount | chat-s01-channel-detail | Integration |
| T34 | GET /chat/channels/:channelId avec channelId inexistant retourne 404 | chat-s01-channel-detail | Validation |

### Groupe 7 : REST API messages

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T35 | GET /chat/channels/:channelId/messages retourne les 50 plus recents | chat-s01-message-history | Integration |
| T36 | GET /chat/channels/:channelId/messages?before=<id> retourne les 50 suivants | chat-s01-message-history | Pagination |
| T37 | GET /chat/channels/:channelId/messages avec hasMore correct | chat-s01-message-history | Pagination |
| T38 | GET /chat/channels/:channelId/messages depuis un autre company retourne 403 | chat-s01-rest-permission-denied | Securite |

### Groupe 8 : Channel lifecycle

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T39 | Fermeture channel envoie channel_closed a tous les clients WS | chat-s01-channel-closed-event | Fonctionnel |
| T40 | Fermeture channel met le status a "closed" en DB | chat-s01-channel-closed-event | Integration |
| T41 | Tentative d'envoi message sur channel ferme retourne erreur | chat-s01-error-invalid | Fonctionnel |
| T42 | LiveEvent chat.channel_created emis a la creation | chat-s01-live-event-channel-created | Integration |
| T43 | LiveEvent chat.channel_closed emis a la fermeture | chat-s01-live-event-channel-closed | Integration |
| T44 | LiveEvent chat.message_sent emis a chaque message | chat-s01-live-event-message | Integration |

### Groupe 9 : Ping/Pong et heartbeat

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T45 | ping -> pong repondu | chat-s01-ping-pong | Fonctionnel |
| T46 | Connexion WebSocket fermee apres 30s sans pong (heartbeat WS natif) | chat-s01-ws-endpoint | Resilience |

### Groupe 10 : Backward compatibility

| # | Cas de test | data-testid | Type |
|---|------------|-------------|------|
| T47 | LiveEvents WS existant (/api/companies/:companyId/events/ws) fonctionne toujours | chat-s01-ws-endpoint | Regression |
| T48 | Nouveaux LiveEventTypes visibles dans le flux LiveEvents | chat-s01-live-event-message | Regression |

### Groupe 11 : Fichiers source

| # | Cas de test | Verification |
|---|------------|-------------|
| T49 | `server/src/realtime/chat-ws.ts` existe et exporte `setupChatWebSocketServer` | File-content |
| T50 | `server/src/services/chat-ws-manager.ts` existe | File-content |
| T51 | `server/src/services/chat.ts` existe et exporte `chatService` | File-content |
| T52 | `server/src/routes/chat.ts` existe et exporte `chatRoutes` | File-content |
| T53 | `server/src/validators/chat-ws.ts` existe avec les schemas Zod | File-content |
| T54 | `packages/shared/src/types/chat-ws.ts` existe avec les interfaces | File-content |
| T55 | `packages/shared/src/constants.ts` contient `chat.message_sent` dans LIVE_EVENT_TYPES | File-content |
| T56 | `packages/shared/src/constants.ts` contient `chat.channel_created` dans LIVE_EVENT_TYPES | File-content |
| T57 | `packages/shared/src/constants.ts` contient `chat.channel_closed` dans LIVE_EVENT_TYPES | File-content |
| T58 | `server/src/app.ts` monte `chatRoutes(db)` sur le router API | File-content |
| T59 | `server/src/index.ts` appelle `setupChatWebSocketServer()` | File-content |
| T60 | `server/src/realtime/live-events-ws.ts` n'est PAS modifie (backward compat) | File-content |

---

## Edge Cases et Scenarios d'Erreur

### E1 : Client envoie du texte non-JSON

```
Given un client connecte au WebSocket chat
When il envoie une string qui n'est pas du JSON valide ("hello world")
Then le serveur repond { type: "error", code: "INVALID_MESSAGE", message: "Invalid JSON" }
  And la connexion n'est PAS fermee (le client peut retenter)
```

### E2 : Deconnexion brutale du client

```
Given un client connecte au WebSocket chat
When le client est deconnecte brutalement (crash, perte reseau)
Then le serveur detecte la deconnexion via le heartbeat ping/pong (30s max)
  And la connexion est retiree du registry
  And les autres clients ne sont pas impactes
  And aucun typing_indicator phantom ne persiste (auto-clear apres 15s sans typing_stop)
```

### E3 : Redis tombe pendant le chat

```
Given deux instances avec Redis pub/sub actif
  And des clients connectes sur les deux instances
When Redis tombe
Then les messages sont toujours traites localement sur chaque instance
  And la distribution cross-instance est perdue temporairement
  And un warning est logue une seule fois
When Redis revient
Then le pub/sub se re-etablit automatiquement (ioredis reconnect)
  And les messages cross-instance reprennent
```

### E4 : Flooding de messages

```
Given un client malveillant qui envoie 1000 messages par seconde
When les messages arrivent
Then le rate limiter bloque apres 10 messages/min
  And les messages suivants recoivent l'erreur RATE_LIMITED
  And le serveur ne crash pas (backpressure via le buffer WS natif)
  And un warning est logue avec l'IP du client
```

### E5 : Channel avec beaucoup de messages (pagination)

```
Given un channel avec 10000 messages
When un client demande l'historique via REST avec limit=50
Then seuls les 50 plus recents sont retournes (DESC)
  And hasMore: true
When le client passe before=<id du 50eme>
Then les 50 suivants sont retournes
  And la requete utilise l'index chat_messages_channel_created_idx
```

### E6 : Connexion depuis deux onglets du meme user

```
Given un user connecte au meme channel depuis 2 onglets
When il envoie un message depuis l'onglet 1
Then l'onglet 1 recoit l'ack
  And l'onglet 2 recoit le broadcast du message
  And les deux onglets voient le meme etat
```

### E7 : Agent envoie un message via WebSocket

```
Given un agent authentifie via agent API key
  And il est associe au channel (chatChannels.agentId = agent.id)
When l'agent envoie { type: "chat_message", content: "J'ai termine le refactoring" }
Then le message est persiste avec senderType: "agent"
  And tous les clients user du channel recoivent le message
  And le senderName est le nom de l'agent (depuis la table agents)
```

---

## Notes Techniques d'Implementation

### Structure des fichiers crees/modifies

| Fichier | Action | Description |
|---------|--------|-------------|
| `packages/shared/src/types/chat-ws.ts` | Creer | Interfaces protocole WS chat |
| `packages/shared/src/types/index.ts` | Modifier | Re-export chat-ws types |
| `packages/shared/src/index.ts` | Modifier | Re-export chat-ws types |
| `packages/shared/src/constants.ts` | Modifier | 3 nouveaux LiveEventTypes |
| `server/src/realtime/chat-ws.ts` | Creer | Serveur WebSocket chat (~250 lignes) |
| `server/src/services/chat-ws-manager.ts` | Creer | Manager connexions + broadcast + pub/sub (~300 lignes) |
| `server/src/services/chat.ts` | Creer | Service CRUD channels/messages (~200 lignes) |
| `server/src/routes/chat.ts` | Creer | 4 routes REST chat (~150 lignes) |
| `server/src/validators/chat-ws.ts` | Creer | Schemas Zod validation WS (~50 lignes) |
| `server/src/app.ts` | Modifier | Monter chatRoutes |
| `server/src/index.ts` | Modifier | Appeler setupChatWebSocketServer |

### Conventions de code

- **Imports** : `import type` pour les types, `import` pour les valeurs
- **Logger** : `parentLogger.child({ module: "chat-ws" })` pour le contexte
- **Errors** : reutiliser les helpers `forbidden()`, `notFound()` de `server/src/errors.ts`
- **DB** : Drizzle ORM, pas de raw SQL sauf si performance critique
- **RLS** : Le companyId est filtre par RLS automatiquement via `setTenantContext()` (pour les ops WebSocket non-HTTP, appeler `setTenantContext(db, companyId)` explicitement)

### Performance considerations

- Le buffer de reconnexion est un `Map<channelId, Array<ChatServerMessage>>` avec eviction apres 30s et max 100 messages par channel
- Les messages typing_indicator ne sont PAS persistes en DB (in-memory seulement)
- Le rate limiter WebSocket utilise la meme `createRateLimiter` (TECH-04) adapte pour le contexte non-Express (direct call au store)
- Les indexes existants sur `chat_messages` (channel_created_idx, company_created_idx) sont suffisants pour les queries

### Dependances

| Dependance | Version | Raison |
|------------|---------|--------|
| `ws` | Deja installe | WebSocket server (utilise par live-events-ws.ts) |
| `ioredis` | Deja installe (TECH-04) | Redis pub/sub |
| `zod` | Deja installe | Validation payloads |

Aucune nouvelle dependance a installer.

---

## Definition of Done

- [ ] Types chat WebSocket definis dans packages/shared
- [ ] 3 nouveaux LiveEventTypes dans LIVE_EVENT_TYPES
- [ ] Serveur WebSocket chat fonctionnel sur /ws/chat/:channelId
- [ ] Auth WebSocket avec verification permission chat.agent
- [ ] Messages envoyes et recus bidirectionnellement
- [ ] Messages persistes dans chat_messages via chatService
- [ ] Ack renvoye avec clientMessageId echo
- [ ] Broadcast aux autres clients du channel (pas de loop-back pour typing)
- [ ] Rate limiting 10 msg/min par user/channel
- [ ] Reconnexion sync (sync_request -> sync_response avec messages manques)
- [ ] Buffer 30s en memoire pour les messages recents
- [ ] Redis pub/sub pour distribution multi-instance (graceful degradation)
- [ ] 4 routes REST chat fonctionnelles avec permission check
- [ ] Validation Zod des payloads WebSocket
- [ ] Backward compatibility totale avec le WebSocket LiveEvents existant
- [ ] LiveEvents chat.message_sent, chat.channel_created, chat.channel_closed emis
- [ ] Channel lifecycle (open -> closed) avec notification aux clients
- [ ] Tous les tests existants passent (`pnpm test:run`)
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
