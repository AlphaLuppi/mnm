import { Router } from "express";
import type { Db } from "@mnm/db";
import {
  companyPortabilityExportSchema,
  companyPortabilityImportSchema,
  companyPortabilityPreviewSchema,
  createCompanySchema,
  updateCompanySchema,
} from "@mnm/shared";
import { forbidden } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { accessService, companyPortabilityService, companyService, emitAudit, logActivity } from "../services/index.js";
import { bootstrapCompany } from "../services/cao.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function companyRoutes(db: Db) {
  const router = Router();
  const svc = companyService(db);
  const portability = companyPortabilityService(db);
  const access = accessService(db);

  router.get("/", async (req, res) => {
    assertBoard(req);
    const result = await svc.list();
    if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
      res.json(result);
      return;
    }
    const allowed = new Set(req.actor.companyIds ?? []);
    res.json(result.filter((company) => allowed.has(company.id)));
  });

  router.get("/stats", async (req, res) => {
    assertBoard(req);
    const allowed = req.actor.source === "local_implicit" || req.actor.isInstanceAdmin
      ? null
      : new Set(req.actor.companyIds ?? []);
    const stats = await svc.stats();
    if (!allowed) {
      res.json(stats);
      return;
    }
    const filtered = Object.fromEntries(Object.entries(stats).filter(([companyId]) => allowed.has(companyId)));
    res.json(filtered);
  });

  // Common malformed path when companyId is empty in "/api/companies/{companyId}/issues".
  router.get("/issues", (_req, res) => {
    res.status(400).json({
      error: "Missing companyId in path. Use /api/companies/{companyId}/issues.",
    });
  });

  router.get("/:companyId", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await svc.getById(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(company);
  });

  router.post("/:companyId/export", validate(companyPortabilityExportSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await portability.exportBundle(companyId, req.body);

    await emitAudit({
      req, db, companyId,
      action: "company.exported",
      targetType: "company",
      targetId: companyId,
      metadata: { format: req.body.format ?? "json" },
    });

    res.json(result);
  });

  router.post("/import/preview", validate(companyPortabilityPreviewSchema), async (req, res) => {
    if (req.body.target.mode === "existing_company") {
      assertCompanyAccess(req, req.body.target.companyId);
    } else {
      assertBoard(req);
    }
    const preview = await portability.previewImport(req.body);
    res.json(preview);
  });

  router.post("/import", validate(companyPortabilityImportSchema), async (req, res) => {
    if (req.body.target.mode === "existing_company") {
      assertCompanyAccess(req, req.body.target.companyId);
    } else {
      assertBoard(req);
    }
    const actor = getActorInfo(req);
    const result = await portability.importBundle(req.body, req.actor.type === "board" ? req.actor.userId : null);
    await logActivity(db, {
      companyId: result.company.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "company.imported",
      entityType: "company",
      entityId: result.company.id,
      agentId: actor.agentId,
      runId: actor.runId,
      details: {
        include: req.body.include ?? null,
        agentCount: result.agents.length,
        warningCount: result.warnings.length,
        companyAction: result.company.action,
      },
    });

    await emitAudit({
      req, db, companyId: result.company.id,
      action: "company.imported",
      targetType: "company",
      targetId: result.company.id,
      metadata: { source: "import", agentCount: result.agents.length },
    });

    res.json(result);
  });

  router.post("/", validate(createCompanySchema), async (req, res) => {
    assertBoard(req);
    if (!(req.actor.source === "local_implicit" || req.actor.isInstanceAdmin)) {
      throw forbidden("Instance admin required");
    }
    const company = await svc.create(req.body);
    const adminUserId = req.actor.userId ?? "local-board";
    await access.ensureMembership(company.id, "user", adminUserId, "owner", "active");

    // Bootstrap: seed permissions, create Admin role, create CAO agent
    await bootstrapCompany(db, company.id, adminUserId);

    await logActivity(db, {
      companyId: company.id,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "company.created",
      entityType: "company",
      entityId: company.id,
      details: { name: company.name },
    });

    await emitAudit({
      req, db, companyId: company.id,
      action: "company.created",
      targetType: "company",
      targetId: company.id,
      metadata: { name: company.name },
    });

    res.status(201).json(company);
  });

  router.patch("/:companyId", validate(updateCompanySchema), async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    // If invitationOnly is being changed, fetch current value for audit
    let oldInvitationOnly: boolean | undefined;
    if (req.body.invitationOnly !== undefined) {
      const current = await svc.getById(companyId);
      if (!current) {
        res.status(404).json({ error: "Company not found" });
        return;
      }
      oldInvitationOnly = current.invitationOnly;
    }

    const company = await svc.update(companyId, req.body);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "company.updated",
      entityType: "company",
      entityId: companyId,
      details: req.body,
    });

    // Specific config_change audit when invitationOnly changes
    if (
      req.body.invitationOnly !== undefined &&
      oldInvitationOnly !== undefined &&
      req.body.invitationOnly !== oldInvitationOnly
    ) {
      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "company.config_change",
        entityType: "company",
        entityId: companyId,
        details: {
          field: "invitationOnly",
          oldValue: oldInvitationOnly,
          newValue: req.body.invitationOnly,
        },
      });
    }

    await emitAudit({
      req, db, companyId,
      action: "company.updated",
      targetType: "company",
      targetId: companyId,
      metadata: { changedFields: Object.keys(req.body) },
    });

    res.json(company);
  });

  router.post("/:companyId/archive", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await svc.archive(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "company.archived",
      entityType: "company",
      entityId: companyId,
    });

    await emitAudit({
      req, db, companyId,
      action: "company.archived",
      targetType: "company",
      targetId: companyId,
      metadata: { name: company.name },
      severity: "warning",
    });

    res.json(company);
  });

  router.delete("/:companyId", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await svc.remove(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    await emitAudit({
      req, db, companyId,
      action: "company.deleted",
      targetType: "company",
      targetId: companyId,
      metadata: { name: company.name },
      severity: "critical",
    });

    res.json({ ok: true });
  });

  return router;
}
