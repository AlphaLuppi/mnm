import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { chatContextLinkService } from "../services/chat-context-link.js";
import { chatService } from "../services/chat.js";
import { addContextLinkSchema } from "@mnm/shared";
import { badRequest, notFound } from "../errors.js";

export function chatContextLinkRoutes(db: Db) {
  const router = Router();
  const svc = chatContextLinkService(db);
  const chat = chatService(db);

  // POST /api/companies/:companyId/chat/channels/:channelId/context — Add context link
  router.post(
    "/companies/:companyId/chat/channels/:channelId/context",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await chat.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      const body = addContextLinkSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const actor = getActorInfo(req);

      try {
        const link = await svc.addLink(companyId, channel.id, body.data, actor.actorId);
        res.status(201).json(link);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add context link";
        if (message.includes("not found")) {
          throw notFound(message);
        }
        throw err;
      }
    },
  );

  // GET /api/companies/:companyId/chat/channels/:channelId/context — List context links
  router.get(
    "/companies/:companyId/chat/channels/:channelId/context",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await chat.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      const links = await svc.getLinksForChannel(companyId, channel.id);

      res.json({ links });
    },
  );

  // DELETE /api/companies/:companyId/chat/channels/:channelId/context/:linkId — Remove link
  router.delete(
    "/companies/:companyId/chat/channels/:channelId/context/:linkId",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await chat.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      await svc.removeLink(companyId, channel.id, req.params.linkId as string);

      res.status(204).end();
    },
  );

  return router;
}
