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
    const svc = governedWorkflowService(db, { resolveGitProvider: async () => gitProvider, shaCache });

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

  // ── Task 16 — full cancel + reactivate cycle via MCP ──────────────────
  // Drives the cancel/reactivate lifecycle end-to-end through the MCP tool
  // layer: launch a run, cancel it, verify launch_governed_step and
  // complete_governed_step both surface WORKFLOW_RUN_CANCELLED, then
  // reactivate and confirm step launch resumes.
  //
  // We deliberately keep the cycle minimal — we cancel BEFORE completing
  // any step. The cancellation cascade flips pending step executions to
  // `cancelled`, which is enough to exercise the run-level guard (the same
  // guard that fires regardless of which step is targeted). Service-level
  // tests already cover partial-progress cancel scenarios in detail
  // (Task 5/6 — 12 unit tests). The blocked-after-cancel / unblocked-after-
  // reactivate assertions are the load-bearing ones for this E2E.
  it("launch → cancel → blocked launch+complete → reactivate → resume launch", async () => {
    const actor = mkActor();

    const launch = tools.find((t) => t.name === "launch_governed_workflow")!;
    const launchStep = tools.find((t) => t.name === "launch_governed_step")!;
    const completeStep = tools.find((t) => t.name === "complete_governed_step")!;
    const cancelRun = tools.find((t) => t.name === "cancel_governed_workflow_run")!;
    const reactivateRun = tools.find((t) => t.name === "reactivate_governed_workflow_run")!;

    // ── Launch a fresh run ─────────────────────────────────────────────
    const launchRes = await launch.handler({
      input: { name: "hello-world", params: { name: "Alice" } },
      actor,
    });
    expect(launchRes.isError).toBeFalsy();
    const launchBody = JSON.parse(launchRes.content[0]!.text);
    const runId: string = launchBody.run_id;
    expect(runId).toBeTruthy();
    expect(launchBody.first_step).toBe("greet");

    // ── Cancel the run BEFORE any step completes ───────────────────────
    // Pending step executions are cascaded to `cancelled` by cancelRun.
    const cancelRes = await cancelRun.handler({
      input: { run_id: runId, reason: "scenario-cancel-task16" },
      actor,
    });
    expect(cancelRes.isError).toBeFalsy();
    const cancelBody = JSON.parse(cancelRes.content[0]!.text);
    expect(cancelBody.run_id).toBe(runId);
    expect(cancelBody.cancelled_at).toBeDefined();
    expect(Array.isArray(cancelBody.cancelled_step_ids)).toBe(true);

    // ── launch_governed_step on step `greet` must surface WORKFLOW_RUN_CANCELLED ─
    // The MCP tool layer maps GovernedWorkflowError onto an error envelope
    // (`isError: true` + JSON body with `error_code`) — see governedError()
    // in governed-workflows.tool.ts. We assert on the envelope shape rather
    // than `.rejects` because errors are returned, not thrown.
    const blockedLaunchRes = await launchStep.handler({
      input: { run_id: runId, step_id: "greet" },
      actor,
    });
    expect(blockedLaunchRes.isError).toBe(true);
    const blockedLaunchBody = JSON.parse(blockedLaunchRes.content[0]!.text);
    expect(blockedLaunchBody.error_code).toBe("WORKFLOW_RUN_CANCELLED");

    // ── complete_governed_step on step `greet` must also surface WORKFLOW_RUN_CANCELLED ─
    const blockedCompleteRes = await completeStep.handler({
      input: {
        run_id: runId,
        step_id: "greet",
        artifact: { outputs: [], data: { greeting: "anything" } },
      },
      actor,
    });
    expect(blockedCompleteRes.isError).toBe(true);
    const blockedCompleteBody = JSON.parse(blockedCompleteRes.content[0]!.text);
    expect(blockedCompleteBody.error_code).toBe("WORKFLOW_RUN_CANCELLED");

    // ── Reactivate ─────────────────────────────────────────────────────
    const reactivateRes = await reactivateRun.handler({
      input: { run_id: runId },
      actor,
    });
    expect(reactivateRes.isError).toBeFalsy();
    const reactivateBody = JSON.parse(reactivateRes.content[0]!.text);
    expect(reactivateBody.run_id).toBe(runId);
    expect(Array.isArray(reactivateBody.reactivated_step_ids)).toBe(true);
    expect(reactivateBody.reactivated_step_ids.length).toBeGreaterThan(0);

    // ── After reactivation, launch_governed_step succeeds again ────────
    const resumedLaunchRes = await launchStep.handler({
      input: { run_id: runId, step_id: "greet" },
      actor,
    });
    expect(resumedLaunchRes.isError).toBeFalsy();
    const resumedLaunchBody = JSON.parse(resumedLaunchRes.content[0]!.text);
    expect(resumedLaunchBody.agent_name).toBe("greeter");
  });
});
