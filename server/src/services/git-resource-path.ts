export type ResourceType = "agent" | "workflow";

type ResourceTypeKey = "agents" | "workflows";

const RESOURCE_TYPE_TO_KEY: Record<ResourceType, ResourceTypeKey> = {
  agent: "agents",
  workflow: "workflows",
};

export interface ProviderWithPaths {
  paths?: Partial<Record<ResourceTypeKey, string>>;
}

function rejectTraversal(label: string, value: string): void {
  if (value.startsWith("/")) {
    throw new Error(`resolveResourcePath: invalid ${label} '${value}' (absolute paths are not allowed)`);
  }
  if (value.split("/").includes("..")) {
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
