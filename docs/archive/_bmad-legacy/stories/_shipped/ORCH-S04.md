# ORCH-S04 : API Routes Orchestrateur

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | ORCH-S04 |
| **Titre** | API Routes Orchestrateur -- Expose les fonctionnalites d'orchestration, HITL et enforcement via REST |
| **Epic** | Epic ORCH -- Orchestrateur Deterministe (Noyau A) |
| **Sprint** | Sprint 4 (Batch 7) |
| **Effort** | M (3 SP, 2-3j) |
| **Priorite** | P0 -- REQ-ORCH-08, REQ-ORCH-09, REQ-ORCH-10 |
| **Assignation** | Tom (backend routes) |
| **Bloque par** | ORCH-S01 (State Machine XState -- DONE), ORCH-S02 (WorkflowEnforcer -- DONE), ORCH-S03 (HITL validation -- DONE) |
| **Debloque** | Frontend orchestrateur (ORCH-S05), integration Drift (DRIFT-S02), integration Dual-Speed (DUAL-S03) |
| **ADR** | ADR-003 (Orchestrateur Deterministe -- State Machine) |
| **Type** | Backend (routes + validators + types) |
| **FRs couverts** | REQ-ORCH-08 (API d'orchestration), REQ-ORCH-09 (HITL API), REQ-ORCH-10 (Stage lifecycle API) |

---

## Description

### Contexte -- Pourquoi cette story est necessaire

Les services orchestrateur (ORCH-S01), WorkflowEnforcer (ORCH-S02) et HITL validation (ORCH-S03) sont complets et fonctionnels au niveau service. Cependant, **aucune route REST n'expose ces fonctionnalites au frontend ni aux agents**. Le fichier `server/src/routes/stages.ts` existant contient une route legacy `POST /stages/:id/transition` qui utilise l'ancien service (`stageService`) et non le nouvel orchestrateur (`orchestratorService`).

Sans ces routes API :
- Le frontend ne peut pas declencher des transitions orchestrees (start, pause, approve, reject)
- Le frontend ne peut pas lister les validations HITL en attente
- Le frontend ne peut pas consulter l'etat enrichi d'un workflow (machineState, transitionHistory, enforcement)
- Les agents ne peuvent pas reporter des artifacts ou signaler une completion via l'API REST
- L'enforcement (fichiers obligatoires, pre-prompts) n'est pas accessible via REST

### Etat actuel du code

| Fichier | Etat | Role |
|---------|------|------|
| `server/src/services/orchestrator.ts` | Existe (512 lignes, ORCH-S01+S02+S03 DONE) | `transitionStage()`, `getStageWithState()`, `getWorkflowWithState()`, `listWorkflowsByState()`, `listStagesByState()`, `listPendingValidations()`, `getValidationHistory()`, `getHitlRoles()` |
| `server/src/services/workflow-enforcer.ts` | Existe (433 lignes, ORCH-S02 DONE) | `enforceTransition()`, `buildStageContext()`, `getStageArtifacts()`, `persistStageResults()` |
| `server/src/services/hitl-validation.ts` | Existe (330 lignes, ORCH-S03 DONE) | `shouldRequestValidation()`, `requestValidation()`, `approveStage()`, `rejectStage()`, `listPendingValidations()`, `getValidationHistory()`, `getHitlRoles()` |
| `server/src/routes/stages.ts` | Existe (48 lignes) | Routes legacy : `GET /stages/:id`, `POST /stages/:id/transition` (ancien stageService), `PATCH /stages/:id` |
| `server/src/routes/workflows.ts` | Existe (147 lignes) | CRUD templates + instances, utilise `workflowService` (pas l'orchestrateur) |
| `server/src/routes/index.ts` | Existe | Barrel exports des routes |
| `server/src/routes/authz.ts` | Existe | `assertCompanyAccess()`, `getActorInfo()` |
| `server/src/middleware/require-permission.ts` | Existe | `requirePermission(db, key)`, `assertCompanyPermission(db, req, companyId, key)` |
| `packages/shared/src/types/orchestrator.ts` | Existe (196 lignes) | Types `StageState`, `StageEvent`, `StageContext`, `OrchestratorEvent`, `HitlDecision`, `PendingValidation`, `EnforcementResult`, `PrePromptPayload` |
| `packages/shared/src/validators/workflow.ts` | Existe | `transitionStageSchema` (legacy), `updateStageSchema` |

### Ce que cette story construit

1. **Nouveau fichier `server/src/routes/orchestrator.ts`** (~300-400 lignes) -- routes REST pour l'orchestrateur :

   **Stage Lifecycle :**
   - `POST /api/companies/:companyId/orchestrator/stages/:stageId/transition` -- transition orchestree via state machine (remplace l'ancien `POST /stages/:id/transition` pour les workflows orchestres)
   - `GET /api/companies/:companyId/orchestrator/stages/:stageId` -- etat enrichi d'un stage (machineState, transitionHistory, enforcementResults, hitlDecision, prePromptsInjected)
   - `GET /api/companies/:companyId/orchestrator/stages/:stageId/context` -- pre-prompt payload pour un stage (utilise `buildStageContext()`)
   - `GET /api/companies/:companyId/orchestrator/stages/:stageId/artifacts` -- artifacts de sortie d'un stage
   - `GET /api/companies/:companyId/orchestrator/stages/:stageId/history` -- historique complet des transitions

   **Workflow State :**
   - `GET /api/companies/:companyId/orchestrator/workflows/:workflowId` -- workflow enrichi avec tous les stages et leur machineState
   - `GET /api/companies/:companyId/orchestrator/workflows` -- liste des workflow instances filtrable par `workflowState`
   - `GET /api/companies/:companyId/orchestrator/workflows/:workflowId/stages` -- stages d'un workflow filtrable par `machineState`

   **HITL (Human-In-The-Loop) :**
   - `GET /api/companies/:companyId/orchestrator/validations/pending` -- validations en attente pour la company
   - `POST /api/companies/:companyId/orchestrator/stages/:stageId/approve` -- approuver un stage en `validating`
   - `POST /api/companies/:companyId/orchestrator/stages/:stageId/reject` -- rejeter un stage avec feedback obligatoire
   - `GET /api/companies/:companyId/orchestrator/stages/:stageId/validation-history` -- historique des decisions HITL pour un stage

   **Enforcement :**
   - `POST /api/companies/:companyId/orchestrator/stages/:stageId/check-enforcement` -- lancer un check de fichiers obligatoires sans transitionner (dry-run)
   - `GET /api/companies/:companyId/orchestrator/stages/:stageId/enforcement-results` -- dernier resultat d'enforcement persiste

2. **Nouveaux validateurs Zod** dans `packages/shared/src/validators/orchestrator.ts` (~80 lignes) :
   - `orchestratorTransitionSchema` : validation du body pour les transitions orchestrees
   - `orchestratorApproveSchema` : validation du body pour l'approbation HITL
   - `orchestratorRejectSchema` : validation du body pour le rejet HITL (feedback obligatoire)
   - `orchestratorCheckEnforcementSchema` : validation du body pour le dry-run enforcement
   - `orchestratorWorkflowFilterSchema` : validation des query params pour le filtrage workflows
   - `orchestratorStageFilterSchema` : validation des query params pour le filtrage stages

3. **Mise a jour `server/src/routes/index.ts`** -- ajout export `orchestratorRoutes`

4. **Mise a jour `server/src/services/index.ts`** -- ajout export `orchestratorService` (s'il n'est pas deja exporte)

5. **Mise a jour barrel exports** -- `packages/shared/src/validators/index.ts` et `packages/shared/src/index.ts`

### Ce que cette story ne fait PAS (scope)

- Pas de modification des services existants (orchestrator.ts, workflow-enforcer.ts, hitl-validation.ts) -- les services sont complets
- Pas de modification de la state machine (ORCH-S01)
- Pas de routes drift -- les routes drift existantes dans `drift.ts` sont deja fonctionnelles
- Pas de UI frontend -- c'est ORCH-S05
- Pas de refactoring des routes legacy `stages.ts` ou `workflows.ts` -- elles restent pour la backward-compatibility
- Pas de WebSocket endpoints -- les events WebSocket sont deja emis par les services
- Pas de pagination avancee (cursor-based) -- la liste de workflows/stages est volumetriquement faible
- Pas de rate limiting specifique -- le rate limiting global (TECH-04) s'applique

---

## Architecture Technique

### Flux API -- Transition orchestree

```
Client POST /api/companies/:companyId/orchestrator/stages/:stageId/transition
  { event: "start", metadata: { agentId: "..." } }
       |
       v
[1] requirePermission(db, "workflows:enforce") -- middleware RBAC
       |
       v
[2] validate(orchestratorTransitionSchema) -- Zod validation
       |
       v
[3] assertCompanyAccess(req, companyId) -- multi-tenant check
       |
       v
[4] orchestrator.transitionStage(stageId, event, actor, payload)
       |  -> RBAC check interne (getRequiredPermission)
       |  -> Enforcement (ORCH-S02)
       |  -> HITL interception si applicable (ORCH-S03)
       |  -> XState transition (ORCH-S01)
       |  -> Persist + LiveEvent
       |
       v
[5] res.json({ stage, fromState, toState })
       + logActivity()
```

### Flux API -- Approbation HITL

```
Client POST /api/companies/:companyId/orchestrator/stages/:stageId/approve
  { comment: "LGTM" }
       |
       v
[1] requirePermission(db, "workflows:enforce")
       |
       v
[2] validate(orchestratorApproveSchema)
       |
       v
[3] assertCompanyAccess + verifier stage en "validating"
       |
       v
[4] orchestrator.transitionStage(stageId, "approve", actor, { metadata: { comment } })
       |  -> approve + auto-complete + maybeAdvanceNextStage
       |
       v
[5] res.json({ stage, fromState: "validating", toState: "completed" })
```

### Flux API -- Rejet HITL

```
Client POST /api/companies/:companyId/orchestrator/stages/:stageId/reject
  { feedback: "Missing unit tests for edge cases" }
       |
       v
[1] requirePermission(db, "workflows:enforce")
       |
       v
[2] validate(orchestratorRejectSchema) -- feedback obligatoire, min 1 char
       |
       v
[3] assertCompanyAccess + verifier stage en "validating"
       |
       v
[4] orchestrator.transitionStage(stageId, "reject_with_feedback", actor, { feedback })
       |  -> stage repasse en in_progress avec feedback
       |
       v
[5] res.json({ stage, fromState: "validating", toState: "in_progress" })
```

### Flux API -- Dry-run enforcement

```
Client POST /api/companies/:companyId/orchestrator/stages/:stageId/check-enforcement
  { outputArtifacts: ["design-spec.md"], workspacePath: "/workspace/project" }
       |
       v
[1] requirePermission(db, "workflows:enforce")
       |
       v
[2] enforcer.enforceTransition(stageId, "complete", actor, payload)
       |  -> verifie les fichiers sans transitionner
       |
       v
[3] res.json(enforcementResult)
       |  -> { passed: false, missingFiles: ["wireframes.md"], warnings: [...] }
```

### Conventions de routes

Les routes orchestrateur suivent le pattern existant dans le codebase :
- **Prefixe** : `/api/companies/:companyId/orchestrator/...`
- **RBAC** : `requirePermission(db, "workflows:enforce")` pour les mutations, lecture autorisee pour tout membre de la company
- **Authz** : `assertCompanyAccess(req, companyId)` sur chaque route
- **Validation** : Zod via le middleware `validate()` existant
- **Logging** : `logActivity(db, { ... })` sur chaque mutation
- **Erreurs** : pattern `notFound()`, `forbidden()`, `conflict()`, `badRequest()` existant

### Interaction avec les routes legacy

Les routes existantes dans `stages.ts` et `workflows.ts` restent intactes pour la backward-compatibility. Les nouvelles routes orchestrateur offrent un superset enrichi :

| Legacy route | Orchestrator route | Difference |
|-------------|-------------------|-----------|
| `GET /stages/:id` | `GET /orchestrator/stages/:stageId` | + machineState, transitionHistory, enforcementResults, hitlDecision |
| `POST /stages/:id/transition` | `POST /orchestrator/stages/:stageId/transition` | Utilise orchestratorService au lieu de stageService, enforcement + HITL |
| `GET /workflows/:id` | `GET /orchestrator/workflows/:workflowId` | + stages avec machineState, workflowState |
| (n'existe pas) | `GET /orchestrator/validations/pending` | Nouveau |
| (n'existe pas) | `POST /orchestrator/stages/:stageId/approve` | Nouveau |
| (n'existe pas) | `POST /orchestrator/stages/:stageId/reject` | Nouveau |

---

## Acceptance Criteria

### AC-01 : Transition orchestree via API

**Given** un stage en etat `ready`
**When** un utilisateur avec permission `workflows:enforce` envoie `POST /api/companies/:companyId/orchestrator/stages/:stageId/transition` avec `{ event: "start" }`
**Then** le stage passe en etat `in_progress`, la reponse contient `{ stage, fromState: "ready", toState: "in_progress" }`, et un `activityLog` est cree

### AC-02 : Transition refusee sans permission

**Given** un utilisateur avec le role `viewer` (sans permission `workflows:enforce`)
**When** il envoie `POST /orchestrator/stages/:stageId/transition` avec `{ event: "start" }`
**Then** la reponse est `403 Forbidden` avec `{ error: "PERMISSION_DENIED", requiredPermission: "workflows:enforce" }`

### AC-03 : Transition avec enforcement

**Given** un stage avec des fichiers obligatoires definis dans le template
**When** un agent envoie `POST /orchestrator/stages/:stageId/transition` avec `{ event: "complete", outputArtifacts: [...] }`
**Then** l'enforcement verifie les fichiers, et si un fichier blocking manque, la reponse est `409 Conflict` avec `{ error: "ENFORCEMENT_FAILED", missingFiles: [...] }`

### AC-04 : Transition avec interception HITL

**Given** un stage avec `hitlRequired: true` dans le template
**When** un agent envoie `{ event: "complete" }`
**Then** l'orchestrateur intercepte et le stage passe en `validating` au lieu de `completed`, la reponse contient `toState: "validating"`

### AC-05 : Approbation HITL via API

**Given** un stage en etat `validating`
**When** un admin envoie `POST /orchestrator/stages/:stageId/approve` avec `{ comment: "LGTM" }`
**Then** le stage passe en `completed` (via approve + auto-complete), le stage suivant est auto-avance, et un `activityLog` est cree

### AC-06 : Rejet HITL avec feedback obligatoire

**Given** un stage en etat `validating`
**When** un admin envoie `POST /orchestrator/stages/:stageId/reject` avec `{ feedback: "Fix the tests" }`
**Then** le stage repasse en `in_progress` avec `feedback` persiste, et un `activityLog` est cree

### AC-07 : Rejet sans feedback refuse

**Given** un stage en etat `validating`
**When** un admin envoie `POST /orchestrator/stages/:stageId/reject` avec `{}` ou `{ feedback: "" }`
**Then** la reponse est `400 Bad Request` (validation Zod echoue)

### AC-08 : Liste des validations en attente

**Given** 3 stages en etat `validating` pour la company
**When** un admin envoie `GET /orchestrator/validations/pending`
**Then** la reponse contient les 3 validations avec `stageId`, `stageName`, `workflowName`, `requestedAt`, `hitlRoles`, `outputArtifacts`, `rejectCount`

### AC-09 : Historique des validations HITL

**Given** un stage qui a ete rejete 2 fois puis approuve
**When** un admin envoie `GET /orchestrator/stages/:stageId/validation-history`
**Then** la reponse contient 3 entries chronologiques : `[rejected, rejected, approved]` avec actorId, timestamp, feedback

### AC-10 : Workflow enrichi avec machineState

**Given** un workflow avec 5 stages dont 3 sont `completed`, 1 `in_progress` et 1 `created`
**When** un utilisateur envoie `GET /orchestrator/workflows/:workflowId`
**Then** la reponse contient le workflow avec `workflowState`, et les 5 stages chacun avec `machineState`, `transitionHistory`, `enforcementResults`

### AC-11 : Liste des workflows filtrable

**Given** 10 workflows dont 3 en etat `active` et 2 en `completed`
**When** un utilisateur envoie `GET /orchestrator/workflows?workflowState=active`
**Then** la reponse contient uniquement les 3 workflows `active`

### AC-12 : Stages filtrables par machineState

**Given** un workflow avec 5 stages
**When** un utilisateur envoie `GET /orchestrator/workflows/:workflowId/stages?machineState=completed`
**Then** la reponse contient uniquement les stages en etat `completed`

### AC-13 : Stage context (pre-prompts) via API

**Given** un stage avec des pre-prompts et des artifacts de stages precedents
**When** un agent envoie `GET /orchestrator/stages/:stageId/context`
**Then** la reponse contient le `PrePromptPayload` avec `stagePrePrompts`, `previousArtifacts`, `acceptanceCriteria`, `stageName`

### AC-14 : Dry-run enforcement

**Given** un stage avec des fichiers obligatoires
**When** un utilisateur envoie `POST /orchestrator/stages/:stageId/check-enforcement` avec `{ outputArtifacts: ["file1.md"] }`
**Then** la reponse contient le `EnforcementResult` avec `passed`, `fileChecks`, `missingFiles`, `warnings`, SANS transitionner le stage

### AC-15 : Enforcement results persistes

**Given** un stage qui a subi un check d'enforcement
**When** un utilisateur envoie `GET /orchestrator/stages/:stageId/enforcement-results`
**Then** la reponse contient le dernier `EnforcementResult` persiste

### AC-16 : Historique des transitions

**Given** un stage qui a subi 5 transitions
**When** un utilisateur envoie `GET /orchestrator/stages/:stageId/history`
**Then** la reponse contient les 5 `TransitionRecord` en ordre chronologique avec `from`, `to`, `event`, `actorId`, `actorType`, `timestamp`

### AC-17 : Validation Zod sur les events

**Given** une requete avec un event invalide
**When** un utilisateur envoie `POST /orchestrator/stages/:stageId/transition` avec `{ event: "invalid_event" }`
**Then** la reponse est `400 Bad Request` avec les details de validation Zod

### AC-18 : Multi-tenant isolation

**Given** un stage appartenant a la company A
**When** un utilisateur de la company B tente `GET /orchestrator/stages/:stageId`
**Then** la reponse est `403 Forbidden`

### AC-19 : Audit trail pour chaque mutation

**Given** chaque mutation orchestrateur (transition, approve, reject)
**When** la mutation est executee avec succes
**Then** un `activityLog` est enregistre avec `companyId`, `actorType`, `actorId`, `action`, `entityType`, `entityId`, `details`

### AC-20 : Backward-compatibility routes legacy

**Given** les routes legacy `POST /stages/:id/transition` et `GET /stages/:id`
**When** un client existant les appelle
**Then** elles fonctionnent toujours comme avant (non modifiees)

---

## Data-test-id Mapping

### Routes -- Transition (POST /orchestrator/stages/:stageId/transition)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-transition-route` | Route handler | `POST /companies/:companyId/orchestrator/stages/:stageId/transition` existe et est fonctionnel |
| `orch-s04-transition-rbac` | Middleware | `requirePermission(db, "workflows:enforce")` applique sur la route transition |
| `orch-s04-transition-validation` | Middleware | Validation Zod du body avec `orchestratorTransitionSchema` |
| `orch-s04-transition-company-access` | Guard | `assertCompanyAccess(req, companyId)` verifie l'acces multi-tenant |
| `orch-s04-transition-response` | Response | Response contient `{ stage, fromState, toState }` |
| `orch-s04-transition-activity-log` | Side effect | `logActivity()` appele avec action `orchestrator.stage_transitioned` |
| `orch-s04-transition-enforcement-error` | Error response | 409 avec `{ error: "ENFORCEMENT_FAILED", missingFiles }` quand enforcement echoue |
| `orch-s04-transition-invalid-event` | Error response | 400 quand l'event n'est pas un `StageEvent` valide |
| `orch-s04-transition-forbidden` | Error response | 403 quand l'acteur n'a pas `workflows:enforce` |

### Routes -- Approbation HITL (POST /orchestrator/stages/:stageId/approve)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-approve-route` | Route handler | `POST /companies/:companyId/orchestrator/stages/:stageId/approve` |
| `orch-s04-approve-rbac` | Middleware | `requirePermission(db, "workflows:enforce")` |
| `orch-s04-approve-validation` | Middleware | Validation Zod du body avec `orchestratorApproveSchema` |
| `orch-s04-approve-response` | Response | Response contient `{ stage, fromState: "validating", toState }` |
| `orch-s04-approve-activity-log` | Side effect | `logActivity()` appele avec action `orchestrator.stage_approved` |
| `orch-s04-approve-not-validating` | Error response | 409 quand le stage n'est pas en etat `validating` |

### Routes -- Rejet HITL (POST /orchestrator/stages/:stageId/reject)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-reject-route` | Route handler | `POST /companies/:companyId/orchestrator/stages/:stageId/reject` |
| `orch-s04-reject-rbac` | Middleware | `requirePermission(db, "workflows:enforce")` |
| `orch-s04-reject-validation` | Middleware | Validation Zod du body avec `orchestratorRejectSchema` (feedback obligatoire min 1 char) |
| `orch-s04-reject-response` | Response | Response contient `{ stage, fromState: "validating", toState: "in_progress" }` |
| `orch-s04-reject-activity-log` | Side effect | `logActivity()` appele avec action `orchestrator.stage_rejected` |
| `orch-s04-reject-empty-feedback` | Error response | 400 quand feedback est vide ou absent |

### Routes -- Validations en attente (GET /orchestrator/validations/pending)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-pending-validations-route` | Route handler | `GET /companies/:companyId/orchestrator/validations/pending` |
| `orch-s04-pending-validations-rbac` | Middleware | `requirePermission(db, "workflows:enforce")` |
| `orch-s04-pending-validations-response` | Response | Array de `PendingValidation` avec stageId, stageName, workflowName, requestedAt, hitlRoles |

### Routes -- Validation history (GET /orchestrator/stages/:stageId/validation-history)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-validation-history-route` | Route handler | `GET /companies/:companyId/orchestrator/stages/:stageId/validation-history` |
| `orch-s04-validation-history-response` | Response | Array de `HitlDecision` en ordre chronologique |

### Routes -- Stage enrichi (GET /orchestrator/stages/:stageId)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-stage-get-route` | Route handler | `GET /companies/:companyId/orchestrator/stages/:stageId` |
| `orch-s04-stage-get-response` | Response | Stage avec `machineState`, `transitionHistory`, `enforcementResults`, `hitlDecision`, `prePromptsInjected` |

### Routes -- Stage context (GET /orchestrator/stages/:stageId/context)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-stage-context-route` | Route handler | `GET /companies/:companyId/orchestrator/stages/:stageId/context` |
| `orch-s04-stage-context-response` | Response | `PrePromptPayload` avec `stagePrePrompts`, `previousArtifacts`, `acceptanceCriteria` |

### Routes -- Stage artifacts (GET /orchestrator/stages/:stageId/artifacts)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-stage-artifacts-route` | Route handler | `GET /companies/:companyId/orchestrator/stages/:stageId/artifacts` |
| `orch-s04-stage-artifacts-response` | Response | Array de `StageArtifact` pour le workflow instance |

### Routes -- Stage transition history (GET /orchestrator/stages/:stageId/history)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-stage-history-route` | Route handler | `GET /companies/:companyId/orchestrator/stages/:stageId/history` |
| `orch-s04-stage-history-response` | Response | Array de `TransitionRecord` en ordre chronologique |

### Routes -- Workflow enrichi (GET /orchestrator/workflows/:workflowId)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-workflow-get-route` | Route handler | `GET /companies/:companyId/orchestrator/workflows/:workflowId` |
| `orch-s04-workflow-get-response` | Response | Workflow avec `workflowState` + array de stages avec `machineState` |

### Routes -- Workflow list (GET /orchestrator/workflows)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-workflow-list-route` | Route handler | `GET /companies/:companyId/orchestrator/workflows` |
| `orch-s04-workflow-list-filter` | Query param | `?workflowState=active` filtre par etat workflow |
| `orch-s04-workflow-list-response` | Response | Array de workflow instances |

### Routes -- Workflow stages (GET /orchestrator/workflows/:workflowId/stages)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-workflow-stages-route` | Route handler | `GET /companies/:companyId/orchestrator/workflows/:workflowId/stages` |
| `orch-s04-workflow-stages-filter` | Query param | `?machineState=completed` filtre par etat stage |
| `orch-s04-workflow-stages-response` | Response | Array de stages avec `machineState` |

### Routes -- Enforcement dry-run (POST /orchestrator/stages/:stageId/check-enforcement)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-check-enforcement-route` | Route handler | `POST /companies/:companyId/orchestrator/stages/:stageId/check-enforcement` |
| `orch-s04-check-enforcement-rbac` | Middleware | `requirePermission(db, "workflows:enforce")` |
| `orch-s04-check-enforcement-response` | Response | `EnforcementResult` avec `passed`, `fileChecks`, `missingFiles`, `warnings` |
| `orch-s04-check-enforcement-no-transition` | Behavior | Le stage ne change PAS d'etat apres le check |

### Routes -- Enforcement results (GET /orchestrator/stages/:stageId/enforcement-results)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-enforcement-results-route` | Route handler | `GET /companies/:companyId/orchestrator/stages/:stageId/enforcement-results` |
| `orch-s04-enforcement-results-response` | Response | Dernier `EnforcementResult` persiste ou `null` |

### Validators (Zod schemas)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-validator-transition` | Zod schema | `orchestratorTransitionSchema` dans `packages/shared/src/validators/orchestrator.ts` |
| `orch-s04-validator-approve` | Zod schema | `orchestratorApproveSchema` dans `packages/shared/src/validators/orchestrator.ts` |
| `orch-s04-validator-reject` | Zod schema | `orchestratorRejectSchema` avec `feedback` min 1 char |
| `orch-s04-validator-check-enforcement` | Zod schema | `orchestratorCheckEnforcementSchema` |
| `orch-s04-validator-workflow-filter` | Zod schema | `orchestratorWorkflowFilterSchema` pour query params |
| `orch-s04-validator-stage-filter` | Zod schema | `orchestratorStageFilterSchema` pour query params |

### Barrel exports

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s04-routes-barrel` | Export | `orchestratorRoutes` exporte depuis `server/src/routes/index.ts` |
| `orch-s04-validators-barrel` | Export | Schemas Zod exportes depuis `packages/shared/src/validators/index.ts` |
| `orch-s04-validators-shared-barrel` | Export | Schemas Zod re-exportes depuis `packages/shared/src/index.ts` |

---

## Cas de Test pour QA (Playwright E2E)

### T01 -- orchestrator.ts route file exists
Verifier que `server/src/routes/orchestrator.ts` existe et exporte une fonction `orchestratorRoutes(db)` qui retourne un `Router`.

### T02 -- orchestratorRoutes exported from routes/index.ts
Verifier que `server/src/routes/index.ts` contient `export { orchestratorRoutes } from "./orchestrator.js"`.

### T03 -- orchestratorTransitionSchema exists
Verifier que `packages/shared/src/validators/orchestrator.ts` exporte `orchestratorTransitionSchema` avec les champs `event` (enum StageEvent), `outputArtifacts` (optional string[]), et `metadata` (optional record).

### T04 -- orchestratorApproveSchema exists
Verifier que `packages/shared/src/validators/orchestrator.ts` exporte `orchestratorApproveSchema` avec le champ `comment` (optional string).

### T05 -- orchestratorRejectSchema exists
Verifier que `packages/shared/src/validators/orchestrator.ts` exporte `orchestratorRejectSchema` avec le champ `feedback` (string, min 1 char obligatoire).

### T06 -- orchestratorCheckEnforcementSchema exists
Verifier que `packages/shared/src/validators/orchestrator.ts` exporte `orchestratorCheckEnforcementSchema` avec les champs `outputArtifacts` (optional string[]) et `workspacePath` (optional string).

### T07 -- orchestratorWorkflowFilterSchema exists
Verifier que `packages/shared/src/validators/orchestrator.ts` exporte `orchestratorWorkflowFilterSchema` avec `workflowState` (optional enum WorkflowState).

### T08 -- orchestratorStageFilterSchema exists
Verifier que `packages/shared/src/validators/orchestrator.ts` exporte `orchestratorStageFilterSchema` avec `machineState` (optional enum StageState).

### T09 -- validators barrel export
Verifier que `packages/shared/src/validators/index.ts` re-exporte tous les schemas de `orchestrator.ts`.

### T10 -- shared barrel export
Verifier que `packages/shared/src/index.ts` re-exporte les validators orchestrateur.

### T11 -- POST transition route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `POST /companies/:companyId/orchestrator/stages/:stageId/transition`.

### T12 -- POST transition uses requirePermission
Verifier que la route transition utilise `requirePermission(db, "workflows:enforce")` comme middleware.

### T13 -- POST transition uses validate middleware
Verifier que la route transition utilise `validate(orchestratorTransitionSchema)`.

### T14 -- POST transition calls orchestratorService.transitionStage
Verifier que la route transition appelle `orchestratorService(db)` puis `transitionStage(stageId, event, actor, payload)`.

### T15 -- POST transition calls logActivity
Verifier que la route transition appelle `logActivity(db, ...)` avec `action: "orchestrator.stage_transitioned"`.

### T16 -- POST transition response format
Verifier que la response contient les proprietes `stage`, `fromState`, `toState`.

### T17 -- GET stage enrichi route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `GET /companies/:companyId/orchestrator/stages/:stageId`.

### T18 -- GET stage enrichi calls getStageWithState
Verifier que la route appelle `orchestrator.getStageWithState(stageId)`.

### T19 -- GET stage enrichi response includes machineState
Verifier que la response contient `machineState`, `transitionHistory`.

### T20 -- GET stage context route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `GET /companies/:companyId/orchestrator/stages/:stageId/context`.

### T21 -- GET stage context calls buildStageContext
Verifier que la route appelle `enforcer.buildStageContext(stageId)`.

### T22 -- GET stage context response format
Verifier que la response contient `stagePrePrompts`, `previousArtifacts`, `acceptanceCriteria`, `stageName`.

### T23 -- GET stage artifacts route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `GET /companies/:companyId/orchestrator/stages/:stageId/artifacts`.

### T24 -- GET stage history route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `GET /companies/:companyId/orchestrator/stages/:stageId/history`.

### T25 -- GET stage history response is TransitionRecord array
Verifier que la response est un array de `TransitionRecord` avec `from`, `to`, `event`, `actorId`, `actorType`, `timestamp`.

### T26 -- GET workflow enrichi route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `GET /companies/:companyId/orchestrator/workflows/:workflowId`.

### T27 -- GET workflow enrichi calls getWorkflowWithState
Verifier que la route appelle `orchestrator.getWorkflowWithState(workflowId)`.

### T28 -- GET workflow enrichi response includes stages with machineState
Verifier que la response contient `workflowState` et `stages` array ou chaque stage a `machineState`.

### T29 -- GET workflows list route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `GET /companies/:companyId/orchestrator/workflows`.

### T30 -- GET workflows list supports workflowState filter
Verifier que la route accepte `?workflowState=active` et filtre correctement.

### T31 -- GET workflow stages route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `GET /companies/:companyId/orchestrator/workflows/:workflowId/stages`.

### T32 -- GET workflow stages supports machineState filter
Verifier que la route accepte `?machineState=completed` et filtre correctement.

### T33 -- POST approve route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `POST /companies/:companyId/orchestrator/stages/:stageId/approve`.

### T34 -- POST approve uses requirePermission
Verifier que la route approve utilise `requirePermission(db, "workflows:enforce")`.

### T35 -- POST approve uses validate middleware
Verifier que la route approve utilise `validate(orchestratorApproveSchema)`.

### T36 -- POST approve calls transitionStage with approve event
Verifier que la route appelle `transitionStage(stageId, "approve", actor, ...)`.

### T37 -- POST approve calls logActivity
Verifier que la route appelle `logActivity(db, ...)` avec `action: "orchestrator.stage_approved"`.

### T38 -- POST reject route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `POST /companies/:companyId/orchestrator/stages/:stageId/reject`.

### T39 -- POST reject uses requirePermission
Verifier que la route reject utilise `requirePermission(db, "workflows:enforce")`.

### T40 -- POST reject uses validate middleware
Verifier que la route reject utilise `validate(orchestratorRejectSchema)`.

### T41 -- POST reject calls transitionStage with reject_with_feedback event
Verifier que la route appelle `transitionStage(stageId, "reject_with_feedback", actor, { feedback })`.

### T42 -- POST reject calls logActivity
Verifier que la route appelle `logActivity(db, ...)` avec `action: "orchestrator.stage_rejected"`.

### T43 -- GET validations pending route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `GET /companies/:companyId/orchestrator/validations/pending`.

### T44 -- GET validations pending uses requirePermission
Verifier que la route utilise `requirePermission(db, "workflows:enforce")`.

### T45 -- GET validations pending calls listPendingValidations
Verifier que la route appelle `orchestrator.listPendingValidations(companyId)`.

### T46 -- GET validation-history route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `GET /companies/:companyId/orchestrator/stages/:stageId/validation-history`.

### T47 -- GET validation-history calls getValidationHistory
Verifier que la route appelle `orchestrator.getValidationHistory(stageId)`.

### T48 -- POST check-enforcement route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `POST /companies/:companyId/orchestrator/stages/:stageId/check-enforcement`.

### T49 -- POST check-enforcement uses requirePermission
Verifier que la route utilise `requirePermission(db, "workflows:enforce")`.

### T50 -- POST check-enforcement calls enforceTransition
Verifier que la route appelle `enforcer.enforceTransition(stageId, "complete", actor, payload)`.

### T51 -- POST check-enforcement does NOT transition stage
Verifier que le stage `machineState` ne change PAS apres le call (dry-run).

### T52 -- GET enforcement-results route exists
Verifier que `server/src/routes/orchestrator.ts` contient un handler pour `GET /companies/:companyId/orchestrator/stages/:stageId/enforcement-results`.

### T53 -- GET enforcement-results returns persisted results
Verifier que la response contient `enforcementResults` depuis la colonne `enforcement_results` du stage.

### T54 -- assertCompanyAccess on all routes
Verifier que CHAQUE route dans `orchestrator.ts` appelle `assertCompanyAccess(req, companyId)`.

### T55 -- getActorInfo used for actor resolution
Verifier que les routes mutation (transition, approve, reject) utilisent `getActorInfo(req)` pour resoudre l'acteur.

### T56 -- event enum validation rejects invalid events
Verifier que `orchestratorTransitionSchema` rejette les events non presents dans `STAGE_EVENTS` (ex: `"invalid"`, `""`, `123`).

### T57 -- feedback min length validation
Verifier que `orchestratorRejectSchema` rejette un feedback vide (`""`) ou absent.

### T58 -- workflowState filter enum validation
Verifier que `orchestratorWorkflowFilterSchema` rejette les etats invalides (ex: `"running"`).

### T59 -- machineState filter enum validation
Verifier que `orchestratorStageFilterSchema` rejette les etats invalides (ex: `"active"`).

### T60 -- Legacy routes unchanged
Verifier que `server/src/routes/stages.ts` n'a PAS ete modifie (meme contenu qu'avant ORCH-S04).

### T61 -- Legacy workflows routes unchanged
Verifier que `server/src/routes/workflows.ts` n'a PAS ete modifie.

### T62 -- Route file imports orchestratorService
Verifier que `orchestrator.ts` importe et utilise `orchestratorService` depuis `../services/orchestrator.js`.

### T63 -- Route file imports workflowEnforcerService
Verifier que `orchestrator.ts` importe et utilise `workflowEnforcerService` depuis `../services/workflow-enforcer.js` pour le dry-run enforcement.

### T64 -- 14 routes total in orchestrator.ts
Verifier que `orchestrator.ts` contient exactement 14 route handlers (5 stage lifecycle + 3 workflow state + 4 HITL + 2 enforcement).

---

## Notes Techniques

### 1. Structure du fichier orchestrator.ts routes

```typescript
import { Router } from "express";
import type { Db } from "@mnm/db";
import {
  orchestratorTransitionSchema,
  orchestratorApproveSchema,
  orchestratorRejectSchema,
  orchestratorCheckEnforcementSchema,
  orchestratorWorkflowFilterSchema,
  orchestratorStageFilterSchema,
  STAGE_EVENTS,
  WORKFLOW_STATES,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission } from "../middleware/require-permission.js";
import { orchestratorService } from "../services/orchestrator.js";
import { workflowEnforcerService } from "../services/workflow-enforcer.js";
import { logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound } from "../errors.js";

export function orchestratorRoutes(db: Db) {
  const router = Router();
  const orchestrator = orchestratorService(db);
  const enforcer = workflowEnforcerService(db);

  // ... 14 routes
  return router;
}
```

### 2. Validateurs Zod -- orchestrator.ts

```typescript
import { z } from "zod";
import { STAGE_EVENTS, STAGE_STATES, WORKFLOW_STATES } from "../types/orchestrator.js";

export const orchestratorTransitionSchema = z.object({
  event: z.enum(STAGE_EVENTS),
  outputArtifacts: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  feedback: z.string().optional(),
});

export type OrchestratorTransition = z.infer<typeof orchestratorTransitionSchema>;

export const orchestratorApproveSchema = z.object({
  comment: z.string().optional(),
});

export type OrchestratorApprove = z.infer<typeof orchestratorApproveSchema>;

export const orchestratorRejectSchema = z.object({
  feedback: z.string().min(1, "Feedback is required when rejecting"),
});

export type OrchestratorReject = z.infer<typeof orchestratorRejectSchema>;

export const orchestratorCheckEnforcementSchema = z.object({
  outputArtifacts: z.array(z.string()).optional(),
  workspacePath: z.string().optional(),
});

export type OrchestratorCheckEnforcement = z.infer<typeof orchestratorCheckEnforcementSchema>;

export const orchestratorWorkflowFilterSchema = z.object({
  workflowState: z.enum(WORKFLOW_STATES).optional(),
});

export type OrchestratorWorkflowFilter = z.infer<typeof orchestratorWorkflowFilterSchema>;

export const orchestratorStageFilterSchema = z.object({
  machineState: z.enum(STAGE_STATES).optional(),
});

export type OrchestratorStageFilter = z.infer<typeof orchestratorStageFilterSchema>;
```

### 3. Pattern de route pour la transition

```typescript
router.post(
  "/companies/:companyId/orchestrator/stages/:stageId/transition",
  requirePermission(db, "workflows:enforce"),
  validate(orchestratorTransitionSchema),
  async (req, res) => {
    const { companyId, stageId } = req.params;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);

    const result = await orchestrator.transitionStage(
      stageId as string,
      req.body.event,
      {
        actorId: actor.actorId,
        actorType: actor.actorType,
        companyId: companyId as string,
        userId: actor.actorType === "user" ? actor.actorId : null,
      },
      {
        outputArtifacts: req.body.outputArtifacts,
        error: req.body.error,
        feedback: req.body.feedback,
        metadata: req.body.metadata,
      },
    );

    await logActivity(db, {
      companyId: companyId as string,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "orchestrator.stage_transitioned",
      entityType: "stage",
      entityId: stageId as string,
      details: {
        event: req.body.event,
        fromState: result.fromState,
        toState: result.toState,
      },
    });

    res.json(result);
  },
);
```

### 4. Pattern pour l'approbation HITL

```typescript
router.post(
  "/companies/:companyId/orchestrator/stages/:stageId/approve",
  requirePermission(db, "workflows:enforce"),
  validate(orchestratorApproveSchema),
  async (req, res) => {
    const { companyId, stageId } = req.params;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);

    const result = await orchestrator.transitionStage(
      stageId as string,
      "approve",
      {
        actorId: actor.actorId,
        actorType: actor.actorType,
        companyId: companyId as string,
        userId: actor.actorType === "user" ? actor.actorId : null,
      },
      {
        metadata: { comment: req.body.comment },
      },
    );

    await logActivity(db, {
      companyId: companyId as string,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "orchestrator.stage_approved",
      entityType: "stage",
      entityId: stageId as string,
      details: {
        fromState: result.fromState,
        toState: result.toState,
        comment: req.body.comment,
      },
    });

    res.json(result);
  },
);
```

### 5. Pattern pour la lecture enrichie d'un stage

```typescript
router.get(
  "/companies/:companyId/orchestrator/stages/:stageId",
  async (req, res) => {
    const { companyId, stageId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const stage = await orchestrator.getStageWithState(stageId as string);
    // Verify stage belongs to the company
    if (stage.companyId !== companyId) {
      throw notFound("Stage not found");
    }

    res.json(stage);
  },
);
```

### 6. Pattern pour le dry-run enforcement

```typescript
router.post(
  "/companies/:companyId/orchestrator/stages/:stageId/check-enforcement",
  requirePermission(db, "workflows:enforce"),
  validate(orchestratorCheckEnforcementSchema),
  async (req, res) => {
    const { companyId, stageId } = req.params;
    assertCompanyAccess(req, companyId as string);
    const actor = getActorInfo(req);

    const result = await enforcer.enforceTransition(
      stageId as string,
      "complete",
      {
        actorId: actor.actorId,
        actorType: actor.actorType,
        companyId: companyId as string,
      },
      {
        outputArtifacts: req.body.outputArtifacts,
        metadata: { workspacePath: req.body.workspacePath },
      },
    );

    res.json(result);
  },
);
```

### 7. API Reference (resume complet)

| # | Methode | Path | Permission | Body/Query | Response |
|---|---------|------|------------|-----------|----------|
| 1 | POST | `/companies/:companyId/orchestrator/stages/:stageId/transition` | `workflows:enforce` | `{ event, outputArtifacts?, metadata?, error?, feedback? }` | `{ stage, fromState, toState }` |
| 2 | GET | `/companies/:companyId/orchestrator/stages/:stageId` | (auth) | - | Stage enrichi |
| 3 | GET | `/companies/:companyId/orchestrator/stages/:stageId/context` | (auth) | - | `PrePromptPayload` |
| 4 | GET | `/companies/:companyId/orchestrator/stages/:stageId/artifacts` | (auth) | - | `StageArtifact[]` |
| 5 | GET | `/companies/:companyId/orchestrator/stages/:stageId/history` | (auth) | - | `TransitionRecord[]` |
| 6 | GET | `/companies/:companyId/orchestrator/workflows/:workflowId` | (auth) | - | Workflow + stages enrichis |
| 7 | GET | `/companies/:companyId/orchestrator/workflows` | (auth) | `?workflowState=active` | Workflow[] |
| 8 | GET | `/companies/:companyId/orchestrator/workflows/:workflowId/stages` | (auth) | `?machineState=completed` | Stage[] |
| 9 | GET | `/companies/:companyId/orchestrator/validations/pending` | `workflows:enforce` | - | `PendingValidation[]` |
| 10 | POST | `/companies/:companyId/orchestrator/stages/:stageId/approve` | `workflows:enforce` | `{ comment? }` | `{ stage, fromState, toState }` |
| 11 | POST | `/companies/:companyId/orchestrator/stages/:stageId/reject` | `workflows:enforce` | `{ feedback }` | `{ stage, fromState, toState }` |
| 12 | GET | `/companies/:companyId/orchestrator/stages/:stageId/validation-history` | (auth) | - | `HitlDecision[]` |
| 13 | POST | `/companies/:companyId/orchestrator/stages/:stageId/check-enforcement` | `workflows:enforce` | `{ outputArtifacts?, workspacePath? }` | `EnforcementResult` |
| 14 | GET | `/companies/:companyId/orchestrator/stages/:stageId/enforcement-results` | (auth) | - | `EnforcementResult \| null` |

Notes :
- `(auth)` = authentification requise + `assertCompanyAccess()`, mais pas de permission specifique
- Les routes GET de lecture sont accessibles a tout membre de la company pour permettre la visibilite
- Les routes POST de mutation requierent `workflows:enforce`

### 8. Fichiers a creer/modifier

| Fichier | Action | Lignes estimees |
|---------|--------|----------------|
| `server/src/routes/orchestrator.ts` | CREER | ~350-400 lignes |
| `packages/shared/src/validators/orchestrator.ts` | CREER | ~80 lignes |
| `server/src/routes/index.ts` | MODIFIER | +1 ligne (export orchestratorRoutes) |
| `packages/shared/src/validators/index.ts` | MODIFIER | +1 ligne (export * from orchestrator) |
| `packages/shared/src/index.ts` | MODIFIER | +1 ligne (re-export validators) |
| `server/src/app.ts` (ou equivalent) | MODIFIER | +1-2 lignes (mount orchestratorRoutes) |

### 9. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Conflit de noms avec routes legacy `/stages/:id` | Moyen | Les nouvelles routes ont le prefixe `/orchestrator/` qui les isole completement |
| Performance `getWorkflowWithState` avec beaucoup de stages | Faible | Le nombre de stages par workflow est typiquement < 20, pas d'optimisation necessaire |
| Route `/check-enforcement` qui persiste un resultat sans transition | Mineur | L'enforcement `enforceTransition` persiste deja le resultat dans la DB. Le dry-run utilise le meme code mais le stage ne transite pas car on ne fait que l'enforcement, pas la transition XState |
| Ordering des routes Express (`:stageId` vs paths fixe) | Faible | Les paths fixes (ex: `validations/pending`) sont declares AVANT les parametres dynamiques (`:stageId`) pour eviter le conflit |

### 10. Definition of Done

- [ ] Fichier `server/src/routes/orchestrator.ts` cree avec 14 routes
- [ ] Fichier `packages/shared/src/validators/orchestrator.ts` cree avec 6 schemas Zod
- [ ] `requirePermission(db, "workflows:enforce")` sur toutes les routes de mutation
- [ ] `assertCompanyAccess(req, companyId)` sur toutes les routes
- [ ] `validate()` middleware sur toutes les routes POST
- [ ] `logActivity()` sur toutes les mutations (transition, approve, reject)
- [ ] Barrel exports dans `routes/index.ts`, `validators/index.ts`, `shared/index.ts`
- [ ] Routes montees dans l'app Express
- [ ] Routes legacy `stages.ts` et `workflows.ts` non modifiees
- [ ] Tous les data-testid implementes
- [ ] Tests E2E Playwright
- [ ] `pnpm typecheck` passe
- [ ] Backward-compatible (les anciennes routes fonctionnent toujours)
