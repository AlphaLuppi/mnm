import type { McpToolDefinition, McpActor } from "./types.js";

export class ToolRegistry {
  private tools: McpToolDefinition[] = [];

  register(tools: McpToolDefinition[]) {
    this.tools.push(...tools);
  }

  listForActor(actor: McpActor): McpToolDefinition[] {
    return this.tools.filter((tool) =>
      tool.permissions.every((perm) => actor.effectivePermissions.has(perm)),
    );
  }

  findForActor(name: string, actor: McpActor): McpToolDefinition | null {
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) return null;
    if (!tool.permissions.every((perm) => actor.effectivePermissions.has(perm))) return null;
    return tool;
  }

  get allTools(): McpToolDefinition[] {
    return this.tools;
  }
}
