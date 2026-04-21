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

describe("LocalBareRepoProvider.commitFile", () => {
  it("adds a new file and returns the new commit sha", async () => {
    const result = await provider.commitFile({
      path: "workflow.json",
      content: '{"name":"hello-world"}',
      message: "add workflow",
      branch: "main",
      authorName: "Tom User",
      authorEmail: "tom@example.com",
    });
    expect(result.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.sha).not.toBe(repo.seedSha);

    const content = await provider.fetchBlob({ path: "workflow.json", ref: "main" });
    expect(content.trim()).toBe('{"name":"hello-world"}');
  });

  it("stamps the requested author on the commit (not the runner's git config)", async () => {
    const result = await provider.commitFile({
      path: "file.txt",
      content: "x",
      message: "add file",
      branch: "main",
      authorName: "Tom User",
      authorEmail: "tom@example.com",
    });
    const { stdout } = await execFileAsync(
      "git",
      [
        "--git-dir",
        repo.dir,
        "show",
        "--quiet",
        "--format=%an <%ae>",
        result.sha,
      ],
    );
    expect(stdout.trim()).toBe("Tom User <tom@example.com>");
  });

  it("updates an existing file", async () => {
    await provider.commitFile({
      path: "README.md",
      content: "updated\n",
      message: "bump readme",
      branch: "main",
      authorName: "Tom",
      authorEmail: "tom@example.com",
    });
    const content = await provider.fetchBlob({ path: "README.md", ref: "main" });
    expect(content).toBe("updated\n");
  });

  it("creates nested directories as needed", async () => {
    await provider.commitFile({
      path: "gates/deep/nested/check.gate.ts",
      content: "export default () => ({ pass: true, report: 'ok' });\n",
      message: "add nested gate",
      branch: "main",
      authorName: "Tom",
      authorEmail: "tom@example.com",
    });
    expect(
      await provider.pathExists({ path: "gates/deep/nested/check.gate.ts", ref: "main" }),
    ).toBe(true);
  });
});
