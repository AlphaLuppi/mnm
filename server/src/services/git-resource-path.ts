export type ResourceType = "agent" | "workflow";

type ResourceTypeKey = "agents" | "workflows";

const RESOURCE_TYPE_TO_KEY: Record<ResourceType, ResourceTypeKey> = {
  agent: "agents",
  workflow: "workflows",
};

export interface ProviderWithPaths {
  paths?: Partial<Record<ResourceTypeKey, string>>;
}

// Defense-in-depth path-component validator. Used by resolveResourcePath and
// directly by services that build subtree paths from client-supplied names
// (e.g. resolveWorkflowDir in governed-workflow-files.ts).
//
// Rules:
// - No absolute paths (`/foo`).
// - No `..` traversal segment (after URL-decoding to catch `%2E%2E` smuggling).
// - No backslash separators (Windows-style) — git treats `\\` literally on
//   Linux but cross-platform clients sometimes send them and providers may
//   interpret them inconsistently.
export function rejectTraversal(label: string, value: string): void {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  if (decoded.startsWith("/")) {
    throw new Error(`resolveResourcePath: invalid ${label} '${value}' (absolute paths are not allowed)`);
  }
  if (decoded.includes("\\")) {
    throw new Error(`resolveResourcePath: invalid ${label} '${value}' (backslash separators are not allowed)`);
  }
  if (decoded.split("/").includes("..")) {
    throw new Error(`resolveResourcePath: invalid ${label} '${value}' (traversal segment '..' is not allowed)`);
  }
}

export function resolveResourcePath(
  provider: ProviderWithPaths,
  resourceType: ResourceType,
  name: string,
  file: string,
): string {
  const key = RESOURCE_TYPE_TO_KEY[resourceType];
  const base = provider.paths?.[key] ?? "";
  rejectTraversal("paths prefix", base);
  rejectTraversal("name", name);
  rejectTraversal("file", file);
  return base === "" ? `${name}/${file}` : `${base}/${name}/${file}`;
}
