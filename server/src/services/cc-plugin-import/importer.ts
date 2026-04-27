import type { ParsedPlugin } from "./plugin-parser.js";

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
