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
import { projectService, issueService, agentService, logActivity } from "../services/index.js";
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

    const wsId = workspaceId ?? "<workspace-id-not-found>";

    const description = `# Workspace Onboarding — ${project.name}

## Fixed context (do not modify these values)

| | |
|--|--|
| Workspace path | \`${workspacePath}\` |
| Project ID | \`${id}\` |
| Company ID | \`${project.companyId}\` |
| Workspace ID | \`${wsId}\` |
| MnM API | \`${mnmApiUrl}\` |
| Auth | \`Authorization: Bearer $MNM_API_KEY\` |

---

## What you must deliver — three things

Do them in order. Do not stop after any one step.

---

## STEP 1 — Scoped Agents

### What "scoped agent" means in MnM

MnM agents are AI assistants that run tasks. An agent can be:
- **Global**: visible across ALL projects in MnM (pollutes the global list)
- **Scoped**: exclusive to ONE project's workspace (what you want here)

Scoping is controlled by the \`scopedToWorkspaceId\` field. **Every agent you create MUST have \`"scopedToWorkspaceId": "${wsId}"\`.** The API accepts the request without it (no error), but the agent will silently become global. This has already caused problems in a previous run — don't repeat it.

### What to discover

Read \`${workspacePath}\` recursively. Look for:
- Agent persona files: \`.claude/commands/bmad-agent-*.md\`, \`_bmad/agents/\`, or any \`*agent*.md\` / \`*persona*.md\`
- Each persona = one MnM agent to create
- Also note the agent's role (CEO, developer, PM, QA, etc.) to pick the right MnM role

### How to create each agent

\`\`\`bash
curl -s -X POST "${mnmApiUrl}/api/companies/${project.companyId}/agents" \\
  -H "Authorization: Bearer $MNM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "<persona name, e.g. Analyst Mary>",
    "role": "<ceo | cto | engineer | pm | qa | general>",
    "adapterType": "claude_local",
    "scopedToWorkspaceId": "${wsId}"
  }'
\`\`\`

**Save the \`"id"\` field from each response** — you need it in Step 2.

The \`role\` field maps as follows: orchestrator/manager → \`ceo\`, architect/tech lead → \`cto\`, developer → \`engineer\`, product manager/analyst → \`pm\`, QA/tester → \`qa\`, everything else → \`general\`.

---

## STEP 2 — Workflow Assignments

### What workflow assignments are in MnM

The MnM cockpit has a "Launch agent" button. When a user clicks it on a story or document, MnM needs to know **which agent to use for which workflow**. That mapping is the "workflow assignments" — a dictionary of \`{ workflowSlug: agentId }\`.

### What to discover

In the workspace, workflows are defined by files in \`.claude/commands/\`. Look for files that are NOT agent personas (i.e., not \`bmad-agent-*.md\`). Each of these is a workflow definition.

For each workflow file:
1. Read its YAML frontmatter (the \`---\` block at the top)
2. The **slug** is the \`agentRole\` field in the frontmatter, or the filename without extension if \`agentRole\` is absent
3. Determine which agent (from Step 1) handles this workflow based on content and role

Example: \`bmad-dev-story.md\` with frontmatter \`agentRole: bmad-dev-story\` → slug is \`bmad-dev-story\` → assign to the Developer agent ID from Step 1.

### How to save all assignments in one call

\`\`\`bash
curl -s -X POST "${mnmApiUrl}/api/projects/${id}/workspace-context/assignments" \\
  -H "Authorization: Bearer $MNM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "${wsId}",
    "assignments": {
      "<slug-1>": "<agent-id-from-step-1>",
      "<slug-2>": "<agent-id-from-step-1>",
      "<slug-3>": "<agent-id-from-step-1>"
    }
  }'
\`\`\`

This replaces the full map — include ALL slugs you found in one call.

---

## STEP 3 — Context Panel (left pane of the MnM cockpit)

### What the Context panel is

The left panel of the MnM cockpit displays the project's documents and implementation structure. It is NOT a database field — it reads directly from the **filesystem** inside \`${workspacePath}/_bmad-output/\`.

The panel shows two sections:

**PLANNING section** — reads \`_bmad-output/planning-artifacts/\`:
- Each \`.md\` file = one document card (title taken from the first \`# H1\` in the file)
- Subdirectories = groups (e.g., \`etape-1/prd.md\` → group "etape-1", card "prd")
- Files are typed by name: \`product-brief*\` → brief, \`prd*\` → PRD, \`architecture*\` → arch, others → doc

**EPICS section** — reads \`_bmad-output/implementation-artifacts/\`:
- Each \`.md\` file must follow the naming pattern: \`{epicNum}-{storyNum}-{slug}.md\`
  Example: \`1-1-user-auth.md\`, \`1-2-login-form.md\`, \`2-1-dashboard.md\`
- The first \`# H1\` in each file = story title
- Status is read from a \`## Status\` section with values: \`backlog\`, \`ready-for-dev\`, \`in-progress\`, \`review\`, \`done\`
- An optional \`_bmad-output/implementation-artifacts/sprint-status.yaml\` can override statuses

### What to do

**Case A — \`_bmad-output/\` or equivalent already exists in the workspace:**

Check if the directory \`${workspacePath}/_bmad-output/\` exists. If it does, the Context panel should already work — do nothing, just confirm.

If you find a similarly named directory (e.g., \`bmad_output/\`, \`_bmad-output/\`, \`bmad-output/\`) that contains planning or implementation artifacts:
1. Create \`${workspacePath}/_bmad-output/\` (exact name, with leading underscore and hyphen)
2. Create \`planning-artifacts/\` and \`implementation-artifacts/\` subdirectories inside it
3. Copy or symlink the relevant files from the existing directory into the correct structure

**Case B — No output directory found:**

Create the structure from existing content:
1. Create \`${workspacePath}/_bmad-output/planning-artifacts/\`
2. For each major document found in the workspace (README, architecture doc, spec, brief), create a corresponding \`.md\` file in \`planning-artifacts/\` with a \`# Title\` H1 and the content
3. If there are existing stories or task lists, create corresponding \`{e}-{s}-*.md\` files in \`_bmad-output/implementation-artifacts/\`
4. If no content exists yet, create placeholder stubs so the panel shows something

After creating the files, the panel will refresh automatically on the next page load.

---

## DELIVER

After completing all three steps, reply with a structured summary:

### Agents created
List each: name | MnM ID | role | scoped to \`${wsId}\` ✓

### Workflow assignments saved
List each: slug → agent name

### Context panel
What is now visible in the left panel, or what files were created/missing.

### Next step
The single most important thing the user should do right now (be specific: which agent to open, what to ask it).

---

## If no framework found at all

If you find NO agentic framework and NO content to populate the context panel, say so clearly and present:

**[A] Install BMAD** — Fetch the official BMAD docs online, set it up in this workspace, create scoped agents for CEO/Dev/SM/QA/Architect, populate \`_bmad-output/\`, save assignments. Then tell the user their first step.

**[B] Custom workflow** — Ask what roles they need, what a typical session looks like, what tools they use. Build it together, then create the agents (scoped), assignments, and context files.

Reply with A or B.`;


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

    // Cascade: delete scoped agents and issues before removing the project.
    // The DB schema does not define onDelete cascade for agents (no FK) or issues
    // (nullable FK with no action), so we handle it explicitly here.
    const agentSvc = agentService(db);
    const issueSvc = issueService(db);

    // 1. Delete agents scoped to any of this project's workspaces
    const workspaces = await svc.listWorkspaces(id);
    for (const workspace of workspaces) {
      const allAgents = await agentSvc.list(existing.companyId, { workspaceId: workspace.id, includeScoped: true });
      for (const agent of allAgents.filter((a) => a.scopedToWorkspaceId === workspace.id)) {
        await agentSvc.remove(agent.id);
      }
    }

    // 2. Delete all issues belonging to this project
    const projectIssues = await issueSvc.list(existing.companyId, { projectId: id });
    for (const issue of projectIssues) {
      await issueSvc.remove(issue.id);
    }

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
