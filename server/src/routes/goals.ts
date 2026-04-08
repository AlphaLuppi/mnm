import { Router } from "express";
import type { Db } from "@mnm/db";
import { PERMISSIONS, createGoalSchema, updateGoalSchema } from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission, assertCompanyPermission } from "../middleware/require-permission.js";
import { emitAudit, goalService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function goalRoutes(db: Db) {
  const router = Router();
  const svc = goalService(db);

  router.get("/companies/:companyId/goals", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId);
    res.json(result);
  });

  router.get("/goals/:id", async (req, res) => {
    const id = req.params.id as string;
    const goal = await svc.getById(id);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    res.json(goal);
  });

  router.post("/companies/:companyId/goals", requirePermission(db, PERMISSIONS.PROJECTS_CREATE), validate(createGoalSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const goal = await svc.create(companyId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.created",
      entityType: "goal",
      entityId: goal.id,
      details: { title: goal.title },
    });

    await emitAudit({
      req, db, companyId,
      action: "goal.created",
      targetType: "project",
      targetId: goal.id,
      metadata: { title: goal.title },
    });

    res.status(201).json(goal);
  });

  router.patch("/goals/:id", validate(updateGoalSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    await assertCompanyPermission(db, req, existing.companyId, PERMISSIONS.PROJECTS_CREATE);
    const goal = await svc.update(id, req.body);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.updated",
      entityType: "goal",
      entityId: goal.id,
      details: req.body,
    });

    await emitAudit({
      req, db, companyId: goal.companyId,
      action: "goal.updated",
      targetType: "project",
      targetId: goal.id,
      metadata: { changedFields: Object.keys(req.body) },
    });

    res.json(goal);
  });

  router.delete("/goals/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    await assertCompanyPermission(db, req, existing.companyId, PERMISSIONS.PROJECTS_CREATE);
    const goal = await svc.remove(id);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.deleted",
      entityType: "goal",
      entityId: goal.id,
    });

    await emitAudit({
      req, db, companyId: goal.companyId,
      action: "goal.deleted",
      targetType: "project",
      targetId: goal.id,
      metadata: { title: goal.title },
    });

    res.json(goal);
  });

  return router;
}
