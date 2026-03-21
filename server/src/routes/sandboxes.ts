// POD-04: Sandbox API routes (renamed from pods.ts)
import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { sandboxManagerService } from "../services/sandbox-manager.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";

const provisionSchema = z.object({
  image: z.string().max(255).optional(),
  cpuMillicores: z.number().int().min(100).max(4000).optional(),
  memoryMb: z.number().int().min(256).max(8192).optional(),
});

export function sandboxRoutes(db: Db) {
  const router = Router();
  const manager = sandboxManagerService(db);

  // POST /companies/:companyId/sandboxes/provision — provision user's sandbox
  router.post(
    "/companies/:companyId/sandboxes/provision",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const parsed = provisionSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
        return;
      }

      const sandbox = await manager.provisionSandbox(actor.actorId, companyId as string, parsed.data);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "sandbox.provisioned",
        targetType: "user_pod",
        targetId: sandbox.id,
        metadata: { image: sandbox.dockerImage },
      });

      res.status(202).json(sandbox);
    },
  );

  // GET /companies/:companyId/sandboxes/my — get current user's sandbox
  router.get(
    "/companies/:companyId/sandboxes/my",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const sandbox = await manager.getMySandbox(actor.actorId, companyId as string);
      res.json({ pod: sandbox });
    },
  );

  // POST /companies/:companyId/sandboxes/my/wake — wake hibernated sandbox
  router.post(
    "/companies/:companyId/sandboxes/my/wake",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const sandbox = await manager.wakeSandbox(actor.actorId, companyId as string);
      res.status(202).json(sandbox);
    },
  );

  // POST /companies/:companyId/sandboxes/my/hibernate — hibernate sandbox
  router.post(
    "/companies/:companyId/sandboxes/my/hibernate",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const sandbox = await manager.hibernateSandbox(actor.actorId, companyId as string);
      res.json(sandbox);
    },
  );

  // DELETE /companies/:companyId/sandboxes/my — destroy sandbox
  router.delete(
    "/companies/:companyId/sandboxes/my",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      await manager.destroySandbox(actor.actorId, companyId as string);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "sandbox.destroyed",
        targetType: "user_pod",
        targetId: actor.actorId,
        metadata: {},
      });

      res.json({ status: "destroyed" });
    },
  );

  // GET /companies/:companyId/sandboxes — list all sandboxes (admin)
  router.get(
    "/companies/:companyId/sandboxes",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const sandboxes = await manager.listSandboxes(companyId as string);
      res.json({ pods: sandboxes });
    },
  );

  return router;
}
