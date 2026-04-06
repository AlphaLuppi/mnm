import { describe, expect, it, vi, beforeEach } from "vitest";
import { agentTagCache } from "../agent-tag-cache.js";

// Mock DB — returns a simple chainable query builder
function createMockDb(rows: Array<{ tagId: string }>) {
  const mockWhere = vi.fn().mockResolvedValue(rows);
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return {
    db: { select: mockSelect } as any,
    mockSelect,
    mockWhere,
  };
}

describe("agentTagCache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns tags from DB on first call", async () => {
    const { db } = createMockDb([{ tagId: "t1" }, { tagId: "t2" }]);
    const cache = agentTagCache(db, 60_000);

    const tags = await cache.getAgentTags("c1", "a1");
    expect(tags).toEqual(new Set(["t1", "t2"]));
  });

  it("returns cached tags on subsequent calls within TTL", async () => {
    const { db, mockSelect } = createMockDb([{ tagId: "t1" }]);
    const cache = agentTagCache(db, 60_000);

    await cache.getAgentTags("c1", "a1");
    await cache.getAgentTags("c1", "a1");

    // Only one DB call
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it("refetches after TTL expires", async () => {
    const { db, mockSelect } = createMockDb([{ tagId: "t1" }]);
    const cache = agentTagCache(db, 10); // 10ms TTL

    await cache.getAgentTags("c1", "a1");

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 20));

    await cache.getAgentTags("c1", "a1");
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it("invalidate forces refetch", async () => {
    const { db, mockSelect } = createMockDb([{ tagId: "t1" }]);
    const cache = agentTagCache(db, 60_000);

    await cache.getAgentTags("c1", "a1");
    cache.invalidate("a1");
    await cache.getAgentTags("c1", "a1");

    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it("invalidate does not affect other agents", async () => {
    const { db, mockSelect } = createMockDb([{ tagId: "t1" }]);
    const cache = agentTagCache(db, 60_000);

    await cache.getAgentTags("c1", "a1");
    await cache.getAgentTags("c1", "a2");
    cache.invalidate("a1");
    await cache.getAgentTags("c1", "a2"); // should still be cached

    // a1 initial + a2 initial = 2 calls, a2 still cached
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it("returns empty set when DB returns no rows", async () => {
    const { db } = createMockDb([]);
    const cache = agentTagCache(db, 60_000);

    const tags = await cache.getAgentTags("c1", "a1");
    expect(tags).toEqual(new Set());
  });
});
