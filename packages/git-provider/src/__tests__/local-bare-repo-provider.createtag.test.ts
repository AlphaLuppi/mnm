import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LocalBareRepoProvider } from "../local-bare-repo-provider.js";
import { makeBareRepo, type BareRepoHandle } from "./fixtures/make-bare-repo.js";

const execFileAsync = promisify(execFile);

let repo: BareRepoHandle;
let provider: LocalBareRepoProvider;

beforeEach(async () => {
  repo = await makeBareRepo({
    seedFiles: { "README.md": "hello\n" },
    branch: "main",
  });
  provider = new LocalBareRepoProvider({ providerId: "local-test", repoDir: repo.dir });
});

afterEach(async () => {
  await repo.cleanup();
});

describe("LocalBareRepoProvider.createTag", () => {
  it("creates a lightweight tag pointing at the seed sha", async () => {
    const result = await provider.createTag({ name: "my-wf/v1.0.0", ref: repo.seedSha });
    expect(result.sha).toBe(repo.seedSha);

    const tags = await provider.listTags();
    expect(tags.map((t) => t.name)).toContain("my-wf/v1.0.0");
  });

  it("creates an annotated tag when message is supplied", async () => {
    const result = await provider.createTag({
      name: "my-wf/v1.0.1",
      ref: repo.seedSha,
      message: "release v1.0.1",
    });
    expect(result.sha).toBe(repo.seedSha);

    // Annotated tags appear in for-each-ref; verify the name is present.
    const { stdout } = await execFileAsync(
      "git",
      ["--git-dir", repo.dir, "tag", "-l", "my-wf/v1.0.1"],
    );
    expect(stdout.trim()).toBe("my-wf/v1.0.1");
  });

  it("creates a tag pointing at a branch name (resolves via resolveRef)", async () => {
    const result = await provider.createTag({ name: "my-wf/v2.0.0", ref: "main" });
    expect(result.sha).toBe(repo.seedSha);
  });

  it("throws a GitProviderError when the sha does not exist", async () => {
    const { GitProviderError } = await import("../errors.js");
    await expect(
      provider.createTag({ name: "bad-tag", ref: "0000000000000000000000000000000000000000" }),
    ).rejects.toBeInstanceOf(GitProviderError);
  });
});
