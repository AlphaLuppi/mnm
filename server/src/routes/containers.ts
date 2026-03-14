import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { containerManagerService } from "../services/container-manager.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";
import { badRequest } from "../errors.js";
import type { ContainerStatus } from "@mnm/shared";

// ---- Zod Schemas ----

const launchSchema = z.object({
  agentId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  dockerImage: z.string().optional(),
  environmentVars: z.record(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
});

const stopSchema = z.object({
  gracePeriodSeconds: z.number().int().positive().max(60).optional(),
  reason: z.string().max(500).optional(),
});

const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  cpuMillicores: z.number().int().min(100).max(16000).optional(),
  memoryMb: z.number().int().min(64).max(32768).optional(),
  diskMb: z.number().int().min(128).max(65536).optional(),
  timeoutSeconds: z.number().int().min(60).max(86400).optional(),
  gpuEnabled: z.boolean().optional(),
  networkPolicy: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export function containerRoutes(db: Db) {
  const router = Router();
  const manager = containerManagerService(db);

  // POST /companies/:companyId/containers — launch container
  router.post(
    "/companies/:companyId/containers",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const parsed = launchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const result = await manager.launchContainer(
        parsed.data.agentId,
        companyId as string,
        actor.actorId,
        {
          profileId: parsed.data.profileId,
          dockerImage: parsed.data.dockerImage,
          environmentVars: parsed.data.environmentVars,
          timeout: parsed.data.timeout,
        },
      );

      res.status(201).json(result);
    },
  );

  // GET /companies/:companyId/containers — list containers
  router.get(
    "/companies/:companyId/containers",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const status = req.query.status as ContainerStatus | undefined;
      const agentId = req.query.agentId as string | undefined;

      const containers = await manager.listContainers(companyId as string, {
        status,
        agentId,
      });

      res.json({ containers });
    },
  );

  // GET /companies/:companyId/containers/profiles — list profiles
  router.get(
    "/companies/:companyId/containers/profiles",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const profiles = await manager.listProfiles(companyId as string);
      res.json({ profiles });
    },
  );

  // POST /companies/:companyId/containers/profiles — create profile
  router.post(
    "/companies/:companyId/containers/profiles",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = createProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const profile = await manager.createProfile(companyId as string, parsed.data);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "container.profile_created",
        targetType: "container_profile",
        targetId: profile.id,
        metadata: { name: parsed.data.name },
      });

      res.status(201).json(profile);
    },
  );

  // GET /companies/:companyId/containers/health — Docker health check
  router.get(
    "/companies/:companyId/containers/health",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const health = await manager.checkDockerHealth();
      res.json(health);
    },
  );

  // GET /companies/:companyId/containers/:containerId — get status
  router.get(
    "/companies/:companyId/containers/:containerId",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId, containerId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const info = await manager.getContainerStatus(containerId as string, companyId as string);
      res.json(info);
    },
  );

  // POST /companies/:companyId/containers/:containerId/stop — stop container
  router.post(
    "/companies/:companyId/containers/:containerId/stop",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, containerId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const parsed = stopSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      await manager.stopContainer(
        containerId as string,
        companyId as string,
        actor.actorId,
        parsed.data,
      );

      res.json({ status: "stopped" });
    },
  );

  // DELETE /companies/:companyId/containers/:containerId — destroy container
  router.delete(
    "/companies/:companyId/containers/:containerId",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, containerId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      // Stop and destroy (same as stop)
      await manager.stopContainer(
        containerId as string,
        companyId as string,
        actor.actorId,
        { reason: "Destroyed by user" },
      );

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "container.destroyed",
        targetType: "container_instance",
        targetId: containerId as string,
        metadata: { destroyedBy: actor.actorId },
      });

      res.json({ status: "destroyed" });
    },
  );

  return router;
}
