# DRIFT-S03 : UI Diff Visuel Drift -- Page de visualisation des alertes drift avec diff attendu/observe

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | DRIFT-S03 |
| **Titre** | UI Diff Visuel Drift -- Page de visualisation des alertes drift avec diff attendu/observe |
| **Epic** | Epic DRIFT -- Drift Detection (Noyau A) |
| **Sprint** | Sprint 5 (Batch 9) |
| **Effort** | M (5 SP, 3-5j) |
| **Priorite** | P0 -- CTO "Sais quoi faire en < 5 min" (Defining Experience #3) |
| **Assignation** | Cofondateur (frontend) |
| **Bloque par** | DRIFT-S02 (Drift monitor service) -- DONE |
| **Debloque** | Aucune dependance bloquante (story terminale de l'epic DRIFT) |
| **ADR** | ADR-007 (Observabilite), ADR-003 (Orchestrateur Deterministe) |
| **Type** | Frontend (composants React + API client + hooks + integration page Drift existante) |
| **FRs couverts** | REQ-ORCH-05 (Drift detection basique <15min P0 -- partie UI) |

---

## Description

### Contexte -- Pourquoi cette story est necessaire

Les stories DRIFT-S01 et DRIFT-S02 ont construit la fondation backend du drift detection :
- **DRIFT-S01** : tables DB `drift_reports`/`drift_items` + service de persistance + routes CRUD
- **DRIFT-S02** : drift monitor service actif qui detecte 5 types de deviations d'execution (time_exceeded, stagnation, retry_excessive, stage_skipped, sequence_violation) et emet des alertes WebSocket

Mais **aucune UI n'existe** pour visualiser ces alertes d'execution en temps reel. La page `Drift.tsx` actuelle ne montre que les drifts de documents statiques (comparaison planning artifacts). Les alertes du drift monitor (DRIFT-S02) n'ont aucune surface UI.

L'UX Design B2B definit l'experience "Premiere Alerte Drift" (Defining Experience #3) comme un moment cle :
> Badge rouge sur l'etape du pipeline -> notification toast -> panneau drift : attendu vs observe en diff visuel -> severite (Info/Warning/Critical) -> actions proposees (Ignorer/Recharger/Kill+relance/Alerter CTO)

### Ce que cette story construit

1. **API client `driftAlertsApi`** dans `ui/src/api/drift.ts` :
   - `listAlerts(companyId, filters)` -- GET /companies/:companyId/drift/alerts
   - `resolveAlert(companyId, alertId, body)` -- POST /companies/:companyId/drift/alerts/:alertId/resolve
   - `getMonitoringStatus(companyId)` -- GET /companies/:companyId/drift/monitoring/status
   - `startMonitoring(companyId, config?)` -- POST /companies/:companyId/drift/monitoring/start
   - `stopMonitoring(companyId)` -- POST /companies/:companyId/drift/monitoring/stop

2. **Hook `useDriftAlerts`** dans `ui/src/hooks/useDriftAlerts.ts` :
   - `useDriftAlerts(companyId, filters?)` -- React Query hook pour lister les alertes avec refetch auto
   - `useDriftAlertResolve(companyId)` -- Mutation pour resoudre une alerte
   - `useDriftMonitoringStatus(companyId)` -- Query statut monitoring
   - `useDriftMonitoringToggle(companyId)` -- Mutation start/stop monitoring

3. **Composant `DriftAlertPanel.tsx`** -- panneau de detail d'une alerte drift d'execution :
   - Vue diff comparee : attendu (template workflow) vs observe (execution reelle)
   - Badge severite (critical/moderate/minor) avec couleur et icone
   - Badge type d'alerte (time_exceeded, stagnation, etc.) avec label humain
   - Metadata contextuelle : stageId, workflowInstanceId, duree, retryCount
   - Actions de resolution : Acknowledge, Ignore, Remediate avec note optionnelle
   - Timestamps : creation, resolution
   - Etat resolu affiche en mode collapsed avec resolution info

4. **Composant `DriftMonitorToggle.tsx`** -- bouton toggle pour activer/desactiver le monitoring :
   - Bouton toggle On/Off avec indicateur visuel d'etat
   - Status info : nombre d'alertes actives, derniere verification, configuration
   - Permission gate : visible seulement si `workflows:enforce`

5. **Section "Execution Drift Alerts"** ajoutee dans la page `Drift.tsx` existante :
   - Onglet ou section separee pour les alertes d'execution (distinct des drifts de documents)
   - Liste filtrable par severite, type d'alerte, statut (active/resolved)
   - Badge count dans le header avec le nombre d'alertes actives
   - MonitorToggle dans le header
   - Empty state quand le monitoring est desactive ou aucune alerte

6. **Query keys** enrichis dans `ui/src/lib/queryKeys.ts` :
   - `drift.alerts(companyId, filters)` -- alertes d'execution
   - `drift.monitoringStatus(companyId)` -- statut monitoring

### Ce que cette story ne fait PAS (scope)

- Pas de toast notification temps reel via WebSocket (sera fait quand le composant useWebSocket sera integre -- CHAT-S04)
- Pas de kill+relance d'agent depuis l'UI (COMP-S02)
- Pas de lien vers le workflow pipeline visuel (ORCH-S05)
- Pas de drag-and-drop ou modification de workflow
- Pas de notifications push browser
- Pas de modification du drift monitor backend (DRIFT-S02 est DONE et inchange)

---

## Etat Actuel du Code (Analyse)

### Page Drift existante (`ui/src/pages/Drift.tsx`)

La page actuelle (299 lignes) est dediee aux **drifts de documents** (planning artifacts). Elle affiche :
- Selecteur de projet
- Bouton Scan/Cancel
- Progress bar pendant le scan
- Liste de DriftAlertCard (composant existant pour drifts de documents)
- Stats (pending, critical, resolved)

Elle utilise :
- `useDriftResults(projectId, companyId)` -- hook pour les rapports de drift documents
- `useDriftScan()`, `useDriftScanStatus()`, `useDriftCancelScan()` -- scan control
- `useDriftResolve()` -- resolution de drifts documents
- `DriftAlertCard` composant -- affiche un DriftItem de type document

### API client drift existant (`ui/src/api/drift.ts`)

6 fonctions pour les drifts de documents. **Aucune** fonction pour les alertes d'execution (DRIFT-S02 routes).

Les routes backend DRIFT-S02 sont :
- `GET /companies/:companyId/drift/alerts` -- lister les alertes
- `POST /companies/:companyId/drift/alerts/:alertId/resolve` -- resoudre
- `GET /companies/:companyId/drift/monitoring/status` -- statut monitoring
- `POST /companies/:companyId/drift/monitoring/start` -- demarrer
- `POST /companies/:companyId/drift/monitoring/stop` -- arreter

### Composant DriftAlertCard existant (`ui/src/components/DriftAlertCard.tsx`)

Ce composant est concu pour les drifts de **documents** (DriftItem avec driftType: scope_expansion | approach_change | design_deviation). Il ne gere pas les alertes d'**execution** (DriftAlert avec alertType: time_exceeded | stagnation | etc.).

Le nouveau composant `DriftAlertPanel` sera dedie aux alertes d'execution et sera structurellement different (diff attendu/observe, metadata workflow, actions de resolution differentes).

### Types partages disponibles

```typescript
// Deja disponibles via DRIFT-S02 dans @mnm/shared
type DriftAlertType = "time_exceeded" | "stagnation" | "retry_excessive" | "stage_skipped" | "sequence_violation";
interface DriftAlert { id, companyId, projectId, workflowInstanceId, stageId, alertType, severity, message, metadata, resolved, resolvedAt, resolvedBy, resolution, resolutionNote, createdAt }
interface DriftMonitorConfig { defaultStageTimeoutMs, stagnationTimeoutMs, retryAlertThreshold, checkIntervalMs, enabled }
interface DriftMonitorStatus { active, activeAlertCount, startedAt, lastCheckAt, config }
```

### Query keys existants

```typescript
drift: {
  results: (projectId: string) => ["drift", "results", projectId],
  check: (projectId: string) => ["drift", "check", projectId],
  status: (projectId: string) => ["drift", "status", projectId],
}
```

Manquent : `drift.alerts`, `drift.monitoringStatus`.

### UX Design -- Direction C "Adaptive Cockpit"

- Couleurs severite : critical = rouge (#DC2626), moderate/warning = orange (#D97706), minor = vert (#16A34A)
- Triple encodage : couleur + icone + texte pour chaque statut
- Hierarchie visuelle : alertes critiques en Niveau 1 (focal), resolues en Niveau 3 (secondaire)
- Actions inline : resolution directe depuis la carte d'alerte

---

## Architecture des Composants

### Diagramme des composants

```
ui/src/pages/Drift.tsx (modifie)
  |
  +-- (Section existante: Document Drift)
  |   +-- DriftAlertCard.tsx (existant, inchange)
  |
  +-- (Nouvelle section: Execution Drift Alerts)
      +-- DriftMonitorToggle.tsx (nouveau)
      |   +-- useDriftMonitoringStatus()
      |   +-- useDriftMonitoringToggle()
      |   +-- usePermissions() -> "workflows:enforce"
      |
      +-- DriftAlertPanel.tsx (nouveau, repete pour chaque alerte)
      |   +-- Badge severite (critical/moderate/minor)
      |   +-- Badge alertType (label humain)
      |   +-- Diff visuel attendu/observe
      |   +-- Metadata (stageId, workflow, duree, retries)
      |   +-- Actions resolution (Acknowledge/Ignore/Remediate)
      |   +-- useDriftAlertResolve()
      |
      +-- Filtres (severite, type, statut)
      +-- useDriftAlerts(companyId, filters)
```

### Flux de donnees

```
1. Drift.tsx monte -> useDriftAlerts(companyId) fetche GET /companies/:cid/drift/alerts
2. Alertes rendues via DriftAlertPanel.tsx (une par alerte)
3. User clique "Acknowledge" -> useDriftAlertResolve.mutate() -> POST .../resolve
4. onSuccess -> invalidate queryKeys.drift.alerts -> refetch automatique
5. DriftMonitorToggle -> useDriftMonitoringStatus() -> GET .../monitoring/status
6. User toggle -> useDriftMonitoringToggle.mutate() -> POST .../start ou .../stop
```

---

## Design Visuel

### Layout de la page Drift (enrichie)

```
+============================================================+
| [Radar icon] Drift Detection                               |
|                                                             |
| [Tab: Documents]  [Tab: Execution Alerts (3)]              |
+============================================================+

--- Tab "Execution Alerts" ---

+------------------------------------------------------------+
| Monitoring: [ON/OFF toggle]  |  3 active  |  Last: 2m ago  |
+------------------------------------------------------------+
| Filters: [Severity v] [Type v] [Status v]  [Clear]        |
+------------------------------------------------------------+

+------------------------------------------------------------+
| CRITICAL  sequence_violation                    2 min ago  |
| Stage "Code" started while "Design" not complete           |
|                                                             |
| +--- Expected ---+  +--- Observed ---+                     |
| | Stage "Design"  |  | Stage "Design"  |                   |
| | -> completed    |  | -> in_progress  |                   |
| +----------------+  +-----------------+                     |
|                                                             |
| Workflow: wf-abc123  Stage: stage-def456                   |
|                                                             |
| [Acknowledge] [Ignore] [Remediate]                         |
+------------------------------------------------------------+

+------------------------------------------------------------+
| MODERATE  time_exceeded                         5 min ago  |
| Stage "Test" has been in progress for 18 min (max: 15)     |
| ...                                                         |
+------------------------------------------------------------+
```

### DriftAlertPanel -- Detail d'une alerte

```
+============================================================+
| [AlertTriangle/AlertCircle/Info icon]                      |
| [CRITICAL badge] [sequence_violation badge]    [2 min ago] |
|                                                             |
| Stage "Code" (order 2) started while previous stage        |
| "Design" (order 1) is in state "in_progress"               |
|                                                             |
| +--- Expected Execution ---+  +--- Observed Execution ---+ |
| | Previous stage "Design"  |  | Previous stage "Design"   | |
| | State: completed/skipped |  | State: in_progress        | |
| | Then "Code" can start    |  | But "Code" started anyway | |
| +-------------------------+  +---------------------------+ |
|                                                             |
| Metadata:                                                  |
| Workflow: wf-abc123                                        |
| Stage: stage-def456                                        |
| Previous Stage: stage-ghi789 (in_progress)                 |
|                                                             |
| +--Resolution Note (optional)--+                           |
| | [textarea placeholder]       |                           |
| +------------------------------+                           |
|                                                             |
| [Acknowledge] [Ignore] [Remediate]                         |
+============================================================+
```

### Couleurs et icones par severite

| Severite | Icone | Couleur card | Badge |
|----------|-------|-------------|-------|
| critical | AlertTriangle | `bg-red-50 border-red-200 dark:bg-red-950/30` | `bg-red-100 text-red-700 dark:bg-red-900/50` |
| moderate | AlertCircle | `bg-amber-50 border-amber-200 dark:bg-amber-950/30` | `bg-amber-100 text-amber-700 dark:bg-amber-900/50` |
| minor | Info | `bg-green-50 border-green-200 dark:bg-green-950/30` | `bg-green-100 text-green-700 dark:bg-green-900/50` |

### Labels humains des alertTypes

| AlertType | Label affiche | Description courte |
|-----------|--------------|-------------------|
| time_exceeded | Time Exceeded | Stage depasse la duree max |
| stagnation | Stagnation | Aucune activite depuis trop longtemps |
| retry_excessive | Excessive Retries | Trop de tentatives de relance |
| stage_skipped | Stage Skipped | Etape sautee sans execution |
| sequence_violation | Sequence Violation | Etape demarree hors ordre |

---

## Acceptance Criteria

### AC-1 : API client pour les alertes d'execution

**Given** le fichier `ui/src/api/drift.ts`
**When** il est enrichi
**Then** il exporte `driftAlertsApi` avec les fonctions `listAlerts`, `resolveAlert`, `getMonitoringStatus`, `startMonitoring`, `stopMonitoring`

**Given** la fonction `listAlerts(companyId, filters?)`
**When** elle est appelee
**Then** elle fait un GET vers `/companies/:companyId/drift/alerts` avec les query params severity, limit, offset

### AC-2 : Hook useDriftAlerts avec React Query

**Given** le hook `useDriftAlerts(companyId, filters?)`
**When** il est monte avec un companyId valide
**Then** il retourne `{ data: { data: DriftAlert[], total: number }, isLoading, error }`
**And** le queryKey utilise `queryKeys.drift.alerts(companyId, filters)`

**Given** une mutation `useDriftAlertResolve`
**When** une alerte est resolue
**Then** le cache `drift.alerts` est invalide et les alertes sont re-fetchees

### AC-3 : Composant DriftAlertPanel affichant le diff attendu/observe

**Given** une alerte drift de type `sequence_violation`
**When** le DriftAlertPanel est rendu
**Then** il affiche :
  - Badge severite avec couleur (critical = rouge, moderate = orange, minor = vert)
  - Badge type d'alerte avec label humain ("Sequence Violation")
  - Le message de l'alerte
  - Une section diff side-by-side "Expected" vs "Observed"
  - Les metadata (workflowInstanceId, stageId)
  - Le timestamp de creation (format relatif "2 min ago")

**Given** une alerte drift de type `time_exceeded`
**When** le DriftAlertPanel est rendu
**Then** la section diff montre :
  - Expected : "Stage should complete in < 15 min"
  - Observed : "Stage has been in progress for 18 min"

### AC-4 : Actions de resolution sur les alertes

**Given** une alerte drift non resolue
**When** l'utilisateur clique "Acknowledge"
**Then** une mutation POST /companies/:cid/drift/alerts/:aid/resolve est envoyee avec `{ resolution: "acknowledged" }`
**And** l'alerte passe en etat resolu dans l'UI

**Given** une alerte drift non resolue
**When** l'utilisateur clique "Remediate" avec une note
**Then** une mutation est envoyee avec `{ resolution: "remediated", note: "..." }`
**And** la note est affichee dans l'alerte resolue

**Given** une alerte resolue
**When** elle est renderee
**Then** les boutons d'action sont masques et le statut de resolution est affiche

### AC-5 : Section Execution Alerts dans la page Drift

**Given** la page Drift.tsx
**When** elle est chargee
**Then** deux onglets sont visibles : "Documents" (contenu existant) et "Execution Alerts"
**And** l'onglet "Execution Alerts" affiche un badge count avec le nombre d'alertes actives

**Given** l'onglet "Execution Alerts" est selectionne
**When** des alertes existent
**Then** elles sont affichees en liste, triees par date de creation (plus recentes en premier)
**And** chaque alerte est un composant DriftAlertPanel

### AC-6 : Filtres sur les alertes d'execution

**Given** l'onglet "Execution Alerts"
**When** l'utilisateur selectionne le filtre severite "critical"
**Then** seules les alertes de severite critical sont affichees

**Given** l'onglet "Execution Alerts"
**When** l'utilisateur selectionne le filtre type "time_exceeded"
**Then** seules les alertes de type time_exceeded sont affichees

**Given** l'onglet "Execution Alerts"
**When** l'utilisateur selectionne le filtre statut "resolved"
**Then** seules les alertes resolues sont affichees

### AC-7 : DriftMonitorToggle avec permission gate

**Given** un utilisateur avec la permission `workflows:enforce`
**When** la page Drift s'affiche
**Then** le toggle de monitoring est visible et cliquable

**Given** un utilisateur sans la permission `workflows:enforce`
**When** la page Drift s'affiche
**Then** le toggle de monitoring est absent du DOM (pas grise, absent)

**Given** le monitoring est arrete (inactive)
**When** l'utilisateur clique le toggle
**Then** POST /companies/:cid/drift/monitoring/start est appele
**And** le toggle passe a "ON"
**And** le statut affiche "Monitoring active"

### AC-8 : Empty state quand pas d'alertes ou monitoring inactif

**Given** le monitoring est inactif
**When** l'onglet "Execution Alerts" est selectionne
**Then** un empty state s'affiche avec le message "Drift monitoring is not active" et un bouton pour activer

**Given** le monitoring est actif mais aucune alerte n'existe
**When** l'onglet "Execution Alerts" est selectionne
**Then** un empty state s'affiche avec le message "No drift alerts detected" et un indicateur vert

### AC-9 : Query keys enrichis

**Given** le fichier `ui/src/lib/queryKeys.ts`
**When** il est modifie
**Then** le namespace `drift` contient les cles `alerts(companyId, filters?)` et `monitoringStatus(companyId)`

### AC-10 : Accessibilite

**Given** la section Execution Alerts
**When** un utilisateur navigue au clavier
**Then** tous les boutons et filtres sont accessibles via Tab/Shift+Tab
**And** les boutons d'action ont des `aria-label` descriptifs
**And** les alertes ont des roles ARIA semantiques (`role="alert"` pour critical)
**And** les badges de severite ont un texte lisible (pas que de la couleur)

### AC-11 : Responsive

**Given** la page Drift sur un ecran < 768px
**When** les alertes sont affichees
**Then** le diff side-by-side passe en layout vertical (stacked)
**And** les filtres passent en layout vertical

---

## data-test-id Reference Table

### Page Drift enrichie

| Element | data-testid | Description |
|---------|-------------|-------------|
| Page container | `drift-s03-page` | Container principal de la section execution alerts |
| Tab Documents | `drift-s03-tab-documents` | Onglet drift documents (contenu existant) |
| Tab Execution Alerts | `drift-s03-tab-execution` | Onglet alertes d'execution |
| Tab badge count | `drift-s03-tab-execution-count` | Badge count alertes actives sur l'onglet |
| Loading state | `drift-s03-loading` | Skeleton pendant le chargement |
| Error state | `drift-s03-error` | Message d'erreur si le fetch echoue |
| Empty state (monitoring off) | `drift-s03-empty-monitoring-off` | Empty state quand monitoring inactif |
| Empty state (no alerts) | `drift-s03-empty-no-alerts` | Empty state quand aucune alerte |
| Alerts list | `drift-s03-alerts-list` | Container de la liste des alertes |

### Filtres

| Element | data-testid | Description |
|---------|-------------|-------------|
| Filters container | `drift-s03-filters` | Container des filtres |
| Filter severity | `drift-s03-filter-severity` | Select filtre severite |
| Filter type | `drift-s03-filter-type` | Select filtre type d'alerte |
| Filter status | `drift-s03-filter-status` | Select filtre statut (active/resolved) |
| Filter clear | `drift-s03-filter-clear` | Bouton reset filtres |

### DriftMonitorToggle

| Element | data-testid | Description |
|---------|-------------|-------------|
| Toggle container | `drift-s03-monitor-toggle` | Container du toggle monitoring |
| Toggle button | `drift-s03-monitor-toggle-btn` | Bouton on/off du monitoring |
| Toggle status text | `drift-s03-monitor-status` | Texte statut ("Active" / "Inactive") |
| Alert count badge | `drift-s03-monitor-alert-count` | Badge nombre d'alertes actives |
| Last check timestamp | `drift-s03-monitor-last-check` | Timestamp derniere verification |

### DriftAlertPanel

| Element | data-testid | Description |
|---------|-------------|-------------|
| Alert card (dynamic) | `drift-s03-alert-{alertId}` | Container d'une alerte (par ID) |
| Severity badge | `drift-s03-alert-{alertId}-severity` | Badge severite (critical/moderate/minor) |
| Alert type badge | `drift-s03-alert-{alertId}-type` | Badge type d'alerte |
| Alert message | `drift-s03-alert-{alertId}-message` | Message descriptif de l'alerte |
| Timestamp | `drift-s03-alert-{alertId}-timestamp` | Timestamp de creation |
| Diff container | `drift-s03-alert-{alertId}-diff` | Container diff expected/observed |
| Diff expected | `drift-s03-alert-{alertId}-diff-expected` | Panneau "Expected" |
| Diff observed | `drift-s03-alert-{alertId}-diff-observed` | Panneau "Observed" |
| Metadata section | `drift-s03-alert-{alertId}-metadata` | Section metadata (workflowId, stageId) |
| Metadata workflow | `drift-s03-alert-{alertId}-metadata-workflow` | Workflow instance ID |
| Metadata stage | `drift-s03-alert-{alertId}-metadata-stage` | Stage ID |
| Resolution note input | `drift-s03-alert-{alertId}-note` | Textarea pour la note de resolution |
| Action acknowledge | `drift-s03-alert-{alertId}-action-acknowledge` | Bouton "Acknowledge" |
| Action ignore | `drift-s03-alert-{alertId}-action-ignore` | Bouton "Ignore" |
| Action remediate | `drift-s03-alert-{alertId}-action-remediate` | Bouton "Remediate" |
| Resolution status | `drift-s03-alert-{alertId}-resolution` | Badge statut resolution (si resolu) |
| Resolution note (display) | `drift-s03-alert-{alertId}-resolution-note` | Note de resolution affichee |
| Resolved by | `drift-s03-alert-{alertId}-resolved-by` | Qui a resolu |
| Resolved at | `drift-s03-alert-{alertId}-resolved-at` | Quand resolu |
| Expand/collapse toggle | `drift-s03-alert-{alertId}-toggle` | Toggle pour afficher/masquer les details |

### API Client

| Element | data-testid | Description |
|---------|-------------|-------------|
| API drift alerts module | `drift-s03-api-drift-alerts` | Fonctions API dans drift.ts |
| Fn listAlerts | `drift-s03-api-list-alerts` | Fonction GET /companies/:cid/drift/alerts |
| Fn resolveAlert | `drift-s03-api-resolve-alert` | Fonction POST .../resolve |
| Fn getMonitoringStatus | `drift-s03-api-monitoring-status` | Fonction GET .../monitoring/status |
| Fn startMonitoring | `drift-s03-api-start-monitoring` | Fonction POST .../monitoring/start |
| Fn stopMonitoring | `drift-s03-api-stop-monitoring` | Fonction POST .../monitoring/stop |

### Hooks

| Element | data-testid | Description |
|---------|-------------|-------------|
| Hook file | `drift-s03-hook-file` | Fichier useDriftAlerts.ts |
| Hook useDriftAlerts | `drift-s03-hook-use-drift-alerts` | Hook React Query pour les alertes |
| Hook useDriftAlertResolve | `drift-s03-hook-use-drift-alert-resolve` | Mutation resolution |
| Hook useDriftMonitoringStatus | `drift-s03-hook-use-monitoring-status` | Hook statut monitoring |
| Hook useDriftMonitoringToggle | `drift-s03-hook-use-monitoring-toggle` | Mutation toggle monitoring |

### Query Keys

| Element | data-testid | Description |
|---------|-------------|-------------|
| Query key alerts | `drift-s03-qk-alerts` | Cle `drift.alerts(companyId, filters)` |
| Query key monitoringStatus | `drift-s03-qk-monitoring-status` | Cle `drift.monitoringStatus(companyId)` |

---

## Fichiers Impactes

### Fichiers a CREER

| Fichier | Description | Lignes estimees |
|---------|-------------|-----------------|
| `ui/src/components/DriftAlertPanel.tsx` | Composant alerte drift d'execution avec diff visuel | ~200-250 |
| `ui/src/components/DriftMonitorToggle.tsx` | Toggle monitoring on/off avec status | ~80-100 |
| `ui/src/hooks/useDriftAlerts.ts` | Hooks React Query pour alertes drift d'execution | ~80-100 |

### Fichiers a MODIFIER

| Fichier | Modification |
|---------|-------------|
| `ui/src/api/drift.ts` | Ajouter 5 fonctions pour les routes DRIFT-S02 (alertes + monitoring) |
| `ui/src/pages/Drift.tsx` | Ajouter onglets Documents/Execution, integrer DriftAlertPanel + DriftMonitorToggle + filtres |
| `ui/src/lib/queryKeys.ts` | Ajouter `drift.alerts(companyId, filters)` et `drift.monitoringStatus(companyId)` |

### Fichiers NON MODIFIES

| Fichier | Raison |
|---------|--------|
| `ui/src/components/DriftAlertCard.tsx` | Composant existant pour drifts documents -- distinct et inchange |
| `ui/src/hooks/useDriftResults.ts` | Hooks existants pour drifts documents -- inchanges |
| `server/src/services/drift-monitor.ts` | Service backend DRIFT-S02 -- DONE et inchange |
| `server/src/services/drift-persistence.ts` | Service persistance DRIFT-S01 -- DONE et inchange |
| `server/src/routes/drift.ts` | Routes backend -- DONE et inchangees |
| `packages/shared/src/types/drift.ts` | Types partages -- DONE et inchanges |

---

## Implementation Guide

### Etape 1 : Query Keys

Enrichir `ui/src/lib/queryKeys.ts` :

```typescript
drift: {
  results: (projectId: string) => ["drift", "results", projectId] as const,
  check: (projectId: string) => ["drift", "check", projectId] as const,
  status: (projectId: string) => ["drift", "status", projectId] as const,
  // DRIFT-S03: execution alerts
  alerts: (companyId: string, filters?: Record<string, unknown>) =>
    ["drift", "alerts", companyId, filters] as const,
  monitoringStatus: (companyId: string) =>
    ["drift", "monitoring-status", companyId] as const,
},
```

### Etape 2 : API Client

Ajouter dans `ui/src/api/drift.ts` :

```typescript
// DRIFT-S03: Execution drift alerts API
function companyDriftPath(companyId: string) {
  return `/companies/${encodeURIComponent(companyId)}/drift`;
}

export const driftAlertsApi = {
  listAlerts: (companyId: string, filters?: {
    severity?: string;
    limit?: number;
    offset?: number;
  }) => {
    let url = `${companyDriftPath(companyId)}/alerts`;
    const params = new URLSearchParams();
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.limit != null) params.set("limit", String(filters.limit));
    if (filters?.offset != null) params.set("offset", String(filters.offset));
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return api.get<{ data: DriftAlert[]; total: number }>(url);
  },

  resolveAlert: (companyId: string, alertId: string, body: {
    resolution: "acknowledged" | "ignored" | "remediated";
    note?: string;
  }) =>
    api.post<DriftAlert>(
      `${companyDriftPath(companyId)}/alerts/${encodeURIComponent(alertId)}/resolve`,
      body,
    ),

  getMonitoringStatus: (companyId: string) =>
    api.get<DriftMonitorStatus>(
      `${companyDriftPath(companyId)}/monitoring/status`,
    ),

  startMonitoring: (companyId: string, config?: Partial<DriftMonitorConfig>) =>
    api.post<DriftMonitorStatus>(
      `${companyDriftPath(companyId)}/monitoring/start`,
      config ? { config } : {},
    ),

  stopMonitoring: (companyId: string) =>
    api.post<DriftMonitorStatus>(
      `${companyDriftPath(companyId)}/monitoring/stop`,
      {},
    ),
};
```

### Etape 3 : Hooks React Query

Creer `ui/src/hooks/useDriftAlerts.ts` :

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { driftAlertsApi } from "../api/drift";
import { queryKeys } from "../lib/queryKeys";

export function useDriftAlerts(companyId: string | undefined, filters?: {
  severity?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: queryKeys.drift.alerts(companyId!, filters as Record<string, unknown>),
    queryFn: () => driftAlertsApi.listAlerts(companyId!, filters),
    enabled: !!companyId,
    refetchInterval: 30_000, // refresh every 30s for near-realtime
  });
}

export function useDriftAlertResolve(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      alertId: string;
      resolution: "acknowledged" | "ignored" | "remediated";
      note?: string;
    }) => driftAlertsApi.resolveAlert(companyId!, params.alertId, {
      resolution: params.resolution,
      note: params.note,
    }),
    onSuccess: () => {
      if (companyId) {
        qc.invalidateQueries({ queryKey: ["drift", "alerts", companyId] });
        qc.invalidateQueries({ queryKey: queryKeys.drift.monitoringStatus(companyId) });
      }
    },
  });
}

export function useDriftMonitoringStatus(companyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.drift.monitoringStatus(companyId!),
    queryFn: () => driftAlertsApi.getMonitoringStatus(companyId!),
    enabled: !!companyId,
    refetchInterval: 60_000, // refresh every 60s
  });
}

export function useDriftMonitoringToggle(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "start" | "stop") =>
      action === "start"
        ? driftAlertsApi.startMonitoring(companyId!)
        : driftAlertsApi.stopMonitoring(companyId!),
    onSuccess: () => {
      if (companyId) {
        qc.invalidateQueries({ queryKey: queryKeys.drift.monitoringStatus(companyId) });
        qc.invalidateQueries({ queryKey: ["drift", "alerts", companyId] });
      }
    },
  });
}
```

### Etape 4 : Composant DriftAlertPanel

Creer `ui/src/components/DriftAlertPanel.tsx` :

- Pattern a suivre : `DriftAlertCard.tsx` pour la structure de base + `AuditEventDetail.tsx` pour le pattern de detail expandable
- Utiliser les icones Lucide : AlertTriangle (critical), AlertCircle (moderate), Info (minor), ChevronDown/Right (toggle), Check, X, Eye
- Diff side-by-side : 2 colonnes grid avec fond different (`bg-red-50/30` pour observed qui diverge, `bg-green-50/30` pour expected)
- Actions : 3 boutons (Acknowledge = outline/green, Ignore = ghost, Remediate = outline/blue)
- Note de resolution : Textarea conditionnelle affichee quand "Remediate" est clique
- Responsive : `grid-cols-2 md:grid-cols-2` pour diff, `grid-cols-1` sous 768px

**Mapping des metadata pour le diff visuel par type d'alerte :**

| AlertType | Expected | Observed |
|-----------|----------|----------|
| time_exceeded | `Stage should complete in < ${threshold} min` | `Stage has been running for ${elapsed} min` |
| stagnation | `Activity expected within ${threshold} min` | `No activity for ${silent} min` |
| retry_excessive | `Max ${maxRetries} retries, alert at ${threshold}` | `${retryCount} retries attempted` |
| stage_skipped | `Stage should be attempted (in_progress)` | `Stage skipped without execution` |
| sequence_violation | `Previous stage "${name}" should be completed` | `Previous stage "${name}" is "${state}"` |

Les metadata sont extraites du champ `metadata` de l'objet `DriftAlert` qui contient les valeurs specifiques (elapsedMs, thresholdMs, retryCount, previousStageName, previousStageState, etc.).

### Etape 5 : Composant DriftMonitorToggle

Creer `ui/src/components/DriftMonitorToggle.tsx` :

- Pattern : bouton avec indicateur vert/rouge + texte
- Utiliser `usePermissions()` pour gate sur `workflows:enforce`
- Si pas la permission : return null (masque, pas grise -- pattern RBAC-S05)
- Afficher : status (Active/Inactive), alert count, last check timestamp

### Etape 6 : Integration dans Drift.tsx

Modifier `ui/src/pages/Drift.tsx` pour ajouter :

1. **Onglets** : utiliser shadcn/ui Tabs si disponible, sinon boutons toggle simples avec state
2. **Tab "Documents"** : contenu existant inchange (wrap dans un conditionnel)
3. **Tab "Execution Alerts"** : nouvelle section avec :
   - DriftMonitorToggle en haut
   - Filtres (Select pour severity, type, status)
   - Liste de DriftAlertPanel
   - Empty state conditionnel
4. **Badge count** : nombre d'alertes actives (non resolues) sur l'onglet

---

## Cas de Test pour QA (Playwright E2E -- file-content based)

### T01-T05 : API Client drift alerts

| ID | Test | Verification |
|----|------|-------------|
| T01 | Fichier drift.ts enrichi | `ui/src/api/drift.ts` contient `driftAlertsApi` ou les 5 nouvelles fonctions |
| T02 | Fn listAlerts presente | Fonction avec path `/drift/alerts` dans le fichier |
| T03 | Fn resolveAlert presente | Fonction avec path contenant `/resolve` pour les alertes |
| T04 | Fn getMonitoringStatus presente | Fonction avec path `/monitoring/status` dans le fichier |
| T05 | Fn startMonitoring et stopMonitoring presentes | Fonctions avec paths `/monitoring/start` et `/monitoring/stop` |

### T06-T10 : Hooks useDriftAlerts

| ID | Test | Verification |
|----|------|-------------|
| T06 | Fichier useDriftAlerts.ts existe | `ui/src/hooks/useDriftAlerts.ts` cree |
| T07 | Hook useDriftAlerts exporte | `export function useDriftAlerts` present |
| T08 | Hook useDriftAlertResolve exporte | `export function useDriftAlertResolve` present |
| T09 | Hook useDriftMonitoringStatus exporte | `export function useDriftMonitoringStatus` present |
| T10 | Hook useDriftMonitoringToggle exporte | `export function useDriftMonitoringToggle` present |

### T11-T15 : Query keys et React Query integration

| ID | Test | Verification |
|----|------|-------------|
| T11 | Query key drift.alerts ajoutee | `queryKeys.ts` contient `alerts` dans le namespace `drift` |
| T12 | Query key drift.monitoringStatus ajoutee | `queryKeys.ts` contient `monitoringStatus` dans le namespace `drift` |
| T13 | useQuery dans useDriftAlerts | `useQuery` importe et utilise dans le hook |
| T14 | useMutation dans useDriftAlertResolve | `useMutation` utilise pour la resolution |
| T15 | invalidateQueries dans mutation onSuccess | `invalidateQueries` appele apres resolution |

### T16-T25 : Composant DriftAlertPanel

| ID | Test | Verification |
|----|------|-------------|
| T16 | Fichier DriftAlertPanel.tsx existe | `ui/src/components/DriftAlertPanel.tsx` cree |
| T17 | Export DriftAlertPanel | `export function DriftAlertPanel` ou `export const DriftAlertPanel` |
| T18 | data-testid severity badge | `drift-s03-alert-` et `-severity` dans le composant |
| T19 | data-testid type badge | `drift-s03-alert-` et `-type` dans le composant |
| T20 | data-testid diff expected | `drift-s03-alert-` et `-diff-expected` dans le composant |
| T21 | data-testid diff observed | `drift-s03-alert-` et `-diff-observed` dans le composant |
| T22 | data-testid action acknowledge | `drift-s03-alert-` et `-action-acknowledge` dans le composant |
| T23 | data-testid action ignore | `drift-s03-alert-` et `-action-ignore` dans le composant |
| T24 | data-testid action remediate | `drift-s03-alert-` et `-action-remediate` dans le composant |
| T25 | data-testid metadata | `drift-s03-alert-` et `-metadata` dans le composant |

### T26-T30 : Composant DriftMonitorToggle

| ID | Test | Verification |
|----|------|-------------|
| T26 | Fichier DriftMonitorToggle.tsx existe | `ui/src/components/DriftMonitorToggle.tsx` cree |
| T27 | Export DriftMonitorToggle | `export function DriftMonitorToggle` ou `export const DriftMonitorToggle` |
| T28 | data-testid monitor toggle | `drift-s03-monitor-toggle` dans le composant |
| T29 | data-testid monitor toggle button | `drift-s03-monitor-toggle-btn` dans le composant |
| T30 | usePermissions utilise | Import et usage de `usePermissions` pour gate `workflows:enforce` |

### T31-T40 : Integration page Drift.tsx

| ID | Test | Verification |
|----|------|-------------|
| T31 | Onglet Documents | `drift-s03-tab-documents` data-testid dans Drift.tsx |
| T32 | Onglet Execution Alerts | `drift-s03-tab-execution` data-testid dans Drift.tsx |
| T33 | Badge count onglet | `drift-s03-tab-execution-count` data-testid dans Drift.tsx |
| T34 | Liste alertes container | `drift-s03-alerts-list` data-testid dans Drift.tsx |
| T35 | Filtres container | `drift-s03-filters` data-testid dans Drift.tsx |
| T36 | Filtre severity | `drift-s03-filter-severity` data-testid dans Drift.tsx |
| T37 | Filtre type | `drift-s03-filter-type` data-testid dans Drift.tsx |
| T38 | Filtre status | `drift-s03-filter-status` data-testid dans Drift.tsx |
| T39 | Empty state monitoring off | `drift-s03-empty-monitoring-off` data-testid dans Drift.tsx |
| T40 | Empty state no alerts | `drift-s03-empty-no-alerts` data-testid dans Drift.tsx |

### T41-T45 : Labels et affichage types d'alertes

| ID | Test | Verification |
|----|------|-------------|
| T41 | Label "Time Exceeded" | String `"Time Exceeded"` ou `"time_exceeded"` mappe a un label dans DriftAlertPanel |
| T42 | Label "Stagnation" | String `"Stagnation"` ou `"stagnation"` mappe a un label dans DriftAlertPanel |
| T43 | Label "Excessive Retries" | String `"Excessive Retries"` ou `"retry_excessive"` mappe a un label dans DriftAlertPanel |
| T44 | Label "Stage Skipped" | String `"Stage Skipped"` ou `"stage_skipped"` mappe a un label dans DriftAlertPanel |
| T45 | Label "Sequence Violation" | String `"Sequence Violation"` ou `"sequence_violation"` mappe a un label dans DriftAlertPanel |

### T46-T55 : Severite, couleurs, accessibilite

| ID | Test | Verification |
|----|------|-------------|
| T46 | Couleur critical rouge | `bg-red-` ou `text-red-` dans le mapping severite du composant |
| T47 | Couleur moderate orange/amber | `bg-amber-` ou `text-amber-` dans le mapping severite |
| T48 | Couleur minor vert | `bg-green-` ou `text-green-` dans le mapping severite |
| T49 | Icone AlertTriangle pour critical | `AlertTriangle` importe et utilise dans le composant |
| T50 | Icone AlertCircle pour moderate | `AlertCircle` importe et utilise dans le composant |
| T51 | aria-label sur les boutons d'action | `aria-label` present sur au moins un bouton d'action dans DriftAlertPanel |
| T52 | Responsive grid diff | `grid-cols-1` ou `md:grid-cols-2` pour le diff side-by-side |
| T53 | Import DriftAlert type | `import.*DriftAlert` depuis `@mnm/shared` dans le composant ou hook |
| T54 | Import DriftMonitorStatus type | `import.*DriftMonitorStatus` depuis `@mnm/shared` dans le composant ou hook |
| T55 | Import DriftAlertType type | `import.*DriftAlertType` depuis `@mnm/shared` dans le composant ou hook |

### T56-T60 : Integration imports et wiring

| ID | Test | Verification |
|----|------|-------------|
| T56 | DriftAlertPanel importe dans Drift.tsx | `import.*DriftAlertPanel` dans Drift.tsx |
| T57 | DriftMonitorToggle importe dans Drift.tsx | `import.*DriftMonitorToggle` dans Drift.tsx |
| T58 | useDriftAlerts importe dans Drift.tsx | `import.*useDriftAlerts` dans Drift.tsx |
| T59 | useDriftMonitoringStatus ou toggle importe dans Drift.tsx | `import.*useDriftMonitoring` dans Drift.tsx |
| T60 | driftAlertsApi importe dans hooks | `import.*driftAlertsApi` dans useDriftAlerts.ts |

### T61-T65 : Resolution et etats

| ID | Test | Verification |
|----|------|-------------|
| T61 | Resolution "acknowledged" | String `"acknowledged"` dans DriftAlertPanel |
| T62 | Resolution "ignored" | String `"ignored"` dans DriftAlertPanel |
| T63 | Resolution "remediated" | String `"remediated"` dans DriftAlertPanel |
| T64 | Note de resolution textarea | `drift-s03-alert-` et `-note` dans le composant (textarea ou input) |
| T65 | Etat resolu affiche resolution info | `drift-s03-alert-` et `-resolution` dans le composant |

### T66-T70 : Edge cases et robustesse

| ID | Test | Verification |
|----|------|-------------|
| T66 | Guard companyId dans hooks | `enabled: !!companyId` pattern dans useDriftAlerts |
| T67 | Refetch interval pour near-realtime | `refetchInterval` configure dans useDriftAlerts |
| T68 | Error boundary dans Drift.tsx | `drift-s03-error` data-testid pour l'etat d'erreur |
| T69 | Loading state dans Drift.tsx | `drift-s03-loading` data-testid pour le chargement |
| T70 | useCompany utilise pour selectedCompanyId | `useCompany` importe dans Drift.tsx (deja present, verification inchangee) |

---

## Notes Techniques

### Performance

- Le hook `useDriftAlerts` utilise `refetchInterval: 30_000` (30s) pour le near-realtime sans WebSocket
- Le hook `useDriftMonitoringStatus` utilise `refetchInterval: 60_000` (60s) car le statut change rarement
- Le diff visuel est genere cote client a partir des `metadata` de l'alerte (pas de calcul serveur additionnel)
- Les filtres sont appliques cote serveur via query params (pas de filtrage client)

### Architecture

- **Separation nette** entre les drifts de documents (existant) et les drifts d'execution (nouveau) :
  - Documents : `DriftItem`, `DriftReport`, `DriftAlertCard`, `useDriftResults`
  - Execution : `DriftAlert`, `DriftAlertPanel`, `useDriftAlerts`
- Cette separation permet de garder le code existant intact et d'evoluer chaque concern independamment

### Types reutilises

- Tous les types necessaires sont deja dans `@mnm/shared` (DRIFT-S02) :
  - `DriftAlert`, `DriftAlertType`, `DriftSeverity`, `DriftMonitorConfig`, `DriftMonitorStatus`
- Pas besoin de creer de nouveaux types -- uniquement de les importer cote frontend

### Pattern RBAC-S05 pour le toggle

- Le `DriftMonitorToggle` utilise `usePermissions()` pour verifier `workflows:enforce`
- Si la permission est absente, le composant retourne `null` (masque du DOM, pas grise)
- Ce pattern est deja utilise dans la sidebar et la navigation (RBAC-S05 -- DONE)

### Pattern diff visuel

- Le diff n'est pas un vrai "diff de texte" (comme un git diff)
- C'est une **vue comparee semantique** : "Expected" vs "Observed"
- Les valeurs sont extraites des `metadata` de l'alerte et formatees en texte lisible
- Le panneau "Observed" a un fond colore indiquant la deviation (rouge pour critical, orange pour moderate)

### Backward Compatibility

- La page `Drift.tsx` garde tout son contenu existant dans l'onglet "Documents"
- L'onglet "Execution Alerts" est un ajout, pas un remplacement
- Les hooks existants (`useDriftResults`, `useDriftScan`, etc.) ne sont pas modifies
- L'`DriftAlertCard` existant n'est pas modifie

---

## Definition of Done

- [ ] 5 fonctions API client ajoutees dans `ui/src/api/drift.ts` (listAlerts, resolveAlert, getMonitoringStatus, startMonitoring, stopMonitoring)
- [ ] 4 hooks React Query crees dans `ui/src/hooks/useDriftAlerts.ts`
- [ ] 2 query keys ajoutees dans `ui/src/lib/queryKeys.ts` (drift.alerts, drift.monitoringStatus)
- [ ] Composant `DriftAlertPanel.tsx` cree avec diff visuel expected/observed
- [ ] Composant `DriftMonitorToggle.tsx` cree avec permission gate `workflows:enforce`
- [ ] Page `Drift.tsx` enrichie avec onglets Documents/Execution Alerts
- [ ] Filtres (severite, type, statut) fonctionnels sur les alertes d'execution
- [ ] Empty states pour monitoring inactif et aucune alerte
- [ ] Actions de resolution (Acknowledge/Ignore/Remediate) avec note optionnelle
- [ ] Labels humains pour les 5 types d'alertes
- [ ] Couleurs severite conformes au design system (critical=rouge, moderate=orange, minor=vert)
- [ ] Triple encodage : couleur + icone + texte pour chaque severite
- [ ] data-testid sur tous les elements interactifs et verifiables (65 data-testid documentes)
- [ ] 70 tests E2E Playwright passent (file-content based)
- [ ] `pnpm typecheck` passe sans erreur
- [ ] Pas de regression sur les tests existants
- [ ] Accessibilite : aria-labels, navigation clavier, pas de couleur seule
- [ ] Responsive : diff stacked sous 768px
