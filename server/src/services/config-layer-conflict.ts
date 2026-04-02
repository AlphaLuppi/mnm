import { sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import type {
  ConfigLayerConflict,
  ConflictCheckResult,
  MergePreviewResult,
  MergedConfigItem,
  ConflictSeverity,
  ConfigLayerItemType,
} from "@mnm/shared";

// ─── Row types for raw SQL results ──────────────────────────────────────────

interface ActiveItemRow {
  item_type: string;
  name: string;
  priority: number;
  layer_id: string;
  layer_name: string;
}

interface MergedItemRow {
  id: string;
  item_type: string;
  name: string;
  config_json: Record<string, unknown>;
  priority: number;
  layer_id: string;
  layer_name: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export function configLayerConflictService(db: Db) {

  /**
   * Build the active_layers CTE SQL fragment for a given company+agent.
   * Reused by both checkConflicts and mergePreview.
   */
  function activeLayersCte(companyId: string, agentId: string) {
    return sql`
      active_layers AS (
        SELECT cl.id AS layer_id, cl.name AS layer_name, 999 AS priority
        FROM config_layers cl
        WHERE cl.company_id = ${companyId}
          AND cl.enforced = true
          AND cl.archived_at IS NULL
        UNION ALL
        SELECT a.base_layer_id AS layer_id, 'Base Layer' AS layer_name, 500 AS priority
        FROM agents a
        WHERE a.id = ${agentId}::uuid
          AND a.base_layer_id IS NOT NULL
        UNION ALL
        SELECT acl.layer_id, cl.name AS layer_name, acl.priority
        FROM agent_config_layers acl
        JOIN config_layers cl ON cl.id = acl.layer_id
        WHERE acl.agent_id = ${agentId}::uuid
      )
    `;
  }

  /**
   * Get all active items for an agent (enforced + base + attached layers).
   */
  async function getActiveItems(
    tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
    companyId: string,
    agentId: string,
  ): Promise<ActiveItemRow[]> {
    const result = await tx.execute(sql`
      WITH ${activeLayersCte(companyId, agentId)}
      SELECT
        cli.item_type,
        cli.name,
        al.priority,
        al.layer_id::text,
        al.layer_name
      FROM active_layers al
      JOIN config_layer_items cli ON cli.layer_id = al.layer_id AND cli.enabled = true
    `);

    return (result as unknown as ActiveItemRow[]).map((row) => ({
      item_type: row.item_type,
      name: row.name,
      priority: Number(row.priority),
      layer_id: row.layer_id,
      layer_name: row.layer_name,
    }));
  }

  /**
   * Check for conflicts if a candidate layer were attached to an agent at a given priority.
   */
  async function checkConflicts(
    companyId: string,
    agentId: string,
    candidateLayerId: string,
    candidatePriority: number,
  ): Promise<ConflictCheckResult> {
    return db.transaction(async (tx) => {
      // Advisory lock for serialization on this agent's config
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('agent_config_' || ${agentId}))`,
      );

      // Get all currently active items
      const activeItems = await getActiveItems(tx, companyId, agentId);

      // Get candidate layer items (enabled only)
      const candidateItems = await tx.execute(sql`
        SELECT item_type, name
        FROM config_layer_items
        WHERE layer_id = ${candidateLayerId}::uuid
          AND enabled = true
      `) as unknown as Array<{ item_type: string; name: string }>;

      const conflicts: ConfigLayerConflict[] = [];

      for (const candidate of candidateItems) {
        // Find matching active items (same itemType + name)
        const matches = activeItems.filter(
          (a) => a.item_type === candidate.item_type && a.name === candidate.name,
        );

        for (const match of matches) {
          let severity: ConflictSeverity;

          if (match.priority === 999) {
            severity = "enforced_conflict";
          } else if (match.priority >= candidatePriority) {
            severity = "priority_conflict";
          } else {
            severity = "override_conflict";
          }

          conflicts.push({
            itemType: candidate.item_type as ConfigLayerItemType,
            name: candidate.name,
            severity,
            existingLayerId: match.layer_id,
            existingLayerName: match.layer_name,
            existingPriority: match.priority,
            candidatePriority,
          });
        }
      }

      const hasEnforcedConflict = conflicts.some(
        (c) => c.severity === "enforced_conflict",
      );

      return {
        conflicts,
        canAttach: !hasEnforcedConflict,
      };
    });
  }

  /**
   * Preview the merged configuration for an agent, applying priority-based resolution.
   * Uses DISTINCT ON to pick the highest-priority item for each (itemType, name) pair.
   */
  async function mergePreview(
    companyId: string,
    agentId: string,
  ): Promise<MergePreviewResult> {
    const result = await db.execute(sql`
      WITH ${activeLayersCte(companyId, agentId)}
      SELECT DISTINCT ON (cli.item_type, cli.name)
        cli.id::text,
        cli.item_type,
        cli.name,
        cli.config_json,
        al.priority,
        al.layer_id::text,
        al.layer_name
      FROM active_layers al
      JOIN config_layer_items cli ON cli.layer_id = al.layer_id AND cli.enabled = true
      ORDER BY cli.item_type, cli.name, al.priority DESC
    `) as unknown as MergedItemRow[];

    const items: MergedConfigItem[] = result.map((row) => ({
      id: row.id,
      itemType: row.item_type as ConfigLayerItemType,
      name: row.name,
      configJson: row.config_json,
      priority: Number(row.priority),
      layerId: row.layer_id,
    }));

    // Deduplicate layer sources and sort by priority DESC
    const layerMap = new Map<string, { layerId: string; layerName: string; priority: number }>();
    for (const row of result) {
      const existing = layerMap.get(row.layer_id);
      if (!existing || Number(row.priority) > existing.priority) {
        layerMap.set(row.layer_id, {
          layerId: row.layer_id,
          layerName: row.layer_name,
          priority: Number(row.priority),
        });
      }
    }
    const layerSources = [...layerMap.values()].sort(
      (a, b) => b.priority - a.priority,
    );

    return { items, layerSources };
  }

  return {
    checkConflicts,
    mergePreview,
  };
}
