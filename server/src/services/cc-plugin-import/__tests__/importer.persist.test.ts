import { describe, it, expect, vi } from "vitest";
import { persistImport } from "../importer.js";
import type { DbPayload } from "../importer.js";

function buildMockDb(layerId = "layer-1", itemId = "item-1", agentId = "agent-1") {
  // Track inserts for assertion
  const inserts: Array<{ table: string; values: unknown[] }> = [];

  // Mock query builder: insert(table).values(...).returning(...) returns [{id: ...}]
  function mockInsert(table: { _: { name: string } } | string) {
    const tableName = typeof table === "string" ? table : (table as any)?.[Symbol.for("drizzle:Name")] ?? "unknown";
    return {
      values: (vals: unknown) => {
        inserts.push({ table: tableName, values: Array.isArray(vals) ? vals : [vals] });
        return {
          returning: (cols?: unknown) => {
            const arr = Array.isArray(vals) ? vals : [vals];
            const stub = arr.map((_, i) => {
              if (tableName === "config_layers") return { id: layerId };
              if (tableName === "config_layer_items") return { id: `${itemId}-${i}` };
              if (tableName === "agents") return { id: `${agentId}-${i}` };
              return { id: `row-${i}` };
            });
            return Promise.resolve(stub);
          },
        };
      },
    };
  }

  const tx = {
    insert: vi.fn(mockInsert as any),
  };

  const db = {
    transaction: vi.fn(async (fn: any) => fn(tx)),
  };

  return { db, tx, inserts };
}

const fakePayload: DbPayload = {
  layer: {
    name: "demo",
    description: "x",
    scope: "company",
    sourceKind: "cc-plugin",
    sourceUrl: "https://x",
    sourceSha: "abc",
    createdByUserId: "u1",
    visibility: "public",
  },
  skillItems: [
    {
      tempId: "t1",
      itemType: "skill",
      name: "s1",
      displayName: "s1",
      description: "d",
      configJson: { frontmatter: { name: "s1" }, primaryFile: "SKILL.md" },
      sourceType: "git",
      sourceUrl: "skills/s1/SKILL.md",
    },
  ],
  skillFiles: [
    { itemTempId: "t1", path: "SKILL.md", content: "x", contentHash: "h" },
    { itemTempId: "t1", path: "references/r.md", content: "y", contentHash: "h2" },
  ],
  agents: [
    { name: "writer", frontmatter: { name: "writer", model: "sonnet", description: "d" }, body: "" },
  ],
};

describe("persistImport", () => {
  it("inserts layer + items + files + agents in a transaction and returns ids", async () => {
    const { db } = buildMockDb();
    const result = await persistImport({
      db: db as any,
      companyId: "c1",
      payload: fakePayload,
      mnmCommitSha: "deadbeef",
    });
    expect(result.layerId).toBe("layer-1");
    expect(result.agentIds.length).toBe(1);
    expect(result.itemIds.length).toBe(1);
  });

  it("propagates db transaction errors", async () => {
    const db = { transaction: vi.fn(async () => { throw new Error("simulated"); }) };
    await expect(
      persistImport({ db: db as any, companyId: "c1", payload: fakePayload, mnmCommitSha: "x" }),
    ).rejects.toThrow(/simulated/);
  });
});
