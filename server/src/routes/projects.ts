import { Router, type Request } from "express";
import type { Db } from "@mnm/db";
import {
  createProjectSchema,
  createProjectWorkspaceSchema,
  isUuidLike,
  updateProjectSchema,
  updateProjectWorkspaceSchema,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { projectService, issueService, logActivity } from "../services/index.js";
import { conflict } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function projectRoutes(db: Db) {
  const router = Router();
  const svc = projectService(db);

  async function resolveCompanyIdForProjectReference(req: Request) {
    const companyIdQuery = req.query.companyId;
    const requestedCompanyId =
      typeof companyIdQuery === "string" && companyIdQuery.trim().length > 0
        ? companyIdQuery.trim()
        : null;
    if (requestedCompanyId) {
      assertCompanyAccess(req, requestedCompanyId);
      return requestedCompanyId;
    }
    if (req.actor.type === "agent" && req.actor.companyId) {
      return req.actor.companyId;
    }
    return null;
  }

  async function normalizeProjectReference(req: Request, rawId: string) {
    if (isUuidLike(rawId)) return rawId;
    const companyId = await resolveCompanyIdForProjectReference(req);
    if (!companyId) return rawId;
    const resolved = await svc.resolveByReference(companyId, rawId);
    if (resolved.ambiguous) {
      throw conflict("Project shortname is ambiguous in this company. Use the project ID.");
    }
    return resolved.project?.id ?? rawId;
  }

  router.param("id", async (req, _res, next, rawId) => {
    try {
      req.params.id = await normalizeProjectReference(req, rawId);
      next();
    } catch (err) {
      next(err);
    }
  });

  router.get("/companies/:companyId/projects", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId);
    res.json(result);
  });

  router.get("/projects/:id", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, project.companyId);
    res.json(project);
  });

  router.post("/companies/:companyId/projects", validate(createProjectSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    type CreateProjectPayload = Parameters<typeof svc.create>[1] & {
      workspace?: Parameters<typeof svc.createWorkspace>[1];
    };

    const { workspace, ...projectData } = req.body as CreateProjectPayload;
    const project = await svc.create(companyId, projectData);
    let createdWorkspaceId: string | null = null;
    if (workspace) {
      const createdWorkspace = await svc.createWorkspace(project.id, workspace);
      if (!createdWorkspace) {
        await svc.remove(project.id);
        res.status(422).json({ error: "Invalid project workspace payload" });
        return;
      }
      createdWorkspaceId = createdWorkspace.id;
    }
    const hydratedProject = workspace ? await svc.getById(project.id) : project;

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      details: {
        name: project.name,
        workspaceId: createdWorkspaceId,
      },
    });
    res.status(201).json(hydratedProject ?? project);
  });

  router.patch("/projects/:id", validate(updateProjectSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const project = await svc.update(id, req.body);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: project.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.updated",
      entityType: "project",
      entityId: project.id,
      details: req.body,
    });

    res.json(project);
  });

  router.post("/projects/:id/onboard", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);

    const workspacePath = project.primaryWorkspace?.cwd;
    if (!workspacePath) {
      res.status(400).json({ error: "No local workspace configured for this project" });
      return;
    }

    const agentId = typeof req.body.agentId === "string" ? req.body.agentId : null;
    const actor = getActorInfo(req);
    const issueSvc = issueService(db);

    const workspaceId = project.primaryWorkspace?.id ?? null;
    const mnmApiUrl = process.env.MNM_API_URL ?? "$MNM_API_URL";

    // Pre-fill the exact API calls so the agent can't miss the scopedToWorkspaceId field
    const scopeClause = workspaceId
      ? `  "scopedToWorkspaceId": "${workspaceId}"   ← REQUIRED — this scopes the agent to THIS project only`
      : `  "scopedToWorkspaceId": "<workspace-id>"   ← REQUIRED — fetch the workspace ID first`;
    const wsClause = workspaceId
      ? `  "workspaceId": "${workspaceId}",`
      : `  "workspaceId": "<workspace-id>",`;

    const description = [
      `# Workspace Onboarding — ${project.name}`,
      ``,
      `## Context`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| Workspace path | \`${workspacePath}\` |`,
      `| Project ID | \`${id}\` |`,
      `| Company ID | \`${project.companyId}\` |`,
      workspaceId
        ? `| Workspace ID | \`${workspaceId}\` |`
        : `| Workspace ID | run \`GET ${mnmApiUrl}/api/projects/${id}/workspaces\` to get it |`,
      `| MnM API base | \`${mnmApiUrl}\` |`,
      `| Auth header | \`Authorization: Bearer $MNM_API_KEY\` |`,
      ``,
      `---`,
      ``,
      `## Goal`,
      ``,
      `**Leave the user with a fully operational AI-assisted development workflow for this project.**`,
      ``,
      `Concretely, by the end of this task:`,
      `- Every agent that works on this project is **scoped** to workspace \`${workspaceId ?? "<workspace-id>"}\``,
      `  (scoped = only visible inside this project, not polluting the global agent list)`,
      `- Each workflow/role is **assigned** to the right agent in MnM so the user can launch them directly from the cockpit`,
      `- The user knows exactly what to do next`,
      ``,
      `---`,
      ``,
      `## Phase 1 — Explore`,
      ``,
      `Read \`${workspacePath}\`. Start with a full directory listing, then inspect:`,
      `- **Agentic frameworks**: BMAD (\`_bmad-output/\`, \`.claude/commands/\`, \`_bmad/\`), custom Claude Code setups, agent persona files`,
      `- **Project structure**: README, package.json / pyproject.toml / Cargo.toml, config files, tech stack`,
      `- **Existing automation**: scripts, CI/CD, Makefile, custom tooling`,
      ``,
      `Be specific — name every relevant file you find.`,
      ``,
      `---`,
      ``,
      `## Phase 2A — Framework found → Map it`,
      ``,
      `If you found an existing agentic framework, map it to MnM immediately.`,
      ``,
      `### Step 1 — Create scoped agents`,
      ``,
      `For each agent role/persona discovered, call:`,
      ``,
      `\`\`\`http`,
      `POST ${mnmApiUrl}/api/companies/${project.companyId}/agents`,
      `Authorization: Bearer $MNM_API_KEY`,
      `Content-Type: application/json`,
      ``,
      `{`,
      `  "name": "<persona name, e.g. Analyst Mary>",`,
      `  "role": "<closest MnM role: ceo | cto | engineer | pm | qa | general>",`,
      `  "adapterType": "claude_local",`,
      scopeClause,
      `}`,
      `\`\`\``,
      ``,
      `> ⚠️ **CRITICAL**: \`scopedToWorkspaceId\` must be \`"${workspaceId ?? "<workspace-id>"}"\` on EVERY agent you create.`,
      `> Without it the agent is global and leaks into every other project's agent list.`,
      `> The create call will succeed silently without it — do not omit it.`,
      ``,
      `Save each returned agent \`id\` — you need them for the next step.`,
      ``,
      `### Step 2 — Save workflow assignments`,
      ``,
      `\`\`\`http`,
      `POST ${mnmApiUrl}/api/projects/${id}/workspace-context/assignments`,
      `Authorization: Bearer $MNM_API_KEY`,
      `Content-Type: application/json`,
      ``,
      `{`,
      wsClause,
      `  "assignments": {`,
      `    "<workflow-slug-1>": "<agent-id-1>",`,
      `    "<workflow-slug-2>": "<agent-id-2>"`,
      `  }`,
      `}`,
      `\`\`\``,
      ``,
      `### Step 3 — Confirm`,
      ``,
      `List every agent you created (name + MnM ID) and every assignment saved.`,
      `Then tell the user their exact next step (which agent to run first and on what task).`,
      ``,
      `---`,
      ``,
      `## Phase 2B — No framework found → Propose`,
      ``,
      `If no agentic framework is detected, say so clearly and present this choice:`,
      ``,
      `---`,
      `**Which workflow do you want for this project?**`,
      ``,
      `**[A] BMAD** — Battle-tested multi-agent dev framework.`,
      `Roles: CEO (orchestrator), Dev, Scrum Master, QA, Architect.`,
      `Best for structured product development with epics, stories, and planning artifacts.`,
      ``,
      `**[B] Custom** — Tell me what you need and we'll build it together step by step.`,
      ``,
      `Reply with **A** or **B** and I'll set it up immediately.`,
      ``,
      `---`,
      ``,
      `## Phase 3 — Install (only if Phase 2B, after user replies)`,
      ``,
      `### User chose [A] BMAD:`,
      ``,
      `1. Search online for the official BMAD GitHub repo and read its quickstart/installation guide`,
      `2. Create the BMAD file structure inside \`${workspacePath}\`:`,
      `   - \`_bmad-output/planning-artifacts/\``,
      `   - \`_bmad-output/implementation-artifacts/\``,
      `   - \`.claude/commands/\` — copy the BMAD workflow and persona \`.md\` files`,
      `3. Create a scoped MnM agent for each BMAD role (CEO, Dev, SM, QA, Architect) — **with \`scopedToWorkspaceId: "${workspaceId ?? "<workspace-id>"}"\` on each one**`,
      `4. Save their assignments`,
      `5. Tell the user: which agent to talk to first, and what to ask it (e.g. "Ask the CEO agent to create your product brief")`,
      ``,
      `### User chose [B] Custom:`,
      ``,
      `Ask:`,
      `- What roles/agents do you need?`,
      `- What does a typical work session look like?`,
      `- What tools and processes do you use?`,
      ``,
      `Then create the agents (**scoped**), save the assignments, and confirm.`,
    ].join("\n");

    const issue = await issueSvc.create(project.companyId, {
      title: `Workspace discovery — ${project.name}`,
      description,
      status: "todo",
      priority: "medium",
      projectId: id,
      assigneeAgentId: agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      createdByAgentId: actor.agentId ?? null,
      requestDepth: 0,
    });

    res.status(201).json({ issueId: issue.id, identifier: issue.identifier });
  });

  router.get("/projects/:id/workspaces", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const workspaces = await svc.listWorkspaces(id);
    res.json(workspaces);
  });

  router.post("/projects/:id/workspaces", validate(createProjectWorkspaceSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const workspace = await svc.createWorkspace(id, req.body);
    if (!workspace) {
      res.status(422).json({ error: "Invalid project workspace payload" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.workspace_created",
      entityType: "project",
      entityId: id,
      details: {
        workspaceId: workspace.id,
        name: workspace.name,
        cwd: workspace.cwd,
        isPrimary: workspace.isPrimary,
      },
    });

    res.status(201).json(workspace);
  });

  router.patch(
    "/projects/:id/workspaces/:workspaceId",
    validate(updateProjectWorkspaceSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const workspaceId = req.params.workspaceId as string;
      const existing = await svc.getById(id);
      if (!existing) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      assertCompanyAccess(req, existing.companyId);
      const workspaceExists = (await svc.listWorkspaces(id)).some((workspace) => workspace.id === workspaceId);
      if (!workspaceExists) {
        res.status(404).json({ error: "Project workspace not found" });
        return;
      }
      const workspace = await svc.updateWorkspace(id, workspaceId, req.body);
      if (!workspace) {
        res.status(422).json({ error: "Invalid project workspace payload" });
        return;
      }

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "project.workspace_updated",
        entityType: "project",
        entityId: id,
        details: {
          workspaceId: workspace.id,
          changedKeys: Object.keys(req.body).sort(),
        },
      });

      res.json(workspace);
    },
  );

  router.delete("/projects/:id/workspaces/:workspaceId", async (req, res) => {
    const id = req.params.id as string;
    const workspaceId = req.params.workspaceId as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const workspace = await svc.removeWorkspace(id, workspaceId);
    if (!workspace) {
      res.status(404).json({ error: "Project workspace not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.workspace_deleted",
      entityType: "project",
      entityId: id,
      details: {
        workspaceId: workspace.id,
        name: workspace.name,
      },
    });

    res.json(workspace);
  });

  router.delete("/projects/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const project = await svc.remove(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: project.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.deleted",
      entityType: "project",
      entityId: project.id,
    });

    res.json(project);
  });

  return router;
}
