import type { GitProvider } from "@mnm/git-provider";
import matter from "gray-matter";
import type { ParsedPlugin } from "./plugin-parser.js";
import { parsePlugin } from "./plugin-parser.js";

export interface Conflict {
  kind: "layer" | "agent";
  name: string;
}

export interface DetectConflictsInput {
  companyId: string;
  plugin: ParsedPlugin;
  existingLayerNames: Set<string>;
  existingAgentNames: Set<string>;
}

export async function detectConflicts(
  input: DetectConflictsInput,
): Promise<{ conflicts: Conflict[] }> {
  const conflicts: Conflict[] = [];
  if (input.existingLayerNames.has(input.plugin.manifest.name)) {
    conflicts.push({ kind: "layer", name: input.plugin.manifest.name });
  }
  for (const agent of input.plugin.agents) {
    if (input.existingAgentNames.has(agent.name)) {
      conflicts.push({ kind: "agent", name: agent.name });
    }
  }
  return { conflicts };
}

export interface FetchAndParseInput {
  gitProvider: GitProvider;
  ref: string;
  excludeAgents?: string[];
  excludeSkills?: string[];
}

export interface FetchAndParseResult {
  plugin: ParsedPlugin;
  sourceSha: string;
}

export async function fetchAndParsePlugin(
  input: FetchAndParseInput,
): Promise<FetchAndParseResult> {
  const sourceSha = await input.gitProvider.resolveRef({ ref: input.ref });
  const tree = await input.gitProvider.fetchTree({
    ref: input.ref,
    recursive: true,
  });
  const plugin = await parsePlugin({
    tree,
    fetchBlob: (path) => input.gitProvider.fetchBlob({ path, ref: sourceSha }),
    excludeAgents: input.excludeAgents,
    excludeSkills: input.excludeSkills,
  });
  return { plugin, sourceSha };
}

export interface GitAction {
  path: string;
  content: string;
}

export function stageGitActions(plugin: ParsedPlugin): GitAction[] {
  const actions: GitAction[] = [];
  const layerName = plugin.manifest.name;

  for (const agent of plugin.agents) {
    const fm = { ...agent.frontmatter };
    const existing = Array.isArray(fm.config_layers) ? (fm.config_layers as string[]) : [];
    if (!existing.includes(layerName)) {
      fm.config_layers = [...existing, layerName];
    } else {
      fm.config_layers = existing;
    }
    const rebuilt = matter.stringify(agent.body, fm);
    actions.push({ path: `agents/${agent.name}.md`, content: rebuilt });
  }

  for (const skill of plugin.skills) {
    for (const file of skill.files) {
      actions.push({
        path: `config_layers/${layerName}/skills/${skill.name}/${file.path}`,
        content: file.content,
      });
    }
  }

  actions.push({
    path: `config_layers/${layerName}/plugin.json`,
    content: JSON.stringify(plugin.manifest, null, 2) + "\n",
  });

  return actions;
}
