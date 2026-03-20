# PROJ-S03 : Filtrage Agents/Issues/Workflows par Scope Projet

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | PROJ-S03 |
| **Titre** | Filtrage Agents/Issues/Workflows par Scope Projet |
| **Epic** | Epic PROJ -- Scoping par Projet |
| **Sprint** | Sprint 5 (Batch 8) |
| **Effort** | M (5 SP, 3-5j) |
| **Priorite** | P0 -- Isolation fine des donnees par projet au sein d'une company |
| **Assignation** | Tom (backend) |
| **Bloque par** | PROJ-S02 (Service project-memberships avance -- DONE) |
| **Debloque** | PROJ-S04 (Page ProjectAccess UI), securite B2B multi-projet |
| **ADR** | ADR-001 (Multi-tenant RLS PostgreSQL), ADR-002 (RBAC + Scope JSONB) |
| **Type** | Backend + Frontend (service middleware, routes, hooks UI) |
| **FRs couverts** | FR-PROJ (Phase 3 scoping par projet), INV-04 (scope JSONB lu et applique) |

---

## Description

### Contexte -- Pourquoi cette story est necessaire

PROJ-S02 a fourni `getUserProjectIds(companyId, userId)` et la synchronisation automatique du scope JSONB dans `principal_permission_grants`. Cependant, aucune route API ne filtre actuellement les donnees par les projets auxquels l'utilisateur a acces.

Le probleme actuel :
- Un Contributor avec `scope: { projectIds: ["proj-A"] }` peut voir TOUS les issues, workflows et drift reports de la company, pas seulement ceux de `proj-A`
- `GET /api/companies/:companyId/issues` retourne toutes les issues de la company sans filtrage par scope projet
- `GET /api/companies/:companyId/workflows` retourne tous les workflows sans filtrage
- `GET /api/companies/:companyId/projects` retourne tous les projets sans filtrage
- Les routes drift (`GET /drift/reports`, `GET /drift/alerts`) retournent les donnees de tous les projets
- C'est une faille de securite : un user scoped ne devrait voir que les entites de ses projets

### Ce que cette story construit

1. **Middleware `extractProjectScope`** -- Un middleware/helper qui extrait les projectIds accessibles pour l'utilisateur courant via `getUserProjectIds()`. Les Admins/Managers sans scope restriction voient tout. Les Contributors/Viewers scoped ne voient que leurs projets.

2. **Helper service `scopeFilter`** -- Un service utilitaire `createScopeFilter(companyId, userId, userRole)` qui retourne soit `null` (acces global -- pas de filtrage) soit `string[]` (liste de projectIds autorises). Utilise par toutes les routes filtrees.

3. **Filtrage sur 6 routes GET existantes** :
   - `GET /api/companies/:companyId/issues` -- WHERE `projectId IN (user_project_ids)` ou projectId IS NULL
   - `GET /api/companies/:companyId/workflows` -- WHERE `projectId IN (user_project_ids)` ou projectId IS NULL
   - `GET /api/companies/:companyId/projects` -- WHERE `id IN (user_project_ids)` (filtre les projets eux-memes)
   - `GET /api/drift/companies/:companyId/reports` -- WHERE `projectId IN (user_project_ids)`
   - `GET /api/drift/companies/:companyId/alerts` -- WHERE `projectId IN (user_project_ids)` ou pas de projectId
   - `GET /api/companies/:companyId/agents` -- agents non scoped par projectId (pas de colonne projectId sur agents), mais filtrage indirect : ne retourner que les agents des projets accessibles via leurs issues assignees

4. **Filtrage sur routes single-entity GET** :
   - `GET /api/issues/:id` -- verifier que l'issue appartient a un projet accessible
   - `GET /api/workflows/:id` -- verifier que le workflow appartient a un projet accessible
   - `GET /api/drift/reports/:id` -- verifier que le drift report appartient a un projet accessible

5. **Hook frontend `useProjectScope`** -- Un hook React qui expose les projectIds accessibles pour l'utilisateur courant (pour filtrage cote UI si necessaire).

6. **Audit events** -- Emission d'un audit event `access.scope_filtered` quand un utilisateur tente d'acceder a une entite hors de son scope.

### Ce que cette story NE fait PAS (scope)

- Pas de modification du schema DB (pas de nouvelle migration)
- Pas de modification de `hasPermission()` ou `canUser()` (deja corriges par RBAC-S01)
- Pas de modification du service `project-memberships.ts` (getUserProjectIds deja fourni par PROJ-S02)
- Pas de filtrage sur les routes de mutation (POST/PUT/DELETE) -- le `requirePermission` avec scope JSONB gere deja cela via RBAC-S01
- Pas de UI page ProjectAccess (PROJ-S04)
- Pas de filtrage des agents par projectId direct (agents n'ont pas de colonne projectId)
- Pas de filtrage sur les routes `costs`, `activity`, `sidebar-badges` (hors scope, pas de projectId direct ou donnees agregees)

---

## Etat Actuel du Code (Analyse)

### Service project-memberships (PROJ-S02 -- DONE)

`server/src/services/project-memberships.ts` fournit :
```typescript
getUserProjectIds: async (companyId: string, userId: string): Promise<string[]>
```

### Routes impactees -- Issues

`server/src/routes/issues.ts` (45K, ~1100 lignes) :
- `GET /companies/:companyId/issues` : appelle `svc.list(companyId, filters)` avec filtre optionnel `projectId`
- `GET /issues/:issueId` : retourne une issue par ID avec `assertCompanyAccess`
- Le service `issueService.list()` accepte deja un filtre `projectId?: string` mais c'est un filtre utilisateur explicite, pas un scope enforcement

### Routes impactees -- Workflows

`server/src/routes/workflows.ts` (~200 lignes) :
- `GET /companies/:companyId/workflows` : appelle `svc.listInstances(companyId, filters)` avec filtre optionnel `projectId`
- `GET /workflows/:id` : retourne un workflow par ID avec `assertCompanyAccess`
- Le service `workflowService.listInstances()` accepte `{ status?, projectId? }`

### Routes impactees -- Projects

`server/src/routes/projects.ts` (~650 lignes) :
- `GET /companies/:companyId/projects` : appelle `svc.list(companyId)` -- retourne TOUS les projets
- Doit etre filtre pour les users scoped

### Routes impactees -- Drift

`server/src/routes/drift.ts` (~300 lignes) :
- `GET /drift/companies/:companyId/reports` : retourne les drift reports par company
- `GET /drift/companies/:companyId/alerts` : retourne les alertes actives
- `drift_reports` a `projectId NOT NULL`

### Schemas DB avec projectId

| Table | Colonne projectId | Nullable | Index |
|-------|-------------------|----------|-------|
| `issues` | `project_id` | OUI (nullable) | `issues_company_project_idx` |
| `workflow_instances` | `project_id` | OUI (nullable) | `workflow_instances_company_project_idx` |
| `drift_reports` | `project_id` | NON (not null) | `drift_reports_company_project_idx` |
| `cost_events` | `project_id` | OUI (nullable) | aucun |
| `chat_channels` | `project_id` | OUI (nullable) | `chat_channels_company_project_idx` |
| `project_goals` | `project_id` | NON (not null) | `project_goals_project_idx` |

### Fichiers de reference (non modifies directement)

| Fichier | Role |
|---------|------|
| `server/src/services/project-memberships.ts` | `getUserProjectIds()` -- deja DONE |
| `server/src/services/access.ts` | `hasPermission()` + `canUser()` -- scope JSONB lu |
| `packages/db/src/schema/issues.ts` | Schema issues avec projectId nullable |
| `packages/db/src/schema/workflow_instances.ts` | Schema workflows avec projectId nullable |
| `packages/db/src/schema/drift_reports.ts` | Schema drift avec projectId NOT NULL |

---

## Architecture

### Strategie de filtrage scope

Le filtrage suit une strategie en deux niveaux :

**Niveau 1 -- Determination du scope** :
Un helper `getScopeProjectIds(db, companyId, req)` determine si l'utilisateur a un scope restreint :
- Si l'utilisateur est un Agent (API key) : pas de filtrage scope (agents operent dans leur contexte)
- Si l'utilisateur est un board user :
  - Si `local_implicit` ou `isInstanceAdmin` : pas de filtrage (acces global)
  - Sinon : appeler `getUserProjectIds(companyId, userId)` et verifier si l'utilisateur a des grants avec `scope.projectIds`
  - Si l'utilisateur a des grants avec `scope: null` (acces global) pour au moins une permission pertinente : pas de filtrage
  - Si l'utilisateur a des grants avec `scope.projectIds` : retourner ces projectIds comme filtre

**Niveau 2 -- Application du filtre** :
- Pour les routes LIST : ajouter `WHERE projectId IN (...) OR projectId IS NULL` (les entites sans projet restent visibles)
- Pour les routes GET single : verifier que l'entite appartient a un projet accessible ou n'a pas de projectId
- Si l'entite est hors scope : retourner `403 Forbidden` avec audit event

**Cas special -- entites sans projectId** :
Les issues et workflows avec `projectId IS NULL` sont visibles par tous les utilisateurs de la company (ils ne sont rattaches a aucun projet specifique). C'est le comportement attendu : les entites "orphelines" restent accessibles.

### Flow de donnees

```
GET /api/companies/:companyId/issues
  -> assertCompanyAccess(req, companyId)
  -> scopeProjectIds = await getScopeProjectIds(db, companyId, req)
  -> if (scopeProjectIds !== null) {
       // User is scoped -- add project filter
       filters.allowedProjectIds = scopeProjectIds
     }
  -> svc.list(companyId, filters)
     -> WHERE companyId = ? AND (projectId IN (...) OR projectId IS NULL)
  -> res.json(result)
```

```
GET /api/issues/:issueId
  -> issue = await svc.getById(issueId)
  -> assertCompanyAccess(req, issue.companyId)
  -> scopeProjectIds = await getScopeProjectIds(db, issue.companyId, req)
  -> if (scopeProjectIds !== null && issue.projectId !== null) {
       if (!scopeProjectIds.includes(issue.projectId)) {
         emitAudit("access.scope_denied")
         throw forbidden("Access denied: issue outside project scope")
       }
     }
  -> res.json(issue)
```

### Strategie pour le GET projects filtre

```
GET /api/companies/:companyId/projects
  -> assertCompanyAccess(req, companyId)
  -> scopeProjectIds = await getScopeProjectIds(db, companyId, req)
  -> if (scopeProjectIds !== null) {
       // Only return projects the user is a member of
       result = await svc.listByIds(companyId, scopeProjectIds)
     } else {
       result = await svc.list(companyId)
     }
  -> res.json(result)
```

---

## Acceptance Criteria

### AC-1 : Filtrage issues par scope -- utilisateur scoped

**Given** un Contributor avec `scope: { projectIds: ["proj-A", "proj-B"] }` et 5 issues dans proj-A, 3 dans proj-B, 10 dans proj-C, 2 sans projet
**When** il appelle `GET /api/companies/:companyId/issues`
**Then** il recoit 10 issues (5 + 3 + 2 sans projet), pas les 10 de proj-C

### AC-2 : Filtrage issues par scope -- admin (pas de filtrage)

**Given** un Admin avec `scope: null` (acces global) et 20 issues dans la company
**When** il appelle `GET /api/companies/:companyId/issues`
**Then** il recoit les 20 issues (aucun filtrage)

### AC-3 : Acces issue single -- hors scope

**Given** un Contributor scope sur `["proj-A"]` et une issue dans `proj-C`
**When** il appelle `GET /api/issues/:issueId` pour l'issue de proj-C
**Then** il recoit `403 Forbidden` avec `{ error: "SCOPE_DENIED", projectId: "proj-C" }`
**And** un `audit_event` `access.scope_denied` est emis

### AC-4 : Acces issue single -- issue sans projet

**Given** un Contributor scope sur `["proj-A"]` et une issue avec `projectId: null`
**When** il appelle `GET /api/issues/:issueId` pour cette issue
**Then** il recoit l'issue normalement (les issues sans projet sont accessibles)

### AC-5 : Filtrage workflows par scope

**Given** un Contributor scope sur `["proj-A"]` et 3 workflows dans proj-A, 2 dans proj-B, 1 sans projet
**When** il appelle `GET /api/companies/:companyId/workflows`
**Then** il recoit 4 workflows (3 de proj-A + 1 sans projet)

### AC-6 : Acces workflow single -- hors scope

**Given** un Contributor scope sur `["proj-A"]` et un workflow dans `proj-B`
**When** il appelle `GET /api/workflows/:id` pour ce workflow
**Then** il recoit `403 Forbidden` avec `{ error: "SCOPE_DENIED" }`

### AC-7 : Filtrage projets par scope

**Given** un Contributor scope sur `["proj-A", "proj-B"]` et 5 projets dans la company
**When** il appelle `GET /api/companies/:companyId/projects`
**Then** il recoit 2 projets (proj-A et proj-B uniquement)

### AC-8 : Filtrage projets -- admin voit tout

**Given** un Admin et 5 projets dans la company
**When** il appelle `GET /api/companies/:companyId/projects`
**Then** il recoit les 5 projets

### AC-9 : Filtrage drift reports par scope

**Given** un Contributor scope sur `["proj-A"]` et 3 drift reports dans proj-A, 2 dans proj-B
**When** il appelle `GET /api/drift/companies/:companyId/reports`
**Then** il recoit 3 drift reports (ceux de proj-A uniquement)

### AC-10 : Filtrage drift alerts par scope

**Given** un Contributor scope sur `["proj-A"]` et 2 alertes actives (1 pour proj-A, 1 pour proj-B)
**When** il appelle `GET /api/drift/companies/:companyId/alerts`
**Then** il recoit 1 alerte (celle de proj-A uniquement)

### AC-11 : Instance admin bypass scope

**Given** un utilisateur `local_implicit` (instance admin)
**When** il appelle n'importe quelle route GET
**Then** aucun filtrage scope n'est applique (acces global)

### AC-12 : Agent API bypass scope

**Given** un agent authentifie via API key
**When** il appelle `GET /api/companies/:companyId/issues`
**Then** aucun filtrage scope n'est applique (agents operent dans leur contexte)

### AC-13 : Scope helper retourne null pour admin

**Given** un Admin sans restriction scope
**When** `getScopeProjectIds(db, companyId, req)` est appele
**Then** il retourne `null` (signifiant acces global, pas de filtrage)

### AC-14 : Scope helper retourne projectIds pour contributor scoped

**Given** un Contributor membre de proj-A et proj-B
**When** `getScopeProjectIds(db, companyId, req)` est appele
**Then** il retourne `["proj-A-uuid", "proj-B-uuid"]`

### AC-15 : Scope helper retourne tableau vide si aucun projet

**Given** un Contributor qui n'est membre d'aucun projet
**When** `getScopeProjectIds(db, companyId, req)` est appele
**Then** il retourne `[]` (tableau vide -- l'utilisateur ne voit que les entites sans projet)

### AC-16 : Audit event sur acces scope denied

**Given** un Contributor scope qui tente d'acceder a une entite hors scope
**When** l'acces est refuse
**Then** un `audit_event` est emis avec `action: "access.scope_denied"`, `targetType`, `targetId`, `metadata: { requestedProjectId, allowedProjectIds }`

### AC-17 : Filtre explicite projectId reste fonctionnel

**Given** un Admin qui appelle `GET /api/companies/:companyId/issues?projectId=proj-A`
**When** la requete est traitee
**Then** le filtre explicite `projectId` est respecte en plus du scope (intersection)

### AC-18 : Hook useProjectScope frontend

**Given** un utilisateur connecte dans l'UI React
**When** le hook `useProjectScope()` est appele
**Then** il retourne `{ projectIds: string[] | null, isLoading: boolean, isScoped: boolean }`

---

## Specifications Techniques

### Nouveau fichier : `server/src/services/scope-filter.ts`

```typescript
import type { Request } from "express";
import type { Db } from "@mnm/db";
import { projectMembershipService } from "./project-memberships.js";
import { accessService } from "./access.js";

/**
 * Determines the allowed project IDs for the current user.
 * Returns null if the user has global access (no scope restriction).
 * Returns string[] if the user is scoped to specific projects.
 */
export async function getScopeProjectIds(
  db: Db,
  companyId: string,
  req: Request,
): Promise<string[] | null> {
  // Agent API keys bypass scope filtering
  if (req.actor.type === "agent") return null;

  // Board user
  if (req.actor.type === "board") {
    // Instance admin or local implicit = global access
    if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
      return null;
    }

    const userId = req.actor.userId;
    if (!userId) return null;

    // Check if user has any grant with scope: null (global access)
    const access = accessService(db);
    const hasGlobalScope = await access.hasGlobalScope(companyId, userId);
    if (hasGlobalScope) return null;

    // User is scoped -- get their project IDs
    const pmSvc = projectMembershipService(db);
    const projectIds = await pmSvc.getUserProjectIds(companyId, userId);
    return projectIds;
  }

  // Unknown actor type = no filtering (defensive)
  return null;
}
```

### Modification : `server/src/services/access.ts`

Ajouter une methode `hasGlobalScope` au service :

```typescript
hasGlobalScope: async (companyId: string, userId: string): Promise<boolean> => {
  // Check if user has ANY grant with scope: null (global access)
  const grants = await db
    .select({ id: principalPermissionGrants.id, scope: principalPermissionGrants.scope })
    .from(principalPermissionGrants)
    .where(
      and(
        eq(principalPermissionGrants.companyId, companyId),
        eq(principalPermissionGrants.principalType, "user"),
        eq(principalPermissionGrants.principalId, userId),
      ),
    );
  // If any grant has scope: null, user has global access
  return grants.some((g) => g.scope === null);
},
```

### Modification : `server/src/routes/issues.ts`

#### Import scope filter

```typescript
import { getScopeProjectIds } from "../services/scope-filter.js";
```

#### Modification GET /companies/:companyId/issues

```typescript
router.get("/companies/:companyId/issues", async (req, res) => {
  const companyId = req.params.companyId as string;
  assertCompanyAccess(req, companyId);

  // PROJ-S03: Determine scope-based project filtering
  const scopeProjectIds = await getScopeProjectIds(db, companyId, req);

  // ... existing filter parsing ...

  const result = await svc.list(companyId, {
    // ... existing filters ...
    projectId: req.query.projectId as string | undefined,
    allowedProjectIds: scopeProjectIds, // PROJ-S03: scope filter
    // ...
  });
  res.json(result);
});
```

#### Modification GET /issues/:issueId

```typescript
router.get("/issues/:issueId", async (req, res) => {
  const issueId = req.params.issueId as string;
  const issue = await svc.getById(issueId);
  // ... existing company access check ...
  assertCompanyAccess(req, issue.companyId);

  // PROJ-S03: Scope check for single entity
  const scopeProjectIds = await getScopeProjectIds(db, issue.companyId, req);
  if (scopeProjectIds !== null && issue.projectId !== null) {
    if (!scopeProjectIds.includes(issue.projectId)) {
      await emitAudit({
        req, db, companyId: issue.companyId,
        action: "access.scope_denied",
        targetType: "issue",
        targetId: issue.id,
        metadata: { requestedProjectId: issue.projectId, allowedProjectIds: scopeProjectIds },
        severity: "warning",
      });
      throw forbidden("Access denied: resource outside project scope", {
        error: "SCOPE_DENIED",
        projectId: issue.projectId,
      });
    }
  }

  // ... rest of existing handler ...
});
```

### Modification : `server/src/services/issues.ts`

#### Ajout du filtre allowedProjectIds dans list()

Le type `IssueFilters` doit etre enrichi :

```typescript
interface IssueFilters {
  // ... existing filters ...
  projectId?: string;
  allowedProjectIds?: string[] | null; // PROJ-S03: scope-based filtering
  // ...
}
```

Dans la methode `list()` :

```typescript
list: async (companyId: string, filters?: IssueFilters) => {
  const conditions = [eq(issues.companyId, companyId)];

  // ... existing filters ...

  // PROJ-S03: Scope-based project filtering
  if (filters?.allowedProjectIds !== undefined && filters.allowedProjectIds !== null) {
    if (filters.allowedProjectIds.length === 0) {
      // User has no projects -- only show unscoped issues
      conditions.push(sql`${issues.projectId} IS NULL`);
    } else {
      // Show issues from allowed projects + unscoped issues
      conditions.push(
        sql`(${issues.projectId} IS NULL OR ${issues.projectId} IN (${sql.join(
          filters.allowedProjectIds.map((id) => sql`${id}`),
          sql`, `,
        )}))`,
      );
    }
  }

  // Existing explicit projectId filter still applies (intersection)
  if (filters?.projectId) {
    conditions.push(eq(issues.projectId, filters.projectId));
  }

  // ... rest of query ...
},
```

### Modification : `server/src/routes/workflows.ts`

#### Import scope filter

```typescript
import { getScopeProjectIds } from "../services/scope-filter.js";
```

#### Modification GET /companies/:companyId/workflows

```typescript
router.get("/companies/:companyId/workflows", async (req, res) => {
  const companyId = req.params.companyId as string;
  assertCompanyAccess(req, companyId);

  // PROJ-S03: Scope filtering
  const scopeProjectIds = await getScopeProjectIds(db, companyId, req);

  const filters: { status?: string; projectId?: string; allowedProjectIds?: string[] | null } = {};
  if (typeof req.query.status === "string") filters.status = req.query.status;
  if (typeof req.query.projectId === "string") filters.projectId = req.query.projectId;
  filters.allowedProjectIds = scopeProjectIds; // PROJ-S03

  const instances = await svc.listInstances(companyId, filters);
  res.json(instances);
});
```

#### Modification GET /workflows/:id

```typescript
router.get("/workflows/:id", async (req, res) => {
  const instance = await svc.getInstance(req.params.id as string);
  assertCompanyAccess(req, instance.companyId);

  // PROJ-S03: Scope check for single entity
  const scopeProjectIds = await getScopeProjectIds(db, instance.companyId, req);
  if (scopeProjectIds !== null && instance.projectId !== null) {
    if (!scopeProjectIds.includes(instance.projectId)) {
      await emitAudit({
        req, db, companyId: instance.companyId,
        action: "access.scope_denied",
        targetType: "workflow",
        targetId: instance.id,
        metadata: { requestedProjectId: instance.projectId, allowedProjectIds: scopeProjectIds },
        severity: "warning",
      });
      throw forbidden("Access denied: resource outside project scope", {
        error: "SCOPE_DENIED",
        projectId: instance.projectId,
      });
    }
  }

  res.json(instance);
});
```

### Modification : `server/src/services/workflows.ts`

#### Ajout du filtre allowedProjectIds dans listInstances()

```typescript
listInstances: async (
  companyId: string,
  filters?: { status?: string; projectId?: string; allowedProjectIds?: string[] | null },
) => {
  const conditions = [eq(workflowInstances.companyId, companyId)];

  if (filters?.status) {
    conditions.push(eq(workflowInstances.status, filters.status));
  }

  // PROJ-S03: Scope-based project filtering
  if (filters?.allowedProjectIds !== undefined && filters.allowedProjectIds !== null) {
    if (filters.allowedProjectIds.length === 0) {
      conditions.push(sql`${workflowInstances.projectId} IS NULL`);
    } else {
      conditions.push(
        sql`(${workflowInstances.projectId} IS NULL OR ${workflowInstances.projectId} IN (${sql.join(
          filters.allowedProjectIds.map((id) => sql`${id}`),
          sql`, `,
        )}))`,
      );
    }
  }

  // Existing explicit filter
  if (filters?.projectId) {
    conditions.push(eq(workflowInstances.projectId, filters.projectId));
  }

  // ... rest of query ...
},
```

### Modification : `server/src/routes/projects.ts`

#### Import scope filter

```typescript
import { getScopeProjectIds } from "../services/scope-filter.js";
```

#### Modification GET /companies/:companyId/projects

```typescript
router.get("/companies/:companyId/projects", async (req, res) => {
  const companyId = req.params.companyId as string;
  assertCompanyAccess(req, companyId);

  // PROJ-S03: Scope filtering -- only show projects the user is a member of
  const scopeProjectIds = await getScopeProjectIds(db, companyId, req);

  if (scopeProjectIds !== null) {
    if (scopeProjectIds.length === 0) {
      res.json([]);
      return;
    }
    const result = await svc.listByIds(companyId, scopeProjectIds);
    res.json(result);
    return;
  }

  const result = await svc.list(companyId);
  res.json(result);
});
```

### Modification : `server/src/services/projects.ts`

#### Ajout de listByIds()

```typescript
listByIds: async (companyId: string, projectIds: string[]) => {
  if (projectIds.length === 0) return [];
  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.companyId, companyId),
        inArray(projects.id, projectIds),
      ),
    );
},
```

### Modification : `server/src/routes/drift.ts`

#### Import scope filter

```typescript
import { getScopeProjectIds } from "../services/scope-filter.js";
```

#### Modification GET /drift/companies/:companyId/reports

```typescript
// Add scopeProjectIds to the query conditions
const scopeProjectIds = await getScopeProjectIds(db, companyId, req);
// Pass to service which filters drift_reports by projectId IN (scopeProjectIds)
```

#### Modification GET /drift/companies/:companyId/alerts

```typescript
// Same pattern -- filter active alerts by scopeProjectIds
const scopeProjectIds = await getScopeProjectIds(db, companyId, req);
```

### Nouveau fichier : `server/src/services/scope-filter.ts`

Le fichier complet a ete decrit ci-dessus dans la section Architecture.

### Modification : `server/src/services/index.ts`

```typescript
export { getScopeProjectIds } from "./scope-filter.js";
```

### Nouveau hook frontend : `ui/src/hooks/use-project-scope.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useCurrentCompany } from "./use-current-company";
import { useAuth } from "./use-auth";

export function useProjectScope() {
  const { companyId } = useCurrentCompany();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["project-scope", companyId, user?.id],
    queryFn: async () => {
      if (!companyId || !user?.id) return null;
      const res = await api.get(`/companies/${companyId}/users/${user.id}/project-ids`);
      return res.data as { projectIds: string[] };
    },
    enabled: !!companyId && !!user?.id,
    staleTime: 30_000, // Cache for 30s
  });

  return {
    projectIds: data?.projectIds ?? null,
    isLoading,
    isScoped: data?.projectIds !== null && data?.projectIds !== undefined,
  };
}
```

### Exports hook

`ui/src/hooks/index.ts` :
```typescript
export { useProjectScope } from "./use-project-scope.js";
```

---

## data-test-id Mapping

### Convention

Tous les `data-testid` suivent le format `proj-s03-[element]`.
Cette story est principalement backend avec un hook frontend.

### data-testid pour le service scope-filter

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-scope-filter-file` | `server/src/services/scope-filter.ts` | File | Fichier service scope filter |
| `proj-s03-get-scope-fn` | `getScopeProjectIds()` function | Service | Determine les projectIds accessibles |
| `proj-s03-agent-bypass` | Agent API key bypass | Logic | `if (req.actor.type === "agent") return null` |
| `proj-s03-admin-bypass` | Instance admin bypass | Logic | `if (req.actor.source === "local_implicit" \|\| req.actor.isInstanceAdmin)` |
| `proj-s03-global-scope-check` | hasGlobalScope check | Logic | Verifie si grants ont `scope: null` |
| `proj-s03-user-project-ids-call` | getUserProjectIds call | Logic | Appelle `getUserProjectIds(companyId, userId)` |

### data-testid pour access.ts enrichment

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-has-global-scope-fn` | `hasGlobalScope()` function | Service | Verifie si user a un grant avec scope null |
| `proj-s03-has-global-scope-query` | SELECT grants with scope null | Query | `where principalType=user AND principalId=userId` |
| `proj-s03-has-global-scope-some` | `.some(g => g.scope === null)` | Logic | Retourne true si un grant a scope null |

### data-testid pour filtrage routes issues

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-issues-list-scope` | Scope filtering on GET issues list | Route | `getScopeProjectIds()` dans GET /issues |
| `proj-s03-issues-list-allowed` | `allowedProjectIds` filter param | Filter | Passe allowedProjectIds au service |
| `proj-s03-issues-single-scope` | Scope check on GET single issue | Route | Verifie projectId sur GET /issues/:id |
| `proj-s03-issues-scope-denied` | 403 scope denied on single issue | Error | `throw forbidden("SCOPE_DENIED")` |
| `proj-s03-issues-scope-audit` | Audit event on scope denied issue | Audit | `emitAudit("access.scope_denied")` |

### data-testid pour filtrage service issues

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-issues-filter-type` | `allowedProjectIds` in IssueFilters | Type | Interface enrichie |
| `proj-s03-issues-filter-null-only` | projectId IS NULL fallback | Logic | Quand allowedProjectIds = [] |
| `proj-s03-issues-filter-in-or-null` | projectId IN (...) OR IS NULL | Query | Filtrage combine |
| `proj-s03-issues-filter-intersection` | Explicit + scope intersection | Logic | projectId filtre + scope filtre |

### data-testid pour filtrage routes workflows

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-workflows-list-scope` | Scope filtering on GET workflows list | Route | `getScopeProjectIds()` dans GET /workflows |
| `proj-s03-workflows-list-allowed` | `allowedProjectIds` filter param | Filter | Passe allowedProjectIds au service |
| `proj-s03-workflows-single-scope` | Scope check on GET single workflow | Route | Verifie projectId sur GET /workflows/:id |
| `proj-s03-workflows-scope-denied` | 403 scope denied on single workflow | Error | `throw forbidden("SCOPE_DENIED")` |
| `proj-s03-workflows-scope-audit` | Audit event on scope denied workflow | Audit | `emitAudit("access.scope_denied")` |

### data-testid pour filtrage service workflows

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-workflows-filter-type` | `allowedProjectIds` in filters type | Type | Interface enrichie |
| `proj-s03-workflows-filter-null-only` | projectId IS NULL fallback | Logic | Quand allowedProjectIds = [] |
| `proj-s03-workflows-filter-in-or-null` | projectId IN (...) OR IS NULL | Query | Filtrage combine |

### data-testid pour filtrage routes projects

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-projects-list-scope` | Scope filtering on GET projects list | Route | `getScopeProjectIds()` dans GET /projects |
| `proj-s03-projects-list-by-ids` | `listByIds()` call for scoped users | Logic | Appelle `svc.listByIds(companyId, scopeProjectIds)` |
| `proj-s03-projects-empty-scope` | Empty array returns empty list | Logic | `if (scopeProjectIds.length === 0) res.json([])` |

### data-testid pour filtrage service projects

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-projects-list-by-ids-fn` | `listByIds()` function | Service | Nouvelle fonction service |
| `proj-s03-projects-list-by-ids-query` | `WHERE id IN (...)` query | Query | inArray(projects.id, projectIds) |

### data-testid pour filtrage routes drift

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-drift-reports-scope` | Scope filtering on GET drift reports | Route | `getScopeProjectIds()` dans GET /drift/reports |
| `proj-s03-drift-alerts-scope` | Scope filtering on GET drift alerts | Route | `getScopeProjectIds()` dans GET /drift/alerts |
| `proj-s03-drift-reports-filter` | projectId IN (...) filter on reports | Query | Filtrage drift_reports |
| `proj-s03-drift-alerts-filter` | projectId IN (...) filter on alerts | Query | Filtrage drift alerts |

### data-testid pour audit events

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-audit-scope-denied` | `access.scope_denied` event action | Event | Action audit pour refus scope |
| `proj-s03-audit-metadata-project` | metadata.requestedProjectId | Data | ProjectId demande dans metadata |
| `proj-s03-audit-metadata-allowed` | metadata.allowedProjectIds | Data | ProjectIds autorises dans metadata |
| `proj-s03-audit-severity-warning` | severity: "warning" | Data | Severite warning pour scope denied |

### data-testid pour hook frontend

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-use-project-scope-hook` | `useProjectScope()` hook | Hook | Hook React pour scope projet |
| `proj-s03-hook-query-key` | `["project-scope", ...]` query key | Config | Cle de cache React Query |
| `proj-s03-hook-stale-time` | `staleTime: 30_000` | Config | Cache 30 secondes |
| `proj-s03-hook-return-type` | `{ projectIds, isLoading, isScoped }` | Type | Type de retour du hook |
| `proj-s03-hook-export` | Export in hooks/index.ts | Export | Export du hook |

### data-testid pour barrel exports

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s03-scope-filter-export` | `getScopeProjectIds` in services/index.ts | Export | Export barrel service |
| `proj-s03-scope-filter-import-issues` | Import in routes/issues.ts | Import | Import dans issues routes |
| `proj-s03-scope-filter-import-workflows` | Import in routes/workflows.ts | Import | Import dans workflows routes |
| `proj-s03-scope-filter-import-projects` | Import in routes/projects.ts | Import | Import dans projects routes |
| `proj-s03-scope-filter-import-drift` | Import in routes/drift.ts | Import | Import dans drift routes |

---

## Test Cases pour Agent QA

### Groupe 1 : Service scope-filter.ts (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T01 | scope-filter file exists | `server/src/services/scope-filter.ts` existe |
| T02 | getScopeProjectIds function | Exporte une fonction `getScopeProjectIds(db, companyId, req)` |
| T03 | Agent bypass | Contient `if (req.actor.type === "agent") return null` |
| T04 | Instance admin bypass | Contient check `req.actor.source === "local_implicit"` et `req.actor.isInstanceAdmin` |
| T05 | hasGlobalScope call | Appelle `hasGlobalScope(companyId, userId)` |
| T06 | getUserProjectIds call | Appelle `getUserProjectIds(companyId, userId)` pour les users scoped |
| T07 | Returns null for global | Retourne `null` pour acces global |
| T08 | Returns string[] for scoped | Retourne `string[]` pour users scoped |
| T09 | Exports in services/index.ts | `server/src/services/index.ts` exporte `getScopeProjectIds` |

### Groupe 2 : access.ts hasGlobalScope (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T10 | hasGlobalScope function exists | `server/src/services/access.ts` contient `hasGlobalScope` |
| T11 | Queries principalPermissionGrants | SELECT avec `eq(principalType, "user")` et `eq(principalId, userId)` |
| T12 | Checks scope null | Utilise `.some()` pour verifier si un grant a `scope === null` |
| T13 | Returns boolean | Type de retour `Promise<boolean>` |

### Groupe 3 : Issues routes scope filtering (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T14 | Import getScopeProjectIds | `issues.ts` importe `getScopeProjectIds` depuis `scope-filter` |
| T15 | GET list calls getScopeProjectIds | Route GET /companies/:companyId/issues appelle `getScopeProjectIds()` |
| T16 | Passes allowedProjectIds to service | Route passe `allowedProjectIds: scopeProjectIds` au service `svc.list()` |
| T17 | GET single calls getScopeProjectIds | Route GET /issues/:issueId appelle `getScopeProjectIds()` |
| T18 | Single issue scope check | Verifie `issue.projectId` contre `scopeProjectIds` |
| T19 | Throws forbidden on scope denied | `throw forbidden(...)` avec `SCOPE_DENIED` |
| T20 | emitAudit on scope denied | Appelle `emitAudit` avec `action: "access.scope_denied"` et `targetType: "issue"` |
| T21 | Null projectId passes | Issues avec `projectId: null` ne declenchent pas le scope check |

### Groupe 4 : Issues service scope filter (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T22 | IssueFilters has allowedProjectIds | Interface/type `IssueFilters` contient `allowedProjectIds?: string[] \| null` |
| T23 | Empty array = IS NULL only | Quand `allowedProjectIds` est `[]`, condition = `projectId IS NULL` |
| T24 | Non-empty array = IN OR NULL | Quand `allowedProjectIds` est non-vide, condition = `projectId IN (...) OR projectId IS NULL` |
| T25 | Explicit projectId intersection | Le filtre explicite `projectId` s'applique en plus du scope |

### Groupe 5 : Workflows routes scope filtering (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T26 | Import getScopeProjectIds | `workflows.ts` importe `getScopeProjectIds` |
| T27 | GET list calls getScopeProjectIds | Route GET /companies/:companyId/workflows appelle `getScopeProjectIds()` |
| T28 | Passes allowedProjectIds | Route passe `allowedProjectIds` au service |
| T29 | GET single scope check | Route GET /workflows/:id verifie le scope |
| T30 | Throws forbidden on scope denied | `throw forbidden(...)` avec `SCOPE_DENIED` pour workflows |
| T31 | emitAudit on workflow scope denied | Appelle `emitAudit` avec `targetType: "workflow"` |

### Groupe 6 : Workflows service scope filter (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T32 | listInstances has allowedProjectIds | Parametre filters inclut `allowedProjectIds` |
| T33 | Empty array = IS NULL only | Quand vide, condition = `projectId IS NULL` |
| T34 | Non-empty array = IN OR NULL | Quand non-vide, condition = `projectId IN (...) OR IS NULL` |

### Groupe 7 : Projects routes scope filtering (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T35 | Import getScopeProjectIds | `projects.ts` importe `getScopeProjectIds` |
| T36 | GET list calls getScopeProjectIds | Route GET /companies/:companyId/projects appelle `getScopeProjectIds()` |
| T37 | Scoped user calls listByIds | Quand `scopeProjectIds !== null`, appelle `svc.listByIds(companyId, scopeProjectIds)` |
| T38 | Empty scope returns empty array | Quand `scopeProjectIds.length === 0`, retourne `res.json([])` |
| T39 | Global user calls list | Quand `scopeProjectIds === null`, appelle `svc.list(companyId)` (existant) |

### Groupe 8 : Projects service listByIds (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T40 | listByIds function exists | Service projects contient `listByIds` |
| T41 | Uses inArray | `listByIds` utilise `inArray(projects.id, projectIds)` |
| T42 | Filters by companyId | Condition inclut `eq(projects.companyId, companyId)` |
| T43 | Empty array returns empty | `if (projectIds.length === 0) return []` |

### Groupe 9 : Drift routes scope filtering (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T44 | Import getScopeProjectIds | `drift.ts` importe `getScopeProjectIds` |
| T45 | GET reports calls getScopeProjectIds | Route drift reports appelle `getScopeProjectIds()` |
| T46 | GET alerts calls getScopeProjectIds | Route drift alerts appelle `getScopeProjectIds()` |
| T47 | Reports filtered by projectId | Drift reports filtres par `projectId IN (scopeProjectIds)` |
| T48 | Alerts filtered by projectId | Drift alerts filtres par scope |

### Groupe 10 : Audit events (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T49 | Issues scope denied has audit | Route issues appelle `emitAudit` avec `action: "access.scope_denied"` |
| T50 | Workflows scope denied has audit | Route workflows appelle `emitAudit` avec `action: "access.scope_denied"` |
| T51 | Audit metadata has requestedProjectId | `metadata: { requestedProjectId: ... }` |
| T52 | Audit metadata has allowedProjectIds | `metadata: { allowedProjectIds: ... }` |
| T53 | Audit severity warning | `severity: "warning"` sur scope denied |

### Groupe 11 : Frontend hook (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T54 | Hook file exists | `ui/src/hooks/use-project-scope.ts` existe |
| T55 | Exports useProjectScope | Hook exporte `useProjectScope` |
| T56 | Uses useQuery | Hook utilise `useQuery` de `@tanstack/react-query` |
| T57 | Query key contains project-scope | queryKey contient `"project-scope"` |
| T58 | Calls /users/:userId/project-ids | Appelle l'endpoint `GET /companies/:companyId/users/:userId/project-ids` |
| T59 | Returns projectIds | Retourne `{ projectIds, isLoading, isScoped }` |
| T60 | StaleTime 30s | `staleTime: 30_000` ou `30000` |
| T61 | Hook exported in index | `ui/src/hooks/index.ts` exporte `useProjectScope` |

### Groupe 12 : Import patterns (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T62 | issues.ts imports scope-filter | Contient `import.*getScopeProjectIds.*scope-filter` |
| T63 | workflows.ts imports scope-filter | Contient `import.*getScopeProjectIds.*scope-filter` |
| T64 | projects.ts imports scope-filter | Contient `import.*getScopeProjectIds.*scope-filter` |
| T65 | drift.ts imports scope-filter | Contient `import.*getScopeProjectIds.*scope-filter` |
| T66 | scope-filter.ts imports project-memberships | Contient `import.*projectMembershipService.*project-memberships` |
| T67 | scope-filter.ts imports access | Contient `import.*accessService.*access` |

---

## Notes Techniques

### Retrocompatibilite

Toutes les modifications sont backward-compatible :
- Le parametre `allowedProjectIds` est optionnel -- quand absent ou `null`, le comportement existant est preserve
- Le service `listByIds` est additionnel -- `list` continue de fonctionner
- Le hook `useProjectScope` est optionnel -- les pages existantes ne l'utilisent pas encore

### Performance

- `getScopeProjectIds` fait 2 queries (hasGlobalScope + getUserProjectIds) pour les users scoped
- Ces queries sont legeres (index sur companyId + userId/principalId)
- Le hook frontend cache le resultat 30s pour eviter les appels repetitifs
- Le filtre SQL `IN (...)` utilise l'index `*_company_project_idx` sur chaque table

### Entites sans projectId

Les issues et workflows avec `projectId IS NULL` sont accessibles par tous les utilisateurs de la company. C'est intentionnel :
- Les entites creees avant le systeme de projets n'ont pas de projectId
- Les entites "globales" a la company ne doivent pas etre masquees
- Le filtre est `projectId IN (...) OR projectId IS NULL`

### Agents sans projectId

Les agents n'ont pas de colonne `projectId` dans le schema. Le filtrage des agents n'est donc pas applicable dans cette story. Si un filtrage agents par projet est necessaire dans le futur, il faudra soit ajouter une colonne `projectId` aux agents, soit filtrer via les issues assignees. Ce n'est PAS dans le scope de PROJ-S03.

### Drift reports avec projectId NOT NULL

Les `drift_reports` ont `projectId NOT NULL` -- donc pas de fallback `OR IS NULL`. Les drift reports sont toujours associes a un projet. Le filtre est simplement `projectId IN (scopeProjectIds)`. Si le user n'a aucun projet, les drift reports sont masques.

### hasGlobalScope vs simple Admin check

On utilise `hasGlobalScope` (verifie si un grant a `scope: null`) plutot qu'un simple check du `businessRole` pour rester coherent avec le systeme RBAC JSONB. Un Admin peut theoriquement avoir des grants scoped (configuration fine). L'autorite est dans les grants, pas dans le role.

---

## Definition of Done

- [ ] `server/src/services/scope-filter.ts` cree avec `getScopeProjectIds()`
- [ ] `getScopeProjectIds` exporte dans `server/src/services/index.ts`
- [ ] `hasGlobalScope()` ajoute dans `server/src/services/access.ts`
- [ ] `GET /companies/:companyId/issues` filtre par scope projet
- [ ] `GET /issues/:issueId` verifie le scope projet (403 si hors scope)
- [ ] `IssueFilters` enrichi avec `allowedProjectIds?: string[] | null`
- [ ] Service issues.list() applique le filtre `allowedProjectIds`
- [ ] `GET /companies/:companyId/workflows` filtre par scope projet
- [ ] `GET /workflows/:id` verifie le scope projet (403 si hors scope)
- [ ] Service workflows.listInstances() applique le filtre `allowedProjectIds`
- [ ] `GET /companies/:companyId/projects` filtre par scope projet (listByIds)
- [ ] `listByIds()` ajoute au service projects
- [ ] `GET /drift/.../reports` filtre par scope projet
- [ ] `GET /drift/.../alerts` filtre par scope projet
- [ ] Issues avec `projectId: null` restent visibles pour tous (OR IS NULL)
- [ ] Agents API bypass scope (return null)
- [ ] Instance admin bypass scope (return null)
- [ ] Admin avec scope null bypass (hasGlobalScope)
- [ ] 403 Forbidden avec `{ error: "SCOPE_DENIED" }` sur acces single hors scope
- [ ] `emitAudit("access.scope_denied")` avec metadata sur acces refuse
- [ ] Hook `useProjectScope()` cree dans `ui/src/hooks/use-project-scope.ts`
- [ ] Hook exporte dans `ui/src/hooks/index.ts`
- [ ] Import `getScopeProjectIds` dans les 4 fichiers routes (issues, workflows, projects, drift)
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
- [ ] Tests E2E Playwright (agent QA) passent
