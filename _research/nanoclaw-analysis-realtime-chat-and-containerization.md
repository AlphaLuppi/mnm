# Analyse Nanoclaw — Chat temps réel & Containerisation d'agents

> Date: 2026-03-13
> Source: https://github.com/qwibitai/nanoclaw
> Objectif: Évaluer comment Nanoclaw gère le chat temps réel et la containerisation d'agents, et comment adapter ces patterns pour MnM.

---

## 1. Architecture globale de Nanoclaw

Nanoclaw est un **orchestrateur headless** d'agents Claude (~7300 LOC TypeScript), accessible via des canaux de messagerie (WhatsApp, Telegram, Slack, Discord, Gmail). C'est un single process Node.js qui :

- Poll SQLite toutes les 2s pour détecter les nouveaux messages
- Spawn des containers Docker éphémères (max 5 en parallèle)
- Communique avec les containers via **stdin JSON** (entrée initiale) + **file-based IPC** (messages suivants)
- Reçoit les réponses via **stdout avec markers** (`---NANOCLAW_OUTPUT_START---` / `---NANOCLAW_OUTPUT_END---`)

### Stack

| Couche | Technologie |
|--------|------------|
| Runtime | Node.js 22+ |
| Base de données | SQLite (better-sqlite3) |
| Container Runtime | Docker (+ Apple Container en option) |
| Agent SDK | @anthropic-ai/claude-agent-sdk |
| Messaging | Channel-specific (Baileys, Telegram Bot API, etc.) |
| Build | TypeScript 5.7, tsx |
| Logging | Pino |

**Pas de frontend web** — Nanoclaw est entièrement headless.

### Flow de communication complet

```
WhatsApp/Telegram message
  → SQLite (storeMessage)
  → Message Loop (poll 2s)
  → Check trigger (@Andy)
  → GroupQueue (concurrence max 5)
  → docker run --rm nanoclaw-agent (éphémère)
  → stdin: JSON {prompt, sessionId, groupFolder...}
  → Agent Runner (dans le container)
  → Claude Agent SDK avec MessageStream (AsyncIterable)
  → stdout: markers JSON avec résultat
  → Host parse → channel.sendMessage()
```

---

## 2. Système de Chat Temps Réel

### Protocole: File-based IPC + stdout markers (pas WebSocket/SSE)

Nanoclaw n'utilise ni WebSocket ni SSE. Le protocole repose sur :

- **Entrée initiale** : JSON via stdin au spawn du container
- **Messages suivants** : fichiers JSON écrits dans `/workspace/ipc/input/` (pollés toutes les 500ms)
- **Sortie** : stdout avec markers de délimitation JSON
- **Fermeture** : sentinel file `_close`

### MessageStream — Le mécanisme clé

Pendant que l'agent tourne, les nouveaux messages sont **pipés en temps réel** via un AsyncIterable :

```typescript
class MessageStream {
  private queue: SDKUserMessage[] = [];
  private waiting: (() => void) | null = null;
  private done = false;

  push(text: string): void {
    this.queue.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: '',
    });
    this.waiting?.();
  }

  end(): void {
    this.done = true;
    this.waiting?.();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    while (true) {
      while (this.queue.length > 0) {
        yield this.queue.shift()!;
      }
      if (this.done) return;
      await new Promise<void>(r => { this.waiting = r; });
      this.waiting = null;
    }
  }
}
```

Pendant l'exécution du query Claude SDK, un poll IPC tourne en parallèle :

```typescript
const pollIpcDuringQuery = () => {
  if (shouldClose()) { stream.end(); return; }
  const messages = drainIpcInput(); // lit /workspace/ipc/input/*.json
  for (const text of messages) {
    stream.push(text); // INJECTE dans la query Claude active
  }
  setTimeout(pollIpcDuringQuery, 500); // poll toutes les 500ms
};
```

### Streaming de sortie (Container → Host)

```typescript
// Markers sur stdout
const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}
```

Le host parse le stdout au fur et à mesure et envoie chaque résultat au canal de messaging.

### Interruption et contrôle

1. **Messages en temps réel** : écrits dans `/workspace/ipc/input/`, pollés par le container, injectés dans la query active
2. **Close sentinel** : fichier `_close` dans le répertoire IPC → le container termine sa boucle
3. **Timeout** : 30 min par défaut, reset à chaque output. Graceful stop puis SIGKILL si nécessaire
4. **Idle management** : après un résultat, le container attend de nouveaux messages pendant 30 min

### Sessions persistantes

```sql
CREATE TABLE sessions (
  group_folder TEXT PRIMARY KEY,
  session_id TEXT NOT NULL
);
```

Le `sessionId` est passé au container pour reprendre la conversation. Le SDK Claude restore le contexte complet.

---

## 3. Système de Containerisation — Defense in Depth

### Architecture 5 couches

#### Couche 1 : Container Docker éphémère

- `docker run --rm` — container détruit après chaque exécution
- Image `node:22-slim` avec Chromium pré-installé
- User `node` (uid 1000, non-root)
- Entrypoint : compile TypeScript → exécute agent-runner

#### Couche 2 : Mounts contrôlés avec allowlist externe

Fichier allowlist stocké à `~/.config/nanoclaw/mount-allowlist.json` — **JAMAIS monté dans le container** (tamper-proof) :

```json
{
  "allowedRoots": [
    { "path": "~/projects", "allowReadWrite": true, "description": "Dev projects" },
    { "path": "~/Documents/work", "allowReadWrite": false, "description": "Read-only" }
  ],
  "blockedPatterns": [
    "password", "secret", "token", ".ssh", ".gnupg", ".aws", ".azure",
    ".gcloud", ".kube", ".docker", "credentials", ".env", ".netrc",
    ".npmrc", ".pypirc", "id_rsa", "id_ed25519", "private_key", ".secret"
  ],
  "nonMainReadOnly": true
}
```

**Validation des mounts :**
1. Rejet si contient `..` (path traversal)
2. Résolution symlink
3. Vérification contre `blockedPatterns`
4. Vérification contre `allowedRoots`
5. Enforcement read-only pour non-main groups si `nonMainReadOnly: true`

#### Couche 3 : Isolation des credentials (Credential Proxy)

```
Container reçoit:
  ANTHROPIC_API_KEY=placeholder
  ANTHROPIC_BASE_URL=http://host.docker.internal:3001

Host credential proxy (port 3001):
  → Intercepte les requêtes API
  → Remplace le placeholder par la vraie clé
  → L'agent ne voit JAMAIS la vraie clé API
```

Deux modes : API-key (injection `x-api-key`) ou OAuth (remplacement Bearer token).

Le `.env` du projet est **shadowed avec `/dev/null`** pour empêcher l'accès direct aux secrets :

```typescript
if (fs.existsSync(envFile)) {
  mounts.push({
    hostPath: '/dev/null',
    containerPath: '/workspace/project/.env',
    readonly: true,
  });
}
```

#### Couche 4 : Isolation inter-agents (IPC autorisé par répertoire)

| Capability | Main Group | Non-Main Group |
|-----------|-----------|---------------|
| Envoyer à n'importe quel chatJid | Oui | Non (self only) |
| Gérer les tasks d'autres groupes | Oui | Non |
| Voir tous les groupes enregistrés | Oui | Non |
| Accès au projet root | RO | Aucun |
| Accès mémoire globale (CLAUDE.md) | Implicite | RO |

L'identité du groupe est vérifiée par son répertoire IPC source (tamper-proof).

#### Couche 5 : Limites de ressources

| Paramètre | Valeur par défaut |
|-----------|------------------|
| Timeout container | 30 min (reset à chaque output) |
| Output max | 10 MB |
| Concurrence | 5 containers max |
| Idle timeout | 30 min |
| IPC poll | 500ms (container), 1000ms (host) |

### Mounts par type d'agent

| Mount | Main group | Non-main group |
|---|---|---|
| `/workspace/project` | Host project root (RO) | **Aucun** |
| `.env` | Shadowed `/dev/null` | N/A |
| `/workspace/group` | Group folder (RW) | Group folder (RW) |
| `/workspace/global` | Implicite | CLAUDE.md global (RO) |
| `/home/node/.claude` | Session isolée (RW) | Session isolée (RW) |
| `/workspace/ipc` | IPC namespace isolé (RW) | IPC namespace isolé (RW) |
| `/workspace/extra/*` | Via allowlist | Via allowlist (RO forcé) |

### Outils disponibles dans le container

```typescript
allowedTools: [
  'Bash',       // Sandboxé dans le container
  'Read', 'Write', 'Edit', 'Glob', 'Grep',  // Fichiers
  'WebSearch', 'WebFetch',                    // Web
  'Task', 'TaskOutput', 'TaskStop',           // Task management
  'TeamCreate', 'TeamDelete', 'SendMessage',  // Team operations
  'mcp__nanoclaw__*'                          // Custom MCP tools
]
```

Permission mode : `bypassPermissions` (sûr car sandboxé dans le container).

---

## 4. État actuel de MnM et faisabilité

### Ce que MnM a déjà

| Infrastructure | Statut |
|---------------|--------|
| WebSocket | **Existe** (`live-events-ws.ts`, `publishLiveEvent()`) |
| Event streaming | **Existe** (`heartbeat.run.status`, `.event`, `.log`) |
| Pattern callback | **Existe** (`onLog`, `onMeta` dans adapters) |
| Session management | **Existe** (`agentTaskSessions`) |
| stdin dans `runChildProcess()` | **Supporté mais inutilisé** (à `"ignore"`) |
| Container isolation | **Inexistant** |
| Resource limits | **Inexistant** |
| Audit centralisé | **Basique** |

### Ce que MnM n'a PAS

- Pas de canal de communication UI → agent **pendant** l'exécution
- Pas de stdin streaming vers agent pendant l'exécution
- Pas d'interrupt/feedback en temps réel (seulement cancel)
- Pas de containerisation (agents = processus locaux avec perms user MnM)
- Pas de sandboxing filesystem
- Pas de credential isolation

---

## 5. Comparaison Nanoclaw vs MnM

| Aspect | Nanoclaw | MnM actuel |
|--------|----------|-------------|
| Communication temps réel | File-based IPC (500ms polling) | WebSocket (mais read-only, pas de input) |
| Streaming | stdout markers | Events via WebSocket |
| Interruption agent | Oui (sentinel `_close` + timeout) | Cancel basique (kill process) |
| Messages pendant exécution | Oui (IPC → MessageStream) | Non |
| Isolation agents | Docker container éphémère | Aucune |
| Permissions fichiers | Volumes Docker (RO/RW) + allowlist | Accès total |
| Credentials | Proxy HTTP (agents voient placeholder) | Env vars directes |
| Audit actions | Logs structurés (Pino) | Logs basiques |
| Persistance sessions | SQLite + SDK resume | PostgreSQL + agentTaskSessions |
| Limites ressources | Timeout, output max, concurrence | Timeout uniquement |
| Frontend | Aucun (headless, messaging apps) | UI React complète |
| Base de données | SQLite | PostgreSQL (meilleur pour B2B) |

---

## 6. Patterns à copier / adapter de Nanoclaw

### A copier

| Pattern | Implémentation Nanoclaw | Adaptation MnM |
|---------|------------------------|----------------|
| Credential Proxy HTTP | Express sur port 3001, inject `x-api-key` | Identique — Express proxy, containers reçoivent placeholder |
| Mount allowlist tamper-proof | `~/.config/nanoclaw/mount-allowlist.json` | Config admin dans PostgreSQL (+ fichier local pour self-hosted) |
| Shadow `.env` avec `/dev/null` | `-v /dev/null:/workspace/project/.env:ro` | Identique |
| Container éphémère `--rm` | `docker run --rm` | Identique |
| Timeout avec reset à chaque output | `clearTimeout` + `setTimeout` sur chaque OUTPUT marker | Adapter dans `runChildProcess()` |
| MessageStream AsyncIterable | Injection messages dans query Claude SDK active | Adapter pour WebSocket → stdin pipe |
| Per-agent session isolation | Répertoires séparés montés dans `/home/node/.claude` | Adapter pour workspace dirs existants de MnM |

### NE PAS copier

| Pattern | Raison |
|---------|--------|
| SQLite | MnM a PostgreSQL — bien meilleur pour multi-user B2B |
| File-based IPC | MnM a déjà WebSocket — plus propre, plus réactif, pas de latence polling |
| Pas de frontend web | MnM a une UI React complète |
| Single process monolithique | MnM est structuré en monorepo |
| Canaux messaging (WhatsApp etc.) | Hors scope pour MnM (possible feature future) |

---

## 7. Plan d'implémentation pour MnM

### Phase A : Chat temps réel (2-3 semaines, priorité 1)

**Pas de ré-architecture nécessaire.** L'infrastructure WebSocket et les callbacks existent.

#### Semaine 1 : Backend

1. **Modifier `runChildProcess()`** : ouvrir stdin en mode pipe au lieu de `"ignore"`
   - Fichier : `packages/adapter-utils/src/server-utils.ts`

2. **Ajouter callback `onInput`** à l'adapter interface (backward-compatible)
   - Fichier : adapter interface types

3. **Nouveau endpoint WebSocket** : `heartbeat.run.input` pour envoyer des messages à un agent en cours
   - Fichier : `server/src/realtime/live-events-ws.ts`
   - Routing : `runId → process.stdin.write(message)`

4. **Table d'audit** :
   ```sql
   CREATE TABLE heartbeat_run_messages (
     id UUID PRIMARY KEY,
     run_id UUID NOT NULL REFERENCES heartbeat_runs(id),
     sender TEXT NOT NULL, -- "user" | "system"
     message TEXT NOT NULL,
     created_at TIMESTAMP NOT NULL DEFAULT NOW()
   );
   ```

#### Semaine 2 : Frontend + intégration

5. **Composant `ChatPanel`** dans le run viewer
   - Fichier : nouveau composant UI

6. **Gestion du state messages** (React Query + WebSocket)
   - Fichier : `ui/src/context/LiveUpdatesProvider.tsx`

7. **Interrupt/cancel amélioré** intégré au chat

#### Semaine 3 : Polish

8. Reconnection WebSocket
9. Persistence conversation pour resume
10. Tests d'intégration

### Phase B : Containerisation (3-5 semaines, priorité 2)

**Recommandation : Docker** (comme Nanoclaw), car MnM vise le B2B SaaS multi-tenant.

#### Semaine 1-2 : Infrastructure Docker

1. **Service `ContainerManager`** avec `dockerode`
   - Gestion lifecycle containers
   - Build/pull images

2. **Credential Proxy** (port du pattern Nanoclaw)
   - Express proxy sur port local
   - Injection credentials transparente

3. **Images Docker** par profil d'agent
   - dev : Node.js + outils CLI
   - designer : outils Figma/design
   - QA : browsers + outils de test

#### Semaine 3 : Permissions et isolation

4. **Mount allowlist** configurable par admin
   - Extension du JSONB `agent.runtimeConfig`
   ```json
   {
     "containerization": {
       "enabled": true,
       "type": "docker",
       "memoryMB": 2048,
       "cpuPercent": 80,
       "networkMode": "none",
       "allowedPaths": ["/workspace/project"]
     }
   }
   ```

5. **Profils de sécurité** par rôle d'agent

6. **Shadow des secrets** (`.env`, credentials)

#### Semaine 4-5 : Audit, monitoring, UI

7. **Logging centralisé** de toutes les actions d'agents
8. **Dashboard monitoring** containers dans le frontend
9. **Tests de sécurité** (path traversal, privilege escalation)

### Fichiers clés à modifier dans MnM

| Feature | Fichiers |
|---------|---------|
| Chat temps réel | `server/src/realtime/live-events-ws.ts`, `server/src/services/heartbeat.ts`, `packages/adapter-utils/src/server-utils.ts`, `ui/src/context/LiveUpdatesProvider.tsx` |
| Containerisation | `packages/adapter-utils/src/server-utils.ts`, `packages/db/src/schema/agents.ts`, `server/src/services/heartbeat.ts`, `server/src/adapters/registry.ts` |

---

## 8. Conclusion

Nanoclaw valide les deux features comme réalisables avec le pattern Node.js + Docker. L'architecture actuelle de MnM est **mieux positionnée** que Nanoclaw pour les implémenter :

- **WebSocket déjà en place** (vs file-based IPC chez Nanoclaw)
- **PostgreSQL** (vs SQLite — meilleur pour multi-user B2B)
- **UI React complète** (vs headless)
- **Monorepo structuré** (vs monolithe)

**Aucune ré-architecture drastique n'est nécessaire.** Les deux features sont des ajouts incrémentaux qui s'intègrent dans l'architecture existante.

**Ordre de priorité :**
1. Chat temps réel (meilleur ROI, quick win, 2-3 semaines)
2. Containerisation (sécurité B2B, chantier structurant, 3-5 semaines)
