/**
 * A2A-S01: A2A Bus — Agent-to-Agent Communication Service
 *
 * Enables structured inter-agent communication with:
 * - Message types: request, response, notification, error
 * - Chain tracking with cycle detection (max depth 5)
 * - TTL-based expiration (default 300s)
 * - Rate limiting (20 messages/min per agent)
 * - Persistence in PostgreSQL (a2a_messages table)
 * - LiveEvent notifications for real-time updates
 * - Audit trail for all A2A operations
 *
 * Pattern: Same service factory as automation-cursors.ts, compaction-watcher.ts
 */

import { randomUUID } from "node:crypto";
import { and, eq, sql, desc, inArray, lt, count } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { a2aMessages, agents } from "@mnm/db";
import type {
  A2AMessage,
  A2AMessageType,
  A2AMessageStatus,
  A2AStats,
  A2AMessageFilters,
  A2AChainInfo,
} from "@mnm/shared";
import { publishLiveEvent } from "./live-events.js";
import { auditService } from "./audit.js";
// a2a-s02-bus-integration
import { a2aPermissionsService } from "./a2a-permissions.js";
import { logger as parentLogger } from "../middleware/logger.js";

const logger = parentLogger.child({ module: "a2a-bus" });

// --- Constants ---

const MAX_CHAIN_DEPTH = 5;
const MAX_A2A_RATE = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_TTL_SECONDS = 300;
const CLEANUP_INTERVAL_MS = 60_000;

// --- Rate limiting ---

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// a2a-s01-rate-limit
function checkRateLimit(agentId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(agentId);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(agentId, entry);
  }

  entry.count += 1;
  if (entry.count > MAX_A2A_RATE) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

// Periodic rate limit cleanup
const rateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);
rateLimitCleanup.unref();

// --- Helper: row to A2AMessage ---

function rowToMessage(row: typeof a2aMessages.$inferSelect): A2AMessage {
  return {
    id: row.id,
    companyId: row.companyId,
    chainId: row.chainId,
    senderId: row.senderId,
    receiverId: row.receiverId,
    replyToId: row.replyToId,
    messageType: row.messageType as A2AMessageType,
    status: row.status as A2AMessageStatus,
    content: (row.content ?? {}) as Record<string, unknown>,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    chainDepth: row.chainDepth,
    ttlSeconds: row.ttlSeconds,
    expiresAt: row.expiresAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// --- Service factory ---

// a2a-s01-service-factory
export function a2aBusService(db: Db) {
  const audit = auditService(db);
  const permSvc = a2aPermissionsService(db);

  // --- Cycle detection tracking (in-memory per companyId) ---
  // Counts cycles detected for stats
  let cyclesDetectedCount = 0;

  // --- TTL cleanup interval ---
  const cleanupTimer = setInterval(() => {
    void cleanupExpiredMessages();
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  // a2a-s01-detect-cycle
  async function detectCycle(chainId: string, receiverId: string): Promise<boolean> {
    // Get all distinct senders in this chain
    const chainMessages = await db
      .select({ senderId: a2aMessages.senderId })
      .from(a2aMessages)
      .where(eq(a2aMessages.chainId, chainId));

    const senderIds = new Set(chainMessages.map((m) => m.senderId));

    // If the intended receiver has already been a sender in this chain, it's a cycle
    return senderIds.has(receiverId);
  }

  // a2a-s01-send-message
  async function sendMessage(
    companyId: string,
    senderId: string,
    input: {
      receiverId: string;
      messageType?: A2AMessageType;
      content: Record<string, unknown>;
      metadata?: Record<string, unknown> | null;
      chainId?: string;
      replyToId?: string;
      ttlSeconds?: number;
    },
  ): Promise<A2AMessage> {
    // Rate limit check
    const rl = checkRateLimit(senderId);
    if (!rl.allowed) {
      throw Object.assign(new Error("RATE_LIMITED"), {
        statusCode: 429,
        retryAfter: rl.retryAfter,
      });
    }

    // a2a-s02-bus-integration — Permission check before sending
    // Roles removed — pass "agent" as generic role for backward compat with a2a-permissions
    const senderRole = "agent";
    const receiverRole = "agent";

    const permResult = await permSvc.checkPermission(
      companyId,
      senderId,
      senderRole,
      input.receiverId,
      receiverRole,
    );

    if (!permResult.allowed) {
      await audit.emit({
        companyId,
        actorId: senderId,
        actorType: "agent",
        action: "a2a.permission_denied",
        targetType: "a2a_message",
        targetId: input.receiverId,
        metadata: {
          senderId,
          senderRole,
          receiverId: input.receiverId,
          receiverRole,
          matchedRuleId: permResult.matchedRuleId,
          reason: permResult.reason,
          defaultPolicy: permResult.defaultPolicy,
        },
        severity: "warning",
      });

      throw Object.assign(new Error("A2A_PERMISSION_DENIED"), {
        statusCode: 403,
        senderId,
        receiverId: input.receiverId,
        reason: permResult.reason,
        matchedRuleId: permResult.matchedRuleId,
      });
    }

    // a2a-s03-audit-permission-allowed
    await audit.emit({
      companyId,
      actorId: senderId,
      actorType: "agent",
      action: "a2a.permission_allowed",
      targetType: "a2a_message",
      targetId: input.receiverId,
      metadata: {
        senderId,
        senderRole,
        receiverId: input.receiverId,
        receiverRole,
        matchedRuleId: permResult.matchedRuleId,
        reason: permResult.reason,
        defaultPolicy: permResult.defaultPolicy,
      },
      severity: "info",
    });

    const messageType = input.messageType ?? "request";
    const ttlSeconds = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const chainId = input.chainId ?? randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    // Determine chain depth
    let chainDepth = 0;
    if (input.chainId) {
      // Existing chain — get the max depth so far
      const maxDepthResult = await db
        .select({ maxDepth: sql<number>`COALESCE(MAX(${a2aMessages.chainDepth}), -1)` })
        .from(a2aMessages)
        .where(eq(a2aMessages.chainId, input.chainId));

      chainDepth = (maxDepthResult[0]?.maxDepth ?? -1) + 1;

      // Chain depth check
      if (chainDepth >= MAX_CHAIN_DEPTH) {
        cyclesDetectedCount++;

        await audit.emit({
          companyId,
          actorId: senderId,
          actorType: "agent",
          action: "a2a.chain_depth_exceeded",
          targetType: "a2a_message",
          targetId: chainId,
          metadata: { chainId, chainDepth, maxDepth: MAX_CHAIN_DEPTH, senderId, receiverId: input.receiverId },
          severity: "warning",
        });

        throw Object.assign(new Error("CHAIN_DEPTH_EXCEEDED"), {
          statusCode: 400,
          chainDepth,
          maxDepth: MAX_CHAIN_DEPTH,
        });
      }

      // Cycle detection
      const hasCycle = await detectCycle(chainId, input.receiverId);
      if (hasCycle) {
        cyclesDetectedCount++;

        await audit.emit({
          companyId,
          actorId: senderId,
          actorType: "agent",
          action: "a2a.cycle_detected",
          targetType: "a2a_message",
          targetId: chainId,
          metadata: { chainId, senderId, receiverId: input.receiverId, chainDepth },
          severity: "warning",
        });

        throw Object.assign(new Error("CYCLE_DETECTED"), {
          statusCode: 400,
          chainId,
          receiverId: input.receiverId,
        });
      }
    }

    // Insert the message
    const [row] = await db
      .insert(a2aMessages)
      .values({
        companyId,
        chainId,
        senderId,
        receiverId: input.receiverId,
        replyToId: input.replyToId ?? null,
        messageType,
        status: "pending",
        content: input.content,
        metadata: input.metadata ?? null,
        chainDepth,
        ttlSeconds,
        expiresAt,
      })
      .returning();

    const message = rowToMessage(row);

    // a2a-s01-live-event-sent
    publishLiveEvent({
      companyId,
      type: "a2a.message_sent",
      payload: {
        messageId: message.id,
        chainId: message.chainId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        messageType: message.messageType,
        chainDepth: message.chainDepth,
      },
    });

    // a2a-s03-audit-enriched-sent
    await audit.emit({
      companyId,
      actorId: senderId,
      actorType: "agent",
      action: "a2a.message_sent",
      targetType: "a2a_message",
      targetId: message.id,
      metadata: {
        chainId: message.chainId,
        receiverId: message.receiverId,
        messageType: message.messageType,
        chainDepth: message.chainDepth,
        ttlSeconds: message.ttlSeconds,
        contentSize: Object.keys(input.content).length,
        expiresAt: message.expiresAt,
      },
      severity: "info",
    });

    logger.info(
      { messageId: message.id, chainId: message.chainId, senderId, receiverId: input.receiverId },
      "A2A message sent",
    );

    return message;
  }

  // a2a-s01-respond-to-message
  async function respondToMessage(
    companyId: string,
    messageId: string,
    senderId: string,
    content: Record<string, unknown>,
    metadata?: Record<string, unknown> | null,
  ): Promise<A2AMessage> {
    // Find the original message
    const [original] = await db
      .select()
      .from(a2aMessages)
      .where(and(eq(a2aMessages.id, messageId), eq(a2aMessages.companyId, companyId)));

    if (!original) {
      throw Object.assign(new Error("Message not found"), { statusCode: 404 });
    }

    if (original.status !== "pending") {
      throw Object.assign(new Error(`Cannot respond to message with status '${original.status}'`), {
        statusCode: 400,
      });
    }

    // Rate limit check
    const rl = checkRateLimit(senderId);
    if (!rl.allowed) {
      throw Object.assign(new Error("RATE_LIMITED"), {
        statusCode: 429,
        retryAfter: rl.retryAfter,
      });
    }

    const now = new Date();
    const ttlSeconds = DEFAULT_TTL_SECONDS;
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    // Create response message
    const [responseRow] = await db
      .insert(a2aMessages)
      .values({
        companyId,
        chainId: original.chainId,
        senderId,
        receiverId: original.senderId,
        replyToId: messageId,
        messageType: "response",
        status: "completed",
        content,
        metadata: metadata ?? null,
        chainDepth: original.chainDepth + 1,
        ttlSeconds,
        expiresAt,
        respondedAt: now,
      })
      .returning();

    // Update original message to completed
    await db
      .update(a2aMessages)
      .set({ status: "completed", respondedAt: now })
      .where(eq(a2aMessages.id, messageId));

    const response = rowToMessage(responseRow);

    // a2a-s01-live-event-responded
    publishLiveEvent({
      companyId,
      type: "a2a.message_responded",
      payload: {
        messageId: response.id,
        originalMessageId: messageId,
        chainId: response.chainId,
        senderId: response.senderId,
        receiverId: response.receiverId,
      },
    });

    // a2a-s03-audit-enriched-responded
    const responseTimeMs = now.getTime() - original.createdAt.getTime();
    await audit.emit({
      companyId,
      actorId: senderId,
      actorType: "agent",
      action: "a2a.message_responded",
      targetType: "a2a_message",
      targetId: response.id,
      metadata: {
        originalMessageId: messageId,
        chainId: response.chainId,
        chainDepth: response.chainDepth,
        responseTimeMs,
      },
      severity: "info",
    });

    logger.info(
      { responseId: response.id, originalId: messageId, chainId: response.chainId },
      "A2A message responded",
    );

    return response;
  }

  // a2a-s01-cancel-message
  async function cancelMessage(
    companyId: string,
    messageId: string,
  ): Promise<A2AMessage> {
    const [original] = await db
      .select()
      .from(a2aMessages)
      .where(and(eq(a2aMessages.id, messageId), eq(a2aMessages.companyId, companyId)));

    if (!original) {
      throw Object.assign(new Error("Message not found"), { statusCode: 404 });
    }

    if (original.status !== "pending") {
      throw Object.assign(new Error(`Cannot cancel message with status '${original.status}'`), {
        statusCode: 400,
      });
    }

    const [updated] = await db
      .update(a2aMessages)
      .set({ status: "cancelled" })
      .where(eq(a2aMessages.id, messageId))
      .returning();

    const message = rowToMessage(updated);

    // Audit
    await audit.emit({
      companyId,
      actorId: "system",
      actorType: "system",
      action: "a2a.message_cancelled",
      targetType: "a2a_message",
      targetId: messageId,
      metadata: { chainId: message.chainId, senderId: message.senderId, receiverId: message.receiverId },
      severity: "info",
    });

    logger.info({ messageId, chainId: message.chainId }, "A2A message cancelled");

    return message;
  }

  // a2a-s01-get-messages
  async function getMessages(
    companyId: string,
    filters: A2AMessageFilters = {},
  ): Promise<A2AMessage[]> {
    const conditions = [eq(a2aMessages.companyId, companyId)];

    if (filters.senderId) {
      conditions.push(eq(a2aMessages.senderId, filters.senderId));
    }
    if (filters.receiverId) {
      conditions.push(eq(a2aMessages.receiverId, filters.receiverId));
    }
    if (filters.messageType) {
      conditions.push(eq(a2aMessages.messageType, filters.messageType));
    }
    if (filters.status) {
      conditions.push(eq(a2aMessages.status, filters.status));
    }
    if (filters.chainId) {
      conditions.push(eq(a2aMessages.chainId, filters.chainId));
    }

    const rows = await db
      .select()
      .from(a2aMessages)
      .where(and(...conditions))
      .orderBy(desc(a2aMessages.createdAt))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);

    return rows.map(rowToMessage);
  }

  // a2a-s01-get-message-by-id
  async function getMessageById(
    companyId: string,
    messageId: string,
  ): Promise<A2AMessage | null> {
    const [row] = await db
      .select()
      .from(a2aMessages)
      .where(and(eq(a2aMessages.id, messageId), eq(a2aMessages.companyId, companyId)));

    return row ? rowToMessage(row) : null;
  }

  // a2a-s01-get-chain-messages
  async function getChainMessages(
    companyId: string,
    chainId: string,
  ): Promise<A2AMessage[]> {
    const rows = await db
      .select()
      .from(a2aMessages)
      .where(and(eq(a2aMessages.companyId, companyId), eq(a2aMessages.chainId, chainId)))
      .orderBy(a2aMessages.chainDepth);

    return rows.map(rowToMessage);
  }

  // a2a-s01-get-stats
  async function getStats(companyId: string): Promise<A2AStats> {
    const [totals] = await db
      .select({
        totalMessages: count(),
        pendingCount: count(sql`CASE WHEN ${a2aMessages.status} = 'pending' THEN 1 END`),
        completedCount: count(sql`CASE WHEN ${a2aMessages.status} = 'completed' THEN 1 END`),
        expiredCount: count(sql`CASE WHEN ${a2aMessages.status} = 'expired' THEN 1 END`),
        cancelledCount: count(sql`CASE WHEN ${a2aMessages.status} = 'cancelled' THEN 1 END`),
        errorCount: count(sql`CASE WHEN ${a2aMessages.status} = 'error' THEN 1 END`),
        averageResponseTimeMs: sql<number | null>`
          AVG(
            CASE WHEN ${a2aMessages.respondedAt} IS NOT NULL
            THEN EXTRACT(EPOCH FROM (${a2aMessages.respondedAt} - ${a2aMessages.createdAt})) * 1000
            END
          )
        `,
      })
      .from(a2aMessages)
      .where(eq(a2aMessages.companyId, companyId));

    return {
      totalMessages: Number(totals?.totalMessages ?? 0),
      pendingCount: Number(totals?.pendingCount ?? 0),
      completedCount: Number(totals?.completedCount ?? 0),
      expiredCount: Number(totals?.expiredCount ?? 0),
      cancelledCount: Number(totals?.cancelledCount ?? 0),
      errorCount: Number(totals?.errorCount ?? 0),
      cyclesDetected: cyclesDetectedCount,
      averageResponseTimeMs: totals?.averageResponseTimeMs != null
        ? Math.round(Number(totals.averageResponseTimeMs))
        : null,
    };
  }

  // a2a-s01-cleanup-expired
  async function cleanupExpiredMessages(targetCompanyId?: string): Promise<number> {
    const now = new Date();
    const conditions = [
      eq(a2aMessages.status, "pending"),
      lt(a2aMessages.expiresAt, now),
    ];

    if (targetCompanyId) {
      conditions.push(eq(a2aMessages.companyId, targetCompanyId));
    }

    const expired = await db
      .update(a2aMessages)
      .set({ status: "expired" })
      .where(and(...conditions))
      .returning();

    if (expired.length > 0) {
      // Group by companyId for LiveEvents
      const byCompany = new Map<string, typeof expired>();
      for (const row of expired) {
        const list = byCompany.get(row.companyId) ?? [];
        list.push(row);
        byCompany.set(row.companyId, list);
      }

      for (const [cid, messages] of byCompany) {
        // a2a-s01-live-event-expired
        publishLiveEvent({
          companyId: cid,
          type: "a2a.message_expired",
          payload: { expiredCount: messages.length, messageIds: messages.map((m) => m.id) },
        });

        // a2a-s03-audit-expired
        for (const msg of messages) {
          await audit.emit({
            companyId: cid,
            actorId: "system",
            actorType: "system",
            action: "a2a.message_expired",
            targetType: "a2a_message",
            targetId: msg.id,
            metadata: {
              chainId: msg.chainId,
              senderId: msg.senderId,
              receiverId: msg.receiverId,
              ttlSeconds: msg.ttlSeconds,
            },
            severity: "warning",
          });
        }
      }

      logger.info({ expiredCount: expired.length }, "A2A messages expired by TTL cleanup");
    }

    return expired.length;
  }

  return {
    sendMessage,
    respondToMessage,
    cancelMessage,
    getMessages,
    getMessageById,
    getChainMessages,
    getStats,
    detectCycle,
    cleanupExpiredMessages,
  };
}
