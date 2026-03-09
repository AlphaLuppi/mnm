import { createChildLogger } from "@/lib/core/logger";
import * as specRepo from "@/lib/db/repositories/specs";

const log = createChildLogger({ module: "hierarchy-model" });

/**
 * Spec hierarchy levels from highest (most authoritative) to lowest.
 * Product Brief → PRD → Architecture → Stories → Code
 */
export const HIERARCHY_LEVELS = [
  "product_brief",
  "prd",
  "architecture",
  "epic",
  "story",
] as const;

export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number];

export interface HierarchyNode {
  specId: string;
  filePath: string;
  title: string | null;
  specType: string;
  level: HierarchyLevel;
  children: HierarchyNode[];
}

/**
 * Map spec_type values to hierarchy levels.
 */
export function classifySpecLevel(specType: string): HierarchyLevel | null {
  const normalized = specType.toLowerCase().replace(/[_\- ]/g, "");
  if (normalized.includes("productbrief") || normalized.includes("brief"))
    return "product_brief";
  if (normalized.includes("prd") || normalized.includes("requirements"))
    return "prd";
  if (normalized.includes("architecture") || normalized.includes("arch"))
    return "architecture";
  if (normalized.includes("epic")) return "epic";
  if (normalized.includes("story") || normalized.includes("stories"))
    return "story";
  return null;
}

/**
 * Build the full document hierarchy from indexed specs.
 */
export function buildHierarchy(): HierarchyNode[] {
  const allSpecs = specRepo.findAll();
  const roots: HierarchyNode[] = [];
  const byLevel = new Map<HierarchyLevel, HierarchyNode[]>();

  // Classify all specs into hierarchy levels
  for (const spec of allSpecs) {
    const level = classifySpecLevel(spec.specType);
    if (!level) continue;

    const node: HierarchyNode = {
      specId: spec.id,
      filePath: spec.filePath,
      title: spec.title,
      specType: spec.specType,
      level,
      children: [],
    };

    if (!byLevel.has(level)) {
      byLevel.set(level, []);
    }
    byLevel.get(level)!.push(node);
  }

  // Build parent-child relationships based on hierarchy order
  for (let i = 0; i < HIERARCHY_LEVELS.length; i++) {
    const level = HIERARCHY_LEVELS[i];
    const nodes = byLevel.get(level) ?? [];

    if (i === 0) {
      // Top level = roots
      roots.push(...nodes);
    } else {
      // Attach to parent level
      const parentLevel = HIERARCHY_LEVELS[i - 1];
      const parents = byLevel.get(parentLevel) ?? [];

      if (parents.length > 0) {
        // Distribute children across parents (simple heuristic: attach to first parent)
        // In a more sophisticated version, use LLM to determine relationships
        for (const node of nodes) {
          parents[0].children.push(node);
        }
      } else {
        // No parent level exists — promote to root
        roots.push(...nodes);
      }
    }
  }

  log.info(
    { rootCount: roots.length, totalSpecs: allSpecs.length },
    "Built document hierarchy"
  );

  return roots;
}

/**
 * Get all spec pairs that should be compared for cross-doc drift.
 * Returns pairs of (upstream, downstream) specs.
 */
export function getComparablePairs(): Array<{
  upstream: { specId: string; filePath: string; specType: string };
  downstream: { specId: string; filePath: string; specType: string };
}> {
  const allSpecs = specRepo.findAll();
  const pairs: Array<{
    upstream: { specId: string; filePath: string; specType: string };
    downstream: { specId: string; filePath: string; specType: string };
  }> = [];

  // Group specs by hierarchy level
  const byLevel = new Map<HierarchyLevel, typeof allSpecs>();
  for (const spec of allSpecs) {
    const level = classifySpecLevel(spec.specType);
    if (!level) continue;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(spec);
  }

  // Create pairs between adjacent hierarchy levels
  for (let i = 0; i < HIERARCHY_LEVELS.length - 1; i++) {
    const upstreamLevel = HIERARCHY_LEVELS[i];
    const downstreamLevel = HIERARCHY_LEVELS[i + 1];
    const upstreamSpecs = byLevel.get(upstreamLevel) ?? [];
    const downstreamSpecs = byLevel.get(downstreamLevel) ?? [];

    for (const up of upstreamSpecs) {
      for (const down of downstreamSpecs) {
        pairs.push({
          upstream: {
            specId: up.id,
            filePath: up.filePath,
            specType: up.specType,
          },
          downstream: {
            specId: down.id,
            filePath: down.filePath,
            specType: down.specType,
          },
        });
      }
    }
  }

  log.info({ pairCount: pairs.length }, "Generated comparable spec pairs");
  return pairs;
}
