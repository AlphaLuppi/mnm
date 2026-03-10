import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type { Db } from "@mnm/db";
import { AGENT_ROLES } from "@mnm/shared";
import { projectService, agentService } from "../services/index.js";
import { analyzeBmadWorkspace } from "../services/bmad-analyzer.js";
import { startBmadWatcher } from "../services/bmad-watcher.js";
import { checkDrift } from "../services/drift.js";
import { assertCompanyAccess } from "./authz.js";
import { badRequest } from "../errors.js";

const BMAD_ROOT = "_bmad-output";

/* ── Helpers ─────────────────────────────────────────────────── */

/** Parse YAML frontmatter from a markdown file (--- ... ---) */
function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    return yaml.load(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** IDE command directories to check, in priority order */
function ideDirs(workspacePath: string): string[] {
  return [
    path.join(workspacePath, ".claude", "commands"),
    path.join(workspacePath, ".cursor", "commands"),
    path.join(workspacePath, ".windsurf", "commands"),
  ];
}

/* ── Workflow discovery ───────────────────────────────────────── */

export interface BmadWorkflow {
  name: string;
  description: string;
  phase?: string;
  agentRole?: string;
}

const WORKFLOW_ROLE_FALLBACK: Record<string, string> = {
  "dev-story": "dev",
  "correct-course": "dev",
  "quick-dev": "quick-flow-solo-dev",
  "quick-spec": "pm",
  "create-prd": "pm",
  "create-ux": "ux-designer",
  "create-architecture": "architect",
  "create-epics-and-stories": "architect",
  "brainstorm": "analyst",
  "product-brief": "analyst",
  "research": "analyst",
  "sprint": "sm",
  "create-story": "sm",
  "readiness": "qa",
  "code-review": "qa",
  "retrospective": "sm",
};

/** Derive a human-readable phase label from the workflow name */
function phaseFromName(name: string): string {
  if (/brainstorm|product-brief|research/.test(name)) return "Analysis";
  if (/create-prd|create-ux/.test(name)) return "Planning";
  if (/create-architecture|create-epics|readiness/.test(name)) return "Solutioning";
  if (/sprint|dev-story|code-review|correct-course|retrospective|create-story/.test(name)) return "Implementation";
  if (/quick-spec|quick-dev/.test(name)) return "Quick Flow";
  if (/create-agent|create-module|create-workflow|edit-|validate-|rework/.test(name)) return "Builder";
  return "Utility";
}

/**
 * Scan IDE command directories for bmad-*.md workflow files (excluding agent commands).
 * Falls back to scanning workflow.yaml files inside _bmad/ if nothing found.
 */
async function scanWorkflows(workspacePath: string): Promise<BmadWorkflow[]> {
  const results: BmadWorkflow[] = [];
  const seen = new Set<string>();

  for (const dir of ideDirs(workspacePath)) {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      if (!entry.name.startsWith("bmad-")) continue;
      if (entry.name.startsWith("bmad-agent-")) continue; // agents handled separately

      const content = await fs.readFile(path.join(dir, entry.name), "utf-8").catch(() => null);
      if (!content) continue;

      const fm = parseFrontmatter(content);
      const name = typeof fm?.name === "string" ? fm.name : null;
      const description = typeof fm?.description === "string" ? fm.description : "";
      if (!name || seen.has(name)) continue;

      const agentRole = typeof fm?.agentRole === "string" ? fm.agentRole : (WORKFLOW_ROLE_FALLBACK[name] ?? undefined);
      seen.add(name);
      results.push({ name, description, phase: phaseFromName(name), agentRole });
    }

    if (results.length > 0) break; // found in first available IDE dir
  }

  // Fallback: scan workflow.yaml files in _bmad/
  if (results.length === 0) {
    const bmadDir = path.join(workspacePath, "_bmad");
    async function walk(dir: string) {
      let entries: import("node:fs").Dirent[];
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { await walk(full); continue; }
        if (entry.name !== "workflow.yaml") continue;
        const content = await fs.readFile(full, "utf-8").catch(() => null);
        if (!content) continue;
        const parsed = yaml.load(content) as Record<string, unknown> | null;
        if (!parsed) continue;
        const name = typeof parsed.name === "string" ? parsed.name : null;
        const description = typeof parsed.description === "string" ? parsed.description : "";
        if (name && !seen.has(name)) {
          seen.add(name);
          results.push({ name, description, phase: phaseFromName(name), agentRole: WORKFLOW_ROLE_FALLBACK[name] ?? undefined });
        }
      }
    }
    await walk(bmadDir);
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/* ── Agent discovery ─────────────────────────────────────────── */

export interface DiscoveredBmadAgent {
  slug: string;        // e.g. "bmm-dev"
  commandName: string; // e.g. "dev"
  personaName: string; // e.g. "Amelia"
  title: string;       // e.g. "Developer Agent"
  description: string;
  icon: string | null;
  capabilities: string | null;
  role: string;        // MnM role mapping
}

const ROLE_MAP: Record<string, string> = {
  analyst: "researcher",
  pm: "pm",
  architect: "cto",
  dev: "engineer",
  qa: "qa",
  sm: "general",
  "ux-designer": "designer",
  "tech-writer": "general",
  "quick-flow-solo-dev": "engineer",
  "bmad-master": "ceo",
};

function inferRole(slug: string): string {
  for (const [key, role] of Object.entries(ROLE_MAP)) {
    if (slug.endsWith(key)) return role;
  }
  return "general";
}

async function discoverBmadAgents(workspacePath: string): Promise<DiscoveredBmadAgent[]> {
  const results: DiscoveredBmadAgent[] = [];
  const seen = new Set<string>();

  for (const dir of ideDirs(workspacePath)) {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      if (!entry.name.startsWith("bmad-agent-")) continue;

      const slug = entry.name.replace(/^bmad-agent-/, "").replace(/\.md$/, "");
      if (seen.has(slug)) continue;

      const content = await fs.readFile(path.join(dir, entry.name), "utf-8").catch(() => null);
      if (!content) continue;

      const fm = parseFrontmatter(content);
      const commandName = typeof fm?.name === "string" ? fm.name : slug;
      const description = typeof fm?.description === "string" ? fm.description : "";

      // Extract <agent> XML tag attributes
      const agentTag = content.match(/<agent([^>]*)>/)?.[1] ?? "";
      const personaName = agentTag.match(/name="([^"]+)"/)?.[1] ?? commandName;
      const title = agentTag.match(/title="([^"]+)"/)?.[1] ?? description;
      const icon = agentTag.match(/icon="([^"]+)"/)?.[1] ?? null;
      const capabilities = agentTag.match(/capabilities="([^"]+)"/)?.[1] ?? null;

      seen.add(slug);
      results.push({
        slug,
        commandName,
        personaName,
        title,
        description,
        icon,
        capabilities,
        role: inferRole(slug),
      });
    }

    if (results.length > 0) break;
  }

  return results.sort((a, b) => a.personaName.localeCompare(b.personaName));
}

/* ── Router ──────────────────────────────────────────────────── */

export function bmadRoutes(db: Db) {
  const router = Router();
  const svc = projectService(db);
  const agentSvc = agentService(db);

  async function resolveWorkspacePath(projectId: string): Promise<string | null> {
    const project = await svc.getById(projectId);
    if (!project) return null;
    return project.primaryWorkspace?.cwd ?? null;
  }

  // GET /projects/:id/bmad — full BMAD structure
  router.get("/projects/:id/bmad", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.status(404).json({ error: "No workspace path configured for this project" }); return; }

    // Start file watcher lazily on first access
    startBmadWatcher(id, project.companyId, workspacePath);

    const result = await analyzeBmadWorkspace(workspacePath);
    if (!result) { res.status(404).json({ error: "No BMAD structure found in workspace" }); return; }
    res.json(result);
  });

  // GET /projects/:id/bmad/workflows — list all BMAD workflows from IDE commands
  router.get("/projects/:id/bmad/workflows", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.json({ workflows: [] }); return; }

    const workflows = await scanWorkflows(workspacePath);
    res.json({ workflows });
  });

  // GET /projects/:id/bmad/agents — discover BMAD agents in workspace
  router.get("/projects/:id/bmad/agents", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.json({ agents: [] }); return; }

    const agents = await discoverBmadAgents(workspacePath);
    res.json({ agents });
  });

  // POST /projects/:id/bmad/import-agents — create MnM agents from discovered BMAD agents
  router.post("/projects/:id/bmad/import-agents", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const slugs: string[] = Array.isArray(req.body.slugs) ? req.body.slugs : [];
    if (slugs.length === 0) { res.status(400).json({ error: "No agent slugs provided" }); return; }

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.status(404).json({ error: "No workspace path configured" }); return; }

    const discovered = await discoverBmadAgents(workspacePath);
    const toImport = discovered.filter((a) => slugs.includes(a.slug));

    const validRoles = new Set(AGENT_ROLES);
    const created = [];
    for (const agent of toImport) {
      const role = validRoles.has(agent.role as typeof AGENT_ROLES[number])
        ? (agent.role as typeof AGENT_ROLES[number])
        : "general";
      const newAgent = await agentSvc.create(project.companyId, {
        name: `${agent.personaName} (BMAD)`,
        title: agent.title,
        role,
        capabilities: agent.capabilities ?? null,
        adapterType: "claude_local",
        adapterConfig: {},
        runtimeConfig: {},
        status: "idle",
        budgetMonthlyCents: 0,
        spentMonthlyCents: 0,
        lastHeartbeatAt: null,
        metadata: { bmad: { slug: agent.slug, commandName: agent.commandName, icon: agent.icon } },
      });
      created.push(newAgent);
    }

    res.status(201).json({ created });
  });

  // GET /projects/:id/bmad/assignments — reads from primary workspace metadata
  router.get("/projects/:id/bmad/assignments", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);
    const meta = project.primaryWorkspace?.metadata as Record<string, unknown> | null | undefined;
    const assignments = (meta?.bmadAssignments as Record<string, string> | undefined) ?? {};
    res.json({ assignments, workspaceId: project.primaryWorkspace?.id ?? null });
  });

  // POST /projects/:id/bmad/assignments — saves to primary workspace metadata
  router.post("/projects/:id/bmad/assignments", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);
    const workspaceId = project.primaryWorkspace?.id;
    if (!workspaceId) { res.status(404).json({ error: "No primary workspace configured" }); return; }
    const assignments = req.body.assignments;
    if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) {
      res.status(400).json({ error: "assignments must be an object" }); return;
    }
    const existingMeta = (project.primaryWorkspace?.metadata ?? {}) as Record<string, unknown>;
    await svc.updateWorkspace(id, workspaceId, {
      metadata: { ...existingMeta, bmadAssignments: assignments },
    });
    res.json({ ok: true });
  });

  // GET /projects/:id/bmad/command?name=<commandname> — serves a file from IDE command directories
  router.get("/projects/:id/bmad/command", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);
    const name = req.query.name;
    if (typeof name !== "string" || !name || name.includes("..") || name.includes("/") || name.includes("\\")) {
      throw badRequest("Invalid command name");
    }
    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.status(404).json({ error: "No workspace configured" }); return; }
    for (const dir of ideDirs(workspacePath)) {
      const filePath = path.join(dir, `${name}.md`);
      const content = await fs.readFile(filePath, "utf-8").catch(() => null);
      if (content) { res.type("text/markdown").send(content); return; }
    }
    res.status(404).json({ error: "Command not found" });
  });

  // POST /projects/:id/bmad/drift-check — check drift between two BMAD artifacts
  router.post("/projects/:id/bmad/drift-check", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const { sourceDoc, targetDoc } = req.body as { sourceDoc?: string; targetDoc?: string };
    if (!sourceDoc || !targetDoc) { res.status(400).json({ error: "Missing sourceDoc or targetDoc" }); return; }
    if (sourceDoc.includes("..") || targetDoc.includes("..")) { res.status(400).json({ error: "Invalid path" }); return; }

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.status(404).json({ error: "No workspace path configured" }); return; }

    const bmadBase = path.resolve(workspacePath, BMAD_ROOT);
    const absSource = path.resolve(bmadBase, sourceDoc);
    const absTarget = path.resolve(bmadBase, targetDoc);

    if (!absSource.startsWith(bmadBase) || !absTarget.startsWith(bmadBase)) {
      res.status(400).json({ error: "Paths must be within _bmad-output/" }); return;
    }

    const report = await checkDrift(project.id, absSource, absTarget);
    res.json(report);
  });

  // GET /projects/:id/bmad/file?path=<relative-path> — raw markdown content
  router.get("/projects/:id/bmad/file", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const filePath = req.query.path;
    if (typeof filePath !== "string" || filePath.length === 0) throw badRequest("Missing required query parameter: path");
    if (filePath.includes("..") || filePath.startsWith("/")) throw badRequest("Invalid path: must be relative and cannot contain '..'");

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.status(404).json({ error: "No workspace path configured for this project" }); return; }

    const fullPath = path.resolve(workspacePath, BMAD_ROOT, filePath);
    const bmadBase = path.resolve(workspacePath, BMAD_ROOT);
    if (!fullPath.startsWith(bmadBase + path.sep) && fullPath !== bmadBase) throw badRequest("Path must be within _bmad-output/");

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      res.type("text/markdown").send(content);
    } catch {
      res.status(404).json({ error: "File not found" });
    }
  });

  return router;
}
