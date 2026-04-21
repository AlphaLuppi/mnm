import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { setTenantContext, clearTenantContext } from "../../middleware/tenant-context.js";
import { governedWorkflowService } from "../governed-workflows.js";
import type { Db } from "@mnm/db";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";
import { WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";
import { ShaCache } from "@mnm/git-provider";

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

describe("governedWorkflowService — getRun", () => {
  let db: Db;
  const companyA = "00000000-0000-0000-0000-000000000a03";

  function mkSvc() {
    return governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
  }

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyA}, 'RunCo', 'GWTR')`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyA}, 'hello-world', 'v1.0.0')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  afterEach(async () => {
    await clearTenantContext(db);
  });

  it("returns run with steps + last gate_result", async () => {
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "hello-world", params: {}, actor: { type: "user", id: "u-1" },
    });
    const run = await svc.getRun({ companyId: companyA, runId });
    expect(run.runId).toBe(runId);
    expect(run.status).toBe("active");
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]).toMatchObject({ id: "greet", state: "pending", artifactOk: false });
    expect(run.lastGateResult).toBeNull();
  });

  it("returns WORKFLOW_RUN_NOT_FOUND for unknown runId", async () => {
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    await expect(
      svc.getRun({ companyId: companyA, runId: "00000000-0000-0000-0000-000000000999" }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND });
  });

  it("hides cross-tenant runs behind WORKFLOW_RUN_NOT_FOUND (not 403)", async () => {
    const companyB = "00000000-0000-0000-0000-000000000b03";
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyB}, 'RunCoB', 'GWRB') ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyB}, 'hello-world', 'v1.0.0') ON CONFLICT DO NOTHING`);

    const svc = mkSvc();
    // Launch under B
    await setTenantContext(db, companyB);
    const { runId } = await svc.launchWorkflow({
      companyId: companyB, name: "hello-world", params: {}, actor: { type: "user", id: "u-B" },
    });

    // Fetch as A
    await setTenantContext(db, companyA);
    await expect(
      svc.getRun({ companyId: companyA, runId }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND });
  });
});

describe("governedWorkflowService — launchStep", () => {
  let db: Db;
  const companyA = "00000000-0000-0000-0000-000000000a04";

  // Fixture: a two-step workflow with an entry gate on step "shout"
  const TWO_STEP_WORKFLOW = {
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name: "two-step",
    variables: {},
    steps: [
      { id: "greet", deps: [], agent: "greeter", prompt_context: {}, gates: {} },
      {
        id: "shout",
        deps: ["greet"],
        agent: "shouter",
        prompt_context: {},
        gates: {
          entry: [
            { id: "pre-shout", source: "./gates/pre-shout.gate.ts" },
          ],
        },
      },
    ],
  };

  // Stub provider returning the two-step JSON + a canned passing gate source.
  // `sha` must differ between tests that use different gate sources to prevent
  // the process-wide compiledCache from serving a stale compiled JS entry.
  function mkProviderWithGate(gateSource: string, sha = "two-step-sha") {
    return {
      fetchBlob: async ({ path }: { path: string }) => {
        if (path.endsWith("workflow.json")) return JSON.stringify(TWO_STEP_WORKFLOW);
        if (path.endsWith(".gate.ts")) return gateSource;
        throw new Error(`unexpected path ${path}`);
      },
      resolveRef: async () => sha,
      listTags: async () => [],
      pathExists: async () => true,
      commitFile: async () => ({ sha: "x" }),
    };
  }

  const PASSING_GATE = `
    import { defineGate } from "@mnm/governed-workflows";
    export default defineGate(async () => ({ pass: true, report: "ok" }));
  `;
  const FAILING_GATE = `
    import { defineGate } from "@mnm/governed-workflows";
    export default defineGate(async () => ({ pass: false, report: "nope", error_code: "X", hints: ["try harder"] }));
  `;

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyA}, 'LaunchStepCo', 'GWLS')`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyA}, 'two-step', 'v1.0.0')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  afterEach(async () => {
    await clearTenantContext(db);
  });

  it("WORKFLOW_STEP_NOT_FOUND for an unknown stepId", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: mkProviderWithGate(PASSING_GATE) as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
    });
    await expect(
      svc.launchStep({ companyId: companyA, runId, stepId: "nope", actor: { type: "user", id: "u-1" } }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_STEP_NOT_FOUND });
  });

  it("WORKFLOW_DEPENDENCY_UNMET when a dep isn't succeeded", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: mkProviderWithGate(PASSING_GATE) as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
    });
    // "shout" depends on "greet" which is still pending
    await expect(
      svc.launchStep({ companyId: companyA, runId, stepId: "shout", actor: { type: "user", id: "u-1" } }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_DEPENDENCY_UNMET });
  });

  it("returns triplet without gate eval when step has no entry gate", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: mkProviderWithGate(PASSING_GATE) as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
    });
    // "greet" has no entry gate — should return triplet immediately
    const result = await svc.launchStep({
      companyId: companyA, runId, stepId: "greet", actor: { type: "user", id: "u-1" },
    });
    expect(result).toMatchObject({
      agentName: "greeter",
      subagentType: "mnm--greeter",
      promptContext: expect.any(Object),
    });
  });

  it("returns triplet when entry gate passes", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: mkProviderWithGate(PASSING_GATE) as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyA}, 'two-step', 'v1.0.0') ON CONFLICT DO NOTHING`);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
    });
    await db.execute(sql`UPDATE governed_step_executions SET state='succeeded', completed_at=now() WHERE run_id=${runId} AND step_id_in_json='greet'`);
    const result = await svc.launchStep({
      companyId: companyA, runId, stepId: "shout", actor: { type: "user", id: "u-1" },
    });
    expect(result).toMatchObject({
      agentName: "shouter",
      subagentType: "mnm--shouter",
      promptContext: expect.any(Object),
    });
  });

  it("returns WORKFLOW_GATE_FAILED + gate_result when entry gate fails", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: mkProviderWithGate(FAILING_GATE, "two-step-failing-sha") as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyA}, 'two-step', 'v1.0.0') ON CONFLICT DO NOTHING`);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
    });
    await db.execute(sql`UPDATE governed_step_executions SET state='succeeded', completed_at=now() WHERE run_id=${runId} AND step_id_in_json='greet'`);
    await expect(
      svc.launchStep({ companyId: companyA, runId, stepId: "shout", actor: { type: "user", id: "u-1" } }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
      hints: expect.arrayContaining(["try harder"]),
    });
  });
});

describe("governedWorkflowService — completeStep", () => {
  let db: Db;
  const companyA = "00000000-0000-0000-0000-000000000a05";

  // Reuses the two-step fixture from launchStep tests.
  const TWO_STEP_WORKFLOW = {
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name: "two-step",
    variables: {},
    steps: [
      { id: "greet", deps: [], agent: "greeter", prompt_context: {}, gates: {} },
      {
        id: "shout",
        deps: ["greet"],
        agent: "shouter",
        prompt_context: {},
        gates: {
          exit: [
            { id: "post-shout", source: "./gates/post-shout.gate.ts" },
          ],
        },
      },
    ],
  };

  function mkProviderWithGate(gateSource: string, sha = "cs-sha") {
    return {
      fetchBlob: async ({ path }: { path: string }) => {
        if (path.endsWith("workflow.json")) return JSON.stringify(TWO_STEP_WORKFLOW);
        if (path.endsWith(".gate.ts")) return gateSource;
        throw new Error(`unexpected path ${path}`);
      },
      resolveRef: async () => sha,
      listTags: async () => [],
      pathExists: async () => true,
      commitFile: async () => ({ sha: "x" }),
    };
  }

  const PASSING_GATE = `
    import { defineGate } from "@mnm/governed-workflows";
    export default defineGate(async () => ({ pass: true, report: "ok" }));
  `;
  const FAILING_GATE = `
    import { defineGate } from "@mnm/governed-workflows";
    export default defineGate(async () => ({ pass: false, report: "bad artifact", error_code: "BAD", hints: ["fix it"] }));
  `;

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyA}, 'CompleteStepCo', 'GWCS')`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyA}, 'two-step', 'v1.0.0')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  afterEach(async () => {
    await clearTenantContext(db);
  });

  it("no exit gate → step becomes succeeded directly", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: mkProviderWithGate(PASSING_GATE) as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
    });
    // "greet" has no exit gate
    await db.execute(sql`UPDATE governed_step_executions SET state='running' WHERE run_id=${runId} AND step_id_in_json='greet'`);
    const result = await svc.completeStep({
      companyId: companyA, runId, stepId: "greet", artifact: { greeting: "hi" }, actor: { type: "user", id: "u-1" },
    });
    expect(result).toMatchObject({ stepState: "succeeded", runStatus: "active" });
  });

  it("exit gate passes → step=succeeded", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: mkProviderWithGate(PASSING_GATE, "cs-pass-sha") as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
    });
    // Mark greet succeeded so shout can run
    await db.execute(sql`UPDATE governed_step_executions SET state='succeeded', completed_at=now() WHERE run_id=${runId} AND step_id_in_json='greet'`);
    await db.execute(sql`UPDATE governed_step_executions SET state='running' WHERE run_id=${runId} AND step_id_in_json='shout'`);
    const result = await svc.completeStep({
      companyId: companyA, runId, stepId: "shout", artifact: { output: "HELLO" }, actor: { type: "user", id: "u-1" },
    });
    expect(result).toMatchObject({ stepState: "succeeded", runStatus: "completed" });
  });

  it("exit gate fails → step back to running + WORKFLOW_GATE_FAILED", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: mkProviderWithGate(FAILING_GATE, "cs-fail-sha") as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
    });
    await db.execute(sql`UPDATE governed_step_executions SET state='succeeded', completed_at=now() WHERE run_id=${runId} AND step_id_in_json='greet'`);
    await db.execute(sql`UPDATE governed_step_executions SET state='running' WHERE run_id=${runId} AND step_id_in_json='shout'`);
    await expect(
      svc.completeStep({ companyId: companyA, runId, stepId: "shout", artifact: { output: "HELLO" }, actor: { type: "user", id: "u-1" } }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
      hints: expect.arrayContaining(["fix it"]),
    });
  });

  it("all steps done → run status=completed", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: mkProviderWithGate(PASSING_GATE, "cs-done-sha") as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
    });
    // Complete greet (no exit gate) → active
    await db.execute(sql`UPDATE governed_step_executions SET state='running' WHERE run_id=${runId} AND step_id_in_json='greet'`);
    const r1 = await svc.completeStep({
      companyId: companyA, runId, stepId: "greet", artifact: {}, actor: { type: "user", id: "u-1" },
    });
    expect(r1.runStatus).toBe("active");
    // Complete shout (has passing exit gate) → completed
    await db.execute(sql`UPDATE governed_step_executions SET state='running' WHERE run_id=${runId} AND step_id_in_json='shout'`);
    const r2 = await svc.completeStep({
      companyId: companyA, runId, stepId: "shout", artifact: { output: "HELLO" }, actor: { type: "user", id: "u-1" },
    });
    expect(r2.runStatus).toBe("completed");
  });

  it("calling on already-succeeded step → WORKFLOW_ALREADY_COMPLETED", async () => {
    const svc = governedWorkflowService(db, {
      gitProvider: mkProviderWithGate(PASSING_GATE, "cs-idem-sha") as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-1" },
    });
    await db.execute(sql`UPDATE governed_step_executions SET state='running' WHERE run_id=${runId} AND step_id_in_json='greet'`);
    await svc.completeStep({
      companyId: companyA, runId, stepId: "greet", artifact: {}, actor: { type: "user", id: "u-1" },
    });
    // Second call on same step
    await expect(
      svc.completeStep({ companyId: companyA, runId, stepId: "greet", artifact: {}, actor: { type: "user", id: "u-1" } }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_ALREADY_COMPLETED });
  });
});

describe("governedWorkflowService — syncEnvironment", () => {
  let db: Db;
  const companyA = "00000000-0000-0000-0000-000000000a06";

  const stubProvider = {
    fetchBlob: async ({ path }: { path: string }) => `# Agent MD for ${path}`,
    resolveRef: async () => "agent-sha",
    listTags: async () => [],
    pathExists: async () => true,
    commitFile: async () => ({ sha: "x" }),
  };

  function mkSvc() {
    return governedWorkflowService(db, {
      gitProvider: stubProvider as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
  }

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyA}, 'SyncEnvCo', 'GWSE')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  afterEach(async () => {
    await clearTenantContext(db);
  });

  it("returns { hasChanges:false, agents:[] } when lastSyncedSha matches", async () => {
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
      VALUES (${companyA}, 'greeter', 'claude_local', 'v1.0.0', true)
      ON CONFLICT DO NOTHING
    `);
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    // First call to obtain the real newSha
    const first = await svc.syncEnvironment({ companyId: companyA });
    expect(first.hasChanges).toBe(true);
    // Second call with the same sha → short-circuit
    const second = await svc.syncEnvironment({ companyId: companyA, lastSyncedSha: first.newSha });
    expect(second).toMatchObject({ hasChanges: false, agents: [] });
    expect(second.newSha).toBe(first.newSha);
  });

  it("returns populated agents when lastSyncedSha differs", async () => {
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
      VALUES (${companyA}, 'greeter', 'claude_local', 'v1.0.0', true)
      ON CONFLICT DO NOTHING
    `);
    const svc = mkSvc();
    await setTenantContext(db, companyA);
    const result = await svc.syncEnvironment({ companyId: companyA, lastSyncedSha: "stale-sha" });
    expect(result.hasChanges).toBe(true);
    expect(result.agents.length).toBeGreaterThan(0);
    expect(result.agents[0]).toMatchObject({
      name: "greeter",
      mdContent: expect.any(String),
      configMerged: { mcp: [], hook: [], setting: [], env_ref: [] },
    });
  });

  it("returns { agents:[], hasChanges:true } when no enabled agents exist", async () => {
    // Use a distinct company with no agents to avoid interference
    const emptyCompany = "00000000-0000-0000-0000-000000000a07";
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${emptyCompany}, 'EmptyCo', 'GWEM') ON CONFLICT DO NOTHING`);
    const svc = mkSvc();
    await setTenantContext(db, emptyCompany);
    const result = await svc.syncEnvironment({ companyId: emptyCompany });
    // No agents → synced list is empty; lastSyncedSha is undefined so newSha never matches
    expect(result.agents).toEqual([]);
    expect(result.hasChanges).toBe(true);
    expect(typeof result.newSha).toBe("string");
  });
});
