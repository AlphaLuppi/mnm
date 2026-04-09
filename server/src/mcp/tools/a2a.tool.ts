import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { encodeCursor, decodeCursor } from "./_pagination.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_a2a_messages", {
    permissions: [PERMISSIONS.AGENTS_READ],
    description:
      "[A2A] List agent-to-agent messages with optional filters.\n" +
      "Returns cursor-paginated messages ordered by recency with sender, receiver, and status.\n" +
      "Supports filtering by sender, receiver, message type, status, or chain.\n" +
      "Pass the nextCursor value to fetch subsequent pages.",
    input: z.object({
      senderId: z.string().uuid().optional().describe("Filter by sender agent ID"),
      receiverId: z.string().uuid().optional().describe("Filter by receiver agent ID"),
      messageType: z.string().optional().describe("Filter by type: request, response, notification, error"),
      status: z.string().optional().describe("Filter by status: pending, completed, expired, cancelled, error"),
      chainId: z.string().uuid().optional().describe("Filter by conversation chain ID"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().int().min(1).max(100).default(25).describe("Page size (default 25, max 100)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const limit = input.limit ?? 25;
      const offset = decodeCursor(input.cursor);
      const messages = await services.a2aBus.getMessages(actor.companyId, {
        senderId: input.senderId,
        receiverId: input.receiverId,
        messageType: input.messageType,
        status: input.status,
        chainId: input.chainId,
        limit: limit + 1,
        offset,
      });
      const hasMore = messages.length > limit;
      const page = hasMore ? messages.slice(0, limit) : messages;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: page.map((m: any) => ({
              id: m.id,
              chainId: m.chainId,
              senderId: m.senderId,
              receiverId: m.receiverId,
              messageType: m.messageType,
              status: m.status,
              chainDepth: m.chainDepth,
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

  tool("send_a2a_message", {
    permissions: [PERMISSIONS.AGENTS_CREATE],
    description:
      "[A2A] Send an agent-to-agent message.\n" +
      "Creates a new message or continues an existing chain.\n" +
      "Supports request, response, notification, and error message types.",
    input: z.object({
      senderId: z.string().uuid().describe("Sender agent ID"),
      receiverId: z.string().uuid().describe("Receiver agent ID"),
      messageType: z.enum(["request", "response", "notification", "error"]).optional().describe("Message type (default: request)"),
      content: z.record(z.unknown()).describe("Message content (JSON object)"),
      metadata: z.record(z.unknown()).optional().describe("Optional metadata"),
      chainId: z.string().uuid().optional().describe("Chain ID to continue an existing conversation"),
      replyToId: z.string().uuid().optional().describe("Message ID being replied to"),
      ttlSeconds: z.number().optional().describe("Time-to-live in seconds (default 300)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const message = await services.a2aBus.sendMessage(actor.companyId, input.senderId, {
        receiverId: input.receiverId,
        messageType: input.messageType,
        content: input.content,
        metadata: input.metadata ?? null,
        chainId: input.chainId,
        replyToId: input.replyToId,
        ttlSeconds: input.ttlSeconds,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: message.id,
            chainId: message.chainId,
            senderId: message.senderId,
            receiverId: message.receiverId,
            messageType: message.messageType,
            status: message.status,
            chainDepth: message.chainDepth,
            expiresAt: message.expiresAt,
          }),
        }],
      };
    },
  });

  tool("manage_a2a_rules", {
    permissions: [PERMISSIONS.AGENTS_MANAGE],
    description:
      "[A2A] Manage A2A permission rules and default policy.\n" +
      "Actions: list_rules, create_rule, update_rule, delete_rule, get_policy, set_policy.\n" +
      "Rules control which agents can communicate with each other.",
    input: z.object({
      action: z.enum(["list_rules", "create_rule", "update_rule", "delete_rule", "get_policy", "set_policy"]).describe("A2A rule management action"),
      ruleId: z.string().uuid().optional().describe("Rule ID (required for update_rule/delete_rule)"),
      sourceAgentId: z.string().uuid().optional().describe("Source agent ID filter"),
      sourceAgentRole: z.string().optional().describe("Source agent role filter"),
      targetAgentId: z.string().uuid().optional().describe("Target agent ID filter"),
      targetAgentRole: z.string().optional().describe("Target agent role filter"),
      allowed: z.boolean().optional().describe("Whether communication is allowed"),
      bidirectional: z.boolean().optional().describe("Whether rule applies in both directions"),
      priority: z.number().optional().describe("Rule priority (higher = checked first)"),
      description: z.string().optional().describe("Rule description"),
      policy: z.enum(["allow", "deny"]).optional().describe("Default policy (for set_policy action)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      if (input.action === "list_rules") {
        const rules = await services.a2aPermissions.listRules(actor.companyId);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              items: rules.map((r: any) => ({
                id: r.id,
                sourceAgentId: r.sourceAgentId,
                sourceAgentRole: r.sourceAgentRole,
                targetAgentId: r.targetAgentId,
                targetAgentRole: r.targetAgentRole,
                allowed: r.allowed,
                bidirectional: r.bidirectional,
                priority: r.priority,
                description: r.description,
              })),
              total: rules.length,
            }),
          }],
        };
      }

      if (input.action === "create_rule") {
        const rule = await services.a2aPermissions.createRule(actor.companyId, {
          sourceAgentId: input.sourceAgentId ?? null,
          sourceAgentRole: input.sourceAgentRole ?? null,
          targetAgentId: input.targetAgentId ?? null,
          targetAgentRole: input.targetAgentRole ?? null,
          allowed: input.allowed ?? true,
          bidirectional: input.bidirectional ?? false,
          priority: input.priority ?? 0,
          description: input.description ?? null,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: rule.id, allowed: rule.allowed, priority: rule.priority }) }],
        };
      }

      if (input.action === "update_rule") {
        if (!input.ruleId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "ruleId is required for update_rule" }) }],
            isError: true,
          };
        }
        const rule = await services.a2aPermissions.updateRule(actor.companyId, input.ruleId, {
          sourceAgentId: input.sourceAgentId,
          sourceAgentRole: input.sourceAgentRole,
          targetAgentId: input.targetAgentId,
          targetAgentRole: input.targetAgentRole,
          allowed: input.allowed,
          bidirectional: input.bidirectional,
          priority: input.priority,
          description: input.description,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: rule.id, allowed: rule.allowed, priority: rule.priority }) }],
        };
      }

      if (input.action === "delete_rule") {
        if (!input.ruleId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "ruleId is required for delete_rule" }) }],
            isError: true,
          };
        }
        await services.a2aPermissions.deleteRule(actor.companyId, input.ruleId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, action: "deleted" }) }],
        };
      }

      if (input.action === "get_policy") {
        const policy = await services.a2aPermissions.getDefaultPolicy(actor.companyId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ defaultPolicy: policy }) }],
        };
      }

      if (input.action === "set_policy") {
        if (!input.policy) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "policy is required for set_policy" }) }],
            isError: true,
          };
        }
        const policy = await services.a2aPermissions.updateDefaultPolicy(actor.companyId, input.policy);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ defaultPolicy: policy }) }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Unknown action" }) }],
        isError: true,
      };
    },
  });
});
