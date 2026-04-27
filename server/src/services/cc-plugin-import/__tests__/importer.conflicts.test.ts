import { describe, it, expect } from "vitest";
import { detectConflicts } from "../importer.js";
import type { ParsedPlugin } from "../plugin-parser.js";

const fakePlugin: ParsedPlugin = {
  manifest: { name: "demo", version: "1.0.0" },
  agents: [
    { name: "agent-a", sourcePath: "agents/agent-a.md", frontmatter: { name: "agent-a" }, body: "" },
  ],
  skills: [],
};

describe("detectConflicts", () => {
  it("returns no conflicts when names are free", async () => {
    const result = await detectConflicts({
      companyId: "c1",
      plugin: fakePlugin,
      existingLayerNames: new Set(),
      existingAgentNames: new Set(["unrelated"]),
    });
    expect(result.conflicts).toEqual([]);
  });

  it("flags layer conflict", async () => {
    const result = await detectConflicts({
      companyId: "c1",
      plugin: fakePlugin,
      existingLayerNames: new Set(["demo"]),
      existingAgentNames: new Set(),
    });
    expect(result.conflicts).toContainEqual({ kind: "layer", name: "demo" });
  });

  it("flags agent conflict", async () => {
    const result = await detectConflicts({
      companyId: "c1",
      plugin: fakePlugin,
      existingLayerNames: new Set(),
      existingAgentNames: new Set(["agent-a"]),
    });
    expect(result.conflicts).toContainEqual({ kind: "agent", name: "agent-a" });
  });
});
