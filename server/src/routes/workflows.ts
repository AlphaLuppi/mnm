import { Router } from "express";
import type { Db } from "@mnm/db";
import {
  createWorkflowTemplateSchema,
  updateWorkflowTemplateSchema,
  createWorkflowInstanceSchema,
  updateWorkflowInstanceSchema,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission, assertCompanyPermission } from "../middleware/require-permission.js";
import { emitAudit, workflowService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { getScopeProjectIds } from "../services/scope-filter.js";
import { forbidden } from "../errors.js";

export function workflowRoutes(db: Db) {
  const router = Router();
  const svc = workflowService(db);

  // ─── Templates ────────────────────────────────────────────────

  router.get("/companies/:companyId/workflow-templates", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const templates = await svc.listTemplates(companyId);
    res.json(templates);
  });

  router.get("/workflow-templates/:id", async (req, res) => {
    const template = await svc.getTemplate(req.params.id as string);
    assertCompanyAccess(req, template.companyId);
    res.json(template);
  });

  router.post(
    "/companies/:companyId/workflow-templates",
    requirePermission(db, "workflows:create"),
    validate(createWorkflowTemplateSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const template = await svc.createTemplate(companyId, req.body);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "workflow_template.created",
        entityType: "workflow_template",
        entityId: template.id,
        details: { name: template.name },
      });

      await emitAudit({
        req, db, companyId,
        action: "workflow.template_created",
        targetType: "workflow",
        targetId: template.id,
        metadata: { name: template.name },
      });

      res.status(201).json(template);
    },
  );

  router.patch(
    "/workflow-templates/:id",
    validate(updateWorkflowTemplateSchema),
    async (req, res) => {
      const existing = await svc.getTemplate(req.params.id as string);
      assertCompanyAccess(req, existing.companyId);
      await assertCompanyPermission(db, req, existing.companyId, "workflows:create");
      const template = await svc.updateTemplate(existing.id, req.body);

      await emitAudit({
        req, db, companyId: existing.companyId,
        action: "workflow.template_updated",
        targetType: "workflow",
        targetId: existing.id,
        metadata: { name: template.name },
      });

      res.json(template);
    },
  );

  router.delete("/workflow-templates/:id", async (req, res) => {
    const existing = await svc.getTemplate(req.params.id as string);
    assertCompanyAccess(req, existing.companyId);
    await assertCompanyPermission(db, req, existing.companyId, "workflows:create");
    await svc.deleteTemplate(existing.id);

    await emitAudit({
      req, db, companyId: existing.companyId,
      action: "workflow.template_deleted",
      targetType: "workflow",
      targetId: existing.id,
      metadata: { name: existing.name },
      severity: "warning",
    });

    res.json({ deleted: true });
  });

  // Ensure BMAD builtin template exists for a company
  router.post("/companies/:companyId/workflow-templates/ensure-bmad", requirePermission(db, "workflows:create"), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const template = await svc.ensureBmadTemplate(companyId);
    res.json(template);
  });

  // ─── Instances ────────────────────────────────────────────────

  router.get("/companies/:companyId/workflows", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    // PROJ-S03: Scope filtering
    const scopeProjectIds = await getScopeProjectIds(db, companyId, req);

    const filters: { status?: string; projectId?: string; allowedProjectIds?: string[] | null } = {};
    if (typeof req.query.status === "string") filters.status = req.query.status;
    if (typeof req.query.projectId === "string") filters.projectId = req.query.projectId;
    filters.allowedProjectIds = scopeProjectIds; // PROJ-S03
    const instances = await svc.listInstances(companyId, filters);
    res.json(instances);
  });

  router.get("/workflows/:id", async (req, res) => {
    const instance = await svc.getInstance(req.params.id as string);
    assertCompanyAccess(req, instance.companyId);

    // PROJ-S03: Scope check for single entity
    const scopeProjectIds = await getScopeProjectIds(db, instance.companyId, req);
    if (scopeProjectIds !== null && instance.projectId !== null) {
      if (!scopeProjectIds.includes(instance.projectId)) {
        await emitAudit({
          req, db, companyId: instance.companyId,
          action: "access.scope_denied",
          targetType: "workflow",
          targetId: instance.id,
          metadata: { requestedProjectId: instance.projectId, allowedProjectIds: scopeProjectIds },
          severity: "warning",
        });
        throw forbidden("Access denied: resource outside project scope", {
          error: "SCOPE_DENIED",
          projectId: instance.projectId,
        });
      }
    }

    res.json(instance);
  });

  router.post(
    "/companies/:companyId/workflows",
    requirePermission(db, "workflows:create"),
    validate(createWorkflowInstanceSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);
      const instance = await svc.createInstance(companyId, req.body, actor.actorId ?? undefined);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "workflow.created",
        entityType: "workflow",
        entityId: instance.id,
        details: { name: instance.name },
      });

      await emitAudit({
        req, db, companyId,
        action: "workflow.instance_created",
        targetType: "workflow",
        targetId: instance.id,
        metadata: { templateName: instance.name },
      });

      res.status(201).json(instance);
    },
  );

  router.patch(
    "/workflows/:id",
    validate(updateWorkflowInstanceSchema),
    async (req, res) => {
      const existing = await svc.getInstance(req.params.id as string);
      assertCompanyAccess(req, existing.companyId);
      await assertCompanyPermission(db, req, existing.companyId, "workflows:create");
      const instance = await svc.updateInstance(existing.id, req.body);

      await emitAudit({
        req, db, companyId: existing.companyId,
        action: "workflow.instance_updated",
        targetType: "workflow",
        targetId: existing.id,
        metadata: { changedFields: Object.keys(req.body) },
      });

      res.json(instance);
    },
  );

  router.delete("/workflows/:id", async (req, res) => {
    const existing = await svc.getInstance(req.params.id as string);
    assertCompanyAccess(req, existing.companyId);
    await assertCompanyPermission(db, req, existing.companyId, "workflows:create");
    await svc.deleteInstance(existing.id);

    await emitAudit({
      req, db, companyId: existing.companyId,
      action: "workflow.instance_deleted",
      targetType: "workflow",
      targetId: existing.id,
      metadata: { name: existing.name },
      severity: "warning",
    });

    res.json({ deleted: true });
  });

  return router;
}
