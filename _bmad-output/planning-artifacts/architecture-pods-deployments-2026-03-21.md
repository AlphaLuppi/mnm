# Architecture — Per-User Pods + Artifact Deployment

> **Date** : 2026-03-21 | **Version** : 1.0
> **Statut** : Draft — ready for review
> **Auteur** : System Architect (BMAD)
> **Sources** : Brainstorming 2026-03-21, Epics B2B v1.0, Tech Spec Trace Pipeline v2.0

---

## 1. Architectural Drivers

| # | Driver | Requirement | Impact |
|---|--------|-------------|--------|
| AD-1 | Multi-Tenant Isolation | Pods/deployments scoped per company + user, RLS enforced | Critical |
| AD-2 | Container Security | Pod cannot escape to host; no Docker socket access inside pods | Critical |
| AD-3 | Async Provisioning | Pod creation < 30s perceived (async + WebSocket status) | High |
| AD-4 | Resource Bounds | Hard limits: 1 pod/user, N deployments/company, CPU/RAM caps | High |
| AD-5 | Zero New Infrastructure | No Traefik, no K8s for MVP — MnM server handles everything | Medium |
| AD-6 | Credential Persistence | Claude auth survives pod restarts via volume mounts | High |
| AD-7 | Deployment Ephemerality | Auto-cleanup via TTL, garbage collector, company quotas | Medium |

---

## 2. High-Level Architecture

### Pattern: Extended Modular Monolith

MnM is already a modular monolith (Express + React + PostgreSQL). These two features add as new modules within the same architecture — no microservices, no new processes.

```
                         ┌──────────────────────────────────────────┐
                         │              MnM Server (Express)        │
                         │                                          │
  Browser ──────────────►│  /api/pods/*          → PodManager       │
  (React UI)             │  /api/deployments/*   → DeployManager    │
                         │  /preview/:id/*       → ReverseProxy ────┼──► Deployment Container :9xxx
                         │  /ws/pod-terminal     → WebSocket TTY ───┼──► User Pod (attach)
                         │  /ws/pod-status       → WebSocket Status │
                         │                                          │
                         │  ┌─ Docker Socket (/var/run/docker.sock) │
                         │  │                                       │
                         │  ├─► Create/Start/Stop Pods              │
                         │  ├─► Create/Start/Stop Deployments       │
                         │  └─► Monitor health, resources           │
                         └──────────────────────────────────────────┘
                              │            │              │
                    ┌─────────┘    ┌───────┘      ┌───────┘
                    ▼              ▼               ▼
              ┌──────────┐  ┌──────────┐   ┌──────────────────┐
              │ PostgreSQL│  │  Redis   │   │  Docker Daemon   │
              │ (RLS)     │  │ (events) │   │  (host)          │
              └──────────┘  └──────────┘   │                  │
                                           │ ┌──────────────┐ │
                                           │ │ User Pod A   │ │
                                           │ │ (mnm-pod-*)  │ │
                                           │ └──────────────┘ │
                                           │ ┌──────────────┐ │
                                           │ │ User Pod B   │ │
                                           │ └──────────────┘ │
                                           │ ┌──────────────┐ │
                                           │ │ Deploy C     │ │
                                           │ │ (:9001)      │ │
                                           │ └──────────────┘ │
                                           └──────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pod model | 1 persistent pod per user | Avoids cold-start, keeps credentials warm |
| Agent execution | Processes inside pod (not sub-containers) | Lighter, simpler, Claude auth inherited |
| Deployment serving | MnM as reverse proxy | No extra infra, auth inherited |
| Terminal access | WebSocket via MnM server (xterm.js) | In-browser, no SSH needed |
| Credential storage | Docker named volume per user | Persists across restarts |
| Image | Custom `mnm-agent` image (pre-installed Claude CLI + tools) | Fast start, consistent environment |

---

## 3. Technology Stack (Additions)

### New Dependencies

| Package | Purpose | Where |
|---------|---------|-------|
| `http-proxy` | Reverse proxy for deployments | server |
| `node-pty` or Docker attach API | Terminal multiplexing for pod WebSocket | server |
| `xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links` | Browser terminal UI | ui |

### Docker Image: `mnm-agent`

Custom Dockerfile for user pods (NOT the MnM server Dockerfile):

```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates python3 build-essential \
    && npm install -g @anthropic-ai/claude-code@latest \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash agent
USER agent
WORKDIR /home/agent
ENV HOME=/home/agent
```

Built once and tagged `mnm-agent:latest`. Pre-pulled on MnM server start.

---

## 4. System Components

### Component 1: PodManager (server service)

**Purpose:** Manage per-user pod lifecycle (provision, hibernate, wake, destroy)

**Responsibilities:**
- Create Docker container for user on demand
- Attach named volumes (home dir, workspace)
- Monitor pod health and resource usage
- Hibernate idle pods (stop container, keep volumes)
- Wake hibernated pods (start container with same volumes)
- Enforce 1-pod-per-user and company quotas
- Pre-pull `mnm-agent` image on server start

**Interfaces:**
- Internal service (called by pod routes)
- Docker API (via dockerode)
- WebSocket for real-time status updates

**Dependencies:**
- Docker daemon (via socket)
- PostgreSQL (pod records)
- Redis (publish status events)

**Key File:** `server/src/services/pod-manager.ts`

---

### Component 2: PodTerminalRelay (server WebSocket handler)

**Purpose:** Relay WebSocket terminal sessions between browser and pod

**Responsibilities:**
- Accept WebSocket connection from browser (xterm.js)
- Authenticate user via session cookie
- Docker exec attach to user's pod (`/bin/bash`)
- Bidirectional stream: browser keystrokes → pod stdin, pod stdout → browser
- Handle disconnect, reconnect, resize events
- Rate limit: 1 terminal per user

**Interfaces:**
- WebSocket endpoint: `/ws/pod-terminal`
- Docker exec API

**Dependencies:**
- PodManager (get container ID)
- Auth middleware (verify user)

**Key File:** `server/src/realtime/pod-terminal.ts`

---

### Component 3: DeployManager (server service)

**Purpose:** Deploy agent artifacts as preview containers with URLs

**Responsibilities:**
- Detect artifact type (static, Node, Python)
- Build artifacts if needed (npm run build, etc.)
- Launch lightweight container (nginx for static, node for apps)
- Allocate port from pool (9000-9999)
- Track deployment lifecycle (building → running → expired)
- TTL-based cleanup with garbage collector
- Company quota enforcement (max 10 active)

**Interfaces:**
- Internal service (called by deployment routes)
- Docker API
- Cron (cleanup expired deployments)

**Dependencies:**
- Docker daemon
- PostgreSQL (deployment records)
- Redis (build log streaming)

**Key File:** `server/src/services/deploy-manager.ts`

---

### Component 4: DeploymentProxy (Express middleware)

**Purpose:** Reverse proxy HTTP requests to deployment containers

**Responsibilities:**
- Match `/preview/:deploymentId/*` routes
- Look up deployment port from DB/cache
- Proxy request to `localhost:{port}`
- Inject CORS headers
- Handle WebSocket upgrade (for HMR/live reload)
- Auth check: require MnM session or valid share token

**Interfaces:**
- Express middleware mounted on `/preview`

**Dependencies:**
- DeployManager (port lookup)
- Auth (session validation)
- `http-proxy` package

**Key File:** `server/src/middleware/deployment-proxy.ts`

---

### Component 5: Frontend — Workspace Page

**Purpose:** "My Workspace" UI with pod status, terminal, file browser

**Responsibilities:**
- Show pod status (provisioning/running/idle/hibernated)
- Provision button (first time) / Wake button (hibernated)
- Embedded web terminal (xterm.js)
- File browser (list files in pod workspace via exec)
- Claude auth status indicator

**Key Files:**
- `ui/src/pages/Workspace.tsx`
- `ui/src/components/workspace/PodTerminal.tsx`
- `ui/src/components/workspace/PodStatusCard.tsx`

---

### Component 6: Frontend — Deployments Page

**Purpose:** List and manage artifact deployments (Vercel-style)

**Responsibilities:**
- List all company deployments with status/URL/TTL
- Deploy button on run detail page
- Build log viewer (streaming)
- Preview iframe (embedded)
- Pin/unpin, destroy actions

**Key Files:**
- `ui/src/pages/Deployments.tsx`
- `ui/src/pages/DeploymentDetail.tsx`
- `ui/src/components/deployments/BuildLogViewer.tsx`
- `ui/src/components/deployments/PreviewFrame.tsx`

---

## 5. Data Architecture

### New Tables

#### `user_pods`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → auth_users | UNIQUE per company |
| company_id | UUID FK → companies | RLS |
| docker_container_id | text | Docker daemon ID |
| docker_image | text | Default: mnm-agent:latest |
| status | text | provisioning/running/idle/hibernated/failed/destroyed |
| volume_name | text | Docker named volume for home dir |
| workspace_volume | text | Docker named volume for workspace |
| port | int | Internal container port (for exec) |
| cpu_millicores | int | Resource limit |
| memory_mb | int | Resource limit |
| last_active_at | timestamp | For idle detection |
| claude_auth_status | text | unknown/authenticated/expired |
| error | text | Last error message |
| created_at | timestamp | |
| updated_at | timestamp | |

**Indexes:** (company_id, user_id) UNIQUE, (status), (last_active_at)
**RLS:** company_id scoping

#### `artifact_deployments`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | RLS |
| user_id | UUID FK → auth_users | Who deployed |
| issue_id | UUID FK → issues | Optional: linked issue (shown on issue page) |
| run_id | UUID FK → heartbeat_runs | Optional: linked run |
| agent_id | UUID FK → agents | Optional: which agent |
| project_id | UUID FK → projects | Optional: which project |
| name | text | Display name |
| status | text | building/running/failed/expired/pinned |
| project_type | text | static/node/python/unknown |
| docker_container_id | text | Docker daemon ID |
| port | int | Allocated from pool 9000-9999 |
| source_path | text | Path inside pod where artifacts live |
| build_log | text | Build output (appended) |
| ttl_seconds | int | Default: 86400 (24h) |
| pinned | boolean | Default: false |
| share_token | text | Optional: for public sharing |
| url | text | Computed: /preview/{id} |
| expires_at | timestamp | created_at + ttl |
| created_at | timestamp | |
| updated_at | timestamp | |

**Indexes:** (company_id, status), (expires_at), (port) UNIQUE, (share_token), (issue_id)
**RLS:** company_id scoping

### Entity Relationships

```
issues ──1:N──► artifact_deployments (deployment links shown on issue page)
                    │
auth_users ──1:1──► user_pods (per company)
     │
     └──1:N──► artifact_deployments
                    │
                    ├── FK → issues (primary link — shown on issue detail)
                    ├── FK → heartbeat_runs (optional)
                    ├── FK → agents (optional)
                    └── FK → projects (optional)
```

### Issue ↔ Deployment Integration

**Key design point:** Deployments are surfaced ON the issue page.

When an agent works on an issue and produces a deployable artifact:
1. Agent run is linked to issue (existing: `heartbeat_runs.issueId`)
2. Deploy is created with `issue_id` set
3. Issue detail page shows a "Deployments" panel with:
   - Preview URL (clickable, opens in new tab)
   - Deployment status badge (building/running/expired)
   - Embedded preview iframe (collapsible)
   - Deploy timestamp + who deployed
   - Pin/unpin toggle for admins

**UI location:** On IssueDetail page, as a new panel/tab alongside existing "Runs", "Comments", "Activity" sections.

**API:** `GET /api/companies/:companyId/deployments?issueId=X` returns deployments for an issue.

### Migration Plan

```
packages/db/src/migrations/0050_user_pods.sql
packages/db/src/migrations/0051_artifact_deployments.sql
```

Both with RLS policies matching existing patterns (company_id scoping, admin override).

---

## 6. API Design

### Pod Management

```
POST   /api/companies/:companyId/pods/provision
  Body: { image?: string, cpuMillicores?: number, memoryMb?: number }
  Response: 202 { podId, status: "provisioning" }
  Permission: agents:launch
  Notes: Async — returns immediately, sends status via WebSocket

GET    /api/companies/:companyId/pods/my
  Response: 200 { pod: UserPod | null }
  Permission: agents:launch
  Notes: Returns current user's pod (or null if none)

POST   /api/companies/:companyId/pods/my/wake
  Response: 202 { status: "waking" }
  Permission: agents:launch
  Notes: Wake a hibernated pod

POST   /api/companies/:companyId/pods/my/hibernate
  Response: 200 { status: "hibernated" }
  Permission: agents:launch
  Notes: Stop container, keep volumes

DELETE /api/companies/:companyId/pods/my
  Response: 200 { status: "destroyed" }
  Permission: agents:manage_containers
  Notes: Stop container AND remove volumes

GET    /api/companies/:companyId/pods
  Response: 200 { pods: UserPod[] }
  Permission: agents:manage_containers
  Notes: Admin view — list all pods in company

WS     /ws/pod-terminal?companyId=X
  Auth: session cookie
  Protocol: binary frames (stdin/stdout)
  Notes: xterm.js compatible
```

### Deployment Management

```
POST   /api/companies/:companyId/deployments
  Body: { sourcePath: string, name?: string, runId?: string, ttlSeconds?: number }
  Response: 202 { deploymentId, status: "building" }
  Permission: agents:launch
  Notes: Async build + deploy

GET    /api/companies/:companyId/deployments
  Response: 200 { deployments: ArtifactDeployment[] }
  Permission: agents:launch

GET    /api/companies/:companyId/deployments/:deploymentId
  Response: 200 { deployment: ArtifactDeployment }
  Permission: agents:launch

GET    /api/companies/:companyId/deployments/:deploymentId/logs
  Response: 200 { log: string }
  Permission: agents:launch
  Notes: Also available via WebSocket for streaming

POST   /api/companies/:companyId/deployments/:deploymentId/pin
  Response: 200 { pinned: true, expiresAt: null }
  Permission: agents:manage_containers

POST   /api/companies/:companyId/deployments/:deploymentId/unpin
  Response: 200 { pinned: false, expiresAt: "..." }
  Permission: agents:manage_containers

DELETE /api/companies/:companyId/deployments/:deploymentId
  Response: 200 { status: "destroyed" }
  Permission: agents:manage_containers

GET    /preview/:deploymentId/*
  Auth: session cookie OR ?token=shareToken
  Notes: Reverse proxy to deployment container
```

---

## 7. NFR Coverage

### NFR-1: Multi-Tenant Isolation

**Requirement:** All pods and deployments scoped per company via RLS. No cross-company access.

**Solution:**
- `user_pods.company_id` and `artifact_deployments.company_id` with RLS policies
- Pod Docker labels include `mnm.companyId` for traceability
- Deployment containers on isolated Docker network (no access to MnM internals)
- Admin permission (`agents:manage_containers`) required for cross-user pod management

**Validation:** E2E tests verifying RBAC (viewer cannot manage, admin can see all, cross-company blocked)

---

### NFR-2: Container Security

**Requirement:** Pods and deployment containers cannot escape to host or access MnM internals.

**Solution:**
- Pods run as non-root user (`agent`, UID 1000)
- No Docker socket mount inside pods
- `--cap-drop=ALL` with only `--cap-add=NET_BIND_SERVICE` if needed
- Read-only root filesystem with writable tmpfs for `/tmp`
- Writable volumes: only user home (`/home/agent`) and workspace (`/workspace`)
- Deployment containers: `--network=none` or dedicated isolated network
- No `--privileged` flag, no SYS_ADMIN capability
- PID namespace isolation (cannot see host processes)
- Seccomp profile: default Docker profile

**Validation:** Security audit checklist, penetration test of container escape vectors

---

### NFR-3: Async Provisioning Performance

**Requirement:** Pod provisioning perceived as < 30 seconds. Deployment build start < 5 seconds.

**Solution:**
- Pre-pull `mnm-agent:latest` image on MnM server startup (cron every 6h)
- Pod provisioning is async (API returns 202 immediately)
- Real-time status updates via WebSocket (`/ws/pod-status`)
- UI shows spinner with step-by-step progress: "Pulling image... Creating container... Starting..."
- Deployment build starts immediately (copy artifacts → run build → start server)

**Validation:** Performance test: provision pod with pre-pulled image < 10s. Cold pull < 60s.

---

### NFR-4: Resource Bounds

**Requirement:** Hard limits to prevent resource exhaustion on shared host.

**Solution:**
- 1 pod per user per company (enforced in DB with UNIQUE constraint)
- Company pod quota: configurable, default 25 (MAX_PODS_PER_COMPANY)
- Pod resource defaults: 1000 CPU millicores, 1024 MB RAM, 2048 MB disk
- Company deployment quota: configurable, default 10 (MAX_DEPLOYMENTS_PER_COMPANY)
- Deployment port pool: 9000-9999 (1000 slots, shared globally)
- Idle pod hibernation: after 30 minutes of no terminal/agent activity
- Garbage collector: runs every 5 minutes, cleans expired deployments

**Validation:** Load test with 25 pods + 10 deployments simultaneously

---

### NFR-5: Credential Persistence

**Requirement:** Claude login credentials survive pod restarts and hibernation.

**Solution:**
- User home dir mounted as Docker named volume: `mnm-pod-home-{userId}`
- Volume persists when container is stopped (hibernated)
- Volume only destroyed on explicit pod deletion (with user confirmation)
- Claude credentials stored at `/home/agent/.claude/` inside volume
- Pod status includes `claude_auth_status` field (checked periodically)

**Validation:** Test: login to Claude → hibernate pod → wake pod → verify `claude` CLI works

---

### NFR-6: Deployment TTL & Cleanup

**Requirement:** Deployments auto-expire. No resource leak.

**Solution:**
- Every deployment has `expires_at` = `created_at + ttl_seconds`
- Default TTL: 86400 seconds (24 hours)
- Garbage collector cron (every 5 min): finds expired deployments, stops containers, frees ports
- Pinned deployments skip TTL check (require explicit unpin or delete)
- Company quota check before creating new deployment
- Orphan container detection: reconcile DB records with Docker state

**Validation:** Test: create deployment with 5-minute TTL → verify auto-cleanup

---

## 8. Security Architecture

### Pod Security Model

```
┌─────────────────────────────────────────┐
│  MnM Server (trusted zone)              │
│  - Has Docker socket                    │
│  - Has DB access                        │
│  - Manages pod lifecycle                │
└────────────────────┬────────────────────┘
                     │ Docker API
                     ▼
┌─────────────────────────────────────────┐
│  User Pod (untrusted zone)              │
│  - NO Docker socket                     │
│  - NO DB/Redis access                   │
│  - NO host network access               │
│  - Non-root user (agent:1000)           │
│  - Read-only rootfs                     │
│  - Writable: /home/agent, /workspace    │
│  - Dropped capabilities                 │
│  - Seccomp default profile              │
│  - Resource-limited (cgroup)            │
└─────────────────────────────────────────┘
```

### Deployment Security Model

```
┌─────────────────────────────────────────┐
│  MnM Server (reverse proxy)             │
│  - Auth check on /preview/:id/*         │
│  - Session cookie OR share token        │
│  - Rate limit: 100 req/min per deploy   │
└────────────────────┬────────────────────┘
                     │ Proxy
                     ▼
┌─────────────────────────────────────────┐
│  Deployment Container                   │
│  - Isolated network (no internet by     │
│    default, configurable)               │
│  - Serves on localhost:{port} only      │
│  - No access to MnM internals           │
│  - Read-only source mount               │
│  - 256 MB RAM limit, 500 CPU millicores │
│  - Auto-destroyed on TTL expiry         │
└─────────────────────────────────────────┘
```

### Authentication Flow

1. User logs into MnM (Better Auth session cookie)
2. User navigates to /workspace → MnM checks session, returns pod status
3. User opens terminal → WebSocket authenticated via session cookie
4. Inside pod, user runs `claude login` → credentials stored in pod's volume
5. When agents run in pod, they use the Claude credentials from the volume
6. Preview URLs: authenticated via session cookie OR `?token=shareToken`

### RBAC Integration

| Permission | Who | Actions |
|------------|-----|---------|
| `agents:launch` | contributor+ | Provision own pod, create deployments, view own |
| `agents:manage_containers` | admin | View/manage all pods and deployments, pin/unpin, destroy |

---

## 9. Scalability & Performance

### Scaling Considerations

| Concern | Current Limit | Mitigation |
|---------|---------------|------------|
| Pods per host | ~50 (RAM-bound) | Company quotas, idle hibernation |
| Deployments per host | ~100 (port-bound) | TTL cleanup, port pool 9000-9999 |
| Terminal sessions | ~100 (WebSocket-bound) | 1 terminal per user, disconnect idle |
| Docker daemon | Single host | Future: Docker Swarm or K8s for multi-host |

### Performance Optimization

- **Image pre-pull**: `mnm-agent:latest` pulled on server start
- **Pod wake time**: < 3s (container already created, just `docker start`)
- **Deployment proxy**: Cache port lookup in Redis (TTL 60s)
- **Terminal latency**: Direct Docker exec attach, no intermediate buffering
- **Garbage collector**: Batch operations (stop + remove in parallel)

### Future Scaling Path

1. **Phase 1 (current)**: Single Docker host, MnM manages everything
2. **Phase 2**: Docker Swarm mode — distribute pods across multiple hosts
3. **Phase 3**: Kubernetes — Helm chart, pod per user as K8s Pod, Ingress for deployments

---

## 10. Reliability & Availability

### Pod Reliability

- Pod containers have `restart: unless-stopped` policy
- Health check: every 30s, 3 retries, 5s timeout
- If pod crashes: Docker auto-restarts, MnM updates status on next health poll
- Volumes persist even if container is destroyed (explicit cleanup only)
- Orphan detection: reconcile DB state with Docker state every 5 min

### Deployment Reliability

- Deployment containers have `restart: no` (ephemeral by design)
- Health check before marking "live": HTTP GET to container root
- If deployment crashes: mark status as "failed", notify user
- Port reuse: freed port returned to pool immediately

### Monitoring

- Pod metrics: CPU%, MEM%, status, last_active_at → dashboard
- Deployment metrics: request count, active deployments, port usage
- Alerts: pod failed to start, deployment quota exceeded, garbage collector stuck

---

## 11. Development & Deployment

### New Files (Server)

```
server/src/services/pod-manager.ts          — Pod lifecycle management
server/src/services/deploy-manager.ts       — Deployment lifecycle management
server/src/services/deploy-garbage.ts       — TTL cleanup cron
server/src/routes/pods.ts                   — Pod API routes
server/src/routes/deployments.ts            — Deployment API routes
server/src/middleware/deployment-proxy.ts    — Reverse proxy middleware
server/src/realtime/pod-terminal.ts         — WebSocket terminal relay
```

### New Files (UI)

```
ui/src/pages/Workspace.tsx                  — My Workspace page
ui/src/pages/Deployments.tsx                — Deployment list
ui/src/pages/DeploymentDetail.tsx           — Deployment detail + preview
ui/src/components/workspace/PodTerminal.tsx — xterm.js terminal
ui/src/components/workspace/PodStatusCard.tsx
ui/src/components/deployments/BuildLogViewer.tsx
ui/src/components/deployments/PreviewFrame.tsx
ui/src/components/deployments/IssueDeploymentLinks.tsx — Deployment links panel for IssueDetail
ui/src/api/pods.ts                          — Pod API client
ui/src/api/deployments.ts                   — Deployment API client
```

### New Files (DB)

```
packages/db/src/schema/user_pods.ts
packages/db/src/schema/artifact_deployments.ts
packages/db/src/migrations/0050_user_pods.sql
packages/db/src/migrations/0051_artifact_deployments.sql
```

### New Files (Docker)

```
docker/Dockerfile.agent                     — mnm-agent image
```

### Testing Strategy

- **Unit tests**: PodManager, DeployManager (mock dockerode)
- **Integration tests**: API routes with real DB (embedded postgres)
- **E2E tests**: Pod provision + terminal + deployment flow (requires Docker)
- **Security tests**: Container escape attempts, cross-company access

### Build Sequence

1. Create `Dockerfile.agent` and build `mnm-agent:latest`
2. Add migrations (0050, 0051)
3. Implement PodManager service
4. Implement Pod API routes
5. Implement PodTerminalRelay (WebSocket)
6. Implement Workspace UI page + terminal
7. Implement DeployManager service
8. Implement DeploymentProxy middleware
9. Implement Deployment API routes
10. Implement Deployments UI pages
11. Add garbage collector cron
12. E2E tests

---

## 12. Traceability & Trade-offs

### Trade-offs

| Decision | Gain | Lose | Rationale |
|----------|------|------|-----------|
| 1 pod per user (not per agent) | Simpler, fewer resources, shared auth | Less isolation between agents | Agents from same user share trust boundary |
| MnM as reverse proxy (not Traefik) | Zero new infra, auth inherited | Less scalable, single point of proxy | MVP simplicity; Traefik can be added later |
| Processes inside pod (not sub-containers) | Lighter, faster, shared filesystem | No agent-level resource limits | Acceptable for MVP; Docker-in-Docker adds complexity |
| Named volumes (not bind mounts) | Portable, Docker-managed, no host path dependency | Harder to inspect from host | Volume can be inspected via `docker volume inspect` |
| Port pool 9000-9999 | Simple allocation, 1000 slots | Global limit, not per-company | Sufficient for single-host deployment |
| TTL-based cleanup (not manual) | Automatic resource recovery | User may lose deployments they forgot to pin | Notifications before expiry mitigate this |

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Docker daemon overload (too many pods) | Medium | High | Hard quotas, hibernation, monitoring |
| Port exhaustion (too many deployments) | Low | High | TTL cleanup, company quotas, port pool size |
| Claude token expiry in pod | Medium | Medium | Periodic check, UI notification to re-login |
| Container escape vulnerability | Low | Critical | Seccomp, dropped caps, no Docker socket in pods |
| WebSocket terminal instability | Medium | Medium | Reconnection logic, heartbeat pings |

---

## 13. Epic Breakdown (Suggested)

### Epic POD — Per-User Pods (8 stories)

| Story | Name | SP | Priority |
|-------|------|----|----------|
| POD-01 | Dockerfile.agent + image build pipeline | 3 | P0 |
| POD-02 | DB migration: user_pods table + RLS | 3 | P0 |
| POD-03 | PodManager service (provision, hibernate, wake, destroy) | 8 | P0 |
| POD-04 | Pod API routes + RBAC | 5 | P0 |
| POD-05 | WebSocket terminal relay (pod-terminal.ts) | 8 | P0 |
| POD-06 | Workspace UI page (status + terminal) | 5 | P0 |
| POD-07 | Sidebar "My Workspace" link + pod status indicator | 2 | P1 |
| POD-08 | Pod admin view (list all pods in company) | 3 | P1 |

**Total: ~37 SP**

### Epic DEPLOY — Artifact Deployment (8 stories)

| Story | Name | SP | Priority |
|-------|------|----|----------|
| DEPLOY-01 | DB migration: artifact_deployments table (with issue_id FK) + RLS | 3 | P0 |
| DEPLOY-02 | DeployManager service (detect, build, serve, cleanup) | 8 | P0 |
| DEPLOY-03 | DeploymentProxy middleware (reverse proxy) | 5 | P0 |
| DEPLOY-04 | Deployment API routes + RBAC | 5 | P0 |
| DEPLOY-05 | Deployment garbage collector cron | 3 | P1 |
| DEPLOY-06 | Deployments UI page (list + detail + preview iframe) | 5 | P1 |
| DEPLOY-07 | "Deploy" button on run detail page | 3 | P1 |
| DEPLOY-08 | Issue deployment links panel (IssueDetail page) | 5 | P0 |

**DEPLOY-08 detail:** On the IssueDetail page, add a "Deployments" panel showing all deployments linked to this issue. Each entry shows: preview URL (clickable), status badge, timestamp, deployer name, and an optional embedded preview iframe. Uses `GET /deployments?issueId=X`. Integrated alongside existing "Runs", "Comments", "Activity" tabs.

**Total: ~37 SP**

### Combined: ~74 SP (~7-9 weeks for 1 dev)

---

## Validation Checklist

- [x] All architectural drivers have solutions
- [x] Multi-tenant isolation via RLS
- [x] Security model defined (non-root, no socket, dropped caps)
- [x] Technology choices justified (minimal new dependencies)
- [x] Trade-offs documented (6 major decisions)
- [x] Data model defined (2 new tables)
- [x] API contracts specified (14 endpoints)
- [x] Testing strategy defined
- [x] Build sequence specified (12 steps)
- [x] Scalability path clear (single host → Swarm → K8s)
- [x] Risks identified with mitigations (5 risks)

---

*Generated by BMAD Method v6 - System Architect*
*Architecture session: 2026-03-21*
