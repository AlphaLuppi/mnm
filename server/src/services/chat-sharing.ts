import crypto from "node:crypto";
import {
  and,
  eq,
  desc,
  lt,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  chatShares,
  chatChannels,
  chatMessages,
  chatContextLinks,
} from "@mnm/db";
import { publishLiveEvent } from "./live-events.js";

export function chatSharingService(db: Db) {
  return {
    async createShare(
      companyId: string,
      channelId: string,
      sharedByUserId: string,
      input: { permission?: string; expiresAt?: string | null },
    ) {
      const shareToken = crypto.randomBytes(32).toString("base64url");

      const [share] = await db
        .insert(chatShares)
        .values({
          companyId,
          channelId,
          sharedByUserId,
          shareToken,
          permission: input.permission ?? "read",
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        })
        .returning();

      // WS-SEC-08: Resolve channel's agent for visibility
      const chanRow = await db.select({ agentId: chatChannels.agentId }).from(chatChannels)
        .where(eq(chatChannels.id, channelId))
        .then((rows) => rows[0]);

      publishLiveEvent({
        companyId,
        type: "chat.shared",
        payload: {
          shareId: share!.id,
          channelId,
          sharedByUserId,
          permission: share!.permission,
        },
        visibility: chanRow ? { scope: "agents", agentIds: [chanRow.agentId] } : { scope: "company-wide" },
      });

      return share!;
    },

    async getShareByToken(token: string) {
      const row = await db
        .select()
        .from(chatShares)
        .where(
          and(
            eq(chatShares.shareToken, token),
            isNull(chatShares.revokedAt),
            sql`(${chatShares.expiresAt} IS NULL OR ${chatShares.expiresAt} > now())`,
          ),
        )
        .then((rows) => rows[0] ?? null);

      return row;
    },

    async revokeShare(companyId: string, shareId: string) {
      const now = new Date();
      const [updated] = await db
        .update(chatShares)
        .set({ revokedAt: now })
        .where(
          and(eq(chatShares.id, shareId), eq(chatShares.companyId, companyId)),
        )
        .returning();

      return updated ?? null;
    },

    async listSharesForChannel(companyId: string, channelId: string) {
      const shares = await db
        .select()
        .from(chatShares)
        .where(
          and(
            eq(chatShares.companyId, companyId),
            eq(chatShares.channelId, channelId),
          ),
        )
        .orderBy(desc(chatShares.createdAt));

      return shares;
    },

    async forkChat(
      companyId: string,
      token: string,
      forkingUserId: string,
      agentId: string,
    ) {
      return await db.transaction(async (tx) => {
        // 1. Verify share: valid + not expired/revoked + permission includes "fork" or "edit"
        const share = await tx
          .select()
          .from(chatShares)
          .where(
            and(
              eq(chatShares.shareToken, token),
              eq(chatShares.companyId, companyId),
              isNull(chatShares.revokedAt),
              sql`(${chatShares.expiresAt} IS NULL OR ${chatShares.expiresAt} > now())`,
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!share) {
          throw new Error("Share not found or expired");
        }

        // Permission check: "edit" permission allows forking
        if (share.permission !== "edit" && share.permission !== "comment") {
          throw new Error("Share does not allow forking (requires edit or comment permission)");
        }

        // 2. Get original channel + all messages
        const originalChannel = await tx
          .select()
          .from(chatChannels)
          .where(eq(chatChannels.id, share.channelId))
          .then((rows) => rows[0] ?? null);

        if (!originalChannel) {
          throw new Error("Original channel not found");
        }

        const originalMessages = await tx
          .select()
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.channelId, originalChannel.id),
              isNull(chatMessages.deletedAt),
            ),
          )
          .orderBy(chatMessages.createdAt);

        // Determine the fork point (last message)
        const lastMessage =
          originalMessages.length > 0
            ? originalMessages[originalMessages.length - 1]
            : null;

        // 3. Create NEW channel
        const [newChannel] = await tx
          .insert(chatChannels)
          .values({
            companyId,
            agentId,
            name: originalChannel.name
              ? `Fork of ${originalChannel.name}`
              : null,
            status: "open",
            projectId: originalChannel.projectId,
            createdBy: forkingUserId,
            description: originalChannel.description,
            forkedFromChannelId: originalChannel.id,
            forkPointMessageId: lastMessage?.id ?? null,
          })
          .returning();

        // 4. Copy all messages from original to new channel (new UUIDs, new channelId)
        if (originalMessages.length > 0) {
          const messageValues = originalMessages.map((msg) => ({
            channelId: newChannel!.id,
            companyId,
            senderId: msg.senderId,
            senderType: msg.senderType,
            content: msg.content,
            metadata: msg.metadata,
            messageType: msg.messageType,
            replyToId: null as string | null, // Replies don't carry over across forks
            createdAt: msg.createdAt,
          }));

          await tx.insert(chatMessages).values(messageValues);
        }

        // 5. Copy chat_context_links from original to new channel
        const originalLinks = await tx
          .select()
          .from(chatContextLinks)
          .where(eq(chatContextLinks.channelId, originalChannel.id));

        if (originalLinks.length > 0) {
          const linkValues = originalLinks.map((link) => ({
            channelId: newChannel!.id,
            companyId,
            linkType: link.linkType,
            documentId: link.documentId,
            artifactId: link.artifactId,
            folderId: link.folderId,
            linkedChannelId: link.linkedChannelId,
            addedByUserId: forkingUserId,
          }));

          await tx.insert(chatContextLinks).values(linkValues);
        }

        // 6. Publish live event
        publishLiveEvent({
          companyId,
          type: "chat.forked",
          payload: {
            newChannelId: newChannel!.id,
            originalChannelId: originalChannel.id,
            forkingUserId,
            shareId: share.id,
          },
          visibility: { scope: "agents", agentIds: [originalChannel.agentId] },
        });

        // 7. Return new channel
        return newChannel!;
      });
    },

    async getSharedChatData(
      companyId: string,
      token: string,
      opts?: { before?: string; limit?: number },
    ) {
      // Verify token is valid
      const share = await db
        .select()
        .from(chatShares)
        .where(
          and(
            eq(chatShares.shareToken, token),
            isNull(chatShares.revokedAt),
            sql`(${chatShares.expiresAt} IS NULL OR ${chatShares.expiresAt} > now())`,
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!share) {
        return null;
      }

      // Verify same company
      if (share.companyId !== companyId) {
        return null;
      }

      // Get channel info
      const channel = await db
        .select()
        .from(chatChannels)
        .where(eq(chatChannels.id, share.channelId))
        .then((rows) => rows[0] ?? null);

      if (!channel) {
        return null;
      }

      // Get messages (same pagination as chat service)
      const limit = opts?.limit ?? 50;
      const conditions: SQL[] = [
        eq(chatMessages.channelId, channel.id),
        isNull(chatMessages.deletedAt),
      ];

      if (opts?.before) {
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

      return { channel, messages, share, hasMore };
    },
  };
}
