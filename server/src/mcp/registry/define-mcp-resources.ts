import type { PermissionSlug } from "@mnm/shared";
import type { McpResourceDefinition, McpResourceResult, McpActor, McpServices } from "./types.js";

interface ResourceConfig {
  permissions: PermissionSlug[];
  name: string;
  description: string;
  mimeType: string;
  handler: (ctx: { uri: string; params: Record<string, string>; actor: McpActor }) => Promise<McpResourceResult>;
}

interface ResourceRegistrar {
  services: McpServices;
  template: (uriTemplate: string, config: ResourceConfig) => void;
}

type ResourceDefiner = (registrar: ResourceRegistrar) => void;

export function defineMcpResources(definer: ResourceDefiner) {
  return definer;
}

export function collectResources(
  definer: ResourceDefiner,
  services: McpServices,
): McpResourceDefinition[] {
  const resources: McpResourceDefinition[] = [];

  const registrar: ResourceRegistrar = {
    services,
    template(uriTemplate, config) {
      resources.push({ uriTemplate, ...config });
    },
  };

  definer(registrar);
  return resources;
}
