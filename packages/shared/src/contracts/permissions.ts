/**
 * Typed permission contracts — single source of truth for all permission slugs.
 * Imported by: permission-seed.ts, requirePermission(), MCP tools, UI.
 * Build-time safety: PermissionSlug is a string literal union type.
 */

export const PERMISSION_CATEGORIES = [
  "agents", "issues", "stories", "projects", "users",
  "workflows", "traces", "dashboard", "admin", "chat",
  "documents", "artifacts", "folders", "sandbox", "config",
  "feedback", "routines", "org", "inbox",
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
  [PERMISSIONS.TASKS_ASSIGN]: { category: "issues", description: "Assigner des tâches", destructive: false },
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
