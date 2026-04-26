import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

const FEATURE_DEV_WORKFLOW_JSON = JSON.stringify({
  apiVersion: "mnm/v1",
  kind: "GovernedWorkflow",
  name: "feature-dev",
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

interface FeatureDevRepoSeed {
  repoDir: string;
  sha: string;
  tag: string;
  cleanup: () => Promise<void>;
}

async function seedFeatureDevRepo(): Promise<FeatureDevRepoSeed> {
  // Git-first layout: agents/<name>/agent.md + workflows/<name>/workflow.json
  const seedFiles: Record<string, string> = {
    "agents/senior-dev/agent.md": SENIOR_DEV_AGENT_MD,
    "workflows/feature-dev/workflow.json": FEATURE_DEV_WORKFLOW_JSON,
    "workflows/feature-dev/gates/tech-design-exit.gate.ts": TECH_DESIGN_EXIT_GATE,
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
  await runIn(bareDir, ["tag", "feature-dev/v1.0.0", seedSha]);

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

describe("P11 E2E — feature-dev tech-design step (git-first agents)", () => {
  let db: Db;
  let repo: FeatureDevRepoSeed;
  let companyId: string;
  let svc: ReturnType<typeof governedWorkflowService>;

  const agentTag = "agents/v1.0.0";
  const workflowTag = "feature-dev/v1.0.0";

  beforeAll(async () => {
    db = await setupTestDb();
    repo = await seedFeatureDevRepo();

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
      VALUES (${companyId}, 'feature-dev', ${workflowTag})
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

  it("launches feature-dev tech-design step end-to-end", async () => {
    await setTenantContext(db, companyId);

    // ── Step 1: setupWorkspace — exercises agents/<name>/agent.md path ────
    const setup = await svc.setupWorkspace({ companyId, userId: "u-1" });

    const seniorDev = setup.agents.find((a) => a.name === "mnm--senior-dev");
    expect(seniorDev).toBeDefined();

    // sha is computed via sha256(content) by loadCanonicalAgent — verify it
    // matches a fresh sha256 of the known content we seeded.
    const expectedSeniorDevSha = seniorDev!.sha;
    const recomputedSha = createHash("sha256")
      .update(SENIOR_DEV_AGENT_MD)
      .digest("hex");
    expect(expectedSeniorDevSha).toBe(recomputedSha);
    expect(expectedSeniorDevSha).toMatch(/^[0-9a-f]{64}$/);

    // targetPath must be the namespaced ~/.claude/agents/<mnm--name>.md path.
    expect(seniorDev!.targetPath).toBe("~/.claude/agents/mnm--senior-dev.md");

    // ── Step 2: launchWorkflow ─────────────────────────────────────────────
    const launchResult = await svc.launchWorkflow({
      companyId,
      name: "feature-dev",
      params: { ticket_id: "ISSUE-NN", gitlab_project: "example-org/repo" },
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
        ticket_id: "ISSUE-NN",
      }),
    });
  });
});
