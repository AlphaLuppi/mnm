// POD-04: Pod API routes
import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { podManagerService } from "../services/pod-manager.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";

const provisionSchema = z.object({
  image: z.string().max(255).optional(),
  cpuMillicores: z.number().int().min(100).max(4000).optional(),
  memoryMb: z.number().int().min(256).max(8192).optional(),
});

export function podRoutes(db: Db) {
  const router = Router();
  const manager = podManagerService(db);

  // POST /companies/:companyId/pods/provision — provision user's pod
  router.post(
    "/companies/:companyId/pods/provision",
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

      const pod = await manager.provisionPod(actor.actorId, companyId as string, parsed.data);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "pod.provisioned",
        targetType: "user_pod",
        targetId: pod.id,
        metadata: { image: pod.dockerImage },
      });

      res.status(202).json(pod);
    },
  );

  // GET /companies/:companyId/pods/my — get current user's pod
  router.get(
    "/companies/:companyId/pods/my",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const pod = await manager.getMyPod(actor.actorId, companyId as string);
      res.json({ pod });
    },
  );

  // POST /companies/:companyId/pods/my/wake — wake hibernated pod
  router.post(
    "/companies/:companyId/pods/my/wake",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const pod = await manager.wakePod(actor.actorId, companyId as string);
      res.status(202).json(pod);
    },
  );

  // POST /companies/:companyId/pods/my/hibernate — hibernate pod
  router.post(
    "/companies/:companyId/pods/my/hibernate",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const pod = await manager.hibernatePod(actor.actorId, companyId as string);
      res.json(pod);
    },
  );

  // DELETE /companies/:companyId/pods/my — destroy pod
  router.delete(
    "/companies/:companyId/pods/my",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      await manager.destroyPod(actor.actorId, companyId as string);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "pod.destroyed",
        targetType: "user_pod",
        targetId: actor.actorId,
        metadata: {},
      });

      res.json({ status: "destroyed" });
    },
  );

  // GET /companies/:companyId/pods — list all pods (admin)
  router.get(
    "/companies/:companyId/pods",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const pods = await manager.listPods(companyId as string);
      res.json({ pods });
    },
  );

  return router;
}
