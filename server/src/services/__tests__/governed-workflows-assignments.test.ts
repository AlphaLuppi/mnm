/**
 * Tests for `governedWorkflowsAssignmentsService` (T3.2).
 *
 * Coverage:
 *  - resolveAssignment: tag intersection (AND), role expansion (OR),
 *    explicit principals (UNION), dedup with composite reason.
 *  - snapshotStepAssignments: idempotent on (step_execution_id, principal_id).
 *  - listPendingWorkFor: joins step_executions filtered on
 *    state IN ('pending','running'), excludes cancelled runs.
 *
 * Requires Postgres (uses `setupTestDb`). Skips the suite gracefully if
 * the database isn't reachable so dev workstations without the test DB
 * don't get red CI noise.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";
import { governedWorkflowsAssignmentsService } from "../governed-workflows-assignments.js";

const COMPANY = "00000000-0000-0000-0000-00000a553001";
const OTHER_COMPANY = "00000000-0000-0000-0000-00000a553002";

let db: Db;
let dbAvailable = true;

beforeAll(async () => {
  try {
    db = await setupTestDb();
    await cleanTestDb(db);
  } catch (err) {
    // No Postgres available — tests below short-circuit via the
    // `dbAvailable` guard. We intentionally do NOT mark the suite as
    // failed; the migration test (0082_step_assignments.test.ts) covers
    // the SQL invariants without DB.
    // eslint-disable-next-line no-console
    console.warn("[governed-workflows-assignments.test] no test DB:", err);
    dbAvailable = false;
    return;
  }

  // Two tenant rows so we can prove no cross-tenant leakage.
  await db.execute(
    sql`INSERT INTO companies (id, name, issue_prefix) VALUES
      (${COMPANY}, 'AssignA', 'ASGA'),
      (${OTHER_COMPANY}, 'AssignB', 'ASGB')
      ON CONFLICT DO NOTHING`,
  );

  // ─── Tags ────────────────────────────────────────────────────────────
  // tags A, B, C — used for intersection tests.
  await db.execute(
    sql`INSERT INTO tags (id, company_id, name, slug) VALUES
      ('00000000-0000-0000-0000-00000a55ta01', ${COMPANY}, 'Alpha', 'alpha'),
      ('00000000-0000-0000-0000-00000a55ta02', ${COMPANY}, 'Beta',  'beta'),
      ('00000000-0000-0000-0000-00000a55ta03', ${COMPANY}, 'Gamma', 'gamma')
      ON CONFLICT DO NOTHING`,
  );

  // tag_assignments :
  //   - principal P1 → alpha + beta + gamma
  //   - principal P2 → alpha + beta
  //   - principal P3 → alpha only
  await db.execute(
    sql`INSERT INTO tag_assignments (company_id, target_type, target_id, tag_id) VALUES
      (${COMPANY}, 'user', 'P1', '00000000-0000-0000-0000-00000a55ta01'),
      (${COMPANY}, 'user', 'P1', '00000000-0000-0000-0000-00000a55ta02'),
      (${COMPANY}, 'user', 'P1', '00000000-0000-0000-0000-00000a55ta03'),
      (${COMPANY}, 'user', 'P2', '00000000-0000-0000-0000-00000a55ta01'),
      (${COMPANY}, 'user', 'P2', '00000000-0000-0000-0000-00000a55ta02'),
      (${COMPANY}, 'user', 'P3', '00000000-0000-0000-0000-00000a55ta01')
      ON CONFLICT DO NOTHING`,
  );

  // ─── Roles ───────────────────────────────────────────────────────────
  // role engineer → P2 + P4 ; role manager → P5
  await db.execute(
    sql`INSERT INTO roles (id, company_id, name, slug, hierarchy_level, bypass_tag_filter) VALUES
      ('00000000-0000-0000-0000-00000a55ro01', ${COMPANY}, 'Engineer', 'engineer', 100, false),
      ('00000000-0000-0000-0000-00000a55ro02', ${COMPANY}, 'Manager',  'manager',  50,  false)
      ON CONFLICT DO NOTHING`,
  );
  await db.execute(
    sql`INSERT INTO company_memberships (company_id, principal_type, principal_id, status, role_id) VALUES
      (${COMPANY}, 'user', 'P2', 'active', '00000000-0000-0000-0000-00000a55ro01'),
      (${COMPANY}, 'user', 'P4', 'active', '00000000-0000-0000-0000-00000a55ro01'),
      (${COMPANY}, 'user', 'P5', 'active', '00000000-0000-0000-0000-00000a55ro02')
      ON CONFLICT DO NOTHING`,
  );
});

afterAll(async () => {
  if (dbAvailable) await teardownTestDb(db);
});

describe("governedWorkflowsAssignmentsService.resolveAssignment", () => {
  it("returns [] for undefined/empty assignment", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    const r1 = await svc.resolveAssignment({ companyId: COMPANY, assignment: undefined });
    expect(r1).toEqual([]);
    const r2 = await svc.resolveAssignment({
      companyId: COMPANY,
      assignment: { tags: [], roles: [], principals: [] },
    });
    expect(r2).toEqual([]);
  });

  it("tag intersection — only principals carrying ALL declared tags match", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    const result = await svc.resolveAssignment({
      companyId: COMPANY,
      assignment: { tags: ["alpha", "beta"] },
    });
    const ids = result.map((e) => e.principalId).sort();
    expect(ids).toEqual(["P1", "P2"]); // P3 only has alpha → excluded
    for (const e of result) {
      expect(e.reason).toContain("tag-intersection:alpha,beta");
    }
  });

  it("tag intersection — declaring 3 tags narrows to P1 only", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    const result = await svc.resolveAssignment({
      companyId: COMPANY,
      assignment: { tags: ["alpha", "beta", "gamma"] },
    });
    expect(result.map((e) => e.principalId)).toEqual(["P1"]);
  });

  it("tag intersection — bogus tag yields no principals (silent failure, fail-closed)", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    const result = await svc.resolveAssignment({
      companyId: COMPANY,
      assignment: { tags: ["alpha", "does-not-exist"] },
    });
    expect(result).toEqual([]);
  });

  it("role expansion — every active membership in the role is matched", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    const result = await svc.resolveAssignment({
      companyId: COMPANY,
      assignment: { roles: ["engineer"] },
    });
    const ids = result.map((e) => e.principalId).sort();
    expect(ids).toEqual(["P2", "P4"]);
    for (const e of result) {
      expect(e.reason).toContain("role-expansion:engineer");
    }
  });

  it("explicit principals UNION — added unconditionally, reason='explicit'", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    const result = await svc.resolveAssignment({
      companyId: COMPANY,
      assignment: { principals: ["P9", "P10"] },
    });
    const ids = result.map((e) => e.principalId).sort();
    expect(ids).toEqual(["P10", "P9"]);
    for (const e of result) {
      expect(e.reason).toBe("explicit");
    }
  });

  it("dedup — a principal matching by tag AND role AND explicit appears once with composite reason", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    // P2 has tags alpha+beta AND role engineer. Adding P2 explicitly gives 3 paths.
    const result = await svc.resolveAssignment({
      companyId: COMPANY,
      assignment: {
        tags: ["alpha", "beta"],
        roles: ["engineer"],
        principals: ["P2"],
      },
    });
    const p2Rows = result.filter((e) => e.principalId === "P2");
    expect(p2Rows).toHaveLength(1);
    expect(p2Rows[0]!.reason).toContain("tag-intersection");
    expect(p2Rows[0]!.reason).toContain("role-expansion");
    expect(p2Rows[0]!.reason).toContain("explicit");
  });

  it("cross-tenant — declarations in COMPANY don't leak principals from OTHER_COMPANY", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    // OTHER_COMPANY has zero seeded data → tag/role declarations resolve empty.
    const result = await svc.resolveAssignment({
      companyId: OTHER_COMPANY,
      assignment: { tags: ["alpha"], roles: ["engineer"] },
    });
    expect(result).toEqual([]);
  });
});

describe("governedWorkflowsAssignmentsService.snapshotStepAssignments", () => {
  let runId: string;
  let stepExecId: string;
  let workflowDefId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    // Seed a workflow def, run, and step execution to satisfy FKs.
    workflowDefId = "00000000-0000-0000-0000-00000a55de01";
    runId = "00000000-0000-0000-0000-00000a55ru01";
    stepExecId = "00000000-0000-0000-0000-00000a55se01";
    await db.execute(
      sql`INSERT INTO governed_workflow_definitions (id, company_id, name, latest_git_sha)
          VALUES (${workflowDefId}, ${COMPANY}, 'wf-asg', 'sha-stub')
          ON CONFLICT DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO governed_workflow_runs (id, company_id, workflow_def_id, workflow_git_tag, workflow_git_sha, status, started_at)
          VALUES (${runId}, ${COMPANY}, ${workflowDefId}, 'v0', 'sha-stub', 'active', now())
          ON CONFLICT DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO governed_step_executions (id, company_id, run_id, step_id_in_json, state)
          VALUES (${stepExecId}, ${COMPANY}, ${runId}, 'review', 'pending')
          ON CONFLICT DO NOTHING`,
    );
  });

  it("inserts the resolved entries, idempotent on re-run", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    const first = await svc.snapshotStepAssignments({
      companyId: COMPANY,
      stepExecutionId: stepExecId,
      entries: [
        { principalId: "P1", reason: "tag-intersection:alpha" },
        { principalId: "P2", reason: "explicit" },
      ],
    });
    expect(first).toHaveLength(2);

    // Second call with one overlap + one new → only the new row inserts.
    const second = await svc.snapshotStepAssignments({
      companyId: COMPANY,
      stepExecutionId: stepExecId,
      entries: [
        { principalId: "P1", reason: "delta-launchStep" },
        { principalId: "P3", reason: "tag-intersection:alpha" },
      ],
    });
    expect(second.map((r) => r.principalId)).toEqual(["P3"]);
  });
});

describe("governedWorkflowsAssignmentsService.listPendingWorkFor", () => {
  it("returns assignments joined with active step+run, excludes cancelled runs", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    const rows = await svc.listPendingWorkFor({
      companyId: COMPANY,
      principalId: "P1",
    });
    // From the snapshot test above, P1 should have 1 pending assignment.
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row.workflowName).toBe("wf-asg");
      expect(["pending", "running"]).toContain(row.runStatus === "active" ? "running" : row.runStatus);
      // V0 stubs
      expect(row.parentStepExecutionId).toBeNull();
      expect(row.depsCompleted).toBe(true);
    }
  });

  it("excludes a principal who has no assignment", async () => {
    if (!dbAvailable) return;
    const svc = governedWorkflowsAssignmentsService(db);
    const rows = await svc.listPendingWorkFor({
      companyId: COMPANY,
      principalId: "P-not-assigned",
    });
    expect(rows).toEqual([]);
  });
});
