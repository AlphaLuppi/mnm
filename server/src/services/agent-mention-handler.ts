/**
 * CHAT-WS: Agent @Mention Handler
 *
 * Handles @agent mentions in the collaborative chat.
 * Looks up the agent by ID, checks tag-based visibility,
 * and routes the message through the A2A bus.
 *
 * Pattern: Same service factory as chat.ts, a2a-bus.ts
 */

import type { Db } from "@mnm/db";
import { agents, tagAssignments } from "@mnm/db";
import { and, eq, inArray } from "drizzle-orm";
import { tagFilterService } from "./tag-filter.js";
import { a2aBusService } from "./a2a-bus.js";
import { logger as parentLogger } from "../middleware/logger.js";

const logger = parentLogger.child({ module: "agent-mention-handler" });

export function agentMentionHandler(db: Db) {
  const tagFilter = tagFilterService(db);
  const a2aBus = a2aBusService(db);

  return {
    async handleMention(
      companyId: string,
      channelId: string,
      agentId: string,
      content: string,
      senderUserId: string,
    ): Promise<{ success: boolean; agentId?: string; error?: string }> {
      // 1. Find agent by ID in the company
      const [agent] = await db
        .select()
        .from(agents)
        .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
        .limit(1);

      if (!agent) {
        return {
          success: false,
          error: `Agent not found`,
        };
      }

      // 2. Check tag-based visibility (user must share at least 1 tag with agent)
      const userTags = await db
        .select({ tagId: tagAssignments.tagId })
        .from(tagAssignments)
        .where(
          and(
            eq(tagAssignments.companyId, companyId),
            eq(tagAssignments.targetType, "user"),
            eq(tagAssignments.targetId, senderUserId),
          ),
        );

      const agentTags = await db
        .select({ tagId: tagAssignments.tagId })
        .from(tagAssignments)
        .where(
          and(
            eq(tagAssignments.companyId, companyId),
            eq(tagAssignments.targetType, "agent"),
            eq(tagAssignments.targetId, agent.id),
          ),
        );

      if (agentTags.length > 0) {
        const userTagSet = new Set(userTags.map((t) => t.tagId));
        const hasOverlap = agentTags.some((t) => userTagSet.has(t.tagId));
        if (!hasOverlap) {
          return {
            success: false,
            error: `Agent "${agent.name}" is not accessible`,
          };
        }
      }

      // 3. Route message via A2A bus
      try {
        await a2aBus.sendMessage(companyId, senderUserId, {
          receiverId: agent.id,
          messageType: "request",
          content: {
            source: "chat_mention",
            channelId,
            message: content,
            senderUserId,
          },
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to route mention";
        logger.warn(
          { agentId: agent.id, channelId, err },
          "Failed to route @mention via A2A bus",
        );
        return { success: false, error: message };
      }

      logger.info(
        { agentId: agent.id, channelId, senderUserId },
        "Agent mention routed via A2A bus",
      );

      // 4. Return success with agentId
      return { success: true, agentId: agent.id };
    },
  };
}
