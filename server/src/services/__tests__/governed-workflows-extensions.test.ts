import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { computeNextTag, saveDefinition } from "../governed-workflows-extensions.js";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";
import { setTenantContext } from "../../middleware/tenant-context.js";
import type { Db } from "@mnm/db";

// ── U2.2: computeNextTag — semver bump helper ────────────────────────────────

describe("computeNextTag", () => {
  it("bumps patch from an existing v-prefixed tag", () => {
    expect(computeNextTag("hello-world", ["hello-world/v1.2.3"])).toBe("hello-world/v1.2.4");
  });

  it("returns v1.0.0 when no matching tags exist", () => {
    expect(computeNextTag("hello-world", [])).toBe("hello-world/v1.0.0");
  });

  it("ignores tags for other workflows", () => {
    expect(computeNextTag("foo", ["bar/v5.0.0"])).toBe("foo/v1.0.0");
  });

  it("picks the highest semver among multiple tags", () => {
    expect(
      computeNextTag("wf", ["wf/v1.0.0", "wf/v2.1.3", "wf/v1.9.9"]),
    ).toBe("wf/v2.1.4");
  });

  it("handles a tag with patch=0", () => {
    expect(computeNextTag("x", ["x/v3.0.0"])).toBe("x/v3.0.1");
  });
});

// ── U2.3: saveDefinition ────────────────────────────────────────────────────

describe("saveDefinition", () => {
  let db: Db;
  const companyId = "00000000-0000-0000-0000-000000000c01";

  // Minimal stub GitProvider for saveDefinition tests.
  function makeStubProvider(existingTags: string[] = []) {
    return {
      listTags: async () => existingTags.map((name) => ({ name, sha: "abc123" })),
      commitFile: async () => ({ sha: "commitsha001" }),
      createTag: async () => ({ sha: "tagsha001" }),
      fetchBlob: async () => "{}",
      resolveRef: async () => "commitsha001",
      pathExists: async () => false,
    };
  }

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, 'SaveDef', 'SDF')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  it("creates a new definition row with v1.0.0 when no prior tags", async () => {
    await setTenantContext(db, companyId);
    const result = await saveDefinition(db, {
      companyId,
      name: "my-wf",
      description: "test wf",
      definitionContent: JSON.stringify({ name: "my-wf" }),
      commitMessage: "add my-wf",
      branch: "main",
      authorName: "Dev",
      authorEmail: "dev@mnm.local",
      resolveGitProvider: async () => makeStubProvider() as any,
    });
    expect(result.created).toBe(true);
    expect(result.newGitTag).toBe("my-wf/v1.0.0");
    expect(result.commitSha).toBe("commitsha001");
  });

  it("updates an existing definition row and bumps the tag", async () => {
    await setTenantContext(db, companyId);
    const result = await saveDefinition(db, {
      companyId,
      name: "my-wf",
      description: "updated",
      definitionContent: JSON.stringify({ name: "my-wf" }),
      commitMessage: "update my-wf",
      branch: "main",
      authorName: "Dev",
      authorEmail: "dev@mnm.local",
      resolveGitProvider: async () => makeStubProvider(["my-wf/v1.0.0"]) as any,
    });
    expect(result.created).toBe(false);
    expect(result.newGitTag).toBe("my-wf/v1.0.1");
  });
});
