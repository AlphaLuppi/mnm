# TECH-07 : Schema DB — Modifications 5 Tables Existantes — Spécification Détaillée

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Story ID** | TECH-07 |
| **Titre** | Schema DB — Modifications 5 Tables Existantes |
| **Epic** | Epic 0 — Infrastructure & Setup |
| **Sprint** | Sprint 0 (prérequis) |
| **Effort** | S (2 SP, 1j) |
| **Assignation** | Tom (backend) |
| **Bloqué par** | TECH-01 (PostgreSQL externe), TECH-06 (10 nouvelles tables — requis pour FK `container_profiles`) |
| **Débloque** | RBAC-S01 (Fix hasPermission), RBAC-S03 (businessRole migration), MU-S04 (Sélecteur company), MU-S05 (Désactivation signup) |
| **ADR** | ADR-001 (companyId sur chaque table), ADR-002 (RBAC 4 rôles) |
| **Type** | Backend-only (pas de composant UI) |

---

## Description

Le schema Drizzle ORM de MnM nécessite la modification de 5 tables existantes pour supporter la transformation B2B enterprise. Les modifications ajoutent des colonnes liées à :

1. **Tiers de facturation** et contrôle SSO/multi-tenant sur `companies`
2. **Rôle métier RBAC** (4 niveaux) sur `company_memberships`
3. **Containerisation des agents** sur `agents`
4. **9 nouvelles permission keys** dans le code TypeScript (pas de changement de schema sur `principal_permission_grants`)
5. **Enrichissement audit** avec IP, User-Agent et sévérité sur `activity_log`

**Règle critique** : Toutes les nouvelles colonnes DOIVENT être backward-compatible — soit nullable, soit avec une valeur par défaut. Aucune donnée existante ne doit être perdue ou modifiée. Les routes existantes doivent continuer à fonctionner sans modification.

---

## État Actuel du Code (Analyse)

### Fichiers impactés

| Fichier | Table | Colonnes actuelles | Colonnes ajoutées |
|---------|-------|--------------------|-------------------|
| `packages/db/src/schema/companies.ts` | `companies` | 12 colonnes (id, name, description, status, issuePrefix, issueCounter, budgetMonthlyCents, spentMonthlyCents, requireBoardApprovalForNewAgents, brandColor, createdAt, updatedAt) | +4 colonnes |
| `packages/db/src/schema/company_memberships.ts` | `company_memberships` | 8 colonnes (id, companyId, principalType, principalId, status, membershipRole, createdAt, updatedAt) | +1 colonne |
| `packages/db/src/schema/agents.ts` | `agents` | 17 colonnes (id, companyId, name, role, title, icon, status, reportsTo, capabilities, adapterType, adapterConfig, runtimeConfig, budgetMonthlyCents, spentMonthlyCents, permissions, lastHeartbeatAt, metadata, scopedToWorkspaceId, createdAt, updatedAt) | +2 colonnes |
| `packages/db/src/schema/principal_permission_grants.ts` | `principal_permission_grants` | 8 colonnes (id, companyId, principalType, principalId, permissionKey, scope, grantedByUserId, createdAt, updatedAt) | 0 (schema inchangé) |
| `packages/db/src/schema/activity_log.ts` | `activity_log` | 10 colonnes (id, companyId, actorType, actorId, action, entityType, entityId, agentId, runId, details, createdAt) | +3 colonnes |
| `packages/shared/src/constants.ts` | (code) | 6 PERMISSION_KEYS | +9 nouvelles keys (15 total) |

### Fichiers de référence (FK target)

| Fichier | Rôle |
|---------|------|
| `packages/db/src/schema/container_profiles.ts` | Table créée dans TECH-06, cible du FK `containerProfileId` sur `agents` |

### Conventions du codebase (à respecter)

1. **PK** : `id: uuid("id").primaryKey().defaultRandom()`
2. **FK companyId** : `companyId: uuid("company_id").notNull().references(() => companies.id)`
3. **Timestamps** : `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()`
4. **Indexes** : callback `(table) => ({})` retournant un objet nommé
5. **Nommage indexes** : `{table_name}_{colonnes}_idx`
6. **Imports** : depuis `drizzle-orm/pg-core`, références relatives `.js`
7. **Pas de pgEnum** : `text()` avec types TypeScript séparés
8. **JSONB** : `jsonb("col").$type<Record<string, unknown>>()`
9. **Boolean** : `boolean("col").notNull().default(false)`

---

## Tâches d'Implémentation

### T1 : Modifier `packages/db/src/schema/companies.ts` — 4 colonnes ajoutées

**Raison** : Supporter les tiers de facturation (free/team/enterprise/on_premise), le flag SSO, la limite d'utilisateurs par company, et le multi-tenant hiérarchique.

#### Colonnes actuelles

```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  issuePrefix: text("issue_prefix").notNull().default("PAP"),
  issueCounter: integer("issue_counter").notNull().default(0),
  budgetMonthlyCents: integer("budget_monthly_cents").notNull().default(0),
  spentMonthlyCents: integer("spent_monthly_cents").notNull().default(0),
  requireBoardApprovalForNewAgents: boolean("require_board_approval_for_new_agents").notNull().default(true),
  brandColor: text("brand_color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}
```

#### Nouvelles colonnes

| Colonne | Type Drizzle | Type SQL | Default | Nullable | Justification |
|---------|-------------|----------|---------|----------|---------------|
| `tier` | `text("tier")` | `text` | `"free"` | Non (a default) | Détermine les limites de la company (users, features, SSO). Valeurs : `"free"` / `"team"` / `"enterprise"` / `"on_premise"` |
| `ssoEnabled` | `boolean("sso_enabled")` | `boolean` | `false` | Non (a default) | Flag pour activer/désactiver l'authentification SSO. Requis par Epic SSO (SSO-S01 à SSO-S03) |
| `maxUsers` | `integer("max_users")` | `integer` | `50` | Non (a default) | Limite du nombre d'utilisateurs par company. free=5, team=50, enterprise=10000. Default 50 pour ne pas bloquer les companies existantes |
| `parentCompanyId` | `uuid("parent_company_id")` | `uuid` | `null` | Oui (nullable) | FK self-referencing vers `companies.id`. `null` = company racine. Permet le multi-tenant hiérarchique |

#### Code Drizzle à ajouter

```typescript
// Ajouter après brandColor, avant createdAt
tier: text("tier").notNull().default("free"),
ssoEnabled: boolean("sso_enabled").notNull().default(false),
maxUsers: integer("max_users").notNull().default(50),
parentCompanyId: uuid("parent_company_id").references((): AnyPgColumn => companies.id),
```

**Note** : `parentCompanyId` utilise `AnyPgColumn` pour le self-reference (même pattern que `agents.reportsTo`). L'import de `AnyPgColumn` doit être ajouté depuis `drizzle-orm/pg-core`.

#### Backward Compatibility

- Les companies existantes recevront `tier='free'`, `ssoEnabled=false`, `maxUsers=50`, `parentCompanyId=null`
- Les routes `companyRoutes` existantes continuent de fonctionner sans modification
- Les nouvelles colonnes sont exposées uniquement via les nouveaux endpoints B2B

#### Indexes

Aucun nouvel index requis. Les requêtes par tier seront rares (admin-only) et ne justifient pas un index dédié à ce stade.

---

### T2 : Modifier `packages/db/src/schema/company_memberships.ts` — 1 colonne ajoutée

**Raison** : Ajouter le rôle métier RBAC à 4 niveaux (hiérarchie B2B) sur chaque membership.

#### Colonnes actuelles

```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  principalType: text("principal_type").notNull(),
  principalId: text("principal_id").notNull(),
  status: text("status").notNull().default("active"),
  membershipRole: text("membership_role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}
```

#### Nouvelle colonne

| Colonne | Type Drizzle | Type SQL | Default | Nullable | Justification |
|---------|-------------|----------|---------|----------|---------------|
| `businessRole` | `text("business_role")` | `text` | `"contributor"` | Non (a default) | Rôle métier RBAC. 4 niveaux : `"admin"` / `"manager"` / `"contributor"` / `"viewer"`. Distinct de `membershipRole` (rôle technique libre). `hasPermission()` utilisera `businessRole` pour les presets, `principal_permission_grants` pour les overrides |

#### Code Drizzle à ajouter

```typescript
// Ajouter après membershipRole, avant createdAt
businessRole: text("business_role").notNull().default("contributor"),
```

#### Coexistence avec `membershipRole`

- `membershipRole` (existant) : rôle technique libre (ex: "member", "owner") — nullable, pas de contrainte
- `businessRole` (nouveau) : rôle RBAC métier avec exactement 4 valeurs — non-nullable, default "contributor"
- Les deux coexistent. `membershipRole` reste pour la rétrocompatibilité, `businessRole` est la source de vérité pour le RBAC B2B

#### Backward Compatibility

- Tous les membres existants deviennent `contributor` par défaut
- Les routes existantes qui lisent `membershipRole` ne sont pas affectées
- Le créateur/owner de chaque company devra être promu `admin` manuellement ou via un script de migration data (hors scope de cette story — traité dans RBAC-S03)

#### Indexes

Aucun nouvel index. Les requêtes filtrées par `businessRole` utiliseront l'index existant `company_memberships_company_status_idx(companyId, status)` combiné avec un filtre en mémoire. Un index dédié pourra être ajouté plus tard si les performances l'exigent.

---

### T3 : Modifier `packages/db/src/schema/agents.ts` — 2 colonnes ajoutées

**Raison** : Associer chaque agent à un profil de containerisation et définir son mode d'isolation.

#### Colonnes actuelles

```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  role: text("role").notNull().default("general"),
  title: text("title"),
  icon: text("icon"),
  status: text("status").notNull().default("idle"),
  reportsTo: uuid("reports_to").references((): AnyPgColumn => agents.id),
  capabilities: text("capabilities"),
  adapterType: text("adapter_type").notNull().default("process"),
  adapterConfig: jsonb("adapter_config").$type<Record<string, unknown>>().notNull().default({}),
  runtimeConfig: jsonb("runtime_config").$type<Record<string, unknown>>().notNull().default({}),
  budgetMonthlyCents: integer("budget_monthly_cents").notNull().default(0),
  spentMonthlyCents: integer("spent_monthly_cents").notNull().default(0),
  permissions: jsonb("permissions").$type<Record<string, unknown>>().notNull().default({}),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  scopedToWorkspaceId: uuid("scoped_to_workspace_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}
```

#### Nouvelles colonnes

| Colonne | Type Drizzle | Type SQL | Default | Nullable | Justification |
|---------|-------------|----------|---------|----------|---------------|
| `containerProfileId` | `uuid("container_profile_id")` | `uuid` | `null` | Oui (nullable) | FK vers `container_profiles.id` (table créée dans TECH-06). Associe l'agent à un profil de ressources (CPU, mémoire, disque). `null` = pas de container, l'agent tourne en mode process |
| `isolationMode` | `text("isolation_mode")` | `text` | `"process"` | Non (a default) | Mode d'isolation de l'agent. Valeurs : `"process"` (comportement actuel), `"container"` (Docker avec profil), `"container_strict"` (Docker + réseau isolé). Le mode `process` correspond au comportement existant pré-B2B |

#### Code Drizzle à ajouter

```typescript
// Imports à ajouter en haut du fichier
import { containerProfiles } from "./container_profiles.js";

// Ajouter après scopedToWorkspaceId, avant createdAt
containerProfileId: uuid("container_profile_id").references(() => containerProfiles.id, { onDelete: "set null" }),
isolationMode: text("isolation_mode").notNull().default("process"),
```

#### Relation FK

- `containerProfileId` → `container_profiles.id` avec `onDelete: "set null"`
- Si un `container_profiles` est supprimé, les agents associés reviennent automatiquement à `containerProfileId=null` (mode process)
- La table `container_profiles` est créée dans TECH-06 et DOIT exister avant cette migration

#### Backward Compatibility

- Tous les agents existants restent en `isolationMode='process'` et `containerProfileId=null`
- Le comportement existant est totalement inchangé
- Les routes `agentRoutes` qui créent/modifient des agents doivent accepter les nouveaux champs comme optionnels (pas de modification dans cette story — sera fait dans CONT-S01)

#### Indexes

Aucun nouvel index. Le `containerProfileId` est nullable et les jointures seront rares (dashboard admin uniquement). L'index existant `agents_company_status_idx(companyId, status)` suffit pour les requêtes courantes.

---

### T4 : Documenter les 9 nouvelles PERMISSION_KEYS dans `packages/shared/src/constants.ts`

**Raison** : La table `principal_permission_grants` n'a PAS besoin de modification de schema. Elle stocke déjà les clés de permission comme des valeurs `text` libres dans la colonne `permissionKey`. La modification est uniquement dans le code TypeScript pour typer les nouvelles clés.

#### Schema actuel (INCHANGÉ)

```typescript
export const principalPermissionGrants = pgTable(
  "principal_permission_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    principalType: text("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    permissionKey: text("permission_key").notNull(),
    scope: jsonb("scope").$type<Record<string, unknown> | null>(),
    grantedByUserId: text("granted_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // ... indexes inchangés
);
```

#### 6 clés existantes

```typescript
export const PERMISSION_KEYS = [
  "agents:create",
  "users:invite",
  "users:manage_permissions",
  "tasks:assign",
  "tasks:assign_scope",
  "joins:approve",
] as const;
```

#### 9 nouvelles clés à ajouter (15 total)

| Clé | Domaine | Justification |
|-----|---------|---------------|
| `"projects:create"` | PROJ | Créer des projets dans la company |
| `"projects:manage_members"` | PROJ | Gérer les membres d'un projet (ajouter/retirer) |
| `"workflows:create"` | ORCH | Créer des templates de workflow |
| `"workflows:enforce"` | ORCH | Activer l'enforcement d'un workflow sur un projet |
| `"agents:manage_containers"` | CONT | Gérer les profils de containerisation et l'isolation des agents |
| `"company:manage_settings"` | MU | Modifier les paramètres de la company (tier, maxUsers, etc.) |
| `"company:manage_sso"` | SSO | Configurer l'authentification SSO (SAML/OIDC) |
| `"audit:read"` | OBS | Consulter l'audit log |
| `"audit:export"` | OBS | Exporter l'audit log en CSV/JSON |

#### Code TypeScript à modifier

```typescript
// packages/shared/src/constants.ts
export const PERMISSION_KEYS = [
  // 6 existantes
  "agents:create",
  "users:invite",
  "users:manage_permissions",
  "tasks:assign",
  "tasks:assign_scope",
  "joins:approve",
  // 9 nouvelles (B2B transformation)
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

#### Impact

- Le type `PermissionKey` (dérivé via `typeof PERMISSION_KEYS[number]`) inclura automatiquement les nouvelles clés
- Le validateur Zod `z.enum(PERMISSION_KEYS)` dans `packages/shared/src/validators/access.ts` acceptera les nouvelles clés sans modification
- Aucune migration DB nécessaire
- Les grants existants avec les 6 anciennes clés restent valides

---

### T5 : Modifier `packages/db/src/schema/activity_log.ts` — 3 colonnes ajoutées

**Raison** : Enrichir l'audit trail avec l'IP source, le User-Agent du navigateur, et un niveau de sévérité pour le filtrage et l'alerting.

#### Colonnes actuelles

```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  actorType: text("actor_type").notNull().default("system"),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  runId: uuid("run_id").references(() => heartbeatRuns.id),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}
```

#### Nouvelles colonnes

| Colonne | Type Drizzle | Type SQL | Default | Nullable | Justification |
|---------|-------------|----------|---------|----------|---------------|
| `ipAddress` | `text("ip_address")` | `text` | `null` | Oui (nullable) | Adresse IP de la requête HTTP. Capturé via `req.ip`. `null` pour les actions système/agent sans contexte HTTP. Requis pour l'audit de sécurité (Epic OBS) |
| `userAgent` | `text("user_agent")` | `text` | `null` | Oui (nullable) | User-Agent du navigateur. Capturé via `req.headers['user-agent']`. `null` pour les actions système/agent. Permet l'identification des dispositifs dans l'audit |
| `severity` | `text("severity")` | `text` | `"info"` | Non (a default) | Niveau de sévérité de l'événement. Valeurs : `"info"` (action normale), `"warn"` (accès refusé, drift détecté), `"critical"` (sécurité, violation RLS). Permet le filtrage et l'alerting dans le dashboard OBS |

#### Code Drizzle à ajouter

```typescript
// Ajouter après details, avant createdAt
ipAddress: text("ip_address"),
userAgent: text("user_agent"),
severity: text("severity").notNull().default("info"),
```

#### Nouvel index

```typescript
// Ajouter dans le callback (table) => ({})
companySeverityIdx: index("activity_log_company_severity_idx").on(table.companyId, table.severity),
```

**Justification** : Le dashboard OBS filtrera fréquemment par sévérité au sein d'une company (ex: "montrer tous les events critiques"). L'index composite `(companyId, severity)` optimise cette requête.

#### Backward Compatibility

- Les entrées existantes de l'activity log reçoivent `severity='info'`, `ipAddress=null`, `userAgent=null`
- Le service `logActivity()` existant sera enrichi dans une story ultérieure (OBS-S02) pour capturer `req.ip` et `req.headers['user-agent']`
- Aucune modification des routes existantes requise dans cette story

---

### T6 : Générer la migration Drizzle

Après toutes les modifications de schema (T1, T2, T3, T5) et les modifications TypeScript (T4), générer la migration Drizzle.

#### Procédure

```bash
cd packages/db
pnpm build         # Compile les schemas modifiés en JS
pnpm generate      # Génère la migration SQL
```

La migration générée devrait contenir :

```sql
-- companies : 4 nouvelles colonnes
ALTER TABLE "companies" ADD COLUMN "tier" text DEFAULT 'free' NOT NULL;
ALTER TABLE "companies" ADD COLUMN "sso_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "companies" ADD COLUMN "max_users" integer DEFAULT 50 NOT NULL;
ALTER TABLE "companies" ADD COLUMN "parent_company_id" uuid;

-- company_memberships : 1 nouvelle colonne
ALTER TABLE "company_memberships" ADD COLUMN "business_role" text DEFAULT 'contributor' NOT NULL;

-- agents : 2 nouvelles colonnes
ALTER TABLE "agents" ADD COLUMN "container_profile_id" uuid;
ALTER TABLE "agents" ADD COLUMN "isolation_mode" text DEFAULT 'process' NOT NULL;

-- activity_log : 3 nouvelles colonnes + 1 index
ALTER TABLE "activity_log" ADD COLUMN "ip_address" text;
ALTER TABLE "activity_log" ADD COLUMN "user_agent" text;
ALTER TABLE "activity_log" ADD COLUMN "severity" text DEFAULT 'info' NOT NULL;
CREATE INDEX "activity_log_company_severity_idx" ON "activity_log" ("company_id", "severity");

-- Foreign keys
ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_company_id_companies_id_fk" FOREIGN KEY ("parent_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "agents" ADD CONSTRAINT "agents_container_profile_id_container_profiles_id_fk" FOREIGN KEY ("container_profile_id") REFERENCES "public"."container_profiles"("id") ON DELETE set null ON UPDATE no action;
```

#### Validation

```bash
pnpm db:migrate    # Appliquer la migration sur PostgreSQL
```

- Vérifier que la migration s'applique sans erreur
- Vérifier que les données existantes sont préservées
- Vérifier que les valeurs par défaut sont correctement appliquées

---

### T7 : Vérification TypeScript

```bash
pnpm typecheck     # Doit passer sans erreur
```

- Les types Drizzle inferred doivent inclure les nouvelles colonnes
- Le type `PermissionKey` doit inclure les 15 clés
- Aucune erreur de compilation dans `server/src/` ni `ui/src/`

---

## Acceptance Criteria

### AC-1 : Colonnes ajoutées et backward-compatible

```gherkin
Given les migrations TECH-07
When elles s'exécutent sur une base PostgreSQL 17 avec des données existantes
Then les colonnes sont ajoutées sur les 4 tables (companies, company_memberships, agents, activity_log)
And toutes les nouvelles colonnes ont des valeurs par défaut ou sont nullable
And aucune erreur n'est levée
```

**Vérification** : `pnpm db:migrate` réussit sans erreur.

### AC-2 : Aucune donnée perdue

```gherkin
Given des companies, memberships, agents et activity_log existants
When la migration TECH-07 s'applique
Then les companies existantes ont tier='free', ssoEnabled=false, maxUsers=50, parentCompanyId=null
And les memberships existants ont businessRole='contributor'
And les agents existants ont containerProfileId=null, isolationMode='process'
And les activity_log existants ont ipAddress=null, userAgent=null, severity='info'
And toutes les autres colonnes conservent leurs valeurs originales
```

**Vérification** : Query SQL de validation post-migration.

### AC-3 : 15 PERMISSION_KEYS typées

```gherkin
Given les constantes dans packages/shared/src/constants.ts
When le type PermissionKey est dérivé
Then il inclut les 15 clés (6 existantes + 9 nouvelles)
And le validateur Zod z.enum(PERMISSION_KEYS) accepte toutes les 15 clés
```

**Vérification** : `pnpm typecheck` passe.

### AC-4 : Index de sévérité créé

```gherkin
Given la migration TECH-07
When elle s'applique
Then l'index activity_log_company_severity_idx(company_id, severity) est créé
And les requêtes filtrées par (company_id, severity) utilisent l'index
```

**Vérification** : `EXPLAIN` sur une requête filtrée.

### AC-5 : FK container_profiles fonctionne

```gherkin
Given un agent avec containerProfileId pointant vers un container_profiles
When le container_profiles est supprimé
Then l'agent.containerProfileId est mis à null (ON DELETE SET NULL)
And l'agent existe toujours avec isolationMode inchangé
```

**Vérification** : Test d'intégration DB.

### AC-6 : FK parentCompanyId fonctionne

```gherkin
Given une company avec parentCompanyId pointant vers une autre company
When on requête la company enfant
Then le parentCompanyId retourne l'UUID de la company parent
And une company racine a parentCompanyId=null
```

**Vérification** : Test d'intégration DB.

---

## data-test-id (pour tests E2E et intégration)

Cette story étant backend-only (schema + migration), les `data-testid` s'appliquent aux vérifications via requêtes SQL/API dans les tests E2E.

| Test ID | Element | Description |
|---------|---------|-------------|
| `tech-07-companies-tier` | Colonne `companies.tier` | Vérifie que la colonne existe et a le default 'free' |
| `tech-07-companies-sso-enabled` | Colonne `companies.sso_enabled` | Vérifie que la colonne existe et a le default false |
| `tech-07-companies-max-users` | Colonne `companies.max_users` | Vérifie que la colonne existe et a le default 50 |
| `tech-07-companies-parent-company-id` | Colonne `companies.parent_company_id` | Vérifie que la colonne existe et est nullable |
| `tech-07-memberships-business-role` | Colonne `company_memberships.business_role` | Vérifie que la colonne existe et a le default 'contributor' |
| `tech-07-agents-container-profile-id` | Colonne `agents.container_profile_id` | Vérifie que la colonne existe et est nullable FK vers container_profiles |
| `tech-07-agents-isolation-mode` | Colonne `agents.isolation_mode` | Vérifie que la colonne existe et a le default 'process' |
| `tech-07-activity-log-ip-address` | Colonne `activity_log.ip_address` | Vérifie que la colonne existe et est nullable |
| `tech-07-activity-log-user-agent` | Colonne `activity_log.user_agent` | Vérifie que la colonne existe et est nullable |
| `tech-07-activity-log-severity` | Colonne `activity_log.severity` | Vérifie que la colonne existe et a le default 'info' |
| `tech-07-activity-log-severity-idx` | Index `activity_log_company_severity_idx` | Vérifie que l'index composite (company_id, severity) existe |
| `tech-07-permission-keys-count` | Constante `PERMISSION_KEYS` | Vérifie que le tableau contient exactement 15 clés |
| `tech-07-permission-keys-new` | 9 nouvelles clés | Vérifie que chaque nouvelle clé est présente dans PERMISSION_KEYS |
| `tech-07-fk-container-profiles-cascade` | FK `agents.container_profile_id` | Vérifie le ON DELETE SET NULL |
| `tech-07-fk-parent-company-self-ref` | FK `companies.parent_company_id` | Vérifie le self-reference FK |
| `tech-07-backward-compat-companies` | Données existantes | Vérifie que les companies existantes ont les defaults corrects post-migration |
| `tech-07-backward-compat-memberships` | Données existantes | Vérifie que les memberships existants ont businessRole='contributor' |
| `tech-07-backward-compat-agents` | Données existantes | Vérifie que les agents existants ont isolationMode='process' et containerProfileId=null |
| `tech-07-backward-compat-activity-log` | Données existantes | Vérifie que les activity_log existants ont severity='info' |

---

## Risques et Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Migration échoue si TECH-06 pas appliquée (FK container_profiles) | Faible | Élevé | Vérifier que TECH-06 est DONE avant d'exécuter. L'ordre des batches l'impose. |
| `maxUsers` default trop bas bloque des companies existantes | Moyen | Moyen | Default à 50 (pas 5 comme dans l'architecture) pour éviter de bloquer. Ajustable via migration data ultérieure. |
| Conflit de nommage entre `membershipRole` et `businessRole` | Faible | Faible | Documentation claire dans le code + commentaire TypeScript |
| `isolationMode` default "process" vs architecture "none" | Faible | Faible | Alignement avec la terminologie existante dans `adapterType`. "process" est plus descriptif que "none". |

---

## Notes pour les Agents

### Agent Dev
- Modifier les 4 fichiers de schema Drizzle (companies, company_memberships, agents, activity_log)
- Modifier `packages/shared/src/constants.ts` pour les 9 nouvelles PERMISSION_KEYS
- Générer la migration Drizzle via `pnpm build && pnpm generate` dans `packages/db`
- NE PAS modifier `principal_permission_grants.ts` (schema inchangé)
- NE PAS modifier les routes existantes
- Vérifier avec `pnpm typecheck` que tout compile

### Agent QA
- Tests E2E basés sur les data-test-id ci-dessus
- Vérifier chaque colonne via requête SQL `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = '...'`
- Vérifier les indexes via `SELECT indexname FROM pg_indexes WHERE tablename = '...'`
- Vérifier les FK via `SELECT constraint_name, delete_rule FROM information_schema.referential_constraints`
- Vérifier les 15 PERMISSION_KEYS via import et assertion sur le tableau
- Tester le backward compatibility en insérant des données AVANT la migration et vérifiant APRÈS

### Agent Review
- Vérifier que TOUTES les nouvelles colonnes sont backward-compatible (nullable ou default)
- Vérifier que le self-reference FK sur companies utilise `AnyPgColumn`
- Vérifier que le FK agents → container_profiles a `onDelete: "set null"`
- Vérifier que `pnpm typecheck` passe sans erreur
- Vérifier que `pnpm test:run` passe (tests unitaires existants non cassés)
- PAS de Chrome MCP (story backend-only)
