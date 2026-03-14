/**
 * DUAL-S01: Automation Cursor API Routes
 *
 * 5 routes for managing automation cursors (dual-speed workflow):
 * - GET    /companies/:companyId/automation-cursors          — list cursors
 * - GET    /companies/:companyId/automation-cursors/:cursorId — get cursor
 * - PUT    /companies/:companyId/automation-cursors          — set (upsert)
 * - DELETE /companies/:companyId/automation-cursors/:cursorId — delete
 * - POST   /companies/:companyId/automation-cursors/resolve  — resolve effective
 */

import { Router } from "express";
import type { Db } from "@mnm/db";
import {
  setCursorSchema,
  cursorFiltersSchema,
  resolveCursorSchema,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission } from "../middleware/require-permission.js";
import { automationCursorService } from "../services/automation-cursors.js";
import { emitAudit, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound } from "../errors.js";

export function automationCursorRoutes(db: Db) {
  const router = Router();
  const svc = automationCursorService(db);

  // ──────────────────────────────────────────────────────────
  // dual-s01-route-list
  // GET /companies/:companyId/automation-cursors
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/automation-cursors",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const filters = cursorFiltersSchema.parse(req.query);
      const cursors = await svc.getCursors(companyId as string, filters);

      res.json(cursors);
    },
  );

  // ──────────────────────────────────────────────────────────
  // dual-s01-route-get-by-id
  // GET /companies/:companyId/automation-cursors/:cursorId
  // ──────────────────────────────────────────────────────────
  router.get(
    "/companies/:companyId/automation-cursors/:cursorId",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const { companyId, cursorId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const cursor = await svc.getCursorById(
        companyId as string,
        cursorId as string,
      );

      if (!cursor) {
        throw notFound("Automation cursor not found");
      }

      res.json(cursor);
    },
  );

  // ──────────────────────────────────────────────────────────
  // dual-s01-route-set
  // PUT /companies/:companyId/automation-cursors
  // ──────────────────────────────────────────────────────────
  router.put(
    "/companies/:companyId/automation-cursors",
    requirePermission(db, "workflows:enforce"),
    validate(setCursorSchema),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const cursor = await svc.setCursor(
        companyId as string,
        req.body,
        actor.actorId,
      );

      await logActivity(db, {
        companyId: companyId as string,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "automation_cursor.updated",
        entityType: "automation_cursor",
        entityId: cursor.id,
        details: { level: req.body.level, position: req.body.position },
      });

      await emitAudit({
        req, db, companyId: companyId as string,
        action: "automation_cursor.updated",
        targetType: "automation_cursor",
        targetId: cursor.id,
        metadata: { level: req.body.level, position: req.body.position, ceiling: req.body.ceiling },
      });

      res.json(cursor);
    },
  );

  // ──────────────────────────────────────────────────────────
  // dual-s01-route-delete
  // DELETE /companies/:companyId/automation-cursors/:cursorId
  // ──────────────────────────────────────────────────────────
  router.delete(
    "/companies/:companyId/automation-cursors/:cursorId",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const { companyId, cursorId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const deleted = await svc.deleteCursor(
        companyId as string,
        cursorId as string,
      );

      if (!deleted) {
        throw notFound("Automation cursor not found");
      }

      await logActivity(db, {
        companyId: companyId as string,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "automation_cursor.deleted",
        entityType: "automation_cursor",
        entityId: cursorId as string,
        details: { level: deleted.level, position: deleted.position },
      });

      await emitAudit({
        req, db, companyId: companyId as string,
        action: "automation_cursor.deleted",
        targetType: "automation_cursor",
        targetId: cursorId as string,
        metadata: { level: deleted.level, position: deleted.position },
      });

      res.json({ deleted: true });
    },
  );

  // ──────────────────────────────────────────────────────────
  // dual-s01-route-resolve
  // POST /companies/:companyId/automation-cursors/resolve
  // ──────────────────────────────────────────────────────────
  router.post(
    "/companies/:companyId/automation-cursors/resolve",
    requirePermission(db, "workflows:enforce"),
    validate(resolveCursorSchema),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const effective = await svc.resolveEffective(
        companyId as string,
        req.body,
      );

      res.json(effective);
    },
  );

  return router;
}
