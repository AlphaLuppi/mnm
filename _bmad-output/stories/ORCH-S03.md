# ORCH-S03 : Validation Humaine (Human-In-The-Loop)

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | ORCH-S03 |
| **Titre** | Validation Humaine (HITL) -- Pause configurable par etape avec approbation/rejet + feedback |
| **Epic** | Epic ORCH -- Orchestrateur Deterministe (Noyau A) |
| **Sprint** | Sprint 4 (Batch 7) |
| **Effort** | M (5 SP, 3-4j) |
| **Priorite** | P0 -- REQ-ORCH-09 (Human-in-the-loop) |
| **Assignation** | Cofondateur (backend service + frontend UI) |
| **Bloque par** | ORCH-S01 (State Machine XState -- DONE), ORCH-S02 (WorkflowEnforcer -- DONE) |
| **Debloque** | DUAL-S03 (Enforcement curseur), ORCH-S05 (UI editeur workflow) |
| **ADR** | ADR-003 (Orchestrateur Deterministe -- State Machine) |
| **Type** | Full-stack (backend service + frontend components + schema extension + types) |
| **FRs couverts** | REQ-ORCH-09 (Validation humaine configurable human-in-the-loop) |

---

## Description

### Contexte -- Pourquoi cette story est critique

L'orchestrateur (ORCH-S01) definit l'etat `validating` avec les transitions `approve` et `reject_with_feedback`. Le WorkflowEnforcer (ORCH-S02) verifie les fichiers obligatoires et injecte les pre-prompts. Mais **aucun mecanisme ne decide automatiquement quand un stage doit passer en validation humaine**, ni ne fournit l'interface pour que le validateur puisse approuver ou rejeter.

Aujourd'hui, la transition `request_validation` existe dans la state machine mais n'est jamais declenchee automatiquement. Un agent peut completer une etape critique (ex: "Review", "Design") sans qu'aucun humain ne valide le livrable. C'est incompatible avec la promesse B2B : **le CTO de CBA veut voir et approuver chaque livrable critique avant que l'agent passe a l'etape suivante** (Verite #45 du brainstorming).

Le PRD est explicite : REQ-ORCH-09 (P0) exige une validation humaine configurable. Le critere de succes SC-D4 impose un taux de 100% de validation humaine au MVP.

### Etat actuel du code

| Fichier | Etat | Role |
|---------|------|------|
| `server/src/services/orchestrator.ts` | Existe (511 lignes, ORCH-S01+S02 DONE) | `transitionStage()` gere approve/reject_with_feedback, `maybeAdvanceNextStage()` auto-avance apres completion |
| `server/src/services/workflow-state-machine.ts` | Existe (300 lignes, ORCH-S01 DONE) | Etat `validating` avec transitions `approve -> in_progress` et `reject_with_feedback -> in_progress` |
| `server/src/services/workflow-enforcer.ts` | Existe (433 lignes, ORCH-S02 DONE) | `enforceTransition()` verifie fichiers obligatoires pour `complete` et `request_validation` |
| `packages/db/src/schema/workflow_templates.ts` | Existe | `WorkflowStageTemplateDef` avec `requiredFiles`, `prePrompts`, `expectedOutputs` |
| `packages/db/src/schema/stage_instances.ts` | Existe | Colonnes `machineState`, `feedback`, `transitionHistory`, `enforcementResults` |
| `packages/shared/src/types/orchestrator.ts` | Existe (155 lignes) | `StageState` inclut `validating`, `StageEvent` inclut `request_validation`, `approve`, `reject_with_feedback` |
| `packages/shared/src/constants.ts` | Existe | `LIVE_EVENT_TYPES` inclut deja `stage.validation_requested`, `stage.approved`, `stage.rejected` |
| `server/src/routes/approvals.ts` | Existe (346 lignes) | Systeme d'approbation existant (pour hire_agent, etc.) -- pattern de reference mais scope different |
| `server/src/services/live-events.ts` | Existe | `publishLiveEvent()` pour notifications WebSocket |

### Ce que cette story construit

1. **Extension `WorkflowStageTemplateDef`** -- ajout de 2 champs au type de template de stage :
   - `hitlRequired?: boolean` : si `true`, la completion de l'etape passe automatiquement en `validating` au lieu de `completed`
   - `hitlRoles?: string[]` : roles autorises a valider (ex: `["admin", "manager"]`). Defaut: `["admin", "manager"]`

2. **Nouveau service `server/src/services/hitl-validation.ts`** (~200-300 lignes) :
   - `shouldRequestValidation(stageId)` : verifie si le template de l'etape a `hitlRequired: true`
   - `requestValidation(stageId, actor)` : declenche `request_validation` sur la state machine et emet les notifications WebSocket
   - `approveStage(stageId, actor, comment?)` : declenche `approve` et avance au stage suivant
   - `rejectStage(stageId, actor, feedback)` : declenche `reject_with_feedback` avec le feedback injecte dans le contexte de l'agent
   - `listPendingValidations(companyId)` : liste les stages en etat `validating` pour une company
   - `getValidationHistory(stageId)` : retourne l'historique des validations/rejets pour un stage

3. **Integration dans `orchestrator.ts`** :
   - Modification de `transitionStage()` : quand l'evenement est `complete` et que `hitlRequired` est `true`, intercepter et emettre `request_validation` a la place
   - Modification de `maybeAdvanceNextStage()` : si le stage passe a `completed` apres approbation, avancer normalement

4. **Extension `stage_instances`** -- ajout de 2 colonnes :
   - `hitlDecision` (jsonb) : derniere decision HITL (`{ decision: "approved"|"rejected", actorId, actorType, comment, feedback, decidedAt }`)
   - `hitlHistory` (jsonb array) : historique de toutes les decisions HITL pour ce stage

5. **Frontend : `ValidationBanner.tsx`** -- banniere d'alerte dans le WorkflowPipeline
   - Affiche quand un stage est en etat `validating`
   - Boutons Approuver / Rejeter avec dialogue de feedback
   - Visible uniquement pour les roles autorises (`hitlRoles`)

6. **Frontend : `PendingValidationsPanel.tsx`** -- panneau dans la sidebar/dashboard
   - Liste les validations en attente pour la company
   - Badge de compteur sur l'icone de navigation
   - Click redirige vers le workflow concerne

7. **Extension LiveEventTypes** -- ajout de :
   - `hitl.validation_requested` : emis quand un stage passe en `validating` (contient stageId, workflowId, stageName, requiredRoles)
   - `hitl.approved` : emis quand un stage est approuve (contient stageId, actorId, comment)
   - `hitl.rejected` : emis quand un stage est rejete (contient stageId, actorId, feedback)

8. **Types partages** -- nouvelles interfaces dans `packages/shared/src/types/orchestrator.ts` :
   - `HitlDecision` : decision d'approbation/rejet avec metadata
   - `HitlValidationRequest` : requete de validation emise par le systeme
   - `PendingValidation` : objet retourne par `listPendingValidations()`

### Ce que cette story ne fait PAS (scope)

- Pas de nouvelles routes API REST -- c'est ORCH-S04
- Pas de drift detection -- c'est DRIFT-S02
- Pas de compaction watcher -- c'est COMP-S01
- Pas de modification du graphe XState (les etats et transitions existent deja dans ORCH-S01)
- Pas de configuration UI des etapes HITL -- c'est ORCH-S05 (editeur workflow)
- Pas de notifications email/Slack -- WebSocket uniquement pour le MVP
- Pas de timeout automatique sur les validations en attente (P1 futur)
- Pas de delegation de validation (un validateur ne peut pas deleguer a un autre)
- Pas de validation multi-approbateurs (un seul validateur suffit)

---

## Architecture Technique

### Flux HITL -- Completion avec validation humaine

```
Agent complete une etape "Review"
       |
       v
[1] orchestrator.transitionStage(stageId, "complete", actor)
       |
       v
[2] enforcer.enforceTransition() -- verifie fichiers obligatoires
       |  (si echec -> 409 ENFORCEMENT_FAILED, fin)
       |
       v
[3] hitlService.shouldRequestValidation(stageId)
       |  -> lit WorkflowStageTemplateDef.hitlRequired
       |
       +-- hitlRequired === false -> [4a] transition normale "complete"
       |                              -> etat "completed"
       |                              -> maybeAdvanceNextStage()
       |
       +-- hitlRequired === true  -> [4b] intercepter "complete"
                                      -> emettre "request_validation"
                                      -> etat "validating"
                                      -> publishLiveEvent("hitl.validation_requested")
                                      -> WebSocket notifie les validateurs
```

### Flux HITL -- Approbation

```
Validateur (admin/manager) clique "Approuver"
       |
       v
[1] hitlService.approveStage(stageId, actor, comment?)
       |
       v
[2] orchestrator.transitionStage(stageId, "approve", actor)
       |  -> guard canManageWorkflow (permission workflows:enforce)
       |
       v
[3] XState: validating -> in_progress (clearFeedback, recordTransition)
       |
       v
[4] Persist hitlDecision: { decision: "approved", actorId, decidedAt, comment }
       |
       v
[5] publishLiveEvent("hitl.approved")
       |
       v
[6] Transition automatique "complete" -> etat "completed"
       |  (pas de re-verification HITL -- l'approbation == completion)
       |
       v
[7] maybeAdvanceNextStage()
```

### Flux HITL -- Rejet avec feedback

```
Validateur clique "Rejeter" + saisit feedback
       |
       v
[1] hitlService.rejectStage(stageId, actor, feedback)
       |
       v
[2] orchestrator.transitionStage(stageId, "reject_with_feedback", actor, { feedback })
       |  -> guard canManageWorkflow
       |
       v
[3] XState: validating -> in_progress (recordFeedback, recordTransition)
       |
       v
[4] Persist hitlDecision: { decision: "rejected", actorId, decidedAt, feedback }
       |
       v
[5] publishLiveEvent("hitl.rejected")
       |  -> payload inclut le feedback pour que l'UI puisse l'afficher
       |
       v
[6] Stage revient en "in_progress" AVEC feedback dans context
       |  -> L'agent peut lire stage.feedback et reagir
       |  -> Le feedback est aussi injecte dans les pre-prompts si l'agent redemarre
```

### Flux complet dans orchestrator.transitionStage()

```
1. Load stage from DB                 (existant, inchange)
2. RBAC pre-evaluation                (existant, inchange)
3. Enforcement check                  (existant, ORCH-S02)
4. >>> HITL interception <<<          (NOUVEAU - ORCH-S03)
   Si event == "complete" && hitlRequired:
     -> remplace event par "request_validation"
     -> persiste hitl metadata
     -> emet hitl.validation_requested
5. Build machine context              (existant, inchange)
6. XState transition evaluation       (existant, inchange)
7. Build transition record            (existant, inchange)
8. Persist to DB                      (existant + hitlDecision/hitlHistory)
9. Emit LiveEvent                     (existant + hitl events)
10. Update workflow state             (existant, inchange)
11. Auto-advance next stage           (existant, inchange)

Pour approve:
   Apres etape 8 (persist), enchainer:
   -> auto-complete (transitionStage("complete"))
   -> qui passe en "completed" (hitlRequired n'intercepte PAS quand on vient de validating)
   -> maybeAdvanceNextStage()
```

### Interaction avec ORCH-S02 (WorkflowEnforcer)

Le WorkflowEnforcer verifie les fichiers obligatoires pour les events `complete` et `request_validation`. L'interception HITL se fait **APRES** l'enforcement : si les fichiers manquent, l'agent recoit une erreur `ENFORCEMENT_FAILED` et ne peut pas passer en validation. Cela garantit que le validateur ne voit que des livrables complets.

### Interaction avec ORCH-S01 (State Machine)

Les transitions XState utilisees existent deja :
- `in_progress -> validating` via `request_validation` (pas de guard, tout acteur)
- `validating -> in_progress` via `approve` (guard `canManageWorkflow`)
- `validating -> in_progress` via `reject_with_feedback` (guard `canManageWorkflow`)

Aucune modification de la state machine n'est necessaire. Seule la logique d'interception dans `orchestrator.ts` et le nouveau service `hitl-validation.ts` sont ajoutes.

---

## Acceptance Criteria

### AC-01 : Interception automatique de completion HITL

**Given** un workflow template avec l'etape "Review" ayant `hitlRequired: true`
**When** l'agent emet l'event `complete` sur cette etape
**Then** l'orchestrateur intercepte et emet `request_validation` a la place, le stage passe en etat `validating`

### AC-02 : Pas d'interception si HITL non configure

**Given** un workflow template avec l'etape "Code" ayant `hitlRequired: false` (ou absent)
**When** l'agent emet l'event `complete` sur cette etape
**Then** la transition `complete` est executee normalement, le stage passe en `completed`

### AC-03 : Approbation par un validateur autorise

**Given** un stage en etat `validating`
**When** un utilisateur avec permission `workflows:enforce` et un role dans `hitlRoles` clique "Approuver"
**Then** le stage passe en `completed`, le feedback est nettoye, `hitlDecision` est persiste avec `decision: "approved"`, et le stage suivant est auto-avance

### AC-04 : Rejet avec feedback obligatoire

**Given** un stage en etat `validating`
**When** un utilisateur autorise clique "Rejeter" avec un feedback non-vide
**Then** le stage repasse en `in_progress` avec le feedback injecte dans `stage.feedback`, `hitlDecision` est persiste avec `decision: "rejected"` et le feedback texte

### AC-05 : Rejet sans feedback refuse

**Given** un stage en etat `validating`
**When** un utilisateur autorise tente de rejeter sans feedback (champ vide)
**Then** la requete est refusee avec un message d'erreur clair

### AC-06 : WebSocket notification sur validation_requested

**Given** un stage qui passe en `validating`
**When** l'interception HITL est declenchee
**Then** un `LiveEvent` de type `hitl.validation_requested` est emis avec `{ stageId, workflowInstanceId, stageName, hitlRoles }` et les utilisateurs connectes avec les bons roles recoivent la notification

### AC-07 : WebSocket notification sur approved/rejected

**Given** un stage en `validating`
**When** un validateur approuve ou rejette
**Then** un `LiveEvent` de type `hitl.approved` ou `hitl.rejected` est emis avec les metadata de la decision

### AC-08 : Enforcement AVANT HITL

**Given** un stage avec `hitlRequired: true` ET des fichiers obligatoires manquants
**When** l'agent emet `complete`
**Then** l'enforcement echoue avec `ENFORCEMENT_FAILED` AVANT que la transition `request_validation` ne soit tentee

### AC-09 : Liste des validations en attente

**Given** une company avec 3 stages en etat `validating`
**When** un admin/manager appelle `listPendingValidations(companyId)`
**Then** il recoit les 3 validations avec stageId, stageName, workflowName, requestedAt, requiredRoles

### AC-10 : Historique des decisions HITL

**Given** un stage qui a ete rejete 2 fois puis approuve
**When** on consulte `hitlHistory` du stage
**Then** on voit 3 entrees chronologiques : rejected, rejected, approved, avec actorId, timestamp et feedback pour chaque

### AC-11 : Banniere de validation dans le pipeline UI

**Given** un stage en etat `validating`
**When** un utilisateur avec le role requis consulte le workflow
**Then** une banniere d'alerte s'affiche avec le nom de l'etape, les outputs produits, et les boutons "Approuver" / "Rejeter"

### AC-12 : Panneau de validations en attente

**Given** des validations en attente pour la company
**When** l'utilisateur consulte le panneau de navigation
**Then** un badge numerique indique le nombre de validations en attente, et le panneau liste chaque validation avec un lien vers le workflow concerne

### AC-13 : Roles non-autorises ne voient pas les actions

**Given** un stage en etat `validating` avec `hitlRoles: ["admin", "manager"]`
**When** un `contributor` ou `viewer` consulte le workflow
**Then** la banniere de validation est affichee (lecture seule) mais les boutons "Approuver" / "Rejeter" sont absents du DOM

### AC-14 : Cycle rejet-correction-resoumission

**Given** un stage rejete avec feedback "Ajouter les tests unitaires"
**When** l'agent reprend le travail (stage en `in_progress` avec feedback)
**Then** le feedback est disponible dans `stage.feedback`, l'agent peut re-emettre `complete`, et le cycle HITL recommence

### AC-15 : Audit trail complet

**Given** chaque action HITL (validation_requested, approved, rejected)
**When** l'action est executee
**Then** un `transitionRecord` est ajoute a `transitionHistory` avec actorId, actorType, timestamp et metadata

---

## Data-test-id Mapping

### Backend (service + integration)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s03-hitl-interception` | Logic path in orchestrator | L'event `complete` est intercepte quand `hitlRequired: true` |
| `orch-s03-hitl-no-interception` | Logic path in orchestrator | L'event `complete` passe normalement quand `hitlRequired: false` |
| `orch-s03-hitl-approve` | Service method | `approveStage()` execute `approve` + auto-complete |
| `orch-s03-hitl-reject` | Service method | `rejectStage()` execute `reject_with_feedback` + persiste feedback |
| `orch-s03-hitl-reject-no-feedback` | Validation | Rejet refuse si feedback vide |
| `orch-s03-hitl-pending-list` | Service method | `listPendingValidations()` retourne les stages en `validating` |
| `orch-s03-hitl-history` | Service method | `getValidationHistory()` retourne l'historique |
| `orch-s03-hitl-decision-persist` | DB column | `hitlDecision` jsonb est ecrit apres approve/reject |
| `orch-s03-hitl-history-persist` | DB column | `hitlHistory` jsonb array accumule les decisions |
| `orch-s03-enforcement-before-hitl` | Logic order | Enforcement est verifie AVANT l'interception HITL |
| `orch-s03-ws-validation-requested` | WebSocket event | `hitl.validation_requested` emis sur interception |
| `orch-s03-ws-approved` | WebSocket event | `hitl.approved` emis sur approbation |
| `orch-s03-ws-rejected` | WebSocket event | `hitl.rejected` emis sur rejet |
| `orch-s03-auto-complete-after-approve` | Logic path | Apres approve, auto-transition vers `completed` |
| `orch-s03-auto-advance-after-approve` | Logic path | Apres approve+complete, `maybeAdvanceNextStage()` est appele |
| `orch-s03-feedback-injected` | Context | Feedback de rejet est disponible dans `stage.feedback` |
| `orch-s03-hitl-cycle` | Integration | Cycle complet rejet -> correction -> re-complete -> re-validation |

### Frontend (UI components)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s03-validation-banner` | `div` | Banniere d'alerte quand un stage est en `validating` |
| `orch-s03-validation-banner-stage-name` | `span` | Nom de l'etape en attente de validation |
| `orch-s03-validation-banner-requested-at` | `span` | Date/heure de la demande de validation |
| `orch-s03-validation-banner-requested-by` | `span` | Acteur ayant declenche la validation (agent ou systeme) |
| `orch-s03-approve-btn` | `button` | Bouton "Approuver" (visible seulement pour roles autorises) |
| `orch-s03-reject-btn` | `button` | Bouton "Rejeter" (visible seulement pour roles autorises) |
| `orch-s03-reject-dialog` | `dialog` | Modale de saisie du feedback de rejet |
| `orch-s03-reject-feedback-input` | `textarea` | Champ de saisie du feedback de rejet |
| `orch-s03-reject-confirm-btn` | `button` | Bouton de confirmation du rejet dans la modale |
| `orch-s03-reject-cancel-btn` | `button` | Bouton d'annulation dans la modale de rejet |
| `orch-s03-approve-comment-input` | `textarea` | Champ optionnel de commentaire pour l'approbation |
| `orch-s03-approve-dialog` | `dialog` | Modale de confirmation d'approbation |
| `orch-s03-approve-confirm-btn` | `button` | Bouton de confirmation d'approbation |
| `orch-s03-pending-validations-panel` | `div` | Panneau lateral listant les validations en attente |
| `orch-s03-pending-validations-badge` | `span` | Badge numerique sur l'icone de navigation |
| `orch-s03-pending-validations-count` | `span` | Nombre de validations en attente (texte) |
| `orch-s03-pending-validation-item` | `div` | Item individuel dans la liste des validations en attente |
| `orch-s03-pending-validation-stage-name` | `span` | Nom de l'etape dans l'item |
| `orch-s03-pending-validation-workflow-name` | `span` | Nom du workflow dans l'item |
| `orch-s03-pending-validation-requested-at` | `span` | Date de la demande dans l'item |
| `orch-s03-pending-validation-link` | `a` | Lien vers le workflow concerne |
| `orch-s03-validation-history` | `div` | Section historique des decisions HITL |
| `orch-s03-validation-history-item` | `div` | Item individuel dans l'historique |
| `orch-s03-validation-history-decision` | `span` | Decision (approved/rejected) dans l'historique |
| `orch-s03-validation-history-actor` | `span` | Validateur dans l'historique |
| `orch-s03-validation-history-date` | `span` | Date de la decision dans l'historique |
| `orch-s03-validation-history-feedback` | `p` | Feedback de rejet dans l'historique |
| `orch-s03-validation-readonly-banner` | `div` | Banniere en lecture seule pour les roles non-autorises |
| `orch-s03-output-artifacts-list` | `ul` | Liste des outputs produits affichee dans la banniere |
| `orch-s03-output-artifact-item` | `li` | Item de fichier output dans la banniere |

### Schema / Types (verification fichiers)

| data-testid | Element | Description |
|-------------|---------|-------------|
| `orch-s03-template-hitl-required` | Type field | `WorkflowStageTemplateDef.hitlRequired` boolean field |
| `orch-s03-template-hitl-roles` | Type field | `WorkflowStageTemplateDef.hitlRoles` string[] field |
| `orch-s03-type-hitl-decision` | Type | `HitlDecision` interface dans orchestrator.ts types |
| `orch-s03-type-hitl-validation-request` | Type | `HitlValidationRequest` interface |
| `orch-s03-type-pending-validation` | Type | `PendingValidation` interface |
| `orch-s03-column-hitl-decision` | DB column | `stage_instances.hitlDecision` jsonb |
| `orch-s03-column-hitl-history` | DB column | `stage_instances.hitlHistory` jsonb array |
| `orch-s03-live-event-validation-requested` | Constant | `hitl.validation_requested` dans LIVE_EVENT_TYPES |
| `orch-s03-live-event-approved` | Constant | `hitl.approved` dans LIVE_EVENT_TYPES |
| `orch-s03-live-event-rejected` | Constant | `hitl.rejected` dans LIVE_EVENT_TYPES |

---

## Cas de Test pour QA (Playwright E2E)

### T01 -- hitlRequired field exists in WorkflowStageTemplateDef
Verifier que `packages/db/src/schema/workflow_templates.ts` contient `hitlRequired?: boolean` dans le type `WorkflowStageTemplateDef`.

### T02 -- hitlRoles field exists in WorkflowStageTemplateDef
Verifier que `packages/db/src/schema/workflow_templates.ts` contient `hitlRoles?: string[]` dans le type `WorkflowStageTemplateDef`.

### T03 -- HitlDecision type defined
Verifier que `packages/shared/src/types/orchestrator.ts` exporte `HitlDecision` avec les champs : `decision`, `actorId`, `actorType`, `comment`, `feedback`, `decidedAt`.

### T04 -- HitlValidationRequest type defined
Verifier que `packages/shared/src/types/orchestrator.ts` exporte `HitlValidationRequest` avec les champs : `stageId`, `workflowInstanceId`, `stageName`, `workflowName`, `hitlRoles`, `requestedAt`, `requestedBy`.

### T05 -- PendingValidation type defined
Verifier que `packages/shared/src/types/orchestrator.ts` exporte `PendingValidation` avec les champs : `stageId`, `stageName`, `workflowInstanceId`, `workflowName`, `requestedAt`, `hitlRoles`, `outputArtifacts`.

### T06 -- hitlDecision column in stage_instances
Verifier que `packages/db/src/schema/stage_instances.ts` contient la colonne `hitlDecision` de type `jsonb`.

### T07 -- hitlHistory column in stage_instances
Verifier que `packages/db/src/schema/stage_instances.ts` contient la colonne `hitlHistory` de type `jsonb` avec type `HitlDecision[]`.

### T08 -- Migration adds hitlDecision and hitlHistory columns
Verifier qu'une migration Drizzle ajoute les colonnes `hitl_decision` et `hitl_history` a `stage_instances`.

### T09 -- LIVE_EVENT_TYPES includes HITL events
Verifier que `packages/shared/src/constants.ts` contient `hitl.validation_requested`, `hitl.approved`, `hitl.rejected` dans `LIVE_EVENT_TYPES`.

### T10 -- hitl-validation.ts service file exists
Verifier que `server/src/services/hitl-validation.ts` existe et exporte une fonction factory `hitlValidationService(db)`.

### T11 -- shouldRequestValidation returns true when hitlRequired
Verifier que `shouldRequestValidation()` retourne `true` quand le template de l'etape a `hitlRequired: true`.

### T12 -- shouldRequestValidation returns false when hitlRequired absent
Verifier que `shouldRequestValidation()` retourne `false` quand `hitlRequired` est absent ou `false`.

### T13 -- HITL interception in orchestrator.transitionStage
Verifier que `orchestrator.ts` appelle `shouldRequestValidation()` quand l'event est `complete`, et remplace par `request_validation` si HITL requis.

### T14 -- No HITL interception when hitlRequired is false
Verifier que `orchestrator.ts` ne modifie pas l'event `complete` quand `hitlRequired` est `false`.

### T15 -- approveStage transitions to completed
Verifier que `approveStage()` execute `approve` puis auto-complete pour passer en `completed`.

### T16 -- rejectStage requires non-empty feedback
Verifier que `rejectStage()` refuse si le feedback est vide ou absent.

### T17 -- rejectStage persists feedback in stage
Verifier que `rejectStage()` ecrit le feedback dans `stage.feedback` via la transition `reject_with_feedback`.

### T18 -- hitlDecision persisted on approve
Verifier que `hitlDecision` jsonb est ecrit avec `decision: "approved"`, `actorId`, `decidedAt` apres approbation.

### T19 -- hitlDecision persisted on reject
Verifier que `hitlDecision` jsonb est ecrit avec `decision: "rejected"`, `actorId`, `feedback`, `decidedAt` apres rejet.

### T20 -- hitlHistory accumulates decisions
Verifier que `hitlHistory` jsonb array contient toutes les decisions precedentes (rejects + final approve).

### T21 -- listPendingValidations returns validating stages
Verifier que `listPendingValidations(companyId)` retourne les stages en etat `validating` avec metadata.

### T22 -- listPendingValidations filters by companyId
Verifier que `listPendingValidations()` ne retourne pas les stages d'autres companies.

### T23 -- getValidationHistory returns ordered decisions
Verifier que `getValidationHistory(stageId)` retourne les decisions en ordre chronologique.

### T24 -- WebSocket event hitl.validation_requested emitted
Verifier que `publishLiveEvent` est appele avec type `hitl.validation_requested` quand un stage passe en `validating`.

### T25 -- WebSocket event hitl.approved emitted
Verifier que `publishLiveEvent` est appele avec type `hitl.approved` quand un stage est approuve.

### T26 -- WebSocket event hitl.rejected emitted
Verifier que `publishLiveEvent` est appele avec type `hitl.rejected` quand un stage est rejete.

### T27 -- Enforcement failure prevents HITL
Verifier que si l'enforcement echoue (fichiers manquants), l'interception HITL ne se declenche pas et l'erreur est `ENFORCEMENT_FAILED`.

### T28 -- Auto-advance after approve
Verifier que apres approbation, `maybeAdvanceNextStage()` est appele et le stage suivant est initialise.

### T29 -- Full HITL cycle (reject -> fix -> re-complete -> approve)
Verifier le cycle complet : `complete` -> `validating` -> `reject_with_feedback` -> `in_progress` (avec feedback) -> `complete` -> `validating` -> `approve` -> `completed`.

### T30 -- barrel export in services/index.ts
Verifier que `server/src/services/index.ts` exporte `hitlValidationService`.

### T31 -- types barrel export
Verifier que `packages/shared/src/index.ts` exporte `HitlDecision`, `HitlValidationRequest`, `PendingValidation`.

### T32 -- ValidationBanner component exists
Verifier que `ui/src/components/orchestrator/ValidationBanner.tsx` existe et utilise les data-testid `orch-s03-validation-banner`, `orch-s03-approve-btn`, `orch-s03-reject-btn`.

### T33 -- ValidationBanner shows stage name and artifacts
Verifier que `ValidationBanner` affiche le nom de l'etape (`orch-s03-validation-banner-stage-name`) et la liste des outputs (`orch-s03-output-artifacts-list`).

### T34 -- ValidationBanner approve button triggers approveStage
Verifier que le bouton `orch-s03-approve-btn` ouvre un dialogue de confirmation (`orch-s03-approve-dialog`) avec commentaire optionnel.

### T35 -- ValidationBanner reject button opens feedback dialog
Verifier que le bouton `orch-s03-reject-btn` ouvre la modale `orch-s03-reject-dialog` avec le champ `orch-s03-reject-feedback-input`.

### T36 -- Reject dialog requires feedback
Verifier que le bouton `orch-s03-reject-confirm-btn` est desactive quand `orch-s03-reject-feedback-input` est vide.

### T37 -- PendingValidationsPanel component exists
Verifier que `ui/src/components/orchestrator/PendingValidationsPanel.tsx` existe et utilise `orch-s03-pending-validations-panel`.

### T38 -- PendingValidationsPanel shows badge count
Verifier que `orch-s03-pending-validations-badge` affiche le nombre correct de validations.

### T39 -- PendingValidationsPanel lists items with links
Verifier que chaque item a `orch-s03-pending-validation-stage-name`, `orch-s03-pending-validation-workflow-name`, et `orch-s03-pending-validation-link`.

### T40 -- ValidationHistory component shows decisions
Verifier que `orch-s03-validation-history` affiche les items avec `orch-s03-validation-history-decision`, `orch-s03-validation-history-actor`, `orch-s03-validation-history-date`.

### T41 -- Readonly banner for non-authorized roles
Verifier que `orch-s03-validation-readonly-banner` s'affiche pour les roles non-autorises (contributor, viewer) et que `orch-s03-approve-btn` et `orch-s03-reject-btn` sont absents du DOM.

### T42 -- hitlRequired in existing template stages does not break backward compat
Verifier que les templates existants sans `hitlRequired` fonctionnent normalement (le champ est optionnel, defaut `false`).

---

## Notes Techniques

### 1. Strategie d'interception dans orchestrator.ts

L'interception HITL se fait dans `transitionStage()`, entre l'enforcement (etape 3) et la construction du contexte XState (etape 5). Le code ressemble a :

```typescript
// After enforcement check, before XState evaluation
if (event === "complete") {
  const needsHitl = await hitlService.shouldRequestValidation(stageId);
  if (needsHitl) {
    // Replace event with request_validation
    event = "request_validation";
    // Persist HITL metadata
    // Emit hitl.validation_requested
  }
}
```

Apres `approve`, l'orchestrateur enchaine automatiquement :
```typescript
if (event === "approve" && toState === "in_progress") {
  // HITL approved -> auto-complete the stage
  await transitionStage(stageId, "complete", {
    actorId: null, actorType: "system", companyId
  });
  // Note: shouldRequestValidation est smart -- il ne re-intercepte pas
  // si le stage vient d'etre approuve (verifie hitlDecision.decision === "approved")
}
```

### 2. Eviter la boucle infinie approve -> complete -> validating

Quand `approve` est execute et le stage passe a `in_progress`, l'auto-complete qui suit ne doit PAS re-declencher le HITL. Deux strategies possibles :

**Strategie A (recommandee)** : `shouldRequestValidation()` verifie si la derniere decision HITL est `approved`. Si oui, retourne `false`.

```typescript
async function shouldRequestValidation(stageId: string): Promise<boolean> {
  const stage = await loadStage(stageId);
  const template = await loadTemplateForStage(stage);
  if (!template.hitlRequired) return false;
  // If just approved, don't re-trigger HITL
  const lastDecision = stage.hitlDecision as HitlDecision | null;
  if (lastDecision?.decision === "approved") return false;
  return true;
}
```

**Strategie B** : passer un flag `skipHitl: true` dans le metadata du `complete` auto-declenche apres approve.

La strategie A est preferee car elle est stateless et auto-documentee.

### 3. Migration Drizzle

La migration ajoute 2 colonnes nullable a `stage_instances`. Pas de donnees a migrer. Le rollback est un simple `DROP COLUMN`.

```sql
-- up
ALTER TABLE stage_instances
  ADD COLUMN hitl_decision jsonb,
  ADD COLUMN hitl_history jsonb DEFAULT '[]'::jsonb;

-- down
ALTER TABLE stage_instances
  DROP COLUMN hitl_decision,
  DROP COLUMN hitl_history;
```

### 4. Structure HitlDecision

```typescript
export interface HitlDecision {
  decision: "approved" | "rejected";
  actorId: string;
  actorType: "user" | "agent" | "system";
  comment?: string;    // commentaire optionnel (approve)
  feedback?: string;   // feedback obligatoire (reject)
  decidedAt: string;   // ISO 8601
}
```

### 5. Structure HitlValidationRequest

```typescript
export interface HitlValidationRequest {
  stageId: string;
  workflowInstanceId: string;
  stageName: string;
  workflowName: string;
  hitlRoles: string[];
  requestedAt: string;     // ISO 8601
  requestedBy: {
    actorId: string | null;
    actorType: "user" | "agent" | "system";
  };
  outputArtifacts: string[];
}
```

### 6. Structure PendingValidation

```typescript
export interface PendingValidation {
  stageId: string;
  stageName: string;
  workflowInstanceId: string;
  workflowName: string;
  requestedAt: string;     // ISO 8601
  hitlRoles: string[];
  outputArtifacts: string[];
  hitlHistory: HitlDecision[];
  rejectCount: number;
}
```

### 7. Extension WorkflowStageTemplateDef

```typescript
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
  // ORCH-S03: HITL fields
  hitlRequired?: boolean;
  hitlRoles?: string[];
};
```

### 8. Fichiers a creer/modifier

| Fichier | Action | Lignes estimees |
|---------|--------|----------------|
| `server/src/services/hitl-validation.ts` | CREER | ~250 lignes |
| `server/src/services/orchestrator.ts` | MODIFIER | +30 lignes (interception + auto-complete) |
| `packages/db/src/schema/workflow_templates.ts` | MODIFIER | +2 lignes (hitlRequired, hitlRoles) |
| `packages/db/src/schema/stage_instances.ts` | MODIFIER | +2 lignes (hitlDecision, hitlHistory) |
| `packages/shared/src/types/orchestrator.ts` | MODIFIER | +30 lignes (3 interfaces) |
| `packages/shared/src/constants.ts` | MODIFIER | +3 lignes (3 LiveEventTypes) |
| `packages/shared/src/index.ts` | MODIFIER | +3 lignes (exports) |
| `server/src/services/index.ts` | MODIFIER | +1 ligne (export) |
| `ui/src/components/orchestrator/ValidationBanner.tsx` | CREER | ~200 lignes |
| `ui/src/components/orchestrator/PendingValidationsPanel.tsx` | CREER | ~150 lignes |
| `ui/src/components/orchestrator/ValidationHistory.tsx` | CREER | ~100 lignes |
| Migration Drizzle | CREER | ~10 lignes SQL |

### 9. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Boucle infinie approve -> complete -> validating | Bloquant | Strategie A : `shouldRequestValidation` verifie `hitlDecision.decision` |
| Race condition : 2 validateurs approuvent simultanement | Mineur | La 2e transition `approve` echoue car le stage n'est plus en `validating` |
| Stage en `validating` indefiniment (pas de timeout) | Moyen | P1 futur. Pour le MVP, pas de timeout. Le panneau de validations en attente donne la visibilite |
| Performance : `listPendingValidations` sur grande company | Faible | L'index `stage_instances_machine_state_idx` sur `(companyId, machineState)` existe deja |

### 10. Definition of Done

- [ ] Service `hitl-validation.ts` avec les 6 fonctions
- [ ] Interception dans `orchestrator.ts` (event `complete` -> `request_validation` si HITL)
- [ ] Auto-complete apres `approve` sans boucle infinie
- [ ] 2 nouvelles colonnes dans `stage_instances` + migration
- [ ] 2 nouveaux champs dans `WorkflowStageTemplateDef`
- [ ] 3 nouvelles interfaces dans types orchestrator
- [ ] 3 nouveaux `LiveEventType`
- [ ] Composant `ValidationBanner.tsx` avec approve/reject
- [ ] Composant `PendingValidationsPanel.tsx` avec badge
- [ ] Composant `ValidationHistory.tsx`
- [ ] Tous les data-testid implementes
- [ ] Tests unitaires du service
- [ ] Tests E2E Playwright
- [ ] `pnpm typecheck` passe
- [ ] Backward-compatible (templates sans `hitlRequired` fonctionnent)
