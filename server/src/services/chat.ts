import {
  and,
  eq,
  desc,
  asc,
  lt,
  gt,
  isNull,
  sql,
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
      opts?: {
        heartbeatRunId?: string;
        name?: string;
        // CHAT-S02: new options
        projectId?: string;
        createdBy?: string;
        description?: string;
      },
    ) {
      const [channel] = await db
        .insert(chatChannels)
        .values({
          companyId,
          agentId,
          heartbeatRunId: opts?.heartbeatRunId ?? null,
          name: opts?.name ?? null,
          status: "open",
          // CHAT-S02: persist new columns
          projectId: opts?.projectId ?? null,
          createdBy: opts?.createdBy ?? null,
          description: opts?.description ?? null,
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
        // CHAT-S02: new filters
        projectId?: string;
        limit?: number;
        offset?: number;
        sortBy?: "createdAt" | "lastMessageAt";
      },
    ) {
      const conditions: SQL[] = [eq(chatChannels.companyId, companyId)];
      if (filters?.status) {
        conditions.push(eq(chatChannels.status, filters.status));
      }
      if (filters?.agentId) {
        conditions.push(eq(chatChannels.agentId, filters.agentId));
      }
      // CHAT-S02: filter by projectId
      if (filters?.projectId) {
        conditions.push(eq(chatChannels.projectId, filters.projectId));
      }

      const limit = filters?.limit ?? 50;
      const offset = filters?.offset ?? 0;

      // CHAT-S02: support sortBy lastMessageAt with NULLS LAST
      const orderByClause =
        filters?.sortBy === "lastMessageAt"
          ? sql`${chatChannels.lastMessageAt} DESC NULLS LAST`
          : desc(chatChannels.createdAt);

      const [channels, totalResult] = await Promise.all([
        db
          .select()
          .from(chatChannels)
          .where(and(...conditions))
          .orderBy(orderByClause)
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
      // CHAT-S02: new options
      opts?: {
        messageType?: string;
        replyToId?: string;
      },
    ) {
      // CHAT-S02: validate replyToId is in the same channel
      if (opts?.replyToId) {
        const parentMsg = await db
          .select({ id: chatMessages.id, channelId: chatMessages.channelId })
          .from(chatMessages)
          .where(eq(chatMessages.id, opts.replyToId))
          .then((rows) => rows[0] ?? null);

        if (!parentMsg) {
          throw new Error("Referenced message not found");
        }
        if (parentMsg.channelId !== channelId) {
          throw new Error("Reply must target a message in the same channel");
        }
      }

      const [message] = await db
        .insert(chatMessages)
        .values({
          channelId,
          companyId,
          senderId,
          senderType,
          content,
          metadata: metadata ?? null,
          // CHAT-S02: new columns
          messageType: opts?.messageType ?? "text",
          replyToId: opts?.replyToId ?? null,
        })
        .returning();

      // CHAT-S02: update lastMessageAt on the channel (race-safe with GREATEST)
      const msgCreatedAt = message!.createdAt instanceof Date ? message!.createdAt.toISOString() : message!.createdAt;
      await db
        .update(chatChannels)
        .set({
          lastMessageAt: sql`GREATEST(COALESCE(${chatChannels.lastMessageAt}, '1970-01-01'::timestamptz), ${msgCreatedAt}::timestamptz)`,
          updatedAt: new Date(),
        })
        .where(eq(chatChannels.id, channelId));

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
      const conditions: SQL[] = [
        eq(chatMessages.channelId, channelId),
        // CHAT-S02: exclude soft-deleted messages
        isNull(chatMessages.deletedAt),
      ];

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
            // CHAT-S02: exclude soft-deleted messages
            isNull(chatMessages.deletedAt),
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
        .where(
          and(
            eq(chatMessages.channelId, channelId),
            // CHAT-S02: exclude soft-deleted messages from count
            isNull(chatMessages.deletedAt),
          ),
        );
      return Number(result[0]?.count ?? 0);
    },

    // CHAT-S02: get a single message by id
    async getMessage(messageId: string) {
      const row = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.id, messageId))
        .then((rows) => rows[0] ?? null);
      return row;
    },

    // CHAT-S02: edit a message (update content + set editedAt)
    async updateMessage(
      messageId: string,
      channelId: string,
      opts: {
        content?: string;
        metadata?: Record<string, unknown>;
      },
    ) {
      const now = new Date();
      const updates: Record<string, unknown> = { editedAt: now };
      if (opts.content !== undefined) {
        updates.content = opts.content;
      }
      if (opts.metadata !== undefined) {
        updates.metadata = opts.metadata;
      }

      const [updated] = await db
        .update(chatMessages)
        .set(updates)
        .where(
          and(
            eq(chatMessages.id, messageId),
            eq(chatMessages.channelId, channelId),
          ),
        )
        .returning();

      return updated ?? null;
    },

    // CHAT-S02: soft-delete a message (set deletedAt without physical deletion)
    async softDeleteMessage(messageId: string, channelId: string) {
      const now = new Date();
      const [updated] = await db
        .update(chatMessages)
        .set({ deletedAt: now })
        .where(
          and(
            eq(chatMessages.id, messageId),
            eq(chatMessages.channelId, channelId),
          ),
        )
        .returning();

      return updated ?? null;
    },

    // CHAT-S02: get thread replies for a parent message
    async getThreadReplies(parentMessageId: string, limit = 100) {
      const replies = await db
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.replyToId, parentMessageId),
            isNull(chatMessages.deletedAt),
          ),
        )
        .orderBy(asc(chatMessages.createdAt))
        .limit(limit);

      return replies;
    },
  };
}
