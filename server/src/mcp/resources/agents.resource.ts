import { PERMISSIONS } from "@mnm/shared";
import { defineMcpResources } from "../registry/define-mcp-resources.js";

export default defineMcpResources(({ template, services }) => {
  template("mnm://agents/{agentId}", {
    permissions: [PERMISSIONS.AGENTS_READ],
    name: "Agent",
    description: "An agent with config, runtime state, and recent runs",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const agent = await services.agents.getById(params.agentId);
      if (!agent || agent.companyId !== actor.companyId) {
        return {
          contents: [{
            uri: `mnm://agents/${params.agentId}`,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Agent not found" }),
          }],
        };
      }
      const activeRuns = await services.agents.runningForAgent(params.agentId);
      return {
        contents: [{
          uri: `mnm://agents/${params.agentId}`,
          mimeType: "application/json",
          text: JSON.stringify({
            ...agent,
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
