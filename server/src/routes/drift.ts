import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { projectService } from "../services/index.js";
import { checkDrift, getDriftResults, resolveDrift } from "../services/drift.js";
import { assertCompanyAccess } from "./authz.js";
import { badRequest, notFound } from "../errors.js";

const driftCheckBody = z.object({
  sourceDoc: z.string().min(1),
  targetDoc: z.string().min(1),
  customInstructions: z.string().optional(),
});

export function driftRoutes(db: Db) {
  const router = Router();
  const svc = projectService(db);

  // POST /projects/:id/drift/check
  router.post("/projects/:id/drift/check", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, project.companyId);

    const parsed = driftCheckBody.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const report = await checkDrift(id, parsed.data.sourceDoc, parsed.data.targetDoc, parsed.data.customInstructions);
    res.json(report);
  });

  // GET /projects/:id/drift/results
  router.get("/projects/:id/drift/results", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, project.companyId);

    const results = getDriftResults(id);
    res.json(results);
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

    const updated = resolveDrift(
      id as string,
      driftId as string,
      parsed.data.decision,
      parsed.data.remediationNote,
    );

    if (!updated) {
      res.status(404).json({ error: "Drift not found" });
      return;
    }

    res.json(updated);
  });

  return router;
}
