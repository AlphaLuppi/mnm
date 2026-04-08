import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_issues", {
    permissions: [PERMISSIONS.ISSUES_READ],
    description:
      "[Issues] List issues with optional filters by project, status, assignee, or label.\n" +
      "Returns all matching issues ordered by priority then recency.",
    input: z.object({
      projectId: z.string().uuid().optional().describe("Filter by project ID"),
      status: z.string().optional().describe("Filter by status (comma-separated: backlog,todo,in_progress,in_review,blocked,done,cancelled)"),
      assigneeAgentId: z.string().uuid().optional().describe("Filter by assigned agent ID"),
      assigneeUserId: z.string().uuid().optional().describe("Filter by assigned user ID"),
      labelId: z.string().uuid().optional().describe("Filter by label ID"),
      q: z.string().optional().describe("Full-text search across title, identifier, description, comments"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const items = await services.issues.list(actor.companyId, {
        projectId: input.projectId,
        status: input.status,
        assigneeAgentId: input.assigneeAgentId,
        assigneeUserId: input.assigneeUserId,
        labelId: input.labelId,
        q: input.q,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: items.map((i: any) => ({
              id: i.id,
              identifier: i.identifier,
              title: i.title,
              status: i.status,
              priority: i.priority,
              assigneeAgentId: i.assigneeAgentId,
              assigneeUserId: i.assigneeUserId,
              projectId: i.projectId,
              labelIds: i.labelIds,
            })),
            total: items.length,
          }),
        }],
      };
    },
  });

  tool("get_issue", {
    permissions: [PERMISSIONS.ISSUES_READ],
    description:
      "[Issues] Get a single issue by ID with full details including labels.",
    input: z.object({
      issueId: z.string().uuid().describe("The issue ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const issue = await services.issues.getById(input.issueId);
      if (!issue || issue.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Issue not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(issue),
        }],
      };
    },
  });

  tool("create_issue", {
    permissions: [PERMISSIONS.ISSUES_CREATE],
    description:
      "[Issues] Create a new issue. Requires at minimum a title.\n" +
      "Status defaults to 'backlog'. Setting status to 'in_progress' requires an assignee.",
    input: z.object({
      title: z.string().min(1).describe("Issue title"),
      description: z.string().optional().describe("Issue description (markdown)"),
      status: z.string().optional().describe("Initial status: backlog, todo, in_progress, in_review, blocked, done, cancelled"),
      priority: z.string().optional().describe("Priority: critical, high, medium, low"),
      projectId: z.string().uuid().optional().describe("Project to assign this issue to"),
      assigneeAgentId: z.string().uuid().optional().describe("Agent to assign"),
      assigneeUserId: z.string().uuid().optional().describe("User to assign"),
      labelIds: z.array(z.string().uuid()).optional().describe("Label IDs to attach"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const issue = await services.issues.create(actor.companyId, {
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "backlog",
        priority: input.priority ?? "medium",
        projectId: input.projectId ?? null,
        assigneeAgentId: input.assigneeAgentId ?? null,
        assigneeUserId: input.assigneeUserId ?? null,
        labelIds: input.labelIds,
        createdByUserId: actor.userId ?? null,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            status: issue.status,
          }),
        }],
      };
    },
  });
});
