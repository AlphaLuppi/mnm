import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type { Db } from "@mnm/db";
import { AGENT_ROLES } from "@mnm/shared";
import { projectService, agentService } from "../services/index.js";
import { analyzeWorkspace, resolveContextRoot } from "../services/workspace-analyzer.js";
import { startWorkspaceContextWatcher } from "../services/workspace-context-watcher.js";
import { checkDrift } from "../services/drift.js";
import { assertCompanyAccess } from "./authz.js";
import { badRequest } from "../errors.js";


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

export interface WorkspaceWorkflow {
  name: string;
  description: string;
  phase?: string;
  agentRole?: string;
}


/**
 * Scan IDE command directories for bmad-*.md workflow files (excluding agent commands).
 * Falls back to scanning workflow.yaml files inside _bmad/ if nothing found.
 */
async function scanWorkflows(workspacePath: string): Promise<WorkspaceWorkflow[]> {
  const results: WorkspaceWorkflow[] = [];
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

      const agentRole = typeof fm?.agentRole === "string" ? fm.agentRole : undefined;
      const phase = typeof fm?.phase === "string" ? fm.phase : undefined;
      seen.add(name);
      results.push({ name, description, phase, agentRole });
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
          const agentRole = typeof parsed.agentRole === "string" ? parsed.agentRole : undefined;
          const phase = typeof parsed.phase === "string" ? parsed.phase : undefined;
          results.push({ name, description, phase, agentRole });
        }
      }
    }
    await walk(bmadDir);
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/* ── Agent discovery ─────────────────────────────────────────── */

export interface DiscoveredWorkspaceAgent {
  slug: string;        // e.g. "bmm-dev"
  commandName: string; // e.g. "dev"
  personaName: string; // e.g. "Amelia"
  title: string;       // e.g. "Developer Agent"
  description: string;
  icon: string | null;
  capabilities: string | null;
  role: string;        // MnM role mapping
  workflows: string[]; // workflow names declared in the agent's menu
}


async function discoverWorkspaceAgents(workspacePath: string): Promise<DiscoveredWorkspaceAgent[]> {
  const results: DiscoveredWorkspaceAgent[] = [];
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

      // Resolve persona file: look for first {project-root}/path/to/file.md in the command body
      const personaPathMatch = content.match(/\{project-root\}\/([^}\s\n"']+\.md)/);
      const personaContent = personaPathMatch
        ? await fs.readFile(path.join(workspacePath, personaPathMatch[1]), "utf-8").catch(() => null)
        : null;

      // <agent> tag may live in the persona file (typical) or fall back to the command file
      const agentTag = (personaContent ?? content).match(/<agent([^>]*)>/)?.[1] ?? "";
      const personaName = agentTag.match(/name="([^"]+)"/)?.[1] ?? commandName;
      const title = agentTag.match(/title="([^"]+)"/)?.[1] ?? description;
      const icon = agentTag.match(/icon="([^"]+)"/)?.[1] ?? null;
      const capabilities = agentTag.match(/capabilities="([^"]+)"/)?.[1] ?? null;

      // Extract workflow names declared in the agent's <menu> items
      const workflows: string[] = [];
      if (personaContent) {
        const menuItemRe = /<item\b[^>]*\bworkflow="([^"]+)"/g;
        let m;
        while ((m = menuItemRe.exec(personaContent)) !== null) {
          // Path format: {project-root}/_bmad/.../workflow-name/workflow.yaml
          const nameMatch = m[1].match(/\/([^/{]+)\/workflow\.yaml/);
          if (nameMatch) workflows.push(nameMatch[1]);
        }
      }

      const role = typeof fm?.mnmRole === "string" ? fm.mnmRole : "general";
      seen.add(slug);
      results.push({
        slug,
        commandName,
        personaName,
        title,
        description,
        icon,
        capabilities,
        role,
        workflows,
      });
    }

    if (results.length > 0) break;
  }

  return results.sort((a, b) => a.personaName.localeCompare(b.personaName));
}

/* ── Router ──────────────────────────────────────────────────── */

export function workspaceContextRoutes(db: Db) {
  const router = Router();
  const svc = projectService(db);
  const agentSvc = agentService(db);

  async function resolveWorkspacePath(projectId: string): Promise<string | null> {
    const project = await svc.getById(projectId);
    if (!project) return null;
    return project.primaryWorkspace?.cwd ?? null;
  }

  // GET /projects/:id/workspace-context — full workspace context structure
  router.get("/projects/:id/workspace-context", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) {
      res.json({ detected: false, planningArtifacts: [], epics: [], sprintStatus: null });
      return;
    }

    // Start file watcher lazily on first access
    startWorkspaceContextWatcher(id, project.companyId, workspacePath);

    const result = await analyzeWorkspace(workspacePath);
    if (!result) {
      res.json({ detected: false, planningArtifacts: [], epics: [], sprintStatus: null });
      return;
    }
    res.json(result);
  });

  // GET /projects/:id/workspace-context/workflows — list all workflows from IDE commands
  router.get("/projects/:id/workspace-context/workflows", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.json({ workflows: [] }); return; }

    const [workflows, agents] = await Promise.all([
      scanWorkflows(workspacePath),
      discoverWorkspaceAgents(workspacePath),
    ]);

    // Build inverted index from agent menus: workflowName → first agent slug that declares it
    const menuAgentMap: Record<string, string> = {};
    for (const agent of agents) {
      for (const wf of agent.workflows) {
        if (!menuAgentMap[wf]) menuAgentMap[wf] = agent.slug;
      }
    }

    // Frontmatter agentRole takes priority; fall back to menu-derived mapping
    const enriched = workflows.map((wf) => ({
      ...wf,
      agentRole: wf.agentRole ?? menuAgentMap[wf.name],
    }));

    res.json({ workflows: enriched });
  });

  // GET /projects/:id/workspace-context/agents — discover workspace agents
  router.get("/projects/:id/workspace-context/agents", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.json({ agents: [] }); return; }

    const agents = await discoverWorkspaceAgents(workspacePath);
    res.json({ agents });
  });

  // POST /projects/:id/workspace-context/import-agents — create workspace-scoped MnM agents from discovered agents
  router.post("/projects/:id/workspace-context/import-agents", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const slugs: string[] = Array.isArray(req.body.slugs) ? req.body.slugs : [];
    if (slugs.length === 0) { res.status(400).json({ error: "No agent slugs provided" }); return; }

    // workspaceId: explicit string → use it; explicit null → global agent (no scope); absent → primary workspace
    const workspaceId: string | null =
      req.body.workspaceId === null ? null
      : typeof req.body.workspaceId === "string" ? req.body.workspaceId
      : project.primaryWorkspace?.id ?? null;

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.status(404).json({ error: "No workspace path configured" }); return; }

    const discovered = await discoverWorkspaceAgents(workspacePath);
    const toImport = discovered.filter((a) => slugs.includes(a.slug));

    const validRoles = new Set(AGENT_ROLES);
    const created = [];
    const newAssignments: Record<string, string> = {};

    for (const agent of toImport) {
      const role = validRoles.has(agent.role as typeof AGENT_ROLES[number])
        ? (agent.role as typeof AGENT_ROLES[number])
        : "general";
      const newAgent = await agentSvc.create(project.companyId, {
        name: `${agent.personaName}`,
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
        scopedToWorkspaceId: workspaceId,
        metadata: {
          bmad: {
            slug: agent.slug,
            commandName: agent.commandName,
            icon: agent.icon,
            roles: [{ slug: agent.slug, personaName: agent.personaName, capabilities: agent.capabilities, icon: agent.icon }],
          },
        },
      });
      created.push(newAgent);
      newAssignments[agent.slug] = newAgent.id;
    }

    // Persist assignments to workspace metadata so LaunchAgentDialog resolves them immediately
    if (workspaceId && Object.keys(newAssignments).length > 0) {
      const existingMeta = (project.primaryWorkspace?.metadata ?? {}) as Record<string, unknown>;
      const existingAssignments = (existingMeta.bmadAssignments as Record<string, string> | undefined) ?? {};
      await svc.updateWorkspace(id, workspaceId, {
        metadata: { ...existingMeta, bmadAssignments: { ...existingAssignments, ...newAssignments } },
      });
    }

    res.status(201).json({ created, assignments: newAssignments });
  });

  // GET /projects/:id/workspace-context/assignments — reads from primary workspace metadata
  router.get("/projects/:id/workspace-context/assignments", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);
    const meta = project.primaryWorkspace?.metadata as Record<string, unknown> | null | undefined;
    const assignments = (meta?.bmadAssignments as Record<string, string> | undefined) ?? {};
    res.json({ assignments, workspaceId: project.primaryWorkspace?.id ?? null });
  });

  // POST /projects/:id/workspace-context/assignments — saves to primary workspace metadata
  router.post("/projects/:id/workspace-context/assignments", async (req, res) => {
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

  // GET /projects/:id/workspace-context/command?name=<commandname> — serves a file from IDE command directories
  router.get("/projects/:id/workspace-context/command", async (req, res) => {
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

  // POST /projects/:id/workspace-context/drift-check — check drift between two workspace artifacts
  router.post("/projects/:id/workspace-context/drift-check", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const { sourceDoc, targetDoc } = req.body as { sourceDoc?: string; targetDoc?: string };
    if (!sourceDoc || !targetDoc) { res.status(400).json({ error: "Missing sourceDoc or targetDoc" }); return; }
    if (sourceDoc.includes("..") || targetDoc.includes("..")) { res.status(400).json({ error: "Invalid path" }); return; }

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.status(404).json({ error: "No workspace path configured" }); return; }

    const wsBase = path.resolve(workspacePath);
    const absSource = path.resolve(workspacePath, sourceDoc);
    const absTarget = path.resolve(workspacePath, targetDoc);

    if (!absSource.startsWith(wsBase) || !absTarget.startsWith(wsBase)) {
      res.status(400).json({ error: "Paths must be within the workspace" }); return;
    }

    const report = await checkDrift(project.id, absSource, absTarget);
    res.json(report);
  });

  // GET /projects/:id/workspace-context/file?path=<relative-path> — raw markdown content
  router.get("/projects/:id/workspace-context/file", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const filePath = req.query.path;
    if (typeof filePath !== "string" || filePath.length === 0) throw badRequest("Missing required query parameter: path");
    if (filePath.includes("..") || filePath.startsWith("/")) throw badRequest("Invalid path: must be relative and cannot contain '..'");

    const workspacePath = await resolveWorkspacePath(id);
    if (!workspacePath) { res.status(404).json({ error: "No workspace path configured for this project" }); return; }

    // filePath is always relative to workspace root (config-driven or legacy)
    const fullPath = path.resolve(workspacePath, filePath);
    if (!fullPath.startsWith(path.resolve(workspacePath) + path.sep)) throw badRequest("Path must be within the workspace");

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      res.type("text/markdown").send(content);
    } catch {
      res.status(404).json({ error: "File not found" });
    }
  });

  return router;
}
