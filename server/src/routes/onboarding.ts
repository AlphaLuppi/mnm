import { Router } from "express";
import type { Db } from "@mnm/db";
import { onboardingService } from "../services/onboarding.js";
import { cascadeService } from "../services/cascade.js";
import { assertCompanyAccess } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";
import { badRequest } from "../errors.js";

// onb-s01-route-marker

export function onboardingRoutes(db: Db) {
  const router = Router();
  const svc = onboardingService(db);
  const cascadeSvc = cascadeService(db);

  // onb-s01-route-get
  // GET /companies/:companyId/onboarding — get onboarding status
  router.get("/companies/:companyId/onboarding", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const status = await svc.getOnboardingStatus(companyId as string);
    res.json(status);
  });

  // onb-s01-route-put
  // PUT /companies/:companyId/onboarding — update onboarding step
  router.put("/companies/:companyId/onboarding", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const { step, data } = req.body;
    if (typeof step !== "number" || step < 0 || step > 6) {
      throw badRequest("step must be a number between 0 and 6");
    }

    const status = await svc.updateOnboardingStep(
      companyId as string,
      step,
      data ?? undefined,
    );

    await emitAudit({
      req,
      db,
      companyId: companyId as string,
      action: "onboarding.step_updated",
      targetType: "company",
      targetId: companyId as string,
      metadata: { step, hasData: !!data },
    });

    res.json(status);
  });

  // onb-s01-route-complete
  // POST /companies/:companyId/onboarding/complete — mark onboarding complete
  router.post("/companies/:companyId/onboarding/complete", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const status = await svc.completeOnboarding(companyId as string);

    await emitAudit({
      req,
      db,
      companyId: companyId as string,
      action: "onboarding.completed",
      targetType: "company",
      targetId: companyId as string,
      metadata: { steps_completed: 5 },
    });

    res.json(status);
  });

  // onb-s01-route-reset
  // POST /companies/:companyId/onboarding/reset — reset onboarding
  router.post("/companies/:companyId/onboarding/reset", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const status = await svc.resetOnboarding(companyId as string);

    await emitAudit({
      req,
      db,
      companyId: companyId as string,
      action: "onboarding.reset",
      targetType: "company",
      targetId: companyId as string,
      metadata: {},
      severity: "warning",
    });

    res.json(status);
  });

  // onb-s02-cascade-info-route
  // GET /companies/:companyId/onboarding/cascade-info — returns cascade hierarchy info for current user
  router.get("/companies/:companyId/onboarding/cascade-info", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const userId = req.actor?.userId;
    if (!userId) {
      throw badRequest("User ID required for cascade info");
    }

    const info = await cascadeSvc.getCascadeInfo(companyId as string, userId);
    res.json(info);
  });

  return router;
}
