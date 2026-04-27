import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalBareRepoProvider } from "../local-bare-repo-provider.js";
import { makeBareRepo, type BareRepoHandle } from "./fixtures/make-bare-repo.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("commitMultipleFiles startBranch", () => {
  let repo: BareRepoHandle;

  beforeEach(async () => {
    repo = await makeBareRepo({
      seedFiles: { "README.md": "hello\n" },
      branch: "master",
    });
  });

  afterEach(async () => {
    await repo.cleanup();
  });

  it("creates a new branch starting from startBranch when target branch does not exist", async () => {
    const provider = new LocalBareRepoProvider({
      providerId: "test",
      repoDir: repo.dir,
    });

    const result = await provider.commitMultipleFiles({
      branch: "mnm-runs/abc-123",
      startBranch: "master",
      commitMessage: "step tech-design: handoff",
      authorName: "Tom",
      authorEmail: "tom@cba.fr",
      actions: [
        { path: "artifacts/runs/abc-123/tech-design/design.md", content: "# Design\n" },
      ],
    });

    expect(result.sha).toMatch(/^[a-f0-9]{40}$/);

    // Verify the new branch exists and points at the new commit.
    const { stdout: branchSha } = await execFileAsync("git", [
      "--git-dir",
      repo.dir,
      "rev-parse",
      "refs/heads/mnm-runs/abc-123",
    ]);
    expect(branchSha.trim()).toBe(result.sha);

    // Verify master is unchanged (parent of the new commit, not the same).
    const { stdout: masterSha } = await execFileAsync("git", [
      "--git-dir",
      repo.dir,
      "rev-parse",
      "refs/heads/master",
    ]);
    expect(masterSha.trim()).not.toBe(result.sha);

    // Verify the new commit's parent is master's tip.
    const { stdout: parentSha } = await execFileAsync("git", [
      "--git-dir",
      repo.dir,
      "rev-parse",
      `${result.sha}^`,
    ]);
    expect(parentSha.trim()).toBe(masterSha.trim());
  });
});
