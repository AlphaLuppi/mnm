# DUAL-S01 — Table automation_cursors + Service

> **Epic** : DUAL — Dual-Speed Workflow (Noyau E)
> **Sprint** : Batch 11
> **Assignation** : Cofondateur
> **Effort** : M (5 SP, 3-4j)
> **Bloqué par** : RBAC-S01 (DONE), PROJ-S01 (DONE)
> **Débloque** : DUAL-S02, DUAL-S03

---

## Contexte

Le Dual-Speed Workflow permet aux utilisateurs de configurer un **curseur d'automatisation** à 3 positions (Manuel / Assisté / Auto) sur 4 niveaux de granularité (action / agent / projet / company). Un plafond hiérarchique impose que le niveau d'un rôle inférieur ne peut jamais dépasser celui d'un rôle supérieur (CEO > CTO/Manager > Contributeur > Viewer).

La table `automation_cursors` existe déjà dans le schéma DB (TECH-06). Cette story implémente le **service backend complet** et les **routes API** pour le CRUD des curseurs avec la logique de plafonnement hiérarchique.

---

## Acceptance Criteria (Given/When/Then)

### AC-01: Get effective cursor position
- **Given** un Manager qui a positionné le curseur à "Assisté" au niveau company
- **And** un Contributor qui a positionné son curseur à "Auto" au niveau agent
- **When** le système évalue le curseur effectif pour le Contributor
- **Then** le curseur effectif = "assisted" (plafonné par le Manager supérieur)

### AC-02: Set cursor position
- **Given** un utilisateur avec le rôle Manager
- **When** il appelle PUT /companies/:companyId/automation-cursors
- **Then** le curseur est créé/mis à jour pour le level et targetId donnés
- **And** un audit event "automation_cursor.updated" est émis

### AC-03: Get cursor by level
- **Given** un utilisateur authentifié
- **When** il appelle GET /companies/:companyId/automation-cursors?level=agent&targetId=xxx
- **Then** le curseur correspondant est retourné avec sa position et son ceiling

### AC-04: List cursors for company
- **Given** un Admin
- **When** il appelle GET /companies/:companyId/automation-cursors
- **Then** tous les curseurs de la company sont retournés

### AC-05: Hierarchy ceiling enforcement
- **Given** un Admin avec un curseur company à "assisted"
- **And** un Contributor qui tente de définir son curseur à "auto"
- **When** l'évaluation effective est calculée
- **Then** le curseur effectif est "assisted" (plafonné)

### AC-06: Delete cursor
- **Given** un Admin
- **When** il appelle DELETE /companies/:companyId/automation-cursors/:cursorId
- **Then** le curseur est supprimé
- **And** un audit event "automation_cursor.deleted" est émis

### AC-07: Cursor position values
- **Given** le système
- **Then** les positions valides sont exactement: "manual", "assisted", "auto"
- **And** les niveaux valides sont exactement: "action", "agent", "project", "company"

### AC-08: Permission check
- **Given** un Viewer (sans permission workflows.manage)
- **When** il tente PUT sur un curseur
- **Then** il reçoit 403 Forbidden
- **And** un audit event "access.denied" est émis

### AC-09: Resolve effective cursor
- **Given** des curseurs à plusieurs niveaux (company, project, agent)
- **When** le service résout le curseur effectif pour un agent dans un projet
- **Then** le curseur retourné est le min() des positions de la hiérarchie
- **And** l'ordre est: manual < assisted < auto

### AC-10: Audit trail
- **Given** toute mutation sur un curseur
- **When** elle est exécutée
- **Then** un audit_event est émis avec action, actorId, targetId, metadata

### AC-11: Company isolation via RLS
- **Given** un curseur créé par la company A
- **When** un utilisateur de la company B requête les curseurs
- **Then** le curseur de la company A n'est PAS visible (garanti par RLS)

### AC-12: Unique constraint enforcement
- **Given** un curseur existant pour (companyId, level, targetId)
- **When** un utilisateur tente de créer un doublon
- **Then** la requête effectue un upsert (met à jour l'existant)

---

## Deliverables

### D1 — Shared Types (`packages/shared/src/types/automation-cursor.ts`)

Types TypeScript pour les curseurs:

```typescript
// Cursor position (3 values)
export type AutomationCursorPosition = "manual" | "assisted" | "auto";

// Cursor level (4 values)
export type AutomationCursorLevel = "action" | "agent" | "project" | "company";

// Cursor record
export interface AutomationCursor {
  id: string;
  companyId: string;
  level: AutomationCursorLevel;
  targetId: string | null;
  position: AutomationCursorPosition;
  ceiling: AutomationCursorPosition;
  setByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Effective cursor resolution result
export interface EffectiveCursor {
  position: AutomationCursorPosition;
  ceiling: AutomationCursorPosition;
  resolvedFrom: AutomationCursorLevel;
  hierarchy: Array<{
    level: AutomationCursorLevel;
    position: AutomationCursorPosition;
    ceiling: AutomationCursorPosition;
  }>;
}
```

Constants:

```typescript
export const AUTOMATION_CURSOR_POSITIONS = ["manual", "assisted", "auto"] as const;
export const AUTOMATION_CURSOR_LEVELS = ["action", "agent", "project", "company"] as const;
```

### D2 — Shared Validators (`packages/shared/src/validators/automation-cursor.ts`)

Zod schemas for API input validation:

```typescript
export const setCursorSchema = z.object({
  level: z.enum(AUTOMATION_CURSOR_LEVELS),
  targetId: z.string().uuid().nullable().optional(),
  position: z.enum(AUTOMATION_CURSOR_POSITIONS),
  ceiling: z.enum(AUTOMATION_CURSOR_POSITIONS).optional(),
});

export const cursorFiltersSchema = z.object({
  level: z.enum(AUTOMATION_CURSOR_LEVELS).optional(),
  targetId: z.string().uuid().optional(),
});

export const resolveCursorSchema = z.object({
  level: z.enum(AUTOMATION_CURSOR_LEVELS),
  targetId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});
```

### D3 — Service (`server/src/services/automation-cursors.ts`)

Service with the following functions:

| Function | Description |
|----------|-------------|
| `setCursor(companyId, input, userId)` | Create or upsert a cursor |
| `getCursors(companyId, filters?)` | List cursors for a company with optional level/targetId filter |
| `getCursorById(companyId, cursorId)` | Get a single cursor |
| `deleteCursor(companyId, cursorId)` | Delete a cursor |
| `resolveEffective(companyId, opts)` | Resolve effective cursor position with hierarchy ceiling |
| `getPositionValue(position)` | Convert position to numeric (manual=0, assisted=1, auto=2) |
| `minPosition(a, b)` | Return the more restrictive of two positions |

Hierarchy ceiling logic:
- Company-level cursor applies to everything below
- Project-level cursor applies to agents/actions in that project
- Agent-level cursor applies to actions of that agent
- Effective position = min(all applicable levels)
- min uses: manual(0) < assisted(1) < auto(2)

### D4 — Routes (`server/src/routes/automation-cursors.ts`)

5 routes:

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/companies/:companyId/automation-cursors` | `workflows:manage` | List cursors |
| GET | `/companies/:companyId/automation-cursors/:cursorId` | `workflows:manage` | Get cursor by ID |
| PUT | `/companies/:companyId/automation-cursors` | `workflows:manage` | Set (upsert) cursor |
| DELETE | `/companies/:companyId/automation-cursors/:cursorId` | `workflows:manage` | Delete cursor |
| POST | `/companies/:companyId/automation-cursors/resolve` | `workflows:manage` | Resolve effective cursor |

### D5 — Barrel Exports

- `server/src/services/index.ts` — export `automationCursorService`
- `server/src/routes/index.ts` — export `automationCursorRoutes`
- `packages/shared/src/types/index.ts` — export types & constants
- `packages/shared/src/validators/index.ts` — export validators
- `packages/shared/src/index.ts` — re-export from types and validators
- `server/src/app.ts` — import and mount routes

---

## data-testid Mapping

| Element | data-testid |
|---------|-------------|
| Cursor list container | `data-testid="dual-s01-cursor-list"` |
| Cursor item row | `data-testid="dual-s01-cursor-item"` |
| Position display | `data-testid="dual-s01-position"` |
| Level display | `data-testid="dual-s01-level"` |
| Ceiling display | `data-testid="dual-s01-ceiling"` |
| Set cursor form | `data-testid="dual-s01-set-form"` |
| Position selector | `data-testid="dual-s01-position-selector"` |
| Level selector | `data-testid="dual-s01-level-selector"` |
| Target ID input | `data-testid="dual-s01-target-id"` |
| Save button | `data-testid="dual-s01-save-btn"` |
| Delete button | `data-testid="dual-s01-delete-btn"` |
| Effective cursor badge | `data-testid="dual-s01-effective-badge"` |
| Hierarchy chain | `data-testid="dual-s01-hierarchy-chain"` |
| Resolve result | `data-testid="dual-s01-resolve-result"` |

---

## Test Cases (file-content based)

### Service tests (T01–T15)

| ID | Description | Target file |
|----|-------------|-------------|
| T01 | Service exports automationCursorService function | services/automation-cursors.ts |
| T02 | Service has setCursor method | services/automation-cursors.ts |
| T03 | Service has getCursors method | services/automation-cursors.ts |
| T04 | Service has getCursorById method | services/automation-cursors.ts |
| T05 | Service has deleteCursor method | services/automation-cursors.ts |
| T06 | Service has resolveEffective method | services/automation-cursors.ts |
| T07 | Service has getPositionValue helper | services/automation-cursors.ts |
| T08 | Service has minPosition helper | services/automation-cursors.ts |
| T09 | Service imports automationCursors from @mnm/db | services/automation-cursors.ts |
| T10 | Service imports auditService for audit emission | services/automation-cursors.ts |
| T11 | setCursor uses upsert (onConflictDoUpdate) | services/automation-cursors.ts |
| T12 | resolveEffective queries all hierarchy levels | services/automation-cursors.ts |
| T13 | getPositionValue maps manual=0, assisted=1, auto=2 | services/automation-cursors.ts |
| T14 | minPosition returns more restrictive position | services/automation-cursors.ts |
| T15 | Service emits audit event on setCursor | services/automation-cursors.ts |

### Route tests (T16–T25)

| ID | Description | Target file |
|----|-------------|-------------|
| T16 | Route file exports automationCursorRoutes function | routes/automation-cursors.ts |
| T17 | GET /companies/:companyId/automation-cursors route exists | routes/automation-cursors.ts |
| T18 | GET /companies/:companyId/automation-cursors/:cursorId route | routes/automation-cursors.ts |
| T19 | PUT /companies/:companyId/automation-cursors route exists | routes/automation-cursors.ts |
| T20 | DELETE /companies/:companyId/automation-cursors/:cursorId route | routes/automation-cursors.ts |
| T21 | POST /companies/:companyId/automation-cursors/resolve route | routes/automation-cursors.ts |
| T22 | All routes use requirePermission("workflows:manage") | routes/automation-cursors.ts |
| T23 | PUT route uses validate(setCursorSchema) | routes/automation-cursors.ts |
| T24 | POST resolve uses validate(resolveCursorSchema) | routes/automation-cursors.ts |
| T25 | Routes use emitAudit for mutations | routes/automation-cursors.ts |

### Types tests (T26–T32)

| ID | Description | Target file |
|----|-------------|-------------|
| T26 | Types file exports AutomationCursor interface | types/automation-cursor.ts |
| T27 | Types file exports EffectiveCursor interface | types/automation-cursor.ts |
| T28 | Types file exports AutomationCursorPosition type | types/automation-cursor.ts |
| T29 | Types file exports AutomationCursorLevel type | types/automation-cursor.ts |
| T30 | Types file exports AUTOMATION_CURSOR_POSITIONS constant | types/automation-cursor.ts |
| T31 | Types file exports AUTOMATION_CURSOR_LEVELS constant | types/automation-cursor.ts |
| T32 | AUTOMATION_CURSOR_POSITIONS = ["manual","assisted","auto"] | types/automation-cursor.ts |

### Validators tests (T33–T37)

| ID | Description | Target file |
|----|-------------|-------------|
| T33 | Validators file exports setCursorSchema | validators/automation-cursor.ts |
| T34 | Validators file exports cursorFiltersSchema | validators/automation-cursor.ts |
| T35 | Validators file exports resolveCursorSchema | validators/automation-cursor.ts |
| T36 | setCursorSchema validates position enum | validators/automation-cursor.ts |
| T37 | resolveCursorSchema validates level enum | validators/automation-cursor.ts |

### Barrel exports tests (T38–T45)

| ID | Description | Target file |
|----|-------------|-------------|
| T38 | services/index.ts exports automationCursorService | services/index.ts |
| T39 | routes/index.ts exports automationCursorRoutes | routes/index.ts |
| T40 | types/index.ts re-exports AutomationCursor | types/index.ts |
| T41 | types/index.ts re-exports AUTOMATION_CURSOR_POSITIONS | types/index.ts |
| T42 | validators/index.ts re-exports setCursorSchema | validators/index.ts |
| T43 | shared/index.ts re-exports AutomationCursor | shared/index.ts |
| T44 | shared/index.ts re-exports setCursorSchema | shared/index.ts |
| T45 | app.ts mounts automationCursorRoutes | app.ts |

### Schema tests (T46–T50)

| ID | Description | Target file |
|----|-------------|-------------|
| T46 | automation_cursors schema has id, companyId, level, position | schema/automation_cursors.ts |
| T47 | automation_cursors schema has ceiling field | schema/automation_cursors.ts |
| T48 | automation_cursors schema has setByUserId field | schema/automation_cursors.ts |
| T49 | automation_cursors schema has unique index on company+level+target | schema/automation_cursors.ts |
| T50 | schema/index.ts exports automationCursors | schema/index.ts |

---

## Notes techniques

- La table `automation_cursors` existe déjà (TECH-06), pas besoin de migration
- Le service suit le même pattern factory que `projectMembershipService(db)`
- Les routes suivent le pattern de `compactionRoutes(db)`
- Le `requirePermission` utilise la permission key `workflows:manage` existante (RBAC-S02)
- L'upsert utilise `onConflictDoUpdate` de Drizzle sur l'index unique (companyId, level, targetId)
- L'audit utilise `emitAudit` déjà en place (OBS-S02)
