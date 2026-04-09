import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { encodeCursor, decodeCursor } from "./_pagination.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_channels", {
    permissions: [PERMISSIONS.CHAT_READ],
    description:
      "[Chat] List chat channels with optional filters by status, agent, or project.\n" +
      "Returns cursor-paginated channels ordered by most recent activity.\n" +
      "Pass the nextCursor value to fetch subsequent pages.",
    input: z.object({
      status: z.string().optional().describe("Filter by status: open, closed"),
      agentId: z.string().uuid().optional().describe("Filter by agent ID"),
      projectId: z.string().uuid().optional().describe("Filter by project ID"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().int().min(1).max(100).default(25).describe("Page size (default 25, max 100)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const limit = input.limit ?? 25;
      const offset = decodeCursor(input.cursor);
      const result = await services.chat.listChannels(actor.companyId, {
        status: input.status,
        agentId: input.agentId,
        projectId: input.projectId,
        limit: limit + 1,
        offset,
      });
      const items = result.channels;
      const hasMore = items.length > limit;
      const page = hasMore ? items.slice(0, limit) : items;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: page.map((c: any) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              agentId: c.agentId,
              projectId: c.projectId,
              createdBy: c.createdBy,
              lastMessageAt: c.lastMessageAt,
              createdAt: c.createdAt,
            })),
            total: page.length,
            hasMore,
            nextCursor: hasMore ? encodeCursor(offset + limit) : null,
          }),
        }],
      };
    },
  });

  tool("get_channel", {
    permissions: [PERMISSIONS.CHAT_READ],
    description:
      "[Chat] Get a single channel by ID with recent messages.\n" +
      "Returns channel details and the last 20 messages.",
    input: z.object({
      channelId: z.string().uuid().describe("The channel ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const channel = await services.chat.getChannel(input.channelId);
      if (!channel || channel.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Channel not found" }) }],
          isError: true,
        };
      }
      const { messages } = await services.chat.getMessages(input.channelId, { limit: 20 });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ...channel,
            recentMessages: messages.map((m: any) => ({
              id: m.id,
              senderId: m.senderId,
              senderType: m.senderType,
              content: m.content,
              messageType: m.messageType,
              createdAt: m.createdAt,
            })),
          }),
        }],
      };
    },
  });

  tool("create_channel", {
    permissions: [PERMISSIONS.CHAT_CHANNEL],
    description:
      "[Chat] Create a new chat channel with an agent.\n" +
      "Requires an agentId. Optionally attach to a project.",
    input: z.object({
      agentId: z.string().uuid().describe("Agent to chat with"),
      name: z.string().optional().describe("Channel name"),
      description: z.string().optional().describe("Channel description"),
      projectId: z.string().uuid().optional().describe("Project to attach this channel to"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const channel = await services.chat.createChannel(actor.companyId, input.agentId, {
        name: input.name,
        description: input.description,
        projectId: input.projectId,
        createdBy: actor.userId ?? actor.agentId,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: channel.id,
            name: channel.name,
            status: channel.status,
            agentId: channel.agentId,
          }),
        }],
      };
    },
  });

  tool("send_message", {
    permissions: [PERMISSIONS.CHAT_AGENT],
    description:
      "[Chat] Send a message to a chat channel.\n" +
      "The sender is the authenticated actor (user or agent).",
    input: z.object({
      channelId: z.string().uuid().describe("Channel to send the message to"),
      content: z.string().min(1).describe("Message content"),
      replyToId: z.string().uuid().optional().describe("ID of message to reply to (thread)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const channel = await services.chat.getChannel(input.channelId);
      if (!channel || channel.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Channel not found" }) }],
          isError: true,
        };
      }
      const senderId = actor.userId ?? actor.agentId!;
      const senderType = actor.type;
      const message = await services.chat.createMessage(
        input.channelId,
        actor.companyId,
        senderId,
        senderType,
        input.content,
        undefined,
        { replyToId: input.replyToId },
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: message.id,
            channelId: message.channelId,
            content: message.content,
            createdAt: message.createdAt,
          }),
        }],
      };
    },
  });

  tool("share_channel", {
    permissions: [PERMISSIONS.CHAT_SHARE],
    description:
      "[Chat] Create a share link for a chat channel.\n" +
      "Returns a share token that can be used to access the channel.",
    input: z.object({
      channelId: z.string().uuid().describe("Channel to share"),
      permission: z.string().optional().describe("Share permission: read, comment, edit (default read)"),
      expiresAt: z.string().optional().describe("Expiration date (ISO 8601) or null for no expiry"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const channel = await services.chat.getChannel(input.channelId);
      if (!channel || channel.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Channel not found" }) }],
          isError: true,
        };
      }
      const share = await services.chatSharing.createShare(
        actor.companyId,
        input.channelId,
        actor.userId!,
        { permission: input.permission, expiresAt: input.expiresAt },
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: share.id,
            shareToken: share.shareToken,
            permission: share.permission,
            expiresAt: share.expiresAt,
          }),
        }],
      };
    },
  });
});
