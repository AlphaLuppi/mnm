import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LocalBareRepoProvider } from "../local-bare-repo-provider.js";
import { GitProviderError } from "../errors.js";
import { makeBareRepo, type BareRepoHandle } from "./fixtures/make-bare-repo.js";

const execFileAsync = promisify(execFile);

let repo: BareRepoHandle;
let provider: LocalBareRepoProvider;

beforeAll(async () => {
  repo = await makeBareRepo({
    seedFiles: {
      "workflow.json": '{"name":"hello-world"}',
      "gates/greet.gate.ts": "export default () => ({ pass: true, report: 'ok' });",
    },
    branch: "main",
  });
  await execFileAsync("git", ["--git-dir", repo.dir, "tag", "v1.0.0", repo.seedSha]);
  await execFileAsync("git", ["--git-dir", repo.dir, "tag", "v1.1.0", repo.seedSha]);
  await execFileAsync("git", ["--git-dir", repo.dir, "tag", "preview-1", repo.seedSha]);
  provider = new LocalBareRepoProvider({ providerId: "local-test", repoDir: repo.dir });
});

afterAll(async () => {
  await repo.cleanup();
});

describe("LocalBareRepoProvider.fetchBlob", () => {
  it("returns file content at a sha", async () => {
    const content = await provider.fetchBlob({ path: "workflow.json", ref: repo.seedSha });
    expect(content).toBe('{"name":"hello-world"}');
  });

  it("resolves a tag ref to the right blob", async () => {
    const content = await provider.fetchBlob({ path: "workflow.json", ref: "v1.0.0" });
    expect(content).toBe('{"name":"hello-world"}');
  });

  it("throws GitProviderError(not_found) for a missing path", async () => {
    await expect(
      provider.fetchBlob({ path: "does/not/exist.json", ref: repo.seedSha }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("throws GitProviderError(not_found) for a missing ref", async () => {
    await expect(
      provider.fetchBlob({ path: "workflow.json", ref: "does-not-exist" }),
    ).rejects.toBeInstanceOf(GitProviderError);
  });
});

describe("LocalBareRepoProvider.resolveRef", () => {
  it("resolves a tag to a sha", async () => {
    const sha = await provider.resolveRef({ ref: "v1.0.0" });
    expect(sha).toBe(repo.seedSha);
  });

  it("resolves a branch to a sha", async () => {
    const sha = await provider.resolveRef({ ref: "main" });
    expect(sha).toBe(repo.seedSha);
  });

  it("passes a sha through unchanged", async () => {
    const sha = await provider.resolveRef({ ref: repo.seedSha });
    expect(sha).toBe(repo.seedSha);
  });

  it("throws not_found for an unknown ref", async () => {
    await expect(provider.resolveRef({ ref: "nope" })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("LocalBareRepoProvider.listTags", () => {
  it("lists all tags sorted alphabetically with their shas", async () => {
    const tags = await provider.listTags();
    expect(tags.map((t) => t.name).sort()).toEqual(["preview-1", "v1.0.0", "v1.1.0"]);
    for (const tag of tags) {
      expect(tag.sha).toBe(repo.seedSha);
    }
  });

  it("filters by prefix", async () => {
    const tags = await provider.listTags({ prefix: "v1." });
    expect(tags.map((t) => t.name).sort()).toEqual(["v1.0.0", "v1.1.0"]);
  });

  it("returns [] for a prefix that matches nothing", async () => {
    const tags = await provider.listTags({ prefix: "beta-" });
    expect(tags).toEqual([]);
  });
});

describe("LocalBareRepoProvider.pathExists", () => {
  it("returns true for a tracked path", async () => {
    expect(await provider.pathExists({ path: "workflow.json", ref: "main" })).toBe(true);
  });

  it("returns true for a tracked nested path", async () => {
    expect(
      await provider.pathExists({ path: "gates/greet.gate.ts", ref: repo.seedSha }),
    ).toBe(true);
  });

  it("returns false for a missing path", async () => {
    expect(await provider.pathExists({ path: "nope.md", ref: "main" })).toBe(false);
  });

  it("throws not_found for an unknown ref", async () => {
    await expect(
      provider.pathExists({ path: "workflow.json", ref: "no-such-ref" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
