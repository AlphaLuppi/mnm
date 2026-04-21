import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LocalBareRepoProvider, ShaCache } from "../index.js";
import { makeBareRepo, type BareRepoHandle } from "./fixtures/make-bare-repo.js";

const execFileAsync = promisify(execFile);

let repo: BareRepoHandle;
let provider: LocalBareRepoProvider;
const cache = new ShaCache();

beforeAll(async () => {
  repo = await makeBareRepo({
    seedFiles: { ".keep": "" },
    branch: "main",
  });
  provider = new LocalBareRepoProvider({
    providerId: "local-e2e",
    repoDir: repo.dir,
  });
});

afterAll(async () => {
  await repo.cleanup();
});

describe("GitProvider round-trip (Local bare repo)", () => {
  it("commits a workflow, tags it, then fetches it back by tag and sha", async () => {
    // 1. commit the workflow.
    const { sha } = await provider.commitFile({
      path: "hello-world/workflow.json",
      content: '{"name":"hello-world","steps":[]}',
      message: "seed hello-world",
      branch: "main",
      authorName: "Tom User",
      authorEmail: "tom@example.com",
    });
    expect(sha).toMatch(/^[0-9a-f]{40}$/);

    // 2. create a tag on the bare repo directly (tagging via MCP is T5 scope).
    await execFileAsync("git", ["--git-dir", repo.dir, "tag", "v0.1.0", sha]);

    // 3. listTags sees the tag.
    const tags = await provider.listTags({ prefix: "v" });
    expect(tags).toEqual([{ name: "v0.1.0", sha }]);

    // 4. resolveRef returns the same sha.
    expect(await provider.resolveRef({ ref: "v0.1.0" })).toBe(sha);

    // 5. fetchBlob by tag + sha returns identical content.
    const byTag = await provider.fetchBlob({ path: "hello-world/workflow.json", ref: "v0.1.0" });
    const bySha = await provider.fetchBlob({ path: "hello-world/workflow.json", ref: sha });
    expect(byTag.trim()).toBe('{"name":"hello-world","steps":[]}');
    expect(bySha).toBe(byTag);

    // 6. pathExists for a known tracked path.
    expect(
      await provider.pathExists({ path: "hello-world/workflow.json", ref: sha }),
    ).toBe(true);
    expect(
      await provider.pathExists({ path: "not-here.json", ref: sha }),
    ).toBe(false);

    // 7. ShaCache memoizes the sha-keyed read.
    cache.set(provider.providerId, "hello-world/workflow.json", sha, bySha);
    expect(cache.get(provider.providerId, "hello-world/workflow.json", sha)).toBe(bySha);
  });
});
