import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { chatSharingService } from "../services/chat-sharing.js";
import { chatService } from "../services/chat.js";
import { createShareSchema } from "@mnm/shared";
import { badRequest, forbidden, notFound } from "../errors.js";

export function chatSharingRoutes(db: Db) {
  const router = Router();
  const svc = chatSharingService(db);
  const chat = chatService(db);

  // POST /api/companies/:companyId/chat/channels/:channelId/share — Create share
  router.post(
    "/companies/:companyId/chat/channels/:channelId/share",
    requirePermission(db, "chat:share"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await chat.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
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
    requirePermission(db, "chat:share"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await chat.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      const shares = await svc.listSharesForChannel(companyId, channel.id);

      res.json({ shares });
    },
  );

  // DELETE /api/companies/:companyId/chat/shares/:shareId — Revoke share
  router.delete(
    "/companies/:companyId/chat/shares/:shareId",
    requirePermission(db, "chat:share"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

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
    requirePermission(db, "chat:agent"),
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
    requirePermission(db, "chat:fork"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const { agentId } = req.body as { agentId?: string };
      if (!agentId) {
        throw badRequest("agentId is required");
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
