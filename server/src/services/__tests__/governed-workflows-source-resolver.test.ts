import { describe, it, expect, vi } from "vitest";
import { ShaCache } from "@mnm/git-provider";
import type { GitProvider } from "@mnm/git-provider";
import { makeResolveSource } from "../governed-workflows-source-resolver.js";

function stubProvider(overrides: Partial<GitProvider> = {}): GitProvider {
  return {
    fetchBlob: vi.fn(async () => "stub-source"),
    listTags: vi.fn(async () => []),
    resolveRef: vi.fn(async (a) => `sha-of-${a.ref}`),
    pathExists: vi.fn(async () => true),
    commitFile: vi.fn(async () => ({ sha: "x" })),
    createTag: vi.fn(async () => ({ sha: "x" })),
    fetchTree: vi.fn(async () => []),
    commitMultipleFiles: vi.fn(async () => ({ sha: "x" })),
    mergeBranch: vi.fn(async () => ({ sha: "x" })),
    deleteBranch: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("makeResolveSource", () => {
  it("resolves a relative gate source against the workflow path", async () => {
    const provider = stubProvider();
    const cache = new ShaCache();
    const resolve = makeResolveSource({
      gitProvider: provider,
      workflowGitSha: "abc",
      workflowRepoPath: "hello-world/workflow.json",
      shaCache: cache,
    });
    const r = await resolve("./gates/greet-exit.gate.ts");
    expect(r.gateSourcePath).toBe("hello-world/gates/greet-exit.gate.ts");
    expect(r.source).toBe("stub-source");
    expect(provider.fetchBlob).toHaveBeenCalledWith({
      path: "hello-world/gates/greet-exit.gate.ts",
      ref: "abc",
    });
  });

  it("caches per (sha, path) — provider called once", async () => {
    const provider = stubProvider();
    const cache = new ShaCache();
    const resolve = makeResolveSource({
      gitProvider: provider,
      workflowGitSha: "abc",
      workflowRepoPath: "hello-world/workflow.json",
      shaCache: cache,
    });
    await resolve("./gates/a.gate.ts");
    await resolve("./gates/a.gate.ts");
    expect(provider.fetchBlob).toHaveBeenCalledTimes(1);
  });

  it("rejects sources escaping the workflow directory", async () => {
    const provider = stubProvider();
    const resolve = makeResolveSource({
      gitProvider: provider,
      workflowGitSha: "abc",
      workflowRepoPath: "hello-world/workflow.json",
      shaCache: new ShaCache(),
    });
    await expect(resolve("../../etc/passwd")).rejects.toThrow(
      /outside workflow directory/,
    );
    await expect(resolve("/absolute")).rejects.toThrow(/must be relative/);
  });
});
