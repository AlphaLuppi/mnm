/**
 * A2A-S01 + A2A-S02: A2A Bus API Routes
 *
 * 14 routes for inter-agent communication and permissions:
 * --- A2A-S01 (7 routes) ---
 * - POST   /companies/:companyId/a2a/messages              — send message
 * - POST   /companies/:companyId/a2a/messages/:id/respond  — respond to message
 * - POST   /companies/:companyId/a2a/messages/:id/cancel   — cancel message
 * - GET    /companies/:companyId/a2a/messages               — list messages
 * - GET    /companies/:companyId/a2a/messages/:id           — get message detail
 * - GET    /companies/:companyId/a2a/chains/:chainId        — get chain messages
 * - GET    /companies/:companyId/a2a/stats                  — get stats
 * --- A2A-S02 (7 routes) ---
 * - POST   /companies/:companyId/a2a/permissions            — create permission rule
 * - GET    /companies/:companyId/a2a/permissions             — list permission rules
 * - GET    /companies/:companyId/a2a/permissions/:ruleId    — get permission rule
 * - PUT    /companies/:companyId/a2a/permissions/:ruleId    — update permission rule
 * - DELETE /companies/:companyId/a2a/permissions/:ruleId    — delete permission rule
 * - GET    /companies/:companyId/a2a/default-policy         — get default policy
 * - PUT    /companies/:companyId/a2a/default-policy         — update default policy
 */

import { Router } from "express";
import type { Db } from "@mnm/db";
import {
  sendA2AMessageSchema,
  respondA2AMessageSchema,
  a2aMessageFiltersSchema,
  createA2APermissionRuleSchema,
  updateA2APermissionRuleSchema,
  updateA2ADefaultPolicySchema,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission } from "../middleware/require-permission.js";
import { a2aBusService } from "../services/a2a-bus.js";
import { a2aPermissionsService } from "../services/a2a-permissions.js";
import { emitAudit } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound } from "../errors.js";

export function a2aRoutes(db: Db) {
  const router = Router();
  const svc = a2aBusService(db);
  const permSvc = a2aPermissionsService(db);

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
        if (err.message === "A2A_PERMISSION_DENIED") {
          res.status(403).json({
            error: "A2A_PERMISSION_DENIED",
            senderId: err.senderId,
            receiverId: err.receiverId,
            reason: err.reason,
            matchedRuleId: err.matchedRuleId,
          });
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

      // a2a-s03-route-audit-stats
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "a2a.stats_queried",
        targetType: "a2a_stats",
        targetId: companyId as string,
        metadata: { totalMessages: stats.totalMessages, pendingCount: stats.pendingCount },
      });

      res.json(stats);
    },
  );

  // ==============================================================
  // A2A-S02: Permission Management Routes (7 routes)
  // ==============================================================

  // ──────────────────────────────────────────────────────────
  // a2a-s02-route-create-rule
  // POST /companies/:companyId/a2a/permissions
  // ──────────────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/a2a/permissions",
    requirePermission(db, "agents:create"),
    validate(createA2APermissionRuleSchema),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const rule = await permSvc.createRule(companyId as string, req.body);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "a2a.permission_rule_created",
        targetType: "a2a_permission_rule",
        targetId: rule.id,
        metadata: {
          sourceAgentRole: rule.sourceAgentRole,
          targetAgentRole: rule.targetAgentRole,
          allowed: rule.allowed,
        },
      });

      res.status(201).json(rule);
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s02-route-list-rules
  // GET /companies/:companyId/a2a/permissions
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/a2a/permissions",
    requirePermission(db, "agents:create"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const rules = await permSvc.listRules(companyId as string);
      const defaultPolicy = await permSvc.getDefaultPolicy(companyId as string);

      res.json({ rules, defaultPolicy });
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s02-route-get-rule
  // GET /companies/:companyId/a2a/permissions/:ruleId
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/a2a/permissions/:ruleId",
    requirePermission(db, "agents:create"),
    async (req, res) => {
      const { companyId, ruleId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const rule = await permSvc.getRuleById(companyId as string, ruleId as string);
      if (!rule) {
        throw notFound("A2A permission rule not found");
      }

      res.json(rule);
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s02-route-update-rule
  // PUT /companies/:companyId/a2a/permissions/:ruleId
  // ──────────────────────────────────────────────────────────
  router.put(
    "/companies/:companyId/a2a/permissions/:ruleId",
    requirePermission(db, "agents:create"),
    validate(updateA2APermissionRuleSchema),
    async (req, res) => {
      const { companyId, ruleId } = req.params;
      assertCompanyAccess(req, companyId as string);

      try {
        const rule = await permSvc.updateRule(companyId as string, ruleId as string, req.body);

        await emitAudit({
          req,
          db,
          companyId: companyId as string,
          action: "a2a.permission_rule_updated",
          targetType: "a2a_permission_rule",
          targetId: ruleId as string,
          metadata: { changes: req.body },
        });

        res.json(rule);
      } catch (err: any) {
        if (err.statusCode === 404) {
          throw notFound("A2A permission rule not found");
        }
        throw err;
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s02-route-delete-rule
  // DELETE /companies/:companyId/a2a/permissions/:ruleId
  // ──────────────────────────────────────────────────────────
  router.delete(
    "/companies/:companyId/a2a/permissions/:ruleId",
    requirePermission(db, "agents:create"),
    async (req, res) => {
      const { companyId, ruleId } = req.params;
      assertCompanyAccess(req, companyId as string);

      try {
        await permSvc.deleteRule(companyId as string, ruleId as string);

        await emitAudit({
          req,
          db,
          companyId: companyId as string,
          action: "a2a.permission_rule_deleted",
          targetType: "a2a_permission_rule",
          targetId: ruleId as string,
        });

        res.status(204).end();
      } catch (err: any) {
        if (err.statusCode === 404) {
          throw notFound("A2A permission rule not found");
        }
        throw err;
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s02-route-get-default-policy
  // GET /companies/:companyId/a2a/default-policy
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/a2a/default-policy",
    requirePermission(db, "agents:create"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const policy = await permSvc.getDefaultPolicy(companyId as string);

      res.json({ defaultPolicy: policy });
    },
  );

  // ──────────────────────────────────────────────────────────
  // a2a-s02-route-update-default-policy
  // PUT /companies/:companyId/a2a/default-policy
  // ──────────────────────────────────────────────────────────
  router.put(
    "/companies/:companyId/a2a/default-policy",
    requirePermission(db, "agents:create"),
    validate(updateA2ADefaultPolicySchema),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const policy = await permSvc.updateDefaultPolicy(companyId as string, req.body.policy);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "a2a.default_policy_updated",
        targetType: "company",
        targetId: companyId as string,
        metadata: { policy },
      });

      res.json({ defaultPolicy: policy });
    },
  );

  return router;
}
