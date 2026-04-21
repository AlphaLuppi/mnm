import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { makeBareRepo } from "./make-bare-repo.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length) {
    const cleanup = cleanups.pop();
    if (cleanup) await cleanup();
  }
});

describe("makeBareRepo fixture", () => {
  it("returns a path to a bare repo with a seed commit", async () => {
    const repo = await makeBareRepo({
      seedFiles: { "README.md": "hello" },
      branch: "main",
    });
    cleanups.push(repo.cleanup);

    expect(existsSync(repo.dir)).toBe(true);
    const refs = execFileSync("git", ["--git-dir", repo.dir, "branch", "--list"], {
      encoding: "utf8",
    });
    expect(refs).toContain("main");
  });

  it("exposes the seed commit sha", async () => {
    const repo = await makeBareRepo({
      seedFiles: { "a.txt": "1" },
      branch: "main",
    });
    cleanups.push(repo.cleanup);
    expect(repo.seedSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("cleanup removes the tmp dir", async () => {
    const repo = await makeBareRepo({
      seedFiles: { "a.txt": "1" },
      branch: "main",
    });
    await repo.cleanup();
    expect(existsSync(repo.dir)).toBe(false);
  });
});
