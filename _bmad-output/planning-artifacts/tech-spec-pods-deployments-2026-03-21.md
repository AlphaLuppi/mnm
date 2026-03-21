# Tech Spec — Per-User Pods + Artifact Deployment

> **Date** : 2026-03-21 | **Version** : 1.0
> **Statut** : En cours d'implementation (MVP)
> **Auteur** : System Architect (BMAD)
> **Sources** : Architecture 2026-03-21, Brainstorming 2026-03-21, Epics B2B v1.0
> **Epics** : POD (8 stories, ~37 SP) + DEPLOY (8 stories, ~37 SP) = ~74 SP

---

## 1. Vision Produit

### Deux fonctionnalites complementaires

```
┌─────────────────────────────────────────────────────────────────┐
│  EPIC POD — Per-User Pods                                       │
│  Chaque utilisateur a un conteneur Docker persistant.            │
│  Claude CLI pre-installe. Auth via console chat in-browser.      │
│  Hibernate quand inactif, wake instantane.                       │
│  Les agents s'executent DANS le pod → heritent l'auth Claude.   │
├─────────────────────────────────────────────────────────────────┤
│  EPIC DEPLOY — Artifact Deployment                               │
│  Les outputs des agents sont deployes comme previews HTTP.       │
│  Reverse proxy MnM, URLs /preview/{id}.                          │
│  TTL automatique (24h), garbage collector, pin/unpin.            │
│  Lies aux issues → visibles sur la page IssueDetail.             │
└─────────────────────────────────────────────────────────────────┘
```

### Decisions cles

| Decision | Choix | Rationale |
|----------|-------|-----------|
| 1 pod par user (pas par agent) | Warm pod model | Evite cold-start, garde les credentials chauds |
| Console chat (pas xterm.js) | HTTP exec, pas WebSocket terminal | Plus simple, pas besoin de node-pty, fonctionne avec REST |
| MnM comme reverse proxy | Port pool 9000-9999 | Zero nouvelle infra, auth MnM heritee |
| Docker socket auto-detection | `docker-client.ts` singleton | Windows named pipe vs Unix socket transparent |
| Migration unique 0048 | 2 tables dans 1 fichier | Plus simple, atomique |

### Difference avec l'architecture initiale

L'architecture document (v1.0) prevoyait `xterm.js` + WebSocket terminal (`/ws/pod-terminal`). L'implementation MVP utilise une **console chat** (HTTP POST `/pods/my/exec`) qui est plus simple :

- Pas besoin de `node-pty`, `xterm`, ou `@xterm/addon-*`
- Pas de WebSocket terminal relay
- Supporte les commandes interactives (ex: `claude auth login`) via stdin pipe
- Quick commands pour les actions courantes (Claude Login, Auth Status, etc.)
- Historique de commandes (flèches haut/bas)

---

## 2. Architecture

### Pattern : Modular Monolith etendu

Pas de microservices. Les pods et deployments sont des modules dans le monolithe Express existant.

```
                         ┌──────────────────────────────────────────┐
                         │              MnM Server (Express)        │
                         │                                          │
  Browser ──────────────►│  /api/.../pods/*         → PodManager    │
  (React UI)             │  /api/.../pods/my/exec   → PodExec       │
                         │  /api/.../deployments/*  → DeployManager │
                         │  /preview/:id/*          → ReverseProxy ─┼──► Deploy Container :9xxx
                         │                                          │
                         │  ┌─ Docker Socket (auto-detect)          │
                         │  │  Windows: //./pipe/docker_engine      │
                         │  │  Linux:   /var/run/docker.sock        │
                         │  │  Custom:  $DOCKER_HOST env var        │
                         │  │                                       │
                         │  ├─► Create/Start/Stop User Pods         │
                         │  ├─► Exec commands in Pods (REST)        │
                         │  ├─► Create/Start/Stop Deployments       │
                         │  └─► Garbage collector (TTL expired)     │
                         └──────────────────────────────────────────┘
                              │            │
                    ┌─────────┘    ┌───────┘
                    ▼              ▼
              ┌──────────┐  ┌──────────────────┐
              │ PostgreSQL│  │  Docker Daemon   │
              │ (RLS)     │  │  (host)          │
              └──────────┘  │                  │
                            │ ┌──────────────┐ │
                            │ │ User Pod     │ │
                            │ │ mnm-pod-*    │ │
                            │ └──────────────┘ │
                            │ ┌──────────────┐ │
                            │ │ Deploy       │ │
                            │ │ mnm-deploy-* │ │
                            │ └──────────────┘ │
                            └──────────────────┘
```

### Docker Client — Auto-detection Socket

**Fichier** : `server/src/services/docker-client.ts`

Singleton `dockerode` avec auto-detection :
1. `DOCKER_HOST` env var → priorite absolue
2. Windows (`process.platform === "win32"`) → `//./pipe/docker_engine`
3. Linux/macOS → `/var/run/docker.sock`

```typescript
// Extrait de docker-client.ts
export function getDockerClient(): Docker {
  if (_instance) return _instance;
  const isWindows = process.platform === "win32";
  if (process.env.DOCKER_HOST) {
    _instance = new Docker({ host: process.env.DOCKER_HOST });
  } else if (isWindows) {
    _instance = new Docker({ socketPath: "//./pipe/docker_engine" });
  } else {
    _instance = new Docker({ socketPath: "/var/run/docker.sock" });
  }
  return _instance;
}
```

---

## 3. Modele de Donnees

### Migration : `0048_user_pods_and_deployments.sql`

Migration unique qui cree les deux tables avec RLS.

### Table `user_pods`

| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| user_id | text FK → `user(id)` | NOT NULL |
| company_id | uuid FK → `companies(id)` | NOT NULL, RLS |
| docker_container_id | text | ID Docker daemon |
| docker_image | text | Default: `mnm-agent:latest` |
| status | text | `provisioning/running/idle/hibernated/failed/destroyed` |
| volume_name | text | Volume Docker pour `/home/agent` |
| workspace_volume | text | Volume Docker pour `/workspace` |
| cpu_millicores | integer | Default: 1000 (1 vCPU) |
| memory_mb | integer | Default: 1024 (1 GB) |
| last_active_at | timestamptz | Pour detection idle |
| claude_auth_status | text | `unknown/authenticated/expired` |
| error | text | Dernier message d'erreur |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Index** : `UNIQUE (company_id, user_id)` — 1 pod par user par company
**Index** : `status`, `last_active_at`
**RLS** : `company_id::text = current_setting('app.current_company_id', true)`

**Schema Drizzle** : `packages/db/src/schema/user_pods.ts`

### Table `artifact_deployments`

| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| company_id | uuid FK → `companies(id)` | NOT NULL, RLS |
| user_id | text FK → `user(id)` | NOT NULL — qui a deploye |
| issue_id | uuid FK → `issues(id)` | **Optionnel** — lie a une issue (affiche sur IssueDetail) |
| run_id | uuid FK → `heartbeat_runs(id)` | Optionnel — lie a un run |
| agent_id | uuid FK → `agents(id)` | Optionnel |
| project_id | uuid FK → `projects(id)` | Optionnel |
| name | text | Nom affiche |
| status | text | `building/running/failed/expired/destroyed` |
| project_type | text | `static/node/python/unknown` |
| docker_container_id | text | ID Docker daemon |
| port | integer | Port alloue (pool 9000-9999) |
| source_path | text | Chemin dans le pod source |
| build_log | text | Sortie du build |
| ttl_seconds | integer | Default: 86400 (24h) |
| pinned | boolean | Default: false |
| share_token | text | Token pour partage public |
| url | text | Compute: `/preview/{id}` |
| expires_at | timestamptz | `created_at + ttl_seconds` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Index** : `(company_id, status)`, `expires_at`, `issue_id`, `share_token`
**RLS** : `company_id::text = current_setting('app.current_company_id', true)`

**Schema Drizzle** : `packages/db/src/schema/artifact_deployments.ts`

### Relations entre entites

```
auth_users ──1:1──► user_pods (par company, UNIQUE constraint)
     │
     └──1:N──► artifact_deployments
                    │
                    ├── FK → issues (lien principal — affiche sur IssueDetail)
                    ├── FK → heartbeat_runs (optionnel)
                    ├── FK → agents (optionnel)
                    └── FK → projects (optionnel)
```

### Exports Schema

Les schemas sont exportes dans `packages/db/src/schema/index.ts` :
```typescript
export { userPods } from "./user_pods.js";
export { artifactDeployments } from "./artifact_deployments.js";
```

### Types partages

Les types sont definis dans `packages/shared/src/types/` et exportes via `packages/shared/src/index.ts` :

**Pod** (`packages/shared/src/types/pod.ts`) :
- `PodStatus` : `"provisioning" | "running" | "idle" | "hibernated" | "failed" | "destroyed"`
- `PodClaudeAuthStatus` : `"unknown" | "authenticated" | "expired"`
- `UserPod` : interface complete
- `PodProvisionOptions` : `{ image?, cpuMillicores?, memoryMb? }`

**Deployment** (`packages/shared/src/types/deployment.ts`) :
- `DeploymentStatus` : `"building" | "running" | "failed" | "expired" | "destroyed"`
- `DeploymentProjectType` : `"static" | "node" | "python" | "unknown"`
- `ArtifactDeployment` : interface complete (avec `issueTitle?`, `userName?`, `agentName?` pour jointures)
- `DeploymentCreateOptions` : `{ sourcePath, name?, issueId?, runId?, agentId?, projectId?, ttlSeconds? }`

---

## 4. API

### Pod Management

| Methode | Route | Permission | Description |
|---------|-------|------------|-------------|
| `POST` | `/companies/:companyId/pods/provision` | `agents:launch` | Provisionner le pod de l'user (async, retourne 202) |
| `GET` | `/companies/:companyId/pods/my` | `agents:launch` | Obtenir le pod de l'user courant (ou null) |
| `POST` | `/companies/:companyId/pods/my/wake` | `agents:launch` | Reveiller un pod hibernate (202) |
| `POST` | `/companies/:companyId/pods/my/hibernate` | `agents:launch` | Hiberner le pod (stop container, garde volumes) |
| `DELETE` | `/companies/:companyId/pods/my` | `agents:manage_containers` | Detruire le pod + volumes |
| `GET` | `/companies/:companyId/pods` | `agents:manage_containers` | Lister tous les pods (admin) |
| `POST` | `/companies/:companyId/pods/my/exec` | `agents:launch` | Executer une commande dans le pod |

#### Detail : POST /pods/my/exec

C'est le coeur de la console chat. Pas de WebSocket — simple HTTP.

```typescript
// Request body (Zod validated)
{
  command: string,   // max 10000 chars
  stdin?: string     // max 100000 chars — pour les flows interactifs (auth code)
}

// Response
{
  stdout: string,
  stderr: string,
  exitCode: number
}
```

**Comportement** :
- Commande non-interactive (ex: `ls`, `whoami`) : exec via `bash -c`, collecte stdout/stderr, timeout 30s
- Commande interactive (ex: `claude auth login`) : exec avec TTY + stdin pipe, timeout 60s
- Le stream Docker est demultiplexe (`demuxDockerStream()`) pour separer stdout/stderr
- En mode TTY (quand stdin est fourni), le output n'est pas multiplexe

**Validation Zod** dans `server/src/routes/pod-exec.ts` :
```typescript
const execSchema = z.object({
  command: z.string().min(1).max(10000),
  stdin: z.string().max(100000).optional(),
});
```

### Deployment Management

| Methode | Route | Permission | Description |
|---------|-------|------------|-------------|
| `POST` | `/companies/:companyId/deployments` | `agents:launch` | Creer un deployment (async, 202) |
| `GET` | `/companies/:companyId/deployments` | `agents:launch` | Lister les deployments (`?issueId=X&status=Y`) |
| `GET` | `/companies/:companyId/deployments/:id` | `agents:launch` | Detail d'un deployment |
| `GET` | `/companies/:companyId/deployments/:id/logs` | `agents:launch` | Build logs |
| `POST` | `/companies/:companyId/deployments/:id/pin` | `agents:manage_containers` | Pin (empeche TTL cleanup) |
| `POST` | `/companies/:companyId/deployments/:id/unpin` | `agents:manage_containers` | Unpin (reactive le TTL) |
| `DELETE` | `/companies/:companyId/deployments/:id` | `agents:manage_containers` | Detruire le deployment |
| `GET` | `/preview/:deploymentId/*` | Session cookie OU `?token=shareToken` | Reverse proxy vers le container |

**Validation Zod** pour la creation :
```typescript
const createDeploymentSchema = z.object({
  sourcePath: z.string().min(1).max(4096),
  name: z.string().min(1).max(200).optional(),
  issueId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  ttlSeconds: z.number().int().min(300).max(604800).optional(), // 5min a 7 jours
});
```

### Audit Trail

Les actions suivantes emettent des evenements audit via `emitAudit()` :
- `pod.provisioned` (targetType: `user_pod`)
- `pod.destroyed` (targetType: `user_pod`)
- `deployment.created` (targetType: `artifact_deployment`)
- `deployment.destroyed` (targetType: `artifact_deployment`)

---

## 5. Services Backend

### PodManager (`server/src/services/pod-manager.ts`)

**Responsabilites** :
- `prePullImage()` — Verifie si l'image `mnm-agent:latest` est deja presente, la pull sinon
- `provisionPod()` — Cree le record DB + lance `createAndStartPod()` en async
- `getMyPod()` — Recupere le pod de l'user avec jointure `authUsers.name`
- `listPods()` — Admin : tous les pods d'une company
- `hibernatePod()` — `docker.stop()` + status = "hibernated"
- `wakePod()` — `docker.start()` + status = "running"
- `destroyPod()` — `docker.stop()` + `docker.remove()` + supprime les volumes
- `execInPod()` — Cree un `docker.exec()` avec bash et retourne le handle

**Machine d'etat du pod** :
```
provisioning → running → idle → hibernated → running (wake)
                  ↓                              ↓
               failed                         destroyed
```

**Constantes** :
```typescript
const DEFAULT_POD_IMAGE = "mnm-agent:latest";
const MAX_PODS_PER_COMPANY = 25;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
```

**Configuration du conteneur Docker** :
```typescript
{
  Image: "mnm-agent:latest",
  name: "mnm-pod-{userId.slice(0,8)}",
  Labels: { "mnm.type": "user-pod", "mnm.userId", "mnm.companyId", "mnm.podId" },
  HostConfig: {
    Binds: ["mnm-pod-home-{userId}:/home/agent", "mnm-pod-workspace-{userId}:/workspace"],
    Memory: memoryMb * 1024 * 1024,
    NanoCpus: cpuMillicores * 1_000_000,
    CapDrop: ["ALL"],
    CapAdd: ["NET_BIND_SERVICE"],
    SecurityOpt: ["no-new-privileges"],
    RestartPolicy: { Name: "unless-stopped" },
  },
  Tty: true,
  OpenStdin: true,
}
```

### DeployManager (`server/src/services/deploy-manager.ts`)

**Responsabilites** :
- `allocatePort()` — Cherche le premier port libre dans [9000, 9999]
- `detectProjectType()` — Heuristique basee sur le chemin (`/dist` = static, `package.json` = node, etc.)
- `createDeployment()` — Quota check + port alloc + insert DB + `startDeploymentContainer()` async
- `listDeployments()` — Avec jointures (userName, issueTitle, agentName)
- `getDeployment()` — Detail avec jointures
- `getDeploymentForProxy()` — Lookup rapide pour le reverse proxy (pas de jointures, pas de company check)
- `pinDeployment()` / `destroyDeployment()`
- `cleanupExpired()` — Garbage collector : trouve les deployments expires + non-pinned, stop/remove containers
- `startGarbageCollector()` — `setInterval()` toutes les 5 minutes

**Constantes** :
```typescript
const PORT_POOL_START = 9000;
const PORT_POOL_END = 9999;
const MAX_DEPLOYMENTS_PER_COMPANY = 10;
const DEFAULT_TTL_SECONDS = 86400; // 24 heures
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
```

**Choix de l'image Docker pour les deployments** :
- `static` → `nginx:alpine` (cmd par defaut)
- `node` → `node:20-slim` (tente `npm install && npm start || node index.js || npx serve -s .`)

**Limites ressources par deployment** :
- 256 MB RAM
- 500 millicores CPU

### DeploymentProxy (`server/src/middleware/deployment-proxy.ts`)

**Responsabilites** :
- Match pattern URL : `/preview/[UUID](.*)`
- Cache des lookups port → Redis-like Map (TTL 60s)
- Auth check : session cookie OU `?token=shareToken`
- Proxy HTTP natif (`http.request`) vers `127.0.0.1:{port}`
- Headers CORS + `X-MnM-Deployment`
- Gestion erreur 502 si container unreachable

**Monte dans app.ts** en dehors de `/api` pour des URLs propres :
```typescript
app.use(deploymentProxyMiddleware(db));
```

---

## 6. Image Docker Agent

### Dockerfile : `docker/Dockerfile.agent`

```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates python3 build-essential openssh-client jq \
    && npm install -g @anthropic-ai/claude-code@latest \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash agent
RUN mkdir -p /workspace && chown agent:agent /workspace
USER agent
WORKDIR /home/agent
ENV HOME=/home/agent
ENV PATH="/home/agent/.local/bin:$PATH"
CMD ["sleep", "infinity"]
```

**Points cles** :
- Non-root user `agent` (UID 1000)
- Claude CLI pre-installe globalement (`@anthropic-ai/claude-code@latest`)
- `/workspace` cree et owned par `agent`
- `CMD ["sleep", "infinity"]` — le container reste vivant comme pod persistant
- Build tools inclus (`build-essential`, `python3`, `git`, `jq`, `openssh-client`)

**Build** :
```bash
docker build -f docker/Dockerfile.agent -t mnm-agent:latest .
```

---

## 7. UI Frontend

### Page Workspace (`ui/src/pages/Workspace.tsx`)

**Route** : `/workspace` (sidebar: "My Workspace")

**Etats** :
1. **Pas de pod** (ou `destroyed`/`failed`) : bouton "Set Up Workspace" → `provisionMutation`
2. **Provisioning** : spinner + "Setting up your workspace..."
3. **Running/Idle** : carte info + PodConsole
4. **Hibernated** : bouton "Wake Up"

**Carte info** affiche :
- Image Docker
- Resources (CPU/RAM)
- Claude Auth status (Authenticated/Expired/Not configured)
- Last active (timeAgo)
- Erreur si presente

**Polling** : `refetchInterval: 5000` pour detecter les changements de status

### PodConsole (`ui/src/components/workspace/PodConsole.tsx`)

Interface chat pour executer des commandes dans le pod. Pas un terminal xterm.js.

**Fonctionnalites** :
- Input avec prompt `$` (ou `>` en mode interactif)
- Historique de commandes (fleches haut/bas)
- Quick commands en barre horizontale :
  - "Claude Login" → `claude auth login`
  - "Auth Status" → `claude auth status`
  - "Check Claude" → `claude --version`
  - "Who Am I" → `whoami && pwd`
- Messages types : `command`, `output`, `error`, `system`, `input-prompt`
- Detection d'URLs cliquables dans le output (`linkifyText()`)
- Mode interactif pour `claude auth login` :
  1. La commande est executee, output affiche (avec URL d'auth)
  2. Le console passe en mode "Awaiting input..." (prompt `>`)
  3. L'user colle le code d'auth → envoye comme stdin
  4. Escape pour annuler le mode interactif
- Exit code affiche si non-zero

### Page Deployments (`ui/src/pages/Deployments.tsx`)

**Route** : `/deployments` (sidebar: "Deployments")

**Contenu** :
- Header avec compteur deployments actifs
- Auto-refresh indicator (polling 10s)
- Empty state si aucun deployment
- Cartes par deployment :
  - Nom + status badge (running/building/failed/expired)
  - Pin icon si pinned
  - Issue liee, agent, timestamp, TTL
  - Lien "Open Preview" pour les deployments running

### IssueDeploymentLinks (`ui/src/components/deployments/IssueDeploymentLinks.tsx`)

**Integre dans** : `ui/src/pages/IssueDetail.tsx` (ligne ~745)

```tsx
{issueId && <IssueDeploymentLinks issueId={issueId} />}
```

**Comportement** :
- Query `deployments?issueId=X` avec polling 15s
- Cache silencieux si loading
- **Ne rend rien** si aucun deployment lie a l'issue (pas de panel vide)
- Pour chaque deployment :
  - Status badge
  - Nom (tronque 200px)
  - Pin icon
  - Boutons Copy URL + Open (si running)
  - Metadata : deployer name, timeAgo, expires

### Navigation Sidebar (`ui/src/components/Sidebar.tsx`)

Deux nouveaux items :
```tsx
<SidebarNavItem data-testid="pod-06-nav-workspace" to="/workspace" label="My Workspace" icon={Terminal} />
<SidebarNavItem data-testid="deploy-06-nav-deployments" to="/deployments" label="Deployments" icon={Globe} />
```

### API Clients

**Pods** (`ui/src/api/pods.ts`) : `getMyPod`, `provision`, `wake`, `hibernate`, `destroy`, `listAll`, `exec`

**Deployments** (`ui/src/api/deployments.ts`) : `create`, `list` (avec filtres), `getById`, `getLogs`, `pin`, `unpin`, `destroy`

### Query Keys (`ui/src/lib/queryKeys.ts`)

```typescript
pods: {
  my: (companyId) => ["pods", companyId, "my"],
  list: (companyId) => ["pods", companyId, "list"],
},
deployments: {
  list: (companyId, filters?) => ["deployments", companyId, "list", filters],
  detail: (companyId, deploymentId) => ["deployments", companyId, "detail", deploymentId],
  byIssue: (companyId, issueId) => ["deployments", companyId, "by-issue", issueId],
},
```

### Routes Company (`ui/src/lib/company-routes.ts`)

`workspace` et `deployments` ajoutes a `BOARD_ROUTE_ROOTS` pour le routing multi-tenant avec prefix company.

---

## 8. Securite

### Modele de securite des Pods

```
┌─────────────────────────────────────────┐
│  MnM Server (zone de confiance)         │
│  - A le Docker socket                   │
│  - A l'acces DB                         │
│  - Gere le lifecycle des pods           │
└────────────────────┬────────────────────┘
                     │ Docker API
                     ▼
┌─────────────────────────────────────────┐
│  User Pod (zone non-fiable)             │
│  - PAS de Docker socket                 │
│  - PAS d'acces DB/Redis                 │
│  - User non-root (agent:1000)           │
│  - CapDrop: ALL                         │
│  - CapAdd: NET_BIND_SERVICE seulement   │
│  - SecurityOpt: no-new-privileges       │
│  - Restart: unless-stopped              │
│  - Writable: /home/agent, /workspace    │
│  - Resource limits (cgroup)             │
└─────────────────────────────────────────┘
```

### Modele de securite des Deployments

```
┌─────────────────────────────────────────┐
│  MnM Server (reverse proxy)            │
│  - Auth: session cookie OU share token  │
│  - Cache port lookup (60s TTL)          │
│  - CORS headers injectes                │
└────────────────────┬────────────────────┘
                     │ Proxy HTTP
                     ▼
┌─────────────────────────────────────────┐
│  Deployment Container                   │
│  - 256 MB RAM, 500 CPU millicores       │
│  - CapDrop: ALL + CapAdd: NET_BIND      │
│  - Ecoute localhost:{port} seulement    │
│  - Auto-destroy sur TTL expiry          │
└─────────────────────────────────────────┘
```

### RBAC

| Permission | Qui | Actions |
|------------|-----|---------|
| `agents:launch` | contributor+ | Provisionner son pod, exec, creer deployments, voir les siens |
| `agents:manage_containers` | admin | Voir/gerer tous les pods/deployments, pin/unpin, destroy |

### Isolation Multi-Tenant

- `user_pods.company_id` + RLS policy
- `artifact_deployments.company_id` + RLS policy
- Labels Docker incluent `mnm.companyId` pour tracabilite
- Le proxy verifie que la session appartient a la company du deployment (via session cookie) OU que le share token est valide

### Persistence des Credentials Claude

- Home directory monte comme Docker named volume : `mnm-pod-home-{userId}`
- Workspace monte comme volume : `mnm-pod-workspace-{userId}`
- Les volumes persistent quand le container est stop (hibernate)
- Volumes supprimes seulement sur `destroyPod()` explicite
- Credentials Claude stockes dans `/home/agent/.claude/` a l'interieur du volume

---

## 9. Statut d'Implementation

### Stories POD

| Story | Nom | SP | Statut | Fichier(s) cle(s) |
|-------|-----|----|--------|-------------------|
| POD-01 | Dockerfile.agent + image build | 3 | **FAIT** | `docker/Dockerfile.agent` |
| POD-02 | DB migration: user_pods + RLS | 3 | **FAIT** | `packages/db/src/migrations/0048_user_pods_and_deployments.sql`, `packages/db/src/schema/user_pods.ts` |
| POD-03 | PodManager service | 8 | **FAIT** | `server/src/services/pod-manager.ts` |
| POD-04 | Pod API routes + RBAC | 5 | **FAIT** | `server/src/routes/pods.ts` |
| POD-05 | Pod console (chat-style exec) | 8 | **FAIT** | `server/src/routes/pod-exec.ts`, `ui/src/components/workspace/PodConsole.tsx` |
| POD-06 | Workspace UI page | 5 | **FAIT** | `ui/src/pages/Workspace.tsx` |
| POD-07 | Sidebar "My Workspace" link | 2 | **FAIT** | `ui/src/components/Sidebar.tsx` (ligne 167) |
| POD-08 | Pod admin view (lister tous) | 3 | **PARTIEL** | Route API `GET /pods` faite, UI admin pas encore |

### Stories DEPLOY

| Story | Nom | SP | Statut | Fichier(s) cle(s) |
|-------|-----|----|--------|-------------------|
| DEPLOY-01 | DB migration: artifact_deployments + RLS | 3 | **FAIT** | `packages/db/src/migrations/0048_user_pods_and_deployments.sql`, `packages/db/src/schema/artifact_deployments.ts` |
| DEPLOY-02 | DeployManager service | 8 | **FAIT** | `server/src/services/deploy-manager.ts` |
| DEPLOY-03 | DeploymentProxy middleware | 5 | **FAIT** | `server/src/middleware/deployment-proxy.ts` |
| DEPLOY-04 | Deployment API routes + RBAC | 5 | **FAIT** | `server/src/routes/deployments.ts` |
| DEPLOY-05 | Garbage collector cron | 3 | **FAIT** | Integre dans `deploy-manager.ts` (`startGarbageCollector()`) |
| DEPLOY-06 | Deployments UI page | 5 | **FAIT** | `ui/src/pages/Deployments.tsx` |
| DEPLOY-07 | "Deploy" button on run detail | 3 | **TODO** | — |
| DEPLOY-08 | Issue deployment links panel | 5 | **FAIT** | `ui/src/components/deployments/IssueDeploymentLinks.tsx`, `ui/src/pages/IssueDetail.tsx` |

### Integration dans app.ts

Routes montees dans `server/src/app.ts` :
```typescript
api.use(podRoutes(db));        // POD-04
api.use(podExecRoutes(db));    // POD-05
api.use(deploymentRoutes(db)); // DEPLOY-04
app.use(deploymentProxyMiddleware(db)); // DEPLOY-03 (hors /api)
```

### Fichiers modifies (existants)

| Fichier | Modification |
|---------|-------------|
| `server/src/app.ts` | Import + mount des 4 modules (pod routes, pod exec, deployment routes, deployment proxy) |
| `packages/db/src/schema/index.ts` | Export `userPods` et `artifactDeployments` |
| `packages/shared/src/types/index.ts` | Re-export des types Pod et Deployment |
| `packages/shared/src/index.ts` | Export des constantes et types Pod/Deployment |
| `ui/src/App.tsx` | Routes `/workspace` et `/deployments` |
| `ui/src/components/Sidebar.tsx` | Nav items "My Workspace" et "Deployments" |
| `ui/src/lib/company-routes.ts` | `workspace` et `deployments` dans `BOARD_ROUTE_ROOTS` |
| `ui/src/lib/queryKeys.ts` | Query keys pour `pods` et `deployments` |
| `ui/src/pages/IssueDetail.tsx` | Import + render `IssueDeploymentLinks` |

### Fichiers crees (nouveaux)

| Fichier | Story |
|---------|-------|
| `docker/Dockerfile.agent` | POD-01 |
| `packages/db/src/migrations/0048_user_pods_and_deployments.sql` | POD-02 + DEPLOY-01 |
| `packages/db/src/schema/user_pods.ts` | POD-02 |
| `packages/db/src/schema/artifact_deployments.ts` | DEPLOY-01 |
| `packages/shared/src/types/pod.ts` | POD-01 |
| `packages/shared/src/types/deployment.ts` | DEPLOY-01 |
| `server/src/services/docker-client.ts` | Shared |
| `server/src/services/pod-manager.ts` | POD-03 |
| `server/src/services/deploy-manager.ts` | DEPLOY-02 |
| `server/src/routes/pods.ts` | POD-04 |
| `server/src/routes/pod-exec.ts` | POD-05 |
| `server/src/routes/deployments.ts` | DEPLOY-04 |
| `server/src/middleware/deployment-proxy.ts` | DEPLOY-03 |
| `ui/src/api/pods.ts` | POD-06 |
| `ui/src/api/deployments.ts` | DEPLOY-06 |
| `ui/src/pages/Workspace.tsx` | POD-06 |
| `ui/src/pages/Deployments.tsx` | DEPLOY-06 |
| `ui/src/components/workspace/PodConsole.tsx` | POD-05 |
| `ui/src/components/deployments/IssueDeploymentLinks.tsx` | DEPLOY-08 |

---

## 10. Reste a Faire

### P0 — Verification

| Tache | Description |
|-------|-------------|
| **BUILD** | Verifier que `bun run typecheck` passe avec les nouveaux fichiers |
| **MIGRATION** | Tester la migration 0048 sur un DB propre |
| **DOCKER BUILD** | Construire l'image `mnm-agent:latest` et verifier que Claude CLI fonctionne |
| **E2E POD** | Test: provision → exec `whoami` → hibernate → wake → exec → destroy |
| **E2E DEPLOY** | Test: create deployment → verify running → verify proxy → TTL cleanup |

### P1 — Stories manquantes

| Story | Description | SP |
|-------|-------------|-----|
| POD-08 (UI) | Page admin pour voir tous les pods de la company | 3 |
| DEPLOY-07 | Bouton "Deploy" sur la page RunDetail | 3 |
| Pod idle detection | Cron qui marque les pods idle (30min sans activite) puis hibernate | 3 |
| Build log streaming | WebSocket pour streamer les logs de build en temps reel | 5 |
| Deployment health check | HTTP GET sur le root du container avant de marquer "running" | 2 |

### P2 — Ameliorations futures

| Amelioration | Description |
|-------------|-------------|
| xterm.js terminal | Remplacer la console chat par un vrai terminal WebSocket (si besoin) |
| Subdomain routing | `{id}.preview.mnm.local` au lieu de `/preview/{id}` |
| Build cache | Cacher `node_modules` entre deployments pour accelerer les builds |
| Side-by-side compare | Comparer deux versions d'un deployment |
| QR code partage | Generer un QR code pour preview mobile |
| Traefik integration | Pour scaling multi-host |
| Pod pool pre-warmed | Pool de pods pre-crees pour attribution instantanee |

---

## 11. Trade-offs

| Decision | Gain | Perte | Rationale |
|----------|------|-------|-----------|
| Console chat vs xterm.js | Pas de deps (node-pty, xterm), simple REST | Pas de vrai terminal interactif (vim, htop) | MVP suffisant pour `claude auth login` et commandes basiques |
| 1 migration pour 2 tables | Atomique, simple | Pas de rollback independant | Les deux features sont liees conceptuellement |
| Port pool global (9000-9999) | Simple allocation | Limite a 1000 deployments global | Suffisant pour single-host |
| Proxy HTTP natif (pas http-proxy) | Zero dep supplementaire | Moins de features (WebSocket upgrade) | Suffisant pour static/node previews |
| TTL 24h par defaut | Auto-cleanup, pas de resource leak | L'user peut oublier de pin | Notifications futures mitigeront |
| Pas de Docker-in-Docker | Simple, leger | Pas d'isolation agent-level dans le pod | Acceptable pour MVP |

---

## 12. Risques

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Docker daemon overload (trop de pods) | Medium | High | Quotas (25/company), hibernation idle, monitoring |
| Port exhaustion | Low | High | TTL cleanup, quotas (10/company), pool 1000 ports |
| Claude token expiry dans le pod | Medium | Medium | Status check periodique, UI notification pour re-login |
| Container escape | Low | Critical | CapDrop ALL, no Docker socket, no-new-privileges, non-root |
| Console chat limitations (commandes interactives complexes) | Medium | Medium | Evolution future vers xterm.js si besoin |
| Migration 0048 conflits FK | Low | Medium | FK vers tables existantes (user, companies, issues, heartbeat_runs, agents, projects) |

---

*Genere par BMAD Method v6 - Tech Lead*
*Session tech-spec : 2026-03-21*
