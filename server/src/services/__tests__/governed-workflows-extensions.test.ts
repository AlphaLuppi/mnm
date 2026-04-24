import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  computeNextTag,
  saveDefinition,
  archiveDefinition,
  listRuns,
  getRunWithSteps,
} from "../governed-workflows-extensions.js";
import { governedWorkflowDefinitions } from "@mnm/db";
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

// ── U2.5: archiveDefinition / listRuns / getRunWithSteps ────────────────────
// These tests require the embedded test DB (port 5433). They are skipped on
// Windows CI where the DB is unavailable (pre-existing platform limitation).

describe("archiveDefinition", () => {
  let db: Db;
  const companyId = "00000000-0000-0000-0000-000000000c02";

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, 'ArchiveDef', 'ARC')`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
      VALUES (${companyId}, 'wf-to-archive', 'v1.0.0')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  it("returns true and sets archived_at when the definition exists", async () => {
    await setTenantContext(db, companyId);
    const result = await archiveDefinition(db, { companyId, name: "wf-to-archive" });
    expect(result).toBe(true);
  });

  it("returns false when called again on an already-archived definition", async () => {
    await setTenantContext(db, companyId);
    const result = await archiveDefinition(db, { companyId, name: "wf-to-archive" });
    expect(result).toBe(false);
  });

  it("returns false for a non-existent definition", async () => {
    await setTenantContext(db, companyId);
    const result = await archiveDefinition(db, { companyId, name: "does-not-exist" });
    expect(result).toBe(false);
  });

  it("sets enabled=false when archiving", async () => {
    await setTenantContext(db, companyId);
    // Insert a fresh workflow to archive
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
      VALUES (${companyId}, 'wf-enabled-check', 'v1.0.0')`);
    const ok = await archiveDefinition(db, { companyId, name: "wf-enabled-check" });
    expect(ok).toBe(true);

    // Verify enabled=false in DB
    const [row] = await db
      .select({ enabled: governedWorkflowDefinitions.enabled, archivedAt: governedWorkflowDefinitions.archivedAt })
      .from(governedWorkflowDefinitions)
      .where(eq(governedWorkflowDefinitions.name, "wf-enabled-check"));
    expect(row?.enabled).toBe(false);
    expect(row?.archivedAt).not.toBeNull();
  });
});

describe("listDefinitions excludes archived", () => {
  // This test uses the governedWorkflowService.listDefinitions function indirectly
  // by verifying the DB state after archiveDefinition.
  // Full integration test for listDefinitions is in governed-workflows.test.ts.
  // Here we just confirm archiveDefinition leaves the row with archivedAt set,
  // so it would be filtered by IS NULL in listDefinitions.
  let db: Db;
  const companyId = "00000000-0000-0000-0000-000000000c05";

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, 'ListExclArch', 'LEA')`);
    await db.execute(sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
      VALUES (${companyId}, 'wf-archived-list', 'v1.0.0')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  it("archived row has archivedAt set (confirming listDefinitions IS NULL filter removes it)", async () => {
    await setTenantContext(db, companyId);
    const ok = await archiveDefinition(db, { companyId, name: "wf-archived-list" });
    expect(ok).toBe(true);

    // Verify the row has archivedAt set — listDefinitions filters IS NULL
    const [row] = await db
      .select({ archivedAt: governedWorkflowDefinitions.archivedAt })
      .from(governedWorkflowDefinitions)
      .where(eq(governedWorkflowDefinitions.name, "wf-archived-list"));
    expect(row?.archivedAt).not.toBeNull();
  });
});

describe("listRuns", () => {
  let db: Db;
  const companyId = "00000000-0000-0000-0000-000000000c03";

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, 'ListRuns', 'LR')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  it("returns empty items and total=0 when no definition exists", async () => {
    await setTenantContext(db, companyId);
    const result = await listRuns(db, { companyId, workflowName: "missing-wf" });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe("getRunWithSteps", () => {
  let db: Db;
  const companyId = "00000000-0000-0000-0000-000000000c04";

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, 'GetRunSteps', 'GRS')`);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  it("returns null for a non-existent run", async () => {
    await setTenantContext(db, companyId);
    const result = await getRunWithSteps(db, {
      companyId,
      runId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result).toBeNull();
  });
});
