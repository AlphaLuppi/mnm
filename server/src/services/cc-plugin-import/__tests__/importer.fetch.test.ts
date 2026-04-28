import { describe, it, expect } from "vitest";
import { fetchAndParsePlugin } from "../importer.js";
import type { GitProvider, TreeEntry } from "@mnm/git-provider";

function mockProvider(blobs: Record<string, string>, sha = "abc123"): GitProvider {
  const tree: TreeEntry[] = Object.keys(blobs).map((path) => ({
    path,
    type: "blob",
    sha: "x",
    size: blobs[path].length,
  }));
  return {
    fetchTree: async () => tree,
    fetchBlob: async ({ path }) => blobs[path],
    resolveRef: async () => sha,
    listTags: async () => [],
    pathExists: async ({ path }) => path in blobs,
    commitFile: async () => ({ sha: "n" }),
    commitMultipleFiles: async () => ({ sha: "n" }),
    createTag: async () => ({ sha: "n" }),
    mergeBranch: async () => ({ sha: "n" }),
    deleteBranch: async () => {},
  };
}

describe("fetchAndParsePlugin", () => {
  it("fetches tree and blobs and returns ParsedPlugin + sha", async () => {
    const provider = mockProvider({
      ".claude-plugin/plugin.json": JSON.stringify({ name: "demo", version: "1.0.0" }),
      "agents/a.md": "---\nname: a\n---\nx",
      "skills/s/SKILL.md": "---\nname: s\ndescription: d\n---\nbody",
    });
    const result = await fetchAndParsePlugin({ gitProvider: provider, ref: "main" });
    expect(result.plugin.manifest.name).toBe("demo");
    expect(result.plugin.agents.map((a) => a.name)).toEqual(["a"]);
    expect(result.plugin.skills.map((s) => s.name)).toEqual(["s"]);
    expect(result.sourceSha).toBe("abc123");
  });
});
