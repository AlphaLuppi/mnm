# Architecture — Roles + Tags + Dynamic Permissions

> **Version** : 2.0 | **Date** : 2026-03-22 | **Statut** : Reviewed
> **Input** : Brainstorm enterprise 2026-03-21 (Solution Hybride), clarifications Tom 2026-03-22
> **Scope** : Roles custom, Tags organisationnels, permissions dynamiques, isolation par tags, sandbox routing, CAO, Task Pool
> **Review** : Adversarial review passed — 11 findings fixed (v1→v2)

---

## Table des Matières

1. [Architectural Drivers](#1-architectural-drivers)
2. [Principes Fondamentaux](#2-principes-fondamentaux)
3. [Data Architecture](#3-data-architecture)
4. [Permission Resolution](#4-permission-resolution)
5. [Tag-Based Isolation (Backend)](#5-tag-based-isolation-backend)
6. [Agent Visibility & Sandbox Routing](#6-agent-visibility--sandbox-routing)
7. [Task Pool & Tag Assignment](#7-task-pool--tag-assignment)
8. [CAO — Chief Agent Officer](#8-cao--chief-agent-officer)
9. [Single-Tenant Simplification](#9-single-tenant-simplification)
10. [API Design](#10-api-design)
11. [Onboarding Flow](#11-onboarding-flow)
12. [Audit Trail pour Mutations Sensibles](#12-audit-trail-pour-mutations-sensibles)
13. [Cache & Invalidation](#13-cache--invalidation)
14. [Impact sur l'Existant — Ce qui est Nuké](#14-impact-sur-lexistant--ce-qui-est-nuké)
15. [Trade-offs & Décisions](#15-trade-offs--décisions)

---

## 1. Architectural Drivers

| # | Driver | Conséquence architecturale |
|---|--------|---------------------------|
| AD-1 | **Tags = frontière d'accès backend** | Tag A ne voit JAMAIS les données de Tag B. Enforcement au niveau query (service layer), pas juste UI. |
| AD-2 | **Rien de hardcodé** | 0 rôle, 0 permission, 0 preset dans le code. Tout est en DB, généré à l'onboarding. |
| AD-3 | **Single-tenant dominant** | 90% des clients = 1 instance = 1 entreprise. `company_id` gardé en DB (RLS gratuit) mais invisible, auto-injecté, jamais exposé. |
| AD-4 | **Sandbox = toujours personnel** | 1 user = 1 container = 1 auth Claude. Pas de sandbox d'équipe. Tags = visibilité, pas exécution. |
| AD-5 | **Agents = taggables** | Un agent a des tags. La visibilité d'un agent = intersection tags user ∩ tags agent. |
| AD-6 | **Pas en prod** | Aucune contrainte de migration. On nuke et on rebuild. |
| AD-7 | **Performance permission resolution** | `hasPermission()` appelé à chaque requête. Doit rester O(1) avec cache. |

---

## 2. Principes Fondamentaux

### Séparation STABLE vs VOLATILE

```
STABLE = RÔLES
  → Définissent les PERMISSIONS (ce qu'on peut FAIRE)
  → Changent rarement (promotion, nouveau rôle = événement RH)
  → Petit set par entreprise (3-8 rôles typique)
  → Hiérarchiques (Admin > Lead > Member > Viewer)

VOLATILE = TAGS
  → Définissent la VISIBILITÉ (ce qu'on peut VOIR)
  → Bougent tout le temps (re-orgs, nouveaux produits, nouveaux membres)
  → Grand set par entreprise (10-100+ tags)
  → Plats (pas de hiérarchie entre tags)
  → Additifs (on ajoute avant de retirer, coexistence pendant transition)
```

### Règle d'or

> **Un user peut FAIRE une action (rôle) SI ET SEULEMENT SI il peut VOIR la ressource (tags).**
>
> Permission effective = `role.permissions.includes(action) AND user.tags ∩ resource.tags ≠ ∅`

### Exceptions

- **Rôles avec `bypass_tag_filter = true`** : voient tout, pas de filtrage par tags. Le rôle Admin system a ce flag.
- **CAO** : a tous les tags ET reçoit automatiquement chaque nouveau tag créé.

---

## 3. Data Architecture

### 3.1 Nouvelles Tables

```sql
-- Table PERMISSIONS : registre de toutes les permissions connues
CREATE TABLE permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  slug          TEXT NOT NULL,                    -- "agents:launch", "issues:create"
  description   TEXT NOT NULL,                    -- "Lancer un agent run"
  category      TEXT NOT NULL,                    -- "agents", "issues", "admin"
  is_custom     BOOLEAN NOT NULL DEFAULT FALSE,   -- true = créé par le client
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(company_id, slug)
);

-- Table ROLES : petit set stable, permissions via FK
CREATE TABLE roles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  name                TEXT NOT NULL,                    -- "Admin", "Lead", "Member"
  slug                TEXT NOT NULL,                    -- "admin", "lead", "member"
  description         TEXT,
  hierarchy_level     INTEGER NOT NULL DEFAULT 100,     -- 0=highest, 100=lowest
  inherits_from_id    UUID REFERENCES roles(id),        -- 1 seul parent, pas de chaîne
  bypass_tag_filter   BOOLEAN NOT NULL DEFAULT FALSE,   -- true = voit tout (Admin)
  is_system           BOOLEAN NOT NULL DEFAULT FALSE,   -- true = cannot delete
  color               TEXT,
  icon                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(company_id, slug),
  -- Empêche les cycles : un rôle ne peut pas hériter de lui-même
  CHECK (inherits_from_id IS NULL OR inherits_from_id != id)
);

-- Table ROLE_PERMISSIONS : many-to-many rôle ↔ permission
CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Table TAGS : set flexible, AUCUNE permission, juste de l'organisation
CREATE TABLE tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  name          TEXT NOT NULL,                    -- "Produit-A", "Frontend", "QA"
  slug          TEXT NOT NULL,                    -- "produit-a", "frontend", "qa"
  description   TEXT,
  color         TEXT,
  icon          TEXT,
  archived_at   TIMESTAMPTZ,                      -- soft delete for transitions
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(company_id, slug)
);

-- Table TAG_ASSIGNMENTS : qui/quoi a quel tag (users ET agents)
CREATE TABLE tag_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  target_type     TEXT NOT NULL,                  -- 'user' | 'agent'
  target_id       TEXT NOT NULL,                  -- user.id ou agent.id (as text)
  tag_id          UUID NOT NULL REFERENCES tags(id),
  assigned_by     TEXT,                            -- userId qui a assigné (audit)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(company_id, target_type, target_id, tag_id)
);

CREATE INDEX tag_assignments_target_idx
  ON tag_assignments(company_id, target_type, target_id);
CREATE INDEX tag_assignments_tag_idx
  ON tag_assignments(company_id, tag_id);
```

### 3.2 Tables Modifiées

```sql
-- company_memberships : business_role text → role_id FK
-- On nuke et rebuild (pas en prod)
company_memberships:
  DROP COLUMN business_role
  ADD COLUMN role_id UUID NOT NULL REFERENCES roles(id)

-- agents : supprimer la colonne "role", ajouter created_by_user_id
agents:
  DROP COLUMN role            -- remplacé par tags via tag_assignments
  ADD COLUMN created_by_user_id TEXT  -- pour le fallback sandbox routing

-- issues : ajout assignee_tag_id
issues:
  ADD COLUMN assignee_tag_id UUID REFERENCES tags(id)
  -- Une issue peut être assignée à :
  --   assignee_agent_id (direct à un agent)
  --   assignee_user_id  (direct à un user)
  --   assignee_tag_id   (à un tag → pool filtré par tag)
  -- Si les 3 sont NULL → pool global (visible par Admin uniquement)
```

### 3.3 Tables Supprimées

```
SUPPRIMÉ :
  - principal_permission_grants → remplacé par role_permissions
  - TOUTES les constantes hardcodées (BUSINESS_ROLES, AGENT_ROLES, PERMISSION_KEYS, etc.)
  - rbac-presets.ts, role-hierarchy.ts

GARDÉ TEL QUEL :
  - instance_user_roles (instance_admin bypass — orthogonal aux company roles)
  - user_pods (sandbox personnel, inchangé)
```

### 3.4 Schema Drizzle

```typescript
// packages/db/src/schema/permissions.ts
export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companySlugIdx: uniqueIndex("permissions_company_slug_idx").on(table.companyId, table.slug),
  companyCategoryIdx: index("permissions_company_category_idx").on(table.companyId, table.category),
}));

// packages/db/src/schema/roles.ts
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  hierarchyLevel: integer("hierarchy_level").notNull().default(100),
  inheritsFromId: uuid("inherits_from_id").references((): AnyPgColumn => roles.id),
  bypassTagFilter: boolean("bypass_tag_filter").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  color: text("color"),
  icon: text("icon"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companySlugIdx: uniqueIndex("roles_company_slug_idx").on(table.companyId, table.slug),
  companyLevelIdx: index("roles_company_level_idx").on(table.companyId, table.hierarchyLevel),
}));

// packages/db/src/schema/role_permissions.ts
export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

// packages/db/src/schema/tags.ts
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  color: text("color"),
  icon: text("icon"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companySlugIdx: uniqueIndex("tags_company_slug_idx").on(table.companyId, table.slug),
  archivedIdx: index("tags_archived_idx").on(table.companyId, table.archivedAt),
}));

// packages/db/src/schema/tag_assignments.ts
export const tagAssignments = pgTable("tag_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  targetType: text("target_type").notNull(),     // 'user' | 'agent'
  targetId: text("target_id").notNull(),
  tagId: uuid("tag_id").notNull().references(() => tags.id),
  assignedBy: text("assigned_by"),               // userId qui a assigné
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueTagAssignmentIdx: uniqueIndex("tag_assignments_unique_idx").on(
    table.companyId, table.targetType, table.targetId, table.tagId
  ),
  targetIdx: index("tag_assignments_target_idx").on(
    table.companyId, table.targetType, table.targetId
  ),
  tagIdx: index("tag_assignments_tag_idx").on(table.companyId, table.tagId),
}));
```

### 3.5 Diagramme Relationnel

```
                    ┌─────────────┐
                    │  companies  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
  ┌──────▼──────┐   ┌─────▼─────┐   ┌───────▼───────┐
  │ permissions │   │   tags     │   │    agents      │
  │ (registry)  │   │            │   │ (created_by_   │
  └──────┬──────┘   └─────┬──────┘   │  user_id)     │
         │                │          └───────┬────────┘
  ┌──────▼──────┐   ┌─────▼──────────────────▼───────┐
  │    roles    │   │       tag_assignments           │
  │ (hierarchy, │   │  (user↔tag, agent↔tag)          │
  │  bypass_tag │   └────────────────────────────────┘
  │  _filter)   │
  └──────┬──────┘
         │
  ┌──────▼──────────┐     ┌──────────────────────┐
  │role_permissions  │     │ company_memberships  │
  │ (role↔permission)│     │ (role_id FK)         │
  └─────────────────┘     └──────────────────────┘
```

---

## 4. Permission Resolution

### 4.1 Nouveau `hasPermission()` — Simple et Performant

```typescript
async function hasPermission(
  companyId: string,
  userId: string,
  action: string,           // ex: "agents:launch"
  resourceTagIds?: string[] // tags de la ressource cible (optionnel)
): Promise<boolean> {
  // 1. Instance admin bypass (super-admin MnM)
  if (await isInstanceAdmin(userId)) return true;

  // 2. Charger le membership + role (1 query, cacheable)
  const membership = await getMembershipWithRole(companyId, userId);
  if (!membership || membership.status !== "active") return false;

  // 3. Résoudre les permissions (rôle + parent si héritage 1-niveau)
  const permSlugs = await resolvePermissionSlugs(membership.role);
  if (!permSlugs.has(action)) return false;

  // 4. Si la ressource a des tags → vérifier l'intersection
  if (resourceTagIds && resourceTagIds.length > 0) {
    // bypass_tag_filter = true → pas de filtrage (Admin)
    if (membership.role.bypassTagFilter) return true;

    const userTagIds = await getUserTagIds(companyId, userId);
    const hasOverlap = resourceTagIds.some(id => userTagIds.has(id));
    if (!hasOverlap) return false;
  }

  return true;
}
```

### 4.2 Résolution Permissions — 1 Niveau, Pas de Récursion

```typescript
// Résolution PLATE : rôle + parent direct. Jamais de chaîne.
async function resolvePermissionSlugs(role: Role): Promise<Set<string>> {
  // Cache hit ?
  const cached = permissionCache.get(role.id);
  if (cached && !isStale(cached)) return cached.slugs;

  // Charger les permissions du rôle
  const ownPerms = await db.select({ slug: permissions.slug })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, role.id));

  const slugs = new Set(ownPerms.map(p => p.slug));

  // Si héritage → charger les permissions du parent (1 niveau max)
  if (role.inheritsFromId) {
    const parentPerms = await db.select({ slug: permissions.slug })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(rolePermissions.roleId, role.inheritsFromId));

    for (const p of parentPerms) slugs.add(p.slug);
  }
  // PAS de récursion. Si le parent a lui-même un parent, on l'ignore.
  // Le CHECK constraint empêche les cycles (inherits_from_id != id).
  // L'UI empêche les chaînes (dropdown filtre les rôles qui héritent déjà).

  permissionCache.set(role.id, { slugs, cachedAt: Date.now() });
  return slugs;
}
```

### 4.3 Validation des Permission Slugs

```typescript
// Au démarrage du serveur : valider que toutes les permissions
// utilisées dans les route guards existent dans la table permissions.

async function validatePermissionSlugs(db: Db, companyId: string) {
  const knownSlugs = await db.select({ slug: permissions.slug })
    .from(permissions)
    .where(eq(permissions.companyId, companyId));
  const known = new Set(knownSlugs.map(p => p.slug));

  // ROUTE_PERMISSION_MAP est auto-généré par le build
  // à partir des décorateurs sur les routes
  for (const [route, requiredSlug] of ROUTE_PERMISSION_MAP) {
    if (!known.has(requiredSlug)) {
      logger.error({ route, slug: requiredSlug },
        "PERMISSION INCONNUE dans un route guard — typo probable !");
      // En dev : crash. En prod : warning.
      if (process.env.NODE_ENV === "development") {
        throw new Error(`Unknown permission "${requiredSlug}" on route ${route}`);
      }
    }
  }
}
```

### 4.4 Permissions Standard — Seed Set

Les permissions sont stockées en DB (table `permissions`), seedées à l'onboarding. Le code ne hardcode **jamais** la liste, mais valide au startup que les slugs utilisés dans les guards existent (cf. 4.3).

```
SEED PERMISSIONS (créées à l'onboarding) :

Agents:
  agents:create        — Créer un nouvel agent
  agents:launch        — Lancer un agent run
  agents:configure     — Modifier la config d'un agent
  agents:delete        — Supprimer un agent

Issues:
  issues:create        — Créer une issue
  issues:assign        — Assigner une issue
  issues:delete        — Supprimer une issue

Projects:
  projects:create      — Créer un projet
  projects:manage      — Gérer les membres d'un projet

Users:
  users:invite         — Inviter des utilisateurs
  users:manage         — Gérer les rôles/tags des utilisateurs

Workflows:
  workflows:create     — Créer un workflow template
  workflows:enforce    — Activer/désactiver l'enforcement

Observability:
  traces:read          — Voir les traces
  traces:manage        — Gérer les prompts gold, lenses

Admin:
  settings:manage      — Paramètres de l'instance
  audit:read           — Lire l'audit log
  audit:export         — Exporter l'audit log
  sso:manage           — Configurer SSO
  roles:manage         — Créer/modifier les rôles
  tags:manage          — Créer/modifier les tags

Chat:
  chat:agent           — Discuter avec les agents
  chat:channel         — Créer des channels

Sandbox:
  sandbox:manage       — Gérer les sandboxes
```

Les clients peuvent créer des permissions custom (`is_custom = true`) via l'UI admin. Ces permissions custom sont utilisables dans les rôles mais ne sont pas référencées par les route guards (qui ne connaissent que le seed set).

---

## 5. Tag-Based Isolation (Backend)

### 5.1 Principe : Double Couche d'Isolation

```
Couche 1 — RLS PostgreSQL (company_id)
  → Isolation TENANT (entreprise A ne voit jamais entreprise B)
  → Transparent, automatique, infaillible
  → Déjà en place sur 48+ tables

Couche 2 — Tag filtering (application layer)
  → Isolation INTRA-TENANT (équipe A ne voit pas équipe B)
  → Enforced via le pattern TagScope (voir 5.2)
```

### 5.2 TagScope — Pattern d'Enforcement Obligatoire

**Problème résolu** : un développeur qui oublie le tag filter sur un endpoint = fuite de données.

**Solution** : le `TagScope` est un objet opaque, créé par le middleware, qui DOIT être passé à toute query de données filtrables. Sans lui, le service refuse de retourner des données.

```typescript
// Type opaque — ne peut être créé que par le middleware
type TagScope = {
  readonly __brand: "TagScope";
  readonly userId: string;
  readonly tagIds: Set<string>;       // tags du user (vide si bypass)
  readonly bypassTagFilter: boolean;  // true = Admin, voit tout
};

// Middleware : injecte le TagScope dans req
async function tagScopeMiddleware(req, res, next) {
  const membership = await getMembershipWithRole(companyId, req.userId);
  const role = membership.role;

  if (role.bypassTagFilter) {
    req.tagScope = createTagScope(req.userId, new Set(), true);
  } else {
    const tagIds = await getUserTagIds(companyId, req.userId);
    req.tagScope = createTagScope(req.userId, tagIds, false);
  }
  next();
}

// Les services EXIGENT un TagScope en paramètre
async function listAgents(companyId: string, scope: TagScope) {
  const query = db.select().from(agents).where(eq(agents.companyId, companyId));

  if (scope.bypassTagFilter) return query;

  // Filtrer par intersection de tags
  return query.innerJoin(tagAssignments, and(
    eq(tagAssignments.targetType, "agent"),
    sql`${tagAssignments.targetId} = ${agents.id}::text`,
    inArray(tagAssignments.tagId, [...scope.tagIds]),
  ));
}

// IMPOSSIBLE d'appeler listAgents() sans TagScope.
// Ça force chaque route à passer par le middleware.
// Si un dev crée un endpoint et oublie → erreur TypeScript.
```

### 5.3 Ressources Filtrées par Tags

| Ressource | Filtrage via TagScope | Règle |
|-----------|----------------------|-------|
| **Agents** | `tag_assignments` agent ∩ scope.tagIds | Un user voit un agent s'ils partagent au moins 1 tag |
| **Issues** | `assignee_tag_id` ∩ scope.tagIds, OU `assignee_user_id = scope.userId` | Un user voit les issues de ses tags OU assignées directement à lui |
| **Issues pool global** | `assignee_*` tous NULL | **Visibles uniquement par les rôles avec `bypass_tag_filter`** (Admin). Pas de pool global sans filtrage. |
| **Traces/Runs** | Via l'agent parent | Si le user voit l'agent → il voit ses traces |
| **Projects** | Via `project_memberships` (inchangé) | Les projects gardent leur propre membership |
| **Chat channels** | Via tags sur le channel (futur) | Pour l'instant pas de filtrage tag |

### 5.4 Sécurité — Fail-Closed

```
RÈGLES :
  1. Un user sans tags → ne voit RIEN (sauf ses assignations directes)
  2. Un agent sans tags → invisible par TOUS (sauf bypass_tag_filter)
  3. Une issue pool global (3 assignees NULL) → visible SEULEMENT par Admin
  4. L'onboarding DOIT assigner au moins 1 tag à chaque user
  5. La création d'un agent FORCE la sélection d'au moins 1 tag (UI)
  6. Le CAO détecte et alerte sur les users/agents sans tags
```

---

## 6. Agent Visibility & Sandbox Routing

### 6.1 Agent Visibility (Tags)

```
Agent "Code Review Bot" → tags: [Produit-A, Code-Review]
Tom → tags: [Produit-A, Frontend, Lead-UIKit]
Gab → tags: [Produit-B, Backend]

Tom voit l'agent (Produit-A ∩ {Produit-A, Code-Review} ≠ ∅) → peut le lancer
Gab NE voit PAS l'agent ({Produit-B, Backend} ∩ {Produit-A, Code-Review} = ∅)

Partager l'agent avec Gab = ajouter le tag Produit-B à l'agent
  OU ajouter le tag Produit-A à Gab
  OU créer un tag "Shared-Review-Bots" et l'ajouter aux deux
```

### 6.2 Sandbox Routing (Exécution Toujours Personnelle)

```
Tom lance "Code Review Bot"
  → executeRun() résout l'acteur = Tom
  → sandboxManager.getOrCreate(tom.id, companyId)
  → docker exec dans le container de Tom
  → auth Claude = token de Tom
  → traces/runs = rattachés au run de Tom

Gab lance le même agent (s'il a accès via tags)
  → Même chose, mais dans le container de Gab

La config agent est un TEMPLATE partagé.
L'exécution est PERSONNELLE.
```

### 6.3 Résolution de l'Acteur

```typescript
function resolveRunActor(run: HeartbeatRun, agent: Agent): string {
  // 1. Explicit : le user qui a cliqué "Run"
  if (run.wakeupRequest?.requestedByActorId) {
    return run.wakeupRequest.requestedByActorId;
  }
  // 2. Issue : le user assigné ou le créateur de l'issue
  if (run.issue?.assigneeUserId) {
    return run.issue.assigneeUserId;
  }
  if (run.issue?.createdByUserId) {
    return run.issue.createdByUserId;
  }
  // 3. Fallback : le créateur de l'agent (nouveau champ agents.created_by_user_id)
  if (agent.createdByUserId) {
    return agent.createdByUserId;
  }
  // 4. ERREUR — ne jamais exécuter sans acteur identifié
  throw new Error(`No actor resolvable for run ${run.id}, agent ${agent.id}`);
}
```

**Note** : `agents.created_by_user_id` est un **nouveau champ** ajouté à la table agents (section 3.2). Il est rempli automatiquement à la création de l'agent.

---

## 7. Task Pool & Tag Assignment

### 7.1 Task Pool = Issues Sans Assignee Direct

```
Pas de nouvelle table. Le pool = WHERE sur les issues existantes.

Assigné direct :   assignee_agent_id IS NOT NULL OU assignee_user_id IS NOT NULL
Pool par tag :     assignee_tag_id IS NOT NULL (et pas d'assignee direct)
Pool global :      les 3 assignees sont NULL → Admin only (bypass_tag_filter)
```

### 7.2 Visibilité du Pool

```
Un user voit les issues du pool SI :
  1. L'issue est assignée à un de ses tags (assignee_tag_id ∈ scope.tagIds)
  2. L'issue est assignée directement à lui (assignee_user_id = userId)
  3. L'issue a assignee tout NULL ET le user a bypass_tag_filter (Admin)
  4. Jamais de pool "visible par tout le monde" sans filtre
```

### 7.3 "Prendre" une Issue du Pool

```
Un user/agent "prend" une issue du pool :
  → assignee_user_id = userId (ou assignee_agent_id = agentId)
  → L'exécution tourne dans le sandbox de l'acteur
  → L'issue garde son assignee_tag_id (historique) mais l'assignee direct prime
```

---

## 8. CAO — Chief Agent Officer

### 8.1 Dual Nature

```
AUTO-CRÉÉ au setup de l'instance.
  → role = Admin (bypass_tag_filter=true, is_system=true)
  → tags = TOUS les tags existants
  → Auto-tagging : un hook sur INSERT dans tags crée automatiquement
    un tag_assignments pour le CAO (voir 8.3)

MODE SILENCIEUX (watchdog) :
  → Hook sur événements lifecycle (issue created, stage changed, agent error)
  → Détecte les anomalies :
    - Issues assignées à un tag archivé
    - Users/agents sans tags
    - Agents en erreur récurrente
    - Bypass de workflow
  → Commente les issues (suggestions, warnings)
  → Trace dans l'audit log
  → Ne BLOQUE jamais

MODE INTERACTIF :
  → @cao dans un commentaire → il répond via le chat system
  → Questions type :
    - "Quels agents sont dispo pour ce tag ?"
    - "Résume l'état du projet X"
    - "Qui devrait prendre cette issue ?"
```

### 8.2 Implémentation Technique

```
Le CAO est un AGENT avec :
  - adapter_type = "system" (nouveau type, pas de sandbox Docker)
  - Tourne dans le process MnM server directement
  - Utilise claude -p --model haiku pour le monitoring silencieux
  - Utilise claude -p --model sonnet pour les réponses interactives
  - Ses "runs" sont des background jobs, pas des sandbox executions
  - created_by_user_id = l'admin qui a créé l'instance
```

### 8.3 Auto-Tagging du CAO

```typescript
// Hook : quand un tag est créé → auto-assigner au CAO
async function onTagCreated(companyId: string, tagId: string) {
  const cao = await db.select().from(agents)
    .where(and(
      eq(agents.companyId, companyId),
      eq(agents.adapterType, "system"), // le CAO est le seul "system" agent
    ))
    .then(rows => rows[0]);

  if (!cao) return; // pas encore de CAO (ne devrait pas arriver)

  await db.insert(tagAssignments).values({
    companyId,
    targetType: "agent",
    targetId: cao.id,
    tagId,
    assignedBy: "system",
  }).onConflictDoNothing(); // idempotent
}
```

---

## 9. Single-Tenant Simplification

```
SUPPRIMÉ DE L'UI :
  - Sidebar company selector
  - Company creation flow
  - Company switching

AUTO-INJECTÉ SERVER-SIDE :
  - companyId résolu automatiquement (1 seule company en DB)
  - Middleware : si req n'a pas de companyId → prendre la seule company
  - RLS : toujours actif (filet de sécurité gratuit)

GARDÉ EN DB :
  - company_id sur toutes les tables (0 effort, RLS intact)
  - companies table (1 seule row)
  - company_memberships (avec role_id)

IMPORTANT : garder le surface area de company_id minimal.
  - Ne jamais ajouter de logique qui dépend de multi-company
  - Auto-inject partout, jamais demandé au client
  - Si un jour multi-tenant → c'est déjà prêt en DB
```

---

## 10. API Design

### 10.1 Roles API

```
GET    /api/roles                    → Liste des rôles
POST   /api/roles                    → Créer un rôle
GET    /api/roles/:roleId            → Détail d'un rôle + ses permissions
PATCH  /api/roles/:roleId            → Modifier un rôle (nom, level, permissions)
DELETE /api/roles/:roleId            → Supprimer un rôle (interdit si is_system)

Permissions requises : roles:manage
```

### 10.2 Tags API

```
GET    /api/tags                     → Liste des tags (exclut archivés par défaut)
POST   /api/tags                     → Créer un tag (+ auto-assign au CAO)
GET    /api/tags/:tagId              → Détail d'un tag
PATCH  /api/tags/:tagId              → Modifier un tag
POST   /api/tags/:tagId/archive      → Archiver un tag
DELETE /api/tags/:tagId              → Supprimer (seulement si 0 assignments)

Permissions requises : tags:manage
```

### 10.3 Tag Assignments API

```
GET    /api/users/:userId/tags          → Tags d'un user
PUT    /api/users/:userId/tags          → Set les tags d'un user (replace all)
POST   /api/users/:userId/tags/:tagId   → Ajouter un tag à un user
DELETE /api/users/:userId/tags/:tagId   → Retirer un tag d'un user

GET    /api/agents/:agentId/tags        → Tags d'un agent
PUT    /api/agents/:agentId/tags        → Set les tags d'un agent
POST   /api/agents/:agentId/tags/:tagId → Ajouter un tag à un agent
DELETE /api/agents/:agentId/tags/:tagId → Retirer un tag d'un agent

GET    /api/tags/:tagId/members         → Tous les users + agents avec ce tag

Permissions requises : users:manage (user tags), agents:configure (agent tags)
```

### 10.4 Permissions API

```
GET    /api/permissions                 → Liste des permissions (seed + custom)
POST   /api/permissions                 → Créer une permission custom

Permissions requises : roles:manage
```

### 10.5 Member Role API

```
PATCH  /api/members/:memberId/role     → Changer le rôle d'un membre
  Body: { roleId: "uuid" }
  Contrôle : le rôle cible doit avoir hierarchy_level >= celui de l'acteur
  Permissions requises : users:manage
```

### 10.6 Changements API Existantes

```
GET /api/agents → filtré automatiquement par TagScope
GET /api/issues → filtré par TagScope + assignee direct
  Nouveau query param : ?pool=true (issues sans assignee direct)
  Nouveau query param : ?tagId=uuid (filtrer par tag spécifique)

Note : le companyId est supprimé des URL paths.
  Avant : /api/companies/:companyId/agents
  Après : /api/agents
  Le companyId est auto-injecté via middleware.
```

---

## 11. Onboarding Flow

### 11.1 Wizard Steps (Repensé)

```
Step 1 — Company Info
  → Nom, logo, secteur (déjà existant, simplifié)
  → Crée la company + seed les permissions standard (table permissions)

Step 2 — Rôles
  → Proposer 3 presets :
    - "Startup" : Admin, Member (2 rôles)
    - "Équipe structurée" : Admin, Lead, Member, Viewer (4 rôles)
    - "Custom" : l'admin crée ses propres rôles
  → Chaque preset pré-remplit nom + permissions associées
  → L'admin peut modifier les permissions dans un éditeur visuel (checkbox grid)
  → Le rôle Admin est toujours créé (is_system, bypass_tag_filter)

Step 3 — Tags
  → Proposer de créer les premiers tags :
    - Par équipe ("Frontend", "Backend", "Design")
    - Par produit ("Produit-A", "Produit-B")
    - Par fonction ("QA", "DevOps", "Data")
    - Custom
  → Suggestions dynamiques basées sur le secteur choisi
  → Chaque tag créé → auto-assigné au CAO

Step 4 — Inviter les membres
  → Email + rôle + tags
  → Batch invite (CSV possible)

Step 5 — Premier agent
  → Créer un agent avec des tags (pré-sélection = tags du créateur)
  → Lancer un test run dans le sandbox du créateur
```

### 11.2 Seed Data (Auto-Généré)

```
À la création d'une company :
  1. Seed les permissions standard (table permissions, ~22 rows)
  2. Créer le rôle "Admin" (is_system=true, hierarchy_level=0, bypass_tag_filter=true, toutes permissions)
  3. Assigner le créateur comme Admin
  4. Créer l'agent CAO (adapter_type="system", is_system=true, bypass... impliqué par Admin role)
  5. NE PAS créer d'autres rôles/tags → l'onboarding wizard le fait
```

---

## 12. Audit Trail pour Mutations Sensibles

Toutes les mutations sur les rôles, tags, et assignments sont tracées dans `activity_log` (table existante, immutable, partitionnée).

### Événements Audités

| Événement | Données logguées |
|-----------|-----------------|
| `role.created` | roleId, name, permissions, actorUserId |
| `role.updated` | roleId, diff (permissions added/removed, level changed), actorUserId |
| `role.deleted` | roleId, name, actorUserId |
| `tag.created` | tagId, name, actorUserId |
| `tag.archived` | tagId, name, actorUserId |
| `tag.deleted` | tagId, name, actorUserId |
| `tag_assignment.created` | targetType, targetId, tagId, assignedBy |
| `tag_assignment.removed` | targetType, targetId, tagId, removedBy |
| `member.role_changed` | memberId, oldRoleId, newRoleId, actorUserId |
| `permission.created` | slug, description, isCustom, actorUserId |

### Implémentation

```typescript
// Chaque service de mutation appelle auditService.log()
async function createTag(companyId: string, data: CreateTagInput, actorUserId: string) {
  const tag = await db.insert(tags).values({ ...data, companyId }).returning();

  // Auto-assign au CAO
  await onTagCreated(companyId, tag.id);

  // Audit
  await auditService.log({
    companyId,
    eventType: "tag.created",
    actorUserId,
    payload: { tagId: tag.id, name: data.name },
  });

  // Invalidate tag caches
  await cacheInvalidator.tagChanged(companyId);

  return tag;
}
```

---

## 13. Cache & Invalidation

### 13.1 Ce qui est Caché

```
Cache 1 : Role + Permissions par userId
  → Map<userId, { roleId, permissionSlugs: Set<string>, bypassTagFilter, cachedAt }>
  → TTL : 5 minutes
  → Invalidé sur : role.updated, member.role_changed

Cache 2 : Tag IDs par userId
  → Map<userId, { tagIds: Set<string>, cachedAt }>
  → TTL : 5 minutes
  → Invalidé sur : tag_assignment.created, tag_assignment.removed
```

### 13.2 Mécanisme d'Invalidation

```typescript
// EventEmitter interne (déjà existant : live-events.ts)
// Utilisé pour la communication inter-services dans le même process

class CacheInvalidator {
  private roleCache = new Map<string, CachedRole>();
  private tagCache = new Map<string, CachedTags>();

  // Appelé par les services de mutation
  async roleChanged(companyId: string, affectedUserIds?: string[]) {
    if (affectedUserIds) {
      // Invalidation ciblée
      for (const uid of affectedUserIds) this.roleCache.delete(uid);
    } else {
      // Invalidation globale (role modifié → tous les users de ce rôle)
      this.roleCache.clear();
    }
    // Publier sur EventEmitter pour les WebSocket subscribers
    liveEvents.emit("cache:invalidated", { companyId, type: "roles" });
  }

  async tagChanged(companyId: string, affectedTargetIds?: string[]) {
    if (affectedTargetIds) {
      for (const id of affectedTargetIds) this.tagCache.delete(id);
    } else {
      this.tagCache.clear();
    }
    liveEvents.emit("cache:invalidated", { companyId, type: "tags" });
  }
}

// NOTE : MnM tourne en single-process Node.js.
// Si un jour multi-process → remplacer Map par Redis + pub/sub.
// L'interface CacheInvalidator reste identique.
```

---

## 14. Impact sur l'Existant — Ce qui est Nuké

### Code à Supprimer

```
packages/shared/src/constants.ts:
  - BUSINESS_ROLES, BusinessRole, BUSINESS_ROLE_LABELS
  - AGENT_ROLES, AgentRole, AGENT_ROLE_LABELS
  - PERMISSION_KEYS, PermissionKey (deviennent des strings dynamiques)

packages/shared/src/rbac-presets.ts:
  - TOUT le fichier

packages/shared/src/role-hierarchy.ts:
  - TOUT le fichier (remplacé par roles.hierarchy_level en DB)

packages/db/src/schema/principal_permission_grants.ts:
  - TOUTE la table (remplacé par role_permissions)

server/src/services/access.ts:
  - Rewrite complet
```

### Code à Modifier

```
packages/db/src/schema/company_memberships.ts:
  - business_role text → role_id uuid FK

packages/db/src/schema/agents.ts:
  - Supprimer la colonne "role"
  - Ajouter created_by_user_id text

server/src/services/access.ts:
  - Nouveau : resolvePermissionSlugs(), hasPermission() avec TagScope
  - Supprimer : setMemberPermissions, setPrincipalGrants, preset logic

server/src/middleware/:
  - Ajouter tagScopeMiddleware
  - Modifier tenant-context.ts pour auto-inject single company

server/src/routes/:
  - Supprimer :companyId des URL paths
  - Ajouter routes /api/roles, /api/tags, /api/permissions, /api/*/tags
  - Tous les handlers passent req.tagScope aux services

ui/src/:
  - Supprimer le company selector sidebar
  - Refaire le panel admin (rôles + tags + permissions editor)
  - Refaire l'agent creation (tags au lieu de role dropdown)
  - Refaire l'issue assignment (ajout assignee_tag_id option)
  - Refaire l'onboarding wizard (5 steps)
```

---

## 15. Trade-offs & Décisions

### TD-1 : Tag isolation = application layer (TagScope), pas RLS PG

```
Choix : Le filtrage par tags se fait via le pattern TagScope (middleware + service params),
pas via RLS PostgreSQL.

Raison : Les tags sont many-to-many (tag_assignments). RLS avec un JOIN est possible mais :
  - Requiert un set_config avec une liste de tag IDs (pas un seul UUID)
  - Performance dégradée (RLS évalué à chaque row)
  - Moins flexible (hard to do admin bypass en RLS)

Le RLS company_id reste comme filet de sécurité tenant.
Le TagScope est enforced par le type system TypeScript : un service ne peut pas
retourner de données filtrables sans recevoir un TagScope en paramètre.

Mitigation supplémentaire : tests E2E qui vérifient l'isolation inter-tags.
```

### TD-2 : Permissions dans une table séparée, pas JSONB

```
Choix (v2, corrigé) : Les permissions sont dans une table `permissions` avec une
join table `role_permissions`, pas un JSONB array sur roles.

Raison :
  - Détection de typos au startup (validation against known slugs)
  - Self-documenting (chaque permission a une description et une catégorie)
  - Query "quels rôles ont la permission X" = triviale
  - Les clients peuvent créer des permissions custom (is_custom=true)
  - FK integrity (une permission supprimée cascade sur role_permissions)

Trade-off : 1 JOIN supplémentaire pour charger les permissions d'un rôle.
  → Mitigé par le cache (5min TTL).
```

### TD-3 : Agent tags = seul mécanisme de visibilité (fail-closed)

```
Choix : Un agent SANS tags n'est visible par PERSONNE (sauf bypass_tag_filter).

Raison : Fail-closed. Pas de "visible par défaut".
  - À la création d'un agent, l'UI force la sélection d'au moins 1 tag
  - Pré-sélection = tags du créateur (le user n'a qu'à confirmer)

Trade-off : plus de friction à la création. Mitigé par l'UX (pré-sélection).
```

### TD-4 : Héritage de rôles = 1 niveau max, pas de récursion

```
Choix : Un rôle peut hériter d'UN parent (inherits_from_id). Pas de chaîne.
La résolution est PLATE : role.permissions ∪ parent.permissions. Pas de récursion.

Raison :
  - 1 niveau suffit (Member hérite de Viewer)
  - Pas de risque de cycle
  - O(2) queries max, pas O(n)
  - CHECK constraint : inherits_from_id != id
  - L'UI empêche de choisir un parent qui hérite déjà

Si besoin de chaîne → copier les permissions du grand-parent dans le parent.
```

### TD-5 : bypass_tag_filter au lieu de slug check "admin"

```
Choix : Le bypass du filtrage par tags est contrôlé par un booléen
`bypass_tag_filter` sur la table roles, pas par un slug magic string.

Raison :
  - Aucun magic string dans le code
  - Une company peut nommer son admin "Superadmin", "Administrateur", etc.
  - Plusieurs rôles peuvent avoir le bypass (Admin + CAO par exemple)
  - Explicite et auditable
```

---

## Annexe A — Diagramme de Flux Permission

```
User Request (GET /api/agents)
       │
       ▼
  ┌─────────────────┐
  │ Is Instance      │──YES──▶ Return ALL (super-admin MnM)
  │ Admin?           │
  └────────┬─────────┘
           │ NO
           ▼
  ┌─────────────────┐
  │ Load membership  │──NULL──▶ 403 Forbidden
  │ + role           │
  └────────┬─────────┘
           │ OK
           ▼
  ┌─────────────────┐
  │ role permissions │──NO───▶ 403 Forbidden
  │ .has(action)?    │
  └────────┬─────────┘
           │ YES
           ▼
  ┌──────────────────┐
  │ bypass_tag_filter │──YES──▶ Return ALL agents (no tag filter)
  │ = true?           │
  └────────┬──────────┘
           │ NO
           ▼
  ┌─────────────────┐
  │ TagScope :       │
  │ load user tags   │
  │ from cache       │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ SELECT agents    │
  │ JOIN tag_        │
  │ assignments      │
  │ WHERE tagId      │──▶ Return FILTERED agents
  │ IN (scope.tags)  │
  └──────────────────┘
```

## Annexe B — Crash Test CBA (Rappel)

```
                                    Hybride
                                    ───────
Jean  (Dev Product-A + Lead UIKit)   ✅  role=Member, tags=[Developer, Frontend, Product-A, UIKit, Lead-UIKit]
Marie (PO multi-produit A+B)         ✅  role=Lead,   tags=[PO, Product-A, Product-B]
Sophie (Designer + cross-design)     ✅  role=Member, tags=[Designer, Product-A, Cross-Design]
Lucas (Cross Tech hardware)          ✅  role=Member, tags=[Hardware, Cross-Tech, Product-C]
Léa   (Lead IA cross 5 produits)     ✅  role=Lead,   tags=[IA, Product-A..E]
Pierre (Proxy-PO Product-C)         ✅  role=Member, tags=[Proxy-PO, Product-C]
Camille (UXR cross)                  ✅  role=Member, tags=[UXR, Cross-Design]
Hugo  (Dev Product-B + Lab Inno)     ✅  role=Member, tags=[Developer, Backend, Product-B, Lab-Innovation]

Score: 8/8
```
