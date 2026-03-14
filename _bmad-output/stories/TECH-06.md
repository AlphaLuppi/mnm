# TECH-06 : Schema DB — 10 Nouvelles Tables — Spécification Détaillée

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Story ID** | TECH-06 |
| **Titre** | Schema DB — 10 Nouvelles Tables |
| **Epic** | Epic 0 — Infrastructure & Setup |
| **Sprint** | Sprint 0 (prérequis) |
| **Effort** | M (5 SP, 2-3j) |
| **Assignation** | Tom (backend) |
| **Bloqué par** | TECH-01 (PostgreSQL externe) |
| **Débloque** | Tout le niveau CORE — TECH-05 (RLS), PROJ-S01, OBS-S01, CHAT-S02, CONT-S05, SSO-S01, DUAL-S01 |
| **ADR** | ADR-001 (companyId sur chaque table B2B) |
| **Type** | Backend-only (pas de composant UI) |

---

## Description

Le schema Drizzle ORM de MnM compte actuellement 38 tables exportées depuis `packages/db/src/schema/index.ts`. La transformation B2B nécessite 10 nouvelles tables pour supporter les fonctionnalités multi-user, orchestration, chat, containerisation, audit, SSO et import.

**L'objectif de cette story** est de créer les 10 fichiers de schema Drizzle, exporter les tables depuis `index.ts`, générer la migration Drizzle correspondante, et valider que la migration s'applique proprement sur PostgreSQL 17.

Les 10 tables suivent les conventions existantes du codebase :
- UUID primary key avec `defaultRandom()`
- `companyId` foreign key vers `companies.id` (ADR-001)
- `createdAt` / `updatedAt` avec `timestamp("...", { withTimezone: true }).notNull().defaultNow()`
- Indexes composites avec `companyId` en première colonne (pour RLS et requêtes multi-tenant)
- Naming : snake_case pour les noms de table et colonnes SQL, camelCase pour les identifiants TypeScript

---

## État Actuel du Code (Analyse)

### Fichiers clés

| Fichier | Rôle | Observation |
|---------|------|-------------|
| `packages/db/src/schema/index.ts` | Exports centralisés des 38 tables | 38 lignes d'export, chaque table dans son propre fichier |
| `packages/db/src/schema/companies.ts` | Table racine `companies` | Référencée par toutes les tables via `companyId` FK |
| `packages/db/src/schema/projects.ts` | Table `projects` | FK cible pour `project_memberships` |
| `packages/db/src/schema/agents.ts` | Table `agents` | FK cible pour `container_instances`, `chat_channels` |
| `packages/db/src/schema/heartbeat_runs.ts` | Table `heartbeat_runs` | FK cible pour `chat_channels` |
| `packages/db/src/schema/auth.ts` | Tables auth (user, session, account, verification) | `authUsers.id` est `text`, pas `uuid` |
| `packages/db/drizzle.config.ts` | Config Drizzle Kit | `schema: "./dist/schema/*.js"`, `out: "./src/migrations"` |
| `packages/db/package.json` | Scripts : `generate`, `migrate`, `build` | `generate` compile d'abord en JS puis lance `drizzle-kit generate` |

### Conventions détectées

1. **PK** : `id: uuid("id").primaryKey().defaultRandom()` (sauf tables auth qui utilisent `text`)
2. **FK companyId** : `companyId: uuid("company_id").notNull().references(() => companies.id)`
3. **Timestamps** : `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()`
4. **Indexes** : fonction callback `(table) => ({})` retournant un objet nommé
5. **Nommage indexes** : `{table_name}_{colonnes}_idx` (ex: `agents_company_status_idx`)
6. **Imports** : depuis `drizzle-orm/pg-core`, référence aux autres tables via imports relatifs `.js`
7. **Exports** : `export const tableName = pgTable(...)` avec un seul export par fichier
8. **JSONB** : `jsonb("col").$type<Record<string, unknown>>()` pour le typage TypeScript
9. **Pas de pgEnum** : les valeurs d'enum sont des `text()` avec des types TypeScript séparés

---

## Tâches d'Implémentation

### T1 : Créer `packages/db/src/schema/project_memberships.ts`

Lie les utilisateurs aux projets au sein d'une company. Permet le scoping des permissions par projet.

```typescript
import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const projectMemberships = pgTable(
  "project_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("contributor"),
    grantedBy: text("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectUserUniqueIdx: uniqueIndex("project_memberships_company_project_user_unique_idx").on(
      table.companyId,
      table.projectId,
      table.userId,
    ),
    companyUserIdx: index("project_memberships_company_user_idx").on(table.companyId, table.userId),
    companyProjectIdx: index("project_memberships_company_project_idx").on(table.companyId, table.projectId),
  }),
);
```

**Colonnes** :

| Colonne | Type Drizzle | SQL | Nullable | Default | Description |
|---------|-------------|-----|----------|---------|-------------|
| `id` | `uuid` | `UUID` | NOT NULL | `defaultRandom()` | PK |
| `companyId` | `uuid` | `UUID` | NOT NULL | — | FK → `companies.id` (ADR-001) |
| `userId` | `text` | `TEXT` | NOT NULL | — | FK logique → `user.id` (auth table, text PK) |
| `projectId` | `uuid` | `UUID` | NOT NULL | — | FK → `projects.id` (CASCADE delete) |
| `role` | `text` | `TEXT` | NOT NULL | `"contributor"` | Rôle dans le projet : `lead` / `contributor` / `viewer` |
| `grantedBy` | `text` | `TEXT` | NULL | — | userId de celui qui a accordé l'accès |
| `createdAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de création |
| `updatedAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de dernière modification |

**Indexes** :
- `project_memberships_company_project_user_unique_idx` : UNIQUE(companyId, projectId, userId) — un user ne peut être membre qu'une fois par projet
- `project_memberships_company_user_idx` : (companyId, userId) — trouver tous les projets d'un user
- `project_memberships_company_project_idx` : (companyId, projectId) — lister les membres d'un projet

**Note** : `userId` est `text` et non `uuid` car la table `user` (Better Auth) utilise `text("id")` comme PK. On ne met pas de FK Drizzle pour éviter les dépendances circulaires avec le module auth.

---

### T2 : Créer `packages/db/src/schema/automation_cursors.ts`

Curseur d'automatisation 3 positions (manual / assisted / auto) par niveau (action / agent / project / company).

```typescript
import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const automationCursors = pgTable(
  "automation_cursors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    level: text("level").notNull(),
    targetId: uuid("target_id"),
    position: text("position").notNull().default("assisted"),
    ceiling: text("ceiling").notNull().default("auto"),
    setByUserId: text("set_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyLevelTargetUniqueIdx: uniqueIndex("automation_cursors_company_level_target_unique_idx").on(
      table.companyId,
      table.level,
      table.targetId,
    ),
    companyLevelIdx: index("automation_cursors_company_level_idx").on(table.companyId, table.level),
  }),
);
```

**Colonnes** :

| Colonne | Type Drizzle | SQL | Nullable | Default | Description |
|---------|-------------|-----|----------|---------|-------------|
| `id` | `uuid` | `UUID` | NOT NULL | `defaultRandom()` | PK |
| `companyId` | `uuid` | `UUID` | NOT NULL | — | FK → `companies.id` (ADR-001) |
| `level` | `text` | `TEXT` | NOT NULL | — | Niveau du curseur : `company` / `project` / `agent` / `action` |
| `targetId` | `uuid` | `UUID` | NULL | — | ID de la cible (projectId, agentId, etc.). NULL si level=company |
| `position` | `text` | `TEXT` | NOT NULL | `"assisted"` | Position : `manual` / `assisted` / `auto` |
| `ceiling` | `text` | `TEXT` | NOT NULL | `"auto"` | Position max autorisée par le niveau supérieur |
| `setByUserId` | `text` | `TEXT` | NULL | — | Qui a défini ce curseur |
| `createdAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de création |
| `updatedAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de dernière modification |

**Indexes** :
- `automation_cursors_company_level_target_unique_idx` : UNIQUE(companyId, level, targetId) — un seul curseur par (company, level, target)
- `automation_cursors_company_level_idx` : (companyId, level) — lister les curseurs par niveau

**Logique métier** : La `position` effective ne peut jamais dépasser le `ceiling` hérité du niveau parent. Le niveau company définit le ceiling global, le projet hérite et peut restreindre, etc.

---

### T3 : Créer `packages/db/src/schema/chat_channels.ts`

Canaux de chat WebSocket, un par agent run (session heartbeat). Permet la communication bidirectionnelle user-agent.

```typescript
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const chatChannels = pgTable(
  "chat_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id),
    name: text("name"),
    status: text("status").notNull().default("open"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentIdx: index("chat_channels_company_agent_idx").on(table.companyId, table.agentId),
    companyStatusIdx: index("chat_channels_company_status_idx").on(table.companyId, table.status),
    heartbeatRunIdx: index("chat_channels_heartbeat_run_idx").on(table.heartbeatRunId),
  }),
);
```

**Colonnes** :

| Colonne | Type Drizzle | SQL | Nullable | Default | Description |
|---------|-------------|-----|----------|---------|-------------|
| `id` | `uuid` | `UUID` | NOT NULL | `defaultRandom()` | PK |
| `companyId` | `uuid` | `UUID` | NOT NULL | — | FK → `companies.id` (ADR-001) |
| `agentId` | `uuid` | `UUID` | NOT NULL | — | FK → `agents.id` |
| `heartbeatRunId` | `uuid` | `UUID` | NULL | — | FK → `heartbeat_runs.id` (le run associé, peut être NULL si le channel est persistant) |
| `name` | `text` | `TEXT` | NULL | — | Nom optionnel du channel |
| `status` | `text` | `TEXT` | NOT NULL | `"open"` | Statut : `open` / `closed` / `archived` |
| `closedAt` | `timestamp` | `TIMESTAMPTZ` | NULL | — | Date de fermeture |
| `createdAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de création |
| `updatedAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de dernière modification |

**Indexes** :
- `chat_channels_company_agent_idx` : (companyId, agentId) — trouver les channels d'un agent
- `chat_channels_company_status_idx` : (companyId, status) — lister les channels ouverts
- `chat_channels_heartbeat_run_idx` : (heartbeatRunId) — trouver le channel d'un run

---

### T4 : Créer `packages/db/src/schema/chat_messages.ts`

Messages dans les canaux de chat. Supporte les messages user et agent.

```typescript
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { chatChannels } from "./chat_channels.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    senderId: text("sender_id").notNull(),
    senderType: text("sender_type").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelCreatedIdx: index("chat_messages_channel_created_idx").on(table.channelId, table.createdAt),
    companyCreatedIdx: index("chat_messages_company_created_idx").on(table.companyId, table.createdAt),
    senderIdx: index("chat_messages_sender_idx").on(table.senderId, table.senderType),
  }),
);
```

**Colonnes** :

| Colonne | Type Drizzle | SQL | Nullable | Default | Description |
|---------|-------------|-----|----------|---------|-------------|
| `id` | `uuid` | `UUID` | NOT NULL | `defaultRandom()` | PK |
| `channelId` | `uuid` | `UUID` | NOT NULL | — | FK → `chat_channels.id` (CASCADE delete) |
| `companyId` | `uuid` | `UUID` | NOT NULL | — | Dénormalisé pour RLS (ADR-001). Pas de FK Drizzle pour éviter la boucle de dépendances ; intégrité garantie par le channelId |
| `senderId` | `text` | `TEXT` | NOT NULL | — | ID de l'expéditeur (userId ou agentId stringifié) |
| `senderType` | `text` | `TEXT` | NOT NULL | — | Type : `user` / `agent` / `system` |
| `content` | `text` | `TEXT` | NOT NULL | — | Contenu du message |
| `metadata` | `jsonb` | `JSONB` | NULL | — | Métadonnées optionnelles (attachments, formatting, etc.) |
| `createdAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de création (append-only, pas d'updatedAt) |

**Indexes** :
- `chat_messages_channel_created_idx` : (channelId, createdAt) — pagination des messages d'un channel
- `chat_messages_company_created_idx` : (companyId, createdAt) — RLS + recherche globale
- `chat_messages_sender_idx` : (senderId, senderType) — trouver les messages d'un sender

**Note** : Pas de `updatedAt` car les messages de chat sont append-only (pas de modification après envoi).

---

### T5 : Créer `packages/db/src/schema/container_profiles.ts`

Profils de ressources Docker pour les agents containerisés. 4 profils prédéfinis : light, standard, heavy, gpu.

```typescript
import { pgTable, uuid, text, timestamp, integer, jsonb, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const containerProfiles = pgTable(
  "container_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    cpuMillicores: integer("cpu_millicores").notNull().default(1000),
    memoryMb: integer("memory_mb").notNull().default(512),
    diskMb: integer("disk_mb").notNull().default(1024),
    timeoutSeconds: integer("timeout_seconds").notNull().default(3600),
    gpuEnabled: boolean("gpu_enabled").notNull().default(false),
    mountAllowlist: jsonb("mount_allowlist").$type<string[]>().default([]),
    networkPolicy: text("network_policy").notNull().default("isolated"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameUniqueIdx: uniqueIndex("container_profiles_company_name_unique_idx").on(
      table.companyId,
      table.name,
    ),
    companyIdx: index("container_profiles_company_idx").on(table.companyId),
  }),
);
```

**Colonnes** :

| Colonne | Type Drizzle | SQL | Nullable | Default | Description |
|---------|-------------|-----|----------|---------|-------------|
| `id` | `uuid` | `UUID` | NOT NULL | `defaultRandom()` | PK |
| `companyId` | `uuid` | `UUID` | NOT NULL | — | FK → `companies.id` (ADR-001) |
| `name` | `text` | `TEXT` | NOT NULL | — | Nom du profil : `light` / `standard` / `heavy` / `gpu` / custom |
| `description` | `text` | `TEXT` | NULL | — | Description du profil |
| `cpuMillicores` | `integer` | `INTEGER` | NOT NULL | `1000` | CPU en millicores (1000 = 1 CPU) |
| `memoryMb` | `integer` | `INTEGER` | NOT NULL | `512` | Mémoire RAM en Mo |
| `diskMb` | `integer` | `INTEGER` | NOT NULL | `1024` | Disque en Mo |
| `timeoutSeconds` | `integer` | `INTEGER` | NOT NULL | `3600` | Timeout max en secondes (1h par défaut) |
| `gpuEnabled` | `boolean` | `BOOLEAN` | NOT NULL | `false` | GPU activé |
| `mountAllowlist` | `jsonb` | `JSONB` | NULL | `[]` | Liste des paths autorisés en mount |
| `networkPolicy` | `text` | `TEXT` | NOT NULL | `"isolated"` | Politique réseau : `isolated` / `bridge` / `host` |
| `isDefault` | `boolean` | `BOOLEAN` | NOT NULL | `false` | Profil par défaut pour la company |
| `createdAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de création |
| `updatedAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de dernière modification |

**Indexes** :
- `container_profiles_company_name_unique_idx` : UNIQUE(companyId, name) — un seul profil par nom par company
- `container_profiles_company_idx` : (companyId) — lister les profils d'une company

**Profils prédéfinis (ADR-004)** :
| Profil | CPU | RAM | Disk | Timeout | GPU |
|--------|-----|-----|------|---------|-----|
| light | 500 (0.5) | 256 MB | 512 MB | 1800s | non |
| standard | 1000 (1) | 512 MB | 1024 MB | 3600s | non |
| heavy | 2000 (2) | 1024 MB | 2048 MB | 7200s | non |
| gpu | 4000 (4) | 4096 MB | 8192 MB | 7200s | oui |

---

### T6 : Créer `packages/db/src/schema/container_instances.ts`

Instances de containers Docker en cours d'exécution ou terminées.

```typescript
import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { containerProfiles } from "./container_profiles.js";

export const containerInstances = pgTable(
  "container_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    profileId: uuid("profile_id").notNull().references(() => containerProfiles.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    dockerContainerId: text("docker_container_id"),
    status: text("status").notNull().default("pending"),
    exitCode: integer("exit_code"),
    error: text("error"),
    resourceUsage: jsonb("resource_usage").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("container_instances_company_status_idx").on(table.companyId, table.status),
    companyAgentIdx: index("container_instances_company_agent_idx").on(table.companyId, table.agentId),
    dockerContainerIdx: index("container_instances_docker_container_idx").on(table.dockerContainerId),
    profileIdx: index("container_instances_profile_idx").on(table.profileId),
  }),
);
```

**Colonnes** :

| Colonne | Type Drizzle | SQL | Nullable | Default | Description |
|---------|-------------|-----|----------|---------|-------------|
| `id` | `uuid` | `UUID` | NOT NULL | `defaultRandom()` | PK |
| `companyId` | `uuid` | `UUID` | NOT NULL | — | FK → `companies.id` (ADR-001) |
| `profileId` | `uuid` | `UUID` | NOT NULL | — | FK → `container_profiles.id` |
| `agentId` | `uuid` | `UUID` | NOT NULL | — | FK → `agents.id` |
| `dockerContainerId` | `text` | `TEXT` | NULL | — | ID du container Docker (rempli au lancement) |
| `status` | `text` | `TEXT` | NOT NULL | `"pending"` | Statut : `pending` / `starting` / `running` / `stopping` / `stopped` / `failed` |
| `exitCode` | `integer` | `INTEGER` | NULL | — | Code de sortie du container |
| `error` | `text` | `TEXT` | NULL | — | Message d'erreur si échec |
| `resourceUsage` | `jsonb` | `JSONB` | NULL | — | Usage CPU/RAM/disk observé (snapshot) |
| `startedAt` | `timestamp` | `TIMESTAMPTZ` | NULL | — | Date de démarrage effectif |
| `stoppedAt` | `timestamp` | `TIMESTAMPTZ` | NULL | — | Date d'arrêt |
| `createdAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de création |
| `updatedAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de dernière modification |

**Indexes** :
- `container_instances_company_status_idx` : (companyId, status) — lister les containers actifs par company
- `container_instances_company_agent_idx` : (companyId, agentId) — historique des containers d'un agent
- `container_instances_docker_container_idx` : (dockerContainerId) — lookup par ID Docker
- `container_instances_profile_idx` : (profileId) — containers utilisant un profil

---

### T7 : Créer `packages/db/src/schema/credential_proxy_rules.ts`

Règles d'accès au credential proxy. Détermine quels rôles d'agents peuvent accéder à quels secrets.

```typescript
import { pgTable, uuid, text, timestamp, jsonb, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const credentialProxyRules = pgTable(
  "credential_proxy_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    secretPattern: text("secret_pattern").notNull(),
    allowedAgentRoles: jsonb("allowed_agent_roles").$type<string[]>().notNull().default([]),
    proxyEndpoint: text("proxy_endpoint").notNull().default("http://credential-proxy:8090"),
    enabled: boolean("enabled").notNull().default(true),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameUniqueIdx: uniqueIndex("credential_proxy_rules_company_name_unique_idx").on(
      table.companyId,
      table.name,
    ),
    companyEnabledIdx: index("credential_proxy_rules_company_enabled_idx").on(table.companyId, table.enabled),
    companyPatternIdx: index("credential_proxy_rules_company_pattern_idx").on(table.companyId, table.secretPattern),
  }),
);
```

**Colonnes** :

| Colonne | Type Drizzle | SQL | Nullable | Default | Description |
|---------|-------------|-----|----------|---------|-------------|
| `id` | `uuid` | `UUID` | NOT NULL | `defaultRandom()` | PK |
| `companyId` | `uuid` | `UUID` | NOT NULL | — | FK → `companies.id` (ADR-001) |
| `name` | `text` | `TEXT` | NOT NULL | — | Nom de la règle |
| `secretPattern` | `text` | `TEXT` | NOT NULL | — | Pattern glob pour les noms de secrets (ex: `OPENAI_*`, `AWS_*`) |
| `allowedAgentRoles` | `jsonb` | `JSONB` | NOT NULL | `[]` | Liste des rôles d'agent autorisés (ex: `["general", "cto"]`) |
| `proxyEndpoint` | `text` | `TEXT` | NOT NULL | `"http://credential-proxy:8090"` | Endpoint du proxy |
| `enabled` | `boolean` | `BOOLEAN` | NOT NULL | `true` | Règle active ou non |
| `createdByUserId` | `text` | `TEXT` | NULL | — | Qui a créé la règle |
| `createdAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de création |
| `updatedAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de dernière modification |

**Indexes** :
- `credential_proxy_rules_company_name_unique_idx` : UNIQUE(companyId, name) — noms de règle uniques par company
- `credential_proxy_rules_company_enabled_idx` : (companyId, enabled) — filtrer les règles actives
- `credential_proxy_rules_company_pattern_idx` : (companyId, secretPattern) — lookup par pattern

---

### T8 : Créer `packages/db/src/schema/audit_events.ts`

Table d'audit immutable (append-only). Sera partitionnée par mois en production (TECH-05 ajoutera le TRIGGER deny UPDATE/DELETE et la politique RLS).

```typescript
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    severity: text("severity").notNull().default("info"),
    prevHash: text("prev_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("audit_events_company_created_idx").on(table.companyId, table.createdAt),
    companyActorIdx: index("audit_events_company_actor_idx").on(table.companyId, table.actorId, table.actorType),
    companyActionIdx: index("audit_events_company_action_idx").on(table.companyId, table.action),
    companyTargetIdx: index("audit_events_company_target_idx").on(table.companyId, table.targetType, table.targetId),
    companySeverityIdx: index("audit_events_company_severity_idx").on(table.companyId, table.severity, table.createdAt),
  }),
);
```

**Colonnes** :

| Colonne | Type Drizzle | SQL | Nullable | Default | Description |
|---------|-------------|-----|----------|---------|-------------|
| `id` | `uuid` | `UUID` | NOT NULL | `defaultRandom()` | PK |
| `companyId` | `uuid` | `UUID` | NOT NULL | — | FK → `companies.id` (ADR-001) |
| `actorId` | `text` | `TEXT` | NOT NULL | — | ID de l'acteur (userId, agentId, "system") |
| `actorType` | `text` | `TEXT` | NOT NULL | — | Type : `user` / `agent` / `system` / `a2a` |
| `action` | `text` | `TEXT` | NOT NULL | — | Action effectuée (ex: `agent.launch`, `member.invite`, `permission.grant`) |
| `targetType` | `text` | `TEXT` | NOT NULL | — | Type de la cible : `agent` / `project` / `member` / `workflow` / etc. |
| `targetId` | `text` | `TEXT` | NOT NULL | — | ID de la cible |
| `metadata` | `jsonb` | `JSONB` | NULL | — | Détails supplémentaires (avant/après, paramètres, etc.) |
| `ipAddress` | `text` | `TEXT` | NULL | — | Adresse IP du client |
| `userAgent` | `text` | `TEXT` | NULL | — | User-Agent du client |
| `severity` | `text` | `TEXT` | NOT NULL | `"info"` | Sévérité : `info` / `warning` / `error` / `critical` |
| `prevHash` | `text` | `TEXT` | NULL | — | Hash SHA-256 de l'événement précédent (chaîne de hachage, P2) |
| `createdAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de l'événement (append-only, pas d'updatedAt) |

**Indexes** :
- `audit_events_company_created_idx` : (companyId, createdAt) — pagination chronologique par company
- `audit_events_company_actor_idx` : (companyId, actorId, actorType) — filtrer par acteur
- `audit_events_company_action_idx` : (companyId, action) — filtrer par type d'action
- `audit_events_company_target_idx` : (companyId, targetType, targetId) — filtrer par cible
- `audit_events_company_severity_idx` : (companyId, severity, createdAt) — filtrer par sévérité

**Note** : Pas de `updatedAt` car la table est append-only (ADR-007). Le TRIGGER deny UPDATE/DELETE sera ajouté dans TECH-05 (RLS).

**Partitionnement** : Le partitionnement par mois sera configuré au niveau PostgreSQL (pas dans Drizzle ORM) lors de TECH-05. La table sera créée comme table standard ici, puis convertie en table partitionnée.

---

### T9 : Créer `packages/db/src/schema/sso_configurations.ts`

Configuration SSO SAML/OIDC par company. Une company peut avoir une seule configuration SSO active.

```typescript
import { pgTable, uuid, text, timestamp, jsonb, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const ssoConfigurations = pgTable(
  "sso_configurations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    provider: text("provider").notNull(),
    displayName: text("display_name"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProviderUniqueIdx: uniqueIndex("sso_configurations_company_provider_unique_idx").on(
      table.companyId,
      table.provider,
    ),
    companyEnabledIdx: index("sso_configurations_company_enabled_idx").on(table.companyId, table.enabled),
  }),
);
```

**Colonnes** :

| Colonne | Type Drizzle | SQL | Nullable | Default | Description |
|---------|-------------|-----|----------|---------|-------------|
| `id` | `uuid` | `UUID` | NOT NULL | `defaultRandom()` | PK |
| `companyId` | `uuid` | `UUID` | NOT NULL | — | FK → `companies.id` (ADR-001) |
| `provider` | `text` | `TEXT` | NOT NULL | — | Type SSO : `saml` / `oidc` |
| `displayName` | `text` | `TEXT` | NULL | — | Nom affiché (ex: "Okta", "Azure AD") |
| `config` | `jsonb` | `JSONB` | NOT NULL | `{}` | Configuration SSO (entity ID, metadata URL, client ID/secret, etc.) |
| `enabled` | `boolean` | `BOOLEAN` | NOT NULL | `false` | SSO activé pour cette company |
| `verifiedAt` | `timestamp` | `TIMESTAMPTZ` | NULL | — | Date de vérification de la configuration |
| `createdByUserId` | `text` | `TEXT` | NULL | — | Admin ayant créé la config |
| `createdAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de création |
| `updatedAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de dernière modification |

**Indexes** :
- `sso_configurations_company_provider_unique_idx` : UNIQUE(companyId, provider) — une seule config par type SSO par company
- `sso_configurations_company_enabled_idx` : (companyId, enabled) — trouver les configs actives

**Structure du `config` JSONB** :
```typescript
// Pour SAML :
{
  entityId: string;
  metadataUrl: string;
  certificateFingerprint: string;
  loginUrl: string;
  logoutUrl?: string;
  nameIdFormat?: string;
}

// Pour OIDC :
{
  clientId: string;
  clientSecret: string; // Chiffré en DB
  issuerUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}
```

---

### T10 : Créer `packages/db/src/schema/import_jobs.ts`

Jobs d'import depuis des sources externes (Jira, Linear, ClickUp, CSV, etc.).

```typescript
import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    source: text("source").notNull(),
    status: text("status").notNull().default("pending"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    progressTotal: integer("progress_total").notNull().default(0),
    progressDone: integer("progress_done").notNull().default(0),
    error: text("error"),
    startedByUserId: text("started_by_user_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("import_jobs_company_status_idx").on(table.companyId, table.status),
    companySourceIdx: index("import_jobs_company_source_idx").on(table.companyId, table.source),
    companyCreatedIdx: index("import_jobs_company_created_idx").on(table.companyId, table.createdAt),
  }),
);
```

**Colonnes** :

| Colonne | Type Drizzle | SQL | Nullable | Default | Description |
|---------|-------------|-----|----------|---------|-------------|
| `id` | `uuid` | `UUID` | NOT NULL | `defaultRandom()` | PK |
| `companyId` | `uuid` | `UUID` | NOT NULL | — | FK → `companies.id` (ADR-001) |
| `source` | `text` | `TEXT` | NOT NULL | — | Source : `jira` / `linear` / `clickup` / `csv` / `github_issues` |
| `status` | `text` | `TEXT` | NOT NULL | `"pending"` | Statut : `pending` / `running` / `completed` / `failed` / `cancelled` |
| `config` | `jsonb` | `JSONB` | NOT NULL | `{}` | Configuration d'import (URL API, mapping de champs, options) |
| `progressTotal` | `integer` | `INTEGER` | NOT NULL | `0` | Nombre total d'items à importer |
| `progressDone` | `integer` | `INTEGER` | NOT NULL | `0` | Nombre d'items importés avec succès |
| `error` | `text` | `TEXT` | NULL | — | Message d'erreur si échec |
| `startedByUserId` | `text` | `TEXT` | NULL | — | Qui a lancé l'import |
| `startedAt` | `timestamp` | `TIMESTAMPTZ` | NULL | — | Début effectif de l'import |
| `completedAt` | `timestamp` | `TIMESTAMPTZ` | NULL | — | Fin de l'import |
| `createdAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de création |
| `updatedAt` | `timestamp` | `TIMESTAMPTZ` | NOT NULL | `defaultNow()` | Date de dernière modification |

**Indexes** :
- `import_jobs_company_status_idx` : (companyId, status) — lister les jobs actifs
- `import_jobs_company_source_idx` : (companyId, source) — filtrer par source
- `import_jobs_company_created_idx` : (companyId, createdAt) — historique des imports

---

### T11 : Mettre à jour `packages/db/src/schema/index.ts`

Ajouter les 10 nouvelles exports au fichier index.

```typescript
// Ajouter à la fin du fichier :
export { projectMemberships } from "./project_memberships.js";
export { automationCursors } from "./automation_cursors.js";
export { chatChannels } from "./chat_channels.js";
export { chatMessages } from "./chat_messages.js";
export { containerProfiles } from "./container_profiles.js";
export { containerInstances } from "./container_instances.js";
export { credentialProxyRules } from "./credential_proxy_rules.js";
export { auditEvents } from "./audit_events.js";
export { ssoConfigurations } from "./sso_configurations.js";
export { importJobs } from "./import_jobs.js";
```

---

### T12 : Générer et valider la migration Drizzle

```bash
# 1. Compiler le TypeScript (nécessaire pour drizzle-kit)
cd packages/db && pnpm build

# 2. Générer la migration
pnpm generate

# 3. Vérifier le fichier de migration généré dans packages/db/src/migrations/
# Le fichier doit contenir 10 CREATE TABLE + tous les indexes

# 4. Appliquer la migration sur PostgreSQL de dev
pnpm migrate

# 5. Vérifier que les 48 tables existent (38 + 10)
```

---

## Acceptance Criteria

### AC-1 : 10 fichiers de schema créés
```
Given le dossier packages/db/src/schema/
When on liste les fichiers
Then les 10 nouveaux fichiers existent :
  - project_memberships.ts
  - automation_cursors.ts
  - chat_channels.ts
  - chat_messages.ts
  - container_profiles.ts
  - container_instances.ts
  - credential_proxy_rules.ts
  - audit_events.ts
  - sso_configurations.ts
  - import_jobs.ts
```

### AC-2 : Exports dans index.ts
```
Given le fichier packages/db/src/schema/index.ts
When on l'importe
Then les 10 nouvelles tables sont exportées :
  - projectMemberships, automationCursors, chatChannels, chatMessages
  - containerProfiles, containerInstances, credentialProxyRules
  - auditEvents, ssoConfigurations, importJobs
  And le total des exports est 48 (38 existants + 10 nouveaux)
```

### AC-3 : Migration générée et applicable
```
Given les 10 nouveaux fichiers de schema
When la commande `pnpm db:generate` s'exécute
Then un fichier de migration SQL est généré dans packages/db/src/migrations/
  And il contient 10 instructions CREATE TABLE
  And il contient tous les indexes définis dans les schemas
```

### AC-4 : Migration exécutable sur PostgreSQL
```
Given une base PostgreSQL avec le schema existant (38 tables)
When la commande `pnpm db:migrate` s'exécute
Then les 10 nouvelles tables sont créées
  And les 48 tables existent au total
  And aucune erreur n'est levée
```

### AC-5 : companyId sur chaque table (ADR-001)
```
Given les 10 nouvelles tables
When on inspecte leur schema
Then chaque table a une colonne `company_id UUID NOT NULL`
  And chaque `company_id` a une FK vers `companies.id` (sauf chat_messages qui utilise une FK dénormalisée sans contrainte Drizzle)
  And chaque table a au moins un index incluant `company_id` en première position
```

### AC-6 : Conventions respectées
```
Given les 10 nouveaux fichiers de schema
When on les compare aux fichiers existants (ex: company_memberships.ts, agents.ts)
Then ils suivent les mêmes conventions :
  - uuid PK avec defaultRandom()
  - timestamp avec withTimezone: true
  - camelCase en TypeScript, snake_case en SQL
  - Indexes nommés {table_name}_{colonnes}_idx
  - Imports relatifs avec .js extension
```

### AC-7 : TypeScript compile sans erreur
```
Given les 10 nouveaux fichiers de schema
When la commande `pnpm typecheck` s'exécute
Then aucune erreur TypeScript n'est levée
```

### AC-8 : Rollback possible
```
Given la migration appliquée (10 tables créées)
When un rollback est nécessaire
Then les 10 tables peuvent être droppées sans impact sur les 38 tables existantes
  And aucune FK des tables existantes ne pointe vers les nouvelles tables (one-way dependency)
```

### AC-9 : Foreign keys valides
```
Given les 10 nouvelles tables
When on inspecte les foreign keys
Then toutes les FK pointent vers des tables existantes :
  - companies.id (toutes les tables)
  - projects.id (project_memberships)
  - agents.id (chat_channels, container_instances)
  - heartbeat_runs.id (chat_channels)
  - chat_channels.id (chat_messages)
  - container_profiles.id (container_instances)
  And la seule FK inter-nouvelles-tables est : chat_messages → chat_channels et container_instances → container_profiles
```

---

## data-test-id

**N/A** — Cette story est backend-only. Aucun composant UI n'est ajouté ou modifié.

Les éléments testables sont :
- Fichiers de schema TypeScript (compilation)
- Migration SQL générée (application sur PostgreSQL)
- Requêtes SQL `\dt` pour vérifier les tables (48 au total)

---

## Notes Techniques d'Implémentation

### Ordre de création des fichiers

L'ordre est important à cause des dépendances inter-tables (imports Drizzle) :

1. `container_profiles.ts` — dépend seulement de `companies`
2. `credential_proxy_rules.ts` — dépend seulement de `companies`
3. `audit_events.ts` — dépend seulement de `companies`
4. `sso_configurations.ts` — dépend seulement de `companies`
5. `import_jobs.ts` — dépend seulement de `companies`
6. `automation_cursors.ts` — dépend de `companies`, `projects`
7. `project_memberships.ts` — dépend de `companies`, `projects`
8. `chat_channels.ts` — dépend de `companies`, `agents`, `heartbeat_runs`
9. `chat_messages.ts` — dépend de `chat_channels`
10. `container_instances.ts` — dépend de `companies`, `agents`, `container_profiles`

### userId comme text, pas uuid

La table `user` de Better Auth utilise `text("id")` comme PK (pas `uuid`). Toutes les colonnes `userId`, `senderId`, `grantedBy`, etc. sont donc `text`.

On ne crée PAS de FK Drizzle vers `user.id` pour éviter les dépendances circulaires avec le module auth (Better Auth gère sa propre table). L'intégrité référentielle est assurée au niveau applicatif.

### chat_messages.companyId sans FK Drizzle

La colonne `companyId` de `chat_messages` est dénormalisée (copiée depuis `chat_channels.companyId`). On ne met pas de FK Drizzle pour éviter une import circulaire (`chat_messages → companies` + `chat_messages → chat_channels → companies`). L'intégrité est garantie par le fait que le `channelId` FK pointe vers un channel qui a forcément un `companyId` valide.

### audit_events sans updatedAt

La table `audit_events` est append-only par design (ADR-007). Pas de colonne `updatedAt`. Le TRIGGER deny UPDATE/DELETE sera ajouté dans TECH-05.

### chat_messages sans updatedAt

Les messages de chat sont immuables après envoi. Pas de modification, pas de `updatedAt`.

### Partitionnement de audit_events

Le partitionnement par mois sera configuré dans TECH-05 (RLS) car il nécessite des opérations DDL PostgreSQL directes (pas supporté par Drizzle ORM). Cette story crée la table comme table standard.

### Noms de fichiers

Les noms de fichiers utilisent des underscores (snake_case) pour correspondre aux noms de tables SQL, conformément à la convention existante du codebase (ex: `company_memberships.ts`, `heartbeat_runs.ts`).

---

## Edge Cases et Scénarios d'Erreur

### E1 : Migration sur DB avec données existantes
```
Given une DB PostgreSQL avec les 38 tables et des données
When la migration TECH-06 s'exécute
Then les 10 nouvelles tables sont créées SANS toucher aux données existantes
  And aucune table existante n'est modifiée
```

### E2 : Migration exécutée deux fois
```
Given la migration TECH-06 déjà appliquée
When on relance `pnpm db:migrate`
Then la migration est skippée (déjà dans __drizzle_migrations)
  And aucune erreur n'est levée
```

### E3 : FK vers table non existante
```
Given les fichiers de schema avec des FK
When les tables sont créées dans le bon ordre par la migration
Then toutes les FK sont satisfaites
  And l'ordre de création dans la migration respecte les dépendances
```

### E4 : Collision de noms d'index
```
Given les index des 38 tables existantes
When les 10 nouvelles tables définissent leurs indexes
Then aucun nom d'index ne collisionne avec un index existant
  And tous les index sont préfixés par le nom de la table
```

### E5 : Suppression d'une company avec des données dans les nouvelles tables
```
Given une company avec des données dans project_memberships, chat_channels, etc.
When la company est supprimée
Then les FK `companyId` empêchent la suppression (pas de CASCADE)
  And les données doivent être nettoyées avant de supprimer la company
```

---

## Dépendances Sortantes (ce que TECH-06 débloque)

| Story | Table(s) nécessaire(s) | Raison |
|-------|----------------------|--------|
| TECH-05 | Toutes les 10 | RLS PostgreSQL sur les nouvelles tables |
| PROJ-S01 | `project_memberships` | Service project-memberships |
| DUAL-S01 | `automation_cursors` | Table automation_cursors |
| CHAT-S02 | `chat_channels`, `chat_messages` | Tables chat |
| CONT-S05 | `container_profiles`, `container_instances` | Tables container |
| OBS-S01 | `audit_events` | Table audit_events |
| SSO-S01 | `sso_configurations` | Table SSO |

---

## Critères de Définition of Done

- [ ] 10 fichiers de schema créés dans `packages/db/src/schema/`
- [ ] 10 exports ajoutés dans `packages/db/src/schema/index.ts`
- [ ] Chaque table a `companyId` avec FK vers `companies.id` (ADR-001)
- [ ] Chaque table a au moins un index incluant `companyId`
- [ ] Migration Drizzle générée (`pnpm db:generate`)
- [ ] Migration appliquée avec succès (`pnpm db:migrate`)
- [ ] 48 tables au total dans la DB
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
- [ ] Tous les tests existants passent (`pnpm test:run`)
- [ ] Aucun fichier existant modifié (sauf `index.ts`)
- [ ] Convention de nommage cohérente avec le codebase existant
