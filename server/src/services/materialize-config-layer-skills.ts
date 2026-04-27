import fs from "node:fs/promises";
import path from "node:path";
import { eq, inArray, and } from "drizzle-orm";
import { configLayerItems, configLayerFiles, type Db } from "@mnm/db";

export interface MaterializedSkill {
  skillName: string;
  files: Array<{ path: string; content: string }>;
}

export interface MaterializeInput {
  sandbox: string;
  layerIds: string[];
  /**
   * Default: queries the DB. Pass a fake here in tests.
   * Used by both V1 demo (manual call from tests / scripts) and future
   * launcher integration.
   */
  listSkillsForLayers?: (layerIds: string[]) => Promise<MaterializedSkill[]>;
  db?: Db;
}

export async function listSkillsForLayersFromDb(
  db: Db,
  layerIds: string[],
): Promise<MaterializedSkill[]> {
  if (layerIds.length === 0) return [];
  const items = await db
    .select({ itemId: configLayerItems.id, name: configLayerItems.name })
    .from(configLayerItems)
    .where(
      and(
        inArray(configLayerItems.layerId, layerIds),
        eq(configLayerItems.itemType, "skill"),
        eq(configLayerItems.enabled, true),
      ),
    );
  if (items.length === 0) return [];

  const itemIds = items.map((i) => i.itemId);
  const files = await db
    .select({
      itemId: configLayerFiles.itemId,
      path: configLayerFiles.path,
      content: configLayerFiles.content,
    })
    .from(configLayerFiles)
    .where(inArray(configLayerFiles.itemId, itemIds));

  return items.map((it) => ({
    skillName: it.name,
    files: files
      .filter((f) => f.itemId === it.itemId)
      .map((f) => ({ path: f.path, content: f.content })),
  }));
}

export async function materializeConfigLayerSkills(
  input: MaterializeInput,
): Promise<void> {
  if (input.layerIds.length === 0) return;

  const fetcher =
    input.listSkillsForLayers ??
    (input.db
      ? (ids: string[]) => listSkillsForLayersFromDb(input.db!, ids)
      : null);
  if (!fetcher) {
    throw new Error(
      "materializeConfigLayerSkills: either listSkillsForLayers or db must be provided",
    );
  }

  const skills = await fetcher(input.layerIds);
  if (skills.length === 0) return;

  const baseDir = path.join(input.sandbox, ".claude", "skills");
  for (const skill of skills) {
    const skillDir = path.join(baseDir, skill.skillName);
    for (const file of skill.files) {
      const target = path.join(skillDir, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, "utf8");
    }
  }
}
