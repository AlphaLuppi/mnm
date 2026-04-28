# Cancel / Reactivate Governed Workflow Runs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the ability to cancel and reactivate `governed_workflow_runs` from MCP, REST, and UI, with cascade to step executions, audit log, live events, and dual-track auth (initiator OR `workflows:cancel_run` permission).

**Architecture:** Orthogonal `cancelled_at` flag on the run row (status enum untouched). All write endpoints (`launch_governed_step`, `complete_governed_step`) gate on `cancelled_at IS NULL`. Reactivate restores cancelled step executions to `pending`/`running` based on `started_at`. Auth dual-track in the service layer (not via `requirePermission` middleware) because we need to know the initiator.

**Tech Stack:** TypeScript, Bun monorepo, Drizzle ORM, PostgreSQL, Express, Zod, React 18, TanStack Query, shadcn/ui (Dialog, Textarea, Button), Vitest.

**Spec:** `docs/superpowers/specs/2026-04-27-cancel-governed-workflow-runs-design.md`.

**Branch:** Continue on `feat/artifact-persistence` (the spec was committed here). All tasks atomic-commit-and-push per project rule (`CLAUDE.md`).

---

## File Map

**Created:**
- `packages/db/src/migrations/0069_workflow_run_cancellation.sql` — DB migration
- `packages/db/src/migrations/0069_workflow_run_cancellation.test.ts` — migration test
- `ui/src/components/workflows/CancelRunDialog.tsx` — confirm dialog with required reason
- `ui/src/hooks/useWorkflowRunActions.ts` — TanStack Query mutations

**Modified:**
- `packages/db/src/schema/governed_workflow_runs.ts` — 4 new columns
- `packages/db/src/schema/governed_step_executions.ts` — add `"cancelled"` to enum
- `packages/db/src/seed.ts` — wire new permission to Admin/Owner roles
- `packages/shared/src/contracts/permissions.ts` — `WORKFLOWS_CANCEL_RUN`
- `packages/shared/src/contracts/live-events.ts` (or wherever `LiveEventType` lives) — add `governed_run.cancelled` and `governed_run.reactivated`
- `packages/governed-workflows/src/errors.ts` — 5 new error codes
- `server/src/realtime/emitters/governed-run-events.ts` — `emitRunCancelled`, `emitRunReactivated`
- `server/src/services/governed-workflows.ts` — `cancelRun`, `reactivateRun`, guard `launchStep` + `completeStep`
- `server/src/services/governed-workflows-extensions.ts` — extend `listRuns` SELECT with new columns
- `server/src/mcp/tools/governed-workflows.tool.ts` — register 2 new tools, enrich existing 2
- `server/src/routes/governed-workflows-ui.ts` — 2 new POST routes
- `ui/src/pages/GovernedWorkflowRuns.tsx` — actions column + cancelled badge
- `ui/src/pages/GovernedWorkflowRunDetail.tsx` — banner + steps display + cancel button

**Tests:**
- `server/src/services/__tests__/governed-workflows.test.ts` — service-level
- `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts` — MCP-level
- `server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts` — full lifecycle E2E
- `ui/src/components/workflows/__tests__/CancelRunDialog.test.tsx` — dialog unit test (Vitest + Testing Library)

---

## Task 1: DB migration + Drizzle schema

**Files:**
- Create: `packages/db/src/migrations/0069_workflow_run_cancellation.sql`
- Create: `packages/db/src/migrations/0069_workflow_run_cancellation.test.ts`
- Modify: `packages/db/src/schema/governed_workflow_runs.ts`
- Modify: `packages/db/src/schema/governed_step_executions.ts`

- [ ] **Step 1.1: Write the migration test (failing)**

```ts
// packages/db/src/migrations/0069_workflow_run_cancellation.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { setupTestDb, type TestDb } from "@mnm/test-utils";

describe("migration 0069 — workflow run cancellation", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await setupTestDb({ migrate: true });
  });

  it("adds cancelled_at, cancelled_by_actor_id, cancelled_by_actor_type, cancellation_reason to governed_workflow_runs", async () => {
    const cols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'governed_workflow_runs'
        AND column_name IN ('cancelled_at','cancelled_by_actor_id','cancelled_by_actor_type','cancellation_reason')
    `);
    const names = (cols.rows as Array<{ column_name: string }>).map((r) => r.column_name).sort();
    expect(names).toEqual([
      "cancellation_reason",
      "cancelled_at",
      "cancelled_by_actor_id",
      "cancelled_by_actor_type",
    ]);
  });

  it("creates partial index governed_workflow_runs_cancelled_at_idx", async () => {
    const idx = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'governed_workflow_runs'
        AND indexname = 'governed_workflow_runs_cancelled_at_idx'
    `);
    expect(idx.rows.length).toBe(1);
  });

  it("adds 'cancelled' value to the governed_step_state enum", async () => {
    const vals = await db.execute(sql`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = 'governed_step_state'::regtype
    `);
    const labels = (vals.rows as Array<{ enumlabel: string }>).map((r) => r.enumlabel);
    expect(labels).toContain("cancelled");
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `bun test packages/db/src/migrations/0069_workflow_run_cancellation.test.ts`
Expected: FAIL — migration file not found / columns missing.

- [ ] **Step 1.3: Write the migration SQL**

```sql
-- packages/db/src/migrations/0069_workflow_run_cancellation.sql
-- Cancel/Reactivate governed workflow runs.
-- Spec: docs/superpowers/specs/2026-04-27-cancel-governed-workflow-runs-design.md §1.

ALTER TABLE "governed_workflow_runs"
  ADD COLUMN IF NOT EXISTS "cancelled_at"            timestamptz,
  ADD COLUMN IF NOT EXISTS "cancelled_by_actor_id"   text,
  ADD COLUMN IF NOT EXISTS "cancelled_by_actor_type" text,
  ADD COLUMN IF NOT EXISTS "cancellation_reason"     text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "governed_workflow_runs_cancelled_at_idx"
  ON "governed_workflow_runs" ("company_id", "cancelled_at")
  WHERE "cancelled_at" IS NOT NULL;
--> statement-breakpoint

-- ALTER TYPE ... ADD VALUE is non-transactional; safe to re-run because
-- IF NOT EXISTS guards the duplicate-add. Postgres 12+ supports this.
ALTER TYPE "governed_step_state" ADD VALUE IF NOT EXISTS 'cancelled';
```

- [ ] **Step 1.4: Update `governed_workflow_runs.ts` Drizzle schema**

Modify `packages/db/src/schema/governed_workflow_runs.ts` — add 4 nullable columns inside the `pgTable` call, after `paramsJson`:

```ts
    paramsJson: jsonb("params_json").$type<Record<string, unknown>>().notNull().default({}),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByActorId: text("cancelled_by_actor_id"),
    cancelledByActorType: text("cancelled_by_actor_type").$type<AuditActorType>(),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
```

Then in the index block, add:

```ts
    cancelledAtIdx: index("governed_workflow_runs_cancelled_at_idx")
      .on(table.companyId, table.cancelledAt)
      .where(sql`${table.cancelledAt} IS NOT NULL`),
```

(Add `import { sql } from "drizzle-orm";` at the top if not already present.)

- [ ] **Step 1.5: Update `governed_step_executions.ts` enum**

Modify `packages/db/src/schema/governed_step_executions.ts:14-20` — add `"cancelled"` to the array literal:

```ts
export const GOVERNED_STEP_STATES = [
  "pending",
  "running",
  "gate_eval",
  "succeeded",
  "failed",
  "cancelled",
] as const;
```

- [ ] **Step 1.6: Run test, verify pass**

Run: `bun test packages/db/src/migrations/0069_workflow_run_cancellation.test.ts`
Expected: PASS (3/3).

- [ ] **Step 1.7: Run full DB test suite**

Run: `bun test packages/db`
Expected: PASS — no regression on existing schema tests.

- [ ] **Step 1.8: Typecheck the DB package**

Run: `bun run typecheck`
Expected: PASS for `packages/db`.

- [ ] **Step 1.9: Commit and push**

```bash
git add packages/db/src/migrations/0069_workflow_run_cancellation.sql \
        packages/db/src/migrations/0069_workflow_run_cancellation.test.ts \
        packages/db/src/schema/governed_workflow_runs.ts \
        packages/db/src/schema/governed_step_executions.ts
git commit -m "feat(db): add cancellation columns to governed_workflow_runs (0069)"
git push
```

---

## Task 2: Permission constant + seed wiring

**Files:**
- Modify: `packages/shared/src/contracts/permissions.ts`
- Modify: `packages/db/src/seed.ts`

- [ ] **Step 2.1: Write a failing seed test for the new permission**

Append to (or create) `packages/db/src/seed.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { setupTestDb, runSeed } from "@mnm/test-utils";
import { rolePermissions, roles, permissions } from "@mnm/db";
import { eq, and } from "drizzle-orm";
import { PERMISSIONS } from "@mnm/shared";

describe("seed — workflows:cancel_run permission", () => {
  it("attaches WORKFLOWS_CANCEL_RUN to the Admin and Owner roles", async () => {
    const db = await setupTestDb({ migrate: true });
    await runSeed(db);

    for (const roleName of ["Admin", "Owner"]) {
      const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
      expect(role, `role ${roleName} must be seeded`).toBeDefined();

      const [perm] = await db.select().from(permissions)
        .where(eq(permissions.key, PERMISSIONS.WORKFLOWS_CANCEL_RUN));
      expect(perm, "WORKFLOWS_CANCEL_RUN permission must be seeded").toBeDefined();

      const [link] = await db.select().from(rolePermissions)
        .where(and(
          eq(rolePermissions.roleId, role.id),
          eq(rolePermissions.permissionId, perm.id),
        ));
      expect(link, `role ${roleName} must have WORKFLOWS_CANCEL_RUN`).toBeDefined();
    }
  });
});
```

If `runSeed` / table imports differ, adapt to the existing seed-test pattern in the repo (search `seed.test.ts` first).

- [ ] **Step 2.2: Run test, verify it fails**

Run: `bun test packages/db/src/seed.test.ts`
Expected: FAIL — `WORKFLOWS_CANCEL_RUN` not found in `PERMISSIONS`.

- [ ] **Step 2.3: Add the permission constant**

Modify `packages/shared/src/contracts/permissions.ts`:

In the `PERMISSIONS` object (after `WORKFLOWS_ENFORCE`):

```ts
  WORKFLOWS_ENFORCE: "workflows:enforce",
  WORKFLOWS_CANCEL_RUN: "workflows:cancel_run",
```

In the metadata map (after `WORKFLOWS_ENFORCE` entry):

```ts
  [PERMISSIONS.WORKFLOWS_ENFORCE]: { category: "workflows", description: "Activer/désactiver l'enforcement", destructive: false },
  [PERMISSIONS.WORKFLOWS_CANCEL_RUN]: { category: "workflows", description: "Annuler ou réactiver les runs de workflow", destructive: false },
```

- [ ] **Step 2.4: Wire the permission into the seed**

Open `packages/db/src/seed.ts`. Find where Admin/Owner roles get their permissions (search for `WORKFLOWS_ENFORCE` or `WORKFLOWS_CREATE`). Add `PERMISSIONS.WORKFLOWS_CANCEL_RUN` to whatever array/list those roles iterate.

If the seed assigns permissions per-role explicitly, add the new key to both the Admin and Owner arrays. If the seed grants "all workflows:* permissions", verify the new key is included by the wildcard logic — adjust if necessary.

- [ ] **Step 2.5: Run test, verify pass**

Run: `bun test packages/db/src/seed.test.ts`
Expected: PASS.

- [ ] **Step 2.6: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 2.7: Commit and push**

```bash
git add packages/shared/src/contracts/permissions.ts \
        packages/db/src/seed.ts \
        packages/db/src/seed.test.ts
git commit -m "feat(rbac): add workflows:cancel_run permission to Admin/Owner"
git push
```

---

## Task 3: Error codes

**Files:**
- Modify: `packages/governed-workflows/src/errors.ts`

- [ ] **Step 3.1: Write a failing test that imports the new codes**

Append to `packages/governed-workflows/src/__tests__/errors.test.ts` (create if missing):

```ts
import { describe, it, expect } from "vitest";
import { WORKFLOW_ERROR_CODES } from "../errors.js";

describe("WORKFLOW_ERROR_CODES — cancellation codes", () => {
  it("exports the 5 cancellation-related codes", () => {
    expect(WORKFLOW_ERROR_CODES.WORKFLOW_RUN_CANCELLED).toBe("WORKFLOW_RUN_CANCELLED");
    expect(WORKFLOW_ERROR_CODES.WORKFLOW_RUN_ALREADY_CANCELLED).toBe("WORKFLOW_RUN_ALREADY_CANCELLED");
    expect(WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_CANCELLED).toBe("WORKFLOW_RUN_NOT_CANCELLED");
    expect(WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_ACTIVE).toBe("WORKFLOW_RUN_NOT_ACTIVE");
    expect(WORKFLOW_ERROR_CODES.WORKFLOW_FORBIDDEN).toBe("WORKFLOW_FORBIDDEN");
  });
});
```

- [ ] **Step 3.2: Run test, verify it fails**

Run: `bun test packages/governed-workflows/src/__tests__/errors.test.ts`
Expected: FAIL — codes undefined.

- [ ] **Step 3.3: Add the codes**

Modify `packages/governed-workflows/src/errors.ts`. Inside `WORKFLOW_ERROR_CODES = Object.freeze({ ... })`, append:

```ts
  WORKFLOW_RUN_CANCELLED: "WORKFLOW_RUN_CANCELLED",
  WORKFLOW_RUN_ALREADY_CANCELLED: "WORKFLOW_RUN_ALREADY_CANCELLED",
  WORKFLOW_RUN_NOT_CANCELLED: "WORKFLOW_RUN_NOT_CANCELLED",
  WORKFLOW_RUN_NOT_ACTIVE: "WORKFLOW_RUN_NOT_ACTIVE",
  WORKFLOW_FORBIDDEN: "WORKFLOW_FORBIDDEN",
```

- [ ] **Step 3.4: Run test, verify pass**

Run: `bun test packages/governed-workflows/src/__tests__/errors.test.ts`
Expected: PASS.

- [ ] **Step 3.5: Commit and push**

```bash
git add packages/governed-workflows/src/errors.ts \
        packages/governed-workflows/src/__tests__/errors.test.ts
git commit -m "feat(governed-workflows): add cancellation error codes"
git push
```

---

## Task 4: LiveEvent types + emit helpers

**Files:**
- Modify: `packages/shared/src/contracts/live-events.ts` (or wherever `LiveEventType` is defined — grep `LiveEventType` to confirm)
- Modify: `server/src/realtime/emitters/governed-run-events.ts`
- Test: `server/src/realtime/emitters/__tests__/governed-run-events.test.ts`

- [ ] **Step 4.1: Locate `LiveEventType`**

```bash
grep -rn "type LiveEventType\|LiveEventType =" packages/shared/src
```

Note the file path. The current types include `governed_run.step_updated` and `governed_run.gate_evaluated`.

- [ ] **Step 4.2: Add the new event type strings**

In the file from 4.1, add the two new union members:

```ts
| "governed_run.cancelled"
| "governed_run.reactivated"
```

- [ ] **Step 4.3: Write failing test for emit helpers**

Append to `server/src/realtime/emitters/__tests__/governed-run-events.test.ts`:

```ts
import { emitRunCancelled, emitRunReactivated, type PublishFn } from "../governed-run-events.js";

describe("emitRunCancelled", () => {
  it("calls publish with governed_run.cancelled and the correct payload", () => {
    const publish = vi.fn() as ReturnType<typeof vi.fn> & PublishFn;
    emitRunCancelled({
      publish,
      companyId: "company-1",
      runId: "run-1",
      cancelledAt: new Date("2026-04-27T10:00:00Z"),
      cancelledByActorId: "user-1",
      cancelledByActorType: "user",
      reason: "by mistake",
      cancelledStepIds: ["step-1", "step-2"],
    });
    expect(publish).toHaveBeenCalledWith({
      companyId: "company-1",
      type: "governed_run.cancelled",
      payload: {
        runId: "run-1",
        cancelledAt: "2026-04-27T10:00:00.000Z",
        cancelledByActorId: "user-1",
        cancelledByActorType: "user",
        reason: "by mistake",
        cancelledStepIds: ["step-1", "step-2"],
      },
    });
  });
});

describe("emitRunReactivated", () => {
  it("calls publish with governed_run.reactivated and the correct payload", () => {
    const publish = vi.fn() as ReturnType<typeof vi.fn> & PublishFn;
    emitRunReactivated({
      publish,
      companyId: "company-1",
      runId: "run-1",
      reactivatedByActorId: "user-1",
      reactivatedByActorType: "user",
      reactivatedStepIds: ["step-1"],
    });
    expect(publish).toHaveBeenCalledWith({
      companyId: "company-1",
      type: "governed_run.reactivated",
      payload: {
        runId: "run-1",
        reactivatedByActorId: "user-1",
        reactivatedByActorType: "user",
        reactivatedStepIds: ["step-1"],
      },
    });
  });
});
```

- [ ] **Step 4.4: Run test, verify it fails**

Run: `bun test server/src/realtime/emitters`
Expected: FAIL — `emitRunCancelled` not exported.

- [ ] **Step 4.5: Implement the emit helpers**

Append to `server/src/realtime/emitters/governed-run-events.ts`:

```ts
import type { AuditActorType } from "@mnm/shared";

export function emitRunCancelled(args: {
  publish: PublishFn;
  companyId: string;
  runId: string;
  cancelledAt: Date;
  cancelledByActorId: string;
  cancelledByActorType: AuditActorType;
  reason: string;
  cancelledStepIds: string[];
}): void {
  args.publish({
    companyId: args.companyId,
    type: "governed_run.cancelled",
    payload: {
      runId: args.runId,
      cancelledAt: args.cancelledAt.toISOString(),
      cancelledByActorId: args.cancelledByActorId,
      cancelledByActorType: args.cancelledByActorType,
      reason: args.reason,
      cancelledStepIds: args.cancelledStepIds,
    },
  });
}

export function emitRunReactivated(args: {
  publish: PublishFn;
  companyId: string;
  runId: string;
  reactivatedByActorId: string;
  reactivatedByActorType: AuditActorType;
  reactivatedStepIds: string[];
}): void {
  args.publish({
    companyId: args.companyId,
    type: "governed_run.reactivated",
    payload: {
      runId: args.runId,
      reactivatedByActorId: args.reactivatedByActorId,
      reactivatedByActorType: args.reactivatedByActorType,
      reactivatedStepIds: args.reactivatedStepIds,
    },
  });
}
```

(The `AuditActorType` import lives alongside the existing `LiveEventType` import at the top of the file. Add it if missing.)

- [ ] **Step 4.6: Run test, verify pass**

Run: `bun test server/src/realtime/emitters`
Expected: PASS.

- [ ] **Step 4.7: Commit and push**

```bash
git add packages/shared/src/contracts/ \
        server/src/realtime/emitters/governed-run-events.ts \
        server/src/realtime/emitters/__tests__/governed-run-events.test.ts
git commit -m "feat(live-events): add governed_run.cancelled + governed_run.reactivated emitters"
git push
```

---

## Task 5: `cancelRun` service method

**Files:**
- Modify: `server/src/services/governed-workflows.ts`
- Test: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 5.1: Write failing tests for `cancelRun`**

Append to `server/src/services/__tests__/governed-workflows.test.ts` a new `describe("cancelRun", ...)` block.

Cases to cover (one `it` each — write actual test code, not placeholders):

```ts
describe("cancelRun", () => {
  // Use the test harness already present in the file (companyId, db, actor factories)
  // Find the existing `setupRun()` / `launchRun()` helper and reuse it.

  it("happy path: marks run cancelled, cascades steps, emits live event, audits", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    const publish = vi.fn();
    const result = await governedWorkflowService.cancelRun({
      runId, companyId, actor,
      reason: "tom mis-launched",
      publishLiveEvent: publish,
    });
    expect(result.cancelledStepIds.length).toBeGreaterThan(0);
    const [run] = await db.select().from(governedWorkflowRuns).where(eq(governedWorkflowRuns.id, runId));
    expect(run.cancelledAt).toBeInstanceOf(Date);
    expect(run.cancellationReason).toBe("tom mis-launched");
    expect(run.cancelledByActorId).toBe(actor.id);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ type: "governed_run.cancelled" }));
    // Audit row inserted:
    const [audit] = await db.select().from(auditLog).where(
      and(eq(auditLog.eventType, "governed_run.cancelled"), eq(auditLog.companyId, companyId)),
    );
    expect(audit).toBeDefined();
    expect((audit.metadata as any).runId).toBe(runId);
  });

  it("cascades pending/running/gate_eval steps to cancelled, leaves succeeded/failed alone", async () => {
    const { runId, succeededStepId, runningStepId, pendingStepId, actor } = await launchRunWithMixedSteps();
    await governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "ok cancel", publishLiveEvent: vi.fn() });
    const steps = await db.select().from(governedStepExecutions).where(eq(governedStepExecutions.runId, runId));
    expect(steps.find((s) => s.id === succeededStepId)?.state).toBe("succeeded");
    expect(steps.find((s) => s.id === runningStepId)?.state).toBe("cancelled");
    expect(steps.find((s) => s.id === pendingStepId)?.state).toBe("cancelled");
  });

  it("rejects when status='completed'", async () => {
    const { runId, actor } = await launchAndCompleteRun();
    await expect(governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "after-the-fact", publishLiveEvent: vi.fn() }))
      .rejects.toMatchObject({ code: "WORKFLOW_RUN_NOT_ACTIVE" });
  });

  it("rejects when already cancelled", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    await governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "first", publishLiveEvent: vi.fn() });
    await expect(governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "second", publishLiveEvent: vi.fn() }))
      .rejects.toMatchObject({ code: "WORKFLOW_RUN_ALREADY_CANCELLED" });
  });

  it("rejects non-initiator actor without permission", async () => {
    const { runId } = await launchRunWithRunningStep();
    const otherActor = await makeActorWithoutPermission();
    await expect(governedWorkflowService.cancelRun({ runId, companyId, actor: otherActor, reason: "intruder", publishLiveEvent: vi.fn() }))
      .rejects.toMatchObject({ code: "WORKFLOW_FORBIDDEN" });
  });

  it("allows initiator without permission", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    await expect(governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "owner cancels", publishLiveEvent: vi.fn() }))
      .resolves.toBeDefined();
  });

  it("allows non-initiator actor with WORKFLOWS_CANCEL_RUN permission", async () => {
    const { runId } = await launchRunWithRunningStep();
    const adminActor = await makeActorWithPermission(PERMISSIONS.WORKFLOWS_CANCEL_RUN);
    await expect(governedWorkflowService.cancelRun({ runId, companyId, actor: adminActor, reason: "admin cancels", publishLiveEvent: vi.fn() }))
      .resolves.toBeDefined();
  });

  it("rejects reason shorter than 5 chars", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    await expect(governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "no", publishLiveEvent: vi.fn() }))
      .rejects.toMatchObject({ code: "WORKFLOW_INVALID_INPUT" });
  });
});
```

If helpers `launchRunWithRunningStep`, `launchRunWithMixedSteps`, `launchAndCompleteRun`, `makeActorWithoutPermission`, `makeActorWithPermission` don't exist, add them to the test file's local helper section, modeled on existing helpers in the same test file.

- [ ] **Step 5.2: Run tests, verify they fail**

Run: `bun test server/src/services/__tests__/governed-workflows.test.ts`
Expected: FAIL — `cancelRun` not implemented.

- [ ] **Step 5.3: Add the `assertCanCancelRun` helper**

Inside `server/src/services/governed-workflows.ts` (helper section, before the public service object), add:

```ts
import { PERMISSIONS } from "@mnm/shared";
import { rolePermissions, permissions, userRoles } from "@mnm/db"; // adjust to actual schema names

async function actorHasCancelPermission(
  db: Db,
  args: { companyId: string; actor: Actor },
): Promise<boolean> {
  // Resolve the userId we check permissions for. Agents inherit their creator.
  let userId: string | null = null;
  if (args.actor.type === "user") userId = args.actor.id;
  else if (args.actor.type === "agent") userId = args.actor.createdByUserId ?? null;
  if (!userId) return false;

  const rows = await db
    .select({ key: permissions.key })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(
      eq(userRoles.userId, userId),
      eq(userRoles.companyId, args.companyId),
      eq(permissions.key, PERMISSIONS.WORKFLOWS_CANCEL_RUN),
    ));
  return rows.length > 0;
}

function assertCanCancelRun(args: {
  actor: Actor;
  run: { initiatedByActorId: string };
  hasPermission: boolean;
}): void {
  if (args.actor.id === args.run.initiatedByActorId) return;
  if (args.hasPermission) return;
  throw new GovernedWorkflowError(
    WORKFLOW_ERROR_CODES.WORKFLOW_FORBIDDEN,
    "You can only cancel runs you initiated, or you need workflows:cancel_run permission.",
  );
}
```

The actor type/permission table names in this snippet are best-effort. Read `server/src/middleware/require-permission.js` to mirror its exact join — re-use whatever helper that middleware already exposes if any; the goal is one source of truth.

- [ ] **Step 5.4: Add the `cancelRun` method**

Inside the same file, in the public `governedWorkflowService` factory's returned object, add a new method:

```ts
async cancelRun(args: {
  runId: string;
  companyId: string;
  actor: Actor;
  reason: string;
  publishLiveEvent: PublishFn;
}): Promise<{ runId: string; cancelledAt: Date; cancelledStepIds: string[] }> {
  // Zod-validate input early.
  if (typeof args.reason !== "string" || args.reason.length < 5) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_INPUT,
      "Cancellation reason must be at least 5 characters.",
    );
  }

  return await db.transaction(async (tx) => {
    // Lock the run row.
    const [run] = await tx
      .select()
      .from(governedWorkflowRuns)
      .where(and(
        eq(governedWorkflowRuns.id, args.runId),
        eq(governedWorkflowRuns.companyId, args.companyId),
      ))
      .for("update");
    if (!run) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
        `Run ${args.runId} not found.`,
      );
    }
    if (run.status !== "active") {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_ACTIVE,
        `Run is ${run.status}, only active runs can be cancelled.`,
      );
    }
    if (run.cancelledAt !== null) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_RUN_ALREADY_CANCELLED,
        `Run ${args.runId} is already cancelled (since ${run.cancelledAt.toISOString()}).`,
      );
    }

    const hasPermission = await actorHasCancelPermission(tx as unknown as Db, {
      companyId: args.companyId, actor: args.actor,
    });
    assertCanCancelRun({ actor: args.actor, run, hasPermission });

    const cancelledAt = new Date();

    await tx
      .update(governedWorkflowRuns)
      .set({
        cancelledAt,
        cancelledByActorId: args.actor.id,
        cancelledByActorType: args.actor.type,
        cancellationReason: args.reason,
        updatedAt: cancelledAt,
      })
      .where(eq(governedWorkflowRuns.id, args.runId));

    const cascaded = await tx
      .update(governedStepExecutions)
      .set({ state: "cancelled" })
      .where(and(
        eq(governedStepExecutions.runId, args.runId),
        inArray(governedStepExecutions.state, ["pending", "running", "gate_eval"]),
      ))
      .returning({ id: governedStepExecutions.id });
    const cancelledStepIds = cascaded.map((r) => r.id);

    await tx.insert(auditLog).values({
      companyId: args.companyId,
      actorType: args.actor.type,
      actorId: args.actor.id,
      eventType: "governed_run.cancelled",
      metadata: { runId: args.runId, reason: args.reason, cancelledStepIds },
      createdAt: cancelledAt,
    });

    emitRunCancelled({
      publish: args.publishLiveEvent,
      companyId: args.companyId,
      runId: args.runId,
      cancelledAt,
      cancelledByActorId: args.actor.id,
      cancelledByActorType: args.actor.type,
      reason: args.reason,
      cancelledStepIds,
    });

    return { runId: args.runId, cancelledAt, cancelledStepIds };
  });
},
```

(Add `inArray` to the `drizzle-orm` import. Add `auditLog` to the `@mnm/db` imports. Add `emitRunCancelled` to the `governed-run-events` import. Add `WORKFLOW_INVALID_INPUT` to the error codes if it doesn't already exist — search first.)

- [ ] **Step 5.5: Run tests, verify pass**

Run: `bun test server/src/services/__tests__/governed-workflows.test.ts -t "cancelRun"`
Expected: PASS (8/8).

- [ ] **Step 5.6: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 5.7: Commit and push**

```bash
git add server/src/services/governed-workflows.ts \
        server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(governed-workflows): cancelRun service method with cascade + audit"
git push
```

---

## Task 6: `reactivateRun` service method

**Files:**
- Modify: `server/src/services/governed-workflows.ts`
- Test: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 6.1: Write failing tests**

Append a new `describe("reactivateRun", ...)` block:

```ts
describe("reactivateRun", () => {
  it("happy path: clears cancelled_at, restores steps, emits, audits", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    await governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "oops", publishLiveEvent: vi.fn() });

    const publish = vi.fn();
    const result = await governedWorkflowService.reactivateRun({ runId, companyId, actor, publishLiveEvent: publish });
    expect(result.reactivatedStepIds.length).toBeGreaterThan(0);

    const [run] = await db.select().from(governedWorkflowRuns).where(eq(governedWorkflowRuns.id, runId));
    expect(run.cancelledAt).toBeNull();
    expect(run.cancelledByActorId).toBeNull();
    expect(run.cancellationReason).toBeNull();

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ type: "governed_run.reactivated" }));

    const [audit] = await db.select().from(auditLog)
      .where(and(eq(auditLog.eventType, "governed_run.reactivated"), eq(auditLog.companyId, companyId)));
    expect(audit).toBeDefined();
  });

  it("restores step to pending if started_at is null, running if not", async () => {
    const { runId, actor, runningStepId, pendingStepId } = await launchRunWithMixedSteps();
    await governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "ok", publishLiveEvent: vi.fn() });
    await governedWorkflowService.reactivateRun({ runId, companyId, actor, publishLiveEvent: vi.fn() });
    const steps = await db.select().from(governedStepExecutions).where(eq(governedStepExecutions.runId, runId));
    expect(steps.find((s) => s.id === pendingStepId)?.state).toBe("pending");
    expect(steps.find((s) => s.id === runningStepId)?.state).toBe("running");
  });

  it("rejects when run is not cancelled", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    await expect(governedWorkflowService.reactivateRun({ runId, companyId, actor, publishLiveEvent: vi.fn() }))
      .rejects.toMatchObject({ code: "WORKFLOW_RUN_NOT_CANCELLED" });
  });

  it("rejects non-initiator without permission", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    await governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "oops", publishLiveEvent: vi.fn() });
    const stranger = await makeActorWithoutPermission();
    await expect(governedWorkflowService.reactivateRun({ runId, companyId, actor: stranger, publishLiveEvent: vi.fn() }))
      .rejects.toMatchObject({ code: "WORKFLOW_FORBIDDEN" });
  });
});
```

- [ ] **Step 6.2: Run tests, verify they fail**

Run: `bun test server/src/services/__tests__/governed-workflows.test.ts -t "reactivateRun"`
Expected: FAIL — method not implemented.

- [ ] **Step 6.3: Implement `reactivateRun`**

Append to the same service object:

```ts
async reactivateRun(args: {
  runId: string;
  companyId: string;
  actor: Actor;
  publishLiveEvent: PublishFn;
}): Promise<{ runId: string; reactivatedStepIds: string[] }> {
  return await db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(governedWorkflowRuns)
      .where(and(
        eq(governedWorkflowRuns.id, args.runId),
        eq(governedWorkflowRuns.companyId, args.companyId),
      ))
      .for("update");
    if (!run) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
        `Run ${args.runId} not found.`,
      );
    }
    if (run.cancelledAt === null) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_CANCELLED,
        `Run ${args.runId} is not cancelled.`,
      );
    }

    const hasPermission = await actorHasCancelPermission(tx as unknown as Db, {
      companyId: args.companyId, actor: args.actor,
    });
    assertCanCancelRun({ actor: args.actor, run, hasPermission });

    const now = new Date();

    await tx
      .update(governedWorkflowRuns)
      .set({
        cancelledAt: null,
        cancelledByActorId: null,
        cancelledByActorType: null,
        cancellationReason: null,
        updatedAt: now,
      })
      .where(eq(governedWorkflowRuns.id, args.runId));

    // Restore each cancelled step to pending or running based on started_at.
    // We split into two UPDATEs so we can leverage a partial WHERE rather
    // than a CASE expression — clearer and easier to test.
    const restoredPending = await tx
      .update(governedStepExecutions)
      .set({ state: "pending" })
      .where(and(
        eq(governedStepExecutions.runId, args.runId),
        eq(governedStepExecutions.state, "cancelled"),
        isNull(governedStepExecutions.startedAt),
      ))
      .returning({ id: governedStepExecutions.id });

    const restoredRunning = await tx
      .update(governedStepExecutions)
      .set({ state: "running" })
      .where(and(
        eq(governedStepExecutions.runId, args.runId),
        eq(governedStepExecutions.state, "cancelled"),
        isNotNull(governedStepExecutions.startedAt),
      ))
      .returning({ id: governedStepExecutions.id });

    const reactivatedStepIds = [...restoredPending, ...restoredRunning].map((r) => r.id);

    await tx.insert(auditLog).values({
      companyId: args.companyId,
      actorType: args.actor.type,
      actorId: args.actor.id,
      eventType: "governed_run.reactivated",
      metadata: { runId: args.runId, reactivatedStepIds },
      createdAt: now,
    });

    emitRunReactivated({
      publish: args.publishLiveEvent,
      companyId: args.companyId,
      runId: args.runId,
      reactivatedByActorId: args.actor.id,
      reactivatedByActorType: args.actor.type,
      reactivatedStepIds,
    });

    return { runId: args.runId, reactivatedStepIds };
  });
},
```

(Add `isNotNull` to the `drizzle-orm` import. Add `emitRunReactivated` to the imports.)

- [ ] **Step 6.4: Run tests, verify pass**

Run: `bun test server/src/services/__tests__/governed-workflows.test.ts -t "reactivateRun"`
Expected: PASS (4/4).

- [ ] **Step 6.5: Commit and push**

```bash
git add server/src/services/governed-workflows.ts \
        server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(governed-workflows): reactivateRun service method"
git push
```

---

## Task 7: Guard `launchStep` and `completeStep`

**Files:**
- Modify: `server/src/services/governed-workflows.ts`
- Test: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 7.1: Write failing tests**

Append:

```ts
describe("launchStep + completeStep — cancelled run guard", () => {
  it("launchStep throws WORKFLOW_RUN_CANCELLED on a cancelled run", async () => {
    const { runId, actor, nextStepId } = await launchRunWithSucceededStep();
    await governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "halt", publishLiveEvent: vi.fn() });
    await expect(governedWorkflowService.launchStep({ runId, stepId: nextStepId, companyId, actor }))
      .rejects.toMatchObject({ code: "WORKFLOW_RUN_CANCELLED" });
  });

  it("completeStep throws WORKFLOW_RUN_CANCELLED on a cancelled run", async () => {
    const { runId, actor, runningStepId } = await launchRunWithRunningStep();
    await governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "halt", publishLiveEvent: vi.fn() });
    await expect(governedWorkflowService.completeStep({ runId, stepId: runningStepId, companyId, actor, artifact: {} }))
      .rejects.toMatchObject({ code: "WORKFLOW_RUN_CANCELLED" });
  });
});
```

- [ ] **Step 7.2: Run tests, verify they fail**

Run: `bun test server/src/services/__tests__/governed-workflows.test.ts -t "cancelled run guard"`
Expected: FAIL.

- [ ] **Step 7.3: Add the guard helper**

Inside `server/src/services/governed-workflows.ts`, near `assertCanCancelRun`, add:

```ts
function assertRunNotCancelled(run: {
  cancelledAt: Date | null;
  cancellationReason: string | null;
  id: string;
}): void {
  if (run.cancelledAt === null) return;
  throw new GovernedWorkflowError(
    WORKFLOW_ERROR_CODES.WORKFLOW_RUN_CANCELLED,
    `Run ${run.id} is cancelled (since ${run.cancelledAt.toISOString()}).`,
    [
      `Reason: ${run.cancellationReason ?? "(none)"}`,
      "Use mcp__plugin_mnm_mnm__reactivate_governed_workflow_run to resume.",
    ],
  );
}
```

- [ ] **Step 7.4: Wire the guard into `launchStep`**

In `launchStep`, after the existing run lookup (search for the section that fetches `governedWorkflowRuns` row early in the method) and before any state mutation, insert:

```ts
assertRunNotCancelled(run);
```

Make sure `run` includes `cancelledAt`, `cancellationReason`, and `id` in the SELECT. If the existing SELECT only fetches a subset, expand it.

- [ ] **Step 7.5: Wire the guard into `completeStep`**

In `completeStep`, after the run lookup (find the line that fetches the run via `getDefByRun(args.companyId, args.runId)` — note this fetches a definition, not the run row, so you may need to add a separate SELECT for the run inside the tx) and before any state mutation:

Add a run-row fetch immediately inside the transaction:

```ts
const [run] = await tx
  .select({
    id: governedWorkflowRuns.id,
    cancelledAt: governedWorkflowRuns.cancelledAt,
    cancellationReason: governedWorkflowRuns.cancellationReason,
  })
  .from(governedWorkflowRuns)
  .where(and(
    eq(governedWorkflowRuns.id, args.runId),
    eq(governedWorkflowRuns.companyId, args.companyId),
  ));
if (!run) {
  throw new GovernedWorkflowError(
    WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
    `Run ${args.runId} not found.`,
  );
}
assertRunNotCancelled(run);
```

Place this before the `governedStepExecutions` SELECT.

- [ ] **Step 7.6: Run tests, verify pass**

Run: `bun test server/src/services/__tests__/governed-workflows.test.ts -t "cancelled run guard"`
Expected: PASS.

Run: `bun test server/src/services/__tests__/governed-workflows.test.ts`
Expected: ALL PASS — verify no regression on existing launch/complete tests.

- [ ] **Step 7.7: Commit and push**

```bash
git add server/src/services/governed-workflows.ts \
        server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(governed-workflows): block launch/completeStep on cancelled runs"
git push
```

---

## Task 8: Enrich `listRuns` and `get_run` SELECTs

**Files:**
- Modify: `server/src/services/governed-workflows-extensions.ts` (the `listRuns` function around line 351)
- Modify: `server/src/services/governed-workflows.ts` (`getRun` method)
- Test: `server/src/services/__tests__/governed-workflows.test.ts`

- [ ] **Step 8.1: Write failing test**

```ts
describe("listRuns + getRun — surface cancellation columns", () => {
  it("listRuns returns cancelled_at and cancellation_reason for cancelled runs", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    await governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "test", publishLiveEvent: vi.fn() });
    const result = await governedWorkflowService.listRuns({ companyId, name: WORKFLOW_NAME });
    const row = result.items.find((r) => r.run_id === runId)!;
    expect(row.cancelled_at).not.toBeNull();
    expect(row.cancellation_reason).toBe("test");
  });

  it("getRun returns cancellation fields for cancelled runs", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    await governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "test", publishLiveEvent: vi.fn() });
    const run = await governedWorkflowService.getRun({ runId, companyId });
    expect(run.cancelled_at).not.toBeNull();
    expect(run.cancellation_reason).toBe("test");
    expect(run.cancelled_by_actor_id).toBe(actor.id);
    expect(run.cancelled_by_actor_type).toBe("user");
  });
});
```

- [ ] **Step 8.2: Run, verify fail**

Run: `bun test server/src/services/__tests__/governed-workflows.test.ts -t "surface cancellation"`
Expected: FAIL.

- [ ] **Step 8.3: Extend `listRuns` SELECT**

Modify `server/src/services/governed-workflows-extensions.ts:351+`:

In the SELECT clause inside `listRuns`, add the four columns:

```ts
.select({
  // ... existing fields ...
  cancelledAt: governedWorkflowRuns.cancelledAt,
  cancellationReason: governedWorkflowRuns.cancellationReason,
  cancelledByActorId: governedWorkflowRuns.cancelledByActorId,
  cancelledByActorType: governedWorkflowRuns.cancelledByActorType,
})
```

In the mapping that builds `items` (find where `run_id`, `status`, `started_at` are returned), add:

```ts
{
  run_id: row.id,
  // ...,
  cancelled_at: row.cancelledAt?.toISOString() ?? null,
  cancellation_reason: row.cancellationReason,
  cancelled_by_actor_id: row.cancelledByActorId,
  cancelled_by_actor_type: row.cancelledByActorType,
}
```

Update the `ListRunsResult` interface earlier in the same file with these four optional fields (typed as `string | null`).

- [ ] **Step 8.4: Extend `getRun` SELECT**

Modify the `getRun` method in `server/src/services/governed-workflows.ts` similarly: add the 4 columns to its SELECT and to its return shape.

- [ ] **Step 8.5: Run tests, verify pass**

Run: `bun test server/src/services/__tests__/governed-workflows.test.ts -t "surface cancellation"`
Expected: PASS.

- [ ] **Step 8.6: Commit and push**

```bash
git add server/src/services/governed-workflows.ts \
        server/src/services/governed-workflows-extensions.ts \
        server/src/services/__tests__/governed-workflows.test.ts
git commit -m "feat(governed-workflows): surface cancellation fields in listRuns/getRun"
git push
```

---

## Task 9: MCP tools

**Files:**
- Modify: `server/src/mcp/tools/governed-workflows.tool.ts`
- Test: `server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts`

- [ ] **Step 9.1: Write failing tests**

Append to the test file:

```ts
describe("MCP — cancel_governed_workflow_run", () => {
  it("cancels via MCP, returns run_id + cancelled_step_ids", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    const result = await callMcpTool("cancel_governed_workflow_run", {
      run_id: runId,
      reason: "via mcp",
    }, actor);
    expect(result.run_id).toBe(runId);
    expect(result.cancelled_at).toBeDefined();
    expect(result.cancelled_step_ids).toEqual(expect.any(Array));
  });

  it("rejects reason < 5 chars at the Zod layer", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    await expect(callMcpTool("cancel_governed_workflow_run", { run_id: runId, reason: "no" }, actor))
      .rejects.toThrow();
  });
});

describe("MCP — reactivate_governed_workflow_run", () => {
  it("reactivates via MCP, returns reactivated_step_ids", async () => {
    const { runId, actor } = await launchRunWithRunningStep();
    await governedWorkflowService.cancelRun({ runId, companyId, actor, reason: "before", publishLiveEvent: vi.fn() });
    const result = await callMcpTool("reactivate_governed_workflow_run", { run_id: runId }, actor);
    expect(result.run_id).toBe(runId);
    expect(result.reactivated_step_ids).toEqual(expect.any(Array));
  });
});
```

(Use whatever test harness this file already uses — find the existing `callMcpTool` helper or its equivalent and reuse it.)

- [ ] **Step 9.2: Run, verify fail**

Run: `bun test server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts -t "cancel_governed_workflow_run|reactivate_governed_workflow_run"`
Expected: FAIL — tools not registered.

- [ ] **Step 9.3: Register `cancel_governed_workflow_run`**

In `server/src/mcp/tools/governed-workflows.tool.ts`, find the section where `list_governed_workflow_runs` is registered (the most recently added tool — look at the bottom of the file).

Add a new tool registration:

```ts
server.registerTool(
  "cancel_governed_workflow_run",
  {
    description:
      "[Governed Workflows] Cancel a run. Cascades to running/pending/gate_eval step executions, blocks subsequent launch/complete calls until reactivated. Auth: initiator OR `workflows:cancel_run` permission.",
    inputSchema: {
      run_id: z.string().uuid(),
      reason: z.string().min(5, "reason must be at least 5 characters"),
    },
  },
  async (args, _extra) => {
    const { actor, companyId } = ensureMnmContext(_extra);
    const result = await governedWorkflowService.cancelRun({
      runId: args.run_id,
      companyId,
      actor,
      reason: args.reason,
      publishLiveEvent,
    });
    return {
      content: [
        { type: "text", text: JSON.stringify({
          run_id: result.runId,
          cancelled_at: result.cancelledAt.toISOString(),
          cancelled_step_ids: result.cancelledStepIds,
        }) },
      ],
    };
  },
);
```

(`ensureMnmContext` and `publishLiveEvent` are the existing helpers used in this file. Match the surrounding code style — if the existing tools use a different wrapping (`asTextContent`, structured returns, etc.), use that.)

- [ ] **Step 9.4: Register `reactivate_governed_workflow_run`**

Right after the cancel registration:

```ts
server.registerTool(
  "reactivate_governed_workflow_run",
  {
    description:
      "[Governed Workflows] Reactivate a cancelled run. Restores cancelled step executions to pending (if never started) or running (if started_at is set). Auth: initiator OR `workflows:cancel_run` permission.",
    inputSchema: {
      run_id: z.string().uuid(),
    },
  },
  async (args, _extra) => {
    const { actor, companyId } = ensureMnmContext(_extra);
    const result = await governedWorkflowService.reactivateRun({
      runId: args.run_id,
      companyId,
      actor,
      publishLiveEvent,
    });
    return {
      content: [
        { type: "text", text: JSON.stringify({
          run_id: result.runId,
          reactivated_step_ids: result.reactivatedStepIds,
        }) },
      ],
    };
  },
);
```

- [ ] **Step 9.5: Update `list_governed_workflow_runs` tool description**

In the same file, find the `list_governed_workflow_runs` registration. Update its description to mention the new fields:

```
Returns {items: [{run_id, status, started_at, completed_at, cancelled_at, cancellation_reason, cancelled_by_actor_id, cancelled_by_actor_type, git_tag, git_sha, ...}], total}.
```

Verify the JSON output already maps the new fields (it should from Task 8.3). If not, add them to the response builder.

- [ ] **Step 9.6: Update `get_governed_workflow_run` tool description**

Similarly: add `cancelled_at, cancelled_by_actor_id, cancelled_by_actor_type, cancellation_reason` to the description's return shape and the JSON response.

- [ ] **Step 9.7: Run tests, verify pass**

Run: `bun test server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts`
Expected: PASS — all 4 new tests + no regression.

- [ ] **Step 9.8: Commit and push**

```bash
git add server/src/mcp/tools/governed-workflows.tool.ts \
        server/src/mcp/tools/__tests__/governed-workflows.tool.test.ts
git commit -m "feat(mcp): cancel + reactivate governed workflow run tools"
git push
```

---

## Task 10: REST routes

**Files:**
- Modify: `server/src/routes/governed-workflows-ui.ts`
- Test: `server/src/routes/__tests__/governed-workflows-ui.test.ts` (or wherever the existing route tests live — find the test file for governed-workflows-ui and append)

- [ ] **Step 10.1: Locate the route test file**

```bash
ls server/src/routes/__tests__/governed-workflows*
```

Use the file that tests the runs list / detail routes for the new tests below.

- [ ] **Step 10.2: Write failing route tests**

```ts
describe("POST /companies/:companyId/governed-workflows/runs/:runId/cancel", () => {
  it("returns 200 with cancellation result when reason is valid and actor is initiator", async () => {
    const { runId, sessionCookie } = await setupActiveRunAsInitiator();
    const res = await request(app)
      .post(`/api/companies/${COMPANY_ID}/governed-workflows/runs/${runId}/cancel`)
      .set("Cookie", sessionCookie)
      .send({ reason: "by mistake" });
    expect(res.status).toBe(200);
    expect(res.body.runId).toBe(runId);
    expect(res.body.cancelledAt).toBeDefined();
    expect(res.body.cancelledStepIds).toEqual(expect.any(Array));
  });

  it("returns 400 for reason < 5 chars", async () => {
    const { runId, sessionCookie } = await setupActiveRunAsInitiator();
    const res = await request(app)
      .post(`/api/companies/${COMPANY_ID}/governed-workflows/runs/${runId}/cancel`)
      .set("Cookie", sessionCookie)
      .send({ reason: "no" });
    expect(res.status).toBe(400);
  });

  it("returns 409 when already cancelled", async () => {
    const { runId, sessionCookie } = await setupCancelledRunAsInitiator();
    const res = await request(app)
      .post(`/api/companies/${COMPANY_ID}/governed-workflows/runs/${runId}/cancel`)
      .set("Cookie", sessionCookie)
      .send({ reason: "second try" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("WORKFLOW_RUN_ALREADY_CANCELLED");
  });

  it("returns 403 when actor is not initiator and lacks permission", async () => {
    const { runId, otherSessionCookie } = await setupActiveRunWithStranger();
    const res = await request(app)
      .post(`/api/companies/${COMPANY_ID}/governed-workflows/runs/${runId}/cancel`)
      .set("Cookie", otherSessionCookie)
      .send({ reason: "intruder" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("WORKFLOW_FORBIDDEN");
  });
});

describe("POST /companies/:companyId/governed-workflows/runs/:runId/reactivate", () => {
  it("returns 200 when run is cancelled and actor is initiator", async () => {
    const { runId, sessionCookie } = await setupCancelledRunAsInitiator();
    const res = await request(app)
      .post(`/api/companies/${COMPANY_ID}/governed-workflows/runs/${runId}/reactivate`)
      .set("Cookie", sessionCookie)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.runId).toBe(runId);
    expect(res.body.reactivatedStepIds).toEqual(expect.any(Array));
  });

  it("returns 409 when run is not cancelled", async () => {
    const { runId, sessionCookie } = await setupActiveRunAsInitiator();
    const res = await request(app)
      .post(`/api/companies/${COMPANY_ID}/governed-workflows/runs/${runId}/reactivate`)
      .set("Cookie", sessionCookie)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("WORKFLOW_RUN_NOT_CANCELLED");
  });
});
```

- [ ] **Step 10.3: Run, verify fail**

Run: `bun test server/src/routes/__tests__/governed-workflows-ui.test.ts -t "/cancel|/reactivate"`
Expected: FAIL — routes return 404.

- [ ] **Step 10.4: Add the routes**

In `server/src/routes/governed-workflows-ui.ts`, find the section where existing run-scoped routes live (search `/runs/`). Add:

```ts
router.post(
  "/runs/:runId/cancel",
  async (req, res, next) => {
    try {
      const body = z.object({
        reason: z.string().min(5),
      }).parse(req.body);
      const result = await governedWorkflowService.cancelRun({
        runId: req.params.runId,
        companyId: req.params.companyId,
        actor: req.actor!,
        reason: body.reason,
        publishLiveEvent,
      });
      res.json({
        runId: result.runId,
        cancelledAt: result.cancelledAt.toISOString(),
        cancelledStepIds: result.cancelledStepIds,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/runs/:runId/reactivate",
  async (req, res, next) => {
    try {
      const result = await governedWorkflowService.reactivateRun({
        runId: req.params.runId,
        companyId: req.params.companyId,
        actor: req.actor!,
        publishLiveEvent,
      });
      res.json({
        runId: result.runId,
        reactivatedStepIds: result.reactivatedStepIds,
      });
    } catch (e) {
      next(e);
    }
  },
);
```

(Match existing handler style — there may be an `asyncHandler` wrapper or central error mapper. If the existing routes pass a `db` arg explicitly, pass it the same way.)

- [ ] **Step 10.5: Add HTTP status mapping for new error codes**

Find the central `GovernedWorkflowError` → HTTP status switch (search `WORKFLOW_NOT_FOUND` in the routes file or middleware). Add:

```ts
case "WORKFLOW_RUN_CANCELLED": return 423; // Locked
case "WORKFLOW_RUN_ALREADY_CANCELLED": return 409;
case "WORKFLOW_RUN_NOT_CANCELLED": return 409;
case "WORKFLOW_RUN_NOT_ACTIVE": return 409;
case "WORKFLOW_FORBIDDEN": return 403;
case "WORKFLOW_INVALID_INPUT": return 400;
```

If no central switch exists yet (`GovernedWorkflowError` is rendered ad-hoc per route), add the mapping inside each new handler's `catch`. But prefer centralizing if the existing pattern allows.

- [ ] **Step 10.6: Run tests, verify pass**

Run: `bun test server/src/routes/__tests__/governed-workflows-ui.test.ts`
Expected: PASS — 6 new tests + no regression.

- [ ] **Step 10.7: Commit and push**

```bash
git add server/src/routes/governed-workflows-ui.ts \
        server/src/routes/__tests__/governed-workflows-ui.test.ts
git commit -m "feat(api): POST /runs/:runId/cancel + /reactivate endpoints"
git push
```

---

## Task 11: UI mutation hooks

**Files:**
- Create: `ui/src/hooks/useWorkflowRunActions.ts`

- [ ] **Step 11.1: Write the hook file**

```ts
// ui/src/hooks/useWorkflowRunActions.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { useCurrentCompanyId } from "@/hooks/useCurrentCompanyId";

interface CancelRunResponse {
  runId: string;
  cancelledAt: string;
  cancelledStepIds: string[];
}

interface ReactivateRunResponse {
  runId: string;
  reactivatedStepIds: string[];
}

export function useCancelRun(runId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const companyId = useCurrentCompanyId();
  return useMutation({
    mutationFn: async ({ reason }: { reason: string }): Promise<CancelRunResponse> => {
      return await apiClient.post(
        `/companies/${companyId}/governed-workflows/runs/${runId}/cancel`,
        { reason },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows", "runs"] });
      qc.invalidateQueries({ queryKey: ["workflows", "run", runId] });
      toast({ title: "Run annulé", description: "Le run a été annulé avec succès." });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const map: Record<string, string> = {
        WORKFLOW_RUN_ALREADY_CANCELLED: "Ce run est déjà annulé.",
        WORKFLOW_RUN_NOT_ACTIVE: "Seuls les runs actifs peuvent être annulés.",
        WORKFLOW_FORBIDDEN: "Vous n'avez pas la permission d'annuler ce run.",
      };
      toast({
        title: "Erreur",
        description: map[code] ?? err?.message ?? "Échec de l'annulation.",
        variant: "destructive",
      });
    },
  });
}

export function useReactivateRun(runId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const companyId = useCurrentCompanyId();
  return useMutation({
    mutationFn: async (): Promise<ReactivateRunResponse> => {
      return await apiClient.post(
        `/companies/${companyId}/governed-workflows/runs/${runId}/reactivate`,
        {},
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows", "runs"] });
      qc.invalidateQueries({ queryKey: ["workflows", "run", runId] });
      toast({ title: "Run réactivé", description: "Le run est de nouveau actif." });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const map: Record<string, string> = {
        WORKFLOW_RUN_NOT_CANCELLED: "Ce run n'est pas annulé.",
        WORKFLOW_FORBIDDEN: "Vous n'avez pas la permission de réactiver ce run.",
      };
      toast({
        title: "Erreur",
        description: map[code] ?? err?.message ?? "Échec de la réactivation.",
        variant: "destructive",
      });
    },
  });
}
```

(If `apiClient`, `useCurrentCompanyId`, or `useToast` paths differ in the codebase, fix them — search `import.*apiClient` in `ui/src/` to confirm.)

- [ ] **Step 11.2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 11.3: Commit and push**

```bash
git add ui/src/hooks/useWorkflowRunActions.ts
git commit -m "feat(ui): useCancelRun + useReactivateRun TanStack mutations"
git push
```

---

## Task 12: `CancelRunDialog` component

**Files:**
- Create: `ui/src/components/workflows/CancelRunDialog.tsx`
- Test: `ui/src/components/workflows/__tests__/CancelRunDialog.test.tsx`

- [ ] **Step 12.1: Write failing component test**

```tsx
// ui/src/components/workflows/__tests__/CancelRunDialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CancelRunDialog } from "../CancelRunDialog";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("CancelRunDialog", () => {
  it("renders header, description, textarea, and 2 buttons when open", () => {
    renderWithClient(<CancelRunDialog runId="run-1" workflowName="feature-dev" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Annuler le run/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Raison.*5 caract/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Garder actif/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmer l'annulation/ })).toBeInTheDocument();
  });

  it("disables confirm button when reason is < 5 chars", () => {
    renderWithClient(<CancelRunDialog runId="run-1" workflowName="x" open={true} onOpenChange={vi.fn()} />);
    const confirm = screen.getByRole("button", { name: /Confirmer/ });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Raison/i), { target: { value: "ab" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Raison/i), { target: { value: "abcde" } });
    expect(confirm).toBeEnabled();
  });

  it("calls onOpenChange(false) when 'Garder actif' is clicked", () => {
    const onOpenChange = vi.fn();
    renderWithClient(<CancelRunDialog runId="run-1" workflowName="x" open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Garder actif/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 12.2: Run, verify fail**

Run: `bun test ui/src/components/workflows`
Expected: FAIL — component not found.

- [ ] **Step 12.3: Create the component**

```tsx
// ui/src/components/workflows/CancelRunDialog.tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCancelRun } from "@/hooks/useWorkflowRunActions";

interface CancelRunDialogProps {
  runId: string;
  workflowName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CancelRunDialog({ runId, workflowName, open, onOpenChange, onSuccess }: CancelRunDialogProps) {
  const [reason, setReason] = useState("");
  const cancel = useCancelRun(runId);

  const isValid = reason.trim().length >= 5;

  const handleConfirm = async () => {
    if (!isValid) return;
    try {
      await cancel.mutateAsync({ reason: reason.trim() });
      setReason("");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // toast already shown by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler le run {workflowName}</DialogTitle>
          <DialogDescription>
            Les étapes en cours seront annulées. Le run pourra être réactivé plus tard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Raison de l'annulation (min 5 caractères)</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : run lancé par erreur"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Garder actif
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || cancel.isPending}
          >
            {cancel.isPending ? "Annulation..." : "Confirmer l'annulation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

If any of the imported `Dialog`, `Textarea`, `Label` components don't exist in `ui/src/components/ui/`, create them following the project's shadcn pattern. The CLAUDE.md rule mandates: "Always use UI library components — Never create custom/inline implementations."

- [ ] **Step 12.4: Run tests, verify pass**

Run: `bun test ui/src/components/workflows`
Expected: PASS (3/3).

- [ ] **Step 12.5: Commit and push**

```bash
git add ui/src/components/workflows/CancelRunDialog.tsx \
        ui/src/components/workflows/__tests__/CancelRunDialog.test.tsx
git commit -m "feat(ui): CancelRunDialog component with required reason"
git push
```

---

## Task 13: Integrate cancel/reactivate into the runs LIST page

**Files:**
- Modify: `ui/src/pages/GovernedWorkflowRuns.tsx`

- [ ] **Step 13.1: Read the existing list page**

Read `ui/src/pages/GovernedWorkflowRuns.tsx` end-to-end. Identify:
- The `useQuery` that fetches runs
- The table/grid render block
- Imports of icons (lucide)

- [ ] **Step 13.2: Extend the row type**

If the page declares an explicit `Run` type/interface, extend it with the 4 cancellation fields (`cancelled_at`, `cancellation_reason`, `cancelled_by_actor_id`, `cancelled_by_actor_type`) — type each as `string | null`.

If the type is inferred from a Zod schema in `packages/shared`, ensure the schema is also extended.

- [ ] **Step 13.3: Add the actions column**

In the table render, add a new column. Pseudo-structure:

```tsx
import { X, RotateCcw, Ban } from "lucide-react";
import { useReactivateRun } from "@/hooks/useWorkflowRunActions";
import { CancelRunDialog } from "@/components/workflows/CancelRunDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// inside the row render, where workflow status is displayed:
{run.cancelled_at && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge variant="secondary" className="ml-2">
        <Ban className="w-3 h-3 mr-1" /> Annulé
      </Badge>
    </TooltipTrigger>
    <TooltipContent>{run.cancellation_reason ?? "(aucune raison)"}</TooltipContent>
  </Tooltip>
)}

// new actions cell:
<td>
  <RunActionButton run={run} workflowName={workflowName} />
</td>
```

Then add `RunActionButton` as a small component at the bottom of the same file (or in a new sibling file `ui/src/components/workflows/RunActionButton.tsx` for cleanliness):

```tsx
function RunActionButton({ run, workflowName }: { run: Run; workflowName: string }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const reactivate = useReactivateRun(run.run_id);

  if (run.cancelled_at !== null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => reactivate.mutate()}
            disabled={reactivate.isPending}
            aria-label="Réactiver"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Réactiver</TooltipContent>
      </Tooltip>
    );
  }

  if (run.status === "active") {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setCancelOpen(true)} aria-label="Annuler">
              <X className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Annuler</TooltipContent>
        </Tooltip>
        <CancelRunDialog
          runId={run.run_id}
          workflowName={workflowName}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
        />
      </>
    );
  }

  return null; // completed runs: no action
}
```

If you create the sibling file, prefer that — keeps the page slim.

- [ ] **Step 13.4: Manual smoke check (until E2E)**

Run: `bun run dev`
Open the runs list page in the browser. Verify:
- Active run shows X button.
- Click X → dialog opens, validation works, submit cancels run.
- After cancel: badge "Annulé" appears, button switches to ↻.
- Click ↻ → run reactivates, badge disappears, button switches back to X.
- Completed run: no button.

- [ ] **Step 13.5: Typecheck + run UI tests**

```bash
bun run typecheck
bun test ui/src
```
Expected: PASS.

- [ ] **Step 13.6: Commit and push**

```bash
git add ui/src/pages/GovernedWorkflowRuns.tsx \
        ui/src/components/workflows/RunActionButton.tsx
git commit -m "feat(ui): cancel/reactivate buttons on runs list"
git push
```

---

## Task 14: Integrate into the run DETAIL page

**Files:**
- Modify: `ui/src/pages/GovernedWorkflowRunDetail.tsx`

- [ ] **Step 14.1: Read the page**

Identify where the header / action bar lives, and where the timeline of step executions is rendered.

- [ ] **Step 14.2: Add the cancellation banner**

At the top of the main content (above the timeline), conditional render:

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Ban, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CancelRunDialog } from "@/components/workflows/CancelRunDialog";
import { useReactivateRun } from "@/hooks/useWorkflowRunActions";

{run.cancelled_at && (
  <Alert variant="destructive" className="mb-4">
    <Ban className="h-4 w-4" />
    <AlertTitle>Run annulé</AlertTitle>
    <AlertDescription className="space-y-2">
      <div>
        Annulé le {format(new Date(run.cancelled_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
        {run.cancelled_by_actor_id && <> par {resolveActorName(run.cancelled_by_actor_id)}</>}
      </div>
      <div>
        Raison : {run.cancellation_reason ?? "(aucune)"}
      </div>
      <Button size="sm" variant="outline" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
        <RotateCcw className="h-4 w-4 mr-2" /> Réactiver
      </Button>
    </AlertDescription>
  </Alert>
)}
```

(`resolveActorName` may need to be looked up via existing user/agent fetch hooks. If it doesn't exist, render the raw ID as a fallback.)

- [ ] **Step 14.3: Add the cancel button to the action bar (when not cancelled)**

In the page header / action bar where actions like "Voir le workflow" live, conditionally render:

```tsx
{!run.cancelled_at && run.status === "active" && (
  <Button variant="outline" onClick={() => setCancelOpen(true)}>
    <X className="h-4 w-4 mr-2" /> Annuler le run
  </Button>
)}
<CancelRunDialog
  runId={run.run_id}
  workflowName={run.workflow_name}
  open={cancelOpen}
  onOpenChange={setCancelOpen}
/>
```

- [ ] **Step 14.4: Style cancelled steps in the timeline**

Find the step render block. Add a new state branch for `state === "cancelled"`:

```tsx
import { Ban } from "lucide-react";

// In the step state badge / icon switch:
case "cancelled":
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center text-muted-foreground opacity-70">
          <Ban className="h-4 w-4 mr-1" />
          Annulé
        </span>
      </TooltipTrigger>
      <TooltipContent>Annulé en cascade lors de l'annulation du run</TooltipContent>
    </Tooltip>
  );
```

Apply the `opacity-70` and `text-muted-foreground` class to the step row container as well so the whole step looks dimmed.

- [ ] **Step 14.5: Manual smoke check**

`bun run dev` → navigate to `/workflows/runs/<id>` for an active run. Click "Annuler le run" → dialog → cancel → page shows the Alert banner, steps are greyed with Ban icon. Click "Réactiver" → banner disappears, steps return to running/pending.

- [ ] **Step 14.6: Typecheck + tests**

```bash
bun run typecheck
bun test ui/src
```
Expected: PASS.

- [ ] **Step 14.7: Commit and push**

```bash
git add ui/src/pages/GovernedWorkflowRunDetail.tsx
git commit -m "feat(ui): cancel/reactivate banner + cancelled step styling on run detail"
git push
```

---

## Task 15: Live event listener wiring

**Files:**
- Modify: the existing UI hook that subscribes to `governed_run.*` events (search `governed_run.step_updated` in `ui/src/`)

- [ ] **Step 15.1: Locate the hook**

```bash
grep -rn "governed_run.step_updated" ui/src
```

Likely candidates: `ui/src/hooks/useWorkflowRunsLive.ts` or similar. Open the file.

- [ ] **Step 15.2: Add listeners for the two new event types**

Inside the existing event-type switch / handler, add:

```ts
case "governed_run.cancelled":
case "governed_run.reactivated":
  qc.invalidateQueries({ queryKey: ["workflows", "runs"] });
  if (event.payload?.runId) {
    qc.invalidateQueries({ queryKey: ["workflows", "run", event.payload.runId] });
  }
  break;
```

- [ ] **Step 15.3: Manual smoke**

Open two browser tabs on the runs list. Cancel a run in tab A → tab B should refresh the row without hitting F5. Reactivate likewise.

- [ ] **Step 15.4: Commit and push**

```bash
git add ui/src/hooks/useWorkflowRunsLive.ts # or whichever file
git commit -m "feat(ui): refresh on governed_run.cancelled + reactivated live events"
git push
```

---

## Task 16: End-to-end test

**Files:**
- Modify: `server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts`

- [ ] **Step 16.1: Write the E2E scenario**

Append (or create new test) :

```ts
describe("E2E — cancel + reactivate full cycle", () => {
  it("launch → complete step 1 → cancel → completeStep blocked → reactivate → finish", async () => {
    const { actor, companyId } = await setupTestWorkflow();
    const launchResult = await callMcpTool("launch_governed_workflow", {
      name: "feature-dev",
      params: { ticket_id: "TEST-1", gitlab_project: "x/y" },
    }, actor);
    const runId = launchResult.run_id;

    // Complete step 1
    await callMcpTool("launch_governed_step", { run_id: runId, step_id: "tech-design" }, actor);
    await callMcpTool("complete_governed_step", { run_id: runId, step_id: "tech-design", artifact: { design_md: "..." } }, actor);

    // Cancel
    const cancelResult = await callMcpTool("cancel_governed_workflow_run", { run_id: runId, reason: "scenario-cancel" }, actor);
    expect(cancelResult.cancelled_step_ids.length).toBeGreaterThanOrEqual(0);

    // Try to launch step 2: must be blocked
    await expect(callMcpTool("launch_governed_step", { run_id: runId, step_id: "dev" }, actor))
      .rejects.toMatchObject({ code: "WORKFLOW_RUN_CANCELLED" });

    // Try to complete step 2: must be blocked
    await expect(callMcpTool("complete_governed_step", { run_id: runId, step_id: "dev", artifact: {} }, actor))
      .rejects.toMatchObject({ code: "WORKFLOW_RUN_CANCELLED" });

    // Reactivate
    await callMcpTool("reactivate_governed_workflow_run", { run_id: runId }, actor);

    // Now resumes: launch step 2 succeeds
    const launchStep2 = await callMcpTool("launch_governed_step", { run_id: runId, step_id: "dev" }, actor);
    expect(launchStep2.agent_name).toBeDefined();
  });
});
```

- [ ] **Step 16.2: Run, verify pass**

Run: `bun test server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts -t "cancel + reactivate full cycle"`
Expected: PASS.

- [ ] **Step 16.3: Run the full server test suite**

Run: `bun test server`
Expected: PASS — no regressions.

- [ ] **Step 16.4: Run the full repo test suite**

Run: `bun test`
Expected: PASS.

- [ ] **Step 16.5: Run the full typecheck**

Run: `bun run typecheck`
Expected: PASS (13/13 packages).

- [ ] **Step 16.6: Commit and push**

```bash
git add server/src/mcp/tools/__tests__/governed-workflows.e2e.test.ts
git commit -m "test(governed-workflows): e2e cancel + reactivate cycle"
git push
```

---

## Final verification

- [ ] **Step F1: Manual full flow in browser**

1. `bun run dev`.
2. Launch a fresh run via UI or `launch_governed_workflow` MCP.
3. From the runs list page, cancel it with reason "demo".
4. Verify badge appears, button toggles, banner on detail page.
5. Try to call `complete_governed_step` from MCP → confirm `WORKFLOW_RUN_CANCELLED`.
6. Reactivate from UI → all returns to normal.
7. Try cancel a `completed` run → confirm `WORKFLOW_RUN_NOT_ACTIVE` toast.
8. Cancel as a non-initiator without permission → confirm 403.

- [ ] **Step F2: Update parity tracker**

Per CLAUDE.md rule, update `scripts/parity/data.ts` to reflect the new feature:

In the `governed-workflows` (or appropriate) domain, add a `Feature` entry for "Cancel/Reactivate run" with `web: { status: "done" }` and `desktop: { status: "done" }` (Tauri shares the React UI).

Run `bun run parity` to verify the report renders.

- [ ] **Step F3: Index refresh**

Run: `npx gitnexus analyze --embeddings` (the project uses GitNexus).

- [ ] **Step F4: Final commit + push**

```bash
git add scripts/parity/data.ts
git commit -m "chore(parity): record cancel/reactivate run feature"
git push
```

---

## Spec Coverage Checklist

| Spec section | Task |
|---|---|
| §1 DB schema | Task 1 |
| §2 Permissions | Task 2 |
| §3.1 cancelRun | Task 5 |
| §3.2 reactivateRun | Task 6 |
| §3.3 launchStep / completeStep guard | Task 7 |
| §4 Error codes | Task 3 |
| §5 MCP tools | Task 9 |
| §6 REST routes | Task 10 |
| §7.1 List page | Task 13 |
| §7.2 Detail page | Task 14 |
| §7.3 CancelRunDialog | Task 12 |
| §7.4 Hooks | Task 11 |
| §7.5 Error toasts | Task 11 (in hooks) |
| §8 Live events | Task 4 + Task 15 |
| §9 Audit log | Task 5 + Task 6 (inline INSERT) |
| §10 Tests | Tasks 5/6/7/9/10/12/16 |
| §11 No backfill needed | n/a |

All spec sections covered.

---

## Notes for the implementer

- **Branch**: stay on `feat/artifact-persistence` (where the spec lives). Do NOT rebase to master without explicit instruction.
- **GPG signing**: if `git commit` fails with `gpg: signing failed: Timeout`, retry with `-c commit.gpgsign=false` (per CLAUDE.md).
- **GitNexus**: each commit triggers an analyze hook. Do not skip.
- **No polling**: live events propagate via WebSocket. Never use `setInterval` or `refetchInterval`.
- **Multi-tenant**: every new endpoint must sit under `/companies/:companyId/...`. Already true here, just don't break it.
- **UI primitives**: never inline-build Dialog/Button/Textarea — always import from `ui/src/components/ui/`.
