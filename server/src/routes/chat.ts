import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess } from "./authz.js";
import { chatService } from "../services/chat.js";
import { createChannelSchema } from "../validators/chat-ws.js";
import { badRequest, notFound } from "../errors.js";

export function chatRoutes(db: Db) {
  const router = Router();
  const svc = chatService(db);

  // POST /api/companies/:companyId/chat/channels — create channel
  router.post(
    "/companies/:companyId/chat/channels",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = createChannelSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const channel = await svc.createChannel(companyId, body.data.agentId, {
        heartbeatRunId: body.data.heartbeatRunId,
        name: body.data.name,
      });

      res.status(201).json(channel);
    },
  );

  // GET /api/companies/:companyId/chat/channels — list channels
  router.get(
    "/companies/:companyId/chat/channels",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const status = (req.query.status as string) || undefined;
      const agentId = (req.query.agentId as string) || undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      const result = await svc.listChannels(companyId, {
        status,
        agentId,
        limit,
        offset,
      });

      res.json(result);
    },
  );

  // GET /api/companies/:companyId/chat/channels/:channelId — channel detail
  router.get(
    "/companies/:companyId/chat/channels/:channelId",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const channel = await svc.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      const messageCount = await svc.getMessageCount(channel.id);

      res.json({ ...channel, messageCount });
    },
  );

  // GET /api/companies/:companyId/chat/channels/:channelId/messages — message history
  router.get(
    "/companies/:companyId/chat/channels/:channelId/messages",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await svc.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      const before = (req.query.before as string) || undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const result = await svc.getMessages(channel.id, { before, limit });

      res.json(result);
    },
  );

  // PATCH /api/companies/:companyId/chat/channels/:channelId — update/close channel
  router.patch(
    "/companies/:companyId/chat/channels/:channelId",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const channel = await svc.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      const { status, reason } = req.body as {
        status?: string;
        reason?: string;
      };

      if (status === "closed") {
        const closeReason =
          reason === "agent_terminated" || reason === "timeout"
            ? reason
            : "manual_close";
        const updated = await svc.closeChannel(channel.id, closeReason);
        res.json(updated);
        return;
      }

      res.json(channel);
    },
  );

  return router;
}
