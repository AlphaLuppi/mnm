# CONT-S04 : Isolation Reseau Docker -- Networks isoles par company/project

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CONT-S04 |
| **Titre** | Isolation Reseau Docker -- creation et gestion de reseaux Docker isoles par company/project |
| **Epic** | Epic CONT -- Containerisation |
| **Sprint** | Sprint 6 (Batch 10) |
| **Effort** | M (3 SP, 2-3j) |
| **Priorite** | P0 -- Securite B2B (couche 5 de defense en profondeur, ADR-004) |
| **Assignation** | Cofondateur (backend + securite) |
| **Bloque par** | CONT-S01 (ContainerManager Docker -- DONE), CONT-S05 (Tables container enrichies -- DONE, networkId + networkMode columns) |
| **Debloque** | CONT-S06 (UI container status), CHAT-S03 (ChatService pipe stdin -- containers need network access for proxy) |
| **ADR** | ADR-004 (Containerisation Docker + Credential Proxy -- couche 5 sur 5) |
| **Type** | Backend (service + integration ContainerManager + routes + audit) |
| **FRs couverts** | REQ-CONT-05 (Reseau isole -- bridge Docker par company, pas d'acces internet direct) |

---

## Description

### Contexte -- Pourquoi cette story est critique

L'ADR-004 definit 5 couches de defense en profondeur pour la containerisation :
1. Container ephemere `--rm --read-only` (CONT-S01 -- DONE)
2. Mount allowlist tamper-proof (CONT-S03 -- DONE)
3. Credential proxy HTTP (CONT-S02 -- DONE)
4. Shadow `.env` -> `/dev/null` (CONT-S01 -- DONE)
5. **Reseau isole** -- cette story

**Le probleme** : sans isolation reseau, les containers partagent le reseau de l'hote Docker. Un agent compromis pourrait :
1. Scanner le reseau interne de l'entreprise
2. Communiquer avec d'autres containers d'autres companies (cross-tenant leak)
3. Exfiltrer des donnees via HTTP vers des serveurs externes
4. Acceder a des services internes non proteges (metadata services, DB directement)

**La solution** : un service `NetworkIsolationService` qui :
- Cree des reseaux Docker isoles par company (un reseau par company)
- Supporte 3 modes de reseau configures par profil : `isolated` (aucun reseau, default), `bridge` (company-bridge, acces interne uniquement), `host-restricted` (reseau hote avec restrictions)
- Attache automatiquement le container au reseau de sa company lors du lancement
- Enregistre le `networkId` dans `container_instances` (colonne CONT-S05)
- Utilise le `networkMode` du profil (colonne CONT-S05 dans `container_profiles`)
- Nettoie les reseaux orphelins lors du cleanup au demarrage

### Ce que cette story construit

1. **NetworkIsolationService** (`server/src/services/network-isolation.ts`) -- service de gestion des reseaux Docker
   - `ensureCompanyNetwork(companyId)` -- cree ou recupere le reseau bridge de la company
   - `resolveNetworkMode(profileNetworkMode)` -- determine le mode reseau effectif
   - `attachContainerToNetwork(containerId, networkId)` -- attache un container a un reseau
   - `detachContainerFromNetwork(containerId, networkId)` -- detache un container d'un reseau
   - `listCompanyNetworks(companyId)` -- liste les reseaux d'une company
   - `getNetworkInfo(networkId)` -- informations sur un reseau Docker
   - `removeNetwork(networkId)` -- supprime un reseau Docker
   - `cleanupOrphanNetworks()` -- nettoie les reseaux sans containers actifs

2. **Integration ContainerManager** -- modification de `container-manager.ts` :
   - Dans `launchContainer()` : apres creation du container, resoudre le mode reseau du profil
   - Si `company-bridge` : appeler `ensureCompanyNetwork()` puis `attachContainerToNetwork()`
   - Si `isolated` : passer `NetworkMode: "none"` dans `HostConfig`
   - Si `host-restricted` : passer `NetworkMode: "host"` dans `HostConfig`
   - Enregistrer le `networkId` dans `container_instances`
   - Dans `stopContainer()` : detacher du reseau avant stop
   - Dans `cleanupStaleContainers()` : appeler `cleanupOrphanNetworks()`

3. **Modification `buildDockerCreateOptions()`** -- ajout du `NetworkMode` dans `HostConfig`

4. **Routes API** pour gerer les reseaux :
   - `GET /companies/:companyId/containers/networks` -- lister les reseaux de la company
   - `GET /companies/:companyId/containers/networks/:networkId` -- info sur un reseau
   - `DELETE /companies/:companyId/containers/networks/:networkId` -- supprimer un reseau orphelin
   - `POST /companies/:companyId/containers/networks/cleanup` -- nettoyer les reseaux orphelins

5. **Types partages** dans `packages/shared/src/types/container.ts` -- ajout de types reseau

6. **Audit trail** -- emission d'audit events pour creation/suppression de reseaux

### Ce que cette story ne fait PAS (scope)

- Pas de regles iptables personnalisees (host-restricted utilise le mode host Docker natif)
- Pas de firewall applicatif (CONT future)
- Pas d'UI pour configurer les reseaux (via profil + API)
- Pas de DNS personnalise (utilise le DNS Docker par defaut)
- Pas de VPN overlay (Weave, Calico, etc.)

---

## Etat Actuel du Code (Analyse)

### Fichiers existants impactes

| Fichier | Modifications |
|---------|--------------|
| `server/src/services/container-manager.ts` | Integration network isolation dans launchContainer, stopContainer, cleanupStaleContainers, buildDockerCreateOptions |
| `server/src/routes/containers.ts` | 4 nouvelles routes pour gestion des reseaux |
| `packages/shared/src/types/container.ts` | Nouveaux types NetworkInfo, NetworkIsolationConfig |
| `packages/shared/src/types/index.ts` | Export des nouveaux types |
| `server/src/services/index.ts` | Export du networkIsolationService |

### Colonnes DB existantes (CONT-S05, deja crees)

- `container_instances.networkId` (text, nullable) -- ID du reseau Docker attache
- `container_profiles.networkMode` (text, default "isolated") -- mode reseau du profil

### Types existants (CONT-S05, deja definis)

- `CONTAINER_NETWORK_MODES` = ["isolated", "company-bridge", "host-restricted"]
- `ContainerNetworkMode` -- type union
- `ContainerInfoFull.networkId` -- champ expose en API

---

## Acceptance Criteria (Given/When/Then)

### AC1 : Reseau isole par defaut
**Given** un profil avec `networkMode = "isolated"` (defaut)
**When** un container est lance
**Then** le container est cree avec `NetworkMode: "none"` (pas d'acces reseau)
**And** `networkId` est null dans `container_instances`

### AC2 : Bridge company isole
**Given** un profil avec `networkMode = "company-bridge"`
**When** un container est lance
**Then** un reseau Docker `mnm-company-{companyId}` est cree (ou reutilise)
**And** le container est attache a ce reseau
**And** `networkId` est enregistre dans `container_instances`

### AC3 : Mode host-restricted
**Given** un profil avec `networkMode = "host-restricted"`
**When** un container est lance
**Then** le container est cree avec `NetworkMode: "host"`
**And** `networkId` est null (utilise le reseau hote)

### AC4 : Isolation cross-company
**Given** deux companies A et B avec des containers en mode `company-bridge`
**When** les containers sont lances
**Then** les containers de company A sont sur `mnm-company-{companyA.id}`
**And** les containers de company B sont sur `mnm-company-{companyB.id}`
**And** les containers de A ne peuvent PAS communiquer avec ceux de B

### AC5 : Detachement au stop
**Given** un container attache a un reseau company-bridge
**When** le container est arrete
**Then** le container est detache du reseau avant le stop Docker

### AC6 : Cleanup reseaux orphelins
**Given** des reseaux Docker `mnm-company-*` sans containers actifs
**When** `cleanupOrphanNetworks()` est appele (ou au demarrage)
**Then** les reseaux orphelins sont supprimes
**And** un audit event `container.network_cleaned` est emis

### AC7 : API lister reseaux
**Given** un admin authentifie
**When** il appelle `GET /companies/:companyId/containers/networks`
**Then** la liste des reseaux de la company est retournee avec infos (id, nom, nombre de containers, cree le)

### AC8 : API supprimer reseau orphelin
**Given** un reseau Docker sans containers actifs
**When** un admin appelle `DELETE /companies/:companyId/containers/networks/:networkId`
**Then** le reseau est supprime
**And** un audit event `container.network_deleted` est emis

### AC9 : Refus suppression reseau actif
**Given** un reseau Docker avec des containers actifs
**When** un admin tente de le supprimer
**Then** 409 Conflict est retourne avec le nombre de containers actifs

### AC10 : Audit creation reseau
**Given** un premier container lance en mode `company-bridge` pour une company
**When** le reseau est cree
**Then** un audit event `container.network_created` est emis avec `targetType: "docker_network"`, `metadata: { networkName, companyId, driver: "bridge" }`

### AC11 : NetworkId dans getContainerStatus
**Given** un container attache a un reseau
**When** `GET /companies/:companyId/containers/:containerId` est appele
**Then** la reponse inclut `networkId` et le status du reseau

### AC12 : buildDockerCreateOptions integre le NetworkMode
**Given** un profil avec `networkMode` configure
**When** `buildDockerCreateOptions()` est appele
**Then** `HostConfig.NetworkMode` est defini selon le mode ("none", "bridge", ou "host")

---

## Design Technique

### 1. NetworkIsolationService

```typescript
// server/src/services/network-isolation.ts
const NETWORK_PREFIX = "mnm-company-";
const NETWORK_LABELS = { "managed-by": "mnm", "purpose": "container-isolation" };

export function networkIsolationService() {
  const docker = new Docker({ socketPath: "/var/run/docker.sock" });

  async function ensureCompanyNetwork(companyId: string): Promise<{ id: string; name: string; created: boolean }>;
  async function resolveNetworkConfig(networkMode: ContainerNetworkMode, companyId: string): Promise<{ networkMode: string; networkId: string | null }>;
  async function attachContainerToNetwork(dockerContainerId: string, networkId: string): Promise<void>;
  async function detachContainerFromNetwork(dockerContainerId: string, networkId: string): Promise<void>;
  async function listCompanyNetworks(companyId: string): Promise<NetworkInfo[]>;
  async function getNetworkInfo(networkId: string): Promise<NetworkInfo>;
  async function removeNetwork(networkId: string): Promise<void>;
  async function cleanupOrphanNetworks(): Promise<{ removed: string[]; errors: string[] }>;
}
```

### 2. Integration dans buildDockerCreateOptions

Ajout du parametre `networkMode` dans l'input et dans le `HostConfig` genere :

```typescript
HostConfig: {
  ...existingConfig,
  NetworkMode: networkMode, // "none" | "bridge" | "host"
}
```

### 3. Integration dans launchContainer

```
Steps additionnels apres step 11 (container started):
  12b. Resolve network mode from profile
  12c. If company-bridge: ensureCompanyNetwork() + attachContainerToNetwork()
  12d. Record networkId in container_instances
```

---

## data-test-id Mapping

| data-testid | Element | Type | AC |
|-------------|---------|------|-----|
| `cont-s04-network-isolation-service` | NetworkIsolationService export in barrel | code marker | AC1-AC6 |
| `cont-s04-ensure-company-network` | ensureCompanyNetwork function | code marker | AC2, AC4, AC10 |
| `cont-s04-resolve-network-config` | resolveNetworkConfig function | code marker | AC1, AC2, AC3 |
| `cont-s04-attach-container` | attachContainerToNetwork function | code marker | AC2, AC4 |
| `cont-s04-detach-container` | detachContainerFromNetwork function | code marker | AC5 |
| `cont-s04-list-networks` | listCompanyNetworks function | code marker | AC7 |
| `cont-s04-get-network-info` | getNetworkInfo function | code marker | AC7, AC11 |
| `cont-s04-remove-network` | removeNetwork function | code marker | AC8, AC9 |
| `cont-s04-cleanup-orphans` | cleanupOrphanNetworks function | code marker | AC6 |
| `cont-s04-cm-network-resolve` | ContainerManager network resolution in launchContainer | code marker | AC1, AC2, AC3, AC12 |
| `cont-s04-cm-network-attach` | ContainerManager attach call in launchContainer | code marker | AC2, AC4 |
| `cont-s04-cm-network-detach` | ContainerManager detach call in stopContainer | code marker | AC5 |
| `cont-s04-cm-network-cleanup` | ContainerManager orphan cleanup call | code marker | AC6 |
| `cont-s04-cm-build-network-mode` | buildDockerCreateOptions NetworkMode in HostConfig | code marker | AC12 |
| `cont-s04-route-list-networks` | GET /containers/networks route | code marker | AC7 |
| `cont-s04-route-get-network` | GET /containers/networks/:networkId route | code marker | AC7 |
| `cont-s04-route-delete-network` | DELETE /containers/networks/:networkId route | code marker | AC8, AC9 |
| `cont-s04-route-cleanup-networks` | POST /containers/networks/cleanup route | code marker | AC6 |
| `cont-s04-type-network-info` | NetworkInfo type in shared | code marker | AC7 |
| `cont-s04-type-network-cleanup-result` | NetworkCleanupResult type in shared | code marker | AC6 |
| `cont-s04-audit-network-created` | Audit event container.network_created | code marker | AC10 |
| `cont-s04-audit-network-deleted` | Audit event container.network_deleted | code marker | AC8 |
| `cont-s04-audit-network-cleaned` | Audit event container.network_cleaned | code marker | AC6 |
| `cont-s04-instance-network-id` | networkId column set in container_instances | code marker | AC2, AC11 |

---

## Test Cases (Playwright E2E -- file-content based)

### T01-T03 : Service file structure
- T01: `network-isolation.ts` exists and exports `networkIsolationService`
- T02: `network-isolation.ts` imports Docker from "dockerode"
- T03: `network-isolation.ts` defines NETWORK_PREFIX constant

### T04-T08 : ensureCompanyNetwork
- T04: Function `ensureCompanyNetwork` exists
- T05: Function builds network name with `mnm-company-` prefix
- T06: Function calls `docker.createNetwork` with bridge driver
- T07: Function uses labels `managed-by: mnm`
- T08: Function catches "already exists" error and returns existing network

### T09-T12 : resolveNetworkConfig
- T09: Function `resolveNetworkConfig` exists
- T10: Returns `{ networkMode: "none" }` for "isolated" mode
- T11: Returns `{ networkMode: "bridge" }` and calls ensureCompanyNetwork for "company-bridge"
- T12: Returns `{ networkMode: "host" }` for "host-restricted" mode

### T13-T16 : attachContainerToNetwork / detachContainerFromNetwork
- T13: Function `attachContainerToNetwork` exists
- T14: Function calls `network.connect({ Container })`
- T15: Function `detachContainerFromNetwork` exists
- T16: Function calls `network.disconnect({ Container })`

### T17-T20 : listCompanyNetworks / getNetworkInfo
- T17: Function `listCompanyNetworks` exists
- T18: Function filters networks by label `managed-by: mnm` and `company-id` label
- T19: Function `getNetworkInfo` exists
- T20: Function returns id, name, containerCount, createdAt

### T21-T23 : removeNetwork
- T21: Function `removeNetwork` exists
- T22: Function calls `network.inspect()` to check containers
- T23: Function throws conflict if containers are attached

### T24-T27 : cleanupOrphanNetworks
- T24: Function `cleanupOrphanNetworks` exists
- T25: Function lists all networks with `mnm-company-` prefix
- T26: Function removes networks with 0 containers
- T27: Function returns `{ removed, errors }` arrays

### T28-T32 : ContainerManager integration -- launchContainer
- T28: `container-manager.ts` imports `networkIsolationService`
- T29: `launchContainer` contains `cont-s04-cm-network-resolve` comment
- T30: `launchContainer` calls `resolveNetworkConfig` with profile networkMode
- T31: `launchContainer` calls `attachContainerToNetwork` for company-bridge mode
- T32: `launchContainer` sets `networkId` in `container_instances` update

### T33-T35 : ContainerManager integration -- stopContainer
- T33: `stopContainer` contains `cont-s04-cm-network-detach` comment
- T34: `stopContainer` calls `detachContainerFromNetwork` when networkId is present
- T35: `stopContainer` handles detach errors gracefully (try/catch)

### T36-T37 : ContainerManager integration -- cleanup
- T36: `cleanupStaleContainers` contains `cont-s04-cm-network-cleanup` comment
- T37: `cleanupStaleContainers` calls `cleanupOrphanNetworks`

### T38-T40 : buildDockerCreateOptions
- T38: `buildDockerCreateOptions` accepts `networkMode` parameter
- T39: `buildDockerCreateOptions` sets `NetworkMode` in `HostConfig`
- T40: Default NetworkMode is "none" when not specified

### T41-T44 : Routes -- list/get networks
- T41: Route `GET /companies/:companyId/containers/networks` exists in containers.ts
- T42: Route `GET /companies/:companyId/containers/networks/:networkId` exists
- T43: Both routes use `requirePermission(db, "agents:manage_containers")`
- T44: Route handlers call `networkIsolationService` functions

### T45-T48 : Routes -- delete/cleanup networks
- T45: Route `DELETE /companies/:companyId/containers/networks/:networkId` exists
- T46: Route `POST /companies/:companyId/containers/networks/cleanup` exists
- T47: Delete route emits audit event `container.network_deleted`
- T48: Cleanup route emits audit event `container.network_cleaned`

### T49-T52 : Types and exports
- T49: `container.ts` in shared types exports `NetworkInfo` interface
- T50: `NetworkInfo` has fields: id, name, companyId, driver, containerCount, createdAt
- T51: `container.ts` exports `NetworkCleanupResult` interface
- T52: `types/index.ts` exports `NetworkInfo` and `NetworkCleanupResult`

### T53-T55 : Barrel exports
- T53: `server/src/services/index.ts` exports `networkIsolationService`
- T54: Route uses `assertCompanyAccess` for company isolation
- T55: Route uses `getActorInfo` for audit actor

### T56-T58 : Audit events
- T56: `container-manager.ts` emits `container.network_created` audit on new network creation
- T57: `containers.ts` routes emit `container.network_deleted` audit on network deletion
- T58: `containers.ts` routes emit `container.network_cleaned` audit on cleanup

---

## Fichiers a creer

| Fichier | Description |
|---------|------------|
| `server/src/services/network-isolation.ts` | NetworkIsolationService -- gestion des reseaux Docker isoles |

## Fichiers a modifier

| Fichier | Modifications |
|---------|--------------|
| `server/src/services/container-manager.ts` | Integration network isolation dans launch, stop, cleanup, buildDockerCreateOptions |
| `server/src/routes/containers.ts` | 4 nouvelles routes pour reseaux |
| `packages/shared/src/types/container.ts` | Types NetworkInfo, NetworkCleanupResult |
| `packages/shared/src/types/index.ts` | Export des nouveaux types |
| `server/src/services/index.ts` | Export networkIsolationService |
