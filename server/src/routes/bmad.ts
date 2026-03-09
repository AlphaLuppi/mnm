import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import type { Db } from "@mnm/db";
import { projectService } from "../services/index.js";
import { analyzeBmadWorkspace } from "../services/bmad-analyzer.js";
import { assertCompanyAccess } from "./authz.js";
import { badRequest, notFound } from "../errors.js";

const BMAD_ROOT = "_bmad-output";

export function bmadRoutes(db: Db) {
  const router = Router();
  const svc = projectService(db);

  async function resolveWorkspacePath(projectId: string): Promise<string | null> {
    const project = await svc.getById(projectId);
    if (!project) return null;
    return project.primaryWorkspace?.cwd ?? null;
  }

  // GET /projects/:id/bmad — full BMAD structure
  router.get("/projects/:id/bmad", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, project.companyId);

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) {
      res.status(404).json({ error: "No workspace path configured for this project" });
      return;
    }

    const result = await analyzeBmadWorkspace(workspacePath);
    if (!result) {
      res.status(404).json({ error: "No BMAD structure found in workspace" });
      return;
    }

    res.json(result);
  });

  // GET /projects/:id/bmad/file?path=<relative-path> — raw markdown content
  router.get("/projects/:id/bmad/file", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, project.companyId);

    const filePath = req.query.path;
    if (typeof filePath !== "string" || filePath.length === 0) {
      throw badRequest("Missing required query parameter: path");
    }

    // Path traversal protection
    if (filePath.includes("..") || filePath.startsWith("/")) {
      throw badRequest("Invalid path: must be relative and cannot contain '..'");
    }

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) {
      res.status(404).json({ error: "No workspace path configured for this project" });
      return;
    }

    // Ensure the resolved path is within _bmad-output/
    const fullPath = path.resolve(workspacePath, BMAD_ROOT, filePath);
    const bmadBase = path.resolve(workspacePath, BMAD_ROOT);
    if (!fullPath.startsWith(bmadBase + path.sep) && fullPath !== bmadBase) {
      throw badRequest("Path must be within _bmad-output/");
    }

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      res.type("text/markdown").send(content);
    } catch {
      res.status(404).json({ error: "File not found" });
    }
  });

  return router;
}
