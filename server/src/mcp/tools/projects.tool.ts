import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_projects", {
    permissions: [PERMISSIONS.PROJECTS_READ],
    description:
      "[Projects] List all projects in the company.\n" +
      "Returns projects with their goals, workspaces, and metadata.\n" +
      "Results are not paginated — all projects are returned.",
    input: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ actor }) => {
      const items = await services.projects.list(actor.companyId);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: items.map((p: any) => ({
              id: p.id,
              name: p.name,
              urlKey: p.urlKey,
              color: p.color,
              status: p.status,
              goalIds: p.goalIds,
              primaryWorkspace: p.primaryWorkspace,
            })),
            total: items.length,
          }),
        }],
      };
    },
  });

  tool("get_project", {
    permissions: [PERMISSIONS.PROJECTS_READ],
    description:
      "[Projects] Get a single project by ID with full details including goals and workspaces.",
    input: z.object({
      projectId: z.string().uuid().describe("The project ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const project = await services.projects.getById(input.projectId);
      if (!project || project.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Project not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(project),
        }],
      };
    },
  });

  tool("create_project", {
    permissions: [PERMISSIONS.PROJECTS_CREATE],
    description:
      "[Projects] Create a new project.\n" +
      "Use when starting a new initiative or workstream.\n" +
      "Name is auto-deduplicated if a collision exists. Color is auto-assigned if omitted.",
    input: z.object({
      name: z.string().min(1).describe("Project name"),
      description: z.string().optional().describe("Project description (markdown)"),
      color: z.string().optional().describe("Project color hex code (auto-assigned if omitted)"),
      goalIds: z.array(z.string().uuid()).optional().describe("Goal IDs to link to this project"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const project = await services.projects.create(actor.companyId, {
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? null,
        goalIds: input.goalIds,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: project.id,
            name: project.name,
            urlKey: project.urlKey,
            color: project.color,
          }),
        }],
      };
    },
  });

  tool("update_project", {
    permissions: [PERMISSIONS.PROJECTS_EDIT],
    description:
      "[Projects] Update an existing project's properties.\n" +
      "Use to rename, change color, update description, or link goals.\n" +
      "Name uniqueness is enforced within the company.",
    input: z.object({
      projectId: z.string().uuid().describe("The project ID to update"),
      name: z.string().min(1).optional().describe("New project name"),
      description: z.string().optional().describe("New description (markdown)"),
      color: z.string().optional().describe("New color hex code"),
      status: z.string().optional().describe("New status"),
      goalIds: z.array(z.string().uuid()).optional().describe("Replace linked goal IDs"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const { projectId, ...data } = input;
      const existing = await services.projects.getById(projectId);
      if (!existing || existing.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Project not found" }) }],
          isError: true,
        };
      }
      const updated = await services.projects.update(projectId, data);
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
            urlKey: updated.urlKey,
            color: updated.color,
          }),
        }],
      };
    },
  });

  tool("delete_project", {
    permissions: [PERMISSIONS.PROJECTS_DELETE],
    description:
      "[Projects] Permanently delete a project.\n" +
      "Use with caution — this cannot be undone.\n" +
      "Issues linked to this project will not be deleted but will lose their project reference.",
    input: z.object({
      projectId: z.string().uuid().describe("The project ID to delete"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const existing = await services.projects.getById(input.projectId);
      if (!existing || existing.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Project not found" }) }],
          isError: true,
        };
      }
      const removed = await services.projects.remove(input.projectId);
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
});
