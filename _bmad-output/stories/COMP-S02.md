# COMP-S02 — Kill+Relance: Compaction Recovery Service

> **Epic** : COMP — Gestion Compaction
> **Story** : COMP-S02
> **Titre** : Stratégie Kill+Relance
> **Priorité** : P0 (MUST-HAVE)
> **Effort** : L (8 SP, 5-7j)
> **Assignation** : Cofondateur
> **Dépendances** : COMP-S01 (CompactionWatcher) ✅, CONT-S01 (ContainerManager) ✅

---

## 1. Objectif

Quand une compaction est détectée (COMP-S01), le système doit pouvoir **kill** le container de l'agent compacté et le **relancer** avec un contexte frais contenant les résultats intermédiaires des étapes déjà complétées. Un circuit breaker (max 3 relances par session) empêche les boucles infinies. La table `compaction_snapshots` assure la persistance (remplace le stockage in-memory de COMP-S01).

---

## 2. Acceptance Criteria (Given/When/Then)

### AC1 — Kill+Relance basique
**Given** un agent à l'étape 3/5 en état `compacting`
**When** la stratégie kill_relaunch est exécutée
**Then** le snapshot est sauvegardé avec status `processing`, le container est stoppé, un nouveau container est lancé avec le contexte des étapes 1-2, et le stage est transitionné vers `in_progress`

### AC2 — Circuit breaker atteint
**Given** un agent qui a déjà été relancé 3 fois (maxRelaunchCount atteint)
**When** une nouvelle compaction est détectée
**Then** le système émet une alerte humaine, le workflow est mis en pause (état `paused`), et aucun nouveau container n'est lancé

### AC3 — Snapshot persistance DB
**Given** une compaction détectée
**When** le snapshot est créé
**Then** il est stocké dans la table `compaction_snapshots` (pas en mémoire) avec tous les champs requis

### AC4 — Snapshot résolu après relance réussie
**Given** un snapshot en status `processing`
**When** le nouveau container démarre avec succès
**Then** le snapshot passe en status `resolved` avec `resolvedAt` renseigné

### AC5 — Snapshot échoué sur erreur container
**Given** un snapshot en status `processing`
**When** le lancement du nouveau container échoue
**Then** le snapshot passe en status `failed` avec l'erreur dans metadata

### AC6 — Contexte de relance enrichi
**Given** un agent relancé après compaction
**When** le nouveau container est créé
**Then** les variables d'environnement incluent `MNM_COMPACTION_RECOVERY=true`, `MNM_SNAPSHOT_ID`, et `MNM_RECOVERY_STAGE_ORDER`

### AC7 — Audit émis pour kill+relance
**Given** une opération kill+relance
**When** elle s'exécute
**Then** les audit events `compaction.kill_started`, `compaction.container_stopped`, `compaction.relaunch_started`, et `compaction.relaunch_completed` sont émis

### AC8 — LiveEvents émis
**Given** une opération kill+relance
**When** elle progresse
**Then** les LiveEvents `compaction.kill_started`, `compaction.relaunch_started`, `compaction.relaunch_completed`, et `compaction.circuit_breaker_triggered` (si applicable) sont publiés

### AC9 — Relaunch count trackable
**Given** un snapshot
**When** on interroge le service
**Then** le `relaunchCount` par agent+workflowInstance est disponible

### AC10 — Route POST kill-relaunch
**Given** un admin/manager
**When** il appelle `POST /companies/:companyId/compaction/snapshots/:snapshotId/kill-relaunch`
**Then** la stratégie kill+relance est exécutée pour ce snapshot

### AC11 — Route GET relaunch-history
**Given** un admin/manager
**When** il appelle `GET /companies/:companyId/compaction/relaunch-history`
**Then** l'historique des relances avec relaunchCount est retourné

### AC12 — Compaction snapshots table migration
**Given** le serveur MnM
**When** la migration s'exécute
**Then** la table `compaction_snapshots` est créée avec tous les champs, indexes, et relations

---

## 3. Deliverables

### 3.1 Schema DB — `packages/db/src/schema/compaction-snapshots.ts`
Table `compaction_snapshots` avec colonnes :
- `id` (uuid, PK)
- `companyId` (uuid, FK companies, NOT NULL)
- `workflowInstanceId` (uuid, NOT NULL)
- `stageId` (uuid, NOT NULL)
- `agentId` (uuid, NOT NULL)
- `stageOrder` (integer, NOT NULL)
- `detectedAt` (timestamp, NOT NULL)
- `detectionPattern` (text, NOT NULL)
- `detectionMessage` (text, NOT NULL)
- `previousArtifacts` (jsonb, default [])
- `prePromptsInjected` (jsonb, nullable)
- `outputArtifactsSoFar` (jsonb, default [])
- `strategy` (text, NOT NULL, default 'kill_relaunch')
- `status` (text, NOT NULL, default 'pending')
- `resolvedAt` (timestamp, nullable)
- `relaunchCount` (integer, NOT NULL, default 0)
- `maxRelaunchCount` (integer, NOT NULL, default 3)
- `metadata` (jsonb, default {})
- `createdAt` (timestamp, NOT NULL, default now)
- `updatedAt` (timestamp, NOT NULL, default now)

Indexes :
- `idx_compaction_snapshots_company_id` on `companyId`
- `idx_compaction_snapshots_agent_stage` on `(agentId, stageId)`
- `idx_compaction_snapshots_status` on `status`

### 3.2 Migration — `packages/db/src/migrations/00XX_compaction_snapshots.sql`
SQL migration creating the table with indexes.

### 3.3 Service — `server/src/services/compaction-kill-relaunch.ts`

**Functions** :
- `executeKillRelaunch(companyId, snapshotId, actorId)` — main kill+relaunch orchestration
- `getRelaunchCount(companyId, agentId, workflowInstanceId)` — get current relaunch count
- `getRelaunchHistory(companyId, filters?)` — list relaunch history
- `persistSnapshot(companyId, snapshot)` — save snapshot to DB (replaces in-memory store)
- `updateSnapshotStatus(snapshotId, status, metadata?)` — update snapshot status
- `getSnapshotFromDb(companyId, snapshotId)` — read snapshot from DB
- `listSnapshotsFromDb(companyId, filters?)` — list snapshots from DB

### 3.4 Integration — Update `compaction-watcher.ts`
- Replace in-memory `snapshotStore` with DB persistence via `compaction-kill-relaunch.ts`
- Add `strategy` field handling when creating snapshots
- Wire `executeKillRelaunch` when strategy is `kill_relaunch`

### 3.5 Shared Types — Update `packages/shared/src/types/compaction.ts`
- Add `KillRelaunchResult` interface
- Add `RelaunchHistoryEntry` interface
- Add `relaunchCount` and `maxRelaunchCount` to `CompactionSnapshot`

### 3.6 Validators — Update `packages/shared/src/validators/compaction.ts`
- Add `killRelaunchSchema` validator
- Add `relaunchHistoryFiltersSchema` validator

### 3.7 Routes — Update `server/src/routes/compaction.ts`
Two new routes:
- `POST /companies/:companyId/compaction/snapshots/:snapshotId/kill-relaunch`
- `GET /companies/:companyId/compaction/relaunch-history`

### 3.8 Barrel Exports
- Export schema from `packages/db/src/schema/index.ts`
- Export service from `server/src/services/index.ts`
- Export new types and validators from shared barrels

---

## 4. Data Test IDs

| Element | data-testid |
|---------|-------------|
| Service factory | `comp-s02-kill-relaunch-service` |
| executeKillRelaunch fn | `comp-s02-execute-kill-relaunch` |
| getRelaunchCount fn | `comp-s02-get-relaunch-count` |
| getRelaunchHistory fn | `comp-s02-get-relaunch-history` |
| persistSnapshot fn | `comp-s02-persist-snapshot` |
| updateSnapshotStatus fn | `comp-s02-update-snapshot-status` |
| getSnapshotFromDb fn | `comp-s02-get-snapshot-from-db` |
| listSnapshotsFromDb fn | `comp-s02-list-snapshots-from-db` |
| Circuit breaker check | `comp-s02-circuit-breaker-check` |
| Circuit breaker trigger | `comp-s02-circuit-breaker-trigger` |
| Container stop call | `comp-s02-container-stop` |
| Container relaunch call | `comp-s02-container-relaunch` |
| Recovery env vars | `comp-s02-recovery-env-vars` |
| Audit kill started | `comp-s02-audit-kill-started` |
| Audit container stopped | `comp-s02-audit-container-stopped` |
| Audit relaunch started | `comp-s02-audit-relaunch-started` |
| Audit relaunch completed | `comp-s02-audit-relaunch-completed` |
| LiveEvent kill started | `comp-s02-live-kill-started` |
| LiveEvent relaunch started | `comp-s02-live-relaunch-started` |
| LiveEvent relaunch completed | `comp-s02-live-relaunch-completed` |
| LiveEvent circuit breaker | `comp-s02-live-circuit-breaker` |
| Schema table | `comp-s02-schema-table` |
| Schema companyId idx | `comp-s02-idx-company` |
| Schema agent-stage idx | `comp-s02-idx-agent-stage` |
| Schema status idx | `comp-s02-idx-status` |
| Migration file | `comp-s02-migration` |
| Route kill-relaunch | `comp-s02-route-kill-relaunch` |
| Route relaunch-history | `comp-s02-route-relaunch-history` |
| Watcher DB integration | `comp-s02-watcher-db-integration` |
| Snapshot to DB persist | `comp-s02-snapshot-db-persist` |
| Type KillRelaunchResult | `comp-s02-type-kill-relaunch-result` |
| Type RelaunchHistoryEntry | `comp-s02-type-relaunch-history-entry` |
| Validator kill-relaunch | `comp-s02-validator-kill-relaunch` |
| Validator history filters | `comp-s02-validator-history-filters` |
| Barrel export service | `comp-s02-barrel-service` |
| Barrel export schema | `comp-s02-barrel-schema` |
| Barrel export types | `comp-s02-barrel-types` |
| Barrel export validators | `comp-s02-barrel-validators` |

---

## 5. Test Cases (38 tests)

### Service: compaction-kill-relaunch.ts (18 tests)

| # | Test Case | Validates |
|---|-----------|-----------|
| T01 | exports compactionKillRelaunchService factory | AC10 |
| T02 | service returns executeKillRelaunch method | AC1 |
| T03 | service returns getRelaunchCount method | AC9 |
| T04 | service returns getRelaunchHistory method | AC11 |
| T05 | service returns persistSnapshot method | AC3 |
| T06 | service returns updateSnapshotStatus method | AC4/AC5 |
| T07 | service returns getSnapshotFromDb method | AC3 |
| T08 | service returns listSnapshotsFromDb method | AC3 |
| T09 | executeKillRelaunch calls containerManagerService.stopContainer | AC1 |
| T10 | executeKillRelaunch calls containerManagerService.launchContainer | AC1 |
| T11 | executeKillRelaunch sets recovery env vars MNM_COMPACTION_RECOVERY | AC6 |
| T12 | executeKillRelaunch sets MNM_SNAPSHOT_ID env var | AC6 |
| T13 | executeKillRelaunch sets MNM_RECOVERY_STAGE_ORDER env var | AC6 |
| T14 | circuit breaker checks relaunchCount >= maxRelaunchCount | AC2 |
| T15 | circuit breaker transitions stage to paused | AC2 |
| T16 | executeKillRelaunch emits audit compaction.kill_started | AC7 |
| T17 | executeKillRelaunch emits audit compaction.relaunch_completed | AC7 |
| T18 | executeKillRelaunch emits LiveEvent compaction.kill_started | AC8 |

### Watcher DB Integration (4 tests)

| # | Test Case | Validates |
|---|-----------|-----------|
| T19 | compaction-watcher imports compactionKillRelaunchService | AC3 |
| T20 | watcher uses persistSnapshot instead of in-memory store | AC3 |
| T21 | watcher uses listSnapshotsFromDb for getSnapshots | AC3 |
| T22 | watcher uses getSnapshotFromDb for getSnapshotById | AC3 |

### Schema: compaction-snapshots.ts (6 tests)

| # | Test Case | Validates |
|---|-----------|-----------|
| T23 | schema exports compactionSnapshots table | AC12 |
| T24 | schema has relaunchCount column with default 0 | AC9 |
| T25 | schema has maxRelaunchCount column with default 3 | AC2 |
| T26 | schema has idx_compaction_snapshots_company_id index | AC12 |
| T27 | schema has idx_compaction_snapshots_agent_stage index | AC12 |
| T28 | schema has idx_compaction_snapshots_status index | AC12 |

### Routes: compaction.ts (4 tests)

| # | Test Case | Validates |
|---|-----------|-----------|
| T29 | route POST kill-relaunch exists with requirePermission | AC10 |
| T30 | route GET relaunch-history exists with requirePermission | AC11 |
| T31 | kill-relaunch route calls executeKillRelaunch | AC10 |
| T32 | relaunch-history route calls getRelaunchHistory | AC11 |

### Shared Types & Validators (4 tests)

| # | Test Case | Validates |
|---|-----------|-----------|
| T33 | types file exports KillRelaunchResult interface | AC1 |
| T34 | types file exports RelaunchHistoryEntry interface | AC11 |
| T35 | validators file exports killRelaunchSchema | AC10 |
| T36 | validators file exports relaunchHistoryFiltersSchema | AC11 |

### Barrel Exports (2 tests)

| # | Test Case | Validates |
|---|-----------|-----------|
| T37 | services/index.ts exports compactionKillRelaunchService | AC10 |
| T38 | db schema/index.ts exports compactionSnapshots | AC12 |

---

## 6. Architecture Notes

### Kill+Relaunch Flow
```
CompactionWatcher detects compaction
  → Creates snapshot in DB (status: pending)
  → Calls compactionKillRelaunchService.executeKillRelaunch()
    → Check circuit breaker (relaunchCount < maxRelaunchCount)
    → If circuit breaker tripped:
      → Transition stage to paused
      → Emit audit compaction.circuit_breaker_triggered
      → Emit LiveEvent compaction.circuit_breaker_triggered
      → Update snapshot status to failed
      → Return { success: false, reason: "circuit_breaker" }
    → Update snapshot status to processing
    → Emit audit compaction.kill_started
    → Stop current container via ContainerManager.stopContainer()
    → Emit audit compaction.container_stopped
    → Build recovery context (previousArtifacts, prePrompts, stageOrder)
    → Launch new container via ContainerManager.launchContainer()
      with MNM_COMPACTION_RECOVERY=true, MNM_SNAPSHOT_ID, MNM_RECOVERY_STAGE_ORDER
    → Increment relaunchCount in snapshot
    → Transition stage back to in_progress
    → Emit audit compaction.relaunch_completed
    → Update snapshot status to resolved
    → Emit LiveEvent compaction.relaunch_completed
    → Return { success: true, newInstanceId, snapshotId }
```

### Circuit Breaker
- Default maxRelaunchCount = 3
- Tracked per snapshot (agentId + workflowInstanceId)
- When tripped: stage → paused, human alert required
