# CONT-S01 : ContainerManager Docker -- Lifecycle Complet Agents Containerises

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CONT-S01 |
| **Titre** | ContainerManager Docker -- Lifecycle complet des containers agents (create, start, monitor, stop, cleanup) |
| **Epic** | Epic CONT -- Containerisation |
| **Sprint** | Sprint 5 (Batch 9) |
| **Effort** | XL (13 SP, 2-3 semaines) |
| **Priorite** | P0 -- Prerequis B2B (isolation, securite) |
| **Assignation** | Cofondateur (backend + infra) |
| **Bloque par** | TECH-02 (Docker Compose -- DONE), TECH-05 (RLS PostgreSQL -- DONE) |
| **Debloque** | CONT-S02 (Credential Proxy), CONT-S03 (Mount Allowlist), CONT-S04 (Isolation Reseau), CONT-S06 (UI ContainerStatus), CHAT-S03 (ChatService pipe stdin), COMP-S02 (Kill+relance) |
| **ADR** | ADR-004 (Containerisation Docker + Credential Proxy) |
| **Type** | Backend (service + adapter + types + API routes) |
| **FRs couverts** | REQ-CONT-01, REQ-CONT-04, REQ-CONT-06, REQ-CONT-07 |

---

## Description

### Contexte -- Pourquoi cette story est critique

La containerisation est le fondement de la securite B2B dans MnM. Aujourd'hui, les agents IA tournent comme des processus enfants directs du serveur Node.js (voir `server/src/adapters/process/execute.ts`). Ce modele est acceptable pour un seul utilisateur, mais inacceptable en multi-tenant B2B :

1. **Aucune isolation** -- un agent compromis a acces a tout le filesystem du serveur
2. **Pas de limite de ressources** -- un agent peut consommer 100% CPU/RAM et bloquer les autres
3. **Secrets exposes** -- les variables d'environnement sont heritees du processus parent
4. **Pas de cleanup garanti** -- un process zombie peut persister indefiniment

Le pattern Nanoclaw (ADR-004) impose 5 couches de defense. Cette story implemente la premiere couche : le ContainerManager qui gere le lifecycle complet des containers Docker ephemeres pour les agents IA.

### Ce que cette story construit

1. **ContainerManager** (`server/src/services/container-manager.ts`) -- service central : create, start, monitor, stop, destroy via `dockerode`
2. **Docker adapter** (`server/src/adapters/docker/`) -- nouvel adapter type "docker" dans le registry, avec execute/test
3. **4 profils de ressources** -- light (0.5 CPU, 256MB), standard (1 CPU, 512MB), heavy (2 CPU, 1GB), gpu (4 CPU, 4GB)
4. **Flags securite** -- `--rm`, `--read-only`, `--no-new-privileges`, shadow `.env` via `/dev/null` mount
5. **Health monitoring** -- polling status container, detection OOM kill, timeout avec SIGTERM puis SIGKILL
6. **API routes** -- POST /api/containers/launch, GET /api/containers/:id/status, POST /api/containers/:id/stop, GET /api/containers (list)
7. **Types partages** -- dans `packages/shared/src/types/container.ts`
8. **Integration DB** -- CRUD `container_instances` et `container_profiles` (tables existantes via TECH-06)

### Ce que cette story ne fait PAS (scope)

- Pas de credential proxy HTTP (CONT-S02)
- Pas de mount allowlist tamper-proof avec realpath (CONT-S03)
- Pas d'isolation reseau Docker inter-company (CONT-S04)
- Pas de tables schema (deja fait en TECH-06 via CONT-S05)
- Pas d'UI ContainerStatus (CONT-S06)
- Pas de pipe stdin pour chat (CHAT-S03)

---

## Etat Actuel du Code (Analyse)

### Fichiers existants impactes

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `server/src/adapters/registry.ts` | Registry des adapters (process, http) | MODIFIE : ajout adapter "docker" |
| `server/src/adapters/index.ts` | Barrel exports adapters | MODIFIE : re-export Docker adapter |
| `server/src/services/heartbeat.ts` | Gestion execution agents (process) | MODIFIE : detection isolationMode "container" pour deleguer au ContainerManager |
| `server/src/services/index.ts` | Barrel exports services | MODIFIE : export containerManagerService |
| `packages/shared/src/types/index.ts` | Barrel exports types partages | MODIFIE : export types container |
| `packages/db/src/schema/container_profiles.ts` | Schema container_profiles (existant TECH-06) | NON MODIFIE (utilise tel quel) |
| `packages/db/src/schema/container_instances.ts` | Schema container_instances (existant TECH-06) | NON MODIFIE (utilise tel quel) |
| `packages/db/src/schema/agents.ts` | Schema agents avec containerProfileId, isolationMode | NON MODIFIE (utilise tel quel) |

### Fichiers a creer

| Fichier | Role |
|---------|------|
| `server/src/services/container-manager.ts` | Service ContainerManager -- lifecycle complet |
| `server/src/adapters/docker/index.ts` | Docker adapter module definition |
| `server/src/adapters/docker/execute.ts` | Docker adapter execute -- lance container via ContainerManager |
| `server/src/adapters/docker/test.ts` | Docker adapter test -- verifie connectivite Docker |
| `server/src/routes/containers.ts` | Routes API containers (launch, status, stop, list) |
| `packages/shared/src/types/container.ts` | Types partages : ContainerProfile, ContainerInstance, ContainerStatus, etc. |
| `server/src/__tests__/container-manager.test.ts` | Tests unitaires ContainerManager |
| `server/src/__tests__/docker-adapter.test.ts` | Tests unitaires Docker adapter |

### Fichiers de reference (non modifies)

| Fichier | Role |
|---------|------|
| `server/src/adapters/process/execute.ts` | Adapter process existant -- modele pour le Docker adapter |
| `server/src/adapters/utils.ts` | Utilitaires adapters (buildMnMEnv, runChildProcess) |
| `server/src/services/access.ts` | hasPermission, canUser -- pour les gardes RBAC sur les routes |
| `server/src/services/audit-emitter.ts` | emitAudit -- pour les audit events |
| `server/src/services/live-events.ts` | publishLiveEvent -- pour les notifications temps reel |
| `server/src/errors.ts` | conflict(), forbidden(), notFound(), unprocessable() |

### Conventions du codebase (a respecter)

1. **Service pattern** : `containerManagerService(db)` retourne un objet de fonctions -- pas de classes
2. **Error handling** : `throw conflict("message")`, `throw forbidden("message")`
3. **Drizzle queries** : `db.select().from().where(and(...))` avec `drizzle-orm` operators
4. **Live events** : `publishLiveEvent({ companyId, type: "...", payload: {...} })`
5. **Audit events** : `emitAudit(db, { companyId, actorId, actorType, action, targetType, targetId, metadata })`
6. **Tests** : Vitest avec `describe`/`it`/`expect`, factories depuis `@mnm/test-utils`
7. **Types partages** : dans `packages/shared/src/types/`, re-exportes dans index.ts
8. **Routes** : Express Router, middleware `requirePermission(key)`, Zod validation body

---

## Diagramme de Flux -- Lifecycle Container

### Diagramme ASCII

```
                        Agent Launch Request
                              |
                              v
                    +--------------------+
                    |  1. Resolve Profile |  (container_profiles DB)
                    |  (light/std/heavy) |
                    +--------+-----------+
                             |
                             v
                    +--------------------+
                    |  2. Create Instance |  (container_instances DB status="pending")
                    |  Record in DB      |
                    +--------+-----------+
                             |
                             v
                    +--------------------+
                    |  3. Docker Create   |  dockerode.createContainer(opts)
                    |  --rm --read-only  |  --no-new-privileges
                    |  resource limits   |  shadow .env -> /dev/null
                    +--------+-----------+
                             |
                             v
                    +--------------------+
                    |  4. Docker Start    |  container.start()
                    |  DB status="running"|  Update dockerContainerId
                    +--------+-----------+
                             |
                             v
                    +--------------------+
                    |  5. Monitor Loop    |  Poll container.inspect()
                    |  Timeout watchdog  |  Detect OOM (exit 137)
                    |  Live events emit  |  Resource usage tracking
                    +--------+-----------+
                             |
                  +----------+----------+
                  |                     |
                  v                     v
         +----------------+    +------------------+
         | Agent completes |    | Timeout/OOM/Error|
         | exitCode=0     |    | exitCode!=0      |
         +-------+--------+    +--------+---------+
                  |                     |
                  v                     v
         +------------------+  +-------------------+
         | 6a. Status="exited"|  | 6b. Status="failed"|
         | Collect logs      |  | Collect error      |
         +--------+---------+  +--------+----------+
                  |                     |
                  +----------+----------+
                             |
                             v
                    +--------------------+
                    |  7. Cleanup         |  container.remove() (if not --rm)
                    |  DB status="stopped"|  stoppedAt = now()
                    |  Emit audit event  |  resourceUsage final
                    +--------------------+
```

### Flux Detaille

```
Request: launchContainer(agentId, companyId, options?)
    |
    v
1. Load agent from DB
    |  -> notFound if missing
    |  -> forbidden if agent.companyId != companyId
    v
2. Resolve container profile
    |  a. agent.containerProfileId -> load specific profile
    |  b. No profile -> load company default profile (isDefault=true)
    |  c. No default -> use built-in "standard" profile
    v
3. Create container_instances record (status="pending")
    |  profileId, agentId, companyId
    v
4. Build Docker container options
    |  Image: from agent.adapterConfig.dockerImage or profile default
    |  HostConfig:
    |    Memory: profile.memoryMb * 1024 * 1024
    |    NanoCpus: profile.cpuMillicores * 1_000_000
    |    ReadonlyRootfs: true
    |    AutoRemove: true
    |    SecurityOpt: ["no-new-privileges"]
    |    Binds: ["/dev/null:/workspace/.env:ro"]  (shadow .env)
    |    Tmpfs: { "/tmp": "rw,noexec,nosuid,size=256m" }
    |  Env: MNM_AGENT_ID, MNM_RUN_ID, MNM_SERVER_URL, MNM_AGENT_JWT
    v
5. dockerode.createContainer(options)
    |  -> Store dockerContainerId in DB
    v
6. container.start()
    |  -> Update status="running", startedAt=now()
    |  -> publishLiveEvent({ type: "container.started", ... })
    |  -> emitAudit("container.started", ...)
    v
7. Start monitoring goroutine (setInterval)
    |  Every 5s: container.inspect() -> update resourceUsage in DB
    |  Check timeout: if elapsed > profile.timeoutSeconds -> graceful stop
    |  Check OOM: if State.OOMKilled -> mark as failed with OOM code
    v
8a. Normal exit (exitCode=0):
    |  -> Update status="exited", exitCode, stoppedAt
    |  -> publishLiveEvent({ type: "container.completed" })
    |  -> emitAudit("container.completed", ...)
    |
8b. Error exit (exitCode!=0):
    |  -> Update status="failed", exitCode, error, stoppedAt
    |  -> publishLiveEvent({ type: "container.failed" })
    |  -> emitAudit("container.failed", { exitCode, error })
    |
8c. Timeout:
    |  -> container.stop({ t: 10 }) (SIGTERM, wait 10s, then SIGKILL)
    |  -> Update status="failed", error="Timeout after Xs", stoppedAt
    |  -> publishLiveEvent({ type: "container.timeout" })
    |  -> emitAudit("container.timeout", ...)
    |
8d. OOM Kill (exit code 137):
    |  -> Update status="failed", exitCode=137, error="OOM killed"
    |  -> publishLiveEvent({ type: "container.oom" })
    |  -> emitAudit("container.oom", { profileId, memoryMb })
```

---

## Specification Technique Detaillee

### T1 : Types partages -- `packages/shared/src/types/container.ts`

```typescript
// Container instance statuses
export const CONTAINER_STATUSES = [
  "pending",    // Instance created in DB, Docker not yet called
  "creating",   // Docker container being created
  "running",    // Container started and executing
  "stopping",   // Graceful stop in progress (SIGTERM sent)
  "exited",     // Container exited normally (exitCode=0)
  "failed",     // Container exited with error (exitCode!=0, OOM, timeout)
  "stopped",    // Container manually stopped
] as const;
export type ContainerStatus = (typeof CONTAINER_STATUSES)[number];

// Predefined resource profiles
export const CONTAINER_PROFILE_PRESETS = {
  light:    { cpuMillicores: 500,  memoryMb: 256,  diskMb: 512,  timeoutSeconds: 1800 },
  standard: { cpuMillicores: 1000, memoryMb: 512,  diskMb: 1024, timeoutSeconds: 3600 },
  heavy:    { cpuMillicores: 2000, memoryMb: 1024, diskMb: 2048, timeoutSeconds: 7200 },
  gpu:      { cpuMillicores: 4000, memoryMb: 4096, diskMb: 4096, timeoutSeconds: 14400 },
} as const;
export type ContainerProfilePreset = keyof typeof CONTAINER_PROFILE_PRESETS;

// Container resource usage snapshot
export interface ContainerResourceUsage {
  cpuPercent: number;
  memoryUsedMb: number;
  memoryLimitMb: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  pidsCount: number;
  timestamp: string; // ISO 8601
}

// Container launch options
export interface ContainerLaunchOptions {
  profileId?: string;         // Use specific profile (overrides agent default)
  dockerImage?: string;       // Override image (default from adapterConfig)
  environmentVars?: Record<string, string>; // Additional env vars
  timeout?: number;           // Override timeout in seconds
  labels?: Record<string, string>; // Docker labels
}

// Container launch result
export interface ContainerLaunchResult {
  instanceId: string;         // container_instances.id
  dockerContainerId: string;  // Docker container ID
  status: ContainerStatus;
  profileName: string;
  agentId: string;
  startedAt: string;
}

// Container info (for API responses)
export interface ContainerInfo {
  id: string;
  agentId: string;
  agentName: string;
  profileId: string;
  profileName: string;
  dockerContainerId: string | null;
  status: ContainerStatus;
  exitCode: number | null;
  error: string | null;
  resourceUsage: ContainerResourceUsage | null;
  startedAt: string | null;
  stoppedAt: string | null;
  createdAt: string;
}

// Container stop options
export interface ContainerStopOptions {
  gracePeriodSeconds?: number; // Default 10s: SIGTERM, wait, then SIGKILL
  reason?: string;
}

// Live event types for containers
export const CONTAINER_EVENT_TYPES = [
  "container.created",
  "container.started",
  "container.completed",
  "container.failed",
  "container.timeout",
  "container.oom",
  "container.stopped",
  "container.resource_update",
] as const;
export type ContainerEventType = (typeof CONTAINER_EVENT_TYPES)[number];
```

**Re-export dans `packages/shared/src/types/index.ts`** :
```typescript
export * from "./container.js";
```

---

### T2 : ContainerManager Service -- `server/src/services/container-manager.ts`

#### Dependance

```bash
pnpm add dockerode --filter server
pnpm add -D @types/dockerode --filter server
```

#### Structure

```typescript
import Docker from "dockerode";
import { and, eq, inArray, desc } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { containerInstances, containerProfiles, agents } from "@mnm/db";
import type {
  ContainerStatus,
  ContainerLaunchOptions,
  ContainerLaunchResult,
  ContainerInfo,
  ContainerStopOptions,
  ContainerResourceUsage,
  CONTAINER_PROFILE_PRESETS,
} from "@mnm/shared";
import { notFound, conflict, forbidden, unprocessable } from "../errors.js";
import { publishLiveEvent } from "./live-events.js";
import { emitAudit } from "./audit-emitter.js";
import { createLocalAgentJwt } from "../agent-auth-jwt.js";
import { logger } from "../middleware/logger.js";

const DEFAULT_DOCKER_IMAGE = "node:20-slim";
const MONITOR_INTERVAL_MS = 5_000;       // 5 seconds
const DEFAULT_GRACE_PERIOD_SEC = 10;
const MAX_CONTAINERS_PER_COMPANY = 50;

// Track active monitors to allow cleanup
const activeMonitors = new Map<string, NodeJS.Timeout>();

export function containerManagerService(db: Db) {
  const docker = new Docker({ socketPath: "/var/run/docker.sock" });

  // ---- Health check ----

  async function checkDockerHealth(): Promise<{ available: boolean; version: string | null; error: string | null }> {
    try {
      const info = await docker.version();
      return { available: true, version: info.Version, error: null };
    } catch (err: any) {
      return { available: false, version: null, error: err.message };
    }
  }

  // ---- Launch Container ----

  async function launchContainer(
    agentId: string,
    companyId: string,
    actorId: string,
    options?: ContainerLaunchOptions,
  ): Promise<ContainerLaunchResult> {
    // 1. Load agent
    const [agent] = await db.select().from(agents).where(
      and(eq(agents.id, agentId), eq(agents.companyId, companyId))
    );
    if (!agent) throw notFound("Agent not found");

    // 2. Check company container limit
    const activeContainers = await db.select().from(containerInstances).where(
      and(
        eq(containerInstances.companyId, companyId),
        inArray(containerInstances.status, ["pending", "creating", "running"])
      )
    );
    if (activeContainers.length >= MAX_CONTAINERS_PER_COMPANY) {
      throw conflict(`Company has reached the maximum of ${MAX_CONTAINERS_PER_COMPANY} active containers`);
    }

    // 3. Resolve profile
    const profile = await resolveProfile(companyId, agent.containerProfileId, options?.profileId);

    // 4. Resolve image
    const dockerImage = options?.dockerImage
      ?? (agent.adapterConfig as Record<string, unknown>)?.dockerImage as string
      ?? DEFAULT_DOCKER_IMAGE;

    // 5. Create instance record
    const [instance] = await db.insert(containerInstances).values({
      companyId,
      profileId: profile.id,
      agentId,
      status: "pending",
    }).returning();

    try {
      // 6. Generate agent JWT for container
      const agentJwt = await createLocalAgentJwt(agentId, companyId);

      // 7. Build container options
      const containerOpts = buildDockerCreateOptions({
        instanceId: instance!.id,
        agentId,
        companyId,
        profile,
        dockerImage,
        agentJwt,
        additionalEnv: options?.environmentVars,
        labels: options?.labels,
        timeout: options?.timeout,
      });

      // 8. Update status to "creating"
      await updateInstanceStatus(instance!.id, "creating");

      // 9. Create Docker container
      const container = await docker.createContainer(containerOpts);
      const dockerContainerId = container.id;

      // 10. Update instance with Docker container ID
      await db.update(containerInstances)
        .set({ dockerContainerId, updatedAt: new Date() })
        .where(eq(containerInstances.id, instance!.id));

      // 11. Start container
      await container.start();
      const startedAt = new Date();

      // 12. Update status to "running"
      await db.update(containerInstances)
        .set({ status: "running", startedAt, updatedAt: new Date() })
        .where(eq(containerInstances.id, instance!.id));

      // 13. Emit events
      publishLiveEvent({
        companyId,
        type: "container.started",
        payload: {
          instanceId: instance!.id,
          agentId,
          dockerContainerId,
          profileName: profile.name,
        },
      });

      await emitAudit(db, {
        companyId,
        actorId,
        actorType: "user",
        action: "container.started",
        targetType: "container_instance",
        targetId: instance!.id,
        metadata: { agentId, profileName: profile.name, dockerImage },
      });

      // 14. Start monitoring
      const timeoutSeconds = options?.timeout ?? profile.timeoutSeconds;
      startMonitoring(instance!.id, dockerContainerId, companyId, agentId, timeoutSeconds);

      return {
        instanceId: instance!.id,
        dockerContainerId,
        status: "running",
        profileName: profile.name,
        agentId,
        startedAt: startedAt.toISOString(),
      };

    } catch (err: any) {
      // Failed to create/start -- update instance to failed
      await db.update(containerInstances)
        .set({
          status: "failed",
          error: err.message,
          stoppedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(containerInstances.id, instance!.id));

      publishLiveEvent({
        companyId,
        type: "container.failed",
        payload: {
          instanceId: instance!.id,
          agentId,
          error: err.message,
        },
      });

      throw conflict(`Failed to launch container: ${err.message}`);
    }
  }

  // ---- Stop Container ----

  async function stopContainer(
    instanceId: string,
    companyId: string,
    actorId: string,
    options?: ContainerStopOptions,
  ): Promise<void> {
    const [instance] = await db.select().from(containerInstances).where(
      and(eq(containerInstances.id, instanceId), eq(containerInstances.companyId, companyId))
    );
    if (!instance) throw notFound("Container instance not found");
    if (!["running", "creating"].includes(instance.status)) {
      throw conflict(`Cannot stop container in status "${instance.status}"`);
    }

    // Update status to "stopping"
    await updateInstanceStatus(instanceId, "stopping");

    // Stop monitoring
    stopMonitoring(instanceId);

    if (instance.dockerContainerId) {
      try {
        const container = docker.getContainer(instance.dockerContainerId);
        const gracePeriod = options?.gracePeriodSeconds ?? DEFAULT_GRACE_PERIOD_SEC;
        await container.stop({ t: gracePeriod });
      } catch (err: any) {
        // Container may already be stopped
        if (!err.message?.includes("is not running") && !err.message?.includes("No such container")) {
          logger.warn({ err, instanceId }, "Error stopping container");
        }
      }
    }

    await db.update(containerInstances)
      .set({
        status: "stopped",
        stoppedAt: new Date(),
        error: options?.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(containerInstances.id, instanceId));

    publishLiveEvent({
      companyId,
      type: "container.stopped",
      payload: { instanceId, agentId: instance.agentId, reason: options?.reason },
    });

    await emitAudit(db, {
      companyId,
      actorId,
      actorType: "user",
      action: "container.stopped",
      targetType: "container_instance",
      targetId: instanceId,
      metadata: { agentId: instance.agentId, reason: options?.reason },
    });
  }

  // ---- Get Status ----

  async function getContainerStatus(
    instanceId: string,
    companyId: string,
  ): Promise<ContainerInfo> {
    const results = await db
      .select({
        instance: containerInstances,
        profile: containerProfiles,
        agent: agents,
      })
      .from(containerInstances)
      .innerJoin(containerProfiles, eq(containerInstances.profileId, containerProfiles.id))
      .innerJoin(agents, eq(containerInstances.agentId, agents.id))
      .where(
        and(eq(containerInstances.id, instanceId), eq(containerInstances.companyId, companyId))
      );

    const row = results[0];
    if (!row) throw notFound("Container instance not found");

    return formatContainerInfo(row);
  }

  // ---- List Containers ----

  async function listContainers(
    companyId: string,
    filters?: { status?: ContainerStatus; agentId?: string },
  ): Promise<ContainerInfo[]> {
    const conditions = [eq(containerInstances.companyId, companyId)];
    if (filters?.status) {
      conditions.push(eq(containerInstances.status, filters.status));
    }
    if (filters?.agentId) {
      conditions.push(eq(containerInstances.agentId, filters.agentId));
    }

    const results = await db
      .select({
        instance: containerInstances,
        profile: containerProfiles,
        agent: agents,
      })
      .from(containerInstances)
      .innerJoin(containerProfiles, eq(containerInstances.profileId, containerProfiles.id))
      .innerJoin(agents, eq(containerInstances.agentId, agents.id))
      .where(and(...conditions))
      .orderBy(desc(containerInstances.createdAt));

    return results.map(formatContainerInfo);
  }

  // ---- Profile Management ----

  async function resolveProfile(
    companyId: string,
    agentProfileId: string | null,
    overrideProfileId?: string,
  ) {
    // Priority: override > agent config > company default > built-in standard
    const profileId = overrideProfileId ?? agentProfileId;

    if (profileId) {
      const [profile] = await db.select().from(containerProfiles).where(
        and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId))
      );
      if (profile) return profile;
    }

    // Fallback: company default
    const [defaultProfile] = await db.select().from(containerProfiles).where(
      and(eq(containerProfiles.companyId, companyId), eq(containerProfiles.isDefault, true))
    );
    if (defaultProfile) return defaultProfile;

    // Fallback: create a built-in standard profile
    const [created] = await db.insert(containerProfiles).values({
      companyId,
      name: "standard",
      description: "Default standard profile (auto-created)",
      cpuMillicores: 1000,
      memoryMb: 512,
      diskMb: 1024,
      timeoutSeconds: 3600,
      isDefault: true,
    }).returning();

    return created!;
  }

  async function listProfiles(companyId: string) {
    return db.select().from(containerProfiles).where(eq(containerProfiles.companyId, companyId));
  }

  async function createProfile(companyId: string, data: {
    name: string;
    description?: string;
    cpuMillicores?: number;
    memoryMb?: number;
    diskMb?: number;
    timeoutSeconds?: number;
    gpuEnabled?: boolean;
    networkPolicy?: string;
    isDefault?: boolean;
  }) {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db.update(containerProfiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(containerProfiles.companyId, companyId), eq(containerProfiles.isDefault, true)));
    }

    const [profile] = await db.insert(containerProfiles).values({
      companyId,
      ...data,
    }).returning();

    return profile!;
  }

  // ---- Monitoring ----

  function startMonitoring(
    instanceId: string,
    dockerContainerId: string,
    companyId: string,
    agentId: string,
    timeoutSeconds: number,
  ): void {
    const startTime = Date.now();

    const interval = setInterval(async () => {
      try {
        const container = docker.getContainer(dockerContainerId);
        const inspection = await container.inspect();
        const state = inspection.State;

        if (!state.Running) {
          // Container has exited
          clearInterval(interval);
          activeMonitors.delete(instanceId);

          const exitCode = state.ExitCode;
          const oomKilled = state.OOMKilled;
          const isSuccess = exitCode === 0 && !oomKilled;

          const status: ContainerStatus = isSuccess ? "exited" : "failed";
          let error: string | null = null;

          if (oomKilled) {
            error = `OOM killed (exit code ${exitCode}). Consider upgrading to a larger profile.`;
            publishLiveEvent({
              companyId,
              type: "container.oom",
              payload: { instanceId, agentId, exitCode },
            });
            await emitAudit(db, {
              companyId, actorId: agentId, actorType: "agent",
              action: "container.oom",
              targetType: "container_instance", targetId: instanceId,
              metadata: { exitCode },
            });
          } else if (!isSuccess) {
            error = `Process exited with code ${exitCode}`;
          }

          await db.update(containerInstances)
            .set({
              status,
              exitCode,
              error,
              stoppedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(containerInstances.id, instanceId));

          const eventType = isSuccess ? "container.completed" : "container.failed";
          publishLiveEvent({
            companyId,
            type: eventType,
            payload: { instanceId, agentId, exitCode, error },
          });

          return;
        }

        // Container is still running -- check timeout
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        if (timeoutSeconds > 0 && elapsedSeconds > timeoutSeconds) {
          clearInterval(interval);
          activeMonitors.delete(instanceId);

          logger.warn({ instanceId, agentId, elapsedSeconds, timeoutSeconds }, "Container timeout");

          // Graceful stop
          try {
            await container.stop({ t: DEFAULT_GRACE_PERIOD_SEC });
          } catch (err: any) {
            logger.warn({ err, instanceId }, "Error stopping timed out container");
          }

          await db.update(containerInstances)
            .set({
              status: "failed",
              error: `Timeout after ${timeoutSeconds}s`,
              stoppedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(containerInstances.id, instanceId));

          publishLiveEvent({
            companyId,
            type: "container.timeout",
            payload: { instanceId, agentId, timeoutSeconds },
          });

          await emitAudit(db, {
            companyId, actorId: "system", actorType: "system",
            action: "container.timeout",
            targetType: "container_instance", targetId: instanceId,
            metadata: { agentId, timeoutSeconds, elapsedSeconds },
          });

          return;
        }

        // Update resource usage
        try {
          const stats = await container.stats({ stream: false });
          const resourceUsage = parseDockerStats(stats);

          await db.update(containerInstances)
            .set({ resourceUsage, updatedAt: new Date() })
            .where(eq(containerInstances.id, instanceId));
        } catch {
          // Stats may fail briefly -- non-critical
        }

      } catch (err: any) {
        // Container disappeared -- mark as failed
        clearInterval(interval);
        activeMonitors.delete(instanceId);

        await db.update(containerInstances)
          .set({
            status: "failed",
            error: `Monitoring error: ${err.message}`,
            stoppedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(containerInstances.id, instanceId));

        publishLiveEvent({
          companyId,
          type: "container.failed",
          payload: { instanceId, agentId, error: err.message },
        });
      }
    }, MONITOR_INTERVAL_MS);

    activeMonitors.set(instanceId, interval);
  }

  function stopMonitoring(instanceId: string): void {
    const interval = activeMonitors.get(instanceId);
    if (interval) {
      clearInterval(interval);
      activeMonitors.delete(instanceId);
    }
  }

  // ---- Cleanup stale containers on startup ----

  async function cleanupStaleContainers(): Promise<number> {
    // Find instances that are "running" or "creating" in DB but may not be running in Docker
    const staleInstances = await db.select().from(containerInstances).where(
      inArray(containerInstances.status, ["running", "creating", "pending"])
    );

    let cleaned = 0;
    for (const instance of staleInstances) {
      if (instance.dockerContainerId) {
        try {
          const container = docker.getContainer(instance.dockerContainerId);
          const info = await container.inspect();
          if (!info.State.Running) {
            await db.update(containerInstances)
              .set({
                status: "failed",
                error: "Found not running during startup cleanup",
                stoppedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(containerInstances.id, instance.id));
            cleaned++;
          }
        } catch {
          // Container doesn't exist in Docker anymore
          await db.update(containerInstances)
            .set({
              status: "failed",
              error: "Container not found during startup cleanup",
              stoppedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(containerInstances.id, instance.id));
          cleaned++;
        }
      } else {
        // No Docker container ID -- was never created
        await db.update(containerInstances)
          .set({
            status: "failed",
            error: "Never started (stale pending)",
            stoppedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(containerInstances.id, instance.id));
        cleaned++;
      }
    }

    return cleaned;
  }

  // ---- Helpers ----

  async function updateInstanceStatus(instanceId: string, status: ContainerStatus) {
    await db.update(containerInstances)
      .set({ status, updatedAt: new Date() })
      .where(eq(containerInstances.id, instanceId));
  }

  function formatContainerInfo(row: {
    instance: typeof containerInstances.$inferSelect;
    profile: typeof containerProfiles.$inferSelect;
    agent: typeof agents.$inferSelect;
  }): ContainerInfo {
    return {
      id: row.instance.id,
      agentId: row.instance.agentId,
      agentName: row.agent.name,
      profileId: row.instance.profileId,
      profileName: row.profile.name,
      dockerContainerId: row.instance.dockerContainerId,
      status: row.instance.status as ContainerStatus,
      exitCode: row.instance.exitCode,
      error: row.instance.error,
      resourceUsage: row.instance.resourceUsage as ContainerResourceUsage | null,
      startedAt: row.instance.startedAt?.toISOString() ?? null,
      stoppedAt: row.instance.stoppedAt?.toISOString() ?? null,
      createdAt: row.instance.createdAt.toISOString(),
    };
  }

  return {
    checkDockerHealth,
    launchContainer,
    stopContainer,
    getContainerStatus,
    listContainers,
    resolveProfile,
    listProfiles,
    createProfile,
    cleanupStaleContainers,
    stopMonitoring,
  };
}

// ---- Pure utility functions (exported for testing) ----

export function buildDockerCreateOptions(input: {
  instanceId: string;
  agentId: string;
  companyId: string;
  profile: typeof containerProfiles.$inferSelect;
  dockerImage: string;
  agentJwt: string;
  additionalEnv?: Record<string, string>;
  labels?: Record<string, string>;
  timeout?: number;
}): Docker.ContainerCreateOptions {
  const { instanceId, agentId, companyId, profile, dockerImage, agentJwt, additionalEnv, labels } = input;

  const env: string[] = [
    `MNM_AGENT_ID=${agentId}`,
    `MNM_COMPANY_ID=${companyId}`,
    `MNM_INSTANCE_ID=${instanceId}`,
    `MNM_AGENT_JWT=${agentJwt}`,
    `MNM_SERVER_URL=${process.env.MNM_SERVER_URL ?? "http://host.docker.internal:3000"}`,
  ];

  if (additionalEnv) {
    for (const [key, value] of Object.entries(additionalEnv)) {
      env.push(`${key}=${value}`);
    }
  }

  return {
    Image: dockerImage,
    Env: env,
    Labels: {
      "mnm.agent_id": agentId,
      "mnm.company_id": companyId,
      "mnm.instance_id": instanceId,
      "mnm.profile": profile.name,
      ...labels,
    },
    HostConfig: {
      AutoRemove: true,
      ReadonlyRootfs: true,
      SecurityOpt: ["no-new-privileges"],
      Memory: profile.memoryMb * 1024 * 1024,
      NanoCpus: profile.cpuMillicores * 1_000_000,
      CpuPeriod: 100000,
      PidsLimit: 256,
      Binds: [
        "/dev/null:/workspace/.env:ro", // Shadow .env
      ],
      Tmpfs: {
        "/tmp": "rw,noexec,nosuid,size=256m",
      },
    },
  };
}

export function parseDockerStats(stats: Docker.ContainerStats): ContainerResourceUsage {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats?.system_cpu_usage ?? 0);
  const numCpus = stats.cpu_stats.online_cpus ?? 1;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

  const memoryUsed = stats.memory_stats.usage ?? 0;
  const memoryLimit = stats.memory_stats.limit ?? 1;
  const cache = (stats.memory_stats.stats as Record<string, number>)?.cache ?? 0;
  const memoryUsedMb = (memoryUsed - cache) / (1024 * 1024);
  const memoryLimitMb = memoryLimit / (1024 * 1024);

  let networkRxBytes = 0;
  let networkTxBytes = 0;
  if (stats.networks) {
    for (const iface of Object.values(stats.networks)) {
      networkRxBytes += (iface as { rx_bytes?: number }).rx_bytes ?? 0;
      networkTxBytes += (iface as { tx_bytes?: number }).tx_bytes ?? 0;
    }
  }

  return {
    cpuPercent: Math.round(cpuPercent * 100) / 100,
    memoryUsedMb: Math.round(memoryUsedMb * 100) / 100,
    memoryLimitMb: Math.round(memoryLimitMb),
    memoryPercent: Math.round((memoryUsedMb / memoryLimitMb) * 100 * 100) / 100,
    networkRxBytes,
    networkTxBytes,
    pidsCount: stats.pids_stats?.current ?? 0,
    timestamp: new Date().toISOString(),
  };
}
```

---

### T3 : Docker Adapter -- `server/src/adapters/docker/`

#### `server/src/adapters/docker/index.ts`

```typescript
import type { ServerAdapterModule } from "@mnm/adapter-utils";
import { execute } from "./execute.js";
import { testConnection } from "./test.js";

export default {
  execute,
  test: testConnection,
} satisfies ServerAdapterModule;
```

#### `server/src/adapters/docker/execute.ts`

```typescript
import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { containerManagerService } from "../../services/container-manager.js";
import { getDb } from "../../db.js";
import { asString, parseObject } from "../utils.js";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, onLog, onMeta } = ctx;
  const db = getDb();
  const containerManager = containerManagerService(db);

  const dockerImage = asString(config.dockerImage, "node:20-slim");
  const companyId = agent.companyId;
  const agentId = agent.id;

  if (onMeta) {
    await onMeta({
      adapterType: "docker",
      dockerImage,
      agentId,
      companyId,
    });
  }

  try {
    const result = await containerManager.launchContainer(agentId, companyId, "system", {
      dockerImage,
      environmentVars: parseObject(config.env) as Record<string, string>,
    });

    if (onLog) {
      await onLog(`Container started: ${result.dockerContainerId} (profile: ${result.profileName})\n`);
    }

    // The container runs asynchronously -- the adapter returns immediately
    // The monitoring loop in ContainerManager handles completion/failure
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      resultJson: {
        instanceId: result.instanceId,
        dockerContainerId: result.dockerContainerId,
        status: result.status,
      },
    };
  } catch (err: any) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Docker adapter error: ${err.message}`,
    };
  }
}
```

#### `server/src/adapters/docker/test.ts`

```typescript
import type { AdapterEnvironmentTestContext, AdapterEnvironmentTestResult } from "../types.js";
import Docker from "dockerode";

export async function testConnection(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  try {
    const docker = new Docker({ socketPath: "/var/run/docker.sock" });
    const version = await docker.version();
    return {
      status: "ok",
      details: {
        dockerVersion: version.Version,
        apiVersion: version.ApiVersion,
        os: version.Os,
        arch: version.Arch,
      },
    };
  } catch (err: any) {
    return {
      status: "error",
      details: {
        error: err.message,
        hint: "Ensure Docker daemon is running and /var/run/docker.sock is accessible",
      },
    };
  }
}
```

---

### T4 : Registry Integration -- `server/src/adapters/registry.ts`

Ajouter l'adapter "docker" au registry existant :

```typescript
// Dans le mapping des adapters, ajouter :
case "docker":
  return import("./docker/index.js").then((m) => m.default);
```

---

### T5 : API Routes -- `server/src/routes/containers.ts`

```typescript
import { Router } from "express";
import { z } from "zod";
import { containerManagerService } from "../services/container-manager.js";
import { requirePermission } from "../middleware/auth.js";
import { getDb } from "../db.js";

const router = Router();

// POST /api/containers/launch
const launchSchema = z.object({
  agentId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  dockerImage: z.string().optional(),
  environmentVars: z.record(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
});

router.post(
  "/launch",
  requirePermission("agents.launch"),
  async (req, res) => {
    const body = launchSchema.parse(req.body);
    const db = getDb();
    const manager = containerManagerService(db);
    const result = await manager.launchContainer(
      body.agentId,
      req.companyId,
      req.userId,
      {
        profileId: body.profileId,
        dockerImage: body.dockerImage,
        environmentVars: body.environmentVars,
        timeout: body.timeout,
      },
    );
    res.status(201).json(result);
  },
);

// GET /api/containers/:id/status
router.get(
  "/:id/status",
  requirePermission("agents.launch"),
  async (req, res) => {
    const db = getDb();
    const manager = containerManagerService(db);
    const info = await manager.getContainerStatus(req.params.id, req.companyId);
    res.json(info);
  },
);

// POST /api/containers/:id/stop
const stopSchema = z.object({
  gracePeriodSeconds: z.number().int().positive().max(60).optional(),
  reason: z.string().max(500).optional(),
});

router.post(
  "/:id/stop",
  requirePermission("agents.configure"),
  async (req, res) => {
    const body = stopSchema.parse(req.body);
    const db = getDb();
    const manager = containerManagerService(db);
    await manager.stopContainer(req.params.id, req.companyId, req.userId, body);
    res.json({ status: "stopped" });
  },
);

// GET /api/containers
const listSchema = z.object({
  status: z.string().optional(),
  agentId: z.string().uuid().optional(),
});

router.get(
  "/",
  requirePermission("agents.launch"),
  async (req, res) => {
    const query = listSchema.parse(req.query);
    const db = getDb();
    const manager = containerManagerService(db);
    const containers = await manager.listContainers(req.companyId, query);
    res.json({ containers });
  },
);

// GET /api/containers/profiles
router.get(
  "/profiles",
  requirePermission("agents.configure"),
  async (req, res) => {
    const db = getDb();
    const manager = containerManagerService(db);
    const profiles = await manager.listProfiles(req.companyId);
    res.json({ profiles });
  },
);

// POST /api/containers/profiles
const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  cpuMillicores: z.number().int().min(100).max(16000).optional(),
  memoryMb: z.number().int().min(64).max(32768).optional(),
  diskMb: z.number().int().min(128).max(65536).optional(),
  timeoutSeconds: z.number().int().min(60).max(86400).optional(),
  gpuEnabled: z.boolean().optional(),
  networkPolicy: z.string().optional(),
  isDefault: z.boolean().optional(),
});

router.post(
  "/profiles",
  requirePermission("agents.configure"),
  async (req, res) => {
    const body = createProfileSchema.parse(req.body);
    const db = getDb();
    const manager = containerManagerService(db);
    const profile = await manager.createProfile(req.companyId, body);
    res.status(201).json(profile);
  },
);

// GET /api/containers/health
router.get(
  "/health",
  requirePermission("agents.configure"),
  async (req, res) => {
    const db = getDb();
    const manager = containerManagerService(db);
    const health = await manager.checkDockerHealth();
    res.json(health);
  },
);

export default router;
```

**Registration dans `server/src/routes/index.ts`** :

```typescript
import containersRouter from "./containers.js";
// ...
app.use("/api/containers", containersRouter);
```

---

### T6 : Integration HeartbeatService

Modifier `server/src/services/heartbeat.ts` pour detecter quand un agent a `isolationMode === "container"` et deleguer au Docker adapter au lieu du process adapter :

```typescript
// Dans la logique de resolution de l'adapter, ajouter :
const effectiveAdapterType = agent.isolationMode === "container"
  ? "docker"
  : agent.adapterType;

// Utiliser effectiveAdapterType pour getServerAdapter()
```

Cela permet de basculer un agent en mode container simplement en changeant `isolationMode` dans la table `agents` -- sans changer le `adapterType`.

---

### T7 : Export dans `server/src/services/index.ts`

```typescript
export { containerManagerService } from "./container-manager.js";
```

---

## Acceptance Criteria

### AC-01 : Container Docker cree avec profil standard

```
Given un agent avec profil "standard" (1 CPU, 512MB)
When un user avec permission "agents.launch" appelle POST /api/containers/launch
Then un container Docker est cree avec les flags --rm --read-only --no-new-privileges
And les limites de ressources correspondent au profil (NanoCpus=1000000000, Memory=536870912)
And un record container_instances est cree avec status="running"
And un audit_event "container.started" est emis
```

### AC-02 : Container detruit automatiquement apres terminaison

```
Given un container Docker en execution
When l'agent termine (exitCode=0)
Then le container est automatiquement supprime (--rm flag)
And le record container_instances passe a status="exited"
And stoppedAt est renseigne
And un evenement "container.completed" est publie via publishLiveEvent
```

### AC-03 : Startup container operationnel en moins de 10 secondes

```
Given un agent avec profil "standard"
When le container est lance
Then le container est en status="running" en moins de 10 secondes
And le timing est mesurable via la difference createdAt/startedAt
```

### AC-04 : Shadow .env empechant l'acces aux secrets

```
Given un container Docker cree par le ContainerManager
When le container tente de lire /workspace/.env
Then le fichier est /dev/null (mount bind ro)
And aucune variable d'environnement du serveur parent n'est heritee
And seules les variables MNM_* injectees explicitement sont presentes
```

### AC-05 : Timeout avec SIGTERM puis SIGKILL

```
Given un container dont le profil a timeoutSeconds=60
When le container depasse 60 secondes d'execution
Then un SIGTERM est envoye au container
And le container a 10 secondes pour s'arreter proprement (grace period)
And si le container ne s'arrete pas, un SIGKILL est envoye
And le status passe a "failed" avec error="Timeout after 60s"
And un audit_event "container.timeout" est emis
```

### AC-06 : Detection OOM kill

```
Given un container avec memoryMb=256
When l'agent consomme plus de 256MB de RAM
Then Docker kill le container (OOM, exit code 137)
And le ContainerManager detecte le OOM via inspection
And le status passe a "failed" avec error="OOM killed..."
And un evenement "container.oom" est publie
And un audit_event "container.oom" est emis avec metadata profileId et memoryMb
```

### AC-07 : Stop manuel avec grace period

```
Given un container en status="running"
When un user avec permission "agents.configure" appelle POST /api/containers/:id/stop
Then le status passe a "stopping" puis "stopped"
And un SIGTERM est envoye au container
And apres gracePeriodSeconds (defaut 10s), un SIGKILL est envoye si necessaire
And un audit_event "container.stopped" est emis avec la reason
```

### AC-08 : Limite de containers par company

```
Given une company avec 50 containers actifs (status running/creating/pending)
When un user tente de lancer un 51eme container
Then la requete est rejetee avec 409 Conflict
And le message indique "Company has reached the maximum of 50 active containers"
```

### AC-09 : Resource usage tracking

```
Given un container en execution
When le monitoring loop s'execute (toutes les 5s)
Then le resourceUsage JSONB est mis a jour dans container_instances
And il contient cpuPercent, memoryUsedMb, memoryLimitMb, memoryPercent, networkRxBytes, networkTxBytes, pidsCount
```

### AC-10 : Docker health check

```
Given le service ContainerManager
When GET /api/containers/health est appele
Then le endpoint retourne { available: true/false, version: "...", error: null/"..." }
And si Docker daemon n'est pas accessible, available=false avec le message d'erreur
```

### AC-11 : Profile resolution cascade

```
Given un agent avec containerProfileId=null
And une company avec un profil isDefault=true nomme "heavy"
When le container est lance sans profileId explicite
Then le profil "heavy" de la company est utilise
And si aucun profil default n'existe, un profil "standard" est auto-cree
```

### AC-12 : RBAC enforcement sur les routes

```
Given un user avec le role "viewer" (sans permission "agents.launch")
When il appelle POST /api/containers/launch
Then il recoit 403 Forbidden
And le body contient { error: "PERMISSION_DENIED", requiredPermission: "agents.launch" }

Given un user avec le role "contributor" (permission "agents.launch")
When il appelle POST /api/containers/launch avec un agentId valide
Then le container est lance avec succes (201)
```

### AC-13 : Cleanup containers stales au startup

```
Given des container_instances en status="running" dans la DB
And les containers Docker correspondants n'existent plus
When le serveur demarre et appelle cleanupStaleContainers()
Then ces instances passent a status="failed" avec error="Container not found during startup cleanup"
And stoppedAt est renseigne
```

### AC-14 : List containers avec filtres

```
Given 5 containers pour un agent "alpha" (3 running, 2 exited) et 2 pour "beta" (running)
When GET /api/containers?status=running&agentId=<alpha-id>
Then seuls les 3 containers running de "alpha" sont retournes
And chaque container inclut agentName, profileName, status, resourceUsage
```

### AC-15 : Docker adapter dans le registry

```
Given un agent avec isolationMode="container"
When le heartbeat service resout l'adapter
Then le Docker adapter est utilise au lieu du process adapter
And le container est lance via le ContainerManager
```

---

## data-test-id Mapping

Cette story est backend-only. Les data-test-id ci-dessous sont pour les tests E2E qui verifient les fichiers sources et le comportement API.

| # | data-testid | Element | Fichier |
|---|-------------|---------|---------|
| 1 | `cont-s01-container-manager-file` | Existence du fichier container-manager.ts | server/src/services/container-manager.ts |
| 2 | `cont-s01-docker-adapter-file` | Existence du fichier docker adapter index.ts | server/src/adapters/docker/index.ts |
| 3 | `cont-s01-docker-execute-file` | Existence du fichier docker execute.ts | server/src/adapters/docker/execute.ts |
| 4 | `cont-s01-docker-test-file` | Existence du fichier docker test.ts | server/src/adapters/docker/test.ts |
| 5 | `cont-s01-routes-file` | Existence du fichier containers routes | server/src/routes/containers.ts |
| 6 | `cont-s01-types-file` | Existence du fichier types container.ts | packages/shared/src/types/container.ts |
| 7 | `cont-s01-container-statuses` | 7 statuts definis dans CONTAINER_STATUSES | packages/shared/src/types/container.ts |
| 8 | `cont-s01-profile-presets` | 4 presets definis dans CONTAINER_PROFILE_PRESETS | packages/shared/src/types/container.ts |
| 9 | `cont-s01-event-types` | 8 types d'evenements dans CONTAINER_EVENT_TYPES | packages/shared/src/types/container.ts |
| 10 | `cont-s01-dockerode-dep` | Dependance dockerode dans server/package.json | server/package.json |
| 11 | `cont-s01-launch-fn` | Fonction launchContainer exportee | server/src/services/container-manager.ts |
| 12 | `cont-s01-stop-fn` | Fonction stopContainer exportee | server/src/services/container-manager.ts |
| 13 | `cont-s01-status-fn` | Fonction getContainerStatus exportee | server/src/services/container-manager.ts |
| 14 | `cont-s01-list-fn` | Fonction listContainers exportee | server/src/services/container-manager.ts |
| 15 | `cont-s01-health-fn` | Fonction checkDockerHealth exportee | server/src/services/container-manager.ts |
| 16 | `cont-s01-cleanup-fn` | Fonction cleanupStaleContainers exportee | server/src/services/container-manager.ts |
| 17 | `cont-s01-build-opts-fn` | Fonction buildDockerCreateOptions exportee | server/src/services/container-manager.ts |
| 18 | `cont-s01-parse-stats-fn` | Fonction parseDockerStats exportee | server/src/services/container-manager.ts |
| 19 | `cont-s01-rm-flag` | Flag AutoRemove=true dans les options Docker | server/src/services/container-manager.ts |
| 20 | `cont-s01-readonly-flag` | Flag ReadonlyRootfs=true dans les options Docker | server/src/services/container-manager.ts |
| 21 | `cont-s01-no-new-privs-flag` | SecurityOpt ["no-new-privileges"] dans les options | server/src/services/container-manager.ts |
| 22 | `cont-s01-shadow-env` | Mount /dev/null sur /workspace/.env | server/src/services/container-manager.ts |
| 23 | `cont-s01-memory-limit` | Memory limit dans HostConfig (profile.memoryMb * 1024 * 1024) | server/src/services/container-manager.ts |
| 24 | `cont-s01-cpu-limit` | NanoCpus limit dans HostConfig (profile.cpuMillicores * 1_000_000) | server/src/services/container-manager.ts |
| 25 | `cont-s01-pids-limit` | PidsLimit=256 dans HostConfig | server/src/services/container-manager.ts |
| 26 | `cont-s01-tmpfs-mount` | Tmpfs /tmp mount dans HostConfig | server/src/services/container-manager.ts |
| 27 | `cont-s01-mnm-env-vars` | Variables MNM_AGENT_ID, MNM_COMPANY_ID, MNM_INSTANCE_ID, MNM_AGENT_JWT, MNM_SERVER_URL | server/src/services/container-manager.ts |
| 28 | `cont-s01-docker-labels` | Labels mnm.agent_id, mnm.company_id, mnm.instance_id, mnm.profile | server/src/services/container-manager.ts |
| 29 | `cont-s01-monitor-interval` | MONITOR_INTERVAL_MS = 5000 (5s) | server/src/services/container-manager.ts |
| 30 | `cont-s01-max-containers` | MAX_CONTAINERS_PER_COMPANY = 50 | server/src/services/container-manager.ts |
| 31 | `cont-s01-grace-period` | DEFAULT_GRACE_PERIOD_SEC = 10 | server/src/services/container-manager.ts |
| 32 | `cont-s01-timeout-detection` | Detection timeout dans monitoring loop | server/src/services/container-manager.ts |
| 33 | `cont-s01-oom-detection` | Detection OOM (State.OOMKilled) dans monitoring | server/src/services/container-manager.ts |
| 34 | `cont-s01-resource-usage-update` | Update resourceUsage JSONB dans monitoring | server/src/services/container-manager.ts |
| 35 | `cont-s01-publish-events` | publishLiveEvent appele pour started/completed/failed/timeout/oom/stopped | server/src/services/container-manager.ts |
| 36 | `cont-s01-audit-events` | emitAudit appele pour started/stopped/timeout/oom | server/src/services/container-manager.ts |
| 37 | `cont-s01-route-launch` | POST /api/containers/launch avec requirePermission("agents.launch") | server/src/routes/containers.ts |
| 38 | `cont-s01-route-status` | GET /api/containers/:id/status avec requirePermission("agents.launch") | server/src/routes/containers.ts |
| 39 | `cont-s01-route-stop` | POST /api/containers/:id/stop avec requirePermission("agents.configure") | server/src/routes/containers.ts |
| 40 | `cont-s01-route-list` | GET /api/containers avec requirePermission("agents.launch") | server/src/routes/containers.ts |
| 41 | `cont-s01-route-profiles-list` | GET /api/containers/profiles avec requirePermission("agents.configure") | server/src/routes/containers.ts |
| 42 | `cont-s01-route-profiles-create` | POST /api/containers/profiles avec requirePermission("agents.configure") | server/src/routes/containers.ts |
| 43 | `cont-s01-route-health` | GET /api/containers/health avec requirePermission("agents.configure") | server/src/routes/containers.ts |
| 44 | `cont-s01-zod-launch-schema` | Schema Zod validation pour le body de launch | server/src/routes/containers.ts |
| 45 | `cont-s01-zod-stop-schema` | Schema Zod validation pour le body de stop | server/src/routes/containers.ts |
| 46 | `cont-s01-zod-profile-schema` | Schema Zod validation pour le body de create profile | server/src/routes/containers.ts |
| 47 | `cont-s01-service-export` | containerManagerService exporte dans index.ts | server/src/services/index.ts |
| 48 | `cont-s01-types-export` | Types container re-exportes dans shared/types/index.ts | packages/shared/src/types/index.ts |
| 49 | `cont-s01-adapter-registry` | Adapter "docker" enregistre dans le registry | server/src/adapters/registry.ts |
| 50 | `cont-s01-isolation-mode-check` | isolationMode="container" detecte dans heartbeat.ts | server/src/services/heartbeat.ts |
| 51 | `cont-s01-profile-cascade` | resolveProfile cascade: override > agent > company default > auto-create | server/src/services/container-manager.ts |
| 52 | `cont-s01-stale-cleanup` | cleanupStaleContainers marque les orphelins comme failed | server/src/services/container-manager.ts |
| 53 | `cont-s01-route-registration` | Router monte sur /api/containers dans routes/index.ts | server/src/routes/index.ts |

---

## Plan de Tests

### Fichier : `server/src/__tests__/container-manager.test.ts`

#### Tests du service ContainerManager

| # | Test | Expected |
|---|------|----------|
| 1 | launchContainer cree un record container_instances avec status pending puis running | status transitions: pending -> creating -> running |
| 2 | launchContainer genere les options Docker avec --rm, --read-only, --no-new-privileges | AutoRemove, ReadonlyRootfs, SecurityOpt verifies |
| 3 | launchContainer applique les limites de ressources du profil | Memory, NanoCpus, PidsLimit corrects |
| 4 | launchContainer mount /dev/null sur /workspace/.env | Binds contient "/dev/null:/workspace/.env:ro" |
| 5 | launchContainer injecte les variables MNM_* | MNM_AGENT_ID, MNM_COMPANY_ID, MNM_INSTANCE_ID, MNM_AGENT_JWT, MNM_SERVER_URL |
| 6 | launchContainer emet publishLiveEvent "container.started" | Event publie avec instanceId, agentId, dockerContainerId |
| 7 | launchContainer emet emitAudit "container.started" | Audit event emis avec metadata |
| 8 | launchContainer refuse si agent non trouve | throw notFound |
| 9 | launchContainer refuse si limite containers atteinte (50) | throw conflict |
| 10 | launchContainer fallback sur profil default si pas de profileId | company default ou auto-create "standard" |
| 11 | stopContainer envoie SIGTERM puis SIGKILL apres grace period | container.stop({ t: gracePeriod }) appele |
| 12 | stopContainer refuse si status != running | throw conflict |
| 13 | stopContainer emet audit et live events | container.stopped events emis |
| 14 | getContainerStatus retourne ContainerInfo complet | agentName, profileName, status, resourceUsage inclus |
| 15 | getContainerStatus refuse si instance non trouvee | throw notFound |
| 16 | listContainers filtre par status et agentId | WHERE conditions correctes |
| 17 | listContainers ordonne par createdAt desc | Ordre descending verifie |
| 18 | checkDockerHealth retourne available=true si Docker repond | Version et ApiVersion inclus |
| 19 | checkDockerHealth retourne available=false si Docker indisponible | Error message inclus |
| 20 | cleanupStaleContainers marque les orphelins comme failed | status=failed, error renseigne, stoppedAt renseigne |

#### Tests de buildDockerCreateOptions (pure function)

| # | Test | Expected |
|---|------|----------|
| 21 | Genere Image correctement | Image = dockerImage input |
| 22 | Genere Env avec toutes les variables MNM_* | 5 variables MNM_* presentes |
| 23 | Ajoute additionalEnv si fourni | Variables supplementaires presentes |
| 24 | Genere Labels mnm.* | 4 labels mnm.* presents |
| 25 | HostConfig contient AutoRemove=true | Verifie |
| 26 | HostConfig contient ReadonlyRootfs=true | Verifie |
| 27 | HostConfig contient SecurityOpt ["no-new-privileges"] | Verifie |
| 28 | Memory = profile.memoryMb * 1024 * 1024 | Calcul correct (512MB = 536870912) |
| 29 | NanoCpus = profile.cpuMillicores * 1_000_000 | Calcul correct (1000 = 1000000000) |
| 30 | PidsLimit = 256 | Verifie |
| 31 | Binds contient shadow .env | "/dev/null:/workspace/.env:ro" |
| 32 | Tmpfs contient /tmp | "rw,noexec,nosuid,size=256m" |

#### Tests de parseDockerStats (pure function)

| # | Test | Expected |
|---|------|----------|
| 33 | Calcule cpuPercent correctement | Delta CPU / Delta system * numCpus * 100 |
| 34 | Calcule memoryUsedMb (usage - cache) | Soustraction cache, conversion MB |
| 35 | Calcule memoryPercent | (usedMb / limitMb) * 100 |
| 36 | Somme networkRxBytes de toutes les interfaces | Total correct |
| 37 | Somme networkTxBytes de toutes les interfaces | Total correct |
| 38 | pidsCount depuis pids_stats.current | Valeur correcte |
| 39 | Retourne 0% CPU si systemDelta=0 | Pas de division par zero |

#### Tests monitoring (integration mock)

| # | Test | Expected |
|---|------|----------|
| 40 | Monitoring detecte container exit normal (exitCode=0) | status=exited, publishLiveEvent container.completed |
| 41 | Monitoring detecte OOM kill (State.OOMKilled=true) | status=failed, error contient "OOM", event container.oom |
| 42 | Monitoring detecte timeout | container.stop appele, status=failed, error contient "Timeout", event container.timeout |
| 43 | Monitoring met a jour resourceUsage | JSONB mis a jour avec cpuPercent, memoryUsedMb, etc. |
| 44 | Monitoring gere la disparition du container | status=failed, error contient "Monitoring error" |
| 45 | stopMonitoring arrete le polling | clearInterval appele, activeMonitors vide |

### Fichier : `server/src/__tests__/docker-adapter.test.ts`

#### Tests du Docker adapter

| # | Test | Expected |
|---|------|----------|
| 46 | execute appelle containerManager.launchContainer | Appel avec agentId, companyId |
| 47 | execute retourne exitCode=0 avec instanceId | resultJson contient instanceId, dockerContainerId |
| 48 | execute retourne exitCode=1 sur erreur | errorMessage contient le message d'erreur |
| 49 | testConnection retourne status=ok si Docker disponible | dockerVersion, apiVersion dans details |
| 50 | testConnection retourne status=error si Docker indisponible | error et hint dans details |

### Couverture cible

| Module | Couverture cible |
|--------|-----------------|
| `container-manager.ts` (service functions) | >= 90% |
| `container-manager.ts` (buildDockerCreateOptions) | >= 95% |
| `container-manager.ts` (parseDockerStats) | >= 95% |
| `docker/execute.ts` | >= 85% |
| `docker/test.ts` | >= 90% |
| `containers.ts` (routes) | >= 85% |
| Types `container.ts` (shared) | 100% |

---

## Schema de Donnees

### Table `container_profiles` (existante -- TECH-06)

```sql
-- Colonnes existantes (utilisees telles quelles) :
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
company_id      UUID NOT NULL REFERENCES companies(id)
name            TEXT NOT NULL
description     TEXT
cpu_millicores  INTEGER NOT NULL DEFAULT 1000
memory_mb       INTEGER NOT NULL DEFAULT 512
disk_mb         INTEGER NOT NULL DEFAULT 1024
timeout_seconds INTEGER NOT NULL DEFAULT 3600
gpu_enabled     BOOLEAN NOT NULL DEFAULT false
mount_allowlist JSONB DEFAULT '[]'       -- utilise par CONT-S03
network_policy  TEXT NOT NULL DEFAULT 'isolated'
is_default      BOOLEAN NOT NULL DEFAULT false
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

-- Indexes existants :
UNIQUE INDEX (company_id, name)
INDEX (company_id)
```

### Table `container_instances` (existante -- TECH-06)

```sql
-- Colonnes existantes (utilisees telles quelles) :
id                   UUID PRIMARY KEY DEFAULT gen_random_uuid()
company_id           UUID NOT NULL REFERENCES companies(id)
profile_id           UUID NOT NULL REFERENCES container_profiles(id)
agent_id             UUID NOT NULL REFERENCES agents(id)
docker_container_id  TEXT               -- Docker container ID (null avant creation)
status               TEXT NOT NULL DEFAULT 'pending'
exit_code            INTEGER            -- code de sortie du container
error                TEXT               -- message d'erreur
resource_usage       JSONB              -- ContainerResourceUsage snapshot
started_at           TIMESTAMPTZ
stopped_at           TIMESTAMPTZ
created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()

-- Indexes existants :
INDEX (company_id, status)
INDEX (company_id, agent_id)
INDEX (docker_container_id)
INDEX (profile_id)
```

### Table `agents` -- colonnes utilisees (existantes -- TECH-07)

```sql
container_profile_id UUID REFERENCES container_profiles(id) ON DELETE SET NULL
isolation_mode       TEXT NOT NULL DEFAULT 'process'  -- 'process' | 'container' | 'sandbox'
```

---

## Edge Cases et Mitigations

| Edge Case | Comportement attendu | Mitigation |
|-----------|---------------------|------------|
| Docker daemon indisponible | `checkDockerHealth` retourne available=false | Mode degrade : fallback sur process adapter si configured, sinon 503 |
| Container cree mais start echoue | Instance passe a status="failed", error renseigne | Try/catch autour de container.start(), cleanup de l'instance |
| OOM kill (exit code 137) | Detection via State.OOMKilled dans inspect | Log l'evenement, suggerer un profil plus grand dans le message d'erreur |
| Timeout (SIGTERM + SIGKILL) | Grace period 10s entre SIGTERM et SIGKILL | container.stop({ t: 10 }) gere les deux signaux |
| Epuisement ressources company | Refuse au-dela de 50 containers actifs | Compteur pre-launch, file d'attente future (CONT-S07) |
| Container orphelin au restart serveur | cleanupStaleContainers au demarrage | Marque comme failed, renseigne stoppedAt |
| Race condition sur stop pendant monitoring | stopMonitoring annule le polling avant le stop Docker | Verification status dans le monitoring loop |
| Image Docker inexistante | docker.createContainer echoue, instance passe a failed | Message d'erreur clair avec le nom de l'image |
| Profil non trouve | Cascade: agent profile > company default > auto-create standard | resolveProfile gere les 3 niveaux |
| Agent d'une autre company | notFound (RLS + check explicite companyId) | Double protection: RLS PostgreSQL + eq(agents.companyId, companyId) |

---

## Risques et Mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Docker socket inaccessible dans l'environnement dev | Moyenne | Bloquant | docker-compose.dev.yml expose /var/run/docker.sock au serveur |
| Performance du polling 5s pour le monitoring | Faible | Moyen | 5s est suffisant pour le MVP, peut etre ajuste. Events Docker (container.wait) en alternative future. |
| Fuite memoire des monitors actifs | Faible | Moyen | Map activeMonitors + cleanup systematique sur stop/exit + startup cleanup |
| Regression adapter process existant | Faible | CRITIQUE | isolationMode="container" est opt-in, default reste "process". Tests de non-regression. |
| dockerode API changes | Faible | Moyen | Version lock dans package.json. Types @types/dockerode. |
| Taille de cette story (XL) | Elevee | Moyen | Splitting possible: T1-T2-T7 (service core, 8 SP) + T3-T4-T5-T6 (adapter+routes+integration, 5 SP) |

---

## Dependencies Externes

| Package | Version | Raison |
|---------|---------|--------|
| `dockerode` | ^4.x | Client Docker Node.js -- API containers/images/networks |
| `@types/dockerode` | ^3.x | TypeScript definitions |

---

## Notes pour le Dev Agent

1. **Commencer par T1 (types)** puis T2 (service) -- le service est le coeur de la story
2. **Mocker dockerode** dans les tests unitaires -- ne PAS dependre de Docker reel pour les tests
3. **buildDockerCreateOptions et parseDockerStats sont des fonctions pures** -- les tester independamment
4. **Le monitoring loop utilise setInterval** -- penser a la cleanup dans les tests (clearInterval)
5. **L'integration heartbeat.ts (T6) est optionnelle pour cette story** -- le Docker adapter (T3) suffit comme point d'entree
6. **Les routes (T5) suivent le pattern exact de containers.ts** -- voir les routes existantes dans server/src/routes/ pour le pattern Express+Zod+middleware
7. **Ne PAS implementer le mount allowlist securise** (realpath, symlinks) -- c'est CONT-S03
8. **Ne PAS implementer l'isolation reseau** -- c'est CONT-S04
9. **L'audit emission utilise le service existant audit-emitter.ts** (DONE via OBS-S02)
