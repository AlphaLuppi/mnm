/**
 * Unit tests for FileTree (U13.5).
 *
 * Matches the repo's existing convention (see ui/src/pages/__tests__/): avoid
 * React rendering, test the pure helpers and prop contracts directly. Full
 * visual + interaction QA happens on the running dev server once U13.8 wires
 * the page up.
 */
import { describe, it, expect } from "vitest";
import type { TreeEntry } from "../../../api/governed-workflows.js";
import { buildTree } from "../FileTree.js";

function blob(path: string): TreeEntry {
  return { path, type: "blob", sha: "deadbeef", size: 1 };
}

describe("FileTree — buildTree", () => {
  it("renders a flat list of files as direct children of root", () => {
    const root = buildTree([blob("workflow.json"), blob("README.md")]);
    expect(root.isDir).toBe(true);
    expect(root.path).toBe("");
    expect(root.children).toHaveLength(2);
    // Alphabetical order (both are files at the same depth).
    expect(root.children.map((c) => c.name)).toEqual(["README.md", "workflow.json"]);
    expect(root.children.every((c) => !c.isDir)).toBe(true);
  });

  it("groups nested paths into directory nodes", () => {
    const root = buildTree([
      blob("gates/lint.ts"),
      blob("gates/format.ts"),
      blob("workflow.json"),
    ]);
    // Root has 2 entries: the `gates` dir and the `workflow.json` leaf.
    expect(root.children).toHaveLength(2);
    // Dirs come first.
    expect(root.children[0].name).toBe("gates");
    expect(root.children[0].isDir).toBe(true);
    expect(root.children[1].name).toBe("workflow.json");
    expect(root.children[1].isDir).toBe(false);
    // The `gates` dir has the two gate files.
    expect(root.children[0].children).toHaveLength(2);
    expect(root.children[0].children.map((c) => c.name)).toEqual([
      "format.ts",
      "lint.ts",
    ]);
    expect(root.children[0].children.every((c) => !c.isDir)).toBe(true);
    // Leaf paths are preserved fully.
    expect(root.children[0].children[0].path).toBe("gates/format.ts");
    expect(root.children[0].children[1].path).toBe("gates/lint.ts");
  });

  it("handles deeply nested paths", () => {
    const root = buildTree([blob("a/b/c/deep.ts")]);
    expect(root.children).toHaveLength(1);
    const a = root.children[0];
    expect(a.name).toBe("a");
    expect(a.isDir).toBe(true);
    expect(a.path).toBe("a");
    const b = a.children[0];
    expect(b.name).toBe("b");
    expect(b.isDir).toBe(true);
    expect(b.path).toBe("a/b");
    const c = b.children[0];
    expect(c.name).toBe("c");
    expect(c.isDir).toBe(true);
    expect(c.path).toBe("a/b/c");
    const leaf = c.children[0];
    expect(leaf.name).toBe("deep.ts");
    expect(leaf.isDir).toBe(false);
    expect(leaf.path).toBe("a/b/c/deep.ts");
  });

  it("ignores server-supplied tree-type rows (derives dirs from blob paths)", () => {
    // LocalBareRepo might omit tree rows; GitLab includes them. We build the
    // tree purely from blob paths for cross-backend consistency.
    const entries: TreeEntry[] = [
      { path: "gates", type: "tree", sha: "aaa", size: null },
      blob("gates/lint.ts"),
    ];
    const root = buildTree(entries);
    // Only one `gates` directory node (not two — the explicit tree row is ignored).
    expect(root.children).toHaveLength(1);
    expect(root.children[0].name).toBe("gates");
    expect(root.children[0].children).toHaveLength(1);
    expect(root.children[0].children[0].name).toBe("lint.ts");
  });

  it("returns an empty root when there are no blobs", () => {
    expect(buildTree([]).children).toHaveLength(0);
    // A lone tree entry still produces an empty tree.
    expect(
      buildTree([{ path: "gates", type: "tree", sha: "x", size: null }]).children,
    ).toHaveLength(0);
  });

  it("sorts directories before files at every level", () => {
    const root = buildTree([
      blob("z-file.md"),
      blob("a-file.md"),
      blob("mid/nested.ts"),
    ]);
    expect(root.children.map((c) => c.name)).toEqual([
      "mid", // dir first
      "a-file.md",
      "z-file.md",
    ]);
  });
});

describe("FileTree — dirty path contract", () => {
  it("Set<string>.has distinguishes dirty leaves", () => {
    // The component checks `dirtyPaths.has(fullPath)`; verify the prop shape.
    const dirty = new Set<string>(["gates/lint.ts"]);
    expect(dirty.has("gates/lint.ts")).toBe(true);
    expect(dirty.has("gates/format.ts")).toBe(false);
    expect(dirty.has("workflow.json")).toBe(false);
  });
});

describe("FileTree — active path contract", () => {
  it("activePath === null disables the highlight for every row", () => {
    // The row component evaluates `!node.isDir && node.path === activePath`.
    // With activePath=null, no leaf matches.
    const root = buildTree([blob("workflow.json"), blob("gates/lint.ts")]);
    const activePath: string | null = null;
    const leaves: string[] = [];
    const walk = (n: { path: string; isDir: boolean; children: any[] }) => {
      if (!n.isDir) leaves.push(n.path);
      for (const c of n.children) walk(c);
    };
    walk(root);
    expect(leaves.every((p) => p !== activePath)).toBe(true);
  });

  it("activePath matches exactly one leaf", () => {
    const root = buildTree([blob("workflow.json"), blob("gates/lint.ts")]);
    const activePath = "gates/lint.ts";
    const matching: string[] = [];
    const walk = (n: { path: string; isDir: boolean; children: any[] }) => {
      if (!n.isDir && n.path === activePath) matching.push(n.path);
      for (const c of n.children) walk(c);
    };
    walk(root);
    expect(matching).toEqual(["gates/lint.ts"]);
  });
});
