import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  tool("get_sandbox_status", {
    permissions: [PERMISSIONS.SANDBOX_READ],
    description:
      "[Sandbox] Get the current user's sandbox status.\n" +
      "Returns container state, resource allocation, and auth status.\n" +
      "Use this to check if the sandbox is running before executing commands.",
    input: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ actor }) => {
      const sandbox = await services.sandboxManager.getMySandbox(actor.userId, actor.companyId);
      if (!sandbox) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "not_provisioned" }) }],
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: sandbox.id,
            status: sandbox.status,
            dockerImage: sandbox.dockerImage,
            cpuMillicores: sandbox.cpuMillicores,
            memoryMb: sandbox.memoryMb,
            claudeAuthStatus: sandbox.claudeAuthStatus,
            lastActiveAt: sandbox.lastActiveAt,
            createdAt: sandbox.createdAt,
          }),
        }],
      };
    },
  });

  tool("manage_sandbox", {
    permissions: [PERMISSIONS.SANDBOX_MANAGE],
    description:
      "[Sandbox] Manage sandbox lifecycle: provision, hibernate, wake, or destroy.\n" +
      "Actions: provision (create new), hibernate (stop), wake (restart), destroy (remove).\n" +
      "Use list_all to see all company sandboxes (admin only).",
    input: z.object({
      action: z.enum(["provision", "hibernate", "wake", "destroy", "list_all"]).describe("Lifecycle action to perform"),
      targetUserId: z.string().uuid().optional().describe("Target user ID (defaults to current user)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const userId = input.targetUserId ?? actor.userId!;

      if (input.action === "list_all") {
        const sandboxes = await services.sandboxManager.listSandboxes(actor.companyId);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              items: sandboxes.map((s: any) => ({
                id: s.id,
                userId: s.userId,
                userName: s.userName,
                status: s.status,
                lastActiveAt: s.lastActiveAt,
              })),
              total: sandboxes.length,
            }),
          }],
        };
      }

      if (input.action === "provision") {
        const sandbox = await services.sandboxManager.provisionSandbox(userId, actor.companyId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: sandbox.id, status: sandbox.status }) }],
        };
      }

      if (input.action === "hibernate") {
        const sandbox = await services.sandboxManager.hibernateSandbox(userId, actor.companyId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: sandbox.id, status: sandbox.status }) }],
        };
      }

      if (input.action === "wake") {
        const sandbox = await services.sandboxManager.wakeSandbox(userId, actor.companyId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: sandbox.id, status: sandbox.status }) }],
        };
      }

      if (input.action === "destroy") {
        await services.sandboxManager.destroySandbox(userId, actor.companyId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, action: "destroyed" }) }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Unknown action" }) }],
        isError: true,
      };
    },
  });
});
