# Brainstorming Session: Per-User Pods + Artifact Deployment

**Date:** 2026-03-21
**Objective:** Design two enterprise features for MnM: (1) Per-User Pods with Claude auth, (2) Artifact Deployment with preview URLs
**Context:** MnM B2B cockpit, existing container infra (dockerode, profiles, RLS multi-tenant), Docker socket now working inside MnM server container

## Techniques Used
1. Mind Mapping — 10 branches exploring all dimensions
2. Reverse Brainstorming — 15 failure modes identified, inverted into design requirements
3. SCAMPER — 7 transformations applied to each feature

---

## Ideas Generated

### Category 1: Pod Lifecycle & Provisioning
- Provision pod async on first login (NOT synchronously on signup)
- Pre-pull base images to avoid cold-start delays
- Warm pod model: pod starts on first access, hibernates after 30min idle
- Pod status machine: provisioning -> running -> idle -> hibernated -> destroyed
- 1 pod per user (strict limit), company-level quota
- Pod upgrade path: new image version = recreate with same volumes
- Alternative: pod pool of pre-warmed containers, assign on demand

### Category 2: Claude Auth & Credentials
- In-browser web terminal (xterm.js via WebSocket) for `claude login`
- User home dir as named volume (persists across pod restarts)
- Claude credentials stored in pod's `~/.claude/` directory
- All agents in pod inherit user's Claude auth automatically
- Alternative: "Connect Claude Account" button with OAuth-like flow
- Alternative: inject API key from MnM secrets vault (no interactive login)
- Token expiry monitoring: alert user when re-login needed

### Category 3: Agent Execution Model
- Agents run as processes INSIDE the pod (not separate containers)
- Multiple agents can run concurrently in one pod
- Pod provides workspace, tools, and auth context
- Agent isolation via process groups, not container boundaries
- Resource limits enforced at pod level (cgroup limits)
- Alternative: agents as sub-containers inside the pod (Docker-in-Docker)
- Alternative: 1 pod per agent (maximum isolation, maximum overhead)

### Category 4: Pod Security & Isolation
- Non-root user inside pod, dropped capabilities
- Each pod on isolated Docker network (no inter-pod communication)
- Read-only root filesystem, writable volumes for workspace/home
- No access to MnM's database, Redis, or internal services
- Pod cannot access Docker socket (no container escape)
- Company-level network policies (company-bridge mode optional)

### Category 5: Pod UI & UX
- "My Workspace" tab in sidebar (not buried in Containers page)
- Pod status indicator in sidebar (running/idle/hibernated)
- Web terminal integrated as tab within workspace view
- File browser for pod workspace files
- Real-time pod status via WebSocket (provisioning progress)
- Combine with onboarding wizard: "Step 3: Set up your workspace"

### Category 6: Artifact Detection & Triggers
- Agent writes to specific output directory (`/workspace/output/`)
- Agent calls MnM API: `POST /deployments` with artifact path
- Auto-detect on run completion: scan output dir for deployable files
- Manual: user clicks "Deploy" on run detail page
- Alternative: live deploy during agent work (hot reload in iframe)

### Category 7: Artifact Build Pipeline
- Auto-detect project type: package.json (Node), index.html (static), requirements.txt (Python)
- Run build step if needed (npm run build, pip install, etc.)
- Health check before marking deployment "live" (HTTP 200 on root)
- Stream build logs in real-time via WebSocket
- Timeout: max 5 min for build step
- Store build cache to speed up subsequent deploys

### Category 8: Deployment Serving & URL Routing
- Dynamic port pool: 9000-9999 (1000 deployments max)
- MnM as reverse proxy: `/preview/{deployment-id}/*` -> `localhost:{port}`
- Alternative: subdomain routing `{id}.preview.mnm.local`
- Alternative: Traefik with Docker labels (more scalable, more complex)
- SSL: optional, self-signed for local, Let's Encrypt for production
- No external reverse proxy needed for MVP

### Category 9: Deployment Lifecycle
- TTL-based: default 24h, configurable per deployment
- Company quota: max 10 active deployments
- Garbage collector: background cron every 5 min
- "Pin" feature: user can prevent auto-cleanup
- Version history: v1, v2, v3 with rollback
- Side-by-side comparison between versions

### Category 10: Deployment UX
- Preview card in run detail page with URL + copy button
- Deployment list page (like Vercel dashboard)
- Status badges: building, running, expired, pinned
- Embedded iframe preview within MnM UI
- Share button: generate shareable link (with optional auth token)
- QR code for mobile preview

### Category 11: Deployment Security
- Behind MnM auth by default (session cookie)
- Optional: public with time-limited token for external sharing
- Isolated network: no access to MnM DB/Redis/internal APIs
- Rate limiting on deployment containers
- Outbound internet: configurable (default: blocked)

### Category 12: Cross-Feature Synergies
- Agents run in pod -> produce artifacts -> deploy from pod's workspace
- Deployment + traces: see what agent did AND the result side-by-side
- Deployment + approval flow: require manager approval before going live
- Deployment + drift detection: auto-check if result matches spec
- Pod + web IDE: combine terminal + file browser + live preview

---

## Key Insights

### Insight 1: "Warm Pod" Model
**Description:** 1 persistent pod per user. Starts on first access, hibernates on idle, restores on demand. Not a new container per agent.
**Source:** Mind Mapping, SCAMPER (Modify), Reverse Brainstorming
**Impact:** High | **Effort:** Medium
**Why it matters:** Avoids cold-start latency, keeps credentials warm, simplifies agent execution. Predictable resource usage (max pods = max users).

### Insight 2: Web Terminal with Guided Auth
**Description:** In-browser xterm.js terminal for `claude login`. Guided UI flow for non-technical users. Alternative: OAuth-like "Connect Claude" button.
**Source:** Reverse Brainstorming, SCAMPER (Substitute)
**Impact:** High | **Effort:** Medium
**Why it matters:** Non-technical users (managers, PMs) won't SSH. Must be in MnM UI.

### Insight 3: Async Provisioning with WebSocket Status
**Description:** Pod creation async with real-time progress updates. Pre-pull images. Pod pool for instant assignment.
**Source:** Reverse Brainstorming, Mind Mapping
**Impact:** High | **Effort:** Low
**Why it matters:** Docker pull + start = 30-120s synchronous. Users abandon on blank spinner.

### Insight 4: MnM as Reverse Proxy
**Description:** MnM server proxies deployment URLs. Port pool 9000-9999. `/preview/{id}/*` routed to deployment container. No extra infra for MVP.
**Source:** Mind Mapping, SCAMPER (Eliminate)
**Impact:** High | **Effort:** Medium
**Why it matters:** Keeps architecture simple. Auth inherited from MnM session. Zero new infrastructure.

### Insight 5: Auto-Detect + Build + Health Check
**Description:** Detect project type, build if needed, health check before "live". Stream build logs real-time.
**Source:** Reverse Brainstorming, SCAMPER (Adapt)
**Impact:** Medium | **Effort:** High
**Why it matters:** Users expect "it just works." Raw source showing blank page destroys trust.

### Insight 6: TTL + Garbage Collection
**Description:** Every deployment has TTL (default 24h). Company quota (10 active). Cron cleanup. Pin to prevent cleanup.
**Source:** Reverse Brainstorming, Mind Mapping
**Impact:** Medium | **Effort:** Low
**Why it matters:** Without cleanup, deployments exhaust disk/ports/memory. Silent killer.

### Insight 7: Pod != Container
**Description:** Pods (user workspaces) are fundamentally different from Containers (agent execution units). Separate DB tables, separate UI pages, separate mental model.
**Source:** Mind Mapping, SCAMPER (Reverse)
**Impact:** High | **Effort:** Medium
**Why it matters:** Conflating pods with containers creates confusion. Pods are persistent workspaces; containers are ephemeral.

---

## Statistics
- Total ideas: 58
- Categories: 12
- Key insights: 7
- Techniques applied: 3

---

## Recommended Architecture (High-Level)

### New DB Tables
```
user_pods: id, userId, companyId, dockerContainerId, status, dockerImage, port, volumeName, lastActiveAt, createdAt
artifact_deployments: id, companyId, userId, runId, agentId, status, projectType, port, url, ttlSeconds, pinnedAt, buildLog, createdAt, expiresAt
```

### New API Routes
```
POST   /api/pods/provision          — Create user's pod (async)
GET    /api/pods/my                 — Get current user's pod status
POST   /api/pods/my/terminal        — WebSocket terminal attach
POST   /api/pods/my/hibernate       — Hibernate pod
POST   /api/pods/my/wake            — Wake hibernated pod
DELETE /api/pods/my                 — Destroy pod

POST   /api/deployments             — Deploy artifact from run/path
GET    /api/deployments             — List company deployments
GET    /api/deployments/:id         — Get deployment status
POST   /api/deployments/:id/pin     — Pin deployment (prevent TTL cleanup)
DELETE /api/deployments/:id         — Destroy deployment
GET    /preview/:id/*               — Reverse proxy to deployment container
```

### New UI Pages
```
/workspace           — "My Workspace" (pod status, terminal, file browser)
/deployments         — Deployment list (Vercel-style)
/deployments/:id     — Deployment detail (logs, preview iframe, sharing)
```

## Recommended Next Steps

1. **Tech Spec** — Run `/bmad:tech-spec` to formalize these insights into implementation stories
2. **Architecture Review** — Run `/bmad:architecture` to validate against NFRs (security, multi-tenancy, scalability)
3. **Prototype** — Start with pod provisioning + web terminal (highest user impact, validates concept)

---

*Generated by BMAD Method v6 - Creative Intelligence*
*Session duration: ~25 minutes*
