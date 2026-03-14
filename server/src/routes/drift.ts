import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { projectService } from "../services/index.js";
import {
  checkDrift,
  getDriftResults,
  resolveDrift,
  getDriftScanStatus,
  runDriftScan,
  cancelDriftScan,
} from "../services/drift.js";
import { driftPersistenceService } from "../services/drift-persistence.js";
import { driftMonitorService } from "../services/drift-monitor.js";
import { emitAudit } from "../services/audit-emitter.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { requirePermission } from "../middleware/require-permission.js";
import { badRequest, notFound } from "../errors.js";
import { getScopeProjectIds } from "../services/scope-filter.js";

const driftCheckBody = z.object({
  sourceDoc: z.string().min(1),
  targetDoc: z.string().min(1),
  customInstructions: z.string().optional(),
});

const driftScanBody = z.object({
  scope: z.string().min(1).default("all"),
});

export function driftRoutes(db: Db) {
  const router = Router();
  const svc = projectService(db);

  async function resolveProject(req: { params: Record<string, string> }, res: any) {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return null;
    }
    return project;
  }

  // POST /projects/:id/drift/check
  router.post("/projects/:id/drift/check", async (req, res) => {
    const project = await resolveProject(req, res);
    if (!project) return;
    assertCompanyAccess(req, project.companyId);

    const parsed = driftCheckBody.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const report = await checkDrift(
      db,
      project.companyId,
      project.id,
      parsed.data.sourceDoc,
      parsed.data.targetDoc,
      parsed.data.customInstructions,
    );
    res.json(report);
  });

  // GET /projects/:id/drift/results — with pagination support
  router.get("/projects/:id/drift/results", async (req, res) => {
    const project = await resolveProject(req, res);
    if (!project) return;
    assertCompanyAccess(req, project.companyId);

    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const status = req.query.status as string | undefined;

    const result = await getDriftResults(db, project.companyId, project.id, {
      limit,
      offset,
      status,
    });
    res.json(result);
  });

  // GET /projects/:id/drift/items — list drift items with filters
  router.get("/projects/:id/drift/items", async (req, res) => {
    const project = await resolveProject(req, res);
    if (!project) return;
    assertCompanyAccess(req, project.companyId);

    const persistence = driftPersistenceService(db);
    const severity = req.query.severity as string | undefined;
    const decision = req.query.decision as string | undefined;
    const driftType = req.query.driftType as string | undefined;
    const reportId = req.query.reportId as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const result = await persistence.listItems({
      companyId: project.companyId,
      reportId,
      severity: severity as any,
      decision: decision as any,
      driftType: driftType as any,
      limit,
      offset,
    });
    res.json(result);
  });

  // POST /projects/:id/drift/scan — trigger a full drift scan
  router.post("/projects/:id/drift/scan", async (req, res) => {
    const project = await resolveProject(req, res);
    if (!project) return;
    assertCompanyAccess(req, project.companyId);

    const parsed = driftScanBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const workspacePath = project.primaryWorkspace?.cwd;
    if (!workspacePath) {
      res.status(400).json({ error: "No workspace path configured for this project" });
      return;
    }

    // Start scan in background, respond immediately
    runDriftScan(db, project.companyId, project.id, workspacePath, parsed.data.scope).catch((err) => {
      // Logged inside runDriftScan, but catch to prevent unhandled rejection
    });

    const scanStatus = await getDriftScanStatus(db, project.companyId, project.id);
    res.json({ started: true, status: scanStatus });
  });

  // GET /projects/:id/drift/status — get scan status
  router.get("/projects/:id/drift/status", async (req, res) => {
    const project = await resolveProject(req, res);
    if (!project) return;
    assertCompanyAccess(req, project.companyId);

    const scanStatus = await getDriftScanStatus(db, project.companyId, project.id);
    res.json(scanStatus);
  });

  // DELETE /projects/:id/drift/scan — cancel ongoing scan
  router.delete("/projects/:id/drift/scan", async (req, res) => {
    const project = await resolveProject(req, res);
    if (!project) return;
    assertCompanyAccess(req, project.companyId);

    const cancelled = cancelDriftScan(project.id);
    res.json({ cancelled });
  });

  // PATCH /projects/:id/drift/:driftId — resolve a drift (accept/reject)
  const driftResolveBody = z.object({
    decision: z.enum(["accepted", "rejected"]),
    remediationNote: z.string().optional(),
  });

  router.patch("/projects/:id/drift/:driftId", async (req, res) => {
    const { id, driftId } = req.params;
    const project = await svc.getById(id as string);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, project.companyId);

    const parsed = driftResolveBody.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const actorInfo = getActorInfo(req);

    const updated = await resolveDrift(
      db,
      project.companyId,
      driftId as string,
      parsed.data.decision,
      actorInfo.actorId,
      parsed.data.remediationNote,
    );

    if (!updated) {
      res.status(404).json({ error: "Drift not found" });
      return;
    }

    // Emit audit event for drift resolution
    emitAudit({
      req,
      db,
      companyId: project.companyId,
      action: "drift.item_resolved",
      targetType: "drift_item",
      targetId: driftId as string,
      metadata: {
        decision: parsed.data.decision,
        severity: updated.severity,
        driftType: updated.driftType,
        projectId: project.id,
      },
      severity: "info",
    });

    res.json(updated);
  });

  // ========================================================
  // DRIFT-S02: Drift monitor routes
  // ========================================================

  const monitor = driftMonitorService(db);

  const alertResolveBody = z.object({
    resolution: z.enum(["acknowledged", "ignored", "remediated"]),
    note: z.string().optional(),
  });

  // GET /companies/:companyId/drift/alerts — list active drift alerts
  router.get("/companies/:companyId/drift/alerts", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    // PROJ-S03: Scope filtering for drift alerts
    const scopeProjectIds = await getScopeProjectIds(db, companyId, req);

    const severity = req.query.severity as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const result = await monitor.getDriftAlerts(companyId, {
      severity: severity as any,
      limit,
      offset,
    });

    // PROJ-S03: Post-filter alerts by scope
    if (scopeProjectIds !== null) {
      const scopeSet = new Set(scopeProjectIds);
      const filtered = result.data.filter((alert) => scopeSet.has(alert.projectId));
      res.json({ data: filtered, total: filtered.length });
      return;
    }

    res.json(result);
  });

  // POST /companies/:companyId/drift/alerts/:alertId/resolve — resolve a drift alert
  router.post("/companies/:companyId/drift/alerts/:alertId/resolve", async (req, res) => {
    const companyId = req.params.companyId as string;
    const alertId = req.params.alertId as string;
    assertCompanyAccess(req, companyId);

    const parsed = alertResolveBody.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const actorInfo = getActorInfo(req);
    const resolved = await monitor.resolveAlert(
      companyId,
      alertId,
      actorInfo.actorId,
      parsed.data.resolution,
      parsed.data.note,
    );

    if (!resolved) {
      throw notFound("Drift alert not found");
    }

    // Emit audit via the route-level emitAudit (with req context)
    emitAudit({
      req,
      db,
      companyId,
      action: "drift.alert_resolved",
      targetType: "drift_alert",
      targetId: alertId,
      metadata: {
        resolution: parsed.data.resolution,
        note: parsed.data.note,
        severity: resolved.severity,
        alertType: resolved.alertType,
      },
      severity: "info",
    });

    res.json(resolved);
  });

  // GET /companies/:companyId/drift/monitoring/status — get monitoring status
  router.get("/companies/:companyId/drift/monitoring/status", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const status = monitor.getMonitoringStatus(companyId);
    res.json(status);
  });

  // POST /companies/:companyId/drift/monitoring/start — start monitoring
  router.post(
    "/companies/:companyId/drift/monitoring/start",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const config = req.body?.config as Record<string, unknown> | undefined;
      const status = await monitor.startMonitoring(companyId, config as any);
      res.json(status);
    },
  );

  // POST /companies/:companyId/drift/monitoring/stop — stop monitoring
  router.post(
    "/companies/:companyId/drift/monitoring/stop",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      await monitor.stopMonitoring(companyId);
      const status = monitor.getMonitoringStatus(companyId);
      res.json(status);
    },
  );

  return router;
}
