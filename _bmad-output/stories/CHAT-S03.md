# CHAT-S03 : ChatService Pipe stdin -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CHAT-S03 |
| **Titre** | ChatService pipe stdin vers container Docker |
| **Epic** | Epic CHAT -- Chat Temps Reel |
| **Sprint** | Sprint 4 (Batch 10) |
| **Effort** | M (5 SP, 3-5j) |
| **Priorite** | P0 -- Prerequis demo CBA (chat bidirectionnel agent) |
| **Assignation** | Tom (backend) |
| **Bloque par** | CONT-S01 (ContainerManager Docker -- DONE), CHAT-S01 (WebSocket bidirectionnel -- DONE) |
| **Debloque** | CHAT-S04 (AgentChatPanel UI) |
| **ADR** | ADR-005 (Chat Temps Reel -- WebSocket Bidirectionnel), ADR-004 (Containerisation Docker) |
| **Type** | Backend (service + integration) |
| **FRs couverts** | REQ-CHAT-02 (dialogue pendant execution), REQ-CHAT-03 (pipe stdin/stdout) |

---

## Description

### Contexte -- Pourquoi cette story est critique

Le chat bidirectionnel (CHAT-S01) et les tables enrichies (CHAT-S02) permettent aux utilisateurs et agents d'echanger des messages persistes via WebSocket. La containerisation (CONT-S01 a CONT-S06) permet de lancer des agents dans des containers Docker isoles. **CHAT-S03 est le pont entre ces deux systemes** : quand un utilisateur envoie un message chat, il doit etre forward au stdin du container Docker de l'agent, et la stdout du container doit etre streamee en retour comme messages chat.

C'est le "moment emotionnel de la demo" CBA : un CEO tape "Utilise le pattern Repository" dans le chat, et voit l'agent s'adapter en temps reel dans son container.

### Etat actuel du code

| Fichier | Etat | Role |
|---------|------|------|
| `server/src/services/chat.ts` | Existe (373 lignes) | Service CRUD chat : createChannel, createMessage, getMessages, etc. |
| `server/src/services/chat-ws-manager.ts` | Existe (499 lignes) | WebSocket manager : connexions, broadcast, buffer, rate limiting, Redis pub/sub |
| `server/src/realtime/chat-ws.ts` | Existe (458 lignes) | Serveur WebSocket /ws/chat/:channelId avec auth et validation |
| `server/src/services/container-manager.ts` | Existe (1028 lignes) | ContainerManager Docker : launch, stop, monitor, profiles. Utilise dockerode |
| `server/src/routes/chat.ts` | Existe (233 lignes) | 7 routes REST chat |
| `packages/shared/src/types/chat-ws.ts` | Existe (98 lignes) | Types protocole WebSocket chat |
| `server/src/validators/chat-ws.ts` | Existe (45 lignes) | Schemas Zod chat |
| `server/src/services/live-events.ts` | Existe (41 lignes) | EventEmitter publishLiveEvent |
| `server/src/services/audit-emitter.ts` | Existe (55 lignes) | emitAudit helper |
| `server/src/services/index.ts` | Existe (44 lignes) | Barrel exports services |

### Ce que cette story construit

1. **ContainerPipeService** (`server/src/services/container-pipe.ts`) -- nouveau service qui gere le pipe bidirectionnel entre chat et container Docker stdin/stdout via Docker exec/attach API
2. **ChatService integration** -- extension du ChatWsManager pour forwarder les messages `chat_message` de type `user` vers le stdin du container associe au channel
3. **Stdout streaming** -- ecoute du stdout/stderr du container Docker et creation de messages chat `agent` correspondants
4. **Reconnexion buffer** -- utilise le buffer 30s existant du ChatWsManager pour gerer les deconnexions temporaires
5. **Rate limiting** -- le rate limiting 10/min existant du ChatWsManager s'applique aux messages pipes
6. **Routes REST** -- nouvelle route POST pour attacher/detacher un pipe a un channel, GET pour le statut du pipe
7. **Types partages** -- nouveaux types pour le pipe status dans packages/shared
8. **Audit** -- emission d'audit events pour les operations pipe (attach, detach, error)
9. **LiveEvent** -- nouveaux types d'evenements pour pipe.attached, pipe.detached, pipe.error

### Ce que cette story ne fait PAS (scope)

- Pas de composant UI React AgentChatPanel (CHAT-S04)
- Pas de modifications aux tables chat (CHAT-S02 deja fait)
- Pas de modifications au WebSocket protocol (CHAT-S01 deja fait)
- Pas de modifications au ContainerManager Docker core (CONT-S01 deja fait)
- Pas de resume LLM des messages (OBS-S03)

---

## Specification Technique

### S1 : ContainerPipeService

**Fichier** : `server/src/services/container-pipe.ts`

Le service central qui gere le pipe bidirectionnel entre le chat WebSocket et le stdin/stdout d'un container Docker.

#### Interface publique

```typescript
export interface PipeAttachOptions {
  channelId: string;
  instanceId: string;    // container_instances.id
  companyId: string;
  actorId: string;       // user who initiated the pipe
  execCommand?: string[]; // default: ["/bin/sh"]
  tty?: boolean;         // default: false
}

export interface PipeStatus {
  channelId: string;
  instanceId: string;
  status: "attached" | "detached" | "error";
  attachedAt: string | null;
  detachedAt: string | null;
  error: string | null;
  messagesPiped: number;
}

export interface ContainerPipeManager {
  attachPipe(opts: PipeAttachOptions): Promise<PipeStatus>;
  detachPipe(channelId: string): Promise<PipeStatus>;
  getPipeStatus(channelId: string): PipeStatus | null;
  pipeMessageToContainer(channelId: string, content: string): Promise<boolean>;
  listActivePipes(companyId: string): PipeStatus[];
  cleanup(): Promise<void>;
}
```

#### Flux de donnees

```
User envoie chat_message via WebSocket
  -> ChatWsManager.handleMessage (CHAT-S01)
  -> Persiste le message (chatService.createMessage)
  -> Broadcast aux autres clients
  -> SI pipe attache:
     -> ContainerPipeService.pipeMessageToContainer(channelId, content)
     -> Docker exec stdin.write(content + "\n")

Container stdout emet des donnees
  -> ContainerPipeService ecoute le stream stdout
  -> Cree un message chat (chatService.createMessage, senderType="agent")
  -> Broadcast via ChatWsManager (broadcastLocal + Redis pub/sub)
```

#### Implementation details

- Utilise `dockerode` container.exec() pour creer une session exec avec stdin/stdout attaches
- Le stream stdout est lu ligne par ligne (ou par chunks) et chaque chunk est converti en message chat
- Un buffer de stdout accumule les donnees pendant 200ms avant d'envoyer (debounce pour eviter le flood)
- Le pipe est nettoye automatiquement quand le container s'arrete ou le channel est ferme
- Les erreurs Docker sont loggees et emises comme messages chat de type "system"

### S2 : Integration ChatWsManager

**Fichier** : `server/src/services/chat-ws-manager.ts`

Extension du `handleMessage` existant pour forwarder les messages vers le pipe container.

#### Modification dans handleMessage, case "chat_message"

Apres la persistance du message et le broadcast, ajouter :

```typescript
// CHAT-S03: Forward user messages to container pipe if attached
if (actorType === "user" && containerPipeManager) {
  const pipeStatus = containerPipeManager.getPipeStatus(channelId);
  if (pipeStatus?.status === "attached") {
    void containerPipeManager
      .pipeMessageToContainer(channelId, payload.content)
      .catch((err) => {
        logger.warn({ err, channelId }, "Failed to pipe message to container");
      });
  }
}
```

#### Nouveau: setter pour containerPipeManager

```typescript
setContainerPipeManager(manager: ContainerPipeManager): void
```

Le ChatWsManager recoit une reference au ContainerPipeManager lors de l'initialisation du serveur.

### S3 : Stdout Streaming vers Chat

Le ContainerPipeService ecoute le stdout du Docker exec stream et cree des messages chat pour chaque output.

#### Debounce strategy

- Accumule stdout dans un buffer pendant 200ms
- Si le buffer depasse 4000 caracteres, flush immediatement
- Chaque flush cree un message chat avec senderType="agent"
- Les messages sont persistes via chatService.createMessage
- Les messages sont broadcastes via le ChatWsManager

#### Stderr handling

- Les stderr sont aussi captures et envoyes comme messages chat avec messageType="system" et metadata `{ stream: "stderr" }`

### S4 : Routes REST

**Fichier** : `server/src/routes/chat.ts` (extension)

| Methode | Path | Auth | Description | data-testid |
|---------|------|------|-------------|-------------|
| POST | `/api/companies/:companyId/chat/channels/:channelId/pipe` | `chat:agent` | Attacher un pipe container a un channel | `chat-s03-pipe-attach` |
| DELETE | `/api/companies/:companyId/chat/channels/:channelId/pipe` | `chat:agent` | Detacher le pipe | `chat-s03-pipe-detach` |
| GET | `/api/companies/:companyId/chat/channels/:channelId/pipe` | `chat:agent` | Statut du pipe | `chat-s03-pipe-status` |

#### POST /pipe request body

```json
{
  "instanceId": "uuid-of-container-instance",
  "execCommand": ["/bin/sh"],
  "tty": false
}
```

#### POST /pipe response

```json
{
  "channelId": "...",
  "instanceId": "...",
  "status": "attached",
  "attachedAt": "2026-03-14T10:00:00Z",
  "detachedAt": null,
  "error": null,
  "messagesPiped": 0
}
```

### S5 : Types Partages

**Fichier** : `packages/shared/src/types/chat-ws.ts` (extension)

Nouveaux types ajoutes :

```typescript
// CHAT-S03: Pipe types
export type ContainerPipeStatus = "attached" | "detached" | "error";

export interface ChatPipeStatus {
  channelId: string;
  instanceId: string;
  status: ContainerPipeStatus;
  attachedAt: string | null;
  detachedAt: string | null;
  error: string | null;
  messagesPiped: number;
}

export interface ChatPipeAttachRequest {
  instanceId: string;
  execCommand?: string[];
  tty?: boolean;
}
```

### S6 : Validator

**Fichier** : `server/src/validators/chat-ws.ts` (extension)

```typescript
// CHAT-S03: pipe attach validator
export const pipeAttachSchema = z.object({
  instanceId: z.string().uuid(),
  execCommand: z.array(z.string()).min(1).max(10).optional(),
  tty: z.boolean().optional(),
});
```

### S7 : LiveEvent Types

**Fichier** : `packages/shared/src/constants.ts` (extension)

Ajouter a `LIVE_EVENT_TYPES` :

- `"chat.pipe_attached"` -- pipe connecte entre channel et container
- `"chat.pipe_detached"` -- pipe deconnecte
- `"chat.pipe_error"` -- erreur de pipe

### S8 : Audit Events

Les operations pipe emettent des audit events :

| Action | Target Type | Trigger |
|--------|-------------|---------|
| `chat.pipe_attached` | `chat_channel` | Quand un pipe est attache a un channel |
| `chat.pipe_detached` | `chat_channel` | Quand un pipe est detache |
| `chat.pipe_error` | `chat_channel` | Quand une erreur de pipe survient |

### S9 : Barrel Exports

**Fichier** : `server/src/services/index.ts` (extension)

```typescript
// chat-s03-barrel-svc
export { createContainerPipeManager, type ContainerPipeManager } from "./container-pipe.js";
```

**Fichier** : `packages/shared/src/types/index.ts` (extension)

```typescript
export type {
  ContainerPipeStatus,
  ChatPipeStatus,
  ChatPipeAttachRequest,
} from "./chat-ws.js";
```

---

## data-testid Mapping Table

| data-testid | Element | Fichier | Description |
|-------------|---------|---------|-------------|
| `chat-s03-pipe-attach` | POST pipe route | `server/src/routes/chat.ts` | Route d'attachement de pipe |
| `chat-s03-pipe-detach` | DELETE pipe route | `server/src/routes/chat.ts` | Route de detachement de pipe |
| `chat-s03-pipe-status` | GET pipe route | `server/src/routes/chat.ts` | Route de statut de pipe |
| `chat-s03-pipe-service` | ContainerPipeService | `server/src/services/container-pipe.ts` | Service de pipe container |
| `chat-s03-pipe-attach-fn` | attachPipe function | `server/src/services/container-pipe.ts` | Fonction d'attachement |
| `chat-s03-pipe-detach-fn` | detachPipe function | `server/src/services/container-pipe.ts` | Fonction de detachement |
| `chat-s03-pipe-status-fn` | getPipeStatus function | `server/src/services/container-pipe.ts` | Fonction de statut |
| `chat-s03-pipe-to-container` | pipeMessageToContainer | `server/src/services/container-pipe.ts` | Fonction de pipe vers container |
| `chat-s03-list-active-pipes` | listActivePipes | `server/src/services/container-pipe.ts` | Liste des pipes actifs |
| `chat-s03-cleanup` | cleanup function | `server/src/services/container-pipe.ts` | Nettoyage des pipes |
| `chat-s03-stdout-handler` | stdout handler | `server/src/services/container-pipe.ts` | Handler de stdout container |
| `chat-s03-stderr-handler` | stderr handler | `server/src/services/container-pipe.ts` | Handler de stderr container |
| `chat-s03-debounce-flush` | debounce flush | `server/src/services/container-pipe.ts` | Flush du buffer debounce |
| `chat-s03-ws-pipe-forward` | WS pipe forward | `server/src/services/chat-ws-manager.ts` | Forward message vers pipe |
| `chat-s03-pipe-manager-setter` | setter | `server/src/services/chat-ws-manager.ts` | Setter du pipe manager |
| `chat-s03-validator` | pipeAttachSchema | `server/src/validators/chat-ws.ts` | Schema Zod pipe attach |
| `chat-s03-live-event-attached` | LiveEvent | `packages/shared/src/constants.ts` | Event chat.pipe_attached |
| `chat-s03-live-event-detached` | LiveEvent | `packages/shared/src/constants.ts` | Event chat.pipe_detached |
| `chat-s03-live-event-error` | LiveEvent | `packages/shared/src/constants.ts` | Event chat.pipe_error |
| `chat-s03-audit-attached` | Audit event | route handler | Audit pipe attached |
| `chat-s03-audit-detached` | Audit event | route handler | Audit pipe detached |
| `chat-s03-shared-types` | Types | `packages/shared/src/types/chat-ws.ts` | Types pipe partages |
| `chat-s03-barrel-svc` | Export | `server/src/services/index.ts` | Barrel export service |
| `chat-s03-barrel-types` | Export | `packages/shared/src/types/index.ts` | Barrel export types |

---

## Acceptance Criteria

### AC1 : Attachement pipe
**Given** un channel chat ouvert avec un agent ayant un container running
**When** un user appelle POST /pipe avec l'instanceId du container
**Then** le pipe est attache et le status est "attached"

### AC2 : Forward message user vers stdin container
**Given** un pipe attache entre un channel et un container
**When** un user envoie un chat_message via WebSocket
**Then** le contenu du message est ecrit dans le stdin du container Docker exec

### AC3 : Streaming stdout vers chat
**Given** un pipe attache entre un channel et un container
**When** le container emet des donnees sur stdout
**Then** un message chat de type "agent" est cree et broadcast aux clients connectes

### AC4 : Stderr comme message system
**Given** un pipe attache entre un channel et un container
**When** le container emet des donnees sur stderr
**Then** un message chat de type "system" est cree avec metadata `{ stream: "stderr" }`

### AC5 : Debounce stdout
**Given** un pipe attache et le container emettant du stdout rapidement
**When** le stdout accumule des donnees pendant 200ms
**Then** un seul message chat est cree avec le contenu accumule (pas de flood)

### AC6 : Detachement pipe
**Given** un pipe attache
**When** un user appelle DELETE /pipe
**Then** le pipe est detache proprement et le status passe a "detached"

### AC7 : Nettoyage automatique
**Given** un pipe attache
**When** le container s'arrete ou le channel est ferme
**Then** le pipe est automatiquement detache et nettoye

### AC8 : Rate limiting
**Given** un pipe attache
**When** un user envoie plus de 10 messages par minute
**Then** les messages supplementaires sont rejetes avec RATE_LIMITED (mecanisme existant ChatWsManager)

### AC9 : Statut pipe
**Given** un pipe attache
**When** un user appelle GET /pipe
**Then** le status complet du pipe est retourne (status, attachedAt, messagesPiped, etc.)

### AC10 : Audit emission
**Given** une operation pipe (attach/detach)
**When** l'operation est executee
**Then** un audit event est emis avec l'action correspondante

### AC11 : LiveEvent emission
**Given** un pipe attache/detache
**When** l'operation est executee
**Then** un LiveEvent est publie pour notifier les clients connectes

### AC12 : Validation instanceId
**Given** un user tentant d'attacher un pipe
**When** l'instanceId ne correspond pas a un container running dans la meme company
**Then** l'operation est rejetee avec une erreur 404 ou 409

### AC13 : Double attach prevention
**Given** un channel avec un pipe deja attache
**When** un user tente d'attacher un deuxieme pipe au meme channel
**Then** l'operation est rejetee avec erreur 409 (Conflict)

---

## Test Cases (Acceptance Criteria mapping)

| ID | Groupe | Description | AC |
|----|--------|-------------|-----|
| T01 | Service | container-pipe.ts existe et exporte createContainerPipeManager | AC1 |
| T02 | Service | attachPipe function existe dans le service | AC1 |
| T03 | Service | detachPipe function existe dans le service | AC6 |
| T04 | Service | getPipeStatus function existe dans le service | AC9 |
| T05 | Service | pipeMessageToContainer function existe dans le service | AC2 |
| T06 | Service | listActivePipes function existe dans le service | AC9 |
| T07 | Service | cleanup function existe dans le service | AC7 |
| T08 | Service | stdout handler utilise debounce/buffer | AC5 |
| T09 | Service | stderr handler cree messages system | AC4 |
| T10 | Service | stdout handler cree messages agent via chatService.createMessage | AC3 |
| T11 | Service | pipe utilise docker exec avec stdin/stdout | AC2 |
| T12 | Service | pipe ferme automatiquement si container s'arrete | AC7 |
| T13 | Service | double attach prevention (conflict check) | AC13 |
| T14 | Integration | ChatWsManager forward messages vers pipe | AC2 |
| T15 | Integration | ChatWsManager a un setter setContainerPipeManager | AC2 |
| T16 | Integration | ChatWsManager verifie pipeStatus avant forward | AC2 |
| T17 | Routes | POST /pipe route existe dans chat.ts | AC1 |
| T18 | Routes | DELETE /pipe route existe dans chat.ts | AC6 |
| T19 | Routes | GET /pipe route existe dans chat.ts | AC9 |
| T20 | Routes | POST /pipe valide instanceId avec pipeAttachSchema | AC12 |
| T21 | Routes | POST /pipe verifie channel ownership (companyId) | AC12 |
| T22 | Routes | POST /pipe verifie container running status | AC12 |
| T23 | Routes | POST /pipe retourne 409 si pipe deja attache | AC13 |
| T24 | Routes | POST /pipe emet audit chat.pipe_attached | AC10 |
| T25 | Routes | DELETE /pipe emet audit chat.pipe_detached | AC10 |
| T26 | Routes | POST /pipe emet LiveEvent chat.pipe_attached | AC11 |
| T27 | Routes | DELETE /pipe emet LiveEvent chat.pipe_detached | AC11 |
| T28 | Validator | pipeAttachSchema valide instanceId UUID | AC12 |
| T29 | Validator | pipeAttachSchema accepte execCommand optionnel | AC1 |
| T30 | Validator | pipeAttachSchema accepte tty optionnel | AC1 |
| T31 | Types | ContainerPipeStatus type existe dans chat-ws.ts | AC9 |
| T32 | Types | ChatPipeStatus interface existe dans chat-ws.ts | AC9 |
| T33 | Types | ChatPipeAttachRequest interface existe dans chat-ws.ts | AC1 |
| T34 | LiveEvents | LIVE_EVENT_TYPES contient chat.pipe_attached | AC11 |
| T35 | LiveEvents | LIVE_EVENT_TYPES contient chat.pipe_detached | AC11 |
| T36 | LiveEvents | LIVE_EVENT_TYPES contient chat.pipe_error | AC11 |
| T37 | Barrel | services/index.ts exporte createContainerPipeManager | AC1 |
| T38 | Barrel | services/index.ts exporte ContainerPipeManager type | AC1 |
| T39 | Barrel | types/index.ts exporte ContainerPipeStatus | AC9 |
| T40 | Barrel | types/index.ts exporte ChatPipeStatus | AC9 |
| T41 | Barrel | types/index.ts exporte ChatPipeAttachRequest | AC1 |
| T42 | Regression | CHAT-S01 chat-ws-manager.ts n'a pas de breaking changes | -- |
| T43 | Regression | CHAT-S02 routes count dans chat.ts est >= 7 (CHAT-S02) + 3 (CHAT-S03) | -- |
| T44 | Regression | CONT-S01 container-manager.ts exports sont intacts | -- |

---

## Definition of Done

- [ ] `server/src/services/container-pipe.ts` cree avec toutes les fonctions (attachPipe, detachPipe, getPipeStatus, pipeMessageToContainer, listActivePipes, cleanup)
- [ ] `server/src/services/chat-ws-manager.ts` etendu avec setContainerPipeManager et forward dans handleMessage
- [ ] `server/src/routes/chat.ts` etendu avec 3 routes pipe (POST, DELETE, GET)
- [ ] `server/src/validators/chat-ws.ts` etendu avec pipeAttachSchema
- [ ] `packages/shared/src/types/chat-ws.ts` etendu avec types pipe
- [ ] `packages/shared/src/constants.ts` etendu avec 3 LiveEventTypes
- [ ] `server/src/services/index.ts` barrel export du service
- [ ] `packages/shared/src/types/index.ts` barrel export des types
- [ ] Audit events emis pour attach/detach
- [ ] LiveEvents emis pour attach/detach/error
- [ ] Tous les tests E2E passent (44/44)
- [ ] Pas de regressions sur CHAT-S01, CHAT-S02, CONT-S01
