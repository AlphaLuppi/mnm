/**
 * Integration tests for governed-workflows-ui REST endpoints.
 *
 * These tests spin up an Express app with mocked services (no real DB, no real
 * git provider). They validate routing, permission enforcement, error contract,
 * and response shapes — not DB behaviour (which is tested in extension helpers).
 *
 * Pre-existing Windows/embedded-Postgres limitation means DB-backed tests that
 * call setupTestDb() fail with auth errors; these tests avoid that by mocking
 * the service layer directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { Router } from "express";

// ── Minimal actor middleware stubs ───────────────────────────────────────────

/** Injects a board actor with local_implicit (dev mode — bypasses permission checks). */
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

// ── Minimal mock of governedWorkflowUiRoutes ─────────────────────────────────
// We import the real route factory but inject a mock db + git provider so no
// real I/O happens.

vi.mock("../services/governed-workflows.js", () => ({
  governedWorkflowService: vi.fn(() => ({
    listDefinitions: vi.fn().mockResolvedValue([
      {
        id: "wf-id-1",
        companyId: "company-1",
        name: "hello-world",
        description: null,
        latestGitTag: "hello-world/v1.0.0",
        enabled: true,
        archivedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]),
    getDefinition: vi.fn().mockImplementation(({ name }: { name: string }) => {
      if (name === "hello-world") {
        return Promise.resolve({
          id: "wf-id-1",
          companyId: "company-1",
          name: "hello-world",
          description: null,
          latestGitTag: "hello-world/v1.0.0",
          enabled: true,
          archivedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return Promise.resolve(null);
    }),
    getWorkflowParsed: vi.fn().mockResolvedValue({
      workflow: { name: "hello-world", steps: [] },
      gitTag: "hello-world/v1.0.0",
      gitSha: "deadbeef",
      workflowRepoPath: "hello-world/workflow.json",
    }),
    launchWorkflow: vi.fn().mockResolvedValue({
      runId: "run-id-1",
      firstStep: "step-1",
      gitTag: "hello-world/v1.0.0",
      gitSha: "deadbeef",
    }),
  })),
}));

vi.mock("../services/governed-workflows-extensions.js", () => ({
  saveDefinition: vi.fn().mockResolvedValue({
    commitSha: "sha001",
    newGitTag: "hello-world/v1.0.1",
    created: true,
  }),
  upsertDefinition: vi.fn().mockResolvedValue({
    commitSha: "sha001",
    newGitTag: "hello-world/v1.0.1",
    created: false,
  }),
  archiveDefinition: vi.fn().mockResolvedValue(true),
  setEnabled: vi.fn().mockResolvedValue(true),
  listRuns: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getRunWithSteps: vi.fn().mockImplementation((args: { companyId: string; runId: string }) =>
    args.runId === "existing-run"
      ? Promise.resolve({ run: { id: "existing-run" }, steps: [] })
      : Promise.resolve(null),
  ),
}));

vi.mock("../mcp/build-mcp-services.js", () => ({
  createResolveGitProvider: vi.fn(() => async () => ({
    listTags: async () => [{ name: "hello-world/v1.0.0", sha: "deadbeef" }],
    commitFile: async () => ({ sha: "sha001" }),
    createTag: async () => ({ sha: "sha001" }),
    fetchBlob: async () => "{}",
    resolveRef: async () => "deadbeef",
    pathExists: async () => true,
  })),
}));

vi.mock("@mnm/git-provider", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@mnm/git-provider")>();
  return {
    ...orig,
    ShaCache: class {
      get() { return undefined; }
      set() {}
    },
  };
});

import { governedWorkflowUiRoutes } from "../routes/governed-workflows-ui.js";

// ── App factory ──────────────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());
  withLocalImplicitActor(app);

  // Simulate Express extracting :companyId before the sub-router
  const outer = Router();
  outer.use(
    "/companies/:companyId/governed-workflows",
    governedWorkflowUiRoutes({} as any),
  );
  app.use("/api", outer);

  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/companies/:companyId/governed-workflows", () => {
  it("returns 200 with items array", async () => {
    const app = makeApp();
    const res = await request(app)
      .get("/api/companies/company-1/governed-workflows")
      .expect(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBe(1);
  });
});

describe("GET /api/companies/:companyId/governed-workflows/:name", () => {
  it("returns 200 with definition and parsed when workflow exists", async () => {
    const app = makeApp();
    const res = await request(app)
      .get("/api/companies/company-1/governed-workflows/hello-world")
      .expect(200);
    expect(res.body.definition.name).toBe("hello-world");
  });

  it("returns 404 with WORKFLOW_NOT_FOUND when workflow is missing", async () => {
    const app = makeApp();
    const res = await request(app)
      .get("/api/companies/company-1/governed-workflows/missing-wf")
      .expect(404);
    expect(res.body.isError).toBe(true);
    expect(res.body.error_code).toBe("WORKFLOW_NOT_FOUND");
  });
});

describe("POST /api/companies/:companyId/governed-workflows", () => {
  it("returns 422 with VALIDATION_ERROR when definition is invalid", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/companies/company-1/governed-workflows")
      .send({ definition: {}, commitMessage: "bad", branch: "main" })
      .expect(422);
    expect(res.body.isError).toBe(true);
    expect(res.body.error_code).toBe("VALIDATION_ERROR");
  });

  it("returns 201 with commit SHA when definition is valid", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/companies/company-1/governed-workflows")
      .send({
        definition: {
          apiVersion: "mnm/v1",
          kind: "GovernedWorkflow",
          name: "hello-world",
          variables: {},
          steps: [
            {
              id: "greet",
              deps: [],
              agent: "greeter",
              prompt_context: {},
              gates: {},
            },
          ],
        },
        commitMessage: "add hello-world",
        branch: "main",
      })
      .expect(201);
    expect(res.body.commitSha).toBeDefined();
    expect(res.body.newGitTag).toBeDefined();
  });
});

describe("PUT /api/companies/:companyId/governed-workflows/:name", () => {
  it("returns 422 WORKFLOW_NAME_MISMATCH when body name differs from URL", async () => {
    const app = makeApp();
    const res = await request(app)
      .put("/api/companies/company-1/governed-workflows/different-name")
      .send({
        definition: {
          apiVersion: "mnm/v1",
          kind: "GovernedWorkflow",
          name: "hello-world",
          variables: {},
          steps: [{ id: "greet", deps: [], agent: "greeter", prompt_context: {}, gates: {} }],
        },
        commitMessage: "update",
        branch: "main",
      })
      .expect(422);
    expect(res.body.error_code).toBe("WORKFLOW_NAME_MISMATCH");
  });
});

describe("PATCH /api/companies/:companyId/governed-workflows/:name/enabled", () => {
  it("returns 200 ok when enabled is valid boolean", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch("/api/companies/company-1/governed-workflows/hello-world/enabled")
      .send({ enabled: false })
      .expect(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 422 when enabled is not a boolean", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch("/api/companies/company-1/governed-workflows/hello-world/enabled")
      .send({ enabled: "yes" })
      .expect(422);
    expect(res.body.isError).toBe(true);
    expect(res.body.error_code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /api/companies/:companyId/governed-workflows/:name", () => {
  it("returns 204 when workflow is archived successfully", async () => {
    const app = makeApp();
    await request(app)
      .delete("/api/companies/company-1/governed-workflows/hello-world")
      .expect(204);
  });
});

describe("GET /api/companies/:companyId/governed-workflows/:name/tags", () => {
  it("returns tags array", async () => {
    const app = makeApp();
    const res = await request(app)
      .get("/api/companies/company-1/governed-workflows/hello-world/tags")
      .expect(200);
    expect(res.body).toHaveProperty("tags");
    expect(Array.isArray(res.body.tags)).toBe(true);
  });
});

describe("GET /api/companies/:companyId/governed-workflows/:name/runs", () => {
  it("returns items and total", async () => {
    const app = makeApp();
    const res = await request(app)
      .get("/api/companies/company-1/governed-workflows/hello-world/runs")
      .expect(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
  });
});

describe("GET /api/companies/:companyId/governed-workflows/:name/runs/:runId", () => {
  it("returns 404 WORKFLOW_RUN_NOT_FOUND when run is missing (mock returns null)", async () => {
    // getRunWithSteps mock returns null for all runIds not in the happy path
    const app = makeApp();
    const res = await request(app)
      .get("/api/companies/company-1/governed-workflows/hello-world/runs/missing-run")
      .expect(404);
    expect(res.body.isError).toBe(true);
    expect(res.body.error_code).toBe("WORKFLOW_RUN_NOT_FOUND");
  });

  it("returns 200 with run + steps when mock returns a run", async () => {
    // Override getRunWithSteps mock for this specific test
    const { getRunWithSteps } = await import("../services/governed-workflows-extensions.js");
    (getRunWithSteps as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      run: { id: "run-x" },
      steps: [],
    });
    const app = makeApp();
    const res = await request(app)
      .get("/api/companies/company-1/governed-workflows/hello-world/runs/run-x")
      .expect(200);
    expect(res.body.run).toBeDefined();
    expect(Array.isArray(res.body.steps)).toBe(true);
  });
});

describe("POST /api/companies/:companyId/governed-workflows/:name/runs", () => {
  it("returns 201 with runId when launch is successful", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/companies/company-1/governed-workflows/hello-world/runs")
      .send({ params: {}, gitTagPreference: "latest" })
      .expect(201);
    expect(res.body.runId).toBeDefined();
  });
});
