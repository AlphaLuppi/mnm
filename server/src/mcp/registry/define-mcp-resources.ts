import type { PermissionSlug } from "@mnm/shared";
import type { McpResourceDefinition, McpResourceResult, McpActor, McpServices } from "./types.js";

interface ResourceConfig {
  permissions: PermissionSlug[];
  name: string;
  description: string;
  mimeType: string;
  handler: (ctx: { uri: string; params: Record<string, string>; actor: McpActor }) => Promise<McpResourceResult>;
}

export interface ResourceRegistrar {
  services: McpServices;
  template: (uriTemplate: string, config: ResourceConfig) => void;
}

export type ResourceDefiner = (registrar: ResourceRegistrar) => void;

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
      const wrappedHandler: McpResourceDefinition["handler"] = async (ctx) => {
        try {
          return await Promise.race([
            config.handler(ctx),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Resource read timeout")), 30_000),
            ),
          ]);
        } catch (err: any) {
          return {
            contents: [{
              uri: ctx.uri,
              mimeType: "application/json",
              text: JSON.stringify({ error: err.message ?? "Internal error", code: "INTERNAL_ERROR" }),
            }],
          };
        }
      };
      resources.push({ uriTemplate, ...config, handler: wrappedHandler });
    },
  };

  definer(registrar);
  return resources;
}
