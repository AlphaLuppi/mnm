import { eq, and, isNull } from "drizzle-orm";
import { configLayers, agents as agentsTable, type Db } from "@mnm/db";
import type { GitProvider } from "@mnm/git-provider";
import {
  fetchAndParsePlugin,
  detectConflicts,
  stageGitActions,
  buildDbPayload,
  persistImport,
} from "./importer.js";

export class PluginImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    // Include the code in the message so .toThrow(/CODE/) matches.
    super(`${code}: ${message}`);
    this.name = "PluginImportError";
  }
}

export interface RunImportInput {
  db: Db;
  companyId: string;
  createdByUserId: string;
  sourceProvider: GitProvider;
  destProvider: GitProvider;
  destBranch: string;
  sourceUrl: string;
  ref?: string;
  excludeAgents?: string[];
  excludeSkills?: string[];
  authorName?: string;
  authorEmail?: string;
}

export interface RunImportResult {
  layerId: string;
  agents: Array<{ id: string; name: string }>;
  skills: Array<{ name: string; files: number }>;
  skippedSkills: string[];
  skippedAgents: string[];
  pluginCommitSha: string;
  mnmCommitSha: string;
  tag: string;
}

export async function runImport(input: RunImportInput): Promise<RunImportResult> {
  // 1) Fetch + parse
  const { plugin, sourceSha } = await fetchAndParsePlugin({
    gitProvider: input.sourceProvider,
    ref: input.ref ?? "main",
    excludeAgents: input.excludeAgents,
    excludeSkills: input.excludeSkills,
  });

  // 2) Conflicts (read existing names from DB)
  const layerRows = await input.db
    .select({ name: configLayers.name })
    .from(configLayers)
    .where(and(eq(configLayers.companyId, input.companyId), isNull(configLayers.archivedAt)));
  const layerNames = new Set(layerRows.map((r) => r.name));

  const agentRows = await input.db
    .select({ name: agentsTable.name })
    .from(agentsTable)
    .where(eq(agentsTable.companyId, input.companyId));
  const agentNames = new Set(agentRows.map((r) => r.name));

  const { conflicts } = await detectConflicts({
    companyId: input.companyId,
    plugin,
    existingLayerNames: layerNames,
    existingAgentNames: agentNames,
  });
  if (conflicts.length > 0) {
    const layerC = conflicts.find((c) => c.kind === "layer");
    const agentC = conflicts.find((c) => c.kind === "agent");
    if (layerC) {
      throw new PluginImportError("CONFLICT_LAYER_NAME", `Layer ${layerC.name} already exists`, conflicts);
    }
    if (agentC) {
      throw new PluginImportError("CONFLICT_AGENT_NAME", `Agent ${agentC.name} already exists`, conflicts);
    }
  }

  // 3) Stage Git actions and commit
  const actions = stageGitActions(plugin);
  const author = {
    authorName: input.authorName ?? "MnM Plugin Importer",
    authorEmail: input.authorEmail ?? "mnm@cbainfo.fr",
  };
  const commitResult = await input.destProvider.commitMultipleFiles({
    branch: input.destBranch,
    commitMessage: `feat(plugin-import): import ${plugin.manifest.name} v${plugin.manifest.version}`,
    actions: actions.map((a) => ({ path: a.path, content: a.content })),
    ...author,
  });
  const tag = `plugin-imports/${plugin.manifest.name}/v${plugin.manifest.version}`;
  await input.destProvider.createTag({
    name: tag,
    ref: commitResult.sha,
    message: `Import ${plugin.manifest.name} v${plugin.manifest.version}`,
  });

  // 4) Persist DB
  const payload = buildDbPayload({
    plugin,
    companyId: input.companyId,
    createdByUserId: input.createdByUserId,
    sourceUrl: input.sourceUrl,
    sourceSha,
  });
  const persistResult = await persistImport({
    db: input.db,
    companyId: input.companyId,
    payload,
    mnmCommitSha: commitResult.sha,
  });

  return {
    layerId: persistResult.layerId,
    agents: plugin.agents.map((a, i) => ({ id: persistResult.agentIds[i], name: a.name })),
    skills: plugin.skills.map((s) => ({ name: s.name, files: s.files.length })),
    skippedSkills: input.excludeSkills ?? [],
    skippedAgents: input.excludeAgents ?? [],
    pluginCommitSha: sourceSha,
    mnmCommitSha: commitResult.sha,
    tag,
  };
}
