import {
  and,
  eq,
  desc,
  lt,
  gt,
  count as drizzleCount,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@mnm/db";
import { chatChannels, chatMessages } from "@mnm/db";
import { publishLiveEvent } from "./live-events.js";

export function chatService(db: Db) {
  return {
    async createChannel(
      companyId: string,
      agentId: string,
      opts?: { heartbeatRunId?: string; name?: string },
    ) {
      const [channel] = await db
        .insert(chatChannels)
        .values({
          companyId,
          agentId,
          heartbeatRunId: opts?.heartbeatRunId ?? null,
          name: opts?.name ?? null,
          status: "open",
        })
        .returning();

      publishLiveEvent({
        companyId,
        type: "chat.channel_created",
        payload: {
          channelId: channel!.id,
          agentId,
          name: opts?.name ?? null,
        },
      });

      return channel!;
    },

    async getChannel(channelId: string) {
      const row = await db
        .select()
        .from(chatChannels)
        .where(eq(chatChannels.id, channelId))
        .then((rows) => rows[0] ?? null);
      return row;
    },

    async listChannels(
      companyId: string,
      filters?: {
        status?: string;
        agentId?: string;
        limit?: number;
        offset?: number;
      },
    ) {
      const conditions: SQL[] = [eq(chatChannels.companyId, companyId)];
      if (filters?.status) {
        conditions.push(eq(chatChannels.status, filters.status));
      }
      if (filters?.agentId) {
        conditions.push(eq(chatChannels.agentId, filters.agentId));
      }

      const limit = filters?.limit ?? 50;
      const offset = filters?.offset ?? 0;

      const [channels, totalResult] = await Promise.all([
        db
          .select()
          .from(chatChannels)
          .where(and(...conditions))
          .orderBy(desc(chatChannels.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: drizzleCount() })
          .from(chatChannels)
          .where(and(...conditions)),
      ]);

      return {
        channels,
        total: Number(totalResult[0]?.count ?? 0),
      };
    },

    async closeChannel(
      channelId: string,
      reason: "agent_terminated" | "manual_close" | "timeout",
    ) {
      const now = new Date();
      const [updated] = await db
        .update(chatChannels)
        .set({ status: "closed", closedAt: now, updatedAt: now })
        .where(eq(chatChannels.id, channelId))
        .returning();

      if (updated) {
        publishLiveEvent({
          companyId: updated.companyId,
          type: "chat.channel_closed",
          payload: {
            channelId,
            reason,
          },
        });
      }

      return updated ?? null;
    },

    async createMessage(
      channelId: string,
      companyId: string,
      senderId: string,
      senderType: "user" | "agent",
      content: string,
      metadata?: Record<string, unknown>,
    ) {
      const [message] = await db
        .insert(chatMessages)
        .values({
          channelId,
          companyId,
          senderId,
          senderType,
          content,
          metadata: metadata ?? null,
        })
        .returning();

      publishLiveEvent({
        companyId,
        type: "chat.message_sent",
        payload: {
          messageId: message!.id,
          channelId,
          senderId,
          senderType,
        },
      });

      return message!;
    },

    async getMessages(
      channelId: string,
      opts?: { before?: string; limit?: number },
    ) {
      const limit = opts?.limit ?? 50;
      const conditions: SQL[] = [eq(chatMessages.channelId, channelId)];

      if (opts?.before) {
        // Cursor-based: get the createdAt of the "before" message
        const cursorRow = await db
          .select({ createdAt: chatMessages.createdAt })
          .from(chatMessages)
          .where(eq(chatMessages.id, opts.before))
          .then((rows) => rows[0] ?? null);

        if (cursorRow) {
          conditions.push(lt(chatMessages.createdAt, cursorRow.createdAt));
        }
      }

      const messages = await db
        .select()
        .from(chatMessages)
        .where(and(...conditions))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit + 1);

      const hasMore = messages.length > limit;
      if (hasMore) {
        messages.pop();
      }

      return { messages, hasMore };
    },

    async getMessagesSince(
      channelId: string,
      afterMessageId: string,
      limit = 100,
    ) {
      // Get the createdAt of the "after" message
      const cursorRow = await db
        .select({ createdAt: chatMessages.createdAt })
        .from(chatMessages)
        .where(eq(chatMessages.id, afterMessageId))
        .then((rows) => rows[0] ?? null);

      if (!cursorRow) return [];

      const messages = await db
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.channelId, channelId),
            gt(chatMessages.createdAt, cursorRow.createdAt),
          ),
        )
        .orderBy(chatMessages.createdAt)
        .limit(limit);

      return messages;
    },

    async getMessageCount(channelId: string) {
      const result = await db
        .select({ count: drizzleCount() })
        .from(chatMessages)
        .where(eq(chatMessages.channelId, channelId));
      return Number(result[0]?.count ?? 0);
    },
  };
}
