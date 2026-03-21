// DEPLOY-04: Artifact Deployment API routes
import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { deployManagerService } from "../services/deploy-manager.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";
import { badRequest } from "../errors.js";
import type { DeploymentStatus } from "@mnm/shared";

const createDeploymentSchema = z.object({
  sourcePath: z.string().min(1).max(4096),
  name: z.string().min(1).max(200).optional(),
  issueId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  ttlSeconds: z.number().int().min(300).max(604800).optional(), // 5min to 7 days
});

export function deploymentRoutes(db: Db) {
  const router = Router();
  const manager = deployManagerService(db);

  // POST /companies/:companyId/deployments — create deployment
  router.post(
    "/companies/:companyId/deployments",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const parsed = createDeploymentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const deployment = await manager.createDeployment(
        actor.actorId,
        companyId as string,
        parsed.data,
      );

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "deployment.created",
        targetType: "artifact_deployment",
        targetId: deployment.id,
        metadata: { name: deployment.name, sourcePath: parsed.data.sourcePath },
      });

      res.status(202).json(deployment);
    },
  );

  // GET /companies/:companyId/deployments — list deployments
  router.get(
    "/companies/:companyId/deployments",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const issueId = req.query.issueId as string | undefined;
      const status = req.query.status as DeploymentStatus | undefined;

      const deployments = await manager.listDeployments(companyId as string, { issueId, status });
      res.json({ deployments });
    },
  );

  // GET /companies/:companyId/deployments/:deploymentId — get deployment
  router.get(
    "/companies/:companyId/deployments/:deploymentId",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId, deploymentId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const deployment = await manager.getDeployment(deploymentId as string, companyId as string);
      res.json(deployment);
    },
  );

  // GET /companies/:companyId/deployments/:deploymentId/logs — get build logs
  router.get(
    "/companies/:companyId/deployments/:deploymentId/logs",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId, deploymentId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const deployment = await manager.getDeployment(deploymentId as string, companyId as string);
      res.json({ log: deployment.buildLog ?? "" });
    },
  );

  // POST /companies/:companyId/deployments/:deploymentId/pin — pin deployment
  router.post(
    "/companies/:companyId/deployments/:deploymentId/pin",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, deploymentId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const deployment = await manager.pinDeployment(deploymentId as string, companyId as string, true);
      res.json(deployment);
    },
  );

  // POST /companies/:companyId/deployments/:deploymentId/unpin — unpin deployment
  router.post(
    "/companies/:companyId/deployments/:deploymentId/unpin",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, deploymentId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const deployment = await manager.pinDeployment(deploymentId as string, companyId as string, false);
      res.json(deployment);
    },
  );

  // DELETE /companies/:companyId/deployments/:deploymentId — destroy deployment
  router.delete(
    "/companies/:companyId/deployments/:deploymentId",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, deploymentId } = req.params;
      assertCompanyAccess(req, companyId as string);

      await manager.destroyDeployment(deploymentId as string, companyId as string);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "deployment.destroyed",
        targetType: "artifact_deployment",
        targetId: deploymentId as string,
        metadata: {},
      });

      res.json({ status: "destroyed" });
    },
  );

  return router;
}
