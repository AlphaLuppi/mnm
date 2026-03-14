# COMP-S01 — CompactionWatcher : Détection de Compaction

> **Epic** : COMP — Gestion Compaction
> **Batch** : 11 — A2A + Dual-Speed + Compaction
> **Priorité** : P0 (Critical Path)
> **Effort** : L (8 SP, 5-7j)
> **Assignation** : Cofondateur
> **Dépendances** : ORCH-S01 (state machine XState) ✅
> **Débloque** : COMP-S02 (Kill+Relance), COMP-S03 (Réinjection post-compaction)

---

## 1. Contexte

La compaction est un phénomène critique dans les agents AI : lorsque le contexte
d'un LLM atteint sa limite, l'agent effectue un résumé automatique de sa mémoire,
ce qui peut entraîner la perte de directives critiques (workflow, pré-prompts, fichiers
obligatoires). Le CompactionWatcher surveille les heartbeat events des agents en
exécution, détecte les patterns de compaction, persiste les snapshots pré/post-compaction,
et déclenche les transitions appropriées via l'orchestrateur.

**ADR** : ADR-008 — Gestion de Compaction (Risque R1)
**Stratégie** : Détection basée sur les heartbeat run events (output logs des agents).

---

## 2. Acceptance Criteria

### AC1 — Détection par pattern matching sur heartbeat events
**Given** un agent en exécution (stage `in_progress`)
**When** un heartbeat run event contient un pattern de compaction reconnu
**Then** le CompactionWatcher marque la compaction comme détectée

### AC2 — Transition vers `compacting` via orchestrateur
**Given** une compaction détectée sur une stage `in_progress`
**When** le CompactionWatcher déclenche `compact_detected`
**Then** la stage passe de `in_progress` à `compacting` via l'orchestrateur XState

### AC3 — Snapshot pré-compaction persisté
**Given** une compaction détectée
**When** le snapshot est créé
**Then** il contient : stageId, workflowInstanceId, companyId, stageOrder, agentId, outputArtifacts des stages précédentes, prePrompts injectés, position dans le workflow, timestamp de détection

### AC4 — Émission audit event
**Given** une compaction détectée
**When** le snapshot est persisté
**Then** un audit event `compaction.detected` est émis avec severity=`warning`

### AC5 — Émission LiveEvent WebSocket
**Given** une compaction détectée
**When** la transition est effectuée
**Then** un LiveEvent `compaction.detected` est émis avec le payload du snapshot

### AC6 — Monitoring en temps réel via LiveEvents
**Given** le CompactionWatcher actif pour une company
**When** des heartbeat run events arrivent
**Then** ils sont analysés en temps réel via subscription LiveEvents (même pattern que drift-monitor)

### AC7 — Configuration du watcher
**Given** un CompactionWatcher
**When** il est initialisé
**Then** la config contient : patterns de détection, enabled flag, cooldownMs entre détections

### AC8 — Déduplication des détections
**Given** une compaction déjà détectée pour un agent/run
**When** un second pattern match survient dans le cooldown
**Then** la seconde détection est ignorée (pas de doublon)

### AC9 — API routes CRUD
**Given** un utilisateur avec permission `workflows:enforce`
**When** il appelle les routes compaction
**Then** il peut : start/stop monitoring, lister les snapshots, obtenir le status du watcher

### AC10 — Récupération des artifacts pour recovery (getStageArtifacts)
**Given** une compaction détectée sur une stage d'un workflow
**When** le snapshot est construit
**Then** il utilise `workflowEnforcerService.getStageArtifacts()` pour récupérer les résultats intermédiaires des stages précédentes

### AC11 — Patterns de compaction reconnus
**Given** les outputs d'un agent AI
**When** un message matche un des patterns suivants :
- `"I'll now summarize"` / `"Let me summarize"`
- `"context window"` / `"token limit"`
- `"compacting"` / `"compaction"`
- `"memory summary"` / `"context summary"`
- `"truncating context"` / `"trimming context"`
- `"conversation too long"` / `"context too large"`
**Then** la détection est déclenchée

### AC12 — Intégration barrel exports
**Given** le service CompactionWatcher
**When** il est exporté
**Then** il est accessible via `server/src/services/index.ts` et les types/validators via `@mnm/shared`

---

## 3. Livrables Techniques

### 3.1 Nouveau fichier : `server/src/services/compaction-watcher.ts`

Service principal (~300 lignes). Pattern calqué sur `drift-monitor.ts` :
- Factory function `compactionWatcherService(db: Db)`
- In-memory monitors par companyId
- Subscribe aux LiveEvents `heartbeat.run.event`
- Analyse des messages pour patterns de compaction
- Crée snapshots, déclenche transitions orchestrateur
- Émet audit events et LiveEvents

**Fonctions exposées** :
| Fonction | Signature | Description |
|----------|-----------|-------------|
| `startWatching` | `(companyId: string, config?: Partial<CompactionWatcherConfig>) => Promise<CompactionWatcherStatus>` | Démarre la surveillance pour une company |
| `stopWatching` | `(companyId: string) => Promise<void>` | Arrête la surveillance |
| `getWatcherStatus` | `(companyId: string) => CompactionWatcherStatus` | Statut du watcher |
| `getSnapshots` | `(companyId: string, filters?: CompactionSnapshotFilters) => Promise<CompactionSnapshot[]>` | Liste les snapshots de compaction |
| `getSnapshotById` | `(companyId: string, snapshotId: string) => Promise<CompactionSnapshot | null>` | Récupère un snapshot |
| `onHeartbeatEvent` | `(companyId: string, event: LiveEvent) => Promise<void>` | Handler interne pour les events heartbeat |

### 3.2 Nouveau fichier : `packages/shared/src/types/compaction.ts`

Types partagés :

```typescript
// Compaction detection strategies
export const COMPACTION_STRATEGIES = ["kill_relaunch", "reinjection"] as const;
export type CompactionStrategy = (typeof COMPACTION_STRATEGIES)[number];

// Snapshot of state at compaction detection
export interface CompactionSnapshot {
  id: string;
  companyId: string;
  workflowInstanceId: string;
  stageId: string;
  agentId: string;
  stageOrder: number;
  detectedAt: string; // ISO 8601
  detectionPattern: string; // pattern that triggered detection
  detectionMessage: string; // original message that matched
  previousArtifacts: StageArtifact[]; // from getStageArtifacts
  prePromptsInjected: PrePromptPayload | null;
  outputArtifactsSoFar: string[];
  strategy: CompactionStrategy;
  status: CompactionSnapshotStatus;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
}

export const COMPACTION_SNAPSHOT_STATUSES = [
  "pending",
  "processing",
  "resolved",
  "failed",
] as const;
export type CompactionSnapshotStatus = (typeof COMPACTION_SNAPSHOT_STATUSES)[number];

// Watcher configuration
export interface CompactionWatcherConfig {
  enabled: boolean;
  cooldownMs: number; // min ms between detections per agent
  patterns: string[]; // regex patterns to detect compaction
}

// Watcher status
export interface CompactionWatcherStatus {
  active: boolean;
  activeSnapshotCount: number;
  startedAt: string | null;
  lastCheckAt: string | null;
  config: CompactionWatcherConfig;
}

// Filters for snapshot queries
export interface CompactionSnapshotFilters {
  stageId?: string;
  agentId?: string;
  status?: CompactionSnapshotStatus;
  limit?: number;
  offset?: number;
}
```

### 3.3 Nouveau fichier : `packages/shared/src/validators/compaction.ts`

Zod validators pour les routes API.

### 3.4 Modifications : `packages/shared/src/types/index.ts`

Export des types compaction.

### 3.5 Modifications : `packages/shared/src/validators/index.ts`

Export des validators compaction.

### 3.6 Modifications : `packages/shared/src/index.ts`

Export barrel compaction types et validators.

### 3.7 Modifications : `packages/shared/src/constants.ts`

4 nouveaux LiveEventType :
- `"compaction.detected"`
- `"compaction.snapshot_created"`
- `"compaction.watching_started"`
- `"compaction.watching_stopped"`

### 3.8 Nouveau fichier : `server/src/routes/compaction.ts`

5 routes API :

| Route | Méthode | Permission | Description |
|-------|---------|------------|-------------|
| `POST /companies/:companyId/compaction/start` | POST | `workflows:enforce` | Start watching |
| `POST /companies/:companyId/compaction/stop` | POST | `workflows:enforce` | Stop watching |
| `GET /companies/:companyId/compaction/status` | GET | `workflows:enforce` | Get watcher status |
| `GET /companies/:companyId/compaction/snapshots` | GET | `workflows:enforce` | List snapshots |
| `GET /companies/:companyId/compaction/snapshots/:snapshotId` | GET | `workflows:enforce` | Get snapshot |

### 3.9 Modifications : `server/src/routes/index.ts`

Export `compactionRoutes`.

### 3.10 Modifications : `server/src/services/index.ts`

Export `compactionWatcherService`.

---

## 4. data-testid Mapping

| data-testid | Élément | Fichier |
|-------------|---------|---------|
| `comp-s01-watcher-service` | Service factory | `compaction-watcher.ts` |
| `comp-s01-start-watching` | startWatching function | `compaction-watcher.ts` |
| `comp-s01-stop-watching` | stopWatching function | `compaction-watcher.ts` |
| `comp-s01-get-status` | getWatcherStatus function | `compaction-watcher.ts` |
| `comp-s01-get-snapshots` | getSnapshots function | `compaction-watcher.ts` |
| `comp-s01-get-snapshot-by-id` | getSnapshotById function | `compaction-watcher.ts` |
| `comp-s01-on-heartbeat-event` | onHeartbeatEvent handler | `compaction-watcher.ts` |
| `comp-s01-detect-compaction` | detectCompaction internal | `compaction-watcher.ts` |
| `comp-s01-create-snapshot` | createSnapshot internal | `compaction-watcher.ts` |
| `comp-s01-trigger-transition` | triggerTransition internal | `compaction-watcher.ts` |
| `comp-s01-default-patterns` | DEFAULT_COMPACTION_PATTERNS | `compaction-watcher.ts` |
| `comp-s01-default-config` | DEFAULT_CONFIG | `compaction-watcher.ts` |
| `comp-s01-dedup-tracker` | cooldown dedup tracker | `compaction-watcher.ts` |
| `comp-s01-snapshot-type` | CompactionSnapshot type | `types/compaction.ts` |
| `comp-s01-config-type` | CompactionWatcherConfig type | `types/compaction.ts` |
| `comp-s01-status-type` | CompactionWatcherStatus type | `types/compaction.ts` |
| `comp-s01-strategy-const` | COMPACTION_STRATEGIES const | `types/compaction.ts` |
| `comp-s01-snapshot-statuses` | COMPACTION_SNAPSHOT_STATUSES const | `types/compaction.ts` |
| `comp-s01-route-start` | POST /compaction/start | `routes/compaction.ts` |
| `comp-s01-route-stop` | POST /compaction/stop | `routes/compaction.ts` |
| `comp-s01-route-status` | GET /compaction/status | `routes/compaction.ts` |
| `comp-s01-route-snapshots` | GET /compaction/snapshots | `routes/compaction.ts` |
| `comp-s01-route-snapshot-by-id` | GET /compaction/snapshots/:id | `routes/compaction.ts` |
| `comp-s01-validator-start` | startCompactionWatcherSchema | `validators/compaction.ts` |
| `comp-s01-validator-snapshots` | compactionSnapshotFiltersSchema | `validators/compaction.ts` |
| `comp-s01-live-event-detected` | LiveEvent compaction.detected | `constants.ts` |
| `comp-s01-live-event-snapshot` | LiveEvent compaction.snapshot_created | `constants.ts` |
| `comp-s01-live-event-started` | LiveEvent compaction.watching_started | `constants.ts` |
| `comp-s01-live-event-stopped` | LiveEvent compaction.watching_stopped | `constants.ts` |
| `comp-s01-barrel-svc` | Service barrel export | `services/index.ts` |
| `comp-s01-barrel-route` | Route barrel export | `routes/index.ts` |
| `comp-s01-barrel-types` | Types barrel export | `types/index.ts` |
| `comp-s01-barrel-validators` | Validators barrel export | `validators/index.ts` |
| `comp-s01-barrel-shared` | Shared barrel export | `shared/index.ts` |

---

## 5. Test Cases (E2E — file-content based)

### T01 — Service factory export
Verify `compaction-watcher.ts` exports `compactionWatcherService` function.

### T02 — startWatching function exists
Verify service returns object with `startWatching` method.

### T03 — stopWatching function exists
Verify service returns object with `stopWatching` method.

### T04 — getWatcherStatus function exists
Verify service returns object with `getWatcherStatus` method.

### T05 — getSnapshots function exists
Verify service returns object with `getSnapshots` method.

### T06 — getSnapshotById function exists
Verify service returns object with `getSnapshotById` method.

### T07 — onHeartbeatEvent function exists
Verify service returns object with `onHeartbeatEvent` method.

### T08 — Default compaction patterns include key phrases
Verify DEFAULT_COMPACTION_PATTERNS includes patterns for "summarize", "context window", "compacting", "token limit".

### T09 — Default config has correct shape
Verify DEFAULT_CONFIG includes `enabled`, `cooldownMs`, `patterns` fields.

### T10 — Subscribes to heartbeat events
Verify `subscribeCompanyLiveEvents` is imported and used in startWatching.

### T11 — Uses orchestratorService for transitions
Verify `orchestratorService` is imported and used for `compact_detected` event.

### T12 — Uses workflowEnforcerService for recovery artifacts
Verify `workflowEnforcerService.getStageArtifacts` is used for snapshot building.

### T13 — Uses auditService for event emission
Verify `auditService` is imported and `audit.emit` is called for compaction.detected.

### T14 — Uses publishLiveEvent for WebSocket
Verify `publishLiveEvent` is imported and called with `compaction.detected` type.

### T15 — Deduplication tracker (cooldown Map)
Verify in-memory cooldown tracker using Map for dedup by agent/run.

### T16 — CompactionSnapshot type definition
Verify `packages/shared/src/types/compaction.ts` contains `CompactionSnapshot` interface with required fields.

### T17 — CompactionWatcherConfig type definition
Verify `CompactionWatcherConfig` interface with `enabled`, `cooldownMs`, `patterns`.

### T18 — CompactionWatcherStatus type definition
Verify `CompactionWatcherStatus` interface with `active`, `activeSnapshotCount`, `startedAt`.

### T19 — COMPACTION_STRATEGIES constant
Verify `COMPACTION_STRATEGIES` array includes `"kill_relaunch"` and `"reinjection"`.

### T20 — COMPACTION_SNAPSHOT_STATUSES constant
Verify `COMPACTION_SNAPSHOT_STATUSES` includes `"pending"`, `"processing"`, `"resolved"`, `"failed"`.

### T21 — CompactionSnapshotFilters type
Verify `CompactionSnapshotFilters` includes `stageId`, `agentId`, `status`, `limit`, `offset`.

### T22 — Zod validator: startCompactionWatcherSchema
Verify `validators/compaction.ts` exports `startCompactionWatcherSchema`.

### T23 — Zod validator: compactionSnapshotFiltersSchema
Verify `validators/compaction.ts` exports `compactionSnapshotFiltersSchema`.

### T24 — Types barrel export
Verify `types/index.ts` exports CompactionSnapshot, CompactionWatcherConfig, CompactionWatcherStatus, etc.

### T25 — Validators barrel export
Verify `validators/index.ts` exports compaction validators.

### T26 — Shared index barrel export types
Verify `packages/shared/src/index.ts` exports compaction types.

### T27 — Shared index barrel export validators
Verify `packages/shared/src/index.ts` exports compaction validators.

### T28 — LiveEventType includes compaction events
Verify `LIVE_EVENT_TYPES` in constants.ts includes `"compaction.detected"`, `"compaction.snapshot_created"`, `"compaction.watching_started"`, `"compaction.watching_stopped"`.

### T29 — Route: POST compaction/start
Verify `routes/compaction.ts` has POST route for start with `requirePermission(db, "workflows:enforce")`.

### T30 — Route: POST compaction/stop
Verify `routes/compaction.ts` has POST route for stop.

### T31 — Route: GET compaction/status
Verify `routes/compaction.ts` has GET route for status.

### T32 — Route: GET compaction/snapshots
Verify `routes/compaction.ts` has GET route for listing snapshots.

### T33 — Route: GET compaction/snapshots/:snapshotId
Verify `routes/compaction.ts` has GET route for snapshot by id.

### T34 — Routes barrel export
Verify `routes/index.ts` exports `compactionRoutes`.

### T35 — Service barrel export
Verify `services/index.ts` exports `compactionWatcherService`.

### T36 — Pattern matching logic uses regex
Verify `detectCompaction` function creates RegExp from patterns for case-insensitive matching.

### T37 — Snapshot includes previousArtifacts
Verify snapshot creation calls `getStageArtifacts` to populate `previousArtifacts`.

### T38 — Snapshot includes prePromptsInjected
Verify snapshot creation reads `prePromptsInjected` from stage instance.

### T39 — Audit emit uses severity "warning"
Verify `audit.emit` call includes `severity: "warning"`.

### T40 — Logger usage
Verify `logger` from middleware is imported and used for info/error logging.

### T41 — assertCompanyAccess in routes
Verify routes use `assertCompanyAccess(req, companyId)` pattern.

### T42 — getActorInfo in routes
Verify routes use `getActorInfo(req)` for actor extraction.

### T43 — emitAudit in routes
Verify routes call `emitAudit` for auditing.

### T44 — Route uses validate middleware
Verify POST routes use `validate()` middleware with compaction schemas.

### T45 — CompactionStrategy type export
Verify `CompactionStrategy` type is exported from types/compaction.ts.

### T46 — Monitors map uses companyId as key
Verify in-memory `monitors` Map uses `companyId` as key (same pattern as drift-monitor).

### T47 — stopWatching clears interval and unsubscribes
Verify stopWatching calls `unsubscribe()` and `clearInterval()`.

### T48 — Event filter: only heartbeat.run.event processed
Verify onHeartbeatEvent only processes events with type starting with `heartbeat.run.event` or `heartbeat.run.log`.

### T49 — Stage lookup before snapshot
Verify service loads the stage from DB using stageInstances before creating snapshot.

### T50 — CompactionSnapshot has id field (uuid generation)
Verify snapshot creation generates a unique id (crypto.randomUUID or similar).

---

## 6. Architecture Notes

### 6.1 Pattern de détection
Le watcher surveille les `heartbeat.run.event` et `heartbeat.run.log` LiveEvents.
Quand le champ `message` d'un event matche un pattern de compaction, il :
1. Vérifie la déduplication (cooldown par agentId)
2. Identifie la stage en cours via le runId → agentId → stageInstances en `in_progress`
3. Crée un CompactionSnapshot avec les artifacts des stages précédentes
4. Déclenche `orchestrator.transitionStage(stageId, "compact_detected", ...)`
5. Émet audit + LiveEvent

### 6.2 Stockage des snapshots
Les snapshots sont stockés **en mémoire** dans cette story (Map<string, CompactionSnapshot[]>).
La persistance DB sera ajoutée dans COMP-S02 (table `compaction_snapshots`).

### 6.3 Intégration avec ORCH-S01
Le state machine XState supporte déjà la transition `compact_detected` :
- `in_progress` → `compacting` via `compact_detected`
- `compacting` → `in_progress` via `reinjected` (COMP-S03)
- `compacting` → `terminated` via `compaction_failed`

---

*COMP-S01 v1.0 — 50 test cases — 35 data-testid — 12 ACs*
