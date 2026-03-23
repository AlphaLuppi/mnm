import { Router } from "express";
import type { Db } from "@mnm/db";
import { onboardingService } from "../services/onboarding.js";
import { cascadeService } from "../services/cascade.js";
import { sandboxManagerService } from "../services/sandbox-manager.js";
import { assertCompanyAccess } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";
import { badRequest } from "../errors.js";
import { logger } from "../middleware/logger.js";

// onb-s01-route-marker
// onb-s04-route-validation-marker

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
    if (typeof step !== "number" || step < 0 || step > 7) {
      throw badRequest("step must be a number between 0 and 7");
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

    // Auto-provision sandbox for the onboarding user
    const userId = req.actor.type === "board" ? req.actor.userId : null;
    if (userId) {
      try {
        const manager = sandboxManagerService(db);
        await manager.provisionSandbox(userId, companyId as string);
        logger.info({ userId, companyId }, "Auto-provisioned sandbox after onboarding");
      } catch (err: any) {
        // Don't block onboarding completion if sandbox provisioning fails
        logger.warn({ err: err.message, userId, companyId }, "Auto-provision sandbox failed (non-blocking)");
      }
    }

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

  // GET /api/onboarding/role-presets — returns predefined role presets for onboarding step 2
  router.get("/onboarding/role-presets", async (_req, res) => {
    res.json({
      startup: [
        {
          name: "Member", slug: "member", description: "Standard team member", hierarchyLevel: 50,
          permissionSlugs: [
            "agents:launch", "agents:create", "agents:configure",
            "issues:create", "issues:assign",
            "projects:create",
            "stories:create", "stories:edit",
            "traces:read",
            "chat:agent",
            "dashboard:view",
          ],
        },
      ],
      structured: [
        {
          name: "Lead", slug: "lead", description: "Team lead with elevated access", hierarchyLevel: 20,
          permissionSlugs: [
            "agents:create", "agents:launch", "agents:configure", "agents:delete",
            "issues:create", "issues:assign", "issues:delete",
            "projects:create", "projects:manage", "projects:manage_members",
            "users:invite",
            "workflows:create", "workflows:enforce",
            "stories:create", "stories:edit",
            "traces:read", "traces:write",
            "audit:read",
            "chat:agent", "chat:channel",
            "dashboard:view",
          ],
        },
        {
          name: "Member", slug: "member", description: "Standard team member", hierarchyLevel: 50,
          permissionSlugs: [
            "agents:launch", "agents:create", "agents:configure",
            "issues:create", "issues:assign",
            "projects:create",
            "stories:create", "stories:edit",
            "traces:read",
            "chat:agent",
            "dashboard:view",
          ],
        },
        {
          name: "Viewer", slug: "viewer", description: "Read-only access", hierarchyLevel: 80,
          permissionSlugs: [
            "traces:read",
            "audit:read",
            "dashboard:view",
          ],
        },
      ],
    });
  });

  return router;
}
