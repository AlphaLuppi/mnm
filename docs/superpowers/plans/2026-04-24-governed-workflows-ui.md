# Governed Workflows UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 React pages (list / editor / runs / run detail) + 10 REST endpoints + 3 new MCP tools (createGovernedWorkflow / updateGovernedWorkflow / archiveGovernedWorkflow) for Governed Workflows, and nuke the entire legacy Workflows feature (5 DB tables, 12 server files, 8 UI files, xstate dep, dead permissions) so Governed becomes MnM's single workflow standard — usable identically via UI, REST, and MCP.

**Architecture:** Git canonical (workflow.json lives in the company's `mnm-<company>-workflows` GitLab repo), DB `governed_workflow_definitions` acts as a lightweight list cache. Editor uses Monaco with live zod validation; Save = `commitFile` on `main` + auto-computed semver tag. Runs execute client-side via Claude Code harness; the run-detail page subscribes to SSE live events for step/gate updates.

**Tech Stack:** Express + Drizzle + Postgres (RLS) on the server side, React 18 + Vite + TanStack Query + React Router + shadcn/ui + Monaco on the UI side, bun workspaces monorepo.

**Spec reference:** `docs/superpowers/specs/2026-04-24-governed-workflows-ui-design.md`

---

## File structure

### Created

**DB migrations:**
- `packages/db/src/migrations/0066_nuke_legacy_workflows.sql` — drop 5 legacy tables + legacy FK columns on `traces`/`compaction_snapshots` + add `archived_at` on `governed_workflow_definitions`.
- `packages/db/src/migrations/0066_nuke_legacy_workflows.test.ts` — file-content assertions on the SQL above.

**Server (routes + services + MCP):**
- `server/src/routes/governed-workflows-ui.ts` — 10 REST endpoints.
- `server/src/routes/__tests__/governed-workflows-ui.test.ts` — endpoint tests.
- `server/src/services/governed-workflows-extensions.ts` — helpers `computeNextTag`, `saveDefinition`, `archiveDefinition`, `listRuns`, `getRunWithSteps`. Kept in a sibling file rather than bloating `governed-workflows.ts`.
- `server/src/services/__tests__/governed-workflows-extensions.test.ts` — unit tests for helpers.
- `server/src/realtime/emitters/governed-run-events.ts` — emission helpers `emitStepUpdated`, `emitGateEvaluated`.
- `server/src/realtime/emitters/__tests__/governed-run-events.test.ts` — emission tests.
- Additions to `server/src/mcp/tools/governed-workflows.tool.ts` (existing file): 3 new tools `createGovernedWorkflow`, `updateGovernedWorkflow`, `archiveGovernedWorkflow`.
- Additions to `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts`: tests for the 3 new tools.

**UI:**
- `ui/src/api/governed-workflows.ts` — API client.
- `ui/src/hooks/useGovernedRunEvents.ts` — SSE live-events subscriber.
- `ui/src/pages/GovernedWorkflowsList.tsx`
- `ui/src/pages/GovernedWorkflowEditor.tsx`
- `ui/src/pages/GovernedWorkflowRuns.tsx`
- `ui/src/pages/GovernedWorkflowRunDetail.tsx`
- `ui/src/pages/__tests__/GovernedWorkflowsList.test.tsx`
- `ui/src/pages/__tests__/GovernedWorkflowEditor.test.tsx`
- `ui/src/pages/__tests__/GovernedWorkflowRuns.test.tsx`
- `ui/src/pages/__tests__/GovernedWorkflowRunDetail.test.tsx`
- `ui/src/hooks/__tests__/useGovernedRunEvents.test.ts`

**Shared:**
- `packages/shared/src/types/governed-workflows-rows.ts` — `GovernedWorkflowDefinitionRow`, `GovernedRunRow`, `GovernedStepExecutionRow`, `GateResultRow`.

### Modified

- `packages/db/src/schema/index.ts` — remove 5 legacy exports.
- `packages/db/src/schema/traces.ts` — drop `workflow_instance_id` + `stage_instance_id`.
- `packages/db/src/schema/compaction_snapshots.ts` — drop `workflow_instance_id` + `stage_id`.
- `server/src/app.ts` — unmount legacy routes, mount `governed-workflows-ui`.
- `server/src/services/index.ts` — remove legacy service exports.
- `server/src/mcp/build-mcp-services.ts` — remove legacy workflowService usage.
- `server/src/services/governed-workflows.ts` — wire emission calls in `launchStep` / `completeStep` + gate runner.
- `server/package.json` — remove `xstate` dep.
- `ui/package.json` — add `@monaco-editor/react` and `monaco-editor`.
- `ui/src/App.tsx` — delete legacy routes, add governed routes, remove legacy imports.
- `ui/src/lib/nav-registry.ts` — drop `cursors` entry, keep `workflows` + `workflow-editor` slots (re-point `workflow-editor` to `/workflows/new`).
- `ui/src/lib/queryKeys.ts` — add `governedWorkflows` namespace.
- `packages/shared/src/types/view-preset.ts` — drop `cursors` from `NavItemId` union.
- `packages/shared/src/contracts/permissions.ts` — drop `WORKFLOWS_DELETE` + `WORKFLOWS_MANAGE`.
- `scripts/parity/data.ts` — add new domain `governed-workflows` with 4 features.

### Deleted

**Server:**
- `server/src/routes/workflows.ts`
- `server/src/routes/orchestrator.ts`
- `server/src/routes/stages.ts`
- `server/src/routes/compaction.ts`
- `server/src/services/workflows.ts`
- `server/src/services/workflow-enforcer.ts`
- `server/src/services/workflow-state-machine.ts`
- `server/src/services/orchestrator.ts`
- `server/src/services/stages.ts`
- `server/src/services/compaction-watcher.ts`
- `server/src/services/compaction-reinjection.ts`
- `server/src/services/compaction-kill-relaunch.ts`
- And every `__tests__` file sibling to those.

**UI:**
- `ui/src/pages/Workflows.tsx`
- `ui/src/pages/WorkflowEditor.tsx`
- `ui/src/pages/WorkflowDetail.tsx`
- `ui/src/pages/WorkflowTraces.tsx`
- `ui/src/pages/NewWorkflow.tsx`
- `ui/src/pages/AutomationCursors.tsx`
- `ui/src/api/workflows.ts`
- `ui/src/components/traces/WorkflowTimeline.tsx`

**DB schema:**
- `packages/db/src/schema/workflow_templates.ts`
- `packages/db/src/schema/workflow_instances.ts`
- `packages/db/src/schema/stage_instances.ts`
- `packages/db/src/schema/workflow_stage_config_layers.ts`
- `packages/db/src/schema/workflow_template_stage_layers.ts`

---

# Tranche U1 — Nuke legacy workflows

Goal: zero legacy workflow code left in the repo, all typechecks green, app boots cleanly. One commit at the end (atomic).

### Task U1.1: Pre-flight audit

**Files:** none modified — read-only.

- [ ] **Step 1: Enumerate the exact list of files to delete**

Run: `ls -1 server/src/routes/{workflows,orchestrator,stages,compaction}.ts server/src/services/{workflows,workflow-enforcer,workflow-state-machine,orchestrator,stages,compaction-watcher,compaction-reinjection,compaction-kill-relaunch}.ts ui/src/pages/{Workflows,WorkflowEditor,WorkflowDetail,WorkflowTraces,NewWorkflow,AutomationCursors}.tsx ui/src/api/workflows.ts ui/src/components/traces/WorkflowTimeline.tsx packages/db/src/schema/{workflow_templates,workflow_instances,stage_instances,workflow_stage_config_layers,workflow_template_stage_layers}.ts 2>/dev/null`

Expected: every path exists. If any is missing, mark it so we don't try to delete it in later tasks.

- [ ] **Step 2: Read `packages/db/src/schema/traces.ts` and note the exact column names/constraints for `workflow_instance_id` + `stage_instance_id`**

Record the exact column definition syntax (nullable? references?). We need this to generate matching `ALTER TABLE` statements.

- [ ] **Step 3: Read `packages/db/src/schema/compaction_snapshots.ts` and note `workflow_instance_id` + `stage_id` column syntax**

Same as above.

- [ ] **Step 4: Record findings inline — no commit**

Write a tiny note at the top of the next task's migration file stating the exact columns/constraints discovered. Don't commit yet — Task U1.2 creates that file.

### Task U1.2: Write migration test (failing)

**Files:**
- Create: `packages/db/src/migrations/0066_nuke_legacy_workflows.test.ts`

- [ ] **Step 1: Write the failing test file**

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "./0066_nuke_legacy_workflows.sql"),
  "utf8",
);

describe("0066_nuke_legacy_workflows migration", () => {
  it("drops the 5 legacy workflow tables", () => {
    expect(sql).toMatch(/DROP TABLE IF EXISTS "stage_instances" CASCADE/);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "workflow_stage_config_layers" CASCADE/);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "workflow_template_stage_layers" CASCADE/);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "workflow_instances" CASCADE/);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "workflow_templates" CASCADE/);
  });

  it("nullifies legacy traces FKs before dropping the columns", () => {
    expect(sql).toMatch(
      /ALTER TABLE "traces" ALTER COLUMN "stage_instance_id" DROP NOT NULL/,
    );
    expect(sql).toMatch(/UPDATE "traces" SET "workflow_instance_id" = NULL, "stage_instance_id" = NULL/);
    expect(sql).toMatch(/ALTER TABLE "traces" DROP COLUMN IF EXISTS "workflow_instance_id"/);
    expect(sql).toMatch(/ALTER TABLE "traces" DROP COLUMN IF EXISTS "stage_instance_id"/);
  });

  it("drops legacy columns from compaction_snapshots", () => {
    expect(sql).toMatch(
      /ALTER TABLE "compaction_snapshots" DROP COLUMN IF EXISTS "workflow_instance_id"/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "compaction_snapshots" DROP COLUMN IF EXISTS "stage_id"/,
    );
  });

  it("adds archived_at column to governed_workflow_definitions", () => {
    expect(sql).toMatch(
      /ALTER TABLE "governed_workflow_definitions" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz/,
    );
  });

  it("creates a partial index on (company_id, enabled) filtering archived rows", () => {
    expect(sql).toMatch(
      /CREATE INDEX .*"governed_workflow_definitions_company_enabled_active_idx".*ON "governed_workflow_definitions".*\("company_id", "enabled"\).*WHERE "archived_at" IS NULL/s,
    );
  });

  it("does NOT drop the traces table itself", () => {
    expect(sql).not.toMatch(/DROP TABLE IF EXISTS "traces"/);
  });
});
```

- [ ] **Step 2: Run and verify the test fails**

Run: `cd packages/db && bun test src/migrations/0066_nuke_legacy_workflows.test.ts`
Expected: FAIL — `ENOENT: no such file or directory ... 0066_nuke_legacy_workflows.sql`

### Task U1.3: Write migration SQL

**Files:**
- Create: `packages/db/src/migrations/0066_nuke_legacy_workflows.sql`

- [ ] **Step 1: Author the SQL file**

```sql
-- Nuke the legacy workflows feature. Governed Workflows becomes the sole workflow
-- abstraction in MnM. Spec: docs/superpowers/specs/2026-04-24-governed-workflows-ui-design.md
-- Depends on: 0065 (governed workflow tables already exist).
-- Note: MnM is pre-deployment, so we accept full data loss on legacy workflow rows.

-- 1. Release traces FKs to legacy workflow rows, then drop the columns.
ALTER TABLE "traces" ALTER COLUMN "stage_instance_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "traces" SET "workflow_instance_id" = NULL, "stage_instance_id" = NULL;--> statement-breakpoint
ALTER TABLE "traces" DROP COLUMN IF EXISTS "workflow_instance_id";--> statement-breakpoint
ALTER TABLE "traces" DROP COLUMN IF EXISTS "stage_instance_id";--> statement-breakpoint

-- 2. Clean up compaction_snapshots — plain UUID columns without FK constraints.
ALTER TABLE "compaction_snapshots" DROP COLUMN IF EXISTS "workflow_instance_id";--> statement-breakpoint
ALTER TABLE "compaction_snapshots" DROP COLUMN IF EXISTS "stage_id";--> statement-breakpoint

-- 3. Drop the 5 legacy tables. CASCADE releases any remaining FK/index dependency.
DROP TABLE IF EXISTS "stage_instances" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_stage_config_layers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_template_stage_layers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_instances" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_templates" CASCADE;--> statement-breakpoint

-- 4. Optional enums — drop if they exist, ignore if absent.
DROP TYPE IF EXISTS "workflow_stage_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "workflow_instance_status" CASCADE;--> statement-breakpoint

-- 5. Add archived_at to governed_workflow_definitions + partial index.
ALTER TABLE "governed_workflow_definitions"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamptz NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "governed_workflow_definitions_company_enabled_active_idx"
  ON "governed_workflow_definitions" ("company_id", "enabled")
  WHERE "archived_at" IS NULL;--> statement-breakpoint
```

- [ ] **Step 2: Run the migration test, verify it passes**

Run: `cd packages/db && bun test src/migrations/0066_nuke_legacy_workflows.test.ts`
Expected: PASS — all 6 assertions green.

### Task U1.4: Delete legacy server services + routes

**Files:**
- Delete: 8 legacy services + 4 legacy route files (see File structure / Deleted).

- [ ] **Step 1: Delete the files**

```bash
rm server/src/routes/workflows.ts server/src/routes/orchestrator.ts server/src/routes/stages.ts server/src/routes/compaction.ts
rm server/src/services/workflows.ts server/src/services/workflow-enforcer.ts server/src/services/workflow-state-machine.ts server/src/services/orchestrator.ts server/src/services/stages.ts server/src/services/compaction-watcher.ts server/src/services/compaction-reinjection.ts server/src/services/compaction-kill-relaunch.ts
rm -f server/src/routes/__tests__/workflows.test.ts server/src/routes/__tests__/orchestrator.test.ts server/src/routes/__tests__/stages.test.ts server/src/routes/__tests__/compaction.test.ts
rm -f server/src/services/__tests__/workflows.test.ts server/src/services/__tests__/workflow-enforcer.test.ts server/src/services/__tests__/workflow-state-machine.test.ts server/src/services/__tests__/orchestrator.test.ts server/src/services/__tests__/stages.test.ts server/src/services/__tests__/compaction-watcher.test.ts server/src/services/__tests__/compaction-reinjection.test.ts server/src/services/__tests__/compaction-kill-relaunch.test.ts
```

- [ ] **Step 2: Verify deletions**

Run: `ls server/src/routes/{workflows,orchestrator,stages,compaction}.ts server/src/services/{workflows,workflow-enforcer,workflow-state-machine,orchestrator,stages,compaction-watcher,compaction-reinjection,compaction-kill-relaunch}.ts 2>&1 | grep -c "No such file"`
Expected: `12` (all missing).

### Task U1.5: Remove server wiring of legacy code

**Files:**
- Modify: `server/src/app.ts`
- Modify: `server/src/services/index.ts`
- Modify: `server/src/mcp/build-mcp-services.ts`

- [ ] **Step 1: Edit `server/src/app.ts` — remove legacy imports + route mounts**

Open the file, find the imports block at the top and delete these lines:
```typescript
import { workflowRoutes } from "./routes/workflows.js";
import { orchestratorRoutes } from "./routes/orchestrator.js";
import { stageRoutes } from "./routes/stages.js";
import { compactionRoutes } from "./routes/compaction.js";
```
(Only delete lines that actually exist — use grep first: `grep -n "workflowRoutes\|orchestratorRoutes\|stageRoutes\|compactionRoutes" server/src/app.ts`.)

Find and delete every `app.use(...)` line that mounts one of those routers (search: `grep -n "workflowRoutes\|orchestratorRoutes\|stageRoutes\|compactionRoutes" server/src/app.ts`).

- [ ] **Step 2: Edit `server/src/services/index.ts` — remove 7 legacy exports**

Remove these exports (some may not be present — remove only what exists):
```typescript
export { workflowService } from "./workflows.js";
export { stageService } from "./stages.js";
export { orchestratorService } from "./orchestrator.js";
export { workflowEnforcerService } from "./workflow-enforcer.js";
export { compactionWatcherService } from "./compaction-watcher.js";
export { compactionKillRelaunchService } from "./compaction-kill-relaunch.js";
export { compactionReinjectionService } from "./compaction-reinjection.js";
```

- [ ] **Step 3: Edit `server/src/mcp/build-mcp-services.ts` — remove legacy workflowService usage**

Run: `grep -n "workflowService\|workflowEnforcer\|orchestrator\|stageService\|compaction" server/src/mcp/build-mcp-services.ts`
For each line returned (only the ones referring to legacy names, NOT governed), delete that line. Keep anything referring to `governedWorkflow*`.

- [ ] **Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: errors in places that still import from `./routes/workflows` etc. If any remain, fix them (they should be covered by the edits above; if a test file you didn't delete still imports, delete that test file too).

### Task U1.6: Delete legacy UI pages + api client + component

**Files:**
- Delete: 8 UI files (see File structure / Deleted).

- [ ] **Step 1: Delete the files**

```bash
rm ui/src/pages/Workflows.tsx ui/src/pages/WorkflowEditor.tsx ui/src/pages/WorkflowDetail.tsx ui/src/pages/WorkflowTraces.tsx ui/src/pages/NewWorkflow.tsx ui/src/pages/AutomationCursors.tsx
rm ui/src/api/workflows.ts
rm ui/src/components/traces/WorkflowTimeline.tsx
rm -f ui/src/pages/__tests__/Workflows.test.tsx ui/src/pages/__tests__/WorkflowEditor.test.tsx ui/src/pages/__tests__/WorkflowDetail.test.tsx ui/src/pages/__tests__/WorkflowTraces.test.tsx ui/src/pages/__tests__/NewWorkflow.test.tsx ui/src/pages/__tests__/AutomationCursors.test.tsx
```

- [ ] **Step 2: Edit `ui/src/App.tsx` — remove legacy imports and routes**

Run: `grep -n "Workflows\|WorkflowEditor\|WorkflowDetail\|WorkflowTraces\|NewWorkflow\|AutomationCursors\|automation-cursors" ui/src/App.tsx`

Delete every import line that matches and every `<Route>` whose `element` refers to one of the deleted components. Leave the rest of the file untouched — we'll add the new routes in U5.

- [ ] **Step 3: Verify no dead imports**

Run: `grep -rn "from.*pages/Workflows\|from.*pages/WorkflowEditor\|from.*pages/WorkflowDetail\|from.*pages/WorkflowTraces\|from.*pages/NewWorkflow\|from.*pages/AutomationCursors\|from.*api/workflows\|from.*WorkflowTimeline" ui/src/`
Expected: empty output.

### Task U1.7: Delete legacy DB schema files

**Files:**
- Delete: 5 schema files.
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/schema/traces.ts`
- Modify: `packages/db/src/schema/compaction_snapshots.ts`

- [ ] **Step 1: Delete schema files**

```bash
rm packages/db/src/schema/workflow_templates.ts packages/db/src/schema/workflow_instances.ts packages/db/src/schema/stage_instances.ts packages/db/src/schema/workflow_stage_config_layers.ts packages/db/src/schema/workflow_template_stage_layers.ts
```

- [ ] **Step 2: Edit `packages/db/src/schema/index.ts` — remove 5 legacy exports**

Run: `grep -n "workflow_templates\|workflow_instances\|stage_instances\|workflow_stage_config_layers\|workflow_template_stage_layers" packages/db/src/schema/index.ts`

Delete each matching export line.

- [ ] **Step 3: Edit `packages/db/src/schema/traces.ts` — remove legacy columns**

Find and delete the column declarations for `workflow_instance_id` and `stage_instance_id` (exact names from Task U1.1 notes). Also remove any FK references pointing to `workflowInstances` or `stageInstances`.

- [ ] **Step 4: Edit `packages/db/src/schema/compaction_snapshots.ts` — remove legacy columns**

Delete column declarations for `workflow_instance_id` and `stage_id`.

- [ ] **Step 5: Run typecheck on db package**

Run: `cd packages/db && bun run typecheck`
Expected: PASS.

### Task U1.8: Retrait xstate dep + nav cleanup

**Files:**
- Modify: `server/package.json`
- Modify: `ui/src/lib/nav-registry.ts`
- Modify: `packages/shared/src/types/view-preset.ts`

- [ ] **Step 1: Remove `xstate` from `server/package.json`**

Run: `grep '"xstate"' server/package.json`
If a match is found, open the file and delete that line from the `dependencies` object. Verify with `grep '"xstate"' server/package.json` → empty.

- [ ] **Step 2: Re-install to drop from lockfile**

Run: `bun install`
Expected: bun removes xstate from the lockfile.

- [ ] **Step 3: Edit `ui/src/lib/nav-registry.ts` — remove `cursors` entry**

Open the file, delete this line:
```typescript
cursors:           { to: "/automation-cursors",   icon: SlidersHorizontal,   label: "Cursors",          permission: "workflows:enforce" },
```

Also delete the `SlidersHorizontal` import if it's only used by `cursors` (grep to confirm).

Update `workflow-editor` entry — change `to: "/workflow-editor/new"` to `to: "/workflows/new"`:
```typescript
"workflow-editor": { to: "/workflows/new",  icon: PenTool, label: "Workflow Editor",  permission: "workflows:create" },
```

- [ ] **Step 4: Edit `packages/shared/src/types/view-preset.ts` — drop `cursors` from `NavItemId` union**

Run: `grep -n '"cursors"' packages/shared/src/types/view-preset.ts`
Open the file, delete the `"cursors"` string literal from the `NavItemId` union type (usually on line 4-10).

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

### Task U1.9: Permissions cleanup

**Files:**
- Modify: `packages/shared/src/contracts/permissions.ts`
- Modify: `server/src/services/permission-seed.ts` (if it references the dropped keys)

- [ ] **Step 1: Edit `packages/shared/src/contracts/permissions.ts`**

Delete these two lines (around lines 55, 57):
```typescript
WORKFLOWS_DELETE: "workflows:delete",
WORKFLOWS_MANAGE: "workflows:manage",
```

Also remove any occurrence of `workflows:delete` or `workflows:manage` inside `PERMISSION_META` or `ALL_PERMISSION_SLUGS` derived from the object.

- [ ] **Step 2: Check `permission-seed.ts` for references to the dropped slugs**

Run: `grep -n "workflows:delete\|workflows:manage\|WORKFLOWS_DELETE\|WORKFLOWS_MANAGE" server/src/services/permission-seed.ts`

For each match, delete the matching line (in VIEWER_PERMS / CONTRIBUTOR_PERMS / MAINTAINER_PERMS / ADMIN_PERMS arrays).

- [ ] **Step 3: Typecheck + run unit tests**

Run: `bun run typecheck && bun run test --filter='!e2e'`
Expected: PASS (13/13 typecheck, all unit tests green).

### Task U1.10: Commit U1

- [ ] **Step 1: Review the diff**

Run: `git status && git diff --stat`
Expected: ~25 files deleted, ~8 files modified, 2 new migration files.

- [ ] **Step 2: Stage & commit**

```bash
git add -A
git -c commit.gpgsign=false commit -m "refactor(workflows): nuke legacy workflows, governed becomes sole standard

Removes the entire legacy Workflows feature (5 DB tables, 12 server files, 8 UI files, xstate dep, 2 dead permissions, AutomationCursors page) so Governed Workflows becomes MnM's single workflow abstraction. MnM is pre-deployment — no data migration needed.

Adds archived_at column + partial index to governed_workflow_definitions in the same migration (needed by U2 archive endpoint)."
git push
```

---

# Tranche U2 — REST endpoints + service extensions

Goal: 10 REST endpoints under `/api/companies/:companyId/governed-workflows/*` backed by helper methods in a new extensions service. All tests green.

### Task U2.1: Shared row types

**Files:**
- Create: `packages/shared/src/types/governed-workflows-rows.ts`
- Modify: `packages/shared/src/index.ts` (or relevant barrel)

- [ ] **Step 1: Create the types file**

```typescript
// packages/shared/src/types/governed-workflows-rows.ts
export type GovernedRunStatus = "draft" | "active" | "completed" | "failed";
export type GovernedStepState =
  | "pending"
  | "running"
  | "gate_eval"
  | "succeeded"
  | "failed";
export type GateKind = "entry" | "exit" | string;

export interface GovernedWorkflowDefinitionRow {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  latestGitTag: string | null;
  enabled: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GovernedRunRow {
  id: string;
  companyId: string;
  workflowDefId: string;
  workflowGitTag: string;
  workflowGitSha: string;
  initiatedByActorType: "user" | "agent" | "system";
  initiatedByActorId: string;
  status: GovernedRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  paramsJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GovernedStepExecutionRow {
  id: string;
  companyId: string;
  runId: string;
  stepIdInJson: string;
  state: GovernedStepState;
  startedAt: string | null;
  completedAt: string | null;
  artifactsJson: Record<string, unknown> | null;
  launchedByActorType: "user" | "agent" | "system" | null;
  launchedByActorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GateResultRow {
  id: string;
  companyId: string;
  runId: string;
  stepExecId: string;
  gateIdInJson: string;
  kind: GateKind;
  pass: boolean;
  report: string;
  errorCode: string | null;
  hints: string[];
  gateGitSha: string;
  evaluatedAt: string;
}
```

- [ ] **Step 2: Re-export from the shared barrel**

Find the barrel that exports other types (grep: `grep -rn "export \*.*types" packages/shared/src/index.ts`) and add:
```typescript
export * from "./types/governed-workflows-rows.js";
```
If it's a named-export style, add each interface explicitly.

- [ ] **Step 3: Typecheck**

Run: `cd packages/shared && bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git -c commit.gpgsign=false commit -m "feat(workflows): shared row types for governed workflow DB rows"
git push
```

### Task U2.2: `computeNextTag` helper (TDD)

**Files:**
- Create: `server/src/services/__tests__/governed-workflows-extensions.test.ts`
- Create: `server/src/services/governed-workflows-extensions.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/services/__tests__/governed-workflows-extensions.test.ts
import { describe, expect, it } from "vitest";
import { computeNextTag } from "../governed-workflows-extensions.js";

describe("computeNextTag", () => {
  it("returns v0.0.1 when no prior tag exists", () => {
    expect(computeNextTag({ workflowName: "hello", existingTags: [] })).toBe(
      "hello/v0.0.1",
    );
  });

  it("bumps patch of the highest existing semver tag", () => {
    expect(
      computeNextTag({
        workflowName: "hello",
        existingTags: ["hello/v0.0.1", "hello/v0.0.2", "hello/v0.0.3"],
      }),
    ).toBe("hello/v0.0.4");
  });

  it("ignores tags from other workflows", () => {
    expect(
      computeNextTag({
        workflowName: "hello",
        existingTags: ["other/v9.9.9", "hello/v0.1.5"],
      }),
    ).toBe("hello/v0.1.6");
  });

  it("skips malformed tags", () => {
    expect(
      computeNextTag({
        workflowName: "hello",
        existingTags: ["hello/v0.1.5", "hello/garbage", "hello/v0.0.1"],
      }),
    ).toBe("hello/v0.1.6");
  });

  it("considers minor and major correctly when picking the max", () => {
    expect(
      computeNextTag({
        workflowName: "hello",
        existingTags: [
          "hello/v0.0.10",
          "hello/v0.1.0",
          "hello/v1.0.0",
          "hello/v0.2.9",
        ],
      }),
    ).toBe("hello/v1.0.1");
  });
});
```

Run: `bun test server/src/services/__tests__/governed-workflows-extensions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Create the impl file**

```typescript
// server/src/services/governed-workflows-extensions.ts
export interface ComputeNextTagArgs {
  workflowName: string;
  existingTags: string[]; // raw tag names like "hello/v1.2.3"
}

const SEMVER_RE = /^v(\d+)\.(\d+)\.(\d+)$/;

export function computeNextTag({
  workflowName,
  existingTags,
}: ComputeNextTagArgs): string {
  const prefix = `${workflowName}/`;
  const versions = existingTags
    .filter((t) => t.startsWith(prefix))
    .map((t) => t.slice(prefix.length))
    .map((v) => SEMVER_RE.exec(v))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({
      major: Number(m[1]),
      minor: Number(m[2]),
      patch: Number(m[3]),
    }));

  if (versions.length === 0) return `${prefix}v0.0.1`;

  versions.sort((a, b) => {
    if (a.major !== b.major) return b.major - a.major;
    if (a.minor !== b.minor) return b.minor - a.minor;
    return b.patch - a.patch;
  });

  const latest = versions[0];
  return `${prefix}v${latest.major}.${latest.minor}.${latest.patch + 1}`;
}
```

- [ ] **Step 3: Run tests, verify green**

Run: `bun test server/src/services/__tests__/governed-workflows-extensions.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/governed-workflows-extensions.ts server/src/services/__tests__/governed-workflows-extensions.test.ts
git -c commit.gpgsign=false commit -m "feat(workflows): computeNextTag semver bump helper"
git push
```

### Task U2.3: `saveDefinition` service method (TDD)

**Files:**
- Modify: `server/src/services/governed-workflows-extensions.ts`
- Modify: `server/src/services/__tests__/governed-workflows-extensions.test.ts`

- [ ] **Step 1: Add the failing test**

Append to the test file:

```typescript
import type { GitProvider } from "@mnm/git-provider";

function makeMockGitProvider(overrides: Partial<GitProvider> = {}): GitProvider {
  return {
    fetchBlob: async () => { throw new Error("not mocked"); },
    listTags: async () => [],
    resolveRef: async () => "deadbeef",
    pathExists: async () => false,
    commitFile: async () => ({ sha: "abc123" }),
    ...overrides,
  };
}

describe("saveDefinition", () => {
  it("commits workflow.json on main, creates next tag, returns new tag", async () => {
    const commits: Array<Record<string, unknown>> = [];
    const git = makeMockGitProvider({
      listTags: async () => [
        { name: "hello/v0.0.1", sha: "111" },
        { name: "hello/v0.0.2", sha: "222" },
      ],
      commitFile: async (args) => {
        commits.push(args);
        if (args.path.endsWith(".tag")) return { sha: "tagsha" };
        return { sha: "commitsha" };
      },
    });

    const { saveDefinition } = await import("../governed-workflows-extensions.js");

    const res = await saveDefinition({
      gitProvider: git,
      workflowName: "hello",
      definitionJson: { apiVersion: "mnm/v1", kind: "GovernedWorkflow", name: "hello", steps: [] },
      commitMessage: "feat(hello): test",
      authorName: "Tom",
      authorEmail: "tom@example.com",
    });

    expect(res.newGitTag).toBe("hello/v0.0.3");
    expect(res.commitSha).toBe("commitsha");
    expect(commits[0]).toMatchObject({
      path: "hello/workflow.json",
      branch: "main",
      authorName: "Tom",
      authorEmail: "tom@example.com",
    });
  });
});
```

Run: `bun test server/src/services/__tests__/governed-workflows-extensions.test.ts`
Expected: FAIL — `saveDefinition is not exported`.

- [ ] **Step 2: Implement `saveDefinition`**

Append to `server/src/services/governed-workflows-extensions.ts`:

```typescript
import type { GitProvider } from "@mnm/git-provider";

export interface SaveDefinitionArgs {
  gitProvider: GitProvider;
  workflowName: string;
  definitionJson: unknown;
  commitMessage: string;
  authorName: string;
  authorEmail: string;
  branch?: string;
}

export interface SaveDefinitionResult {
  commitSha: string;
  newGitTag: string;
}

export async function saveDefinition({
  gitProvider,
  workflowName,
  definitionJson,
  commitMessage,
  authorName,
  authorEmail,
  branch = "main",
}: SaveDefinitionArgs): Promise<SaveDefinitionResult> {
  const content = JSON.stringify(definitionJson, null, 2);
  const path = `${workflowName}/workflow.json`;
  const commit = await gitProvider.commitFile({
    path,
    content,
    message: commitMessage,
    branch,
    authorName,
    authorEmail,
  });

  const tags = await gitProvider.listTags({ prefix: `${workflowName}/v` });
  const newGitTag = computeNextTag({
    workflowName,
    existingTags: tags.map((t) => t.name),
  });

  // For MVP: create a tag by committing a sentinel .tag file alongside,
  // then rely on GitlabProvider to actually create the tag via its API.
  // The GitProvider interface doesn't expose createTag yet — add it as a
  // follow-up OR extend `commitFile` semantics. For the MVP we store the
  // intended tag in the commit message and let the backend create it via
  // a new `gitProvider.createTag` call introduced in the next task if
  // needed. See plan U2.4.
  // TODO-resolved-in-U2.4: wire createTag call here.

  return { commitSha: commit.sha, newGitTag };
}
```

Run the tests — expected PASS for the assertions above (the createTag call is stubbed until U2.4).

- [ ] **Step 3: Commit**

```bash
git add server/src/services/governed-workflows-extensions.ts server/src/services/__tests__/governed-workflows-extensions.test.ts
git -c commit.gpgsign=false commit -m "feat(workflows): saveDefinition commits workflow.json and computes next tag"
git push
```

### Task U2.4: Extend `GitProvider` with `createTag` + wire it in `saveDefinition`

**Files:**
- Modify: `packages/git-provider/src/types.ts`
- Modify: `packages/git-provider/src/gitlab-provider.ts`
- Modify: `packages/git-provider/src/local-bare-repo-provider.ts`
- Modify: `packages/git-provider/src/__tests__/*` — add tests for createTag
- Modify: `server/src/services/governed-workflows-extensions.ts` — remove the TODO, call `createTag`

- [ ] **Step 1: Write failing test for `LocalBareRepoProvider.createTag`**

In the existing local-bare-repo-provider test file (grep to find: `find packages/git-provider/src/__tests__ -name "*local*"`), add:

```typescript
it("creates an annotated tag on a branch head", async () => {
  // Setup: commit a file on main, then createTag pointing at HEAD
  await provider.commitFile({
    path: "README.md",
    content: "hi",
    message: "init",
    branch: "main",
    authorName: "t",
    authorEmail: "t@x.y",
  });
  const { sha } = await provider.createTag({ name: "hello/v0.0.1", ref: "main" });
  expect(sha).toMatch(/^[0-9a-f]{7,40}$/);
  const tags = await provider.listTags({ prefix: "hello/" });
  expect(tags.map((t) => t.name)).toContain("hello/v0.0.1");
});
```

Run the test file → FAIL (method not defined).

- [ ] **Step 2: Add `createTag` to the `GitProvider` interface**

Edit `packages/git-provider/src/types.ts`, append:

```typescript
export interface CreateTagArgs {
  name: string;
  ref: string; // branch or sha to point the tag at
  message?: string;
}

export interface CreateTagResult {
  sha: string;
}

// and inside GitProvider interface:
// createTag(args: CreateTagArgs): Promise<CreateTagResult>;
```

Also add the signature inside the `GitProvider` interface.

- [ ] **Step 3: Implement `createTag` in `LocalBareRepoProvider`**

Open `packages/git-provider/src/local-bare-repo-provider.ts` and add a method using `git tag <name> <sha>` (look at how `commitFile` shells out to `git` — replicate the pattern). Use `execSync` or the same helper the file already relies on.

- [ ] **Step 4: Implement `createTag` in `GitlabProvider`**

Open `packages/git-provider/src/gitlab-provider.ts` — add a method that calls `POST /projects/:id/repository/tags` with body `{ tag_name, ref, message }`. Follow the error-handling pattern of `commitFile` in the same file (retry/backoff + closed-set error codes).

- [ ] **Step 5: Run all git-provider tests**

Run: `cd packages/git-provider && bun test`
Expected: all pre-existing tests + the new one PASS.

- [ ] **Step 6: Wire `createTag` in `saveDefinition`**

Edit `server/src/services/governed-workflows-extensions.ts` — replace the TODO section with:

```typescript
const tagResult = await gitProvider.createTag({
  name: newGitTag,
  ref: branch,
  message: commitMessage,
});
// optional: log tagResult.sha for audit
```

Ensure the earlier test still passes by extending the mock: add `createTag: async () => ({ sha: "tagsha" })` to `makeMockGitProvider`.

- [ ] **Step 7: Commit**

```bash
git add packages/git-provider/ server/src/services/governed-workflows-extensions.ts server/src/services/__tests__/governed-workflows-extensions.test.ts
git -c commit.gpgsign=false commit -m "feat(git-provider): add createTag + wire into saveDefinition"
git push
```

### Task U2.5: `archiveDefinition` + `listRuns` + `getRunWithSteps` (TDD, grouped)

**Files:**
- Modify: `server/src/services/governed-workflows-extensions.ts`
- Modify: `server/src/services/__tests__/governed-workflows-extensions.test.ts`

- [ ] **Step 1: Write failing tests (one per helper, sharing a DB mock)**

Append to the test file:

```typescript
import { randomUUID } from "node:crypto";

function makeDbStub(initial: Record<string, unknown[]> = {}) {
  const tables: Record<string, unknown[]> = { ...initial };
  return {
    tables,
    async query<T>(table: string, predicate: (row: T) => boolean): Promise<T[]> {
      return ((tables[table] ?? []) as T[]).filter(predicate);
    },
    async update<T extends { id: string }>(
      table: string,
      id: string,
      patch: Partial<T>,
    ): Promise<void> {
      tables[table] = ((tables[table] ?? []) as T[]).map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      );
    },
  };
}

// Note: production wiring uses Drizzle directly. These tests exercise the
// pure helper logic by passing a minimal interface — the repo-style impl
// in governed-workflows-extensions.ts accepts `db` as a Drizzle instance
// and uses drizzle syntax. Tests below use a thin wrapper. See the real
// tests/integration suite for end-to-end DB coverage in U2.9.
```

For each helper write a dedicated `describe`:

```typescript
describe("archiveDefinition", () => {
  it("sets archived_at and enabled=false, returns the updated row", async () => {
    // TDD: write the assertion first, implement next
  });
});

describe("listRuns", () => {
  it("filters by status and paginates with limit/offset", async () => { /* ... */ });
  it("sorts by started_at desc", async () => { /* ... */ });
});

describe("getRunWithSteps", () => {
  it("returns the run + its steps + gate results grouped per step", async () => { /* ... */ });
});
```

Because these helpers interact with Drizzle, prefer to make them thin wrappers that are easy to integration-test in U2.9. For the unit tests here, assert only the SQL-shape by mocking `db` at the query-builder level (use the pattern already present in `server/src/services/__tests__/governed-workflows.test.ts` if any — grep for `vi.mock.*drizzle` first).

Run: `bun test server/src/services/__tests__/governed-workflows-extensions.test.ts`
Expected: FAIL — the helpers aren't defined yet.

- [ ] **Step 2: Implement the three helpers**

Append to `governed-workflows-extensions.ts`:

```typescript
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { DrizzleClient } from "../db.js"; // adjust to the repo's actual import path
import {
  governedWorkflowDefinitions,
  governedWorkflowRuns,
  governedStepExecutions,
  gateResults,
} from "@mnm/db/schema";

export async function archiveDefinition(
  db: DrizzleClient,
  args: { companyId: string; name: string },
) {
  const [row] = await db
    .update(governedWorkflowDefinitions)
    .set({ archivedAt: new Date(), enabled: false, updatedAt: new Date() })
    .where(
      and(
        eq(governedWorkflowDefinitions.companyId, args.companyId),
        eq(governedWorkflowDefinitions.name, args.name),
      ),
    )
    .returning();
  return row ?? null;
}

export interface ListRunsArgs {
  companyId: string;
  workflowDefId: string;
  status?: "draft" | "active" | "completed" | "failed";
  initiatedByActorId?: string;
  startedAfter?: Date;
  startedBefore?: Date;
  limit?: number;
  offset?: number;
}

export async function listRuns(db: DrizzleClient, args: ListRunsArgs) {
  const conditions = [
    eq(governedWorkflowRuns.companyId, args.companyId),
    eq(governedWorkflowRuns.workflowDefId, args.workflowDefId),
  ];
  if (args.status) conditions.push(eq(governedWorkflowRuns.status, args.status));
  if (args.initiatedByActorId)
    conditions.push(
      eq(governedWorkflowRuns.initiatedByActorId, args.initiatedByActorId),
    );
  if (args.startedAfter)
    conditions.push(gte(governedWorkflowRuns.startedAt, args.startedAfter));
  if (args.startedBefore)
    conditions.push(lte(governedWorkflowRuns.startedAt, args.startedBefore));

  return db
    .select()
    .from(governedWorkflowRuns)
    .where(and(...conditions))
    .orderBy(desc(governedWorkflowRuns.startedAt))
    .limit(args.limit ?? 50)
    .offset(args.offset ?? 0);
}

export async function getRunWithSteps(
  db: DrizzleClient,
  args: { companyId: string; runId: string },
) {
  const [run] = await db
    .select()
    .from(governedWorkflowRuns)
    .where(
      and(
        eq(governedWorkflowRuns.companyId, args.companyId),
        eq(governedWorkflowRuns.id, args.runId),
      ),
    );
  if (!run) return null;

  const steps = await db
    .select()
    .from(governedStepExecutions)
    .where(eq(governedStepExecutions.runId, run.id));

  const gates = await db
    .select()
    .from(gateResults)
    .where(eq(gateResults.runId, run.id));

  return {
    run,
    steps: steps.map((s) => ({
      ...s,
      gateResults: gates
        .filter((g) => g.stepExecId === s.id)
        .sort(
          (a, b) =>
            new Date(a.evaluatedAt).getTime() -
            new Date(b.evaluatedAt).getTime(),
        ),
    })),
  };
}
```

Note: fix the import path for `DrizzleClient` / schema based on what actually exists. Grep: `grep -rn "export type DrizzleClient\|export.*drizzle" server/src/`.

- [ ] **Step 3: Run tests + typecheck**

Run: `bun test server/src/services/__tests__/governed-workflows-extensions.test.ts && cd server && bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/governed-workflows-extensions.ts server/src/services/__tests__/governed-workflows-extensions.test.ts
git -c commit.gpgsign=false commit -m "feat(workflows): archiveDefinition + listRuns + getRunWithSteps helpers"
git push
```

### Task U2.6: Route skeleton + GET list endpoint (TDD)

**Files:**
- Create: `server/src/routes/governed-workflows-ui.ts`
- Create: `server/src/routes/__tests__/governed-workflows-ui.test.ts`

- [ ] **Step 1: Write failing test for `GET /governed-workflows`**

Mirror the structure of existing tests (grep for a route test: `find server/src/routes/__tests__ -name "*.test.ts" | head -3`):

```typescript
// server/src/routes/__tests__/governed-workflows-ui.test.ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { makeTestApp } from "../../__tests__/helpers/make-test-app.js"; // adjust path per repo convention

describe("GET /api/companies/:companyId/governed-workflows", () => {
  it("returns 403 without workflows:read permission", async () => {
    const { app } = await makeTestApp({ permissions: [] });
    const res = await request(app).get(
      "/api/companies/00000000-0000-0000-0000-000000000001/governed-workflows",
    );
    expect(res.status).toBe(403);
  });

  it("returns empty list when company has no definitions", async () => {
    const { app, companyId } = await makeTestApp({
      permissions: ["workflows:read"],
    });
    const res = await request(app).get(
      `/api/companies/${companyId}/governed-workflows`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0 });
  });

  it("returns definitions the company owns", async () => {
    const { app, companyId, seedDefinition } = await makeTestApp({
      permissions: ["workflows:read"],
    });
    await seedDefinition({ name: "hello", description: "demo" });
    const res = await request(app).get(
      `/api/companies/${companyId}/governed-workflows`,
    );
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ name: "hello", description: "demo" });
  });
});
```

Run: `bun test server/src/routes/__tests__/governed-workflows-ui.test.ts`
Expected: FAIL — route file doesn't exist.

Note: the `makeTestApp` helper exists in this codebase — grep `find server/src -name "make-test-app*"` to locate it. If the shape differs, adapt the assertions to match the real helper's API (keep the three scenarios: 403 / empty / 1-row).

- [ ] **Step 2: Create the route file with just the GET list handler**

```typescript
// server/src/routes/governed-workflows-ui.ts
import { Router } from "express";
import type { DrizzleClient } from "../db.js";
import {
  requirePermission,
} from "../middleware/require-permission.js";
import { governedWorkflowService } from "../services/governed-workflows.js";

export function governedWorkflowsUiRoutes(db: DrizzleClient): Router {
  const router = Router({ mergeParams: true });
  const service = governedWorkflowService(db);

  router.get(
    "/",
    requirePermission("workflows:read"),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        const enabled = req.query.enabled === undefined
          ? undefined
          : req.query.enabled === "true";
        const items = await service.listDefinitions({ companyId, enabled });
        res.json({ items, total: items.length });
      } catch (err) { next(err); }
    },
  );

  return router;
}
```

- [ ] **Step 3: Mount it in `server/src/app.ts`**

Find the spot where other company-scoped routers are mounted (grep for `app.use.*companies.*:companyId`). Add:

```typescript
import { governedWorkflowsUiRoutes } from "./routes/governed-workflows-ui.js";
// ...
app.use(
  "/api/companies/:companyId/governed-workflows",
  assertCompanyMembership,
  tenantContextMiddleware,
  tagScopeMiddleware,
  governedWorkflowsUiRoutes(db),
);
```

Use the exact middleware imports + middleware chain order that other routes use (grep the chain in an existing route mount).

- [ ] **Step 4: Run the test file — expect PASS**

Run: `bun test server/src/routes/__tests__/governed-workflows-ui.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/governed-workflows-ui.ts server/src/routes/__tests__/governed-workflows-ui.test.ts server/src/app.ts
git -c commit.gpgsign=false commit -m "feat(workflows): REST route skeleton + GET list endpoint"
git push
```

### Task U2.7: `GET /:name` endpoint (fetch workflow.json from git)

**Files:**
- Modify: `server/src/routes/governed-workflows-ui.ts`
- Modify: `server/src/routes/__tests__/governed-workflows-ui.test.ts`

- [ ] **Step 1: Append failing test**

```typescript
describe("GET /api/companies/:companyId/governed-workflows/:name", () => {
  it("404s when the definition is not in the DB", async () => {
    const { app, companyId } = await makeTestApp({ permissions: ["workflows:read"] });
    const res = await request(app).get(
      `/api/companies/${companyId}/governed-workflows/missing`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error_code).toBe("WORKFLOW_NOT_FOUND");
  });

  it("returns the parsed workflow fetched from git at latest_git_tag", async () => {
    const { app, companyId, seedDefinition, stubGitProvider } = await makeTestApp({
      permissions: ["workflows:read"],
    });
    await seedDefinition({ name: "hello", latestGitTag: "hello/v0.0.3" });
    stubGitProvider.fetchBlob.mockResolvedValueOnce(
      JSON.stringify({
        apiVersion: "mnm/v1",
        kind: "GovernedWorkflow",
        name: "hello",
        steps: [],
      }),
    );

    const res = await request(app).get(
      `/api/companies/${companyId}/governed-workflows/hello`,
    );
    expect(res.status).toBe(200);
    expect(res.body.definition.name).toBe("hello");
    expect(res.body.latestGitTag).toBe("hello/v0.0.3");
  });
});
```

Run: FAIL — route not wired.

- [ ] **Step 2: Implement the handler**

Append to `governed-workflows-ui.ts`:

```typescript
router.get(
  "/:name",
  requirePermission("workflows:read"),
  async (req, res, next) => {
    try {
      const { companyId, name } = req.params as { companyId: string; name: string };
      const def = await service.getDefinition({ companyId, name });
      if (!def) {
        return res.status(404).json({
          isError: true,
          error_code: "WORKFLOW_NOT_FOUND",
          message: `Workflow '${name}' not found in company ${companyId}`,
          hints: ["Check the workflow name and company"],
        });
      }
      const parsed = await service.getWorkflowParsed({
        companyId,
        name,
        gitTag: def.latestGitTag ?? "main",
      });
      res.json({
        definition: parsed,
        latestGitTag: def.latestGitTag,
        enabled: def.enabled,
        archivedAt: def.archivedAt,
        updatedAt: def.updatedAt,
      });
    } catch (err) { next(err); }
  },
);
```

- [ ] **Step 3: Verify test passes**

Run: `bun test server/src/routes/__tests__/governed-workflows-ui.test.ts -t "GET /api/companies/:companyId/governed-workflows/:name"`
Expected: 2/2 PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/governed-workflows-ui.ts server/src/routes/__tests__/governed-workflows-ui.test.ts
git -c commit.gpgsign=false commit -m "feat(workflows): GET /:name endpoint (fetch from git)"
git push
```

### Task U2.8: POST + PUT + PATCH enabled + DELETE endpoints (grouped)

**Files:**
- Modify: `server/src/routes/governed-workflows-ui.ts`
- Modify: `server/src/routes/__tests__/governed-workflows-ui.test.ts`

- [ ] **Step 1: Write failing tests for the 4 endpoints**

Add a `describe` block per endpoint. One happy-path test + one 403 test + one validation test each. ~9 new tests. Use the same test-app helper.

Example for POST:

```typescript
describe("POST /api/companies/:companyId/governed-workflows", () => {
  it("creates a new workflow: commits + tags + inserts DB row", async () => {
    const { app, companyId, stubGitProvider } = await makeTestApp({
      permissions: ["workflows:create"],
    });
    stubGitProvider.listTags.mockResolvedValueOnce([]);
    stubGitProvider.commitFile.mockResolvedValueOnce({ sha: "c1" });
    stubGitProvider.createTag.mockResolvedValueOnce({ sha: "t1" });

    const res = await request(app)
      .post(`/api/companies/${companyId}/governed-workflows`)
      .send({
        definition: {
          apiVersion: "mnm/v1",
          kind: "GovernedWorkflow",
          name: "hello",
          steps: [],
        },
        commitMessage: "feat(hello): create",
      });

    expect(res.status).toBe(201);
    expect(res.body.newGitTag).toBe("hello/v0.0.1");
  });

  it("rejects invalid definition with 422", async () => {
    const { app, companyId } = await makeTestApp({ permissions: ["workflows:create"] });
    const res = await request(app)
      .post(`/api/companies/${companyId}/governed-workflows`)
      .send({ definition: { kind: "wrong" }, commitMessage: "x" });
    expect(res.status).toBe(422);
  });
});
```

Repeat pattern for PUT, PATCH enabled, DELETE.

Run: FAIL.

- [ ] **Step 2: Implement the 4 handlers**

```typescript
import { workflowDefinitionSchema } from "@mnm/governed-workflows";
import {
  saveDefinition,
  archiveDefinition,
} from "../services/governed-workflows-extensions.js";

const bodySchema = z.object({
  definition: workflowDefinitionSchema,
  commitMessage: z.string().min(1).max(500),
  branch: z.string().optional(),
});

router.post(
  "/",
  requirePermission("workflows:create"),
  async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({
          isError: true, error_code: "WORKFLOW_VALIDATION",
          message: "Invalid workflow definition", hints: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        });
      }
      const { definition, commitMessage } = parsed.data;
      const actor = res.locals.actor; // the actor middleware sets this
      const gitProvider = await service.resolveGitProvider({ companyId });
      const result = await saveDefinition({
        gitProvider,
        workflowName: definition.name,
        definitionJson: definition,
        commitMessage,
        authorName: actor.name ?? "MnM Dev",
        authorEmail: actor.email ?? "dev@mnm.local",
      });
      await service.upsertDefinition({
        companyId,
        name: definition.name,
        description: definition.description ?? null,
        latestGitTag: result.newGitTag,
      });
      res.status(201).json({ commitSha: result.commitSha, newGitTag: result.newGitTag });
    } catch (err) { next(err); }
  },
);

router.put(
  "/:name",
  requirePermission("workflows:create"),
  async (req, res, next) => {
    try {
      const { companyId, name } = req.params as { companyId: string; name: string };
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ isError: true, error_code: "WORKFLOW_VALIDATION", message: "Invalid workflow definition", hints: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
      }
      if (parsed.data.definition.name !== name) {
        return res.status(422).json({ isError: true, error_code: "WORKFLOW_NAME_MISMATCH", message: `Path :name=${name} does not match body name=${parsed.data.definition.name}`, hints: ["Align the URL path with the workflow body name"] });
      }
      // Same body as POST
      const actor = res.locals.actor;
      const gitProvider = await service.resolveGitProvider({ companyId });
      const result = await saveDefinition({
        gitProvider,
        workflowName: name,
        definitionJson: parsed.data.definition,
        commitMessage: parsed.data.commitMessage,
        authorName: actor.name ?? "MnM Dev",
        authorEmail: actor.email ?? "dev@mnm.local",
      });
      await service.upsertDefinition({
        companyId,
        name,
        description: parsed.data.definition.description ?? null,
        latestGitTag: result.newGitTag,
      });
      res.json({ commitSha: result.commitSha, newGitTag: result.newGitTag });
    } catch (err) { next(err); }
  },
);

router.patch(
  "/:name/enabled",
  requirePermission("workflows:create"),
  async (req, res, next) => {
    try {
      const { companyId, name } = req.params as { companyId: string; name: string };
      const enabledSchema = z.object({ enabled: z.boolean() });
      const parsed = enabledSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ isError: true, error_code: "WORKFLOW_VALIDATION", message: "body.enabled must be boolean", hints: [] });
      }
      const row = await service.setEnabled({ companyId, name, enabled: parsed.data.enabled });
      if (!row) return res.status(404).json({ isError: true, error_code: "WORKFLOW_NOT_FOUND", message: `Workflow '${name}' not found`, hints: [] });
      res.json({ enabled: row.enabled });
    } catch (err) { next(err); }
  },
);

router.delete(
  "/:name",
  requirePermission("workflows:create"),
  async (req, res, next) => {
    try {
      const { companyId, name } = req.params as { companyId: string; name: string };
      const row = await archiveDefinition(db, { companyId, name });
      if (!row) return res.status(404).json({ isError: true, error_code: "WORKFLOW_NOT_FOUND", message: `Workflow '${name}' not found`, hints: [] });
      res.status(204).send();
    } catch (err) { next(err); }
  },
);
```

Notes:
- `service.resolveGitProvider` and `service.upsertDefinition` and `service.setEnabled` may not exist yet on `governedWorkflowService`. If they don't, add thin wrappers in the service (grep `resolveGitProvider` in `server/src/services/` — it was shipped in T7 DEF-4). `upsertDefinition` + `setEnabled` likely also need adding; put them in `governed-workflows-extensions.ts` and re-export from `governed-workflows.ts`.
- Import `z` from `zod` at the top.

- [ ] **Step 3: Run tests**

Run: `bun test server/src/routes/__tests__/governed-workflows-ui.test.ts`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add -A
git -c commit.gpgsign=false commit -m "feat(workflows): POST+PUT+PATCH enabled+DELETE endpoints"
git push
```

### Task U2.9: GET tags + GET runs + GET run detail + POST run endpoints

**Files:**
- Modify: `server/src/routes/governed-workflows-ui.ts`
- Modify: `server/src/routes/__tests__/governed-workflows-ui.test.ts`

- [ ] **Step 1: Write failing tests**

Add 4 `describe` blocks, one test per endpoint (happy + 403 + at least one error case each).

Key scenarios:
- `GET /:name/tags` → returns `{tags: [{name, sha}, ...]}` via `gitProvider.listTags`.
- `GET /:name/runs` → paginated, filters `status` / `initiatedByActorId` / `startedAfter` / `startedBefore` / `limit` / `offset`.
- `GET /:name/runs/:runId` → returns `{run, steps: [{...step, gateResults: [...]}, ...]}`, 404 if absent.
- `POST /:name/runs` → delegates to `service.launchWorkflow`, accepts `{params, gitTag?: "latest" | "HEAD"}`.

Run: FAIL.

- [ ] **Step 2: Implement the 4 handlers**

```typescript
import { listRuns, getRunWithSteps } from "../services/governed-workflows-extensions.js";

router.get(
  "/:name/tags",
  requirePermission("workflows:read"),
  async (req, res, next) => {
    try {
      const { companyId, name } = req.params as { companyId: string; name: string };
      const gitProvider = await service.resolveGitProvider({ companyId });
      const tags = await gitProvider.listTags({ prefix: `${name}/v` });
      res.json({ tags });
    } catch (err) { next(err); }
  },
);

router.get(
  "/:name/runs",
  requirePermission("workflows:read"),
  async (req, res, next) => {
    try {
      const { companyId, name } = req.params as { companyId: string; name: string };
      const def = await service.getDefinition({ companyId, name });
      if (!def) return res.status(404).json({ isError: true, error_code: "WORKFLOW_NOT_FOUND", message: `Workflow '${name}' not found`, hints: [] });
      const items = await listRuns(db, {
        companyId,
        workflowDefId: def.id,
        status: req.query.status as ("draft" | "active" | "completed" | "failed" | undefined),
        initiatedByActorId: req.query.initiatedByActorId as string | undefined,
        startedAfter: req.query.startedAfter ? new Date(req.query.startedAfter as string) : undefined,
        startedBefore: req.query.startedBefore ? new Date(req.query.startedBefore as string) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      });
      res.json({ items, total: items.length });
    } catch (err) { next(err); }
  },
);

router.get(
  "/:name/runs/:runId",
  requirePermission("workflows:read"),
  async (req, res, next) => {
    try {
      const { companyId, runId } = req.params as { companyId: string; runId: string };
      const payload = await getRunWithSteps(db, { companyId, runId });
      if (!payload) return res.status(404).json({ isError: true, error_code: "RUN_NOT_FOUND", message: `Run '${runId}' not found`, hints: [] });
      res.json(payload);
    } catch (err) { next(err); }
  },
);

router.post(
  "/:name/runs",
  requirePermission("workflows:enforce"),
  async (req, res, next) => {
    try {
      const { companyId, name } = req.params as { companyId: string; name: string };
      const launchBody = z.object({
        params: z.record(z.unknown()).optional(),
        gitTag: z.enum(["latest", "HEAD"]).optional(),
      }).safeParse(req.body);
      if (!launchBody.success) {
        return res.status(422).json({ isError: true, error_code: "WORKFLOW_VALIDATION", message: "Invalid launch body", hints: launchBody.error.issues.map((i) => i.message) });
      }
      const actor = res.locals.actor;
      const result = await service.launchWorkflow({
        companyId,
        name,
        params: launchBody.data.params ?? {},
        gitTagPreference: launchBody.data.gitTag ?? "latest",
        initiatedBy: { actorType: actor.type, actorId: actor.id },
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  },
);
```

- [ ] **Step 3: Run tests**

Run: `bun test server/src/routes/__tests__/governed-workflows-ui.test.ts`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add -A
git -c commit.gpgsign=false commit -m "feat(workflows): GET tags/runs/run detail + POST launch endpoints"
git push
```

### Task U2.10: Tranche U2 integration test + full typecheck

**Files:** none directly — this is a verification pass.

- [ ] **Step 1: Apply the migration locally**

Run: `bun run db:migrate` (or the actual migrate command — grep `scripts.*migrate` in `package.json`).
Expected: migration 0066 applied cleanly, legacy tables gone, `archived_at` present.

- [ ] **Step 2: Full typecheck + tests**

Run: `bun run typecheck && bun run test --filter='!e2e'`
Expected: 13/13 typecheck green, all unit tests pass.

- [ ] **Step 3: Manual smoke**

Run: `bun run dev` (in one terminal).
In another terminal, hit the new endpoints with curl (use the dev company UUID from `bun run dev` logs):

```bash
curl -s http://localhost:3000/api/companies/<uuid>/governed-workflows | jq
```

Expected: `{items: [], total: 0}` (or the seed data if any).

- [ ] **Step 4: No commit needed — this is a verification gate**

If anything failed, open an issue and fix before moving to U3.

---

# Tranche U3 — Live events server + UI hook

Goal: every `launchStep` / `completeStep` / gate evaluation emits an SSE event on the company's `governed-runs` channel; a React hook subscribes and invalidates the query cache.

### Task U3.1: Emitter helpers (TDD)

**Files:**
- Create: `server/src/realtime/emitters/governed-run-events.ts`
- Create: `server/src/realtime/emitters/__tests__/governed-run-events.test.ts`

- [ ] **Step 1: Grep the existing emitter pattern**

Run: `grep -rn "function emit\|publishEvent\|broadcastEvent" server/src/realtime/`
Pick the helper used by `issue.updated` / `agent.heartbeat` (the pattern Tom confirmed exists via `live-events-ws.ts`).

- [ ] **Step 2: Write failing test**

```typescript
// server/src/realtime/emitters/__tests__/governed-run-events.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  emitStepUpdated,
  emitGateEvaluated,
} from "../governed-run-events.js";

describe("governed-run events", () => {
  it("emitStepUpdated publishes on the company run channel", () => {
    const publish = vi.fn();
    emitStepUpdated({ publish, companyId: "C1", runId: "R1", stepExecId: "S1" });
    expect(publish).toHaveBeenCalledWith({
      channel: "company:C1:governed-runs:R1",
      type: "governed_run.step_updated",
      payload: { runId: "R1", stepExecId: "S1" },
    });
  });

  it("emitGateEvaluated publishes on the run channel", () => {
    const publish = vi.fn();
    emitGateEvaluated({ publish, companyId: "C1", runId: "R1", stepExecId: "S1", gateResultId: "G1" });
    expect(publish).toHaveBeenCalledWith({
      channel: "company:C1:governed-runs:R1",
      type: "governed_run.gate_evaluated",
      payload: { runId: "R1", stepExecId: "S1", gateResultId: "G1" },
    });
  });
});
```

Run: FAIL.

- [ ] **Step 3: Implement the helpers**

```typescript
// server/src/realtime/emitters/governed-run-events.ts
export interface PublishFn {
  (event: { channel: string; type: string; payload: unknown }): void;
}

export function emitStepUpdated(args: {
  publish: PublishFn;
  companyId: string;
  runId: string;
  stepExecId: string;
}) {
  args.publish({
    channel: `company:${args.companyId}:governed-runs:${args.runId}`,
    type: "governed_run.step_updated",
    payload: { runId: args.runId, stepExecId: args.stepExecId },
  });
}

export function emitGateEvaluated(args: {
  publish: PublishFn;
  companyId: string;
  runId: string;
  stepExecId: string;
  gateResultId: string;
}) {
  args.publish({
    channel: `company:${args.companyId}:governed-runs:${args.runId}`,
    type: "governed_run.gate_evaluated",
    payload: {
      runId: args.runId,
      stepExecId: args.stepExecId,
      gateResultId: args.gateResultId,
    },
  });
}
```

- [ ] **Step 4: Run tests — PASS. Commit.**

```bash
git add server/src/realtime/emitters/
git -c commit.gpgsign=false commit -m "feat(workflows): SSE emitters for governed run events"
git push
```

### Task U3.2: Wire emission into `launchStep`, `completeStep`, gate runner

**Files:**
- Modify: `server/src/services/governed-workflows.ts`

- [ ] **Step 1: Grep for the right injection point**

Run: `grep -n "launchStep\|completeStep" server/src/services/governed-workflows.ts`

Locate the places where:
- A step execution transitions to `running` (inside `launchStep` after the DB update).
- A step execution transitions to `succeeded` or `failed` (inside `completeStep` after the DB update).
- A `gate_result` row is inserted (inside the gate-runner wrapper — the service calls out to `@mnm/gate-runner`; grep for where the result is persisted).

- [ ] **Step 2: Inject emission calls**

At each of the 3 injection points, add:

```typescript
import { emitStepUpdated, emitGateEvaluated } from "../realtime/emitters/governed-run-events.js";
import { publishLiveEvent } from "../realtime/live-events-ws.js"; // use the actual publish fn name (grep)

// Step transitions:
emitStepUpdated({
  publish: publishLiveEvent,
  companyId, runId, stepExecId: step.id,
});

// After inserting a gate_result row:
emitGateEvaluated({
  publish: publishLiveEvent,
  companyId, runId, stepExecId, gateResultId: gateResult.id,
});
```

Use the actual imported symbol for `publishLiveEvent` — grep the realtime file to confirm the export name.

- [ ] **Step 3: Write an integration test that exercises one end-to-end emission**

Add to `server/src/services/__tests__/governed-workflows.test.ts` (or create a new test file if the existing one is too large):

```typescript
it("emits step_updated when launchStep transitions to running", async () => {
  const publish = vi.fn();
  vi.spyOn(realtime, "publishLiveEvent").mockImplementation(publish);
  const service = governedWorkflowService(db);
  const run = await service.launchWorkflow({ /* ... */ });
  await service.launchStep({ companyId, runId: run.runId, stepId: run.firstStep });
  expect(publish).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "governed_run.step_updated",
      channel: expect.stringContaining(`governed-runs:${run.runId}`),
    }),
  );
});
```

Run: should pass after impl is in place.

- [ ] **Step 4: Commit**

```bash
git add -A
git -c commit.gpgsign=false commit -m "feat(workflows): emit step_updated/gate_evaluated from governed service"
git push
```

### Task U3.3: Client hook `useGovernedRunEvents`

**Files:**
- Create: `ui/src/hooks/useGovernedRunEvents.ts`
- Create: `ui/src/hooks/__tests__/useGovernedRunEvents.test.ts`

- [ ] **Step 1: Grep the existing live-events client utility**

Run: `grep -rn "events/ws\|useLiveEvent\|subscribeToChannel" ui/src/`
Find the pattern used elsewhere (the code-base already subscribes to live events — reuse the lowest-level hook/util it exposes).

- [ ] **Step 2: Write failing test**

```typescript
// ui/src/hooks/__tests__/useGovernedRunEvents.test.ts
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGovernedRunEvents } from "../useGovernedRunEvents.js";

describe("useGovernedRunEvents", () => {
  it("invalidates the runDetail query when a step_updated event arrives", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    // mock the underlying live-events subscription to fire a synthetic event
    // Use the same mock pattern as other hook tests in the repo.
    // ...
    // renderHook(() => useGovernedRunEvents({ companyId: "C", runId: "R" }), { wrapper: ... })
    // simulate event
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(["governed-workflows", "runs", "detail", "C", "R"]) }),
    );
  });
});
```

Run: FAIL.

- [ ] **Step 3: Implement the hook**

```typescript
// ui/src/hooks/useGovernedRunEvents.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys.js";
import { useLiveEvents } from "./useLiveEvents.js"; // adjust to the actual hook name

export function useGovernedRunEvents({
  companyId,
  runId,
}: {
  companyId: string;
  runId: string;
}) {
  const qc = useQueryClient();
  useLiveEvents({
    channel: `company:${companyId}:governed-runs:${runId}`,
    onEvent: (event) => {
      if (
        event.type === "governed_run.step_updated" ||
        event.type === "governed_run.gate_evaluated"
      ) {
        qc.invalidateQueries({
          queryKey: queryKeys.governedWorkflows.runDetail(companyId, runId),
        });
      }
    },
  });
}
```

If the real hook is `useLiveChannel(channel, handler)` or another shape, adapt the call — the point is: subscribe to the channel, invalidate on the 2 event types.

- [ ] **Step 4: Run tests — PASS. Commit.**

```bash
git add ui/src/hooks/useGovernedRunEvents.ts ui/src/hooks/__tests__/useGovernedRunEvents.test.ts
git -c commit.gpgsign=false commit -m "feat(workflows): useGovernedRunEvents hook invalidates runDetail on SSE"
git push
```

---

# Tranche U4 — API client + query keys

Goal: UI has a typed API surface to talk to the new endpoints, with TanStack Query keys ready.

### Task U4.1: Query keys + API client

**Files:**
- Modify: `ui/src/lib/queryKeys.ts`
- Create: `ui/src/api/governed-workflows.ts`

- [ ] **Step 1: Extend `queryKeys.ts`**

Open `ui/src/lib/queryKeys.ts`, find the top-level object that holds all namespaces (structure from scout: `agents: { list: ..., detail: ... }`), and add:

```typescript
governedWorkflows: {
  list: (companyId: string, filters?: Record<string, unknown>) =>
    ["governed-workflows", companyId, filters ?? {}] as const,
  detail: (companyId: string, name: string) =>
    ["governed-workflows", "detail", companyId, name] as const,
  tags: (companyId: string, name: string) =>
    ["governed-workflows", "tags", companyId, name] as const,
  runs: (companyId: string, name: string, filters?: Record<string, unknown>) =>
    ["governed-workflows", "runs", companyId, name, filters ?? {}] as const,
  runDetail: (companyId: string, runId: string) =>
    ["governed-workflows", "runs", "detail", companyId, runId] as const,
},
```

- [ ] **Step 2: Create the API client**

```typescript
// ui/src/api/governed-workflows.ts
import { api } from "./client.js";
import type {
  GovernedWorkflowDefinitionRow,
  GovernedRunRow,
  GovernedStepExecutionRow,
  GateResultRow,
} from "@mnm/shared";
import type { WorkflowDefinition } from "@mnm/governed-workflows";

const base = (companyId: string) =>
  `/companies/${companyId}/governed-workflows`;

export const governedWorkflowsApi = {
  list: (companyId: string, opts?: { enabled?: boolean }) =>
    api.get<{
      items: GovernedWorkflowDefinitionRow[];
      total: number;
    }>(`${base(companyId)}${opts?.enabled === undefined ? "" : `?enabled=${opts.enabled}`}`),

  get: (companyId: string, name: string) =>
    api.get<{
      definition: WorkflowDefinition;
      latestGitTag: string | null;
      enabled: boolean;
      archivedAt: string | null;
      updatedAt: string;
    }>(`${base(companyId)}/${encodeURIComponent(name)}`),

  tags: (companyId: string, name: string) =>
    api.get<{ tags: Array<{ name: string; sha: string }> }>(
      `${base(companyId)}/${encodeURIComponent(name)}/tags`,
    ),

  create: (
    companyId: string,
    body: { definition: WorkflowDefinition; commitMessage: string },
  ) => api.post<{ commitSha: string; newGitTag: string }>(base(companyId), body),

  update: (
    companyId: string,
    name: string,
    body: { definition: WorkflowDefinition; commitMessage: string },
  ) =>
    api.put<{ commitSha: string; newGitTag: string }>(
      `${base(companyId)}/${encodeURIComponent(name)}`,
      body,
    ),

  setEnabled: (companyId: string, name: string, enabled: boolean) =>
    api.patch<{ enabled: boolean }>(
      `${base(companyId)}/${encodeURIComponent(name)}/enabled`,
      { enabled },
    ),

  delete: (companyId: string, name: string) =>
    api.delete<void>(`${base(companyId)}/${encodeURIComponent(name)}`),

  listRuns: (
    companyId: string,
    name: string,
    opts?: {
      status?: "draft" | "active" | "completed" | "failed";
      initiatedByActorId?: string;
      startedAfter?: string;
      startedBefore?: string;
      limit?: number;
      offset?: number;
    },
  ) => {
    const qs = opts ? "?" + new URLSearchParams(
      Object.entries(opts).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
    ).toString() : "";
    return api.get<{ items: GovernedRunRow[]; total: number }>(
      `${base(companyId)}/${encodeURIComponent(name)}/runs${qs}`,
    );
  },

  getRun: (companyId: string, name: string, runId: string) =>
    api.get<{
      run: GovernedRunRow;
      steps: Array<GovernedStepExecutionRow & { gateResults: GateResultRow[] }>;
    }>(`${base(companyId)}/${encodeURIComponent(name)}/runs/${runId}`),

  launchRun: (
    companyId: string,
    name: string,
    body: { params?: Record<string, unknown>; gitTag?: "latest" | "HEAD" },
  ) =>
    api.post<{ runId: string; firstStep: string }>(
      `${base(companyId)}/${encodeURIComponent(name)}/runs`,
      body,
    ),
};
```

- [ ] **Step 3: Typecheck UI**

Run: `cd ui && bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add ui/src/api/governed-workflows.ts ui/src/lib/queryKeys.ts
git -c commit.gpgsign=false commit -m "feat(workflows): UI API client + query keys for governed workflows"
git push
```

---

# Tranche U5 — 4 pages UI

Goal: the 4 pages are live, routes wired, Monaco lazy-loaded, parity tracker updated, manual E2E passing.

### Task U5.1: Install Monaco

**Files:**
- Modify: `ui/package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Install**

Run: `cd ui && bun add @monaco-editor/react monaco-editor`
Expected: deps added to `ui/package.json`.

- [ ] **Step 2: Verify bundle impact note**

Run: `grep "monaco" ui/package.json`
Confirm both deps are listed.

- [ ] **Step 3: Commit**

```bash
git add ui/package.json bun.lock
git -c commit.gpgsign=false commit -m "chore(ui): add @monaco-editor/react + monaco-editor"
git push
```

### Task U5.2: `GovernedWorkflowsList` page (TDD)

**Files:**
- Create: `ui/src/pages/GovernedWorkflowsList.tsx`
- Create: `ui/src/pages/__tests__/GovernedWorkflowsList.test.tsx`

- [ ] **Step 1: Write failing render test**

```typescript
// ui/src/pages/__tests__/GovernedWorkflowsList.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import GovernedWorkflowsList from "../GovernedWorkflowsList.js";
import { governedWorkflowsApi } from "../../api/governed-workflows.js";

vi.mock("../../api/governed-workflows.js", () => ({
  governedWorkflowsApi: {
    list: vi.fn().mockResolvedValue({
      items: [{ name: "hello", description: "demo", latestGitTag: "hello/v0.0.1", enabled: true, updatedAt: new Date().toISOString() }],
      total: 1,
    }),
    setEnabled: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../hooks/useCompany.js", () => ({
  useCompany: () => ({ selectedCompanyId: "11111111-1111-1111-1111-111111111111" }),
}));

describe("GovernedWorkflowsList", () => {
  it("renders workflow rows", async () => {
    const qc = new QueryClient();
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <GovernedWorkflowsList />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("hello")).toBeInTheDocument());
    expect(screen.getByText(/v0.0.1/)).toBeInTheDocument();
  });

  it("shows the CTA to create a new workflow", async () => {
    const qc = new QueryClient();
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <GovernedWorkflowsList />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("link", { name: /nouveau workflow/i })).toBeInTheDocument());
  });
});
```

Run: FAIL — page doesn't exist.

- [ ] **Step 2: Implement the page**

```typescript
// ui/src/pages/GovernedWorkflowsList.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Workflow, Plus, Trash2 } from "lucide-react";
import { useCompany } from "../hooks/useCompany.js";
import { governedWorkflowsApi } from "../api/governed-workflows.js";
import { queryKeys } from "../lib/queryKeys.js";
import { Button } from "../components/ui/button.js";
import { Switch } from "../components/ui/switch.js";
import { Badge } from "../components/ui/badge.js";
import { PageSkeleton } from "../components/PageSkeleton.js";
import { EmptyState } from "../components/EmptyState.js";
import { formatRelative } from "../lib/date.js"; // use the actual helper in repo

export default function GovernedWorkflowsList() {
  const { selectedCompanyId } = useCompany();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.governedWorkflows.list(selectedCompanyId!),
    queryFn: () => governedWorkflowsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      governedWorkflowsApi.setEnabled(selectedCompanyId!, name, enabled),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.governedWorkflows.list(selectedCompanyId!) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => governedWorkflowsApi.delete(selectedCompanyId!, name),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.governedWorkflows.list(selectedCompanyId!) }),
  });

  if (isLoading) return <PageSkeleton />;

  const items = data?.items ?? [];
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Workflow className="h-6 w-6" /> Workflows
        </h1>
        <Button asChild>
          <Link to="/workflows/new">
            <Plus className="h-4 w-4 mr-1" /> Nouveau workflow
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Aucun workflow"
          description="Créez votre premier workflow gouverné."
          action={<Button asChild><Link to="/workflows/new">Nouveau workflow</Link></Button>}
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-2">Nom</th>
              <th>Description</th>
              <th>Tag</th>
              <th>Activé</th>
              <th>Dernière modif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.name} className="border-b hover:bg-muted/40">
                <td className="py-2">
                  <Link to={`/workflows/${w.name}`} className="font-medium hover:underline">
                    {w.name}
                  </Link>
                </td>
                <td className="max-w-xs truncate">{w.description ?? "—"}</td>
                <td>{w.latestGitTag ? <Badge variant="secondary">{w.latestGitTag}</Badge> : "—"}</td>
                <td>
                  <Switch
                    checked={w.enabled}
                    onCheckedChange={(checked) =>
                      toggleEnabled.mutate({ name: w.name, enabled: checked })
                    }
                  />
                </td>
                <td>{formatRelative(w.updatedAt)}</td>
                <td className="flex gap-2 justify-end py-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/workflows/${w.name}/runs`}>Runs</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Archiver ${w.name} ?`)) deleteMutation.mutate(w.name);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run the tests, fix until green**

Run: `cd ui && bun test src/pages/__tests__/GovernedWorkflowsList.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add ui/src/pages/GovernedWorkflowsList.tsx ui/src/pages/__tests__/GovernedWorkflowsList.test.tsx
git -c commit.gpgsign=false commit -m "feat(workflows): GovernedWorkflowsList page"
git push
```

### Task U5.3: `GovernedWorkflowEditor` page

**Files:**
- Create: `ui/src/pages/GovernedWorkflowEditor.tsx`
- Create: `ui/src/pages/__tests__/GovernedWorkflowEditor.test.tsx`

- [ ] **Step 1: Write render test (happy path load + display)**

Follow the same mock + render pattern as U5.2. Mock `governedWorkflowsApi.get` to return a minimal definition. Assert the editor's header and the JSON content are in the DOM. Note that Monaco won't truly render in JSDOM — mock `@monaco-editor/react` with a textarea:

```typescript
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="monaco"
      value={value}
      onChange={(e) => onChange?.(e.target.value, {})}
    />
  ),
}));
```

- [ ] **Step 2: Implement the page**

Key requirements (full impl in the file — not truncated):

```typescript
// ui/src/pages/GovernedWorkflowEditor.tsx
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workflowDefinitionSchema } from "@mnm/governed-workflows";
import { useCompany } from "../hooks/useCompany.js";
import { governedWorkflowsApi } from "../api/governed-workflows.js";
import { queryKeys } from "../lib/queryKeys.js";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog.js";
import { Textarea } from "../components/ui/textarea.js";
import { Badge } from "../components/ui/badge.js";
import { PageSkeleton } from "../components/PageSkeleton.js";

const Monaco = lazy(() => import("@monaco-editor/react"));

const TEMPLATE = JSON.stringify(
  {
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name: "",
    description: "",
    variables: {},
    steps: [],
  },
  null,
  2,
);

export default function GovernedWorkflowEditor() {
  const { name } = useParams();
  const mode: "create" | "edit" = name ? "edit" : "create";
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: loaded, isLoading } = useQuery({
    queryKey: queryKeys.governedWorkflows.detail(selectedCompanyId!, name!),
    queryFn: () => governedWorkflowsApi.get(selectedCompanyId!, name!),
    enabled: mode === "edit" && !!selectedCompanyId && !!name,
  });

  const [json, setJson] = useState<string>(TEMPLATE);
  const [commitMessage, setCommitMessage] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    if (mode === "edit" && loaded) {
      setJson(JSON.stringify(loaded.definition, null, 2));
    }
  }, [loaded, mode]);

  const validation = useMemo(() => {
    try {
      const parsed = JSON.parse(json);
      const r = workflowDefinitionSchema.safeParse(parsed);
      if (r.success) return { ok: true as const, definition: r.data };
      return { ok: false as const, issues: r.error.issues };
    } catch (e) {
      return { ok: false as const, issues: [{ path: [], message: (e as Error).message }] };
    }
  }, [json]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!validation.ok) throw new Error("Invalid JSON");
      const body = { definition: validation.definition, commitMessage };
      return mode === "create"
        ? governedWorkflowsApi.create(selectedCompanyId!, body)
        : governedWorkflowsApi.update(selectedCompanyId!, name!, body);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.governedWorkflows.list(selectedCompanyId!) });
      navigate(`/workflows/${validation.ok ? validation.definition.name : name}`);
    },
  });

  if (mode === "edit" && isLoading) return <PageSkeleton />;

  return (
    <div className="p-6 grid grid-cols-[1fr,320px] gap-4 h-full">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            {mode === "create" ? "Nouveau workflow" : `Éditer: ${name}`}
          </h1>
          {loaded?.latestGitTag && <Badge variant="secondary">{loaded.latestGitTag}</Badge>}
        </div>
        <Suspense fallback={<div className="border rounded h-[70vh]" />}>
          <Monaco
            height="70vh"
            defaultLanguage="json"
            value={json}
            onChange={(v) => setJson(v ?? "")}
          />
        </Suspense>
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger asChild>
            <Button disabled={!validation.ok}>Save</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Commit + tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="feat(<workflow>): ..."
              />
            </div>
            <DialogFooter>
              <Button onClick={() => saveMutation.mutate()} disabled={!validation.ok || commitMessage.length < 1}>
                Save & push
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <aside className="border rounded p-3 overflow-auto">
        <h2 className="font-medium mb-2">Validation</h2>
        {validation.ok ? (
          <div className="text-green-700">JSON valide</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {validation.issues.map((issue, i) => (
              <li key={i} className="text-red-700">
                <span className="font-mono text-xs">{Array.isArray(issue.path) ? issue.path.join(".") : ""}</span>
                {": "}{issue.message}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Run tests — PASS. Commit.**

```bash
git add ui/src/pages/GovernedWorkflowEditor.tsx ui/src/pages/__tests__/GovernedWorkflowEditor.test.tsx
git -c commit.gpgsign=false commit -m "feat(workflows): GovernedWorkflowEditor page (Monaco + zod live)"
git push
```

### Task U5.4: `GovernedWorkflowRuns` page

**Files:**
- Create: `ui/src/pages/GovernedWorkflowRuns.tsx`
- Create: `ui/src/pages/__tests__/GovernedWorkflowRuns.test.tsx`

- [ ] **Step 1: Write render test**

Same pattern: mock `governedWorkflowsApi.listRuns` and `.getRun`, render with MemoryRouter, assert headers + row text.

- [ ] **Step 2: Implement the page**

Key behavior:
- List paginated (50/page) table with columns `id (short mono)`, `status (Badge)`, `started_at`, `completed_at`, `initiated_by`, `git_tag`.
- Filters (status Select, DateRange, Input initiatedBy).
- "Lancer un run" CTA → Dialog with `params` form built from the workflow's variables (fetched via `governedWorkflowsApi.get`) + checkbox "Launch from main HEAD (untagged)".
- Row click navigates to `/workflows/:name/runs/:runId`.

Structure follows `GovernedWorkflowsList` plus a Dialog for launching. Full code follows the shadcn/ui patterns used elsewhere (Select, DatePicker, Dialog).

- [ ] **Step 3: Run tests — PASS. Commit.**

```bash
git add ui/src/pages/GovernedWorkflowRuns.tsx ui/src/pages/__tests__/GovernedWorkflowRuns.test.tsx
git -c commit.gpgsign=false commit -m "feat(workflows): GovernedWorkflowRuns page"
git push
```

### Task U5.5: `GovernedWorkflowRunDetail` page (with SSE live updates)

**Files:**
- Create: `ui/src/pages/GovernedWorkflowRunDetail.tsx`
- Create: `ui/src/pages/__tests__/GovernedWorkflowRunDetail.test.tsx`

- [ ] **Step 1: Write render test**

Mock `governedWorkflowsApi.getRun` and `useGovernedRunEvents`. Assert the timeline renders + Gates tab content for a mocked step + gate.

- [ ] **Step 2: Implement the page**

Key:
- `useQuery` for `getRun`.
- `useGovernedRunEvents({ companyId, runId })` at the top of the component.
- Vertical timeline of steps, each step as a `<Card>` with `<Tabs>` (Input / Output / Gates).
- Input tab: pretty-printed JSON from `step.promptContextResolved` (or computed client-side if not provided — spec says re-resolve server-side).
- Output tab: pretty-printed `step.artifactsJson` or "Not executed yet" placeholder.
- Gates tab: `<table>` of `gate_results` with columns `id`, `kind`, `pass` (badge), `report`, `errorCode`, `hints (bullets)`, `gateGitSha` (short).

- [ ] **Step 3: Run tests — PASS. Commit.**

```bash
git add ui/src/pages/GovernedWorkflowRunDetail.tsx ui/src/pages/__tests__/GovernedWorkflowRunDetail.test.tsx
git -c commit.gpgsign=false commit -m "feat(workflows): GovernedWorkflowRunDetail page with SSE live updates"
git push
```

### Task U5.6: Wire routes in `App.tsx`

**Files:**
- Modify: `ui/src/App.tsx`

- [ ] **Step 1: Add the 5 routes**

Find the `<Routes>` block (grep `<Routes>` in `ui/src/App.tsx`). Inside, add:

```tsx
<Route path="workflows" element={<RequirePermission permission="workflows:read" showForbidden><GovernedWorkflowsList /></RequirePermission>} />
<Route path="workflows/new" element={<RequirePermission permission="workflows:create" showForbidden><GovernedWorkflowEditor /></RequirePermission>} />
<Route path="workflows/:name" element={<RequirePermission permission="workflows:read" showForbidden><GovernedWorkflowEditor /></RequirePermission>} />
<Route path="workflows/:name/runs" element={<RequirePermission permission="workflows:read" showForbidden><GovernedWorkflowRuns /></RequirePermission>} />
<Route path="workflows/:name/runs/:runId" element={<RequirePermission permission="workflows:read" showForbidden><GovernedWorkflowRunDetail /></RequirePermission>} />
```

Add the imports at the top:

```typescript
import GovernedWorkflowsList from "./pages/GovernedWorkflowsList.js";
import GovernedWorkflowEditor from "./pages/GovernedWorkflowEditor.js";
import GovernedWorkflowRuns from "./pages/GovernedWorkflowRuns.js";
import GovernedWorkflowRunDetail from "./pages/GovernedWorkflowRunDetail.js";
```

- [ ] **Step 2: Typecheck + boot**

Run: `bun run typecheck && bun run dev`
Expected: no compile errors. Navigate to `/workflows` in browser → list page renders (may be empty if no data).

- [ ] **Step 3: Commit**

```bash
git add ui/src/App.tsx
git -c commit.gpgsign=false commit -m "feat(workflows): wire governed workflow routes"
git push
```

### Task U5.7: Parity tracker update

**Files:**
- Modify: `scripts/parity/data.ts`

- [ ] **Step 1: Add the new domain**

Open `scripts/parity/data.ts`, find the domains array/object, add:

```typescript
{
  key: "governed-workflows",
  name: "Governed Workflows",
  features: [
    {
      id: "governed-workflows-list",
      name: "Liste des workflows gouvernés",
      web: { status: "done", since: "2026-04-24" },
      desktop: { status: "missing", notes: "Web parity: route /workflows wired in Tauri shell" },
    },
    {
      id: "governed-workflows-editor",
      name: "Éditeur JSON Monaco",
      web: { status: "done", since: "2026-04-24" },
      desktop: { status: "missing", notes: "Monaco bundle works in Tauri if imported the same way" },
    },
    {
      id: "governed-workflows-runs-list",
      name: "Liste des runs d'un workflow",
      web: { status: "done", since: "2026-04-24" },
      desktop: { status: "missing" },
    },
    {
      id: "governed-workflows-run-detail",
      name: "Detail d'un run avec SSE live",
      web: { status: "done", since: "2026-04-24" },
      desktop: { status: "missing", notes: "SSE in Tauri: verify WebSocket allowlist" },
    },
  ],
},
```

If `scripts/parity/data.ts` uses a flat `FEATURES` array instead of nested domains, adapt — the point is: 4 features with `web: done`, `desktop: missing`.

- [ ] **Step 2: Verify the report renders**

Run: `bun run parity`
Expected: the 4 new features appear under `governed-workflows`.

- [ ] **Step 3: Commit**

```bash
git add scripts/parity/data.ts
git -c commit.gpgsign=false commit -m "chore(parity): track governed workflows UI features"
git push
```

### Task U5.8: Manual E2E smoke

- [ ] **Step 1: Apply migrations + start dev**

```bash
bun run db:migrate
bun run dev
```

- [ ] **Step 2: Walk the happy path in the browser**

1. Navigate to `/workflows`. Expect empty state.
2. Click `Nouveau workflow`. Fill the JSON editor with a minimal valid `hello` workflow (1 step, no gates). Save → back to list, row appears with `hello/v0.0.1`.
3. Click `hello` row → editor opens with the JSON. Change `description`, Save → row now shows `hello/v0.0.2`.
4. Click "Runs" → empty list. Click "Lancer un run" → form shows variables (if any). Launch → redirected to run detail.
5. (If MCP/client harness isn't running, the run will stay in `draft`. For a full E2E including SSE, drive `launchStep`/`completeStep` via MCP in a second terminal and verify the run detail page updates live without page reload.)

- [ ] **Step 3: Document any gaps**

If a step fails, open an issue with reproduction steps. Don't commit fixes here — file them as follow-ups in a completion report at the bottom of this plan.

- [ ] **Step 4: Final commit — completion report**

At the bottom of this plan file, append a "## Completion report" section with:
- Summary of what shipped
- Any follow-ups discovered
- Sign-off date

```bash
git add docs/superpowers/plans/2026-04-24-governed-workflows-ui.md
git -c commit.gpgsign=false commit -m "docs(workflows): completion report for governed workflows UI"
git push
```

---

# Tranche U6 — MCP tool parity

Goal: Claude Code sessions (via MCP) can create/update/archive governed workflows with the same capabilities as the UI. Reuses the service helpers from U2 (`saveDefinition`, `archiveDefinition`), adds thin MCP tool wrappers with the MnM uniform error contract.

### Task U6.1: `createGovernedWorkflow` MCP tool (TDD)

**Files:**
- Modify: `server/src/mcp/tools/governed-workflows.tool.ts`
- Modify: `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts`

- [ ] **Step 1: Scout the existing tool pattern**

Run: `grep -n "export.*Tool\|toolDefinition\|inputSchema\|execute" server/src/mcp/tools/governed-workflows.tool.ts | head -40`

Record:
- How each existing tool (e.g. `launchWorkflow`) declares its `name`, `description`, `inputSchema` (zod), `execute` function.
- How the actor is retrieved inside `execute` (likely from the `ctx` passed to the tool — grep for `ctx.actor` or similar).
- How errors are formatted (the `isError` / `error_code` / `hints` shape from the MVP spec §4).

- [ ] **Step 2: Write failing test for `createGovernedWorkflow`**

Append to the existing tool test file:

```typescript
describe("createGovernedWorkflow MCP tool", () => {
  it("commits workflow.json, creates tag, inserts DB row, returns newGitTag", async () => {
    const { tools, stubGitProvider } = await makeTestMcpContext({ companyId: "C1", actor: { type: "user", id: "U1", name: "Tom", email: "t@x.y" } });
    stubGitProvider.listTags.mockResolvedValueOnce([]);
    stubGitProvider.commitFile.mockResolvedValueOnce({ sha: "c1" });
    stubGitProvider.createTag.mockResolvedValueOnce({ sha: "t1" });

    const res = await tools.createGovernedWorkflow.execute({
      definition: { apiVersion: "mnm/v1", kind: "GovernedWorkflow", name: "hello", steps: [] },
      commitMessage: "feat(hello): create via MCP",
    });

    expect(res).toMatchObject({ newGitTag: "hello/v0.0.1", commitSha: "c1" });
    // DB row asserted via side-effect: companies/.../governed-workflows getDefinition should now return it
  });

  it("returns error_code WORKFLOW_VALIDATION on invalid definition", async () => {
    const { tools } = await makeTestMcpContext({ companyId: "C1" });
    const res = await tools.createGovernedWorkflow.execute({
      definition: { kind: "wrong" } as any,
      commitMessage: "x",
    });
    expect(res).toMatchObject({
      isError: true,
      error_code: "WORKFLOW_VALIDATION",
    });
    expect(res.hints).toBeInstanceOf(Array);
  });

  it("returns error_code GIT_PROVIDER_MISCONFIG if the company has no git_provider config_layer_item", async () => {
    const { tools, disableGitProvider } = await makeTestMcpContext({ companyId: "C1" });
    disableGitProvider();
    const res = await tools.createGovernedWorkflow.execute({
      definition: { apiVersion: "mnm/v1", kind: "GovernedWorkflow", name: "hello", steps: [] },
      commitMessage: "x",
    });
    expect(res).toMatchObject({ isError: true, error_code: "GIT_PROVIDER_MISCONFIG" });
  });
});
```

Note: `makeTestMcpContext` and helpers are specific to this repo — grep `makeTestMcpContext\|makeTestMcpClient\|makeToolTestEnv` in `server/src/mcp/tools/__tests__/` to find the existing pattern used by other tool tests. Adapt the API if it differs.

Run: `bun test server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts -t createGovernedWorkflow`
Expected: FAIL — tool not defined.

- [ ] **Step 3: Implement the tool**

Append to `server/src/mcp/tools/governed-workflows.tool.ts`, following the exact pattern of the existing tools in the same file (copy the shape of `launchWorkflow` and adapt):

```typescript
import { z } from "zod";
import { workflowDefinitionSchema } from "@mnm/governed-workflows";
import { saveDefinition } from "../../services/governed-workflows-extensions.js";

// Input schema
const createGovernedWorkflowInput = z.object({
  definition: workflowDefinitionSchema,
  commitMessage: z.string().min(1).max(500),
});

// Tool (follows the same export/register pattern as other tools in this file)
export const createGovernedWorkflowTool = {
  name: "createGovernedWorkflow",
  description:
    "Create a new governed workflow. Commits workflow.json to the company's workflows git repo on main, creates an auto-semver tag (<name>/vX.Y.Z), and inserts a row in governed_workflow_definitions. Equivalent to the UI 'Nouveau workflow' flow.",
  inputSchema: createGovernedWorkflowInput,
  execute: async (
    input: z.infer<typeof createGovernedWorkflowInput>,
    ctx: McpToolContext, // use the actual ctx type from the other tools in this file
  ) => {
    try {
      const { companyId, actor } = ctx;
      const gitProvider = await ctx.service.resolveGitProvider({ companyId });
      const result = await saveDefinition({
        gitProvider,
        workflowName: input.definition.name,
        definitionJson: input.definition,
        commitMessage: input.commitMessage,
        authorName: actor.name ?? "MnM MCP",
        authorEmail: actor.email ?? "mcp@mnm.local",
      });
      await ctx.service.upsertDefinition({
        companyId,
        name: input.definition.name,
        description: input.definition.description ?? null,
        latestGitTag: result.newGitTag,
      });
      return {
        commitSha: result.commitSha,
        newGitTag: result.newGitTag,
      };
    } catch (err) {
      return mapErrorToMcpContract(err); // reuse the helper already present in this file
    }
  },
};
```

If the file exports a `tools` array/object that the MCP registry picks up, add `createGovernedWorkflowTool` to it.

- [ ] **Step 4: Run the tests — PASS.**

Run: `bun test server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts -t createGovernedWorkflow`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/mcp/tools/governed-workflows.tool.ts server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts
git -c commit.gpgsign=false commit -m "feat(workflows): createGovernedWorkflow MCP tool"
git push
```

### Task U6.2: `updateGovernedWorkflow` MCP tool

**Files:**
- Modify: `server/src/mcp/tools/governed-workflows.tool.ts`
- Modify: `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe("updateGovernedWorkflow MCP tool", () => {
  it("commits to main + bumps patch tag + updates DB row", async () => {
    const { tools, seedDefinition, stubGitProvider } = await makeTestMcpContext({ companyId: "C1" });
    await seedDefinition({ name: "hello", latestGitTag: "hello/v0.0.5" });
    stubGitProvider.listTags.mockResolvedValueOnce([{ name: "hello/v0.0.5", sha: "x" }]);
    stubGitProvider.commitFile.mockResolvedValueOnce({ sha: "c2" });
    stubGitProvider.createTag.mockResolvedValueOnce({ sha: "t2" });

    const res = await tools.updateGovernedWorkflow.execute({
      name: "hello",
      definition: { apiVersion: "mnm/v1", kind: "GovernedWorkflow", name: "hello", description: "updated", steps: [] },
      commitMessage: "feat(hello): tweak description via MCP",
    });

    expect(res).toMatchObject({ newGitTag: "hello/v0.0.6", commitSha: "c2" });
  });

  it("returns error_code WORKFLOW_NAME_MISMATCH if input.name != definition.name", async () => {
    const { tools } = await makeTestMcpContext({ companyId: "C1" });
    const res = await tools.updateGovernedWorkflow.execute({
      name: "hello",
      definition: { apiVersion: "mnm/v1", kind: "GovernedWorkflow", name: "not-hello", steps: [] },
      commitMessage: "x",
    });
    expect(res).toMatchObject({ isError: true, error_code: "WORKFLOW_NAME_MISMATCH" });
  });

  it("returns error_code WORKFLOW_NOT_FOUND if the workflow DB row is missing", async () => {
    const { tools } = await makeTestMcpContext({ companyId: "C1" });
    const res = await tools.updateGovernedWorkflow.execute({
      name: "ghost",
      definition: { apiVersion: "mnm/v1", kind: "GovernedWorkflow", name: "ghost", steps: [] },
      commitMessage: "x",
    });
    expect(res).toMatchObject({ isError: true, error_code: "WORKFLOW_NOT_FOUND" });
  });
});
```

Run: FAIL.

- [ ] **Step 2: Implement the tool**

```typescript
const updateGovernedWorkflowInput = z.object({
  name: z.string().min(1),
  definition: workflowDefinitionSchema,
  commitMessage: z.string().min(1).max(500),
});

export const updateGovernedWorkflowTool = {
  name: "updateGovernedWorkflow",
  description:
    "Update an existing governed workflow. Commits workflow.json changes, bumps the patch tag, and updates the DB row. Equivalent to the UI editor 'Save' action.",
  inputSchema: updateGovernedWorkflowInput,
  execute: async (input: z.infer<typeof updateGovernedWorkflowInput>, ctx: McpToolContext) => {
    try {
      if (input.definition.name !== input.name) {
        return {
          isError: true,
          error_code: "WORKFLOW_NAME_MISMATCH",
          message: `input.name=${input.name} does not match definition.name=${input.definition.name}`,
          hints: ["Align the input.name with the definition.name"],
        };
      }
      const existing = await ctx.service.getDefinition({ companyId: ctx.companyId, name: input.name });
      if (!existing) {
        return {
          isError: true,
          error_code: "WORKFLOW_NOT_FOUND",
          message: `Workflow '${input.name}' not found`,
          hints: ["Use createGovernedWorkflow to create it first"],
        };
      }
      const gitProvider = await ctx.service.resolveGitProvider({ companyId: ctx.companyId });
      const result = await saveDefinition({
        gitProvider,
        workflowName: input.name,
        definitionJson: input.definition,
        commitMessage: input.commitMessage,
        authorName: ctx.actor.name ?? "MnM MCP",
        authorEmail: ctx.actor.email ?? "mcp@mnm.local",
      });
      await ctx.service.upsertDefinition({
        companyId: ctx.companyId,
        name: input.name,
        description: input.definition.description ?? null,
        latestGitTag: result.newGitTag,
      });
      return { commitSha: result.commitSha, newGitTag: result.newGitTag };
    } catch (err) {
      return mapErrorToMcpContract(err);
    }
  },
};
```

Register `updateGovernedWorkflowTool` in the tools registry of this file.

- [ ] **Step 3: Run tests — PASS. Commit.**

```bash
git add server/src/mcp/tools/governed-workflows.tool.ts server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts
git -c commit.gpgsign=false commit -m "feat(workflows): updateGovernedWorkflow MCP tool"
git push
```

### Task U6.3: `archiveGovernedWorkflow` MCP tool

**Files:**
- Modify: `server/src/mcp/tools/governed-workflows.tool.ts`
- Modify: `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe("archiveGovernedWorkflow MCP tool", () => {
  it("soft-deletes the DB row (archived_at + enabled=false), does not touch git", async () => {
    const { tools, seedDefinition, stubGitProvider } = await makeTestMcpContext({ companyId: "C1" });
    await seedDefinition({ name: "hello" });

    const res = await tools.archiveGovernedWorkflow.execute({ name: "hello" });

    expect(res).toEqual({ archived: true, name: "hello" });
    expect(stubGitProvider.commitFile).not.toHaveBeenCalled();
    expect(stubGitProvider.createTag).not.toHaveBeenCalled();
  });

  it("returns error_code WORKFLOW_NOT_FOUND if the workflow does not exist", async () => {
    const { tools } = await makeTestMcpContext({ companyId: "C1" });
    const res = await tools.archiveGovernedWorkflow.execute({ name: "ghost" });
    expect(res).toMatchObject({ isError: true, error_code: "WORKFLOW_NOT_FOUND" });
  });
});
```

Run: FAIL.

- [ ] **Step 2: Implement the tool**

```typescript
import { archiveDefinition } from "../../services/governed-workflows-extensions.js";

const archiveGovernedWorkflowInput = z.object({
  name: z.string().min(1),
});

export const archiveGovernedWorkflowTool = {
  name: "archiveGovernedWorkflow",
  description:
    "Soft-delete a governed workflow. Sets archived_at=now() and enabled=false on the DB row. Does NOT delete anything in git (history is preserved). Equivalent to the UI 'Supprimer' action.",
  inputSchema: archiveGovernedWorkflowInput,
  execute: async (input: z.infer<typeof archiveGovernedWorkflowInput>, ctx: McpToolContext) => {
    try {
      const row = await archiveDefinition(ctx.db, { companyId: ctx.companyId, name: input.name });
      if (!row) {
        return {
          isError: true,
          error_code: "WORKFLOW_NOT_FOUND",
          message: `Workflow '${input.name}' not found`,
          hints: [],
        };
      }
      return { archived: true, name: input.name };
    } catch (err) {
      return mapErrorToMcpContract(err);
    }
  },
};
```

Register `archiveGovernedWorkflowTool` in the tools registry.

- [ ] **Step 3: Run tests — PASS. Commit.**

```bash
git add server/src/mcp/tools/governed-workflows.tool.ts server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts
git -c commit.gpgsign=false commit -m "feat(workflows): archiveGovernedWorkflow MCP tool"
git push
```

### Task U6.4: MCP registry + discovery check

**Files:** verification only.

- [ ] **Step 1: Verify the 3 new tools show up in the MCP registry**

Run: `grep -n "createGovernedWorkflow\|updateGovernedWorkflow\|archiveGovernedWorkflow" server/src/mcp/` recursively (use Grep tool if available). All 3 names must appear in the tools registry file.

- [ ] **Step 2: End-to-end MCP sanity**

Start dev: `bun run dev` then, from a Claude Code session with the MnM plugin installed, run a list of MCP tools — verify the 3 new tools are advertised. If not, debug the registration (usually a forgotten entry in the tools array or an `export` missed).

- [ ] **Step 3: Commit if any wiring was needed**

```bash
git add -A
git -c commit.gpgsign=false commit -m "feat(workflows): expose 3 new governed workflow tools via MCP registry"
git push
```

If no changes were needed (everything was already wired), skip this step.

---

## Notes for executors

- **Atomic commits**: every task ends with a commit. Don't batch.
- **Typecheck gate**: each commit should leave `bun run typecheck` green. If a commit breaks typecheck, it's not atomic.
- **Follow repo conventions**: imports use `.js` extensions (TS paths → compiled JS), error pattern uses `error_code` + `hints`, permissions checked via `requirePermission` middleware.
- **When a pattern is unclear**: grep first, don't guess. The plan calls out "adjust per repo convention" where the exact symbol name depends on what's currently in the tree.
- **Fresh subagent per task**: this is a large plan; context will bloat otherwise. Use the subagent-driven-development skill.

---

## Completion report

**Date:** 2026-04-24
**Shipped:** 6 tranches (U1 nuke legacy, U2 REST endpoints + service helpers, U3 live events, U4 UI API client, U5 4 UI pages + routes + parity, U6 MCP tool parity).
**Follow-ups / known gaps:**
- `jsdom` was not installed in the workspace when U5 ran — tests failed to boot even though they don't use jsdom rendering. Installed as devDep at root level; all 26 new page unit tests now pass. Pre-existing test failures (DB integration, git-provider round-trip, E2E server tests) remain at 18 failing test files / 23 failing tests.
- The root `mnm typecheck` fails on `@embedded-postgres/windows-x64` — pre-existing Windows-specific issue, unrelated to U5. All 15 individual package typechecks pass (including `@mnm/ui`).
- Breadcrumb `Breadcrumb.href` used instead of `to` — the `BreadcrumbContext` interface uses `href?` not `to`; all page breadcrumbs fixed.
- `WorkflowDefinition` schema uses flat `name` field and `agent` + `prompt_context` step fields (no `metadata.name`, no `kind`/`prompt`). Default template in GovernedWorkflowEditor corrected accordingly.
- Manual browser smoke test to be done by Tom tomorrow.
**Sign-off:** pending Tom's morning review.
