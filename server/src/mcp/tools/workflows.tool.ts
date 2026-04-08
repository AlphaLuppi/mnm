import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_workflows", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Workflows] List workflow templates and instances.\n" +
      "Returns all workflow templates for the company, or instances filtered by status/project.",
    input: z.object({
      type: z.enum(["templates", "instances"]).describe("Whether to list templates or instances"),
      status: z.string().optional().describe("Filter instances by status (active, completed, failed, paused)"),
      projectId: z.string().uuid().optional().describe("Filter instances by project ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (input.type === "templates") {
        const templates = await services.workflows.listTemplates(actor.companyId);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              items: templates.map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                isDefault: t.isDefault,
                createdFrom: t.createdFrom,
                stages: t.stages,
                createdAt: t.createdAt,
              })),
              total: templates.length,
            }),
          }],
        };
      }

      const instances = await services.workflows.listInstances(actor.companyId, {
        status: input.status,
        projectId: input.projectId,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: instances.map((i: any) => ({
              id: i.id,
              name: i.name,
              description: i.description,
              templateId: i.templateId,
              projectId: i.projectId,
              status: i.status,
              stageCount: i.stages?.length ?? 0,
              currentStage: i.stages?.find((s: any) => s.status === "running")?.name ?? null,
              createdAt: i.createdAt,
            })),
            total: instances.length,
          }),
        }],
      };
    },
  });

  tool("get_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_READ],
    description:
      "[Workflows] Get a single workflow template or instance by ID with full details.\n" +
      "Instances include all stage details with status and progress.",
    input: z.object({
      type: z.enum(["template", "instance"]).describe("Whether to fetch a template or instance"),
      id: z.string().uuid().describe("The workflow template or instance ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (input.type === "template") {
        const template = await services.workflows.getTemplate(input.id);
        if (!template || template.companyId !== actor.companyId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Workflow template not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(template),
          }],
        };
      }

      const instance = await services.workflows.getInstance(input.id);
      if (!instance || instance.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Workflow instance not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(instance),
        }],
      };
    },
  });

  tool("create_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_CREATE],
    description:
      "[Workflows] Create a new workflow template with named stages.\n" +
      "Each stage defines an order, name, agent role, and acceptance criteria.",
    input: z.object({
      name: z.string().min(1).describe("Workflow template name"),
      description: z.string().optional().describe("Template description"),
      stages: z.array(z.object({
        order: z.number().int().min(0).describe("Stage order (0-based)"),
        name: z.string().describe("Stage name"),
        description: z.string().optional().describe("Stage description"),
        agentRole: z.string().optional().describe("Required agent role for this stage"),
        autoTransition: z.boolean().optional().describe("Auto-advance to next stage on completion"),
        acceptanceCriteria: z.array(z.string()).optional().describe("List of acceptance criteria"),
      })).describe("Ordered list of stage definitions"),
      isDefault: z.boolean().optional().describe("Set as default template (default false)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const template = await services.workflows.createTemplate(actor.companyId, {
        name: input.name,
        description: input.description,
        stages: input.stages,
        isDefault: input.isDefault,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: template.id,
            name: template.name,
            stages: template.stages,
            isDefault: template.isDefault,
          }),
        }],
      };
    },
  });

  tool("delete_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_DELETE],
    description:
      "[Workflows] Delete a workflow template or instance.\n" +
      "Templates with active instances cannot be deleted.",
    input: z.object({
      type: z.enum(["template", "instance"]).describe("Whether to delete a template or instance"),
      id: z.string().uuid().describe("The workflow template or instance ID"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input }) => {
      if (input.type === "template") {
        await services.workflows.deleteTemplate(input.id);
      } else {
        await services.workflows.deleteInstance(input.id);
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ deleted: true, type: input.type, id: input.id }),
        }],
      };
    },
  });

  tool("start_workflow", {
    permissions: [PERMISSIONS.WORKFLOWS_ENFORCE],
    description:
      "[Workflows] Start a new workflow instance from a template.\n" +
      "Creates all stage instances and sets the first stage to running.",
    input: z.object({
      templateId: z.string().uuid().describe("The workflow template ID to instantiate"),
      name: z.string().min(1).describe("Instance name"),
      description: z.string().optional().describe("Instance description"),
      projectId: z.string().uuid().optional().describe("Link to a project"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const instance = await services.workflows.createInstance(
        actor.companyId,
        {
          templateId: input.templateId,
          name: input.name,
          description: input.description,
          projectId: input.projectId,
        },
        actor.userId,
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: instance.id,
            name: instance.name,
            status: instance.status,
            templateId: instance.templateId,
            stageCount: instance.stages?.length ?? 0,
            currentStage: instance.stages?.find((s: any) => s.status === "running")?.name ?? null,
          }),
        }],
      };
    },
  });
});
