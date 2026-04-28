import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { sql } from "drizzle-orm";
import { setTenantContext, clearTenantContext } from "../../middleware/tenant-context.js";
import { governedWorkflowService } from "../governed-workflows.js";
import type { Db } from "@mnm/db";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";
import { WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";
import { ShaCache, GitProviderError } from "@mnm/git-provider";

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

  it("propagates actor.id (when type=user) to resolveGitProvider so the per-user OAuth token is selected", async () => {
    const resolveSpy = vi.fn(async () => stubProvider);
    const svc = governedWorkflowService(db, {
      resolveGitProvider: resolveSpy as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyA);
    await svc.launchWorkflow({
      companyId: companyA,
      name: "hello-world",
      params: {},
      actor: { type: "user", id: "u-42" },
    });
    expect(resolveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: companyA, userId: "u-42" }),
    );
    expect(resolveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: expect.stringMatching(/^(agent|workflow)$/) }),
    );
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

  it("propagates actor.id through launchStep's getWorkflowParsed call so the user OAuth token is reused", async () => {
    const resolveSpy = vi.fn(async () => mkProviderWithGate(PASSING_GATE));
    const svc = governedWorkflowService(db, {
      resolveGitProvider: resolveSpy as any,
      shaCache: new ShaCache(),
    });
    await setTenantContext(db, companyA);
    const { runId } = await svc.launchWorkflow({
      companyId: companyA, name: "two-step", params: {}, actor: { type: "user", id: "u-42" },
    });
    resolveSpy.mockClear();
    await svc.launchStep({
      companyId: companyA, runId, stepId: "greet", actor: { type: "user", id: "u-42" },
    });
    expect(resolveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: companyA, userId: "u-42" }),
    );
    expect(resolveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: expect.stringMatching(/^(agent|workflow)$/) }),
    );
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
      companyId: companyA, runId, stepId: "greet", artifact: { outputs: [], data: { greeting: "hi" } }, actor: { type: "user", id: "u-1" },
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
      companyId: companyA, runId, stepId: "shout", artifact: { outputs: [], data: { output: "HELLO" } }, actor: { type: "user", id: "u-1" },
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
      svc.completeStep({ companyId: companyA, runId, stepId: "shout", artifact: { outputs: [], data: { output: "HELLO" } }, actor: { type: "user", id: "u-1" } }),
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
      companyId: companyA, runId, stepId: "greet", artifact: { outputs: [], data: {} }, actor: { type: "user", id: "u-1" },
    });
    expect(r1.runStatus).toBe("active");
    // Complete shout (has passing exit gate) → completed
    await db.execute(sql`UPDATE governed_step_executions SET state='running' WHERE run_id=${runId} AND step_id_in_json='shout'`);
    const r2 = await svc.completeStep({
      companyId: companyA, runId, stepId: "shout", artifact: { outputs: [], data: { output: "HELLO" } }, actor: { type: "user", id: "u-1" },
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
      companyId: companyA, runId, stepId: "greet", artifact: { outputs: [], data: {} }, actor: { type: "user", id: "u-1" },
    });
    // Second call on same step
    await expect(
      svc.completeStep({ companyId: companyA, runId, stepId: "greet", artifact: { outputs: [], data: {} }, actor: { type: "user", id: "u-1" } }),
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

  it("propagates userId to resolveGitProvider so the per-user OAuth token is used (regression for the gap left after a93c085)", async () => {
    const resolveSpy = vi.fn(async () => stubProvider);
    const svc = governedWorkflowService(db, {
      resolveGitProvider: resolveSpy as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
      VALUES (${companyA}, 'a1', 'claude_local', 'v1.0.0', true) ON CONFLICT DO NOTHING
    `);
    await setTenantContext(db, companyA);
    await svc.syncEnvironment({ companyId: companyA, userId: "u-77" });
    expect(resolveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: companyA, userId: "u-77", resourceType: "agent" }),
    );
  });

  // B-FIX-1: syncEnvironment must use resolveResourcePath so paths.agents prefix is honoured.
  it("uses resolveResourcePath when paths.agents is configured (fetches agents/<name>/agent.md, not <name>/agent.md)", async () => {
    const fetchSpy = vi.fn(async ({ path }: { path: string }) => `# md @ ${path}`);
    const provider = {
      paths: { agents: "agents" },
      fetchBlob: fetchSpy,
      resolveRef: async () => "sha-x",
      listTags: async () => [],
      pathExists: async () => true,
      commitFile: async () => ({ sha: "x" }),
    };
    const svc = governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
      VALUES (${companyA}, 'pathed-agent', 'claude_local', 'v1.0.0', true) ON CONFLICT DO NOTHING
    `);
    await setTenantContext(db, companyA);
    await svc.syncEnvironment({ companyId: companyA, lastSyncedSha: "stale-sha" });
    const calledPaths = fetchSpy.mock.calls.map((c) => c[0].path);
    expect(calledPaths).toContain("agents/pathed-agent/agent.md");
    expect(calledPaths).not.toContain("pathed-agent/agent.md");
  });

  // B-FIX-1: skip-on-404 mirrors setupWorkspace — one orphan agent must not abort sync.
  it("skips agents whose .md is missing at the pinned tag (skip-on-404 with structured warn)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = {
      paths: { agents: "agents" },
      providerId: "local:test",
      fetchBlob: async ({ path }: { path: string }) => {
        if (path.includes("ghost")) throw new GitProviderError("not_found", `not found: ${path}`);
        return `# md @ ${path}`;
      },
      resolveRef: async () => "sha-x",
      listTags: async () => [],
      pathExists: async () => true,
      commitFile: async () => ({ sha: "x" }),
    };
    const svc = governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    const dedicatedCompany = "00000000-0000-0000-0000-000000000a08";
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${dedicatedCompany}, 'SkipCo', 'GWSK') ON CONFLICT DO NOTHING`,
    );
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
      VALUES
        (${dedicatedCompany}, 'live-agent', 'claude_local', 'v1.0.0', true),
        (${dedicatedCompany}, 'ghost', 'claude_local', 'v1.0.0', true)
      ON CONFLICT DO NOTHING
    `);
    await setTenantContext(db, dedicatedCompany);
    const result = await svc.syncEnvironment({ companyId: dedicatedCompany, lastSyncedSha: "stale-sha" });
    expect(result.agents.map((a) => a.name).sort()).toEqual(["live-agent"]);
    const ourWarns = warnSpy.mock.calls.filter(
      (c) => c[0] === "[mnm.sync_environment] agent_md_missing",
    );
    expect(ourWarns).toHaveLength(1);
    warnSpy.mockRestore();
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

  // Seed a company + agents for a test. Uses issuePrefix with random suffix
  // so concurrent test runs don't collide on the unique `issue_prefix`.
  async function seedCompanyWithAgents(opts: {
    issuePrefix: string;
    agents: Array<{ name: string; enabled: boolean; archivedAt?: Date | null }>;
  }): Promise<string> {
    const companyId = crypto.randomUUID();
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const prefix = `${opts.issuePrefix}${suffix}`;
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, ${"Setup-" + suffix}, ${prefix}) ON CONFLICT (id) DO NOTHING`,
    );
    for (const a of opts.agents) {
      await db.execute(sql`
        INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled, archived_at)
        VALUES (${companyId}, ${a.name}, 'claude_local', 'v0.0.1', ${a.enabled}, ${a.archivedAt ?? null})
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

    expect(resolveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ companyId, userId: "u-42" }),
    );
    expect(resolveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: expect.stringMatching(/^(agent|workflow)$/) }),
    );
  });

  // ── P5: skip-on-404, warn shape, archived filter, non-404 re-throw ──────────

  it("excludes from result the agents whose agent.md is missing at the pinned tag", async () => {
    const companyId = await seedCompanyWithAgents({
      issuePrefix: "T6SK",
      agents: [
        { name: "alpha", enabled: true },
        { name: "ghost", enabled: true },
      ],
    });
    const provider = {
      ...stubProvider,
      fetchBlob: async ({ path }: { path: string }) => {
        if (path.includes("ghost")) {
          throw new GitProviderError("not_found", `Blob not found: ${path}`);
        }
        return `---\nname: alpha\n---\n\n# Alpha body\n`;
      },
    };
    const svc = governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyId);
    const result = await svc.setupWorkspace({ companyId });
    expect(result.agents.map((a) => a.name)).toEqual(["mnm--alpha"]);
  });

  it("logs a structured warn with the documented payload shape and no token-like fields", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const companyId = await seedCompanyWithAgents({
      issuePrefix: "T6SK",
      agents: [{ name: "ghost", enabled: true }],
    });
    const provider = {
      ...stubProvider,
      providerId: "local:mnm-demo",
      fetchBlob: async ({ path }: { path: string }) => {
        throw new GitProviderError("not_found", `Blob not found: ${path}`);
      },
    };
    const svc = governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyId);
    await svc.setupWorkspace({ companyId });

    // Filter on the specific prefix to avoid catching unrelated warnings.
    const ourWarns = warnSpy.mock.calls.filter(
      (c) => c[0] === "[mnm.setup_workspace] agent_md_missing",
    );
    expect(ourWarns).toHaveLength(1);

    const payload = ourWarns[0][1];
    // Exact shape expected per §3.4 (N-CR-1: providerProjectId renamed to
    // providerId so the field name matches the actual value `provider.providerId`).
    expect(Object.keys(payload).sort()).toEqual(
      ["agentId", "agentName", "companyId", "fullPath", "latestGitTag", "providerId"].sort(),
    );
    expect(payload).toMatchObject({
      companyId,
      agentName: "ghost",
      latestGitTag: expect.any(String),
      providerId: expect.any(String),
      fullPath: expect.stringMatching(/\/ghost\/agent\.md$/),
    });
    // CRITICAL: no token-like fields in payload (defense in depth).
    for (const k of Object.keys(payload)) {
      expect(k.toLowerCase()).not.toMatch(/token|secret|password|credential/);
    }
    warnSpy.mockRestore();
  });

  it("excludes archived agents from setupWorkspace output", async () => {
    const companyId = await seedCompanyWithAgents({
      issuePrefix: "T6AR",
      agents: [
        { name: "live", enabled: true },
        { name: "old", enabled: true, archivedAt: new Date() },
      ],
    });
    const svc = governedWorkflowService(db, {
      resolveGitProvider: (async () => stubProvider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyId);
    const result = await svc.setupWorkspace({ companyId });
    expect(result.agents.map((a) => a.name)).toEqual(["mnm--live"]);
  });

  it("re-throws non-404 GitProviderErrors (auth, network) instead of skipping", async () => {
    const companyId = await seedCompanyWithAgents({
      issuePrefix: "T6AU",
      agents: [{ name: "alpha", enabled: true }],
    });
    const provider = {
      ...stubProvider,
      fetchBlob: async () => {
        throw new GitProviderError("unauthorized", "auth_failed: token expired");
      },
    };
    const svc = governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
    await setTenantContext(db, companyId);
    await expect(svc.setupWorkspace({ companyId })).rejects.toThrow(/auth_failed/);
  });

  describe("pushLocalState", () => {
    it("returns only lastPluginVersion in the payload (no live DB counters)", async () => {
      const companyId = await seedCompanyWithAgents({
        issuePrefix: "T6HL",
        agents: [{ name: "greeter", enabled: true }],
      });
      const result = await service.pushLocalState({
        companyId,
        pluginVersion: "0.1.0",
      });
      expect(result.targetRelativePath).toBe("last-session.json");
      expect(result.content).toEqual({ lastPluginVersion: "0.1.0" });
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

    // Compute the canonical sha the same way the service does. F1 fix:
    // loadCanonicalAgent rewrites the YAML `name:` line to match the
    // namespaced filename, so the sha is computed on the rewritten blob.
    const { createHash } = await import("node:crypto");
    const rewrittenContent = AGENT_MD_CONTENT.replace(
      /^name:\s*.*$/m,
      "name: mnm--greeter",
    );
    const expectedAgentSha = createHash("sha256").update(rewrittenContent).digest("hex");

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

// ── P4: loadCanonicalAgent — T6 git-first hard errors ───────────────────────

describe("governedWorkflowService — loadCanonicalAgent (T6 git-first)", () => {
  let db: Db;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  afterEach(async () => {
    await clearTenantContext(db);
  });

  async function seedCompany(): Promise<string> {
    const companyId = crypto.randomUUID();
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const prefix = `P4${suffix}`;
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, ${"P4-" + suffix}, ${prefix})`,
    );
    return companyId;
  }

  async function seedWorkflow(companyId: string, workflowName: string, agentName: string): Promise<void> {
    const workflowDef = JSON.stringify({
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: workflowName,
      variables: {},
      steps: [
        { id: "s1", deps: [], agent: agentName, prompt_context: {}, gates: {} },
      ],
    });
    await db.execute(
      sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag, enabled)
          VALUES (${companyId}, ${workflowName}, ${"tag-1.0.0"}, true)`,
    );
    // The provider will return this content when fetchBlob is called.
    return void workflowDef;
  }

  it("throws AGENT_NOT_REGISTERED when no agents row exists for the referenced step.agent", async () => {
    const companyId = await seedCompany();
    await seedWorkflow(companyId, "wf-no-agent", "ghost-agent");

    const workflowJson = JSON.stringify({
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "wf-no-agent",
      variables: {},
      steps: [
        { id: "s1", deps: [], agent: "ghost-agent", prompt_context: {}, gates: {} },
      ],
    });

    const provider = {
      fetchBlob: async () => workflowJson,
      listTags: async () => [{ name: "tag-1.0.0", sha: "abc123" }],
      resolveRef: async () => "abc123",
      pathExists: async () => true,
      commitFile: async () => ({ sha: "x" }),
    };

    const service = governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: new ShaCache(),
    });

    await setTenantContext(db, companyId);

    await expect(
      service.launchStep({
        companyId,
        runId: crypto.randomUUID(),
        stepId: "s1",
        actor: { type: "user", id: "u-1" },
        currentAgents: {},
        sessionTools: [],
      }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED,
    });
  });

  it("throws AGENT_NOT_REGISTERED (sub_cause AGENT_TAG_MISSING) when agents row exists but latestGitTag is null", async () => {
    const companyId = await seedCompany();
    const agentName = "no-tag-agent";
    await seedWorkflow(companyId, "wf-no-tag", agentName);

    // Insert an agent row WITHOUT a latestGitTag.
    await db.execute(
      sql`INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
          VALUES (${companyId}, ${agentName}, 'claude_local', null, true)`,
    );

    const workflowJson = JSON.stringify({
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "wf-no-tag",
      variables: {},
      steps: [
        { id: "s1", deps: [], agent: agentName, prompt_context: {}, gates: {} },
      ],
    });

    const provider = {
      fetchBlob: async () => workflowJson,
      listTags: async () => [{ name: "tag-1.0.0", sha: "abc123" }],
      resolveRef: async () => "abc123",
      pathExists: async () => true,
      commitFile: async () => ({ sha: "x" }),
    };

    const service = governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: new ShaCache(),
    });

    await setTenantContext(db, companyId);

    await expect(
      service.launchStep({
        companyId,
        runId: crypto.randomUUID(),
        stepId: "s1",
        actor: { type: "user", id: "u-1" },
        currentAgents: {},
        sessionTools: [],
      }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED,
      data: expect.objectContaining({ sub_cause: "AGENT_TAG_MISSING" }),
    });
  });

  it("throws AGENT_NOT_REGISTERED for an archived agent (archivedAt is set)", async () => {
    const companyId = await seedCompany();
    const agentName = "archived-agent";
    await seedWorkflow(companyId, "wf-archived", agentName);

    // Insert an archived agent row.
    await db.execute(
      sql`INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled, archived_at)
          VALUES (${companyId}, ${agentName}, 'claude_local', ${"v1.0.0"}, true, now())`,
    );

    const workflowJson = JSON.stringify({
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "wf-archived",
      variables: {},
      steps: [
        { id: "s1", deps: [], agent: agentName, prompt_context: {}, gates: {} },
      ],
    });

    const provider = {
      fetchBlob: async () => workflowJson,
      listTags: async () => [{ name: "tag-1.0.0", sha: "abc123" }],
      resolveRef: async () => "abc123",
      pathExists: async () => true,
      commitFile: async () => ({ sha: "x" }),
    };

    const service = governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: new ShaCache(),
    });

    await setTenantContext(db, companyId);

    await expect(
      service.launchStep({
        companyId,
        runId: crypto.randomUUID(),
        stepId: "s1",
        actor: { type: "user", id: "u-1" },
        currentAgents: {},
        sessionTools: [],
      }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED,
    });
  });

  it("fetches agent.md from agents/<name>/agent.md path (git-first path convention)", async () => {
    const companyId = await seedCompany();
    const agentName = "senior-dev";
    await seedWorkflow(companyId, "wf-path-check", agentName);

    await db.execute(
      sql`INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
          VALUES (${companyId}, ${agentName}, 'claude_local', ${"v1.0.0"}, true)`,
    );

    const capturedPaths: string[] = [];
    const workflowJson = JSON.stringify({
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "wf-path-check",
      variables: {},
      steps: [
        { id: "s1", deps: [], agent: agentName, prompt_context: {}, gates: {} },
      ],
    });

    const provider = {
      fetchBlob: async ({ path }: { path: string }) => {
        capturedPaths.push(path);
        if (path.endsWith("agent.md")) {
          return `# ${agentName}\nsubagentType: claude_local\n`;
        }
        return workflowJson;
      },
      listTags: async () => [{ name: "tag-1.0.0", sha: "abc123" }],
      resolveRef: async () => "abc123",
      pathExists: async () => true,
      commitFile: async () => ({ sha: "x" }),
    };

    const service = governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: new ShaCache(),
    });

    await setTenantContext(db, companyId);

    // launchStep fetches agent.md; we verify the path used respects git-first convention.
    const result = await service.launchStep({
      companyId,
      runId: crypto.randomUUID(),
      stepId: "s1",
      actor: { type: "user", id: "u-1" },
      currentAgents: { [agentName]: "abc123" },
      sessionTools: [],
    });

    const agentMdPath = capturedPaths.find((p) => p.endsWith("agent.md"));
    // Must be agents/<name>/agent.md (git-first), not <name>/agent.md (legacy).
    expect(agentMdPath).toBe(`agents/${agentName}/agent.md`);
    expect(result.agentName).toBe(agentName);
  });
});

describe("governedWorkflowService — cancelRun", () => {
  let db: Db;

  // Each test seeds its own company so there is no cross-test pollution
  // (accessService caches role lookups by `${companyId}:${type}:${id}`).
  function mkSvc() {
    return governedWorkflowService(db, {
      resolveGitProvider: (async () => stubProvider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
  }

  // Seeds: company + workflow definition. Returns the companyId.
  async function seedCompany(suffix: string): Promise<string> {
    const companyId = crypto.randomUUID();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, ${"Cancel-" + suffix + "-" + rand}, ${"CR" + rand})`,
    );
    await db.execute(
      sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyId}, 'hello-world', 'v1.0.0')`,
    );
    return companyId;
  }

  // Launch a fresh run for a fresh company. The default initiator is
  // `userId` (string-typed; we don't seed an authUsers row because the
  // initiator-cancel path never hits the permission system).
  async function launchRun(opts: { userId?: string } = {}): Promise<{
    companyId: string;
    runId: string;
    actor: { type: "user"; id: string };
  }> {
    const userId = opts.userId ?? `init-${crypto.randomUUID()}`;
    const companyId = await seedCompany(userId.slice(0, 6));
    await setTenantContext(db, companyId);
    const svc = mkSvc();
    const { runId } = await svc.launchWorkflow({
      companyId,
      name: "hello-world",
      params: {},
      actor: { type: "user", id: userId },
    });
    return { companyId, runId, actor: { type: "user", id: userId } };
  }

  // Helper for the "cascade" test — flips the seeded greet step into a
  // mix of states so the assertion can verify which states cascade and
  // which don't. The default workflow only has 1 step, so we INSERT
  // additional step_executions rows directly to model a 4-step run.
  async function seedRunWithMixedStates(): Promise<{
    companyId: string;
    runId: string;
    actor: { type: "user"; id: string };
    succeededStepId: string;
    failedStepId: string;
    runningStepId: string;
    pendingStepId: string;
  }> {
    const { companyId, runId, actor } = await launchRun();
    // The launchWorkflow path inserted 1 step ("greet") in 'pending'. We
    // mark it succeeded and add three more synthetic step_executions
    // (running, pending, failed). step_id_in_json values need to be
    // unique within the run (uniqueIndex governed_step_executions_run_step_uq).
    await db.execute(sql`
      UPDATE governed_step_executions
      SET state = 'succeeded', completed_at = now()
      WHERE run_id = ${runId} AND step_id_in_json = 'greet'
    `);
    await db.execute(sql`
      INSERT INTO governed_step_executions (company_id, run_id, step_id_in_json, state)
      VALUES
        (${companyId}, ${runId}, 'step-running', 'running'),
        (${companyId}, ${runId}, 'step-pending', 'pending'),
        (${companyId}, ${runId}, 'step-failed', 'failed')
    `);
    const rows = await db.execute(sql`
      SELECT id::text AS id, step_id_in_json, state
      FROM governed_step_executions
      WHERE run_id = ${runId}
    `) as unknown as Array<{ id: string; step_id_in_json: string; state: string }>;
    const byStepId = (s: string) => rows.find((r) => r.step_id_in_json === s)!.id;
    return {
      companyId,
      runId,
      actor,
      succeededStepId: byStepId("greet"),
      failedStepId: byStepId("step-failed"),
      runningStepId: byStepId("step-running"),
      pendingStepId: byStepId("step-pending"),
    };
  }

  // Seed a board user (auth_users + company_membership) bound to a role
  // that owns `workflows:cancel_run`. Returns an actor pointing at that user.
  async function makeActorWithCancelPermission(
    companyId: string,
  ): Promise<{ type: "user"; id: string }> {
    const userId = crypto.randomUUID();
    // No auth_users row needed — accessService.hasPermission joins via
    // company_memberships → roles → role_permissions → permissions. There
    // is no FK from company_memberships.principal_id to auth_users, so
    // referencing a free-floating user-shaped id is fine for permission tests.
    // Ensure the workflows:cancel_run permission exists for this company.
    const permId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO permissions (id, company_id, slug, description, category, is_custom)
      VALUES (${permId}, ${companyId}, 'workflows:cancel_run', 'Cancel/reactivate runs', 'workflows', false)
      ON CONFLICT (company_id, slug) DO NOTHING
    `);
    // Look up the actual permission id (idempotent on repeated runs).
    const permRows = await db.execute(sql`
      SELECT id::text AS id FROM permissions
      WHERE company_id = ${companyId} AND slug = 'workflows:cancel_run'
    `) as unknown as Array<{ id: string }>;
    const realPermId = permRows[0]!.id;
    // Create a role + bind the permission.
    const roleId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO roles (id, company_id, name, slug, hierarchy_level)
      VALUES (${roleId}, ${companyId}, 'CancelRunner', ${"cancel-runner-" + roleId.slice(0, 6)}, 100)
    `);
    await db.execute(sql`
      INSERT INTO role_permissions (role_id, permission_id) VALUES (${roleId}, ${realPermId})
    `);
    // Membership.
    await db.execute(sql`
      INSERT INTO company_memberships (company_id, principal_type, principal_id, status, role_id)
      VALUES (${companyId}, 'user', ${userId}, 'active', ${roleId})
    `);
    return { type: "user", id: userId };
  }

  // Stub provider for the cancelRun suite — workflowJson with a single
  // step is enough; cancelRun never re-fetches the workflow.
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

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  afterEach(async () => {
    await clearTenantContext(db);
  });

  it("happy path: cancels run, cascades steps, emits live event, audits", async () => {
    const { companyId, runId, actor } = await launchRun();
    const publish = vi.fn();
    const result = await mkSvc().cancelRun({
      runId,
      companyId,
      actor,
      reason: "tom mis-launched",
      publishLiveEvent: publish,
    });

    expect(result.runId).toBe(runId);
    expect(result.cancelledAt).toBeInstanceOf(Date);
    expect(result.cancelledStepIds.length).toBeGreaterThan(0);

    // Run row updated. Use Drizzle's typed select so the timestamp comes
    // back as a Date — db.execute() returns raw strings for timestamps.
    const { governedWorkflowRuns } = await import("@mnm/db");
    const runRows = await db
      .select()
      .from(governedWorkflowRuns)
      .where(sql`${governedWorkflowRuns.id} = ${runId}`);
    expect(runRows[0]!.cancelledAt).toBeInstanceOf(Date);
    expect(runRows[0]!.cancellationReason).toBe("tom mis-launched");
    expect(runRows[0]!.cancelledByActorId).toBe(actor.id);
    expect(runRows[0]!.cancelledByActorType).toBe("user");

    // Live event published with expected shape.
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "governed_run.cancelled",
        companyId,
        payload: expect.objectContaining({
          runId,
          reason: "tom mis-launched",
          cancelledByActorId: actor.id,
        }),
      }),
    );

    // Audit row inserted.
    const auditRows = await db.execute(sql`
      SELECT action, target_id, metadata
      FROM audit_events
      WHERE company_id = ${companyId} AND action = 'governed_run.cancelled'
    `) as unknown as Array<{ action: string; target_id: string; metadata: any }>;
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.target_id).toBe(runId);
    expect(auditRows[0]!.metadata).toMatchObject({
      runId,
      reason: "tom mis-launched",
    });
  });

  it("cascades pending/running/gate_eval steps to cancelled, leaves succeeded/failed alone", async () => {
    const {
      companyId,
      runId,
      actor,
      succeededStepId,
      failedStepId,
      runningStepId,
      pendingStepId,
    } = await seedRunWithMixedStates();

    await mkSvc().cancelRun({
      runId,
      companyId,
      actor,
      reason: "ok cancel",
      publishLiveEvent: vi.fn(),
    });

    const stepRows = await db.execute(sql`
      SELECT id::text AS id, state FROM governed_step_executions WHERE run_id = ${runId}
    `) as unknown as Array<{ id: string; state: string }>;
    const stateById = (id: string) => stepRows.find((r) => r.id === id)!.state;

    // Terminal states preserved.
    expect(stateById(succeededStepId)).toBe("succeeded");
    expect(stateById(failedStepId)).toBe("failed");
    // In-flight states cascaded to cancelled.
    expect(stateById(runningStepId)).toBe("cancelled");
    expect(stateById(pendingStepId)).toBe("cancelled");
  });

  it("rejects when run.status !== 'active' (already completed)", async () => {
    const { companyId, runId, actor } = await launchRun();
    await db.execute(sql`
      UPDATE governed_workflow_runs SET status = 'completed', completed_at = now() WHERE id = ${runId}
    `);
    await expect(
      mkSvc().cancelRun({
        runId,
        companyId,
        actor,
        reason: "after-the-fact",
        publishLiveEvent: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_ACTIVE });
  });

  it("rejects when already cancelled (idempotent guard)", async () => {
    const { companyId, runId, actor } = await launchRun();
    await mkSvc().cancelRun({
      runId,
      companyId,
      actor,
      reason: "first cancel",
      publishLiveEvent: vi.fn(),
    });
    await expect(
      mkSvc().cancelRun({
        runId,
        companyId,
        actor,
        reason: "second cancel",
        publishLiveEvent: vi.fn(),
      }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.WORKFLOW_RUN_ALREADY_CANCELLED,
    });
  });

  it("rejects non-initiator actor without permission", async () => {
    const { companyId, runId } = await launchRun();
    // Different user, no membership/role → no permission.
    const otherActor = { type: "user" as const, id: crypto.randomUUID() };
    await expect(
      mkSvc().cancelRun({
        runId,
        companyId,
        actor: otherActor,
        reason: "intruder cancels",
        publishLiveEvent: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_FORBIDDEN });
  });

  it("allows initiator without permission", async () => {
    const { companyId, runId, actor } = await launchRun();
    await expect(
      mkSvc().cancelRun({
        runId,
        companyId,
        actor,
        reason: "owner cancels",
        publishLiveEvent: vi.fn(),
      }),
    ).resolves.toMatchObject({ runId });
  });

  it("allows non-initiator actor with workflows:cancel_run permission", async () => {
    const { companyId, runId } = await launchRun();
    const adminActor = await makeActorWithCancelPermission(companyId);
    await expect(
      mkSvc().cancelRun({
        runId,
        companyId,
        actor: adminActor,
        reason: "admin cancels",
        publishLiveEvent: vi.fn(),
      }),
    ).resolves.toMatchObject({ runId });
  });

  it("rejects reason shorter than 5 chars", async () => {
    const { companyId, runId, actor } = await launchRun();
    await expect(
      mkSvc().cancelRun({
        runId,
        companyId,
        actor,
        reason: "no",
        publishLiveEvent: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_INPUT });
  });
});

describe("governedWorkflowService — reactivateRun", () => {
  let db: Db;

  function mkSvc() {
    return governedWorkflowService(db, {
      resolveGitProvider: (async () => stubProvider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
  }

  async function seedCompany(suffix: string): Promise<string> {
    const companyId = crypto.randomUUID();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, ${"Reactivate-" + suffix + "-" + rand}, ${"RR" + rand})`,
    );
    await db.execute(
      sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyId}, 'hello-world', 'v1.0.0')`,
    );
    return companyId;
  }

  async function launchRun(opts: { userId?: string } = {}): Promise<{
    companyId: string;
    runId: string;
    actor: { type: "user"; id: string };
  }> {
    const userId = opts.userId ?? `init-${crypto.randomUUID()}`;
    const companyId = await seedCompany(userId.slice(0, 6));
    await setTenantContext(db, companyId);
    const svc = mkSvc();
    const { runId } = await svc.launchWorkflow({
      companyId,
      name: "hello-world",
      params: {},
      actor: { type: "user", id: userId },
    });
    return { companyId, runId, actor: { type: "user", id: userId } };
  }

  // Cancel a run as the initiator so we have a cancelled run to reactivate.
  async function launchAndCancelRun(): Promise<{
    companyId: string;
    runId: string;
    actor: { type: "user"; id: string };
  }> {
    const { companyId, runId, actor } = await launchRun();
    await mkSvc().cancelRun({
      runId,
      companyId,
      actor,
      reason: "test setup cancel",
      publishLiveEvent: vi.fn(),
    });
    return { companyId, runId, actor };
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

  it("happy path: clears cancellation fields, restores steps, emits, audits", async () => {
    const { companyId, runId, actor } = await launchAndCancelRun();
    const publish = vi.fn();
    const result = await mkSvc().reactivateRun({
      runId,
      companyId,
      actor,
      publishLiveEvent: publish,
    });

    expect(result.runId).toBe(runId);
    expect(result.reactivatedStepIds.length).toBeGreaterThan(0);

    // Run row: all 4 cancellation fields cleared.
    const { governedWorkflowRuns } = await import("@mnm/db");
    const runRows = await db
      .select()
      .from(governedWorkflowRuns)
      .where(sql`${governedWorkflowRuns.id} = ${runId}`);
    expect(runRows[0]!.cancelledAt).toBeNull();
    expect(runRows[0]!.cancelledByActorId).toBeNull();
    expect(runRows[0]!.cancelledByActorType).toBeNull();
    expect(runRows[0]!.cancellationReason).toBeNull();

    // Live event published with expected shape.
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "governed_run.reactivated",
        companyId,
        payload: expect.objectContaining({
          runId,
          reactivatedByActorId: actor.id,
          reactivatedByActorType: "user",
        }),
      }),
    );

    // Audit row inserted.
    const auditRows = await db.execute(sql`
      SELECT action, target_id, metadata
      FROM audit_events
      WHERE company_id = ${companyId} AND action = 'governed_run.reactivated'
    `) as unknown as Array<{ action: string; target_id: string; metadata: any }>;
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.target_id).toBe(runId);
    expect(auditRows[0]!.metadata).toMatchObject({ runId });
    expect(Array.isArray(auditRows[0]!.metadata.reactivatedStepIds)).toBe(true);
  });

  it("restores step to pending if startedAt is null, running if not null", async () => {
    const { companyId, runId, actor } = await launchRun();
    // Seed two steps in distinct states: one never-started, one started.
    // The launchWorkflow path inserted 1 step ("greet") in 'pending' with
    // startedAt=NULL. Add a second step with startedAt set.
    await db.execute(sql`
      INSERT INTO governed_step_executions (company_id, run_id, step_id_in_json, state, started_at)
      VALUES (${companyId}, ${runId}, 'step-was-running', 'running', now())
    `);
    // Cancel — both steps cascade to 'cancelled', but startedAt is preserved.
    await mkSvc().cancelRun({
      runId,
      companyId,
      actor,
      reason: "setup for reactivate",
      publishLiveEvent: vi.fn(),
    });

    // Reactivate.
    await mkSvc().reactivateRun({
      runId,
      companyId,
      actor,
      publishLiveEvent: vi.fn(),
    });

    const stepRows = await db.execute(sql`
      SELECT step_id_in_json, state FROM governed_step_executions WHERE run_id = ${runId}
    `) as unknown as Array<{ step_id_in_json: string; state: string }>;
    const stateBy = (sid: string) =>
      stepRows.find((r) => r.step_id_in_json === sid)!.state;

    // Never-started step → pending. Previously-running step → running.
    expect(stateBy("greet")).toBe("pending");
    expect(stateBy("step-was-running")).toBe("running");
  });

  it("rejects when run is not cancelled", async () => {
    const { companyId, runId, actor } = await launchRun();
    await expect(
      mkSvc().reactivateRun({
        runId,
        companyId,
        actor,
        publishLiveEvent: vi.fn(),
      }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_CANCELLED,
    });
  });

  it("rejects non-initiator without permission", async () => {
    const { companyId, runId } = await launchAndCancelRun();
    // Stranger B has no membership/role on this company.
    const stranger = { type: "user" as const, id: crypto.randomUUID() };
    await expect(
      mkSvc().reactivateRun({
        runId,
        companyId,
        actor: stranger,
        publishLiveEvent: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: WORKFLOW_ERROR_CODES.WORKFLOW_FORBIDDEN });
  });
});

describe("governedWorkflowsService — cancelled run guard", () => {
  let db: Db;

  // Stub provider for this suite — a 2-step workflow lets us:
  //  - complete step 1 (no entry/exit gates) so launchStep on step 2 has its
  //    deps satisfied (test 1)
  //  - leave step 1 running and try completeStep after cancellation (test 2)
  const TWO_STEP_WORKFLOW = {
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name: "hello-world",
    variables: {},
    steps: [
      { id: "greet", deps: [], agent: "greeter", prompt_context: {}, gates: {} },
      { id: "shout", deps: ["greet"], agent: "shouter", prompt_context: {}, gates: {} },
    ],
  };

  const provider = {
    fetchBlob: async () => JSON.stringify(TWO_STEP_WORKFLOW),
    listTags: async () => [{ name: "v1.0.0", sha: "deadbeef" }],
    resolveRef: async () => "deadbeef",
    pathExists: async () => true,
    commitFile: async () => ({ sha: "x" }),
  };

  function mkSvc() {
    return governedWorkflowService(db, {
      resolveGitProvider: (async () => provider) as any,
      shaCache: { get: () => undefined, set: () => undefined } as any,
    });
  }

  // Fresh company per test — isolates accessService role caches and avoids
  // cross-pollination of governed_workflow_definitions (mirrors the cancelRun
  // / reactivateRun describe blocks).
  async function seedCompany(suffix: string): Promise<string> {
    const companyId = crypto.randomUUID();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, ${"Guard-" + suffix + "-" + rand}, ${"GD" + rand})`,
    );
    await db.execute(
      sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag) VALUES (${companyId}, 'hello-world', 'v1.0.0')`,
    );
    return companyId;
  }

  // Launch a fresh run and return run identity + an actor pointing at the
  // initiator (so cancelRun's permission check passes via the initiator path).
  async function launchRun(): Promise<{
    companyId: string;
    runId: string;
    actor: { type: "user"; id: string };
  }> {
    const userId = `init-${crypto.randomUUID()}`;
    const companyId = await seedCompany(userId.slice(0, 6));
    await setTenantContext(db, companyId);
    const svc = mkSvc();
    const { runId } = await svc.launchWorkflow({
      companyId,
      name: "hello-world",
      params: {},
      actor: { type: "user", id: userId },
    });
    return { companyId, runId, actor: { type: "user", id: userId } };
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

  it("launchStep throws WORKFLOW_RUN_CANCELLED on a cancelled run", async () => {
    const { companyId, runId, actor } = await launchRun();
    const svc = mkSvc();

    // Mark the first step succeeded so 'shout' (deps=[greet]) is launchable.
    // We then cancel the run and confirm launchStep on 'shout' rejects with
    // WORKFLOW_RUN_CANCELLED rather than the deps/state errors that would
    // otherwise apply (the cascade moves 'shout' to 'cancelled').
    await db.execute(sql`
      UPDATE governed_step_executions
      SET state = 'succeeded', completed_at = now()
      WHERE run_id = ${runId} AND step_id_in_json = 'greet'
    `);

    await svc.cancelRun({
      runId,
      companyId,
      actor,
      reason: "test setup: cancel before launchStep",
      publishLiveEvent: vi.fn(),
    });

    await expect(
      svc.launchStep({
        companyId,
        runId,
        stepId: "shout",
        actor,
      }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.WORKFLOW_RUN_CANCELLED,
    });
  });

  it("completeStep throws WORKFLOW_RUN_CANCELLED on a cancelled run", async () => {
    const { companyId, runId, actor } = await launchRun();
    const svc = mkSvc();

    // Move the first step to 'running' so completeStep would normally proceed.
    // Cancellation cascades it to 'cancelled' — the guard must still fire on
    // the RUN's cancelledAt, not on the step state (otherwise the
    // WORKFLOW_ALREADY_COMPLETED check, which only matches succeeded/failed,
    // would silently let the call through to commitHandoffArtifacts).
    await db.execute(sql`
      UPDATE governed_step_executions
      SET state = 'running', started_at = now()
      WHERE run_id = ${runId} AND step_id_in_json = 'greet'
    `);

    await svc.cancelRun({
      runId,
      companyId,
      actor,
      reason: "test setup: cancel before completeStep",
      publishLiveEvent: vi.fn(),
    });

    await expect(
      svc.completeStep({
        companyId,
        runId,
        stepId: "greet",
        artifact: { outputs: [], data: { greeting: "hi" } },
        actor,
      }),
    ).rejects.toMatchObject({
      code: WORKFLOW_ERROR_CODES.WORKFLOW_RUN_CANCELLED,
    });
  });
});
