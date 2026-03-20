# RBAC-S02 : 9 Permission Keys + Presets par Role -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | RBAC-S02 |
| **Titre** | Permission Presets par BusinessRole + nouvelles permission keys + fallback dans hasPermission() |
| **Epic** | Epic RBAC -- Roles & Permissions |
| **Sprint** | Sprint 2 (Phase 2) |
| **Effort** | S (2 SP, 1-2j) |
| **Priorite** | P0 |
| **Assignation** | Tom (backend) |
| **Bloque par** | RBAC-S01 (Fix hasPermission scope JSONB) |
| **Debloque** | RBAC-S04 (Enforcement 22 routes), RBAC-S06 (UI admin matrice permissions) |
| **ADR** | ADR-002 (RBAC 4 roles) |
| **FRs couverts** | REQ-RBAC-02 (Presets de permissions par role), REQ-RBAC-04 (9 nouvelles permission keys) |
| **Type** | Backend + Shared (pas de composant UI dans cette story) |

---

## Description

### Contexte

TECH-07 a deja ajoute les 15 permission keys dans `packages/shared/src/constants.ts` (PERMISSION_KEYS array). RBAC-S01 a corrige `hasPermission()` pour lire le scope JSONB. RBAC-S03 a ajoute le `businessRole` (admin/manager/contributor/viewer) sur `company_memberships`.

Cependant, **le systeme ne lie pas encore les businessRoles aux permissions**. Actuellement :

1. **`hasPermission()` ne consulte que `principal_permission_grants`** -- si un utilisateur n'a aucun grant explicite, il n'a AUCUNE permission, meme s'il est admin
2. **Aucun preset n'existe** -- pas de mapping "admin a toutes les permissions par defaut"
3. **Pas de fallback businessRole** -- `hasPermission()` retourne `false` si aucun grant explicite n'existe, ignorant completement le `businessRole` du membre
4. **Les 15 keys existantes ne couvrent pas tous les domaines B2B** -- il manque des keys pour stories, agents launch, dashboard et chat

### Ce que cette story fait

1. **Ajoute 5 nouvelles permission keys** pour couvrir les domaines manquants (stories, agents:launch, dashboard, chat)
2. **Cree une matrice de presets** : constante TypeScript `ROLE_PERMISSION_PRESETS` mappant chaque `BusinessRole` a ses permission keys par defaut
3. **Modifie `hasPermission()`** pour utiliser les presets comme fallback : si aucun grant explicite n'existe dans `principal_permission_grants`, on consulte le preset du `businessRole`
4. **Ajoute un endpoint API** `GET /api/companies/:companyId/rbac/presets` pour permettre au frontend de connaitre la matrice
5. **Ajoute un endpoint API** `GET /api/companies/:companyId/rbac/effective-permissions/:memberId` pour retourner les permissions effectives (presets + overrides)

### Principe fondamental : Presets en code, overrides en DB

Les presets sont des **constantes TypeScript** (pas en DB). Les `principal_permission_grants` deviennent des **overrides** qui priment sur le preset :

- Si un grant existe pour une permission key -> utiliser le grant (avec son scope)
- Si aucun grant n'existe -> consulter le preset du businessRole
- Un preset accorde la permission sans scope (acces global company-wide)

Cela permet une evolution future (RBAC-S06) ou l'admin pourra surcharger les presets par des grants personnalises.

---

## Etat Actuel du Code (Analyse)

### Les 15 Permission Keys existantes (packages/shared/src/constants.ts)

```typescript
export const PERMISSION_KEYS = [
  "agents:create",
  "users:invite",
  "users:manage_permissions",
  "tasks:assign",
  "tasks:assign_scope",
  "joins:approve",
  "projects:create",
  "projects:manage_members",
  "workflows:create",
  "workflows:enforce",
  "agents:manage_containers",
  "company:manage_settings",
  "company:manage_sso",
  "audit:read",
  "audit:export",
] as const;
```

### Mapping epic description -> keys existantes

| Epic description | Key existante | Statut |
|-----------------|---------------|--------|
| workflows.create | `workflows:create` | EXISTE |
| workflows.manage | `workflows:enforce` | EXISTE (semantiquement equivalent) |
| agents.launch | -- | MANQUANTE |
| stories.create | -- | MANQUANTE |
| stories.edit | -- | MANQUANTE |
| audit.view | `audit:read` | EXISTE (semantiquement equivalent) |
| audit.export | `audit:export` | EXISTE |
| dashboard.view | -- | MANQUANTE |
| chat.agent | -- | MANQUANTE |

### 5 Nouvelles Keys a ajouter

| Key | Domaine | Description |
|-----|---------|-------------|
| `agents:launch` | Agents | Droit de lancer/demarrer un agent (distinct de agents:create) |
| `stories:create` | Stories/Issues | Droit de creer des stories/issues dans un projet |
| `stories:edit` | Stories/Issues | Droit de modifier des stories/issues existantes |
| `dashboard:view` | Dashboard | Droit de voir les dashboards (metriques, KPIs) |
| `chat:agent` | Chat | Droit de discuter avec un agent via le chat temps reel |

### Fichiers impactes

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `packages/shared/src/constants.ts` | 15 PERMISSION_KEYS | MODIFIE : +5 nouvelles keys (20 total) |
| `packages/shared/src/rbac-presets.ts` | N'existe pas | CREE : ROLE_PERMISSION_PRESETS + helpers |
| `packages/shared/src/index.ts` | Barrel exports | MODIFIE : re-export rbac-presets |
| `server/src/services/access.ts` | hasPermission() sans fallback preset | MODIFIE : fallback businessRole preset |
| `server/src/routes/access.ts` | Routes auth/invites/members | MODIFIE : +2 endpoints RBAC presets |
| `server/src/__tests__/rbac-presets.test.ts` | N'existe pas | CREE : tests unitaires presets |
| `server/src/__tests__/access-service-presets.test.ts` | N'existe pas | CREE : tests hasPermission avec fallback |

### Fichiers de reference (non modifies dans cette story)

| Fichier | Role |
|---------|------|
| `packages/db/src/schema/principal_permission_grants.ts` | Schema Drizzle (inchange) |
| `packages/db/src/schema/company_memberships.ts` | Schema avec businessRole (inchange) |
| `packages/shared/src/validators/access.ts` | Zod schemas pour scope/permissions |
| `server/src/middleware/require-permission.ts` | Middleware requirePermission (inchange) |
| `packages/test-utils/src/factories/membership.factory.ts` | createTestCompanyMembership() |
| `packages/test-utils/src/factories/permission.factory.ts` | createTestPermissionGrant() |

### Conventions du codebase (a respecter)

1. **Service pattern** : `accessService(db)` retourne un objet de fonctions -- pas de classes
2. **Error handling** : `throw forbidden("message")`, `throw notFound("message")`
3. **Drizzle queries** : `db.select().from().where(and(...))` avec `drizzle-orm` operators
4. **Permission key format** : `domain:action` avec deux-points (ex: `agents:create`, pas `agents.create`)
5. **Constants** : arrays `as const` avec types derives (`typeof X[number]`)
6. **Routes** : Express Router avec `validate()` middleware pour body/query parsing
7. **Tests** : Vitest avec `describe`/`it`/`expect`, factories depuis `@mnm/test-utils`

---

## Specification Technique Detaillee

### T1 : Ajouter 5 nouvelles permission keys -- `packages/shared/src/constants.ts`

#### Modification

Ajouter 5 keys au tableau `PERMISSION_KEYS` (20 total) :

```typescript
export const PERMISSION_KEYS = [
  // --- Existantes (15) ---
  "agents:create",
  "users:invite",
  "users:manage_permissions",
  "tasks:assign",
  "tasks:assign_scope",
  "joins:approve",
  "projects:create",
  "projects:manage_members",
  "workflows:create",
  "workflows:enforce",
  "agents:manage_containers",
  "company:manage_settings",
  "company:manage_sso",
  "audit:read",
  "audit:export",
  // --- Nouvelles (5) ---
  "agents:launch",
  "stories:create",
  "stories:edit",
  "dashboard:view",
  "chat:agent",
] as const;
```

#### Backward compatibility

Le type `PermissionKey` est derive du tableau. L'ajout de nouvelles valeurs est additif et ne casse pas les types existants. Les Zod schemas utilisant `z.enum(PERMISSION_KEYS)` accepteront automatiquement les nouvelles valeurs.

---

### T2 : Creer la matrice de presets -- `packages/shared/src/rbac-presets.ts`

#### Nouveau fichier

```typescript
import type { BusinessRole, PermissionKey } from "./constants.js";

/**
 * Matrice de presets : chaque businessRole a un ensemble de permissions par defaut.
 * Ces presets sont utilises comme fallback quand aucun grant explicite n'existe
 * dans principal_permission_grants.
 *
 * Un grant explicite (present dans principal_permission_grants) a TOUJOURS priorite
 * sur le preset. Le preset accorde la permission sans scope (acces global company-wide).
 *
 * Source de verite : ADR-002 (Architecture B2B)
 */
export const ROLE_PERMISSION_PRESETS: Record<BusinessRole, readonly PermissionKey[]> = {
  admin: [
    // Admin a TOUTES les permissions
    "agents:create",
    "agents:launch",
    "agents:manage_containers",
    "users:invite",
    "users:manage_permissions",
    "tasks:assign",
    "tasks:assign_scope",
    "joins:approve",
    "projects:create",
    "projects:manage_members",
    "workflows:create",
    "workflows:enforce",
    "company:manage_settings",
    "company:manage_sso",
    "audit:read",
    "audit:export",
    "stories:create",
    "stories:edit",
    "dashboard:view",
    "chat:agent",
  ],

  manager: [
    // Manager : gestion courante, pas d'admin systeme
    "agents:create",
    "agents:launch",
    "users:invite",
    "tasks:assign",
    "joins:approve",
    "projects:create",
    "projects:manage_members",
    "workflows:create",
    "workflows:enforce",
    "audit:read",
    "stories:create",
    "stories:edit",
    "dashboard:view",
    "chat:agent",
  ],

  contributor: [
    // Contributor : creer et lancer, pas gerer ni administrer
    "agents:launch",
    "tasks:assign",
    "stories:create",
    "stories:edit",
    "chat:agent",
  ],

  viewer: [
    // Viewer : lecture seule
    "audit:read",
    "dashboard:view",
  ],
} as const;

/**
 * Verifie si une permission est incluse dans le preset d'un businessRole.
 */
export function isPermissionInPreset(
  businessRole: BusinessRole,
  permissionKey: PermissionKey,
): boolean {
  const preset = ROLE_PERMISSION_PRESETS[businessRole];
  return preset.includes(permissionKey);
}

/**
 * Retourne la liste des permissions par defaut d'un businessRole.
 */
export function getPresetPermissions(businessRole: BusinessRole): readonly PermissionKey[] {
  return ROLE_PERMISSION_PRESETS[businessRole];
}

/**
 * Retourne la matrice complete de presets sous forme serializeable
 * (pour l'endpoint API GET /api/companies/:companyId/rbac/presets).
 */
export function getPresetsMatrix(): Record<string, readonly PermissionKey[]> {
  return { ...ROLE_PERMISSION_PRESETS };
}
```

#### Logique de la matrice

| Permission Key | Admin | Manager | Contributor | Viewer |
|---------------|-------|---------|-------------|--------|
| `agents:create` | x | x | | |
| `agents:launch` | x | x | x | |
| `agents:manage_containers` | x | | | |
| `users:invite` | x | x | | |
| `users:manage_permissions` | x | | | |
| `tasks:assign` | x | x | x | |
| `tasks:assign_scope` | x | | | |
| `joins:approve` | x | x | | |
| `projects:create` | x | x | | |
| `projects:manage_members` | x | x | | |
| `workflows:create` | x | x | | |
| `workflows:enforce` | x | x | | |
| `company:manage_settings` | x | | | |
| `company:manage_sso` | x | | | |
| `audit:read` | x | x | | x |
| `audit:export` | x | | | |
| `stories:create` | x | x | x | |
| `stories:edit` | x | x | x | |
| `dashboard:view` | x | x | | x |
| `chat:agent` | x | x | x | |

#### Justification des choix

- **Admin (20/20 permissions)** : Acces total, conformement a ADR-002 "Admin : toutes les permissions"
- **Manager (14/20)** : Gestion courante d'equipe. Exclut : `users:manage_permissions`, `tasks:assign_scope`, `agents:manage_containers`, `company:manage_settings`, `company:manage_sso`, `audit:export` -- ces actions sont reservees aux admins
- **Contributor (5/20)** : Productivite quotidienne. Peut lancer des agents, creer/editer des stories, assigner des taches, et chatter avec les agents
- **Viewer (2/20)** : Observateur. Peut consulter l'audit et les dashboards, conformement a ADR-002 "Viewer : audit.view, dashboard.view"

---

### T3 : Exporter depuis packages/shared/src/index.ts

Ajouter le re-export du nouveau module :

```typescript
export {
  ROLE_PERMISSION_PRESETS,
  isPermissionInPreset,
  getPresetPermissions,
  getPresetsMatrix,
} from "./rbac-presets.js";
```

---

### T4 : Modifier hasPermission() pour fallback preset -- `server/src/services/access.ts`

#### Logique modifiee

La fonction `hasPermission()` actuelle retourne `false` quand aucun grant explicite n'existe. Le changement est d'ajouter un fallback sur le preset du `businessRole` :

```typescript
import { isPermissionInPreset } from "@mnm/shared";

async function hasPermission(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  permissionKey: PermissionKey,
  resourceScope?: ResourceScope,
): Promise<boolean> {
  const membership = await getMembership(companyId, principalType, principalId);
  if (!membership || membership.status !== "active") return false;

  // 1. Chercher un grant explicite dans principal_permission_grants
  const grant = await db
    .select({
      id: principalPermissionGrants.id,
      scope: principalPermissionGrants.scope,
    })
    .from(principalPermissionGrants)
    .where(
      and(
        eq(principalPermissionGrants.companyId, companyId),
        eq(principalPermissionGrants.principalType, principalType),
        eq(principalPermissionGrants.principalId, principalId),
        eq(principalPermissionGrants.permissionKey, permissionKey),
      ),
    )
    .then((rows) => rows[0] ?? null);

  // 2. Si un grant explicite existe, l'evaluer (avec scope)
  if (grant) {
    if (!resourceScope) return true;
    const grantScope = grant.scope as Record<string, unknown> | null | undefined;
    if (!grantScope || Object.keys(grantScope).length === 0) return true;
    const requestedProjectIds = resourceScope.projectIds;
    if (requestedProjectIds && requestedProjectIds.length > 0) {
      const grantedProjectIds = Array.isArray(grantScope.projectIds)
        ? new Set(grantScope.projectIds as string[])
        : null;
      if (!grantedProjectIds) return true;
      const allCovered = requestedProjectIds.every((id) => grantedProjectIds.has(id));
      if (!allCovered) return false;
    }
    return true;
  }

  // 3. Pas de grant explicite -> fallback sur le preset du businessRole
  const businessRole = membership.businessRole as BusinessRole | null;
  if (!businessRole) return false;

  // Le preset accorde la permission sans scope (company-wide)
  // Si un resourceScope est demande, le preset ne peut PAS le satisfaire
  // (il faudrait un grant explicite avec scope pour ca)
  if (resourceScope && resourceScope.projectIds && resourceScope.projectIds.length > 0) {
    // Le preset accorde un acces global -- il couvre tous les scopes
    // (un admin avec preset ne devrait pas etre bloque sur un projet specifique)
    return isPermissionInPreset(businessRole, permissionKey);
  }

  return isPermissionInPreset(businessRole, permissionKey);
}
```

#### Regles d'evaluation (mise a jour)

| Scenario | Grant explicite | BusinessRole | ResourceScope | Resultat |
|----------|----------------|-------------|---------------|----------|
| Grant explicite, pas de scope | OUI (scope null) | N/A | undefined | `true` |
| Grant explicite, scope couvert | OUI (scope {A}) | N/A | {A} | `true` |
| Grant explicite, scope non couvert | OUI (scope {A}) | N/A | {B} | `false` |
| Pas de grant, preset inclut la key | NON | admin | undefined | `true` |
| Pas de grant, preset inclut la key, scope demande | NON | admin | {A} | `true` (preset = global) |
| Pas de grant, preset n'inclut PAS la key | NON | viewer | "agents:create" | `false` |
| Pas de grant, businessRole null | NON | null | undefined | `false` |
| Membership inactive | N/A | admin | N/A | `false` |
| Instance admin (via canUser) | N/A | N/A | N/A | `true` (bypass) |

#### Important : Priorite grant > preset

Un grant explicite a TOUJOURS priorite sur le preset. Cela permet les scenarios suivants :
- **Promotion** : Un contributor peut recevoir un grant explicite `workflows:create` pour etendre ses droits au-dela du preset contributor
- **Restriction** : Dans une future iteration, on pourra ajouter des "deny grants" pour retirer une permission du preset
- **Scoping** : Un manager peut avoir un grant `tasks:assign` avec scope `{ projectIds: ["proj-A"] }` qui restreint l'acces du preset (qui est global)

**Note sur le scoping des presets** : Le preset accorde un acces global (company-wide, pas de scope). Si un resourceScope est demande par l'appelant et que le membre utilise le fallback preset, le preset est considere comme un acces global qui couvre tout scope. Cela reflete la philosophie ADR-002 : les roles metier accordent des droits sur toute la company, le scoping est gere par des grants explicites.

---

### T5 : Ajouter un helper pour calculer les permissions effectives

Ajouter dans `accessService()` :

```typescript
async function getEffectivePermissions(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
): Promise<{
  businessRole: BusinessRole | null;
  presetPermissions: PermissionKey[];
  explicitGrants: Array<{
    permissionKey: PermissionKey;
    scope: Record<string, unknown> | null;
  }>;
  effectivePermissions: PermissionKey[];
}> {
  const membership = await getMembership(companyId, principalType, principalId);
  if (!membership || membership.status !== "active") {
    return {
      businessRole: null,
      presetPermissions: [],
      explicitGrants: [],
      effectivePermissions: [],
    };
  }

  const businessRole = membership.businessRole as BusinessRole | null;
  const presetPerms = businessRole ? [...getPresetPermissions(businessRole)] : [];

  const grants = await db
    .select({
      permissionKey: principalPermissionGrants.permissionKey,
      scope: principalPermissionGrants.scope,
    })
    .from(principalPermissionGrants)
    .where(
      and(
        eq(principalPermissionGrants.companyId, companyId),
        eq(principalPermissionGrants.principalType, principalType),
        eq(principalPermissionGrants.principalId, principalId),
      ),
    );

  const explicitGrants = grants.map((g) => ({
    permissionKey: g.permissionKey as PermissionKey,
    scope: g.scope as Record<string, unknown> | null,
  }));

  // Permissions effectives = union preset + grants explicites
  const effectiveSet = new Set<PermissionKey>(presetPerms);
  for (const grant of explicitGrants) {
    effectiveSet.add(grant.permissionKey);
  }

  return {
    businessRole,
    presetPermissions: presetPerms,
    explicitGrants,
    effectivePermissions: [...effectiveSet].sort(),
  };
}
```

Ajouter `getEffectivePermissions` au retour de `accessService()`.

---

### T6 : Ajouter les endpoints API -- `server/src/routes/access.ts`

#### Endpoint 1 : GET /api/companies/:companyId/rbac/presets

Retourne la matrice complete des presets (constante, identique pour toutes les companies).

```typescript
// GET /api/companies/:companyId/rbac/presets
router.get("/companies/:companyId/rbac/presets", async (req, res) => {
  assertCompanyAccess(req, req.params.companyId);
  // Tout utilisateur authentifie de la company peut lire les presets
  const matrix = getPresetsMatrix();
  res.json(matrix);
});
```

**Auth** : Tout membre actif de la company. Pas de permission requise (informations publiques au sein de la company).

**Response** :
```json
{
  "admin": ["agents:create", "agents:launch", "..."],
  "manager": ["agents:create", "agents:launch", "..."],
  "contributor": ["agents:launch", "..."],
  "viewer": ["audit:read", "dashboard:view"]
}
```

#### Endpoint 2 : GET /api/companies/:companyId/rbac/effective-permissions/:memberId

Retourne les permissions effectives d'un membre specifique (preset + overrides).

```typescript
// GET /api/companies/:companyId/rbac/effective-permissions/:memberId
router.get(
  "/companies/:companyId/rbac/effective-permissions/:memberId",
  async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const { companyId, memberId } = req.params;

    // Seuls les admins/managers peuvent consulter les permissions d'un autre membre
    // Un membre peut toujours consulter ses propres permissions
    const isOwnProfile = /* check if req.actor matches memberId */;
    if (!isOwnProfile) {
      const access = accessService(db);
      const canManage = await access.canUser(companyId, req.actor.userId, "users:manage_permissions");
      if (!canManage) {
        throw forbidden("Permission denied: users:manage_permissions");
      }
    }

    const member = await db
      .select()
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.id, memberId),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!member) throw notFound("Member not found");

    const access = accessService(db);
    const effective = await access.getEffectivePermissions(
      companyId, member.principalType, member.principalId,
    );

    res.json(effective);
  },
);
```

**Auth** : `users:manage_permissions` OU propre profil.

**Response** :
```json
{
  "businessRole": "manager",
  "presetPermissions": ["agents:create", "agents:launch", "..."],
  "explicitGrants": [
    { "permissionKey": "tasks:assign", "scope": { "projectIds": ["uuid-1"] } }
  ],
  "effectivePermissions": ["agents:create", "agents:launch", "...", "tasks:assign"]
}
```

---

### T7 : Tests unitaires

#### Fichier 1 : `server/src/__tests__/rbac-presets.test.ts`

Tests de la matrice de presets (logique pure, pas de DB).

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | Admin a toutes les 20 permissions | `ROLE_PERMISSION_PRESETS.admin.length` | 20 |
| 2 | Manager a 14 permissions | `ROLE_PERMISSION_PRESETS.manager.length` | 14 |
| 3 | Contributor a 5 permissions | `ROLE_PERMISSION_PRESETS.contributor.length` | 5 |
| 4 | Viewer a 2 permissions | `ROLE_PERMISSION_PRESETS.viewer.length` | 2 |
| 5 | Admin inclut toutes les keys de PERMISSION_KEYS | Toutes les keys sont couvertes | `true` |
| 6 | Manager n'a PAS users:manage_permissions | `isPermissionInPreset("manager", "users:manage_permissions")` | `false` |
| 7 | Manager n'a PAS company:manage_settings | `isPermissionInPreset("manager", "company:manage_settings")` | `false` |
| 8 | Manager n'a PAS company:manage_sso | `isPermissionInPreset("manager", "company:manage_sso")` | `false` |
| 9 | Manager n'a PAS agents:manage_containers | `isPermissionInPreset("manager", "agents:manage_containers")` | `false` |
| 10 | Manager n'a PAS audit:export | `isPermissionInPreset("manager", "audit:export")` | `false` |
| 11 | Manager n'a PAS tasks:assign_scope | `isPermissionInPreset("manager", "tasks:assign_scope")` | `false` |
| 12 | Contributor a agents:launch | `isPermissionInPreset("contributor", "agents:launch")` | `true` |
| 13 | Contributor n'a PAS agents:create | `isPermissionInPreset("contributor", "agents:create")` | `false` |
| 14 | Viewer a audit:read | `isPermissionInPreset("viewer", "audit:read")` | `true` |
| 15 | Viewer a dashboard:view | `isPermissionInPreset("viewer", "dashboard:view")` | `true` |
| 16 | Viewer n'a PAS chat:agent | `isPermissionInPreset("viewer", "chat:agent")` | `false` |
| 17 | getPresetsMatrix retourne 4 roles | `Object.keys(getPresetsMatrix()).length` | 4 |
| 18 | Aucune key dans les presets n'est en dehors de PERMISSION_KEYS | Toutes les keys de preset sont dans PERMISSION_KEYS | `true` |

#### Fichier 2 : `server/src/__tests__/access-service-presets.test.ts`

Tests de `hasPermission()` avec le fallback preset (necessite DB mock ou test utils).

| # | Test | Grant | BusinessRole | Expected |
|---|------|-------|-------------|----------|
| 1 | Admin sans grant, permission preset | Aucun | admin | `true` |
| 2 | Admin sans grant, toutes les permissions | Aucun | admin | `true` pour chacune des 20 keys |
| 3 | Viewer sans grant, audit:read | Aucun | viewer | `true` |
| 4 | Viewer sans grant, agents:create | Aucun | viewer | `false` |
| 5 | Contributor sans grant, agents:launch | Aucun | contributor | `true` |
| 6 | Contributor sans grant, users:invite | Aucun | contributor | `false` |
| 7 | Grant explicite prime sur preset absent | Grant agents:create | contributor | `true` (via grant, pas preset) |
| 8 | Grant explicite avec scope restreint | Grant tasks:assign scope {A} | manager (preset inclut tasks:assign) | resourceScope {A} -> `true`, resourceScope {B} -> `false` (grant a priorite) |
| 9 | Preset fallback avec resourceScope demande | Aucun | manager | resourceScope {A} -> `true` (preset = global) |
| 10 | Membership inactive ignore preset | Aucun | admin, status suspended | `false` |
| 11 | BusinessRole null retourne false | Aucun | null | `false` |
| 12 | getEffectivePermissions : admin sans grants | Aucun | admin | effectivePermissions = 20 keys triees |
| 13 | getEffectivePermissions : contributor avec 1 grant additionnel | Grant workflows:create | contributor | effectivePermissions = 5 preset + 1 extra = 6 |
| 14 | getEffectivePermissions : viewer avec grants | Grant agents:create | viewer | effectivePermissions = 2 preset + 1 extra = 3 |

#### Couverture cible

| Module | Couverture cible |
|--------|-----------------|
| `ROLE_PERMISSION_PRESETS` matrice | 100% |
| `isPermissionInPreset()` | 100% |
| `hasPermission()` fallback preset | >= 95% |
| `getEffectivePermissions()` | >= 90% |
| Endpoints API | >= 85% |

---

## data-test-id Attributes

Cette story est backend-only (pas de composants UI). Les `data-testid` ci-dessous sont pour les tests E2E qui verifient les endpoints API et les fichiers source.

| Element | data-testid | Usage |
|---------|-------------|-------|
| Endpoint presets response | `rbac-s02-presets-response` | E2E : verifier le contenu de GET /rbac/presets |
| Endpoint effective-permissions response | `rbac-s02-effective-response` | E2E : verifier le contenu de GET /rbac/effective-permissions |
| Permission key agents:launch | `rbac-s02-key-agents-launch` | E2E : verifier la presence de la key dans PERMISSION_KEYS |
| Permission key stories:create | `rbac-s02-key-stories-create` | E2E : verifier la presence de la key |
| Permission key stories:edit | `rbac-s02-key-stories-edit` | E2E : verifier la presence de la key |
| Permission key dashboard:view | `rbac-s02-key-dashboard-view` | E2E : verifier la presence de la key |
| Permission key chat:agent | `rbac-s02-key-chat-agent` | E2E : verifier la presence de la key |
| Preset admin array | `rbac-s02-preset-admin` | E2E : verifier que admin a 20 permissions |
| Preset manager array | `rbac-s02-preset-manager` | E2E : verifier que manager a 14 permissions |
| Preset contributor array | `rbac-s02-preset-contributor` | E2E : verifier que contributor a 5 permissions |
| Preset viewer array | `rbac-s02-preset-viewer` | E2E : verifier que viewer a 2 permissions |
| hasPermission fallback | `rbac-s02-fallback-preset` | E2E : verifier le comportement fallback |
| Effective permissions merge | `rbac-s02-effective-merge` | E2E : verifier preset + grants = effective |

---

## Acceptance Criteria

### AC-01 : 5 nouvelles permission keys ajoutees

```
Given le fichier packages/shared/src/constants.ts
When on inspecte le tableau PERMISSION_KEYS
Then il contient exactement 20 entries
And il inclut "agents:launch", "stories:create", "stories:edit", "dashboard:view", "chat:agent"
And le type PermissionKey accepte ces 5 nouvelles valeurs
```

### AC-02 : Matrice de presets complete

```
Given le fichier packages/shared/src/rbac-presets.ts
When on inspecte ROLE_PERMISSION_PRESETS
Then admin a 20 permissions (toutes)
And manager a 14 permissions
And contributor a 5 permissions (agents:launch, tasks:assign, stories:create, stories:edit, chat:agent)
And viewer a 2 permissions (audit:read, dashboard:view)
```

### AC-03 : Admin sans grant explicite a toutes les permissions

```
Given un membre avec businessRole "admin" et AUCUN grant dans principal_permission_grants
When hasPermission() est appele avec n'importe quelle des 20 permission keys
Then la fonction retourne true
```

### AC-04 : Viewer sans grant est limite a audit:read et dashboard:view

```
Given un membre avec businessRole "viewer" et AUCUN grant explicite
When hasPermission() est appele avec "agents:create"
Then la fonction retourne false
When hasPermission() est appele avec "audit:read"
Then la fonction retourne true
```

### AC-05 : Grant explicite prime sur le preset

```
Given un membre avec businessRole "contributor" (preset: pas de workflows:create)
And un grant explicite "workflows:create" dans principal_permission_grants
When hasPermission() est appele avec "workflows:create"
Then la fonction retourne true (via le grant, pas le preset)
```

### AC-06 : Grant explicite avec scope restreint a priorite sur le preset global

```
Given un membre avec businessRole "manager" (preset inclut tasks:assign, acces global)
And un grant explicite "tasks:assign" scope { projectIds: ["proj-A"] }
When hasPermission() est appele avec "tasks:assign" et resourceScope { projectIds: ["proj-A"] }
Then la fonction retourne true
When hasPermission() est appele avec "tasks:assign" et resourceScope { projectIds: ["proj-B"] }
Then la fonction retourne false (le grant explicite restreint, malgre le preset global)
```

### AC-07 : Preset fallback accorde un acces global (company-wide)

```
Given un membre avec businessRole "admin" et AUCUN grant explicite
When hasPermission() est appele avec "agents:create" et resourceScope { projectIds: ["proj-X"] }
Then la fonction retourne true (le preset est considere global)
```

### AC-08 : Membership inactive ignore le preset

```
Given un membre avec businessRole "admin" et status "suspended"
When hasPermission() est appele avec n'importe quelle permission
Then la fonction retourne false
```

### AC-09 : Endpoint GET /rbac/presets retourne la matrice

```
Given un utilisateur authentifie membre de la company
When il envoie GET /api/companies/:companyId/rbac/presets
Then la reponse est 200
And le body contient { admin: [...], manager: [...], contributor: [...], viewer: [...] }
And admin contient 20 keys, manager 14, contributor 5, viewer 2
```

### AC-10 : Endpoint GET /rbac/effective-permissions retourne les permissions effectives

```
Given un membre "contributor" avec un grant additionnel "workflows:create"
When un admin envoie GET /api/companies/:companyId/rbac/effective-permissions/:memberId
Then la reponse est 200
And effectivePermissions contient les 5 preset contributor + "workflows:create" = 6 keys
And presetPermissions contient 5 keys
And explicitGrants contient 1 entry { permissionKey: "workflows:create", scope: null }
```

### AC-11 : Seul un admin ou le membre lui-meme peut consulter les permissions effectives

```
Given un utilisateur contributor
When il envoie GET /api/companies/:companyId/rbac/effective-permissions/:autreMemberId
Then la reponse est 403 (pas de users:manage_permissions)
When il envoie GET /api/companies/:companyId/rbac/effective-permissions/:sonPropreMemberId
Then la reponse est 200
```

### AC-12 : Backward compatibility -- appels existants inchanges

```
Given le code existant qui appelle canUser() ou hasPermission() sans changement
When la nouvelle version est deployee
Then le comportement est ameliore (presets fonctionnent comme fallback)
And aucune route existante ne casse
And pnpm typecheck passe sans erreur
```

### AC-13 : Toutes les keys des presets sont dans PERMISSION_KEYS

```
Given la matrice ROLE_PERMISSION_PRESETS
When on verifie chaque key de chaque role
Then toutes les keys sont presentes dans PERMISSION_KEYS
And aucune key orpheline n'existe dans les presets
```

---

## Diagramme de Flux -- hasPermission() avec fallback preset

```
hasPermission(companyId, principalType, principalId, permissionKey, resourceScope?)
    |
    v
getMembership(companyId, principalType, principalId)
    |
    ├── membership null ou status !== "active"? --> return false
    |
    v
Query principal_permission_grants WHERE (company, principal, key)
    |
    ├── Grant explicite trouve?
    |   ├── OUI --> Evaluer scope du grant (logique existante RBAC-S01)
    |   |          ├── resourceScope non demande? --> return true
    |   |          ├── grant.scope null/vide? --> return true (wildcard)
    |   |          └── grant.scope couvre resourceScope? --> true/false
    |   |
    |   └── NON --> Fallback sur preset businessRole
    |               |
    |               v
    |           membership.businessRole existe?
    |               ├── NON --> return false
    |               └── OUI --> isPermissionInPreset(businessRole, permissionKey)?
    |                           ├── OUI --> return true (acces global, couvre tout scope)
    |                           └── NON --> return false
    |
    v
(fin)
```

---

## Schema de Donnees

### Pas de migration DB dans cette story

Les presets sont des constantes TypeScript, pas des donnees en base. La table `principal_permission_grants` n'est pas modifiee. Les 5 nouvelles permission keys sont ajoutees au type `PermissionKey` mais pas inserees comme grants -- elles sont accessibles via les presets.

### PERMISSION_KEYS final (20 keys)

```typescript
// Domaine agents (3)
"agents:create"           // Creer un agent
"agents:launch"           // Lancer/demarrer un agent  [NOUVEAU]
"agents:manage_containers" // Gerer les containers d'agents

// Domaine users (2)
"users:invite"            // Inviter des utilisateurs
"users:manage_permissions" // Gerer les permissions des membres

// Domaine tasks (2)
"tasks:assign"            // Assigner des taches
"tasks:assign_scope"      // Gerer le scope des assignations

// Domaine joins (1)
"joins:approve"           // Approuver les demandes d'adhesion

// Domaine projects (2)
"projects:create"         // Creer des projets
"projects:manage_members" // Gerer les membres de projets

// Domaine workflows (2)
"workflows:create"        // Creer des workflows
"workflows:enforce"       // Activer l'enforcement des workflows

// Domaine company (2)
"company:manage_settings" // Gerer les parametres company
"company:manage_sso"      // Gerer la configuration SSO

// Domaine audit (2)
"audit:read"              // Consulter l'audit log
"audit:export"            // Exporter l'audit log

// Domaine stories (2)
"stories:create"          // Creer des stories/issues  [NOUVEAU]
"stories:edit"            // Modifier des stories/issues  [NOUVEAU]

// Domaine dashboard (1)
"dashboard:view"          // Consulter les dashboards  [NOUVEAU]

// Domaine chat (1)
"chat:agent"              // Chatter avec un agent  [NOUVEAU]
```

---

## Risques et Mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Grant explicite avec scope restreint vs preset global | Moyenne | Moyen | La regle est claire : grant explicite a TOUJOURS priorite. Documente dans le code |
| Incoherence preset si PERMISSION_KEYS evolue | Faible | Moyen | Test T1#18 verifie que toutes les keys de preset sont dans PERMISSION_KEYS. Test T1#5 verifie que admin couvre tout |
| Performance : lecture membership + grants + preset | Faible | Faible | Le preset est un lookup memoire O(1), pas de requete DB supplementaire |
| Backward compatibility routes existantes | Faible | CRITIQUE | Le fallback preset est additif : les routes qui fonctionnaient avant continuent. Seuls les utilisateurs sans grants qui avaient businessRole recoivent maintenant des permissions |

---

## Definition of Done

- [ ] 5 nouvelles permission keys ajoutees dans PERMISSION_KEYS (20 total)
- [ ] Fichier `packages/shared/src/rbac-presets.ts` cree avec ROLE_PERMISSION_PRESETS
- [ ] `isPermissionInPreset()` et `getPresetPermissions()` et `getPresetsMatrix()` exportes
- [ ] `hasPermission()` utilise le preset businessRole comme fallback quand aucun grant explicite n'existe
- [ ] `getEffectivePermissions()` ajoute a accessService()
- [ ] Endpoint `GET /api/companies/:companyId/rbac/presets` fonctionnel
- [ ] Endpoint `GET /api/companies/:companyId/rbac/effective-permissions/:memberId` fonctionnel
- [ ] Tests unitaires presets >= 100% couverture
- [ ] Tests unitaires hasPermission fallback >= 95% couverture
- [ ] `pnpm typecheck` passe sans erreur
- [ ] `pnpm test` passe sans regression
- [ ] Pas de secrets en dur, input sanitise
