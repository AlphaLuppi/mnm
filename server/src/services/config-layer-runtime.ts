import { sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { logger } from "../middleware/logger.js";
import { mcpCredentialService } from "./mcp-credential.js";

// ─── Resolved Config Types ────────────────────────────────────────────────────

export interface ResolvedMcpServer {
  name: string;
  type: string;
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

export interface ResolvedSkill {
  name: string;
  frontmatter: Record<string, unknown>;
  content: string;
  files: Array<{ path: string; content: string }>;
}

export interface ResolvedHook {
  event: string;
  matcher?: string;
  hookType: string;
  command?: string;
  url?: string;
  prompt?: string;
  timeout?: number;
}

export interface ResolvedConfig {
  mcpServers: ResolvedMcpServer[];
  skills: ResolvedSkill[];
  hooks: ResolvedHook[];
  settings: Record<string, unknown>;
  warnings: string[];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CachedConfig {
  config: ResolvedConfig;
  cachedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute

// key = `${companyId}:${agentId}`
const configCache = new Map<string, CachedConfig>();

function cacheKey(companyId: string, agentId: string): string {
  return `${companyId}:${agentId}`;
}

function isStale(cachedAt: number): boolean {
  return Date.now() - cachedAt > CACHE_TTL_MS;
}

// ─── Raw SQL row types ────────────────────────────────────────────────────────

interface MergedItemRow {
  id: string;
  item_type: string;
  name: string;
  config_json: Record<string, unknown>;
  priority: number;
  layer_id: string;
}

interface FileRow {
  item_id: string;
  path: string;
  content: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export function configLayerRuntimeService(db: Db) {
  const credSvc = mcpCredentialService(db);

  /**
   * Main entry point — resolves the merged configuration for an agent run.
   * Results are cached for 1 minute to avoid hot-path DB overhead.
   */
  async function resolveConfigForRun(
    companyId: string,
    agentId: string,
    ownerUserId: string,
  ): Promise<ResolvedConfig> {
    const key = cacheKey(companyId, agentId);
    const cached = configCache.get(key);
    if (cached && !isStale(cached.cachedAt)) {
      return cached.config;
    }

    const config = await _resolve(companyId, agentId, ownerUserId);
    configCache.set(key, { config, cachedAt: Date.now() });
    return config;
  }

  /**
   * Invalidate the cache for a specific agent.
   */
  function invalidateCache(companyId: string, agentId: string): void {
    configCache.delete(cacheKey(companyId, agentId));
  }

  /**
   * Invalidate all cache entries for a company (e.g. when an enforced layer changes).
   */
  function invalidateCompanyCache(companyId: string): void {
    for (const key of configCache.keys()) {
      if (key.startsWith(`${companyId}:`)) {
        configCache.delete(key);
      }
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  async function _resolve(
    companyId: string,
    agentId: string,
    ownerUserId: string,
  ): Promise<ResolvedConfig> {
    const warnings: string[] = [];

    // ── 1. Merge query: CTE with enforced / base / attached layers, DISTINCT ON for priority ──
    //
    // Priority tiers:
    //   999 = enforced company layers (top — cannot be overridden)
    //   500 = agent base layer (personal defaults)
    //    N  = manually attached layers (user-specified priority)
    //
    // DISTINCT ON (item_type, name) ORDER BY priority DESC picks the winner.

    let mergedRows: MergedItemRow[] = [];
    try {
      const raw = await db.execute(sql`
        WITH active_layers AS (
          -- Enforced company layers (highest priority)
          SELECT
            cl.id   AS layer_id,
            999     AS priority
          FROM config_layers cl
          WHERE cl.company_id = ${companyId}::uuid
            AND cl.enforced   = true
            AND cl.archived_at IS NULL

          UNION ALL

          -- Agent base layer
          SELECT
            a.base_layer_id AS layer_id,
            500             AS priority
          FROM agents a
          WHERE a.id            = ${agentId}::uuid
            AND a.base_layer_id IS NOT NULL

          UNION ALL

          -- Agent-attached layers
          SELECT
            acl.layer_id,
            acl.priority
          FROM agent_config_layers acl
          WHERE acl.agent_id = ${agentId}::uuid
        )
        SELECT DISTINCT ON (cli.item_type, cli.name)
          cli.id::text          AS id,
          cli.item_type,
          cli.name,
          cli.config_json,
          al.priority,
          al.layer_id::text     AS layer_id
        FROM active_layers al
        JOIN config_layer_items cli
          ON  cli.layer_id = al.layer_id
          AND cli.enabled  = true
        ORDER BY cli.item_type, cli.name, al.priority DESC
      `);
      mergedRows = raw as unknown as MergedItemRow[];
    } catch (err) {
      logger.error({ err, companyId, agentId }, "[config-layer-runtime] merge query failed");
      warnings.push("Config layer merge query failed — running with empty config");
      return { mcpServers: [], skills: [], hooks: [], settings: {}, warnings };
    }

    // ── 2. Load files for skill items ────────────────────────────────────────

    const skillItemIds = mergedRows
      .filter((r) => r.item_type === "skill")
      .map((r) => r.id);

    let fileRows: FileRow[] = [];
    if (skillItemIds.length > 0) {
      try {
        const idList = skillItemIds.map((id) => sql`${id}::uuid`);
        const raw = await db.execute(sql`
          SELECT
            item_id::text AS item_id,
            path,
            content
          FROM config_layer_files
          WHERE item_id IN (${sql.join(idList, sql`, `)})
        `);
        fileRows = raw as unknown as FileRow[];
      } catch (err) {
        logger.warn({ err, companyId, agentId }, "[config-layer-runtime] file load failed");
        warnings.push("Failed to load skill supporting files");
      }
    }

    // Group files by item ID
    const filesByItemId = new Map<string, Array<{ path: string; content: string }>>();
    for (const f of fileRows) {
      const arr = filesByItemId.get(f.item_id) ?? [];
      arr.push({ path: f.path, content: f.content });
      filesByItemId.set(f.item_id, arr);
    }

    // ── 3. Resolve typed structures ──────────────────────────────────────────

    const mcpServers: ResolvedMcpServer[] = [];
    const skills: ResolvedSkill[] = [];
    const hooks: ResolvedHook[] = [];
    const settings: Record<string, unknown> = {};

    for (const row of mergedRows) {
      const cfg = row.config_json ?? {};

      switch (row.item_type) {
        case "mcp": {
          const server: ResolvedMcpServer = {
            name: row.name,
            type: (cfg.type as string) ?? "stdio",
          };
          if (cfg.url) server.url = cfg.url as string;
          if (cfg.command) server.command = cfg.command as string;
          if (Array.isArray(cfg.args)) server.args = cfg.args as string[];
          if (cfg.headers && typeof cfg.headers === "object") {
            server.headers = cfg.headers as Record<string, string>;
          }
          if (cfg.env && typeof cfg.env === "object") {
            server.env = cfg.env as Record<string, string>;
          }
          mcpServers.push(server);
          break;
        }

        case "skill": {
          const frontmatter = (cfg.frontmatter as Record<string, unknown>) ?? {};
          const content = (cfg.content as string) ?? "";
          const files = filesByItemId.get(row.id) ?? [];
          skills.push({ name: row.name, frontmatter, content, files });
          break;
        }

        case "hook": {
          const hook: ResolvedHook = {
            event: (cfg.event as string) ?? row.name,
            hookType: (cfg.hookType as string) ?? "command",
          };
          if (cfg.matcher) hook.matcher = cfg.matcher as string;
          if (cfg.command) hook.command = cfg.command as string;
          if (cfg.url) hook.url = cfg.url as string;
          if (cfg.prompt) hook.prompt = cfg.prompt as string;
          if (cfg.timeout) hook.timeout = Number(cfg.timeout);
          hooks.push(hook);
          break;
        }

        case "setting": {
          // Each setting item has name = key, config_json = { value: ... }
          settings[row.name] = cfg.value ?? cfg;
          break;
        }

        default:
          warnings.push(`Unknown item_type "${row.item_type}" for item "${row.name}" — skipped`);
      }
    }

    // ── 4. Inject MCP credentials ─────────────────────────────────────────
    // For each MCP item, check if the owner has stored credentials.
    // Credential material.env gets merged on top of static env vars.

    const mcpItemIds = mergedRows
      .filter((r) => r.item_type === "mcp")
      .map((r) => r.id);

    if (mcpItemIds.length > 0 && ownerUserId) {
      const credByItemId = new Map<string, Record<string, unknown>>();

      await Promise.all(
        mcpItemIds.map(async (itemId) => {
          try {
            const material = await credSvc.getDecryptedMaterial(ownerUserId, companyId, itemId);
            if (material) credByItemId.set(itemId, material);
          } catch {
            // Decryption failure already logged by credSvc
          }
        }),
      );

      // Match credentials to resolved servers by item id (same order as mergedRows)
      let mcpIdx = 0;
      for (const row of mergedRows) {
        if (row.item_type !== "mcp") continue;
        const material = credByItemId.get(row.id);
        if (material) {
          const server = mcpServers[mcpIdx];
          // Merge credential env vars on top of static env vars
          if (material.env && typeof material.env === "object") {
            server.env = {
              ...(server.env ?? {}),
              ...(material.env as Record<string, string>),
            };
          }
          // Merge credential headers on top of static headers
          if (material.headers && typeof material.headers === "object") {
            server.headers = {
              ...(server.headers ?? {}),
              ...(material.headers as Record<string, string>),
            };
          }
        }
        mcpIdx++;
      }
    }

    logger.debug(
      {
        companyId,
        agentId,
        ownerUserId,
        mcpCount: mcpServers.length,
        skillCount: skills.length,
        hookCount: hooks.length,
        settingCount: Object.keys(settings).length,
      },
      "[config-layer-runtime] config resolved",
    );

    return { mcpServers, skills, hooks, settings, warnings };
  }

  // ─── File generators ──────────────────────────────────────────────────────

  /**
   * Generate the content of .mcp.json from the resolved config.
   * Format: { mcpServers: { [name]: { type, url?, command?, args?, headers? } } }
   */
  function generateMcpJson(config: ResolvedConfig): string {
    const mcpServers: Record<string, unknown> = {};
    for (const srv of config.mcpServers) {
      const { name, ...rest } = srv;
      mcpServers[name] = rest;
    }
    return JSON.stringify({ mcpServers }, null, 2);
  }

  /**
   * Generate the content of settings.json from the resolved config.
   * Includes hooks grouped by event + flat settings key/value pairs.
   */
  function generateSettingsJson(config: ResolvedConfig): string {
    // Group hooks by event
    const hooksByEvent: Record<string, unknown[]> = {};
    for (const hook of config.hooks) {
      const arr = hooksByEvent[hook.event] ?? [];
      arr.push({
        matcher: hook.matcher,
        type: hook.hookType,
        command: hook.command,
        url: hook.url,
        prompt: hook.prompt,
        timeout_ms: hook.timeout,
      });
      hooksByEvent[hook.event] = arr;
    }

    const out: Record<string, unknown> = {
      ...config.settings,
    };

    if (Object.keys(hooksByEvent).length > 0) {
      out.hooks = hooksByEvent;
    }

    return JSON.stringify(out, null, 2);
  }

  return {
    resolveConfigForRun,
    invalidateCache,
    invalidateCompanyCache,
    generateMcpJson,
    generateSettingsJson,
  };
}
