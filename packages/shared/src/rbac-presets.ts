import type { BusinessRole, PermissionKey } from "./constants.js";

/**
 * Matrice de presets : chaque businessRole a un ensemble de permissions par defaut.
 * Ces presets sont utilises comme fallback quand aucun grant explicite n'existe
 * dans principal_permission_grants.
 *
 * Un grant explicite (present dans principal_permission_grants) a TOUJOURS priorite
 * sur le preset. Le preset accorde la permission sans scope (acces global company-wide).
 *
 * Source de verite : ADR-002 (Architecture B2B)
 */
export const ROLE_PERMISSION_PRESETS: Record<BusinessRole, readonly PermissionKey[]> = {
  admin: [
    // Admin a TOUTES les permissions (22/22)
    "agents:create",
    "agents:launch",
    "agents:manage_containers",
    "users:invite",
    "users:manage_permissions",
    "tasks:assign",
    "tasks:assign_scope",
    "joins:approve",
    "projects:create",
    "projects:manage_members",
    "workflows:create",
    "workflows:enforce",
    "company:manage_settings",
    "company:manage_sso",
    "audit:read",
    "audit:export",
    "stories:create",
    "stories:edit",
    "dashboard:view",
    "chat:agent",
    "traces:read",
    "traces:write",
  ],

  manager: [
    // Manager : gestion courante, pas d'admin systeme (16/22)
    // Exclut : users:manage_permissions, tasks:assign_scope, agents:manage_containers,
    //          company:manage_settings, company:manage_sso, audit:export
    "agents:create",
    "agents:launch",
    "users:invite",
    "tasks:assign",
    "joins:approve",
    "projects:create",
    "projects:manage_members",
    "workflows:create",
    "workflows:enforce",
    "audit:read",
    "stories:create",
    "stories:edit",
    "dashboard:view",
    "chat:agent",
    "traces:read",
    "traces:write",
  ],

  contributor: [
    // Contributor : productivite quotidienne (6/22)
    "agents:launch",
    "tasks:assign",
    "stories:create",
    "stories:edit",
    "chat:agent",
    "traces:read",
  ],

  viewer: [
    // Viewer : lecture seule (3/22)
    "audit:read",
    "dashboard:view",
    "traces:read",
  ],
} as const;

/**
 * Verifie si une permission est incluse dans le preset d'un businessRole.
 */
export function isPermissionInPreset(
  businessRole: BusinessRole,
  permissionKey: PermissionKey,
): boolean {
  const preset = ROLE_PERMISSION_PRESETS[businessRole];
  return preset.includes(permissionKey);
}

/**
 * Retourne la liste des permissions par defaut d'un businessRole.
 */
export function getPresetPermissions(businessRole: BusinessRole): readonly PermissionKey[] {
  return ROLE_PERMISSION_PRESETS[businessRole];
}

/**
 * Retourne la matrice complete de presets sous forme serializeable
 * (pour l'endpoint API GET /api/companies/:companyId/rbac/presets).
 */
export function getPresetsMatrix(): Record<string, readonly PermissionKey[]> {
  return { ...ROLE_PERMISSION_PRESETS };
}
