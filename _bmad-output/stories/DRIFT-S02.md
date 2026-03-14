# DRIFT-S02 : Drift Monitor Service -- Comparaison Attendu vs Observe + Alertes WebSocket

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | DRIFT-S02 |
| **Titre** | Drift Monitor Service -- Comparaison attendu vs observe + alertes WebSocket |
| **Epic** | Epic DRIFT -- Drift Detection (Noyau A) |
| **Sprint** | Sprint 4 (Batch 8) |
| **Effort** | M (5 SP, 3-5j) |
| **Priorite** | P0 -- Coeur detection drift temps reel |
| **Assignation** | Tom (backend) |
| **Bloque par** | ORCH-S01 (state machine XState) -- DONE, DRIFT-S01 (persistence DB) -- DONE |
| **Debloque** | DRIFT-S03 (UI diff visuel drift) |
| **ADR** | ADR-007 (Observabilite), ADR-003 (Orchestrateur Deterministe) |
| **Type** | Backend-only (service + types + routes + WebSocket events, pas de composant UI) |
| **FRs couverts** | REQ-ORCH-05 (Drift detection basique <15min P0) |

---

## Description

### Contexte -- Pourquoi cette story est necessaire

Le systeme de drift actuel (`drift.ts` refactore par DRIFT-S01) est **passif** : il ne detecte le drift que quand un utilisateur lance manuellement un scan ou un check. Il compare des documents statiques (planning artifacts) entre eux.

Pour le B2B enterprise, MnM a besoin d'un **drift monitor actif** qui :
1. **Observe les transitions d'etat** des agents en temps reel via les evenements de l'orchestrateur (ORCH-S01)
2. **Compare l'execution attendue** (template workflow defini par le Manager) avec **l'execution observee** (transitions reelles des stages)
3. **Detecte les deviations** : etapes sautees, duree excessive (>15 min par defaut), retries excessifs, progression stagnante
4. **Alerte via WebSocket** les Manager/Admin quand un drift d'execution est detecte
5. **Persiste les alertes** dans les tables `drift_reports`/`drift_items` (DRIFT-S01)

### Flux architectural (Flux 3 du architecture-b2b.md)

```
Orchestrator transitionStage() --> OrchestratorEvent emis via publishLiveEvent()
  --> DriftMonitorService ecoute les events stage.*
  --> Compare attendu (workflow template stages) vs observe (transitions reelles)
  --> Si deviation detectee --> cree un DriftReport via drift-persistence
  --> Emet un LiveEvent "drift.alert_created" via WebSocket
  --> Manager/Admin recoit l'alerte en temps reel dans le frontend
```

### Ce que cette story construit

1. **Service `drift-monitor.ts`** (~300-400 lignes) :
   - `DriftMonitorService` -- service principal qui observe les transitions
   - `startMonitoring(companyId)` -- s'abonne aux LiveEvents d'une company
   - `stopMonitoring(companyId)` -- se desabonne
   - `checkStageDrift(stageId, event, context)` -- evalue une transition specifique
   - `checkWorkflowTimeDrift(workflowInstanceId)` -- verifie les depassements de duree
   - `getDriftAlerts(companyId, filters)` -- recupere les alertes actives
   - `resolveAlert(companyId, alertId, resolution)` -- resoudre une alerte
   - `getMonitoringStatus(companyId)` -- retourne le statut du monitoring

2. **Types partages** dans `packages/shared/src/types/drift.ts` :
   - `DriftAlert` -- alerte enrichie avec type de deviation
   - `DriftAlertType` -- types de deviations (stage_skipped, time_exceeded, retry_excessive, sequence_violation, stagnation)
   - `DriftMonitorConfig` -- configuration du moniteur (seuils de temps, max retries, etc.)
   - `DriftMonitorStatus` -- statut du monitoring (active, companyId, alertCount, etc.)

3. **Nouvelles LiveEventTypes** dans `packages/shared/src/constants.ts` :
   - `"drift.alert_created"` -- alerte creee
   - `"drift.alert_resolved"` -- alerte resolue
   - `"drift.monitoring_started"` -- monitoring demarre
   - `"drift.monitoring_stopped"` -- monitoring arrete

4. **Integration orchestrateur** :
   - Hook dans `orchestrator.ts` apres chaque `transitionStage()` qui notifie le drift monitor
   - Le drift monitor evalue la transition et cree une alerte si necessaire

5. **Nouvelles routes API** :
   - `GET /api/drift/alerts` -- lister les alertes actives (filtre par companyId, projectId, severity)
   - `POST /api/drift/alerts/:alertId/resolve` -- resoudre une alerte
   - `GET /api/drift/monitor/status` -- statut du monitoring
   - `POST /api/drift/monitor/start` -- demarrer le monitoring
   - `POST /api/drift/monitor/stop` -- arreter le monitoring

6. **Barrel exports** mis a jour :
   - `server/src/services/index.ts` -- export `driftMonitorService`
   - `packages/shared/src/types/index.ts` -- export nouveaux types drift
   - `packages/shared/src/constants.ts` -- export nouvelles LiveEventTypes

### Ce que cette story ne fait PAS (scope)

- Pas de UI pour les alertes drift (DRIFT-S03)
- Pas de CompactionWatcher (COMP-S01)
- Pas de kill+relance d'agent (COMP-S02)
- Pas de modification du schema DB (les tables drift_reports/drift_items de DRIFT-S01 suffisent)
- Pas de websocket client-side (le frontend ecoute deja les LiveEvents)
- Pas de detection de drift inter-documents (ca reste dans drift.ts existant)

---

## Etat Actuel du Code (Analyse)

### Orchestrator service (`server/src/services/orchestrator.ts`)

Le service orchestrateur emet deja des LiveEvents apres chaque transition :

```typescript
// orchestrator.ts ligne 283
publishLiveEvent({
  companyId: stage.companyId,
  type: orchestratorEvent.type as LiveEventType,
  payload: orchestratorEvent as unknown as Record<string, unknown>,
});
```

Les evenements emis sont de type `stage.{started|completed|paused|failed|...}` avec un payload `OrchestratorEvent` contenant :
- `workflowInstanceId`, `stageId`, `fromState`, `toState`, `event`, `actorId`, `actorType`, `timestamp`

### XState state machine (`server/src/services/workflow-state-machine.ts`)

La machine d'etat a 10 etats et 15 transitions. Les transitions sont :
- CREATED -> READY (initialize)
- READY -> IN_PROGRESS (start)
- IN_PROGRESS -> VALIDATING (request_validation)
- IN_PROGRESS -> COMPLETED (complete)
- IN_PROGRESS -> PAUSED (pause)
- IN_PROGRESS -> FAILED (fail)
- IN_PROGRESS -> COMPACTING (compact_detected)
- VALIDATING -> IN_PROGRESS (approve/reject_with_feedback)
- PAUSED -> IN_PROGRESS (resume)
- FAILED -> IN_PROGRESS (retry)
- FAILED -> TERMINATED (terminate)
- COMPACTING -> IN_PROGRESS (reinjected)
- COMPACTING -> TERMINATED (compaction_failed)

### LiveEvents system (`server/src/services/live-events.ts`)

Systeme EventEmitter par companyId. `publishLiveEvent({ companyId, type, payload })` emet un evenement recu par tous les listeners abonnes a cette company.

`subscribeCompanyLiveEvents(companyId, listener)` retourne une fonction unsubscribe.

### Drift persistence (`server/src/services/drift-persistence.ts`)

Service CRUD cree par DRIFT-S01. Expose :
- `createReport(input)` -- cree un rapport + items en transaction
- `listReports(filters)` -- avec pagination
- `resolveItem(companyId, itemId, decision, decidedBy, note?)` -- resoudre un item
- `getReportById(companyId, reportId)` -- un rapport par ID
- `listItems(filters)` -- items avec filtres
- `getScanStatus(companyId, projectId)` -- status derive

### Workflow instances DB

Les `workflowInstances` et `stageInstances` contiennent :
- `stageInstances.machineState` -- etat actuel (StageState)
- `stageInstances.transitionHistory` -- JSON array de TransitionRecord
- `stageInstances.stageOrder` -- ordre dans le workflow (0-based)
- `stageInstances.startedAt`, `completedAt` -- timestamps
- `stageInstances.retryCount`, `maxRetries` -- compteurs retry
- `workflowInstances.workflowState` -- etat global du workflow

---

## Architecture du Drift Monitor Service

### Diagramme de flux

```
                      +-----------------------+
                      |  Orchestrator Service  |
                      |   transitionStage()    |
                      +----------+------------+
                                 |
                      publishLiveEvent("stage.*")
                                 |
                      +----------v------------+
                      | DriftMonitorService    |
                      |  onStageEvent(event)   |
                      +----------+------------+
                                 |
                    +------------+------------+
                    |                         |
           checkStageDrift()        checkWorkflowTimeDrift()
                    |                         |
          +---------+---------+     +---------+---------+
          | Deviation?        |     | Time exceeded?    |
          | - stage_skipped   |     | - time_exceeded   |
          | - sequence_error  |     | - stagnation      |
          | - retry_excessive |     |                   |
          +---------+---------+     +---------+---------+
                    |                         |
                    +------------+------------+
                                 |
                      YES: createDriftAlert()
                                 |
                    +------------+------------+
                    |                         |
            driftPersistence          publishLiveEvent
            .createReport()          ("drift.alert_created")
```

### Types de deviations detectees

| Type | Description | Seuil par defaut | Severite |
|------|-------------|------------------|----------|
| `time_exceeded` | Un stage depasse la duree max configuree | 15 min | moderate |
| `stagnation` | Un stage est en `in_progress` sans aucun evenement depuis trop longtemps | 30 min | critical |
| `retry_excessive` | Un stage a depasse N retries | 2 (seuil = maxRetries - 1) | moderate |
| `stage_skipped` | Un stage est passe directement a `skipped` sans avoir ete tente | N/A | minor |
| `sequence_violation` | Un stage a ete demarrer avant que le precedent soit complete | N/A | critical |

### Configuration du moniteur

```typescript
interface DriftMonitorConfig {
  /** Duree max par defaut pour un stage avant alerte (ms). Default: 15 * 60 * 1000 */
  defaultStageTimeoutMs: number;
  /** Duree sans activite avant alerte stagnation (ms). Default: 30 * 60 * 1000 */
  stagnationTimeoutMs: number;
  /** Seuil de retries avant alerte. Default: 2 */
  retryAlertThreshold: number;
  /** Intervalle de check periodique pour le time drift (ms). Default: 60 * 1000 */
  checkIntervalMs: number;
  /** Active/desactive le monitoring. Default: true */
  enabled: boolean;
}
```

---

## Acceptance Criteria

### AC-1 : Detection drift temporel (>15 min)

**Given** un agent en execution sur un stage
**When** le DriftMonitorService detecte que le stage est en `in_progress` depuis plus de 15 minutes (configurable)
**Then** une alerte drift de type `time_exceeded` est creee avec severite `moderate`

**Given** l'alerte creee
**When** elle est persistee
**Then** un `DriftReport` est cree dans la DB via `drift-persistence.createReport()` avec `driftType = "time_exceeded"` et un `DriftItem` associe

### AC-2 : Notification WebSocket Manager/Admin

**Given** une deviation detectee
**When** l'alerte est creee
**Then** un LiveEvent `"drift.alert_created"` est emis via `publishLiveEvent()` avec le payload contenant `alertId`, `alertType`, `stageId`, `workflowInstanceId`, `severity`, `companyId`

**Given** un Manager/Admin abonne aux LiveEvents de la company
**When** l'alerte est emise
**Then** il recoit l'evenement en temps reel via WebSocket

### AC-3 : Detection stagnation (aucune activite)

**Given** un stage en `in_progress`
**When** aucune transition n'est recue depuis plus de 30 minutes (configurable)
**Then** une alerte drift de type `stagnation` est creee avec severite `critical`

### AC-4 : Detection retries excessifs

**Given** un stage qui a deja echoue et ete relance
**When** le nombre de retries atteint le seuil d'alerte (par defaut 2, soit maxRetries - 1)
**Then** une alerte drift de type `retry_excessive` est creee avec severite `moderate`
**And** le message inclut le nombre de retries et la limite

### AC-5 : Detection skip non-attendu

**Given** un stage dans un workflow
**When** il est transitionne directement vers `skipped` sans avoir jamais ete `in_progress`
**Then** une alerte drift de type `stage_skipped` est creee avec severite `minor`

### AC-6 : Detection violation de sequence

**Given** un workflow avec des stages ordonnees [S1, S2, S3]
**When** S2 est demarree alors que S1 n'est pas `completed`
**Then** une alerte drift de type `sequence_violation` est creee avec severite `critical`
**And** le message indique quel stage precedent n'est pas complete

### AC-7 : Resolution d'alerte

**Given** une alerte drift active
**When** un Manager/Admin appelle `POST /api/drift/alerts/:alertId/resolve` avec `{ resolution: "acknowledged" | "ignored" | "remediated", note: "..." }`
**Then** l'item drift associe est resolu via `drift-persistence.resolveItem()`
**And** un LiveEvent `"drift.alert_resolved"` est emis
**And** un audit event `"drift.alert_resolved"` est emis via `emitAudit()`

### AC-8 : API alertes actives

**Given** des alertes drift creees pour une company
**When** `GET /api/drift/alerts?companyId=xxx&severity=critical` est appele
**Then** seules les alertes non resolues de severite `critical` pour cette company sont retournees
**And** la reponse inclut `{ data: DriftAlert[], total: number }`

### AC-9 : Monitoring demarrage/arret

**Given** le serveur MnM
**When** un Admin appelle `POST /api/drift/monitor/start`
**Then** le DriftMonitorService s'abonne aux LiveEvents de la company
**And** le check periodique (intervalle 60s) demarre
**And** un LiveEvent `"drift.monitoring_started"` est emis

**Given** un monitoring actif
**When** un Admin appelle `POST /api/drift/monitor/stop`
**Then** le DriftMonitorService se desabonne et arrete le check periodique
**And** un LiveEvent `"drift.monitoring_stopped"` est emis

### AC-10 : Pas de doublon d'alerte

**Given** une alerte `time_exceeded` deja active pour un stage
**When** le check periodique detecte a nouveau le meme depassement
**Then** aucune nouvelle alerte n'est creee (deduplication par stageId + alertType)

### AC-11 : Integration audit

**Given** une alerte drift creee
**When** elle est persistee
**Then** un audit event `"drift.alert_created"` est emis via `emitAudit()` (appel non-bloquant) avec :
  - `actorType: "system"`, `actorId: "drift-monitor"`
  - `targetType: "stage"`, `targetId: stageId`
  - `metadata: { alertType, severity, workflowInstanceId, stageId, message }`
  - `severity: "warning"` (ou `"error"` pour critical)

### AC-12 : Orchestrator integration hook

**Given** l'orchestrateur qui effectue une transition
**When** `transitionStage()` complete avec succes
**Then** le DriftMonitorService est notifie via le LiveEvent existant (pas d'appel direct)
**And** le monitoring evalue la transition de facon asynchrone (non-bloquante pour l'orchestrateur)

---

## data-test-id Reference Table

| Element | data-testid | Description |
|---------|-------------|-------------|
| Service drift-monitor.ts | `drift-s02-service-drift-monitor` | Fichier service principal |
| Fn startMonitoring | `drift-s02-fn-start-monitoring` | Fonction demarrage monitoring par company |
| Fn stopMonitoring | `drift-s02-fn-stop-monitoring` | Fonction arret monitoring |
| Fn onStageEvent | `drift-s02-fn-on-stage-event` | Handler evenements stage.* |
| Fn checkStageDrift | `drift-s02-fn-check-stage-drift` | Evaluation drift sur une transition |
| Fn checkWorkflowTimeDrift | `drift-s02-fn-check-workflow-time-drift` | Verification depassement temps |
| Fn createDriftAlert | `drift-s02-fn-create-drift-alert` | Creation d'une alerte drift |
| Fn getDriftAlerts | `drift-s02-fn-get-drift-alerts` | Recuperation des alertes actives |
| Fn resolveAlert | `drift-s02-fn-resolve-alert` | Resolution d'une alerte |
| Fn getMonitoringStatus | `drift-s02-fn-get-monitoring-status` | Statut du monitoring |
| Dedup active alerts | `drift-s02-dedup-active-alerts` | Deduplication par stageId + alertType |
| Config defaults | `drift-s02-config-defaults` | Configuration seuils par defaut (15min, 30min, 2 retries) |
| LiveEvent drift.alert_created | `drift-s02-event-alert-created` | Emission evenement WebSocket alerte creee |
| LiveEvent drift.alert_resolved | `drift-s02-event-alert-resolved` | Emission evenement WebSocket alerte resolue |
| LiveEvent drift.monitoring_started | `drift-s02-event-monitoring-started` | Emission evenement monitoring demarre |
| LiveEvent drift.monitoring_stopped | `drift-s02-event-monitoring-stopped` | Emission evenement monitoring arrete |
| LIVE_EVENT_TYPES updated | `drift-s02-constants-live-events` | 4 nouveaux types dans LIVE_EVENT_TYPES |
| Type DriftAlertType | `drift-s02-type-drift-alert-type` | Type union des 5 types d'alerte |
| Type DriftAlert | `drift-s02-type-drift-alert` | Interface DriftAlert |
| Type DriftMonitorConfig | `drift-s02-type-monitor-config` | Interface config moniteur |
| Type DriftMonitorStatus | `drift-s02-type-monitor-status` | Interface statut monitoring |
| Route GET /drift/alerts | `drift-s02-route-get-alerts` | Endpoint lister alertes actives |
| Route POST /drift/alerts/:id/resolve | `drift-s02-route-resolve-alert` | Endpoint resolution alerte |
| Route GET /drift/monitor/status | `drift-s02-route-monitor-status` | Endpoint statut monitoring |
| Route POST /drift/monitor/start | `drift-s02-route-monitor-start` | Endpoint demarrer monitoring |
| Route POST /drift/monitor/stop | `drift-s02-route-monitor-stop` | Endpoint arreter monitoring |
| Barrel export service | `drift-s02-barrel-service` | Export driftMonitorService dans services/index.ts |
| Barrel export types | `drift-s02-barrel-types` | Export nouveaux types drift dans types/index.ts |
| Audit emit alert created | `drift-s02-audit-alert-created` | emitAudit('drift.alert_created') |
| Audit emit alert resolved | `drift-s02-audit-alert-resolved` | emitAudit('drift.alert_resolved') |
| subscribeCompanyLiveEvents used | `drift-s02-subscribe-live-events` | Utilisation de subscribeCompanyLiveEvents pour ecouter |
| publishLiveEvent used | `drift-s02-publish-live-event` | Utilisation de publishLiveEvent pour emettre |
| Periodic check interval | `drift-s02-periodic-check` | setInterval pour check periodique (60s) |
| Time exceeded threshold 15min | `drift-s02-threshold-time` | Seuil 15 minutes (900_000 ms) |
| Stagnation threshold 30min | `drift-s02-threshold-stagnation` | Seuil 30 minutes (1_800_000 ms) |
| Retry threshold | `drift-s02-threshold-retry` | Seuil retries (maxRetries - 1, default 2) |
| Uses drift-persistence | `drift-s02-uses-persistence` | Import et usage de driftPersistenceService |
| Non-blocking async | `drift-s02-non-blocking` | Monitoring async, non-bloquant pour l'orchestrateur |

---

## Fichiers Impactes

### Fichiers a CREER

| Fichier | Description | Lignes estimees |
|---------|-------------|-----------------|
| `server/src/services/drift-monitor.ts` | Service principal de monitoring drift | ~300-400 |

### Fichiers a MODIFIER

| Fichier | Modification |
|---------|-------------|
| `packages/shared/src/types/drift.ts` | Ajouter DriftAlertType, DriftAlert, DriftMonitorConfig, DriftMonitorStatus |
| `packages/shared/src/types/index.ts` | Re-export nouveaux types |
| `packages/shared/src/constants.ts` | Ajouter 4 LiveEventTypes drift.* |
| `server/src/services/index.ts` | Export driftMonitorService |
| `server/src/routes/drift.ts` | Ajouter 5 routes API pour alertes et monitoring |

### Fichiers NON MODIFIES

| Fichier | Raison |
|---------|--------|
| `server/src/services/orchestrator.ts` | Pas de modification -- le drift monitor ecoute les LiveEvents emis, pas d'appel direct |
| `server/src/services/workflow-state-machine.ts` | Machine d'etat inchangee |
| `server/src/services/drift.ts` | Service drift LLM existant inchange (drift documents != drift execution) |
| `server/src/services/drift-persistence.ts` | Service persistence inchange -- reutilise tel quel |
| `packages/db/src/schema/drift_reports.ts` | Schema DB inchange |
| `packages/db/src/schema/drift_items.ts` | Schema DB inchange |

---

## Implementation Guide

### Etape 1 : Types partages

Enrichir `packages/shared/src/types/drift.ts` avec les nouveaux types :

```typescript
// packages/shared/src/types/drift.ts -- ajouts DRIFT-S02

/** Types de deviations detectees par le drift monitor */
export type DriftAlertType =
  | "time_exceeded"      // stage depasse la duree max
  | "stagnation"         // aucune activite depuis trop longtemps
  | "retry_excessive"    // trop de retries
  | "stage_skipped"      // stage skippe sans execution
  | "sequence_violation"; // stage demarre hors sequence

/** Alerte drift enrichie (vue API) */
export interface DriftAlert {
  id: string;
  companyId: string;
  projectId: string;
  workflowInstanceId: string;
  stageId: string;
  alertType: DriftAlertType;
  severity: DriftSeverity;
  message: string;
  /** Metadata supplementaire (duree, retryCount, etc.) */
  metadata: Record<string, unknown>;
  /** Statut de resolution */
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: "acknowledged" | "ignored" | "remediated";
  resolutionNote?: string;
  createdAt: string;
}

/** Configuration du drift monitor */
export interface DriftMonitorConfig {
  /** Duree max par defaut pour un stage (ms). Default: 900_000 (15 min) */
  defaultStageTimeoutMs: number;
  /** Duree sans activite avant stagnation (ms). Default: 1_800_000 (30 min) */
  stagnationTimeoutMs: number;
  /** Seuil de retries avant alerte. Default: 2 */
  retryAlertThreshold: number;
  /** Intervalle du check periodique (ms). Default: 60_000 (1 min) */
  checkIntervalMs: number;
  /** Monitoring actif. Default: true */
  enabled: boolean;
}

/** Statut du monitoring pour une company */
export interface DriftMonitorStatus {
  /** Monitoring actif pour cette company */
  active: boolean;
  /** Nombre d'alertes actives non resolues */
  activeAlertCount: number;
  /** Date de demarrage du monitoring */
  startedAt: string | null;
  /** Derniere verification */
  lastCheckAt: string | null;
  /** Configuration actuelle */
  config: DriftMonitorConfig;
}
```

### Etape 2 : LiveEventTypes

Ajouter dans `packages/shared/src/constants.ts` dans le tableau `LIVE_EVENT_TYPES` :

```typescript
// DRIFT-S02: Drift monitor events
"drift.alert_created",
"drift.alert_resolved",
"drift.monitoring_started",
"drift.monitoring_stopped",
```

### Etape 3 : Service drift-monitor.ts

Pattern a suivre : le service est un singleton par company, cree via factory function.

```typescript
// server/src/services/drift-monitor.ts

import type { Db } from "@mnm/db";
import { stageInstances, workflowInstances } from "@mnm/db";
import { eq, and, asc } from "drizzle-orm";
import type {
  DriftAlertType,
  DriftMonitorConfig,
  DriftMonitorStatus,
  DriftSeverity,
  OrchestratorEvent,
  LiveEvent,
} from "@mnm/shared";
import { publishLiveEvent, subscribeCompanyLiveEvents } from "./live-events.js";
import { driftPersistenceService } from "./drift-persistence.js";
import { logger } from "../middleware/logger.js";

const DEFAULT_CONFIG: DriftMonitorConfig = {
  defaultStageTimeoutMs: 15 * 60 * 1000,  // 15 min
  stagnationTimeoutMs: 30 * 60 * 1000,    // 30 min
  retryAlertThreshold: 2,
  checkIntervalMs: 60 * 1000,             // 1 min
  enabled: true,
};

/** In-memory tracker for active alerts to prevent duplicates */
const activeAlerts = new Map<string, Set<string>>(); // stageId -> Set<alertType>

/** Active monitoring subscriptions by company */
const monitors = new Map<string, {
  unsubscribe: () => void;
  intervalId: ReturnType<typeof setInterval>;
  startedAt: string;
  lastCheckAt: string | null;
  config: DriftMonitorConfig;
}>();

export function driftMonitorService(db: Db) {
  const persistence = driftPersistenceService(db);

  /** Start monitoring for a company */
  async function startMonitoring(
    companyId: string,
    config?: Partial<DriftMonitorConfig>,
  ): Promise<DriftMonitorStatus> {
    // If already monitoring, stop first
    if (monitors.has(companyId)) {
      await stopMonitoring(companyId);
    }

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Subscribe to stage events
    const unsubscribe = subscribeCompanyLiveEvents(companyId, (event) => {
      if (event.type.startsWith("stage.")) {
        onStageEvent(companyId, event).catch((err) => {
          logger.error({ err, companyId }, "Drift monitor: error processing stage event");
        });
      }
    });

    // Start periodic time drift check
    const intervalId = setInterval(() => {
      checkWorkflowTimeDrift(companyId, mergedConfig).catch((err) => {
        logger.error({ err, companyId }, "Drift monitor: error in periodic check");
      });
    }, mergedConfig.checkIntervalMs);

    monitors.set(companyId, {
      unsubscribe,
      intervalId,
      startedAt: new Date().toISOString(),
      lastCheckAt: null,
      config: mergedConfig,
    });

    publishLiveEvent({
      companyId,
      type: "drift.monitoring_started",
      payload: { companyId, config: mergedConfig },
    });

    return getMonitoringStatus(companyId);
  }

  /** Stop monitoring for a company */
  async function stopMonitoring(companyId: string): Promise<void> {
    const monitor = monitors.get(companyId);
    if (!monitor) return;

    monitor.unsubscribe();
    clearInterval(monitor.intervalId);
    monitors.delete(companyId);

    publishLiveEvent({
      companyId,
      type: "drift.monitoring_stopped",
      payload: { companyId },
    });
  }

  /** Handle a stage event from the orchestrator */
  async function onStageEvent(
    companyId: string,
    event: LiveEvent,
  ): Promise<void> {
    const payload = event.payload as unknown as OrchestratorEvent;
    if (!payload?.stageId || !payload?.workflowInstanceId) return;

    const monitor = monitors.get(companyId);
    if (!monitor) return;

    await checkStageDrift(companyId, payload, monitor.config);
  }

  /** Evaluate a stage transition for drift */
  async function checkStageDrift(
    companyId: string,
    event: OrchestratorEvent,
    config: DriftMonitorConfig,
  ): Promise<void> {
    // 1. Check stage_skipped
    if (event.toState === "skipped" && event.fromState === "created") {
      await createDriftAlert(companyId, event, "stage_skipped", "minor",
        `Stage ${event.stageId} was skipped without being attempted`);
    }

    // 2. Check sequence_violation
    if (event.event === "start" && event.toState === "in_progress") {
      await checkSequenceViolation(companyId, event);
    }

    // 3. Check retry_excessive
    if (event.event === "retry") {
      await checkRetryExcessive(companyId, event, config);
    }
  }

  // ... remaining implementation
}
```

### Etape 4 : Routes API

Ajouter les routes dans `server/src/routes/drift.ts` (5 nouvelles routes) :

```typescript
// GET /drift/alerts
router.get("/drift/alerts", async (req, res) => {
  // assertCompanyAccess, filtrage par severity, pagination
  // Appelle driftMonitorService(db).getDriftAlerts(companyId, filters)
});

// POST /drift/alerts/:alertId/resolve
router.post("/drift/alerts/:alertId/resolve", async (req, res) => {
  // Valider resolution body
  // Appelle driftMonitorService(db).resolveAlert(companyId, alertId, resolution)
  // emitAudit('drift.alert_resolved')
});

// GET /drift/monitor/status
router.get("/drift/monitor/status", async (req, res) => {
  // Retourne le statut du monitoring
});

// POST /drift/monitor/start
router.post("/drift/monitor/start", async (req, res) => {
  // Demarre le monitoring pour la company
  // requirePermission "workflows:enforce"
});

// POST /drift/monitor/stop
router.post("/drift/monitor/stop", async (req, res) => {
  // Arrete le monitoring pour la company
  // requirePermission "workflows:enforce"
});
```

### Etape 5 : Barrel exports

Mettre a jour `server/src/services/index.ts` :

```typescript
export { driftMonitorService } from "./drift-monitor.js";
```

Mettre a jour `packages/shared/src/types/index.ts` pour exporter les nouveaux types.

---

## Detection Details -- Algorithmes

### Detection time_exceeded

```
Pour chaque stage en etat "in_progress" :
  elapsed = now - stage.startedAt
  if elapsed > config.defaultStageTimeoutMs :
    if NOT already_alerted(stageId, "time_exceeded") :
      create alert "time_exceeded" severity "moderate"
      mark as alerted
```

### Detection stagnation

```
Pour chaque stage en etat "in_progress" :
  lastTransition = stage.transitionHistory[last].timestamp
  silent = now - lastTransition
  if silent > config.stagnationTimeoutMs :
    if NOT already_alerted(stageId, "stagnation") :
      create alert "stagnation" severity "critical"
      mark as alerted
```

### Detection sequence_violation

```
Quand un stage recoit l'event "start" :
  stages = getAllStages(workflowInstanceId) ORDER BY stageOrder
  currentStage = stages.find(s => s.id === event.stageId)
  previousStage = stages.find(s => s.stageOrder === currentStage.stageOrder - 1)
  if previousStage AND previousStage.machineState NOT IN ["completed", "skipped"] :
    create alert "sequence_violation" severity "critical"
```

### Detection retry_excessive

```
Quand un stage recoit l'event "retry" :
  retryCount = stage.retryCount + 1  // post-retry
  if retryCount >= config.retryAlertThreshold :
    if NOT already_alerted(stageId, "retry_excessive") :
      create alert "retry_excessive" severity "moderate"
```

### Deduplication

Le service maintient un `Map<stageId, Set<alertType>>` en memoire. Quand une alerte est creee, la cle `stageId:alertType` est ajoutee. Quand une alerte est resolue ou quand le stage atteint un etat final (`completed`, `terminated`, `skipped`), les cles sont nettoyees.

---

## Cas de Test pour QA (Playwright E2E -- file-content based)

### T01-T05 : Service drift-monitor.ts existence et structure

| ID | Test | Verification |
|----|------|-------------|
| T01 | Fichier drift-monitor.ts existe | `server/src/services/drift-monitor.ts` cree et exporte `driftMonitorService` |
| T02 | Fn startMonitoring presente | Fonction `startMonitoring` dans le service |
| T03 | Fn stopMonitoring presente | Fonction `stopMonitoring` dans le service |
| T04 | Fn onStageEvent presente | Fonction `onStageEvent` dans le service |
| T05 | Fn checkStageDrift presente | Fonction `checkStageDrift` dans le service |

### T06-T10 : Fonctions supplementaires

| ID | Test | Verification |
|----|------|-------------|
| T06 | Fn checkWorkflowTimeDrift presente | Fonction `checkWorkflowTimeDrift` dans le service |
| T07 | Fn createDriftAlert presente | Fonction `createDriftAlert` dans le service |
| T08 | Fn getDriftAlerts presente | Fonction `getDriftAlerts` dans le service |
| T09 | Fn resolveAlert presente | Fonction `resolveAlert` dans le service |
| T10 | Fn getMonitoringStatus presente | Fonction `getMonitoringStatus` dans le service |

### T11-T15 : Configuration et seuils

| ID | Test | Verification |
|----|------|-------------|
| T11 | Seuil time_exceeded = 15 min | `15 * 60 * 1000` ou `900_000` ou `900000` present dans le code |
| T12 | Seuil stagnation = 30 min | `30 * 60 * 1000` ou `1_800_000` ou `1800000` present dans le code |
| T13 | Seuil retry default = 2 | `retryAlertThreshold` avec valeur 2 |
| T14 | Intervalle check = 60s | `60 * 1000` ou `60_000` ou `60000` present pour l'intervalle |
| T15 | DriftMonitorConfig interface | Interface ou type `DriftMonitorConfig` avec les 5 champs |

### T16-T20 : Types partages

| ID | Test | Verification |
|----|------|-------------|
| T16 | DriftAlertType exporte | Type `DriftAlertType` avec les 5 valeurs dans drift.ts partage |
| T17 | DriftAlert interface | Interface `DriftAlert` avec champs id, companyId, stageId, alertType, severity, message |
| T18 | DriftMonitorConfig exporte | Interface `DriftMonitorConfig` exportee depuis drift.ts partage |
| T19 | DriftMonitorStatus exporte | Interface `DriftMonitorStatus` exportee depuis drift.ts partage |
| T20 | Types re-exportes dans index.ts | Les 4 types re-exportes dans types/index.ts |

### T21-T24 : LiveEventTypes

| ID | Test | Verification |
|----|------|-------------|
| T21 | drift.alert_created dans LIVE_EVENT_TYPES | String `"drift.alert_created"` dans constants.ts |
| T22 | drift.alert_resolved dans LIVE_EVENT_TYPES | String `"drift.alert_resolved"` dans constants.ts |
| T23 | drift.monitoring_started dans LIVE_EVENT_TYPES | String `"drift.monitoring_started"` dans constants.ts |
| T24 | drift.monitoring_stopped dans LIVE_EVENT_TYPES | String `"drift.monitoring_stopped"` dans constants.ts |

### T25-T30 : Integration events et persistence

| ID | Test | Verification |
|----|------|-------------|
| T25 | subscribeCompanyLiveEvents utilise | Import et appel de `subscribeCompanyLiveEvents` dans drift-monitor.ts |
| T26 | publishLiveEvent utilise | Import et appel de `publishLiveEvent` dans drift-monitor.ts |
| T27 | driftPersistenceService utilise | Import et appel de `driftPersistenceService` dans drift-monitor.ts |
| T28 | setInterval pour check periodique | `setInterval` utilise dans le service |
| T29 | clearInterval pour cleanup | `clearInterval` utilise dans stopMonitoring |
| T30 | Dedup Map pour eviter doublons | `Map` ou `Set` pour tracker les alertes actives par stage |

### T31-T35 : Detection de deviations

| ID | Test | Verification |
|----|------|-------------|
| T31 | Detection time_exceeded | String `"time_exceeded"` utilise comme type de drift dans le code |
| T32 | Detection stagnation | String `"stagnation"` utilise comme type de drift dans le code |
| T33 | Detection retry_excessive | String `"retry_excessive"` utilise comme type de drift dans le code |
| T34 | Detection stage_skipped | String `"stage_skipped"` utilise comme type de drift dans le code |
| T35 | Detection sequence_violation | String `"sequence_violation"` utilise comme type de drift dans le code |

### T36-T40 : Routes API

| ID | Test | Verification |
|----|------|-------------|
| T36 | Route GET /drift/alerts | Route GET avec path contenant `/drift/alerts` dans drift.ts routes |
| T37 | Route POST /drift/alerts/:alertId/resolve | Route POST avec path contenant `/drift/alerts/` et `/resolve` |
| T38 | Route GET /drift/monitor/status | Route GET avec path contenant `/drift/monitor/status` |
| T39 | Route POST /drift/monitor/start | Route POST avec path contenant `/drift/monitor/start` |
| T40 | Route POST /drift/monitor/stop | Route POST avec path contenant `/drift/monitor/stop` |

### T41-T45 : Barrel exports et audit

| ID | Test | Verification |
|----|------|-------------|
| T41 | driftMonitorService exporte dans services/index.ts | Export present dans barrel |
| T42 | emitAudit utilise pour alerte creee | `emitAudit` ou `audit` avec `"drift.alert_created"` dans le code |
| T43 | emitAudit utilise pour alerte resolue | `emitAudit` ou `audit` avec `"drift.alert_resolved"` dans le code |
| T44 | Actor type "system" pour alertes auto | `"system"` ou `"drift-monitor"` comme actorId pour les alertes automatiques |
| T45 | Non-blocking async pattern | `.catch()` ou `void` pattern pour les appels monitoring non-bloquants |

### T46-T50 : Edge cases et robustesse

| ID | Test | Verification |
|----|------|-------------|
| T46 | Filtrage events par type stage.* | Condition `event.type.startsWith("stage.")` ou equivalent |
| T47 | Logging des erreurs monitoring | `logger.error` ou `logger.warn` pour les erreurs de monitoring |
| T48 | Guard payload invalide | Check `payload?.stageId` ou equivalent avant traitement |
| T49 | Monitor cleanup on stop | `unsubscribe()` et `clearInterval()` dans stopMonitoring |
| T50 | Sequence check load stages | Query `stageInstances` avec `workflowInstanceId` et `stageOrder` |

---

## Notes Techniques

### Performance

- Le monitoring est **event-driven** (pas de polling DB) pour les detections stage_skipped, sequence_violation, retry_excessive
- Seules les verifications **time_exceeded** et **stagnation** utilisent un check periodique (1/min)
- Le check periodique ne query que les stages en etat `in_progress` (query indexee sur `machineState`)
- La deduplication est in-memory (Map) pour eviter des requetes DB supplementaires

### Couplage

- Le drift monitor est **decouple** de l'orchestrateur : il ecoute les LiveEvents, pas d'appel direct
- Cela signifie que si le monitoring est arrete, l'orchestrateur continue de fonctionner normalement
- Le monitoring peut etre demarre/arrete dynamiquement sans restart

### Resilience

- Les erreurs de monitoring sont **logguees mais ne bloquent pas** l'orchestrateur
- Si le serveur redemarre, les subscriptions sont perdues mais les alertes deja creees sont en DB
- Le monitoring doit etre re-demarre explicitement apres un restart (pas d'auto-start)

### Reuse des tables DRIFT-S01

- Le drift monitor reutilise les tables `drift_reports` et `drift_items` de DRIFT-S01
- Le champ `driftType` est etendu avec les nouveaux types (time_exceeded, stagnation, etc.)
- Le champ `scanScope` est utilise pour distinguer les alertes monitoring (`"execution_monitor"`)
- Pas besoin de nouvelles tables ni de migration

### Mapping DriftAlert vers drift_reports/drift_items

Un `DriftAlert` est persiste comme :
- 1 `drift_report` avec `sourceDoc = "workflow:<workflowInstanceId>"`, `targetDoc = "stage:<stageId>"`, `scanScope = "execution_monitor"`
- 1 `drift_item` avec `driftType = <alertType>`, `severity = <severity>`, `description = <message>`

La fonction `getDriftAlerts()` query les reports avec `scanScope = "execution_monitor"` et les map en `DriftAlert`.

---

## Definition of Done

- [ ] Service drift-monitor.ts cree (~300-400 lignes) avec 10 fonctions
- [ ] 5 types de deviation detectes (time_exceeded, stagnation, retry_excessive, stage_skipped, sequence_violation)
- [ ] Alertes WebSocket emises via publishLiveEvent()
- [ ] 4 nouveaux LiveEventTypes enregistres dans constants.ts
- [ ] Alertes persistees via drift-persistence (reutilisation tables DRIFT-S01)
- [ ] Deduplication des alertes (pas de doublon par stageId + alertType)
- [ ] 5 routes API pour alertes et monitoring
- [ ] Check periodique pour time drift (intervalle configurable, default 60s)
- [ ] Types partages enrichis (DriftAlertType, DriftAlert, DriftMonitorConfig, DriftMonitorStatus)
- [ ] Barrel exports mis a jour (services + types)
- [ ] Audit events emis pour creation et resolution d'alertes
- [ ] Integration non-bloquante avec l'orchestrateur (via LiveEvents, pas d'appel direct)
- [ ] 50 tests E2E Playwright passent (file-content based)
- [ ] `pnpm typecheck` passe sans erreur
- [ ] Pas de regression sur les tests existants
