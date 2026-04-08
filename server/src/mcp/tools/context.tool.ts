import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  tool("get_context", {
    permissions: [PERMISSIONS.PROJECTS_READ],
    description:
      "[Context] Bridge tool that fetches a resource by URI.\n" +
      "Supported URI patterns:\n" +
      "- mnm://projects/{projectId}\n" +
      "- mnm://issues/{issueId}\n" +
      "Use this when you need to fetch a resource but only have access to tools.",
    input: z.object({
      uri: z.string().describe("Resource URI, e.g. mnm://projects/{id} or mnm://issues/{id}"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const { uri } = input;

      // Parse mnm://projects/{id}
      const projectMatch = uri.match(/^mnm:\/\/projects\/([0-9a-f-]+)$/i);
      if (projectMatch) {
        const project = await services.projects.getById(projectMatch[1]);
        if (!project || project.companyId !== actor.companyId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Project not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(project) }],
        };
      }

      // Parse mnm://issues/{id}
      const issueMatch = uri.match(/^mnm:\/\/issues\/([0-9a-f-]+)$/i);
      if (issueMatch) {
        const issue = await services.issues.getById(issueMatch[1]);
        if (!issue || issue.companyId !== actor.companyId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Issue not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(issue) }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `Unsupported URI pattern: ${uri}` }) }],
        isError: true,
      };
    },
  });
});
