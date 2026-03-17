import { Router } from "express";
import type { Db } from "@mnm/db";
import { transitionStageSchema, updateStageSchema } from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { emitAudit, stageService, logActivity, publishLiveEvent } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function stageRoutes(db: Db) {
  const router = Router();
  const svc = stageService(db);

  router.get("/stages/:id", async (req, res) => {
    const stage = await svc.getStage(req.params.id as string);
    assertCompanyAccess(req, stage.companyId);
    res.json(stage);
  });

  router.post("/stages/:id/transition", validate(transitionStageSchema), async (req, res) => {
    const stage = await svc.getStage(req.params.id as string);
    assertCompanyAccess(req, stage.companyId);
    const updated = await svc.transitionStage(stage.id, req.body.status, {
      agentId: req.body.agentId,
      outputArtifacts: req.body.outputArtifacts,
    });
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: stage.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "stage.transitioned",
      entityType: "stage",
      entityId: stage.id,
      details: { from: stage.status, to: req.body.status },
    });

    await emitAudit({
      req, db, companyId: stage.companyId,
      action: "stage.transitioned",
      targetType: "stage",
      targetId: stage.id,
      metadata: { fromStatus: stage.status, toStatus: req.body.status },
    });

    res.json(updated);
  });

  router.patch("/stages/:id", validate(updateStageSchema), async (req, res) => {
    const stage = await svc.getStage(req.params.id as string);
    assertCompanyAccess(req, stage.companyId);
    const updated = await svc.updateStage(stage.id, req.body);
    publishLiveEvent({
      companyId: stage.companyId,
      type: "stage.transitioned",
      payload: { stageId: stage.id },
    });
    res.json(updated);
  });

  return router;
}
