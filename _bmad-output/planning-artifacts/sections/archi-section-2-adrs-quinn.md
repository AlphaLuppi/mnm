# ADRs 004–008 : Problèmes Architecturaux Complexes

> **Auteur** : Dr. Quinn — Problem Solver
> **Date** : 2026-03-14
> **Sources** : PRD B2B v1.0, Nanoclaw Research, Code source MnM (secrets.ts, live-events-ws.ts, heartbeat.ts, drift.ts, adapters/)
> **Statut** : Proposé

---

## Table des Matières

1. [ADR-004 : Containerisation Docker & Credential Proxy](#adr-004--containerisation-docker--credential-proxy)
2. [ADR-005 : Chat Temps Réel — WebSocket Bidirectionnel](#adr-005--chat-temps-réel--websocket-bidirectionnel)
3. [ADR-006 : Communication Agent-to-Agent (A2A)](#adr-006--communication-agent-to-agent-a2a)
4. [ADR-007 : Observabilité — Audit Log Immutable & Résumé LLM](#adr-007--observabilité--audit-log-immutable--résumé-llm)
5. [ADR-008 : Gestion de Compaction](#adr-008--gestion-de-compaction)

---

## ADR-004 : Containerisation Docker & Credential Proxy

### Contexte

MnM exécute aujourd'hui les agents IA comme des processus enfants directs du serveur Node.js, via `runChildProcess()` dans le service heartbeat (`server/src/services/heartbeat.ts`, ~2396 lignes). Les agents héritent des permissions de l'utilisateur système qui fait tourner MnM :

- **Accès fichier complet** : aucun sandboxing filesystem — un agent peut lire `~/.ssh`, `~/.aws`, n'importe quel fichier accessible au processus MnM.
- **Credentials en clair** : les variables d'environnement sont résolues par `secrets.ts` (4 providers : `plain`, `secret_ref`, etc.) puis passées directement dans `process.env` du child process. Un agent malveillant ou compromis peut lire `ANTHROPIC_API_KEY` via `process.env` ou `cat /proc/self/environ`.
- **Pas de limites de ressources** : seul un timeout basique existe. Un agent peut consommer CPU et RAM sans borne.
- **Pas d'isolation réseau** : les agents partagent la stack réseau du host.

Pour le B2B enterprise multi-tenant (REQ-CONT-01 à REQ-CONT-07), cette architecture est un risque de sécurité inacceptable. L'analyse de Nanoclaw (`_research/nanoclaw-analysis-realtime-chat-and-containerization.md`) a révélé un pattern mature de **defense in depth à 5 couches** que MnM doit adopter et adapter.

### Options Considérées

#### Option A : gVisor / Firecracker (micro-VMs)

- Isolation noyau forte (sandboxing syscall)
- Temps de démarrage ~1-3s (Firecracker), ~100ms overhead (gVisor)
- Complexité opérationnelle élevée : gVisor nécessite un runtime custom, Firecracker nécessite un host Linux avec KVM
- Non compatible Windows/macOS pour le développement local
- Sur-ingénierie pour le cas d'usage actuel (agents de code, pas workloads adversariaux)

#### Option B : Wasm/WASI Isolation

- Isolation au niveau du bytecode
- Excellent pour le sandboxing CPU-bound
- Incompatible avec les SDKs agents existants (Claude SDK, Codex CLI, Cursor) qui sont des binaires natifs Node.js
- Pas de support Docker mount, networking standard
- Trop restrictif — les agents ont besoin d'un shell, de git, d'outils CLI

#### Option C : Docker containers éphémères avec Credential Proxy (RETENUE)

- Pattern prouvé par Nanoclaw en production
- Compatible avec tous les adapter types existants (8 types dans `server/src/adapters/registry.ts`)
- Defense in depth à 5 couches
- Temps de démarrage <10s (objectif PRD), images pré-pullées <5s
- Dégradation gracieuse possible (mode sans Docker = processus local avec warnings)
- Écosystème Docker mature, tooling existant (dockerode, Docker Compose)

### Décision

**Adopter l'Option C** : containers Docker éphémères avec credential proxy HTTP, en adaptant le pattern Nanoclaw pour l'architecture multi-tenant PostgreSQL de MnM.

### Architecture Détaillée — 5 Couches de Defense in Depth

#### Couche 1 : Container Docker éphémère

Chaque exécution d'agent crée un container Docker éphémère `--rm`. Le container est détruit automatiquement après exécution — aucune donnée persistante dans le container lui-même.

```
ContainerManager.run({
  image: "mnm-agent-dev:latest",    // image par profil
  rm: true,                          // éphémère
  user: "node:node",                 // non-root (uid 1000)
  networkMode: "none",               // isolation réseau par défaut
  memoryLimit: "2g",                 // REQ-CONT-06
  cpuQuota: 80000,                   // 80% d'un CPU
  pidsLimit: 256,                    // protection fork bomb
  readonlyRootfs: true,              // filesystem racine RO
  tmpfs: { "/tmp": "size=512m" },    // tmpfs pour écriture
})
```

**Images par profil d'agent** (stockées dans `container_profiles`) :

| Profil | Image de base | Outils préinstallés |
|--------|--------------|---------------------|
| `dev` | `node:22-slim` | git, npm, pnpm, Claude SDK |
| `designer` | `node:22-slim` | Chromium, design tools |
| `qa` | `node:22-slim` | Playwright, jest, vitest |
| `minimal` | `node:22-alpine` | shell uniquement |

#### Couche 2 : Mount Allowlist Tamper-Proof

Fichier de configuration **externe au container** (JAMAIS monté dans le container) :

```json
// PostgreSQL: container_mount_allowlists table
// OU fichier local: ~/.config/mnm/mount-allowlist.json (self-hosted)
{
  "allowedRoots": [
    { "path": "/workspace/projects", "allowReadWrite": true },
    { "path": "/workspace/shared-libs", "allowReadWrite": false }
  ],
  "blockedPatterns": [
    "password", "secret", "token", ".ssh", ".gnupg", ".aws",
    ".azure", ".gcloud", ".kube", ".docker", "credentials",
    ".env", ".netrc", ".npmrc", ".pypirc", "id_rsa",
    "id_ed25519", "private_key", ".secret"
  ]
}
```

**Validation des mounts** — 5 étapes séquentielles :

1. **Rejet path traversal** : tout chemin contenant `..` est rejeté
2. **Résolution symlink** : `fs.realpath()` — les symlinks qui pointent hors des `allowedRoots` sont rejetés
3. **Vérification blockedPatterns** : chaque composant du chemin est testé contre les patterns
4. **Vérification allowedRoots** : le chemin résolu doit être un sous-chemin d'un `allowedRoot`
5. **Enforcement RO** : les mounts hors du workspace principal sont forcés en read-only

#### Couche 3 : Credential Proxy HTTP

C'est le composant le plus critique. Les agents ne doivent **JAMAIS** accéder directement aux clés API.

```
┌──────────────────────┐      ┌─────────────────────────┐
│   Container Agent    │      │    Host MnM Server      │
│                      │      │                         │
│  ANTHROPIC_API_KEY   │──────│  Credential Proxy       │
│  = "placeholder"     │      │  (port interne)         │
│                      │      │                         │
│  ANTHROPIC_BASE_URL  │──────│  → Intercepte requêtes  │
│  = http://host:3001  │      │  → Remplace placeholder  │
│                      │      │    par vraie clé         │
│  .env → /dev/null    │      │  → Forward à l'API      │
│  (shadow mount)      │      │  → Log audit            │
└──────────────────────┘      └─────────────────────────┘
```

**Implémentation** — `server/src/services/credential-proxy.ts` :

```typescript
// Le proxy s'intègre avec le secretService existant (secrets.ts)
// qui a déjà 4 providers et le pattern resolveAdapterConfigForRuntime()
interface CredentialProxyConfig {
  listenPort: number;          // port dynamique par container
  targetUrl: string;           // URL API réelle (api.anthropic.com)
  agentId: string;             // pour le audit log
  runId: string;               // pour la traçabilité
  credentials: Map<string, string>;  // clé header → valeur réelle
}
```

Le proxy utilise le `secretService.resolveAdapterConfigForRuntime()` existant pour résoudre les `secret_ref` en valeurs, puis les injecte dans les headers sans jamais les exposer au container.

**Shadow `.env`** — Protection contre l'accès direct aux secrets :

```typescript
// Si un fichier .env existe dans le workspace monté
if (fs.existsSync(path.join(workspacePath, '.env'))) {
  mounts.push({
    hostPath: '/dev/null',
    containerPath: '/workspace/project/.env',
    readonly: true,
  });
}
```

#### Couche 4 : Isolation Inter-Agents

Chaque container reçoit un namespace IPC isolé. Les capacités sont différenciées par rôle :

| Capability | Agent principal | Agent secondaire |
|------------|----------------|-----------------|
| Accès workspace projet | RW | RO ou aucun |
| Accès fichiers autres agents | Non | Non |
| Communication A2A | Via bus (ADR-006) | Via bus (ADR-006) |
| Accès réseau | Configurable | `none` par défaut |

#### Couche 5 : Limites de Ressources

```typescript
interface ContainerResourceLimits {
  memoryMB: number;        // défaut 2048, max 8192
  cpuPercent: number;      // défaut 80, max 100
  diskMB: number;          // défaut 1024 (tmpfs)
  pidsLimit: number;       // défaut 256
  timeoutMs: number;       // défaut 30min, reset sur output
  outputMaxBytes: number;  // défaut 10MB
  concurrencyLimit: number; // par company, défaut 5
}
```

**Timeout avec reset** — adapté du pattern Nanoclaw :

Le timeout se réinitialise à chaque output du container (SIGTERM suivi de SIGKILL après 10s si pas d'arrêt propre). Ce pattern est crucial car les agents LLM ont des temps de réponse variables.

### Architecture des Composants

```
server/src/
├── containers/
│   ├── container-manager.ts        // Lifecycle containers (dockerode)
│   ├── container-profiles.ts       // Profils par type d'agent
│   ├── credential-proxy.ts         // Proxy HTTP credentials
│   ├── mount-validator.ts          // Validation allowlist
│   └── resource-monitor.ts         // Monitoring limites
├── adapters/
│   ├── docker/
│   │   ├── docker-adapter.ts       // Adapter Docker (ServerAdapterModule)
│   │   └── docker-image-builder.ts // Build/pull images
│   └── registry.ts                 // +1 adapter type "docker_container"
└── services/
    ├── heartbeat.ts                // Modifié : délègue au ContainerManager
    └── secrets.ts                  // Inchangé : fournit les credentials
```

### Conséquences

**Positives :**
- Isolation complète des agents — un agent compromis ne peut pas accéder aux secrets ou fichiers d'autres agents
- Les credentials ne sont jamais exposées aux agents, même via `/proc/self/environ`
- Limites de ressources empêchent les abus (fork bombs, OOM, etc.)
- Audit complet de toutes les requêtes API via le credential proxy
- Compatible avec le modèle multi-tenant B2B

**Négatives :**
- Overhead de démarrage : ~3-10s par container vs ~100ms pour un processus local
- Complexité opérationnelle : Docker doit être installé et fonctionnel sur le host
- Images Docker à maintenir et mettre à jour
- Consommation mémoire accrue : chaque container a son propre kernel namespace

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Docker daemon indisponible | Moyenne | Critique | Mode dégradé : exécution en processus local avec warnings de sécurité et log audit |
| Container qui ne s'arrête pas | Faible | Moyen | Timeout SIGTERM → SIGKILL 10s + monitoring |
| Credential proxy comme SPOF | Faible | Critique | Health check + retry (3 tentatives, suspend agent après 3 échecs) |
| Path traversal via symlinks | Moyenne | Critique | `realpath()` + rejection systématique des symlinks hors allowlist |
| Épuisement ressources Docker | Moyenne | Moyen | Quota par company, file d'attente avec priorité |
| Latence réseau credential proxy | Faible | Faible | Proxy sur `host.docker.internal` (latence <1ms), connection pooling |

---

## ADR-005 : Chat Temps Réel — WebSocket Bidirectionnel

### Contexte

L'état actuel du WebSocket dans MnM (`server/src/realtime/live-events-ws.ts`, 273 lignes) est **strictement unidirectionnel** : le serveur publie des événements vers les clients via `subscribeCompanyLiveEvents()`, mais le client ne peut pas envoyer de messages au serveur via le WebSocket.

Analyse du code existant :

```typescript
// live-events-ws.ts ligne 201-210 : le handler "connection"
// ne définit aucun listener "message" sur le socket
wss.on("connection", (socket: WsSocket, req: IncomingMessage) => {
  const unsubscribe = subscribeCompanyLiveEvents(context.companyId, (event) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(event));  // serveur → client UNIQUEMENT
  });
  // ... ping/pong, close, error — mais PAS de socket.on("message")
});
```

L'interface `WsSocket` elle-même ne déclare même pas de handler `on("message")`. Le WebSocket actuel ne sert qu'à diffuser les événements `heartbeat.run.status`, `heartbeat.run.event`, et `heartbeat.run.log`.

Le PRD exige (REQ-CHAT-01 à REQ-CHAT-05) un dialogue bidirectionnel humain-agent pendant l'exécution. L'analyse Nanoclaw montre que cela est faisable via un pattern `MessageStream` + stdin piping, adapté à l'infrastructure WebSocket existante de MnM.

De plus, le `runChildProcess()` dans heartbeat.ts configure actuellement le stdin à `"ignore"` — le pipe existe dans Node.js mais n'est pas utilisé.

### Options Considérées

#### Option A : SSE (Server-Sent Events) pour le downstream + POST pour l'upstream

- Plus simple à implémenter côté serveur
- Pas de problème de proxy/firewall (HTTP standard)
- Limité : une connexion par direction, pas de multiplexage
- Rejet : MnM a déjà un WebSocket fonctionnel — ajouter SSE serait une régression architecturale

#### Option B : gRPC bidirectionnel

- Excellent pour le streaming bidirectionnel
- Typage fort via Protocol Buffers
- Rejet : complexité d'intégration avec l'écosystème frontend React existant, et l'UI utilise déjà React Query + WebSocket. gRPC-Web ajoute un proxy supplémentaire.

#### Option C : Extension WebSocket bidirectionnel (RETENUE)

- Réutilise l'infrastructure WebSocket existante (`live-events-ws.ts`)
- Ajout d'un handler `on("message")` pour le trafic client → serveur
- Routing par type de message vers les handlers appropriés
- Compatible avec `LiveUpdatesProvider.tsx` côté frontend

### Décision

**Adopter l'Option C** : étendre le WebSocket existant pour supporter le trafic bidirectionnel, avec un protocole de messages typé et un pipe vers stdin des agents en cours d'exécution.

### Architecture Détaillée

#### Protocole de Messages

```typescript
// Messages client → serveur
type ClientMessage =
  | { type: "chat.send"; runId: string; content: string; requestId: string }
  | { type: "chat.typing"; runId: string }
  | { type: "agent.interrupt"; runId: string; reason?: string }
  | { type: "ping" };

// Messages serveur → client (extension de l'existant)
type ServerMessage =
  | { type: "chat.message"; runId: string; message: ChatMessage }
  | { type: "chat.ack"; requestId: string; messageId: string }
  | { type: "chat.error"; requestId: string; code: string; reason: string }
  | { type: "chat.agent_typing"; runId: string }
  | LiveEvent;  // événements existants (heartbeat.run.status, etc.)
```

#### Modification de `live-events-ws.ts`

Le handler `on("connection")` doit être étendu avec un listener `on("message")` :

```typescript
// Ajout au handler connection (ligne ~201)
socket.on("message", (raw: Buffer | string) => {
  try {
    const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString()) as ClientMessage;
    handleClientMessage(socket, context, msg);
  } catch {
    socket.send(JSON.stringify({
      type: "chat.error",
      requestId: "unknown",
      code: "PARSE_ERROR",
      reason: "Invalid JSON"
    }));
  }
});
```

#### Pipeline Chat : UI → WebSocket → stdin Agent

```
┌────────┐    WebSocket     ┌──────────┐    stdin pipe    ┌──────────────┐
│   UI   │ ──chat.send──→  │  Server  │ ──JSON write──→ │   Agent      │
│        │                  │          │                  │  (container  │
│        │ ←chat.message── │          │ ←stdout parse── │   ou local)  │
└────────┘                  └──────────┘                  └──────────────┘
```

**Modification de `heartbeat.ts`** — le `runChildProcess()` doit :

1. Ouvrir stdin en mode `"pipe"` au lieu de `"ignore"`
2. Enregistrer le processus dans un `Map<runId, ChildProcess>` accessible au handler WebSocket
3. Écrire les messages chat sur `process.stdin` au format JSON (une ligne par message)

```typescript
// Dans le spawn de l'agent
const child = spawn(command, args, {
  stdio: ["pipe", "pipe", "pipe"],  // stdin en pipe (était "ignore")
  // ...
});

// Enregistrement pour accès depuis le handler WebSocket
runningProcesses.set(runId, {
  process: child,
  agentId,
  companyId,
  startedAt: Date.now(),
});
```

#### Schéma Base de Données

```sql
-- Table de persistance des messages chat
CREATE TABLE chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  run_id UUID NOT NULL REFERENCES heartbeat_runs(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  UNIQUE(run_id)  -- un channel par run
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id),
  sender_type TEXT NOT NULL CHECK(sender_type IN ('user', 'agent', 'system')),
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,  -- pour les pièces jointes, code snippets, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_channel_created
  ON chat_messages(channel_id, created_at);
```

#### Reconnexion avec Sync Messages Manqués (REQ-CHAT-03)

```typescript
// Buffer circulaire côté serveur (30 secondes)
class MessageBuffer {
  private buffer: Map<string, ChatMessage[]> = new Map(); // runId → messages
  private readonly maxAgeMs = 30_000;

  push(runId: string, message: ChatMessage): void {
    const messages = this.buffer.get(runId) ?? [];
    messages.push(message);
    this.buffer.set(runId, messages);
    this.pruneOld(runId);
  }

  // À la reconnexion, le client envoie son lastMessageId
  // Le serveur renvoie tous les messages après ce point
  getSince(runId: string, lastMessageId: string | null): ChatMessage[] {
    const messages = this.buffer.get(runId) ?? [];
    if (!lastMessageId) return messages;
    const idx = messages.findIndex(m => m.id === lastMessageId);
    return idx >= 0 ? messages.slice(idx + 1) : messages;
  }
}
```

#### Rate Limiting (REQ-CHAT-05)

```typescript
// 10 messages par minute par utilisateur par channel
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, channelId: string): boolean {
  const key = `${userId}:${channelId}`;
  const now = Date.now();
  const entry = rateLimiter.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}
```

### Conséquences

**Positives :**
- Dialogue temps réel humain-agent pendant l'exécution du workflow
- Réutilise l'infrastructure WebSocket existante — pas de nouveau serveur
- Persistance des conversations pour replay et audit
- Le buffer 30s résout le problème de reconnexion gracieusement

**Négatives :**
- Le handler `on("message")` ajoute de la complexité au WebSocket existant
- Le piping stdin nécessite une modification non-triviale de `heartbeat.ts`
- Tous les adapter types ne supportent pas stdin (certains CLI agents ignorent stdin)

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Agent qui ne lit pas stdin | Moyenne | Moyen | Détection via timeout réponse, fallback en mode "note" (message persisté mais pas transmis en temps réel) |
| Flood de messages | Faible | Moyen | Rate limit 10/min + validation taille max 100KB + sanitization XSS (UTF-8 strict) |
| Messages en vol lors de crash serveur | Faible | Faible | Messages persistés en DB avant forwarding, le buffer 30s ne sert que pour la reconnexion rapide |
| Confusion client si message après fin d'exécution | Moyenne | Faible | Rejet avec `chat.error` code `RUN_COMPLETED` |
| Contenu XSS dans les messages | Moyenne | Élevé | Sanitization UTF-8 strict côté serveur, échappement HTML côté client, Content Security Policy |

---

## ADR-006 : Communication Agent-to-Agent (A2A)

### Contexte

MnM dispose déjà d'un système de permissions inter-agents dans la base de données : `agents.permissions`, `agents.reportsTo`, et les `principal_permission_grants` (pour les agents). Le PRD prévoit des interactions entre agents IA dans le cadre de workflows complexes (REQ-A2A-01 à REQ-A2A-04) :

- Un agent architecte qui consulte l'agent QA pour valider un schéma
- Un agent PM qui délègue une sous-tâche à un agent développeur
- Un agent développeur qui partage un artifact avec l'agent designer

Aujourd'hui, les agents sont exécutés de manière isolée par le heartbeat service — chaque run est indépendant, et il n'existe aucun bus de communication entre agents en cours d'exécution. Les interactions se font uniquement via des modifications de fichiers dans le workspace partagé (détection passive).

Le risque principal est la **boucle infinie** : un agent A envoie un message à B, qui répond à A, qui répond à B, etc. — consommant des tokens LLM sans limite. La validation human-in-the-loop configurable est la réponse à ce risque.

### Options Considérées

#### Option A : Communication via fichiers partagés (pattern actuel implicite)

- Les agents écrivent des fichiers dans un workspace commun
- Détection via polling ou inotify
- Simple mais fragile : pas de garantie de livraison, pas de typage, pas d'audit
- Rejet : ne répond pas aux exigences d'audit et de validation humaine

#### Option B : Message broker externe (RabbitMQ / Redis Streams)

- Infrastructure robuste, patterns publish/subscribe éprouvés
- Overhead opérationnel : un service supplémentaire à déployer et maintenir
- Sur-ingénierie pour le volume attendu (dizaines de messages A2A par jour, pas des milliers)
- Rejet : complexité opérationnelle disproportionnée

#### Option C : Bus de messages applicatif avec validation humaine (RETENUE)

- Bus interne au serveur MnM, persisté en PostgreSQL
- Validation human-in-the-loop configurable par paire d'agents
- Audit de chaque transaction
- Intégration avec le WebSocket existant pour les notifications temps réel

### Décision

**Adopter l'Option C** : bus de messages A2A applicatif, intégré au serveur MnM, avec validation humaine configurable et audit complet.

### Architecture Détaillée

#### Composants Principaux

```
┌─────────────┐    A2ABus     ┌──────────────────┐    Notification    ┌──────┐
│  Agent A    │ ──request──→ │  PermissionCheck  │ ──────────────→   │  UI  │
│ (container) │              │  + HumanValidation│                   │      │
│             │ ←response── │  + AuditLogger    │ ←──approve/deny── │      │
└─────────────┘              └──────────────────┘                   └──────┘
                                    │
                                    ▼
                              ┌──────────┐
                              │  Agent B │
                              │          │
                              └──────────┘
```

#### Types de Messages A2A

```typescript
type A2AMessageType =
  | "query"        // Question à un autre agent (réponse attendue)
  | "notify"       // Notification sans réponse attendue
  | "delegate"     // Délégation de sous-tâche
  | "share"        // Partage d'artifact (fichier, snippet, résultat)
  | "context_request" // Demande de contexte (historique, décisions)
;

interface A2AMessage {
  id: string;                    // UUID
  fromAgentId: string;
  toAgentId: string;
  type: A2AMessageType;
  subject: string;               // Description courte
  content: string;               // Contenu complet (JSON ou texte)
  metadata: {
    workflowId?: string;         // Contexte workflow
    stageId?: string;            // Étape courante
    priority: "low" | "normal" | "high";
    requiresHumanApproval: boolean;
    maxResponseTimeMs?: number;  // Timeout de réponse
  };
  status: "pending_approval" | "approved" | "delivered" | "responded" | "rejected" | "timeout";
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;           // userId du validateur humain
  deliveredAt?: Date;
  respondedAt?: Date;
}
```

#### Validation Human-in-the-Loop

La matrice de permissions détermine si une approbation humaine est requise :

```typescript
interface A2APermissionRule {
  id: string;
  companyId: string;
  fromAgentId: string | "*";     // wildcard = tout agent
  toAgentId: string | "*";
  messageType: A2AMessageType | "*";
  requireApproval: boolean;       // true = human-in-the-loop
  autoApproveConditions?: {
    maxContentLength?: number;    // auto-approve si contenu court
    allowedSubjects?: string[];   // patterns de sujets auto-approuvés
    withinSameWorkflow?: boolean; // auto-approve si même workflow
  };
}
```

**Algorithme de résolution** :

1. Chercher une règle spécifique `(fromAgentId, toAgentId, messageType)`
2. Sinon, chercher `(fromAgentId, toAgentId, *)`
3. Sinon, chercher `(*, *, messageType)`
4. Sinon, **défaut = requireApproval: true** (sécurité par défaut)

#### Protection Anti-Boucle

```typescript
class A2ALoopDetector {
  // Fenêtre glissante de 5 minutes
  private recentMessages = new Map<string, number[]>();

  check(fromAgentId: string, toAgentId: string): boolean {
    const pairKey = `${fromAgentId}:${toAgentId}`;
    const reversePairKey = `${toAgentId}:${fromAgentId}`;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;

    // Compter les messages dans les deux directions
    const forwardCount = this.countRecent(pairKey, now, windowMs);
    const reverseCount = this.countRecent(reversePairKey, now, windowMs);

    // Si > 10 échanges dans la fenêtre → suspicion de boucle
    if (forwardCount + reverseCount > 10) {
      return false; // BLOQUER
    }

    this.record(pairKey, now);
    return true;
  }
}
```

#### Schéma Base de Données

```sql
CREATE TABLE a2a_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  from_agent_id UUID NOT NULL REFERENCES agents(id),
  to_agent_id UUID NOT NULL REFERENCES agents(id),
  message_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_approval',
  parent_message_id UUID REFERENCES a2a_messages(id), -- pour les réponses
  workflow_instance_id UUID,  -- contexte workflow si applicable
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  delivered_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_a2a_messages_to_agent ON a2a_messages(to_agent_id, status);
CREATE INDEX idx_a2a_messages_company ON a2a_messages(company_id, created_at);

CREATE TABLE a2a_permission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  from_agent_id UUID,  -- NULL = wildcard
  to_agent_id UUID,    -- NULL = wildcard
  message_type TEXT,    -- NULL = wildcard
  require_approval BOOLEAN NOT NULL DEFAULT TRUE,
  auto_approve_conditions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Intégration avec les Agents Containerisés (ADR-004)

Les agents dans leurs containers accèdent au bus A2A via une API HTTP locale exposée par le credential proxy :

```
Container Agent A → http://host.docker.internal:3001/a2a/send
                  → http://host.docker.internal:3001/a2a/poll
                  → http://host.docker.internal:3001/a2a/respond
```

Le credential proxy authentifie l'agent par son `agentId` (injecté dans l'environnement du container) et applique les permissions.

### Conséquences

**Positives :**
- Communication structurée et auditée entre agents
- Validation humaine configurable — sécurité par défaut
- Protection anti-boucle intégrée
- Traçabilité complète de chaque transaction A2A

**Négatives :**
- Latence ajoutée par la validation humaine (secondes à minutes selon la configuration)
- Complexité du système de permissions (matrice de règles)
- Les agents doivent être modifiés pour utiliser l'API A2A (prompt engineering + tools)

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Boucle infinie A2A | Moyenne | Critique | Détecteur de boucle (10 échanges / 5 min), circuit breaker, alerte |
| Fatigue d'approbation humaine | Élevée | Moyen | Auto-approve configurable pour les patterns récurrents et sûrs |
| Agent qui ne répond jamais | Moyenne | Moyen | Timeout configurable (défaut 5 min), notification à l'agent source |
| Contenu A2A qui leak des secrets | Faible | Élevé | Scan du contenu contre les `blockedPatterns` de l'ADR-004, alerting |

---

## ADR-007 : Observabilité — Audit Log Immutable & Résumé LLM

### Contexte

MnM dispose déjà d'un `activity_log` basique (`packages/db/src/schema/activity_log.ts`, 26 lignes) avec les colonnes : `companyId`, `actorType`, `actorId`, `action`, `entityType`, `entityId`, `agentId`, `runId`, `details` (JSONB), `createdAt`. Ce log est alimenté ponctuellement depuis `heartbeat.ts` et `costs.ts`.

Cependant, ce log souffre de plusieurs limitations pour le B2B enterprise :

1. **Mutabilité** : rien n'empêche un `UPDATE` ou `DELETE` sur les entrées — pas d'immutabilité garantie
2. **Pas de partitionnement** : toutes les entreprises dans une seule table, pas d'optimisation pour la rétention longue (3 ans requis par REQ-OBS-06)
3. **Pas de résumé** : les logs sont techniques (JSON brut) — les managers non-techniques ne peuvent pas les comprendre
4. **Pas de dashboards agrégés** : la Vérité #20 du brainstorming exige "JAMAIS de dashboards individuels"
5. **Pas d'export** : REQ-OBS-05 exige CSV/JSON

Le `heartbeat_run_events` existant capture les événements d'exécution, et le `cost_events` trace les coûts. Mais aucun de ces systèmes ne fournit un audit trail immutable et compréhensible pour les décideurs business.

### Options Considérées

#### Option A : Audit log externe (Elasticsearch / OpenSearch)

- Recherche full-text performante
- Kibana/OpenSearch Dashboards pour la visualisation
- Complexité opérationnelle : cluster à maintenir, synchronisation avec PostgreSQL
- Rejet : trop de dépendances pour le MVP, PostgreSQL peut gérer le volume attendu

#### Option B : Event sourcing complet

- Historique complet et immuable par design
- Capacité de replay et reconstruction de l'état
- Rejet : changement paradigmatique de toute l'architecture — disproportionné. MnM n'est pas un système financier.

#### Option C : Audit log PostgreSQL partitionné + TRIGGER d'immutabilité + Résumé LLM (RETENUE)

- Extension du `activity_log` existant
- Immutabilité garantie par TRIGGER SQL
- Partitionnement par date pour la rétention longue
- Résumé LLM temps réel via un service dédié

### Décision

**Adopter l'Option C** : audit log immutable partitionné dans PostgreSQL avec résumé LLM temps réel.

### Architecture Détaillée

#### Immutabilité par TRIGGER SQL

```sql
-- TRIGGER qui empêche toute modification ou suppression
-- sur la table audit_log (renommée depuis activity_log)
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable — UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

-- Appliqué sur UPDATE
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();

-- Appliqué sur DELETE
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();
```

**Note** : un superadmin PostgreSQL peut toujours désactiver les triggers. Pour une immutabilité plus forte en production, un rôle applicatif dédié sans `ALTER TABLE` est requis. Cette limitation est documentée.

#### Partitionnement par Date

```sql
-- Table partitionnée par mois pour la rétention longue
CREATE TABLE audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  agent_id UUID,
  run_id UUID,
  workflow_instance_id UUID,
  stage_instance_id UUID,
  details JSONB,
  summary TEXT,              -- Résumé LLM en langage naturel
  summary_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)  -- clé composite pour le partitionnement
) PARTITION BY RANGE (created_at);

-- Partitions mensuelles (générées automatiquement par un job CRON)
CREATE TABLE audit_log_2026_03 PARTITION OF audit_log
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE audit_log_2026_04 PARTITION OF audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- etc.
```

**Rétention** : les partitions de plus de 3 ans peuvent être archivées (pg_dump) puis détachées (`ALTER TABLE audit_log DETACH PARTITION`). Ce pattern permet une rétention efficace sans impacter les performances.

#### Résumé LLM Temps Réel (REQ-OBS-01)

Le service `audit-summarizer.ts` traduit les logs techniques en langage naturel compréhensible par un manager :

```typescript
// server/src/services/audit-summarizer.ts
interface AuditSummarizerConfig {
  model: string;           // e.g. "claude-haiku-4-5" — modèle rapide et économique
  maxLatencyMs: number;    // 5000ms max (REQ-OBS-01)
  batchSize: number;       // traiter par lots de 5 événements max
  language: "fr" | "en";   // langue de sortie
}

// Exemple de transformation
// Input (log technique) :
// { action: "file.write", entity_type: "file", entity_id: "/src/auth/middleware.ts",
//   details: { linesAdded: 47, linesRemoved: 12 } }
//
// Output (résumé LLM) :
// "L'agent a modifié le middleware d'authentification : 47 lignes ajoutées,
//  12 supprimées. Il semble refactorer la validation des tokens JWT."
```

**Architecture du pipeline** :

```
Événement brut → audit_log INSERT → pg_notify('audit_new')
                                          ↓
                                   AuditSummarizer (listener)
                                          ↓
                                   Batch (max 5, max 2s wait)
                                          ↓
                                   LLM API (Haiku — rapide, économique)
                                          ↓
                                   UPDATE audit_log SET summary = ...
                                   (via une colonne summary distincte,
                                    le TRIGGER autorise cet UPDATE spécifique)
```

**Exception au TRIGGER d'immutabilité** : le champ `summary` est la seule colonne modifiable, et uniquement par le service summarizer. Le TRIGGER est ajusté :

```sql
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Autoriser uniquement la mise à jour du résumé LLM
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.company_id = NEW.company_id
        AND OLD.actor_type = NEW.actor_type
        AND OLD.action = NEW.action
        AND OLD.entity_type = NEW.entity_type
        AND OLD.entity_id = NEW.entity_id
        AND OLD.details IS NOT DISTINCT FROM NEW.details
        AND OLD.created_at = NEW.created_at
        AND NEW.summary IS NOT NULL
        AND OLD.summary IS NULL) THEN
      RETURN NEW;  -- Autoriser : c'est l'ajout initial du résumé
    END IF;
  END IF;
  RAISE EXCEPTION 'Audit log entries are immutable — only initial summary generation is allowed';
END;
$$ LANGUAGE plpgsql;
```

#### Dashboards Agrégés — Vérité #20

La Vérité #20 du brainstorming des cofondateurs est catégorique : "Les dashboards sont TOUJOURS agrégés, JAMAIS individuels". Cela signifie :

- **OUI** : "Cette semaine, l'équipe a traité 47 issues, dont 12 critiques"
- **NON** : "Jean a traité 3 issues, Marie en a traité 8"

Les dashboards exposent :
- **Métriques d'équipe** : issues traitées/ouvertes, temps moyen de résolution, drift rate
- **Santé du workflow** : étapes en cours, blocages, compactions
- **Coûts agrégés** : tokens consommés par projet (pas par agent)
- **Tendances** : progression sur 7j/30j/90j

Les requêtes SQL agrégent toujours par `company_id` + `project_id`, jamais par `agent_id` seul.

#### Export (REQ-OBS-05)

```typescript
// API endpoint : GET /api/companies/:companyId/audit/export
// Query params : format=csv|json, from=ISO, to=ISO, actions[]=...
async function exportAuditLog(params: ExportParams): Promise<ReadableStream> {
  // Streaming pour les gros volumes — pas de chargement en mémoire
  const query = db
    .select()
    .from(auditLog)
    .where(and(
      eq(auditLog.companyId, params.companyId),
      gte(auditLog.createdAt, params.from),
      lte(auditLog.createdAt, params.to),
    ))
    .orderBy(asc(auditLog.createdAt));

  // Streaming CSV ou JSON via Transform streams
  return format === "csv"
    ? streamAsCSV(query)
    : streamAsJSON(query);
}
```

### Conséquences

**Positives :**
- Audit trail immutable — confiance pour compliance et audits
- Résumé LLM rend les logs accessibles aux non-techniques
- Partitionnement permet une rétention de 3+ ans sans dégradation
- Dashboards agrégés respectent la philosophie de confiance (pas de surveillance individuelle)

**Négatives :**
- Coût LLM pour les résumés (atténué par l'utilisation de Haiku, modèle économique)
- Le partitionnement mensuel nécessite un job de maintenance pour créer les partitions à l'avance
- L'exception au TRIGGER pour le résumé ajoute de la complexité à la logique d'immutabilité

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Volume d'audit logs explosif | Moyenne | Moyen | Partitionnement + archivage automatique des anciennes partitions |
| Latence résumé LLM > 5s | Moyenne | Faible | Batch processing, modèle Haiku (latence P99 < 2s), résumé asynchrone (l'UI montre le log brut puis le résumé) |
| Coût API LLM pour les résumés | Faible | Faible | Haiku à $0.25/MTok entrée — pour 100K events/mois ~$2-5/mois |
| Superadmin qui désactive les triggers | Faible | Élevé | Rôle applicatif dédié sans ALTER TABLE, monitoring des trigger states |
| Partitions non créées à temps | Faible | Critique | Job CRON qui crée les 3 prochains mois à l'avance, alerte si partition manquante |

---

## ADR-008 : Gestion de Compaction

### Contexte

La compaction est le **risque R1** — le plus critique du projet. Les LLMs ont une fenêtre de contexte limitée (100K-200K tokens selon le modèle). Lorsqu'un agent atteint cette limite, le SDK LLM "compacte" automatiquement le contexte : il résume les messages anciens et remplace le contexte complet par un résumé plus court.

**Pourquoi c'est critique pour MnM :**

Dans le cadre des workflows orchestrés (REQ-ORCH-06, REQ-ORCH-07), un agent doit exécuter des étapes séquentielles avec des pré-prompts injectés à chaque étape. Quand la compaction survient :

1. **Les pré-prompts sont perdus** : les instructions injectées par l'orchestrateur au début de l'exécution sont résumées ou supprimées
2. **Les résultats intermédiaires sont perdus** : les outputs des étapes précédentes, nécessaires pour la cohérence, disparaissent
3. **L'agent "oublie" son contexte** : il peut dériver de son objectif, sauter des étapes, ou répéter du travail
4. **Les fichiers obligatoires ne sont plus vérifiés** : l'agent ne sait plus qu'il devait produire certains fichiers

L'analyse du heartbeat service (`server/src/services/heartbeat.ts`) montre que MnM surveille déjà les runs via un système de heartbeat, mais ne détecte ni ne gère la compaction. Le `runChildProcess()` traite la sortie du processus comme un flux opaque — il n'analyse pas les événements de compaction.

### Options Considérées

#### Option A : Prévention de la compaction (contexte infini)

- Utiliser uniquement des modèles à fenêtre illimitée
- Rejet : aucun modèle actuel n'a une fenêtre réellement infinie. Même avec 200K tokens, les workflows longs (multi-heures) atteignent la limite. De plus, les coûts API croissent linéairement avec la taille du contexte.

#### Option B : Segmentation préventive (couper avant la compaction)

- Diviser automatiquement les longues sessions en sous-sessions plus courtes
- Chaque sous-session reçoit un résumé de la précédente
- Problème : la coupure peut intervenir au milieu d'une opération critique (commit, migration DB, etc.)
- Rejet partiel : bon principe mais insuffisant seul — la compaction peut quand même survenir

#### Option C : Stratégie duale — Kill+relance ET réinjection post-compaction (RETENUE)

Combine deux stratégies complémentaires :
1. **Stratégie 1 (proactive)** : détecter l'approche de la limite et kill+relancer avec résultats intermédiaires
2. **Stratégie 2 (réactive)** : si compaction détectée, réinjecter les pré-prompts critiques

### Décision

**Adopter l'Option C** : stratégie duale combinant la prévention proactive (kill+relance) et la récupération réactive (réinjection post-compaction).

### Architecture Détaillée

#### Détection de Compaction

La détection repose sur deux signaux complémentaires :

**Signal 1 : Monitoring du heartbeat (existant)**

Le service heartbeat (`heartbeat.ts`) surveille déjà les runs. Les SDKs agents émettent des événements sur stdout qui sont capturés par MnM. Certains SDKs (Claude SDK notamment) émettent un événement explicite lors de la compaction :

```typescript
// Événement de compaction émis par le SDK Claude
interface CompactionEvent {
  type: "system.compaction";
  timestamp: string;
  tokensBefore: number;
  tokensAfter: number;
  messagesDropped: number;
}
```

Le handler d'événements dans heartbeat.ts est étendu pour détecter ce pattern :

```typescript
// Extension du handler onLog/onEvent dans heartbeat.ts
function detectCompaction(event: unknown): CompactionEvent | null {
  const parsed = parseObject(event);
  if (parsed.type === "system.compaction" ||
      parsed.event === "compaction" ||
      // Heuristique pour SDKs qui n'émettent pas d'événement explicite
      (parsed.type === "system" &&
       typeof parsed.message === "string" &&
       parsed.message.includes("compact"))) {
    return {
      type: "system.compaction",
      timestamp: new Date().toISOString(),
      tokensBefore: asNumber(parsed.tokensBefore, 0),
      tokensAfter: asNumber(parsed.tokensAfter, 0),
      messagesDropped: asNumber(parsed.messagesDropped, 0),
    };
  }
  return null;
}
```

**Signal 2 : Estimation du contexte consommé**

Pour les SDKs qui n'émettent pas d'événement de compaction, MnM estime la consommation de contexte :

```typescript
interface ContextEstimation {
  estimatedTokens: number;       // estimation basée sur les logs
  modelMaxTokens: number;        // limite du modèle (100K, 200K, etc.)
  utilizationPercent: number;    // estimatedTokens / modelMaxTokens * 100
  warningThreshold: number;      // 70% — alerte proactive
  criticalThreshold: number;     // 85% — kill+relance recommandé
}
```

L'estimation est basée sur le volume de logs (approximation ~4 chars/token) émis par l'agent depuis le début du run. C'est une heuristique imprécise mais suffisante pour déclencher des alertes proactives.

#### Stratégie 1 : Kill + Relance avec Résultats Intermédiaires (REQ-ORCH-06)

Quand l'utilisation du contexte dépasse 85% ou qu'une compaction est détectée :

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Détection : contexte à 85% OU compaction détectée       │
│    ↓                                                        │
│ 2. Persistance des résultats intermédiaires                 │
│    → Sauvegarde dans compaction_snapshots                   │
│    → Liste des fichiers produits + état workflow            │
│    ↓                                                        │
│ 3. Kill propre de l'agent (SIGTERM → attente 10s → SIGKILL)│
│    ↓                                                        │
│ 4. Relance avec contexte frais                              │
│    → Pré-prompts de l'étape courante réinjectés             │
│    → Résumé des résultats intermédiaires injecté            │
│    → Référence aux fichiers déjà produits                   │
│    ↓                                                        │
│ 5. L'agent reprend avec un contexte propre                  │
└─────────────────────────────────────────────────────────────┘
```

**Table `compaction_snapshots`** :

```sql
CREATE TABLE compaction_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  run_id UUID NOT NULL REFERENCES heartbeat_runs(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  workflow_instance_id UUID,
  stage_instance_id UUID,

  -- Raison du snapshot
  trigger TEXT NOT NULL, -- 'compaction_detected', 'threshold_85', 'manual'

  -- État au moment du snapshot
  context_tokens_estimated INTEGER,
  model_max_tokens INTEGER,

  -- Résultats intermédiaires
  intermediate_results JSONB NOT NULL DEFAULT '{}',
  -- Exemple : { "filesProduced": ["/src/auth.ts", "/tests/auth.test.ts"],
  --             "stageProgress": "step 3/5 completed",
  --             "lastAction": "wrote authentication middleware" }

  -- Fichiers produits (pour vérification de continuité)
  files_snapshot JSONB,  -- { path: hash } pour chaque fichier produit

  -- Pré-prompts actifs au moment de la compaction
  active_preprompts JSONB,

  -- Session agent (pour resume si possible)
  session_params JSONB,

  -- Résultat du kill+relance
  relaunch_run_id UUID REFERENCES heartbeat_runs(id),
  relaunch_status TEXT, -- 'pending', 'launched', 'failed'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compaction_snapshots_run ON compaction_snapshots(run_id);
CREATE INDEX idx_compaction_snapshots_agent ON compaction_snapshots(agent_id, created_at);
```

#### Stratégie 2 : Réinjection de Pré-Prompts Post-Compaction (REQ-ORCH-07)

Si la compaction survient sans que le kill+relance ait été déclenché (compaction automatique par le SDK avant d'atteindre le seuil de détection), les pré-prompts doivent être réinjectés dans le contexte de l'agent via stdin :

```typescript
// Utilise le pipe stdin du chat temps réel (ADR-005)
async function reinjectPostCompaction(
  runId: string,
  snapshot: CompactionSnapshot
): Promise<void> {
  const process = runningProcesses.get(runId);
  if (!process?.stdin) return;

  // Construire le message de réinjection
  const reinjectMessage = buildReinjectPrompt({
    currentStage: snapshot.stageProgress,
    preprompts: snapshot.activePreprompts,
    intermediateResults: snapshot.intermediateResults,
    filesProduced: snapshot.filesProduced,
  });

  // Écrire sur stdin du processus agent
  process.stdin.write(JSON.stringify({
    type: "system",
    message: reinjectMessage,
  }) + "\n");

  // Log dans l'audit
  await auditLog.insert({
    action: "compaction.reinject",
    entityType: "heartbeat_run",
    entityId: runId,
    details: {
      tokensEstimated: snapshot.contextTokensEstimated,
      prepromptsReinjectCount: Object.keys(snapshot.activePreprompts ?? {}).length,
    },
  });
}
```

**Contenu du prompt de réinjection** :

```typescript
function buildReinjectPrompt(params: {
  currentStage: string;
  preprompts: Record<string, string>;
  intermediateResults: Record<string, unknown>;
  filesProduced: string[];
}): string {
  return `
## CONTEXTE RÉINJECTÉ APRÈS COMPACTION

Ton contexte a été compacté. Voici les informations critiques que tu dois avoir :

### Étape actuelle du workflow
${params.currentStage}

### Instructions de l'étape (pré-prompts)
${Object.entries(params.preprompts).map(([k, v]) => `**${k}** : ${v}`).join("\n")}

### Résultats intermédiaires déjà produits
${JSON.stringify(params.intermediateResults, null, 2)}

### Fichiers déjà produits (ne pas recréer)
${params.filesProduced.map(f => `- ${f}`).join("\n")}

### Instructions
Continue ton travail depuis l'étape actuelle. Ne répète pas le travail déjà fait.
Vérifie que les fichiers listés ci-dessus existent avant de les recréer.
`.trim();
}
```

#### Intégration avec le Heartbeat Service

Le service heartbeat est étendu avec un `CompactionWatcher` :

```typescript
class CompactionWatcher {
  private estimatedTokens = 0;
  private readonly charsPerToken = 4;  // approximation

  // Appelé à chaque log/événement émis par l'agent
  onAgentOutput(chunk: string): void {
    this.estimatedTokens += Math.ceil(chunk.length / this.charsPerToken);
  }

  // Vérifie si on approche de la limite
  checkThresholds(modelMaxTokens: number): "ok" | "warning" | "critical" {
    const utilization = this.estimatedTokens / modelMaxTokens;
    if (utilization >= 0.85) return "critical";
    if (utilization >= 0.70) return "warning";
    return "ok";
  }

  // Appelé quand une compaction est détectée par le SDK
  onCompactionDetected(event: CompactionEvent): void {
    this.estimatedTokens = event.tokensAfter;
    // Déclencher le snapshot + réinjection
  }
}
```

#### Interaction avec le Drift Detection

Le service de drift existant (`server/src/services/drift.ts`) utilise un cache in-memory (`reportCache`) et un système de scan par projet. La compaction peut provoquer du drift si l'agent "oublie" ses contraintes après compaction. Le `CompactionWatcher` notifie le drift service pour déclencher un scan accéléré après toute compaction :

```typescript
// Après une compaction, vérifier que l'agent n'a pas dévié
async function postCompactionDriftCheck(
  agentId: string,
  workflowInstanceId: string
): Promise<void> {
  // Scan rapide des fichiers produits vs les attendus
  // Si divergence → alerte via WebSocket
}
```

### Conséquences

**Positives :**
- La compaction ne fait plus perdre le contexte critique des workflows
- Les résultats intermédiaires sont persistés et récupérables
- La réinjection de pré-prompts maintient l'agent sur sa trajectoire
- La détection proactive (70%/85%) permet d'agir avant la compaction

**Négatives :**
- Le kill+relance interrompt l'agent en cours d'exécution — risque de corruption si au milieu d'une opération fichier
- L'estimation de tokens est imprécise (heuristique chars/4)
- La réinjection via stdin dépend du support stdin par l'adapter (ADR-005)
- Certains SDKs n'émettent pas d'événement de compaction explicite

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Kill pendant une opération critique | Moyenne | Élevé | Fenêtre de grâce : attendre la fin de l'opération en cours (commit, write) avant kill. Détection via les logs de l'agent. |
| Estimation de tokens incorrecte | Élevée | Moyen | L'estimation est une heuristique. En cas de faux négatif (pas de détection), la stratégie 2 (réactive) prend le relais. |
| SDK qui ne supporte pas la réinjection | Moyenne | Élevé | Fallback : kill+relance systématique pour les SDKs sans support stdin. Table de compatibilité par adapter type. |
| Compaction pendant le kill+relance | Faible | Élevé | Le kill est suffisamment rapide (<10s) pour que la compaction ne survienne pas pendant. Si elle survient, un nouveau cycle est déclenché. |
| Boucle de compaction (compact → relance → compact immédiat) | Faible | Critique | Circuit breaker : max 3 relances par run. Après 3 relances, l'agent est mis en pause avec notification au board. |
| Divergence post-compaction non détectée | Moyenne | Élevé | Scan de drift accéléré post-compaction + vérification des fichiers obligatoires de l'étape courante |

---

## Synthèse des Dépendances entre ADRs

```
ADR-004 (Containerisation)
    │
    ├──→ ADR-005 (Chat) : stdin pipe fonctionne aussi dans les containers
    │
    ├──→ ADR-006 (A2A) : le credential proxy expose l'API A2A aux containers
    │
    └──→ ADR-007 (Observabilité) : le credential proxy log chaque requête API

ADR-005 (Chat Temps Réel)
    │
    └──→ ADR-008 (Compaction) : la réinjection post-compaction utilise le pipe stdin

ADR-006 (A2A)
    │
    └──→ ADR-007 (Observabilité) : chaque transaction A2A est auditée

ADR-008 (Compaction)
    │
    ├──→ ADR-005 (Chat) : réinjection via stdin
    │
    └──→ ADR-007 (Observabilité) : chaque compaction est auditée
```

## Récapitulatif des Tables à Créer

| ADR | Tables | Estimation lignes/mois |
|-----|--------|----------------------|
| ADR-004 | `container_profiles`, `container_mount_allowlists`, `container_runs` | ~1K |
| ADR-005 | `chat_channels`, `chat_messages` | ~10K |
| ADR-006 | `a2a_messages`, `a2a_permission_rules` | ~500 |
| ADR-007 | `audit_log` (partitionné, remplace `activity_log`) | ~100K |
| ADR-008 | `compaction_snapshots` | ~100 |

## Récapitulatif des Fichiers à Créer/Modifier

| Fichier | Action | ADR |
|---------|--------|-----|
| `server/src/containers/container-manager.ts` | Créer | ADR-004 |
| `server/src/containers/credential-proxy.ts` | Créer | ADR-004 |
| `server/src/containers/mount-validator.ts` | Créer | ADR-004 |
| `server/src/containers/container-profiles.ts` | Créer | ADR-004 |
| `server/src/containers/resource-monitor.ts` | Créer | ADR-004 |
| `server/src/adapters/docker/docker-adapter.ts` | Créer | ADR-004 |
| `server/src/realtime/live-events-ws.ts` | Modifier | ADR-005 |
| `server/src/services/heartbeat.ts` | Modifier | ADR-005, ADR-008 |
| `server/src/services/agent-chat.ts` | Créer | ADR-005 |
| `server/src/services/a2a-bus.ts` | Créer | ADR-006 |
| `server/src/services/a2a-permissions.ts` | Créer | ADR-006 |
| `server/src/services/audit-summarizer.ts` | Créer | ADR-007 |
| `server/src/services/audit-export.ts` | Créer | ADR-007 |
| `server/src/services/compaction-watcher.ts` | Créer | ADR-008 |
| `packages/db/src/schema/activity_log.ts` | Modifier (→ audit_log) | ADR-007 |
| `packages/db/src/schema/chat.ts` | Créer | ADR-005 |
| `packages/db/src/schema/a2a.ts` | Créer | ADR-006 |
| `packages/db/src/schema/compaction.ts` | Créer | ADR-008 |
