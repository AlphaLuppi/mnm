import { Router, type Request } from "express";
import type { Db } from "@mnm/db";
import { issues as issuesTable } from "@mnm/db";
import { eq } from "drizzle-orm";
import {
  createProjectSchema,
  createProjectWorkspaceSchema,
  isUuidLike,
  updateProjectSchema,
  updateProjectWorkspaceSchema,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission, assertCompanyPermission } from "../middleware/require-permission.js";
import { emitAudit, projectService, issueService, agentService, heartbeatService, logActivity } from "../services/index.js";
import { conflict } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { getScopeProjectIds } from "../services/scope-filter.js";

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

    // PROJ-S03: Scope filtering -- only show projects the user is a member of
    const scopeProjectIds = await getScopeProjectIds(db, companyId, req);

    if (scopeProjectIds !== null) {
      if (scopeProjectIds.length === 0) {
        res.json([]);
        return;
      }
      const result = await svc.listByIds(companyId, scopeProjectIds);
      res.json(result);
      return;
    }

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

  router.post("/companies/:companyId/projects", requirePermission(db, "projects:create"), validate(createProjectSchema), async (req, res) => {
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

    await emitAudit({
      req, db, companyId,
      action: "project.created",
      targetType: "project",
      targetId: project.id,
      metadata: { name: project.name },
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
    await assertCompanyPermission(db, req, existing.companyId, "projects:create");
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

    await emitAudit({
      req, db, companyId: project.companyId,
      action: "project.updated",
      targetType: "project",
      targetId: project.id,
      metadata: { changedFields: Object.keys(req.body) },
    });

    res.json(project);
  });

  router.post("/projects/:id/onboard", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    assertCompanyAccess(req, project.companyId);
    await assertCompanyPermission(db, req, project.companyId, "projects:create");

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

For each one found, record: **slug** (short id you will reuse), **name** (display name), **role** (what it does).

### B — Workflow/command definitions
Anything that describes a repeatable task or process. Could be:
- Command files (\`.claude/commands/\`, \`.cursor/\`, \`.windsurf/\`, or any \`commands/\` directory)
- Makefile targets, npm scripts, shell scripts that describe a workflow
- CI/CD pipeline steps or stages
- README sections like "How to run X" or "Workflow for Y"
- Any structured process definition file

For each one found, record: **slug** (short id you will reuse), **what it does**, and crucially **which agent slug from category A should run it**. If the workflow file contains a frontmatter field like \`agentRole:\` or \`agent:\`, use that value to identify the responsible agent. If there is no explicit field, infer from context (a "run tests" workflow -> QA agent, a "write code" workflow -> dev agent, etc.).

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

Before proceeding, output two explicit tables:

**Agent table (Step 1A)**
| Slug | Name | Role description |
|------|------|-----------------|
| ... | ... | ... |

**Workflow table (Step 1B)**
| Slug | Description | Responsible agent slug |
|------|------------|----------------------|
| ... | ... | ... |

These tables are your contract for Steps 2 and 3. Every row must be filled.

---

## STEP 2 — Create scoped agents

### What a scoped MnM agent is

A scoped agent is visible ONLY inside this project's cockpit. Without \`scopedToWorkspaceId\`, the agent becomes global and pollutes every other project's agent list. **The API accepts the call silently without it — this has already caused a problem in a previous run. Do not omit it.**

### Rules — non-negotiable

Take your **Agent table from Step 1A**. For EVERY row — no exceptions, no skips — call the API below and fill in the returned MnM ID:

| Slug (from 1A) | Agent name | MnM ID (returned by API) |
|----------------|-----------|--------------------------|
| (copy rows from Step 1A table) | | |

\`\`\`bash
curl -s -X POST "${mnmApiUrl}/api/companies/${project.companyId}/agents" \\
  -H "Authorization: Bearer $MNM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "<name from the Agent table>",
    "role": "<pick the closest: ceo | cto | engineer | pm | qa | general>",
    "adapterType": "claude_local",
    "scopedToWorkspaceId": "${wsId}"
  }'
\`\`\`

Role mapping: orchestrator/lead/manager -> \`ceo\`, tech lead/architect -> \`cto\`, developer -> \`engineer\`, product/analyst/UX -> \`pm\`, QA/tester -> \`qa\`, everything else -> \`general\`.

If you found NO agent definitions: create one \`general\` scoped agent named after the project (e.g. "\`${project.name} Agent\`") as a placeholder, with slug \`default\`.

**Do not continue to Step 3 until every slug in the Agent table has a MnM ID.**

---

## STEP 3 — Save workflow assignments

### What workflow assignments are

A workflow assignment tells MnM: "when the user launches workflow X, use agent Y". This powers the "Launch agent" button in the cockpit.

### How to build the assignments map

Take your two tables from Step 1:

1. **From the Agent table (1A):** for each row, add \`"<agent-slug>": "<MnM-ID-from-step-2>"\`. This registers the agent itself so the cockpit can launch it directly.

2. **From the Workflow table (1B):** for each row, look up the "Responsible agent slug" column -> find that slug in your Step 2 table -> use its MnM ID. Add \`"<workflow-slug>": "<MnM-ID>"\`.

3. **Verify before sending:** count your rows. You must have exactly (number of agents in 1A) + (number of workflows in 1B) entries. No row from either table may be missing. No value may be empty or null.

A **slug** is the short identifier you recorded in Step 1. Rules:
- If the file has a frontmatter \`agentRole:\`, \`slug:\`, or \`name:\` field, use that value exactly
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
      "<slug>": "<MnM-agent-ID>",
      "<slug>": "<MnM-agent-ID>"
    }
  }'
\`\`\`

If you found NO workflow definitions: the assignments map only contains the agent slugs from Step 1A.

---

## STEP 4 — Populate the Context panel

### What the Context panel is

The left pane of the MnM cockpit shows planning documents and stories/epics for the project. It reads the **real files of the project** — no copying, no duplication. You configure it by writing a single mapping file: \`_mnm-context/config.yaml\`.

MnM reads this config at request time and loads the actual files directly from their real paths. The panel stays in sync automatically as the project files evolve.

### Format of \`_mnm-context/config.yaml\`

\`\`\`yaml
# _mnm-context/config.yaml
# Paths are relative to the workspace root: ${workspacePath}

planning:
  - path: README.md               # any .md file anywhere in the project
    type: product-brief           # product-brief | prd | architecture | epics | document
  - path: docs/prd.md
    type: prd
    group: specs                  # optional: visual group label in the panel
  - path: docs/architecture.md
    type: architecture

stories:
  - path: epics/1-1-user-auth.md  # real file path — no renaming required
    epic: 1
    story: 1
    epicTitle: Authentication     # optional: displayed as the epic heading
  - path: epics/1-2-user-profile.md
    epic: 1
    story: 2

sprint_status:                    # optional
  path: .bmad/sprint-status.yaml  # or wherever your status file lives
\`\`\`

Type hint rules: \`product-brief*\` -> brief, \`prd*\` -> PRD, \`architecture*\` -> arch, others -> doc.
Story status is read from a \`Status: <value>\` line in the story file itself (\`backlog | ready-for-dev | in-progress | review | done\`).

### What to write

Using what you found in Step 1 (categories C and D):

1. For each planning document (PRD, spec, README, architecture…) — add an entry under \`planning:\` pointing to the real file.
2. For each story/epic/feature definition — add an entry under \`stories:\` with the real path and assign an epic + story number (start at 1-1 if numbering is unclear).
3. If you found a sprint/status file, add it under \`sprint_status:\`.
4. Write the config to \`_mnm-context/config.yaml\`.

**Do NOT copy or duplicate file contents.** Only write the mapping config.

If there are no planning or story files yet: write a minimal config with at least \`- path: README.md\` under planning (create README.md if it does not exist), so the panel shows something.

---

## DELIVER

After all four steps, reply with:

**Agents** — table: name | MnM ID | role | scoped (yes/no)
**Assignments** — table: slug | assigned agent name | MnM agent ID (every slug listed — agents AND workflows)
**Coverage check** — confirm: "X agent slugs found, X assigned. Y workflow slugs found, Y assigned. 0 gaps."
**Context panel** — list every \`path:\` entry written in \`config.yaml\`
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

    if (agentId) {
      const heartbeat = heartbeatService(db);
      void heartbeat.wakeup(agentId, {
        source: "assignment",
        triggerDetail: "system",
        reason: "issue_assigned",
        payload: { issueId: issue.id, mutation: "create" },
        requestedByActorType: actor.actorType,
        requestedByActorId: actor.actorId,
        contextSnapshot: { issueId: issue.id, source: "issue.create" },
      }).catch((err) => console.error("Failed to wake agent on discovery:", err));
    }

    await emitAudit({
      req, db, companyId: project.companyId,
      action: "project.onboarded",
      targetType: "project",
      targetId: id,
      metadata: {},
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
    await assertCompanyPermission(db, req, existing.companyId, "projects:create");
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

    await emitAudit({
      req, db, companyId: existing.companyId,
      action: "project.workspace_created",
      targetType: "project",
      targetId: id,
      metadata: { workspacePath: workspace.cwd },
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
      await assertCompanyPermission(db, req, existing.companyId, "projects:create");
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

      await emitAudit({
        req, db, companyId: existing.companyId,
        action: "project.workspace_updated",
        targetType: "project",
        targetId: id,
        metadata: { workspaceId: workspace.id },
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
    await assertCompanyPermission(db, req, existing.companyId, "projects:create");
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

    await emitAudit({
      req, db, companyId: existing.companyId,
      action: "project.workspace_deleted",
      targetType: "project",
      targetId: id,
      metadata: { workspaceId: workspace.id },
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
    await assertCompanyPermission(db, req, existing.companyId, "projects:create");

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

    // 2. Delete all issues belonging to this project (including hidden ones)
    const projectIssueIds = await db
      .select({ id: issuesTable.id })
      .from(issuesTable)
      .where(eq(issuesTable.projectId, id));
    for (const { id: issueId } of projectIssueIds) {
      await issueSvc.remove(issueId);
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

    await emitAudit({
      req, db, companyId: project.companyId,
      action: "project.deleted",
      targetType: "project",
      targetId: project.id,
      metadata: { name: project.name },
      severity: "warning",
    });

    res.json(project);
  });

  return router;
}
