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

## Your context

| | |
|--|--|
| Workspace | \`${workspacePath}\` |
| Project ID | \`${id}\` |
| Company ID | \`${project.companyId}\` |
| Workspace ID | \`${wsId}\` |
| MnM API | \`${mnmApiUrl}\` |
| Auth | \`Authorization: Bearer $MNM_API_KEY\` |

---

## What you are doing

You are setting up MnM for this project. MnM is a cockpit for AI-assisted development — it shows the project's context, manages agents, and lets the user launch workflows from a single UI.

Your job is to read this workspace and translate whatever you find into three MnM constructs:
1. **Scoped agents** — AI roles specific to this project
2. **Workflow assignments** — which agent handles which task
3. **Context panel** — the project's documents and stories, visible in the cockpit's left pane

The workspace may use any framework (BMAD, open-specs, raw Claude Code, custom YAML, plain Markdown, nothing at all). **Do not assume any specific structure.** Discover what's actually there.

---

## STEP 1 — Explore the workspace

Do a thorough read of \`${workspacePath}\`. You are looking for four categories of content:

### A — Agent/role definitions
Anything that describes an AI persona, role, or assistant. Could be:
- Markdown files named like \`*agent*\`, \`*persona*\`, \`*role*\`, \`*assistant*\`
- YAML/JSON configs that define an AI agent (name, capabilities, instructions)
- System prompt files or instruction files
- Cursor rules, Windsurf rules, Claude memory files, or equivalent
- Comments in code that describe what agent runs what

For each one found: what is its name, what role does it play, what does it do?

### B — Workflow/command definitions
Anything that describes a repeatable task or process. Could be:
- Command files (\`.claude/commands/\`, \`.cursor/\`, \`.windsurf/\`, or any \`commands/\` directory)
- Makefile targets, npm scripts, shell scripts that describe a workflow
- CI/CD pipeline steps or stages
- README sections like "How to run X" or "Workflow for Y"
- Any structured process definition file

For each one found: what is the workflow name/slug, what does it do, which role should run it?

### C — Project context and documentation
Anything that describes what this project is, what it should do, or how it is built. Could be:
- README, product brief, PRD, architecture doc, technical spec
- User stories, epics, feature definitions
- API documentation, design docs, ADRs
- Any Markdown, PDF, or structured doc that explains the project

For each one found: what is it, where is it, what does it cover?

### D — Test and acceptance definitions
Anything that describes expected behavior or acceptance criteria. Could be:
- Gherkin \`.feature\` files (BDD)
- Test plan Markdown files
- Acceptance criteria sections inside story files
- \`__tests__\`, \`spec/\`, \`tests/\` directories with descriptive test names
- Any "Definition of Done" or "AC" documents

For each one found: what feature/story does it cover, what are the key criteria?

List everything you found under each category before proceeding.

---

## STEP 2 — Create scoped agents

### What a scoped MnM agent is

A scoped agent is visible ONLY inside this project's cockpit. Without \`scopedToWorkspaceId\`, the agent becomes global and pollutes every other project's agent list. **The API accepts the call silently without it — this has already caused a problem in a previous run. Do not omit it.**

For every agent role / persona you found in Step 1 category A, create one MnM agent:

\`\`\`bash
curl -s -X POST "${mnmApiUrl}/api/companies/${project.companyId}/agents" \\
  -H "Authorization: Bearer $MNM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "<name from the persona/role definition>",
    "role": "<pick the closest: ceo | cto | engineer | pm | qa | general>",
    "adapterType": "claude_local",
    "scopedToWorkspaceId": "${wsId}"
  }'
\`\`\`

Role mapping: orchestrator/lead/manager → \`ceo\`, tech lead/architect → \`cto\`, developer → \`engineer\`, product/analyst/UX → \`pm\`, QA/tester → \`qa\`, everything else → \`general\`.

**Save the returned \`id\` for each agent** — needed in Step 3.

If you found NO agent definitions: create one \`general\` scoped agent named after the project (e.g. "\`${project.name} Agent\`") as a placeholder.

---

## STEP 3 — Save workflow assignments

### What workflow assignments are

A workflow assignment tells MnM: "when the user launches workflow X, use agent Y". This powers the "Launch agent" button in the cockpit.

A **slug** is a short identifier for a workflow. Derive it from what you found:
- If the workflow file has a frontmatter \`agentRole:\` or \`slug:\` field, use that value
- Otherwise use the filename without extension, lowercased and hyphenated
- For Makefile targets or npm scripts, use the target/script name

Save all assignments in one call (this replaces the full map):

\`\`\`bash
curl -s -X POST "${mnmApiUrl}/api/projects/${id}/workspace-context/assignments" \\
  -H "Authorization: Bearer $MNM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "${wsId}",
    "assignments": {
      "<workflow-slug>": "<agent-id-from-step-2>",
      "<workflow-slug>": "<agent-id-from-step-2>"
    }
  }'
\`\`\`

If you found NO workflow definitions: create one assignment \`"default": "<agent-id>"\` pointing to the agent from Step 2.

---

## STEP 4 — Populate the Context panel

### What the Context panel is

The left pane of the MnM cockpit displays the project's planning documents and implementation structure. It reads directly from the **filesystem** at \`${workspacePath}/_bmad-output/\`. It is not a database field — you populate it by creating files on disk.

Structure it expects:

\`\`\`
_bmad-output/
  planning-artifacts/          ← PLANNING section of the panel
    <any-name>.md              ← Each .md = one card. Title = first # H1.
    <group-name>/              ← Subdirectory = visual group in the panel
      <any-name>.md
  implementation-artifacts/    ← EPICS section of the panel
    <epicN>-<storyN>-<slug>.md ← e.g. 1-1-user-login.md, 2-3-search.md
    sprint-status.yaml         ← optional: { statuses: { "1-1-*": "in-progress" } }
\`\`\`

File naming rules:
- Planning: any \`.md\` with a \`# Title\` H1. Name prefix hints the type: \`product-brief*\` → brief, \`prd*\` → PRD, \`architecture*\` → arch, others → doc.
- Stories: **must** start with \`{epicNumber}-{storyNumber}-\`. The \`## Status\` section sets status: \`backlog | ready-for-dev | in-progress | review | done\`.

### What to create

Using what you found in Step 1 categories C and D:

**For planning-artifacts**: for each document/spec/PRD/architecture file you found — copy its content into a new \`.md\` file inside \`_bmad-output/planning-artifacts/\`. If documents are grouped (e.g., by epic, by feature, by module), create subdirectories that reflect the grouping. Make sure each file starts with a \`# Title\` H1.

**For implementation-artifacts**: for each user story, epic, or feature definition you found — create a \`{e}-{s}-{slug}.md\` file. If the original has acceptance criteria, include them under a \`## Acceptance Criteria\` section. Add a \`## Status\` section with the current status. If you cannot determine epic/story numbers, start at 1-1, 1-2, etc.

If the workspace already has a \`_bmad-output/\` directory (or any directory that looks like output artifacts — \`bmad_output/\`, \`output/\`, \`artifacts/\`, \`docs/\`), use its content as the source. Adapt the structure to match the format above if needed.

If you find nothing useful for context: create at minimum a \`planning-artifacts/project-overview.md\` with a \`# ${project.name}\` title and a one-paragraph description of the project based on what you read in the workspace.

---

## DELIVER

After all four steps, reply with:

**Agents** — table: name | MnM ID | role | scoped ✓/✗
**Workflows** — table: slug | assigned agent name
**Context panel** — list every file created in \`_bmad-output/\`, or confirm existing files were found
**What to do now** — one specific action (which agent, which workflow, what to ask)

---

## If the workspace is truly empty

If you find absolutely nothing, tell the user and present two options:

**[A] Install a framework** — Available: BMAD (battle-tested multi-agent dev framework: CEO, Dev, SM, QA, Architect roles). I will fetch the official docs, install it in this workspace, create the agents and assignments, and populate the context panel.

**[B] Build custom** — Describe your workflow and I'll build it: agents, assignments, and context panel from scratch.

Reply A or B.`;


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
