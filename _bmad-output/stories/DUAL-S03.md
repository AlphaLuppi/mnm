# DUAL-S03 — Enforcement Curseur dans Workflow

> **Epic** : DUAL — Dual-Speed Workflow (Noyau E)
> **Sprint** : Batch 12
> **Assignation** : Cofondateur
> **Effort** : S (2 SP, 1-2j)
> **Bloque par** : ORCH-S01 (DONE)
> **Dependances** : DUAL-S01 (DONE), ORCH-S01 (DONE), ORCH-S02 (DONE), ORCH-S03 (DONE)

---

## Contexte

Le systeme de curseurs d'automatisation (DUAL-S01) definit 3 positions : **manual**, **assisted**, **auto** — appliquees a 4 niveaux hierarchiques (company > project > agent > action) avec plafonnement par la hierarchie.

L'orchestrateur (ORCH-S01) gere les transitions d'etapes via une state machine XState. Le WorkflowEnforcer (ORCH-S02) valide les fichiers obligatoires. Le systeme HITL (ORCH-S03) intercepte les completions pour demander une validation humaine.

**DUAL-S03** integre le curseur d'automatisation dans le flux de l'orchestrateur : avant chaque transition declenchee par un agent, le systeme resout le curseur effectif et applique les restrictions suivantes :

| Position | Comportement |
|----------|-------------|
| **manual** | L'agent ne peut PAS avancer automatiquement. Toute transition agent est bloquee. Seul un utilisateur humain peut declencher la transition. |
| **assisted** | L'agent peut demander la transition, mais elle est interceptee et redirigee vers HITL (validation humaine requise avant execution). |
| **auto** | L'agent est libre. Aucune restriction supplementaire (comportement actuel). |

Le curseur est resolu par `automationCursorService.resolveEffective()` en tenant compte du companyId, du projectId (si disponible via le workflow), et de l'agentId (si disponible via le stage).

---

## Acceptance Criteria (Given/When/Then)

### AC-01: Cursor enforcement bloque agent en mode manual
- **Given** un curseur effectif en position "manual" pour l'agent
- **When** l'agent (actorType="agent") tente une transition (ex: "start", "complete")
- **Then** la transition est refusee avec une erreur CURSOR_ENFORCEMENT_BLOCKED
- **And** un audit event "cursor_enforcement.blocked" est emis

### AC-02: Cursor enforcement redirige vers HITL en mode assisted
- **Given** un curseur effectif en position "assisted" pour l'agent
- **When** l'agent tente une transition "complete"
- **Then** la transition est interceptee et redirigee vers "request_validation" (HITL)
- **And** un audit event "cursor_enforcement.hitl_required" est emis

### AC-03: Mode auto ne bloque pas
- **Given** un curseur effectif en position "auto" (ou aucun curseur configure)
- **When** l'agent tente une transition
- **Then** la transition s'execute normalement (aucune interference)

### AC-04: Les transitions humaines ne sont jamais bloquees
- **Given** un curseur effectif en position "manual"
- **When** un utilisateur (actorType="user") declenche une transition
- **Then** la transition s'execute normalement
- **And** le curseur ne bloque que les acteurs de type "agent"

### AC-05: Les transitions systeme ne sont jamais bloquees
- **Given** un curseur effectif en position "manual"
- **When** le systeme (actorType="system") declenche une transition interne
- **Then** la transition s'execute normalement

### AC-06: Cursor resolution utilise le contexte du stage
- **Given** un stage avec un agentId et un projectId (via workflowInstance)
- **When** le curseur est resolu
- **Then** la resolution utilise le companyId + projectId + agentId pour la hierarchie

### AC-07: Service cursor-enforcement expose une methode enforceCursor
- **Given** le module `server/src/services/cursor-enforcement.ts`
- **When** il est importe
- **Then** il exporte une fonction `cursorEnforcementService(db)` qui retourne `{ enforceCursor }`

### AC-08: Integration dans orchestrator.ts
- **Given** le service orchestrateur `transitionStage`
- **When** l'acteur est un agent (actorType="agent")
- **Then** le cursor enforcement est evalue APRES l'enforcement ORCH-S02 et AVANT HITL ORCH-S03
- **And** si bloque, la transition est refusee avant d'atteindre XState

### AC-09: LiveEvent emis pour cursor enforcement
- **Given** un cursor enforcement qui bloque ou redirige une transition
- **When** l'enforcement est evalue
- **Then** un LiveEvent de type "cursor_enforcement.blocked" ou "cursor_enforcement.hitl_required" est publie

### AC-10: Types partages pour CursorEnforcementResult
- **Given** le module `packages/shared/src/types/automation-cursor.ts`
- **When** il est importe
- **Then** il exporte le type `CursorEnforcementResult` avec `{ allowed, position, reason?, redirectToHitl? }`

---

## Deliverables

### D-01: `server/src/services/cursor-enforcement.ts` (nouveau)
Service qui encapsule la logique d'enforcement du curseur :
- `enforceCursor(stageId, event, actor)` : resout le curseur effectif puis evalue les restrictions
- Utilise `automationCursorService.resolveEffective()` pour obtenir la position effective
- Charge le stage pour extraire companyId, agentId, projectId
- Emet des LiveEvents et des audit events

### D-02: `server/src/services/orchestrator.ts` (modifie)
Integration dans `transitionStage()` :
- Import du `cursorEnforcementService`
- Appel a `enforceCursor()` apres enforcement ORCH-S02 et avant interception HITL ORCH-S03
- Gestion du `redirectToHitl` (remplace l'evenement par "request_validation")

### D-03: `packages/shared/src/types/automation-cursor.ts` (modifie)
Ajout du type `CursorEnforcementResult` :
```typescript
export interface CursorEnforcementResult {
  allowed: boolean;
  position: AutomationCursorPosition;
  reason?: string;
  redirectToHitl?: boolean;
  effectiveCursor: EffectiveCursor;
}
```

### D-04: `server/src/services/index.ts` (modifie)
Ajout barrel export : `export { cursorEnforcementService } from "./cursor-enforcement.js";`

### D-05: `packages/shared/src/types/index.ts` (modifie)
Ajout re-export de `CursorEnforcementResult`

---

## data-testid Mapping

| data-testid | Element | Fichier |
|------------|---------|---------|
| `dual-s03-enforce-cursor-fn` | function enforceCursor | cursor-enforcement.ts |
| `dual-s03-resolve-effective-call` | resolveEffective() call | cursor-enforcement.ts |
| `dual-s03-manual-block` | manual position blocking logic | cursor-enforcement.ts |
| `dual-s03-assisted-hitl-redirect` | assisted position HITL redirect | cursor-enforcement.ts |
| `dual-s03-auto-allow` | auto position allow logic | cursor-enforcement.ts |
| `dual-s03-agent-only-guard` | actorType === "agent" check | cursor-enforcement.ts |
| `dual-s03-audit-emit` | audit event emission | cursor-enforcement.ts |
| `dual-s03-live-event-blocked` | LiveEvent cursor_enforcement.blocked | cursor-enforcement.ts |
| `dual-s03-live-event-hitl` | LiveEvent cursor_enforcement.hitl_required | cursor-enforcement.ts |
| `dual-s03-orchestrator-integration` | enforceCursor call in orchestrator | orchestrator.ts |
| `dual-s03-cursor-enforcement-result-type` | CursorEnforcementResult type | automation-cursor.ts |
| `dual-s03-barrel-svc` | barrel export in services/index.ts | services/index.ts |

---

## Test Cases (file-content based)

| ID | Scope | Description | Fichier cible |
|----|-------|-------------|---------------|
| T01 | Service | cursorEnforcementService function export | cursor-enforcement.ts |
| T02 | Service | enforceCursor async function exists | cursor-enforcement.ts |
| T03 | Service | imports automationCursorService | cursor-enforcement.ts |
| T04 | Service | imports stageInstances from @mnm/db | cursor-enforcement.ts |
| T05 | Service | imports workflowInstances from @mnm/db | cursor-enforcement.ts |
| T06 | Service | calls resolveEffective with companyId | cursor-enforcement.ts |
| T07 | Service | checks actorType === "agent" guard | cursor-enforcement.ts |
| T08 | Service | returns allowed:true for non-agent actors | cursor-enforcement.ts |
| T09 | Service | returns allowed:false + reason for manual position | cursor-enforcement.ts |
| T10 | Service | returns redirectToHitl:true for assisted position | cursor-enforcement.ts |
| T11 | Service | returns allowed:true for auto position | cursor-enforcement.ts |
| T12 | Service | emits cursor_enforcement.blocked LiveEvent | cursor-enforcement.ts |
| T13 | Service | emits cursor_enforcement.hitl_required LiveEvent | cursor-enforcement.ts |
| T14 | Service | calls auditService.emit for blocked transitions | cursor-enforcement.ts |
| T15 | Service | loads stage from DB using stageInstances | cursor-enforcement.ts |
| T16 | Service | loads workflow from DB for projectId | cursor-enforcement.ts |
| T17 | Service | passes agentId from stage to resolveEffective | cursor-enforcement.ts |
| T18 | Service | passes projectId from workflow to resolveEffective | cursor-enforcement.ts |
| T19 | Service | returns effectiveCursor in result | cursor-enforcement.ts |
| T20 | Service | handles missing stage (returns allowed:true) | cursor-enforcement.ts |
| T21 | Orchestrator | imports cursorEnforcementService | orchestrator.ts |
| T22 | Orchestrator | calls enforceCursor in transitionStage | orchestrator.ts |
| T23 | Orchestrator | enforceCursor call is AFTER enforcement check | orchestrator.ts |
| T24 | Orchestrator | enforceCursor call is BEFORE HITL interception | orchestrator.ts |
| T25 | Orchestrator | handles CursorEnforcementResult.allowed === false | orchestrator.ts |
| T26 | Orchestrator | handles redirectToHitl by replacing event | orchestrator.ts |
| T27 | Orchestrator | throws conflict with CURSOR_ENFORCEMENT_BLOCKED | orchestrator.ts |
| T28 | Orchestrator | only enforces cursor for agent actors | orchestrator.ts |
| T29 | Types | CursorEnforcementResult interface exists | automation-cursor.ts |
| T30 | Types | CursorEnforcementResult has allowed: boolean | automation-cursor.ts |
| T31 | Types | CursorEnforcementResult has position field | automation-cursor.ts |
| T32 | Types | CursorEnforcementResult has reason optional | automation-cursor.ts |
| T33 | Types | CursorEnforcementResult has redirectToHitl optional | automation-cursor.ts |
| T34 | Types | CursorEnforcementResult has effectiveCursor field | automation-cursor.ts |
| T35 | Barrel | services/index.ts exports cursorEnforcementService | services/index.ts |
| T36 | Barrel | types/index.ts re-exports CursorEnforcementResult | types/index.ts |
| T37 | Barrel | shared/src/index.ts re-exports CursorEnforcementResult | shared/src/index.ts |
| T38 | Service | default position is "assisted" when no cursors found | cursor-enforcement.ts |
| T39 | Service | system actor bypasses cursor enforcement | cursor-enforcement.ts |
| T40 | Regression | ORCH-S01 transitionStage function still exists | orchestrator.ts |
| T41 | Regression | ORCH-S02 enforceTransition call still present | orchestrator.ts |
| T42 | Regression | ORCH-S03 HITL interception still present | orchestrator.ts |
| T43 | Regression | ORCH-S04 routes still functional (import pattern) | orchestrator.ts |
| T44 | Regression | DUAL-S01 resolveEffective function exists | automation-cursors.ts |
| T45 | Regression | DUAL-S01 setCursor function exists | automation-cursors.ts |

---

## Notes techniques

### Ordre d'execution dans `transitionStage()`

```
1. Load stage from DB
2. RBAC guard (existing)
3. ORCH-S02: WorkflowEnforcer.enforceTransition()
4. >>> DUAL-S03: cursorEnforcement.enforceCursor() <<<    [NEW]
5. ORCH-S03: HITL interception (shouldRequestValidation)
6. XState state machine evaluation
7. Persist to DB
8. Emit LiveEvent
```

Le cursor enforcement s'insere entre l'enforcement des fichiers (ORCH-S02) et l'interception HITL (ORCH-S03). Cela permet :
- De bloquer AVANT tout traitement couteux (HITL, XState)
- De rediriger vers HITL sans dupliquer la logique HITL existante

### Resolution du projectId

Le `projectId` n'est pas directement sur le `stageInstances`. Il est obtenu via `workflowInstances.projectId` (si le workflow est associe a un projet). Le service charge le workflow parent pour obtenir cette information.

### Default behavior

Si aucun curseur n'est configure, `resolveEffective` retourne `position: "assisted"` par defaut. Cela signifie qu'en l'absence de configuration, les transitions agent passeront par HITL — un comportement securitaire par defaut.
