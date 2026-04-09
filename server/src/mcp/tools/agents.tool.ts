import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { encodeCursor, decodeCursor } from "./_pagination.js";

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

  tool("create_agent", {
    permissions: [PERMISSIONS.AGENTS_CREATE],
    description:
      "[Agents] Create a new agent in the company.\n" +
      "Use when onboarding a new AI agent. Adapter type defaults to 'claude_local'.\n" +
      "Name must be unique within the company (auto-deduplicated if collision).",
    input: z.object({
      name: z.string().min(1).describe("Agent name"),
      title: z.string().optional().describe("Agent job title"),
      adapterType: z.string().optional().describe("Adapter type (default: claude_local)"),
      reportsTo: z.string().uuid().optional().describe("Manager agent ID"),
      capabilities: z.string().optional().describe("Agent capabilities description (markdown)"),
      budgetMonthlyCents: z.number().int().min(0).optional().describe("Monthly budget in cents (default 0)"),
      tagIds: z.array(z.string().uuid()).optional().describe("Tag IDs to assign"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const agent = await services.agents.create(actor.companyId, {
        name: input.name,
        title: input.title ?? null,
        adapterType: input.adapterType ?? "claude_local",
        reportsTo: input.reportsTo ?? null,
        capabilities: input.capabilities ?? null,
        budgetMonthlyCents: input.budgetMonthlyCents ?? 0,
        tagIds: input.tagIds,
        createdByUserId: actor.userId ?? null,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            urlKey: agent.urlKey,
            adapterType: agent.adapterType,
          }),
        }],
      };
    },
  });

  tool("update_agent", {
    permissions: [PERMISSIONS.AGENTS_EDIT],
    description:
      "[Agents] Update an existing agent's properties.\n" +
      "Use to rename, reassign manager, change capabilities or budget.\n" +
      "Cannot resume terminated agents.",
    input: z.object({
      agentId: z.string().uuid().describe("The agent ID to update"),
      name: z.string().min(1).optional().describe("New agent name"),
      title: z.string().optional().describe("New job title"),
      reportsTo: z.string().uuid().nullable().optional().describe("New manager agent ID (null to remove)"),
      capabilities: z.string().optional().describe("New capabilities description"),
      budgetMonthlyCents: z.number().int().min(0).optional().describe("New monthly budget in cents"),
      tagIds: z.array(z.string().uuid()).optional().describe("Replace tag assignments"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const { agentId, ...data } = input;
      const existing = await services.agents.getById(agentId);
      if (!existing || existing.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Agent not found" }) }],
          isError: true,
        };
      }
      const updated = await services.agents.update(agentId, data, {
        recordRevision: { createdByUserId: actor.userId ?? null, source: "mcp" },
      });
      if (!updated) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Update failed" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: updated.id,
            name: updated.name,
            status: updated.status,
            urlKey: updated.urlKey,
          }),
        }],
      };
    },
  });

  tool("delete_agent", {
    permissions: [PERMISSIONS.AGENTS_DELETE],
    description:
      "[Agents] Permanently delete an agent and all its associated data.\n" +
      "Use with caution — this removes runs, keys, and runtime state.\n" +
      "Subordinates will have their reportsTo cleared.",
    input: z.object({
      agentId: z.string().uuid().describe("The agent ID to delete"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const existing = await services.agents.getById(input.agentId);
      if (!existing || existing.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Agent not found" }) }],
          isError: true,
        };
      }
      const removed = await services.agents.remove(input.agentId);
      if (!removed) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Delete failed" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ id: removed.id, name: removed.name, deleted: true }),
        }],
      };
    },
  });

  tool("launch_agent", {
    permissions: [PERMISSIONS.AGENTS_LAUNCH],
    description:
      "[Agents] Launch an agent run (wakeup).\n" +
      "Use to trigger an on-demand heartbeat run for the agent.\n" +
      "Agent must not be paused or terminated.",
    input: z.object({
      agentId: z.string().uuid().describe("The agent ID to launch"),
      reason: z.string().optional().describe("Reason for launching (shown in run context)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    handler: async ({ input, actor }) => {
      const existing = await services.agents.getById(input.agentId);
      if (!existing || existing.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Agent not found" }) }],
          isError: true,
        };
      }
      const run = await services.heartbeat.wakeup(input.agentId, {
        source: "on_demand",
        triggerDetail: "mcp",
        reason: input.reason ?? null,
        requestedByActorType: actor.type,
        requestedByActorId: actor.userId ?? actor.agentId ?? null,
      });
      if (!run) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Agent cannot be launched (paused or terminated)" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            agentId: input.agentId,
            runId: run.id,
            status: run.status,
          }),
        }],
      };
    },
  });

  tool("configure_agent", {
    permissions: [PERMISSIONS.AGENTS_CONFIGURE],
    description:
      "[Agents] Update an agent's adapter or runtime configuration.\n" +
      "Use for changing adapter settings, runtime config, or metadata.\n" +
      "Creates a config revision for audit trail.",
    input: z.object({
      agentId: z.string().uuid().describe("The agent ID to configure"),
      adapterType: z.string().optional().describe("New adapter type"),
      adapterConfig: z.record(z.unknown()).optional().describe("Adapter configuration object"),
      runtimeConfig: z.record(z.unknown()).optional().describe("Runtime configuration object"),
      metadata: z.record(z.unknown()).optional().describe("Agent metadata object"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const { agentId, ...configData } = input;
      const existing = await services.agents.getById(agentId);
      if (!existing || existing.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Agent not found" }) }],
          isError: true,
        };
      }
      const updated = await services.agents.update(agentId, configData, {
        recordRevision: { createdByUserId: actor.userId ?? null, source: "mcp" },
      });
      if (!updated) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Configuration update failed" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: updated.id,
            name: updated.name,
            adapterType: updated.adapterType,
            configured: true,
          }),
        }],
      };
    },
  });

  tool("get_agent_status", {
    permissions: [PERMISSIONS.AGENTS_READ],
    description:
      "[Agents] Get the runtime status of an agent.\n" +
      "Returns current status, active runs, and whether the agent is idle/busy.\n" +
      "Use to check if an agent is available before assigning work.",
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
      const activeRuns = await services.agents.runningForAgent(input.agentId);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            isBusy: activeRuns.length > 0,
            activeRunCount: activeRuns.length,
            activeRuns: activeRuns.map((r: any) => ({
              id: r.id,
              status: r.status,
              createdAt: r.createdAt,
            })),
          }),
        }],
      };
    },
  });
});
