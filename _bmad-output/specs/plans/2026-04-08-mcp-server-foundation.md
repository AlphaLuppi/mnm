# MnM MCP Server — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working MCP server with OAuth 2.1 auth, typed permission contracts, Streamable HTTP + SSE transports, and 5 example tools + 2 example resources — proving the full pipeline end-to-end.

**Architecture:** MCP server integrated into the existing Express process (`server/src/mcp/`), accessing the 101 services directly. OAuth 2.1 AS built on top of Better-Auth. Permission contracts in `packages/shared/src/contracts/`. Pattern-based tool/resource registration with auto-discovery.

**Tech Stack:** `@modelcontextprotocol/sdk` (TypeScript), Express 5.1, Zod, Better-Auth, existing Drizzle/PostgreSQL services.

**Design Spec:** `_bmad-output/specs/2026-04-08-mcp-server-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `packages/shared/src/contracts/permissions.ts` | Typed permission constants, PermissionSlug type, PERMISSION_META, MCP_SCOPES |
| `packages/shared/src/contracts/mcp-errors.ts` | Typed MCP error codes and error factory |
| `server/src/mcp/index.ts` | Express mount point for /mcp and /mcp/sse |
| `server/src/mcp/mcp-session-manager.ts` | Session pool, cleanup, timeout, limits |
| `server/src/mcp/auth/mcp-oauth-router.ts` | OAuth 2.1 AS endpoints (PRM, metadata, authorize, token, register) |
| `server/src/mcp/auth/mcp-token-verifier.ts` | Dual token verification (OAuth JWT + Agent JWT) via `iss` discriminator |
| `server/src/mcp/auth/mcp-consent.ts` | Consent page renderer (scopes + redirect) |
| `server/src/mcp/auth/permission-scope.ts` | Resolves effectivePermissions + effectiveTags for MCP actor |
| `server/src/mcp/auth/oauth-store.ts` | In-memory store for authorization codes, clients (DCR), refresh tokens |
| `server/src/mcp/registry/types.ts` | McpToolDefinition, McpResourceDefinition, McpActor interfaces |
| `server/src/mcp/registry/tool-registry.ts` | Collects tools, filters by permissions, serves tools/list |
| `server/src/mcp/registry/resource-registry.ts` | Collects resources, filters by permissions, serves resources/list + resources/read |
| `server/src/mcp/registry/define-mcp-tools.ts` | `defineMcpTools()` factory with auto-audit, error handling, permission re-check |
| `server/src/mcp/registry/define-mcp-resources.ts` | `defineMcpResources()` factory |
| `server/src/mcp/tools/index.ts` | Auto-imports all *.tool.ts files |
| `server/src/mcp/tools/issues.tool.ts` | Example: list_issues, get_issue, create_issue |
| `server/src/mcp/tools/agents.tool.ts` | Example: list_agents, get_agent |
| `server/src/mcp/tools/context.tool.ts` | Bridge tool: get_context |
| `server/src/mcp/resources/index.ts` | Auto-imports all *.resource.ts files |
| `server/src/mcp/resources/projects.resource.ts` | Example: mnm://projects/{projectId} |
| `server/src/mcp/resources/issues.resource.ts` | Example: mnm://issues/{issueId} |

### Modified files

| File | Change |
|------|--------|
| `server/package.json` | Add `@modelcontextprotocol/sdk` dependency |
| `packages/shared/src/index.ts` | Re-export contracts |
| `server/src/app.ts` | Mount MCP routes |
| `server/src/agent-auth-jwt.ts` | Add `jti`, `created_by`, reduce TTL, fail-fast on missing secret |
| `server/src/services/permission-seed.ts` | Import from contracts instead of inline strings |
| `server/src/middleware/require-permission.ts` | Change `permissionKey: string` → `permissionKey: PermissionSlug` |
| `packages/db/src/client.ts` | Bump pool `max` from 20 → 40 |

---

## Task 1: Install MCP SDK dependency

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install the MCP SDK**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
bun add @modelcontextprotocol/sdk --cwd server
```

- [ ] **Step 2: Verify installation**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
bun run typecheck --filter @mnm/server
```

Expected: No errors. `@modelcontextprotocol/sdk` resolves.

- [ ] **Step 3: Commit**

```bash
git add server/package.json bun.lockb
git commit -m "chore: add @modelcontextprotocol/sdk dependency"
```

---

## Task 2: Typed permission contracts

**Files:**
- Create: `packages/shared/src/contracts/permissions.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the permission contracts file**

Create `packages/shared/src/contracts/permissions.ts`:

```typescript
/**
 * Typed permission contracts — single source of truth for all 77 permission slugs.
 * Imported by: permission-seed.ts, requirePermission(), MCP tools, UI.
 * Build-time safety: PermissionSlug is a string literal union type.
 */

export const PERMISSION_CATEGORIES = [
  "agents", "issues", "stories", "projects", "users",
  "workflows", "traces", "dashboard", "admin", "chat",
  "documents", "artifacts", "folders", "sandbox", "config",
  "feedback", "routines", "org", "inbox", "tasks",
] as const;

export type PermissionCategory = typeof PERMISSION_CATEGORIES[number];

export const PERMISSIONS = {
  // Agents
  AGENTS_CREATE: "agents:create",
  AGENTS_READ: "agents:read",
  AGENTS_EDIT: "agents:edit",
  AGENTS_LAUNCH: "agents:launch",
  AGENTS_CONFIGURE: "agents:configure",
  AGENTS_DELETE: "agents:delete",
  AGENTS_MANAGE: "agents:manage",
  AGENTS_MANAGE_KEYS: "agents:manage_keys",
  AGENTS_MANAGE_CONTAINERS: "agents:manage_containers",
  // Issues / Tasks
  ISSUES_CREATE: "issues:create",
  ISSUES_READ: "issues:read",
  ISSUES_EDIT: "issues:edit",
  ISSUES_ASSIGN: "issues:assign",
  ISSUES_DELETE: "issues:delete",
  ISSUES_MANAGE: "issues:manage",
  TASKS_ASSIGN: "tasks:assign",
  // Stories
  STORIES_CREATE: "stories:create",
  STORIES_EDIT: "stories:edit",
  // Projects
  PROJECTS_CREATE: "projects:create",
  PROJECTS_READ: "projects:read",
  PROJECTS_EDIT: "projects:edit",
  PROJECTS_DELETE: "projects:delete",
  PROJECTS_MANAGE: "projects:manage",
  PROJECTS_MANAGE_MEMBERS: "projects:manage_members",
  // Users
  USERS_READ: "users:read",
  USERS_INVITE: "users:invite",
  USERS_MANAGE: "users:manage",
  USERS_MANAGE_PERMISSIONS: "users:manage_permissions",
  USERS_REMOVE: "users:remove",
  JOINS_APPROVE: "joins:approve",
  // Workflows
  WORKFLOWS_CREATE: "workflows:create",
  WORKFLOWS_READ: "workflows:read",
  WORKFLOWS_DELETE: "workflows:delete",
  WORKFLOWS_ENFORCE: "workflows:enforce",
  WORKFLOWS_MANAGE: "workflows:manage",
  // Traces / Observability
  TRACES_READ: "traces:read",
  TRACES_WRITE: "traces:write",
  TRACES_MANAGE: "traces:manage",
  TRACES_EXPORT: "traces:export",
  DASHBOARD_VIEW: "dashboard:view",
  // Admin
  COMPANY_MANAGE_SETTINGS: "company:manage_settings",
  COMPANY_MANAGE_SSO: "company:manage_sso",
  COMPANY_DELETE: "company:delete",
  AUDIT_READ: "audit:read",
  AUDIT_EXPORT: "audit:export",
  ROLES_READ: "roles:read",
  ROLES_MANAGE: "roles:manage",
  TAGS_READ: "tags:read",
  TAGS_MANAGE: "tags:manage",
  // Chat
  CHAT_AGENT: "chat:agent",
  CHAT_READ: "chat:read",
  CHAT_CHANNEL: "chat:channel",
  CHAT_SHARE: "chat:share",
  CHAT_FORK: "chat:fork",
  CHAT_MANAGE: "chat:manage",
  // Documents
  DOCUMENTS_UPLOAD: "documents:upload",
  DOCUMENTS_READ: "documents:read",
  DOCUMENTS_DELETE: "documents:delete",
  DOCUMENTS_MANAGE: "documents:manage",
  // Artifacts
  ARTIFACTS_CREATE: "artifacts:create",
  ARTIFACTS_READ: "artifacts:read",
  ARTIFACTS_EDIT: "artifacts:edit",
  ARTIFACTS_DEPLOY: "artifacts:deploy",
  ARTIFACTS_DELETE: "artifacts:delete",
  ARTIFACTS_MANAGE: "artifacts:manage",
  // Folders
  FOLDERS_CREATE: "folders:create",
  FOLDERS_READ: "folders:read",
  FOLDERS_EDIT: "folders:edit",
  FOLDERS_DELETE: "folders:delete",
  FOLDERS_SHARE_USERS: "folders:share_users",
  FOLDERS_SHARE_TAGS: "folders:share_tags",
  FOLDERS_MANAGE: "folders:manage",
  // Sandbox
  SANDBOX_READ: "sandbox:read",
  SANDBOX_MANAGE: "sandbox:manage",
  // Config Layers
  CONFIG_LAYERS_CREATE: "config_layers:create",
  CONFIG_LAYERS_EDIT: "config_layers:edit",
  CONFIG_LAYERS_DELETE: "config_layers:delete",
  CONFIG_LAYERS_READ: "config_layers:read",
  CONFIG_LAYERS_MANAGE: "config_layers:manage",
  CONFIG_LAYERS_PROMOTE: "config_layers:promote",
  CONFIG_LAYERS_ATTACH: "config_layers:attach",
  MCP_CONNECT: "mcp:connect",
  MCP_MANAGE: "mcp:manage",
  // Feedback
  FEEDBACK_READ: "feedback:read",
  FEEDBACK_MANAGE: "feedback:manage",
  // Routines
  ROUTINES_READ: "routines:read",
  ROUTINES_CREATE: "routines:create",
  ROUTINES_DELETE: "routines:delete",
  ROUTINES_MANAGE: "routines:manage",
  // Org
  ORG_VIEW: "org:view",
  // Inbox
  INBOX_READ: "inbox:read",
} as const;

export type PermissionSlug = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** All permission slugs as an array (for iteration, validation). */
export const ALL_PERMISSION_SLUGS: PermissionSlug[] = Object.values(PERMISSIONS);

export interface PermissionMeta {
  category: PermissionCategory;
  description: string;
  destructive: boolean;
}

export const PERMISSION_META: Record<PermissionSlug, PermissionMeta> = {
  [PERMISSIONS.AGENTS_CREATE]: { category: "agents", description: "Créer un nouvel agent", destructive: false },
  [PERMISSIONS.AGENTS_READ]: { category: "agents", description: "Voir la liste et les détails des agents", destructive: false },
  [PERMISSIONS.AGENTS_EDIT]: { category: "agents", description: "Modifier les agents dans son scope", destructive: false },
  [PERMISSIONS.AGENTS_LAUNCH]: { category: "agents", description: "Lancer un agent run", destructive: false },
  [PERMISSIONS.AGENTS_CONFIGURE]: { category: "agents", description: "Modifier la config d'un agent", destructive: false },
  [PERMISSIONS.AGENTS_DELETE]: { category: "agents", description: "Supprimer un agent", destructive: true },
  [PERMISSIONS.AGENTS_MANAGE]: { category: "agents", description: "Gérer TOUS les agents (bypass tag scope)", destructive: false },
  [PERMISSIONS.AGENTS_MANAGE_KEYS]: { category: "agents", description: "Créer/révoquer les clés API des agents", destructive: false },
  [PERMISSIONS.AGENTS_MANAGE_CONTAINERS]: { category: "agents", description: "Gérer les containers/sandboxes des agents", destructive: false },
  [PERMISSIONS.ISSUES_CREATE]: { category: "issues", description: "Créer une issue", destructive: false },
  [PERMISSIONS.ISSUES_READ]: { category: "issues", description: "Voir la liste et les détails des issues", destructive: false },
  [PERMISSIONS.ISSUES_EDIT]: { category: "issues", description: "Modifier les issues dans son scope", destructive: false },
  [PERMISSIONS.ISSUES_ASSIGN]: { category: "issues", description: "Assigner une issue", destructive: false },
  [PERMISSIONS.ISSUES_DELETE]: { category: "issues", description: "Supprimer une issue", destructive: true },
  [PERMISSIONS.ISSUES_MANAGE]: { category: "issues", description: "Gérer TOUTES les issues (bypass tag scope)", destructive: false },
  [PERMISSIONS.TASKS_ASSIGN]: { category: "tasks", description: "Assigner des tâches", destructive: false },
  [PERMISSIONS.STORIES_CREATE]: { category: "stories", description: "Créer une story", destructive: false },
  [PERMISSIONS.STORIES_EDIT]: { category: "stories", description: "Modifier une story", destructive: false },
  [PERMISSIONS.PROJECTS_CREATE]: { category: "projects", description: "Créer un projet", destructive: false },
  [PERMISSIONS.PROJECTS_READ]: { category: "projects", description: "Voir la liste des projets", destructive: false },
  [PERMISSIONS.PROJECTS_EDIT]: { category: "projects", description: "Modifier les projets dans son scope", destructive: false },
  [PERMISSIONS.PROJECTS_DELETE]: { category: "projects", description: "Supprimer des projets", destructive: true },
  [PERMISSIONS.PROJECTS_MANAGE]: { category: "projects", description: "Gérer un projet", destructive: false },
  [PERMISSIONS.PROJECTS_MANAGE_MEMBERS]: { category: "projects", description: "Gérer les membres d'un projet", destructive: false },
  [PERMISSIONS.USERS_READ]: { category: "users", description: "Voir la liste des utilisateurs", destructive: false },
  [PERMISSIONS.USERS_INVITE]: { category: "users", description: "Inviter des utilisateurs", destructive: false },
  [PERMISSIONS.USERS_MANAGE]: { category: "users", description: "Gérer les rôles/tags des utilisateurs", destructive: false },
  [PERMISSIONS.USERS_MANAGE_PERMISSIONS]: { category: "users", description: "Gérer les permissions individuelles", destructive: false },
  [PERMISSIONS.USERS_REMOVE]: { category: "users", description: "Retirer des utilisateurs de la company", destructive: true },
  [PERMISSIONS.JOINS_APPROVE]: { category: "users", description: "Approuver les demandes d'adhésion", destructive: false },
  [PERMISSIONS.WORKFLOWS_CREATE]: { category: "workflows", description: "Créer un workflow template", destructive: false },
  [PERMISSIONS.WORKFLOWS_READ]: { category: "workflows", description: "Voir les workflows", destructive: false },
  [PERMISSIONS.WORKFLOWS_DELETE]: { category: "workflows", description: "Supprimer des workflows", destructive: true },
  [PERMISSIONS.WORKFLOWS_ENFORCE]: { category: "workflows", description: "Activer/désactiver l'enforcement", destructive: false },
  [PERMISSIONS.WORKFLOWS_MANAGE]: { category: "workflows", description: "Gérer TOUS les workflows", destructive: false },
  [PERMISSIONS.TRACES_READ]: { category: "traces", description: "Voir les traces", destructive: false },
  [PERMISSIONS.TRACES_WRITE]: { category: "traces", description: "Écrire des traces", destructive: false },
  [PERMISSIONS.TRACES_MANAGE]: { category: "traces", description: "Gérer les prompts gold, lenses", destructive: false },
  [PERMISSIONS.TRACES_EXPORT]: { category: "traces", description: "Exporter les traces", destructive: false },
  [PERMISSIONS.DASHBOARD_VIEW]: { category: "dashboard", description: "Voir le dashboard", destructive: false },
  [PERMISSIONS.COMPANY_MANAGE_SETTINGS]: { category: "admin", description: "Paramètres de l'instance", destructive: false },
  [PERMISSIONS.COMPANY_MANAGE_SSO]: { category: "admin", description: "Configurer SSO", destructive: false },
  [PERMISSIONS.COMPANY_DELETE]: { category: "admin", description: "Supprimer la company", destructive: true },
  [PERMISSIONS.AUDIT_READ]: { category: "admin", description: "Lire l'audit log", destructive: false },
  [PERMISSIONS.AUDIT_EXPORT]: { category: "admin", description: "Exporter l'audit log", destructive: false },
  [PERMISSIONS.ROLES_READ]: { category: "admin", description: "Voir les rôles", destructive: false },
  [PERMISSIONS.ROLES_MANAGE]: { category: "admin", description: "Créer/modifier les rôles", destructive: false },
  [PERMISSIONS.TAGS_READ]: { category: "admin", description: "Voir les tags", destructive: false },
  [PERMISSIONS.TAGS_MANAGE]: { category: "admin", description: "Créer/modifier les tags", destructive: false },
  [PERMISSIONS.CHAT_AGENT]: { category: "chat", description: "Discuter avec les agents", destructive: false },
  [PERMISSIONS.CHAT_READ]: { category: "chat", description: "Voir les channels de chat", destructive: false },
  [PERMISSIONS.CHAT_CHANNEL]: { category: "chat", description: "Créer des channels", destructive: false },
  [PERMISSIONS.CHAT_SHARE]: { category: "chat", description: "Partager un chat", destructive: false },
  [PERMISSIONS.CHAT_FORK]: { category: "chat", description: "Fork un chat partagé", destructive: false },
  [PERMISSIONS.CHAT_MANAGE]: { category: "chat", description: "Gérer TOUS les chats", destructive: false },
  [PERMISSIONS.DOCUMENTS_UPLOAD]: { category: "documents", description: "Upload des documents", destructive: false },
  [PERMISSIONS.DOCUMENTS_READ]: { category: "documents", description: "Voir les documents", destructive: false },
  [PERMISSIONS.DOCUMENTS_DELETE]: { category: "documents", description: "Supprimer des documents", destructive: true },
  [PERMISSIONS.DOCUMENTS_MANAGE]: { category: "documents", description: "Gérer TOUS les documents", destructive: false },
  [PERMISSIONS.ARTIFACTS_CREATE]: { category: "artifacts", description: "Créer des artefacts", destructive: false },
  [PERMISSIONS.ARTIFACTS_READ]: { category: "artifacts", description: "Voir les artefacts", destructive: false },
  [PERMISSIONS.ARTIFACTS_EDIT]: { category: "artifacts", description: "Éditer des artefacts", destructive: false },
  [PERMISSIONS.ARTIFACTS_DEPLOY]: { category: "artifacts", description: "Déployer des artefacts", destructive: false },
  [PERMISSIONS.ARTIFACTS_DELETE]: { category: "artifacts", description: "Supprimer des artefacts", destructive: true },
  [PERMISSIONS.ARTIFACTS_MANAGE]: { category: "artifacts", description: "Gérer TOUS les artefacts", destructive: false },
  [PERMISSIONS.FOLDERS_CREATE]: { category: "folders", description: "Créer des folders", destructive: false },
  [PERMISSIONS.FOLDERS_READ]: { category: "folders", description: "Voir les folders", destructive: false },
  [PERMISSIONS.FOLDERS_EDIT]: { category: "folders", description: "Modifier ses folders", destructive: false },
  [PERMISSIONS.FOLDERS_DELETE]: { category: "folders", description: "Supprimer ses folders", destructive: true },
  [PERMISSIONS.FOLDERS_SHARE_USERS]: { category: "folders", description: "Partager un folder à des utilisateurs", destructive: false },
  [PERMISSIONS.FOLDERS_SHARE_TAGS]: { category: "folders", description: "Assigner des tags à un folder", destructive: false },
  [PERMISSIONS.FOLDERS_MANAGE]: { category: "folders", description: "Gérer TOUS les folders", destructive: false },
  [PERMISSIONS.SANDBOX_READ]: { category: "sandbox", description: "Voir le statut de sa sandbox", destructive: false },
  [PERMISSIONS.SANDBOX_MANAGE]: { category: "sandbox", description: "Gérer les sandboxes", destructive: false },
  [PERMISSIONS.CONFIG_LAYERS_CREATE]: { category: "config", description: "Créer des config layers", destructive: false },
  [PERMISSIONS.CONFIG_LAYERS_EDIT]: { category: "config", description: "Modifier des config layers", destructive: false },
  [PERMISSIONS.CONFIG_LAYERS_DELETE]: { category: "config", description: "Supprimer des config layers", destructive: true },
  [PERMISSIONS.CONFIG_LAYERS_READ]: { category: "config", description: "Voir les config layers", destructive: false },
  [PERMISSIONS.CONFIG_LAYERS_MANAGE]: { category: "config", description: "Gérer les config layers company/enforced", destructive: false },
  [PERMISSIONS.CONFIG_LAYERS_PROMOTE]: { category: "config", description: "Approuver/rejeter les promotions de layers", destructive: false },
  [PERMISSIONS.CONFIG_LAYERS_ATTACH]: { category: "config", description: "Attacher des layers aux agents", destructive: false },
  [PERMISSIONS.MCP_CONNECT]: { category: "config", description: "Connecter des credentials (MCP, git providers)", destructive: false },
  [PERMISSIONS.MCP_MANAGE]: { category: "config", description: "Gérer TOUTES les credentials (MCP, git providers)", destructive: false },
  [PERMISSIONS.FEEDBACK_READ]: { category: "feedback", description: "Voir et voter sur les feedbacks", destructive: false },
  [PERMISSIONS.FEEDBACK_MANAGE]: { category: "feedback", description: "Gérer les catégories de feedback", destructive: false },
  [PERMISSIONS.ROUTINES_READ]: { category: "routines", description: "Voir les routines", destructive: false },
  [PERMISSIONS.ROUTINES_CREATE]: { category: "routines", description: "Créer et modifier des routines", destructive: false },
  [PERMISSIONS.ROUTINES_DELETE]: { category: "routines", description: "Supprimer des routines", destructive: true },
  [PERMISSIONS.ROUTINES_MANAGE]: { category: "routines", description: "Gérer TOUTES les routines", destructive: false },
  [PERMISSIONS.ORG_VIEW]: { category: "org", description: "Voir l'organigramme", destructive: false },
  [PERMISSIONS.INBOX_READ]: { category: "inbox", description: "Voir la boîte de réception", destructive: false },
};

// ── MCP Scopes ──────────────────────────────────────────────────────────────

export const MCP_SCOPES = {
  READ: "mcp:read",
  WRITE: "mcp:write",
  ADMIN: "mcp:admin",
} as const;

export type McpScope = typeof MCP_SCOPES[keyof typeof MCP_SCOPES];

export const ALL_MCP_SCOPES: McpScope[] = Object.values(MCP_SCOPES);

/**
 * Maps each MCP scope to the permission slugs it grants.
 * effectivePermissions = union(scope_permissions for each scope) ∩ user_role_permissions
 */
export function permissionsForScopes(scopes: McpScope[]): Set<PermissionSlug> {
  const result = new Set<PermissionSlug>();
  for (const scope of scopes) {
    for (const slug of ALL_PERMISSION_SLUGS) {
      const meta = PERMISSION_META[slug];
      if (scope === MCP_SCOPES.READ && !meta.destructive && (
        slug.endsWith(":read") || slug.endsWith(":view") ||
        slug === PERMISSIONS.DASHBOARD_VIEW || slug === PERMISSIONS.ORG_VIEW || slug === PERMISSIONS.INBOX_READ
      )) {
        result.add(slug);
      }
      if (scope === MCP_SCOPES.WRITE && !meta.destructive && !(
        slug.endsWith(":read") || slug.endsWith(":view") ||
        slug === PERMISSIONS.DASHBOARD_VIEW || slug === PERMISSIONS.ORG_VIEW || slug === PERMISSIONS.INBOX_READ
      )) {
        result.add(slug);
      }
      if (scope === MCP_SCOPES.ADMIN && meta.destructive) {
        result.add(slug);
      }
    }
  }
  return result;
}
```

- [ ] **Step 2: Re-export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export {
  PERMISSIONS, PERMISSION_META, PERMISSION_CATEGORIES, ALL_PERMISSION_SLUGS,
  MCP_SCOPES, ALL_MCP_SCOPES, permissionsForScopes,
  type PermissionSlug, type PermissionCategory, type PermissionMeta, type McpScope,
} from "./contracts/permissions.js";
```

- [ ] **Step 3: Run typecheck**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
bun run typecheck --filter @mnm/shared
```

Expected: PASS — no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/contracts/permissions.ts packages/shared/src/index.ts
git commit -m "feat: add typed permission contracts (PermissionSlug, MCP_SCOPES)"
```

---

## Task 3: Migrate permission-seed.ts to use contracts

**Files:**
- Modify: `server/src/services/permission-seed.ts`

- [ ] **Step 1: Rewrite SEED_PERMISSIONS to import from contracts**

Replace the inline `SEED_PERMISSIONS` array (lines 10-139 of `server/src/services/permission-seed.ts`) with:

```typescript
import { ALL_PERMISSION_SLUGS, PERMISSION_META, type PermissionSlug } from "@mnm/shared";

const SEED_PERMISSIONS: Array<{ slug: PermissionSlug; description: string; category: string }> =
  ALL_PERMISSION_SLUGS.map((slug) => ({
    slug,
    description: PERMISSION_META[slug].description,
    category: PERMISSION_META[slug].category,
  }));
```

The rest of the file (`seedPermissions`, role presets, `backfillPermissions`) stays unchanged — it already uses `slug` from the array.

- [ ] **Step 2: Run typecheck**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
bun run typecheck --filter @mnm/server
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/permission-seed.ts
git commit -m "refactor: permission-seed imports from typed contracts"
```

---

## Task 4: Type requirePermission middleware

**Files:**
- Modify: `server/src/middleware/require-permission.ts`

- [ ] **Step 1: Change permissionKey type to PermissionSlug**

In `server/src/middleware/require-permission.ts`, change the function signatures:

```typescript
import type { PermissionSlug } from "@mnm/shared";

export function requirePermission(
  db: Db,
  permissionKey: PermissionSlug,  // was: string
  extractScope?: ScopeExtractor,
) {
```

And for `assertCompanyPermission`:

```typescript
export async function assertCompanyPermission(
  db: Db,
  req: Request,
  companyId: string,
  permissionKey: PermissionSlug,  // was: string
  resourceScope?: ResourceScope,
) {
```

- [ ] **Step 2: Run typecheck to find all call sites with invalid strings**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
bun run typecheck --filter @mnm/server 2>&1 | head -50
```

Expected: Type errors on every route using a string literal not in `PermissionSlug`. This is intentional — we'll fix them in the next step.

- [ ] **Step 3: Fix all route call sites to use PERMISSIONS constants**

For each route file that uses `requirePermission(db, "agents:read")`, change to `requirePermission(db, PERMISSIONS.AGENTS_READ)`. Add `import { PERMISSIONS } from "@mnm/shared";` at the top of each file.

This is a mechanical find-and-replace across all route files. The typecheck from step 2 gives the exact list. Each file needs:
1. Add import: `import { PERMISSIONS } from "@mnm/shared";`
2. Replace every string literal with the matching constant

Example in `server/src/routes/agents.ts`:
```typescript
// Before:
requirePermission(db, "agents:read")
// After:
requirePermission(db, PERMISSIONS.AGENTS_READ)
```

- [ ] **Step 4: Run typecheck — should pass now**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
bun run typecheck --filter @mnm/server
```

Expected: PASS — zero errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/require-permission.ts server/src/routes/
git commit -m "refactor: all requirePermission calls use typed PERMISSIONS constants"
```

---

## Task 5: Harden agent JWT (TTL, jti, fail-fast)

**Files:**
- Modify: `server/src/agent-auth-jwt.ts`

- [ ] **Step 1: Add jti generation, reduce TTL, fail-fast**

In `server/src/agent-auth-jwt.ts`, modify `jwtConfig()` (line 28-41):

```typescript
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

function jwtConfig() {
  const deploymentMode = process.env.MNM_DEPLOYMENT_MODE ?? "local_trusted";
  const rawSecret = process.env.MNM_AGENT_JWT_SECRET;
  const secret = rawSecret || (deploymentMode === "local_trusted" ? "mnm-dev-secret" : null);
  if (!secret) {
    if (deploymentMode !== "local_trusted") {
      throw new Error(
        "FATAL: MNM_AGENT_JWT_SECRET is required in deployment mode '" + deploymentMode + "'. " +
        "Set it to a random 32+ character string."
      );
    }
    return null;
  }

  return {
    secret,
    ttlSeconds: parseNumber(process.env.MNM_AGENT_JWT_TTL_SECONDS, 60 * 60 * 2), // 2h (was 48h)
    issuer: process.env.MNM_AGENT_JWT_ISSUER ?? "mnm-agent", // changed from "mnm"
    audience: process.env.MNM_AGENT_JWT_AUDIENCE ?? "mnm-mcp", // changed from "mnm-api"
  };
}
```

In `createLocalAgentJwt` (line 72+), add `jti` and `created_by`:

```typescript
export function createLocalAgentJwt(
  agentId: string,
  companyId: string,
  adapterType: string,
  runId: string,
  createdByUserId?: string,
) {
  const config = jwtConfig();
  if (!config) return null;

  const now = Math.floor(Date.now() / 1000);
  const claims: LocalAgentJwtClaims = {
    sub: agentId,
    company_id: companyId,
    adapter_type: adapterType,
    run_id: runId,
    jti: randomUUID(),
    created_by: createdByUserId,
    iat: now,
    exp: now + config.ttlSeconds,
    iss: config.issuer,
    aud: config.audience,
  };
```

Update the `LocalAgentJwtClaims` interface:

```typescript
export interface LocalAgentJwtClaims {
  sub: string;
  company_id: string;
  adapter_type: string;
  run_id: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
  jti?: string;
  created_by?: string;
}
```

- [ ] **Step 2: Update heartbeat.ts call site to pass createdByUserId**

Find the call to `createLocalAgentJwt` in `server/src/services/heartbeat.ts` and add the `createdByUserId` parameter (it's available on the agent row as `createdByUserId`).

- [ ] **Step 3: Run typecheck**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
bun run typecheck --filter @mnm/server
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/agent-auth-jwt.ts server/src/services/heartbeat.ts
git commit -m "fix(security): harden agent JWT — TTL 2h, jti, fail-fast on missing secret"
```

---

## Task 6: Bump DB pool max

**Files:**
- Modify: `packages/db/src/client.ts`

- [ ] **Step 1: Change pool max from 20 to 40**

Find the pool config in `packages/db/src/client.ts` (around line 46) and change `max: 20` to `max: 40`.

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/client.ts
git commit -m "chore: bump DB pool max 20→40 for MCP server concurrency"
```

---

## Task 7: MCP registry types and interfaces

**Files:**
- Create: `server/src/mcp/registry/types.ts`
- Create: `packages/shared/src/contracts/mcp-errors.ts`

- [ ] **Step 1: Create MCP error codes**

Create `packages/shared/src/contracts/mcp-errors.ts`:

```typescript
export const MCP_ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type McpErrorCode = typeof MCP_ERROR_CODES[keyof typeof MCP_ERROR_CODES];

export interface McpErrorPayload {
  error: string;
  code: McpErrorCode;
  retryable: boolean;
  hint?: string;
}
```

Re-export from `packages/shared/src/index.ts`.

- [ ] **Step 2: Create registry types**

Create `server/src/mcp/registry/types.ts`:

```typescript
import type { z } from "zod";
import type { PermissionSlug } from "@mnm/shared";

/** Actor resolved from OAuth token or Agent JWT */
export interface McpActor {
  type: "user" | "agent";
  userId?: string;
  agentId?: string;
  companyId: string;
  /** Permissions granted by scopes ∩ role permissions */
  effectivePermissions: Set<PermissionSlug>;
  /** Tags for data isolation (user_tags ∩ agent_tags for agents) */
  effectiveTags: Set<string>;
  /** The MCP session ID */
  mcpSessionId: string;
}

/** Definition of a single MCP tool (used by tool-registry) */
export interface McpToolDefinition {
  name: string;
  permissions: PermissionSlug[];
  description: string;
  input: z.ZodType<any>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    openWorldHint?: boolean;
  };
  handler: (ctx: { input: any; actor: McpActor }) => Promise<McpToolResult>;
}

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Definition of a single MCP resource template */
export interface McpResourceDefinition {
  uriTemplate: string;
  permissions: PermissionSlug[];
  name: string;
  description: string;
  mimeType: string;
  handler: (ctx: { uri: string; params: Record<string, string>; actor: McpActor }) => Promise<McpResourceResult>;
}

export interface McpResourceResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}

/** Services injected into tool/resource handlers */
export interface McpServices {
  [key: string]: any; // Typed per-domain in each tool file
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/contracts/mcp-errors.ts packages/shared/src/index.ts server/src/mcp/registry/types.ts
git commit -m "feat: MCP registry types and error contracts"
```

---

## Task 8: defineMcpTools factory with auto-audit and error handling

**Files:**
- Create: `server/src/mcp/registry/define-mcp-tools.ts`

- [ ] **Step 1: Create the factory**

Create `server/src/mcp/registry/define-mcp-tools.ts`:

```typescript
import type { z } from "zod";
import type { PermissionSlug } from "@mnm/shared";
import { MCP_ERROR_CODES, type McpErrorCode } from "@mnm/shared";
import type { McpToolDefinition, McpToolResult, McpActor, McpServices } from "./types.js";
import { auditService } from "../../services/audit.js";
import type { Db } from "@mnm/db";
import { logger } from "../../middleware/logger.js";

const TOOL_TIMEOUT_MS = 30_000;

interface ToolConfig {
  permissions: PermissionSlug[];
  description: string;
  input: z.ZodType<any>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    openWorldHint?: boolean;
  };
  handler: (ctx: { input: any; actor: McpActor }) => Promise<McpToolResult>;
}

interface ToolRegistrar {
  tool: (name: string, config: ToolConfig) => void;
  services: McpServices;
}

type ToolDefiner = (registrar: ToolRegistrar) => void;

function mcpError(error: string, code: McpErrorCode, retryable: boolean, hint?: string): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error, code, retryable, hint }) }],
    isError: true,
  };
}

export function defineMcpTools(definer: ToolDefiner) {
  return definer;
}

/**
 * Collects tool definitions from a definer function, wrapping each handler
 * with permission re-check, audit logging, error handling, and timeout.
 */
export function collectTools(
  definer: ToolDefiner,
  services: McpServices,
  db: Db,
): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [];

  const registrar: ToolRegistrar = {
    services,
    tool(name, config) {
      const wrappedHandler = async (ctx: { input: any; actor: McpActor }): Promise<McpToolResult> => {
        const start = Date.now();
        const { actor } = ctx;

        // Defense in depth: re-check permissions at execution time
        for (const perm of config.permissions) {
          if (!actor.effectivePermissions.has(perm)) {
            return mcpError(
              `Missing permission: ${perm}`,
              MCP_ERROR_CODES.PERMISSION_DENIED,
              false,
              `You need the ${perm} permission. Check your MCP scopes.`,
            );
          }
        }

        try {
          // Timeout wrapper
          const result = await Promise.race([
            config.handler(ctx),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Tool call timeout")), TOOL_TIMEOUT_MS),
            ),
          ]);

          // Audit success (fire-and-forget)
          auditService(db).emit({
            companyId: actor.companyId,
            actorId: actor.userId ?? actor.agentId ?? "unknown",
            actorType: actor.type,
            action: "mcp.tool_call",
            targetType: "mcp_tool",
            targetId: name,
            metadata: {
              mcpSessionId: actor.mcpSessionId,
              durationMs: Date.now() - start,
              success: true,
            },
            severity: "info",
          }).catch(() => {});

          return result;
        } catch (err: any) {
          const durationMs = Date.now() - start;

          // Audit failure (fire-and-forget)
          auditService(db).emit({
            companyId: actor.companyId,
            actorId: actor.userId ?? actor.agentId ?? "unknown",
            actorType: actor.type,
            action: "mcp.tool_call",
            targetType: "mcp_tool",
            targetId: name,
            metadata: {
              mcpSessionId: actor.mcpSessionId,
              durationMs,
              success: false,
              errorCode: err.statusCode ? String(err.statusCode) : "INTERNAL",
            },
            severity: "warning",
          }).catch(() => {});

          logger.error({ err, tool: name, durationMs }, "MCP tool call failed");

          // Map known error types
          if (err.statusCode === 404 || err.code === "NOT_FOUND") {
            return mcpError(err.message ?? "Not found", MCP_ERROR_CODES.NOT_FOUND, false, "Check the ID. Use a list_* tool to find valid IDs.");
          }
          if (err.statusCode === 403) {
            return mcpError(err.message ?? "Forbidden", MCP_ERROR_CODES.PERMISSION_DENIED, false);
          }
          if (err.statusCode === 409) {
            return mcpError(err.message ?? "Conflict", MCP_ERROR_CODES.CONFLICT, true, "The resource was modified. Retry.");
          }
          if (err.message === "Tool call timeout") {
            return mcpError("Tool call timed out after 30s", MCP_ERROR_CODES.INTERNAL_ERROR, true);
          }

          // Generic error — never leak internals
          return mcpError("Internal error", MCP_ERROR_CODES.INTERNAL_ERROR, false);
        }
      };

      tools.push({
        name,
        permissions: config.permissions,
        description: config.description,
        input: config.input,
        annotations: config.annotations,
        handler: wrappedHandler,
      });
    },
  };

  definer(registrar);
  return tools;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/mcp/registry/define-mcp-tools.ts
git commit -m "feat: defineMcpTools factory with auto-audit, error handling, timeout"
```

---

## Task 9: Tool registry (collects, filters, serves tools/list)

**Files:**
- Create: `server/src/mcp/registry/tool-registry.ts`

- [ ] **Step 1: Create tool-registry.ts**

```typescript
import type { McpToolDefinition, McpActor } from "./types.js";
import type { PermissionSlug } from "@mnm/shared";

export class ToolRegistry {
  private tools: McpToolDefinition[] = [];

  register(tools: McpToolDefinition[]) {
    this.tools.push(...tools);
  }

  /** Returns only the tools the actor has permissions for. */
  listForActor(actor: McpActor): McpToolDefinition[] {
    return this.tools.filter((tool) =>
      tool.permissions.every((perm) => actor.effectivePermissions.has(perm)),
    );
  }

  /** Finds a tool by name, returns null if not found or not permitted. */
  findForActor(name: string, actor: McpActor): McpToolDefinition | null {
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) return null;
    if (!tool.permissions.every((perm) => actor.effectivePermissions.has(perm))) return null;
    return tool;
  }

  get allTools(): McpToolDefinition[] {
    return this.tools;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/mcp/registry/tool-registry.ts
git commit -m "feat: ToolRegistry with permission-filtered listing"
```

---

## Task 10: Resource registry

**Files:**
- Create: `server/src/mcp/registry/define-mcp-resources.ts`
- Create: `server/src/mcp/registry/resource-registry.ts`

- [ ] **Step 1: Create define-mcp-resources.ts**

```typescript
import type { PermissionSlug } from "@mnm/shared";
import type { McpResourceDefinition, McpResourceResult, McpActor, McpServices } from "./types.js";

interface ResourceConfig {
  permissions: PermissionSlug[];
  name: string;
  description: string;
  mimeType: string;
  handler: (ctx: { uri: string; params: Record<string, string>; actor: McpActor }) => Promise<McpResourceResult>;
}

interface ResourceRegistrar {
  template: (uriTemplate: string, config: ResourceConfig) => void;
  services: McpServices;
}

type ResourceDefiner = (registrar: ResourceRegistrar) => void;

export function defineMcpResources(definer: ResourceDefiner) {
  return definer;
}

export function collectResources(
  definer: ResourceDefiner,
  services: McpServices,
): McpResourceDefinition[] {
  const resources: McpResourceDefinition[] = [];

  const registrar: ResourceRegistrar = {
    services,
    template(uriTemplate, config) {
      resources.push({ uriTemplate, ...config });
    },
  };

  definer(registrar);
  return resources;
}
```

- [ ] **Step 2: Create resource-registry.ts**

```typescript
import type { McpResourceDefinition, McpResourceResult, McpActor } from "./types.js";

export class ResourceRegistry {
  private resources: McpResourceDefinition[] = [];

  register(resources: McpResourceDefinition[]) {
    this.resources.push(...resources);
  }

  listForActor(actor: McpActor): McpResourceDefinition[] {
    return this.resources.filter((r) =>
      r.permissions.every((perm) => actor.effectivePermissions.has(perm)),
    );
  }

  /** Match a URI against registered templates and read the resource. */
  async read(uri: string, actor: McpActor): Promise<McpResourceResult | null> {
    for (const resource of this.resources) {
      const params = matchUriTemplate(resource.uriTemplate, uri);
      if (params && resource.permissions.every((p) => actor.effectivePermissions.has(p))) {
        return resource.handler({ uri, params, actor });
      }
    }
    return null;
  }
}

/** Simple URI template matcher for mnm://{type}/{id} patterns. */
function matchUriTemplate(template: string, uri: string): Record<string, string> | null {
  const templateParts = template.split("/");
  const uriParts = uri.split("/");
  if (templateParts.length !== uriParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < templateParts.length; i++) {
    const tpl = templateParts[i];
    const val = uriParts[i];
    if (tpl.startsWith("{") && tpl.endsWith("}")) {
      params[tpl.slice(1, -1)] = val;
    } else if (tpl !== val) {
      return null;
    }
  }
  return params;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/mcp/registry/define-mcp-resources.ts server/src/mcp/registry/resource-registry.ts
git commit -m "feat: ResourceRegistry with URI template matching and permission filtering"
```

---

## Task 11: Example tools (issues + agents)

**Files:**
- Create: `server/src/mcp/tools/issues.tool.ts`
- Create: `server/src/mcp/tools/agents.tool.ts`
- Create: `server/src/mcp/tools/context.tool.ts`
- Create: `server/src/mcp/tools/index.ts`

- [ ] **Step 1: Create issues.tool.ts with 3 tools**

Create `server/src/mcp/tools/issues.tool.ts` with `list_issues`, `get_issue`, `create_issue` — following the pattern from the spec (Section 5.2). Each tool uses `PERMISSIONS.*` constants, Zod input schemas, and calls `services.issues.*` directly.

- [ ] **Step 2: Create agents.tool.ts with 2 tools**

Create `server/src/mcp/tools/agents.tool.ts` with `list_agents`, `get_agent`.

- [ ] **Step 3: Create context.tool.ts bridge**

Create `server/src/mcp/tools/context.tool.ts` with `get_context` that dispatches to the resource registry.

- [ ] **Step 4: Create tools/index.ts auto-import**

```typescript
import issueTools from "./issues.tool.js";
import agentTools from "./agents.tool.js";
import contextTools from "./context.tool.js";

export const allToolDefiners = [issueTools, agentTools, contextTools];
```

- [ ] **Step 5: Commit**

```bash
git add server/src/mcp/tools/
git commit -m "feat: example MCP tools (issues, agents, context bridge)"
```

---

## Task 12: Example resources (projects + issues)

**Files:**
- Create: `server/src/mcp/resources/projects.resource.ts`
- Create: `server/src/mcp/resources/issues.resource.ts`
- Create: `server/src/mcp/resources/index.ts`

- [ ] **Step 1: Create the two resource files and index**

Follow the pattern from the spec (Section 6.4). Each resource uses `PERMISSIONS.*`, a URI template, and calls services directly.

- [ ] **Step 2: Commit**

```bash
git add server/src/mcp/resources/
git commit -m "feat: example MCP resources (projects, issues)"
```

---

## Task 13: OAuth 2.1 store (authorization codes, clients, tokens)

**Files:**
- Create: `server/src/mcp/auth/oauth-store.ts`

- [ ] **Step 1: Create in-memory OAuth store**

This stores authorization codes (short-lived), DCR clients, and refresh tokens. In-memory is fine for single-instance self-hosted.

```typescript
import { randomUUID, createHash } from "node:crypto";

interface OAuthClient {
  clientId: string;
  clientSecret?: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  createdAt: number;
}

interface AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  companyId: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  resource: string;
  expiresAt: number;
}

interface RefreshToken {
  token: string;
  clientId: string;
  userId: string;
  companyId: string;
  scopes: string[];
  resource: string;
  expiresAt: number;
}

export class OAuthStore {
  private clients = new Map<string, OAuthClient>();
  private codes = new Map<string, AuthorizationCode>();
  private refreshTokens = new Map<string, RefreshToken>();

  // ── DCR ──
  registerClient(name: string, redirectUris: string[], grantTypes: string[]): OAuthClient {
    const client: OAuthClient = {
      clientId: randomUUID(),
      clientSecret: randomUUID(),
      clientName: name,
      redirectUris,
      grantTypes,
      createdAt: Date.now(),
    };
    this.clients.set(client.clientId, client);
    return client;
  }

  getClient(clientId: string): OAuthClient | undefined {
    return this.clients.get(clientId);
  }

  // ── Authorization Codes ──
  createCode(params: Omit<AuthorizationCode, "code" | "expiresAt">): string {
    const code = randomUUID();
    this.codes.set(code, { ...params, code, expiresAt: Date.now() + 10 * 60 * 1000 }); // 10 min
    return code;
  }

  consumeCode(code: string): AuthorizationCode | null {
    const entry = this.codes.get(code);
    if (!entry) return null;
    this.codes.delete(code); // single-use
    if (Date.now() > entry.expiresAt) return null;
    return entry;
  }

  // ── Refresh Tokens ──
  createRefreshToken(params: Omit<RefreshToken, "token" | "expiresAt">): string {
    const token = randomUUID();
    this.refreshTokens.set(token, { ...params, token, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }); // 30 days
    return token;
  }

  consumeRefreshToken(token: string): RefreshToken | null {
    const entry = this.refreshTokens.get(token);
    if (!entry) return null;
    this.refreshTokens.delete(token); // rotate
    if (Date.now() > entry.expiresAt) return null;
    return entry;
  }

  // ── Cleanup ──
  cleanup() {
    const now = Date.now();
    for (const [k, v] of this.codes) if (now > v.expiresAt) this.codes.delete(k);
    for (const [k, v] of this.refreshTokens) if (now > v.expiresAt) this.refreshTokens.delete(k);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/mcp/auth/oauth-store.ts
git commit -m "feat: in-memory OAuth store (codes, clients, refresh tokens)"
```

---

## Task 14: MCP token verifier (dual OAuth + Agent JWT)

**Files:**
- Create: `server/src/mcp/auth/mcp-token-verifier.ts`

- [ ] **Step 1: Create dual token verifier**

Examines the JWT `iss` claim to discriminate between OAuth tokens (`iss: "mnm-oauth"`) and agent tokens (`iss: "mnm-agent"`). Resolves `McpActor` with `effectivePermissions` and `effectiveTags`.

This file uses:
- `verifyLocalAgentJwt()` from `agent-auth-jwt.ts` for agent tokens
- `accessService()` from `services/access.ts` for resolving permissions/tags
- `permissionsForScopes()` from contracts for OAuth scope→permission mapping

- [ ] **Step 2: Commit**

```bash
git add server/src/mcp/auth/mcp-token-verifier.ts
git commit -m "feat: dual MCP token verifier (OAuth + Agent JWT via iss discriminator)"
```

---

## Task 15: OAuth 2.1 router (PRM, metadata, authorize, token, register)

**Files:**
- Create: `server/src/mcp/auth/mcp-oauth-router.ts`
- Create: `server/src/mcp/auth/mcp-consent.ts`

- [ ] **Step 1: Create the OAuth router with 5 endpoints**

The router implements:
1. `GET /.well-known/oauth-protected-resource` — PRM (RFC 9728)
2. `GET /.well-known/oauth-authorization-server` — AS metadata (RFC 8414)
3. `POST /oauth/register` — DCR (RFC 7591)
4. `GET /oauth/authorize` — Authorization endpoint (renders consent screen or redirects)
5. `POST /oauth/token` — Token endpoint (authorization_code + refresh_token grants, PKCE validation)

The consent screen (`mcp-consent.ts`) is a simple HTML page that:
- Shows the 3 MCP scopes with checkboxes (mcp:read checked, mcp:write checked, mcp:admin unchecked)
- Requires the user to be logged in via Better-Auth session
- On submit, creates an authorization code and redirects back to the client

- [ ] **Step 2: Commit**

```bash
git add server/src/mcp/auth/mcp-oauth-router.ts server/src/mcp/auth/mcp-consent.ts
git commit -m "feat: OAuth 2.1 AS router (PRM, metadata, authorize, token, DCR)"
```

---

## Task 16: MCP session manager

**Files:**
- Create: `server/src/mcp/mcp-session-manager.ts`

- [ ] **Step 1: Create session manager**

Manages the pool of `StreamableHTTPServerTransport` instances keyed by `Mcp-Session-Id`. Handles:
- Session creation on `InitializeRequest`
- Session lookup by `Mcp-Session-Id` header
- Timeout cleanup (30 min for humans, configurable)
- Max sessions limit (100)
- Graceful shutdown (close all sessions)

- [ ] **Step 2: Commit**

```bash
git add server/src/mcp/mcp-session-manager.ts
git commit -m "feat: MCP session manager with timeout, limits, graceful shutdown"
```

---

## Task 17: MCP Express mount point (index.ts)

**Files:**
- Create: `server/src/mcp/index.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create the MCP mount point**

`server/src/mcp/index.ts` creates an Express Router that:
1. Mounts the OAuth router (`/.well-known/*`, `/oauth/*`)
2. Handles `POST /mcp` — validates Bearer token, routes to session manager
3. Handles `GET /mcp` — SSE stream for server→client notifications
4. Handles `DELETE /mcp` — session termination
5. Returns 401 with `WWW-Authenticate` header when no valid token

For each `InitializeRequest`, it:
1. Verifies the token → resolves `McpActor`
2. Creates a new `McpServer` with tools/resources filtered for that actor
3. Connects it to a new `StreamableHTTPServerTransport`
4. Registers all tools and resources via `server.registerTool()` / `server.registerResource()`

- [ ] **Step 2: Mount in app.ts**

Add to `server/src/app.ts`:

```typescript
import { createMcpRouter } from "./mcp/index.js";

// After other routes, before error handler:
app.use(createMcpRouter(db, services));
```

- [ ] **Step 3: Verify the server starts**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm
bun run dev
```

Expected: Server starts, logs show MCP endpoints registered.

- [ ] **Step 4: Commit**

```bash
git add server/src/mcp/index.ts server/src/app.ts
git commit -m "feat: MCP server mount point with Streamable HTTP transport"
```

---

## Task 18: End-to-end smoke test

- [ ] **Step 1: Test PRM endpoint**

```bash
curl -s http://localhost:3001/.well-known/oauth-protected-resource | jq .
```

Expected: JSON with `resource`, `authorization_servers`, `scopes_supported`.

- [ ] **Step 2: Test 401 on /mcp without token**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/mcp
```

Expected: `401`

- [ ] **Step 3: Test with a manually crafted agent JWT (dev mode)**

```bash
# In dev mode (local_trusted), generate a test token and call tools/list
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer <test-agent-jwt>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Expected: `InitializeResult` with tools and resources capabilities.

- [ ] **Step 4: Commit final integration**

```bash
git add -A
git commit -m "feat: MCP server foundation complete — tools, resources, OAuth, dual auth"
```

---

## Summary

| Task | Description | Deps |
|------|-------------|------|
| 1 | Install MCP SDK | — |
| 2 | Permission contracts | — |
| 3 | Migrate permission-seed | 2 |
| 4 | Type requirePermission | 2 |
| 5 | Harden agent JWT | — |
| 6 | Bump DB pool | — |
| 7 | Registry types + error contracts | 2 |
| 8 | defineMcpTools factory | 7 |
| 9 | Tool registry | 7 |
| 10 | Resource registry | 7 |
| 11 | Example tools | 8, 9 |
| 12 | Example resources | 10 |
| 13 | OAuth store | — |
| 14 | Token verifier | 2, 5 |
| 15 | OAuth router | 13, 14 |
| 16 | Session manager | — |
| 17 | MCP mount point | 9, 10, 11, 12, 15, 16 |
| 18 | Smoke test | 17 |

**Parallelizable:** Tasks 1-6 can all run in parallel. Tasks 7-12 can run in parallel after 2. Task 17 is the integration point.

---

*Plan 1/2 — MnM MCP Server Foundation — 2026-04-08*
*Plan 2 (Expansion: 64 remaining tools + 9 resources) follows the same patterns — no new architecture.*
