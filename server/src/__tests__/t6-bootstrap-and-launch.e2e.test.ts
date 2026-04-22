import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { LocalBareRepoProvider, ShaCache } from "@mnm/git-provider";
import { setupTestDb, teardownTestDb } from "@mnm/test-utils";
import type { Db } from "@mnm/db";
import governedWorkflowTools from "../mcp/tools/governed-workflows.tool.js";
import { collectTools } from "../mcp/registry/define-mcp-tools.js";
import { governedWorkflowService } from "../services/governed-workflows.js";
import { clearTenantContext } from "../middleware/tenant-context.js";
import {
  seedBareRepo,
  type BareRepoSeed,
} from "../mcp/tools/__tests__/fixtures/seed-bare-repo.js";
import type { McpActor } from "../mcp/registry/types.js";
import { PERMISSIONS } from "@mnm/shared";

/**
 * T6 E2E — bootstrap + launch hello-world with stale-agent self-correction.
 *
 * Exercises the real MCP tool stack (via `collectTools`) against the real
 * test DB and a `LocalBareRepoProvider` backed by a temp bare git repo.
 * Mirrors the T5 E2E wiring (`governed-workflows.e2e.test.ts`) rather than
 * introducing a parallel harness — one canonical harness per spec §scope.
 *
 * Scenario:
 *   1. `setup_workspace` returns namespaced `mnm--*` agents with sha.
 *   2. `launch_governed_workflow` opens a run.
 *   3. `launch_governed_step` with a BOGUS sha → `AGENTS_STALE` + fresh sha.
 *   4. Retry with the fresh sha → dispatch succeeds with `agent_name`.
 *   5. `push_local_state` returns the `last-session.json` cache payload.
 */
describe("T6 E2E — bootstrap + launch hello-world with stale-correction", () => {
  let db: Db;
  let repo: BareRepoSeed;
  let tools: ReturnType<typeof collectTools>;
  let companyId: string;
  let actor: McpActor;

  beforeAll(async () => {
    db = await setupTestDb();
    repo = await seedBareRepo();

    // Random suffix so the `issue_prefix` constraint never collides with
    // concurrent suites sharing the singleton test DB.
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const prefix = `T6HL${suffix}`;
    companyId = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO companies (id, name, issue_prefix)
      VALUES (${companyId}, ${"T6HL-" + suffix}, ${prefix})
      ON CONFLICT (id) DO NOTHING
    `);

    // Enabled agents for the hello-world workflow. The `latest_git_tag`
    // MUST match the bare-repo tag so `loadCanonicalAgent` can fetch
    // `<name>/agent.md` at that ref.
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
      VALUES
        (${companyId}, 'greeter', 'claude_local', ${repo.tag}, true),
        (${companyId}, 'shouter', 'claude_local', ${repo.tag}, true)
    `);

    await db.execute(sql`
      INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
      VALUES (${companyId}, 'hello-world', ${repo.tag})
    `);

    const gitProvider = new LocalBareRepoProvider({
      providerId: "local:t6-e2e",
      repoDir: repo.repoDir,
    });
    const shaCache = new ShaCache();
    const svc = governedWorkflowService(db, { resolveGitProvider: async () => gitProvider, shaCache });

    tools = collectTools(
      governedWorkflowTools,
      { db, governedWorkflows: svc } as any,
      db,
    );

    actor = {
      type: "user",
      userId: "u-t6-e2e",
      companyId,
      effectivePermissions: new Set([
        PERMISSIONS.WORKFLOWS_READ,
        PERMISSIONS.WORKFLOWS_ENFORCE,
      ]),
      effectiveTags: [],
      mcpSessionId: "sess-t6-e2e",
    };
  });

  afterAll(async () => {
    await clearTenantContext(db);
    await repo?.cleanup();
    await teardownTestDb(db);
  });

  it("setup_workspace returns agents; launch then rejects stale; retry passes; push_local_state echoes cache", async () => {
    // ── Step 1: setup_workspace — bootstrap materialization list ───────
    const setup = tools.find((t) => t.name === "setup_workspace")!;
    const setupRes = await setup.handler({ input: {}, actor });
    expect(setupRes.isError).toBeFalsy();
    const setupBody = JSON.parse(setupRes.content[0]!.text);
    expect(setupBody.agents.length).toBeGreaterThan(0);
    const greeter = setupBody.agents.find(
      (a: { name: string }) => a.name === "mnm--greeter",
    );
    expect(greeter).toBeDefined();
    expect(greeter.sha).toMatch(/^[0-9a-f]{64}$/);
    expect(greeter.targetPath).toBe("~/.claude/agents/mnm--greeter.md");
    expect(greeter.content.length).toBeGreaterThan(0);

    // ── Step 2: launch_governed_workflow ───────────────────────────────
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
    const firstStep: string = launchBody.first_step;

    // ── Step 3: launch_governed_step with a STALE sha → AGENTS_STALE ──
    const launchStep = tools.find((t) => t.name === "launch_governed_step")!;
    const staleRes = await launchStep.handler({
      input: {
        run_id: runId,
        step_id: firstStep,
        current_agents: { "mnm--greeter": "bogus-stale-sha" },
        session_tools: ["Task", "Write", "Read"],
      },
      actor,
    });
    expect(staleRes.isError).toBe(true);
    const stalePayload = JSON.parse(staleRes.content[0]!.text);
    expect(stalePayload.error_code).toBe("AGENTS_STALE");
    expect(Array.isArray(stalePayload.stale_agents)).toBe(true);
    expect(stalePayload.stale_agents.length).toBeGreaterThan(0);
    const freshSha: string = stalePayload.stale_agents[0].sha;
    expect(freshSha).toMatch(/^[0-9a-f]{64}$/);
    expect(stalePayload.stale_agents[0].name).toBe("mnm--greeter");
    expect(stalePayload.stale_agents[0].target_path).toBe(
      "~/.claude/agents/mnm--greeter.md",
    );

    // The fresh sha returned by AGENTS_STALE must match the one setup_workspace
    // announced — single source of truth.
    expect(freshSha).toBe(greeter.sha);

    // ── Step 4: retry launch_governed_step with the correct sha ───────
    const okRes = await launchStep.handler({
      input: {
        run_id: runId,
        step_id: firstStep,
        current_agents: { "mnm--greeter": freshSha },
        session_tools: ["Task", "Write", "Read"],
      },
      actor,
    });
    expect(okRes.isError).toBeFalsy();
    const dispatched = JSON.parse(okRes.content[0]!.text);
    expect(dispatched.agent_name).toBe("greeter");

    // ── Step 5: push_local_state — cache payload well-formed ──────────
    const push = tools.find((t) => t.name === "push_local_state")!;
    const cacheRes = await push.handler({
      input: {
        agents_provisioned: ["mnm--greeter"],
        plugin_version: "0.1.0",
      },
      actor,
    });
    expect(cacheRes.isError).toBeFalsy();
    const cacheBody = JSON.parse(cacheRes.content[0]!.text);
    expect(cacheBody.target_relative_path).toBe("last-session.json");
    expect(cacheBody.content.agentNames).toContain("mnm--greeter");
    expect(cacheBody.content.lastPluginVersion).toBe("0.1.0");
    expect(typeof cacheBody.content.lastSyncedSha).toBe("string");
    expect(cacheBody.content.lastSyncedSha.length).toBeGreaterThan(0);
    expect(typeof cacheBody.content.pendingRuns).toBe("number");
  });
});
