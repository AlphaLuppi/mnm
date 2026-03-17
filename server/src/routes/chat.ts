import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { chatService } from "../services/chat.js";
import { createChannelSchema, updateMessageSchema, pipeAttachSchema } from "../validators/chat-ws.js";
import { badRequest, forbidden, notFound, conflict } from "../errors.js";
import { createContainerPipeManager } from "../services/container-pipe.js";
import { emitAudit } from "../services/audit-emitter.js";
import { publishLiveEvent } from "../services/live-events.js";

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

      // CHAT-S02: pass createdBy from actor info
      const actor = getActorInfo(req);

      const channel = await svc.createChannel(companyId, body.data.agentId, {
        heartbeatRunId: body.data.heartbeatRunId,
        name: body.data.name,
        // CHAT-S02: new fields
        projectId: body.data.projectId,
        createdBy: actor.actorId,
        description: body.data.description,
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
      // CHAT-S02: new query params
      const projectId = (req.query.projectId as string) || undefined;
      const sortBy = (req.query.sortBy as string) || undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      const result = await svc.listChannels(companyId, {
        status,
        agentId,
        projectId,
        limit,
        offset,
        sortBy: sortBy === "lastMessageAt" ? "lastMessageAt" : "createdAt",
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

  // CHAT-S02: PATCH /api/companies/:companyId/chat/channels/:channelId/messages/:messageId — edit/soft-delete message
  router.patch(
    "/companies/:companyId/chat/channels/:channelId/messages/:messageId",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = updateMessageSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      // Verify channel belongs to this company
      const channel = await svc.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      // Get the message
      const message = await svc.getMessage(req.params.messageId as string);
      if (!message || message.channelId !== channel.id) {
        throw notFound("Message not found");
      }

      // System messages cannot be edited or deleted
      if (message.messageType === "system") {
        throw forbidden("System messages cannot be edited");
      }

      // Only the author can edit/delete
      const actor = getActorInfo(req);
      if (message.senderId !== actor.actorId) {
        throw forbidden("Only the author can edit or delete this message");
      }

      // Cannot edit a deleted message
      if (message.deletedAt && body.data.content) {
        throw badRequest("Cannot edit a deleted message");
      }

      // Handle soft-delete
      if (body.data.deleted) {
        const deleted = await svc.softDeleteMessage(message.id, channel.id);
        publishLiveEvent({
          companyId,
          type: "chat.message_sent",
          payload: { channelId: channel.id, messageId: message.id, action: "deleted" },
        });
        res.json(deleted);
        return;
      }

      // Handle edit
      if (body.data.content) {
        const updated = await svc.updateMessage(message.id, channel.id, {
          content: body.data.content,
        });
        publishLiveEvent({
          companyId,
          type: "chat.message_sent",
          payload: { channelId: channel.id, messageId: message.id, action: "edited" },
        });
        res.json(updated);
        return;
      }

      // Nothing to do
      res.json(message);
    },
  );

  // CHAT-S02: GET /api/companies/:companyId/chat/channels/:channelId/messages/:messageId/replies — thread replies
  router.get(
    "/companies/:companyId/chat/channels/:channelId/messages/:messageId/replies",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await svc.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const replies = await svc.getThreadReplies(
        req.params.messageId as string,
        limit,
      );

      res.json({ replies, total: replies.length });
    },
  );

  // ---- CHAT-S03: Pipe routes ----

  const pipeMgr = createContainerPipeManager(db);

  // chat-s03-pipe-attach — POST /api/companies/:companyId/chat/channels/:channelId/pipe
  router.post(
    "/companies/:companyId/chat/channels/:channelId/pipe",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = pipeAttachSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      // Verify channel belongs to this company
      const channel = await svc.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      if (channel.status === "closed") {
        throw conflict("Channel is closed");
      }

      const actor = getActorInfo(req);

      try {
        const pipeStatus = await pipeMgr.attachPipe({
          channelId: channel.id,
          instanceId: body.data.instanceId,
          companyId,
          actorId: actor.actorId,
          agentId: channel.agentId,
          execCommand: body.data.execCommand,
          tty: body.data.tty,
        });

        // chat-s03-audit-attached
        await emitAudit({
          req,
          db,
          companyId,
          action: "chat.pipe_attached",
          targetType: "chat_channel",
          targetId: channel.id,
          metadata: { instanceId: body.data.instanceId, agentId: channel.agentId },
        });

        res.status(201).json(pipeStatus);
      } catch (err: any) {
        if (err.message === "PIPE_ALREADY_ATTACHED") {
          throw conflict("A pipe is already attached to this channel");
        }
        if (err.message === "CONTAINER_NOT_FOUND") {
          throw notFound("Container instance not found");
        }
        if (err.message === "CONTAINER_NOT_RUNNING") {
          throw conflict("Container is not running");
        }
        if (err.message === "CONTAINER_NO_DOCKER_ID") {
          throw conflict("Container has no Docker ID");
        }
        throw err;
      }
    },
  );

  // chat-s03-pipe-detach — DELETE /api/companies/:companyId/chat/channels/:channelId/pipe
  router.delete(
    "/companies/:companyId/chat/channels/:channelId/pipe",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await svc.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      try {
        const pipeStatus = await pipeMgr.detachPipe(channel.id);

        // chat-s03-audit-detached
        await emitAudit({
          req,
          db,
          companyId,
          action: "chat.pipe_detached",
          targetType: "chat_channel",
          targetId: channel.id,
          metadata: { instanceId: pipeStatus.instanceId },
        });

        res.json(pipeStatus);
      } catch (err: any) {
        if (err.message === "PIPE_NOT_FOUND") {
          throw notFound("No pipe attached to this channel");
        }
        throw err;
      }
    },
  );

  // chat-s03-pipe-status — GET /api/companies/:companyId/chat/channels/:channelId/pipe
  router.get(
    "/companies/:companyId/chat/channels/:channelId/pipe",
    requirePermission(db, "chat:agent"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await svc.getChannel(req.params.channelId as string);
      if (!channel || channel.companyId !== companyId) {
        throw notFound("Channel not found");
      }

      const pipeStatus = pipeMgr.getPipeStatus(channel.id);
      if (!pipeStatus) {
        res.json({ channelId: channel.id, status: "detached", instanceId: null, attachedAt: null, detachedAt: null, error: null, messagesPiped: 0 });
        return;
      }

      res.json(pipeStatus);
    },
  );

  return router;
}
