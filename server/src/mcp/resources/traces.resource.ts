import { PERMISSIONS } from "@mnm/shared";
import { defineMcpResources } from "../registry/define-mcp-resources.js";

export default defineMcpResources(({ template, services }) => {
  template("mnm://traces/{traceId}", {
    permissions: [PERMISSIONS.TRACES_READ],
    name: "Trace",
    description: "A trace with its full observation tree and child traces",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const trace = await services.traces.getTree(actor.companyId, params.traceId);
      if (!trace) {
        return {
          contents: [{
            uri: `mnm://traces/${params.traceId}`,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Trace not found" }),
          }],
        };
      }
      return {
        contents: [{
          uri: `mnm://traces/${params.traceId}`,
          mimeType: "application/json",
          text: JSON.stringify(trace),
        }],
      };
    },
  });
});
