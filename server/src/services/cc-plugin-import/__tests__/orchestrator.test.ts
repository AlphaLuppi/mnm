import { describe, it, expect, vi } from "vitest";
import { runImport, PluginImportError } from "../orchestrator.js";
import type { GitProvider, TreeEntry } from "@mnm/git-provider";

const FIXTURE_BLOBS: Record<string, string> = {
  ".claude-plugin/plugin.json": JSON.stringify({ name: "demo-plugin", version: "1.0.0", description: "x" }),
  "agents/writer.md": "---\nname: writer\nmodel: sonnet\n---\nbody",
  "skills/s1/SKILL.md": "---\nname: s1\ndescription: d\n---\nbody",
};

function fixtureProvider(blobs = FIXTURE_BLOBS, sha = "src-sha"): GitProvider {
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
  };
}

function recordingDestProvider(commitSha = "dst-sha") {
  const recorded = { actions: [] as Array<{ path: string; content?: string }>, commitMessage: "", branch: "", tag: "" };
  const provider: GitProvider = {
    fetchTree: async () => [],
    fetchBlob: async () => "",
    resolveRef: async () => commitSha,
    listTags: async () => [],
    pathExists: async () => false,
    commitFile: async () => ({ sha: commitSha }),
    commitMultipleFiles: async (args) => {
      recorded.actions = args.actions;
      recorded.commitMessage = args.commitMessage;
      recorded.branch = args.branch;
      return { sha: commitSha };
    },
    createTag: async (args) => {
      recorded.tag = args.name;
      return { sha: args.ref };
    },
  };
  return { provider, recorded };
}

function buildMockDb() {
  // Each select() returns a thennable that resolves to an array.
  const selectStub = (rows: any[]) => ({
    from: () => ({
      where: () => Promise.resolve(rows),
      // For select().from() without where():
      then: (cb: any) => Promise.resolve(rows).then(cb),
    }),
  });

  const db: any = {
    select: vi
      .fn()
      .mockImplementationOnce(() => selectStub([])) // existing layer names
      .mockImplementationOnce(() => selectStub([])), // existing agent names
    transaction: vi.fn(async (fn: any) => {
      const tx = {
        insert: () => ({
          values: (vals: any) => ({
            returning: () => Promise.resolve(
              (Array.isArray(vals) ? vals : [vals]).map((_, i) => ({ id: `id-${i}` })),
            ),
          }),
        }),
      };
      return fn(tx);
    }),
  };
  return db;
}

describe("runImport", () => {
  it("clones, parses, conflicts checked, git committed, db persisted", async () => {
    const sourceProvider = fixtureProvider();
    const { provider: destProvider, recorded } = recordingDestProvider();

    const result = await runImport({
      db: buildMockDb(),
      companyId: "c1",
      createdByUserId: "u1",
      sourceProvider,
      destProvider,
      destBranch: "main",
      sourceUrl: "https://example.com/demo-plugin",
      ref: "main",
    });

    // Result shape
    expect(result.layerId).toBe("id-0");
    expect(result.agents.length).toBe(1);
    expect(result.skills.length).toBe(1);
    expect(result.tag).toBe("plugin-imports/demo-plugin/v1.0.0");
    expect(result.pluginCommitSha).toBe("src-sha");

    // Dest provider received the right actions
    expect(recorded.commitMessage).toContain("demo-plugin");
    expect(recorded.actions.some((a) => a.path === "agents/writer.md")).toBe(true);
    expect(recorded.actions.some((a) => a.path === "config_layers/demo-plugin/skills/s1/SKILL.md")).toBe(true);
    expect(recorded.actions.some((a) => a.path === "config_layers/demo-plugin/plugin.json")).toBe(true);
  });

  it("rejects with CONFLICT_LAYER_NAME when layer exists", async () => {
    const sourceProvider = fixtureProvider();
    const { provider: destProvider } = recordingDestProvider();

    const dbWithConflict: any = {
      select: vi
        .fn()
        .mockImplementationOnce(() => ({
          from: () => ({ where: () => Promise.resolve([{ name: "demo-plugin" }]) }),
        }))
        .mockImplementationOnce(() => ({
          from: () => ({ where: () => Promise.resolve([]) }),
        })),
      transaction: vi.fn(),
    };

    await expect(
      runImport({
        db: dbWithConflict,
        companyId: "c1",
        createdByUserId: "u1",
        sourceProvider,
        destProvider,
        destBranch: "main",
        sourceUrl: "https://example.com/demo-plugin",
      }),
    ).rejects.toThrow(/CONFLICT_LAYER_NAME/);
    expect(dbWithConflict.transaction).not.toHaveBeenCalled();
  });
});
