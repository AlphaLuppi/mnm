import { PERMISSIONS } from "@mnm/shared";
import { defineMcpResources } from "../registry/define-mcp-resources.js";

export default defineMcpResources(({ template, services }) => {
  template("mnm://nodes/{nodeId}", {
    permissions: [PERMISSIONS.PROJECTS_READ],
    name: "Node",
    description: "A project node with its goals, workspaces, and linked projects",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const uri = `mnm://nodes/${params.nodeId}`;

      // Nodes are backed by projects — nodeId maps to projectId
      const project = await services.projects.getById(params.nodeId);
      if (!project || project.companyId !== actor.companyId) {
        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Node not found" }),
          }],
        };
      }
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            id: project.id,
            name: project.name,
            urlKey: project.urlKey,
            description: project.description,
            color: project.color,
            status: project.status,
            goals: project.goals,
            workspaces: project.workspaces,
            primaryWorkspace: project.primaryWorkspace,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          }),
        }],
      };
    },
  });
});
