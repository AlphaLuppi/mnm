import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_agents", {
    permissions: [PERMISSIONS.AGENTS_READ],
    description:
      "[Agents] List all active agents in the company.\n" +
      "Returns non-terminated agents by default.",
    input: z.object({
      includeTerminated: z.boolean().optional().describe("Include terminated agents (default false)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const items = await services.agents.list(actor.companyId, {
        includeTerminated: input.includeTerminated,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: items.map((a: any) => ({
              id: a.id,
              name: a.name,
              title: a.title,
              status: a.status,
              urlKey: a.urlKey,
              reportsTo: a.reportsTo,
              adapterType: a.adapterType,
            })),
            total: items.length,
          }),
        }],
      };
    },
  });

  tool("get_agent", {
    permissions: [PERMISSIONS.AGENTS_READ],
    description:
      "[Agents] Get a single agent by ID with full details.",
    input: z.object({
      agentId: z.string().uuid().describe("The agent ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const agent = await services.agents.getById(input.agentId);
      if (!agent || agent.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Agent not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: agent.id,
            name: agent.name,
            title: agent.title,
            status: agent.status,
            urlKey: agent.urlKey,
            reportsTo: agent.reportsTo,
            adapterType: agent.adapterType,
            capabilities: agent.capabilities,
            budgetMonthlyCents: agent.budgetMonthlyCents,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt,
          }),
        }],
      };
    },
  });
});
