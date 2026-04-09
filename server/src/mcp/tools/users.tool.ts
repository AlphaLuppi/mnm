import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { encodeCursor, decodeCursor } from "./_pagination.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_users", {
    permissions: [PERMISSIONS.USERS_READ],
    description:
      "[Users] List all company members and pending invites.\n" +
      "Returns cursor-paginated active members with their roles and pending invitations.\n" +
      "Includes user name, email, status, and role information.\n" +
      "Pass the nextCursor value to fetch subsequent pages.",
    input: z.object({
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().int().min(1).max(100).default(25).describe("Page size (default 25, max 100)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const limit = input.limit ?? 25;
      const offset = decodeCursor(input.cursor);
      const members = await services.access.listMembers(actor.companyId);
      const slice = members.slice(offset, offset + limit + 1);
      const hasMore = slice.length > limit;
      const page = hasMore ? slice.slice(0, limit) : slice;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: page.map((m: any) => ({
              id: m.id,
              principalId: m.principalId,
              status: m.status,
              roleId: m.roleId,
              userName: m.userName,
              userEmail: m.userEmail,
              createdAt: m.createdAt,
            })),
            total: page.length,
            hasMore,
            nextCursor: hasMore ? encodeCursor(offset + limit) : null,
          }),
        }],
      };
    },
  });

  tool("invite_user", {
    permissions: [PERMISSIONS.USERS_INVITE],
    description:
      "[Users] Invite a new user to the company by email.\n" +
      "Not yet available via MCP — use the web UI to send invitations.\n" +
      "Returns an error explaining the limitation.",
    input: z.object({
      email: z.string().email().describe("Email address of the user to invite"),
      roleId: z.string().uuid().optional().describe("Role ID to assign (uses default role if omitted)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async () => {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: "User invitations are not yet available via MCP. Use the web UI to invite users.",
          }),
        }],
        isError: true,
      };
    },
  });

  tool("manage_user", {
    permissions: [PERMISSIONS.USERS_MANAGE],
    description:
      "[Users] Manage a company member: change role, suspend, or reactivate.\n" +
      "Actions: set_role (change user's role), suspend, reactivate.\n" +
      "Requires the membership ID from list_users.",
    input: z.object({
      action: z.enum(["set_role", "suspend", "reactivate"]).describe("Management action to perform"),
      memberId: z.string().uuid().describe("Membership ID of the user to manage"),
      roleId: z.string().uuid().optional().describe("New role ID (required for set_role action)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (input.action === "set_role") {
        if (!input.roleId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "roleId is required for set_role action" }) }],
            isError: true,
          };
        }
        const updated = await services.access.updateMemberRole(actor.companyId, input.memberId, input.roleId);
        if (!updated) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Member not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: updated.id, roleId: updated.roleId, status: updated.status }) }],
        };
      }

      if (input.action === "suspend" || input.action === "reactivate") {
        const status = input.action === "suspend" ? "suspended" : "active";
        const updated = await services.access.updateMemberStatus(actor.companyId, input.memberId, status);
        if (!updated) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Member not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: updated.id, status: updated.status }) }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Unknown action" }) }],
        isError: true,
      };
    },
  });
});
