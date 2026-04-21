import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface BareRepoSeed {
  /** Absolute path to the bare repo dir (pass to LocalBareRepoProvider). */
  repoDir: string;
  /** Commit sha of the seed revision. */
  sha: string;
  /** Git tag name pushed onto the seed commit. */
  tag: string;
  /** Remove the tmp directories. */
  cleanup: () => Promise<void>;
}

const WORKFLOW_JSON = JSON.stringify({
  apiVersion: "mnm/v1",
  kind: "GovernedWorkflow",
  name: "hello-world",
  variables: { name: { type: "string", required: true } },
  steps: [
    {
      id: "greet",
      deps: [],
      agent: "greeter",
      prompt_context: { name: "{{variables.name}}" },
      gates: {
        exit: [{ id: "greeting-ok", source: "./gates/greet-exit.gate.ts" }],
      },
    },
    {
      id: "shout",
      deps: ["greet"],
      agent: "shouter",
      prompt_context: { greeting: "{{steps.greet.artifact.greeting}}" },
      gates: {
        exit: [{ id: "uppercase-ok", source: "./gates/shout-exit.gate.ts" }],
      },
    },
  ],
});

// Gate: artifact must have a non-empty string `greeting`.
const GREET_GATE = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => {
  const a = ctx.artifact;
  if (!a || typeof a.greeting !== "string" || !a.greeting) {
    return { pass: false, report: "no greeting", error_code: "MISSING_GREETING" };
  }
  return { pass: true, report: "ok" };
});
`;

// Gate: artifact must have an ALL-CAPS string `shouted`.
const SHOUT_GATE = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => {
  const a = ctx.artifact;
  if (!a || typeof a.shouted !== "string" || a.shouted !== a.shouted.toUpperCase()) {
    return { pass: false, report: "not uppercase" };
  }
  return { pass: true, report: "ok" };
});
`;

/**
 * Creates a throwaway bare git repo seeded with the hello-world workflow
 * (workflow.json + 2 gate files) and a v1.0.0 tag pointing at the seed
 * commit.
 */
export async function seedBareRepo(): Promise<BareRepoSeed> {
  const seedFiles = {
    "hello-world/workflow.json": WORKFLOW_JSON,
    "hello-world/gates/greet-exit.gate.ts": GREET_GATE,
    "hello-world/gates/shout-exit.gate.ts": SHOUT_GATE,
  };

  const branch = "main";
  const root = await mkdtemp(join(tmpdir(), "mnm-e2e-"));
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

  // Create a lightweight tag in the bare repo.
  await runIn(bareDir, ["tag", "v1.0.0", seedSha]);

  return {
    repoDir: bareDir,
    sha: seedSha,
    tag: "v1.0.0",
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}
