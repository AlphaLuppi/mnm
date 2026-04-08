import { Router } from "express";
import type { Db } from "@mnm/db";
import { chatShares } from "@mnm/db";
import { eq, and } from "drizzle-orm";
import { requirePermission } from "../middleware/require-permission.js";
import { requireTagScope } from "../middleware/tag-scope.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { chatSharingService } from "../services/chat-sharing.js";
import { chatService } from "../services/chat.js";
import { tagFilterService } from "../services/tag-filter.js";
import { PERMISSIONS, createShareSchema } from "@mnm/shared";
import { badRequest, forbidden, notFound } from "../errors.js";

export function chatSharingRoutes(db: Db) {
  const router = Router();
  const svc = chatSharingService(db);
  const chat = chatService(db);
  const tagFilter = tagFilterService(db);

  // POST /api/companies/:companyId/chat/channels/:channelId/share — Create share
  router.post(
    "/companies/:companyId/chat/channels/:channelId/share",
    requirePermission(db, PERMISSIONS.CHAT_SHARE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const tagScope = requireTagScope(req);

      // Verify channel belongs to this company
      const channel = await chat.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      // Tag isolation: verify the user can see this channel
      if (!tagScope.bypassTagFilter) {
        const visible = await chat.isChannelVisible(channel, tagScope);
        if (!visible) throw notFound("Channel not found");
      }

      const body = createShareSchema.safeParse({
        ...req.body,
        channelId: channel.id,
      });
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const actor = getActorInfo(req);

      const share = await svc.createShare(companyId, channel.id, actor.actorId, {
        permission: body.data.permission,
        expiresAt: body.data.expiresAt,
      });

      res.status(201).json(share);
    },
  );

  // GET /api/companies/:companyId/chat/channels/:channelId/shares — List shares
  router.get(
    "/companies/:companyId/chat/channels/:channelId/shares",
    requirePermission(db, PERMISSIONS.CHAT_SHARE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const tagScope = requireTagScope(req);

      // Verify channel belongs to this company
      const channel = await chat.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      // Tag isolation: verify the user can see this channel
      if (!tagScope.bypassTagFilter) {
        const visible = await chat.isChannelVisible(channel, tagScope);
        if (!visible) throw notFound("Channel not found");
      }

      const shares = await svc.listSharesForChannel(companyId, channel.id);

      res.json({ shares });
    },
  );

  // DELETE /api/companies/:companyId/chat/shares/:shareId — Revoke share
  router.delete(
    "/companies/:companyId/chat/shares/:shareId",
    requirePermission(db, PERMISSIONS.CHAT_SHARE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const tagScope = requireTagScope(req);

      // Tag isolation: fetch the share's channel and check visibility
      if (!tagScope.bypassTagFilter) {
        const shareId = req.params.shareId as string;
        const [share] = await db
          .select({ channelId: chatShares.channelId })
          .from(chatShares)
          .where(and(eq(chatShares.id, shareId), eq(chatShares.companyId, companyId)))
          .limit(1);
        if (share) {
          const channel = await chat.getChannel(share.channelId);
          if (channel) {
            const visible = await chat.isChannelVisible(channel, tagScope);
            if (!visible) throw notFound("Share not found");
          }
        }
      }

      const updated = await svc.revokeShare(companyId, req.params.shareId as string);
      if (!updated) {
        throw notFound("Share not found");
      }

      res.json(updated);
    },
  );

  // GET /api/companies/:companyId/shared/chat/:token — Access shared chat
  router.get(
    "/companies/:companyId/shared/chat/:token",
    requirePermission(db, PERMISSIONS.CHAT_AGENT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const before = (req.query.before as string) || undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const result = await svc.getSharedChatData(companyId, req.params.token as string, {
        before,
        limit,
      });

      if (!result) {
        throw notFound("Shared chat not found or expired");
      }

      res.json(result);
    },
  );

  // POST /api/companies/:companyId/shared/chat/:token/fork — Fork chat
  router.post(
    "/companies/:companyId/shared/chat/:token/fork",
    requirePermission(db, PERMISSIONS.CHAT_FORK),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const tagScope = requireTagScope(req);

      const { agentId } = req.body as { agentId?: string };
      if (!agentId) {
        throw badRequest("agentId is required");
      }

      // Tag isolation: verify the target agent is visible
      if (!tagScope.bypassTagFilter) {
        const agentVisible = await tagFilter.isAgentVisible(companyId, agentId, tagScope);
        if (!agentVisible) throw notFound("Agent not found");
      }

      const actor = getActorInfo(req);

      try {
        const newChannel = await svc.forkChat(
          companyId,
          req.params.token as string,
          actor.actorId,
          agentId,
        );

        res.status(201).json(newChannel);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fork failed";
        if (
          message.includes("not found") ||
          message.includes("expired") ||
          message.includes("does not allow")
        ) {
          throw forbidden(message);
        }
        throw err;
      }
    },
  );

  return router;
}
