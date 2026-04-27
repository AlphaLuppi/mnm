import { describe, it, expect } from "vitest";
import { buildDbPayload } from "../importer.js";
import type { ParsedPlugin } from "../plugin-parser.js";

const plugin: ParsedPlugin = {
  manifest: { name: "demo", version: "1.0.0" },
  agents: [
    { name: "writer", sourcePath: "agents/writer.md", frontmatter: { name: "writer", model: "sonnet" }, body: "" },
  ],
  skills: [
    {
      name: "s1",
      frontmatter: { name: "s1", description: "the rules" },
      files: [
        { path: "SKILL.md", content: "x", contentHash: "h1" },
        { path: "references/r.md", content: "y", contentHash: "h2" },
      ],
    },
  ],
};

describe("buildDbPayload", () => {
  it("builds layer + items + files + agents", () => {
    const payload = buildDbPayload({
      plugin,
      companyId: "c1",
      createdByUserId: "u1",
      sourceUrl: "https://example/repo",
      sourceSha: "abc",
    });

    expect(payload.layer.name).toBe("demo");
    expect(payload.layer.sourceKind).toBe("cc-plugin");
    expect(payload.layer.sourceUrl).toBe("https://example/repo");
    expect(payload.layer.sourceSha).toBe("abc");
    expect(payload.layer.scope).toBe("company");

    expect(payload.skillItems.length).toBe(1);
    const item = payload.skillItems[0];
    expect(item.itemType).toBe("skill");
    expect(item.name).toBe("s1");
    expect(item.displayName).toBe("s1");
    expect(item.description).toBe("the rules");

    expect(payload.skillFiles.length).toBe(2);
    expect(payload.skillFiles[0].itemTempId).toBe(item.tempId);
    expect(payload.skillFiles[0].path).toBe("SKILL.md");

    expect(payload.agents.length).toBe(1);
    expect(payload.agents[0].name).toBe("writer");
  });
});
