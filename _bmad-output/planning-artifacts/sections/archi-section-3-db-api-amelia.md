# Section 3 — Database Schema Changes & API Design

> **Auteur** : Amelia (Dev) | **Date** : 2026-03-14 | **Statut** : Final
> **Sources** : PRD B2B v1.0 (sections 5-6), codebase MnM (38 tables, 22 routes, `access.ts`)

---

## Table des Matières

1. [Database Schema Changes — Nouvelles Tables](#1-database-schema-changes--nouvelles-tables)
2. [Database Schema Changes — Tables Modifiées](#2-database-schema-changes--tables-modifiées)
3. [API Design par Functional Requirement](#3-api-design-par-functional-requirement)
4. [Stratégie de Migration](#4-stratégie-de-migration)

---

## 1. Database Schema Changes — Nouvelles Tables

### 1.1 `project_memberships` (T1)

**Objectif** : Scoping d'accès par projet. Permet de restreindre les permissions d'un principal (user ou agent) à un sous-ensemble de projets au sein d'une company.

```typescript
// packages/db/src/schema/project_memberships.ts
export const projectMemberships = pgTable(
  "project_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    principalType: text("principal_type").notNull(), // "user" | "agent"
    principalId: text("principal_id").notNull(),
    role: text("role").notNull().default("contributor"), // "admin" | "contributor" | "viewer"
    grantedByUserId: text("granted_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectPrincipalUniqueIdx: uniqueIndex(
      "project_memberships_company_project_principal_unique_idx"
    ).on(table.companyId, table.projectId, table.principalType, table.principalId),
    companyPrincipalIdx: index("project_memberships_company_principal_idx").on(
      table.companyId, table.principalType, table.principalId
    ),
    projectRoleIdx: index("project_memberships_project_role_idx").on(
      table.projectId, table.role
    ),
  }),
);
```

**Relations** :
- `companyId` → `companies.id` (tenant isolation)
- `projectId` → `projects.id` (cascade delete)
- `principalType` + `principalId` → correspond à `company_memberships` (user/agent)

**Impact** : Clé pour résoudre le trou critique INV-04. `hasPermission()` lira les `project_memberships` pour valider le scope JSONB `{ projectIds: [...] }` sur les `principal_permission_grants`.

---

### 1.2 `automation_cursors` (T2)

**Objectif** : Curseur d'automatisation par user/agent/project/company (REQ-DUAL-01 à 04). Trois positions : `manual` (0), `assisted` (1), `automatic` (2). Le plafond hiérarchique l'emporte toujours.

```typescript
// packages/db/src/schema/automation_cursors.ts
export const automationCursors = pgTable(
  "automation_cursors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    // Granularité : si projectId null → company-wide, si agentId null → tous agents
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    userId: text("user_id"), // null = default company/project level
    level: integer("level").notNull().default(0), // 0=manual, 1=assisted, 2=automatic
    setByUserId: text("set_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyGranularityUniqueIdx: uniqueIndex("automation_cursors_unique_idx").on(
      table.companyId, table.projectId, table.agentId, table.userId
    ),
    companyProjectIdx: index("automation_cursors_company_project_idx").on(
      table.companyId, table.projectId
    ),
  }),
);
```

**Relations** :
- `companyId` → `companies.id`
- `projectId` → `projects.id` (nullable, cascade)
- `agentId` → `agents.id` (nullable, cascade)

**Logique de résolution** : La valeur effective est `min(company_level, project_level, user_level)`. Le plafond hiérarchique (CEO > CTO > Manager > Contributor) détermine qui peut élever le curseur. Un Contributor ne peut pas passer en `automatic` si le Manager a fixé `assisted` comme plafond.

---

### 1.3 `chat_channels` (T3)

**Objectif** : Canaux de chat temps réel humain-agent (FR-CHAT). Chaque canal est typiquement lié à un run d'exécution ou à un agent spécifique.

```typescript
// packages/db/src/schema/chat_channels.ts
export const chatChannels = pgTable(
  "chat_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"), // "active" | "archived" | "closed"
    createdByUserId: text("created_by_user_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentStatusIdx: index("chat_channels_company_agent_status_idx").on(
      table.companyId, table.agentId, table.status
    ),
    companyRunIdx: index("chat_channels_company_run_idx").on(table.companyId, table.runId),
    companyProjectIdx: index("chat_channels_company_project_idx").on(
      table.companyId, table.projectId
    ),
  }),
);
```

**Relations** :
- `companyId` → `companies.id` (isolation tenant)
- `agentId` → `agents.id` (cascade delete — suppression agent ferme les canaux)
- `runId` → `heartbeat_runs.id` (optionnel, lié à un run spécifique)
- `projectId` → `projects.id` (optionnel, pour le scoping)

---

### 1.4 `chat_messages` (T4)

**Objectif** : Messages dans les canaux de chat. Support bidirectionnel humain↔agent.

```typescript
// packages/db/src/schema/chat_messages.ts
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    channelId: uuid("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
    senderType: text("sender_type").notNull(), // "user" | "agent" | "system"
    senderId: text("sender_id").notNull(),
    content: text("content").notNull(),
    contentType: text("content_type").notNull().default("text"), // "text" | "code" | "diff" | "system"
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    parentMessageId: uuid("parent_message_id"), // thread support
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelCreatedIdx: index("chat_messages_channel_created_idx").on(
      table.channelId, table.createdAt
    ),
    companyChannelIdx: index("chat_messages_company_channel_idx").on(
      table.companyId, table.channelId
    ),
    senderIdx: index("chat_messages_sender_idx").on(
      table.senderType, table.senderId
    ),
  }),
);
```

**Relations** :
- `channelId` → `chat_channels.id` (cascade delete — suppression canal supprime messages)
- `companyId` → `companies.id`
- `parentMessageId` → self-ref (optionnel, threads)

**Rate limiting** : 10 messages/min par user/canal (REQ-CHAT-05). Troncature à 100KB (edge case PRD).

---

### 1.5 `container_profiles` (T5)

**Objectif** : Profils de containerisation par type d'agent (FR-CONT). Définit les limites CPU/RAM/disque, images Docker, mounts autorisés.

```typescript
// packages/db/src/schema/container_profiles.ts
export const containerProfiles = pgTable(
  "container_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    dockerImage: text("docker_image").notNull(),
    cpuLimit: text("cpu_limit").notNull().default("1.0"), // e.g. "1.0", "0.5"
    memoryLimitMb: integer("memory_limit_mb").notNull().default(512),
    diskLimitMb: integer("disk_limit_mb").notNull().default(1024),
    timeoutSeconds: integer("timeout_seconds").notNull().default(3600),
    networkMode: text("network_mode").notNull().default("none"), // "none" | "bridge" | "host"
    mountAllowlist: jsonb("mount_allowlist").$type<string[]>().notNull().default([]),
    envOverrides: jsonb("env_overrides").$type<Record<string, string>>().notNull().default({}),
    securityOpts: jsonb("security_opts").$type<string[]>().notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameUniqueIdx: uniqueIndex("container_profiles_company_name_unique_idx").on(
      table.companyId, table.name
    ),
    companyDefaultIdx: index("container_profiles_company_default_idx").on(
      table.companyId, table.isDefault
    ),
  }),
);
```

**Relations** :
- `companyId` → `companies.id`
- Référencé par `agents.containerProfileId` (nouvelle colonne) et `container_instances.profileId`

**Sécurité** :
- `mountAllowlist` : validé via `realpath` + interdiction symlinks (REQ-CONT-03)
- `networkMode` : `none` par défaut (isolation réseau REQ-CONT-05)
- `securityOpts` : options Docker comme `["no-new-privileges"]`

---

### 1.6 `container_instances` (T6)

**Objectif** : Instances de container actives. Tracking du cycle de vie des containers Docker éphémères.

```typescript
// packages/db/src/schema/container_instances.ts
export const containerInstances = pgTable(
  "container_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    profileId: uuid("profile_id").notNull().references(() => containerProfiles.id),
    runId: uuid("run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    dockerContainerId: text("docker_container_id"), // Docker's container ID
    status: text("status").notNull().default("pending"),
      // "pending" | "starting" | "running" | "stopping" | "stopped" | "failed" | "oom_killed"
    hostNode: text("host_node"), // for multi-node
    ipAddress: text("ip_address"),
    portMappings: jsonb("port_mappings").$type<Record<string, string>>(),
    exitCode: integer("exit_code"),
    exitSignal: text("exit_signal"),
    oomKilled: boolean("oom_killed").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentStatusIdx: index("container_instances_company_agent_status_idx").on(
      table.companyId, table.agentId, table.status
    ),
    companyStatusIdx: index("container_instances_company_status_idx").on(
      table.companyId, table.status
    ),
    dockerIdIdx: index("container_instances_docker_id_idx").on(table.dockerContainerId),
    runIdx: index("container_instances_run_idx").on(table.runId),
  }),
);
```

**Relations** :
- `companyId` → `companies.id`
- `agentId` → `agents.id`
- `profileId` → `container_profiles.id`
- `runId` → `heartbeat_runs.id` (optionnel)

---

### 1.7 `credential_proxy_rules` (T7)

**Objectif** : Règles de proxy pour credentials (REQ-CONT-02). Définit quels secrets un agent peut accéder via le proxy HTTP, sans jamais voir la valeur.

```typescript
// packages/db/src/schema/credential_proxy_rules.ts
export const credentialProxyRules = pgTable(
  "credential_proxy_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    profileId: uuid("profile_id").references(() => containerProfiles.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    secretId: uuid("secret_id").notNull().references(() => companySecrets.id, { onDelete: "cascade" }),
    targetUrl: text("target_url").notNull(), // URL pattern where secret is injected
    headerName: text("header_name").notNull().default("Authorization"), // HTTP header to inject
    headerTemplate: text("header_template").notNull().default("Bearer {{secret}}"),
    allowedMethods: jsonb("allowed_methods").$type<string[]>().notNull().default(["GET", "POST"]),
    maxRequestsPerMinute: integer("max_requests_per_minute").notNull().default(60),
    enabled: boolean("enabled").notNull().default(true),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProfileIdx: index("credential_proxy_rules_company_profile_idx").on(
      table.companyId, table.profileId
    ),
    companyAgentIdx: index("credential_proxy_rules_company_agent_idx").on(
      table.companyId, table.agentId
    ),
    secretIdx: index("credential_proxy_rules_secret_idx").on(table.secretId),
  }),
);
```

**Relations** :
- `companyId` → `companies.id`
- `profileId` → `container_profiles.id` (optionnel — peut s'appliquer via profil ou directement via agent)
- `agentId` → `agents.id` (optionnel)
- `secretId` → `company_secrets.id` (cascade)

**Sécurité** : Le proxy HTTP intercepte les requêtes sortantes du container, injecte le header avec la valeur du secret, et forwarde. L'agent ne voit JAMAIS la valeur du secret.

---

### 1.8 `audit_events` (T8)

**Objectif** : Audit log enterprise immutable (REQ-OBS-02, REQ-AUDIT-01). Séparé de `activity_log` existant pour les raisons suivantes :
- **Immutabilité** : TRIGGER deny UPDATE/DELETE (NFR-SEC-04)
- **Partitionnement** : PARTITION BY RANGE sur `created_at` pour rétention 3 ans
- **Non-répudiation** : hash chain (REQ-AUDIT-02)
- **Performance** : table séparée pour éviter de pénaliser l'`activity_log` opérationnel

```typescript
// packages/db/src/schema/audit_events.ts
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(), // pas de FK pour immutabilité
    actorType: text("actor_type").notNull(), // "user" | "agent" | "system"
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(), // "member.invited", "permission.changed", "workflow.enforced", etc.
    entityType: text("entity_type").notNull(), // "company", "project", "agent", "workflow", etc.
    entityId: text("entity_id").notNull(),
    severity: text("severity").notNull().default("info"), // "info" | "warn" | "critical"
    workflowInstanceId: uuid("workflow_instance_id"),
    stageInstanceId: uuid("stage_instance_id"),
    projectId: uuid("project_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    prevHash: text("prev_hash"), // hash chain pour non-répudiation
    eventHash: text("event_hash"), // SHA-256(prevHash + action + entityId + timestamp)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("audit_events_company_created_idx").on(
      table.companyId, table.createdAt
    ),
    companyActionIdx: index("audit_events_company_action_idx").on(
      table.companyId, table.action
    ),
    companyActorIdx: index("audit_events_company_actor_idx").on(
      table.companyId, table.actorType, table.actorId
    ),
    entityIdx: index("audit_events_entity_idx").on(table.entityType, table.entityId),
    severityIdx: index("audit_events_severity_idx").on(table.companyId, table.severity),
    hashChainIdx: index("audit_events_hash_chain_idx").on(table.eventHash),
  }),
);
```

**Immutabilité SQL** (à appliquer via migration raw SQL) :
```sql
-- TRIGGER deny UPDATE/DELETE sur audit_events
CREATE OR REPLACE FUNCTION deny_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is immutable: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();
```

**Partitionnement** (migration raw SQL) :
```sql
-- Partitionnement mensuel pour rétention 3 ans
-- Note : Drizzle ne supporte pas nativement le partitionnement,
-- on utilise une migration custom
CREATE TABLE audit_events_partitioned (
  LIKE audit_events INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Partition automatique via pg_partman ou cron job mensuel
```

**Relations** : Pas de foreign keys (table immutable — les FK empêcheraient le DELETE cascade des entités référencées). Les IDs sont stockés comme références logiques.

---

### 1.9 `sso_configurations` (T9)

**Objectif** : Configuration SSO par company (NFR-SEC-05). Support SAML et OIDC via Better Auth.

```typescript
// packages/db/src/schema/sso_configurations.ts
export const ssoConfigurations = pgTable(
  "sso_configurations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    protocol: text("protocol").notNull(), // "saml" | "oidc"
    displayName: text("display_name").notNull(),
    issuerUrl: text("issuer_url"),
    clientId: text("client_id"),
    // clientSecret stocké via company_secrets, pas en clair
    clientSecretId: uuid("client_secret_id").references(() => companySecrets.id),
    metadataUrl: text("metadata_url"), // SAML metadata endpoint
    metadataXml: text("metadata_xml"), // SAML metadata XML (alternative)
    callbackPath: text("callback_path"), // override du callback URL path
    emailDomain: text("email_domain"), // auto-match : emails @domain → cette config
    attributeMapping: jsonb("attribute_mapping").$type<Record<string, string>>().notNull().default({}),
    defaultRole: text("default_role").notNull().default("contributor"),
    autoProvision: boolean("auto_provision").notNull().default(false),
    enabled: boolean("enabled").notNull().default(false),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    testResult: text("test_result"), // "success" | "failed"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProtocolIdx: index("sso_configurations_company_protocol_idx").on(
      table.companyId, table.protocol
    ),
    emailDomainIdx: uniqueIndex("sso_configurations_email_domain_idx").on(table.emailDomain),
  }),
);
```

**Relations** :
- `companyId` → `companies.id` (cascade)
- `clientSecretId` → `company_secrets.id` (le secret OAuth est stocké dans le vault, pas en clair)

---

### 1.10 `import_jobs` (T10)

**Objectif** : Jobs d'import Jira/Linear/ClickUp (REQ-ONB-03). Suivi de l'état d'import avec mapping et résultats.

```typescript
// packages/db/src/schema/import_jobs.ts
export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    source: text("source").notNull(), // "jira" | "linear" | "clickup" | "csv"
    status: text("status").notNull().default("pending"),
      // "pending" | "mapping" | "running" | "completed" | "failed" | "cancelled"
    sourceConfig: jsonb("source_config").$type<Record<string, unknown>>().notNull(),
      // { baseUrl, projectKey, apiToken (ref to secret), etc. }
    mappingConfig: jsonb("mapping_config").$type<Record<string, unknown>>(),
      // { statusMapping: {}, userMapping: {}, projectMapping: {} }
    progress: jsonb("progress").$type<{
      total: number;
      imported: number;
      skipped: number;
      errors: number;
    }>().notNull().default({ total: 0, imported: 0, skipped: 0, errors: 0 }),
    errorLog: jsonb("error_log").$type<Array<{ item: string; error: string }>>(),
    startedByUserId: text("started_by_user_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("import_jobs_company_status_idx").on(table.companyId, table.status),
    companySourceIdx: index("import_jobs_company_source_idx").on(table.companyId, table.source),
  }),
);
```

**Relations** :
- `companyId` → `companies.id`

---

## 2. Database Schema Changes — Tables Modifiées

### 2.1 `companies` — 4 colonnes ajoutées

```typescript
// Colonnes ajoutées à packages/db/src/schema/companies.ts
tier: text("tier").notNull().default("free"),
  // "free" | "team" | "enterprise" | "on_premise"
ssoEnabled: boolean("sso_enabled").notNull().default(false),
maxUsers: integer("max_users").notNull().default(5),
  // free=5, team=50, enterprise=10000
parentCompanyId: uuid("parent_company_id").references(() => companies.id),
  // null = company racine, sinon multi-tenant hiérarchique
```

**Migration** :
```sql
ALTER TABLE companies ADD COLUMN tier text NOT NULL DEFAULT 'free';
ALTER TABLE companies ADD COLUMN sso_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN max_users integer NOT NULL DEFAULT 5;
ALTER TABLE companies ADD COLUMN parent_company_id uuid REFERENCES companies(id);
```

**Impact sur les requêtes existantes** : Aucun. Toutes les nouvelles colonnes ont des defaults. Les routes existantes (`companyRoutes`) continuent de fonctionner sans modification. Les nouvelles colonnes sont exposées uniquement via les nouveaux endpoints.

**Backward compatibility** : Les companies existantes sont automatiquement `tier=free`, `ssoEnabled=false`, `maxUsers=5`, `parentCompanyId=null`. Aucun changement de comportement.

### 2.2 `company_memberships` — 1 colonne ajoutée

```typescript
// Colonne ajoutée à packages/db/src/schema/company_memberships.ts
businessRole: text("business_role").notNull().default("contributor"),
  // "admin" | "manager" | "contributor" | "viewer"
```

**Migration** :
```sql
ALTER TABLE company_memberships ADD COLUMN business_role text NOT NULL DEFAULT 'contributor';
-- Les memberships existantes deviennent 'contributor' par défaut
-- L'owner/créateur de la company doit être promu 'admin' manuellement
```

**Impact sur les requêtes existantes** : Le champ `membershipRole` existant (text nullable) coexiste avec `businessRole`. `membershipRole` est un rôle technique libre (e.g. "member", "owner"), tandis que `businessRole` est le rôle RBAC métier (les 4 niveaux). `hasPermission()` utilisera `businessRole` pour les presets, et `principal_permission_grants` pour les overrides granulaires.

**Backward compatibility** : Tous les membres existants deviennent `contributor`. Les routes existantes qui lisent `membershipRole` ne sont pas affectées.

### 2.3 `agents` — 2 colonnes ajoutées

```typescript
// Colonnes ajoutées à packages/db/src/schema/agents.ts
containerProfileId: uuid("container_profile_id").references(() => containerProfiles.id, { onDelete: "set null" }),
isolationMode: text("isolation_mode").notNull().default("process"),
  // "process" | "container" | "container_strict"
```

**Migration** :
```sql
ALTER TABLE agents ADD COLUMN container_profile_id uuid REFERENCES container_profiles(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN isolation_mode text NOT NULL DEFAULT 'process';
```

**Impact sur les requêtes existantes** : Les agents existants restent en mode `process` (comportement actuel inchangé). Le `containerProfileId` est nullable — les agents sans profil continuent de fonctionner comme avant. Les routes `agentRoutes` qui créent/modifient des agents doivent accepter les nouveaux champs optionnels.

**Backward compatibility** : Complète. Le mode `process` correspond au comportement existant.

### 2.4 `principal_permission_grants` — 9 nouvelles PERMISSION_KEYS

Pas de modification de schéma : les nouvelles clés sont ajoutées dans `packages/shared/src/constants.ts`.

```typescript
// Modification de packages/shared/src/constants.ts
export const PERMISSION_KEYS = [
  // 6 existantes
  "agents:create",
  "users:invite",
  "users:manage_permissions",
  "tasks:assign",
  "tasks:assign_scope",
  "joins:approve",
  // 9 nouvelles (15 total)
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

**Impact sur les requêtes existantes** : Aucun impact sur la table elle-même. Les 6 clés existantes continuent de fonctionner. Les 9 nouvelles sont utilisées par les nouvelles routes. La modification est dans le code TypeScript, pas en base.

### 2.5 `activity_log` — 3 colonnes ajoutées

```typescript
// Colonnes ajoutées à packages/db/src/schema/activity_log.ts
ipAddress: text("ip_address"),
userAgent: text("user_agent"),
severity: text("severity").notNull().default("info"),
  // "info" | "warn" | "critical"
```

**Migration** :
```sql
ALTER TABLE activity_log ADD COLUMN ip_address text;
ALTER TABLE activity_log ADD COLUMN user_agent text;
ALTER TABLE activity_log ADD COLUMN severity text NOT NULL DEFAULT 'info';
CREATE INDEX activity_log_severity_idx ON activity_log(company_id, severity);
```

**Impact sur les requêtes existantes** : Aucun. Les colonnes sont nullable (sauf severity avec default). Les entrées existantes de l'activity log reçoivent `severity=info`, `ipAddress=null`, `userAgent=null`. Le service `logActivity()` existant sera enrichi pour capturer req.ip et req.headers['user-agent'].

**Backward compatibility** : Complète.

---

## 3. API Design par Functional Requirement

### 3.1 FR-MU : Multi-User & Auth

Les endpoints existants (`accessRoutes` dans `server/src/routes/access.ts`) couvrent déjà une grande partie de FR-MU. Les ajouts sont mineurs.

#### `POST /api/companies/:companyId/invites/bulk`
**Objectif** : REQ-MU-03 — Invitation en bulk (CSV ou liste emails).

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/invites/bulk` |
| **Auth** | Permission `users:invite` |
| **Rate limit** | 20/h par user |

**Request body** :
```json
{
  "emails": ["alice@example.com", "bob@example.com"],
  "businessRole": "contributor",
  "projectIds": ["uuid-1", "uuid-2"],
  "message": "Bienvenue dans l'équipe MnM !"
}
```

**Response 201** :
```json
{
  "results": [
    { "email": "alice@example.com", "status": "invited", "inviteId": "uuid" },
    { "email": "bob@example.com", "status": "already_member" }
  ],
  "invited": 1,
  "skipped": 1
}
```

**Response 403** : `{ "error": "forbidden", "message": "Missing permission users:invite" }`

---

#### `GET /api/companies/:companyId/members`
**Objectif** : REQ-MU-02 — Page Membres. Endpoint existant (`listMembers` dans `access.ts`) enrichi avec pagination, filtres et businessRole.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/members` |
| **Auth** | Tout membre actif de la company |
| **Rate limit** | Standard (100/min) |

**Query params** :
```
?status=active&businessRole=admin&search=alice&page=1&limit=20&sortBy=createdAt&sortDir=desc
```

**Response 200** :
```json
{
  "data": [
    {
      "id": "uuid",
      "principalType": "user",
      "principalId": "user-id",
      "status": "active",
      "membershipRole": "owner",
      "businessRole": "admin",
      "user": { "name": "Alice", "email": "alice@example.com", "image": null },
      "permissions": ["agents:create", "users:invite", "users:manage_permissions"],
      "createdAt": "2026-03-14T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42 }
}
```

---

#### `PATCH /api/companies/:companyId/members/:memberId/role`
**Objectif** : Changement de rôle métier d'un membre.

| Champ | Valeur |
|-------|--------|
| **Méthode** | PATCH |
| **Path** | `/api/companies/:companyId/members/:memberId/role` |
| **Auth** | Permission `users:manage_permissions` |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "businessRole": "manager"
}
```

**Response 200** :
```json
{
  "id": "uuid",
  "businessRole": "manager",
  "permissions": ["agents:create", "tasks:assign", "tasks:assign_scope", "joins:approve"]
}
```

**Edge cases** :
- Dernier admin qui se rétrograde → **403** `"Cannot demote the last admin"`
- Changement de rôle pendant session → permissions appliquées au prochain appel API (pas besoin de re-login)

---

#### `DELETE /api/companies/:companyId/members/:memberId`
**Objectif** : Supprimer un membre de la company.

| Champ | Valeur |
|-------|--------|
| **Méthode** | DELETE |
| **Path** | `/api/companies/:companyId/members/:memberId` |
| **Auth** | Permission `users:manage_permissions` |
| **Rate limit** | Standard |

**Response 200** :
```json
{ "id": "uuid", "status": "removed" }
```

**Edge cases** :
- Suppression d'un membre avec agents actifs → agents passent en status `paused` et perdent leurs assignations
- Dernier admin → **403** `"Cannot remove the last admin"`

---

### 3.2 FR-RBAC : Roles & Permissions

#### `GET /api/companies/:companyId/roles`
**Objectif** : REQ-RBAC-02 — Liste des presets de rôles et leurs permissions.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/roles` |
| **Auth** | Tout membre actif |
| **Rate limit** | Standard |

**Response 200** :
```json
{
  "roles": [
    {
      "name": "admin",
      "label": "Administrateur",
      "color": "#ef4444",
      "permissions": [
        "agents:create", "users:invite", "users:manage_permissions",
        "tasks:assign", "tasks:assign_scope", "joins:approve",
        "projects:create", "projects:manage_members",
        "workflows:create", "workflows:enforce",
        "agents:manage_containers", "company:manage_settings",
        "company:manage_sso", "audit:read", "audit:export"
      ]
    },
    {
      "name": "manager",
      "label": "Manager",
      "color": "#3b82f6",
      "permissions": [
        "agents:create", "tasks:assign", "tasks:assign_scope",
        "joins:approve", "projects:create", "projects:manage_members",
        "workflows:create", "audit:read"
      ]
    },
    {
      "name": "contributor",
      "label": "Contributeur",
      "color": "#22c55e",
      "permissions": [
        "tasks:assign", "agents:create"
      ]
    },
    {
      "name": "viewer",
      "label": "Observateur",
      "color": "#6b7280",
      "permissions": [
        "audit:read"
      ]
    }
  ]
}
```

---

#### `GET /api/companies/:companyId/permissions/matrix`
**Objectif** : REQ-RBAC-07 — Matrice complète des permissions (admin UI).

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/permissions/matrix` |
| **Auth** | Permission `users:manage_permissions` |
| **Rate limit** | Standard |

**Response 200** :
```json
{
  "permissionKeys": ["agents:create", "users:invite", "..."],
  "members": [
    {
      "memberId": "uuid",
      "name": "Alice",
      "businessRole": "admin",
      "grants": {
        "agents:create": { "granted": true, "source": "preset", "scope": null },
        "users:invite": { "granted": true, "source": "custom", "scope": { "projectIds": ["uuid-1"] } }
      }
    }
  ]
}
```

---

#### `PUT /api/companies/:companyId/members/:memberId/permissions`
**Objectif** : Override granulaire des permissions d'un membre. Endpoint existant (`setMemberPermissions` dans `access.ts`) enrichi avec support scope.

| Champ | Valeur |
|-------|--------|
| **Méthode** | PUT |
| **Path** | `/api/companies/:companyId/members/:memberId/permissions` |
| **Auth** | Permission `users:manage_permissions` |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "grants": [
    { "permissionKey": "tasks:assign", "scope": { "projectIds": ["uuid-1", "uuid-2"] } },
    { "permissionKey": "agents:create", "scope": null },
    { "permissionKey": "workflows:create", "scope": { "projectIds": ["uuid-1"] } }
  ]
}
```

**Response 200** :
```json
{
  "memberId": "uuid",
  "grants": [
    { "permissionKey": "tasks:assign", "scope": { "projectIds": ["uuid-1", "uuid-2"] } },
    { "permissionKey": "agents:create", "scope": null },
    { "permissionKey": "workflows:create", "scope": { "projectIds": ["uuid-1"] } }
  ]
}
```

---

#### Correction critique : `hasPermission()` avec scope

Le trou critique identifié dans INV-04 : `hasPermission()` (access.ts:45-66) ne lit JAMAIS le `scope` JSONB.

**Signature modifiée** :
```typescript
async function hasPermission(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  permissionKey: PermissionKey,
  resourceScope?: { projectId?: string },
): Promise<boolean> {
  const membership = await getMembership(companyId, principalType, principalId);
  if (!membership || membership.status !== "active") return false;

  const grants = await db
    .select()
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

  // Si aucun scope demandé, accepter tout grant (scope null = company-wide)
  if (!resourceScope?.projectId) {
    return grants.some((g) => !g.scope); // seul un grant sans scope couvre company-wide
  }

  // Si scope demandé, vérifier que le grant couvre le projet
  return grants.some((g) => {
    if (!g.scope) return true; // grant sans scope = accès company-wide → couvre tout projet
    const scopeData = g.scope as { projectIds?: string[] };
    if (!scopeData.projectIds) return true;
    return scopeData.projectIds.includes(resourceScope.projectId!);
  });
}
```

**Impact** : Les 22 fichiers de routes doivent passer le `resourceScope` quand ils opèrent sur un projet spécifique. Exemple dans `issueRoutes` :
```typescript
// Avant
if (!(await access.canUser(companyId, userId, "tasks:assign"))) return forbidden(res);

// Après
if (!(await access.canUser(companyId, userId, "tasks:assign", { projectId }))) return forbidden(res);
```

---

### 3.3 FR-ORCH : Orchestrateur Déterministe

#### `POST /api/companies/:companyId/workflows/:workflowId/enforce`
**Objectif** : REQ-ORCH-01 — Activer l'enforcement déterministe sur un workflow.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/workflows/:workflowId/enforce` |
| **Auth** | Permission `workflows:enforce` |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "enforcementMode": "strict",
  "driftSensitivity": "medium",
  "requiredFiles": {
    "stage_1": ["requirements.md", "specs.md"],
    "stage_2": ["design.md"]
  },
  "prePrompts": {
    "stage_1": "Tu es un analyste. Lis les requirements et produis un rapport.",
    "stage_2": "Tu es un designer. Utilise le rapport d'analyse."
  },
  "humanValidationStages": [1, 3]
}
```

**Response 200** :
```json
{
  "workflowId": "uuid",
  "enforcementMode": "strict",
  "stages": [
    { "order": 1, "name": "Analyse", "enforced": true, "requiredFiles": ["requirements.md"] }
  ]
}
```

---

#### `GET /api/companies/:companyId/drift/alerts`
**Objectif** : REQ-ORCH-05 — Drift detection alerts.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/drift/alerts` |
| **Auth** | Permission `workflows:enforce` ou `audit:read` |
| **Rate limit** | Standard |

**Query params** :
```
?status=active&severity=high&workflowId=uuid&since=2026-03-01T00:00:00Z&limit=50
```

**Response 200** :
```json
{
  "alerts": [
    {
      "id": "uuid",
      "workflowInstanceId": "uuid",
      "stageInstanceId": "uuid",
      "agentId": "uuid",
      "type": "step_skipped",
      "severity": "high",
      "expected": "Stage 2: Design",
      "observed": "Stage 3: Implementation (skipped Design)",
      "detectedAt": "2026-03-14T10:30:00Z",
      "resolvedAt": null,
      "resolution": null
    }
  ],
  "total": 12
}
```

---

#### `POST /api/companies/:companyId/drift/alerts/:alertId/resolve`
**Objectif** : Résolution d'une alerte drift.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/drift/alerts/:alertId/resolve` |
| **Auth** | Permission `workflows:enforce` |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "resolution": "reload",
  "note": "Agent rechargé avec contexte corrigé"
}
```

`resolution` : `"reload"` | `"kill_restart"` | `"ignore"` | `"rollback"`

**Response 200** :
```json
{
  "id": "uuid",
  "resolution": "reload",
  "resolvedAt": "2026-03-14T11:00:00Z",
  "resolvedByUserId": "user-id"
}
```

---

### 3.4 FR-OBS : Observabilité & Audit

#### `GET /api/companies/:companyId/audit`
**Objectif** : REQ-OBS-02 — Consultation audit log immutable.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/audit` |
| **Auth** | Permission `audit:read` |
| **Rate limit** | Standard |

**Query params** :
```
?actorType=user&actorId=user-id&action=permission.changed&entityType=agent
&severity=critical&since=2026-03-01&until=2026-03-14&page=1&limit=50
```

**Response 200** :
```json
{
  "data": [
    {
      "id": "uuid",
      "actorType": "user",
      "actorId": "user-id",
      "actorName": "Alice",
      "action": "permission.changed",
      "entityType": "agent",
      "entityId": "agent-uuid",
      "entityName": "Agent Builder",
      "severity": "info",
      "workflowInstanceId": null,
      "details": { "before": { "role": "contributor" }, "after": { "role": "admin" } },
      "ipAddress": "192.168.1.10",
      "createdAt": "2026-03-14T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1240 }
}
```

---

#### `GET /api/companies/:companyId/audit/export`
**Objectif** : REQ-OBS-05 — Export audit log (CSV, JSON).

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/audit/export` |
| **Auth** | Permission `audit:export` |
| **Rate limit** | 5/h par user |

**Query params** :
```
?format=csv&since=2026-01-01&until=2026-03-14&actions=permission.changed,member.invited
```

**Response 200** : Stream CSV ou JSON selon `format`.
- Header `Content-Type: text/csv` ou `application/json`
- Header `Content-Disposition: attachment; filename="audit-export-2026-03-14.csv"`

---

#### `GET /api/companies/:companyId/dashboards/:type`
**Objectif** : REQ-OBS-03 — Dashboards management agrégés (JAMAIS individuels — Vérité #20).

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/dashboards/:type` |
| **Auth** | Selon le type : `audit:read` (executive), membre actif (team/project) |
| **Rate limit** | Standard |

**Types supportés** : `executive`, `team`, `project`, `drift`, `costs`

**Response 200 (type=executive)** :
```json
{
  "type": "executive",
  "period": { "start": "2026-03-01", "end": "2026-03-14" },
  "metrics": {
    "activeAgents": 12,
    "activeWorkflows": 5,
    "completedTasks": 147,
    "driftAlerts": 3,
    "totalCostCents": 45200,
    "budgetUsedPercent": 67,
    "memberCount": 24,
    "projectCount": 8
  },
  "trends": {
    "tasksPerDay": [12, 15, 8, 20, 18, 14, 22, 19, 16, 25, 21, 17, 23, 20],
    "costPerDay": [3200, 3500, 2800, 4100, 3900, 3600, 4200, 3800, 3400, 4500, 4100, 3700, 4300, 4000]
  }
}
```

---

### 3.5 FR-CHAT : Chat Temps Réel avec Agents

#### WebSocket `/ws/chat/:channelId`
**Objectif** : REQ-CHAT-01 — WebSocket bidirectionnel humain-agent.

| Champ | Valeur |
|-------|--------|
| **Protocol** | WebSocket (wss://) |
| **Path** | `/ws/chat/:channelId` |
| **Auth** | Token de session dans query param `?token=xxx` ou header `Authorization` |
| **Rate limit** | 10 messages/min par user/canal (REQ-CHAT-05) |

**Messages client → serveur** :
```json
{
  "type": "message",
  "content": "Utilise le pattern Repository",
  "contentType": "text"
}
```

```json
{
  "type": "typing",
  "isTyping": true
}
```

**Messages serveur → client** :
```json
{
  "type": "message",
  "id": "uuid",
  "senderType": "agent",
  "senderId": "agent-uuid",
  "senderName": "Agent Builder",
  "content": "Compris, je refactorise avec le pattern Repository...",
  "contentType": "text",
  "createdAt": "2026-03-14T10:30:00Z"
}
```

```json
{
  "type": "status",
  "channelStatus": "active",
  "agentStatus": "running"
}
```

```json
{
  "type": "error",
  "code": "rate_limited",
  "message": "Rate limit exceeded: 10 messages/min"
}
```

**Reconnexion** (REQ-CHAT-03) : Buffer 30 secondes côté serveur. À la reconnexion, le client envoie :
```json
{ "type": "sync", "lastMessageId": "uuid" }
```
Le serveur répond avec les messages manqués.

**Edge cases** :
- Message après fin d'exécution → rejeté avec `{ "type": "error", "code": "channel_closed" }`
- Message > 100KB → troncature automatique
- XSS → sanitization UTF-8 strict côté serveur

---

#### `POST /api/companies/:companyId/chat/channels`
**Objectif** : Créer un canal de chat pour un agent.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/chat/channels` |
| **Auth** | Membre actif + accès à l'agent (scope projet si applicable) |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "agentId": "uuid",
  "runId": "uuid",
  "name": "Chat Builder — Sprint 3"
}
```

**Response 201** :
```json
{
  "id": "uuid",
  "agentId": "uuid",
  "runId": "uuid",
  "name": "Chat Builder — Sprint 3",
  "status": "active",
  "wsUrl": "/ws/chat/uuid"
}
```

---

#### `GET /api/companies/:companyId/chat/channels/:channelId/messages`
**Objectif** : Historique des messages (REST fallback + pagination).

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/chat/channels/:channelId/messages` |
| **Auth** | Membre actif (viewer = read-only, REQ-CHAT-04) |
| **Rate limit** | Standard |

**Query params** : `?before=uuid&limit=50`

**Response 200** :
```json
{
  "data": [
    {
      "id": "uuid",
      "senderType": "user",
      "senderId": "user-id",
      "senderName": "Alice",
      "content": "Utilise le pattern Repository",
      "contentType": "text",
      "createdAt": "2026-03-14T10:30:00Z"
    }
  ],
  "hasMore": true
}
```

---

### 3.6 FR-CONT : Containerisation

#### `POST /api/companies/:companyId/containers/launch`
**Objectif** : REQ-CONT-01 — Lancer un container Docker éphémère.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/containers/launch` |
| **Auth** | Permission `agents:manage_containers` |
| **Rate limit** | 10/min par company |

**Request body** :
```json
{
  "agentId": "uuid",
  "profileId": "uuid",
  "runId": "uuid",
  "envOverrides": { "NODE_ENV": "production" },
  "command": ["node", "agent.js"]
}
```

**Response 201** :
```json
{
  "id": "uuid",
  "agentId": "uuid",
  "profileId": "uuid",
  "dockerContainerId": "abc123def",
  "status": "starting",
  "credentialProxyUrl": "http://localhost:9876/proxy/uuid",
  "createdAt": "2026-03-14T10:00:00Z"
}
```

---

#### `GET /api/companies/:companyId/containers/:containerId/status`
**Objectif** : État d'un container.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/containers/:containerId/status` |
| **Auth** | Permission `agents:manage_containers` ou membre avec accès au projet de l'agent |
| **Rate limit** | Standard |

**Response 200** :
```json
{
  "id": "uuid",
  "status": "running",
  "agentId": "uuid",
  "profileName": "standard-node",
  "resources": {
    "cpuPercent": 45.2,
    "memoryMb": 312,
    "memoryLimitMb": 512,
    "diskMb": 89
  },
  "startedAt": "2026-03-14T10:00:05Z",
  "uptimeSeconds": 3595
}
```

---

#### `POST /api/companies/:companyId/containers/:containerId/stop`
**Objectif** : Arrêt d'un container (SIGTERM puis SIGKILL 10s — REQ-CONT-07).

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/containers/:containerId/stop` |
| **Auth** | Permission `agents:manage_containers` |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "gracePeriodSeconds": 10,
  "reason": "Manual stop by admin"
}
```

**Response 200** :
```json
{
  "id": "uuid",
  "status": "stopping",
  "stoppedAt": null,
  "reason": "Manual stop by admin"
}
```

---

#### `GET /api/companies/:companyId/containers`
**Objectif** : Liste de tous les containers actifs d'une company.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/containers` |
| **Auth** | Permission `agents:manage_containers` |
| **Rate limit** | Standard |

**Query params** : `?status=running&agentId=uuid&page=1&limit=20`

**Response 200** :
```json
{
  "data": [
    {
      "id": "uuid",
      "agentId": "uuid",
      "agentName": "Builder",
      "profileName": "standard-node",
      "status": "running",
      "startedAt": "2026-03-14T10:00:05Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

---

#### CRUD Container Profiles

**`POST /api/companies/:companyId/container-profiles`** — Créer un profil
- Auth : `agents:manage_containers`
- Body : `{ name, dockerImage, cpuLimit, memoryLimitMb, diskLimitMb, timeoutSeconds, networkMode, mountAllowlist, securityOpts }`
- Response 201 : profil créé

**`GET /api/companies/:companyId/container-profiles`** — Lister les profils
- Auth : membre actif
- Response 200 : liste paginée

**`PATCH /api/companies/:companyId/container-profiles/:profileId`** — Modifier un profil
- Auth : `agents:manage_containers`
- Body : champs partiels
- Response 200 : profil mis à jour

**`DELETE /api/companies/:companyId/container-profiles/:profileId`** — Supprimer un profil
- Auth : `agents:manage_containers`
- Edge case : profil utilisé par des agents → **409 Conflict**
- Response 200 : `{ deleted: true }`

---

### 3.7 FR-DUAL : Dual-Speed Workflow

#### `GET /api/companies/:companyId/automation/cursor`
**Objectif** : REQ-DUAL-01 — Obtenir la valeur effective du curseur d'automatisation.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/automation/cursor` |
| **Auth** | Membre actif |
| **Rate limit** | Standard |

**Query params** : `?projectId=uuid&agentId=uuid`

**Response 200** :
```json
{
  "effectiveLevel": 1,
  "effectiveName": "assisted",
  "levels": {
    "company": { "level": 2, "setBy": "Alice (admin)" },
    "project": { "level": 1, "setBy": "Bob (manager)" },
    "user": null
  },
  "maxAllowed": 1,
  "reason": "Project-level ceiling (manager)"
}
```

---

#### `PUT /api/companies/:companyId/automation/cursor`
**Objectif** : REQ-DUAL-02/03 — Modifier le curseur d'automatisation.

| Champ | Valeur |
|-------|--------|
| **Méthode** | PUT |
| **Path** | `/api/companies/:companyId/automation/cursor` |
| **Auth** | Selon granularité : admin (company), manager (project), contributor (user/agent) |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "level": 2,
  "projectId": null,
  "agentId": null,
  "userId": null
}
```

**Response 200** :
```json
{
  "level": 2,
  "effectiveLevel": 1,
  "reason": "Capped by project-level ceiling (manager set level=1)"
}
```

**Response 403** : `"Cannot set automation level above your role ceiling"`

---

### 3.8 FR-A2A : Agent-to-Agent

#### `POST /api/companies/:companyId/agents/:agentId/query`
**Objectif** : REQ-A2A-01 — Query inter-agents avec validation humaine obligatoire.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/agents/:agentId/query` |
| **Auth** | Agent API key + permission sur l'agent cible |
| **Rate limit** | 30/min par agent |

**Request body** :
```json
{
  "targetAgentId": "uuid",
  "queryType": "context_request",
  "content": "Quels fichiers as-tu modifiés dans le sprint 3 ?",
  "requiresHumanApproval": true
}
```

**Response 202** (si approbation humaine requise) :
```json
{
  "queryId": "uuid",
  "status": "pending_approval",
  "approvalId": "uuid"
}
```

**Response 200** (si approbation automatique) :
```json
{
  "queryId": "uuid",
  "status": "completed",
  "response": { "files": ["src/auth.ts", "src/routes/login.ts"] }
}
```

---

### 3.9 SSO Configuration

#### `POST /api/companies/:companyId/sso`
**Objectif** : NFR-SEC-05 — Configuration SSO SAML/OIDC.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/sso` |
| **Auth** | Permission `company:manage_sso` |
| **Rate limit** | 5/h |

**Request body** :
```json
{
  "protocol": "oidc",
  "displayName": "CBA SSO",
  "issuerUrl": "https://login.cba.com",
  "clientId": "mnm-prod",
  "clientSecret": "secret-value",
  "emailDomain": "cba.com",
  "defaultRole": "contributor",
  "autoProvision": true
}
```

**Response 201** :
```json
{
  "id": "uuid",
  "protocol": "oidc",
  "displayName": "CBA SSO",
  "emailDomain": "cba.com",
  "enabled": false,
  "testUrl": "/api/companies/uuid/sso/uuid/test"
}
```

---

#### `POST /api/companies/:companyId/sso/:ssoId/test`
**Objectif** : Test de la configuration SSO avant activation.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/sso/:ssoId/test` |
| **Auth** | Permission `company:manage_sso` |
| **Rate limit** | 10/h |

**Response 200** :
```json
{
  "result": "success",
  "details": {
    "idpReachable": true,
    "tokenEndpoint": true,
    "userInfoEndpoint": true,
    "attributeMapping": { "email": "ok", "name": "ok" }
  },
  "testedAt": "2026-03-14T10:00:00Z"
}
```

---

### 3.10 Import Jobs

#### `POST /api/companies/:companyId/imports`
**Objectif** : REQ-ONB-03 — Lancer un import Jira/Linear.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/imports` |
| **Auth** | Permission `company:manage_settings` |
| **Rate limit** | 3/h |

**Request body** :
```json
{
  "source": "jira",
  "sourceConfig": {
    "baseUrl": "https://cba.atlassian.net",
    "projectKey": "ALPHA",
    "apiTokenSecretId": "uuid"
  },
  "mappingConfig": {
    "statusMapping": {
      "To Do": "backlog",
      "In Progress": "in_progress",
      "Done": "done"
    }
  }
}
```

**Response 201** :
```json
{
  "id": "uuid",
  "source": "jira",
  "status": "mapping",
  "progress": { "total": 0, "imported": 0, "skipped": 0, "errors": 0 }
}
```

---

#### `GET /api/companies/:companyId/imports/:importId`
**Objectif** : Suivi de la progression d'un import.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/imports/:importId` |
| **Auth** | Permission `company:manage_settings` |
| **Rate limit** | Standard |

**Response 200** :
```json
{
  "id": "uuid",
  "source": "jira",
  "status": "running",
  "progress": { "total": 245, "imported": 180, "skipped": 12, "errors": 3 },
  "errorLog": [
    { "item": "ALPHA-42", "error": "User 'jsmith' not found in MnM" }
  ],
  "startedAt": "2026-03-14T10:00:00Z"
}
```

---

## 4. Stratégie de Migration

### Phase 1 — Colonnes ajoutées, pas de breaking changes (~1 semaine)

**Objectif** : Toutes les modifications aux tables existantes. Zero downtime.

**Migrations** :
1. `ALTER TABLE companies ADD COLUMN tier text NOT NULL DEFAULT 'free'`
2. `ALTER TABLE companies ADD COLUMN sso_enabled boolean NOT NULL DEFAULT false`
3. `ALTER TABLE companies ADD COLUMN max_users integer NOT NULL DEFAULT 5`
4. `ALTER TABLE companies ADD COLUMN parent_company_id uuid REFERENCES companies(id)`
5. `ALTER TABLE company_memberships ADD COLUMN business_role text NOT NULL DEFAULT 'contributor'`
6. `ALTER TABLE agents ADD COLUMN container_profile_id uuid` (FK ajoutée après création de `container_profiles`)
7. `ALTER TABLE agents ADD COLUMN isolation_mode text NOT NULL DEFAULT 'process'`
8. `ALTER TABLE activity_log ADD COLUMN ip_address text`
9. `ALTER TABLE activity_log ADD COLUMN user_agent text`
10. `ALTER TABLE activity_log ADD COLUMN severity text NOT NULL DEFAULT 'info'`
11. Ajout index `activity_log_severity_idx`

**Rollback** : `ALTER TABLE ... DROP COLUMN` pour chaque colonne. Aucune donnée perdue car les colonnes ont des defaults.

**Risque** : Minimal. Toutes les colonnes ont des valeurs par défaut. Le code existant continue de fonctionner sans modification.

### Phase 2 — Nouvelles tables, relations (~2 semaines)

**Objectif** : Créer les 10 nouvelles tables et établir les relations.

**Ordre de création** (respecte les dépendances FK) :
1. `container_profiles` (pas de FK vers nouvelles tables)
2. `container_instances` (FK → container_profiles)
3. `credential_proxy_rules` (FK → container_profiles, company_secrets)
4. `project_memberships` (FK → projects)
5. `automation_cursors` (FK → projects, agents)
6. `chat_channels` (FK → agents, heartbeat_runs, projects)
7. `chat_messages` (FK → chat_channels)
8. `audit_events` (pas de FK — immutable)
9. `sso_configurations` (FK → companies, company_secrets)
10. `import_jobs` (FK → companies)

**Post-création** :
- Ajout FK `agents.container_profile_id → container_profiles.id`
- Création TRIGGER immutabilité sur `audit_events`
- Ajout des 9 nouvelles PERMISSION_KEYS dans constants.ts

**Rollback** : `DROP TABLE` dans l'ordre inverse. Aucun impact sur les tables existantes.

### Phase 3 — Migration scope JSONB (~1 semaine)

**Objectif** : Activer la lecture du scope JSONB dans `hasPermission()` et mettre à jour les 22 fichiers de routes.

**Étapes** :
1. Modifier `hasPermission()` dans `server/src/services/access.ts` (voir section 3.2)
2. Modifier `canUser()` pour accepter le `resourceScope` optionnel
3. Auditer les 22 fichiers de routes :
   - Routes avec contexte projet → passer `{ projectId }`
   - Routes company-wide → pas de scope (comportement existant préservé)
4. Peupler les `project_memberships` pour les membres existants (migration de données)
5. Migrer les grants existants sans scope → ils restent company-wide (backward compatible)

**Fichiers à modifier** :
- `server/src/services/access.ts` — core logic
- `server/src/routes/issues.ts` — projectId disponible
- `server/src/routes/agents.ts` — scopedToWorkspaceId → projectId
- `server/src/routes/workflows.ts` — projectId via workflowInstance
- `server/src/routes/stages.ts` — projectId via workflow
- `server/src/routes/projects.ts` — projectId direct
- `server/src/routes/goals.ts` — via project
- `server/src/routes/approvals.ts` — via agent/project
- `server/src/routes/costs.ts` — via project
- `server/src/routes/secrets.ts` — company-wide (pas de scope)
- `server/src/routes/dashboard.ts` — agrégé (pas de scope)
- `server/src/routes/activity.ts` — filtrage post-query par scope
- Autres : `authz.ts`, `access.ts`, `companies.ts`, `health.ts`, etc.

**Rollback** : Revert du code `hasPermission()` à la version sans scope. Les grants JSONB restent en base mais sont ignorés (comportement actuel).

### Phase 4 — Données existantes (~1 semaine, parallélisable avec Phase 3)

**Objectif** : Migrer les données existantes vers le nouveau modèle.

**Étapes** :
1. **Promouvoir le créateur de chaque company en admin** :
   ```sql
   UPDATE company_memberships
   SET business_role = 'admin'
   WHERE id IN (
     SELECT cm.id FROM company_memberships cm
     JOIN companies c ON cm.company_id = c.id
     WHERE cm.principal_type = 'user'
     AND cm.created_at = (
       SELECT MIN(cm2.created_at) FROM company_memberships cm2
       WHERE cm2.company_id = cm.company_id AND cm2.principal_type = 'user'
     )
   );
   ```

2. **Créer des project_memberships pour les membres existants** :
   Les membres company-wide sans scope → accès à tous les projets (pas besoin de créer des entrées — le scope null = company-wide).

3. **Peupler les presets de permissions** :
   Pour chaque membre avec un `businessRole`, insérer les `principal_permission_grants` correspondant au preset du rôle (si pas déjà présents).

4. **Migrer activity_log → audit_events** :
   Copier les entrées critiques existantes dans `audit_events` pour rétention historique.

**Rollback** : Les données migrées sont additives (nouvelles lignes, nouvelles colonnes). Aucune suppression de données existantes.

---

### Résumé des Risques de Migration

| Phase | Risque | Mitigation |
|-------|--------|------------|
| Phase 1 | Aucun — colonnes avec defaults | ALTER TABLE est non-bloquant avec defaults |
| Phase 2 | Ordre FK | Script de migration avec ordre explicite |
| Phase 3 | Régression scope | Feature flag `ENABLE_SCOPE_CHECK=false` pendant la transition |
| Phase 4 | Données incohérentes | Transaction + validation post-migration |

### Convention de Nommage des Migrations Drizzle

```
0001_add_company_tier_columns.sql
0002_add_membership_business_role.sql
0003_add_agent_container_columns.sql
0004_add_activity_log_columns.sql
0005_create_container_profiles.sql
0006_create_container_instances.sql
0007_create_credential_proxy_rules.sql
0008_create_project_memberships.sql
0009_create_automation_cursors.sql
0010_create_chat_channels.sql
0011_create_chat_messages.sql
0012_create_audit_events_with_triggers.sql
0013_create_sso_configurations.sql
0014_create_import_jobs.sql
0015_add_agent_container_profile_fk.sql
0016_seed_admin_roles.sql
0017_enable_scope_check.sql
```
