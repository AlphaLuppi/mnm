import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { encodeCursor, decodeCursor } from "./_pagination.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_issues", {
    permissions: [PERMISSIONS.ISSUES_READ],
    description:
      "[Issues] List issues with optional filters by project, status, assignee, or label.\n" +
      "Returns cursor-paginated results ordered by priority then recency.\n" +
      "Pass the nextCursor value to fetch subsequent pages.",
    input: z.object({
      projectId: z.string().uuid().optional().describe("Filter by project ID"),
      status: z.string().optional().describe("Filter by status (comma-separated: backlog,todo,in_progress,in_review,blocked,done,cancelled)"),
      assigneeAgentId: z.string().uuid().optional().describe("Filter by assigned agent ID"),
      assigneeUserId: z.string().uuid().optional().describe("Filter by assigned user ID"),
      labelId: z.string().uuid().optional().describe("Filter by label ID"),
      q: z.string().optional().describe("Full-text search across title, identifier, description, comments"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().int().min(1).max(100).default(25).describe("Page size (default 25, max 100)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const limit = input.limit ?? 25;
      const offset = decodeCursor(input.cursor);
      const items = await services.issues.list(actor.companyId, {
        projectId: input.projectId,
        status: input.status,
        assigneeAgentId: input.assigneeAgentId,
        assigneeUserId: input.assigneeUserId,
        labelId: input.labelId,
        q: input.q,
      });
      const slice = items.slice(offset, offset + limit + 1);
      const hasMore = slice.length > limit;
      const page = hasMore ? slice.slice(0, limit) : slice;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: page.map((i: any) => ({
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
            total: page.length,
            hasMore,
            nextCursor: hasMore ? encodeCursor(offset + limit) : null,
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

  tool("update_issue", {
    permissions: [PERMISSIONS.ISSUES_EDIT],
    description:
      "[Issues] Update an existing issue's properties.\n" +
      "Use to change status, priority, assignee, or description.\n" +
      "Setting status to 'in_progress' requires an assignee.",
    input: z.object({
      issueId: z.string().uuid().describe("The issue ID to update"),
      title: z.string().min(1).optional().describe("New title"),
      description: z.string().optional().describe("New description (markdown)"),
      status: z.string().optional().describe("New status: backlog, todo, in_progress, in_review, blocked, done, cancelled"),
      priority: z.string().optional().describe("New priority: critical, high, medium, low"),
      projectId: z.string().uuid().nullable().optional().describe("Move to project (null to unassign)"),
      assigneeAgentId: z.string().uuid().nullable().optional().describe("Assign to agent (null to unassign)"),
      assigneeUserId: z.string().uuid().nullable().optional().describe("Assign to user (null to unassign)"),
      labelIds: z.array(z.string().uuid()).optional().describe("Replace label IDs"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const { issueId, ...data } = input;
      const existing = await services.issues.getById(issueId);
      if (!existing || existing.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Issue not found" }) }],
          isError: true,
        };
      }
      const updated = await services.issues.update(issueId, data);
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
            identifier: updated.identifier,
            title: updated.title,
            status: updated.status,
            priority: updated.priority,
          }),
        }],
      };
    },
  });

  tool("delete_issue", {
    permissions: [PERMISSIONS.ISSUES_DELETE],
    description:
      "[Issues] Permanently delete an issue and its comments/attachments.\n" +
      "Use with caution — this cannot be undone.\n" +
      "Cost events linked to this issue will have their issueId cleared.",
    input: z.object({
      issueId: z.string().uuid().describe("The issue ID to delete"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const existing = await services.issues.getById(input.issueId);
      if (!existing || existing.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Issue not found" }) }],
          isError: true,
        };
      }
      const removed = await services.issues.remove(input.issueId);
      if (!removed) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Delete failed" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ id: removed.id, identifier: removed.identifier, deleted: true }),
        }],
      };
    },
  });

  tool("search_issues", {
    permissions: [PERMISSIONS.ISSUES_READ],
    description:
      "[Issues] Full-text search across issues (title, identifier, description, comments).\n" +
      "Returns cursor-paginated results ranked by relevance.\n" +
      "Combine with status/project filters to narrow results.\n" +
      "Pass the nextCursor value to fetch subsequent pages.",
    input: z.object({
      q: z.string().min(1).describe("Search query"),
      projectId: z.string().uuid().optional().describe("Limit search to a project"),
      status: z.string().optional().describe("Filter by status (comma-separated)"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().int().min(1).max(100).default(25).describe("Page size (default 25, max 100)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const limit = input.limit ?? 25;
      const offset = decodeCursor(input.cursor);
      const items = await services.issues.list(actor.companyId, {
        q: input.q,
        projectId: input.projectId,
        status: input.status,
      });
      const slice = items.slice(offset, offset + limit + 1);
      const hasMore = slice.length > limit;
      const page = hasMore ? slice.slice(0, limit) : slice;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: page.map((i: any) => ({
              id: i.id,
              identifier: i.identifier,
              title: i.title,
              status: i.status,
              priority: i.priority,
              assigneeAgentId: i.assigneeAgentId,
              assigneeUserId: i.assigneeUserId,
              projectId: i.projectId,
            })),
            total: page.length,
            hasMore,
            nextCursor: hasMore ? encodeCursor(offset + limit) : null,
            query: input.q,
          }),
        }],
      };
    },
  });
});
