import { eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { permissions, companies, roles } from "@mnm/db";
import { ALL_PERMISSION_SLUGS, PERMISSION_META, type PermissionSlug } from "@mnm/shared";
import { logger } from "../middleware/logger.js";

/**
 * Standard permission definitions seeded at company creation.
 * Derived from the typed contracts in @mnm/shared — single source of truth.
 */
const SEED_PERMISSIONS: Array<{ slug: PermissionSlug; description: string; category: string }> =
  ALL_PERMISSION_SLUGS.map((slug) => ({
    slug,
    description: PERMISSION_META[slug].description,
    category: PERMISSION_META[slug].category,
  }));

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
