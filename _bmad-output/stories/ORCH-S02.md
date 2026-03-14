# ORCH-S02 : WorkflowEnforcer -- Fichiers Obligatoires, Pre-prompts, Resultats Intermediaires

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | ORCH-S02 |
| **Titre** | WorkflowEnforcer -- Enforcement fichiers obligatoires, injection pre-prompts, persistance resultats intermediaires |
| **Epic** | Epic ORCH -- Orchestrateur Deterministe (Noyau A) |
| **Sprint** | Sprint 4 (Batch 7) |
| **Effort** | L (8 SP, 5-7j) |
| **Priorite** | P0 -- Coeur du determinisme workflow |
| **Assignation** | Cofondateur (backend service) |
| **Bloque par** | ORCH-S01 (State Machine XState -- DONE) |
| **Debloque** | ORCH-S03 (Validation HITL), DRIFT-S02 (Drift monitor), COMP-S01 (CompactionWatcher) |
| **ADR** | ADR-003 (Orchestrateur Deterministe -- State Machine) |
| **Type** | Backend (service + schema extension + types) |
| **FRs couverts** | REQ-ORCH-02 (fichiers obligatoires), REQ-ORCH-03 (pre-prompts), REQ-ORCH-04 (validation transitions), REQ-ORCH-10 (persistance resultats intermediaires) |

---

## Description

### Contexte -- Pourquoi cette story est critique

L'orchestrateur (ORCH-S01) garantit que les transitions entre etapes suivent un graphe d'etats strict via XState. Mais le graphe d'etats seul ne suffit pas : il valide que la transition est **autorisee** (RBAC, sequence), mais pas que les **conditions de contenu** sont remplies. Un agent peut passer de "Design" a "Code" via la state machine, meme si le fichier `design-spec.md` n'a pas ete produit.

Le WorkflowEnforcer ajoute la couche de verification **semantique** sur les transitions :
1. **Fichiers obligatoires** -- chaque etape peut definir des fichiers qui DOIVENT exister avant que la transition soit autorisee
2. **Pre-prompts** -- chaque etape peut injecter un contexte specifique (instructions, contraintes, references) au demarrage de l'agent
3. **Resultats intermediaires** -- chaque etape persiste ses outputs (fichiers produits, artefacts) dans la DB pour permettre la relance post-compaction et l'audit

C'est la difference entre "l'agent suit le bon chemin" (state machine) et "l'agent produit les bons livrables" (enforcer). Le PRD est explicite : REQ-ORCH-02 (P0) exige le refus si des fichiers manquent, REQ-ORCH-03 (P0) exige l'injection de pre-prompts, REQ-ORCH-10 (P0) exige la persistance des resultats intermediaires.

### Etat actuel du code

| Fichier | Etat | Role |
|---------|------|------|
| `server/src/services/orchestrator.ts` | Existe (489 lignes, ORCH-S01 DONE) | `transitionStage()`, `maybeAdvanceNextStage()`, `updateWorkflowStateAfterTransition()` -- transitions XState pures |
| `server/src/services/workflow-state-machine.ts` | Existe (300 lignes, ORCH-S01 DONE) | XState v5 machine, 10 etats, 15 events, 3 guards (`canManageWorkflow`, `canLaunchAgent`, `canRetry`) |
| `server/src/services/workflows.ts` | Existe (267 lignes) | CRUD workflow templates + instances, `createInstance()` materialise les stages |
| `packages/db/src/schema/workflow_templates.ts` | Existe | `WorkflowStageTemplateDef` avec `order`, `name`, `description`, `agentRole`, `autoTransition`, `acceptanceCriteria` |
| `packages/db/src/schema/stage_instances.ts` | Existe (ORCH-S01 DONE) | `machineState`, `inputArtifacts`, `outputArtifacts`, `machineContext`, `feedback`, `transitionHistory` |
| `packages/db/src/schema/workflow_instances.ts` | Existe (ORCH-S01 DONE) | `workflowState`, `lastActorId`, `lastActorType` |
| `packages/shared/src/types/orchestrator.ts` | Existe (87 lignes, ORCH-S01 DONE) | `StageState`, `StageEvent`, `StageContext`, `TransitionRecord`, `OrchestratorEvent` |
| `server/src/services/access.ts` | Existe (RBAC-S01 DONE) | `canUser()`, `hasPermission()` avec scope JSONB |
| `server/src/services/live-events.ts` | Existe | `publishLiveEvent()` pour WebSocket |

### Ce que cette story construit

1. **`server/src/services/workflow-enforcer.ts`** (~300-500 lignes) -- nouveau service WorkflowEnforcer
   - `enforceTransition()` : hook pre-transition qui verifie les fichiers obligatoires et les conditions de sortie
   - `injectPrePrompts()` : collecte et renvoie les pre-prompts pour une etape donnee
   - `persistStageResults()` : sauvegarde les resultats intermediaires (fichiers produits, metriques, metadata)
   - `getStageArtifacts()` : recupere les artefacts d'une etape (pour relance post-compaction)
   - `validateRequiredFiles()` : verifie l'existence des fichiers obligatoires
   - `buildStageContext()` : construit le contexte complet pour le demarrage d'une etape (pre-prompts + artefacts des etapes precedentes)

2. **Extension `WorkflowStageTemplateDef`** -- ajout de 3 champs au type de template de stage :
   - `requiredFiles?: RequiredFileDef[]` : fichiers obligatoires a produire AVANT la transition sortante
   - `prePrompts?: string[]` : instructions/prompts a injecter au demarrage de l'etape
   - `expectedOutputs?: string[]` : descriptions des outputs attendus (pour documentation/validation humaine)

3. **Extension `stage_instances`** -- ajout de 2 colonnes :
   - `enforcementResults` (jsonb) : resultats de la derniere verification d'enforcement (fichiers verifies, statut)
   - `prePromptsInjected` (jsonb) : pre-prompts qui ont ete injectes lors du demarrage de l'etape

4. **Types partages** -- nouvelles interfaces dans `packages/shared/src/types/orchestrator.ts` :
   - `RequiredFileDef`, `EnforcementResult`, `StageArtifact`, `PrePromptPayload`

5. **Integration dans `orchestrator.ts`** -- le `transitionStage()` existant appelle `enforceTransition()` AVANT d'evaluer la transition XState

6. **Extension LiveEventTypes** -- ajout de `enforcement.check_passed`, `enforcement.check_failed`, `enforcement.preprompts_injected`

### Ce que cette story ne fait PAS (scope)

- Pas de validation humaine (HITL) -- c'est ORCH-S03
- Pas d'API routes REST pour le workflow enforcer -- c'est ORCH-S04
- Pas de drift detection -- c'est DRIFT-S02
- Pas de compaction watcher -- c'est COMP-S01
- Pas d'UI pour configurer les fichiers obligatoires/pre-prompts -- c'est ORCH-S05
- Pas de modification du graphe XState (ORCH-S01 est stable)
- Pas de migration de donnees existantes -- les champs sont optionnels

---

## Architecture Technique

### Flux d'enforcement sur transition

```
User/Agent demande transition "complete" sur stage N
    |
    v
orchestrator.transitionStage()
    |
    v
workflowEnforcer.enforceTransition(stage, event, workflowInstance)
    |
    +-- Si event = "complete" ou "request_validation" :
    |       |
    |       v
    |   validateRequiredFiles(stage, templateDef)
    |       |
    |       +-- Pour chaque requiredFile dans templateDef.requiredFiles :
    |       |       verifier que le fichier est present dans outputArtifacts
    |       |       OU que le chemin existe dans le workspace (si checkPath=true)
    |       |
    |       +-- Si fichiers manquants :
    |               return { allowed: false, missingFiles: [...], message: "..." }
    |               -> orchestrator refuse la transition
    |               -> emit "enforcement.check_failed" via LiveEvent
    |
    +-- Si event = "start" ou "initialize" :
    |       |
    |       v
    |   injectPrePrompts(stage, templateDef, previousStages)
    |       |
    |       +-- Collecte les prePrompts du template pour cette etape
    |       +-- Collecte les outputArtifacts des etapes precedentes
    |       +-- Construit le payload PrePromptPayload
    |       +-- Persiste prePromptsInjected dans stage_instances
    |       +-- emit "enforcement.preprompts_injected" via LiveEvent
    |       +-- return { prePrompts: [...], previousArtifacts: [...] }
    |
    +-- Apres transition reussie :
            |
            v
        persistStageResults(stage, payload.outputArtifacts)
            |
            +-- Sauvegarde dans stage_instances.outputArtifacts
            +-- Sauvegarde dans stage_instances.enforcementResults
            +-- emit "enforcement.check_passed" via LiveEvent
```

### Structure des RequiredFiles

```typescript
interface RequiredFileDef {
  /** Glob pattern ou chemin relatif du fichier requis */
  path: string;
  /** Description humaine du fichier attendu */
  description: string;
  /** Mode de verification */
  checkMode: "artifact" | "filesystem" | "both";
  /** Si true, fichier critique -- bloque la transition. Si false, warning seulement */
  blocking: boolean;
}
```

- `checkMode: "artifact"` -- verifie que le path est present dans `outputArtifacts[]` de la stage instance
- `checkMode: "filesystem"` -- verifie que le fichier existe dans le workspace du projet
- `checkMode: "both"` -- les deux verifications doivent passer

### Structure des PrePrompts

```typescript
interface PrePromptPayload {
  /** Pre-prompts definis dans le template pour cette etape */
  stagePrePrompts: string[];
  /** Artefacts des etapes precedentes (pour contexte) */
  previousArtifacts: StageArtifact[];
  /** Acceptance criteria de l'etape (rappel pour l'agent) */
  acceptanceCriteria: string[];
  /** Nom de l'etape et workflow pour reference */
  stageName: string;
  workflowName: string;
  stageOrder: number;
  totalStages: number;
}
```

### Structure EnforcementResult

```typescript
interface EnforcementResult {
  /** Timestamp de la verification */
  checkedAt: string; // ISO 8601
  /** Resultat global */
  passed: boolean;
  /** Fichiers verifies avec leur statut */
  fileChecks: FileCheckResult[];
  /** Fichiers manquants (blocking) */
  missingFiles: string[];
  /** Avertissements (non-blocking) */
  warnings: string[];
  /** Acteur qui a declenche la verification */
  triggeredBy: {
    actorId: string | null;
    actorType: "user" | "agent" | "system";
  };
}

interface FileCheckResult {
  path: string;
  description: string;
  found: boolean;
  checkMode: "artifact" | "filesystem" | "both";
  blocking: boolean;
}
```

### Structure StageArtifact

```typescript
interface StageArtifact {
  stageId: string;
  stageName: string;
  stageOrder: number;
  outputArtifacts: string[];
  completedAt: string | null; // ISO 8601
}
```

---

## Extension du Schema

### WorkflowStageTemplateDef (extension)

```typescript
// packages/db/src/schema/workflow_templates.ts
export type WorkflowStageTemplateDef = {
  order: number;
  name: string;
  description?: string;
  agentRole?: string;
  autoTransition: boolean;
  acceptanceCriteria?: string[];
  // ORCH-S02: WorkflowEnforcer fields
  requiredFiles?: RequiredFileDef[];
  prePrompts?: string[];
  expectedOutputs?: string[];
};
```

Les champs sont optionnels pour la backward compatibility. Les templates existants (BMAD Standard) continuent de fonctionner sans modification.

### stage_instances (2 nouvelles colonnes)

```sql
-- Migration 00XX
ALTER TABLE stage_instances
  ADD COLUMN enforcement_results jsonb,
  ADD COLUMN pre_prompts_injected jsonb;
```

```typescript
// packages/db/src/schema/stage_instances.ts -- ajout
enforcementResults: jsonb("enforcement_results").$type<EnforcementResult>(),
prePromptsInjected: jsonb("pre_prompts_injected").$type<PrePromptPayload>(),
```

---

## Acceptance Criteria

### AC1 -- Fichiers obligatoires bloquent la transition

**Given** une etape "Design" avec `requiredFiles: [{ path: "design-spec.md", checkMode: "artifact", blocking: true }]`
**When** un acteur tente la transition `complete` et `outputArtifacts` ne contient PAS "design-spec.md"
**Then** la transition est refusee avec :
- Code HTTP 409 (Conflict)
- Body `{ error: "ENFORCEMENT_FAILED", missingFiles: ["design-spec.md"], message: "Required files missing: design-spec.md" }`
- Un LiveEvent `enforcement.check_failed` est emis
- `enforcementResults` est persiste dans stage_instances avec `passed: false`

### AC2 -- Fichiers obligatoires presents autorisent la transition

**Given** une etape "Design" avec `requiredFiles: [{ path: "design-spec.md", checkMode: "artifact", blocking: true }]`
**When** un acteur tente la transition `complete` et `outputArtifacts` contient "design-spec.md"
**Then** la transition est autorisee :
- La state machine XState evalue la transition normalement
- `enforcementResults` est persiste avec `passed: true`
- Un LiveEvent `enforcement.check_passed` est emis

### AC3 -- Fichiers non-bloquants generent un warning

**Given** une etape avec `requiredFiles: [{ path: "changelog.md", blocking: false }]`
**When** le fichier est absent dans `outputArtifacts`
**Then** la transition est autorisee mais :
- `enforcementResults.warnings` contient `"Non-blocking file missing: changelog.md"`
- Le LiveEvent `enforcement.check_passed` inclut les warnings dans son payload

### AC4 -- Pre-prompts injectes au demarrage

**Given** une etape "Code" avec `prePrompts: ["Utilise le pattern Repository", "Tests unitaires obligatoires"]`
**When** un acteur envoie l'event `start` sur cette etape
**Then** :
- `injectPrePrompts()` retourne un `PrePromptPayload` contenant les 2 prompts
- Le payload inclut les artefacts des etapes precedentes completees
- `prePromptsInjected` est persiste dans `stage_instances`
- Un LiveEvent `enforcement.preprompts_injected` est emis

### AC5 -- Pre-prompts incluent le contexte des etapes precedentes

**Given** un workflow 3 etapes [Analyse, Design, Code] ou "Analyse" et "Design" sont completees
**When** l'etape "Code" demarre (`start` event)
**Then** le `PrePromptPayload` contient :
- `previousArtifacts` avec les outputArtifacts de "Analyse" et "Design"
- `acceptanceCriteria` de l'etape "Code"
- `stageName: "Code"`, `stageOrder: 2`, `totalStages: 3`

### AC6 -- Resultats intermediaires persistes

**Given** une etape en cours (machineState = `in_progress`)
**When** un agent appelle `persistStageResults(stageId, ["output.ts", "tests.spec.ts"])` ou complete la transition avec `outputArtifacts`
**Then** :
- `stage_instances.outputArtifacts` est mis a jour avec `["output.ts", "tests.spec.ts"]`
- `stage_instances.enforcementResults` est mis a jour avec les checks des fichiers

### AC7 -- getStageArtifacts retourne les artefacts pour relance

**Given** un workflow avec 3 etapes ou les 2 premieres sont completees
**When** `getStageArtifacts(workflowInstanceId)` est appele
**Then** il retourne un tableau `StageArtifact[]` :
- Etape 0 : `{ stageName: "Analyse", stageOrder: 0, outputArtifacts: [...], completedAt: "..." }`
- Etape 1 : `{ stageName: "Design", stageOrder: 1, outputArtifacts: [...], completedAt: "..." }`
- Utile pour COMP-S01 (CompactionWatcher) qui recupere le contexte pour la relance

### AC8 -- Transitions sans requiredFiles passent sans verification

**Given** un template dont les etapes n'ont PAS de champ `requiredFiles`
**When** une transition `complete` est demandee
**Then** la transition passe directement a la state machine (pas de verification d'enforcement)
- Backward compatible avec les templates BMAD Standard existants

### AC9 -- Transitions non sortantes ne sont pas verifiees

**Given** une etape avec `requiredFiles` configurees
**When** l'event est `pause`, `fail`, `terminate`, ou `skip`
**Then** l'enforcement n'est PAS verifie (seuls `complete` et `request_validation` declenchent la verification)

### AC10 -- Fichiers multiples -- verification partielle

**Given** une etape avec 3 fichiers requis : `[a.md (blocking), b.md (blocking), c.md (non-blocking)]`
**When** seul `a.md` est present dans `outputArtifacts`
**Then** :
- La transition est refusee (b.md est blocking et manquant)
- `missingFiles` contient `["b.md"]`
- `warnings` contient `["Non-blocking file missing: c.md"]`

### AC11 -- Integration orchestrator.ts

**Given** le service orchestrateur existant
**When** `transitionStage()` est appele
**Then** `enforceTransition()` est appele AVANT l'evaluation XState et APRES les checks RBAC :
1. RBAC check (existant, inchange)
2. `enforceTransition()` -- NOUVEAU (cette story)
3. XState transition (existant, inchange)
4. Persistance DB (existant, inchange)
5. LiveEvent emission (existant, inchange)

### AC12 -- LiveEvents emis correctement

**Given** une verification d'enforcement
**When** l'enforcement echoue
**Then** un LiveEvent est emis :
```json
{
  "type": "enforcement.check_failed",
  "companyId": "...",
  "workflowInstanceId": "...",
  "stageId": "...",
  "missingFiles": ["design-spec.md"],
  "warnings": []
}
```

**When** l'enforcement reussit
**Then** un LiveEvent est emis :
```json
{
  "type": "enforcement.check_passed",
  "companyId": "...",
  "workflowInstanceId": "...",
  "stageId": "...",
  "fileChecks": [{ "path": "design-spec.md", "found": true }],
  "warnings": []
}
```

---

## data-test-id Reference

### Service Functions (pour tests unitaires/integration)

| data-testid | Element | Type |
|-------------|---------|------|
| `data-testid="orch-s02-enforce-transition"` | Fonction `enforceTransition()` | Service function |
| `data-testid="orch-s02-validate-required-files"` | Fonction `validateRequiredFiles()` | Service function |
| `data-testid="orch-s02-inject-pre-prompts"` | Fonction `injectPrePrompts()` | Service function |
| `data-testid="orch-s02-persist-stage-results"` | Fonction `persistStageResults()` | Service function |
| `data-testid="orch-s02-get-stage-artifacts"` | Fonction `getStageArtifacts()` | Service function |
| `data-testid="orch-s02-build-stage-context"` | Fonction `buildStageContext()` | Service function |

### Schema/Migration Verification (pour tests E2E file-content)

| data-testid | Element | Type |
|-------------|---------|------|
| `data-testid="orch-s02-schema-enforcement-results"` | Colonne `enforcement_results` dans stage_instances | Schema column |
| `data-testid="orch-s02-schema-pre-prompts-injected"` | Colonne `pre_prompts_injected` dans stage_instances | Schema column |
| `data-testid="orch-s02-schema-required-files-type"` | Type `RequiredFileDef` dans workflow_templates | Schema type |
| `data-testid="orch-s02-schema-pre-prompts-field"` | Champ `prePrompts` dans `WorkflowStageTemplateDef` | Schema field |
| `data-testid="orch-s02-schema-expected-outputs-field"` | Champ `expectedOutputs` dans `WorkflowStageTemplateDef` | Schema field |

### Types/Interfaces Verification (pour tests E2E file-content)

| data-testid | Element | Type |
|-------------|---------|------|
| `data-testid="orch-s02-type-required-file-def"` | Interface `RequiredFileDef` | Shared type |
| `data-testid="orch-s02-type-enforcement-result"` | Interface `EnforcementResult` | Shared type |
| `data-testid="orch-s02-type-file-check-result"` | Interface `FileCheckResult` | Shared type |
| `data-testid="orch-s02-type-stage-artifact"` | Interface `StageArtifact` | Shared type |
| `data-testid="orch-s02-type-pre-prompt-payload"` | Interface `PrePromptPayload` | Shared type |

### LiveEvent Types (pour tests E2E file-content)

| data-testid | Element | Type |
|-------------|---------|------|
| `data-testid="orch-s02-event-check-passed"` | LiveEvent type `enforcement.check_passed` | Event type |
| `data-testid="orch-s02-event-check-failed"` | LiveEvent type `enforcement.check_failed` | Event type |
| `data-testid="orch-s02-event-preprompts-injected"` | LiveEvent type `enforcement.preprompts_injected` | Event type |

### Integration Points (pour tests E2E file-content)

| data-testid | Element | Type |
|-------------|---------|------|
| `data-testid="orch-s02-integration-orchestrator"` | Appel `enforceTransition()` dans `transitionStage()` | Integration |
| `data-testid="orch-s02-integration-before-xstate"` | Position de l'enforcement AVANT l'evaluation XState | Integration |
| `data-testid="orch-s02-integration-after-rbac"` | Position de l'enforcement APRES le check RBAC | Integration |
| `data-testid="orch-s02-barrel-export"` | Export dans `server/src/services/index.ts` (si existe) | Barrel |

---

## Fichiers a Creer/Modifier

### Fichiers a CREER

| Fichier | Lignes estimees | Description |
|---------|-----------------|-------------|
| `server/src/services/workflow-enforcer.ts` | 300-500 | Service WorkflowEnforcer principal |
| Migration Drizzle (stage_instances + 2 colonnes) | ~20 | `enforcement_results` + `pre_prompts_injected` |

### Fichiers a MODIFIER

| Fichier | Nature de la modification |
|---------|--------------------------|
| `packages/db/src/schema/workflow_templates.ts` | Ajouter `requiredFiles`, `prePrompts`, `expectedOutputs` a `WorkflowStageTemplateDef` |
| `packages/db/src/schema/stage_instances.ts` | Ajouter colonnes `enforcementResults`, `prePromptsInjected` |
| `packages/shared/src/types/orchestrator.ts` | Ajouter interfaces `RequiredFileDef`, `EnforcementResult`, `FileCheckResult`, `StageArtifact`, `PrePromptPayload` |
| `packages/shared/src/constants.ts` | Ajouter 3 LiveEventTypes : `enforcement.check_passed`, `enforcement.check_failed`, `enforcement.preprompts_injected` |
| `server/src/services/orchestrator.ts` | Integrer l'appel `enforceTransition()` dans `transitionStage()` |
| `packages/db/src/schema/index.ts` | Re-exporter les types etendus si necessaire |

---

## Cas de Test pour QA Agent

### Tests Unitaires/Integration (Vitest)

| # | Cas de test | Type | AC |
|---|-------------|------|-----|
| T01 | `enforceTransition()` retourne `{ allowed: true }` quand pas de `requiredFiles` sur le template | Unit | AC8 |
| T02 | `enforceTransition()` retourne `{ allowed: false, missingFiles: [...] }` quand fichier blocking manquant | Unit | AC1 |
| T03 | `enforceTransition()` retourne `{ allowed: true, warnings: [...] }` quand fichier non-blocking manquant | Unit | AC3 |
| T04 | `enforceTransition()` retourne `{ allowed: true }` quand tous les fichiers sont presents | Unit | AC2 |
| T05 | `enforceTransition()` ne verifie PAS les fichiers pour events `pause`, `fail`, `terminate`, `skip` | Unit | AC9 |
| T06 | `enforceTransition()` verifie les fichiers pour events `complete` et `request_validation` | Unit | AC1, AC2 |
| T07 | `validateRequiredFiles()` check mode `artifact` -- verifie dans outputArtifacts | Unit | AC1 |
| T08 | `validateRequiredFiles()` check mode `filesystem` -- verifie existence fichier | Unit | AC1 |
| T09 | `validateRequiredFiles()` check mode `both` -- les deux verifications | Unit | AC1 |
| T10 | `validateRequiredFiles()` avec 3 fichiers (2 blocking, 1 non-blocking) -- verification partielle | Unit | AC10 |
| T11 | `injectPrePrompts()` retourne les prompts du template + artefacts precedents | Unit | AC4 |
| T12 | `injectPrePrompts()` inclut les artefacts des etapes precedentes completees uniquement | Unit | AC5 |
| T13 | `injectPrePrompts()` inclut acceptanceCriteria, stageName, stageOrder, totalStages | Unit | AC5 |
| T14 | `injectPrePrompts()` retourne payload vide si pas de prePrompts et pas d'etapes precedentes | Unit | AC8 |
| T15 | `persistStageResults()` met a jour outputArtifacts dans stage_instances | Unit | AC6 |
| T16 | `persistStageResults()` met a jour enforcementResults dans stage_instances | Unit | AC6 |
| T17 | `getStageArtifacts()` retourne les artefacts des etapes completees | Unit | AC7 |
| T18 | `getStageArtifacts()` ne retourne PAS les etapes non-completees | Unit | AC7 |
| T19 | `buildStageContext()` combine pre-prompts + artefacts + acceptance criteria | Unit | AC4, AC5 |
| T20 | Integration : `transitionStage()` appelle `enforceTransition()` avant XState | Integration | AC11 |
| T21 | Integration : `transitionStage()` refuse si enforcement echoue (fichiers manquants) | Integration | AC1, AC11 |
| T22 | Integration : `transitionStage()` passe si enforcement OK | Integration | AC2, AC11 |
| T23 | Integration : enforcement se fait APRES le check RBAC | Integration | AC11 |
| T24 | LiveEvent `enforcement.check_failed` emis quand enforcement echoue | Integration | AC12 |
| T25 | LiveEvent `enforcement.check_passed` emis quand enforcement reussit | Integration | AC12 |
| T26 | LiveEvent `enforcement.preprompts_injected` emis au demarrage etape | Integration | AC4 |

### Tests E2E (Playwright -- file-content verification)

| # | Cas de test | Verification |
|---|-------------|-------------|
| T27 | Fichier `workflow-enforcer.ts` existe dans `server/src/services/` | File exists |
| T28 | `workflow-enforcer.ts` exporte `workflowEnforcerService` ou `workflowEnforcer` | Export check |
| T29 | `workflow-enforcer.ts` contient `enforceTransition` function | Function exists |
| T30 | `workflow-enforcer.ts` contient `validateRequiredFiles` function | Function exists |
| T31 | `workflow-enforcer.ts` contient `injectPrePrompts` function | Function exists |
| T32 | `workflow-enforcer.ts` contient `persistStageResults` function | Function exists |
| T33 | `workflow-enforcer.ts` contient `getStageArtifacts` function | Function exists |
| T34 | `workflow-enforcer.ts` contient `buildStageContext` function | Function exists |
| T35 | `workflow-enforcer.ts` importe depuis `@mnm/db` | Import check |
| T36 | `workflow-enforcer.ts` importe depuis `@mnm/shared` | Import check |
| T37 | `workflow-enforcer.ts` importe `publishLiveEvent` | Import check |
| T38 | `workflow_templates.ts` contient `requiredFiles` dans `WorkflowStageTemplateDef` | Schema check |
| T39 | `workflow_templates.ts` contient `prePrompts` dans `WorkflowStageTemplateDef` | Schema check |
| T40 | `workflow_templates.ts` contient `expectedOutputs` dans `WorkflowStageTemplateDef` | Schema check |
| T41 | `stage_instances.ts` contient colonne `enforcement_results` (jsonb) | Schema check |
| T42 | `stage_instances.ts` contient colonne `pre_prompts_injected` (jsonb) | Schema check |
| T43 | `orchestrator.ts` contient un appel a la fonction d'enforcement | Integration check |
| T44 | `orchestrator.ts` importe le workflow-enforcer | Import check |
| T45 | Types `RequiredFileDef` exporte dans `packages/shared/src/types/orchestrator.ts` | Type check |
| T46 | Types `EnforcementResult` exporte dans `packages/shared/src/types/orchestrator.ts` | Type check |
| T47 | Types `FileCheckResult` exporte dans `packages/shared/src/types/orchestrator.ts` | Type check |
| T48 | Types `StageArtifact` exporte dans `packages/shared/src/types/orchestrator.ts` | Type check |
| T49 | Types `PrePromptPayload` exporte dans `packages/shared/src/types/orchestrator.ts` | Type check |
| T50 | `constants.ts` contient `enforcement.check_passed` dans les LiveEventTypes | Constant check |
| T51 | `constants.ts` contient `enforcement.check_failed` dans les LiveEventTypes | Constant check |
| T52 | `constants.ts` contient `enforcement.preprompts_injected` dans les LiveEventTypes | Constant check |
| T53 | Migration file existe pour les nouvelles colonnes stage_instances | Migration check |
| T54 | `EnforcementResult` contient les champs `checkedAt`, `passed`, `fileChecks`, `missingFiles`, `warnings` | Type fields check |
| T55 | `RequiredFileDef` contient les champs `path`, `description`, `checkMode`, `blocking` | Type fields check |
| T56 | `PrePromptPayload` contient `stagePrePrompts`, `previousArtifacts`, `acceptanceCriteria`, `stageName` | Type fields check |
| T57 | `workflow-enforcer.ts` gere le cas ou `requiredFiles` est undefined/null (backward compat) | Logic check |
| T58 | `workflow-enforcer.ts` contient la logique de check `complete` et `request_validation` events | Logic check |
| T59 | `workflow-enforcer.ts` exclut les events `pause`, `fail`, `terminate`, `skip` de l'enforcement | Logic check |
| T60 | `workflow-enforcer.ts` emet des LiveEvents via `publishLiveEvent()` | Emit check |
| T61 | `RequiredFileDef.checkMode` accepte les valeurs `artifact`, `filesystem`, `both` | Enum check |
| T62 | `WorkflowStageTemplateDef` reste backward compatible (champs optionnels) | Compat check |

---

## Notes Techniques

### 1. Backward Compatibility

Tous les nouveaux champs sont optionnels. Le BMAD Standard template existant (sans `requiredFiles`, sans `prePrompts`) continue de fonctionner exactement comme avant. L'enforcer skip la verification si `requiredFiles` est absent ou vide.

### 2. Performance

- `enforceTransition()` est appele synchroniquement dans le flux de transition -- il doit etre rapide (<50ms)
- La verification `checkMode: "artifact"` est un simple lookup dans un array (O(n), n typiquement <10)
- La verification `checkMode: "filesystem"` implique un `fs.access()` -- a utiliser avec precaution, uniquement pour les cas ou l'artefact n'est pas suffisant
- `getStageArtifacts()` fait une seule requete DB (filtrer les stages du workflow par machineState = "completed")

### 3. Ordre d'integration dans transitionStage()

L'enforcement se place dans la sequence existante de `transitionStage()` comme suit :

```
1. Load stage from DB              (existant, inchange)
2. RBAC pre-evaluation             (existant, inchange)
3. Retry count check               (existant, inchange)
4. ENFORCEMENT CHECK               <-- NOUVEAU (cette story)
   4a. Si event sortant (complete/request_validation) : validateRequiredFiles()
   4b. Si event entrant (start/initialize) : injectPrePrompts()
5. Build XState context             (existant, inchange)
6. XState transition evaluation     (existant, inchange)
7. Build transition record          (existant, inchange)
8. Persist to DB                    (existant, inchange + enforcementResults)
9. Emit LiveEvent                   (existant, inchange)
10. Update workflow state           (existant, inchange)
11. Auto-advance next stage         (existant, inchange)
```

### 4. Erreur d'enforcement vs erreur XState

Si l'enforcement echoue, la transition est refusee AVANT d'atteindre XState. L'erreur retournee est un `conflict()` (HTTP 409) avec un body specifique `ENFORCEMENT_FAILED`. C'est distinct de l'erreur XState "transition not allowed" qui retourne `TRANSITION_NOT_ALLOWED`.

### 5. Relation avec ORCH-S03 (HITL)

Le WorkflowEnforcer prepare le terrain pour la validation humaine. Quand une etape a `hitlRequired: true` (ORCH-S03), la transition `complete` sera interceptee pour passer en `validating` au lieu de `completed`. Mais la verification des fichiers obligatoires se fait AVANT -- si les fichiers manquent, le HITL n'est meme pas declenche.

### 6. Relation avec COMP-S01 (CompactionWatcher)

`getStageArtifacts()` est la fonction clef que le CompactionWatcher utilisera pour reconstruire le contexte lors d'une relance post-compaction. Le format `StageArtifact[]` est concu pour etre serialisable et injectable dans un nouveau prompt.

### 7. Migration Drizzle

La migration ajoute 2 colonnes nullable a `stage_instances`. Pas de donnees a migrer. Le rollback est un simple `DROP COLUMN`.

```sql
-- up
ALTER TABLE stage_instances
  ADD COLUMN enforcement_results jsonb,
  ADD COLUMN pre_prompts_injected jsonb;

-- down
ALTER TABLE stage_instances
  DROP COLUMN enforcement_results,
  DROP COLUMN pre_prompts_injected;
```

### 8. Conventions de nommage

- Service : `workflowEnforcerService(db: Db)` -- meme pattern que `orchestratorService(db)`, `workflowService(db)`
- Fonctions internes : camelCase, pas d'abbreviations
- Types : PascalCase, exportes depuis `@mnm/shared`
- Colonnes DB : snake_case (convention Drizzle)
- LiveEvents : `enforcement.check_passed`, `enforcement.check_failed`, `enforcement.preprompts_injected`
