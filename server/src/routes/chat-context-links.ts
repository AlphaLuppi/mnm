import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { requireTagScope } from "../middleware/tag-scope.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { chatContextLinkService } from "../services/chat-context-link.js";
import { chatService } from "../services/chat.js";
import { PERMISSIONS, addContextLinkSchema } from "@mnm/shared";
import { badRequest, notFound } from "../errors.js";

export function chatContextLinkRoutes(db: Db) {
  const router = Router();
  const svc = chatContextLinkService(db);
  const chat = chatService(db);

  /** Tag isolation helper: verify the user can see the channel. Returns 404 if not. */
  async function assertChannelVisible(req: import("express").Request, channel: { agentId: string; companyId: string; createdBy: string | null }) {
    const tagScope = requireTagScope(req);
    if (!tagScope.bypassTagFilter) {
      const visible = await chat.isChannelVisible(channel, tagScope);
      if (!visible) throw notFound("Channel not found");
    }
  }

  // POST /api/companies/:companyId/chat/channels/:channelId/context — Add context link
  router.post(
    "/companies/:companyId/chat/channels/:channelId/context",
    requirePermission(db, PERMISSIONS.CHAT_AGENT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await chat.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }
      await assertChannelVisible(req, channel);

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
    requirePermission(db, PERMISSIONS.CHAT_AGENT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await chat.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }
      await assertChannelVisible(req, channel);

      const links = await svc.getLinksForChannel(companyId, channel.id);

      res.json({ links });
    },
  );

  // DELETE /api/companies/:companyId/chat/channels/:channelId/context/:linkId — Remove link
  router.delete(
    "/companies/:companyId/chat/channels/:channelId/context/:linkId",
    requirePermission(db, PERMISSIONS.CHAT_AGENT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await chat.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }
      await assertChannelVisible(req, channel);

      await svc.removeLink(companyId, channel.id, req.params.linkId as string);

      res.status(204).end();
    },
  );

  return router;
}
