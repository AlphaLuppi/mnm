import { Router } from "express";
import { eq, and } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { agentConfigLayers, configLayers } from "@mnm/db";
import { requirePermission, assertCompanyPermission } from "../middleware/require-permission.js";
import { configLayerService } from "../services/config-layer.js";
import { configLayerConflictService } from "../services/config-layer-conflict.js";
import { auditService } from "../services/audit.js";
import { badRequest, notFound } from "../errors.js";
import { assertCompanyAccess } from "./authz.js";
import {
  createConfigLayerSchema,
  updateConfigLayerSchema,
  createConfigLayerItemSchema,
  updateConfigLayerItemSchema,
  createConfigLayerFileSchema,
  attachConfigLayerSchema,
  approvePromotionSchema,
  rejectPromotionSchema,
} from "@mnm/shared";

function actorId(req: Parameters<typeof assertCompanyAccess>[0]): string {
  return req.actor.type === "board" ? (req.actor.userId ?? "system") : "system";
}

export function configLayerRoutes(db: Db) {
  const router = Router();
  const svc = configLayerService(db);
  const conflictSvc = configLayerConflictService(db);
  const audit = auditService(db);

  // ═══════════════════════════════════════════════════════════
  // 6.1 LAYER CRUD
  // ═══════════════════════════════════════════════════════════

  // ── GET /companies/:companyId/config-layers ── List layers (tag-filtered)
  router.get(
    "/companies/:companyId/config-layers",
    requirePermission(db, "config_layers:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const scope = req.query.scope as string | undefined;
      const includeArchived = req.query.includeArchived === "true";

      const layers = await svc.listLayers(companyId, { scope, includeArchived });
      res.json(layers);
    },
  );

  // ── POST /companies/:companyId/config-layers ── Create a layer
  router.post(
    "/companies/:companyId/config-layers",
    requirePermission(db, "config_layers:create"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const parsed = createConfigLayerSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.message);

      const userId = actorId(req);
      const layer = await svc.createLayer(companyId, userId, parsed.data);
      res.status(201).json(layer);
    },
  );

  // ── GET /config-layers/:id ── Layer detail
  router.get(
    "/config-layers/:id",
    async (req, res) => {
      const layerId = req.params.id as string;
      const layer = await svc.getLayer(layerId);

      await assertCompanyPermission(db, req, layer.companyId, "config_layers:read");
      res.json(layer);
    },
  );

  // ── PATCH /config-layers/:id ── Update layer metadata
  router.patch(
    "/config-layers/:id",
    async (req, res) => {
      const layerId = req.params.id as string;

      // Fetch layer first to get companyId for permission check
      const existing = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, existing.companyId, "config_layers:edit");

      const parsed = updateConfigLayerSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.message);

      const userId = actorId(req);
      const updated = await svc.updateLayer(layerId, userId, parsed.data);
      res.json(updated);
    },
  );

  // ── DELETE /config-layers/:id ── Archive (soft-delete)
  router.delete(
    "/config-layers/:id",
    async (req, res) => {
      const layerId = req.params.id as string;

      const existing = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, existing.companyId, "config_layers:delete");

      const userId = actorId(req);
      const archived = await svc.archiveLayer(layerId, userId);
      res.json(archived);
    },
  );

  // ── GET /config-layers/:id/revisions ── Revision history
  router.get(
    "/config-layers/:id/revisions",
    async (req, res) => {
      const layerId = req.params.id as string;

      const layer = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, layer.companyId, "config_layers:read");

      const revisions = await svc.listRevisions(layerId);
      res.json(revisions);
    },
  );

  // ═══════════════════════════════════════════════════════════
  // 6.2 ITEM CRUD
  // ═══════════════════════════════════════════════════════════

  // ── POST /config-layers/:id/items ── Add item
  router.post(
    "/config-layers/:id/items",
    async (req, res) => {
      const layerId = req.params.id as string;

      const layer = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, layer.companyId, "config_layers:edit");

      const parsed = createConfigLayerItemSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.message);

      const userId = actorId(req);
      const item = await svc.addItem(layerId, userId, parsed.data);
      res.status(201).json(item);
    },
  );

  // ── PATCH /config-layers/:id/items/:itemId ── Update item
  router.patch(
    "/config-layers/:id/items/:itemId",
    async (req, res) => {
      const layerId = req.params.id as string;
      const itemId = req.params.itemId as string;

      const layer = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, layer.companyId, "config_layers:edit");

      const parsed = updateConfigLayerItemSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.message);

      const userId = actorId(req);
      const updated = await svc.updateItem(layerId, itemId, userId, parsed.data);
      res.json(updated);
    },
  );

  // ── DELETE /config-layers/:id/items/:itemId ── Remove item
  router.delete(
    "/config-layers/:id/items/:itemId",
    async (req, res) => {
      const layerId = req.params.id as string;
      const itemId = req.params.itemId as string;

      const layer = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, layer.companyId, "config_layers:edit");

      const userId = actorId(req);
      await svc.removeItem(layerId, itemId, userId);
      res.status(204).end();
    },
  );

  // ── POST /config-layers/:id/items/:itemId/files ── Upload file
  router.post(
    "/config-layers/:id/items/:itemId/files",
    async (req, res) => {
      const layerId = req.params.id as string;
      const itemId = req.params.itemId as string;

      const layer = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, layer.companyId, "config_layers:edit");

      const parsed = createConfigLayerFileSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.message);

      const userId = actorId(req);
      const file = await svc.addFile(layerId, itemId, userId, parsed.data);
      res.status(201).json(file);
    },
  );

  // ── DELETE /config-layers/:id/items/:itemId/files/:fileId ── Remove file
  router.delete(
    "/config-layers/:id/items/:itemId/files/:fileId",
    async (req, res) => {
      const layerId = req.params.id as string;
      const itemId = req.params.itemId as string;
      const fileId = req.params.fileId as string;

      const layer = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, layer.companyId, "config_layers:edit");

      await svc.removeFile(layerId, itemId, fileId);
      res.status(204).end();
    },
  );

  // ═══════════════════════════════════════════════════════════
  // 6.3 AGENT ATTACHMENT
  // ═══════════════════════════════════════════════════════════

  // ── GET /companies/:companyId/agents/:agentId/config-layers ── List attached layers
  router.get(
    "/companies/:companyId/agents/:agentId/config-layers",
    requirePermission(db, "config_layers:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const agentId = req.params.agentId as string;
      assertCompanyAccess(req, companyId);

      const attached = await db
        .select({
          layerId: agentConfigLayers.layerId,
          priority: agentConfigLayers.priority,
          attachedBy: agentConfigLayers.attachedBy,
          attachedAt: agentConfigLayers.attachedAt,
          layer: configLayers,
        })
        .from(agentConfigLayers)
        .innerJoin(configLayers, eq(configLayers.id, agentConfigLayers.layerId))
        .where(
          and(
            eq(agentConfigLayers.agentId, agentId),
            eq(agentConfigLayers.companyId, companyId),
          ),
        );

      res.json(attached);
    },
  );

  // ── POST /companies/:companyId/agents/:agentId/config-layers ── Attach layer
  router.post(
    "/companies/:companyId/agents/:agentId/config-layers",
    requirePermission(db, "config_layers:attach"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const agentId = req.params.agentId as string;
      assertCompanyAccess(req, companyId);

      const parsed = attachConfigLayerSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.message);

      const { layerId, priority } = parsed.data;
      const userId = actorId(req);

      // Run conflict check first
      const conflictResult = await conflictSvc.checkConflicts(
        companyId,
        agentId,
        layerId,
        priority,
      );

      // If any enforced conflicts, block the attachment
      if (!conflictResult.canAttach) {
        throw badRequest("Cannot attach layer: enforced conflicts detected", {
          conflicts: conflictResult.conflicts,
        });
      }

      // Insert the attachment
      const [attachment] = await db
        .insert(agentConfigLayers)
        .values({
          companyId,
          agentId,
          layerId,
          priority,
          attachedBy: userId,
        })
        .onConflictDoNothing()
        .returning();

      await audit.emit({
        companyId,
        actorId: userId,
        actorType: "user",
        action: "config_layer.attached",
        targetType: "config_layer",
        targetId: layerId,
        metadata: { agentId, priority },
      }).catch(() => {});

      res.status(201).json({
        attachment,
        warnings: conflictResult.conflicts.length > 0 ? conflictResult.conflicts : undefined,
      });
    },
  );

  // ── DELETE /companies/:companyId/agents/:agentId/config-layers/:lid ── Detach layer
  router.delete(
    "/companies/:companyId/agents/:agentId/config-layers/:lid",
    requirePermission(db, "config_layers:attach"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const agentId = req.params.agentId as string;
      const layerId = req.params.lid as string;
      assertCompanyAccess(req, companyId);

      await db
        .delete(agentConfigLayers)
        .where(
          and(
            eq(agentConfigLayers.agentId, agentId),
            eq(agentConfigLayers.layerId, layerId),
            eq(agentConfigLayers.companyId, companyId),
          ),
        );

      const userId = actorId(req);
      await audit.emit({
        companyId,
        actorId: userId,
        actorType: "user",
        action: "config_layer.detached",
        targetType: "config_layer",
        targetId: layerId,
        metadata: { agentId },
      }).catch(() => {});

      res.status(204).end();
    },
  );

  // ── POST /companies/:companyId/agents/:agentId/config-layers/check ── Conflict check
  router.post(
    "/companies/:companyId/agents/:agentId/config-layers/check",
    requirePermission(db, "config_layers:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const agentId = req.params.agentId as string;
      assertCompanyAccess(req, companyId);

      const parsed = attachConfigLayerSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.message);

      const { layerId, priority } = parsed.data;
      const result = await conflictSvc.checkConflicts(companyId, agentId, layerId, priority);
      res.json(result);
    },
  );

  // ── GET /companies/:companyId/agents/:agentId/config-layers/preview ── Merge preview
  router.get(
    "/companies/:companyId/agents/:agentId/config-layers/preview",
    requirePermission(db, "config_layers:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const agentId = req.params.agentId as string;
      assertCompanyAccess(req, companyId);

      const preview = await conflictSvc.mergePreview(companyId, agentId);
      res.json(preview);
    },
  );

  // ═══════════════════════════════════════════════════════════
  // 6.5 PROMOTION
  // ═══════════════════════════════════════════════════════════

  // ── POST /config-layers/:id/promote ── Propose promotion
  router.post(
    "/config-layers/:id/promote",
    async (req, res) => {
      const layerId = req.params.id as string;

      const layer = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, layer.companyId, "config_layers:edit");

      const userId = actorId(req);
      const updated = await svc.propose(layerId, userId);
      res.json(updated);
    },
  );

  // ── POST /config-layers/:id/promotion/approve ── Approve promotion
  router.post(
    "/config-layers/:id/promotion/approve",
    async (req, res) => {
      const layerId = req.params.id as string;

      const layer = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, layer.companyId, "config_layers:promote");

      const parsed = approvePromotionSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.message);

      const userId = actorId(req);
      const updated = await svc.approvePromotion(
        layerId,
        userId,
        parsed.data.expectedContentHash,
      );
      res.json(updated);
    },
  );

  // ── POST /config-layers/:id/promotion/reject ── Reject promotion
  router.post(
    "/config-layers/:id/promotion/reject",
    async (req, res) => {
      const layerId = req.params.id as string;

      const layer = await svc.getLayer(layerId);
      await assertCompanyPermission(db, req, layer.companyId, "config_layers:promote");

      const parsed = rejectPromotionSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.message);

      const userId = actorId(req);
      const updated = await svc.rejectPromotion(layerId, userId, parsed.data.reason);
      res.json(updated);
    },
  );

  return router;
}
