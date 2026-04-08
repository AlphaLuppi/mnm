import type { McpResourceDefinition, McpResourceResult, McpActor } from "./types.js";

/**
 * Matches a URI against a URI template like `mnm://{type}/{id}`.
 * Returns extracted params or null if no match.
 */
export function matchUriTemplate(
  template: string,
  uri: string,
): Record<string, string> | null {
  // Convert template to regex: `{name}` -> `(?<name>[^/]+)`
  const paramNames: string[] = [];
  const regexStr = template.replace(/\{([^}]+)\}/g, (_match, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });

  const regex = new RegExp(`^${regexStr}$`);
  const match = uri.match(regex);
  if (!match) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < paramNames.length; i++) {
    params[paramNames[i]!] = match[i + 1]!;
  }
  return params;
}

export class ResourceRegistry {
  private resources: McpResourceDefinition[] = [];

  register(resources: McpResourceDefinition[]) {
    this.resources.push(...resources);
  }

  listForActor(actor: McpActor): McpResourceDefinition[] {
    return this.resources.filter((resource) =>
      resource.permissions.every((perm) => actor.effectivePermissions.has(perm)),
    );
  }

  async read(uri: string, actor: McpActor): Promise<McpResourceResult | null> {
    for (const resource of this.resources) {
      const params = matchUriTemplate(resource.uriTemplate, uri);
      if (!params) continue;

      // Check permissions
      if (!resource.permissions.every((perm) => actor.effectivePermissions.has(perm))) {
        return null;
      }

      return resource.handler({ uri, params, actor });
    }
    return null;
  }

  /** Match a URI against registered templates (exposed for mcp/index.ts). */
  matchUri(template: string, uri: string): Record<string, string> | null {
    return matchUriTemplate(template, uri);
  }

  get allResources(): McpResourceDefinition[] {
    return this.resources;
  }
}
