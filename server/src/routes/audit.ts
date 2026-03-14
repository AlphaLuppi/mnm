import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { auditService } from "../services/audit.js";
import { assertCompanyAccess } from "./authz.js";
import { auditEventFiltersSchema, auditExportFiltersSchema, auditVerifySchema } from "@mnm/shared";

export function auditRoutes(db: Db) {
  const router = Router();
  const svc = auditService(db);

  // GET /api/companies/:companyId/audit — list with 12 filters + pagination
  router.get(
    "/companies/:companyId/audit",
    requirePermission(db, "audit:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const filters = auditEventFiltersSchema.parse(req.query);
      const result = await svc.list({ companyId, ...filters });
      res.json(result);
    },
  );

  // GET /api/companies/:companyId/audit/count — count events
  router.get(
    "/companies/:companyId/audit/count",
    requirePermission(db, "audit:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const filters = auditExportFiltersSchema.parse(req.query);
      const count = await svc.count({ companyId, ...filters });
      res.json({ count });
    },
  );

  // GET /api/companies/:companyId/audit/export/csv — export CSV (streamed)
  router.get(
    "/companies/:companyId/audit/export/csv",
    requirePermission(db, "audit:export"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const filters = auditExportFiltersSchema.parse(req.query);
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit-export-${companyId}-${date}.csv"`);
      for await (const chunk of svc.exportCsv({ companyId, ...filters })) {
        res.write(chunk);
      }
      res.end();
    },
  );

  // GET /api/companies/:companyId/audit/export/json — export JSON (streamed)
  router.get(
    "/companies/:companyId/audit/export/json",
    requirePermission(db, "audit:export"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const filters = auditExportFiltersSchema.parse(req.query);
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="audit-export-${companyId}-${date}.json"`);
      for await (const chunk of svc.exportJson({ companyId, ...filters })) {
        res.write(chunk);
      }
      res.end();
    },
  );

  // GET /api/companies/:companyId/audit/verify — verify hash chain integrity
  router.get(
    "/companies/:companyId/audit/verify",
    requirePermission(db, "audit:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const params = auditVerifySchema.parse(req.query);
      const result = await svc.verifyChain(companyId, params.dateFrom, params.dateTo);
      res.json(result);
    },
  );

  // GET /api/companies/:companyId/audit/:id — single event detail
  // NOTE: This route MUST be declared AFTER /count, /export/*, /verify
  // to prevent Express from matching "count", "export", "verify" as :id.
  router.get(
    "/companies/:companyId/audit/:id",
    requirePermission(db, "audit:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const event = await svc.getById(companyId, req.params.id as string);
      res.json(event);
    },
  );

  return router;
}
