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
    // Evict oldest entries when over limit
    let oldest: { key: string; cachedAt: number } | null = null;
    for (const [k, v] of cache) {
      if (!oldest || v.cachedAt < oldest.cachedAt) {
        oldest = { key: k, cachedAt: v.cachedAt };
      }
    }
    if (oldest) cache.delete(oldest.key);
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
    for (const k of cache.keys()) {
      if (k.endsWith(`:${agentId}`)) {
        cache.delete(k);
      }
    }
  }

  return { getAgentTags, invalidate };
}
