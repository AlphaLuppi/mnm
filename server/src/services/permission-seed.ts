import { eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { permissions } from "@mnm/db";

/**
 * Standard permission definitions seeded at company creation.
 * These are the platform capabilities — clients can add custom ones later.
 */
const SEED_PERMISSIONS: Array<{ slug: string; description: string; category: string }> = [
  // Agents
  { slug: "agents:create", description: "Créer un nouvel agent", category: "agents" },
  { slug: "agents:launch", description: "Lancer un agent run", category: "agents" },
  { slug: "agents:configure", description: "Modifier la config d'un agent", category: "agents" },
  { slug: "agents:delete", description: "Supprimer un agent", category: "agents" },
  { slug: "agents:manage_containers", description: "Gérer les containers/sandboxes des agents", category: "agents" },

  // Issues / Tasks
  { slug: "issues:create", description: "Créer une issue", category: "issues" },
  { slug: "issues:assign", description: "Assigner une issue", category: "issues" },
  { slug: "issues:delete", description: "Supprimer une issue", category: "issues" },
  { slug: "tasks:assign", description: "Assigner des tâches", category: "issues" },

  // Stories
  { slug: "stories:create", description: "Créer une story", category: "stories" },
  { slug: "stories:edit", description: "Modifier une story", category: "stories" },

  // Projects
  { slug: "projects:create", description: "Créer un projet", category: "projects" },
  { slug: "projects:manage", description: "Gérer un projet", category: "projects" },
  { slug: "projects:manage_members", description: "Gérer les membres d'un projet", category: "projects" },

  // Users
  { slug: "users:invite", description: "Inviter des utilisateurs", category: "users" },
  { slug: "users:manage", description: "Gérer les rôles/tags des utilisateurs", category: "users" },
  { slug: "users:manage_permissions", description: "Gérer les permissions individuelles", category: "users" },
  { slug: "joins:approve", description: "Approuver les demandes d'adhésion", category: "users" },

  // Workflows
  { slug: "workflows:create", description: "Créer un workflow template", category: "workflows" },
  { slug: "workflows:enforce", description: "Activer/désactiver l'enforcement", category: "workflows" },

  // Observability
  { slug: "traces:read", description: "Voir les traces", category: "traces" },
  { slug: "traces:write", description: "Écrire des traces", category: "traces" },
  { slug: "traces:manage", description: "Gérer les prompts gold, lenses", category: "traces" },
  { slug: "dashboard:view", description: "Voir le dashboard", category: "dashboard" },

  // Admin
  { slug: "company:manage_settings", description: "Paramètres de l'instance", category: "admin" },
  { slug: "company:manage_sso", description: "Configurer SSO", category: "admin" },
  { slug: "audit:read", description: "Lire l'audit log", category: "admin" },
  { slug: "audit:export", description: "Exporter l'audit log", category: "admin" },
  { slug: "roles:manage", description: "Créer/modifier les rôles", category: "admin" },
  { slug: "tags:manage", description: "Créer/modifier les tags", category: "admin" },

  // Chat
  { slug: "chat:agent", description: "Discuter avec les agents", category: "chat" },
  { slug: "chat:channel", description: "Créer des channels", category: "chat" },

  // Sandbox
  { slug: "sandbox:manage", description: "Gérer les sandboxes", category: "sandbox" },

  // Config Layers
  { slug: "config_layers:create", description: "Créer des config layers", category: "config" },
  { slug: "config_layers:edit", description: "Modifier des config layers", category: "config" },
  { slug: "config_layers:delete", description: "Supprimer des config layers", category: "config" },
  { slug: "config_layers:read", description: "Voir les config layers", category: "config" },
  { slug: "config_layers:manage", description: "Gérer les config layers company/enforced", category: "config" },
  { slug: "config_layers:promote", description: "Approuver/rejeter les promotions de layers", category: "config" },
  { slug: "config_layers:attach", description: "Attacher des layers aux agents", category: "config" },
  { slug: "mcp:connect", description: "Connecter des credentials MCP", category: "config" },
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
