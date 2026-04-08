import { PERMISSIONS } from "@mnm/shared";
import { defineMcpResources } from "../registry/define-mcp-resources.js";

export default defineMcpResources(({ template, services }) => {
  template("mnm://issues/{issueId}", {
    permissions: [PERMISSIONS.ISSUES_READ],
    name: "Issue",
    description: "A single issue with labels, status, priority, and assignee details",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const issue = await services.issues.getById(params.issueId);
      if (!issue || issue.companyId !== actor.companyId) {
        return {
          contents: [{
            uri: `mnm://issues/${params.issueId}`,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Issue not found" }),
          }],
        };
      }
      return {
        contents: [{
          uri: `mnm://issues/${params.issueId}`,
          mimeType: "application/json",
          text: JSON.stringify(issue),
        }],
      };
    },
  });
});
