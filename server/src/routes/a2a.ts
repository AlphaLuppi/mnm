/**
 * A2A-S01: A2A Bus API Routes
 *
 * 7 routes for inter-agent communication:
 * - POST   /companies/:companyId/a2a/messages              — send message
 * - POST   /companies/:companyId/a2a/messages/:id/respond  — respond to message
 * - POST   /companies/:companyId/a2a/messages/:id/cancel   — cancel message
 * - GET    /companies/:companyId/a2a/messages               — list messages
 * - GET    /companies/:companyId/a2a/messages/:id           — get message detail
 * - GET    /companies/:companyId/a2a/chains/:chainId        — get chain messages
 * - GET    /companies/:companyId/a2a/stats                  — get stats
 */

import { Router } from "express";
import type { Db } from "@mnm/db";
import {
  sendA2AMessageSchema,
  respondA2AMessageSchema,
  a2aMessageFiltersSchema,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission } from "../middleware/require-permission.js";
import { a2aBusService } from "../services/a2a-bus.js";
import { emitAudit } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound } from "../errors.js";

export function a2aRoutes(db: Db) {
  const router = Router();
  const svc = a2aBusService(db);

  // ──────────────────────────────────────────────────────────
  // a2a-s01-route-send
  // POST /companies/:companyId/a2a/messages
  // ──────────────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/a2a/messages",
    requirePermission(db, "agents:create"),
    validate(sendA2AMessageSchema),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const actor = getActorInfo(req);
      const body = req.body;

      try {
        const message = await svc.sendMessage(companyId as string, body.receiverId, {
          receiverId: body.receiverId,
          messageType: body.messageType,
          content: body.content,
          metadata: body.metadata,
          chainId: body.chainId,
          replyToId: body.replyToId,
          ttlSeconds: body.ttlSeconds,
        });

        await emitAudit({
          req,
          db,
          companyId: companyId as string,
          action: "a2a.message_sent",
          targetType: "a2a_message",
          targetId: message.id,
          metadata: { chainId: message.chainId, receiverId: message.receiverId, messageType: message.messageType },
        });

        res.status(201).json(message);
      } catch (err: any) {
        if (err.message === "RATE_LIMITED") {
          res.status(429).json({ error: "RATE_LIMITED", retryAfter: err.retryAfter });
          return;
        }
        if (err.message === "CYCLE_DETECTED") {
          res.status(400).json({ error: "CYCLE_DETECTED", chainId: err.chainId, receiverId: err.receiverId });
          return;
        }
        if (err.message === "CHAIN_DEPTH_EXCEEDED") {
          res.status(400).json({ error: "CHAIN_DEPTH_EXCEEDED", chainDepth: err.chainDepth, maxDepth: err.maxDepth });
          return;
        }
        throw err;
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s01-route-respond
  // POST /companies/:companyId/a2a/messages/:id/respond
  // ──────────────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/a2a/messages/:id/respond",
    requirePermission(db, "agents:create"),
    validate(respondA2AMessageSchema),
    async (req, res) => {
      const { companyId, id } = req.params;
      assertCompanyAccess(req, companyId as string);

      const actor = getActorInfo(req);
      const body = req.body;

      try {
        const response = await svc.respondToMessage(
          companyId as string,
          id as string,
          actor.actorId ?? "system",
          body.content,
          body.metadata,
        );

        await emitAudit({
          req,
          db,
          companyId: companyId as string,
          action: "a2a.message_responded",
          targetType: "a2a_message",
          targetId: response.id,
          metadata: { originalMessageId: id, chainId: response.chainId },
        });

        res.json(response);
      } catch (err: any) {
        if (err.statusCode === 404) {
          throw notFound("A2A message not found");
        }
        if (err.message === "RATE_LIMITED") {
          res.status(429).json({ error: "RATE_LIMITED", retryAfter: err.retryAfter });
          return;
        }
        throw err;
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s01-route-cancel
  // POST /companies/:companyId/a2a/messages/:id/cancel
  // ──────────────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/a2a/messages/:id/cancel",
    requirePermission(db, "agents:create"),
    async (req, res) => {
      const { companyId, id } = req.params;
      assertCompanyAccess(req, companyId as string);

      try {
        const message = await svc.cancelMessage(companyId as string, id as string);

        await emitAudit({
          req,
          db,
          companyId: companyId as string,
          action: "a2a.message_cancelled",
          targetType: "a2a_message",
          targetId: id as string,
          metadata: { chainId: message.chainId },
        });

        res.json(message);
      } catch (err: any) {
        if (err.statusCode === 404) {
          throw notFound("A2A message not found");
        }
        throw err;
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s01-route-list
  // GET /companies/:companyId/a2a/messages
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/a2a/messages",
    requirePermission(db, "agents:create"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const filters = a2aMessageFiltersSchema.parse(req.query);
      const messages = await svc.getMessages(companyId as string, filters);

      res.json(messages);
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s01-route-detail
  // GET /companies/:companyId/a2a/messages/:id
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/a2a/messages/:id",
    requirePermission(db, "agents:create"),
    async (req, res) => {
      const { companyId, id } = req.params;
      assertCompanyAccess(req, companyId as string);

      const message = await svc.getMessageById(companyId as string, id as string);
      if (!message) {
        throw notFound("A2A message not found");
      }

      res.json(message);
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s01-route-chain
  // GET /companies/:companyId/a2a/chains/:chainId
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/a2a/chains/:chainId",
    requirePermission(db, "agents:create"),
    async (req, res) => {
      const { companyId, chainId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const messages = await svc.getChainMessages(companyId as string, chainId as string);

      res.json(messages);
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s01-route-stats
  // GET /companies/:companyId/a2a/stats
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/a2a/stats",
    requirePermission(db, "agents:create"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const stats = await svc.getStats(companyId as string);

      res.json(stats);
    },
  );

  return router;
}
