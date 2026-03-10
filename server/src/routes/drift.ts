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
import { assertCompanyAccess } from "./authz.js";
import { badRequest, notFound } from "../errors.js";

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

    const report = await checkDrift(project.id, parsed.data.sourceDoc, parsed.data.targetDoc, parsed.data.customInstructions);
    res.json(report);
  });

  // GET /projects/:id/drift/results
  router.get("/projects/:id/drift/results", async (req, res) => {
    const project = await resolveProject(req, res);
    if (!project) return;
    assertCompanyAccess(req, project.companyId);

    const results = getDriftResults(project.id);
    res.json(results);
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
    runDriftScan(project.id, workspacePath, parsed.data.scope).catch((err) => {
      // Logged inside runDriftScan, but catch to prevent unhandled rejection
    });

    res.json({ started: true, status: getDriftScanStatus(project.id) });
  });

  // GET /projects/:id/drift/status — get scan status
  router.get("/projects/:id/drift/status", async (req, res) => {
    const project = await resolveProject(req, res);
    if (!project) return;
    assertCompanyAccess(req, project.companyId);

    res.json(getDriftScanStatus(project.id));
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
