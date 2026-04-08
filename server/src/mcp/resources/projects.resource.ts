import { PERMISSIONS } from "@mnm/shared";
import { defineMcpResources } from "../registry/define-mcp-resources.js";

export default defineMcpResources(({ template, services }) => {
  template("mnm://projects/{projectId}", {
    permissions: [PERMISSIONS.PROJECTS_READ],
    name: "Project",
    description: "A project with its goals, workspaces, and metadata",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const project = await services.projects.getById(params.projectId);
      if (!project || project.companyId !== actor.companyId) {
        return {
          contents: [{
            uri: `mnm://projects/${params.projectId}`,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Project not found" }),
          }],
        };
      }
      return {
        contents: [{
          uri: `mnm://projects/${params.projectId}`,
          mimeType: "application/json",
          text: JSON.stringify(project),
        }],
      };
    },
  });
});
