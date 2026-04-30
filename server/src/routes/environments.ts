// Phase 3 — REST routes for execution environments + leases.
// Mounted on api.use(...) — the parent router (api) already wraps
// /companies/:companyId with assertCompanyMembership +
// tenantContextMiddleware + tagScopeMiddleware. We re-assert via
// assertCompanyAccess for defence-in-depth.
//
// Permissions: SANDBOX_READ for list/get, SANDBOX_MANAGE for write/release.
// (Environments are the supervisor-side counterpart to sandboxes; same
// audience, same blast radius.)

import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import {
  ENVIRONMENT_DRIVERS,
  ENVIRONMENT_LEASE_STATUSES,
  ENVIRONMENT_STATUSES,
  type EnvironmentDriver,
  type EnvironmentLeaseStatus,
  type EnvironmentStatus,
} from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { environmentService } from "../services/environments.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";
import { badRequest, notFound } from "../errors.js";

const driverSchema = z.enum(ENVIRONMENT_DRIVERS);
const statusSchema = z.enum(ENVIRONMENT_STATUSES);

const createEnvironmentSchema = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional().nullable(),
    driver: driverSchema,
    status: statusSchema.optional(),
    config: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional().nullable(),
  })
  .strict();

const updateEnvironmentSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional().nullable(),
    driver: driverSchema.optional(),
    status: statusSchema.optional(),
    config: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional().nullable(),
  })
  .strict();

const releaseLeaseSchema = z
  .object({
    status: z.enum(["released", "expired", "failed"]).optional(),
    failureReason: z.string().max(2000).optional(),
    cleanupStatus: z.enum(["pending", "success", "failed"]).optional(),
  })
  .strict();

export function environmentRoutes(db: Db) {
  const router = Router();
  const svc = environmentService(db);

  // GET /companies/:companyId/environments — list
  router.get(
    "/companies/:companyId/environments",
    requirePermission(db, PERMISSIONS.SANDBOX_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
      const rawDriver = typeof req.query.driver === "string" ? req.query.driver : undefined;
      const status =
        rawStatus && (ENVIRONMENT_STATUSES as readonly string[]).includes(rawStatus)
          ? (rawStatus as EnvironmentStatus)
          : undefined;
      const driver =
        rawDriver && (ENVIRONMENT_DRIVERS as readonly string[]).includes(rawDriver)
          ? (rawDriver as EnvironmentDriver)
          : undefined;
      const items = await svc.list(companyId, { status, driver });
      res.json({ environments: items });
    },
  );

  // GET /companies/:companyId/environments/:envId — get one
  router.get(
    "/companies/:companyId/environments/:envId",
    requirePermission(db, PERMISSIONS.SANDBOX_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const envId = req.params.envId as string;
      assertCompanyAccess(req, companyId);
      const env = await svc.getById(companyId, envId);
      if (!env) throw notFound("Environment not found");
      res.json(env);
    },
  );

  // POST /companies/:companyId/environments — create
  router.post(
    "/companies/:companyId/environments",
    requirePermission(db, PERMISSIONS.SANDBOX_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const parsed = createEnvironmentSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }
      const env = await svc.create(companyId, parsed.data);

      await emitAudit({
        req,
        db,
        companyId,
        action: "environment.created",
        targetType: "environment",
        targetId: env.id,
        metadata: { driver: env.driver, name: env.name },
      });

      res.status(201).json(env);
    },
  );

  // POST /companies/:companyId/environments/ensure-local — idempotent
  router.post(
    "/companies/:companyId/environments/ensure-local",
    requirePermission(db, PERMISSIONS.SANDBOX_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const env = await svc.ensureLocalEnvironment(companyId);
      res.json(env);
    },
  );

  // PATCH /companies/:companyId/environments/:envId — update
  router.patch(
    "/companies/:companyId/environments/:envId",
    requirePermission(db, PERMISSIONS.SANDBOX_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const envId = req.params.envId as string;
      assertCompanyAccess(req, companyId);
      const parsed = updateEnvironmentSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }
      const env = await svc.update(companyId, envId, parsed.data);
      if (!env) throw notFound("Environment not found");

      await emitAudit({
        req,
        db,
        companyId,
        action: "environment.updated",
        targetType: "environment",
        targetId: envId,
        metadata: { fields: Object.keys(parsed.data) },
      });

      res.json(env);
    },
  );

  // POST /companies/:companyId/environments/:envId/archive
  router.post(
    "/companies/:companyId/environments/:envId/archive",
    requirePermission(db, PERMISSIONS.SANDBOX_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const envId = req.params.envId as string;
      assertCompanyAccess(req, companyId);
      const env = await svc.archive(companyId, envId);
      if (!env) throw notFound("Environment not found");

      await emitAudit({
        req,
        db,
        companyId,
        action: "environment.archived",
        targetType: "environment",
        targetId: envId,
        metadata: {},
      });

      res.json(env);
    },
  );

  // GET /companies/:companyId/environments/:envId/leases — list
  router.get(
    "/companies/:companyId/environments/:envId/leases",
    requirePermission(db, PERMISSIONS.SANDBOX_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const envId = req.params.envId as string;
      assertCompanyAccess(req, companyId);
      const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
      const status =
        rawStatus && (ENVIRONMENT_LEASE_STATUSES as readonly string[]).includes(rawStatus)
          ? (rawStatus as EnvironmentLeaseStatus)
          : undefined;
      const leases = await svc.listLeases(companyId, envId, { status });
      res.json({ leases });
    },
  );

  // GET /companies/:companyId/environments/leases/:leaseId — get one
  router.get(
    "/companies/:companyId/environments/leases/:leaseId",
    requirePermission(db, PERMISSIONS.SANDBOX_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const leaseId = req.params.leaseId as string;
      assertCompanyAccess(req, companyId);
      const lease = await svc.getLeaseById(companyId, leaseId);
      if (!lease) throw notFound("Environment lease not found");
      res.json(lease);
    },
  );

  // POST /companies/:companyId/environments/leases/:leaseId/release
  router.post(
    "/companies/:companyId/environments/leases/:leaseId/release",
    requirePermission(db, PERMISSIONS.SANDBOX_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const leaseId = req.params.leaseId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);

      const parsed = releaseLeaseSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const lease = await svc.releaseLease(
        companyId,
        leaseId,
        parsed.data.status ?? "released",
        {
          failureReason: parsed.data.failureReason,
          cleanupStatus: parsed.data.cleanupStatus,
        },
      );
      if (!lease) throw notFound("Environment lease not found");

      await emitAudit({
        req,
        db,
        companyId,
        action: "environment_lease.released",
        targetType: "environment_lease",
        targetId: leaseId,
        metadata: {
          status: lease.status,
          actorId: actor.actorId,
          failureReason: lease.failureReason,
        },
      });

      res.json(lease);
    },
  );

  return router;
}
