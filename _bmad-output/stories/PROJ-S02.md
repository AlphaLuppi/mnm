# PROJ-S02 : Service project-memberships avance -- Scope sync, bulk ops, pagination

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | PROJ-S02 |
| **Titre** | Service project-memberships avance -- Scope sync, bulk ops, pagination |
| **Epic** | Epic PROJ -- Scoping par Projet |
| **Sprint** | Sprint 5 (Batch 7) |
| **Effort** | M (3 SP, 2-3j) |
| **Priorite** | P0 -- Prerequis filtrage par scope (PROJ-S03) et page ProjectAccess (PROJ-S04) |
| **Assignation** | Tom (backend) |
| **Bloque par** | RBAC-S01 (Fix hasPermission -- DONE), PROJ-S01 (Table project_memberships + service CRUD -- DONE) |
| **Debloque** | PROJ-S03 (Filtrage agents/issues par scope projet), PROJ-S04 (Page ProjectAccess UI) |
| **ADR** | ADR-001 (Multi-tenant RLS PostgreSQL), ADR-002 (RBAC + Scope JSONB) |
| **Type** | Backend-only (service enrichment + routes API, pas de composant UI) |
| **FRs couverts** | FR-PROJ (Phase 3 scoping par projet), INV-04 (scope JSONB lu et applique) |

---

## Description

### Contexte -- Pourquoi cette story est necessaire

PROJ-S01 a cree le service CRUD basique pour `project_memberships` : add/remove/list/update role. Cependant, il manque le lien critique entre **project_memberships** et le systeme **RBAC scope JSONB** de `principal_permission_grants`.

Le probleme actuel :
- Un Admin peut ajouter un user a un projet via `POST /api/companies/:companyId/projects/:projectId/members`
- Mais le champ `scope.projectIds` dans `principal_permission_grants` n'est PAS mis a jour automatiquement
- Un Contributor avec `scope: { projectIds: ["proj-A"] }` ne verra PAS `proj-B` meme s'il est ajoute comme membre de `proj-B` via PROJ-S01
- Le systeme `hasPermission()` (RBAC-S01) lit `scope.projectIds` -- si la liste n'est pas synchronisee, le filtrage est incoheren

De plus, PROJ-S03 et PROJ-S04 ont besoin de fonctionnalites que PROJ-S01 ne fournit pas :
- `getUserProjectIds(companyId, userId)` -- liste des IDs de projets auxquels un user a acces (pour le filtrage WHERE IN)
- `bulkAddMembers(companyId, projectId, userIds[])` -- ajout en masse pour la page ProjectAccess
- `bulkRemoveMembers(companyId, projectId, userIds[])` -- retrait en masse
- Synchronisation automatique `scope.projectIds` quand un membre est ajoute/retire
- Pagination pour `listMembers` quand un projet a des centaines de membres
- Comptage des membres par projet (pour affichage dans la liste des projets)

### Ce que cette story construit

1. **Scope Synchronization** -- Quand un user est ajoute/retire d'un projet, mettre a jour automatiquement le champ `scope.projectIds` dans toutes ses `principal_permission_grants` qui ont un scope restreint (non-null). Cela garantit que `hasPermission()` retourne les bonnes valeurs.

2. **Nouvelles fonctions service** :
   - `getUserProjectIds(companyId, userId)` -- retourne `string[]` des projectIds
   - `bulkAddMembers(companyId, projectId, userIds[], role, grantedBy)` -- ajout en masse avec retour detaille
   - `bulkRemoveMembers(companyId, projectId, userIds[])` -- retrait en masse
   - `countMembersByProject(companyId, projectIds[])` -- nombre de membres par projet
   - `listMembersPaginated(companyId, projectId, opts)` -- pagination cursor-based

3. **Nouvelles routes API** :
   - `GET /api/companies/:companyId/users/:userId/project-ids` -- IDs de projets
   - `POST /api/companies/:companyId/projects/:projectId/members/bulk` -- ajout en masse
   - `DELETE /api/companies/:companyId/projects/:projectId/members/bulk` -- retrait en masse
   - `POST /api/companies/:companyId/projects/member-counts` -- comptage par projet

4. **Enrichissement routes existantes** -- Les routes POST/DELETE de PROJ-S01 appellent desormais la sync scope apres mutation.

5. **Nouveaux validators Zod** -- Schemas pour les operations bulk et les query params pagination.

6. **Audit events** -- Chaque mutation emet un `audit_event` immutable via `emitAudit()`.

### Ce que cette story NE fait PAS (scope)

- Pas de filtrage agents/issues par project scope (PROJ-S03)
- Pas de page UI ProjectAccess (PROJ-S04)
- Pas de modification du schema DB `project_memberships` (pas de nouvelle migration)
- Pas de modification de `hasPermission()` ou `canUser()` (deja corriges par RBAC-S01)
- Pas de modification de `principal_permission_grants` schema (le scope JSONB est deja flexible)
- Pas de cascade automatique "ajouter un member donne des permissions" -- seul le scope est synchronise

---

## Etat Actuel du Code (Analyse)

### Service existant (PROJ-S01 -- DONE)

`server/src/services/project-memberships.ts` fournit deja :
- `addMember(companyId, projectId, userId, role, grantedBy)` -- insert + conflict check
- `removeMember(companyId, projectId, userId)` -- delete + not found check
- `listMembers(companyId, projectId)` -- join authUsers
- `listUserProjects(companyId, userId)` -- join projects
- `isMember(companyId, projectId, userId)` -- boolean check
- `updateMemberRole(companyId, projectId, userId, newRole)` -- update role

### Routes existantes (PROJ-S01 -- DONE)

`server/src/routes/project-memberships.ts` fournit :
- `GET /api/companies/:companyId/projects/:projectId/members`
- `POST /api/companies/:companyId/projects/:projectId/members` (+ requirePermission + logActivity + emitAudit)
- `DELETE /api/companies/:companyId/projects/:projectId/members/:userId` (+ requirePermission + logActivity + emitAudit)
- `PATCH /api/companies/:companyId/projects/:projectId/members/:userId` (+ requirePermission + logActivity + emitAudit)
- `GET /api/companies/:companyId/users/:userId/projects`

### RBAC scope (RBAC-S01 -- DONE)

`server/src/services/access.ts` -- `hasPermission()` lit `scope.projectIds` correctement :
```typescript
const requestedProjectIds = resourceScope.projectIds;
if (requestedProjectIds && requestedProjectIds.length > 0) {
  const grantedProjectIds = Array.isArray(grantScope.projectIds)
    ? new Set(grantScope.projectIds as string[])
    : null;
  if (!grantedProjectIds) return true;
  const allCovered = requestedProjectIds.every((id) => grantedProjectIds.has(id));
  if (!allCovered) return false;
}
```

### Scope schema (shared)

```typescript
// packages/shared/src/validators/access.ts
export const scopeSchema = z.object({
  projectIds: z.array(z.string().uuid()).optional(),
}).strict().nullable();
```

### Fichiers existants impactes

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `server/src/services/project-memberships.ts` | Service CRUD basique | MODIFIE : ajout 5 nouvelles fonctions + scope sync |
| `server/src/routes/project-memberships.ts` | Routes CRUD basiques | MODIFIE : ajout 4 nouvelles routes + enrichissement POST/DELETE existants |
| `packages/shared/src/validators/project-membership.ts` | 2 schemas Zod | MODIFIE : ajout 3 nouveaux schemas |
| `packages/shared/src/validators/index.ts` | Barrel exports | MODIFIE : ajout exports nouveaux schemas |
| `server/src/services/index.ts` | Barrel exports services | DEJA OK (projectMembershipService deja exporte) |

### Fichiers de reference (non modifies)

| Fichier | Role |
|---------|------|
| `packages/db/src/schema/project_memberships.ts` | Schema Drizzle |
| `packages/db/src/schema/principal_permission_grants.ts` | Schema grants avec scope JSONB |
| `server/src/services/access.ts` | hasPermission() + canUser() |
| `server/src/services/audit-emitter.ts` | emitAudit() helper |
| `server/src/middleware/require-permission.ts` | requirePermission() middleware |
| `server/src/routes/authz.ts` | assertCompanyAccess(), getActorInfo() |

---

## Architecture

### Strategie de synchronisation scope

La synchronisation du scope JSONB suit la regle suivante :

**Regle** : Quand un user est ajoute/retire d'un projet, pour CHAQUE `principal_permission_grants` row de ce user dans cette company qui a un `scope` non-null et contenant `projectIds`, mettre a jour `scope.projectIds` pour refleter la liste actuelle de projets du user.

**Cas limites** :
1. Si le grant a `scope: null` (acces global) -- NE PAS toucher, le user a deja acces a tout
2. Si le grant a `scope: {}` (objet vide, pas de projectIds) -- NE PAS toucher, pas de restriction
3. Si le grant a `scope: { projectIds: [...] }` -- METTRE A JOUR avec la liste actuelle
4. Si le user n'a plus aucun projet -- `scope.projectIds` devient `[]` (liste vide = aucun acces par scope)

**Implementation** : Une fonction interne `syncUserProjectScope(companyId, userId)` qui :
1. Lit les projectIds actuels du user via `project_memberships`
2. Lit les grants du user qui ont `scope.projectIds`
3. Met a jour chaque grant avec la nouvelle liste

```
addMember() → insert → syncUserProjectScope() → emitAudit()
removeMember() → delete → syncUserProjectScope() → emitAudit()
bulkAddMembers() → insert N → syncUserProjectScope() per user → emitAudit()
bulkRemoveMembers() → delete N → syncUserProjectScope() per user → emitAudit()
```

### Flow de donnees

```
POST /projects/:projectId/members
  → requirePermission("projects:manage_members")
  → validate(addProjectMemberSchema)
  → svc.addMember(companyId, projectId, userId, role, grantedBy)
     → INSERT INTO project_memberships
     → syncUserProjectScope(companyId, userId)
        → SELECT projectIds FROM project_memberships WHERE userId=?
        → UPDATE principal_permission_grants SET scope = { projectIds: [...] }
           WHERE scope->'projectIds' IS NOT NULL
  → logActivity()
  → emitAudit("project_membership.added")
  → 201 Created
```

---

## Acceptance Criteria

### AC-1 : Synchronisation scope -- ajout membre

**Given** un Contributor avec un grant `agents.launch` scope `{ projectIds: ["proj-A"] }`
**When** il est ajoute comme membre de `proj-B` via `POST /api/companies/:companyId/projects/proj-B/members`
**Then** son grant `agents.launch` est mis a jour : `scope: { projectIds: ["proj-A", "proj-B"] }`
**And** un `audit_event` `project_membership.scope_synced` est emis

### AC-2 : Synchronisation scope -- retrait membre

**Given** un Contributor avec un grant `agents.launch` scope `{ projectIds: ["proj-A", "proj-B"] }` et membre de proj-A et proj-B
**When** il est retire de `proj-B` via `DELETE /api/companies/:companyId/projects/proj-B/members/:userId`
**Then** son grant `agents.launch` est mis a jour : `scope: { projectIds: ["proj-A"] }`

### AC-3 : Scope null non touche

**Given** un Admin avec un grant `company.manage` scope `null` (acces global)
**When** il est ajoute comme membre d'un projet
**Then** son grant `company.manage` reste avec `scope: null`

### AC-4 : Scope sans projectIds non touche

**Given** un user avec un grant scope `{}` (objet vide)
**When** il est ajoute/retire d'un projet
**Then** son grant reste avec `scope: {}` (pas de champ `projectIds` ajoute)

### AC-5 : getUserProjectIds

**Given** un user membre de 3 projets sur 10 dans la company
**When** `getUserProjectIds(companyId, userId)` est appele
**Then** il retourne un tableau de 3 UUIDs correspondant aux projets du user

### AC-6 : getUserProjectIds -- aucun projet

**Given** un user qui n'est membre d'aucun projet
**When** `getUserProjectIds(companyId, userId)` est appele
**Then** il retourne un tableau vide `[]`

### AC-7 : Bulk add members

**Given** un Admin avec `projects:manage_members`
**When** il envoie `POST /api/companies/:companyId/projects/:projectId/members/bulk` avec `{ "userIds": ["user-1", "user-2", "user-3"], "role": "contributor" }`
**Then** 3 enregistrements `project_memberships` sont crees
**And** la reponse contient `{ "added": 3, "skipped": 0, "results": [...] }`
**And** `scope.projectIds` est synchronise pour chaque user
**And** un `audit_event` `project_membership.bulk_added` est emis

### AC-8 : Bulk add -- doublons partiels

**Given** user-1 deja membre du projet, user-2 et user-3 non membres
**When** bulk add avec les 3 userIds
**Then** la reponse contient `{ "added": 2, "skipped": 1, "results": [{ "userId": "user-1", "status": "skipped", "reason": "already_member" }, ...] }`

### AC-9 : Bulk remove members

**Given** un Admin avec `projects:manage_members` et 3 users membres du projet
**When** il envoie `DELETE /api/companies/:companyId/projects/:projectId/members/bulk` avec `{ "userIds": ["user-1", "user-2", "user-3"] }`
**Then** 3 enregistrements sont supprimes
**And** la reponse contient `{ "removed": 3, "skipped": 0, "results": [...] }`
**And** `scope.projectIds` est synchronise pour chaque user

### AC-10 : Bulk remove -- membres inexistants partiels

**Given** user-1 membre, user-2 non-membre
**When** bulk remove avec les 2 userIds
**Then** la reponse contient `{ "removed": 1, "skipped": 1, "results": [{ "userId": "user-2", "status": "skipped", "reason": "not_member" }] }`

### AC-11 : countMembersByProject

**Given** proj-A avec 5 membres, proj-B avec 0 membres, proj-C avec 12 membres
**When** `POST /api/companies/:companyId/projects/member-counts` avec `{ "projectIds": ["proj-A", "proj-B", "proj-C"] }`
**Then** la reponse contient `{ "counts": { "proj-A": 5, "proj-B": 0, "proj-C": 12 } }`

### AC-12 : listMembersPaginated

**Given** un projet avec 50 membres
**When** `GET /api/companies/:companyId/projects/:projectId/members?limit=20` est appele
**Then** la reponse contient 20 membres + `{ "nextCursor": "..." }` pour la page suivante

### AC-13 : listMembersPaginated -- derniere page

**Given** cursor pointe vers les 10 derniers membres
**When** `GET ...?limit=20&cursor=...` est appele
**Then** la reponse contient 10 membres + `{ "nextCursor": null }`

### AC-14 : Permission enforcement bulk

**Given** un Contributor (sans `projects:manage_members`)
**When** il tente `POST .../members/bulk` ou `DELETE .../members/bulk`
**Then** la reponse est `403 Forbidden`

### AC-15 : Audit events

**Given** toute mutation (add, remove, bulk add, bulk remove, role update)
**When** l'operation reussit
**Then** un `audit_event` immutable est cree via `emitAudit()` avec l'action correspondante

### AC-16 : Bulk validation -- limite

**Given** un body bulk avec plus de 100 userIds
**When** la requete est envoyee
**Then** la reponse est `400 Bad Request` avec `"Maximum 100 users per bulk operation"`

---

## Specifications Techniques

### Service enrichi : `server/src/services/project-memberships.ts`

#### Nouvelle fonction interne `syncUserProjectScope`

```typescript
async function syncUserProjectScope(companyId: string, userId: string): Promise<void> {
  // 1. Get all project IDs the user is a member of
  const memberRows = await db
    .select({ projectId: projectMemberships.projectId })
    .from(projectMemberships)
    .where(
      and(
        eq(projectMemberships.companyId, companyId),
        eq(projectMemberships.userId, userId),
      ),
    );
  const currentProjectIds = memberRows.map((r) => r.projectId);

  // 2. Find all grants for this user that have scope.projectIds
  const grants = await db
    .select({
      id: principalPermissionGrants.id,
      scope: principalPermissionGrants.scope,
    })
    .from(principalPermissionGrants)
    .where(
      and(
        eq(principalPermissionGrants.companyId, companyId),
        eq(principalPermissionGrants.principalType, "user"),
        eq(principalPermissionGrants.principalId, userId),
      ),
    );

  // 3. Update grants that have scope.projectIds defined
  for (const grant of grants) {
    const scope = grant.scope as Record<string, unknown> | null;
    if (!scope || !("projectIds" in scope)) continue; // skip null scope or scope without projectIds
    const updatedScope = { ...scope, projectIds: currentProjectIds };
    await db
      .update(principalPermissionGrants)
      .set({ scope: updatedScope, updatedAt: new Date() })
      .where(eq(principalPermissionGrants.id, grant.id));
  }
}
```

#### Nouvelle fonction `getUserProjectIds`

```typescript
getUserProjectIds: async (companyId: string, userId: string): Promise<string[]> => {
  const rows = await db
    .select({ projectId: projectMemberships.projectId })
    .from(projectMemberships)
    .where(
      and(
        eq(projectMemberships.companyId, companyId),
        eq(projectMemberships.userId, userId),
      ),
    );
  return rows.map((r) => r.projectId);
},
```

#### Nouvelle fonction `bulkAddMembers`

```typescript
interface BulkResult {
  userId: string;
  status: "added" | "skipped";
  reason?: string;
}

bulkAddMembers: async (
  companyId: string,
  projectId: string,
  userIds: string[],
  role: ProjectMembershipRole = "contributor",
  grantedBy: string | null = null,
): Promise<{ added: number; skipped: number; results: BulkResult[] }> => {
  await assertProjectExists(companyId, projectId);

  const results: BulkResult[] = [];
  const usersToSync: string[] = [];

  for (const userId of userIds) {
    try {
      await db
        .insert(projectMemberships)
        .values({ companyId, projectId, userId, role, grantedBy });
      results.push({ userId, status: "added" });
      usersToSync.push(userId);
    } catch (err: any) {
      if (err?.code === "23505") {
        results.push({ userId, status: "skipped", reason: "already_member" });
      } else {
        throw err;
      }
    }
  }

  // Sync scope for all successfully added users
  for (const userId of usersToSync) {
    await syncUserProjectScope(companyId, userId);
  }

  const added = results.filter((r) => r.status === "added").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  return { added, skipped, results };
},
```

#### Nouvelle fonction `bulkRemoveMembers`

```typescript
bulkRemoveMembers: async (
  companyId: string,
  projectId: string,
  userIds: string[],
): Promise<{ removed: number; skipped: number; results: BulkResult[] }> => {
  const results: BulkResult[] = [];
  const usersToSync: string[] = [];

  for (const userId of userIds) {
    const [row] = await db
      .delete(projectMemberships)
      .where(
        and(
          eq(projectMemberships.companyId, companyId),
          eq(projectMemberships.projectId, projectId),
          eq(projectMemberships.userId, userId),
        ),
      )
      .returning();
    if (row) {
      results.push({ userId, status: "removed" as const });
      usersToSync.push(userId);
    } else {
      results.push({ userId, status: "skipped" as const, reason: "not_member" });
    }
  }

  // Sync scope for all successfully removed users
  for (const userId of usersToSync) {
    await syncUserProjectScope(companyId, userId);
  }

  const removed = results.filter((r) => r.status === "removed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  return { removed, skipped, results };
},
```

#### Nouvelle fonction `countMembersByProject`

```typescript
countMembersByProject: async (
  companyId: string,
  projectIds: string[],
): Promise<Record<string, number>> => {
  if (projectIds.length === 0) return {};

  const rows = await db
    .select({
      projectId: projectMemberships.projectId,
      count: sql<number>`count(*)::int`,
    })
    .from(projectMemberships)
    .where(
      and(
        eq(projectMemberships.companyId, companyId),
        inArray(projectMemberships.projectId, projectIds),
      ),
    )
    .groupBy(projectMemberships.projectId);

  const counts: Record<string, number> = {};
  for (const pid of projectIds) {
    counts[pid] = 0;
  }
  for (const row of rows) {
    counts[row.projectId] = row.count;
  }
  return counts;
},
```

#### Nouvelle fonction `listMembersPaginated`

```typescript
interface PaginationOpts {
  limit: number;
  cursor?: string | null; // cursor = membership id
}

interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

listMembersPaginated: async (
  companyId: string,
  projectId: string,
  opts: PaginationOpts,
): Promise<PaginatedResult<{
  id: string;
  userId: string;
  role: string;
  grantedBy: string | null;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
}>> => {
  await assertProjectExists(companyId, projectId);

  const limit = Math.min(opts.limit, 100);
  const conditions = [
    eq(projectMemberships.companyId, companyId),
    eq(projectMemberships.projectId, projectId),
  ];

  if (opts.cursor) {
    conditions.push(sql`${projectMemberships.id} > ${opts.cursor}`);
  }

  const rows = await db
    .select({
      id: projectMemberships.id,
      userId: projectMemberships.userId,
      role: projectMemberships.role,
      grantedBy: projectMemberships.grantedBy,
      createdAt: projectMemberships.createdAt,
      userName: authUsers.name,
      userEmail: authUsers.email,
      userImage: authUsers.image,
    })
    .from(projectMemberships)
    .leftJoin(authUsers, eq(projectMemberships.userId, authUsers.id))
    .where(and(...conditions))
    .orderBy(projectMemberships.id)
    .limit(limit + 1); // fetch one extra to determine nextCursor

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1]!.id : null;

  return { data, nextCursor };
},
```

#### Enrichissement fonctions existantes `addMember` et `removeMember`

Les fonctions `addMember` et `removeMember` existantes doivent appeler `syncUserProjectScope` apres la mutation :

```typescript
addMember: async (...) => {
  // ... existing insert logic ...
  await syncUserProjectScope(companyId, userId);
  return row!;
},

removeMember: async (...) => {
  // ... existing delete logic ...
  await syncUserProjectScope(companyId, userId);
  return row;
},
```

### Routes enrichies : `server/src/routes/project-memberships.ts`

#### Nouvelles routes

```typescript
// GET /api/companies/:companyId/users/:userId/project-ids
router.get("/companies/:companyId/users/:userId/project-ids", async (req, res) => {
  const companyId = req.params.companyId as string;
  const userId = req.params.userId as string;
  assertCompanyAccess(req, companyId);
  const projectIds = await svc.getUserProjectIds(companyId, userId);
  res.json({ projectIds });
});

// POST /api/companies/:companyId/projects/:projectId/members/bulk
router.post(
  "/companies/:companyId/projects/:projectId/members/bulk",
  requirePermission(db, "projects:manage_members"),
  validate(bulkAddProjectMembersSchema),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    const projectId = req.params.projectId as string;
    assertCompanyAccess(req, companyId);
    const { userIds, role } = req.body;
    const actor = getActorInfo(req);
    const result = await svc.bulkAddMembers(companyId, projectId, userIds, role, actor.actorId);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.members_bulk_added",
      entityType: "project",
      entityId: projectId,
      details: { added: result.added, skipped: result.skipped, userIds },
    });

    await emitAudit({
      req, db, companyId,
      action: "project_membership.bulk_added",
      targetType: "project",
      targetId: projectId,
      metadata: { added: result.added, skipped: result.skipped, userCount: userIds.length },
    });

    res.status(200).json(result);
  },
);

// DELETE /api/companies/:companyId/projects/:projectId/members/bulk
router.delete(
  "/companies/:companyId/projects/:projectId/members/bulk",
  requirePermission(db, "projects:manage_members"),
  validate(bulkRemoveProjectMembersSchema),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    const projectId = req.params.projectId as string;
    assertCompanyAccess(req, companyId);
    const { userIds } = req.body;
    const actor = getActorInfo(req);
    const result = await svc.bulkRemoveMembers(companyId, projectId, userIds);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.members_bulk_removed",
      entityType: "project",
      entityId: projectId,
      details: { removed: result.removed, skipped: result.skipped, userIds },
    });

    await emitAudit({
      req, db, companyId,
      action: "project_membership.bulk_removed",
      targetType: "project",
      targetId: projectId,
      metadata: { removed: result.removed, skipped: result.skipped, userCount: userIds.length },
    });

    res.json(result);
  },
);

// POST /api/companies/:companyId/projects/member-counts
router.post(
  "/companies/:companyId/projects/member-counts",
  validate(memberCountsSchema),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const { projectIds } = req.body;
    const counts = await svc.countMembersByProject(companyId, projectIds);
    res.json({ counts });
  },
);
```

#### Enrichissement GET listMembers -- pagination optionnelle

Le GET existant est enrichi avec des query params optionnels `limit` et `cursor`. Si `limit` est present, la version paginee est utilisee. Sinon, le comportement existant est preserve (retro-compatible).

```typescript
router.get("/companies/:companyId/projects/:projectId/members", async (req, res) => {
  const companyId = req.params.companyId as string;
  const projectId = req.params.projectId as string;
  assertCompanyAccess(req, companyId);

  const limitParam = req.query.limit as string | undefined;
  if (limitParam) {
    const limit = Math.max(1, Math.min(100, parseInt(limitParam, 10) || 20));
    const cursor = (req.query.cursor as string) || null;
    const result = await svc.listMembersPaginated(companyId, projectId, { limit, cursor });
    return res.json(result);
  }

  const members = await svc.listMembers(companyId, projectId);
  res.json(members);
});
```

### Validators : `packages/shared/src/validators/project-membership.ts`

Nouveaux schemas a ajouter :

```typescript
export const bulkAddProjectMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100, "Maximum 100 users per bulk operation"),
  role: z.enum(PROJECT_MEMBERSHIP_ROLES).default("contributor"),
}).strict();

export type BulkAddProjectMembers = z.infer<typeof bulkAddProjectMembersSchema>;

export const bulkRemoveProjectMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100, "Maximum 100 users per bulk operation"),
}).strict();

export type BulkRemoveProjectMembers = z.infer<typeof bulkRemoveProjectMembersSchema>;

export const memberCountsSchema = z.object({
  projectIds: z.array(z.string().uuid()).min(1).max(100),
}).strict();

export type MemberCounts = z.infer<typeof memberCountsSchema>;
```

### Imports supplementaires necessaires

Le service doit importer `principalPermissionGrants` depuis `@mnm/db` et `sql`, `inArray` depuis `drizzle-orm` :

```typescript
import { and, eq, inArray, sql } from "drizzle-orm";
import { projectMemberships, projects, authUsers, principalPermissionGrants } from "@mnm/db";
```

Les routes doivent importer les nouveaux validators et `emitAudit` :

```typescript
import {
  addProjectMemberSchema,
  updateProjectMemberRoleSchema,
  bulkAddProjectMembersSchema,
  bulkRemoveProjectMembersSchema,
  memberCountsSchema,
} from "@mnm/shared";
```

---

## data-test-id Mapping

### Convention

Tous les `data-testid` suivent le format `proj-s02-[element]`.
Cette story est backend-only, les data-testid sont destines aux tests E2E Playwright qui verifient les fichiers de code et les reponses API.

### data-testid pour fichiers et exports

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s02-sync-scope-fn` | `syncUserProjectScope()` function | Code | Synchronisation scope JSONB interne |
| `proj-s02-get-user-project-ids-fn` | `getUserProjectIds()` function | Service | Retourne projectIds du user |
| `proj-s02-bulk-add-fn` | `bulkAddMembers()` function | Service | Ajout en masse |
| `proj-s02-bulk-remove-fn` | `bulkRemoveMembers()` function | Service | Retrait en masse |
| `proj-s02-count-members-fn` | `countMembersByProject()` function | Service | Comptage par projet |
| `proj-s02-list-paginated-fn` | `listMembersPaginated()` function | Service | Liste paginee |
| `proj-s02-ppg-import` | `principalPermissionGrants` import | Code | Import schema grants |

### data-testid pour routes API

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s02-get-project-ids-endpoint` | `GET /companies/:companyId/users/:userId/project-ids` | API | IDs projets user |
| `proj-s02-bulk-add-endpoint` | `POST /companies/:companyId/projects/:projectId/members/bulk` | API | Ajout en masse |
| `proj-s02-bulk-remove-endpoint` | `DELETE /companies/:companyId/projects/:projectId/members/bulk` | API | Retrait en masse |
| `proj-s02-member-counts-endpoint` | `POST /companies/:companyId/projects/member-counts` | API | Comptage membres |
| `proj-s02-pagination-support` | Query params `limit` + `cursor` sur GET members | API | Pagination optionnelle |

### data-testid pour validators

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s02-bulk-add-schema` | `bulkAddProjectMembersSchema` | Validator | Schema bulk add |
| `proj-s02-bulk-remove-schema` | `bulkRemoveProjectMembersSchema` | Validator | Schema bulk remove |
| `proj-s02-member-counts-schema` | `memberCountsSchema` | Validator | Schema member counts |
| `proj-s02-bulk-limit-100` | `.max(100)` on userIds | Validator | Limite 100 users max |

### data-testid pour scope sync

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s02-scope-sync-after-add` | `syncUserProjectScope()` call after addMember | Code | Sync scope apres ajout |
| `proj-s02-scope-sync-after-remove` | `syncUserProjectScope()` call after removeMember | Code | Sync scope apres retrait |
| `proj-s02-scope-null-skip` | Skip grants with `scope: null` | Logic | Ne pas toucher scope null |
| `proj-s02-scope-no-projectids-skip` | Skip grants without `projectIds` | Logic | Ne pas toucher scope sans projectIds |
| `proj-s02-scope-update-grant` | UPDATE principal_permission_grants SET scope | Code | Mise a jour scope |

### data-testid pour audit events

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s02-audit-bulk-added` | `project_membership.bulk_added` | Event | Audit ajout en masse |
| `proj-s02-audit-bulk-removed` | `project_membership.bulk_removed` | Event | Audit retrait en masse |
| `proj-s02-audit-scope-synced` | `project_membership.scope_synced` | Event | Audit sync scope |

### data-testid pour permission enforcement

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s02-bulk-add-permission` | `requirePermission(db, "projects:manage_members")` on bulk add | Middleware | Protection bulk add |
| `proj-s02-bulk-remove-permission` | `requirePermission(db, "projects:manage_members")` on bulk remove | Middleware | Protection bulk remove |
| `proj-s02-counts-no-permission` | No `requirePermission` on member-counts | Logic | Comptage = lecture ouverte |

### data-testid pour error responses

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s02-bulk-limit-error` | `400 Bad Request` for >100 userIds | Error | Limite depassee |
| `proj-s02-bulk-add-partial` | Partial success response shape | Response | `{ added: N, skipped: M, results: [...] }` |
| `proj-s02-bulk-remove-partial` | Partial success response shape | Response | `{ removed: N, skipped: M, results: [...] }` |
| `proj-s02-paginated-response` | Paginated response shape | Response | `{ data: [...], nextCursor: "..." }` |
| `proj-s02-counts-response` | Counts response shape | Response | `{ counts: { "pid": N, ... } }` |

---

## Test Cases pour Agent QA

### Groupe 1 : Scope synchronization (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T01 | syncUserProjectScope function exists | Service contient `syncUserProjectScope` qui lit `project_memberships` et met a jour `principal_permission_grants` |
| T02 | Import principalPermissionGrants | Service importe `principalPermissionGrants` depuis `@mnm/db` |
| T03 | Scope null skip | `syncUserProjectScope` verifie `if (!scope \|\| !("projectIds" in scope))` et skip |
| T04 | Scope projectIds update | `syncUserProjectScope` fait `db.update(principalPermissionGrants).set({ scope: updatedScope })` |
| T05 | addMember calls syncUserProjectScope | `addMember` appelle `syncUserProjectScope(companyId, userId)` apres insert |
| T06 | removeMember calls syncUserProjectScope | `removeMember` appelle `syncUserProjectScope(companyId, userId)` apres delete |

### Groupe 2 : Nouvelles fonctions service (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T07 | getUserProjectIds function | Service contient `getUserProjectIds` qui retourne `string[]` de projectIds |
| T08 | bulkAddMembers function | Service contient `bulkAddMembers` qui insere N rows et retourne `{ added, skipped, results }` |
| T09 | bulkRemoveMembers function | Service contient `bulkRemoveMembers` qui delete N rows et retourne `{ removed, skipped, results }` |
| T10 | countMembersByProject function | Service contient `countMembersByProject` avec `GROUP BY` et `count(*)` |
| T11 | listMembersPaginated function | Service contient `listMembersPaginated` avec cursor-based pagination |
| T12 | Bulk add conflict handling | `bulkAddMembers` catch `err?.code === "23505"` et marque `skipped` au lieu de throw |
| T13 | Bulk remove not-member handling | `bulkRemoveMembers` verifie si le row a ete supprime et marque `not_member` sinon |
| T14 | Bulk add scope sync | `bulkAddMembers` appelle `syncUserProjectScope` pour chaque user ajoute avec succes |
| T15 | Bulk remove scope sync | `bulkRemoveMembers` appelle `syncUserProjectScope` pour chaque user retire |
| T16 | Pagination limit+1 trick | `listMembersPaginated` fetch `limit + 1` pour detecter hasMore |
| T17 | countMembersByProject inArray | `countMembersByProject` utilise `inArray(projectMemberships.projectId, projectIds)` |

### Groupe 3 : Nouvelles routes (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T18 | GET user project-ids route | Route `GET /companies/:companyId/users/:userId/project-ids` existe |
| T19 | POST bulk add route | Route `POST /companies/:companyId/projects/:projectId/members/bulk` avec `requirePermission` |
| T20 | DELETE bulk remove route | Route `DELETE /companies/:companyId/projects/:projectId/members/bulk` avec `requirePermission` |
| T21 | POST member-counts route | Route `POST /companies/:companyId/projects/member-counts` existe |
| T22 | Bulk add permission | Bulk add utilise `requirePermission(db, "projects:manage_members")` |
| T23 | Bulk remove permission | Bulk remove utilise `requirePermission(db, "projects:manage_members")` |
| T24 | Member counts no mutation permission | Member counts ne requiert PAS `requirePermission` (lecture) |
| T25 | All routes assertCompanyAccess | Les 4 nouvelles routes appellent `assertCompanyAccess()` |

### Groupe 4 : Pagination enrichment (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T26 | GET members pagination support | Route GET members verifie `req.query.limit` et appelle `listMembersPaginated` si present |
| T27 | Backward compatible | Sans query params, GET members retourne le comportement original (tableau non-pagine) |
| T28 | Max limit 100 | Pagination limite `limit` a 100 maximum |

### Groupe 5 : Nouveaux validators (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T29 | bulkAddProjectMembersSchema | Schema valide `{ userIds: string[], role: enum }` avec `.max(100)` |
| T30 | bulkRemoveProjectMembersSchema | Schema valide `{ userIds: string[] }` avec `.max(100)` |
| T31 | memberCountsSchema | Schema valide `{ projectIds: string[] }` avec `.uuid()` |
| T32 | Validator exports | `packages/shared/src/validators/index.ts` exporte les 3 nouveaux schemas |
| T33 | Strict mode | Les 3 schemas utilisent `.strict()` |

### Groupe 6 : Activity log events (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T34 | bulk_added activity | Bulk add route emet `project.members_bulk_added` via logActivity |
| T35 | bulk_removed activity | Bulk remove route emet `project.members_bulk_removed` via logActivity |
| T36 | Activity details | Chaque activity event contient `{ added/removed, skipped, userIds }` |

### Groupe 7 : Audit events (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T37 | Bulk add audit | Bulk add route appelle `emitAudit()` avec `action: "project_membership.bulk_added"` |
| T38 | Bulk remove audit | Bulk remove route appelle `emitAudit()` avec `action: "project_membership.bulk_removed"` |
| T39 | emitAudit import | Routes importent `emitAudit` depuis `../services/index.js` |

### Groupe 8 : Response shapes (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T40 | Bulk add response | Route retourne `res.status(200).json(result)` (pas 201, car partial success possible) |
| T41 | getUserProjectIds response | Route retourne `{ projectIds: [...] }` |
| T42 | Counts response | Route retourne `{ counts: { ... } }` |
| T43 | Paginated response | Route retourne `{ data: [...], nextCursor: "..." }` |

### Groupe 9 : Integration patterns (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T44 | Service uses sql template | `countMembersByProject` utilise `` sql<number>`count(*)::int` `` |
| T45 | Bulk uses validate middleware | Routes bulk utilisent `validate()` middleware |
| T46 | Existing addMember enriched | `addMember` appelle `syncUserProjectScope` (pas juste insert+return) |
| T47 | Existing removeMember enriched | `removeMember` appelle `syncUserProjectScope` (pas juste delete+return) |

---

## Notes Techniques

### Retrocompatibilite GET members

La route `GET /api/companies/:companyId/projects/:projectId/members` doit rester backward-compatible. Sans query params `limit`, elle retourne l'ancien format (tableau simple). Avec `limit`, elle retourne le format pagine `{ data, nextCursor }`. PROJ-S04 (UI) utilisera la version paginee.

### Transaction vs sequential pour sync scope

La sync scope ne necessite PAS de transaction atomique avec l'insert/delete du membership. La raison :
- Si l'insert reussit mais la sync echoue, le user est membre mais le scope n'est pas a jour
- L'appel suivant (ou un retry) corrigera le scope
- La sync scope est "eventually consistent" -- acceptable pour ce cas
- Utiliser une transaction bloquerait les rows `principal_permission_grants` pendant l'insert, ce qui pourrait causer des deadlocks si d'autres routes modifient les permissions en parallele

### Performance du bulk

Le bulk est implementee avec une boucle sequentielle (pas un insert multi-values) pour :
1. Gerer les doublons un par un (rapport individuel added/skipped)
2. Eviter qu'un doublon fasse echouer tout le batch
3. La limite de 100 users garantit que la boucle reste performante (<1s)

### Cursor-based vs offset pagination

On utilise cursor-based pagination (basee sur `id`) plutot que offset (`LIMIT/OFFSET`) car :
- Plus performant pour les grandes tables (pas de scan sequentiel)
- Pas de probleme de "drift" si des rows sont inserees/supprimees pendant la pagination
- Le `id` est un UUID, trie naturellement par `orderBy(projectMemberships.id)`

### countMembersByProject avec GROUP BY

Le `countMembersByProject` utilise un seul `SELECT ... GROUP BY` au lieu de N requetes. Pour les projectIds sans membres, on initialise le dict a 0 avant de remplir avec les resultats.

---

## Definition of Done

- [ ] `syncUserProjectScope()` implementee dans `server/src/services/project-memberships.ts`
- [ ] `addMember()` et `removeMember()` enrichis avec appel `syncUserProjectScope()`
- [ ] `getUserProjectIds()` ajoutee au service
- [ ] `bulkAddMembers()` ajoutee au service avec rapport individuel
- [ ] `bulkRemoveMembers()` ajoutee au service avec rapport individuel
- [ ] `countMembersByProject()` ajoutee au service
- [ ] `listMembersPaginated()` ajoutee au service
- [ ] 4 nouvelles routes API ajoutees dans `server/src/routes/project-memberships.ts`
- [ ] GET members enrichi avec pagination optionnelle (backward-compatible)
- [ ] 3 nouveaux Zod schemas dans `packages/shared/src/validators/project-membership.ts`
- [ ] Exports ajoutes dans `packages/shared/src/validators/index.ts`
- [ ] `requirePermission(db, "projects:manage_members")` sur routes bulk mutation
- [ ] `assertCompanyAccess()` sur toutes les nouvelles routes
- [ ] `logActivity()` sur mutations bulk
- [ ] `emitAudit()` sur mutations bulk
- [ ] Scope JSONB synchronise automatiquement -- grants avec `scope.projectIds` mis a jour
- [ ] Grants avec `scope: null` ou `scope: {}` non modifies
- [ ] Limite 100 users max sur operations bulk
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
- [ ] Tests E2E Playwright (agent QA) passent
