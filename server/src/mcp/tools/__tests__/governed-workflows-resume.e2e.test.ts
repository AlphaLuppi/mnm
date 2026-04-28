import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { LocalBareRepoProvider, ShaCache } from "@mnm/git-provider";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";
import type { Db } from "@mnm/db";
import governedWorkflowTools from "../governed-workflows.tool.js";
import { collectTools } from "../../registry/define-mcp-tools.js";
import { governedWorkflowService } from "../../../services/governed-workflows.js";
import { setTenantContext, clearTenantContext } from "../../../middleware/tenant-context.js";
import { seedBareRepo, type BareRepoSeed } from "./fixtures/seed-bare-repo.js";
import type { McpActor } from "../../registry/types.js";
import { PERMISSIONS } from "@mnm/shared";

const COMPANY_ID = "00000000-0000-0000-0000-00000000e2e2";

function mkActor(): McpActor {
  return {
    type: "user",
    userId: "u-e2e-resume-1",
    companyId: COMPANY_ID,
    effectivePermissions: new Set([PERMISSIONS.WORKFLOWS_READ, PERMISSIONS.WORKFLOWS_ENFORCE]),
    effectiveTags: [],
    mcpSessionId: "sess-e2e-resume",
  };
}

describe("resume_governed_workflow_run", () => {
  let db: Db;
  let repo: BareRepoSeed;
  let tools: ReturnType<typeof collectTools>;

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    repo = await seedBareRepo();

    // Seed company + governed_workflow_definitions row (separate company from the other E2E test)
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${COMPANY_ID}, 'E2E-Resume', 'GWER')`);
    await db.execute(sql`
      INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
      VALUES (${COMPANY_ID}, 'hello-world', ${repo.tag})
    `);

    const gitProvider = new LocalBareRepoProvider({
      providerId: "local:e2e-resume",
      repoDir: repo.repoDir,
    });
    const shaCache = new ShaCache();
    const svc = governedWorkflowService(db, { resolveGitProvider: async () => gitProvider, shaCache });

    tools = collectTools(governedWorkflowTools, { db, governedWorkflows: svc } as any, db);
  });

  afterAll(async () => {
    await clearTenantContext(db);
    await repo.cleanup();
    await teardownTestDb(db);
  });

  it("returns history + current_step matching launch shape after completing first step", async () => {
    const actor = mkActor();

    // Step 1: launch the workflow
    const launchWorkflow = tools.find((t) => t.name === "launch_governed_workflow")!;
    const launchRes = await launchWorkflow.handler({
      input: { name: "hello-world", params: { name: "Tom" } },
      actor,
    });
    expect(launchRes.isError).toBeFalsy();
    const runId: string = JSON.parse(launchRes.content[0]!.text).run_id;

    // Step 2: launch the first step (transitions it to running)
    const launchStep = tools.find((t) => t.name === "launch_governed_step")!;
    const greetLaunchRes = await launchStep.handler({
      input: { run_id: runId, step_id: "greet" },
      actor,
    });
    expect(greetLaunchRes.isError).toBeFalsy();
    expect(JSON.parse(greetLaunchRes.content[0]!.text).agent_name).toBe("greeter");

    // Step 3: complete the first step with an artifact that satisfies the greet exit gate
    // (passes { greeting: "..." } as a flat artifact — commitHandoffArtifacts is a no-op
    // for non-file outputs, so it is stored as-is; the gate sees ctx.artifact.greeting)
    const completeStep = tools.find((t) => t.name === "complete_governed_step")!;
    const greetCompleteRes = await completeStep.handler({
      input: { run_id: runId, step_id: "greet", artifact: { greeting: "Hello, Tom!" } },
      actor,
    });
    expect(greetCompleteRes.isError).toBeFalsy();
    expect(JSON.parse(greetCompleteRes.content[0]!.text).step_state).toBe("succeeded");

    // Step 4: call resume_governed_workflow_run — the run has 1 succeeded step
    // and 1 pending step (shout). Expect history + current_step.
    const resumeTool = tools.find((t) => t.name === "resume_governed_workflow_run")!;
    const resumeRes = await resumeTool.handler({
      input: { run_id: runId },
      actor,
    });
    expect(resumeRes.isError).toBeFalsy();
    const payload = JSON.parse(resumeRes.content[0]!.text);

    // History assertions
    expect(payload.history).toHaveLength(1);
    expect(payload.history[0].step_id).toBe("greet");
    expect(payload.history[0].state).toBe("succeeded");
    // The artifact was stored as flat object (no outputs array in this case)
    expect(payload.history[0].data).toBeDefined();

    // Current step assertions — should be "shout" (the next pending step)
    expect(payload.current_step).not.toBeNull();
    expect(payload.current_step.step_id).toBe("shout");
    expect(payload.current_step.state).toBe("pending");
    expect(payload.current_step.agent_name).toBe("shouter");
    expect(payload.current_step.prompt_context).toBeDefined();
    expect(payload.current_step.handoffs).toBeDefined();
    expect(payload.current_step.run_branch).toBeDefined();
    expect(payload.current_step.subagent_type).toBe("mnm--shouter");

    // Top-level run metadata
    expect(payload.run_id).toBe(runId);
    expect(payload.workflow_name).toBe("hello-world");
    expect(payload.workflow_git_tag).toBe(repo.tag);
    expect(payload.status).toBe("active");
  });

  it("returns current_step: null when the run is fully completed", async () => {
    const actor = mkActor();

    // Launch a fresh run
    const launchWorkflow = tools.find((t) => t.name === "launch_governed_workflow")!;
    const launchRes = await launchWorkflow.handler({
      input: { name: "hello-world", params: { name: "Alice" } },
      actor,
    });
    expect(launchRes.isError).toBeFalsy();
    const runId: string = JSON.parse(launchRes.content[0]!.text).run_id;

    const launchStep = tools.find((t) => t.name === "launch_governed_step")!;
    const completeStep = tools.find((t) => t.name === "complete_governed_step")!;

    // Complete greet
    await launchStep.handler({ input: { run_id: runId, step_id: "greet" }, actor });
    const greetDone = await completeStep.handler({
      input: { run_id: runId, step_id: "greet", artifact: { greeting: "Hello, Alice!" } },
      actor,
    });
    expect(greetDone.isError).toBeFalsy();

    // Complete shout
    await launchStep.handler({ input: { run_id: runId, step_id: "shout" }, actor });
    const shoutDone = await completeStep.handler({
      input: { run_id: runId, step_id: "shout", artifact: { shouted: "HELLO, ALICE!" } },
      actor,
    });
    expect(shoutDone.isError).toBeFalsy();
    expect(JSON.parse(shoutDone.content[0]!.text).run_status).toBe("completed");

    // Resume on a completed run
    const resumeTool = tools.find((t) => t.name === "resume_governed_workflow_run")!;
    const resumeRes = await resumeTool.handler({ input: { run_id: runId }, actor });
    expect(resumeRes.isError).toBeFalsy();
    const payload = JSON.parse(resumeRes.content[0]!.text);

    expect(payload.status).toBe("completed");
    expect(payload.history).toHaveLength(2);
    expect(payload.current_step).toBeNull();
  });

  it("returns WORKFLOW_RUN_NOT_FOUND for an unknown run_id", async () => {
    const actor = mkActor();
    const resumeTool = tools.find((t) => t.name === "resume_governed_workflow_run")!;
    const res = await resumeTool.handler({
      input: { run_id: "00000000-0000-0000-0000-000000000000" },
      actor,
    });
    expect(res.isError).toBeTruthy();
    const body = JSON.parse(res.content[0]!.text);
    expect(body.error_code).toBe("WORKFLOW_RUN_NOT_FOUND");
  });
});
