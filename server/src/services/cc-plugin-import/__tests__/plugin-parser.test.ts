import { describe, it, expect } from "vitest";
import { parsePlugin } from "../plugin-parser.js";
import type { TreeEntry } from "@mnm/git-provider";

const tree: TreeEntry[] = [
  { path: ".claude-plugin/plugin.json", type: "blob", sha: "a", size: 100 },
  { path: "agents/test-writer.md",       type: "blob", sha: "b", size: 200 },
  { path: "agents/test-reviewer.md",     type: "blob", sha: "c", size: 200 },
  { path: "skills/test-conventions/SKILL.md", type: "blob", sha: "d", size: 300 },
  { path: "skills/symfony-autowire/SKILL.md", type: "blob", sha: "e", size: 300 },
  { path: "skills/symfony-autowire/references/attribute-examples.md", type: "blob", sha: "f", size: 400 },
];

const blobs: Record<string, string> = {
  ".claude-plugin/plugin.json": JSON.stringify({ name: "demo", version: "1.0.0", description: "x" }),
  "agents/test-writer.md":       "---\nname: test-writer\nmodel: sonnet\ndescription: x\nskills: [test-conventions]\n---\nbody",
  "agents/test-reviewer.md":     "---\nname: test-reviewer\nmodel: haiku\ndescription: y\n---\nbody",
  "skills/test-conventions/SKILL.md":          "---\nname: test-conventions\ndescription: rules\n---\nbody",
  "skills/symfony-autowire/SKILL.md":          "---\nname: symfony-autowire\ndescription: wire\n---\nbody @references/attribute-examples.md",
  "skills/symfony-autowire/references/attribute-examples.md": "# examples",
};

describe("parsePlugin", () => {
  it("parses manifest, agents, skills with references", async () => {
    const result = await parsePlugin({
      tree,
      fetchBlob: async (path) => blobs[path],
    });

    expect(result.manifest.name).toBe("demo");
    expect(result.manifest.version).toBe("1.0.0");

    expect(result.agents.length).toBe(2);
    const writer = result.agents.find((a) => a.name === "test-writer")!;
    expect(writer.frontmatter.model).toBe("sonnet");
    expect(writer.frontmatter.skills).toEqual(["test-conventions"]);
    expect(writer.body).toBe("body");
    expect(writer.sourcePath).toBe("agents/test-writer.md");

    expect(result.skills.length).toBe(2);
    const auto = result.skills.find((s) => s.name === "symfony-autowire")!;
    expect(auto.files.length).toBe(2);
    expect(auto.files.find((f) => f.path === "SKILL.md")).toBeDefined();
    expect(auto.files.find((f) => f.path === "references/attribute-examples.md")).toBeDefined();
  });

  it("rejects when .claude-plugin/plugin.json is missing", async () => {
    await expect(
      parsePlugin({
        tree: tree.filter((t) => !t.path.startsWith(".claude-plugin/")),
        fetchBlob: async (path) => blobs[path],
      }),
    ).rejects.toThrow(/INVALID_CC_PLUGIN/);
  });

  it("rejects when an agent has invalid frontmatter", async () => {
    const broken: Record<string, string> = { ...blobs, "agents/test-writer.md": "no frontmatter at all" };
    await expect(
      parsePlugin({
        tree,
        fetchBlob: async (path) => broken[path],
      }),
    ).rejects.toThrow(/INVALID_AGENT_FRONTMATTER/);
  });

  it("honors excludeSkills and excludeAgents", async () => {
    const result = await parsePlugin({
      tree,
      fetchBlob: async (path) => blobs[path],
      excludeAgents: ["test-reviewer"],
      excludeSkills: ["symfony-autowire"],
    });
    expect(result.agents.map((a) => a.name)).toEqual(["test-writer"]);
    expect(result.skills.map((s) => s.name)).toEqual(["test-conventions"]);
  });
});
