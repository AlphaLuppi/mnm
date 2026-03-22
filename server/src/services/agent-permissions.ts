export type NormalizedAgentPermissions = Record<string, unknown> & {
  canCreateAgents: boolean;
};

export function defaultAgentPermissions(): NormalizedAgentPermissions {
  return {
    canCreateAgents: false,
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
  };
}
