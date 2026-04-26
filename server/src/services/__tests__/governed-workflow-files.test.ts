import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { eq, sql, and } from "drizzle-orm";
import { ShaCache, GitProviderError } from "@mnm/git-provider";
import type {
  GitProvider,
  TreeEntry,
  CommitMultipleFilesArgs,
  CommitMultipleFilesResult,
} from "@mnm/git-provider";
import { governedWorkflowDefinitions, type Db } from "@mnm/db";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";
import { setTenantContext } from "../../middleware/tenant-context.js";
import {
  listWorkflowFiles,
  getWorkflowFile,
  batchCommitWorkflowFiles,
} from "../governed-workflow-files.js";

// ── Test stubs ──────────────────────────────────────────────────────────────

interface StubOverrides {
  tree?: TreeEntry[];
  blob?: string;
  blobError?: GitProviderError;
  tags?: string[];
  onCommit?: (args: CommitMultipleFilesArgs) => CommitMultipleFilesResult;
  onCreateTag?: (args: { name: string; ref: string }) => void;
}

function makeStubProvider(overrides: StubOverrides = {}): GitProvider {
  return {
    fetchBlob: vi.fn(async () => {
      if (overrides.blobError) throw overrides.blobError;
      return overrides.blob ?? "";
    }),
    listTags: vi.fn(async () =>
      (overrides.tags ?? []).map((name) => ({ name, sha: "tagsha" })),
    ),
    resolveRef: vi.fn(async (a) => `sha-of-${a.ref}`),
    pathExists: vi.fn(async () => true),
    commitFile: vi.fn(async () => ({ sha: "x" })),
    createTag: vi.fn(async (a) => {
      overrides.onCreateTag?.({ name: a.name, ref: a.ref });
      return { sha: "tagsha" };
    }),
    fetchTree: vi.fn(async () => overrides.tree ?? []),
    commitMultipleFiles: vi.fn(async (a) => {
      if (overrides.onCommit) return overrides.onCommit(a);
      return { sha: "commitsha001" };
    }),
  };
}

// ── Pure-logic tests (no DB) ────────────────────────────────────────────────

describe("listWorkflowFiles", () => {
  it("prepends the workflow subtree on read and strips it on the way out", async () => {
    const provider = makeStubProvider({
      tree: [
        { path: "hello-world/workflow.json", type: "blob", sha: "aaa", size: 10 },
        { path: "hello-world/gates/lint.ts", type: "blob", sha: "bbb", size: 20 },
      ],
    });
    const deps = {
      resolveGitProvider: async () => provider,
      shaCache: new ShaCache(),
    };

    const result = await listWorkflowFiles(deps, {
      companyId: "c1",
      userId: null,
      workflowName: "hello-world",
      ref: "v1.0.0",
    });

    // fetchTree must have been called with the workflow as subtree + recursive.
    expect(provider.fetchTree).toHaveBeenCalledWith({
      ref: "v1.0.0",
      subtree: "hello-world",
      recursive: true,
    });

    // Paths come back workflow-relative.
    expect(result.tree.map((e) => e.path).sort()).toEqual([
      "gates/lint.ts",
      "workflow.json",
    ]);
    expect(result.tree.find((e) => e.path === "workflow.json")?.sha).toBe("aaa");
  });
});

describe("getWorkflowFile — path validation", () => {
  const deps = {
    resolveGitProvider: async () => makeStubProvider({ blob: "" }),
    shaCache: new ShaCache(),
  };

  it("rejects `../escape`", async () => {
    await expect(
      getWorkflowFile(deps, {
        companyId: "c1",
        userId: null,
        workflowName: "hw",
        ref: "main",
        path: "../escape",
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_FILE_INVALID_PATH" });
  });

  it("rejects absolute paths", async () => {
    await expect(
      getWorkflowFile(deps, {
        companyId: "c1",
        userId: null,
        workflowName: "hw",
        ref: "main",
        path: "/etc/passwd",
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_FILE_INVALID_PATH" });
  });

  it("rejects backslash paths", async () => {
    await expect(
      getWorkflowFile(deps, {
        companyId: "c1",
        userId: null,
        workflowName: "hw",
        ref: "main",
        path: "gates\\foo.ts",
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_FILE_INVALID_PATH" });
  });

  it("rejects empty paths", async () => {
    await expect(
      getWorkflowFile(deps, {
        companyId: "c1",
        userId: null,
        workflowName: "hw",
        ref: "main",
        path: "",
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_FILE_INVALID_PATH" });
  });

  it("accepts a nested workflow-relative path and prepends the subtree", async () => {
    const provider = makeStubProvider({
      blob: "export default () => ({ pass: true });",
      tree: [
        {
          path: "hw/gates/lint.ts",
          type: "blob",
          sha: "blobsha42",
          size: 40,
        },
      ],
    });
    const result = await getWorkflowFile(
      { resolveGitProvider: async () => provider, shaCache: new ShaCache() },
      {
        companyId: "c1",
        userId: null,
        workflowName: "hw",
        ref: "main",
        path: "gates/lint.ts",
      },
    );
    expect(result.content).toBe("export default () => ({ pass: true });");
    expect(result.sha).toBe("blobsha42");
    expect(provider.fetchBlob).toHaveBeenCalledWith({
      path: "hw/gates/lint.ts",
      ref: "main",
    });
  });

  it("maps not_found to WORKFLOW_FILE_NOT_FOUND", async () => {
    const provider = makeStubProvider({
      blobError: new GitProviderError("not_found", "missing"),
    });
    await expect(
      getWorkflowFile(
        { resolveGitProvider: async () => provider, shaCache: new ShaCache() },
        {
          companyId: "c1",
          userId: null,
          workflowName: "hw",
          ref: "main",
          path: "missing.md",
        },
      ),
    ).rejects.toMatchObject({ code: "WORKFLOW_FILE_NOT_FOUND" });
  });
});

// ── DB-backed tests ─────────────────────────────────────────────────────────

describe("batchCommitWorkflowFiles", () => {
  let db: Db;
  const companyId = "00000000-0000-0000-0000-000000000d01";

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, 'BatchCommit', 'BC')`,
    );
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  beforeEach(async () => {
    await setTenantContext(db, companyId);
    // Seed a definition row so the DB update has something to touch.
    await db.execute(
      sql`DELETE FROM governed_workflow_definitions WHERE company_id = ${companyId}`,
    );
    await db.execute(
      sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
          VALUES (${companyId}, 'hello-world', 'hello-world/v1.0.0')`,
    );
  });

  it("rejects empty changes with WORKFLOW_FILE_EMPTY_CHANGES", async () => {
    const provider = makeStubProvider();
    await expect(
      batchCommitWorkflowFiles(
        db,
        { resolveGitProvider: async () => provider, shaCache: new ShaCache() },
        {
          companyId,
          userId: null,
          workflowName: "hello-world",
          branch: "main",
          commitMessage: "x",
          authorName: "Tom",
          authorEmail: "tom@example.com",
          changes: [],
        },
      ),
    ).rejects.toMatchObject({ code: "WORKFLOW_FILE_EMPTY_CHANGES" });
  });

  it("prefixes paths, creates the next tag, and bumps latest_git_tag", async () => {
    let seenCommit: CommitMultipleFilesArgs | null = null;
    let seenTag: { name: string; ref: string } | null = null;
    const provider = makeStubProvider({
      tags: ["hello-world/v1.0.0", "hello-world/v1.2.3"],
      onCommit: (a) => {
        seenCommit = a;
        return { sha: "commitsha123" };
      },
      onCreateTag: (a) => {
        seenTag = a;
      },
    });

    const result = await batchCommitWorkflowFiles(
      db,
      { resolveGitProvider: async () => provider, shaCache: new ShaCache() },
      {
        companyId,
        userId: null,
        workflowName: "hello-world",
        branch: "main",
        commitMessage: "batch edit",
        authorName: "Tom",
        authorEmail: "tom@example.com",
        changes: [
          { path: "workflow.json", content: '{"name":"hello-world"}' },
          { path: "gates/lint.ts", content: "export default () => ({pass:true});" },
          { path: "old.md", delete: true },
        ],
      },
    );

    expect(result.commitSha).toBe("commitsha123");
    expect(result.newGitTag).toBe("hello-world/v1.2.4");

    // Paths passed to commitMultipleFiles are subtree-prefixed.
    expect(seenCommit).not.toBeNull();
    expect(seenCommit!.actions).toEqual([
      { path: "hello-world/workflow.json", content: '{"name":"hello-world"}' },
      {
        path: "hello-world/gates/lint.ts",
        content: "export default () => ({pass:true});",
      },
      { path: "hello-world/old.md", delete: true },
    ]);

    // Tag creation pointed at the new commit sha.
    expect(seenTag).toEqual({ name: "hello-world/v1.2.4", ref: "commitsha123" });

    // DB row advanced.
    const [row] = await db
      .select({ latestGitTag: governedWorkflowDefinitions.latestGitTag })
      .from(governedWorkflowDefinitions)
      .where(
        and(
          eq(governedWorkflowDefinitions.companyId, companyId),
          eq(governedWorkflowDefinitions.name, "hello-world"),
        ),
      );
    expect(row?.latestGitTag).toBe("hello-world/v1.2.4");
  });

  it("rejects a change with a traversal path before touching git", async () => {
    const provider = makeStubProvider();
    await expect(
      batchCommitWorkflowFiles(
        db,
        { resolveGitProvider: async () => provider, shaCache: new ShaCache() },
        {
          companyId,
          userId: null,
          workflowName: "hello-world",
          branch: "main",
          commitMessage: "bad",
          authorName: "Tom",
          authorEmail: "tom@example.com",
          changes: [{ path: "../../etc/passwd", content: "x" }],
        },
      ),
    ).rejects.toMatchObject({ code: "WORKFLOW_FILE_INVALID_PATH" });
    expect(provider.commitMultipleFiles).not.toHaveBeenCalled();
  });
});

// ── P8 — write-side path symmetry tests ────────────────────────────────────

describe("P8 — listWorkflowFiles uses workflows/<name> subtree when paths.workflows is set", () => {
  it("passes workflows/<name> as subtree when provider.paths.workflows is set", async () => {
    const seenSubtrees: (string | undefined)[] = [];
    const provider = {
      ...makeStubProvider({ tree: [] }),
      paths: { workflows: "workflows" },
      fetchTree: vi.fn(async (args: any) => {
        seenSubtrees.push(args.subtree);
        return [];
      }),
    };
    await listWorkflowFiles(
      { resolveGitProvider: async () => provider as any, shaCache: new ShaCache() },
      { companyId: "c1", userId: null, workflowName: "hello-world", ref: "v1.0.0" },
    );
    expect(seenSubtrees).toContain("workflows/hello-world");
  });

  it("falls back to <name> as subtree when provider has no paths (legacy)", async () => {
    const seenSubtrees: (string | undefined)[] = [];
    const provider = {
      ...makeStubProvider({ tree: [] }),
      fetchTree: vi.fn(async (args: any) => {
        seenSubtrees.push(args.subtree);
        return [];
      }),
    };
    await listWorkflowFiles(
      { resolveGitProvider: async () => provider as any, shaCache: new ShaCache() },
      { companyId: "c1", userId: null, workflowName: "hello-world", ref: "v1.0.0" },
    );
    expect(seenSubtrees).toContain("hello-world");
  });
});

describe("P8 — batchCommitWorkflowFiles prefixes paths with workflows/<name>/ when paths.workflows is set", () => {
  let db: Db;
  const companyId = "00000000-0000-0000-0000-000000000e01";

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, 'PathSym', 'PS')`,
    );
    await setTenantContext(db, companyId);
    await db.execute(
      sql`INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
          VALUES (${companyId}, 'hello-world', 'hello-world/v1.0.0')`,
    );
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  it("prefixes each path with workflows/<name>/ when provider.paths.workflows is set", async () => {
    let seenActions: any[] = [];
    const provider = {
      ...makeStubProvider({
        tags: [],
        onCommit: (a: CommitMultipleFilesArgs) => {
          seenActions = a.actions;
          return { sha: "sym-sha" };
        },
      }),
      paths: { workflows: "workflows" },
    };

    await setTenantContext(db, companyId);
    await batchCommitWorkflowFiles(
      db,
      { resolveGitProvider: async () => provider as any, shaCache: new ShaCache() },
      {
        companyId,
        userId: null,
        workflowName: "hello-world",
        branch: "main",
        commitMessage: "sym test",
        authorName: "Tom",
        authorEmail: "tom@example.com",
        changes: [{ path: "workflow.json", content: "{}" }],
      },
    );

    expect(seenActions[0].path).toBe("workflows/hello-world/workflow.json");
  });
});
