import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { materializeConfigLayerSkills } from "../materialize-config-layer-skills.js";

describe("materializeConfigLayerSkills", () => {
  let tmpRoot = "";

  afterEach(async () => {
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
      tmpRoot = "";
    }
  });

  it("writes skill files into <sandbox>/.claude/skills/<name>/<path>", async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mat-skills-"));
    const fakeListSkillsForLayers = async (_layerIds: string[]) => [
      {
        skillName: "s1",
        files: [
          { path: "SKILL.md", content: "skill body" },
          { path: "references/r.md", content: "ref body" },
        ],
      },
    ];
    await materializeConfigLayerSkills({
      sandbox: tmpRoot,
      layerIds: ["any"],
      listSkillsForLayers: fakeListSkillsForLayers,
    });
    const skillMd = await fs.readFile(
      path.join(tmpRoot, ".claude/skills/s1/SKILL.md"),
      "utf8",
    );
    expect(skillMd).toBe("skill body");
    const refMd = await fs.readFile(
      path.join(tmpRoot, ".claude/skills/s1/references/r.md"),
      "utf8",
    );
    expect(refMd).toBe("ref body");
  });

  it("is a no-op when layerIds is empty", async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mat-empty-"));
    await materializeConfigLayerSkills({
      sandbox: tmpRoot,
      layerIds: [],
      listSkillsForLayers: async () => {
        throw new Error("should not be called");
      },
    });
    // Sandbox should not have a .claude directory
    await expect(fs.access(path.join(tmpRoot, ".claude"))).rejects.toBeTruthy();
  });

  it("creates nested reference directories as needed", async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mat-nested-"));
    await materializeConfigLayerSkills({
      sandbox: tmpRoot,
      layerIds: ["x"],
      listSkillsForLayers: async () => [
        {
          skillName: "deep",
          files: [
            { path: "SKILL.md", content: "head" },
            { path: "references/sub/inner/leaf.md", content: "leaf" },
          ],
        },
      ],
    });
    const leaf = await fs.readFile(
      path.join(tmpRoot, ".claude/skills/deep/references/sub/inner/leaf.md"),
      "utf8",
    );
    expect(leaf).toBe("leaf");
  });
});
