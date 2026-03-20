# PROJ-S01 : Table project_memberships -- Service CRUD + Routes API

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | PROJ-S01 |
| **Titre** | Table project_memberships -- Service CRUD + Routes API |
| **Epic** | Epic PROJ -- Scoping par Projet |
| **Sprint** | Sprint 3 (Batch 6) |
| **Effort** | S (2 SP, 1j) |
| **Priorite** | P0 -- Prerequis scoping B2B |
| **Assignation** | Tom (backend) |
| **Bloque par** | TECH-06 (10 nouvelles tables -- DONE) |
| **Debloque** | PROJ-S02 (Service project-memberships avance), PROJ-S03 (Filtrage par scope), PROJ-S04 (Page ProjectAccess), DUAL-S01 (Table automation_cursors) |
| **ADR** | ADR-001 (Multi-tenant RLS PostgreSQL), ADR-002 (RBAC + Scope JSONB) |
| **Type** | Backend-only (service + routes API, pas de composant UI) |
| **FRs couverts** | FR-PROJ (Phase 3 scoping par projet), REQ-RBAC-08 (scope JSONB integration) |

---

## Description

### Contexte -- Pourquoi cette story est necessaire

Le systeme RBAC de MnM gere aujourd'hui les permissions au niveau **company** via `company_memberships` et `principal_permission_grants` avec un champ `scope` JSONB. Le fix RBAC-S01 a rendu le scope fonctionnel : `hasPermission()` lit desormais `scope.projectIds` et bloque l'acces si le user n'est pas dans la liste.

Mais il manque un maillon : **qui a acces a quel projet ?** La table `project_memberships` a ete creee par TECH-06 (schema Drizzle + migration), mais il n'existe aucun service CRUD ni aucune route API pour la manipuler. Sans ce service :
- Impossible d'ajouter/retirer des users d'un projet
- Impossible de lister les membres d'un projet
- Impossible pour PROJ-S02 de construire le service avance de filtrage
- Impossible pour PROJ-S03 de filtrer agents/issues par scope projet
- Impossible pour PROJ-S04 de construire la page UI d'acces projet

### Ce que cette story construit

1. **Service `project-memberships.ts`** -- CRUD complet sur la table `project_memberships` :
   - `addMember(companyId, projectId, userId, role, grantedBy)` -- ajouter un user a un projet
   - `removeMember(companyId, projectId, userId)` -- retirer un user d'un projet
   - `listMembers(companyId, projectId)` -- lister les membres d'un projet avec join user (nom, email, image)
   - `listUserProjects(companyId, userId)` -- lister les projets auxquels un user a acces
   - `isMember(companyId, projectId, userId)` -- verifier si un user est membre d'un projet
   - `updateMemberRole(companyId, projectId, userId, newRole)` -- changer le role d'un membre dans le projet

2. **Routes API** dans `server/src/routes/project-memberships.ts` :
   - `GET /api/companies/:companyId/projects/:projectId/members` -- lister les membres
   - `POST /api/companies/:companyId/projects/:projectId/members` -- ajouter un membre
   - `DELETE /api/companies/:companyId/projects/:projectId/members/:userId` -- retirer un membre
   - `PATCH /api/companies/:companyId/projects/:projectId/members/:userId` -- changer le role
   - `GET /api/companies/:companyId/users/:userId/projects` -- projets d'un user

3. **Zod validators** dans `packages/shared/src/validators/project-membership.ts` :
   - `addProjectMemberSchema` -- body validation pour POST
   - `updateProjectMemberRoleSchema` -- body validation pour PATCH

4. **Activity log** -- chaque mutation emet un evenement d'activite (`project.member_added`, `project.member_removed`, `project.member_role_changed`)

5. **Integration `server/src/routes/index.ts`** et `server/src/services/index.ts` -- exports du service et des routes

### Ce que cette story ne fait PAS (scope)

- Pas de filtrage agents/issues par project scope (PROJ-S03)
- Pas de page UI ProjectAccess (PROJ-S04)
- Pas de synchronisation automatique avec `scope.projectIds` dans `principal_permission_grants` (PROJ-S02)
- Pas de logique de cascade (ajouter un member au projet ne modifie pas ses permissions RBAC -- c'est PROJ-S02)
- Pas de notification WebSocket aux membres quand ils sont ajoutes/retires

---

## Etat Actuel du Code (Analyse)

### Schema existant (TECH-06 -- DONE)

Le fichier `packages/db/src/schema/project_memberships.ts` existe deja :

```typescript
export const projectMemberships = pgTable(
  "project_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("contributor"),
    grantedBy: text("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectUserUniqueIdx: uniqueIndex(
      "project_memberships_company_project_user_unique_idx",
    ).on(table.companyId, table.projectId, table.userId),
    companyUserIdx: index("project_memberships_company_user_idx").on(
      table.companyId, table.userId,
    ),
    companyProjectIdx: index("project_memberships_company_project_idx").on(
      table.companyId, table.projectId,
    ),
  }),
);
```

**Observations cles** :
- Contrainte d'unicite `(companyId, projectId, userId)` -- pas de doublons possibles
- `onDelete: "cascade"` sur `projectId` -- suppression projet cascade
- `role` par defaut `"contributor"` -- valeurs attendues : `owner`, `manager`, `contributor`, `viewer`
- `grantedBy` -- userId de celui qui a accorde l'acces (audit trail)

### Factories existantes (TECH-03 -- DONE)

Le fichier `packages/test-utils/src/factories/membership.factory.ts` fournit deja :
- `buildTestProjectMembership(companyId, projectId, userId, overrides?)` -- construction en memoire
- `createTestProjectMembership(db, companyId, projectId, userId, overrides?)` -- insertion DB

### Fichiers existants impactes

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `server/src/services/index.ts` | Barrel exports services | MODIFIE : ajout export `projectMembershipService` |
| `server/src/routes/index.ts` ou `server/src/app.ts` | Router registration | MODIFIE : ajout `projectMembershipRoutes` |
| `packages/shared/src/validators/index.ts` | Barrel exports validators | MODIFIE : ajout export schemas project-membership |

### Fichiers a creer

| Fichier | Role |
|---------|------|
| `server/src/services/project-memberships.ts` | Service CRUD project_memberships |
| `server/src/routes/project-memberships.ts` | Routes API Express |
| `packages/shared/src/validators/project-membership.ts` | Zod schemas validation |

### Fichiers de reference (non modifies)

| Fichier | Role |
|---------|------|
| `packages/db/src/schema/project_memberships.ts` | Schema Drizzle (deja cree TECH-06) |
| `server/src/services/access.ts` | `hasPermission()`, `canUser()` -- reference pattern RBAC |
| `server/src/services/projects.ts` | `projectService()` -- reference pattern service |
| `server/src/routes/projects.ts` | `projectRoutes()` -- reference pattern routes |
| `server/src/middleware/require-permission.ts` | `requirePermission()` middleware |
| `server/src/routes/authz.ts` | `assertCompanyAccess()`, `getActorInfo()` |
| `packages/shared/src/constants.ts` | `PERMISSION_KEYS`, `BUSINESS_ROLES` |
| `packages/shared/src/rbac-presets.ts` | Presets de permissions par role |
| `packages/test-utils/src/factories/membership.factory.ts` | Factories project membership |

### Conventions du codebase (a respecter)

1. **Service pattern** : `projectMembershipService(db)` retourne un objet de fonctions -- pas de classes
2. **Error handling** : `throw conflict("message")`, `throw forbidden("message")`, `throw notFound("message")`
3. **Drizzle queries** : `db.select().from().where(and(...))` avec `drizzle-orm` operators
4. **Route pattern** : `export function projectMembershipRoutes(db: Db) { const router = Router(); ... }`
5. **Permission check** : `requirePermission(db, "projects:manage_members")` pour les mutations
6. **Activity log** : `logActivity(db, { companyId, actorType, actorId, agentId, action, entityType, entityId, details })`
7. **Company access** : `assertCompanyAccess(req, companyId)` pour chaque route
8. **Validator pattern** : Zod schemas avec `.strict()` pour empecher les champs non-documentes

---

## Acceptance Criteria

### AC-1 : Ajouter un membre a un projet

**Given** un Admin ou Manager avec la permission `projects:manage_members`
**When** il envoie `POST /api/companies/:companyId/projects/:projectId/members` avec `{ "userId": "user-123", "role": "contributor" }`
**Then** un enregistrement `project_memberships` est cree et retourne avec `201 Created`
**And** un `activity_log` `project.member_added` est emis avec `{ userId, projectId, role, grantedBy }`

### AC-2 : Doublon rejete

**Given** un user deja membre du projet
**When** le meme `POST` est envoie
**Then** la reponse est `409 Conflict` avec `{ "error": "User is already a member of this project" }`

### AC-3 : Lister les membres d'un projet

**Given** un projet avec 3 membres
**When** un user avec acces company envoie `GET /api/companies/:companyId/projects/:projectId/members`
**Then** la reponse contient un tableau de 3 objets avec `{ id, userId, userName, userEmail, userImage, role, grantedBy, createdAt }`

### AC-4 : Retirer un membre

**Given** un Admin ou Manager avec `projects:manage_members`
**When** il envoie `DELETE /api/companies/:companyId/projects/:projectId/members/:userId`
**Then** l'enregistrement est supprime, reponse `200 OK` avec le membre supprime
**And** un `activity_log` `project.member_removed` est emis

### AC-5 : Retirer un membre inexistant

**Given** un userId qui n'est pas membre du projet
**When** `DELETE` est envoie
**Then** la reponse est `404 Not Found`

### AC-6 : Changer le role d'un membre

**Given** un Admin ou Manager avec `projects:manage_members`
**When** il envoie `PATCH /api/companies/:companyId/projects/:projectId/members/:userId` avec `{ "role": "manager" }`
**Then** le role est mis a jour et retourne avec `200 OK`
**And** un `activity_log` `project.member_role_changed` est emis avec `{ userId, oldRole, newRole }`

### AC-7 : Lister les projets d'un user

**Given** un user membre de 2 projets sur 5 dans la company
**When** `GET /api/companies/:companyId/users/:userId/projects` est appele
**Then** la reponse contient un tableau de 2 objets avec `{ projectId, projectName, role, createdAt }`

### AC-8 : Verifier l'appartenance

**Given** le service `projectMembershipService`
**When** `isMember(companyId, projectId, userId)` est appele
**Then** il retourne `true` si le user est membre, `false` sinon

### AC-9 : Permission enforcement

**Given** un Contributor (sans `projects:manage_members`)
**When** il tente `POST /api/companies/:companyId/projects/:projectId/members`
**Then** la reponse est `403 Forbidden` avec `{ "error": "Missing permission: projects:manage_members" }`

### AC-10 : Company access enforcement

**Given** un user de Company A
**When** il tente d'acceder aux membres d'un projet de Company B
**Then** la reponse est `403 Forbidden`

### AC-11 : Projet inexistant

**Given** un projectId qui n'existe pas
**When** une operation sur les membres est tentee
**Then** la reponse est `404 Not Found` avec `{ "error": "Project not found" }`

### AC-12 : Validation body Zod

**Given** un body invalide (ex: `{ "role": "superadmin" }`, `{ "userId": "" }`)
**When** un `POST` ou `PATCH` est envoie
**Then** la reponse est `400 Bad Request` avec les details de validation Zod

### AC-13 : Roles projet valides

**Given** les roles de projet
**When** le champ `role` est valide
**Then** seules les valeurs `"owner"`, `"manager"`, `"contributor"`, `"viewer"` sont acceptees

---

## Specifications Techniques

### Service : `server/src/services/project-memberships.ts`

```typescript
import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { projectMemberships, projects, authUsers } from "@mnm/db";
import { conflict, notFound } from "../errors.js";

const PROJECT_MEMBERSHIP_ROLES = ["owner", "manager", "contributor", "viewer"] as const;
type ProjectMembershipRole = (typeof PROJECT_MEMBERSHIP_ROLES)[number];

export function projectMembershipService(db: Db) {
  return {
    addMember: async (
      companyId: string,
      projectId: string,
      userId: string,
      role: ProjectMembershipRole = "contributor",
      grantedBy: string | null = null,
    ) => { /* ... */ },

    removeMember: async (companyId: string, projectId: string, userId: string) => { /* ... */ },

    listMembers: async (companyId: string, projectId: string) => { /* ... */ },

    listUserProjects: async (companyId: string, userId: string) => { /* ... */ },

    isMember: async (companyId: string, projectId: string, userId: string) => { /* ... */ },

    updateMemberRole: async (
      companyId: string,
      projectId: string,
      userId: string,
      newRole: ProjectMembershipRole,
    ) => { /* ... */ },
  };
}
```

#### Implementation `addMember`

1. Verifier que le projet existe : `db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))`
2. Si pas trouve : `throw notFound("Project not found")`
3. Tenter l'insert : `db.insert(projectMemberships).values({ companyId, projectId, userId, role, grantedBy }).returning()`
4. Si unique constraint violation : `throw conflict("User is already a member of this project")`
5. Retourner le row cree

#### Implementation `listMembers`

1. Verifier que le projet existe
2. Join `project_memberships` avec `auth.users` via `userId = auth_users.id` :
   ```typescript
   db.select({
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
   .where(and(
     eq(projectMemberships.companyId, companyId),
     eq(projectMemberships.projectId, projectId),
   ))
   ```

#### Implementation `listUserProjects`

1. Join `project_memberships` avec `projects` :
   ```typescript
   db.select({
     projectId: projectMemberships.projectId,
     projectName: projects.name,
     role: projectMemberships.role,
     createdAt: projectMemberships.createdAt,
   })
   .from(projectMemberships)
   .innerJoin(projects, eq(projectMemberships.projectId, projects.id))
   .where(and(
     eq(projectMemberships.companyId, companyId),
     eq(projectMemberships.userId, userId),
   ))
   ```

#### Implementation `removeMember`

1. `db.delete(projectMemberships).where(and(eq(companyId), eq(projectId), eq(userId))).returning()`
2. Si aucun row supprime : `throw notFound("Membership not found")`
3. Retourner le row supprime

#### Implementation `updateMemberRole`

1. `db.update(projectMemberships).set({ role: newRole, updatedAt: new Date() }).where(and(...)).returning()`
2. Si aucun row modifie : `throw notFound("Membership not found")`
3. Retourner le row avec l'ancien role pour le log d'activite

#### Implementation `isMember`

1. `db.select({ id }).from(projectMemberships).where(and(eq(companyId), eq(projectId), eq(userId)))`
2. Retourner `Boolean(row)`

### Routes : `server/src/routes/project-memberships.ts`

```typescript
import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { validate } from "../middleware/validate.js";
import { projectMembershipService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { addProjectMemberSchema, updateProjectMemberRoleSchema } from "@mnm/shared";

export function projectMembershipRoutes(db: Db) {
  const router = Router();
  const svc = projectMembershipService(db);

  // GET /api/companies/:companyId/projects/:projectId/members
  router.get("/companies/:companyId/projects/:projectId/members", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const members = await svc.listMembers(req.params.companyId, req.params.projectId);
    res.json(members);
  });

  // POST /api/companies/:companyId/projects/:projectId/members
  router.post(
    "/companies/:companyId/projects/:projectId/members",
    requirePermission(db, "projects:manage_members"),
    validate(addProjectMemberSchema),
    async (req, res) => {
      assertCompanyAccess(req, req.params.companyId);
      const { userId, role } = req.body;
      const actor = getActorInfo(req);
      const member = await svc.addMember(
        req.params.companyId,
        req.params.projectId,
        userId,
        role,
        actor.actorId,
      );
      await logActivity(db, {
        companyId: req.params.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "project.member_added",
        entityType: "project",
        entityId: req.params.projectId,
        details: { userId, role, grantedBy: actor.actorId },
      });
      res.status(201).json(member);
    },
  );

  // DELETE /api/companies/:companyId/projects/:projectId/members/:userId
  router.delete(
    "/companies/:companyId/projects/:projectId/members/:userId",
    requirePermission(db, "projects:manage_members"),
    async (req, res) => {
      assertCompanyAccess(req, req.params.companyId);
      const actor = getActorInfo(req);
      const removed = await svc.removeMember(
        req.params.companyId,
        req.params.projectId,
        req.params.userId,
      );
      await logActivity(db, {
        companyId: req.params.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "project.member_removed",
        entityType: "project",
        entityId: req.params.projectId,
        details: { userId: req.params.userId },
      });
      res.json(removed);
    },
  );

  // PATCH /api/companies/:companyId/projects/:projectId/members/:userId
  router.patch(
    "/companies/:companyId/projects/:projectId/members/:userId",
    requirePermission(db, "projects:manage_members"),
    validate(updateProjectMemberRoleSchema),
    async (req, res) => {
      assertCompanyAccess(req, req.params.companyId);
      const actor = getActorInfo(req);
      const updated = await svc.updateMemberRole(
        req.params.companyId,
        req.params.projectId,
        req.params.userId,
        req.body.role,
      );
      await logActivity(db, {
        companyId: req.params.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "project.member_role_changed",
        entityType: "project",
        entityId: req.params.projectId,
        details: { userId: req.params.userId, newRole: req.body.role },
      });
      res.json(updated);
    },
  );

  // GET /api/companies/:companyId/users/:userId/projects
  router.get("/companies/:companyId/users/:userId/projects", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    const userProjects = await svc.listUserProjects(req.params.companyId, req.params.userId);
    res.json(userProjects);
  });

  return router;
}
```

### Validators : `packages/shared/src/validators/project-membership.ts`

```typescript
import { z } from "zod";

export const PROJECT_MEMBERSHIP_ROLES = ["owner", "manager", "contributor", "viewer"] as const;

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  role: z.enum(PROJECT_MEMBERSHIP_ROLES).default("contributor"),
}).strict();

export const updateProjectMemberRoleSchema = z.object({
  role: z.enum(PROJECT_MEMBERSHIP_ROLES),
}).strict();
```

---

## data-test-id Mapping

### Convention

Tous les `data-testid` suivent le format `proj-s01-[element]`.
Cette story est backend-only, les data-testid sont destines aux tests E2E Playwright qui verifient les reponses API.

### data-testid pour reponses API (verifiables dans les tests E2E)

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `proj-s01-service-file` | `server/src/services/project-memberships.ts` | Fichier | Service CRUD project_memberships |
| `proj-s01-routes-file` | `server/src/routes/project-memberships.ts` | Fichier | Routes API Express |
| `proj-s01-validator-file` | `packages/shared/src/validators/project-membership.ts` | Fichier | Schemas Zod |
| `proj-s01-service-export` | Export dans `server/src/services/index.ts` | Code | `export { projectMembershipService }` |
| `proj-s01-routes-export` | Registration dans app router | Code | `router.use("/api", projectMembershipRoutes(db))` |
| `proj-s01-validator-export` | Export dans `packages/shared/src/validators/index.ts` | Code | Export schemas |
| `proj-s01-add-member-endpoint` | `POST /companies/:companyId/projects/:projectId/members` | API | Ajouter un membre |
| `proj-s01-list-members-endpoint` | `GET /companies/:companyId/projects/:projectId/members` | API | Lister les membres |
| `proj-s01-remove-member-endpoint` | `DELETE /companies/:companyId/projects/:projectId/members/:userId` | API | Retirer un membre |
| `proj-s01-update-role-endpoint` | `PATCH /companies/:companyId/projects/:projectId/members/:userId` | API | Changer le role |
| `proj-s01-user-projects-endpoint` | `GET /companies/:companyId/users/:userId/projects` | API | Projets d'un user |
| `proj-s01-permission-check` | `requirePermission(db, "projects:manage_members")` | Middleware | Protection mutations |
| `proj-s01-company-access-check` | `assertCompanyAccess(req, companyId)` | Middleware | Isolation company |
| `proj-s01-activity-member-added` | `project.member_added` | Event | Log activite ajout |
| `proj-s01-activity-member-removed` | `project.member_removed` | Event | Log activite retrait |
| `proj-s01-activity-role-changed` | `project.member_role_changed` | Event | Log activite changement role |
| `proj-s01-conflict-duplicate` | `409 Conflict` response | Error | Doublon rejete |
| `proj-s01-not-found-project` | `404 Not Found` response (project) | Error | Projet inexistant |
| `proj-s01-not-found-membership` | `404 Not Found` response (membership) | Error | Membership inexistant |
| `proj-s01-forbidden-permission` | `403 Forbidden` response | Error | Permission manquante |
| `proj-s01-validation-error` | `400 Bad Request` response | Error | Body invalide |
| `proj-s01-roles-enum` | `PROJECT_MEMBERSHIP_ROLES` | Constant | owner/manager/contributor/viewer |
| `proj-s01-is-member-fn` | `isMember()` function | Service | Verification appartenance |
| `proj-s01-list-response-shape` | Array response shape | API | `[{ id, userId, userName, userEmail, role, ... }]` |
| `proj-s01-user-projects-shape` | Array response shape | API | `[{ projectId, projectName, role, createdAt }]` |

---

## Test Cases pour Agent QA

### Groupe 1 : Verification fichiers (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T01 | Service file existe | `server/src/services/project-memberships.ts` existe et exporte `projectMembershipService` |
| T02 | Routes file existe | `server/src/routes/project-memberships.ts` existe et exporte `projectMembershipRoutes` |
| T03 | Validator file existe | `packages/shared/src/validators/project-membership.ts` existe et exporte les schemas |
| T04 | Service barrel export | `server/src/services/index.ts` contient `projectMembershipService` |
| T05 | Validator barrel export | `packages/shared/src/validators/index.ts` contient les exports project-membership |
| T06 | Route registration | App router inclut les routes project-memberships |

### Groupe 2 : Service functions (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T07 | addMember function | Service contient `addMember` qui insere dans `project_memberships` |
| T08 | removeMember function | Service contient `removeMember` qui delete de `project_memberships` |
| T09 | listMembers function | Service contient `listMembers` avec JOIN `authUsers` |
| T10 | listUserProjects function | Service contient `listUserProjects` avec JOIN `projects` |
| T11 | isMember function | Service contient `isMember` qui retourne boolean |
| T12 | updateMemberRole function | Service contient `updateMemberRole` qui update le role |
| T13 | Conflict handling | Service gere les duplicate key errors avec `conflict()` |
| T14 | NotFound handling | Service gere les missing records avec `notFound()` |
| T15 | Project existence check | `addMember` verifie que le projet existe avant l'insert |

### Groupe 3 : Routes (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T16 | GET list members route | Route `GET /companies/:companyId/projects/:projectId/members` existe |
| T17 | POST add member route | Route `POST` avec `requirePermission(db, "projects:manage_members")` |
| T18 | DELETE remove member route | Route `DELETE` avec `requirePermission(db, "projects:manage_members")` |
| T19 | PATCH update role route | Route `PATCH` avec `requirePermission(db, "projects:manage_members")` |
| T20 | GET user projects route | Route `GET /companies/:companyId/users/:userId/projects` existe |
| T21 | Company access check | Toutes les routes appellent `assertCompanyAccess()` |
| T22 | Activity logging | Mutations (POST, DELETE, PATCH) appellent `logActivity()` |

### Groupe 4 : Validators (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T23 | addProjectMemberSchema | Schema Zod valide `{ userId: string, role: enum }` |
| T24 | updateProjectMemberRoleSchema | Schema Zod valide `{ role: enum }` |
| T25 | Roles enum | `PROJECT_MEMBERSHIP_ROLES` = `["owner", "manager", "contributor", "viewer"]` |
| T26 | Strict mode | Les deux schemas utilisent `.strict()` |

### Groupe 5 : Permission enforcement (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T27 | POST permission | `POST` route utilise `requirePermission(db, "projects:manage_members")` |
| T28 | DELETE permission | `DELETE` route utilise `requirePermission(db, "projects:manage_members")` |
| T29 | PATCH permission | `PATCH` route utilise `requirePermission(db, "projects:manage_members")` |
| T30 | GET no mutation permission | `GET` routes ne requierent PAS `projects:manage_members` (lecture ouverte au niveau company) |

### Groupe 6 : Activity log events (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T31 | member_added event | POST route emet `project.member_added` |
| T32 | member_removed event | DELETE route emet `project.member_removed` |
| T33 | role_changed event | PATCH route emet `project.member_role_changed` |
| T34 | Event details | Chaque event contient `{ userId, projectId, ... }` dans details |

### Groupe 7 : Error responses (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T35 | Conflict error | Service utilise `conflict("User is already a member of this project")` |
| T36 | NotFound project | Service utilise `notFound("Project not found")` |
| T37 | NotFound membership | Service utilise `notFound("Membership not found")` |
| T38 | Forbidden response | requirePermission genere `Missing permission: projects:manage_members` |

### Groupe 8 : Integration patterns (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T39 | Service uses Drizzle | Queries utilisent `db.select()`, `db.insert()`, `db.delete()`, `db.update()` |
| T40 | JOIN authUsers | `listMembers` fait un LEFT JOIN avec `authUsers` pour enrichir les donnees |
| T41 | JOIN projects | `listUserProjects` fait un INNER JOIN avec `projects` pour le nom |
| T42 | Validate middleware | Routes POST et PATCH utilisent `validate()` middleware |

---

## Notes Techniques

### Error handling pour unique constraint violation

Le `addMember` doit gerer le cas ou l'index unique `project_memberships_company_project_user_unique_idx` est viole. En Drizzle/PostgreSQL, cela genere une erreur avec le code `23505`. Le service doit catch cette erreur et la transformer en `throw conflict(...)` :

```typescript
try {
  const [row] = await db.insert(projectMemberships).values({ ... }).returning();
  return row!;
} catch (err: any) {
  if (err?.code === "23505") {
    throw conflict("User is already a member of this project");
  }
  throw err;
}
```

### Project membership roles vs Business roles

Les roles de projet (`owner`, `manager`, `contributor`, `viewer`) sont distincts des `businessRole` de `company_memberships` (`admin`, `manager`, `contributor`, `viewer`). Un user peut etre `viewer` au niveau company mais `owner` au niveau projet. L'interaction entre ces deux niveaux de roles sera traitee dans PROJ-S02.

### RLS

La table `project_memberships` est sous RLS (TECH-05). Le middleware `tenant-context` set `app.current_company_id` avant chaque requete. Les routes n'ont pas besoin de filtrer par `companyId` dans les WHERE -- le RLS le fait. Cependant, on conserve le filtre explicite `eq(companyId)` comme defense en profondeur (pattern du codebase).

### Pas de migration necessaire

Le schema et la migration ont deja ete crees par TECH-06. Cette story n'a PAS besoin de nouvelle migration Drizzle. Elle cree uniquement le service, les routes et les validators.

---

## Definition of Done

- [ ] `server/src/services/project-memberships.ts` cree avec 6 fonctions CRUD
- [ ] `server/src/routes/project-memberships.ts` cree avec 5 routes API
- [ ] `packages/shared/src/validators/project-membership.ts` cree avec 2 schemas Zod
- [ ] Exports ajoutes dans `server/src/services/index.ts` et `packages/shared/src/validators/index.ts`
- [ ] Routes enregistrees dans le router principal
- [ ] `requirePermission(db, "projects:manage_members")` sur toutes les routes mutation
- [ ] `assertCompanyAccess()` sur toutes les routes
- [ ] Activity log emis pour chaque mutation (added, removed, role_changed)
- [ ] Gestion des erreurs : 409 doublon, 404 projet/membership, 403 permission, 400 validation
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
- [ ] Tests E2E Playwright (agent QA) passent
