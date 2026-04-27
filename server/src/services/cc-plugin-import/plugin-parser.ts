import matter from "gray-matter";
import type { TreeEntry } from "@mnm/git-provider";
import { createHash } from "node:crypto";

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: { name?: string; email?: string };
  repository?: string;
  license?: string;
  keywords?: string[];
}

export interface ParsedAgent {
  name: string;
  sourcePath: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface ParsedSkillFile {
  path: string;
  content: string;
  contentHash: string;
}

export interface ParsedSkill {
  name: string;
  frontmatter: Record<string, unknown>;
  files: ParsedSkillFile[];
}

export interface ParsedPlugin {
  manifest: PluginManifest;
  agents: ParsedAgent[];
  skills: ParsedSkill[];
}

export interface ParsePluginInput {
  tree: TreeEntry[];
  fetchBlob: (path: string) => Promise<string>;
  excludeAgents?: string[];
  excludeSkills?: string[];
}

export class PluginParseError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "PluginParseError";
  }
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function parsePlugin(input: ParsePluginInput): Promise<ParsedPlugin> {
  const manifestEntry = input.tree.find((e) => e.path === ".claude-plugin/plugin.json");
  if (!manifestEntry) {
    throw new PluginParseError("INVALID_CC_PLUGIN", ".claude-plugin/plugin.json is missing");
  }
  let manifest: PluginManifest;
  try {
    manifest = JSON.parse(await input.fetchBlob(manifestEntry.path));
  } catch (err) {
    throw new PluginParseError("INVALID_CC_PLUGIN", `Cannot parse plugin.json: ${(err as Error).message}`);
  }
  if (!manifest.name || !manifest.version) {
    throw new PluginParseError("INVALID_CC_PLUGIN", "plugin.json missing name or version");
  }

  const excludeAgents = new Set(input.excludeAgents ?? []);
  const excludeSkills = new Set(input.excludeSkills ?? []);

  const agentEntries = input.tree.filter(
    (e) => e.type === "blob" && /^agents\/[^/]+\.md$/.test(e.path),
  );
  const agents: ParsedAgent[] = [];
  for (const entry of agentEntries) {
    const name = entry.path.replace(/^agents\//, "").replace(/\.md$/, "");
    if (excludeAgents.has(name)) continue;
    const raw = await input.fetchBlob(entry.path);
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(raw);
    } catch (err) {
      throw new PluginParseError(
        "INVALID_AGENT_FRONTMATTER",
        `agents/${name}.md: ${(err as Error).message}`,
      );
    }
    if (!parsed.data || Object.keys(parsed.data).length === 0) {
      throw new PluginParseError(
        "INVALID_AGENT_FRONTMATTER",
        `agents/${name}.md has no YAML frontmatter`,
      );
    }
    agents.push({
      name,
      sourcePath: entry.path,
      frontmatter: parsed.data,
      body: parsed.content.trim(),
    });
  }

  const skillBlobs = input.tree.filter(
    (e) => e.type === "blob" && e.path.startsWith("skills/") && e.path !== "skills",
  );
  const bySkill = new Map<string, TreeEntry[]>();
  for (const entry of skillBlobs) {
    const rest = entry.path.slice("skills/".length);
    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) continue;
    const skillName = rest.slice(0, slashIdx);
    if (excludeSkills.has(skillName)) continue;
    if (!bySkill.has(skillName)) bySkill.set(skillName, []);
    bySkill.get(skillName)!.push(entry);
  }

  const skills: ParsedSkill[] = [];
  for (const [skillName, entries] of bySkill.entries()) {
    const skillMdEntry = entries.find((e) => e.path === `skills/${skillName}/SKILL.md`);
    if (!skillMdEntry) continue;
    const skillMdRaw = await input.fetchBlob(skillMdEntry.path);
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(skillMdRaw);
    } catch (err) {
      throw new PluginParseError(
        "INVALID_SKILL_FRONTMATTER",
        `skills/${skillName}/SKILL.md: ${(err as Error).message}`,
      );
    }
    if (!parsed.data || !parsed.data.name) {
      throw new PluginParseError(
        "INVALID_SKILL_FRONTMATTER",
        `skills/${skillName}/SKILL.md missing 'name' frontmatter`,
      );
    }
    const files: ParsedSkillFile[] = [];
    for (const entry of entries) {
      const relPath = entry.path.slice(`skills/${skillName}/`.length);
      const content = await input.fetchBlob(entry.path);
      files.push({ path: relPath, content, contentHash: sha256(content) });
    }
    skills.push({ name: skillName, frontmatter: parsed.data, files });
  }

  return { manifest, agents, skills };
}
