# CONT-S05 : Tables Container -- Enrichissement Schema et Service

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CONT-S05 |
| **Titre** | Tables container -- enrichissement schema, colonnes, indexes, Drizzle relations et endpoints de gestion des profils |
| **Epic** | Epic CONT -- Containerisation |
| **Sprint** | Sprint 5 (Batch 9) |
| **Effort** | S (2 SP, 1j) |
| **Priorite** | P0 -- Prerequis CONT-S02, CONT-S03, CONT-S04, CONT-S06 |
| **Assignation** | Tom (backend) |
| **Bloque par** | TECH-06 (10 nouvelles tables -- DONE), CONT-S01 (ContainerManager Docker -- DONE) |
| **Debloque** | CONT-S02 (Credential Proxy), CONT-S03 (Mount Allowlist), CONT-S04 (Isolation Reseau), CONT-S06 (UI ContainerStatus) |
| **ADR** | ADR-004 (Containerisation Docker + Credential Proxy) |
| **Type** | Backend (schema + migration + service enrichissement + endpoints) |
| **FRs couverts** | REQ-CONT-01 (profils configurables), REQ-CONT-03 (mount allowlist tamper-proof), REQ-CONT-05 (isolation reseau), REQ-CONT-06 (resource limits par profil) |

---

## Description

### Contexte -- Pourquoi cette story existe

TECH-06 a cree les tables `container_profiles` et `container_instances` avec un schema fonctionnel. CONT-S01 a construit le ContainerManager complet (lifecycle create/start/monitor/stop/cleanup) qui utilise ces tables. Cependant, pour supporter les stories en aval (CONT-S02 : Credential Proxy, CONT-S03 : Mount Allowlist tamper-proof, CONT-S04 : Isolation reseau, CONT-S06 : UI ContainerStatus), le schema et le service ont besoin d'enrichissements :

1. **`container_profiles`** manque de colonnes pour les stories en aval :
   - `dockerImage` (image Docker par defaut pour ce profil, actuellement hardcode en `node:20-slim` dans le service)
   - `maxContainers` (nombre max de containers simultanes pour ce profil, pour le capacity planning)
   - `credentialProxyEnabled` (boolean pour activer/desactiver le credential proxy -- prereq CONT-S02)
   - `allowedMountPaths` (liste des chemins specifiques autorises pour ce profil -- prereq CONT-S03, plus strict que `mountAllowlist`)
   - `networkMode` (enum string pour le mode reseau : `isolated`, `company-bridge`, `host-restricted` -- prereq CONT-S04)
   - `maxDiskIops` (limite IOPS disque pour empecher les IO storms)
   - `labels` (JSONB labels Docker additionnels par defaut pour ce profil)

2. **`container_instances`** manque de colonnes pour l'observabilite et la gestion avancee :
   - `networkId` (identifiant du reseau Docker attribue -- prereq CONT-S04)
   - `credentialProxyPort` (port du credential proxy attribue a cette instance -- prereq CONT-S02)
   - `mountedPaths` (JSONB des chemins effectivement montes -- prereq CONT-S03)
   - `healthCheckStatus` (dernier status du health check : `healthy`, `unhealthy`, `unknown`)
   - `restartCount` (nombre de redemarrages -- pour circuit breaker COMP-S02)
   - `lastHealthCheckAt` (timestamp du dernier health check reussi)
   - `labels` (JSONB des labels Docker effectifs de l'instance)
   - `logStreamUrl` (URL du flux de logs pour l'UI -- prereq CONT-S06)

3. **Drizzle migration** pour ajouter les nouvelles colonnes de maniere non-destructive (nullable, backward-compatible).

4. **Service enrichi** : endpoints CRUD complets pour les profils (update, delete, duplicate, get by id), validation pre-creation.

5. **Relations Drizzle** pour les 2 tables (faciliter les joins dans les queries).

### Etat actuel du code

| Fichier | Etat | Lignes | Role |
|---------|------|--------|------|
| `packages/db/src/schema/container_profiles.ts` | Existe | 39 | Table : id, companyId, name, description, cpuMillicores, memoryMb, diskMb, timeoutSeconds, gpuEnabled, mountAllowlist, networkPolicy, isDefault, createdAt, updatedAt. 2 indexes |
| `packages/db/src/schema/container_instances.ts` | Existe | 37 | Table : id, companyId, profileId, agentId, dockerContainerId, status, exitCode, error, resourceUsage, startedAt, stoppedAt, createdAt, updatedAt. 4 indexes |
| `server/src/services/container-manager.ts` | Existe | 707 | Service complet : launch, stop, status, list, resolveProfile, listProfiles, createProfile, monitoring, cleanup |
| `server/src/routes/containers.ts` | Existe | 217 | 7 routes : POST launch, GET list, GET profiles, POST create profile, GET health, GET status, POST stop, DELETE destroy |
| `packages/shared/src/types/container.ts` | Existe | 88 | Types : ContainerStatus, ContainerProfilePreset, ContainerResourceUsage, ContainerLaunchOptions, ContainerLaunchResult, ContainerInfo, ContainerStopOptions, ContainerEventType |
| `packages/db/src/schema/index.ts` | Existe | 50 | Exports : containerProfiles, containerInstances |
| `packages/db/src/schema/agents.ts` | Existe | 46 | Agents avec containerProfileId FK vers containerProfiles, isolationMode |

### Ce que cette story construit

1. **Enrichissement schema `container_profiles`** -- 7 nouvelles colonnes : `dockerImage`, `maxContainers`, `credentialProxyEnabled`, `allowedMountPaths`, `networkMode`, `maxDiskIops`, `labels`
2. **Enrichissement schema `container_instances`** -- 8 nouvelles colonnes : `networkId`, `credentialProxyPort`, `mountedPaths`, `healthCheckStatus`, `restartCount`, `lastHealthCheckAt`, `labels`, `logStreamUrl`
3. **Nouveaux indexes** -- 3 indexes supplementaires pour les requetes frequentes
4. **Relations Drizzle** -- relations pour container_profiles et container_instances (avec agents, companies)
5. **Drizzle migration** -- fichier de migration non-destructif (ALTER TABLE ADD COLUMN, toutes nullable ou avec default)
6. **Service enrichi** -- 4 nouvelles fonctions dans container-manager.ts : `getProfile`, `updateProfile`, `deleteProfile`, `duplicateProfile`
7. **Routes REST enrichies** -- 3 nouvelles routes : GET profile by id, PUT update profile, DELETE delete profile
8. **Validators enrichis** -- schemas Zod pour updateProfile
9. **Types partages enrichis** -- `ContainerHealthCheckStatus`, `ContainerNetworkMode`, `ContainerProfileFull` dans packages/shared

### Ce que cette story ne fait PAS

- Pas d'implementation du credential proxy HTTP (CONT-S02)
- Pas de validation tamper-proof des mount paths avec realpath (CONT-S03)
- Pas de creation de reseaux Docker ni d'isolation reseau effective (CONT-S04)
- Pas de composant UI React ContainerStatus (CONT-S06)
- Pas de pipe stdin pour chat (CHAT-S03)
- Pas de creation de nouvelles tables (on enrichit les 2 tables existantes)

---

## Specification Technique

### S1 : Schema `container_profiles` enrichi

**Fichier** : `packages/db/src/schema/container_profiles.ts`

Colonnes ajoutees (toutes nullable ou avec default pour backward-compatibility) :

| Colonne | Type Drizzle | Type SQL | Default | Description |
|---------|-------------|----------|---------|-------------|
| `dockerImage` | `text("docker_image")` | TEXT | null | Image Docker par defaut pour ce profil (ex: `node:20-slim`, `python:3.12-slim`). Si null, fallback sur `DEFAULT_DOCKER_IMAGE` du service |
| `maxContainers` | `integer("max_containers")` | INTEGER | `10` | Nombre max de containers simultanes pour ce profil au sein de la company |
| `credentialProxyEnabled` | `boolean("credential_proxy_enabled")` | BOOLEAN | `false` | Active le credential proxy HTTP pour les containers de ce profil (prereq CONT-S02) |
| `allowedMountPaths` | `jsonb("allowed_mount_paths").$type<string[]>()` | JSONB | `[]` | Chemins autorises pour mount bind dans le container. Validation par realpath dans CONT-S03 |
| `networkMode` | `text("network_mode")` | TEXT | `"isolated"` | Mode reseau : `isolated` (pas de reseau), `company-bridge` (bridge par company), `host-restricted` (acces hote restreint) |
| `maxDiskIops` | `integer("max_disk_iops")` | INTEGER | null | Limite IOPS disque pour le container. null = pas de limite |
| `labels` | `jsonb("labels").$type<Record<string, string>>()` | JSONB | `{}` | Labels Docker additionnels appliques par defaut aux containers de ce profil |

**Note** : La colonne existante `networkPolicy` (text, default `"isolated"`) est conservee pour backward-compatibility. La nouvelle colonne `networkMode` est plus fine et sera utilisee par CONT-S04. A terme, `networkPolicy` sera deprecee.

Nouvel index :

| Index | Colonnes | Justification |
|-------|----------|---------------|
| `container_profiles_company_default_idx` | `(companyId, isDefault)` | Requete rapide du profil par defaut d'une company (utilise dans resolveProfile) |

### S2 : Schema `container_instances` enrichi

**Fichier** : `packages/db/src/schema/container_instances.ts`

Colonnes ajoutees (toutes nullable pour backward-compatibility) :

| Colonne | Type Drizzle | Type SQL | Default | Description |
|---------|-------------|----------|---------|-------------|
| `networkId` | `text("network_id")` | TEXT | null | ID du reseau Docker cree pour cette instance (ex: `mnm-company-{companyId}`). Rempli par CONT-S04 |
| `credentialProxyPort` | `integer("credential_proxy_port")` | INTEGER | null | Port du credential proxy assigne a cette instance. Rempli par CONT-S02 |
| `mountedPaths` | `jsonb("mounted_paths").$type<string[]>()` | JSONB | null | Chemins effectivement montes dans le container. Rempli par CONT-S03 |
| `healthCheckStatus` | `text("health_check_status")` | TEXT | `"unknown"` | Dernier status du health check : `healthy`, `unhealthy`, `unknown` |
| `restartCount` | `integer("restart_count")` | INTEGER | `0` | Nombre de redemarrages de cette instance (pour circuit breaker COMP-S02, max 3) |
| `lastHealthCheckAt` | `timestamp("last_health_check_at", { withTimezone: true })` | TIMESTAMPTZ | null | Timestamp du dernier health check reussi |
| `labels` | `jsonb("labels").$type<Record<string, string>>()` | JSONB | null | Labels Docker effectifs de cette instance (merge profil + launch options) |
| `logStreamUrl` | `text("log_stream_url")` | TEXT | null | URL du flux de logs pour l'UI (format : `/ws/containers/{instanceId}/logs`). Rempli au lancement |

Nouveaux indexes :

| Index | Colonnes | Justification |
|-------|----------|---------------|
| `container_instances_health_idx` | `(companyId, healthCheckStatus)` | Filtrage des instances par status health check (pour dashboard CONT-S06) |
| `container_instances_restart_idx` | `(companyId, restartCount)` | Requete des instances avec redemarrages frequents (pour circuit breaker) |

### S3 : Relations Drizzle

**Fichier** : `packages/db/src/schema/container_profiles.ts` (ajout en fin de fichier)

```typescript
import { relations } from "drizzle-orm";

export const containerProfilesRelations = relations(containerProfiles, ({ one, many }) => ({
  company: one(companies, {
    fields: [containerProfiles.companyId],
    references: [companies.id],
  }),
  instances: many(containerInstances),
}));
```

**Fichier** : `packages/db/src/schema/container_instances.ts` (ajout en fin de fichier)

```typescript
import { relations } from "drizzle-orm";

export const containerInstancesRelations = relations(containerInstances, ({ one }) => ({
  company: one(companies, {
    fields: [containerInstances.companyId],
    references: [companies.id],
  }),
  profile: one(containerProfiles, {
    fields: [containerInstances.profileId],
    references: [containerProfiles.id],
  }),
  agent: one(agents, {
    fields: [containerInstances.agentId],
    references: [agents.id],
  }),
}));
```

**Fichier** : `packages/db/src/schema/index.ts` (ajout exports des relations)

```typescript
export { containerProfiles, containerProfilesRelations } from "./container_profiles.js";
export { containerInstances, containerInstancesRelations } from "./container_instances.js";
```

### S4 : Migration Drizzle

**Fichier** : nouvelle migration generee par `pnpm db:generate` (numero 0039 attendu)

La migration ajoute les colonnes de maniere non-destructive :

```sql
-- container_profiles enrichment
ALTER TABLE "container_profiles" ADD COLUMN "docker_image" TEXT;
ALTER TABLE "container_profiles" ADD COLUMN "max_containers" INTEGER DEFAULT 10 NOT NULL;
ALTER TABLE "container_profiles" ADD COLUMN "credential_proxy_enabled" BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE "container_profiles" ADD COLUMN "allowed_mount_paths" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "container_profiles" ADD COLUMN "network_mode" TEXT DEFAULT 'isolated' NOT NULL;
ALTER TABLE "container_profiles" ADD COLUMN "max_disk_iops" INTEGER;
ALTER TABLE "container_profiles" ADD COLUMN "labels" JSONB DEFAULT '{}'::jsonb;

-- container_instances enrichment
ALTER TABLE "container_instances" ADD COLUMN "network_id" TEXT;
ALTER TABLE "container_instances" ADD COLUMN "credential_proxy_port" INTEGER;
ALTER TABLE "container_instances" ADD COLUMN "mounted_paths" JSONB;
ALTER TABLE "container_instances" ADD COLUMN "health_check_status" TEXT DEFAULT 'unknown' NOT NULL;
ALTER TABLE "container_instances" ADD COLUMN "restart_count" INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE "container_instances" ADD COLUMN "last_health_check_at" TIMESTAMPTZ;
ALTER TABLE "container_instances" ADD COLUMN "labels" JSONB;
ALTER TABLE "container_instances" ADD COLUMN "log_stream_url" TEXT;

-- New indexes
CREATE INDEX "container_profiles_company_default_idx" ON "container_profiles" ("company_id", "is_default");
CREATE INDEX "container_instances_health_idx" ON "container_instances" ("company_id", "health_check_status");
CREATE INDEX "container_instances_restart_idx" ON "container_instances" ("company_id", "restart_count");
```

### S5 : Types partages enrichis

**Fichier** : `packages/shared/src/types/container.ts` (ajout)

```typescript
// Container network mode (isolation level)
export const CONTAINER_NETWORK_MODES = [
  "isolated",          // No network access (--network none)
  "company-bridge",    // Company-scoped Docker bridge network
  "host-restricted",   // Host network with iptables restrictions
] as const;
export type ContainerNetworkMode = (typeof CONTAINER_NETWORK_MODES)[number];

// Container health check status
export const CONTAINER_HEALTH_CHECK_STATUSES = [
  "healthy",    // Health check passed
  "unhealthy",  // Health check failed
  "unknown",    // No health check performed yet
] as const;
export type ContainerHealthCheckStatus = (typeof CONTAINER_HEALTH_CHECK_STATUSES)[number];

// Extended profile info (for API responses, includes new fields)
export interface ContainerProfileInfo {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  dockerImage: string | null;
  cpuMillicores: number;
  memoryMb: number;
  diskMb: number;
  timeoutSeconds: number;
  gpuEnabled: boolean;
  mountAllowlist: string[];
  allowedMountPaths: string[];
  networkPolicy: string;
  networkMode: string;
  credentialProxyEnabled: boolean;
  maxContainers: number;
  maxDiskIops: number | null;
  labels: Record<string, string>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// Extended container info (for API responses, includes new fields)
export interface ContainerInfoFull extends ContainerInfo {
  networkId: string | null;
  credentialProxyPort: number | null;
  mountedPaths: string[] | null;
  healthCheckStatus: ContainerHealthCheckStatus;
  restartCount: number;
  lastHealthCheckAt: string | null;
  labels: Record<string, string> | null;
  logStreamUrl: string | null;
}

// Profile update payload
export interface ContainerProfileUpdate {
  name?: string;
  description?: string | null;
  dockerImage?: string | null;
  cpuMillicores?: number;
  memoryMb?: number;
  diskMb?: number;
  timeoutSeconds?: number;
  gpuEnabled?: boolean;
  mountAllowlist?: string[];
  allowedMountPaths?: string[];
  networkPolicy?: string;
  networkMode?: ContainerNetworkMode;
  credentialProxyEnabled?: boolean;
  maxContainers?: number;
  maxDiskIops?: number | null;
  labels?: Record<string, string>;
  isDefault?: boolean;
}
```

### S6 : Service enrichi

**Fichier** : `server/src/services/container-manager.ts` (ajout de 4 fonctions)

#### S6.1 : `getProfile(companyId, profileId)`

```typescript
async function getProfile(companyId: string, profileId: string) {
  const [profile] = await db.select().from(containerProfiles).where(
    and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId))
  );
  if (!profile) throw notFound("Container profile not found");
  return profile;
}
```

#### S6.2 : `updateProfile(companyId, profileId, data)`

```typescript
async function updateProfile(companyId: string, profileId: string, data: Partial<{
  name: string;
  description: string | null;
  dockerImage: string | null;
  cpuMillicores: number;
  memoryMb: number;
  diskMb: number;
  timeoutSeconds: number;
  gpuEnabled: boolean;
  mountAllowlist: string[];
  allowedMountPaths: string[];
  networkPolicy: string;
  networkMode: string;
  credentialProxyEnabled: boolean;
  maxContainers: number;
  maxDiskIops: number | null;
  labels: Record<string, string>;
  isDefault: boolean;
}>) {
  // Verify profile exists and belongs to company
  const existing = await getProfile(companyId, profileId);

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await db.update(containerProfiles)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(containerProfiles.companyId, companyId), eq(containerProfiles.isDefault, true)));
  }

  const [updated] = await db.update(containerProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId)))
    .returning();

  return updated!;
}
```

#### S6.3 : `deleteProfile(companyId, profileId)`

```typescript
async function deleteProfile(companyId: string, profileId: string) {
  // Verify profile exists
  const profile = await getProfile(companyId, profileId);

  // Check no active containers using this profile
  const activeContainers = await db.select().from(containerInstances).where(
    and(
      eq(containerInstances.profileId, profileId),
      inArray(containerInstances.status, ["pending", "creating", "running"])
    )
  );
  if (activeContainers.length > 0) {
    throw conflict(`Cannot delete profile: ${activeContainers.length} active container(s) using it`);
  }

  // Check no agents referencing this profile
  const referencingAgents = await db.select().from(agents).where(
    eq(agents.containerProfileId, profileId)
  );
  if (referencingAgents.length > 0) {
    throw conflict(`Cannot delete profile: ${referencingAgents.length} agent(s) referencing it`);
  }

  await db.delete(containerProfiles).where(
    and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId))
  );

  return profile;
}
```

#### S6.4 : `duplicateProfile(companyId, profileId, newName)`

```typescript
async function duplicateProfile(companyId: string, profileId: string, newName: string) {
  const source = await getProfile(companyId, profileId);

  const { id, createdAt, updatedAt, ...data } = source;

  const [duplicated] = await db.insert(containerProfiles).values({
    ...data,
    name: newName,
    isDefault: false, // Never duplicate as default
  }).returning();

  return duplicated!;
}
```

**Service return** : ajouter les 4 nouvelles fonctions dans l'objet retourne :

```typescript
return {
  // ... existing functions
  getProfile,
  updateProfile,
  deleteProfile,
  duplicateProfile,
};
```

### S7 : Routes REST enrichies

**Fichier** : `server/src/routes/containers.ts` (ajout de 3 routes)

#### S7.1 : GET `/companies/:companyId/containers/profiles/:profileId`

```typescript
router.get(
  "/companies/:companyId/containers/profiles/:profileId",
  requirePermission(db, "agents:manage_containers"),
  async (req, res) => {
    const { companyId, profileId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const profile = await manager.getProfile(companyId as string, profileId as string);
    res.json(profile);
  },
);
```

#### S7.2 : PUT `/companies/:companyId/containers/profiles/:profileId`

```typescript
router.put(
  "/companies/:companyId/containers/profiles/:profileId",
  requirePermission(db, "agents:manage_containers"),
  async (req, res) => {
    const { companyId, profileId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const profile = await manager.updateProfile(
      companyId as string,
      profileId as string,
      parsed.data,
    );

    await emitAudit({
      req,
      db,
      companyId: companyId as string,
      action: "container.profile_updated",
      targetType: "container_profile",
      targetId: profileId as string,
      metadata: { name: profile.name, changes: Object.keys(parsed.data) },
    });

    res.json(profile);
  },
);
```

#### S7.3 : DELETE `/companies/:companyId/containers/profiles/:profileId`

```typescript
router.delete(
  "/companies/:companyId/containers/profiles/:profileId",
  requirePermission(db, "agents:manage_containers"),
  async (req, res) => {
    const { companyId, profileId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const deleted = await manager.deleteProfile(companyId as string, profileId as string);

    await emitAudit({
      req,
      db,
      companyId: companyId as string,
      action: "container.profile_deleted",
      targetType: "container_profile",
      targetId: profileId as string,
      metadata: { name: deleted.name },
    });

    res.json({ status: "deleted", id: profileId });
  },
);
```

### S8 : Validators enrichis

**Fichier** : `server/src/routes/containers.ts` (ajout schema Zod)

```typescript
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  dockerImage: z.string().max(255).optional().nullable(),
  cpuMillicores: z.number().int().min(100).max(16000).optional(),
  memoryMb: z.number().int().min(64).max(32768).optional(),
  diskMb: z.number().int().min(128).max(65536).optional(),
  timeoutSeconds: z.number().int().min(60).max(86400).optional(),
  gpuEnabled: z.boolean().optional(),
  mountAllowlist: z.array(z.string()).optional(),
  allowedMountPaths: z.array(z.string()).optional(),
  networkPolicy: z.string().optional(),
  networkMode: z.enum(["isolated", "company-bridge", "host-restricted"]).optional(),
  credentialProxyEnabled: z.boolean().optional(),
  maxContainers: z.number().int().min(1).max(200).optional(),
  maxDiskIops: z.number().int().min(100).max(100000).optional().nullable(),
  labels: z.record(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

const duplicateProfileSchema = z.object({
  newName: z.string().min(1).max(100),
});
```

Enrichir le `createProfileSchema` existant pour accepter les nouveaux champs :

```typescript
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
  // New fields from CONT-S05
  dockerImage: z.string().max(255).optional(),
  maxContainers: z.number().int().min(1).max(200).optional(),
  credentialProxyEnabled: z.boolean().optional(),
  allowedMountPaths: z.array(z.string()).optional(),
  networkMode: z.enum(["isolated", "company-bridge", "host-restricted"]).optional(),
  maxDiskIops: z.number().int().min(100).max(100000).optional().nullable(),
  labels: z.record(z.string()).optional(),
});
```

### S9 : Enrichissement formatContainerInfo

**Fichier** : `server/src/services/container-manager.ts` (modifier la fonction `formatContainerInfo`)

Ajouter les nouveaux champs dans la sortie de `formatContainerInfo` :

```typescript
function formatContainerInfo(row: {
  instance: typeof containerInstances.$inferSelect;
  profile: typeof containerProfiles.$inferSelect;
  agent: typeof agents.$inferSelect;
}): ContainerInfoFull {
  return {
    // ... existing fields
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
    // New fields from CONT-S05
    networkId: row.instance.networkId,
    credentialProxyPort: row.instance.credentialProxyPort,
    mountedPaths: row.instance.mountedPaths as string[] | null,
    healthCheckStatus: (row.instance.healthCheckStatus ?? "unknown") as ContainerHealthCheckStatus,
    restartCount: row.instance.restartCount ?? 0,
    lastHealthCheckAt: row.instance.lastHealthCheckAt?.toISOString() ?? null,
    labels: row.instance.labels as Record<string, string> | null,
    logStreamUrl: row.instance.logStreamUrl,
  };
}
```

### S10 : Enrichissement launchContainer

**Fichier** : `server/src/services/container-manager.ts` (modifier la fonction `launchContainer`)

Ajouter la population du champ `logStreamUrl` lors du lancement :

```typescript
// After step 10 (update instance with Docker container ID), also set logStreamUrl and labels
await db.update(containerInstances)
  .set({
    dockerContainerId,
    logStreamUrl: `/ws/containers/${instance!.id}/logs`,
    labels: {
      "mnm.agent_id": agentId,
      "mnm.company_id": companyId,
      "mnm.instance_id": instance!.id,
      "mnm.profile": profile.name,
      ...options?.labels,
    } as Record<string, string>,
    updatedAt: new Date(),
  })
  .where(eq(containerInstances.id, instance!.id));
```

---

## Mapping data-test-id

Ces data-test-id sont utilises par les tests E2E Playwright (verification de la structure des fichiers de code).

### Fichiers Schema

| data-test-id | Element | Fichier |
|--------------|---------|---------|
| `cont-s05-profile-docker-image-col` | Colonne `dockerImage` dans container_profiles | `packages/db/src/schema/container_profiles.ts` |
| `cont-s05-profile-max-containers-col` | Colonne `maxContainers` dans container_profiles | `packages/db/src/schema/container_profiles.ts` |
| `cont-s05-profile-credential-proxy-col` | Colonne `credentialProxyEnabled` dans container_profiles | `packages/db/src/schema/container_profiles.ts` |
| `cont-s05-profile-allowed-mount-paths-col` | Colonne `allowedMountPaths` dans container_profiles | `packages/db/src/schema/container_profiles.ts` |
| `cont-s05-profile-network-mode-col` | Colonne `networkMode` dans container_profiles | `packages/db/src/schema/container_profiles.ts` |
| `cont-s05-profile-max-disk-iops-col` | Colonne `maxDiskIops` dans container_profiles | `packages/db/src/schema/container_profiles.ts` |
| `cont-s05-profile-labels-col` | Colonne `labels` dans container_profiles | `packages/db/src/schema/container_profiles.ts` |
| `cont-s05-instance-network-id-col` | Colonne `networkId` dans container_instances | `packages/db/src/schema/container_instances.ts` |
| `cont-s05-instance-credential-proxy-port-col` | Colonne `credentialProxyPort` dans container_instances | `packages/db/src/schema/container_instances.ts` |
| `cont-s05-instance-mounted-paths-col` | Colonne `mountedPaths` dans container_instances | `packages/db/src/schema/container_instances.ts` |
| `cont-s05-instance-health-check-status-col` | Colonne `healthCheckStatus` dans container_instances | `packages/db/src/schema/container_instances.ts` |
| `cont-s05-instance-restart-count-col` | Colonne `restartCount` dans container_instances | `packages/db/src/schema/container_instances.ts` |
| `cont-s05-instance-last-health-check-col` | Colonne `lastHealthCheckAt` dans container_instances | `packages/db/src/schema/container_instances.ts` |
| `cont-s05-instance-labels-col` | Colonne `labels` dans container_instances | `packages/db/src/schema/container_instances.ts` |
| `cont-s05-instance-log-stream-url-col` | Colonne `logStreamUrl` dans container_instances | `packages/db/src/schema/container_instances.ts` |

### Indexes

| data-test-id | Element | Fichier |
|--------------|---------|---------|
| `cont-s05-profile-default-idx` | Index `container_profiles_company_default_idx` | `packages/db/src/schema/container_profiles.ts` |
| `cont-s05-instance-health-idx` | Index `container_instances_health_idx` | `packages/db/src/schema/container_instances.ts` |
| `cont-s05-instance-restart-idx` | Index `container_instances_restart_idx` | `packages/db/src/schema/container_instances.ts` |

### Relations

| data-test-id | Element | Fichier |
|--------------|---------|---------|
| `cont-s05-profiles-relations` | Relations Drizzle pour container_profiles | `packages/db/src/schema/container_profiles.ts` |
| `cont-s05-instances-relations` | Relations Drizzle pour container_instances | `packages/db/src/schema/container_instances.ts` |

### Migration

| data-test-id | Element | Fichier |
|--------------|---------|---------|
| `cont-s05-migration-profiles-alter` | ALTER TABLE container_profiles dans migration | `packages/db/src/migrations/0039_*.sql` |
| `cont-s05-migration-instances-alter` | ALTER TABLE container_instances dans migration | `packages/db/src/migrations/0039_*.sql` |
| `cont-s05-migration-indexes` | CREATE INDEX dans migration | `packages/db/src/migrations/0039_*.sql` |

### Service

| data-test-id | Element | Fichier |
|--------------|---------|---------|
| `cont-s05-svc-get-profile` | Fonction getProfile | `server/src/services/container-manager.ts` |
| `cont-s05-svc-update-profile` | Fonction updateProfile | `server/src/services/container-manager.ts` |
| `cont-s05-svc-delete-profile` | Fonction deleteProfile | `server/src/services/container-manager.ts` |
| `cont-s05-svc-duplicate-profile` | Fonction duplicateProfile | `server/src/services/container-manager.ts` |
| `cont-s05-svc-format-enriched` | formatContainerInfo avec champs enrichis | `server/src/services/container-manager.ts` |

### Routes

| data-test-id | Element | Fichier |
|--------------|---------|---------|
| `cont-s05-route-get-profile` | GET /companies/:companyId/containers/profiles/:profileId | `server/src/routes/containers.ts` |
| `cont-s05-route-update-profile` | PUT /companies/:companyId/containers/profiles/:profileId | `server/src/routes/containers.ts` |
| `cont-s05-route-delete-profile` | DELETE /companies/:companyId/containers/profiles/:profileId | `server/src/routes/containers.ts` |

### Validators

| data-test-id | Element | Fichier |
|--------------|---------|---------|
| `cont-s05-validator-update-profile` | Schema Zod updateProfileSchema | `server/src/routes/containers.ts` |
| `cont-s05-validator-create-enriched` | Schema Zod createProfileSchema enrichi | `server/src/routes/containers.ts` |

### Types partages

| data-test-id | Element | Fichier |
|--------------|---------|---------|
| `cont-s05-type-network-mode` | Type ContainerNetworkMode | `packages/shared/src/types/container.ts` |
| `cont-s05-type-health-status` | Type ContainerHealthCheckStatus | `packages/shared/src/types/container.ts` |
| `cont-s05-type-profile-info` | Interface ContainerProfileInfo | `packages/shared/src/types/container.ts` |
| `cont-s05-type-info-full` | Interface ContainerInfoFull | `packages/shared/src/types/container.ts` |
| `cont-s05-type-profile-update` | Interface ContainerProfileUpdate | `packages/shared/src/types/container.ts` |

### Barrel Exports

| data-test-id | Element | Fichier |
|--------------|---------|---------|
| `cont-s05-export-profiles-relations` | Export containerProfilesRelations | `packages/db/src/schema/index.ts` |
| `cont-s05-export-instances-relations` | Export containerInstancesRelations | `packages/db/src/schema/index.ts` |
| `cont-s05-export-types` | Export nouveaux types container | `packages/shared/src/types/index.ts` |

---

## Acceptance Criteria (Given/When/Then)

### AC1 : Colonnes container_profiles ajoutees

**Given** le schema `container_profiles`
**When** la migration s'execute
**Then** les 7 nouvelles colonnes sont ajoutees (`docker_image`, `max_containers`, `credential_proxy_enabled`, `allowed_mount_paths`, `network_mode`, `max_disk_iops`, `labels`)
**And** les colonnes avec default sont NOT NULL, les autres sont nullable
**And** aucune donnee existante n'est perdue

### AC2 : Colonnes container_instances ajoutees

**Given** le schema `container_instances`
**When** la migration s'execute
**Then** les 8 nouvelles colonnes sont ajoutees (`network_id`, `credential_proxy_port`, `mounted_paths`, `health_check_status`, `restart_count`, `last_health_check_at`, `labels`, `log_stream_url`)
**And** `health_check_status` default `'unknown'`, `restart_count` default `0`, le reste nullable
**And** aucune donnee existante n'est perdue

### AC3 : Indexes crees

**Given** la migration
**When** elle s'execute
**Then** 3 nouveaux indexes sont crees : `container_profiles_company_default_idx`, `container_instances_health_idx`, `container_instances_restart_idx`
**And** les indexes existants sont preserves

### AC4 : Relations Drizzle declarees

**Given** les fichiers schema
**When** le code est charge
**Then** `containerProfilesRelations` declare `company` (one) et `instances` (many)
**And** `containerInstancesRelations` declare `company` (one), `profile` (one), `agent` (one)
**And** les relations sont exportees dans `index.ts`

### AC5 : GET profile by id

**Given** un profil existant appartenant a la company
**When** GET `/companies/:companyId/containers/profiles/:profileId`
**Then** 200 avec le profil complet incluant les nouveaux champs
**And** permission `agents:manage_containers` requise

### AC6 : GET profile by id -- not found

**Given** un profileId inexistant
**When** GET `/companies/:companyId/containers/profiles/:profileId`
**Then** 404 `Container profile not found`

### AC7 : PUT update profile

**Given** un profil existant
**When** PUT `/companies/:companyId/containers/profiles/:profileId` avec `{ "name": "heavy-updated", "memoryMb": 2048 }`
**Then** 200 avec le profil mis a jour
**And** `updatedAt` est rafraichi
**And** un audit event `container.profile_updated` est emis avec `metadata.changes`

### AC8 : PUT update profile -- set default

**Given** un profil non-default
**When** PUT avec `{ "isDefault": true }`
**Then** ce profil devient le default
**And** l'ancien profil default de la company perd son flag `isDefault`

### AC9 : PUT update profile -- validation

**Given** une requete PUT avec des donnees invalides (`cpuMillicores: -1`)
**When** le validateur Zod s'execute
**Then** 400 Bad Request avec les erreurs de validation

### AC10 : DELETE profile -- succes

**Given** un profil sans containers actifs et sans agents references
**When** DELETE `/companies/:companyId/containers/profiles/:profileId`
**Then** 200 `{ "status": "deleted", "id": "..." }`
**And** le profil est supprime de la DB
**And** un audit event `container.profile_deleted` est emis

### AC11 : DELETE profile -- containers actifs

**Given** un profil avec 2 containers en status `running`
**When** DELETE `/companies/:companyId/containers/profiles/:profileId`
**Then** 409 Conflict `Cannot delete profile: 2 active container(s) using it`

### AC12 : DELETE profile -- agents references

**Given** un profil reference par 1 agent via `containerProfileId`
**When** DELETE `/companies/:companyId/containers/profiles/:profileId`
**Then** 409 Conflict `Cannot delete profile: 1 agent(s) referencing it`

### AC13 : createProfileSchema enrichi

**Given** une requete POST create profile avec les nouveaux champs
**When** `{ "name": "gpu-custom", "gpuEnabled": true, "dockerImage": "nvidia/cuda:12.0", "networkMode": "company-bridge", "credentialProxyEnabled": true }`
**Then** le profil est cree avec tous les champs
**And** `networkMode` accepte uniquement `isolated`, `company-bridge`, `host-restricted`

### AC14 : formatContainerInfo enrichi

**Given** un container en status `running`
**When** GET `/companies/:companyId/containers/:containerId`
**Then** la reponse inclut les nouveaux champs : `healthCheckStatus`, `restartCount`, `logStreamUrl`, `labels`, `networkId`, `credentialProxyPort`, `mountedPaths`, `lastHealthCheckAt`

### AC15 : Backward compatibility

**Given** des donnees container_profiles et container_instances existantes (creees avant CONT-S05)
**When** la migration s'execute
**Then** les enregistrements existants ont les valeurs par defaut correctes
**And** toutes les routes existantes continuent de fonctionner sans modification
**And** le ContainerManager lance des containers normalement

### AC16 : Types partages exportes

**Given** le fichier `packages/shared/src/types/container.ts`
**When** il est importe
**Then** `ContainerNetworkMode`, `ContainerHealthCheckStatus`, `ContainerProfileInfo`, `ContainerInfoFull`, `ContainerProfileUpdate` sont disponibles
**And** `CONTAINER_NETWORK_MODES` et `CONTAINER_HEALTH_CHECK_STATUSES` sont des arrays const

### AC17 : logStreamUrl genere au lancement

**Given** un container lance via launchContainer
**When** le container demarre avec succes
**Then** `logStreamUrl` est rempli avec `/ws/containers/{instanceId}/logs`
**And** `labels` est rempli avec les labels Docker effectifs

---

## Test Cases (pour Agent QA)

### Tests schema container_profiles (T01-T07)

| ID | Test | Verification |
|----|------|-------------|
| T01 | Colonne `docker_image` existe | Fichier schema contient `dockerImage: text("docker_image")` |
| T02 | Colonne `max_containers` avec default 10 | Fichier schema contient `maxContainers: integer("max_containers").notNull().default(10)` |
| T03 | Colonne `credential_proxy_enabled` boolean | Fichier schema contient `credentialProxyEnabled: boolean("credential_proxy_enabled").notNull().default(false)` |
| T04 | Colonne `allowed_mount_paths` JSONB array | Fichier schema contient `allowedMountPaths: jsonb("allowed_mount_paths").$type<string[]>()` |
| T05 | Colonne `network_mode` avec default | Fichier schema contient `networkMode: text("network_mode").notNull().default("isolated")` |
| T06 | Colonne `max_disk_iops` nullable | Fichier schema contient `maxDiskIops: integer("max_disk_iops")` sans `.notNull()` |
| T07 | Colonne `labels` JSONB | Fichier schema contient `labels: jsonb("labels").$type<Record<string, string>>()` |

### Tests schema container_instances (T08-T15)

| ID | Test | Verification |
|----|------|-------------|
| T08 | Colonne `network_id` text nullable | Fichier schema contient `networkId: text("network_id")` |
| T09 | Colonne `credential_proxy_port` integer nullable | Fichier schema contient `credentialProxyPort: integer("credential_proxy_port")` |
| T10 | Colonne `mounted_paths` JSONB nullable | Fichier schema contient `mountedPaths: jsonb("mounted_paths").$type<string[]>()` |
| T11 | Colonne `health_check_status` avec default | Fichier schema contient `healthCheckStatus: text("health_check_status").notNull().default("unknown")` |
| T12 | Colonne `restart_count` default 0 | Fichier schema contient `restartCount: integer("restart_count").notNull().default(0)` |
| T13 | Colonne `last_health_check_at` timestamp nullable | Fichier schema contient `lastHealthCheckAt: timestamp("last_health_check_at"` |
| T14 | Colonne `labels` JSONB nullable | Fichier schema contient `labels: jsonb("labels")` dans container_instances |
| T15 | Colonne `log_stream_url` text nullable | Fichier schema contient `logStreamUrl: text("log_stream_url")` |

### Tests indexes (T16-T18)

| ID | Test | Verification |
|----|------|-------------|
| T16 | Index profiles default | Fichier schema contient `container_profiles_company_default_idx` sur `(companyId, isDefault)` |
| T17 | Index instances health | Fichier schema contient `container_instances_health_idx` sur `(companyId, healthCheckStatus)` |
| T18 | Index instances restart | Fichier schema contient `container_instances_restart_idx` sur `(companyId, restartCount)` |

### Tests relations (T19-T20)

| ID | Test | Verification |
|----|------|-------------|
| T19 | Relations container_profiles | Fichier contient `containerProfilesRelations` avec `company` (one) et `instances` (many) |
| T20 | Relations container_instances | Fichier contient `containerInstancesRelations` avec `company` (one), `profile` (one), `agent` (one) |

### Tests migration (T21-T24)

| ID | Test | Verification |
|----|------|-------------|
| T21 | Migration ALTER profiles | Migration SQL contient 7 `ALTER TABLE "container_profiles" ADD COLUMN` |
| T22 | Migration ALTER instances | Migration SQL contient 8 `ALTER TABLE "container_instances" ADD COLUMN` |
| T23 | Migration indexes | Migration SQL contient 3 `CREATE INDEX` |
| T24 | Migration non-destructive | Aucun `DROP`, `TRUNCATE`, ou `DELETE` dans le SQL |

### Tests service (T25-T32)

| ID | Test | Verification |
|----|------|-------------|
| T25 | getProfile existe | Fichier service contient `async function getProfile(` |
| T26 | updateProfile existe | Fichier service contient `async function updateProfile(` |
| T27 | deleteProfile existe | Fichier service contient `async function deleteProfile(` |
| T28 | deleteProfile check containers actifs | Code contient `inArray(containerInstances.status, ["pending", "creating", "running"])` dans deleteProfile |
| T29 | deleteProfile check agents | Code contient `eq(agents.containerProfileId, profileId)` dans deleteProfile |
| T30 | duplicateProfile existe | Fichier service contient `async function duplicateProfile(` |
| T31 | formatContainerInfo enrichi | Fonction contient `healthCheckStatus` et `restartCount` et `logStreamUrl` |
| T32 | Service exports les 4 nouvelles fonctions | Return object contient `getProfile`, `updateProfile`, `deleteProfile`, `duplicateProfile` |

### Tests routes (T33-T38)

| ID | Test | Verification |
|----|------|-------------|
| T33 | GET profile route | Fichier routes contient `router.get(` avec `/companies/:companyId/containers/profiles/:profileId` |
| T34 | PUT update route | Fichier routes contient `router.put(` avec `/companies/:companyId/containers/profiles/:profileId` |
| T35 | DELETE profile route | Fichier routes contient `router.delete(` avec `/companies/:companyId/containers/profiles/:profileId` (distinct du delete container) |
| T36 | PUT audit emission | Code route PUT contient `container.profile_updated` |
| T37 | DELETE audit emission | Code route DELETE profile contient `container.profile_deleted` |
| T38 | Permission check | Les 3 nouvelles routes utilisent `requirePermission(db, "agents:manage_containers")` |

### Tests validators (T39-T42)

| ID | Test | Verification |
|----|------|-------------|
| T39 | updateProfileSchema existe | Fichier routes contient `const updateProfileSchema = z.object(` |
| T40 | networkMode enum | updateProfileSchema contient `z.enum(["isolated", "company-bridge", "host-restricted"])` |
| T41 | createProfileSchema enrichi | createProfileSchema contient `dockerImage` et `networkMode` et `credentialProxyEnabled` |
| T42 | maxContainers validation | createProfileSchema ou updateProfileSchema contient `z.number().int().min(1).max(200)` |

### Tests types partages (T43-T48)

| ID | Test | Verification |
|----|------|-------------|
| T43 | ContainerNetworkMode type | Fichier types contient `export type ContainerNetworkMode` |
| T44 | CONTAINER_NETWORK_MODES const | Fichier types contient `CONTAINER_NETWORK_MODES` avec `"isolated"`, `"company-bridge"`, `"host-restricted"` |
| T45 | ContainerHealthCheckStatus type | Fichier types contient `export type ContainerHealthCheckStatus` |
| T46 | ContainerProfileInfo interface | Fichier types contient `export interface ContainerProfileInfo` |
| T47 | ContainerInfoFull interface | Fichier types contient `export interface ContainerInfoFull` avec `extends ContainerInfo` |
| T48 | ContainerProfileUpdate interface | Fichier types contient `export interface ContainerProfileUpdate` |

### Tests barrel exports (T49-T51)

| ID | Test | Verification |
|----|------|-------------|
| T49 | index.ts exporte containerProfilesRelations | `packages/db/src/schema/index.ts` contient `containerProfilesRelations` |
| T50 | index.ts exporte containerInstancesRelations | `packages/db/src/schema/index.ts` contient `containerInstancesRelations` |
| T51 | types/index.ts exporte les nouveaux types | `packages/shared/src/types/index.ts` contient les exports des nouveaux types container |

### Tests backward compatibility (T52-T54)

| ID | Test | Verification |
|----|------|-------------|
| T52 | Colonnes existantes preservees | container_profiles garde toutes ses 13 colonnes originales |
| T53 | Indexes existants preserves | container_profiles garde `container_profiles_company_name_unique_idx` et `container_profiles_company_idx` |
| T54 | container_instances garde ses 4 indexes | Indexes `company_status_idx`, `company_agent_idx`, `docker_container_idx`, `profile_idx` sont preserves |

---

## Fichiers Impactes -- Resume

### Fichiers a MODIFIER

| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `packages/db/src/schema/container_profiles.ts` | +7 colonnes, +1 index, +relations |
| 2 | `packages/db/src/schema/container_instances.ts` | +8 colonnes, +2 indexes, +relations |
| 3 | `packages/db/src/schema/index.ts` | Modifier exports pour inclure les relations |
| 4 | `server/src/services/container-manager.ts` | +4 fonctions (getProfile, updateProfile, deleteProfile, duplicateProfile), modifier formatContainerInfo et launchContainer |
| 5 | `server/src/routes/containers.ts` | +3 routes (GET/PUT/DELETE profile), +2 validators (updateProfileSchema, enrichir createProfileSchema) |
| 6 | `packages/shared/src/types/container.ts` | +5 types/interfaces (ContainerNetworkMode, ContainerHealthCheckStatus, ContainerProfileInfo, ContainerInfoFull, ContainerProfileUpdate) |
| 7 | `packages/shared/src/types/index.ts` | +exports des nouveaux types |

### Fichiers a CREER

| # | Fichier | Role |
|---|---------|------|
| 1 | `packages/db/src/migrations/0039_*.sql` | Migration Drizzle : ALTER TABLE + CREATE INDEX |

### Fichiers NON MODIFIES (reference)

| Fichier | Role |
|---------|------|
| `packages/db/src/schema/agents.ts` | Reference pour la relation FK containerProfileId |
| `packages/db/src/schema/companies.ts` | Reference pour la relation FK companyId |
| `server/src/errors.ts` | notFound, conflict (utilise dans les nouvelles fonctions) |
| `server/src/services/audit-emitter.ts` | emitAudit (utilise dans les nouvelles routes) |
| `server/src/middleware/require-permission.ts` | requirePermission (utilise dans les nouvelles routes) |

---

## Risques et Mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Migration echoue sur donnees existantes | Moyen | Toutes les nouvelles colonnes sont nullable ou avec default -- zero risque de conflit |
| Conflit de nom `networkMode` vs `networkPolicy` existant | Faible | Les 2 colonnes coexistent, `networkPolicy` sera deprecee progressivement apres CONT-S04 |
| Performance des 3 nouveaux indexes | Faible | Indexes sur colonnes a faible cardinalite (status, boolean), impact negligeable |
| `labels` JSONB sur les 2 tables | Faible | Pas d'index GIN necessaire, utilise uniquement pour lecture/serialisation |

---

## Definition of Done

- [ ] 7 colonnes ajoutees a `container_profiles` avec types et defaults corrects
- [ ] 8 colonnes ajoutees a `container_instances` avec types et defaults corrects
- [ ] 3 nouveaux indexes crees
- [ ] Relations Drizzle declarees et exportees pour les 2 tables
- [ ] Migration Drizzle generee et fonctionnelle (`pnpm db:generate` + `pnpm db:migrate`)
- [ ] 4 fonctions service ajoutees (getProfile, updateProfile, deleteProfile, duplicateProfile)
- [ ] 3 routes REST ajoutees (GET/PUT/DELETE profile)
- [ ] Validators Zod enrichis (updateProfileSchema, createProfileSchema)
- [ ] 5 types partages ajoutes dans packages/shared
- [ ] formatContainerInfo enrichi avec les nouveaux champs
- [ ] launchContainer populant logStreamUrl et labels
- [ ] Audit events emis pour profile_updated et profile_deleted
- [ ] Backward compatibility verifiee (aucune regression sur les routes existantes)
- [ ] `pnpm typecheck` passe sans erreur
- [ ] 54 test cases E2E passes
