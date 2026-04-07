import { eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { permissions, companies, roles } from "@mnm/db";
import { logger } from "../middleware/logger.js";

/**
 * Standard permission definitions seeded at company creation.
 * These are the platform capabilities — clients can add custom ones later.
 */
const SEED_PERMISSIONS: Array<{ slug: string; description: string; category: string }> = [
  // Agents
  { slug: "agents:create", description: "Créer un nouvel agent", category: "agents" },
  { slug: "agents:read", description: "Voir la liste et les détails des agents", category: "agents" },
  { slug: "agents:edit", description: "Modifier les agents dans son scope", category: "agents" },
  { slug: "agents:launch", description: "Lancer un agent run", category: "agents" },
  { slug: "agents:configure", description: "Modifier la config d'un agent", category: "agents" },
  { slug: "agents:delete", description: "Supprimer un agent", category: "agents" },
  { slug: "agents:manage", description: "Gérer TOUS les agents (bypass tag scope)", category: "agents" },
  { slug: "agents:manage_keys", description: "Créer/révoquer les clés API des agents", category: "agents" },
  { slug: "agents:manage_containers", description: "Gérer les containers/sandboxes des agents", category: "agents" },

  // Issues / Tasks
  { slug: "issues:create", description: "Créer une issue", category: "issues" },
  { slug: "issues:read", description: "Voir la liste et les détails des issues", category: "issues" },
  { slug: "issues:edit", description: "Modifier les issues dans son scope", category: "issues" },
  { slug: "issues:assign", description: "Assigner une issue", category: "issues" },
  { slug: "issues:delete", description: "Supprimer une issue", category: "issues" },
  { slug: "issues:manage", description: "Gérer TOUTES les issues (bypass tag scope)", category: "issues" },
  { slug: "tasks:assign", description: "Assigner des tâches", category: "issues" },

  // Stories
  { slug: "stories:create", description: "Créer une story", category: "stories" },
  { slug: "stories:edit", description: "Modifier une story", category: "stories" },

  // Projects
  { slug: "projects:create", description: "Créer un projet", category: "projects" },
  { slug: "projects:read", description: "Voir la liste des projets", category: "projects" },
  { slug: "projects:edit", description: "Modifier les projets dans son scope", category: "projects" },
  { slug: "projects:delete", description: "Supprimer des projets", category: "projects" },
  { slug: "projects:manage", description: "Gérer un projet", category: "projects" },
  { slug: "projects:manage_members", description: "Gérer les membres d'un projet", category: "projects" },

  // Users
  { slug: "users:invite", description: "Inviter des utilisateurs", category: "users" },
  { slug: "users:manage", description: "Gérer les rôles/tags des utilisateurs", category: "users" },
  { slug: "users:manage_permissions", description: "Gérer les permissions individuelles", category: "users" },
  { slug: "joins:approve", description: "Approuver les demandes d'adhésion", category: "users" },

  // Workflows
  { slug: "workflows:create", description: "Créer un workflow template", category: "workflows" },
  { slug: "workflows:read", description: "Voir les workflows", category: "workflows" },
  { slug: "workflows:delete", description: "Supprimer des workflows", category: "workflows" },
  { slug: "workflows:enforce", description: "Activer/désactiver l'enforcement", category: "workflows" },
  { slug: "workflows:manage", description: "Gérer TOUS les workflows", category: "workflows" },

  // Observability
  { slug: "traces:read", description: "Voir les traces", category: "traces" },
  { slug: "traces:write", description: "Écrire des traces", category: "traces" },
  { slug: "traces:manage", description: "Gérer les prompts gold, lenses", category: "traces" },
  { slug: "traces:export", description: "Exporter les traces", category: "traces" },
  { slug: "dashboard:view", description: "Voir le dashboard", category: "dashboard" },

  // Admin
  { slug: "company:manage_settings", description: "Paramètres de l'instance", category: "admin" },
  { slug: "company:manage_sso", description: "Configurer SSO", category: "admin" },
  { slug: "company:delete", description: "Supprimer la company", category: "admin" },
  { slug: "audit:read", description: "Lire l'audit log", category: "admin" },
  { slug: "audit:export", description: "Exporter l'audit log", category: "admin" },
  { slug: "roles:read", description: "Voir les rôles", category: "admin" },
  { slug: "roles:manage", description: "Créer/modifier les rôles", category: "admin" },
  { slug: "tags:read", description: "Voir les tags", category: "admin" },
  { slug: "tags:manage", description: "Créer/modifier les tags", category: "admin" },

  // Chat
  { slug: "chat:agent", description: "Discuter avec les agents", category: "chat" },
  { slug: "chat:read", description: "Voir les channels de chat", category: "chat" },
  { slug: "chat:channel", description: "Créer des channels", category: "chat" },
  { slug: "chat:share", description: "Partager un chat", category: "chat" },
  { slug: "chat:fork", description: "Fork un chat partagé", category: "chat" },
  { slug: "chat:manage", description: "Gérer TOUS les chats", category: "chat" },

  // Documents
  { slug: "documents:upload", description: "Upload des documents", category: "documents" },
  { slug: "documents:read", description: "Voir les documents", category: "documents" },
  { slug: "documents:delete", description: "Supprimer des documents", category: "documents" },
  { slug: "documents:manage", description: "Gérer TOUS les documents", category: "documents" },

  // Artifacts
  { slug: "artifacts:create", description: "Créer des artefacts", category: "artifacts" },
  { slug: "artifacts:read", description: "Voir les artefacts", category: "artifacts" },
  { slug: "artifacts:edit", description: "Éditer des artefacts", category: "artifacts" },
  { slug: "artifacts:deploy", description: "Déployer des artefacts", category: "artifacts" },
  { slug: "artifacts:delete", description: "Supprimer des artefacts", category: "artifacts" },
  { slug: "artifacts:manage", description: "Gérer TOUS les artefacts", category: "artifacts" },

  // Folders
  { slug: "folders:create", description: "Créer des folders", category: "folders" },
  { slug: "folders:read", description: "Voir les folders", category: "folders" },
  { slug: "folders:edit", description: "Modifier ses folders", category: "folders" },
  { slug: "folders:delete", description: "Supprimer ses folders", category: "folders" },
  { slug: "folders:share_users", description: "Partager un folder à des utilisateurs", category: "folders" },
  { slug: "folders:share_tags", description: "Assigner des tags à un folder", category: "folders" },
  { slug: "folders:manage", description: "Gérer TOUS les folders", category: "folders" },

  // Sandbox
  { slug: "sandbox:read", description: "Voir le statut de sa sandbox", category: "sandbox" },
  { slug: "sandbox:manage", description: "Gérer les sandboxes", category: "sandbox" },

  // Config Layers
  { slug: "config_layers:create", description: "Créer des config layers", category: "config" },
  { slug: "config_layers:edit", description: "Modifier des config layers", category: "config" },
  { slug: "config_layers:delete", description: "Supprimer des config layers", category: "config" },
  { slug: "config_layers:read", description: "Voir les config layers", category: "config" },
  { slug: "config_layers:manage", description: "Gérer les config layers company/enforced", category: "config" },
  { slug: "config_layers:promote", description: "Approuver/rejeter les promotions de layers", category: "config" },
  { slug: "config_layers:attach", description: "Attacher des layers aux agents", category: "config" },
  { slug: "mcp:connect", description: "Connecter des credentials (MCP, git providers)", category: "config" },
  { slug: "mcp:manage", description: "Gérer TOUTES les credentials (MCP, git providers)", category: "config" },

  // Users (additional)
  { slug: "users:read", description: "Voir la liste des utilisateurs", category: "users" },
  { slug: "users:remove", description: "Retirer des utilisateurs de la company", category: "users" },

  // Feedback
  { slug: "feedback:read", description: "Voir et voter sur les feedbacks", category: "feedback" },
  { slug: "feedback:manage", description: "Gérer les catégories de feedback", category: "feedback" },

  // Routines
  { slug: "routines:read", description: "Voir les routines", category: "routines" },
  { slug: "routines:create", description: "Créer et modifier des routines", category: "routines" },
  { slug: "routines:delete", description: "Supprimer des routines", category: "routines" },
  { slug: "routines:manage", description: "Gérer TOUTES les routines", category: "routines" },

  // Org
  { slug: "org:view", description: "Voir l'organigramme", category: "org" },

  // Inbox
  { slug: "inbox:read", description: "Voir la boîte de réception", category: "inbox" },
];

/**
 * Seeds the standard permissions for a company.
 * Idempotent — uses ON CONFLICT DO NOTHING.
 */
export async function seedPermissions(db: Db, companyId: string): Promise<void> {
  const values = SEED_PERMISSIONS.map((p) => ({
    companyId,
    slug: p.slug,
    description: p.description,
    category: p.category,
    isCustom: false,
  }));

  await db.insert(permissions).values(values).onConflictDoNothing();
}

/**
 * Returns all permission slugs for a company (standard + custom).
 */
export async function listPermissionSlugs(db: Db, companyId: string): Promise<Set<string>> {
  const rows = await db
    .select({ slug: permissions.slug })
    .from(permissions)
    .where(eq(permissions.companyId, companyId));
  return new Set(rows.map((r) => r.slug));
}

/**
 * Returns the seed permission definitions (for use in onboarding presets).
 */
export function getSeedPermissions() {
  return SEED_PERMISSIONS;
}

/**
 * Returns all permission slugs from the seed set (for startup validation).
 */
export function getSeedPermissionSlugs(): Set<string> {
  return new Set(SEED_PERMISSIONS.map((p) => p.slug));
}

// ---------------------------------------------------------------------------
// Default role presets
// ---------------------------------------------------------------------------

/** All :read/:view permissions */
export const VIEWER_PERMS: string[] = [
  "agents:read",
  "issues:read",
  "projects:read",
  "workflows:read",
  "chat:read",
  "artifacts:read",
  "documents:read",
  "folders:read",
  "config_layers:read",
  "traces:read",
  "dashboard:view",
  "sandbox:read",
  "roles:read",
  "tags:read",
  "feedback:read",
  "routines:read",
  "org:view",
  "inbox:read",
  "users:read",
];

/** Contributor = Viewer + create/edit + day-to-day work permissions */
export const CONTRIBUTOR_PERMS: string[] = [
  ...VIEWER_PERMS,
  // Agents
  "agents:create",
  "agents:edit",
  "agents:launch",
  "agents:configure",
  // Issues
  "issues:create",
  "issues:edit",
  "issues:assign",
  "tasks:assign",
  // Projects
  "projects:create",
  "projects:edit",
  // Workflows
  "workflows:create",
  // Stories
  "stories:create",
  "stories:edit",
  // Chat
  "chat:agent",
  "chat:channel",
  "chat:fork",
  // Documents
  "documents:upload",
  "documents:delete",
  // Artifacts
  "artifacts:create",
  "artifacts:edit",
  // Folders
  "folders:create",
  "folders:edit",
  "folders:delete",
  "folders:share_users",
  "folders:share_tags",
  // Config
  "config_layers:create",
  "config_layers:edit",
  "config_layers:attach",
  "mcp:connect",
  // Traces
  "traces:write",
  // Routines
  "routines:create",
  // Feedback
  "feedback:read",
];

/** Manager = Contributor + delete/manage (non-admin) + user management */
export const MANAGER_PERMS: string[] = [
  ...CONTRIBUTOR_PERMS,
  // Agents
  "agents:delete",
  "agents:manage",
  "agents:manage_keys",
  "agents:manage_containers",
  // Issues
  "issues:delete",
  "issues:manage",
  // Projects
  "projects:delete",
  "projects:manage",
  "projects:manage_members",
  // Workflows
  "workflows:delete",
  "workflows:manage",
  "workflows:enforce",
  // Chat
  "chat:share",
  "chat:manage",
  // Documents
  "documents:manage",
  // Artifacts
  "artifacts:deploy",
  "artifacts:delete",
  "artifacts:manage",
  // Folders
  "folders:manage",
  // Config
  "config_layers:delete",
  "config_layers:manage",
  "config_layers:promote",
  "mcp:manage",
  // Traces
  "traces:manage",
  "traces:export",
  // Users
  "users:invite",
  "joins:approve",
  "users:manage",
  // Routines
  "routines:delete",
  "routines:manage",
  // Feedback
  "feedback:manage",
  // Sandbox
  "sandbox:manage",
  // Audit
  "audit:read",
];

/** Admin = everything except company:delete */
export const ADMIN_PERMS: string[] = SEED_PERMISSIONS
  .map((p) => p.slug)
  .filter((s) => s !== "company:delete");

/** Owner = everything */
export const OWNER_PERMS: string[] = SEED_PERMISSIONS.map((p) => p.slug);

export interface RolePreset {
  slug: string;
  name: string;
  description: string;
  hierarchyLevel: number;
  bypassTagFilter: boolean;
  permSlugs: string[];
}

export const DEFAULT_ROLES: RolePreset[] = [
  {
    slug: "viewer",
    name: "Viewer",
    description: "Lecture seule — voir les agents, issues, traces, etc.",
    hierarchyLevel: 10,
    bypassTagFilter: false,
    permSlugs: VIEWER_PERMS,
  },
  {
    slug: "contributor",
    name: "Contributor",
    description: "Créer et modifier les ressources dans son scope",
    hierarchyLevel: 30,
    bypassTagFilter: false,
    permSlugs: CONTRIBUTOR_PERMS,
  },
  {
    slug: "manager",
    name: "Manager",
    description: "Gérer les ressources + inviter/gérer les utilisateurs",
    hierarchyLevel: 60,
    bypassTagFilter: false,
    permSlugs: MANAGER_PERMS,
  },
  {
    slug: "admin",
    name: "Admin",
    description: "Accès complet sauf suppression de la company",
    hierarchyLevel: 90,
    bypassTagFilter: true,
    permSlugs: ADMIN_PERMS,
  },
  {
    slug: "owner",
    name: "Owner",
    description: "Accès complet — propriétaire de l'instance",
    hierarchyLevel: 100,
    bypassTagFilter: true,
    permSlugs: OWNER_PERMS,
  },
];

// ---------------------------------------------------------------------------
// Backfill: ensure all existing companies have up-to-date permission slugs
// ---------------------------------------------------------------------------

/**
 * Backfills permission slugs for ALL existing companies.
 * Does NOT create roles — roles are chosen by the admin at onboarding.
 * Idempotent — safe to run on every startup.
 */
export async function backfillPermissions(db: Db): Promise<void> {
  const allCompanies = await db
    .select({ id: companies.id })
    .from(companies);

  if (allCompanies.length === 0) {
    logger.info("permission backfill: no companies found, skipping");
    return;
  }

  logger.info({ count: allCompanies.length }, "permission backfill: starting");

  for (const company of allCompanies) {
    await seedPermissions(db, company.id);
    logger.debug({ companyId: company.id }, "permission backfill: company done");
  }

  // Remove isSystem flag from all roles — roles are user-managed, not locked
  await db.update(roles).set({ isSystem: false }).where(eq(roles.isSystem, true));
  logger.info("permission backfill: cleared isSystem flag on all roles");

  logger.info({ count: allCompanies.length }, "permission backfill: complete");
}
