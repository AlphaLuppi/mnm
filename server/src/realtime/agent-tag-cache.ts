import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { tagAssignments } from "@mnm/db";

const DEFAULT_TTL_MS = 60_000; // 60 seconds
const MAX_ENTRIES = 10_000;

interface CacheEntry {
  tagIds: Set<string>;
  cachedAt: number;
}

export interface AgentTagCache {
  getAgentTags(companyId: string, agentId: string): Promise<Set<string>>;
  invalidate(agentId: string): void;
}

export function agentTagCache(db: Db, ttlMs = DEFAULT_TTL_MS): AgentTagCache {
  const cache = new Map<string, CacheEntry>();

  function key(companyId: string, agentId: string) {
    return `${companyId}:${agentId}`;
  }

  function evictIfNeeded() {
    if (cache.size <= MAX_ENTRIES) return;
    // Batch eviction: delete oldest 10% (Map preserves insertion order)
    const evictCount = Math.max(1, Math.floor(cache.size * 0.1));
    const iter = cache.keys();
    for (let i = 0; i < evictCount; i++) {
      const next = iter.next();
      if (next.done) break;
      cache.delete(next.value);
    }
  }

  async function getAgentTags(companyId: string, agentId: string): Promise<Set<string>> {
    const k = key(companyId, agentId);
    const cached = cache.get(k);
    if (cached && Date.now() - cached.cachedAt < ttlMs) {
      return cached.tagIds;
    }

    const rows = await db
      .select({ tagId: tagAssignments.tagId })
      .from(tagAssignments)
      .where(
        and(
          eq(tagAssignments.companyId, companyId),
          eq(tagAssignments.targetType, "agent"),
          eq(tagAssignments.targetId, agentId),
        ),
      );

    const tagIds = new Set(rows.map((r) => r.tagId));
    cache.set(k, { tagIds, cachedAt: Date.now() });
    evictIfNeeded();
    return tagIds;
  }

  function invalidate(agentId: string) {
    // Invalidate all entries for this agent (across all companies)
    // Use split to avoid suffix collision (e.g. "agent-1" matching "my-agent-1")
    for (const k of cache.keys()) {
      const sep = k.indexOf(":");
      if (sep !== -1 && k.slice(sep + 1) === agentId) {
        cache.delete(k);
      }
    }
  }

  return { getAgentTags, invalidate };
}
