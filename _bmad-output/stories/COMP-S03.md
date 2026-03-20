# COMP-S03 — Réinjection Post-Compaction

> **Epic** : COMP — Gestion Compaction
> **Story** : COMP-S03
> **Titre** : Stratégie Réinjection Post-Compaction
> **Priorité** : P1
> **Effort** : M (5 SP, 3-5j)
> **Assignation** : Cofondateur
> **Dépendances** : COMP-S01 (CompactionWatcher) ✅

---

## 1. Objectif

Après un kill+relance (COMP-S02), le nouvel agent démarre dans un container frais **sans contexte**. Cette story implémente le **service de réinjection** qui, une fois le nouvel agent démarré, réinjecte automatiquement le contexte compacté (snapshots, artifacts des étapes précédentes, pré-prompts, acceptance criteria) dans le nouvel agent pour qu'il reprenne exactement là où l'ancien s'est arrêté.

La réinjection est une stratégie alternative et complémentaire au kill+relance :
- **kill+relance** (COMP-S02) : tue et relance le container avec des env vars de recovery
- **réinjection** (COMP-S03) : construit et injecte le contexte de recovery complet dans l'agent relancé

Le service `compactionReinjectionService` :
1. Charge le snapshot complet depuis la DB
2. Reconstruit le contexte de recovery (previous artifacts + pre-prompts + workflow position + acceptance criteria)
3. Génère un **reinjection prompt** structuré pour l'agent
4. L'envoie via le ChatService (pipe stdin) au nouvel agent
5. Transition l'état du stage de `compacting` vers `in_progress` via l'event `reinjected`
6. Émet les audit events et LiveEvents appropriés

---

## 2. Acceptance Criteria (Given/When/Then)

### AC1 — Réinjection basique après kill+relance
**Given** un snapshot `resolved` après kill+relance (COMP-S02) avec un nouveau container actif
**When** la réinjection est déclenchée
**Then** le service charge le snapshot, construit le prompt de recovery, l'envoie via ChatService au nouvel agent, et le stage transite vers `in_progress`

### AC2 — Contexte de recovery complet
**Given** un agent à l'étape 3/5 après compaction
**When** le prompt de recovery est construit
**Then** il contient : (1) le nom du workflow et la position courante, (2) les artifacts des étapes 1-2 déjà complétées, (3) les pré-prompts de l'étape 3 en cours, (4) les acceptance criteria de l'étape 3, (5) les outputs déjà produits avant la compaction

### AC3 — Réinjection sans kill+relance (stratégie "reinjection" pure)
**Given** un snapshot avec `strategy: "reinjection"` en status `pending`
**When** `executeReinjection()` est appelé
**Then** le service réinjecte le contexte dans l'agent existant (sans kill) et transite le stage vers `in_progress` via l'event `reinjected`

### AC4 — Snapshot mis à jour après réinjection
**Given** une réinjection réussie
**When** le contexte est envoyé à l'agent
**Then** le snapshot est mis à jour avec status `resolved`, `resolvedAt` renseigné, et `metadata.reinjectionPromptLength` enregistré

### AC5 — Échec de réinjection (agent non-joignable)
**Given** un snapshot en status `processing` pour réinjection
**When** l'envoi du prompt échoue (container down, chat channel fermé)
**Then** le snapshot passe en status `failed` avec l'erreur dans metadata, et un audit `compaction.reinjection_failed` est émis

### AC6 — Audit émis pour réinjection
**Given** une opération de réinjection
**When** elle progresse
**Then** les audit events `compaction.reinjection_started` et `compaction.reinjection_completed` (ou `compaction.reinjection_failed`) sont émis avec severity appropriée

### AC7 — LiveEvents émis
**Given** une opération de réinjection
**When** elle progresse
**Then** les LiveEvents `compaction.reinjection_started` et `compaction.reinjection_completed` sont publiés vers les clients WebSocket

### AC8 — Route POST reinject
**Given** un admin/manager avec permission `workflows:enforce`
**When** il appelle `POST /companies/:companyId/compaction/snapshots/:snapshotId/reinject`
**Then** la stratégie réinjection est exécutée pour ce snapshot

### AC9 — Route GET reinjection-history
**Given** un admin/manager avec permission `workflows:enforce`
**When** il appelle `GET /companies/:companyId/compaction/reinjection-history`
**Then** l'historique des réinjections est retourné avec filtrage par agentId, workflowInstanceId, status

### AC10 — Intégration kill+relaunch: réinjection automatique
**Given** un kill+relance réussi (COMP-S02) avec `autoReinject: true`
**When** le nouveau container est opérationnel
**Then** la réinjection est automatiquement déclenchée pour envoyer le contexte au nouvel agent

### AC11 — Prompt de recovery structuré
**Given** un snapshot avec previousArtifacts et prePromptsInjected
**When** le prompt est généré
**Then** il suit le format Markdown structuré avec sections: `## Recovery Context`, `## Previous Stage Results`, `## Current Stage`, `## Instructions`

### AC12 — Validators Zod
**Given** les entrées de l'API
**When** elles sont validées
**Then** `reinjectionSchema` valide `{ autoReinject?: boolean }` et `reinjectionHistoryFiltersSchema` valide les filtres de listing

---

## 3. data-test-id Mapping

| data-testid | Type | Description |
|-------------|------|-------------|
| `comp-s03-reinjection-service` | service | Service factory export |
| `comp-s03-execute-reinjection` | method | Main reinjection method |
| `comp-s03-build-recovery-prompt` | method | Build structured recovery prompt |
| `comp-s03-send-to-agent` | method | Send prompt via ChatService |
| `comp-s03-reinjection-history` | method | Get reinjection history |
| `comp-s03-auto-reinject-flag` | config | autoReinject integration with COMP-S02 |
| `comp-s03-recovery-prompt-sections` | format | Prompt Markdown structure |
| `comp-s03-recovery-previous-artifacts` | data | Previous stage artifacts in prompt |
| `comp-s03-recovery-pre-prompts` | data | Pre-prompts in recovery prompt |
| `comp-s03-recovery-acceptance-criteria` | data | AC in recovery prompt |
| `comp-s03-recovery-workflow-position` | data | Stage order / total in prompt |
| `comp-s03-recovery-output-so-far` | data | Outputs before compaction |
| `comp-s03-snapshot-resolved` | status | Snapshot resolved after reinjection |
| `comp-s03-snapshot-failed` | status | Snapshot failed on error |
| `comp-s03-audit-reinjection-started` | audit | Audit event emitted |
| `comp-s03-audit-reinjection-completed` | audit | Audit event emitted |
| `comp-s03-audit-reinjection-failed` | audit | Audit event emitted |
| `comp-s03-live-reinjection-started` | live | LiveEvent emitted |
| `comp-s03-live-reinjection-completed` | live | LiveEvent emitted |
| `comp-s03-route-reinject` | route | POST reinject route |
| `comp-s03-route-reinjection-history` | route | GET history route |
| `comp-s03-validator-reinjection` | validator | Zod schema |
| `comp-s03-validator-history-filters` | validator | Zod schema filters |
| `comp-s03-barrel-service` | barrel | services/index.ts export |
| `comp-s03-type-reinjection-result` | type | ReinjectionResult interface |
| `comp-s03-type-reinjection-history` | type | ReinjectionHistoryEntry interface |
| `comp-s03-type-reinjection-filters` | type | ReinjectionHistoryFilters interface |
| `comp-s03-type-recovery-prompt` | type | RecoveryPrompt interface |

---

## 4. Fichiers Impactés

### Nouveaux fichiers
| Fichier | Description |
|---------|-------------|
| `server/src/services/compaction-reinjection.ts` | Service principal de réinjection |

### Fichiers modifiés
| Fichier | Modification |
|---------|-------------|
| `server/src/routes/compaction.ts` | +2 routes (POST reinject, GET reinjection-history) |
| `packages/shared/src/types/compaction.ts` | +3 types (ReinjectionResult, ReinjectionHistoryEntry, ReinjectionHistoryFilters, RecoveryPrompt) |
| `packages/shared/src/validators/compaction.ts` | +2 validators (reinjectionSchema, reinjectionHistoryFiltersSchema) |
| `server/src/services/index.ts` | +1 barrel export (compactionReinjectionService) |
| `server/src/services/compaction-kill-relaunch.ts` | Integration autoReinject dans executeKillRelaunch |

---

## 5. Test Cases (42 tests)

### Service: compaction-reinjection.ts (18 tests)
- T01: exports `compactionReinjectionService` function
- T02: service returns `executeReinjection` method
- T03: service returns `buildRecoveryPrompt` method
- T04: service returns `getReinjectionHistory` method
- T05: `executeReinjection` loads snapshot from DB
- T06: `executeReinjection` calls `buildRecoveryPrompt`
- T07: `executeReinjection` sends prompt via chat service (chatService.sendSystemMessage)
- T08: `executeReinjection` transitions stage via orchestrator `reinjected` event
- T09: `executeReinjection` updates snapshot status to `resolved`
- T10: `executeReinjection` handles send failure and sets snapshot to `failed`
- T11: `buildRecoveryPrompt` includes `## Recovery Context` section
- T12: `buildRecoveryPrompt` includes `## Previous Stage Results` section
- T13: `buildRecoveryPrompt` includes `## Current Stage` section
- T14: `buildRecoveryPrompt` includes `## Instructions` section
- T15: `buildRecoveryPrompt` includes workflow position (stageOrder / totalStages)
- T16: `buildRecoveryPrompt` includes pre-prompts from snapshot
- T17: emits audit event `compaction.reinjection_started`
- T18: emits audit event `compaction.reinjection_completed`

### Kill+Relaunch integration (4 tests)
- T19: `compaction-kill-relaunch.ts` imports `compactionReinjectionService`
- T20: `executeKillRelaunch` checks `autoReinject` option
- T21: `executeKillRelaunch` calls `reinjection.executeReinjection` when autoReinject is true
- T22: `KillRelaunchResult` has `reinjectionTriggered` field

### LiveEvents (2 tests)
- T23: emits LiveEvent `compaction.reinjection_started`
- T24: emits LiveEvent `compaction.reinjection_completed`

### Routes: compaction.ts (4 tests)
- T25: POST reinject route exists with requirePermission
- T26: GET reinjection-history route exists with requirePermission
- T27: reinject route calls `reinjection.executeReinjection`
- T28: reinjection-history route calls `reinjection.getReinjectionHistory`

### Shared Types (4 tests)
- T29: types file exports `ReinjectionResult` interface with success, snapshotId, promptLength
- T30: types file exports `ReinjectionHistoryEntry` interface
- T31: types file exports `ReinjectionHistoryFilters` interface
- T32: types file exports `RecoveryPrompt` interface with sections array

### Validators (2 tests)
- T33: validators file exports `reinjectionSchema` with autoReinject
- T34: validators file exports `reinjectionHistoryFiltersSchema` with workflowInstanceId

### Barrel Exports (2 tests)
- T35: services/index.ts exports `compactionReinjectionService`
- T36: shared types index re-exports compaction types

### Route count compatibility (2 tests)
- T37: compaction routes file has 9 route handlers (5 COMP-S01 + 2 COMP-S02 + 2 COMP-S03)
- T38: compaction routes file comment shows 9 routes listed

---

## 6. Notes Techniques

### Prompt de recovery (format Markdown)
```markdown
# Compaction Recovery — [Workflow Name]

## Recovery Context
You are resuming a workflow after a compaction event.
- **Workflow**: [name]
- **Current Stage**: [stageOrder + 1] / [totalStages] — [stageName]
- **Compaction detected at**: [detectedAt]
- **Detection pattern**: [detectionPattern]

## Previous Stage Results
[For each completed stage artifact:]
### Stage [order]: [name]
- Completed at: [completedAt]
- Output artifacts: [list]

## Current Stage
### Pre-prompts
[stagePrePrompts joined]

### Acceptance Criteria
[acceptanceCriteria joined]

### Output produced before compaction
[outputArtifactsSoFar list]

## Instructions
Resume your work on the current stage. The previous stages have been completed
and their results are listed above. Continue from where you left off.
Do NOT re-do work that has already been completed in previous stages.
```

### Integration ChatService
Le service utilise `chatService.sendSystemMessage()` pour piper le prompt vers l'agent via le ChatService existant (CHAT-S03). Si aucun chat channel n'est ouvert pour l'agent, le service tente d'en créer un.

### State machine transition
L'event `reinjected` est déjà défini dans le state machine (ORCH-S01) et transite de `compacting` → `in_progress`.
