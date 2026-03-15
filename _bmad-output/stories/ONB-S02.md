# ONB-S02 — Cascade Hiérarchique

> **Epic** : ONB — Onboarding Cascade (Noyau C)
> **Sprint** : Batch 14
> **Assignation** : Tom (backend)
> **Effort** : S (2 SP, 1-2j)
> **Bloqué par** : ONB-S01 (onboarding CEO wizard), RBAC-S01 (hasPermission scope fix), RBAC-S03 (businessRole migration), MU-S01 (API invitations email)
> **Débloque** : —
> **ADR** : ADR-002 (RBAC + scope)

---

## Contexte

Quand le CEO termine l'onboarding (ONB-S01) et invite des managers, ces managers doivent pouvoir à leur tour inviter des contributors dans leur périmètre. La **cascade hiérarchique** signifie :

1. **Un rôle ne peut inviter qu'un rôle inférieur ou égal** — Un admin peut inviter admin/manager/contributor/viewer. Un manager peut inviter contributor/viewer. Un contributor et un viewer ne peuvent inviter personne.
2. **Les permissions cascadent dans la hiérarchie** — Quand un manager invite un contributor, le contributor reçoit automatiquement les permissions preset de son rôle, scopées au même périmètre de projets que le manager (ou plus restreint).
3. **Plafond hiérarchique** — Un inviteur ne peut jamais accorder plus de permissions que celles qu'il possède lui-même.
4. **Audit trail** — Chaque invitation cascade est tracée avec l'identité de l'inviteur et la chaîne de cascade (qui a invité qui).

### Hiérarchie des BusinessRoles

```
admin (level 0)     — peut inviter : admin, manager, contributor, viewer
manager (level 1)   — peut inviter : manager, contributor, viewer
contributor (level 2) — ne peut pas inviter
viewer (level 3)    — ne peut pas inviter
```

### Règles de cascade des permissions

1. L'inviteur A (businessRole = manager, scope = { projectIds: ["proj-1", "proj-2"] }) invite B avec role = contributor
2. B reçoit les permissions preset de "contributor" (agents:launch, tasks:assign, stories:create, stories:edit, chat:agent)
3. B hérite du scope de A, restreint aux projectIds que A possède : scope = { projectIds: ["proj-1", "proj-2"] } (ou sous-ensemble si spécifié)
4. B ne peut jamais avoir un scope plus large que celui de A

---

## Dépendances vérifiées

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| ONB-S01 | DONE | Onboarding wizard + service + routes |
| RBAC-S01 | DONE | hasPermission() scope fix, canUser(), scopeSchema |
| RBAC-S03 | DONE | businessRole sur company_memberships |
| MU-S01 | DONE | API invitations email (POST /api/invites), email service |
| RBAC-S02 | DONE | 20 permission keys + presets par rôle |
| RBAC-S04 | DONE | Enforcement 22 routes, requirePermission middleware |

---

## Deliverables

### Backend

1. **Hiérarchie des rôles** — `packages/shared/src/role-hierarchy.ts`
   - `BUSINESS_ROLE_LEVELS`: Record<BusinessRole, number> — admin=0, manager=1, contributor=2, viewer=3
   - `canInviteRole(inviterRole, targetRole)`: boolean — inviter level <= target level AND inviter level <= 1 (only admin/manager can invite)
   - `getInvitableRoles(inviterRole)`: BusinessRole[] — list of roles the inviter can assign
   - `getRoleLevel(role)`: number — numeric level for comparison
   - `isHierarchyValid(inviterRole, targetRole)`: boolean — alias for canInviteRole

2. **Service cascade** — `server/src/services/cascade.ts`
   - `validateCascadeInvite(companyId, inviterUserId, targetEmail, targetRole, targetScope?)`:
     - Fetches inviter's membership + effective permissions
     - Checks `canInviteRole(inviter.businessRole, targetRole)`
     - Checks scope containment (target scope must be subset of inviter scope)
     - Returns `{ valid: boolean, reason?: string, inheritedScope: ResourceScope | null }`
   - `computeInheritedScope(inviterScope, requestedScope?)`:
     - If no requestedScope → inherits inviterScope entirely
     - If requestedScope → intersects with inviterScope (only common projectIds)
     - Returns the effective scope for the invitee
   - `getCascadeChain(companyId, userId)`:
     - Walks the `invitedBy` chain to build the hierarchy path
     - Returns `Array<{ userId, businessRole, invitedBy }>`

3. **Integration invitation flow** — Modify `server/src/routes/access.ts`
   - Before creating an invite, call `validateCascadeInvite()`
   - If validation fails → 403 with detailed reason
   - Store `invitedByUserId` on the invitation
   - On invite accept, apply `computeInheritedScope()` to set the new member's permissions

4. **Route for cascade info** — `server/src/routes/onboarding.ts` (extend)
   - `GET /companies/:companyId/onboarding/cascade-info` — returns the hierarchy info for the current user: their role, invitable roles, their scope, cascade chain

5. **Barrel exports** — Update `server/src/services/index.ts`, `packages/shared/src/index.ts`

### Types

6. **Shared types** — `packages/shared/src/role-hierarchy.ts`
   - `CascadeValidationResult`: `{ valid: boolean; reason?: string; inheritedScope: ResourceScope | null }`
   - `CascadeChainEntry`: `{ userId: string; businessRole: BusinessRole; invitedBy: string | null }`
   - `CascadeInfo`: `{ userRole: BusinessRole; invitableRoles: BusinessRole[]; userScope: ResourceScope | null; cascadeChain: CascadeChainEntry[] }`

---

## Acceptance Criteria (Given/When/Then)

### AC1 — Admin can invite any role
**Given** an admin user in company X
**When** they attempt to invite a user with role "manager"
**Then** the invitation is allowed and the manager receives manager preset permissions

### AC2 — Manager can invite contributor
**Given** a manager user with scope `{ projectIds: ["proj-1"] }`
**When** they invite a user with role "contributor"
**Then** the invitation is allowed and the contributor inherits scope `{ projectIds: ["proj-1"] }`

### AC3 — Manager cannot invite admin
**Given** a manager user
**When** they attempt to invite a user with role "admin"
**Then** the invitation is rejected with 403 and reason "Manager cannot invite admin"

### AC4 — Contributor cannot invite anyone
**Given** a contributor user
**When** they attempt to invite anyone
**Then** the invitation is rejected with 403 and reason "Contributors cannot invite users"

### AC5 — Scope containment enforced
**Given** a manager with scope `{ projectIds: ["proj-1"] }`
**When** they try to invite a contributor with scope `{ projectIds: ["proj-1", "proj-2"] }`
**Then** the invitation is rejected because "proj-2" is not in inviter's scope

### AC6 — Scope inheritance
**Given** a manager with scope `{ projectIds: ["proj-1", "proj-2"] }`
**When** they invite a contributor without specifying scope
**Then** the contributor inherits the full scope `{ projectIds: ["proj-1", "proj-2"] }`

### AC7 — Scope intersection
**Given** a manager with scope `{ projectIds: ["proj-1", "proj-2", "proj-3"] }`
**When** they invite a contributor with scope `{ projectIds: ["proj-2", "proj-3"] }`
**Then** the contributor gets scope `{ projectIds: ["proj-2", "proj-3"] }` (valid subset)

### AC8 — Admin has no scope restriction
**Given** an admin user (global scope)
**When** they invite a manager with scope `{ projectIds: ["proj-1"] }`
**Then** the invitation is allowed (admin has no scope restriction)

### AC9 — Cascade chain tracking
**Given** CEO (admin) invited Manager-A, Manager-A invited Contributor-B
**When** getCascadeChain is called for Contributor-B
**Then** chain = [{ userId: B, role: contributor, invitedBy: Manager-A }, { userId: Manager-A, role: manager, invitedBy: CEO }]

### AC10 — Audit trail on cascade invite
**Given** a manager invites a contributor
**When** the invitation is created
**Then** audit event `cascade.invite_created` is emitted with `{ inviterRole, targetRole, targetEmail, inheritedScope }`

### AC11 — Cascade info endpoint
**Given** a manager with scope on 2 projects
**When** GET `/api/companies/:companyId/onboarding/cascade-info` is called
**Then** response contains `{ userRole: "manager", invitableRoles: ["manager", "contributor", "viewer"], userScope: { projectIds: [...] }, cascadeChain: [...] }`

### AC12 — data-testid coverage
**Given** all service functions and route handlers
**When** implemented
**Then** all functions contain marker comments with `onb-s02-` prefix for file-content testing

---

## data-testid / Marker Mapping Table

| Element | Marker / data-testid | File |
|---------|---------------------|------|
| Role hierarchy levels | `onb-s02-role-levels` | role-hierarchy.ts |
| canInviteRole function | `onb-s02-can-invite-role` | role-hierarchy.ts |
| getInvitableRoles function | `onb-s02-get-invitable-roles` | role-hierarchy.ts |
| getRoleLevel function | `onb-s02-get-role-level` | role-hierarchy.ts |
| Cascade service marker | `onb-s02-cascade-service` | cascade.ts |
| validateCascadeInvite function | `onb-s02-validate-cascade` | cascade.ts |
| computeInheritedScope function | `onb-s02-compute-inherited-scope` | cascade.ts |
| getCascadeChain function | `onb-s02-get-cascade-chain` | cascade.ts |
| Cascade validation in access.ts | `onb-s02-access-cascade-check` | access.ts (routes) |
| Cascade info route | `onb-s02-cascade-info-route` | onboarding.ts (routes) |
| Cascade service barrel export | `onb-s02-barrel-svc` | services/index.ts |
| Role hierarchy barrel export | `onb-s02-barrel-shared` | shared/src/index.ts |
| Cascade audit emit | `onb-s02-cascade-audit` | access.ts (routes) |
| Scope containment check | `onb-s02-scope-containment` | cascade.ts |
| InvitedBy tracking | `onb-s02-invited-by` | access.ts (routes) |

---

## Test Cases (file-content based)

### Shared — Role Hierarchy (T01-T08)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T01 | BUSINESS_ROLE_LEVELS exported | role-hierarchy.ts | `BUSINESS_ROLE_LEVELS` |
| T02 | Admin level is 0 | role-hierarchy.ts | `admin.*0` |
| T03 | Manager level is 1 | role-hierarchy.ts | `manager.*1` |
| T04 | Contributor level is 2 | role-hierarchy.ts | `contributor.*2` |
| T05 | Viewer level is 3 | role-hierarchy.ts | `viewer.*3` |
| T06 | canInviteRole function exported | role-hierarchy.ts | `canInviteRole` |
| T07 | getInvitableRoles function exported | role-hierarchy.ts | `getInvitableRoles` |
| T08 | getRoleLevel function exported | role-hierarchy.ts | `getRoleLevel` |

### Shared — Barrel Export (T09)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T09 | Role hierarchy exported from shared index | index.ts (shared) | `role-hierarchy` |

### Backend — Cascade Service (T10-T18)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T10 | Cascade service file exists with marker | cascade.ts | `onb-s02-cascade-service` |
| T11 | validateCascadeInvite function exists | cascade.ts | `validateCascadeInvite` |
| T12 | computeInheritedScope function exists | cascade.ts | `computeInheritedScope` |
| T13 | getCascadeChain function exists | cascade.ts | `getCascadeChain` |
| T14 | Uses canInviteRole from role-hierarchy | cascade.ts | `canInviteRole` |
| T15 | Uses accessService for permissions | cascade.ts | `accessService\|getMembership\|getEffectivePermissions` |
| T16 | Scope containment marker | cascade.ts | `onb-s02-scope-containment` |
| T17 | Returns CascadeValidationResult | cascade.ts | `valid.*reason\|CascadeValidationResult` |
| T18 | Cascade service barrel export | services/index.ts | `onb-s02-barrel-svc` |

### Backend — Access Route Integration (T19-T24)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T19 | Access route imports cascade service | access.ts (routes) | `cascade\|cascadeService\|validateCascadeInvite` |
| T20 | Cascade validation check marker | access.ts (routes) | `onb-s02-access-cascade-check` |
| T21 | Cascade audit emit marker | access.ts (routes) | `onb-s02-cascade-audit` |
| T22 | invitedBy tracking marker | access.ts (routes) | `onb-s02-invited-by` |
| T23 | 403 on hierarchy violation | access.ts (routes) | `403\|HIERARCHY_VIOLATION\|cannot invite` |
| T24 | Scope subset enforcement | access.ts (routes) | `scope.*subset\|containment\|inherited` |

### Backend — Cascade Info Route (T25-T28)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T25 | Cascade info route exists | onboarding.ts (routes) | `cascade-info` |
| T26 | Route marker | onboarding.ts (routes) | `onb-s02-cascade-info-route` |
| T27 | Returns invitableRoles | onboarding.ts (routes) | `invitableRoles\|getInvitableRoles` |
| T28 | Returns cascadeChain | onboarding.ts (routes) | `cascadeChain\|getCascadeChain` |

### Hierarchy Validation Logic (T29-T35)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T29 | Admin can invite any role (level 0) | role-hierarchy.ts | `admin` in canInviteRole returns that support for all roles |
| T30 | Manager can invite manager/contributor/viewer | role-hierarchy.ts | `manager.*contributor\|getInvitableRoles` |
| T31 | Contributor cannot invite (level 2) | role-hierarchy.ts | `contributor.*2\|level.*>.*1` |
| T32 | Viewer cannot invite (level 3) | role-hierarchy.ts | `viewer.*3` |
| T33 | Scope intersection logic | cascade.ts | `filter\|includes\|intersection\|every` |
| T34 | Empty scope means global | cascade.ts | `null.*global\|!.*scope\|scope === null` |
| T35 | Audit emitted on cascade | cascade.ts or access.ts | `cascade\.invite\|emitAudit.*cascade` |

---

## Notes techniques

- La hiérarchie des rôles est définie dans `packages/shared/` car elle est utilisée côté frontend (pour masquer/afficher le sélecteur de rôle dans l'UI d'invitation) et côté backend (pour la validation).
- Le scope d'un utilisateur est déterminé par ses `principal_permission_grants` dans la DB. Pour un admin, le scope est null (global). Pour un manager/contributor, le scope est déterminé par les grants explicites OU le preset du businessRole.
- La cascade chain est stockée en utilisant le champ `invitedByUserId` déjà présent (ou ajouté) sur `company_memberships`. Cela permet de reconstruire la chaîne sans nouvelle table.
- Le service cascade utilise l'`accessService` existant pour lire les permissions effectives de l'inviteur. Il ne duplique pas la logique RBAC.
- L'intersection de scope utilise une logique simple : si l'inviteur a scope null (global), le target peut avoir n'importe quel scope. Si l'inviteur a un scope avec projectIds, le target ne peut avoir que des projectIds inclus dans ceux de l'inviteur.
