# MnM MCP Server — Design Spec

**Date :** 2026-04-08
**Auteur :** MnM contributor + Claude
**Statut :** Validé — prêt pour implementation plan
**Référence vision :** `vision-mnm-2026-04-07.md` (Partie 2, MnM MCP Server)
**Référence product brief :** `product-brief-mnm-v3-2026-04-08.md` (Phase 0)

---

## 1. Objectif

Exposer **l'intégralité de l'API MnM** comme un MCP server que les devs (via Claude Code/Cursor) et les agents (dans les Docker sandboxes) peuvent utiliser nativement. Résout le problème actuel : les agents tentent d'appeler l'API REST directement et échouent constamment ("API not found").

**Non-objectifs :** Pas un remplacement de l'API REST. Les deux coexistent. Le MCP server est une projection MCP du même backend.

---

## 2. Décisions d'architecture

### 2.1 Transports

| Transport | Endpoint | Pour qui | Spec |
|-----------|----------|----------|------|
| **Streamable HTTP** | `POST/GET/DELETE /mcp` | Tous (standard 2025) | MCP 2025-06-18 |
| **SSE legacy** | `GET /mcp/sse` + POST endpoint séparé | Clients anciens | MCP 2024-11-05 backward compat |

Les deux endpoints sont séparés comme recommandé par la spec ("Continue to host both the SSE and POST endpoints of the old transport, alongside the new MCP endpoint").

### 2.2 Auth duale

| Acteur | Mécanisme | Token | Permissions |
|--------|-----------|-------|-------------|
| **Humain** (dev via Claude Code/Cursor) | OAuth 2.1 (MnM = Authorization Server) | JWT court (30min) + refresh token | `dev_scopes ∩ user_role_permissions` |
| **Agent** (dans Docker sandbox) | JWT signé (HMAC, système existant) | JWT (TTL 1-2h, avec `jti` unique) | `dev_scopes ∩ agent_permissions` |

**Discriminateur token :** Le `mcp-token-verifier.ts` examine le claim `iss` du JWT :
- `iss: "mnm-oauth"` → token OAuth humain → résolution via Better-Auth
- `iss: "mnm-agent"` → JWT agent → résolution via `agent-auth-jwt.ts`

Jamais de cascade try/catch.

### 2.3 Modèle de permissions MCP

```
effectivePermissions = actor_scopes ∩ actor_role_permissions
effectiveTags        = dev_tags ∩ agent_tags        (agents uniquement)
effectiveTags        = user_tags                     (humains)
```

**Pour un agent lancé par un dev :**
- `actor_scopes` = scopes OAuth du dev qui a configuré l'agent
- `actor_role_permissions` = permissions du rôle de l'agent + ses permissions directes
- `effectiveTags` = intersection des tags dev ∩ tags agent

**Exemple :**
```
Dev tags:    [produitA, produitB]    Dev scopes:    [mcp:read, mcp:write]
Agent tags:  [produitB, produitC]    Agent perms:   [issues:read, issues:create, agents:read]
                    ↓                                     ↓
effectiveTags: [produitB]            effectivePerms: [issues:read, issues:create, agents:read]
                                     (∩ scopes → seulement les read/write, pas admin)
```

L'agent ne voit QUE les données de produitB et ne peut QUE lire/créer des issues et lire les agents.

### 2.4 Scopes OAuth

3 scopes larges (pas 77 checkboxes) :

| Scope | Permissions incluses | Default |
|-------|---------------------|---------|
| `mcp:read` | Toutes les permissions `*:read`, `*:list`, `dashboard:view`, `org:view`, `inbox:read` | ✅ Coché |
| `mcp:write` | Toutes les permissions `*:create`, `*:edit`, `*:assign`, `*:launch`, `*:configure`, `*:attach`, `*:share_*`, `*:fork` | ✅ Coché |
| `mcp:admin` | Toutes les permissions `*:delete`, `*:manage`, `*:manage_*`, `*:enforce`, `*:promote`, `*:export`, `company:*`, `audit:*`, `roles:*`, `tags:*` | ❌ Décoché |

Le consent screen affiche ces 3 scopes avec une description claire. La granularité fine reste dans le RBAC serveur :
```
effectivePermissions = scope_permissions(selected_scopes) ∩ user_role_permissions
```

### 2.5 Architecture fichiers

```
server/src/mcp/
├── index.ts                    ← Mount Express: /mcp + /mcp/sse
├── mcp-session-manager.ts      ← Pool sessions, cleanup, timeout, graceful shutdown
├── auth/
│   ├── mcp-oauth-router.ts     ← OAuth 2.1 AS endpoints (PRM, metadata, authorize, token, register)
│   ├── mcp-token-verifier.ts   ← Vérifie OAuth + JWT agents (discriminateur iss)
│   ├── mcp-consent.ts          ← Consent screen logic (scopes, redirect)
│   └── permission-scope.ts     ← Résolution effectivePermissions + effectiveTags
├── registry/
│   ├── tool-registry.ts        ← Collecte tools, filtre par permissions, sert tools/list
│   ├── resource-registry.ts    ← Collecte resources, filtre par permissions, sert resources/list
│   └── types.ts                ← McpToolDefinition, McpResourceDefinition interfaces
├── tools/
│   ├── index.ts                ← Auto-import glob de tous les *.tool.ts
│   ├── agents.tool.ts
│   ├── issues.tool.ts
│   ├── projects.tool.ts
│   ├── config-layers.tool.ts
│   ├── workflows.tool.ts
│   ├── traces.tool.ts
│   ├── chat.tool.ts
│   ├── documents.tool.ts
│   ├── folders.tool.ts
│   ├── artifacts.tool.ts
│   ├── sandbox.tool.ts
│   ├── users.tool.ts
│   ├── audit.tool.ts
│   ├── roles.tool.ts
│   ├── tags.tool.ts
│   ├── a2a.tool.ts
│   └── context.tool.ts        ← Tool bridge get_context vers resources
├── resources/
│   ├── index.ts                ← Auto-import glob de tous les *.resource.ts
│   ├── projects.resource.ts
│   ├── agents.resource.ts
│   ├── nodes.resource.ts
│   ├── issues.resource.ts
│   ├── folders.resource.ts
│   ├── documents.resource.ts
│   ├── chat.resource.ts
│   ├── config-layers.resource.ts
│   ├── traces.resource.ts
│   └── artifacts.resource.ts
```

### 2.6 Intégration dans le process Express existant

Le MCP server vit dans le même process Express. Accès direct aux 101 services. Pas de HTTP interne.

**Mitigations risques cohabitation :**
- Monitoring event loop lag (`monitorEventLoopDelay`, alerte si p99 > 100ms)
- Pool DB : bump `max` de 20 → 40, sémaphore MCP limitant les queries concurrentes à 15
- Pagination obligatoire sur tous les `list_*` (default 25, max 100)
- Graceful shutdown : fermer sessions MCP/SSE AVANT le HTTP server

---

## 3. OAuth 2.1 — MnM comme Authorization Server

### 3.1 Endpoints requis

| Endpoint | Méthode | Spec | Description |
|----------|---------|------|-------------|
| `/.well-known/oauth-protected-resource` | GET | RFC 9728 (MUST) | PRM — pointe vers l'AS MnM |
| `/.well-known/oauth-authorization-server` | GET | RFC 8414 (MUST) | AS Metadata — liste les endpoints |
| `/oauth/authorize` | GET | OAuth 2.1 (MUST) | Authorization endpoint — consent screen |
| `/oauth/token` | POST | OAuth 2.1 (MUST) | Token endpoint — échange code PKCE → token |
| `/oauth/register` | POST | RFC 7591 (SHOULD) | Dynamic Client Registration |

### 3.2 Flow complet

```
1. Claude Code → POST /mcp (sans token)
2. MnM → 401 + WWW-Authenticate: Bearer resource_metadata="https://mnm/.well-known/oauth-protected-resource"
3. Claude Code → GET /.well-known/oauth-protected-resource
   → { resource: "https://mnm/mcp", authorization_servers: ["https://mnm/"], scopes_supported: ["mcp:read","mcp:write","mcp:admin"] }
4. Claude Code → GET /.well-known/oauth-authorization-server
   → { issuer: "https://mnm/", authorization_endpoint, token_endpoint, registration_endpoint, response_types_supported: ["code"], grant_types_supported: ["authorization_code","refresh_token"], code_challenge_methods_supported: ["S256"] }
5. Claude Code → POST /oauth/register (DCR)
   → { client_id, client_secret (si confidential), redirect_uris }
6. Claude Code → ouvre navigateur → /oauth/authorize?response_type=code&client_id=...&code_challenge=...&code_challenge_method=S256&scope=mcp:read+mcp:write&resource=https://mnm/mcp&redirect_uri=...&state=...
7. User se connecte (Better-Auth session) → consent screen (3 scopes) → valide
8. MnM → redirect vers callback avec ?code=...&state=...
9. Claude Code → POST /oauth/token { grant_type: "authorization_code", code, code_verifier, redirect_uri, client_id, resource: "https://mnm/mcp" }
   → { access_token (JWT 30min), refresh_token, token_type: "Bearer", expires_in: 1800, scope: "mcp:read mcp:write" }
10. Claude Code → POST /mcp + Authorization: Bearer <access_token> → ✅
```

### 3.3 Access token format (JWT)

```json
{
  "iss": "mnm-oauth",
  "sub": "<userId>",
  "aud": "https://mnm/mcp",
  "company_id": "<companyId>",
  "scope": "mcp:read mcp:write",
  "client_id": "<oauthClientId>",
  "jti": "<unique-id>",
  "iat": 1712592000,
  "exp": 1712593800
}
```

### 3.4 Agent JWT format (révisé)

```json
{
  "iss": "mnm-agent",
  "sub": "<agentId>",
  "company_id": "<companyId>",
  "run_id": "<heartbeatRunId>",
  "created_by": "<userId>",
  "jti": "<unique-id>",
  "iat": 1712592000,
  "exp": 1712599200
}
```

**Changements vs existant :**
- TTL réduit de 48h → 2h max
- `jti` obligatoire (UUID unique par token)
- `created_by` explicite pour résoudre les permissions du dev créateur
- Fail-fast au startup si `MNM_AGENT_JWT_SECRET` absent en mode `authenticated`

---

## 4. Prérequis — Contrats typés de permissions

### 4.1 `packages/shared/src/contracts/permissions.ts`

```typescript
export const PERMISSION_CATEGORIES = [
  "agents", "issues", "stories", "projects", "users",
  "workflows", "traces", "admin", "chat", "documents",
  "artifacts", "folders", "sandbox", "config_layers",
  "mcp", "feedback", "routines", "org", "inbox", "tasks",
] as const;

export type PermissionCategory = typeof PERMISSION_CATEGORIES[number];

export const PERMISSIONS = {
  AGENTS_CREATE: "agents:create",
  AGENTS_READ: "agents:read",
  AGENTS_EDIT: "agents:edit",
  AGENTS_LAUNCH: "agents:launch",
  AGENTS_CONFIGURE: "agents:configure",
  AGENTS_DELETE: "agents:delete",
  AGENTS_MANAGE: "agents:manage",
  AGENTS_MANAGE_KEYS: "agents:manage_keys",
  AGENTS_MANAGE_CONTAINERS: "agents:manage_containers",
  // ... les 77 permissions (exhaustif dans l'implémentation)
} as const;

export type PermissionSlug = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const PERMISSION_META: Record<PermissionSlug, {
  category: PermissionCategory;
  description: string;
  destructive: boolean;
}> = { /* ... */ };

// Mapping scopes OAuth → permissions
export const MCP_SCOPES = {
  READ: "mcp:read",
  WRITE: "mcp:write",
  ADMIN: "mcp:admin",
} as const;

export type McpScope = typeof MCP_SCOPES[keyof typeof MCP_SCOPES];

export const MCP_SCOPE_PERMISSIONS: Record<McpScope, PermissionSlug[]> = {
  [MCP_SCOPES.READ]: Object.values(PERMISSIONS).filter(p =>
    p.endsWith(":read") || p.endsWith(":list") ||
    ["dashboard:view", "org:view", "inbox:read"].includes(p)
  ),
  [MCP_SCOPES.WRITE]: Object.values(PERMISSIONS).filter(p =>
    p.endsWith(":create") || p.endsWith(":edit") || p.endsWith(":assign") ||
    p.endsWith(":launch") || p.endsWith(":configure") || p.endsWith(":attach") ||
    p.includes(":share_") || p.endsWith(":fork")
  ),
  [MCP_SCOPES.ADMIN]: Object.values(PERMISSIONS).filter(p =>
    p.endsWith(":delete") || p.endsWith(":manage") || p.includes(":manage_") ||
    p.endsWith(":enforce") || p.endsWith(":promote") || p.endsWith(":export") ||
    p.startsWith("company:") || p.startsWith("audit:") ||
    p.startsWith("roles:") || p.startsWith("tags:")
  ),
};
```

### 4.2 Impact sur l'existant

- `permission-seed.ts` → importe `PERMISSIONS` et `PERMISSION_META`, plus de strings inline
- `requirePermission(db, PERMISSIONS.AGENTS_READ)` dans toutes les routes
- `permission-validator.ts` → boot check : slugs DB === Object.values(PERMISSIONS)
- UI → importe `PermissionSlug` pour les checks client
- Test CI : vérifie qu'aucun `requirePermission()` n'utilise une string non-typée (lint rule ou grep)

---

## 5. Tools MCP

### 5.1 Conventions

| Aspect | Convention |
|--------|-----------|
| **Nommage** | `action_domain` sans préfixe : `list_issues`, `create_issue`, `get_agent`, `launch_agent` |
| **Granularité** | Tout granulaire. Pas de meta-tools groupés. 1 permission ≈ 1 tool. |
| **Description** | 3 lignes : (1) ce que ça fait, (2) quand l'utiliser, (3) contraintes |
| **Catégorie** | Préfixe dans la description : `[Agents]`, `[Issues]`, `[Projects]`... |
| **Pagination** | Tous les `list_*` : `limit` (default 25, max 100) + `cursor` + réponse avec `total`, `hasMore` |
| **Champs réduits** | Les `list_*` retournent un sous-ensemble de champs. Les `get_*` retournent tout. |
| **Annotations MCP** | `readOnlyHint`, `destructiveHint`, `openWorldHint` sur chaque tool |

### 5.2 Pattern déclaratif

```typescript
// tools/issues.tool.ts
import { PERMISSIONS } from "@mnm/shared/contracts/permissions";

export default defineMcpTools(({ tool, services }) => {
  tool("list_issues", {
    permissions: [PERMISSIONS.ISSUES_READ],
    description:
      "[Issues] List issues with optional filters by project, status, assignee, or label.\n" +
      "Use this to browse issues. For a single issue by ID, use get_issue instead.\n" +
      "Returns max 100 items per page. Supports cursor pagination.",
    input: z.object({
      projectId: z.string().uuid().optional(),
      status: z.string().optional(),
      assigneeId: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(25),
      cursor: z.string().optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const result = await services.issues.list(actor.companyId, {
        ...input,
        tagScope: actor.effectiveTags,
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            items: result.items.map(i => ({ id: i.id, title: i.title, status: i.status, assignee: i.assignee })),
            total: result.total,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          }),
        }],
      };
    },
  });

  tool("create_issue", {
    permissions: [PERMISSIONS.ISSUES_CREATE],
    description:
      "[Issues] Create a new issue in a project.\n" +
      "Requires a title. Description, labels, assignee are optional.\n" +
      "Returns the created issue with its ID.",
    input: z.object({
      projectId: z.string().uuid(),
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      labels: z.array(z.string()).optional(),
      assigneeId: z.string().uuid().optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
    handler: async ({ input, actor }) => {
      const issue = await services.issues.create(actor.companyId, actor.userId, input);
      return { content: [{ type: "text", text: JSON.stringify(issue) }] };
    },
  });

  tool("delete_issue", {
    permissions: [PERMISSIONS.ISSUES_DELETE],
    description:
      "[Issues] Permanently delete an issue. This cannot be undone.\n" +
      "Use with caution. Consider closing the issue instead.\n" +
      "Requires issues:delete permission.",
    input: z.object({ issueId: z.string().uuid() }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    handler: async ({ input, actor }) => {
      await services.issues.delete(actor.companyId, input.issueId);
      return { content: [{ type: "text", text: JSON.stringify({ deleted: true, issueId: input.issueId }) }] };
    },
  });
});
```

### 5.3 Wrapper automatique `defineMcpTools`

Le wrapper fournit automatiquement (le dev ne s'en occupe pas) :
- **Permission re-check** à chaque `tools/call` (defense in depth)
- **Tag scope injection** dans `actor.effectiveTags`
- **Audit logging** : émet `audit.mcp_tool_call` avec `{ toolName, actor, mcpSessionId, input, success, durationMs }`
- **Error handling** : catch toutes les erreurs, retourne `{ isError: true, content: [{ text: JSON.stringify({ error, code, retryable, hint }) }] }`
- **Timeout** : 30s par défaut par tool call

### 5.4 Tool bridge `get_context`

```typescript
// tools/context.tool.ts
tool("get_context", {
  permissions: [PERMISSIONS.PROJECTS_READ], // Permission minimale, affinée par type
  description:
    "[Context] Get rich context for any MnM entity (project, agent, issue, node).\n" +
    "Use this as your primary way to understand MnM entities.\n" +
    "Returns structured context with related data.",
  input: z.object({
    type: z.enum(["project", "agent", "issue", "node", "folder", "document", "chat"]),
    id: z.string().uuid(),
  }),
  annotations: { readOnlyHint: true },
  handler: async ({ input, actor }) => {
    // Dispatch vers le resource handler approprié
    const resource = await resourceRegistry.read(`mnm://${input.type}s/${input.id}`, actor);
    return { content: [{ type: "text", text: resource.text }] };
  },
});
```

### 5.5 Erreurs structurées

```typescript
// Codes d'erreur standardisés
type McpErrorCode =
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

// Format de réponse erreur
{
  isError: true,
  content: [{
    type: "text",
    text: JSON.stringify({
      error: "Issue not found",
      code: "NOT_FOUND",
      retryable: false,
      hint: "Check the issue ID. Use list_issues to find valid IDs."
    })
  }]
}
```

### 5.6 Liste des tools par domaine (exhaustif)

#### Agents (9 tools)
- `list_agents` (agents:read) — readOnly
- `get_agent` (agents:read) — readOnly
- `create_agent` (agents:create)
- `update_agent` (agents:edit)
- `delete_agent` (agents:delete) — destructive
- `launch_agent` (agents:launch)
- `configure_agent` (agents:configure)
- `get_agent_status` (agents:read) — readOnly, retourne runtime state + run en cours

#### Issues (6 tools)
- `list_issues` (issues:read) — readOnly, paginé
- `get_issue` (issues:read) — readOnly
- `create_issue` (issues:create)
- `update_issue` (issues:edit)
- `delete_issue` (issues:delete) — destructive
- `search_issues` (issues:read) — readOnly, recherche full-text

#### Projects (5 tools)
- `list_projects` (projects:read) — readOnly
- `get_project` (projects:read) — readOnly
- `create_project` (projects:create)
- `update_project` (projects:edit)
- `delete_project` (projects:delete) — destructive

#### Config Layers (6 tools)
- `list_config_layers` (config_layers:read) — readOnly
- `get_config_layer` (config_layers:read) — readOnly
- `create_config_layer` (config_layers:create)
- `update_config_layer` (config_layers:edit)
- `delete_config_layer` (config_layers:delete) — destructive
- `attach_config_layer` (config_layers:attach)

#### Workflows (5 tools)
- `list_workflows` (workflows:read) — readOnly
- `get_workflow` (workflows:read) — readOnly
- `create_workflow` (workflows:create)
- `delete_workflow` (workflows:delete) — destructive
- `start_workflow` (workflows:enforce)

#### Traces (4 tools)
- `list_traces` (traces:read) — readOnly, paginé
- `get_trace` (traces:read) — readOnly
- `export_traces` (traces:export)
- `get_dashboard` (dashboard:view) — readOnly

#### Chat (5 tools)
- `list_channels` (chat:read) — readOnly
- `get_channel` (chat:read) — readOnly, messages récents
- `create_channel` (chat:channel)
- `send_message` (chat:agent)
- `share_channel` (chat:share)

#### Documents (4 tools)
- `list_documents` (documents:read) — readOnly
- `get_document` (documents:read) — readOnly
- `upload_document` (documents:upload)
- `delete_document` (documents:delete) — destructive

#### Folders (5 tools)
- `list_folders` (folders:read) — readOnly
- `get_folder` (folders:read) — readOnly
- `create_folder` (folders:create)
- `update_folder` (folders:edit)
- `delete_folder` (folders:delete) — destructive

#### Artifacts (5 tools)
- `list_artifacts` (artifacts:read) — readOnly
- `get_artifact` (artifacts:read) — readOnly
- `create_artifact` (artifacts:create)
- `deploy_artifact` (artifacts:deploy)
- `delete_artifact` (artifacts:delete) — destructive

#### Sandbox (2 tools)
- `get_sandbox_status` (sandbox:read) — readOnly
- `manage_sandbox` (sandbox:manage)

#### Users (3 tools)
- `list_users` (users:read) — readOnly
- `invite_user` (users:invite)
- `manage_user` (users:manage)

#### Admin (6 tools)
- `list_roles` (roles:read) — readOnly
- `manage_role` (roles:manage)
- `list_tags` (tags:read) — readOnly
- `manage_tag` (tags:manage)
- `get_audit_log` (audit:read) — readOnly, paginé
- `export_audit` (audit:export)

#### A2A (3 tools)
- `list_a2a_messages` (agents:read) — readOnly
- `send_a2a_message` (agents:create)
- `manage_a2a_rules` (agents:manage)

#### Context (1 tool)
- `get_context` (varies) — readOnly, bridge vers resources

**Total : ~69 tools** (un Viewer en voit ~20, un Admin en voit ~69)

---

## 6. Resources MCP

### 6.1 URI scheme

Custom scheme `mnm://` conforme RFC 3986.

### 6.2 Resources statiques (listées dans resources/list)

| URI | Permissions | Description |
|-----|------------|-------------|
| `mnm://projects` | projects:read | Liste de tous les projets accessibles |
| `mnm://agents` | agents:read | Liste de tous les agents accessibles |

### 6.3 Resource templates (paramétrées)

| URI Template | Permissions | Description |
|-------------|------------|-------------|
| `mnm://projects/{projectId}` | projects:read | Contexte projet complet (description, health, agents, issues summary) |
| `mnm://agents/{agentId}` | agents:read | Agent avec sa config, runtime state, derniers runs |
| `mnm://agents/{agentId}/config` | config_layers:read | Config compilée de l'agent (layers mergées) |
| `mnm://nodes/{nodeId}` | projects:read | Node de la feature map avec ses enfants et liens |
| `mnm://issues/{issueId}` | issues:read | Issue complète avec comments, liens, traces |
| `mnm://folders/{folderId}` | folders:read | Folder avec ses documents et sous-folders |
| `mnm://documents/{documentId}` | documents:read | Document avec son contenu |
| `mnm://chat/{channelId}` | chat:read | Channel de chat avec messages récents (50 derniers) |
| `mnm://config-layers/{layerId}` | config_layers:read | Config layer avec ses items |
| `mnm://traces/{traceId}` | traces:read | Trace complète (gold + silver + bronze) |
| `mnm://artifacts/{artifactId}` | artifacts:read | Artifact avec ses versions |

### 6.4 Pattern déclaratif

```typescript
// resources/nodes.resource.ts
import { PERMISSIONS } from "@mnm/shared/contracts/permissions";

export default defineMcpResources(({ template, services }) => {
  template("mnm://nodes/{nodeId}", {
    permissions: [PERMISSIONS.PROJECTS_READ],
    name: "Node",
    description: "A node in the project feature map (feature, AC, requirement, module, etc.)",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const node = await services.nodes.get(actor.companyId, params.nodeId, {
        tagScope: actor.effectiveTags,
      });
      return {
        contents: [{
          uri: `mnm://nodes/${params.nodeId}`,
          mimeType: "application/json",
          text: JSON.stringify(node),
        }],
      };
    },
  });
});
```

---

## 7. Session management

### 7.1 Lifecycle

- **Création** : sur `InitializeRequest` (POST /mcp sans Mcp-Session-Id)
- **Identification** : `Mcp-Session-Id` header (UUID cryptographiquement sécurisé)
- **Timeout** : 30 min d'inactivité (humains), 2h (agents — tâches longues)
- **Terminaison** : HTTP DELETE /mcp avec Mcp-Session-Id, ou timeout
- **Reconnexion** : 404 sur session expirée → client refait InitializeRequest

### 7.2 McpServer par session

Chaque session crée un `new McpServer()` + `new StreamableHTTPServerTransport()` (pattern canonique du SDK). Les tools/resources sont filtrés par `effectivePermissions` + `effectiveTags` au moment de la création.

### 7.3 Lazy refresh des permissions

Pas de push `tools/list_changed` en temps réel. À chaque `tools/list` call, le registry re-filtre les tools selon les permissions actuelles (query access service, cache 5min). Si la liste a changé depuis le dernier call, la notification est incluse dans le stream de réponse.

### 7.4 Capabilities

```json
{
  "capabilities": {
    "tools": { "listChanged": true },
    "resources": { "subscribe": true, "listChanged": true }
  }
}
```

### 7.5 Limites

- Max 100 sessions simultanées (configurable)
- Sémaphore DB : max 15 queries MCP concurrentes
- Tool call timeout : 30s
- Pool DB : max 40 connexions (bump de 20)

---

## 8. Observabilité

### 8.1 Audit automatique

Chaque tool call MCP émet un audit event via le wrapper `defineMcpTools` :
```json
{
  "type": "mcp.tool_call",
  "source": "mcp",
  "actorId": "<userId ou agentId>",
  "actorType": "user | agent",
  "metadata": {
    "toolName": "create_issue",
    "mcpSessionId": "<session-id>",
    "transport": "streamable-http | sse",
    "durationMs": 142,
    "success": true,
    "inputSummary": { "projectId": "..." }
  }
}
```

### 8.2 Monitoring

- Event loop lag monitoring (`monitorEventLoopDelay`, alerte si p99 > 100ms)
- Sessions actives (gauge metric)
- Pool DB utilisation (connexions actives vs idle)
- Tool call latency (histogram par tool)
- Error rate par tool et par code d'erreur

---

## 9. Graceful shutdown

Séquence ajoutée au shutdown existant :
1. Stop accepting new MCP sessions
2. Envoyer SSE close event à toutes les sessions actives
3. Cleanup session manager (libérer mémoire)
4. PUIS fermer le HTTP server (séquence existante)

---

## 10. Sécurité — Checklist

| Contrôle | Implémentation |
|----------|---------------|
| Token re-validation chaque requête | Bearer token validé à chaque POST/GET, pas lié au session ID |
| Defense in depth | Permission check au listing ET à l'exécution |
| Tag isolation | `effectiveTags` injecté dans chaque query service |
| Rate limiting | Sémaphore + timeout par tool call |
| Pas de stack traces | Wrapper catch → message générique + log Sentry interne |
| Agent JWT sécurisé | TTL 2h, jti unique, fail-fast si secret absent |
| Token discriminateur | Claim `iss` (pas de cascade try/catch) |
| PKCE obligatoire | S256 uniquement, pas de plain |
| Audience validation | `aud` doit matcher l'URL du MCP server |
| Origin validation | Streamable HTTP : valider le header Origin |

---

## 11. Dépendances nouvelles

| Package | Version | Usage |
|---------|---------|-------|
| `@modelcontextprotocol/sdk` | latest | McpServer, StreamableHTTPServerTransport, SSEServerTransport, types |

Ajouté dans `server/package.json`.

---

## 12. Hors scope (V2+)

- Prompts MCP (templates pré-écrits)
- Resource subscriptions (notifications push quand une resource change)
- Resumability SSE (event IDs + Last-Event-ID)
- IdP externe configurable (Keycloak, Authentik)
- MCP server extractible en process séparé

---

*Spec MnM MCP Server — 2026-04-08 — Prêt pour implementation plan*
