import { Router } from "express";
import type { Db } from "@mnm/db";
import { dashboardService } from "../services/dashboard.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess } from "./authz.js";
import {
  dashboardTimelineFiltersSchema,
  dashboardBreakdownCategorySchema,
} from "@mnm/shared";

export function dashboardRoutes(db: Db) {
  const router = Router();
  const svc = dashboardService(db);

  // Legacy route — backward compatible (AC10, dash-s01-legacy-compat)
  router.get("/companies/:companyId/dashboard", requirePermission(db, "dashboard:view"), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const summary = await svc.summary(companyId);
    res.json(summary);
  });

  // DASH-S01: GET /dashboard/kpis — enriched KPIs (AC1, dash-s01-kpis-route)
  router.get(
    "/companies/:companyId/dashboard/kpis",
    requirePermission(db, "dashboard:view"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const kpis = await svc.kpis(companyId);
      res.json(kpis);
    },
  );

  // DASH-S01: GET /dashboard/timeline — time series (AC2, AC3, dash-s01-timeline-route)
  router.get(
    "/companies/:companyId/dashboard/timeline",
    requirePermission(db, "dashboard:view"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const filters = dashboardTimelineFiltersSchema.parse(req.query);
      const timeline = await svc.timeline(companyId, filters.period);
      res.json(timeline);
    },
  );

  // DASH-S01: GET /dashboard/breakdown/:category — category breakdown (AC4-AC7, AC11, AC12, dash-s01-breakdown-route)
  router.get(
    "/companies/:companyId/dashboard/breakdown/:category",
    requirePermission(db, "dashboard:view"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const category = dashboardBreakdownCategorySchema.parse(req.params.category);
      const breakdown = await svc.breakdown(companyId, category);
      res.json(breakdown);
    },
  );

  return router;
}
