export type NormalizedAgentPermissions = Record<string, unknown> & {
  canCreateAgents: boolean;
  permissionSlugs: string[];
};

export function defaultAgentPermissions(): NormalizedAgentPermissions {
  return {
    canCreateAgents: false,
    permissionSlugs: [],
  };
}

export function normalizeAgentPermissions(
  permissions: unknown,
): NormalizedAgentPermissions {
  const defaults = defaultAgentPermissions();
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return defaults;
  }

  const record = permissions as Record<string, unknown>;
  return {
    canCreateAgents:
      typeof record.canCreateAgents === "boolean"
        ? record.canCreateAgents
        : defaults.canCreateAgents,
    permissionSlugs:
      Array.isArray(record.permissionSlugs) &&
      record.permissionSlugs.every((s) => typeof s === "string")
        ? (record.permissionSlugs as string[])
        : defaults.permissionSlugs,
  };
}
