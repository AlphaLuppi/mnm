import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { traceService } from "../services/trace-service.js";
import { lensAnalysisService } from "../services/lens-analysis.js";
import { enrichTrace, backfillSilverEnrichment } from "../services/silver-trace-enrichment.js";
import { goldTraceEnrichment } from "../services/gold-trace-enrichment.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import {
  createTraceSchema,
  completeTraceSchema,
  createObservationSchema,
  batchCreateObservationsSchema,
  completeObservationSchema,
  traceListFiltersSchema,
  createTraceLensSchema,
  updateTraceLensSchema,
  createGoldPromptSchema,
  updateGoldPromptSchema,
  goldPromptFiltersSchema,
} from "@mnm/shared";

export function traceRoutes(db: Db) {
  const router = Router();
  const svc = traceService(db);
  const analysisEngine = lensAnalysisService(db);

  // --- Trace endpoints ---

  // POST /api/companies/:companyId/traces — create trace
  router.post(
    "/companies/:companyId/traces",
    requirePermission(db, "traces:write"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const body = createTraceSchema.parse(req.body);
      const trace = await svc.create(companyId, body);
      res.status(201).json(trace);
    },
  );

  // GET /api/companies/:companyId/traces — list traces (cursor pagination)
  router.get(
    "/companies/:companyId/traces",
    requirePermission(db, "traces:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const filters = traceListFiltersSchema.parse(req.query);
      const result = await svc.list(companyId, filters);
      res.json(result);
    },
  );

  // GET /api/companies/:companyId/traces/:traceId — detail + observation tree
  router.get(
    "/companies/:companyId/traces/:traceId",
    requirePermission(db, "traces:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const tree = await svc.getTree(companyId, req.params.traceId as string);
      res.json(tree);
    },
  );

  // PATCH /api/companies/:companyId/traces/:traceId/complete — finalize trace
  router.patch(
    "/companies/:companyId/traces/:traceId/complete",
    requirePermission(db, "traces:write"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const body = completeTraceSchema.parse(req.body);
      const trace = await svc.completeTrace(companyId, req.params.traceId as string, body);
      res.json(trace);
    },
  );

  // --- Observation endpoints ---

  // POST /api/companies/:companyId/traces/:traceId/observations — add observation
  router.post(
    "/companies/:companyId/traces/:traceId/observations",
    requirePermission(db, "traces:write"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const body = createObservationSchema.parse(req.body);
      const obs = await svc.addObservation(companyId, req.params.traceId as string, body);
      res.status(201).json(obs);
    },
  );

  // POST /api/companies/:companyId/traces/:traceId/observations/batch — bulk add
  router.post(
    "/companies/:companyId/traces/:traceId/observations/batch",
    requirePermission(db, "traces:write"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const body = batchCreateObservationsSchema.parse(req.body);
      const obs = await svc.addObservationsBatch(companyId, req.params.traceId as string, body.observations);
      res.status(201).json(obs);
    },
  );

  // PATCH /api/companies/:companyId/traces/:traceId/observations/:obsId — complete observation
  router.patch(
    "/companies/:companyId/traces/:traceId/observations/:obsId",
    requirePermission(db, "traces:write"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const body = completeObservationSchema.parse(req.body);
      const obs = await svc.completeObservation(
        companyId,
        req.params.traceId as string,
        req.params.obsId as string,
        body,
      );
      res.json(obs);
    },
  );

  // --- Lens endpoints ---

  // POST /api/companies/:companyId/trace-lenses — create lens
  router.post(
    "/companies/:companyId/trace-lenses",
    requirePermission(db, "traces:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);
      const body = createTraceLensSchema.parse(req.body);
      const lens = await svc.createLens(companyId, actor.actorId, body);
      res.status(201).json(lens);
    },
  );

  // GET /api/companies/:companyId/trace-lenses — list user lenses + templates
  router.get(
    "/companies/:companyId/trace-lenses",
    requirePermission(db, "traces:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);
      const lenses = await svc.listLenses(companyId, actor.actorId);
      res.json(lenses);
    },
  );

  // PUT /api/companies/:companyId/trace-lenses/:lensId — update lens
  router.put(
    "/companies/:companyId/trace-lenses/:lensId",
    requirePermission(db, "traces:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const body = updateTraceLensSchema.parse(req.body);
      const lens = await svc.updateLens(companyId, req.params.lensId as string, body);
      res.json(lens);
    },
  );

  // DELETE /api/companies/:companyId/trace-lenses/:lensId — delete lens
  router.delete(
    "/companies/:companyId/trace-lenses/:lensId",
    requirePermission(db, "traces:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      await svc.deleteLens(companyId, req.params.lensId as string);
      res.status(204).end();
    },
  );

  // POST /api/companies/:companyId/trace-lenses/:lensId/analyze/:traceId — run lens analysis
  router.post(
    "/companies/:companyId/trace-lenses/:lensId/analyze/:traceId",
    requirePermission(db, "traces:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);
      const result = await analysisEngine.analyze(
        companyId,
        actor.actorId,
        req.params.traceId as string,
        req.params.lensId as string,
      );
      res.json(result);
    },
  );

  // GET /api/companies/:companyId/trace-lenses/:lensId/results/:traceId — get cached result
  router.get(
    "/companies/:companyId/trace-lenses/:lensId/results/:traceId",
    requirePermission(db, "traces:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const result = await svc.getLensResult(
        companyId,
        req.params.lensId as string,
        req.params.traceId as string,
      );
      if (!result) {
        res.status(404).json({ error: "No analysis result found for this lens/trace combination" });
        return;
      }
      res.json(result);
    },
  );

  // --- Silver Enrichment endpoints ---

  // POST /api/companies/:companyId/traces/:traceId/enrich — run silver enrichment on one trace
  router.post(
    "/companies/:companyId/traces/:traceId/enrich",
    requirePermission(db, "traces:write"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const phases = await enrichTrace(db, req.params.traceId as string, companyId);
      res.json({ traceId: req.params.traceId, phaseCount: phases.length, phases });
    },
  );

  // POST /api/traces/backfill-silver — backfill silver enrichment on all completed traces without phases
  router.post(
    "/traces/backfill-silver",
    async (_req, res) => {
      const enriched = await backfillSilverEnrichment(db);
      res.json({ enriched });
    },
  );

  // POST /api/traces/backfill-gold — backfill gold enrichment on traces with silver but no gold
  router.post(
    "/traces/backfill-gold",
    async (_req, res) => {
      const enriched = await goldTraceEnrichment(db).backfillGoldEnrichment();
      res.json({ enriched });
    },
  );

  // --- Gold Prompt endpoints (PIPE-03) ---

  // POST /api/companies/:companyId/gold-prompts — create gold prompt
  router.post(
    "/companies/:companyId/gold-prompts",
    requirePermission(db, "traces:write"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);
      const body = createGoldPromptSchema.parse(req.body);
      const prompt = await svc.createGoldPrompt(companyId, actor.actorId, body);
      res.status(201).json(prompt);
    },
  );

  // GET /api/companies/:companyId/gold-prompts — list gold prompts
  router.get(
    "/companies/:companyId/gold-prompts",
    requirePermission(db, "traces:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const filters = goldPromptFiltersSchema.parse(req.query);
      const prompts = await svc.listGoldPrompts(companyId, filters);
      res.json(prompts);
    },
  );

  // PUT /api/companies/:companyId/gold-prompts/:promptId — update gold prompt
  router.put(
    "/companies/:companyId/gold-prompts/:promptId",
    requirePermission(db, "traces:write"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const body = updateGoldPromptSchema.parse(req.body);
      const prompt = await svc.updateGoldPrompt(companyId, req.params.promptId as string, body);
      res.json(prompt);
    },
  );

  // DELETE /api/companies/:companyId/gold-prompts/:promptId — delete gold prompt
  router.delete(
    "/companies/:companyId/gold-prompts/:promptId",
    requirePermission(db, "traces:write"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      await svc.deleteGoldPrompt(companyId, req.params.promptId as string);
      res.status(204).end();
    },
  );

  return router;
}
