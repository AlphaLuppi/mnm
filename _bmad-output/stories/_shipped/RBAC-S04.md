# RBAC-S04 : Enforcement dans 22 Fichiers Routes -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | RBAC-S04 |
| **Titre** | Enforcement `requirePermission()` sur toutes les routes |
| **Epic** | Epic 2 -- RBAC & Permissions |
| **Sprint** | Sprint 2 (Phase 2) |
| **Effort** | L (8 SP, 5-7j) |
| **Priorite** | P0 SECURITE |
| **Assignation** | Tom (routes critiques) + Cofondateur (reste) |
| **Bloque par** | RBAC-S01 (hasPermission + middleware), RBAC-S02 (20 permission keys) |
| **Debloque** | OBS-S02 (Service audit emission), RBAC-S05 (Navigation masquee) |
| **Type** | Backend (routes) + frontend (error display avec data-test-id) |

---

## Description

### Le probleme

Le middleware `requirePermission(db, permissionKey, extractScope?)` existe (`server/src/middleware/require-permission.ts`) mais n'est utilise sur **aucune route**. Les routes utilisent actuellement :

- `assertCompanyAccess()` -- verifie que l'acteur a acces a la company (multi-tenant isolation), **pas** les permissions granulaires
- `assertBoard()` -- verifie que l'acteur est un board user, **pas** la permission specifique
- Des helpers custom ad-hoc (`assertCanCreateAgentsForCompany`, `assertCanAssignTasks`, `assertCanRead`) qui dupliquent partiellement la logique de `requirePermission` sans la standardiser

### Ce que cette story fait

1. Ajouter `requirePermission(db, key)` comme middleware Express sur chaque route mutante (POST/PATCH/DELETE) et sur les routes de lecture sensibles
2. Uniformiser la reponse 403 pour inclure `{ error: "Missing permission: <key>", requiredPermission: "<key>" }`
3. Emettre un evenement d'audit `access.denied` (prepare pour OBS-S02)
4. Couvrir les 3 fichiers critiques sans aucun check RBAC : `approvals.ts`, `assets.ts`, `secrets.ts`

### Strategie de migration

Le middleware `requirePermission` **s'ajoute en complement** de `assertCompanyAccess` -- il ne le remplace pas. L'ordre est :

```
assertCompanyAccess(req, companyId)  // multi-tenant gate (garde existante)
requirePermission(db, "key")         // permission granulaire (NOUVEAU)
```

Pour les routes qui utilisent deja `assertBoard()`, on remplace `assertBoard()` par `requirePermission(db, "key")` car `requirePermission` couvre deja le cas "acteur non authentifie" et "acteur sans permission".

---

## Audit des Route Files -- Etat Actuel

### Legende

| Symbole | Signification |
|---------|---------------|
| `AC` | `assertCompanyAccess()` -- gate multi-tenant OK |
| `AB` | `assertBoard()` -- gate board-only, pas RBAC granulaire |
| `CUSTOM` | Helper custom avec logique de permission ad-hoc |
| `NONE` | Aucun check de permission |
| `RP` | `requirePermission()` -- a ajouter |

### Fichier par fichier

#### 1. `approvals.ts` -- CRITIQUE, 0 permission check RBAC

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /companies/:companyId/approvals` | GET | AC | lecture implicite | RP `joins:approve` (filtrer si viewer) |
| `GET /approvals/:id` | GET | AC | lecture implicite | Pas de RP (lecture autorisee pour tout membre company) |
| `POST /companies/:companyId/approvals` | POST | AC | mutation | RP `agents:create` (creer une approbation = proposer un hire) |
| `GET /approvals/:id/issues` | GET | AC | lecture | Pas de RP |
| `POST /approvals/:id/approve` | POST | AB | **mutation critique** | RP `joins:approve` |
| `POST /approvals/:id/reject` | POST | AB | **mutation critique** | RP `joins:approve` |
| `POST /approvals/:id/request-revision` | POST | AB | mutation | RP `joins:approve` |
| `POST /approvals/:id/resubmit` | POST | AC | mutation | Pas de RP (auto-resubmit par demandeur) |
| `GET /approvals/:id/comments` | GET | AC | lecture | Pas de RP |
| `POST /approvals/:id/comments` | POST | AC | mutation | Pas de RP (tout membre peut commenter) |

#### 2. `assets.ts` -- CRITIQUE, 0 permission check RBAC

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `POST /companies/:companyId/assets/images` | POST | AC | mutation fichier | RP `stories:create` (upload est lie a la creation de contenu) |
| `GET /assets/:assetId/content` | GET | AC | lecture | Pas de RP (lecture autorisee pour tout membre company) |

#### 3. `secrets.ts` -- CRITIQUE, gates `assertBoard` mais 0 RBAC

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /companies/:companyId/secret-providers` | GET | AB + AC | lecture config | RP `company:manage_settings` |
| `GET /companies/:companyId/secrets` | GET | AB + AC | lecture sensible | RP `company:manage_settings` |
| `POST /companies/:companyId/secrets` | POST | AB + AC | **mutation critique** | RP `company:manage_settings` |
| `POST /secrets/:id/rotate` | POST | AB + AC | **mutation critique** | RP `company:manage_settings` |
| `PATCH /secrets/:id` | PATCH | AB + AC | mutation | RP `company:manage_settings` |
| `DELETE /secrets/:id` | DELETE | AB + AC | **mutation critique** | RP `company:manage_settings` |

#### 4. `agents.ts` -- Partiellement protege via helpers custom

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /companies/:companyId/agents` | GET | AC | lecture | Pas de RP (liste autorisee) |
| `GET /companies/:companyId/org` | GET | AC | lecture | Pas de RP |
| `GET /companies/:companyId/agent-configurations` | GET | CUSTOM | lecture config | Deja protege via `assertCanReadConfigurations` -- a migrer vers RP `agents:create` |
| `GET /agents/me` | GET | Agent auth | self-read | Pas de RP |
| `GET /agents/:id` | GET | AC | lecture | Pas de RP |
| `GET /agents/:id/configuration` | GET | CUSTOM | lecture config | Deja protege -- a migrer |
| `GET /agents/:id/config-revisions` | GET | CUSTOM | lecture config | Deja protege -- a migrer |
| `POST /agents/:id/config-revisions/:revId/rollback` | POST | CUSTOM | mutation | RP `agents:create` |
| `GET /agents/:id/runtime-state` | GET | AB + AC | lecture | RP `agents:launch` |
| `GET /agents/:id/task-sessions` | GET | AB + AC | lecture | RP `agents:launch` |
| `POST /agents/:id/runtime-state/reset-session` | POST | AB + AC | mutation | RP `agents:launch` |
| `POST /companies/:companyId/agent-hires` | POST | CUSTOM | **mutation critique** | Deja protege via `assertCanCreateAgentsForCompany` -- a migrer vers RP `agents:create` |
| `POST /companies/:companyId/agents` | POST | CUSTOM | **mutation critique** | Deja protege -- a migrer vers RP `agents:create` |
| `PATCH /agents/:id` | PATCH | CUSTOM | mutation | Deja protege via `assertCanUpdateAgent` -- a migrer |
| `POST /agents/:id/wake` | POST | AC | mutation | RP `agents:launch` |
| `DELETE /agents/:id` | DELETE | CUSTOM | **mutation critique** | Deja protege -- a migrer vers RP `agents:create` |
| `PATCH /agents/:id/permissions` | PATCH | CUSTOM | mutation admin | RP `users:manage_permissions` |
| `PATCH /agents/:id/instructions-path` | PATCH | CUSTOM | mutation | Deja protege |
| `POST /agents/:id/claude-login` | POST | CUSTOM | mutation | RP `agents:create` |
| Adapter model + test routes | GET/POST | AC/CUSTOM | lecture | RP `agents:create` |
| `POST /agents/:id/keys` | POST | AB | mutation clef | RP `agents:create` |

#### 5. `projects.ts` -- Pas de RBAC granulaire

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /companies/:companyId/projects` | GET | AC | lecture | Pas de RP |
| `GET /projects/:id` | GET | AC | lecture | Pas de RP |
| `POST /companies/:companyId/projects` | POST | AC | mutation | RP `projects:create` |
| `PATCH /projects/:id` | PATCH | AC | mutation | RP `projects:create` |
| `POST /projects/:id/onboard` | POST | AC | mutation | RP `projects:create` |
| `GET /projects/:id/workspaces` | GET | AC | lecture | Pas de RP |
| `POST /projects/:id/workspaces` | POST | AC | mutation | RP `projects:create` |
| `PATCH /projects/:id/workspaces/:wId` | PATCH | AC | mutation | RP `projects:create` |
| `DELETE /projects/:id/workspaces/:wId` | DELETE | AC | mutation | RP `projects:create` |
| `DELETE /projects/:id` | DELETE | AC | **mutation critique** | RP `projects:create` |

#### 6. `issues.ts` -- Partiellement protege

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /companies/:companyId/issues` | GET | AC | lecture | Pas de RP |
| `GET /companies/:companyId/labels` | GET | AC | lecture | Pas de RP |
| `POST /companies/:companyId/labels` | POST | AC | mutation | RP `stories:create` |
| `DELETE /labels/:labelId` | DELETE | AC | mutation | RP `stories:create` |
| `GET /issues/:id` | GET | AC | lecture | Pas de RP |
| `POST /issues/:id/read` | POST | Board auth | mutation | Pas de RP (self-action) |
| `GET /issues/:id/approvals` | GET | AC | lecture | Pas de RP |
| `POST /issues/:id/approvals` | POST | CUSTOM | mutation | Deja protege (custom helper) |
| `DELETE /issues/:id/approvals/:approvalId` | DELETE | CUSTOM | mutation | Deja protege |
| `POST /companies/:companyId/issues` | POST | AC + CUSTOM assign | mutation | RP `stories:create` |
| `PATCH /issues/:id` | PATCH | AC + CUSTOM assign | mutation | RP `stories:edit` |
| `DELETE /issues/:id` | DELETE | AC | **mutation critique** | RP `stories:create` |
| `POST /issues/:id/checkout` | POST | AC | mutation | RP `tasks:assign` |
| `POST /issues/:id/release` | POST | AC | mutation | Pas de RP (self-release) |
| `GET /issues/:id/comments` | GET | AC | lecture | Pas de RP |
| `GET /issues/:id/comments/:commentId` | GET | AC | lecture | Pas de RP |
| `POST /issues/:id/comments` | POST | AC | mutation | Pas de RP (tout membre peut commenter) |
| `GET /issues/:id/attachments` | GET | AC | lecture | Pas de RP |
| `POST /companies/:companyId/issues/:issueId/attachments` | POST | AC | mutation | RP `stories:edit` |
| `GET /attachments/:attachmentId/content` | GET | AC | lecture | Pas de RP |
| `DELETE /attachments/:attachmentId` | DELETE | AC | mutation | RP `stories:edit` |

#### 7. `goals.ts` -- Aucun RBAC

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /companies/:companyId/goals` | GET | AC | lecture | Pas de RP |
| `GET /goals/:id` | GET | AC | lecture | Pas de RP |
| `POST /companies/:companyId/goals` | POST | AC | mutation | RP `projects:create` |
| `PATCH /goals/:id` | PATCH | AC | mutation | RP `projects:create` |
| `DELETE /goals/:id` | DELETE | AC | mutation | RP `projects:create` |

#### 8. `costs.ts` -- Partiellement protege

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `POST /companies/:companyId/cost-events` | POST | AC + agent self-check | mutation | Pas de RP (agents rapportent leurs propres couts) |
| `GET /companies/:companyId/costs/summary` | GET | AC | lecture | RP `dashboard:view` |
| `GET /companies/:companyId/costs/by-agent` | GET | AC | lecture sensible | RP `dashboard:view` |
| `GET /companies/:companyId/costs/by-project` | GET | AC | lecture sensible | RP `dashboard:view` |
| `PATCH /companies/:companyId/budgets` | PATCH | AB | mutation | RP `company:manage_settings` |
| `PATCH /agents/:agentId/budgets` | PATCH | Agent self-check | mutation | RP `company:manage_settings` (si board/autre agent) |

#### 9. `activity.ts` -- Lecture audit

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /companies/:companyId/activity` | GET | AC | lecture audit | RP `audit:read` |
| `POST /companies/:companyId/activity` | POST | AB | mutation | RP `audit:read` (ecriture audit interne) |
| `GET /issues/:id/activity` | GET | AC | lecture | Pas de RP (lie a l'issue, pas audit global) |
| `GET /issues/:id/runs` | GET | AC | lecture | Pas de RP |
| `GET /heartbeat-runs/:runId/issues` | GET | NONE | lecture | Ajouter AC minimum |

#### 10. `dashboard.ts` -- Aucun RBAC

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /companies/:companyId/dashboard` | GET | AC | lecture | RP `dashboard:view` |

#### 11. `sidebar-badges.ts` -- Logique custom interne

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /companies/:companyId/sidebar-badges` | GET | AC + custom inline | lecture | Pas de RP (agrege pour le badge count) |
| `POST /companies/:companyId/inbox/dismiss` | POST | AC + userId check | mutation | Pas de RP (self-action) |

#### 12. `workflows.ts` -- Aucun RBAC

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /companies/:companyId/workflow-templates` | GET | AC | lecture | Pas de RP |
| `GET /workflow-templates/:id` | GET | AC | lecture | Pas de RP |
| `POST /companies/:companyId/workflow-templates` | POST | AC | mutation | RP `workflows:create` |
| `PATCH /workflow-templates/:id` | PATCH | AC | mutation | RP `workflows:create` |
| `DELETE /workflow-templates/:id` | DELETE | AC | mutation | RP `workflows:create` |
| `POST /companies/:companyId/workflow-templates/ensure-bmad` | POST | AC | mutation | RP `workflows:create` |
| `GET /companies/:companyId/workflows` | GET | AC | lecture | Pas de RP |
| `GET /workflows/:id` | GET | AC | lecture | Pas de RP |
| `POST /companies/:companyId/workflows` | POST | AC | mutation | RP `workflows:create` |
| `PATCH /workflows/:id` | PATCH | AC | mutation | RP `workflows:create` |
| `DELETE /workflows/:id` | DELETE | AC | mutation | RP `workflows:create` |

#### 13. `stages.ts` -- Aucun RBAC

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /stages/:id` | GET | AC | lecture | Pas de RP |
| `POST /stages/:id/transition` | POST | AC | mutation | RP `workflows:enforce` |
| `PATCH /stages/:id` | PATCH | AC | mutation | RP `workflows:create` |

#### 14. `workspace-context.ts` -- Aucun RBAC

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /projects/:id/workspace-context` | GET | AC | lecture | Pas de RP |
| `GET /projects/:id/workspace-context/workflows` | GET | AC | lecture | Pas de RP |
| `GET /projects/:id/workspace-context/agents` | GET | AC | lecture | Pas de RP |
| `POST /projects/:id/workspace-context/import-agents` | POST | AC | **mutation** | RP `agents:create` |
| `GET /projects/:id/workspace-context/assignments` | GET | AC | lecture | Pas de RP |
| `POST /projects/:id/workspace-context/assignments` | POST | AC | mutation | RP `projects:manage_members` |
| `GET /projects/:id/workspace-context/command` | GET | AC | lecture | Pas de RP |
| `POST /projects/:id/workspace-context/drift-check` | POST | AC | mutation | Pas de RP (analyse) |
| `GET /projects/:id/workspace-context/file` | GET | AC | lecture | Pas de RP |

#### 15. `drift.ts` -- Aucun RBAC

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `POST /projects/:id/drift/check` | POST | AC | mutation | Pas de RP (analyse) |
| `GET /projects/:id/drift/results` | GET | AC | lecture | Pas de RP |
| `POST /projects/:id/drift/scan` | POST | AC | mutation | Pas de RP (analyse) |
| `GET /projects/:id/drift/status` | GET | AC | lecture | Pas de RP |
| `DELETE /projects/:id/drift/scan` | DELETE | AC | mutation | Pas de RP (annulation scan) |
| `PATCH /projects/:id/drift/:driftId` | PATCH | AC | mutation | RP `projects:create` |

#### 16. `companies.ts` -- Protege par assertBoard

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /` | GET | AB | lecture | Pas de RP (liste companies autorisees) |
| `GET /stats` | GET | AB | lecture | RP `dashboard:view` |
| `GET /:companyId` | GET | AB + AC | lecture | Pas de RP |
| `POST /:companyId/export` | POST | AC | mutation | RP `company:manage_settings` |
| `POST /import/preview` | POST | AC/AB | lecture | Pas de RP |
| `POST /import` | POST | AC/AB | **mutation critique** | RP `company:manage_settings` |
| `POST /` | POST | AB + instance_admin | mutation | Pas de RP (deja instance_admin gate) |
| `PATCH /:companyId` | PATCH | AB + AC | mutation | RP `company:manage_settings` |
| `POST /:companyId/archive` | POST | AB + AC | **mutation critique** | RP `company:manage_settings` |
| `DELETE /:companyId` | DELETE | AB + AC | **mutation critique** | RP `company:manage_settings` |

#### 17. `access.ts` -- Gere les invitations et permissions

Les routes dans `access.ts` gerent les invitations, join requests, et la gestion des membres. Elles sont deja complexes avec beaucoup de logique d'autorisation specifique. Les routes mutantes cles :

| Route pattern | Permission requise | Action |
|---------------|-------------------|--------|
| `POST /companies/:companyId/invites` | `users:invite` | RP a ajouter |
| `POST /join-requests/:id/approve` | `joins:approve` | RP a ajouter |
| `POST /join-requests/:id/reject` | `joins:approve` | RP a ajouter |
| `PATCH /memberships/:id/permissions` | `users:manage_permissions` | RP a ajouter |
| `PATCH /memberships/:id/business-role` | `users:manage_permissions` | RP a ajouter |
| `DELETE /memberships/:id` | `users:manage_permissions` | RP a ajouter |
| Lecture-only routes | Pas de RP | Conserve AC seul |

#### 18. `llms.ts` -- Custom auth interne

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| All `/llms/*` routes | GET | CUSTOM (assertCanRead) | lecture | Pas de RP (logique deja adequate) |

#### 19. `health.ts` -- Route publique

| Route | HTTP | Guard actuel | Permission requise | Action |
|-------|------|--------------|--------------------|--------|
| `GET /` | GET | NONE | aucune | Pas de RP (route publique) |

---

## Modification du Middleware `requirePermission`

### Changement du format de reponse 403

Le middleware actuel (`server/src/middleware/require-permission.ts`) lance `forbidden("Missing permission: <key>")` qui produit `{ error: "Missing permission: <key>" }`. Pour cette story, on enrichit la reponse :

```typescript
// AVANT
throw forbidden(`Missing permission: ${permissionKey}`);

// APRES
throw forbidden(`Missing permission: ${permissionKey}`, {
  requiredPermission: permissionKey,
  companyId,
  resourceScope: resourceScope ?? null,
});
```

Grace au error handler existant (`server/src/middleware/error-handler.ts` L48-52), le `details` est automatiquement inclus dans la reponse JSON :

```json
{
  "error": "Missing permission: agents:launch",
  "details": {
    "requiredPermission": "agents:launch",
    "companyId": "...",
    "resourceScope": null
  }
}
```

### Evenement audit `access.denied`

Le middleware loggue deja via `logger.warn({ event: "access.scope_denied", ... })`. Pour preparer OBS-S02, on ajoute un champ `auditEvent: "access.denied"` au contexte de log :

```typescript
logger.warn({
  event: "access.denied",
  permissionKey,
  companyId,
  actorType: req.actor.type,
  userId: req.actor.type === "board" ? req.actor.userId : undefined,
  agentId: req.actor.type === "agent" ? req.actor.agentId : undefined,
  resourceScope: resourceScope ?? null,
  route: `${req.method} ${req.originalUrl}`,
}, `Permission denied: ${permissionKey}`);
```

---

## Plan d'Implementation par Priorite

### Phase 1 -- Routes critiques (Tom, 2j)

**Priorite P0 -- Fichiers sans aucun check RBAC et mutations sensibles**

1. **`secrets.ts`** -- Remplacer `assertBoard()` par `requirePermission(db, "company:manage_settings")`
2. **`approvals.ts`** -- Ajouter `requirePermission(db, "joins:approve")` sur approve/reject/revision
3. **`assets.ts`** -- Ajouter `requirePermission(db, "stories:create")` sur upload
4. **Modifier `require-permission.ts`** -- Enrichir le format de reponse 403

### Phase 2 -- Routes de gestion (Tom, 2j)

5. **`agents.ts`** -- Migrer les helpers custom vers `requirePermission` (les garder comme fallback si besoin de logique complexe type "CEO peut tout faire")
6. **`companies.ts`** -- Remplacer `assertBoard()` par `requirePermission(db, "company:manage_settings")` sur les mutations
7. **`access.ts`** -- Ajouter `requirePermission` sur invites, join approvals, permission management

### Phase 3 -- Routes applicatives (Cofondateur, 3j)

8. **`projects.ts`** -- Ajouter `requirePermission(db, "projects:create")` sur mutations
9. **`issues.ts`** -- Ajouter `requirePermission(db, "stories:create")` et `"stories:edit"` sur mutations
10. **`goals.ts`** -- Ajouter `requirePermission(db, "projects:create")` sur mutations
11. **`workflows.ts`** -- Ajouter `requirePermission(db, "workflows:create")` sur mutations
12. **`stages.ts`** -- Ajouter `requirePermission(db, "workflows:enforce")` sur transitions
13. **`costs.ts`** -- Ajouter `requirePermission(db, "dashboard:view")` sur lecture couts, `"company:manage_settings"` sur budgets
14. **`activity.ts`** -- Ajouter `requirePermission(db, "audit:read")` sur lecture activity
15. **`dashboard.ts`** -- Ajouter `requirePermission(db, "dashboard:view")`
16. **`workspace-context.ts`** -- Ajouter `requirePermission` sur import-agents et assignments
17. **`drift.ts`** -- Ajouter `requirePermission(db, "projects:create")` sur resolve drift

---

## Mapping Permission Key par Route File

| Fichier | Permission Keys utilisees | Routes protegees |
|---------|--------------------------|------------------|
| `secrets.ts` | `company:manage_settings` | 6 routes (toutes) |
| `approvals.ts` | `joins:approve`, `agents:create` | 4 routes mutantes |
| `assets.ts` | `stories:create` | 1 route (upload) |
| `agents.ts` | `agents:create`, `agents:launch`, `users:manage_permissions` | ~15 routes mutantes |
| `projects.ts` | `projects:create` | 6 routes mutantes |
| `issues.ts` | `stories:create`, `stories:edit`, `tasks:assign` | ~8 routes mutantes |
| `goals.ts` | `projects:create` | 3 routes mutantes |
| `workflows.ts` | `workflows:create` | 8 routes mutantes |
| `stages.ts` | `workflows:create`, `workflows:enforce` | 2 routes mutantes |
| `costs.ts` | `dashboard:view`, `company:manage_settings` | 5 routes |
| `activity.ts` | `audit:read` | 2 routes |
| `dashboard.ts` | `dashboard:view` | 1 route |
| `companies.ts` | `company:manage_settings`, `dashboard:view` | 6 routes mutantes |
| `access.ts` | `users:invite`, `joins:approve`, `users:manage_permissions` | ~6 routes mutantes |
| `workspace-context.ts` | `agents:create`, `projects:manage_members` | 2 routes mutantes |
| `drift.ts` | `projects:create` | 1 route (resolve) |

---

## Pattern d'Application du Middleware

### Pattern A -- Route avec companyId dans le path

```typescript
// AVANT
router.post("/companies/:companyId/secrets", validate(createSecretSchema), async (req, res) => {
  assertBoard(req);
  const companyId = req.params.companyId as string;
  assertCompanyAccess(req, companyId);
  // ...
});

// APRES
router.post(
  "/companies/:companyId/secrets",
  requirePermission(db, "company:manage_settings"),
  validate(createSecretSchema),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    // requirePermission a deja verifie companyId + permission
    // ...
  }
);
```

### Pattern B -- Route sans companyId dans le path (lookup entity first)

Pour les routes comme `PATCH /secrets/:id` ou `POST /approvals/:id/approve`, le `companyId` n'est pas dans le path. Le pattern est :

```typescript
// APRES -- option 1: extraire dans le handler (conserver assertBoard/AC inline)
router.post("/approvals/:id/approve", validate(resolveApprovalSchema), async (req, res) => {
  const id = req.params.id as string;
  const approval = await svc.getById(id);
  if (!approval) { res.status(404).json({ error: "Approval not found" }); return; }
  assertCompanyAccess(req, approval.companyId);
  // Check permission inline car companyId pas dans path
  const access = accessService(db);
  const actor = req.actor;
  // ... permission check ...
});
```

Pour ces cas, on cree un helper `assertPermissionForEntity()` :

```typescript
async function assertPermission(
  req: Request,
  companyId: string,
  permissionKey: PermissionKey,
) {
  // Reuse la logique du middleware mais appelable inline
}
```

### Pattern C -- Conserver les helpers custom quand la logique est complexe

Pour `assertCanCreateAgentsForCompany` dans `agents.ts`, la logique inclut un fallback vers `canCreateAgents(actorAgent)` (legacy JSON permissions). On conserve le helper mais on ajoute le `requirePermission` en amont pour les cas simples, et le helper comme fallback pour les agents.

---

## data-test-id -- Erreurs Frontend

Quand le frontend recoit une erreur 403 avec `requiredPermission`, il affiche un toast ou banner d'erreur. Les `data-testid` suivants sont requis sur le composant d'affichage :

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s04-permission-denied-toast` | Toast notification | Toast affiche lors d'un 403 avec requiredPermission |
| `rbac-s04-permission-denied-message` | Texte dans le toast | Message texte "Permission requise : X" |
| `rbac-s04-permission-denied-key` | Badge/chip dans le toast | La permission key manquante |
| `rbac-s04-403-error-banner` | Banniere inline (optionnel) | Banniere dans une page si l'API retourne 403 |

### Composant ErrorToast -- Enrichissement

Le composant existant de gestion d'erreurs API doit detecter `response.details.requiredPermission` et afficher un message specifique :

```tsx
{error.details?.requiredPermission && (
  <div data-testid="rbac-s04-permission-denied-toast">
    <span data-testid="rbac-s04-permission-denied-message">
      Permission requise
    </span>
    <code data-testid="rbac-s04-permission-denied-key">
      {error.details.requiredPermission}
    </code>
  </div>
)}
```

---

## Acceptance Criteria

### AC1 -- Viewer bloque sur mutation agents

```gherkin
Given un utilisateur avec businessRole "viewer" dans la company
When il envoie POST /api/companies/:companyId/agents avec un body valide
Then la reponse est HTTP 403
  And le body contient { error: "Missing permission: agents:create" }
  And le body contient details.requiredPermission = "agents:create"
  And aucune mutation n'est effectuee en base
```

### AC2 -- Viewer bloque sur secrets

```gherkin
Given un utilisateur avec businessRole "viewer" dans la company
When il envoie GET /api/companies/:companyId/secrets
Then la reponse est HTTP 403
  And le body contient details.requiredPermission = "company:manage_settings"
```

### AC3 -- Viewer bloque sur approve

```gherkin
Given un utilisateur avec businessRole "viewer" dans la company
When il envoie POST /api/approvals/:id/approve
Then la reponse est HTTP 403
  And le body contient details.requiredPermission = "joins:approve"
```

### AC4 -- Contributor autorise sur issues

```gherkin
Given un utilisateur avec businessRole "contributor" dans la company
When il envoie POST /api/companies/:companyId/issues avec un body valide
Then la reponse est HTTP 201
  And l'issue est creee en base
```

### AC5 -- Contributor bloque sur company settings

```gherkin
Given un utilisateur avec businessRole "contributor" dans la company
When il envoie PATCH /api/companies/:companyId avec { name: "New Name" }
Then la reponse est HTTP 403
  And le body contient details.requiredPermission = "company:manage_settings"
```

### AC6 -- Admin autorise sur tout

```gherkin
Given un utilisateur avec businessRole "admin" dans la company
When il envoie DELETE /api/secrets/:id
Then la reponse est HTTP 200
  And le secret est supprime
```

### AC7 -- Agent bloque sans permission

```gherkin
Given un agent avec seulement la permission "stories:create"
When il envoie POST /api/companies/:companyId/agents
Then la reponse est HTTP 403
  And le body contient details.requiredPermission = "agents:create"
```

### AC8 -- Log audit access.denied

```gherkin
Given un Viewer qui tente une action non autorisee
When la reponse 403 est envoyee
Then un log avec event: "access.denied" est emis
  And le log contient permissionKey, companyId, actorType, route
```

### AC9 -- local_implicit bypass

```gherkin
Given un acteur board avec source "local_implicit" (mode local_trusted)
When il envoie n'importe quelle requete
Then la requete est autorisee (bypass total du RBAC)
  And aucun log access.denied n'est emis
```

### AC10 -- Toast frontend permission denied

```gherkin
Given un Viewer sur le UI
When une action declenche une erreur 403 avec requiredPermission
Then un toast apparait avec data-testid="rbac-s04-permission-denied-toast"
  And le toast affiche la permission key manquante
```

---

## Fichiers Modifies

| Fichier | Type de modification |
|---------|---------------------|
| `server/src/middleware/require-permission.ts` | MODIFIE -- enrichir 403 response avec details |
| `server/src/routes/secrets.ts` | MODIFIE -- ajouter requirePermission, supprimer assertBoard |
| `server/src/routes/approvals.ts` | MODIFIE -- ajouter requirePermission sur mutations |
| `server/src/routes/assets.ts` | MODIFIE -- ajouter requirePermission sur upload |
| `server/src/routes/agents.ts` | MODIFIE -- migrer helpers custom + ajouter requirePermission |
| `server/src/routes/projects.ts` | MODIFIE -- ajouter requirePermission sur mutations |
| `server/src/routes/issues.ts` | MODIFIE -- ajouter requirePermission sur mutations |
| `server/src/routes/goals.ts` | MODIFIE -- ajouter requirePermission sur mutations |
| `server/src/routes/workflows.ts` | MODIFIE -- ajouter requirePermission sur mutations |
| `server/src/routes/stages.ts` | MODIFIE -- ajouter requirePermission sur transitions |
| `server/src/routes/costs.ts` | MODIFIE -- ajouter requirePermission |
| `server/src/routes/activity.ts` | MODIFIE -- ajouter requirePermission audit:read |
| `server/src/routes/dashboard.ts` | MODIFIE -- ajouter requirePermission dashboard:view |
| `server/src/routes/companies.ts` | MODIFIE -- ajouter requirePermission sur mutations |
| `server/src/routes/access.ts` | MODIFIE -- ajouter requirePermission sur invites/members |
| `server/src/routes/workspace-context.ts` | MODIFIE -- ajouter requirePermission sur import/assignments |
| `server/src/routes/drift.ts` | MODIFIE -- ajouter requirePermission sur resolve |
| `ui/src/components/` (error toast) | MODIFIE -- afficher requiredPermission dans toast |

---

## Risques et Mitigations

| Risque | Mitigation |
|--------|-----------|
| Casser les agents existants qui n'ont pas de grants | `requirePermission` supporte deja le fallback businessRole preset via `hasPermission()` (RBAC-S02). Les agents CEO/manager ont les permissions par defaut via presets. |
| Mode local_trusted casse | `requirePermission` bypass deja pour `local_implicit` (L27-30 du middleware). Aucun changement. |
| Routes sans companyId dans le path | Utiliser le pattern B (lookup entity first, then inline check) ou creer `assertPermission()` helper. |
| Agents avec legacy `permissions.canCreateAgents` JSON | Conserver les helpers custom comme fallback dans `agents.ts` pour la periode de transition. |

---

## Tests E2E Playwright (QA Agent)

Les tests doivent couvrir :

1. **Pour chaque businessRole (viewer, contributor, manager, admin)** : tester au moins 1 route de chaque permission key
2. **403 response format** : verifier `error`, `details.requiredPermission`
3. **local_implicit bypass** : verifier que le mode local_trusted fonctionne
4. **Agent sans permission** : verifier le 403 pour un agent
5. **Toast frontend** : verifier `data-testid="rbac-s04-permission-denied-toast"` sur un 403

Output attendu : `e2e/tests/RBAC-S04.spec.ts`
