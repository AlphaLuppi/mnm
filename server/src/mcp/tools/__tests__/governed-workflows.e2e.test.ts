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

const COMPANY_ID = "00000000-0000-0000-0000-00000000e2e1";

function mkActor(): McpActor {
  return {
    type: "user",
    userId: "u-e2e-1",
    companyId: COMPANY_ID,
    effectivePermissions: new Set([PERMISSIONS.WORKFLOWS_READ, PERMISSIONS.WORKFLOWS_ENFORCE]),
    effectiveTags: [],
    mcpSessionId: "sess-e2e",
  };
}

describe("governed-workflows E2E via MCP tools", () => {
  let db: Db;
  let repo: BareRepoSeed;
  let tools: ReturnType<typeof collectTools>;

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    repo = await seedBareRepo();

    // Seed company + governed_workflow_definitions row
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${COMPANY_ID}, 'E2E', 'GWE2E')`);
    await db.execute(sql`
      INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
      VALUES (${COMPANY_ID}, 'hello-world', ${repo.tag})
    `);

    const gitProvider = new LocalBareRepoProvider({
      providerId: "local:e2e",
      repoDir: repo.repoDir,
    });
    const shaCache = new ShaCache();
    const svc = governedWorkflowService(db, { gitProvider, shaCache });

    tools = collectTools(governedWorkflowTools, { db, governedWorkflows: svc } as any, db);
  });

  afterAll(async () => {
    await clearTenantContext(db);
    await repo.cleanup();
    await teardownTestDb(db);
  });

  it("drives the full hello-world pipeline (6 steps)", async () => {
    const actor = mkActor();

    // ── Step 1: launch_governed_workflow ──────────────────────────────────
    const launch = tools.find((t) => t.name === "launch_governed_workflow")!;
    const launchRes = await launch.handler({
      input: { name: "hello-world", params: { name: "Tom" } },
      actor,
    });
    expect(launchRes.isError).toBeFalsy();
    const launchBody = JSON.parse(launchRes.content[0]!.text);
    expect(launchBody.run_id).toBeTruthy();
    expect(launchBody.first_step).toBe("greet");
    const runId: string = launchBody.run_id;

    // ── Step 2: launch_governed_step greet ───────────────────────────────
    const launchStep = tools.find((t) => t.name === "launch_governed_step")!;
    const greetLaunchRes = await launchStep.handler({
      input: { run_id: runId, step_id: "greet" },
      actor,
    });
    expect(greetLaunchRes.isError).toBeFalsy();
    const greetLaunchBody = JSON.parse(greetLaunchRes.content[0]!.text);
    expect(greetLaunchBody.agent_name).toBe("greeter");

    // ── Step 3: complete_governed_step greet ─────────────────────────────
    const completeStep = tools.find((t) => t.name === "complete_governed_step")!;
    const greetCompleteRes = await completeStep.handler({
      input: { run_id: runId, step_id: "greet", artifact: { greeting: "Hello, Tom!" } },
      actor,
    });
    expect(greetCompleteRes.isError).toBeFalsy();
    const greetCompleteBody = JSON.parse(greetCompleteRes.content[0]!.text);
    expect(greetCompleteBody.step_state).toBe("succeeded");
    expect(greetCompleteBody.run_status).toBe("active");

    // ── Step 4: launch_governed_step shout ───────────────────────────────
    const shoutLaunchRes = await launchStep.handler({
      input: { run_id: runId, step_id: "shout" },
      actor,
    });
    expect(shoutLaunchRes.isError).toBeFalsy();
    const shoutLaunchBody = JSON.parse(shoutLaunchRes.content[0]!.text);
    expect(shoutLaunchBody.agent_name).toBe("shouter");

    // ── Step 5: complete_governed_step shout ─────────────────────────────
    const shoutCompleteRes = await completeStep.handler({
      input: { run_id: runId, step_id: "shout", artifact: { shouted: "HELLO, TOM!" } },
      actor,
    });
    expect(shoutCompleteRes.isError).toBeFalsy();
    const shoutCompleteBody = JSON.parse(shoutCompleteRes.content[0]!.text);
    expect(shoutCompleteBody.step_state).toBe("succeeded");
    expect(shoutCompleteBody.run_status).toBe("completed");

    // ── Step 6: get_governed_workflow_run ────────────────────────────────
    const getRun = tools.find((t) => t.name === "get_governed_workflow_run")!;
    const runRes = await getRun.handler({
      input: { run_id: runId },
      actor,
    });
    expect(runRes.isError).toBeFalsy();
    const runBody = JSON.parse(runRes.content[0]!.text);
    expect(runBody.status).toBe("completed");
    expect(runBody.steps).toHaveLength(2);
    expect(runBody.steps.every((s: any) => s.state === "succeeded")).toBe(true);
    expect(runBody.last_gate_result).toBeTruthy();
  });
});
