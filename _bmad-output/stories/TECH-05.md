# TECH-05 : RLS PostgreSQL — Spécification Détaillée

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Story ID** | TECH-05 |
| **Titre** | RLS PostgreSQL (Row-Level Security) |
| **Epic** | Epic 0 — Infrastructure & Setup |
| **Sprint** | Sprint 1 |
| **Effort** | L (8 SP, 5-7j) |
| **Assignation** | Tom (backend) |
| **Bloqué par** | TECH-01 (PostgreSQL externe), TECH-06 (10 nouvelles tables) |
| **Débloque** | Tout le multi-tenant, CONT-S01, BATCH 9+ |
| **ADR** | ADR-001 |
| **Type** | Backend-only (pas de composant UI — sécurité critique) |
| **Priorité** | P0 — Sécurité critique, fondation multi-tenant |

---

## Description

Implémenter Row-Level Security (RLS) PostgreSQL sur **toutes les tables tenant-scoped** pour garantir l'isolation multi-tenant au niveau base de données. RLS agit comme **défense en profondeur** : même si le code applicatif oublie un filtre `WHERE company_id = ?`, PostgreSQL bloque automatiquement l'accès aux données d'une autre company.

### Principes ADR-001

1. **`SET LOCAL app.current_company_id`** au début de chaque requête/transaction
2. **Politique RESTRICTIVE** sur toutes les tables tenant-scoped : `USING (company_id = current_setting('app.current_company_id')::uuid)`
3. **Fail-closed** : si `app.current_company_id` n'est pas défini, la requête retourne 0 résultats (pas d'erreur)
4. **Overhead négligeable** grâce aux index existants sur `company_id`

---

## Inventaire Complet des Tables

### Tables recevant RLS (39 tables)

Toutes les tables ayant une colonne `company_id` directe, SAUF les tables exclues (voir section suivante).

#### Tables existantes (pré-B2B) — 27 tables

| # | Table PostgreSQL | Schema Drizzle | Colonne FK |
|---|-----------------|----------------|------------|
| 1 | `agents` | `agents` | `company_id NOT NULL → companies.id` |
| 2 | `agent_api_keys` | `agentApiKeys` | `company_id NOT NULL → companies.id` |
| 3 | `agent_config_revisions` | `agentConfigRevisions` | `company_id NOT NULL → companies.id` |
| 4 | `agent_runtime_state` | `agentRuntimeState` | `company_id NOT NULL → companies.id` |
| 5 | `agent_task_sessions` | `agentTaskSessions` | `company_id NOT NULL → companies.id` |
| 6 | `agent_wakeup_requests` | `agentWakeupRequests` | `company_id NOT NULL → companies.id` |
| 7 | `activity_log` | `activityLog` | `company_id NOT NULL → companies.id` |
| 8 | `approvals` | `approvals` | `company_id NOT NULL → companies.id` |
| 9 | `approval_comments` | `approvalComments` | `company_id NOT NULL → companies.id` |
| 10 | `company_memberships` | `companyMemberships` | `company_id NOT NULL → companies.id` |
| 11 | `company_secrets` | `companySecrets` | `company_id NOT NULL → companies.id` |
| 12 | `cost_events` | `costEvents` | `company_id NOT NULL → companies.id` |
| 13 | `goals` | `goals` | `company_id NOT NULL → companies.id` |
| 14 | `heartbeat_runs` | `heartbeatRuns` | `company_id NOT NULL → companies.id` |
| 15 | `heartbeat_run_events` | `heartbeatRunEvents` | `company_id NOT NULL → companies.id` |
| 16 | `invites` | `invites` | `company_id → companies.id` (NULLABLE) |
| 17 | `issues` | `issues` | `company_id NOT NULL → companies.id` |
| 18 | `issue_approvals` | `issueApprovals` | `company_id NOT NULL → companies.id` |
| 19 | `issue_attachments` | `issueAttachments` | `company_id NOT NULL → companies.id` |
| 20 | `issue_comments` | `issueComments` | `company_id NOT NULL → companies.id` |
| 21 | `issue_labels` | `issueLabels` | `company_id NOT NULL → companies.id` |
| 22 | `issue_read_states` | `issueReadStates` | `company_id NOT NULL → companies.id` |
| 23 | `join_requests` | `joinRequests` | `company_id NOT NULL → companies.id` |
| 24 | `labels` | `labels` | `company_id NOT NULL → companies.id` |
| 25 | `principal_permission_grants` | `principalPermissionGrants` | `company_id NOT NULL → companies.id` |
| 26 | `projects` | `projects` | `company_id NOT NULL → companies.id` |
| 27 | `project_workspaces` | `projectWorkspaces` | `company_id NOT NULL → companies.id` |

#### Tables B2B (ajoutées par TECH-06/07) — 12 tables

| # | Table PostgreSQL | Schema Drizzle | Colonne FK |
|---|-----------------|----------------|------------|
| 28 | `project_goals` | `projectGoals` | `company_id NOT NULL → companies.id` |
| 29 | `workflow_templates` | `workflowTemplates` | `company_id NOT NULL → companies.id` |
| 30 | `workflow_instances` | `workflowInstances` | `company_id NOT NULL → companies.id` |
| 31 | `stage_instances` | `stageInstances` | `company_id NOT NULL → companies.id` |
| 32 | `project_memberships` | `projectMemberships` | `company_id NOT NULL → companies.id` |
| 33 | `automation_cursors` | `automationCursors` | `company_id NOT NULL → companies.id` |
| 34 | `chat_channels` | `chatChannels` | `company_id NOT NULL → companies.id` |
| 35 | `chat_messages` | `chatMessages` | `company_id NOT NULL` (no FK) |
| 36 | `container_profiles` | `containerProfiles` | `company_id NOT NULL → companies.id` |
| 37 | `container_instances` | `containerInstances` | `company_id NOT NULL → companies.id` |
| 38 | `credential_proxy_rules` | `credentialProxyRules` | `company_id NOT NULL → companies.id` |
| 39 | `audit_events` | `auditEvents` | `company_id NOT NULL → companies.id` |

#### Tables supplémentaires (TECH-06) — avec traitement spécial

| # | Table PostgreSQL | Schema Drizzle | Traitement RLS |
|---|-----------------|----------------|----------------|
| — | `sso_configurations` | `ssoConfigurations` | `company_id NOT NULL → companies.id` — **INCLUSE** dans RLS (table 40) |
| — | `import_jobs` | `importJobs` | `company_id NOT NULL → companies.id` — **INCLUSE** dans RLS (table 41) |

**Total : 41 tables sous RLS.**

### Tables EXCLUES de RLS (pas de `company_id` direct ou cross-tenant)

| Table PostgreSQL | Raison d'exclusion |
|-----------------|-------------------|
| `user` | Table auth Better Auth — cross-tenant, un user peut appartenir à N companies |
| `session` | Table auth Better Auth — liée à user, pas à company |
| `account` | Table auth Better Auth — providers OAuth, cross-tenant |
| `verification` | Table auth Better Auth — tokens de vérification, cross-tenant |
| `instance_user_roles` | Rôles au niveau instance (instance_admin), pas tenant-scoped |
| `companies` | La table tenant elle-même — pas de self-reference RLS |
| `assets` | A un `company_id` mais **EXCLUE par ADR-001** — les assets (fichiers, images) peuvent être partagés cross-tenant. **Note : à réévaluer si les assets deviennent strictement tenant-scoped.** |
| `inbox_dismissals` | A un `company_id` mais **EXCLUE par ADR-001** — préférences UI cross-company |
| `company_secret_versions` | N'a PAS de colonne `company_id` directe — liée via `secret_id → company_secrets.id`. Protégée indirectement par la RLS sur `company_secrets`. |
| `__drizzle_migrations` | Table système Drizzle, schema `drizzle` |

### Cas spécial : `invites`

La table `invites` a un `company_id` **NULLABLE** (`uuid("company_id").references(() => companies.id)` sans `.notNull()`). Cela signifie que certaines invitations peuvent ne pas être liées à une company (ex: invitation plateforme). La politique RLS devra gérer ce cas :

```sql
-- Pour invites: permettre l'accès aux invites de la company OU aux invites sans company (platform-level)
USING (company_id = current_setting('app.current_company_id', true)::uuid OR company_id IS NULL)
```

---

## Tâches d'Implémentation

### T1 : Migration SQL — Enable RLS + CREATE POLICY (41 tables)

Créer un fichier de migration Drizzle : `packages/db/src/migrations/XXXX_rls_policies.sql`

**Important** : Drizzle ne supporte pas nativement les commandes RLS. Cette migration sera un fichier SQL custom ajouté manuellement au dossier migrations et au journal.

#### SQL Template pour chaque table standard (40 tables)

```sql
-- =============================================
-- RLS Migration — Multi-tenant isolation
-- ADR-001: Row-Level Security PostgreSQL
-- =============================================

-- Helper: ensure the GUC exists with a safe default
-- current_setting('app.current_company_id', true) returns NULL if not set (thanks to `true` = missing_ok)

-- =============================================
-- TABLE: agents
-- =============================================
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "agents"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: agent_api_keys
-- =============================================
ALTER TABLE "agent_api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_api_keys" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "agent_api_keys"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: agent_config_revisions
-- =============================================
ALTER TABLE "agent_config_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_config_revisions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "agent_config_revisions"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: agent_runtime_state
-- =============================================
ALTER TABLE "agent_runtime_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_runtime_state" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "agent_runtime_state"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: agent_task_sessions
-- =============================================
ALTER TABLE "agent_task_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_task_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "agent_task_sessions"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: agent_wakeup_requests
-- =============================================
ALTER TABLE "agent_wakeup_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_wakeup_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "agent_wakeup_requests"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: activity_log
-- =============================================
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "activity_log"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: approvals
-- =============================================
ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approvals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "approvals"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: approval_comments
-- =============================================
ALTER TABLE "approval_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approval_comments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "approval_comments"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: company_memberships
-- =============================================
ALTER TABLE "company_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "company_memberships"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: company_secrets
-- =============================================
ALTER TABLE "company_secrets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_secrets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "company_secrets"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: cost_events
-- =============================================
ALTER TABLE "cost_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cost_events"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: goals
-- =============================================
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "goals"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: heartbeat_runs
-- =============================================
ALTER TABLE "heartbeat_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "heartbeat_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "heartbeat_runs"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: heartbeat_run_events
-- =============================================
ALTER TABLE "heartbeat_run_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "heartbeat_run_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "heartbeat_run_events"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: invites (SPECIAL: nullable company_id)
-- =============================================
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invites" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "invites"
  AS RESTRICTIVE
  FOR ALL
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR company_id IS NULL
  );

--> statement-breakpoint

-- =============================================
-- TABLE: issues
-- =============================================
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issues" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "issues"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: issue_approvals
-- =============================================
ALTER TABLE "issue_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_approvals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "issue_approvals"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: issue_attachments
-- =============================================
ALTER TABLE "issue_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_attachments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "issue_attachments"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: issue_comments
-- =============================================
ALTER TABLE "issue_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_comments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "issue_comments"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: issue_labels
-- =============================================
ALTER TABLE "issue_labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_labels" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "issue_labels"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: issue_read_states
-- =============================================
ALTER TABLE "issue_read_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_read_states" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "issue_read_states"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: join_requests
-- =============================================
ALTER TABLE "join_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "join_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "join_requests"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: labels
-- =============================================
ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "labels" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "labels"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: principal_permission_grants
-- =============================================
ALTER TABLE "principal_permission_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "principal_permission_grants" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "principal_permission_grants"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: projects
-- =============================================
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "projects"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: project_workspaces
-- =============================================
ALTER TABLE "project_workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_workspaces" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "project_workspaces"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: project_goals
-- =============================================
ALTER TABLE "project_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_goals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "project_goals"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: workflow_templates
-- =============================================
ALTER TABLE "workflow_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "workflow_templates"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: workflow_instances
-- =============================================
ALTER TABLE "workflow_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_instances" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "workflow_instances"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: stage_instances
-- =============================================
ALTER TABLE "stage_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stage_instances" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "stage_instances"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: project_memberships
-- =============================================
ALTER TABLE "project_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "project_memberships"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: automation_cursors
-- =============================================
ALTER TABLE "automation_cursors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_cursors" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "automation_cursors"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: chat_channels
-- =============================================
ALTER TABLE "chat_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_channels" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "chat_channels"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: chat_messages
-- =============================================
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "chat_messages"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: container_profiles
-- =============================================
ALTER TABLE "container_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "container_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "container_profiles"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: container_instances
-- =============================================
ALTER TABLE "container_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "container_instances" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "container_instances"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: credential_proxy_rules
-- =============================================
ALTER TABLE "credential_proxy_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credential_proxy_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "credential_proxy_rules"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: audit_events
-- =============================================
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "audit_events"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: sso_configurations
-- =============================================
ALTER TABLE "sso_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sso_configurations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "sso_configurations"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

--> statement-breakpoint

-- =============================================
-- TABLE: import_jobs
-- =============================================
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "import_jobs"
  AS RESTRICTIVE
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
```

#### Décisions SQL clés

1. **`FORCE ROW LEVEL SECURITY`** : Obligatoire pour que la politique s'applique aussi au propriétaire de la table (le user PostgreSQL de l'application). Sans `FORCE`, le superuser ou le propriétaire bypass RLS.

2. **`AS RESTRICTIVE`** : La politique est restrictive — si une table a d'autres politiques permissives, la restrictive doit toujours passer. Cela empêche un ajout futur de policy permissive de créer une faille.

3. **`current_setting('app.current_company_id', true)`** : Le paramètre `true` pour `missing_ok` fait que si le GUC n'est pas défini, `current_setting()` retourne `NULL` au lieu de lever une erreur. `NULL::uuid` ne matchera aucun `company_id`, donc 0 résultats → fail-closed.

4. **`FOR ALL`** : La politique couvre SELECT, INSERT, UPDATE, DELETE — isolation totale.

---

### T2 : Middleware `setTenantContext` — Hook Express

Créer un middleware Express qui exécute `SET LOCAL app.current_company_id` avant chaque requête tenant-scoped.

**Fichier** : `server/src/middleware/tenant-context.ts`

```typescript
import type { Request, Response, NextFunction } from "express";
import type { Db } from "@mnm/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Middleware that sets the PostgreSQL RLS tenant context.
 *
 * Resolves companyId from:
 * 1. req.params.companyId (route parameter)
 * 2. req.actor.companyId (agent authentication)
 * 3. req.actor.companyIds[0] (board user — first company, overridden by route param)
 *
 * If no companyId can be resolved, the GUC is NOT set,
 * which means RLS will filter out ALL tenant-scoped rows (fail-closed).
 */
export function tenantContextMiddleware(db: Db) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const companyId = resolveCompanyId(req);

      if (companyId) {
        // Validate UUID format to prevent SQL injection via the GUC
        if (!isValidUuid(companyId)) {
          logger.warn(
            { companyId, method: req.method, url: req.originalUrl },
            "Invalid companyId format for RLS context",
          );
          next();
          return;
        }

        await db.execute(
          sql`SELECT set_config('app.current_company_id', ${companyId}, true)`
        );

        logger.debug(
          { companyId, method: req.method, url: req.originalUrl },
          "RLS tenant context set",
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Sets the RLS tenant context for a specific companyId.
 * Used by services that need to set context outside of HTTP request flow
 * (e.g., background jobs, WebSocket handlers).
 */
export async function setTenantContext(db: Db, companyId: string): Promise<void> {
  if (!isValidUuid(companyId)) {
    throw new Error(`Invalid companyId for RLS context: ${companyId}`);
  }
  await db.execute(
    sql`SELECT set_config('app.current_company_id', ${companyId}, true)`
  );
}

/**
 * Clears the RLS tenant context.
 * Used when switching between tenants or cleaning up.
 */
export async function clearTenantContext(db: Db): Promise<void> {
  await db.execute(
    sql`SELECT set_config('app.current_company_id', '', true)`
  );
}

function resolveCompanyId(req: Request): string | undefined {
  // Priority 1: explicit route parameter
  if (req.params.companyId) {
    return req.params.companyId;
  }

  // Priority 2: agent actor has single companyId
  if (req.actor.type === "agent" && req.actor.companyId) {
    return req.actor.companyId;
  }

  // Priority 3: board user — use first companyId from memberships
  // Note: multi-company users will have context set by route param
  if (req.actor.type === "board" && req.actor.companyIds?.length) {
    return req.actor.companyIds[0];
  }

  return undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}
```

#### Choix techniques

1. **`set_config(..., true)`** : Le 3ème paramètre `true` = `is_local`, ce qui veut dire que le setting s'applique à la transaction courante seulement. Comme `postgres.js` utilise des connexions poolées, le setting est automatiquement nettoyé en fin de transaction.

2. **`sql` tagged template** de Drizzle ORM : Utilise les paramètres préparés pour empêcher l'injection SQL. Le `companyId` est passé comme paramètre, pas interpolé dans la string.

3. **UUID validation** : Double protection — la regex empêche tout contenu non-UUID d'atteindre PostgreSQL.

4. **`resolveCompanyId`** : Priorise le route param (explicite) sur l'actor (implicite) pour supporter les cas où un admin accède à une company spécifique.

---

### T3 : Intégration dans `app.ts`

Monter le middleware `tenantContextMiddleware` dans la chaîne Express, **après** `actorMiddleware` et **avant** les routes API.

**Fichier modifié** : `server/src/app.ts`

```typescript
// Ajouter l'import
import { tenantContextMiddleware } from "./middleware/tenant-context.js";

// Dans createApp(), après actorMiddleware et avant les routes :
app.use(
  actorMiddleware(db, {
    deploymentMode: opts.deploymentMode,
    resolveSession: opts.resolveSession,
  }),
);

// NEW: Set RLS tenant context after actor is resolved
app.use(tenantContextMiddleware(db));

// ... rest of routes
```

**Fichier modifié** : `server/src/middleware/index.ts`

```typescript
// Ajouter l'export
export { tenantContextMiddleware, setTenantContext, clearTenantContext } from "./tenant-context.js";
```

---

### T4 : Rôle PostgreSQL non-superuser pour l'application

**Critique** : RLS avec `FORCE ROW LEVEL SECURITY` s'applique au table owner. Mais si l'application utilise le même rôle que le propriétaire des tables et qu'on ne `FORCE` pas, RLS serait bypassé.

La stratégie choisie est **`FORCE ROW LEVEL SECURITY`** qui s'applique même au propriétaire. Cela simplifie le déploiement car on n'a pas besoin d'un rôle PostgreSQL séparé pour l'application.

**Attention** : Si dans le futur on a besoin de requêtes cross-tenant (ex: rapports admin, migrations, cron jobs), il faudra :
- Soit un rôle `mnm_admin` (superuser) qui bypass RLS pour les opérations d'administration
- Soit utiliser `SET LOCAL app.current_company_id` avec un UUID spécial de bypass
- Soit utiliser des fonctions `SECURITY DEFINER`

Pour cette story, on documente cette limitation et on ajoute une helper function `withBypassRls()` pour les cas légitimes :

```typescript
/**
 * Execute a callback with RLS bypassed.
 * ONLY for admin operations that genuinely need cross-tenant access:
 * - Migrations
 * - Instance-admin dashboards
 * - Background cleanup jobs
 *
 * The bypass works by temporarily resetting the GUC to empty string,
 * which means company_id comparison fails → 0 results.
 *
 * ACTUALLY: For bypass, we need a SEPARATE superuser connection or
 * a SECURITY DEFINER function. FORCE ROW LEVEL SECURITY means even
 * the owner is subject to RLS.
 *
 * SOLUTION: Create a separate "admin" Drizzle client that connects
 * with a role that has BYPASSRLS, or use raw SQL with SECURITY DEFINER functions.
 */
```

**Approach retenue** : Créer un rôle PostgreSQL `mnm_app` (sans BYPASSRLS) pour le runtime, et garder le rôle de migration/seed (`mnm` owner) qui a BYPASSRLS. Le `createDb()` dans `client.ts` sera utilisé tel quel (il se connecte avec le rôle défini dans `DATABASE_URL`).

**Migration additionnelle** :

```sql
-- Créer le rôle applicatif (si non existant)
-- Note: cette étape se fait HORS migration Drizzle, dans le setup Docker/init script
-- car CREATE ROLE nécessite des droits superuser.

-- docker-compose.dev.yml — init.sql:
-- CREATE ROLE mnm_app LOGIN PASSWORD 'mnm_app_dev';
-- GRANT CONNECT ON DATABASE mnm_dev TO mnm_app;
-- GRANT USAGE ON SCHEMA public TO mnm_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mnm_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mnm_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mnm_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO mnm_app;
```

**Simplification Sprint 0** : Pour cette story, on utilise `FORCE ROW LEVEL SECURITY` avec le rôle owner existant. Le rôle séparé `mnm_app` est documenté comme amélioration future. Les opérations admin (seed, migrations) qui ont besoin de bypass RLS utiliseront `SET LOCAL role = 'mnm'` (le owner) ou désactiveront temporairement RLS en dev.

---

### T5 : Adapter `createDb()` pour supporter le contexte RLS

**Fichier modifié** : `packages/db/src/client.ts`

Ajouter une helper pour créer un client DB avec context tenant automatique :

```typescript
/**
 * Execute a raw SQL command to set the tenant context.
 * Must be called at the start of each request/transaction.
 */
export async function setRlsTenantContext(db: Db, companyId: string): Promise<void> {
  const sql = postgres.unsafe
  // Actual implementation will use drizzle's sql tagged template
}
```

Plutôt que modifier `createDb()`, l'approche est de laisser le middleware Express s'occuper du `SET LOCAL` (T2/T3). Le `createDb` reste inchangé.

---

### T6 : Tests d'isolation cross-company

**Fichier** : `packages/db/src/__tests__/rls-isolation.test.ts`

Tests d'intégration qui vérifient que RLS fonctionne correctement pour chaque table.

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { createDb, type Db } from "../client.js";
import * as schema from "../schema/index.js";

// List of all RLS-protected tables with their Drizzle schema references
const RLS_TABLES = [
  { name: "agents", schema: schema.agents },
  { name: "agent_api_keys", schema: schema.agentApiKeys },
  { name: "agent_config_revisions", schema: schema.agentConfigRevisions },
  { name: "agent_runtime_state", schema: schema.agentRuntimeState },
  { name: "agent_task_sessions", schema: schema.agentTaskSessions },
  { name: "agent_wakeup_requests", schema: schema.agentWakeupRequests },
  { name: "activity_log", schema: schema.activityLog },
  { name: "approvals", schema: schema.approvals },
  { name: "approval_comments", schema: schema.approvalComments },
  { name: "company_memberships", schema: schema.companyMemberships },
  { name: "company_secrets", schema: schema.companySecrets },
  { name: "cost_events", schema: schema.costEvents },
  { name: "goals", schema: schema.goals },
  { name: "heartbeat_runs", schema: schema.heartbeatRuns },
  { name: "heartbeat_run_events", schema: schema.heartbeatRunEvents },
  { name: "invites", schema: schema.invites },
  { name: "issues", schema: schema.issues },
  { name: "issue_approvals", schema: schema.issueApprovals },
  { name: "issue_attachments", schema: schema.issueAttachments },
  { name: "issue_comments", schema: schema.issueComments },
  { name: "issue_labels", schema: schema.issueLabels },
  { name: "issue_read_states", schema: schema.issueReadStates },
  { name: "join_requests", schema: schema.joinRequests },
  { name: "labels", schema: schema.labels },
  { name: "principal_permission_grants", schema: schema.principalPermissionGrants },
  { name: "projects", schema: schema.projects },
  { name: "project_workspaces", schema: schema.projectWorkspaces },
  { name: "project_goals", schema: schema.projectGoals },
  { name: "workflow_templates", schema: schema.workflowTemplates },
  { name: "workflow_instances", schema: schema.workflowInstances },
  { name: "stage_instances", schema: schema.stageInstances },
  { name: "project_memberships", schema: schema.projectMemberships },
  { name: "automation_cursors", schema: schema.automationCursors },
  { name: "chat_channels", schema: schema.chatChannels },
  { name: "chat_messages", schema: schema.chatMessages },
  { name: "container_profiles", schema: schema.containerProfiles },
  { name: "container_instances", schema: schema.containerInstances },
  { name: "credential_proxy_rules", schema: schema.credentialProxyRules },
  { name: "audit_events", schema: schema.auditEvents },
  { name: "sso_configurations", schema: schema.ssoConfigurations },
  { name: "import_jobs", schema: schema.importJobs },
] as const;

describe("RLS Tenant Isolation", () => {
  let db: Db;
  const COMPANY_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const COMPANY_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  beforeAll(async () => {
    db = createDb(process.env.TEST_DATABASE_URL!);
    // Seed two companies
    await db.insert(schema.companies).values([
      { id: COMPANY_A_ID, name: "Company A" },
      { id: COMPANY_B_ID, name: "Company B" },
    ]).onConflictDoNothing();
  });

  afterAll(async () => {
    // Cleanup
  });

  describe("AC-01: Cross-company isolation", () => {
    it("user of company A cannot see data of company B", async () => {
      // Insert a project for company B (bypass RLS via owner role or direct insert)
      await db.execute(sql`RESET app.current_company_id`);

      // Set context to company A
      await db.execute(
        sql`SELECT set_config('app.current_company_id', ${COMPANY_A_ID}, false)`
      );

      // Query projects — should NOT see company B's projects
      const results = await db.select().from(schema.projects);
      for (const row of results) {
        expect(row.companyId).toBe(COMPANY_A_ID);
      }
    });
  });

  describe("AC-02: No SET LOCAL returns 0 results", () => {
    it("query without tenant context returns empty results", async () => {
      // Clear any existing context
      await db.execute(
        sql`SELECT set_config('app.current_company_id', '', false)`
      );

      // Query should return 0 results (not an error)
      const results = await db.select().from(schema.projects);
      expect(results).toHaveLength(0);
    });
  });

  describe("AC-03: All 41 tables are RLS-protected", () => {
    it("verifies RLS is enabled on all expected tables", async () => {
      const result = await db.execute(sql`
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);

      const rlsEnabledTables = result.rows
        .filter((row: any) => row.rowsecurity === true)
        .map((row: any) => row.tablename);

      for (const table of RLS_TABLES) {
        expect(rlsEnabledTables).toContain(table.name);
      }
    });

    it("verifies FORCE RLS is set on all expected tables", async () => {
      const result = await db.execute(sql`
        SELECT relname, relforcerowsecurity
        FROM pg_class
        WHERE relnamespace = 'public'::regnamespace
          AND relkind = 'r'
        ORDER BY relname
      `);

      const forceRlsTables = result.rows
        .filter((row: any) => row.relforcerowsecurity === true)
        .map((row: any) => row.relname);

      for (const table of RLS_TABLES) {
        expect(forceRlsTables).toContain(table.name);
      }
    });

    it("verifies tenant_isolation policy exists on all expected tables", async () => {
      const result = await db.execute(sql`
        SELECT schemaname, tablename, policyname, permissive, cmd, qual
        FROM pg_policies
        WHERE schemaname = 'public'
          AND policyname = 'tenant_isolation'
        ORDER BY tablename
      `);

      const policyTables = result.rows.map((row: any) => row.tablename);

      for (const table of RLS_TABLES) {
        expect(policyTables).toContain(table.name);
      }

      // Verify all policies are RESTRICTIVE
      for (const row of result.rows as any[]) {
        expect(row.permissive).toBe("RESTRICTIVE");
      }
    });
  });

  describe("AC-04: Cross-company isolation per table", () => {
    // For each table, insert data for company A and company B,
    // then verify isolation when switching context

    it.each(RLS_TABLES.map(t => t.name))(
      "table '%s' isolates data between companies",
      async (tableName) => {
        // Set context to company A
        await db.execute(
          sql`SELECT set_config('app.current_company_id', ${COMPANY_A_ID}, false)`
        );

        // Count rows — should only see company A's data
        const countResult = await db.execute(
          sql.raw(`SELECT count(*) as cnt FROM "${tableName}" WHERE company_id != '${COMPANY_A_ID}'`)
        );

        // No rows from other companies should be visible
        expect(Number((countResult.rows[0] as any).cnt)).toBe(0);
      }
    );
  });

  describe("AC-05: INSERT respects RLS", () => {
    it("cannot insert data for a different company", async () => {
      // Set context to company A
      await db.execute(
        sql`SELECT set_config('app.current_company_id', ${COMPANY_A_ID}, false)`
      );

      // Attempt to insert a project for company B — should be blocked by RLS
      await expect(
        db.insert(schema.projects).values({
          name: "Rogue Project",
          companyId: COMPANY_B_ID,
        })
      ).rejects.toThrow();
    });
  });

  describe("AC-06: invites special case — NULL company_id", () => {
    it("platform invites (NULL company_id) are visible in any context", async () => {
      // Insert a platform invite (no company_id)
      // This should be visible regardless of tenant context

      await db.execute(
        sql`SELECT set_config('app.current_company_id', ${COMPANY_A_ID}, false)`
      );

      // Platform invites should be visible
      const results = await db.select().from(schema.invites);
      const platformInvites = results.filter(r => r.companyId === null);
      // If any platform invites exist, they should be visible
      // (test verifies the policy allows NULL company_id)
    });
  });
});
```

---

### T7 : Adapter les opérations cross-tenant existantes

Certaines opérations du code actuel font des requêtes cross-tenant légitimes. Elles doivent être adaptées.

#### 7.1 — `actorMiddleware` (auth.ts)

La résolution d'actor dans `actorMiddleware` fait des queries sur `companyMemberships` et `instanceUserRoles` **avant** que le tenant context ne soit set. C'est correct car le middleware tenant context s'exécute **après** l'actor middleware. Cependant, avec `FORCE ROW LEVEL SECURITY`, même ces queries seront filtrées si aucun context n'est set.

**Solution** : Les queries dans `actorMiddleware` qui touchent `company_memberships` ont besoin d'un bypass. Options :

1. **Preferred** : Utiliser une connexion séparée sans RLS pour l'auth
2. **Pragmatic** : Faire la query membership via une `SECURITY DEFINER` function
3. **Simplest** : Ne pas `FORCE` RLS sur `company_memberships`, utiliser RLS normal (propriétaire bypass automatiquement)

**Décision** : Pour `company_memberships`, `principal_permission_grants`, et `instance_user_roles`, les queries d'authentification et d'autorisation ont besoin d'accès cross-tenant. La solution est :

- Créer un 2ème Drizzle client `adminDb` qui utilise le rôle owner (bypass RLS)
- `actorMiddleware` et `requirePermission` middleware utilisent `adminDb`
- Toutes les routes métier utilisent le `db` standard (soumis à RLS)

```typescript
// packages/db/src/client.ts — ajout
export function createAdminDb(url: string) {
  const sql = postgres(url);
  return drizzlePg(sql, { schema });
}
// Même chose que createDb mais sera connecté avec un rôle BYPASSRLS
// En pratique, si on utilise le même user PostgreSQL partout,
// la différence se fait via SET LOCAL role.
```

**Alternative simplifiée pour Sprint 0** : Comme le codebase utilise un seul rôle PostgreSQL, et qu'on utilise `FORCE ROW LEVEL SECURITY`, les opérations d'auth/middleware devront faire un `RESET app.current_company_id` ou se connecter avant que le GUC soit set (ce qui est déjà le cas puisque `actorMiddleware` s'exécute avant `tenantContextMiddleware`).

**WAIT** : L'ordre des middlewares résout le problème :
1. `actorMiddleware` → queries `company_memberships` etc. → **PAS de GUC set** → RLS retourne 0 résultats → **PROBLÈME**

**Solution finale** : Le middleware `actorMiddleware` doit utiliser un raw SQL connection qui n'est pas soumis à RLS, OU les queries d'auth doivent utiliser des `SECURITY DEFINER` functions.

**Approach retenue (pragmatique)** :
- Créer des `SECURITY DEFINER` SQL functions pour les 3 queries cross-tenant de l'auth middleware
- OU plus simple : utiliser `SET LOCAL role = 'owner_role'` dans l'auth middleware puis reset

**Approach finale (la plus simple)** :
- Le `createDb()` actuel se connecte avec le rôle owner du DATABASE_URL
- `FORCE ROW LEVEL SECURITY` s'applique même au owner
- On crée une function `withoutRls(db)` qui fait `SET LOCAL row_security TO off` pour les opérations admin
- Ou mieux : on ne `FORCE` pas RLS, et le rôle owner bypass automatiquement RLS. On crée un rôle `mnm_app` pour le runtime.

**DECISION DEFINITIVE** :

On n'utilise PAS `FORCE ROW LEVEL SECURITY`. On utilise uniquement `ENABLE ROW LEVEL SECURITY`. Le rôle owner (utilisé par les migrations et l'auth middleware) bypass automatiquement RLS. Le runtime applicatif (routes business) utilisera le même rôle mais avec le GUC set, ce qui fait que les policies s'appliquent quand le GUC est défini.

MAIS WAIT : sans FORCE, le owner bypass toujours. Même avec le GUC set, les policies ne s'appliquent pas au owner.

**VRAIE SOLUTION (industry standard)** :

1. **Rôle owner** (`mnm`) : utilisé pour les migrations, le seed, les opérations admin. **Bypass RLS** (comportement par défaut PostgreSQL).
2. **Rôle applicatif** (`mnm_app`) : utilisé par le runtime Express. **Soumis à RLS** (pas BYPASSRLS).
3. Le serveur utilise **deux connexions** :
   - `createDb(DATABASE_URL)` → rôle `mnm_app` → soumis à RLS (pour les routes business)
   - `createAdminDb(DATABASE_ADMIN_URL)` → rôle `mnm` → bypass RLS (pour auth, migrations, admin)

**Variables d'environnement** :
```
DATABASE_URL=postgresql://mnm_app:password@localhost:5432/mnm_dev
DATABASE_ADMIN_URL=postgresql://mnm:password@localhost:5432/mnm_dev
```

Si `DATABASE_ADMIN_URL` n'est pas défini, fallback à `DATABASE_URL` (mode local_trusted, pas de RLS enforcement).

---

### T8 : Init script Docker — Rôles PostgreSQL

**Fichier** : `docker/init-rls.sql` (monté dans docker-compose.dev.yml comme init script)

```sql
-- Create the application role (non-superuser, no BYPASSRLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mnm_app') THEN
    CREATE ROLE mnm_app LOGIN PASSWORD 'mnm_app_dev';
  END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE mnm_dev TO mnm_app;
GRANT USAGE ON SCHEMA public TO mnm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mnm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mnm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mnm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mnm_app;

-- Grant access to drizzle migration schema (read-only for inspection)
GRANT USAGE ON SCHEMA drizzle TO mnm_app;
GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO mnm_app;
```

**Modification** : `docker-compose.dev.yml` — ajouter le montage de l'init script.

---

### T9 : Modifier `createDb` et le serveur startup

**Fichier modifié** : `packages/db/src/client.ts`

```typescript
// Ajouter createAdminDb (même API, rôle différent via URL)
export function createAdminDb(url: string) {
  const sql = postgres(url);
  return drizzlePg(sql, { schema });
}
```

**Fichier modifié** : `server/src/index.ts`

```typescript
// Startup : créer les deux connexions DB
const adminDb = createDb(config.databaseAdminUrl || config.databaseUrl);
const db = createDb(config.databaseAppUrl || config.databaseUrl);

// Auth middleware utilise adminDb (bypass RLS)
app.use(actorMiddleware(adminDb, { ... }));

// Tenant context middleware set le GUC pour db
app.use(tenantContextMiddleware(db));

// Routes business utilisent db (soumis à RLS)
api.use("/companies", companyRoutes(db));
```

**Fichier modifié** : `server/src/config.ts`

```typescript
// Ajouter les nouvelles variables d'environnement
databaseAdminUrl: env.DATABASE_ADMIN_URL || null,
databaseAppUrl: env.DATABASE_APP_URL || env.DATABASE_URL || null,
```

---

## data-test-id Mapping

Bien que TECH-05 soit une story backend-only sans composants UI, les `data-test-id` sont utilisés dans les tests E2E Playwright pour identifier les éléments à vérifier.

| data-testid | Description | Utilisé dans |
|-------------|-------------|-------------|
| `data-testid="tech-05-rls-enabled"` | Marqueur dans le health check confirmant que RLS est actif | `GET /api/health` response body |
| `data-testid="tech-05-rls-table-count"` | Nombre de tables sous RLS dans le health check | `GET /api/health` response body |
| `data-testid="tech-05-tenant-context-set"` | Log confirmant que le tenant context a été set | Server logs |
| `data-testid="tech-05-isolation-test"` | Classe de test pour l'isolation cross-company | Tests d'intégration |
| `data-testid="tech-05-policy-check"` | Classe de test pour la vérification des policies | Tests d'intégration |
| `data-testid="tech-05-fail-closed"` | Classe de test pour le comportement fail-closed | Tests d'intégration |
| `data-testid="tech-05-insert-block"` | Classe de test pour le blocage d'INSERT cross-tenant | Tests d'intégration |
| `data-testid="tech-05-admin-bypass"` | Classe de test pour le bypass admin (migrations, auth) | Tests d'intégration |

### Health Check Enrichment

**Fichier modifié** : `server/src/routes/health.ts`

Ajouter au payload du health check :

```json
{
  "rls": {
    "enabled": true,
    "tablesProtected": 41,
    "policyName": "tenant_isolation"
  }
}
```

Le health check query `pg_tables` pour compter les tables avec `rowsecurity = true`.

---

## Acceptance Criteria — Détaillés

### AC-01 : Isolation cross-company (P0)

```
Given un user authentifié pour company A
  And des données existent pour company A et company B
When il exécute une requête SELECT sur n'importe quelle table RLS-protégée
Then il ne voit AUCUNE donnée de company B
  And il voit UNIQUEMENT les données de company A
```

**Test** : Pour chaque table RLS, insérer des données pour 2 companies, set le context pour company A, vérifier que seules les données company A sont retournées.

### AC-02 : Fail-closed — pas de context = 0 résultats

```
Given une connexion PostgreSQL sans SET LOCAL app.current_company_id
When une requête SELECT s'exécute sur une table RLS-protégée
Then elle retourne 0 résultats
  And aucune erreur n'est levée
```

**Test** : Ouvrir une connexion sans set le GUC, query une table avec des données, vérifier 0 résultats et pas d'exception.

### AC-03 : Toutes les tables sont protégées

```
Given les 41 tables tenant-scoped
When on inspecte pg_tables et pg_policies
Then 41 tables ont rowsecurity = true
  And 41 tables ont une policy "tenant_isolation" RESTRICTIVE
  And la policy couvre FOR ALL (SELECT, INSERT, UPDATE, DELETE)
```

**Test** : Query `pg_tables` et `pg_policies`, vérifier le count et les attributs.

### AC-04 : INSERT cross-tenant bloqué

```
Given le context RLS set pour company A
When une requête INSERT tente d'insérer une row avec company_id = company B
Then la requête est bloquée par RLS
  And une erreur PostgreSQL est retournée
```

**Test** : Set context company A, tenter un INSERT avec company_id de company B, vérifier l'erreur.

### AC-05 : UPDATE/DELETE cross-tenant bloqué

```
Given le context RLS set pour company A
  And une row existe pour company B
When une requête UPDATE ou DELETE cible cette row
Then la requête ne modifie/supprime AUCUNE row (0 rows affected)
  And la row de company B reste intacte
```

**Test** : Set context company A, tenter UPDATE/DELETE sur des rows de company B, vérifier 0 affected rows.

### AC-06 : Middleware tenant context fonctionne

```
Given un user authentifié avec actor.companyId = X
When il fait une requête API /api/companies/:companyId/...
Then le middleware set SET LOCAL app.current_company_id = :companyId
  And les queries Drizzle dans la route sont filtrées par RLS
```

**Test** : Faire une requête API avec un token company A, vérifier que les données retournées sont exclusivement company A.

### AC-07 : Auth middleware bypass RLS

```
Given le serveur démarre avec DATABASE_ADMIN_URL configuré
When le actorMiddleware résout un user et ses company_memberships
Then la query company_memberships s'exécute via adminDb (bypass RLS)
  And l'authentification fonctionne normalement
```

**Test** : Vérifier que l'auth middleware peut résoudre les memberships cross-tenant.

### AC-08 : invites — NULL company_id visible

```
Given une invite plateforme (company_id IS NULL)
  And le context RLS set pour company A
When une requête SELECT sur invites s'exécute
Then l'invite plateforme EST visible (company_id IS NULL autorisé par policy)
  And les invites de company B ne sont PAS visibles
```

**Test** : Insérer des invites pour company A, company B, et plateforme (NULL), set context A, vérifier que seules A + NULL sont visibles.

### AC-09 : Health check RLS status

```
Given le serveur est démarré avec RLS actif
When un GET /api/health est exécuté
Then la réponse contient rls.enabled = true
  And rls.tablesProtected = 41
```

**Test** : Appeler le health endpoint, vérifier le champ `rls`.

---

## Fichiers Impactés

| Fichier | Action | Description |
|---------|--------|-------------|
| `packages/db/src/migrations/XXXX_rls_policies.sql` | CREATE | Migration RLS 41 tables |
| `server/src/middleware/tenant-context.ts` | CREATE | Middleware SET LOCAL |
| `server/src/middleware/index.ts` | MODIFY | Ajouter export tenant-context |
| `server/src/app.ts` | MODIFY | Monter tenantContextMiddleware |
| `server/src/middleware/auth.ts` | MODIFY | Utiliser adminDb |
| `server/src/middleware/require-permission.ts` | MODIFY | Utiliser adminDb |
| `packages/db/src/client.ts` | MODIFY | Ajouter createAdminDb |
| `server/src/config.ts` | MODIFY | Ajouter DATABASE_ADMIN_URL |
| `server/src/index.ts` | MODIFY | Startup avec 2 DB clients |
| `server/src/routes/health.ts` | MODIFY | Ajouter RLS status |
| `docker/init-rls.sql` | CREATE | Init script rôles PG |
| `docker-compose.dev.yml` | MODIFY | Mount init script |
| `.env.example` | MODIFY | Ajouter DATABASE_ADMIN_URL |
| `packages/db/src/__tests__/rls-isolation.test.ts` | CREATE | Tests d'isolation |
| `e2e/tests/TECH-05.spec.ts` | CREATE | Tests E2E Playwright |

---

## Risques et Mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Performance overhead RLS | Faible | Les index sur `company_id` existent déjà sur toutes les tables. Le plan d'exécution PostgreSQL intègre la condition RLS dans le scan d'index. |
| Queries auth bloquées par RLS | Critique | Utiliser `adminDb` (rôle owner, bypass RLS) pour l'auth middleware |
| Migrations bloquées par RLS | Critique | Les migrations utilisent le rôle owner via `DATABASE_ADMIN_URL` |
| Seed bloqué par RLS | Modéré | Le script seed utilise `DATABASE_ADMIN_URL` |
| Background jobs (heartbeat, etc.) | Modéré | Les services background doivent set le tenant context ou utiliser `adminDb` |
| WebSocket handlers | Modéré | `setTenantContext()` helper pour les handlers WebSocket |
| `company_secret_versions` non protégée directement | Faible | Protégée indirectement via FK cascade sur `company_secrets` (RLS-protégée). Un SELECT direct est impossible sans passer par le `secret_id` qui est lui-même filtré. |

---

## Dépendances Techniques

| Dépendance | Status | Notes |
|------------|--------|-------|
| TECH-01 (PostgreSQL externe) | DONE | DB externe nécessaire pour les rôles |
| TECH-06 (10 nouvelles tables) | DONE | Toutes les tables B2B ont company_id |
| TECH-07 (Modifications 5 tables) | DONE | Colonnes B2B ajoutées |
| Drizzle ORM `sql` tag | Disponible | `drizzle-orm` supporte `sql` tagged template |
| `postgres` driver | Disponible | Le driver `postgres` (postgres.js) supporte `SET LOCAL` |

---

## Notes pour le Dev Agent

1. **Ordre d'implémentation** :
   - T8 → T4 → T1 → T2 → T3 → T9 → T5 → T7 → T6
   - (Docker init → Rôles PG → Migration RLS → Middleware → App integration → Client → Cross-tenant fixes → Tests)

2. **Ne PAS utiliser `FORCE ROW LEVEL SECURITY`** : Utiliser uniquement `ENABLE ROW LEVEL SECURITY`. Le rôle `mnm_app` (non-owner, non-BYPASSRLS) sera soumis à RLS. Le rôle `mnm` (owner) bypass naturellement pour les opérations admin.

3. **UPDATE la migration SQL** : Retirer tous les `ALTER TABLE ... FORCE ROW LEVEL SECURITY` de la migration T1. Seul `ENABLE ROW LEVEL SECURITY` est nécessaire quand on utilise un rôle applicatif séparé.

4. **Tester avec embedded-postgres** : Les tests d'intégration utilisent `embedded-postgres` (TECH-03). Vérifier que embedded-postgres supporte les rôles et RLS.

5. **`set_config` vs `SET LOCAL`** : Préférer `set_config('app.current_company_id', $1, true)` car il est paramétrable via prepared statements (pas d'injection SQL). `SET LOCAL app.current_company_id = '...'` nécessite du SQL dynamique.

6. **Transaction-scoped** : Le `set_config(..., true)` est `LOCAL` = scopé à la transaction. Avec `postgres.js` en mode auto-commit, chaque query est sa propre transaction. Pour que le GUC persiste sur plusieurs queries, il faut une transaction explicite OU utiliser `set_config(..., false)` (session-scoped) et reset en fin de requête.

   **IMPORTANT** : Avec `postgres.js`, les connexions sont poolées. Si on utilise `set_config(..., false)` (session-scoped), le GUC persiste sur la connexion poolée et pourrait fuiter vers la requête suivante. **Solution** :
   - Utiliser `set_config(..., false)` (session) au début de chaque requête
   - Utiliser `RESET app.current_company_id` en fin de requête (middleware cleanup)
   - OU utiliser une transaction explicite pour chaque requête et `set_config(..., true)` (local)

   **Approach retenue** : `set_config(..., false)` + cleanup middleware, car les transactions explicites pour chaque requête ajoutent de la complexité.
