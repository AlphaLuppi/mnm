/**
 * Integration tests for the Workflow Studio REST endpoints (U13.3).
 *
 * Pattern mirrors `server/src/__tests__/governed-workflows-ui.test.ts`: we
 * spin up an Express app with fully-mocked services (no real DB, no real git
 * provider). These tests validate routing, permission enforcement, error
 * contract, and response shapes — not DB behaviour. DB-backed coverage for
 * the underlying service already lives in
 * `server/src/services/__tests__/governed-workflow-files.test.ts`.
 */

import { describe, it, expect, vi } from "vitest";
import express, { type Express, Router } from "express";
import request from "supertest";

// ── Mock actor ───────────────────────────────────────────────────────────────

function withLocalImplicitActor(app: Express) {
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      source: "local_implicit",
      userId: "dev-user",
      companyIds: [],
      isInstanceAdmin: false,
    };
    next();
  });
}

// ── Mock the workflow-files service ──────────────────────────────────────────

const listWorkflowFilesMock = vi.fn();
const getWorkflowFileMock = vi.fn();
const batchCommitWorkflowFilesMock = vi.fn();

vi.mock("../../services/governed-workflow-files.js", () => ({
  listWorkflowFiles: (...args: unknown[]) => listWorkflowFilesMock(...args),
  getWorkflowFile: (...args: unknown[]) => getWorkflowFileMock(...args),
  batchCommitWorkflowFiles: (...args: unknown[]) =>
    batchCommitWorkflowFilesMock(...args),
}));

// ── Mock resolveGitProvider (unused here but constructor calls it) ───────────

vi.mock("../../mcp/build-mcp-services.js", () => ({
  createResolveGitProvider: vi.fn(() => async () => ({
    listTags: async () => [],
    fetchBlob: async () => "",
    fetchTree: async () => [],
    resolveRef: async () => "sha",
    pathExists: async () => true,
    commitFile: async () => ({ sha: "sha" }),
    commitMultipleFiles: async () => ({ sha: "sha" }),
    createTag: async () => ({ sha: "sha" }),
  })),
}));

vi.mock("@mnm/git-provider", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@mnm/git-provider")>();
  return {
    ...orig,
    ShaCache: class {
      get() {
        return undefined;
      }
      set() {}
    },
  };
});

// ── Mock the DB so the "workflow exists" lookup is controllable per test ────

let mockWorkflowExists = true;
let mockLatestGitTag: string | null = "hello-world/v1.0.0";

vi.mock("@mnm/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@mnm/db")>();
  return {
    ...orig,
  };
});

// ── Mock `resolveAuthor` from the UI routes file (single source of truth) ───

vi.mock("../governed-workflows-ui.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../governed-workflows-ui.js")>();
  return {
    ...orig,
    resolveAuthor: vi.fn(async () => ({ name: "Tester", email: "t@mnm.local" })),
  };
});

// ── Import route factory AFTER mocks ────────────────────────────────────────

import { governedWorkflowFilesRoutes } from "../governed-workflows-files.js";

// ── Stub a Drizzle-shaped db object with a chainable select() ───────────────

function makeStubDb() {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => {
      if (!mockWorkflowExists) return [];
      return [{ latestGitTag: mockLatestGitTag }];
    },
  };
  return {
    select: () => chain,
  } as any;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  withLocalImplicitActor(app);

  const outer = Router();
  outer.use(
    "/companies/:companyId/governed-workflows/:name/files",
    governedWorkflowFilesRoutes(makeStubDb()),
  );
  app.use("/api", outer);

  return app;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/companies/:companyId/governed-workflows/:name/files", () => {
  it("returns 404 WORKFLOW_NOT_FOUND when no def row and no ?ref", async () => {
    mockWorkflowExists = false;
    const app = makeApp();
    const res = await request(app)
      .get("/api/companies/c-1/governed-workflows/missing-wf/files")
      .expect(404);
    expect(res.body.isError).toBe(true);
    expect(res.body.error_code).toBe("WORKFLOW_NOT_FOUND");
  });

  it("returns 200 {tree} when def row exists", async () => {
    mockWorkflowExists = true;
    mockLatestGitTag = "hello-world/v1.0.0";
    listWorkflowFilesMock.mockResolvedValueOnce({
      tree: [
        { path: "workflow.json", type: "blob", sha: "aaa", size: 10 },
        { path: "gates", type: "tree", sha: "bbb", size: null },
      ],
    });
    const app = makeApp();
    const res = await request(app)
      .get("/api/companies/c-1/governed-workflows/hello-world/files")
      .expect(200);
    expect(Array.isArray(res.body.tree)).toBe(true);
    expect(res.body.tree).toHaveLength(2);
    expect(listWorkflowFilesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId: "c-1",
        workflowName: "hello-world",
        ref: "hello-world/v1.0.0",
      }),
    );
  });

  it("uses ?ref query over the DB latestGitTag", async () => {
    mockWorkflowExists = true;
    mockLatestGitTag = "hello-world/v1.0.0";
    listWorkflowFilesMock.mockResolvedValueOnce({ tree: [] });
    const app = makeApp();
    await request(app)
      .get("/api/companies/c-1/governed-workflows/hello-world/files?ref=main")
      .expect(200);
    expect(listWorkflowFilesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ref: "main" }),
    );
  });
});

describe("GET /api/companies/:companyId/governed-workflows/:name/files/:path(*)", () => {
  it("returns 200 with {content, sha} and preserves nested path segments", async () => {
    mockWorkflowExists = true;
    mockLatestGitTag = "hello-world/v1.0.0";
    getWorkflowFileMock.mockResolvedValueOnce({
      content: "export const x = 1;",
      sha: "blob-sha-xyz",
    });
    const app = makeApp();
    const res = await request(app)
      .get(
        "/api/companies/c-1/governed-workflows/hello-world/files/gates/lint.ts",
      )
      .expect(200);
    expect(res.body.content).toBe("export const x = 1;");
    expect(res.body.sha).toBe("blob-sha-xyz");
    expect(getWorkflowFileMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ path: "gates/lint.ts" }),
    );
  });

  it("returns 422 WORKFLOW_FILE_INVALID_PATH when service rejects traversal", async () => {
    mockWorkflowExists = true;
    const { GovernedWorkflowError } = await import(
      "../../services/governed-workflows.js"
    );
    const { WORKFLOW_ERROR_CODES } = await import("@mnm/governed-workflows");
    getWorkflowFileMock.mockRejectedValueOnce(
      new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_FILE_INVALID_PATH,
        "Path '../secrets' contains a traversal segment",
      ),
    );
    const app = makeApp();
    const res = await request(app)
      .get(
        "/api/companies/c-1/governed-workflows/hello-world/files/..%2Fsecrets",
      )
      .expect(422);
    expect(res.body.error_code).toBe("WORKFLOW_FILE_INVALID_PATH");
  });

  it("returns 404 WORKFLOW_FILE_NOT_FOUND when the file doesn't exist", async () => {
    mockWorkflowExists = true;
    const { GovernedWorkflowError } = await import(
      "../../services/governed-workflows.js"
    );
    const { WORKFLOW_ERROR_CODES } = await import("@mnm/governed-workflows");
    getWorkflowFileMock.mockRejectedValueOnce(
      new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_FILE_NOT_FOUND,
        "File 'does-not-exist.json' not found",
      ),
    );
    const app = makeApp();
    const res = await request(app)
      .get(
        "/api/companies/c-1/governed-workflows/hello-world/files/does-not-exist.json",
      )
      .expect(404);
    expect(res.body.error_code).toBe("WORKFLOW_FILE_NOT_FOUND");
  });
});

describe("PUT /api/companies/:companyId/governed-workflows/:name/files", () => {
  it("returns 422 WORKFLOW_VALIDATION when changes is empty", async () => {
    const app = makeApp();
    const res = await request(app)
      .put("/api/companies/c-1/governed-workflows/hello-world/files")
      .send({ commitMessage: "noop", changes: [] })
      .expect(422);
    expect(res.body.isError).toBe(true);
    expect(res.body.error_code).toBe("WORKFLOW_VALIDATION");
  });

  it("returns 422 WORKFLOW_VALIDATION when commitMessage is missing", async () => {
    const app = makeApp();
    const res = await request(app)
      .put("/api/companies/c-1/governed-workflows/hello-world/files")
      .send({
        changes: [{ path: "workflow.json", content: "{}" }],
      })
      .expect(422);
    expect(res.body.error_code).toBe("WORKFLOW_VALIDATION");
  });

  it("returns 200 {commitSha, newGitTag} on a successful batch commit", async () => {
    batchCommitWorkflowFilesMock.mockResolvedValueOnce({
      commitSha: "abc123",
      newGitTag: "hello-world/v1.0.1",
    });
    const app = makeApp();
    const res = await request(app)
      .put("/api/companies/c-1/governed-workflows/hello-world/files")
      .send({
        commitMessage: "feat: add a gate",
        branch: "main",
        changes: [{ path: "gates/lint.ts", content: "export const x = 1;" }],
      })
      .expect(200);
    expect(res.body.commitSha).toBe("abc123");
    // Must match the `<name>/v<major>.<minor>.<patch>` pattern.
    expect(res.body.newGitTag).toMatch(/^hello-world\/v\d+\.\d+\.\d+$/);
  });

  it("propagates GIT_PROVIDER_ERROR as 502", async () => {
    const { GovernedWorkflowError } = await import(
      "../../services/governed-workflows.js"
    );
    const { WORKFLOW_ERROR_CODES } = await import("@mnm/governed-workflows");
    batchCommitWorkflowFilesMock.mockRejectedValueOnce(
      new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.GIT_PROVIDER_ERROR,
        "Git commitMultipleFiles failed: remote unavailable",
      ),
    );
    const app = makeApp();
    const res = await request(app)
      .put("/api/companies/c-1/governed-workflows/hello-world/files")
      .send({
        commitMessage: "msg",
        changes: [{ path: "x.json", content: "{}" }],
      })
      .expect(502);
    expect(res.body.error_code).toBe("GIT_PROVIDER_ERROR");
  });
});
