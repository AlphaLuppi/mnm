import { describe, it, expect } from "vitest";
import { stageGitActions } from "../importer.js";
import type { ParsedPlugin } from "../plugin-parser.js";

const plugin: ParsedPlugin = {
  manifest: { name: "demo", version: "1.0.0", description: "desc", author: { name: "x" } },
  agents: [
    {
      name: "writer",
      sourcePath: "agents/writer.md",
      frontmatter: { name: "writer", model: "sonnet", skills: ["s1"] },
      body: "# body",
    },
  ],
  skills: [
    {
      name: "s1",
      frontmatter: { name: "s1", description: "d" },
      files: [
        { path: "SKILL.md", content: "---\nname: s1\n---\nbody", contentHash: "h1" },
        { path: "references/r.md", content: "ref", contentHash: "h2" },
      ],
    },
  ],
};

describe("stageGitActions", () => {
  it("emits agents/, config_layers/, with config_layers: injected", () => {
    const actions = stageGitActions(plugin);

    const writerAction = actions.find((a) => a.path === "agents/writer.md")!;
    expect(writerAction.content).toContain("config_layers:");
    expect(writerAction.content).toContain("- demo");
    expect(writerAction.content).toContain("# body");

    const skillAction = actions.find((a) => a.path === "config_layers/demo/skills/s1/SKILL.md")!;
    expect(skillAction.content).toBe("---\nname: s1\n---\nbody");

    const refAction = actions.find(
      (a) => a.path === "config_layers/demo/skills/s1/references/r.md",
    )!;
    expect(refAction.content).toBe("ref");

    const manifest = actions.find((a) => a.path === "config_layers/demo/plugin.json")!;
    expect(JSON.parse(manifest.content!).name).toBe("demo");
  });

  it("does not duplicate config_layers entry if already present", () => {
    const pluginWithLayer: ParsedPlugin = {
      ...plugin,
      agents: [
        {
          ...plugin.agents[0],
          frontmatter: { ...plugin.agents[0].frontmatter, config_layers: ["demo"] },
        },
      ],
    };
    const actions = stageGitActions(pluginWithLayer);
    const writer = actions.find((a) => a.path === "agents/writer.md")!;
    expect((writer.content!.match(/- demo/g) ?? []).length).toBe(1);
  });
});
