import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
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
      resolveGitProvider: (async () => stubProvider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyA);
    const rows = await svc.listDefinitions({ companyId: companyA });
    expect(rows.map((r) => r.name).sort()).toEqual(["goodbye", "hello-world"]);
  });

  it("listDefinitions { enabled: true } excludes disabled rows", async () => {
    await db.execute(sql`UPDATE governed_workflow_definitions SET enabled = false WHERE company_id = ${companyA} AND name = 'goodbye'`);
    const svc = governedWorkflowService(db, {
      resolveGitProvider: (async () => stubProvider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyA);
    const rows = await svc.listDefinitions({ companyId: companyA, enabled: true });
    expect(rows.map((r) => r.name)).toEqual(["hello-world"]);
  });

  it("getWorkflowParsed returns parsed workflow + sha for a known name", async () => {
    const svc = governedWorkflowService(db, {
      resolveGitProvider: (async () => stubProvider) as any,
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
      resolveGitProvider: (async () => stubProvider) as any,
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
    const customProvider = {
      ...stubProvider,
      resolveRef: async ({ ref }: { ref: string }) => { capturedRef = ref; return `sha-of-${ref}`; },
    };
    const svc = governedWorkflowService(db, {
      resolveGitProvider: (async () => customProvider) as any,
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
      resolveGitProvider: (async () => stubProvider) as any,
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
      resolveGitProvider: (async () => stubProvider) as any,
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
      resolveGitProvider: (async () => mkProviderWithGate(PASSING_GATE)) as any,
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
      resolveGitProvider: (async () => mkProviderWithGate(PASSING_GATE)) as any,
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
      resolveGitProvider: (async () => mkProviderWithGate(PASSING_GATE)) as any,
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
      resolveGitProvider: (async () => mkProviderWithGate(PASSING_GATE)) as any,
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
      resolveGitProvider: (async () => mkProviderWithGate(FAILING_GATE, "two-step-failing-sha")) as any,
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
      resolveGitProvider: (async () => mkProviderWithGate(PASSING_GATE)) as any,
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
      resolveGitProvider: (async () => mkProviderWithGate(PASSING_GATE, "cs-pass-sha")) as any,
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
      resolveGitProvider: (async () => mkProviderWithGate(FAILING_GATE, "cs-fail-sha")) as any,
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
      resolveGitProvider: (async () => mkProviderWithGate(PASSING_GATE, "cs-done-sha")) as any,
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
      resolveGitProvider: (async () => mkProviderWithGate(PASSING_GATE, "cs-idem-sha")) as any,
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
      resolveGitProvider: (async () => stubProvider) as any,
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
      configMerged: { mcp: [], hook: [], setting: [], credential: [] },
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

describe("governedWorkflowService — setupWorkspace", () => {
  let db: Db;

  // In-memory git content map keyed by `path:ref` — mimics the T5 pattern.
  const blobs = new Map<string, string>();

  const stubProvider = {
    fetchBlob: async ({ path, ref }: { path: string; ref: string }) => {
      const key = `${path}:${ref}`;
      const hit = blobs.get(key);
      if (hit !== undefined) return hit;
      // Default: return a canonical agent.md for any `<name>/agent.md` path.
      return `---\nname: ${path}\n---\n\n# Agent body for ${path} @ ${ref}\n`;
    },
    resolveRef: async ({ ref }: { ref: string }) => `sha-${ref}`,
    listTags: async () => [],
    pathExists: async () => true,
    commitFile: async () => ({ sha: "x" }),
  };

  function mkSvc() {
    return governedWorkflowService(db, {
      resolveGitProvider: (async () => stubProvider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
  }

  // Seed a company + agents for a test. Uses `T6HL` prefix with random suffix
  // so concurrent test runs don't collide on the unique `issue_prefix`.
  async function seedCompanyWithAgents(opts: {
    issuePrefix: string;
    agents: Array<{ name: string; enabled: boolean }>;
  }): Promise<string> {
    const companyId = crypto.randomUUID();
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const prefix = `${opts.issuePrefix}${suffix}`;
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, ${"Setup-" + suffix}, ${prefix}) ON CONFLICT (id) DO NOTHING`,
    );
    for (const a of opts.agents) {
      await db.execute(sql`
        INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
        VALUES (${companyId}, ${a.name}, 'claude_local', 'v0.0.1', ${a.enabled})
      `);
    }
    return companyId;
  }

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  afterEach(async () => {
    await clearTenantContext(db);
  });

  const service = {
    setupWorkspace: (args: { companyId: string }) => mkSvc().setupWorkspace(args),
    pushLocalState: (args: Parameters<ReturnType<typeof mkSvc>["pushLocalState"]>[0]) =>
      mkSvc().pushLocalState(args),
  };

  it("returns all enabled agents with content and sha, plus write instructions", async () => {
    // Arrange: seed 2 enabled agents for the test company.
    const companyId = await seedCompanyWithAgents({
      issuePrefix: "T6HL",
      agents: [
        { name: "greeter", enabled: true },
        { name: "shouter", enabled: true },
        { name: "disabled-one", enabled: false },
      ],
    });

    // Act
    const result = await service.setupWorkspace({ companyId });

    // Assert — disabled agents excluded, mnm-- prefix applied in output name.
    expect(result.agents.map((a) => a.name).sort()).toEqual([
      "mnm--greeter",
      "mnm--shouter",
    ]);
    for (const agent of result.agents) {
      expect(agent.content.length).toBeGreaterThan(0);
      expect(agent.sha.length).toBeGreaterThan(0);
      expect(agent.targetPath).toMatch(/^~\/\.claude\/agents\/mnm--[a-z0-9-]+\.md$/);
    }
    expect(result.instructions).toContain("Write");
  });

  it("returns an empty array if the company has no enabled agents", async () => {
    const companyId = await seedCompanyWithAgents({ issuePrefix: "T6HL", agents: [] });
    const result = await service.setupWorkspace({ companyId });
    expect(result.agents).toEqual([]);
  });

  it("propagates userId to resolveGitProvider so the per-user OAuth token is selected", async () => {
    const companyId = await seedCompanyWithAgents({
      issuePrefix: "T6HL",
      agents: [{ name: "greeter", enabled: true }],
    });
    const resolveSpy = vi.fn(async () => stubProvider);
    const svc = governedWorkflowService(db, {
      resolveGitProvider: resolveSpy as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });

    await svc.setupWorkspace({ companyId, userId: "u-42" });

    expect(resolveSpy).toHaveBeenCalledWith({ companyId, userId: "u-42" });
  });

  describe("pushLocalState", () => {
    it("returns the local state payload + path for the harness to persist", async () => {
      const companyId = await seedCompanyWithAgents({
        issuePrefix: "T6HL",
        agents: [{ name: "greeter", enabled: true }],
      });
      const result = await service.pushLocalState({
        companyId,
        agentsProvisioned: ["mnm--greeter"],
        pluginVersion: "0.1.0",
      });
      expect(result.targetRelativePath).toBe("last-session.json");
      expect(result.content.lastPluginVersion).toBe("0.1.0");
      expect(result.content.agentNames).toEqual(["mnm--greeter"]);
      expect(typeof result.content.lastSyncedSha).toBe("string");
      expect(result.content.lastSyncedSha.length).toBeGreaterThan(0);
      expect(typeof result.content.pendingRuns).toBe("number");
      expect(typeof result.content.openIssues).toBe("number");
    });
  });
});

describe("launchStep (T6 enrichment)", () => {
  let db: Db;

  // Fixed canonical agent.md content so tests can compute the expected sha.
  const AGENT_MD_CONTENT = "---\nname: greeter\n---\n\n# Greeter agent body\n";

  // Build a stub git provider whose workflow.json has `required_tools` set
  // on its single step when `requiredTools` is supplied. Content is stable
  // across calls so the sha is deterministic.
  function mkProvider(opts: { requiredTools?: string[] } = {}) {
    const workflowJson = {
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "hello-world",
      variables: {},
      steps: [
        {
          id: "greet",
          deps: [],
          agent: "greeter",
          prompt_context: {},
          gates: {},
          ...(opts.requiredTools ? { required_tools: opts.requiredTools } : {}),
        },
      ],
    };
    return {
      fetchBlob: async ({ path }: { path: string }) => {
        if (path.endsWith("workflow.json")) return JSON.stringify(workflowJson);
        if (path.endsWith("/agent.md")) return AGENT_MD_CONTENT;
        throw new Error(`unexpected path ${path}`);
      },
      resolveRef: async ({ ref }: { ref: string }) => `sha-${ref}`,
      listTags: async () => [],
      pathExists: async () => true,
      commitFile: async () => ({ sha: "x" }),
    };
  }

  // Inline helper: seeds a company + one agent + a hello-world workflow
  // definition, launches the workflow, and returns coordinates the T6
  // enrichment tests need. The expected agent name is the PREFIXED form
  // (`mnm--greeter`) because the harness writes to `~/.claude/agents/mnm--*.md`.
  async function seedHelloWorldRunAtFirstStep(opts: {
    issuePrefix: string;
    requiredTools?: string[];
  }): Promise<{
    companyId: string;
    runId: string;
    stepId: string;
    expectedAgentName: string;
    expectedAgentSha: string;
    provider: ReturnType<typeof mkProvider>;
  }> {
    const companyId = crypto.randomUUID();
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const prefix = `${opts.issuePrefix}${suffix}`;
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, ${"T6HL-" + suffix}, ${prefix}) ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
      VALUES (${companyId}, 'greeter', 'claude_local', 'v1.0.0', true)
    `);
    await db.execute(sql`
      INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
      VALUES (${companyId}, 'hello-world', 'v1.0.0')
    `);

    const provider = mkProvider({ requiredTools: opts.requiredTools });
    const svc = governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyId);
    const { runId, firstStep } = await svc.launchWorkflow({
      companyId,
      name: "hello-world",
      params: {},
      actor: { type: "user", id: "u-1" },
    });

    // Compute the canonical sha the same way the service does.
    const { createHash } = await import("node:crypto");
    const expectedAgentSha = createHash("sha256").update(AGENT_MD_CONTENT).digest("hex");

    return {
      companyId,
      runId,
      stepId: firstStep,
      expectedAgentName: "mnm--greeter",
      expectedAgentSha,
      provider,
    };
  }

  // Build a fresh service that shares the provider used by the seeder so
  // `loadCanonicalAgent` sees the same blob content (thus the same sha).
  function mkSvc(provider: ReturnType<typeof mkProvider>) {
    return governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: new ShaCache(),
    });
  }

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  afterEach(async () => {
    await clearTenantContext(db);
  });

  it("returns agents_stale when currentAgents hash does not match the canonical sha", async () => {
    const { companyId, runId, stepId, expectedAgentName, provider } =
      await seedHelloWorldRunAtFirstStep({ issuePrefix: "T6HL" });
    const service = mkSvc(provider);
    await expect(
      service.launchStep({
        companyId,
        runId,
        stepId,
        actor: { type: "user", id: "u-1" },
        currentAgents: { [expectedAgentName]: "zzzzzzzzzz-bogus-sha" },
        sessionTools: ["Task", "Write", "Read"],
      }),
    ).rejects.toMatchObject({
      code: "AGENTS_STALE",
    });
  });

  it("returns missing_tools when sessionTools lack a required tool", async () => {
    const { companyId, runId, stepId, expectedAgentName, expectedAgentSha, provider } =
      await seedHelloWorldRunAtFirstStep({
        issuePrefix: "T6HL",
        requiredTools: ["mcp__gitnexus__query"],
      });
    const service = mkSvc(provider);
    await expect(
      service.launchStep({
        companyId,
        runId,
        stepId,
        actor: { type: "user", id: "u-1" },
        currentAgents: { [expectedAgentName]: expectedAgentSha },
        sessionTools: ["Task", "Write", "Read"],
      }),
    ).rejects.toMatchObject({
      code: "MISSING_TOOLS",
    });
  });

  it("dispatches when currentAgents and sessionTools both match", async () => {
    const { companyId, runId, stepId, expectedAgentName, expectedAgentSha, provider } =
      await seedHelloWorldRunAtFirstStep({ issuePrefix: "T6HL" });
    const service = mkSvc(provider);
    const result = await service.launchStep({
      companyId,
      runId,
      stepId,
      actor: { type: "user", id: "u-1" },
      currentAgents: { [expectedAgentName]: expectedAgentSha },
      sessionTools: ["Task", "Write", "Read"],
    });
    expect(result.agentName).toBeDefined();
    expect(result.subagentType).toBeDefined();
  });
});

describe("mergeAgentConfig (real merge via mergePreview)", () => {
  let db: Db;

  const stubProvider = {
    fetchBlob: async ({ path }: { path: string }) => `# Agent MD for ${path}`,
    resolveRef: async () => "agent-sha",
    listTags: async () => [],
    pathExists: async () => true,
    commitFile: async () => ({ sha: "x" }),
  };

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  afterEach(async () => {
    await clearTenantContext(db);
  });

  // Seed: 1 agent with 3 config_layer_items across 2 layers (enforced + base).
  //  - mcp:"github-api"      priority=999 (enforced) — wins over base
  //  - hook:"pre-commit"     priority=500 (base)
  //  - credential:"GL_TOKEN" priority=500 (base)
  async function seedAgentWithMergedConfig(): Promise<{
    companyId: string;
    agentId: string;
  }> {
    const companyId = crypto.randomUUID();
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const prefix = `T7D1${suffix}`;

    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, ${"DEF1-" + suffix}, ${prefix})`,
    );

    // Create layers first — the base layer requires is_base_layer=true for the
    // CHECK (is_base_layer = false OR (scope='private' AND visibility='private')).
    const enforcedRows = await db.execute(
      sql`INSERT INTO config_layers
            (company_id, name, scope, enforced, visibility, created_by_user_id)
          VALUES
            (${companyId}, ${"company-enforced-" + suffix}, 'company', true, 'public', 'test-user')
          RETURNING id::text AS id`,
    );
    const enforcedLayerId = (enforcedRows as unknown as Array<{ id: string }>)[0]!.id;

    const baseRows = await db.execute(
      sql`INSERT INTO config_layers
            (company_id, name, scope, enforced, visibility, is_base_layer, created_by_user_id)
          VALUES
            (${companyId}, ${"agent-base-" + suffix}, 'private', false, 'private', true, 'test-user')
          RETURNING id::text AS id`,
    );
    const baseLayerId = (baseRows as unknown as Array<{ id: string }>)[0]!.id;

    // Insert agent with base_layer_id set so the activeLayersCte picks up the
    // base layer at its canonical priority=500. The enforced layer is picked
    // up separately via the CTE's enforced branch at priority=999, so no
    // attachment via agent_config_layers is needed (and the attachment table
    // CHECKs priority IN [0, 498] anyway, which wouldn't fit 500/999).
    const agentRows = await db.execute(
      sql`INSERT INTO agents
            (company_id, name, adapter_type, latest_git_tag, enabled, base_layer_id)
          VALUES
            (${companyId}, 't7-def1-agent', 'claude_local', 'v1.0.0', true, ${baseLayerId}::uuid)
          RETURNING id::text AS id`,
    );
    const agentId = (agentRows as unknown as Array<{ id: string }>)[0]!.id;

    // Items — note: "credential" is a valid ConfigLayerItemType (0062 migration).
    const mcpCfg = JSON.stringify({ endpoint: "https://api.github.com" });
    const hookCfg = JSON.stringify({ command: "bun lint" });
    const credCfg = JSON.stringify({ credentialId: "cred-abc" });
    await db.execute(
      sql`INSERT INTO config_layer_items
            (company_id, layer_id, item_type, name, config_json, enabled)
          VALUES
            (${companyId}, ${enforcedLayerId}::uuid, 'mcp', 'github-api', ${mcpCfg}::jsonb, true),
            (${companyId}, ${baseLayerId}::uuid, 'hook', 'pre-commit', ${hookCfg}::jsonb, true),
            (${companyId}, ${baseLayerId}::uuid, 'credential', 'GL_TOKEN', ${credCfg}::jsonb, true)`,
    );

    return { companyId, agentId };
  }

  it("partitions items by itemType into configMerged buckets", async () => {
    const { companyId, agentId } = await seedAgentWithMergedConfig();

    const service = governedWorkflowService(db, {
      resolveGitProvider: (async () => stubProvider) as any,
      shaCache: new ShaCache(),
    });

    await setTenantContext(db, companyId);
    const { agents } = await service.syncEnvironment({ companyId });

    // The seeded agent should be picked up (enabled=true, latest_git_tag set).
    const found = agents.find((a) => a.name === "t7-def1-agent");
    expect(found).toBeDefined();
    const merged = found!.configMerged;
    expect(merged.mcp).toHaveLength(1);
    expect(merged.mcp[0]).toMatchObject({ name: "github-api", priority: 999 });
    expect(merged.hook).toHaveLength(1);
    expect(merged.hook[0]).toMatchObject({ name: "pre-commit", priority: 500 });
    expect(merged.credential).toHaveLength(1);
    expect(merged.credential[0]).toMatchObject({ name: "GL_TOKEN" });
    expect(merged.setting).toHaveLength(0);

    // Keep the agentId referenced so unused-var lint is satisfied in the stub.
    expect(agentId).toEqual(expect.any(String));
  });
});
