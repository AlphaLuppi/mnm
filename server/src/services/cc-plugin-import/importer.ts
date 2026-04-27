import type { GitProvider } from "@mnm/git-provider";
import matter from "gray-matter";
import { randomUUID } from "node:crypto";
import type { ParsedPlugin } from "./plugin-parser.js";
import { parsePlugin } from "./plugin-parser.js";
import type { Db } from "@mnm/db";
import { configLayers, configLayerItems, configLayerFiles, agents as agentsTable } from "@mnm/db";

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

export interface BuildDbInput {
  plugin: ParsedPlugin;
  companyId: string;
  createdByUserId: string;
  sourceUrl: string;
  sourceSha: string;
}

export interface DbLayerRow {
  name: string;
  description: string | null;
  scope: "company";
  sourceKind: "cc-plugin";
  sourceUrl: string;
  sourceSha: string;
  createdByUserId: string;
  visibility: "public";
}

export interface DbSkillItemRow {
  tempId: string;
  itemType: "skill";
  name: string;
  displayName: string | null;
  description: string | null;
  configJson: { frontmatter: Record<string, unknown>; primaryFile: "SKILL.md" };
  sourceType: "git";
  sourceUrl: string;
}

export interface DbSkillFileRow {
  itemTempId: string;
  path: string;
  content: string;
  contentHash: string;
}

export interface DbAgentRow {
  name: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface DbPayload {
  layer: DbLayerRow;
  skillItems: DbSkillItemRow[];
  skillFiles: DbSkillFileRow[];
  agents: DbAgentRow[];
}

export function buildDbPayload(input: BuildDbInput): DbPayload {
  const skillItems: DbSkillItemRow[] = [];
  const skillFiles: DbSkillFileRow[] = [];
  for (const skill of input.plugin.skills) {
    const tempId = randomUUID();
    skillItems.push({
      tempId,
      itemType: "skill",
      name: skill.name,
      displayName: typeof skill.frontmatter.name === "string" ? skill.frontmatter.name : skill.name,
      description:
        typeof skill.frontmatter.description === "string" ? skill.frontmatter.description : null,
      configJson: { frontmatter: skill.frontmatter, primaryFile: "SKILL.md" },
      sourceType: "git",
      sourceUrl: `skills/${skill.name}/SKILL.md`,
    });
    for (const file of skill.files) {
      skillFiles.push({
        itemTempId: tempId,
        path: file.path,
        content: file.content,
        contentHash: file.contentHash,
      });
    }
  }
  return {
    layer: {
      name: input.plugin.manifest.name,
      description: input.plugin.manifest.description ?? null,
      scope: "company",
      sourceKind: "cc-plugin",
      sourceUrl: input.sourceUrl,
      sourceSha: input.sourceSha,
      createdByUserId: input.createdByUserId,
      visibility: "public",
    },
    skillItems,
    skillFiles,
    agents: input.plugin.agents.map((a) => ({
      name: a.name,
      frontmatter: a.frontmatter,
      body: a.body,
    })),
  };
}

// ---------------------------------------------------------------------------
// persistImport — atomic DB transaction: layer + items + files + agents
// ---------------------------------------------------------------------------

export interface PersistImportInput {
  db: Db;
  companyId: string;
  payload: DbPayload;
  mnmCommitSha: string;
}

export interface PersistImportResult {
  layerId: string;
  itemIds: string[];
  agentIds: string[];
}

export async function persistImport(
  input: PersistImportInput,
): Promise<PersistImportResult> {
  return await input.db.transaction(async (tx) => {
    // 1. Insert the config layer row
    const [layer] = await tx
      .insert(configLayers)
      .values({
        companyId: input.companyId,
        name: input.payload.layer.name,
        description: input.payload.layer.description,
        scope: input.payload.layer.scope,
        visibility: input.payload.layer.visibility,
        createdByUserId: input.payload.layer.createdByUserId,
        sourceKind: input.payload.layer.sourceKind,
        sourceUrl: input.payload.layer.sourceUrl,
        sourceSha: input.payload.layer.sourceSha,
        mnmImportCommitSha: input.mnmCommitSha,
      })
      .returning({ id: configLayers.id });

    // 2. Insert skill items one-by-one to map tempId → real UUID
    const itemIds: string[] = [];
    const tempToReal = new Map<string, string>();
    for (const item of input.payload.skillItems) {
      const [row] = await tx
        .insert(configLayerItems)
        .values({
          companyId: input.companyId,
          layerId: layer.id,
          itemType: item.itemType,
          name: item.name,
          displayName: item.displayName,
          description: item.description,
          configJson: item.configJson,
          sourceType: item.sourceType,
          sourceUrl: item.sourceUrl,
        })
        .returning({ id: configLayerItems.id });
      itemIds.push(row.id);
      tempToReal.set(item.tempId, row.id);
    }

    // 3. Bulk-insert skill files (batch only when there are rows to insert)
    if (input.payload.skillFiles.length > 0) {
      await tx.insert(configLayerFiles).values(
        input.payload.skillFiles.map((f) => ({
          companyId: input.companyId,
          itemId: tempToReal.get(f.itemTempId)!,
          path: f.path,
          content: f.content,
          contentHash: f.contentHash,
        })),
      );
    }

    // 4. Insert agents
    // Mandatory columns (no DB default): companyId, name
    // All other notNull columns have defaults (status, adapterType, adapterConfig, etc.)
    const agentIds: string[] = [];
    for (const agent of input.payload.agents) {
      const [row] = await tx
        .insert(agentsTable)
        .values({
          companyId: input.companyId,
          name: agent.name,
          ...buildAgentInsertDefaults(input.payload.layer.createdByUserId, agent.frontmatter, agent.body),
        })
        .returning({ id: agentsTable.id });
      agentIds.push(row.id);
    }

    return { layerId: layer.id, itemIds, agentIds };
  });
}

/**
 * Builds optional-but-desirable agent fields from the CC-plugin agent frontmatter.
 * Only supplies columns that exist in the schema; leaves all notNull+default columns
 * to their DB defaults (status, adapterType, adapterConfig, runtimeConfig, etc.).
 */
function buildAgentInsertDefaults(
  createdByUserId: string,
  frontmatter: Record<string, unknown>,
  _body: string,
): Record<string, unknown> {
  return {
    // adapterType default is "process"; override with "claude_local" for CC-plugin agents
    adapterType: "claude_local",
    createdByUserId,
    description:
      typeof frontmatter.description === "string" ? frontmatter.description : undefined,
    // Store the full source frontmatter in metadata for traceability
    metadata: { ccPluginFrontmatter: frontmatter },
  };
}
