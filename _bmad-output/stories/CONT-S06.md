# CONT-S06 — UI Container Status

> **Epic** : CONT — Containerisation
> **Sprint** : 10 (Batch 10 — Container avancé + Chat)
> **Assignation** : Cofondateur (frontend)
> **Effort** : M (3 SP, 2-3j)
> **Bloqué par** : CONT-S01 (ContainerManager Docker)
> **Débloque** : —
> **Statut** : IN_PROGRESS

---

## 1. Contexte

L'API de gestion des containers Docker (CONT-S01/S02/S03/S04/S05) est complète :
- `GET /companies/:companyId/containers` — liste des instances avec status, resource usage, agent name, profile
- `GET /companies/:companyId/containers/:containerId` — détail d'une instance
- `POST /companies/:companyId/containers/:containerId/stop` — arrêt graceful
- `DELETE /companies/:companyId/containers/:containerId` — destruction
- `GET /companies/:companyId/containers/health` — santé Docker
- `GET /companies/:companyId/containers/profiles` — profils
- Types partagés : `ContainerInfoFull`, `ContainerStatus`, `ContainerResourceUsage`, `ContainerHealthCheckStatus`

Il manque la couche UI pour permettre aux administrateurs et managers de visualiser et gérer les containers actifs.

## 2. Objectif

Créer une page **Containers** dans le cockpit MnM affichant :
1. Les containers actifs et leur statut en temps réel
2. Des badges colorés par statut
3. L'utilisation des ressources (CPU, mémoire)
4. Des actions Start/Stop/Destroy par container
5. Un indicateur de santé Docker
6. Auto-refresh via React Query

## 3. Acceptance Criteria (Given/When/Then)

### AC-01: Page Containers accessible
- **Given** un admin/manager connecté
- **When** il navigue vers `/containers`
- **Then** la page Containers s'affiche avec le titre et la table des containers

### AC-02: Table des containers
- **Given** la page Containers chargée
- **When** des containers existent
- **Then** la table affiche : Agent Name, Profile, Status (badge), CPU %, Memory %, Created, Actions

### AC-03: Status badges couleur
- **Given** un container dans la table
- **When** son statut est `running`
- **Then** le badge est vert
- **When** son statut est `stopped` ou `exited`
- **Then** le badge est gris
- **When** son statut est `failed`
- **Then** le badge est rouge
- **When** son statut est `creating` ou `pending`
- **Then** le badge est jaune/amber

### AC-04: Resource usage display
- **Given** un container `running` avec `resourceUsage`
- **When** il est affiché dans la table
- **Then** CPU% et Memory% sont montrés avec barres de progression

### AC-05: Action Stop
- **Given** un container `running`
- **When** l'admin clique "Stop"
- **Then** un dialog de confirmation apparaît avec champ reason optionnel
- **When** il confirme
- **Then** POST stop est appelé et la table se rafraîchit

### AC-06: Action Destroy
- **Given** un container `running` ou `stopped`
- **When** l'admin clique "Destroy"
- **Then** un dialog de confirmation destructif apparaît
- **When** il confirme
- **Then** DELETE est appelé et le container disparaît

### AC-07: Docker health indicator
- **Given** la page Containers
- **When** elle charge
- **Then** un indicateur de santé Docker est affiché (vert=available, rouge=unavailable)

### AC-08: Empty state
- **Given** aucun container n'existe
- **When** la page charge
- **Then** un état vide est affiché avec message explicatif

### AC-09: Status filter
- **Given** la page avec des containers
- **When** l'admin sélectionne un filtre statut (ex: "running")
- **Then** seuls les containers de ce statut sont affichés

### AC-10: Auto-refresh
- **Given** la page Containers affichée
- **When** 10 secondes passent
- **Then** les données sont automatiquement rechargées (React Query refetchInterval)

### AC-11: Sidebar navigation
- **Given** un admin/manager
- **When** il regarde la sidebar
- **Then** un item "Containers" est visible dans la section "Company"

### AC-12: Route protection
- **Given** un viewer sans permission `agents:manage_containers`
- **When** il tente d'accéder à `/containers`
- **Then** la page Forbidden s'affiche

## 4. Deliverables

### D1: API Client (`ui/src/api/containers.ts`)
- `containersApi.list(companyId, filters?)` → `GET /companies/:companyId/containers`
- `containersApi.getById(companyId, containerId)` → `GET /companies/:companyId/containers/:containerId`
- `containersApi.stop(companyId, containerId, body?)` → `POST /companies/:companyId/containers/:containerId/stop`
- `containersApi.destroy(companyId, containerId)` → `DELETE /companies/:companyId/containers/:containerId`
- `containersApi.dockerHealth(companyId)` → `GET /companies/:companyId/containers/health`

### D2: Query Keys (`ui/src/lib/queryKeys.ts`)
- `containers.list(companyId, filters?)` — liste des containers
- `containers.detail(companyId, containerId)` — détail
- `containers.health(companyId)` — santé Docker

### D3: Page Containers (`ui/src/pages/Containers.tsx`)
- Header avec titre + Docker health indicator
- Filtre par statut
- Table des containers avec colonnes : Agent, Profile, Status, CPU, Memory, Created, Actions
- Empty state
- Auto-refresh 10s

### D4: Container Status Badge (`ui/src/components/ContainerStatusBadge.tsx`)
- Badge coloré par statut avec icône
- running → green + Loader icon
- stopped/exited → gray + Square icon
- failed → red + XCircle icon
- creating/pending → amber + Clock icon
- stopping → orange + Loader icon

### D5: Stop Container Dialog (`ui/src/components/StopContainerDialog.tsx`)
- Dialog de confirmation avec champ reason optionnel
- Appelle `containersApi.stop()`
- Invalide la query list au succès

### D6: Destroy Container Dialog (`ui/src/components/DestroyContainerDialog.tsx`)
- Dialog destructif (bouton rouge)
- Appelle `containersApi.destroy()`
- Invalide la query list au succès

### D7: Route + Sidebar (`ui/src/App.tsx` + `ui/src/components/Sidebar.tsx`)
- Route `/containers` protégée par `agents:manage_containers`
- Item sidebar "Containers" avec icône Container/Box
- Permission guard `agents:manage_containers`

### D8: API barrel export (`ui/src/api/index.ts`)
- Export `containersApi`

## 5. data-testid Map

| data-testid | Element | Deliverable |
|---|---|---|
| `cont-s06-page` | Page wrapper | D3 |
| `cont-s06-title` | Page title "Containers" | D3 |
| `cont-s06-health-indicator` | Docker health badge | D3 |
| `cont-s06-health-available` | Docker available text | D3 |
| `cont-s06-health-unavailable` | Docker unavailable text | D3 |
| `cont-s06-filter-status` | Status filter select | D3 |
| `cont-s06-table` | Container table | D3 |
| `cont-s06-table-header` | Table header row | D3 |
| `cont-s06-table-row` | Individual container row | D3 |
| `cont-s06-agent-name` | Agent name cell | D3 |
| `cont-s06-profile-name` | Profile name cell | D3 |
| `cont-s06-status-badge` | Status badge | D4 |
| `cont-s06-cpu-bar` | CPU usage progress bar | D3 |
| `cont-s06-cpu-value` | CPU percentage text | D3 |
| `cont-s06-memory-bar` | Memory usage progress bar | D3 |
| `cont-s06-memory-value` | Memory percentage text | D3 |
| `cont-s06-created-at` | Created timestamp | D3 |
| `cont-s06-btn-stop` | Stop button | D3 |
| `cont-s06-btn-destroy` | Destroy button | D3 |
| `cont-s06-empty-state` | Empty state wrapper | D3 |
| `cont-s06-empty-title` | Empty state title | D3 |
| `cont-s06-empty-description` | Empty state description | D3 |
| `cont-s06-loading` | Loading skeleton | D3 |
| `cont-s06-error` | Error state | D3 |
| `cont-s06-stop-dialog` | Stop dialog wrapper | D5 |
| `cont-s06-stop-reason` | Stop reason textarea | D5 |
| `cont-s06-stop-confirm` | Stop confirm button | D5 |
| `cont-s06-stop-cancel` | Stop cancel button | D5 |
| `cont-s06-destroy-dialog` | Destroy dialog wrapper | D6 |
| `cont-s06-destroy-confirm` | Destroy confirm button | D6 |
| `cont-s06-destroy-cancel` | Destroy cancel button | D6 |
| `cont-s06-nav-containers` | Sidebar nav item | D7 |
| `cont-s06-container-count` | Container count badge in header | D3 |
| `cont-s06-refresh-indicator` | Auto-refresh indicator | D3 |

## 6. Technical Notes

### API Integration
- Use `@tanstack/react-query` with `refetchInterval: 10_000` for auto-refresh
- Use `useMutation` for stop/destroy with `onSuccess` → `queryClient.invalidateQueries`
- Company ID from `useCompany()` context

### Status Color Mapping
```typescript
const STATUS_COLORS: Record<ContainerStatus, string> = {
  running: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  stopped: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
  exited: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  creating: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  stopping: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
};
```

### Permission
- Route protection: `agents:manage_containers`
- Sidebar visibility: `agents:manage_containers`
- Actions (stop/destroy) available for all users with page access

### Responsive
- Table scrolls horizontally on small screens
- Resource bars hidden on mobile

## 7. Test Mapping (QA Agent)

| Test ID | AC | Description |
|---|---|---|
| T01-T05 | — | File existence checks |
| T06-T12 | D1 | API client functions |
| T13-T15 | D2 | Query keys |
| T16-T22 | D3 | Page structure and elements |
| T23-T29 | D4 | Status badge colors and icons |
| T30-T35 | AC-05 | Stop dialog |
| T36-T40 | AC-06 | Destroy dialog |
| T41-T45 | AC-09 | Status filter |
| T46-T50 | AC-07 | Docker health indicator |
| T51-T55 | AC-08 | Empty state |
| T56-T60 | D7 | Route + sidebar + permission |
| T61-T65 | AC-10 | Auto-refresh config |
| T66-T70 | D8 | Barrel exports |
