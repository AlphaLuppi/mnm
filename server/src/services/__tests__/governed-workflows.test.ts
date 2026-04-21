import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { setTenantContext, clearTenantContext } from "../../middleware/tenant-context.js";
import { governedWorkflowService } from "../governed-workflows.js";
import type { Db } from "@mnm/db";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";
import { WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";

// A minimal stub GitProvider — integration tests feed canned blobs.
const stubProvider = {
  fetchBlob: async () => JSON.stringify({
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name: "hello-world",
    variables: {},
    steps: [
      { id: "greet", deps: [], agent: "greeter", prompt_context: {}, gates: {} },
    ],
  }),
  listTags: async () => [{ name: "v1.0.0", sha: "deadbeef" }],
  resolveRef: async () => "deadbeef",
  pathExists: async () => true,
  commitFile: async () => ({ sha: "x" }),
};

describe("governedWorkflowService — discovery", () => {
  let db: Db;
  const companyA = "00000000-0000-0000-0000-000000000a01";
  const companyB = "00000000-0000-0000-0000-000000000b01";

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    // Seed two companies + one governed_workflow_definitions row each
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyA}, 'A', 'GWTA'), (${companyB}, 'B', 'GWTB')`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES
      (${companyA}, 'hello-world', 'v1.0.0'),
      (${companyA}, 'goodbye', null),
      (${companyB}, 'hello-world', 'v2.0.0')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  beforeEach(async () => {
    await clearTenantContext(db);
  });

  it("listDefinitions returns only this company's definitions (RLS)", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyA);
    const rows = await svc.listDefinitions({ companyId: companyA });
    expect(rows.map((r) => r.name).sort()).toEqual(["goodbye", "hello-world"]);
  });

  it("listDefinitions { enabled: true } excludes disabled rows", async () => {
    await db.execute(sql`UPDATE governed_workflow_definitions SET enabled = false WHERE company_id = ${companyA} AND name = 'goodbye'`);
    const svc = governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyA);
    const rows = await svc.listDefinitions({ companyId: companyA, enabled: true });
    expect(rows.map((r) => r.name)).toEqual(["hello-world"]);
  });

  it("getWorkflowParsed returns parsed workflow + sha for a known name", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyA);
    const parsed = await svc.getWorkflowParsed({
      companyId: companyA,
      name: "hello-world",
    });
    expect(parsed.workflow.name).toBe("hello-world");
    expect(parsed.gitSha).toBe("deadbeef");
    expect(parsed.gitTag).toBe("v1.0.0");
  });

  it("getWorkflowParsed throws WORKFLOW_NOT_FOUND for unknown name", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyA);
    await expect(
      svc.getWorkflowParsed({ companyId: companyA, name: "nope" }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
    });
  });

  it("getWorkflowParsed uses explicit git_tag when provided", async () => {
    let capturedRef = "";
    const svc = governedWorkflowService(db, {
      gitProvider: {
        ...stubProvider,
        resolveRef: async ({ ref }: { ref: string }) => { capturedRef = ref; return `sha-of-${ref}`; },
      } as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyA);
    const parsed = await svc.getWorkflowParsed({
      companyId: companyA,
      name: "hello-world",
      gitTag: "v0.5.0",
    });
    expect(capturedRef).toBe("v0.5.0");
    expect(parsed.gitSha).toBe("sha-of-v0.5.0");
  });
});

describe("governedWorkflowService — launchWorkflow", () => {
  let db: Db;
  const companyA = "00000000-0000-0000-0000-000000000a02";

  function mkSvc() {
    return governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
  }

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyA}, 'LaunchCo', 'GWTL')`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyA}, 'hello-world', 'v1.0.0')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  afterEach(async () => {
    await clearTenantContext(db);
  });

  it("creates a run + N step executions in pending state", async () => {
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    const { runId, firstStep } = await svc.launchWorkflow({
      companyId: companyA,
      name: "hello-world",
      params: { name: "Tom" },
      actor: { type: "user", id: "u-1" },
    });
    expect(firstStep).toBe("greet");

    const steps = await db.execute(sql`SELECT step_id_in_json, state FROM governed_step_executions WHERE run_id = ${runId} ORDER BY step_id_in_json`);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ step_id_in_json: "greet", state: "pending" });
  });

  it("throws WORKFLOW_NOT_FOUND for unknown name", async () => {
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    await expect(
      svc.launchWorkflow({
        companyId: companyA,
        name: "absent",
        params: {},
        actor: { type: "user", id: "u-1" },
      }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND });
  });

  it("serializes concurrent launches on the same definition", async () => {
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    const [r1, r2] = await Promise.all([
      svc.launchWorkflow({ companyId: companyA, name: "hello-world", params: { name: "A" }, actor: { type: "user", id: "u-1" } }),
      svc.launchWorkflow({ companyId: companyA, name: "hello-world", params: { name: "B" }, actor: { type: "user", id: "u-1" } }),
    ]);
    // Both succeed with different runIds; the advisory lock serialises
    // ordering, preventing partial inserts — verified by both having
    // their full complement of step_executions.
    expect(r1.runId).not.toBe(r2.runId);
    const counts = await db.execute(sql`SELECT run_id, COUNT(*) AS c FROM governed_step_executions WHERE run_id IN (${r1.runId}, ${r2.runId}) GROUP BY run_id`);
    for (const row of counts) expect(Number((row as any).c)).toBe(1);
  });

  it("uses first step id from parsed workflow as firstStep (deps=[])", async () => {
    // Already covered by the first test, but explicitly asserts the choice
    // logic: firstStep = steps.find(s => s.deps.length === 0).id
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    const { firstStep } = await svc.launchWorkflow({
      companyId: companyA, name: "hello-world", params: {}, actor: { type: "user", id: "u-1" },
    });
    expect(firstStep).toBe("greet");
  });
});
