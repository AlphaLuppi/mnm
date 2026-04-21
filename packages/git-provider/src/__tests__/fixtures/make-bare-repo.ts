import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface MakeBareRepoOptions {
  /**
   * Files committed to the initial (seed) revision. Keys are repo-relative
   * POSIX paths. Values are file contents.
   */
  seedFiles: Record<string, string>;
  /**
   * Branch name to point at the seed commit. Defaults to "main".
   */
  branch?: string;
}

export interface BareRepoHandle {
  /** Absolute path to the `--bare` repo (points `--git-dir` at this). */
  dir: string;
  /** Commit sha of the seed revision. */
  seedSha: string;
  /** Remove the tmp work/bare directories. Idempotent. */
  cleanup: () => Promise<void>;
}

/**
 * Creates a throwaway bare git repo seeded with the given files on the given
 * branch. Used by provider tests. Requires a `git` binary on PATH.
 */
export async function makeBareRepo(
  options: MakeBareRepoOptions,
): Promise<BareRepoHandle> {
  if (Object.keys(options.seedFiles).length === 0) {
    throw new Error("makeBareRepo: seedFiles must have >= 1 entry");
  }
  const branch = options.branch ?? "main";
  const root = await mkdtemp(join(tmpdir(), "mnm-git-provider-"));
  const bareDir = join(root, "repo.git");
  const workDir = join(root, "work");

  await mkdir(bareDir, { recursive: true });
  await mkdir(workDir, { recursive: true });

  const runIn = async (cwd: string, args: string[]): Promise<string> => {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim();
  };

  // Initialise the bare repo.
  await runIn(bareDir, ["init", "--bare", "--initial-branch", branch]);

  // Seed via a throwaway worktree cloned from the bare repo.
  await runIn(workDir, ["init", "--initial-branch", branch]);
  await runIn(workDir, ["remote", "add", "origin", bareDir]);

  for (const [relPath, content] of Object.entries(options.seedFiles)) {
    const abs = join(workDir, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }

  await runIn(workDir, ["add", "-A"]);
  await runIn(workDir, [
    "-c",
    "user.name=seed",
    "-c",
    "user.email=seed@mnm.test",
    "commit",
    "-m",
    "seed",
  ]);
  await runIn(workDir, ["push", "origin", branch]);
  const seedSha = await runIn(workDir, ["rev-parse", "HEAD"]);

  return {
    dir: bareDir,
    seedSha,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}
