# RBAC-S01 : Fix hasPermission() -- Scope JSONB -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | RBAC-S01 |
| **Titre** | Fix hasPermission() -- Lecture et validation du scope JSONB |
| **Epic** | Epic 2 -- RBAC & Permissions |
| **Sprint** | Sprint 1 (Phase 2) |
| **Effort** | M (3 SP, 2j) |
| **Priorite** | P0 SECURITE |
| **Assignation** | Tom (backend) |
| **Bloque par** | TECH-07 (Modifications 5 tables -- businessRole + 9 permission keys) |
| **Debloque** | RBAC-S02 (9 permission keys enforcement), RBAC-S04 (Enforcement 22 routes), PROJ-S01 (project_memberships), tout le RBAC |
| **ADR** | ADR-002 (RBAC 4 roles) |
| **Type** | Backend-only (pas de composant UI) |

---

## Description

### Le probleme -- Faille de securite critique (DT1)

La fonction `hasPermission()` dans `server/src/services/access.ts:45-66` **ignore completement** le champ `scope` JSONB de la table `principal_permission_grants`. Le code actuel verifie seulement l'existence d'un grant, sans lire ni evaluer le scope :

```typescript
// ACTUEL -- BROKEN (access.ts:45-66)
async function hasPermission(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  permissionKey: PermissionKey,
): Promise<boolean> {
  const membership = await getMembership(companyId, principalType, principalId);
  if (!membership || membership.status !== "active") return false;
  const grant = await db
    .select({ id: principalPermissionGrants.id })  // <-- Ne lit PAS scope!
    .from(principalPermissionGrants)
    .where(/* ... */)
    .then((rows) => rows[0] ?? null);
  return Boolean(grant);  // <-- Retourne true si le grant existe, scope ignore
}
```

### Consequences de la faille

- Un Contributor avec `tasks:assign` scope `{ projectIds: ["proj-A"] }` peut assigner des taches sur **TOUS** les projets de la company
- Un Agent avec `agents:create` scope restreint peut creer des agents **partout**
- Le champ `scope` dans `principal_permission_grants` est stocke en base mais **jamais evalue**
- **Chaque route qui appelle `hasPermission()` ou `canUser()` est potentiellement vulnerable**

### Routes actuellement affectees

| Fichier | Appels `hasPermission`/`canUser` | Impact |
|---------|----------------------------------|--------|
| `server/src/routes/agents.ts` | 5 appels (`agents:create`) | Agents non scopes |
| `server/src/routes/issues.ts` | 2 appels (`tasks:assign`) | Taches non scopees |
| `server/src/routes/access.ts` | 3 appels (divers) | Permissions non scopees |
| `server/src/routes/sidebar-badges.ts` | 2 appels (`joins:approve`) | Badges non scopes |

### Ce que cette story corrige

1. `hasPermission()` lit le `scope` JSONB du grant et le valide contre un `resourceScope` fourni par l'appelant
2. `canUser()` accepte un `resourceScope` optionnel et le propage a `hasPermission()`
3. Un schema Zod strict valide le scope a l'ecriture (prevention injection)
4. Un middleware factory `requirePermission()` est cree pour simplifier la protection des routes
5. Un evenement d'audit `access.scope_denied` est emis quand un acces scope est refuse

---

## Etat Actuel du Code (Analyse)

### Fichiers impactes

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `server/src/services/access.ts` | Service RBAC, `hasPermission()` sans scope | MODIFIE : lecture scope + validation |
| `packages/shared/src/validators/access.ts` | Zod schemas pour invites/permissions | MODIFIE : ajout `scopeSchema` + `resourceScopeSchema` |
| `server/src/middleware/require-permission.ts` | N'existe pas | CREE : middleware factory |
| `server/src/routes/authz.ts` | `assertCompanyAccess`, `assertBoard`, `getActorInfo` | MODIFIE : re-export `requirePermission` |
| `server/src/__tests__/access-service-scope.test.ts` | N'existe pas | CREE : tests unitaires |

### Fichiers de reference (non modifies dans cette story)

| Fichier | Role |
|---------|------|
| `packages/db/src/schema/principal_permission_grants.ts` | Schema Drizzle -- `scope: jsonb("scope")` deja present |
| `packages/shared/src/constants.ts` | 15 `PERMISSION_KEYS` (6 existantes + 9 ajoutees par TECH-07) |
| `server/src/middleware/auth.ts` | Actor middleware (non modifie) |
| `server/src/types/express.d.ts` | Types `req.actor` (non modifie) |
| `server/src/errors.ts` | `forbidden()`, `unauthorized()`, `unprocessable()` |
| `packages/test-utils/src/factories/permission.factory.ts` | `createTestPermissionGrant()` avec overrides scope |
| `packages/test-utils/src/factories/membership.factory.ts` | `createTestCompanyMembership()` |

### Conventions du codebase (a respecter)

1. **Service pattern** : `accessService(db)` retourne un objet de fonctions -- pas de classes
2. **Error handling** : `throw forbidden("message")`, `throw unprocessable("message")`
3. **Drizzle queries** : `db.select().from().where(and(...))` avec `drizzle-orm` operators
4. **Zod validation** : schemas dans `packages/shared/src/validators/`, `.strict()` pour JSONB
5. **Tests** : Vitest avec `describe`/`it`/`expect`, factories depuis `@mnm/test-utils`
6. **Middleware** : `RequestHandler` type, `(req, res, next) => {}` pattern

---

## Specification Technique Detaillee

### T1 : Ajouter les schemas Zod pour le scope -- `packages/shared/src/validators/access.ts`

#### Schema du scope JSONB (ecriture/stockage)

```typescript
import { z } from "zod";

/**
 * Schema Zod pour le scope JSONB stocke dans principal_permission_grants.scope.
 * .strict() rejette toute cle supplementaire (prevention injection JSONB).
 */
export const scopeSchema = z.object({
  projectIds: z.array(z.string().uuid()).optional(),
}).strict().nullable();

export type PermissionScope = z.infer<typeof scopeSchema>;
```

#### Schema du resource scope (requete/verification)

```typescript
/**
 * Schema Zod pour le scope de la ressource demandee.
 * Passe par l'appelant pour valider l'acces scope.
 */
export const resourceScopeSchema = z.object({
  projectIds: z.array(z.string().uuid()).optional(),
}).strict();

export type ResourceScope = z.infer<typeof resourceScopeSchema>;
```

#### Export dans `packages/shared/src/validators/index.ts`

Ajouter le re-export des nouveaux types :

```typescript
export { scopeSchema, resourceScopeSchema } from "./access.js";
export type { PermissionScope, ResourceScope } from "./access.js";
```

#### Mise a jour du schema `updateMemberPermissionsSchema`

Remplacer le `scope` generique par le schema strict :

```typescript
// AVANT
export const updateMemberPermissionsSchema = z.object({
  grants: z.array(
    z.object({
      permissionKey: z.enum(PERMISSION_KEYS),
      scope: z.record(z.string(), z.unknown()).optional().nullable(),
    }),
  ),
});

// APRES
export const updateMemberPermissionsSchema = z.object({
  grants: z.array(
    z.object({
      permissionKey: z.enum(PERMISSION_KEYS),
      scope: scopeSchema.optional(),
    }),
  ),
});
```

#### Backward Compatibility

- Le schema `scopeSchema` accepte `null` (grant global) et `{ projectIds: [...] }` (grant scope)
- Les grants existants avec `scope: null` continuent a fonctionner comme acces global
- `.strict()` rejette les cles inconnues, mais les grants existants valides ne sont pas affectes

---

### T2 : Corriger `hasPermission()` -- `server/src/services/access.ts`

#### Nouvelle signature

```typescript
async function hasPermission(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  permissionKey: PermissionKey,
  resourceScope?: { projectIds?: string[] },
): Promise<boolean>
```

#### Logique corrigee

```typescript
async function hasPermission(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  permissionKey: PermissionKey,
  resourceScope?: { projectIds?: string[] },
): Promise<boolean> {
  const membership = await getMembership(companyId, principalType, principalId);
  if (!membership || membership.status !== "active") return false;

  // Lire le grant AVEC le scope
  const grants = await db
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
    );

  if (grants.length === 0) return false;

  // Pas de scope requis par l'appelant => le grant suffit
  if (!resourceScope) return true;

  // Evaluer chaque grant -- un seul couvrant le scope suffit (OR logic)
  for (const grant of grants) {
    const grantScope = grant.scope as Record<string, unknown> | null;

    // Grant sans scope = acces global wildcard
    if (!grantScope || Object.keys(grantScope).length === 0) return true;

    // Verifier projectIds
    if (resourceScope.projectIds && resourceScope.projectIds.length > 0) {
      const allowedProjects = grantScope.projectIds;
      if (!Array.isArray(allowedProjects)) continue;

      const allCovered = resourceScope.projectIds.every(
        (pid: string) => allowedProjects.includes(pid),
      );
      if (allCovered) return true;
    }
  }

  return false;
}
```

#### Regles d'evaluation du scope

| Scenario | `grant.scope` | `resourceScope` | Resultat |
|----------|--------------|-----------------|----------|
| Grant global, pas de scope requis | `null` | `undefined` | `true` |
| Grant global, scope requis | `null` | `{ projectIds: ["A"] }` | `true` (wildcard) |
| Grant scope, pas de scope requis | `{ projectIds: ["A"] }` | `undefined` | `true` |
| Grant scope, scope couvert | `{ projectIds: ["A","B"] }` | `{ projectIds: ["A"] }` | `true` |
| Grant scope, scope non couvert | `{ projectIds: ["A"] }` | `{ projectIds: ["B"] }` | `false` |
| Grant scope vide, scope requis | `{}` | `{ projectIds: ["A"] }` | `true` (wildcard) |
| Pas de grant | (aucun) | N/A | `false` |

---

### T3 : Mettre a jour `canUser()` -- `server/src/services/access.ts`

#### Nouvelle signature

```typescript
async function canUser(
  companyId: string,
  userId: string | null | undefined,
  permissionKey: PermissionKey,
  resourceScope?: { projectIds?: string[] },
): Promise<boolean> {
  if (!userId) return false;
  if (await isInstanceAdmin(userId)) return true;
  return hasPermission(companyId, "user", userId, permissionKey, resourceScope);
}
```

#### Important : Instance admins et scope

Les instance admins (verifie via `isInstanceAdmin()`) ont un acces global sans verification de scope. C'est le comportement voulu : un instance admin peut tout faire sur toute l'instance, y compris tous les projets de toutes les companies.

---

### T4 : Valider le scope a l'ecriture -- `server/src/services/access.ts`

#### Validation dans `setMemberPermissions()` et `setPrincipalGrants()`

Ajouter une validation Zod du scope avant chaque ecriture de grant :

```typescript
import { scopeSchema } from "@mnm/shared";

function validateScope(scope: unknown): Record<string, unknown> | null {
  const result = scopeSchema.safeParse(scope);
  if (!result.success) {
    throw unprocessable("Invalid permission scope: " + result.error.message);
  }
  return result.data;
}
```

Appeler `validateScope(grant.scope)` dans les deux fonctions `setMemberPermissions()` et `setPrincipalGrants()` avant l'insert en base :

```typescript
// Dans setMemberPermissions() et setPrincipalGrants()
grants.map((grant) => ({
  // ...
  scope: validateScope(grant.scope) ?? null,
  // ...
})),
```

#### Securite

- `.strict()` dans `scopeSchema` bloque les cles arbitraires (ex: `{ projectIds: [...], sqlInjection: "..." }`)
- `.uuid()` dans `z.array(z.string().uuid())` assure que les `projectIds` sont des UUID valides
- Les requetes Drizzle utilisent des parametres prepares, pas de concatenation SQL

---

### T5 : Creer le middleware `requirePermission()` -- `server/src/middleware/require-permission.ts`

#### Middleware factory

```typescript
import type { Request, Response, NextFunction } from "express";
import type { PermissionKey } from "@mnm/shared";
import { assertCompanyAccess } from "../routes/authz.js";
import { forbidden, unauthorized, badRequest } from "../errors.js";
import { accessService } from "../services/access.js";
import type { Db } from "@mnm/db";

export type ScopeExtractor = (req: Request) => { projectIds?: string[] } | undefined;

export function requirePermission(
  db: Db,
  permissionKey: PermissionKey,
  extractScope?: ScopeExtractor,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const companyId = req.params.companyId;
    if (!companyId) {
      return next(badRequest("companyId required in route params"));
    }

    assertCompanyAccess(req, companyId);

    const scope = extractScope?.(req);
    const access = accessService(db);

    // Local implicit (local_trusted mode) -- bypass permission check
    if (req.actor.type === "board" && req.actor.source === "local_implicit") {
      return next();
    }

    if (req.actor.type === "board") {
      const allowed = await access.canUser(companyId, req.actor.userId, permissionKey, scope);
      if (!allowed) {
        // Emit scope_denied event if scope was the reason
        if (scope) {
          emitScopeDeniedEvent(req, companyId, permissionKey, scope);
        }
        return next(forbidden(`Permission denied: ${permissionKey}`));
      }
    } else if (req.actor.type === "agent") {
      if (!req.actor.agentId) {
        return next(forbidden("Agent authentication required"));
      }
      const allowed = await access.hasPermission(
        companyId, "agent", req.actor.agentId, permissionKey, scope,
      );
      if (!allowed) {
        if (scope) {
          emitScopeDeniedEvent(req, companyId, permissionKey, scope);
        }
        return next(forbidden(`Permission denied: ${permissionKey}`));
      }
    } else {
      return next(unauthorized());
    }

    next();
  };
}

function emitScopeDeniedEvent(
  req: Request,
  companyId: string,
  permissionKey: PermissionKey,
  scope: { projectIds?: string[] },
) {
  // Log structured event for audit trail
  // Note: Full audit_events table integration will come in OBS-S01/OBS-S02.
  // For now, log to structured logger for traceability.
  const actorId = req.actor.type === "board"
    ? req.actor.userId ?? "unknown"
    : req.actor.agentId ?? "unknown";

  // Using console.warn with structured data until audit service is available
  console.warn(JSON.stringify({
    event: "access.scope_denied",
    companyId,
    actorType: req.actor.type,
    actorId,
    permissionKey,
    requestedScope: scope,
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  }));
}
```

#### Usage prevu (pour RBAC-S04)

```typescript
// Route sans scope -- permission company-wide
router.post("/companies/:companyId/agents",
  requirePermission(db, "agents:create"),
  async (req, res) => { /* ... */ }
);

// Route avec scope projet
router.post("/companies/:companyId/projects/:projectId/issues",
  requirePermission(db, "tasks:assign", (req) => ({
    projectIds: [req.params.projectId],
  })),
  async (req, res) => { /* ... */ }
);

// Route avec scope depuis query params
router.get("/companies/:companyId/agents",
  requirePermission(db, "agents:create", (req) => {
    const projectId = typeof req.query.projectId === "string"
      ? req.query.projectId : undefined;
    return projectId ? { projectIds: [projectId] } : undefined;
  }),
  async (req, res) => { /* ... */ }
);
```

**Note** : Le middleware `requirePermission()` n'est pas deploye sur les routes dans cette story. Il est cree et teste ici, puis deploye dans RBAC-S04 (Enforcement 22 routes). Cette story se concentre sur la fondation : le fix du moteur de permissions.

---

### T6 : Mise a jour du type `GrantInput` -- `server/src/services/access.ts`

Le type `GrantInput` doit utiliser le type `PermissionScope` de Zod :

```typescript
// AVANT
type GrantInput = {
  permissionKey: PermissionKey;
  scope?: Record<string, unknown> | null;
};

// APRES
import type { PermissionScope } from "@mnm/shared";

type GrantInput = {
  permissionKey: PermissionKey;
  scope?: PermissionScope;
};
```

---

### T7 : Evenement d'audit `access.scope_denied`

#### Format de l'evenement

```typescript
{
  event: "access.scope_denied",
  companyId: string,
  actorType: "board" | "agent",
  actorId: string,          // userId ou agentId
  permissionKey: string,    // ex: "tasks:assign"
  requestedScope: {
    projectIds?: string[],  // ex: ["proj-B"]
  },
  method: string,           // ex: "GET"
  path: string,             // ex: "/api/companies/xxx/agents?projectId=proj-B"
  timestamp: string,        // ISO 8601
}
```

#### Implementation temporaire

Tant que la table `audit_events` n'existe pas (OBS-S01), l'evenement est emis via `console.warn` avec un JSON structure. L'integration avec le service d'audit sera faite dans OBS-S02.

L'evenement est emis dans deux endroits :
1. Le middleware `requirePermission()` (pour les futures routes protegees)
2. Directement dans les routes qui appellent manuellement `canUser()`/`hasPermission()` avec un scope (adaptation progressive)

---

## Acceptance Criteria

### AC-01 : Scope restreint bloque l'acces hors scope

```
Given un Contributor avec le grant "tasks:assign" scope { projectIds: ["proj-A"] }
When il envoie une requete avec projectId=proj-B
Then la reponse est 403 Forbidden
And l'evenement "access.scope_denied" est emis avec les details
```

**data-testid** : N/A (backend-only, pas de composant UI)

### AC-02 : Scope restreint autorise l'acces dans le scope

```
Given un Contributor avec le grant "tasks:assign" scope { projectIds: ["proj-A"] }
When il envoie une requete avec projectId=proj-A
Then la requete est autorisee (pas de 403)
And les donnees du projet A sont retournees
```

### AC-03 : Scope global autorise tout

```
Given un Contributor avec le grant "agents:create" scope null (global)
When il envoie une requete avec projectId=proj-X (n'importe quel projet)
Then la requete est autorisee
```

### AC-04 : Scope vide est traite comme global

```
Given un Contributor avec le grant "agents:create" scope {} (objet vide)
When il envoie une requete avec projectId=proj-X
Then la requete est autorisee (scope vide = wildcard)
```

### AC-05 : Pas de grant retourne false

```
Given un Contributor SANS le grant "agents:create"
When hasPermission() est appele avec permissionKey "agents:create"
Then la fonction retourne false
```

### AC-06 : Membre inactif retourne false

```
Given un utilisateur avec un membership status "suspended"
And un grant "tasks:assign" scope null
When hasPermission() est appele
Then la fonction retourne false
```

### AC-07 : Instance admin bypass le scope

```
Given un utilisateur instance_admin
When canUser() est appele avec n'importe quel permissionKey et scope
Then la fonction retourne true sans verifier les grants
```

### AC-08 : Validation du scope a l'ecriture

```
Given un appel a setMemberPermissions() avec scope { projectIds: ["not-a-uuid"], extraField: true }
When le scope est valide par Zod
Then une erreur 422 est retournee avec le detail de validation
And le grant n'est PAS insere en base
```

### AC-09 : Backward compatibility -- appels sans scope

```
Given le code existant qui appelle canUser(companyId, userId, "agents:create") sans scope
When la nouvelle version est deployee
Then le comportement est identique a avant (permission globale, scope ignore)
And aucune route existante ne casse
```

### AC-10 : Middleware requirePermission -- acces refuse

```
Given un middleware requirePermission("agents:create") sur une route
And un utilisateur avec le grant "agents:create" scope { projectIds: ["proj-A"] }
When la route est appelee avec projectId=proj-B dans les params
Then la reponse est 403
And l'evenement "access.scope_denied" est emis
```

### AC-11 : Middleware requirePermission -- acces autorise

```
Given un middleware requirePermission("agents:create", (req) => ({ projectIds: [req.params.projectId] }))
And un utilisateur avec le grant "agents:create" scope { projectIds: ["proj-A"] }
When la route est appelee avec projectId=proj-A
Then la requete passe au handler suivant (next())
```

---

## Plan de Tests Unitaires

### Fichier : `server/src/__tests__/access-service-scope.test.ts`

#### Tests hasPermission avec scope

| # | Test | Grant scope | Resource scope | Expected |
|---|------|-------------|----------------|----------|
| 1 | Grant existe, pas de scope requis | `null` | `undefined` | `true` |
| 2 | Grant existe avec scope, pas de scope requis | `{ projectIds: ["A"] }` | `undefined` | `true` |
| 3 | Grant global, scope requis | `null` | `{ projectIds: ["A"] }` | `true` |
| 4 | Grant scope couvert | `{ projectIds: ["A","B"] }` | `{ projectIds: ["A"] }` | `true` |
| 5 | Grant scope exact | `{ projectIds: ["A"] }` | `{ projectIds: ["A"] }` | `true` |
| 6 | Grant scope non couvert | `{ projectIds: ["A"] }` | `{ projectIds: ["B"] }` | `false` |
| 7 | Grant scope partiel | `{ projectIds: ["A"] }` | `{ projectIds: ["A","B"] }` | `false` |
| 8 | Scope vide = wildcard | `{}` | `{ projectIds: ["A"] }` | `true` |
| 9 | Pas de grant | (aucun) | `undefined` | `false` |
| 10 | Membership inactive | `null` | `undefined` | `false` |
| 11 | Membership suspended | `null` | `{ projectIds: ["A"] }` | `false` |
| 12 | Grant scope projectIds vide | `{ projectIds: [] }` | `{ projectIds: ["A"] }` | `false` |
| 13 | Multiple grants OR logic | Grant1: `{ projectIds: ["A"] }`, Grant2: `{ projectIds: ["B"] }` | `{ projectIds: ["B"] }` | `true` |

#### Tests canUser avec scope

| # | Test | Expected |
|---|------|----------|
| 14 | canUser propage le scope a hasPermission | Scope passe correctement |
| 15 | canUser avec userId null | `false` |
| 16 | canUser avec instance admin bypass scope | `true` sans verifier grants |

#### Tests validation scope (ecriture)

| # | Test | Input scope | Expected |
|---|------|-------------|----------|
| 17 | Scope null valide | `null` | OK |
| 18 | Scope avec projectIds valides | `{ projectIds: ["uuid-1"] }` | OK |
| 19 | Scope avec projectIds non-UUID | `{ projectIds: ["not-uuid"] }` | 422 |
| 20 | Scope avec cle supplementaire | `{ projectIds: [], evil: "x" }` | 422 |
| 21 | Scope type invalide | `"string"` | 422 |
| 22 | Scope avec projectIds non-array | `{ projectIds: "uuid" }` | 422 |

#### Tests middleware requirePermission

| # | Test | Expected |
|---|------|----------|
| 23 | Route sans companyId param | 400 Bad Request |
| 24 | Actor type "none" | 401 Unauthorized |
| 25 | Board user avec permission et scope valide | next() |
| 26 | Board user sans permission | 403 |
| 27 | Board user avec scope non couvert | 403 + event emis |
| 28 | Agent avec permission et scope valide | next() |
| 29 | Agent sans agentId | 403 |
| 30 | Local implicit board bypass | next() sans check |
| 31 | Scope extractor retourne undefined | Permission check sans scope |

### Couverture cible

| Module | Couverture cible |
|--------|-----------------|
| `hasPermission()` + scope logic | >= 95% |
| `canUser()` avec scope | >= 95% |
| `validateScope()` | 100% |
| `requirePermission()` middleware | >= 90% |

---

## Schema de Donnees

### Table `principal_permission_grants` (existante -- pas de modification)

```sql
CREATE TABLE principal_permission_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  scope JSONB,                    -- <-- CE CHAMP, ENFIN LU !
  granted_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, principal_type, principal_id, permission_key)
);
```

### Format du scope JSONB

```typescript
// Scope null = acces global (wildcard) a toute la company
null

// Scope avec projectIds = acces restreint aux projets specifies
{
  "projectIds": ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"]
}

// Scope vide = traite comme wildcard (global)
{}
```

**Note sur l'unique constraint** : L'index unique sur `(company_id, principal_type, principal_id, permission_key)` signifie qu'un principal ne peut avoir qu'UN SEUL grant par permission key par company. Cela simplifie la logique : pas besoin de gerer plusieurs grants pour la meme permission (contrairement a ce qui est mentionne dans l'architecture -- la contrainte en base empeche ce cas). Si un principal a besoin d'acceder a plusieurs projets, le scope doit lister TOUS les projectIds dans un seul grant.

**Mise a jour du test #13** : Le scenario "multiple grants OR logic" n'est possible que si deux grants ont des `permissionKey` differentes. Pour le meme `permissionKey`, l'unique constraint empeche les doublons. Le test #13 est donc invalide tel quel et doit etre adapte : on teste plutot que si le grant unique couvre le scope, ca fonctionne.

---

## Diagramme de Flux

```
Requete HTTP
    |
    v
actorMiddleware (auth.ts)
    |  → identifie l'actor (board/agent/none)
    v
requirePermission(key, scopeExtractor?) [middleware]
    |
    ├── companyId dans params? → sinon 400
    ├── assertCompanyAccess(req, companyId)
    ├── local_implicit? → bypass, next()
    |
    ├── actor.type === "board"
    |   └── canUser(companyId, userId, key, scope)
    |       ├── isInstanceAdmin? → true (bypass)
    |       └── hasPermission(companyId, "user", userId, key, scope)
    |           ├── getMembership → actif?
    |           ├── query grants WHERE (company, principal, key)
    |           ├── grants.length === 0? → false
    |           ├── !resourceScope? → true (pas de scope requis)
    |           └── for each grant:
    |               ├── grant.scope null/vide? → true (wildcard)
    |               └── grant.scope.projectIds couvre resourceScope.projectIds? → true
    |           └── aucun grant ne couvre → false
    |
    ├── actor.type === "agent"
    |   └── hasPermission(companyId, "agent", agentId, key, scope)
    |       └── (meme logique que ci-dessus)
    |
    └── actor.type === "none" → 401

    Si refuse:
    ├── scope present? → emitScopeDeniedEvent()
    └── 403 Forbidden
```

---

## Risques et Mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Regression sur les routes existantes | Faible | CRITIQUE | Le 5eme parametre est optionnel, les appels existants ne changent pas |
| Performance : requete supplementaire pour le scope | Faible | Faible | On lit deja le grant, on ajoute juste `scope` au SELECT -- meme requete |
| Injection JSONB via scope malveillant | Faible | CRITIQUE | Validation Zod `.strict()` + `.uuid()` + requetes parametrees Drizzle |
| Unique constraint empeche multi-grants | N/A | Moyen | Design documente : un grant par permission key, scope liste tous les projets |

---

## Definition of Done

- [ ] `hasPermission()` lit le champ `scope` et le valide contre le `resourceScope`
- [ ] `canUser()` accepte un `resourceScope` optionnel
- [ ] Schema Zod `scopeSchema` avec `.strict()` valide le scope a l'ecriture
- [ ] Middleware `requirePermission()` cree et fonctionnel
- [ ] Evenement `access.scope_denied` emis sur refus de scope
- [ ] Backward compatibility : tous les appels existants sans scope fonctionnent
- [ ] Tests unitaires >= 95% couverture sur `hasPermission`/`canUser`
- [ ] `pnpm typecheck` passe sans erreur
- [ ] `pnpm test` passe sans regression
- [ ] Pas de secrets en dur, input sanitise
