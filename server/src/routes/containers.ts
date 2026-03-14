import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { containerManagerService } from "../services/container-manager.js";
import { mountAllowlistService } from "../services/mount-allowlist.js";
import { networkIsolationService } from "../services/network-isolation.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";
import { badRequest } from "../errors.js";
import type { ContainerStatus } from "@mnm/shared";
import { mountPathsSchema, mountValidateSchema } from "@mnm/shared";

// ---- Zod Schemas ----

const launchSchema = z.object({
  agentId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  dockerImage: z.string().optional(),
  environmentVars: z.record(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
  mountPaths: z.array(z.string().min(1).max(4096)).optional(), // cont-s03-cm-validate
});

const stopSchema = z.object({
  gracePeriodSeconds: z.number().int().positive().max(60).optional(),
  reason: z.string().max(500).optional(),
});

// cont-s05-validator-create-enriched
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
  // New fields from CONT-S05
  dockerImage: z.string().max(255).optional(),
  maxContainers: z.number().int().min(1).max(200).optional(),
  credentialProxyEnabled: z.boolean().optional(),
  allowedMountPaths: z.array(z.string()).optional(),
  networkMode: z.enum(["isolated", "company-bridge", "host-restricted"]).optional(),
  maxDiskIops: z.number().int().min(100).max(100000).optional().nullable(),
  labels: z.record(z.string()).optional(),
});

// cont-s05-validator-update-profile
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  dockerImage: z.string().max(255).optional().nullable(),
  cpuMillicores: z.number().int().min(100).max(16000).optional(),
  memoryMb: z.number().int().min(64).max(32768).optional(),
  diskMb: z.number().int().min(128).max(65536).optional(),
  timeoutSeconds: z.number().int().min(60).max(86400).optional(),
  gpuEnabled: z.boolean().optional(),
  mountAllowlist: z.array(z.string()).optional(),
  allowedMountPaths: z.array(z.string()).optional(),
  networkPolicy: z.string().optional(),
  networkMode: z.enum(["isolated", "company-bridge", "host-restricted"]).optional(),
  credentialProxyEnabled: z.boolean().optional(),
  maxContainers: z.number().int().min(1).max(200).optional(),
  maxDiskIops: z.number().int().min(100).max(100000).optional().nullable(),
  labels: z.record(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

const duplicateProfileSchema = z.object({
  newName: z.string().min(1).max(100),
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
          mountPaths: parsed.data.mountPaths,
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

  // cont-s05-route-get-profile
  // GET /companies/:companyId/containers/profiles/:profileId — get profile by id
  router.get(
    "/companies/:companyId/containers/profiles/:profileId",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, profileId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const profile = await manager.getProfile(companyId as string, profileId as string);
      res.json(profile);
    },
  );

  // cont-s05-route-update-profile
  // PUT /companies/:companyId/containers/profiles/:profileId — update profile
  router.put(
    "/companies/:companyId/containers/profiles/:profileId",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, profileId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const profile = await manager.updateProfile(
        companyId as string,
        profileId as string,
        parsed.data,
      );

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "container.profile_updated",
        targetType: "container_profile",
        targetId: profileId as string,
        metadata: { name: profile.name, changes: Object.keys(parsed.data) },
      });

      res.json(profile);
    },
  );

  // cont-s05-route-delete-profile
  // DELETE /companies/:companyId/containers/profiles/:profileId — delete profile
  router.delete(
    "/companies/:companyId/containers/profiles/:profileId",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, profileId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const deleted = await manager.deleteProfile(companyId as string, profileId as string);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "container.profile_deleted",
        targetType: "container_profile",
        targetId: profileId as string,
        metadata: { name: deleted.name },
      });

      res.json({ status: "deleted", id: profileId });
    },
  );

  // POST /companies/:companyId/containers/profiles/:profileId/duplicate — duplicate profile
  router.post(
    "/companies/:companyId/containers/profiles/:profileId/duplicate",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, profileId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = duplicateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const profile = await manager.duplicateProfile(
        companyId as string,
        profileId as string,
        parsed.data.newName,
      );

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "container.profile_created",
        targetType: "container_profile",
        targetId: profile.id,
        metadata: { name: parsed.data.newName, duplicatedFrom: profileId },
      });

      res.status(201).json(profile);
    },
  );

  // cont-s03-route-get-allowlist
  // GET /companies/:companyId/containers/profiles/:profileId/mount-allowlist — get mount allowlist
  router.get(
    "/companies/:companyId/containers/profiles/:profileId/mount-allowlist",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, profileId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const allowlistSvc = mountAllowlistService(db);
      const paths = await allowlistSvc.getEffectiveAllowlist(companyId as string, profileId as string);
      res.json({ profileId, paths });
    },
  );

  // cont-s03-route-put-allowlist
  // PUT /companies/:companyId/containers/profiles/:profileId/mount-allowlist — update mount allowlist
  router.put(
    "/companies/:companyId/containers/profiles/:profileId/mount-allowlist",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, profileId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = mountPathsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const allowlistSvc = mountAllowlistService(db);
      const paths = await allowlistSvc.setAllowlist(companyId as string, profileId as string, parsed.data.paths);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "container.mount_allowlist_updated",
        targetType: "container_profile",
        targetId: profileId as string,
        metadata: { paths, count: paths.length },
      });

      res.json({ profileId, paths });
    },
  );

  // cont-s03-route-validate
  // POST /companies/:companyId/containers/mount-validate — validate mount paths against a profile
  router.post(
    "/companies/:companyId/containers/mount-validate",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = mountValidateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const allowlistSvc = mountAllowlistService(db);
      const allowedPaths = await allowlistSvc.getEffectiveAllowlist(companyId as string, parsed.data.profileId);
      const batchResult = await allowlistSvc.validateAllMounts(parsed.data.paths, allowedPaths);

      res.json({
        profileId: parsed.data.profileId,
        results: batchResult.results,
        allValid: batchResult.valid,
      });
    },
  );

  // ---- CONT-S04: Network isolation routes ----

  // cont-s04-route-list-networks
  // GET /companies/:companyId/containers/networks — list company networks
  router.get(
    "/companies/:companyId/containers/networks",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const networkSvc = networkIsolationService();
      const networks = await networkSvc.listCompanyNetworks(companyId as string);
      res.json({ networks });
    },
  );

  // cont-s04-route-get-network
  // GET /companies/:companyId/containers/networks/:networkId — get network info
  router.get(
    "/companies/:companyId/containers/networks/:networkId",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, networkId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const networkSvc = networkIsolationService();
      const info = await networkSvc.getNetworkInfo(networkId as string);
      res.json(info);
    },
  );

  // cont-s04-route-delete-network
  // DELETE /companies/:companyId/containers/networks/:networkId — remove orphan network
  router.delete(
    "/companies/:companyId/containers/networks/:networkId",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId, networkId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const networkSvc = networkIsolationService();
      await networkSvc.removeNetwork(networkId as string);

      // cont-s04-audit-network-deleted
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "container.network_deleted",
        targetType: "docker_network",
        targetId: networkId as string,
        metadata: { deletedBy: actor.actorId },
      });

      res.json({ status: "deleted", networkId });
    },
  );

  // cont-s04-route-cleanup-networks
  // POST /companies/:companyId/containers/networks/cleanup — cleanup orphan networks
  router.post(
    "/companies/:companyId/containers/networks/cleanup",
    requirePermission(db, "agents:manage_containers"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const networkSvc = networkIsolationService();
      const result = await networkSvc.cleanupOrphanNetworks();

      // cont-s04-audit-network-cleaned
      if (result.removed.length > 0) {
        await emitAudit({
          req,
          db,
          companyId: companyId as string,
          action: "container.network_cleaned",
          targetType: "docker_network",
          targetId: companyId as string,
          metadata: { removedCount: result.removed.length, removed: result.removed, cleanedBy: actor.actorId },
        });
      }

      res.json(result);
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
