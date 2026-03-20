# OBS-S02 : Service audit emission -- Integration systematique dans les routes

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | OBS-S02 |
| **Titre** | Service audit emission -- Integration systematique dans les routes |
| **Epic** | Epic OBS -- Observabilite & Audit (Noyau B) |
| **Sprint** | Sprint 4 (Batch 7) |
| **Effort** | M (5 SP, 3-5j) |
| **Priorite** | P0 -- Prerequis conformite enterprise |
| **Assignation** | Tom (backend) |
| **Bloque par** | RBAC-S04 (Enforcement 22 routes -- DONE), OBS-S01 (Table audit_events + service -- DONE) |
| **Debloque** | OBS-S04 (UI AuditLog), A2A-S03 (Audit A2A), DASH-S01 (API dashboards) |
| **ADR** | ADR-007 (Observabilite) |
| **Type** | Backend-only (service middleware + integration routes, pas de composant UI) |
| **FRs couverts** | REQ-OBS-01 (Toute mutation tracee P0), REQ-OBS-02 (Audit log complet P0) |

---

## Description

### Contexte -- Pourquoi cette story est necessaire

MnM dispose actuellement de deux systemes de logging :

1. **`logActivity()`** -- systeme legacy basique qui ecrit dans la table `activity_log`. Mutable, sans hash chain, sans garantie d'immutabilite. Deja appele dans ~80 endroits des routes.
2. **`auditService.emit()`** -- systeme immutable cree par OBS-S01, ecrit dans la table `audit_events` avec hash chain SHA-256, partitionnement mensuel, TRIGGER deny UPDATE/DELETE. Actuellement utilise nulle part (sauf dans les routes audit elles-memes).

Cette story connecte le systeme d'audit immutable (OBS-S01) aux actions du systeme. Chaque mutation importante doit emettre automatiquement un `audit_event` en plus du `logActivity()` existant.

### Ce que cette story fait

1. **Cree un middleware Express `auditEmit`** qui s'injecte dans le pipeline request/response pour emettre automatiquement un audit event apres une mutation reussie
2. **Cree un helper `emitAudit()`** inline utilisable dans les route handlers pour les cas complexes (quand le middleware ne suffit pas)
3. **Integre l'emission d'audit dans 17 fichiers de routes** couvrant toutes les mutations critiques
4. **Enrichit le middleware `requirePermission`** pour emettre `access.denied` via le systeme d'audit immutable (pas juste un log)
5. **Definit le catalogue complet des 45+ actions d'audit** avec leur severite, targetType et metadata

### Ce que cette story NE fait PAS

- Pas de modification de la table `audit_events` (faite dans OBS-S01)
- Pas de suppression de `logActivity()` (coexistence, migration progressive)
- Pas d'UI (OBS-S04)
- Pas de resume LLM (OBS-S03)

---

## Architecture

### Strategie d'integration

Deux patterns complementaires pour emettre des audit events :

#### Pattern 1 -- Helper inline `emitAudit()`

Un helper simple a appeler dans les route handlers apres une mutation reussie. C'est le pattern principal car il offre un controle total sur les metadonnees.

```typescript
// server/src/services/audit-emitter.ts
import type { Request } from "express";
import type { Db } from "@mnm/db";
import type { AuditEventInput, AuditSeverity } from "@mnm/shared";
import { auditService } from "./audit.js";

interface EmitAuditParams {
  req: Request;
  db: Db;
  companyId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
  severity?: AuditSeverity;
}

export async function emitAudit(params: EmitAuditParams): Promise<void> {
  const { req, db, companyId, action, targetType, targetId, metadata, severity } = params;
  const svc = auditService(db);

  const actorType = req.actor.type === "agent" ? "agent"
    : req.actor.type === "board" ? "user"
    : "system";
  const actorId = req.actor.type === "agent"
    ? (req.actor.agentId ?? "unknown-agent")
    : req.actor.type === "board"
    ? (req.actor.userId ?? "unknown-user")
    : "system";

  await svc.emit({
    companyId,
    actorId,
    actorType,
    action,
    targetType,
    targetId,
    metadata: metadata ?? null,
    ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
    userAgent: req.get("user-agent") ?? null,
    severity: severity ?? "info",
  });
}
```

#### Pattern 2 -- Middleware `requirePermission` enrichi

Le middleware `requirePermission` (deja en place sur toutes les routes mutantes via RBAC-S04) emet deja un `logger.warn()` quand un acces est refuse. On ajoute un appel `auditService.emit()` pour que les refus soient traces dans le systeme d'audit immutable.

```typescript
// Dans require-permission.ts, apres le throw forbidden:
// AVANT le throw (car le throw interrompt l'execution)
await auditService(db).emit({
  companyId,
  actorId: userId ?? agentId ?? "unknown",
  actorType: req.actor.type === "agent" ? "agent" : "user",
  action: "access.denied",
  targetType: "permission",
  targetId: permissionKey,
  metadata: {
    route: `${req.method} ${req.originalUrl}`,
    resourceScope: resourceScope ?? null,
  },
  ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
  userAgent: req.get("user-agent") ?? null,
  severity: "warning",
});
```

---

## Catalogue des Actions d'Audit

### Nomenclature

Format : `{domain}.{action}` avec les domaines suivants :

| Domaine | Description | Route files concernes |
|---------|-------------|----------------------|
| `access` | Authentification et autorisation | `require-permission.ts`, `access.ts` |
| `agent` | Cycle de vie des agents | `agents.ts` |
| `approval` | Approbations de hire | `approvals.ts` |
| `asset` | Fichiers uploades | `assets.ts` |
| `company` | Configuration company | `companies.ts` |
| `cost` | Budgets et couts | `costs.ts` |
| `goal` | Objectifs projet | `goals.ts` |
| `issue` | Stories/issues | `issues.ts` |
| `member` | Gestion des membres | `access.ts` |
| `orchestrator` | Orchestration workflow | `orchestrator.ts` |
| `project` | Projets et workspaces | `projects.ts` |
| `project_membership` | Membres de projets | `project-memberships.ts` |
| `secret` | Secrets et credentials | `secrets.ts` |
| `stage` | Etapes de workflow | `stages.ts` |
| `workflow` | Templates et instances | `workflows.ts` |

### Catalogue complet des actions

#### access -- Authentification & Autorisation

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `access.denied` | warning | `permission` | permissionKey | `{ route, resourceScope }` | `require-permission.ts` |
| `access.invite_created` | info | `invite` | inviteId | `{ email, businessRole, method }` | `access.ts` |
| `access.invite_accepted` | info | `invite` | inviteId | `{ userId, email }` | `access.ts` |
| `access.join_request_approved` | info | `member` | membershipId | `{ userId, approvedBy }` | `access.ts` |
| `access.join_request_rejected` | info | `member` | joinRequestId | `{ userId, rejectedBy }` | `access.ts` |
| `access.member_permissions_updated` | info | `permission` | membershipId | `{ permissionKey, granted }` | `access.ts` |
| `access.member_role_changed` | info | `member` | membershipId | `{ oldRole, newRole }` | `access.ts` |
| `access.member_removed` | warning | `member` | membershipId | `{ userId }` | `access.ts` |

#### agent -- Cycle de vie agents

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `agent.created` | info | `agent` | agentId | `{ name, adapterType }` | `agents.ts` |
| `agent.hired` | info | `agent` | agentId | `{ name, adapterType, projectId }` | `agents.ts` |
| `agent.updated` | info | `agent` | agentId | `{ changedFields }` | `agents.ts` |
| `agent.deleted` | warning | `agent` | agentId | `{ name }` | `agents.ts` |
| `agent.woken` | info | `agent` | agentId | `{ issueId }` | `agents.ts` |
| `agent.permissions_changed` | info | `agent` | agentId | `{ permissions }` | `agents.ts` |
| `agent.instructions_changed` | info | `agent` | agentId | `{ path }` | `agents.ts` |
| `agent.config_rollback` | info | `agent` | agentId | `{ revisionId }` | `agents.ts` |
| `agent.session_reset` | info | `agent` | agentId | `{}` | `agents.ts` |
| `agent.key_created` | info | `agent` | agentId | `{ keyType }` | `agents.ts` |
| `agent.claude_login` | info | `agent` | agentId | `{}` | `agents.ts` |

#### approval -- Approbations hire

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `approval.created` | info | `approval` | approvalId | `{ agentName }` | `approvals.ts` |
| `approval.approved` | info | `approval` | approvalId | `{ agentName, approvedBy }` | `approvals.ts` |
| `approval.rejected` | info | `approval` | approvalId | `{ agentName, rejectedBy }` | `approvals.ts` |
| `approval.revision_requested` | info | `approval` | approvalId | `{ agentName }` | `approvals.ts` |
| `approval.resubmitted` | info | `approval` | approvalId | `{ agentName }` | `approvals.ts` |

#### asset -- Fichiers

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `asset.uploaded` | info | `asset` | assetId | `{ filename, mimeType, size }` | `assets.ts` |

#### company -- Configuration

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `company.created` | info | `company` | companyId | `{ name }` | `companies.ts` |
| `company.updated` | info | `company` | companyId | `{ changedFields }` | `companies.ts` |
| `company.archived` | warning | `company` | companyId | `{ name }` | `companies.ts` |
| `company.deleted` | critical | `company` | companyId | `{ name }` | `companies.ts` |
| `company.exported` | info | `company` | companyId | `{ format }` | `companies.ts` |
| `company.imported` | info | `company` | companyId | `{ source }` | `companies.ts` |

#### cost -- Budgets et couts

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `cost.budget_updated` | info | `company` | companyId | `{ budgetField, newValue }` | `costs.ts` |
| `cost.agent_budget_updated` | info | `agent` | agentId | `{ budgetField, newValue }` | `costs.ts` |

#### goal -- Objectifs

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `goal.created` | info | `project` | goalId | `{ title }` | `goals.ts` |
| `goal.updated` | info | `project` | goalId | `{ changedFields }` | `goals.ts` |
| `goal.deleted` | info | `project` | goalId | `{ title }` | `goals.ts` |

#### issue -- Stories/Issues

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `issue.created` | info | `issue` | issueId | `{ title, projectId }` | `issues.ts` |
| `issue.updated` | info | `issue` | issueId | `{ changedFields }` | `issues.ts` |
| `issue.deleted` | warning | `issue` | issueId | `{ title }` | `issues.ts` |
| `issue.checked_out` | info | `issue` | issueId | `{ agentId }` | `issues.ts` |
| `issue.released` | info | `issue` | issueId | `{ agentId }` | `issues.ts` |
| `issue.label_created` | info | `issue` | labelId | `{ name }` | `issues.ts` |
| `issue.label_deleted` | info | `issue` | labelId | `{ name }` | `issues.ts` |
| `issue.attachment_added` | info | `issue` | issueId | `{ filename }` | `issues.ts` |
| `issue.attachment_deleted` | info | `issue` | attachmentId | `{ filename }` | `issues.ts` |

#### orchestrator -- Orchestration

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `orchestrator.stage_transitioned` | info | `stage` | stageId | `{ event, fromState, toState }` | `orchestrator.ts` |
| `orchestrator.stage_approved` | info | `stage` | stageId | `{ approvedBy }` | `orchestrator.ts` |
| `orchestrator.stage_rejected` | info | `stage` | stageId | `{ rejectedBy, feedback }` | `orchestrator.ts` |

#### project -- Projets

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `project.created` | info | `project` | projectId | `{ name }` | `projects.ts` |
| `project.updated` | info | `project` | projectId | `{ changedFields }` | `projects.ts` |
| `project.deleted` | warning | `project` | projectId | `{ name }` | `projects.ts` |
| `project.workspace_created` | info | `project` | projectId | `{ workspacePath }` | `projects.ts` |
| `project.workspace_updated` | info | `project` | projectId | `{ workspaceId }` | `projects.ts` |
| `project.workspace_deleted` | info | `project` | projectId | `{ workspaceId }` | `projects.ts` |
| `project.onboarded` | info | `project` | projectId | `{}` | `projects.ts` |

#### project_membership -- Membres de projets

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `project_membership.added` | info | `project` | projectId | `{ userId, role }` | `project-memberships.ts` |
| `project_membership.updated` | info | `project` | membershipId | `{ oldRole, newRole }` | `project-memberships.ts` |
| `project_membership.removed` | info | `project` | membershipId | `{ userId }` | `project-memberships.ts` |

#### secret -- Secrets & Credentials

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `secret.created` | info | `secret` | secretId | `{ name, provider }` | `secrets.ts` |
| `secret.rotated` | info | `secret` | secretId | `{ name }` | `secrets.ts` |
| `secret.updated` | info | `secret` | secretId | `{ name }` | `secrets.ts` |
| `secret.deleted` | warning | `secret` | secretId | `{ name }` | `secrets.ts` |

#### stage -- Etapes

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `stage.transitioned` | info | `stage` | stageId | `{ fromStatus, toStatus }` | `stages.ts` |

#### workflow -- Templates & Instances

| Action | Severity | targetType | targetId | Metadata | Route file |
|--------|----------|------------|----------|----------|------------|
| `workflow.template_created` | info | `workflow` | templateId | `{ name }` | `workflows.ts` |
| `workflow.template_updated` | info | `workflow` | templateId | `{ name }` | `workflows.ts` |
| `workflow.template_deleted` | warning | `workflow` | templateId | `{ name }` | `workflows.ts` |
| `workflow.instance_created` | info | `workflow` | instanceId | `{ templateName }` | `workflows.ts` |
| `workflow.instance_updated` | info | `workflow` | instanceId | `{ changedFields }` | `workflows.ts` |
| `workflow.instance_deleted` | warning | `workflow` | instanceId | `{ name }` | `workflows.ts` |

---

## Fichiers a creer

### 1. `server/src/services/audit-emitter.ts` (NOUVEAU)

Helper central pour l'emission d'audit depuis les routes.

```typescript
import type { Request } from "express";
import type { Db } from "@mnm/db";
import type { AuditSeverity } from "@mnm/shared";
import { auditService } from "./audit.js";

export interface EmitAuditParams {
  req: Request;
  db: Db;
  companyId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
  severity?: AuditSeverity;
}

/**
 * Emit an immutable audit event from a route handler.
 * Extracts actor info from req.actor, IP from req, user-agent from headers.
 * Non-blocking: errors are logged but do not fail the request.
 */
export async function emitAudit(params: EmitAuditParams): Promise<void> {
  const { req, db, companyId, action, targetType, targetId, metadata, severity } = params;

  try {
    const svc = auditService(db);

    const actorType = req.actor.type === "agent" ? "agent" as const
      : req.actor.type === "board" ? "user" as const
      : "system" as const;

    const actorId = req.actor.type === "agent"
      ? (req.actor.agentId ?? "unknown-agent")
      : req.actor.type === "board"
        ? (req.actor.userId ?? "unknown-user")
        : "system";

    await svc.emit({
      companyId,
      actorId,
      actorType,
      action,
      targetType,
      targetId,
      metadata: metadata ?? null,
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
      userAgent: req.get("user-agent") ?? null,
      severity: severity ?? "info",
    });
  } catch (err) {
    // Audit emission must NEVER fail the business operation.
    // Log the error but do not rethrow.
    console.error("[audit-emitter] Failed to emit audit event:", action, err);
  }
}
```

**Decisions cles** :
- `try/catch` autour de l'emission : l'audit ne doit JAMAIS bloquer la requete metier
- Extraction automatique de `actorType` et `actorId` depuis `req.actor`
- Extraction `ipAddress` et `userAgent` depuis la requete HTTP

### 2. Export dans `server/src/services/index.ts`

Ajouter l'export :

```typescript
export { emitAudit } from "./audit-emitter.js";
```

---

## Fichiers a modifier

### 3. `server/src/middleware/require-permission.ts` -- Emission `access.denied`

**Modification** : Avant de `throw forbidden(...)`, emettre un audit event `access.denied`.

Dans la fonction `requirePermission()` (2 endroits : acteur board et acteur agent) et dans `assertCompanyPermission()` (2 endroits egalement), ajouter l'emission avant le throw.

**Pattern** :

```typescript
// AVANT le throw forbidden:
// Non-blocking: fire-and-forget audit emission
auditService(db).emit({
  companyId,
  actorId: userId ?? agentId ?? "unknown",
  actorType: req.actor.type === "agent" ? "agent" : "user",
  action: "access.denied",
  targetType: "permission",
  targetId: permissionKey,
  metadata: {
    route: `${req.method} ${req.originalUrl}`,
    resourceScope: resourceScope ?? null,
  },
  ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
  userAgent: req.get("user-agent") ?? null,
  severity: "warning",
}).catch(() => { /* audit must never block */ });
```

**Important** : Utiliser `.catch()` (fire-and-forget) car l'audit ne doit pas bloquer le flux d'erreur 403.

### 4-20. Routes -- Integration `emitAudit()`

Pour chaque route file, ajouter `import { emitAudit } from "../services/index.js"` (ou `"../services/audit-emitter.js"`) et appeler `emitAudit()` apres chaque mutation reussie.

Le pattern general est :

```typescript
// APRES la mutation reussie, AVANT le res.json()
await emitAudit({
  req,
  db,
  companyId,
  action: "domain.action",
  targetType: "entity",
  targetId: entity.id,
  metadata: { /* pertinent context */ },
  severity: "info", // ou "warning"/"critical" pour deletions
});
```

---

## Plan d'integration par fichier

### Phase 1 -- Middleware + Helper (0.5j)

| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `server/src/services/audit-emitter.ts` | CREER -- helper `emitAudit()` |
| 2 | `server/src/services/index.ts` | MODIFIER -- ajouter export `emitAudit` |
| 3 | `server/src/middleware/require-permission.ts` | MODIFIER -- emettre `access.denied` via `auditService.emit()` (4 points d'emission) |

### Phase 2 -- Routes critiques securite (1j)

| # | Fichier | Actions emises | Points d'emission |
|---|---------|---------------|-------------------|
| 4 | `server/src/routes/secrets.ts` | `secret.created`, `secret.rotated`, `secret.updated`, `secret.deleted` | 4 |
| 5 | `server/src/routes/access.ts` | `access.invite_created`, `access.invite_accepted`, `access.join_request_approved`, `access.join_request_rejected`, `access.member_permissions_updated`, `access.member_role_changed`, `access.member_removed` | 7+ |
| 6 | `server/src/routes/companies.ts` | `company.created`, `company.updated`, `company.archived`, `company.deleted`, `company.exported`, `company.imported` | 6 |

### Phase 3 -- Routes agents et workflow (1j)

| # | Fichier | Actions emises | Points d'emission |
|---|---------|---------------|-------------------|
| 7 | `server/src/routes/agents.ts` | `agent.created`, `agent.hired`, `agent.updated`, `agent.deleted`, `agent.woken`, `agent.permissions_changed`, `agent.instructions_changed`, `agent.config_rollback`, `agent.session_reset`, `agent.key_created`, `agent.claude_login` | 11+ |
| 8 | `server/src/routes/approvals.ts` | `approval.created`, `approval.approved`, `approval.rejected`, `approval.revision_requested`, `approval.resubmitted` | 5 |
| 9 | `server/src/routes/workflows.ts` | `workflow.template_created`, `workflow.template_updated`, `workflow.template_deleted`, `workflow.instance_created`, `workflow.instance_updated`, `workflow.instance_deleted` | 6 |

### Phase 4 -- Routes applicatives (1j)

| # | Fichier | Actions emises | Points d'emission |
|---|---------|---------------|-------------------|
| 10 | `server/src/routes/issues.ts` | `issue.created`, `issue.updated`, `issue.deleted`, `issue.checked_out`, `issue.released`, `issue.label_created`, `issue.label_deleted`, `issue.attachment_added`, `issue.attachment_deleted` | 9 |
| 11 | `server/src/routes/projects.ts` | `project.created`, `project.updated`, `project.deleted`, `project.workspace_created`, `project.workspace_updated`, `project.workspace_deleted`, `project.onboarded` | 7 |
| 12 | `server/src/routes/goals.ts` | `goal.created`, `goal.updated`, `goal.deleted` | 3 |
| 13 | `server/src/routes/costs.ts` | `cost.budget_updated`, `cost.agent_budget_updated` | 2 |
| 14 | `server/src/routes/stages.ts` | `stage.transitioned` | 1 |
| 15 | `server/src/routes/orchestrator.ts` | `orchestrator.stage_transitioned`, `orchestrator.stage_approved`, `orchestrator.stage_rejected` | 3 |
| 16 | `server/src/routes/project-memberships.ts` | `project_membership.added`, `project_membership.updated`, `project_membership.removed` | 3 |
| 17 | `server/src/routes/assets.ts` | `asset.uploaded` | 1 |

### Phase 5 -- Mise a jour du catalogue d'actions partage (0.5j)

| # | Fichier | Modification |
|---|---------|-------------|
| 18 | `packages/shared/src/types/audit.ts` | MODIFIER -- ajouter toutes les nouvelles actions au `AUDIT_ACTIONS` array |

---

## Details d'integration par fichier route

### `secrets.ts` -- 4 points d'emission

```typescript
// POST /companies/:companyId/secrets → apres svc.create()
await emitAudit({
  req, db, companyId,
  action: "secret.created",
  targetType: "secret",
  targetId: created.id,
  metadata: { name: created.name, provider: created.provider },
});

// POST /secrets/:id/rotate → apres svc.rotate()
await emitAudit({
  req, db, companyId: existing.companyId,
  action: "secret.rotated",
  targetType: "secret",
  targetId: id,
  metadata: { name: existing.name },
});

// PATCH /secrets/:id → apres svc.update()
await emitAudit({
  req, db, companyId: existing.companyId,
  action: "secret.updated",
  targetType: "secret",
  targetId: id,
  metadata: { name: existing.name },
});

// DELETE /secrets/:id → apres svc.delete()
await emitAudit({
  req, db, companyId: existing.companyId,
  action: "secret.deleted",
  targetType: "secret",
  targetId: id,
  metadata: { name: existing.name },
  severity: "warning",
});
```

### `agents.ts` -- 11+ points d'emission

Placer `emitAudit()` apres chaque `logActivity()` existant. Les actions :

- `POST /companies/:companyId/agents` → `agent.created`
- `POST /companies/:companyId/agent-hires` → `agent.hired`
- `PATCH /agents/:id` → `agent.updated`
- `DELETE /agents/:id` → `agent.deleted` (severity: warning)
- `POST /agents/:id/wake` → `agent.woken`
- `PATCH /agents/:id/permissions` → `agent.permissions_changed`
- `PATCH /agents/:id/instructions-path` → `agent.instructions_changed`
- `POST /agents/:id/config-revisions/:revId/rollback` → `agent.config_rollback`
- `POST /agents/:id/runtime-state/reset-session` → `agent.session_reset`
- `POST /agents/:id/keys` → `agent.key_created`
- `POST /agents/:id/claude-login` → `agent.claude_login`

### `companies.ts` -- 6 points d'emission

- `POST /` → `company.created`
- `PATCH /:companyId` → `company.updated`
- `POST /:companyId/archive` → `company.archived` (severity: warning)
- `DELETE /:companyId` → `company.deleted` (severity: critical)
- `POST /:companyId/export` → `company.exported`
- `POST /import` → `company.imported`

### `access.ts` -- 7+ points d'emission

Les routes dans `access.ts` qui gerent les invitations et la gestion des membres sont critiques. Placer `emitAudit()` apres chaque `logActivity()` existant :

- `POST /companies/:companyId/invites` → `access.invite_created`
- Accept invite flow → `access.invite_accepted`
- `POST /join-requests/:id/approve` → `access.join_request_approved`
- `POST /join-requests/:id/reject` → `access.join_request_rejected`
- `PATCH /memberships/:id/permissions` → `access.member_permissions_updated`
- `PATCH /memberships/:id/business-role` → `access.member_role_changed`
- `DELETE /memberships/:id` → `access.member_removed` (severity: warning)

### `issues.ts` -- 9 points d'emission

- `POST /companies/:companyId/issues` → `issue.created`
- `PATCH /issues/:id` → `issue.updated`
- `DELETE /issues/:id` → `issue.deleted` (severity: warning)
- `POST /issues/:id/checkout` → `issue.checked_out`
- `POST /issues/:id/release` → `issue.released`
- `POST /companies/:companyId/labels` → `issue.label_created`
- `DELETE /labels/:labelId` → `issue.label_deleted`
- `POST /companies/:companyId/issues/:issueId/attachments` → `issue.attachment_added`
- `DELETE /attachments/:attachmentId` → `issue.attachment_deleted`

### `projects.ts` -- 7 points d'emission

- `POST /companies/:companyId/projects` → `project.created`
- `PATCH /projects/:id` → `project.updated`
- `DELETE /projects/:id` → `project.deleted` (severity: warning)
- `POST /projects/:id/workspaces` → `project.workspace_created`
- `PATCH /projects/:id/workspaces/:wId` → `project.workspace_updated`
- `DELETE /projects/:id/workspaces/:wId` → `project.workspace_deleted`
- `POST /projects/:id/onboard` → `project.onboarded`

### `workflows.ts` -- 6 points d'emission

- `POST /companies/:companyId/workflow-templates` → `workflow.template_created`
- `PATCH /workflow-templates/:id` → `workflow.template_updated`
- `DELETE /workflow-templates/:id` → `workflow.template_deleted` (severity: warning)
- `POST /companies/:companyId/workflows` → `workflow.instance_created`
- `PATCH /workflows/:id` → `workflow.instance_updated`
- `DELETE /workflows/:id` → `workflow.instance_deleted` (severity: warning)

### `approvals.ts` -- 5 points d'emission

- `POST /companies/:companyId/approvals` → `approval.created`
- `POST /approvals/:id/approve` → `approval.approved`
- `POST /approvals/:id/reject` → `approval.rejected`
- `POST /approvals/:id/request-revision` → `approval.revision_requested`
- `POST /approvals/:id/resubmit` → `approval.resubmitted`

### `goals.ts` -- 3 points d'emission

- `POST /companies/:companyId/goals` → `goal.created`
- `PATCH /goals/:id` → `goal.updated`
- `DELETE /goals/:id` → `goal.deleted`

### `costs.ts` -- 2 points d'emission

- `PATCH /companies/:companyId/budgets` → `cost.budget_updated`
- `PATCH /agents/:agentId/budgets` → `cost.agent_budget_updated`

### `stages.ts` -- 1 point d'emission

- `POST /stages/:id/transition` → `stage.transitioned`

### `orchestrator.ts` -- 3 points d'emission

- `POST .../transition` → `orchestrator.stage_transitioned`
- `POST .../approve` → `orchestrator.stage_approved`
- `POST .../reject` → `orchestrator.stage_rejected`

### `project-memberships.ts` -- 3 points d'emission

- `POST /companies/:companyId/project-memberships` → `project_membership.added`
- `PATCH /project-memberships/:id` → `project_membership.updated`
- `DELETE /project-memberships/:id` → `project_membership.removed`

### `assets.ts` -- 1 point d'emission

- `POST /companies/:companyId/assets/images` → `asset.uploaded`

---

## Mise a jour `packages/shared/src/types/audit.ts`

Ajouter toutes les nouvelles actions au tableau `AUDIT_ACTIONS` pour typage strict :

```typescript
export const AUDIT_ACTIONS = [
  // Access & auth
  "access.denied", "access.scope_denied", "access.login", "access.logout",
  "access.invite_created", "access.invite_accepted",
  "access.join_request_approved", "access.join_request_rejected",
  "access.member_permissions_updated", "access.member_role_changed", "access.member_removed",
  // Agent lifecycle
  "agent.created", "agent.hired", "agent.updated", "agent.deleted",
  "agent.woken", "agent.permissions_changed", "agent.instructions_changed",
  "agent.config_rollback", "agent.session_reset", "agent.key_created", "agent.claude_login",
  // Approval
  "approval.created", "approval.approved", "approval.rejected",
  "approval.revision_requested", "approval.resubmitted",
  // Asset
  "asset.uploaded",
  // Company
  "company.created", "company.updated", "company.archived", "company.deleted",
  "company.exported", "company.imported", "company.config_change",
  // Cost
  "cost.budget_updated", "cost.agent_budget_updated",
  // Goal
  "goal.created", "goal.updated", "goal.deleted",
  // Issue
  "issue.created", "issue.updated", "issue.deleted",
  "issue.checked_out", "issue.released",
  "issue.label_created", "issue.label_deleted",
  "issue.attachment_added", "issue.attachment_deleted",
  // Member management
  "members.invite", "members.remove", "members.role_changed", "members.status_changed",
  // Orchestrator
  "orchestrator.stage_transitioned", "orchestrator.stage_approved", "orchestrator.stage_rejected",
  // Project
  "project.created", "project.updated", "project.deleted",
  "project.workspace_created", "project.workspace_updated", "project.workspace_deleted",
  "project.onboarded",
  "project.member_added", "project.member_removed", "project.member_role_changed",
  // Project membership
  "project_membership.added", "project_membership.updated", "project_membership.removed",
  // Secret
  "secret.created", "secret.rotated", "secret.updated", "secret.deleted",
  // Stage
  "stage.transitioned",
  // Workflow
  "workflow.template_created", "workflow.template_updated", "workflow.template_deleted",
  "workflow.instance_created", "workflow.instance_updated", "workflow.instance_deleted",
  "workflow.created", "workflow.transition", "workflow.transition_denied",
  // Container (already present, kept for forward-compat)
  "container.created", "container.stopped", "container.killed",
  // Security
  "security.path_traversal", "security.credential_access", "security.rate_limited",
] as const;
```

---

## data-test-id

Cette story est backend-only. Les `data-testid` sont destines au test E2E Playwright qui valide l'emission d'audit via les API.

| data-testid | Usage | Description |
|-------------|-------|-------------|
| `obs-s02-audit-event-row` | E2E test helper | Verification qu'un audit event a ete cree apres une mutation |
| `obs-s02-access-denied-audit` | E2E test helper | Verification qu'un access.denied produit un audit event immutable |
| `obs-s02-severity-badge` | E2E test helper (future OBS-S04 UI) | Badge de severite dans le log d'audit |

Note : Ces data-testid seront principalement utilises par les tests E2E pour verifier l'integration via l'API `GET /api/companies/:companyId/audit`.

---

## Acceptance Criteria

### AC1 -- Mutation agent emet un audit event

```gherkin
Given un Admin qui cree un agent via POST /api/companies/:companyId/agents
When la requete reussit (HTTP 201)
Then un audit_event est cree dans la table audit_events
  And action = "agent.created"
  And targetType = "agent"
  And targetId = l'ID du nouvel agent
  And actorType = "user"
  And actorId = l'ID de l'Admin
  And companyId = le companyId de la requete
  And metadata contient { name, adapterType }
  And severity = "info"
  And ipAddress est renseigne
```

### AC2 -- Deletion emet un audit event avec severity warning

```gherkin
Given un Admin qui supprime un agent via DELETE /api/agents/:id
When la requete reussit (HTTP 200)
Then un audit_event est cree avec action = "agent.deleted"
  And severity = "warning"
  And metadata contient { name }
```

### AC3 -- access.denied emet un audit event immutable

```gherkin
Given un Viewer qui tente POST /api/companies/:companyId/agents
When la requete echoue (HTTP 403)
Then un audit_event est cree dans audit_events
  And action = "access.denied"
  And targetType = "permission"
  And targetId = "agents:create"
  And severity = "warning"
  And metadata contient { route: "POST /api/companies/.../agents" }
```

### AC4 -- Suppression critique emet severity critical

```gherkin
Given un Admin qui supprime une company via DELETE /api/companies/:companyId
When la requete reussit
Then un audit_event est cree avec action = "company.deleted"
  And severity = "critical"
```

### AC5 -- Emission non-bloquante

```gherkin
Given le service audit qui echoue temporairement (ex: DB timeout)
When une mutation metier est executee
Then la mutation reussit quand meme (HTTP 2xx)
  And l'erreur d'audit est loguee dans la console
  And la reponse n'est pas affectee
```

### AC6 -- Secret operations emettent un audit event

```gherkin
Given un Admin qui cree un secret via POST /api/companies/:companyId/secrets
When la requete reussit
Then un audit_event est cree avec action = "secret.created"
  And targetType = "secret"
  And metadata contient { name, provider }
  And metadata NE contient PAS la valeur du secret
```

### AC7 -- Audit event contient ipAddress et userAgent

```gherkin
Given une requete HTTP avec header User-Agent
When un audit_event est emis
Then ipAddress contient l'IP du client
  And userAgent contient le header User-Agent de la requete
```

### AC8 -- Toutes les mutations critiques sont couvertes

```gherkin
Given les 17 fichiers routes du serveur
When toutes les routes mutantes (POST/PATCH/DELETE) sont inventoriees
Then chaque route mutante qui a un logActivity() a aussi un emitAudit()
  And le nombre total de points d'emission est >= 68
```

### AC9 -- Member management emet un audit event

```gherkin
Given un Admin qui invite un membre via POST /api/companies/:companyId/invites
When la requete reussit
Then un audit_event est cree avec action = "access.invite_created"
  And targetType = "invite"
  And metadata contient { email, businessRole }
```

### AC10 -- Le catalogue AUDIT_ACTIONS est a jour

```gherkin
Given le fichier packages/shared/src/types/audit.ts
When on verifie le tableau AUDIT_ACTIONS
Then il contient au minimum 45 actions distinctes
  And chaque action emise par emitAudit() est presente dans le catalogue
```

### AC11 -- Workflow mutations emettent des audit events

```gherkin
Given un Admin qui cree un workflow template
When la requete reussit
Then un audit_event est cree avec action = "workflow.template_created"
  And targetType = "workflow"
  And metadata contient { name }
```

### AC12 -- logActivity() n'est pas supprime

```gherkin
Given les appels logActivity() existants
When emitAudit() est ajoute a cote
Then logActivity() est conserve (coexistence)
  And les deux systemes ecrivent en parallele
```

---

## Regles d'implementation

1. **Non-bloquant** : `emitAudit()` est wrappe dans un try/catch. L'audit ne doit JAMAIS faire echouer une requete metier.
2. **Coexistence** : `logActivity()` est conserve. Les deux systemes coexistent. La migration se fera plus tard.
3. **Pas de secrets dans metadata** : Les valeurs de secrets, tokens, mots de passe ne doivent JAMAIS apparaitre dans les metadata d'audit.
4. **Severity coherente** : `info` pour les creations/mises a jour, `warning` pour les suppressions et les acces refuses, `critical` pour les operations destructives irrecuperables (delete company).
5. **Placement** : Appeler `emitAudit()` APRES la mutation reussie et APRES `logActivity()`, juste avant le `res.json()` ou `res.status().json()`.
6. **Pattern pour access.denied** : Utiliser `.catch(() => {})` (fire-and-forget) dans le middleware car le throw suit immediatement.

---

## Fichiers impactes -- Resume

| Fichier | Action | Points d'emission |
|---------|--------|-------------------|
| `server/src/services/audit-emitter.ts` | CREER | helper central |
| `server/src/services/index.ts` | MODIFIER | export emitAudit |
| `server/src/middleware/require-permission.ts` | MODIFIER | 4 (2 dans requirePermission, 2 dans assertCompanyPermission) |
| `server/src/routes/secrets.ts` | MODIFIER | 4 |
| `server/src/routes/access.ts` | MODIFIER | 7+ |
| `server/src/routes/companies.ts` | MODIFIER | 6 |
| `server/src/routes/agents.ts` | MODIFIER | 11+ |
| `server/src/routes/approvals.ts` | MODIFIER | 5 |
| `server/src/routes/workflows.ts` | MODIFIER | 6 |
| `server/src/routes/issues.ts` | MODIFIER | 9 |
| `server/src/routes/projects.ts` | MODIFIER | 7 |
| `server/src/routes/goals.ts` | MODIFIER | 3 |
| `server/src/routes/costs.ts` | MODIFIER | 2 |
| `server/src/routes/stages.ts` | MODIFIER | 1 |
| `server/src/routes/orchestrator.ts` | MODIFIER | 3 |
| `server/src/routes/project-memberships.ts` | MODIFIER | 3 |
| `server/src/routes/assets.ts` | MODIFIER | 1 |
| `packages/shared/src/types/audit.ts` | MODIFIER | catalogue AUDIT_ACTIONS etendu |
| **TOTAL** | | **72+ points d'emission** |

---

## Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Performance : 72+ INSERT supplementaires par requete | Moyen | L'INSERT est rapide (une seule table, un index). Le try/catch evite les timeouts. Future optimisation : batch via queue Redis. |
| Hash chain ralentie (lecture du dernier event) | Moyen | L'index `auditEvents.companyId + createdAt DESC` est deja en place (OBS-S01). Si bottleneck, cacher le lastHash en Redis. |
| Regression si emitAudit() lance une exception | Critique | Le try/catch dans `emitAudit()` garantit que l'erreur est capturee et loguee. La requete metier n'est JAMAIS affectee. |
| `access.ts` est un fichier de 2800+ lignes | Moyen | Ajouter les `emitAudit()` a cote des `logActivity()` existants, meme pattern. Pas de refactoring de structure. |
| Doublon activity_log + audit_events | Faible | C'est voulu (coexistence). `activity_log` sera deprecie dans une future story. |

---

## Tests E2E Playwright (QA Agent)

Les tests doivent couvrir :

1. **Pour chaque domaine** (agent, secret, company, issue, project, workflow, approval, member, orchestrator) : tester qu'une mutation produit un audit event verifiable via `GET /api/companies/:companyId/audit?action=<action>`
2. **access.denied** : tester qu'un 403 produit un audit event `access.denied` dans la table immutable
3. **Non-bloquant** : tester que meme si l'audit echoue (simulation), la requete metier reussit
4. **severity** : verifier que les deletions ont `severity: "warning"` ou `"critical"`
5. **Pas de secrets dans metadata** : verifier que `secret.created` ne contient pas la valeur du secret
6. **ipAddress et userAgent** : verifier leur presence dans les audit events
7. **Coexistence** : verifier que `logActivity()` continue de fonctionner en parallele

Output attendu : `e2e/tests/OBS-S02.spec.ts`

---

## Definition of Done

- [ ] `audit-emitter.ts` cree avec helper `emitAudit()`
- [ ] `require-permission.ts` modifie pour emettre `access.denied` via audit immutable
- [ ] 17 fichiers routes integres avec emitAudit() (72+ points d'emission)
- [ ] `AUDIT_ACTIONS` dans shared mis a jour (45+ actions)
- [ ] Tous les tests existants passent (pas de regression)
- [ ] AC1-AC12 verifies
- [ ] `pnpm typecheck` passe
- [ ] `pnpm test:run` passe
