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
    seedFiles: {
      "workflow.json": '{"name":"hello"}',
      "hello/workflow.json": '{"name":"hello"}',
      "hello/gates/greet.gate.ts": "export default () => ({ pass: true, report: 'ok' });",
      "hello/steps/first.md": "# first",
    },
    branch: "main",
  });
  await execFileAsync("git", ["--git-dir", repo.dir, "tag", "v1.0.0", repo.seedSha]);
  provider = new LocalBareRepoProvider({ providerId: "local-test", repoDir: repo.dir });
});

afterEach(async () => {
  await repo.cleanup();
});

describe("LocalBareRepoProvider.fetchTree", () => {
  it("lists immediate children of a subtree (non-recursive)", async () => {
    const entries = await provider.fetchTree({
      ref: "v1.0.0",
      subtree: "hello",
      recursive: false,
    });
    const paths = entries.map((e) => e.path).sort();
    expect(paths).toEqual(["hello/gates", "hello/steps", "hello/workflow.json"]);
    const wfEntry = entries.find((e) => e.path === "hello/workflow.json")!;
    expect(wfEntry.type).toBe("blob");
    expect(wfEntry.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(wfEntry.size).toBe('{"name":"hello"}'.length);
    const gatesEntry = entries.find((e) => e.path === "hello/gates")!;
    expect(gatesEntry.type).toBe("tree");
    expect(gatesEntry.size).toBeNull();
  });

  it("recursively lists nested blobs under the subtree", async () => {
    const entries = await provider.fetchTree({
      ref: "v1.0.0",
      subtree: "hello",
      recursive: true,
    });
    const blobs = entries.filter((e) => e.type === "blob").map((e) => e.path).sort();
    expect(blobs).toEqual([
      "hello/gates/greet.gate.ts",
      "hello/steps/first.md",
      "hello/workflow.json",
    ]);
  });

  it("lists the repo root when no subtree is provided", async () => {
    const entries = await provider.fetchTree({ ref: "main" });
    const paths = entries.map((e) => e.path).sort();
    expect(paths).toContain("workflow.json");
    expect(paths).toContain("hello");
  });

  it("throws not_found for an unknown ref", async () => {
    await expect(
      provider.fetchTree({ ref: "no-such-ref" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("LocalBareRepoProvider.commitMultipleFiles", () => {
  it("applies create+update+delete in one commit and returns the sha", async () => {
    const result = await provider.commitMultipleFiles({
      branch: "main",
      commitMessage: "batch edit",
      authorName: "Tom",
      authorEmail: "tom@example.com",
      actions: [
        { path: "hello/workflow.json", content: '{"name":"hello","v":2}' }, // update
        { path: "hello/new.md", content: "new file\n" }, // create
        { path: "hello/steps/first.md", delete: true }, // delete
      ],
    });
    expect(result.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.sha).not.toBe(repo.seedSha);

    // Verify via ls-tree at the new commit.
    const { stdout } = await execFileAsync("git", [
      "--git-dir",
      repo.dir,
      "ls-tree",
      "-r",
      "--name-only",
      result.sha,
    ]);
    const files = stdout.split("\n").filter((l) => l.length > 0).sort();
    expect(files).toContain("hello/workflow.json");
    expect(files).toContain("hello/new.md");
    expect(files).not.toContain("hello/steps/first.md");

    // Verify the update actually changed content.
    const updated = await provider.fetchBlob({
      path: "hello/workflow.json",
      ref: "main",
    });
    expect(updated).toBe('{"name":"hello","v":2}');
  });

  it("stamps the requested author identity on the commit", async () => {
    const result = await provider.commitMultipleFiles({
      branch: "main",
      commitMessage: "author test",
      authorName: "Alice Author",
      authorEmail: "alice@example.com",
      actions: [{ path: "x.txt", content: "x" }],
    });
    const { stdout } = await execFileAsync("git", [
      "--git-dir",
      repo.dir,
      "show",
      "--quiet",
      "--format=%an <%ae>",
      result.sha,
    ]);
    expect(stdout.trim()).toBe("Alice Author <alice@example.com>");
  });

  it("creates the branch from HEAD if it doesn't exist yet", async () => {
    const result = await provider.commitMultipleFiles({
      branch: "feature-x",
      commitMessage: "bootstrap feature",
      authorName: "Tom",
      authorEmail: "tom@example.com",
      actions: [{ path: "feature.md", content: "new branch\n" }],
    });
    expect(result.sha).toMatch(/^[0-9a-f]{40}$/);
    // Branch now exists.
    const { stdout } = await execFileAsync("git", [
      "--git-dir",
      repo.dir,
      "rev-parse",
      "refs/heads/feature-x",
    ]);
    expect(stdout.trim()).toBe(result.sha);
  });
});
