import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { sql } from "drizzle-orm";
import { LocalBareRepoProvider, ShaCache } from "@mnm/git-provider";
import type { ProviderWithPaths } from "../services/git-resource-path.js";
import { setupTestDb, teardownTestDb } from "@mnm/test-utils";
import type { Db } from "@mnm/db";
import { governedWorkflowService } from "../services/governed-workflows.js";
import { setTenantContext, clearTenantContext } from "../middleware/tenant-context.js";

const execFileAsync = promisify(execFile);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SENIOR_DEV_AGENT_MD = `---
name: senior-dev
description: Tech lead for AY features
---

# Senior Dev agent
Analyse the ticket and write the tech design.
`;

// Minimal pass-through gate so the test does not depend on canonical gates.
const TECH_DESIGN_EXIT_GATE = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => ({ pass: true, report: "ok" }));
`;

const CBA_FEATURE_DEV_WORKFLOW_JSON = JSON.stringify({
  apiVersion: "mnm/v1",
  kind: "GovernedWorkflow",
  name: "cba-feature-dev",
  variables: {
    ticket_id: { type: "string", required: true },
    gitlab_project: { type: "string", required: true },
  },
  steps: [
    {
      id: "tech-design",
      deps: [],
      agent: "senior-dev",
      prompt_context: {
        ticket_id: "{{variables.ticket_id}}",
        gitlab_project: "{{variables.gitlab_project}}",
      },
      gates: {
        exit: [{ id: "tech-design-ok", source: "./gates/tech-design-exit.gate.ts" }],
      },
    },
  ],
});

// ── Bare repo factory ─────────────────────────────────────────────────────────

interface CbaRepoSeed {
  repoDir: string;
  sha: string;
  tag: string;
  cleanup: () => Promise<void>;
}

async function seedCbaFeatureDevRepo(): Promise<CbaRepoSeed> {
  // Git-first layout: agents/<name>/agent.md + workflows/<name>/workflow.json
  const seedFiles: Record<string, string> = {
    "agents/senior-dev/agent.md": SENIOR_DEV_AGENT_MD,
    "workflows/cba-feature-dev/workflow.json": CBA_FEATURE_DEV_WORKFLOW_JSON,
    "workflows/cba-feature-dev/gates/tech-design-exit.gate.ts": TECH_DESIGN_EXIT_GATE,
  };

  const branch = "main";
  const root = await mkdtemp(join(tmpdir(), "mnm-p11-"));
  const bareDir = join(root, "repo.git");
  const workDir = join(root, "work");

  await mkdir(bareDir, { recursive: true });
  await mkdir(workDir, { recursive: true });

  const runIn = async (cwd: string, args: string[]): Promise<string> => {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim();
  };

  await runIn(bareDir, ["init", "--bare", "--initial-branch", branch]);
  await runIn(workDir, ["init", "--initial-branch", branch]);
  await runIn(workDir, ["remote", "add", "origin", bareDir]);

  for (const [relPath, content] of Object.entries(seedFiles)) {
    const abs = join(workDir, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }

  await runIn(workDir, ["add", "-A"]);
  await runIn(workDir, ["-c", "user.name=seed", "-c", "user.email=seed@mnm.test", "commit", "-m", "seed"]);
  await runIn(workDir, ["push", "origin", branch]);
  const seedSha = await runIn(workDir, ["rev-parse", "HEAD"]);

  // Lightweight tag in the bare repo.
  await runIn(bareDir, ["tag", "agents/v1.0.0", seedSha]);
  await runIn(bareDir, ["tag", "cba-feature-dev/v1.0.0", seedSha]);

  return {
    repoDir: bareDir,
    sha: seedSha,
    tag: "agents/v1.0.0",
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("P11 E2E — cba-feature-dev tech-design step (git-first agents)", () => {
  let db: Db;
  let repo: CbaRepoSeed;
  let companyId: string;
  let svc: ReturnType<typeof governedWorkflowService>;

  const agentTag = "agents/v1.0.0";
  const workflowTag = "cba-feature-dev/v1.0.0";

  beforeAll(async () => {
    db = await setupTestDb();
    repo = await seedCbaFeatureDevRepo();

    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    companyId = crypto.randomUUID();
    const prefix = `P11${suffix}`;

    await db.execute(sql`
      INSERT INTO companies (id, name, issue_prefix)
      VALUES (${companyId}, ${"P11-" + suffix}, ${prefix})
      ON CONFLICT (id) DO NOTHING
    `);

    // Agent row — latest_git_tag points at the agents/v1.0.0 tag (the commit
    // that has agents/senior-dev/agent.md in the git-first layout).
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
      VALUES (${companyId}, 'senior-dev', 'claude_local', ${agentTag}, true)
    `);

    await db.execute(sql`
      INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
      VALUES (${companyId}, 'cba-feature-dev', ${workflowTag})
    `);

    // Build a LocalBareRepoProvider and attach the git-first paths so
    // resolveResourcePath emits agents/<name>/agent.md and
    // workflows/<name>/workflow.json — matching the seeded repo layout.
    const gitProvider = new LocalBareRepoProvider({
      providerId: "local:p11-e2e",
      repoDir: repo.repoDir,
    });
    (gitProvider as unknown as ProviderWithPaths).paths = {
      agents: "agents",
      workflows: "workflows",
    };

    const shaCache = new ShaCache();
    svc = governedWorkflowService(db, {
      resolveGitProvider: async () => gitProvider,
      shaCache,
    });
  });

  afterAll(async () => {
    await clearTenantContext(db);
    await repo?.cleanup();
    await teardownTestDb(db);
  });

  it("launches cba-feature-dev tech-design step end-to-end", async () => {
    await setTenantContext(db, companyId);

    // ── Step 1: setupWorkspace — exercises agents/<name>/agent.md path ────
    const setup = await svc.setupWorkspace({ companyId, userId: "u-1" });

    const seniorDev = setup.agents.find((a) => a.name === "mnm--senior-dev");
    expect(seniorDev).toBeDefined();

    // F1 fix: setupWorkspace rewrites the YAML frontmatter `name:` line so
    // it matches the namespaced filename (`mnm--senior-dev`) — required
    // for Claude Code to dispatch on the same `subagent_type` the server
    // returns from launch_governed_step.
    expect(seniorDev!.content).toContain("name: mnm--senior-dev");
    expect(seniorDev!.content).not.toMatch(/^name:\s+senior-dev$/m);

    // sha is computed via sha256(REWRITTEN content). Verify the contract:
    // sha is sha256 of the content the harness will actually write to disk.
    const expectedSeniorDevSha = seniorDev!.sha;
    const recomputedSha = createHash("sha256")
      .update(seniorDev!.content)
      .digest("hex");
    expect(expectedSeniorDevSha).toBe(recomputedSha);
    expect(expectedSeniorDevSha).toMatch(/^[0-9a-f]{64}$/);

    // targetPath must be the namespaced ~/.claude/agents/<mnm--name>.md path.
    expect(seniorDev!.targetPath).toBe("~/.claude/agents/mnm--senior-dev.md");

    // ── Step 2: launchWorkflow ─────────────────────────────────────────────
    const launchResult = await svc.launchWorkflow({
      companyId,
      name: "cba-feature-dev",
      params: { ticket_id: "AY-10074", gitlab_project: "tom.andrieu/x" },
      actor: { type: "user", id: "u-1" },
    });

    expect(launchResult.runId).toBeTruthy();
    expect(launchResult.firstStep).toBe("tech-design");

    // ── Step 3: launchStep with correct sha → dispatch succeeds ───────────
    const stepResult = await svc.launchStep({
      companyId,
      runId: launchResult.runId,
      stepId: "tech-design",
      actor: { type: "user", id: "u-1" },
      // Pass the sha discovered by setupWorkspace — this exercises the
      // full AGENTS_STALE contract (sha matches → no stale error).
      currentAgents: { "mnm--senior-dev": expectedSeniorDevSha },
      sessionTools: ["Task", "Write", "Read", "Grep", "Glob"],
    });

    expect(stepResult).toMatchObject({
      agentName: "senior-dev",
      subagentType: "mnm--senior-dev",
      promptContext: expect.objectContaining({
        ticket_id: "AY-10074",
      }),
    });
  });

  // Nit-CR-2: round out coverage of the skip-on-404 path against a real
  // LocalBareRepoProvider (unit tests already cover this with a stub).
  it("skip-on-404 + structured warn fires when one agent's .md is missing at the pinned tag", async () => {
    // Seed a second agent row whose latest_git_tag points at a tag that
    // doesn't carry agents/<name>/agent.md — simulating an orphan registration.
    const ghostName = `ghost-${Math.random().toString(36).slice(2, 8)}`;
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, enabled)
      VALUES (${companyId}, ${ghostName}, 'claude_local', ${agentTag}, true)
    `);
    await setTenantContext(db, companyId);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await svc.setupWorkspace({ companyId, userId: "u-1" });
      // The live agent (senior-dev) is included, the orphan is skipped.
      const names = result.agents.map((a) => a.name);
      expect(names).toContain("mnm--senior-dev");
      expect(names).not.toContain(`mnm--${ghostName}`);

      const ourWarns = warnSpy.mock.calls.filter(
        (c) => c[0] === "[mnm.setup_workspace] agent_md_missing",
      );
      expect(ourWarns.length).toBeGreaterThanOrEqual(1);
      const found = ourWarns.find((c) => (c[1] as any).agentName === ghostName);
      expect(found).toBeDefined();
      expect(found![1]).toMatchObject({
        agentName: ghostName,
        latestGitTag: agentTag,
        fullPath: `agents/${ghostName}/agent.md`,
        providerId: "local:p11-e2e",
      });
    } finally {
      warnSpy.mockRestore();
      // Cleanup the orphan so the previous test's assertions stay deterministic
      // if a future test runner reorders.
      await db.execute(sql`DELETE FROM agents WHERE company_id = ${companyId} AND name = ${ghostName}`);
    }
  });
});
