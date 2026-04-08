import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_traces", {
    permissions: [PERMISSIONS.TRACES_READ],
    description:
      "[Traces] List traces with optional filters by agent, status, workflow, or date range.\n" +
      "Returns cursor-paginated results ordered by most recent first.\n" +
      "Pass the nextCursor value to fetch subsequent pages.",
    input: z.object({
      agentId: z.string().uuid().optional().describe("Filter by agent ID"),
      status: z.string().optional().describe("Filter by status (running, completed, failed, cancelled)"),
      workflowInstanceId: z.string().uuid().optional().describe("Filter by workflow instance ID"),
      dateFrom: z.string().optional().describe("Start date filter (ISO 8601)"),
      dateTo: z.string().optional().describe("End date filter (ISO 8601)"),
      search: z.string().optional().describe("Search by trace name"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().int().min(1).max(100).optional().describe("Page size (default 20, max 100)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const result = await services.traces.list(actor.companyId, {
        agentId: input.agentId,
        status: input.status,
        workflowInstanceId: input.workflowInstanceId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        search: input.search,
        cursor: input.cursor,
        limit: input.limit,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: result.data.map((t: any) => ({
              id: t.id,
              name: t.name,
              agentId: t.agentId,
              status: t.status,
              totalDurationMs: t.totalDurationMs,
              totalTokensIn: t.totalTokensIn,
              totalTokensOut: t.totalTokensOut,
              totalCostUsd: t.totalCostUsd,
              startedAt: t.startedAt,
              completedAt: t.completedAt,
            })),
            nextCursor: result.nextCursor,
            total: result.data.length,
          }),
        }],
      };
    },
  });

  tool("get_trace", {
    permissions: [PERMISSIONS.TRACES_READ],
    description:
      "[Traces] Get a single trace by ID with full observation tree and child traces.\n" +
      "Returns the hierarchical observation structure for detailed analysis.",
    input: z.object({
      traceId: z.string().uuid().describe("The trace ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const trace = await services.traces.getTree(actor.companyId, input.traceId);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(trace),
        }],
      };
    },
  });

  tool("export_traces", {
    permissions: [PERMISSIONS.TRACES_EXPORT],
    description:
      "[Traces] Export traces matching filters as a JSON array.\n" +
      "Returns all matching traces (up to 1000) with their full observation trees.",
    input: z.object({
      agentId: z.string().uuid().optional().describe("Filter by agent ID"),
      status: z.string().optional().describe("Filter by status"),
      dateFrom: z.string().optional().describe("Start date filter (ISO 8601)"),
      dateTo: z.string().optional().describe("End date filter (ISO 8601)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    handler: async ({ input, actor }) => {
      const result = await services.traces.list(actor.companyId, {
        agentId: input.agentId,
        status: input.status,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: 1000,
      });

      const exported = [];
      for (const trace of result.data) {
        const tree = await services.traces.getTree(actor.companyId, (trace as any).id);
        exported.push(tree);
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            exported: exported.length,
            traces: exported,
          }),
        }],
      };
    },
  });

  tool("get_dashboard", {
    permissions: [PERMISSIONS.DASHBOARD_VIEW],
    description:
      "[Dashboard] Get the company dashboard KPIs.\n" +
      "Returns agent counts, task counts, cost metrics, workflow status,\n" +
      "audit event counts, drift alerts, and pending approvals.",
    input: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ actor }) => {
      const kpis = await services.dashboard.kpis(actor.companyId);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(kpis),
        }],
      };
    },
  });
});
