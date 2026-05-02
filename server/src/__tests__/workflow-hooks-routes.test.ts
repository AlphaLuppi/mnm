/**
 * Smoke tests for the T2.8 REST routes (workflow-hooks).
 *
 * These tests stub the workflowHooksService and the actor / permission
 * middleware so we can exercise the route shape (paths, status codes,
 * payload validation) without standing up the full server. The actual
 * service logic is covered by `services/__tests__/workflow-hooks.test.ts`.
 */
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { WorkflowHooksService } from "../services/workflow-hooks.js";
import { workflowHooksRoutes } from "../routes/workflow-hooks.js";

// Stub the requirePermission middleware so we don't need a real DB to test
// the route shape. Permission re-check is covered separately.
vi.mock("../middleware/require-permission.js", () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Stub the access service so actorHasEnforcePermission resolves.
vi.mock("../services/access.js", () => ({
  accessService: () => ({
    canUser: async () => true,
    hasPermission: async () => true,
  }),
}));

// authz helpers — assertCompanyAccess + assertBoard are mocked to no-ops.
vi.mock("../routes/authz.js", () => ({
  assertCompanyAccess: () => undefined,
  assertBoard: () => undefined,
}));

function makeService(over: Partial<WorkflowHooksService> = {}): WorkflowHooksService {
  return {
    listConfigs: vi.fn(async () => []),
    getConfig: vi.fn(async () => null),
    createConfig: vi.fn(async () => ({
      id: "cfg-1",
      companyId: "co-1",
      name: "demo",
      hookRef: "canonical:jira-comment-on-complete",
      defaultConfigJson: {},
      visibility: "private",
      createdByPrincipalId: "user-A",
      enabled: true,
      enforced: false,
      enforcedPhases: [],
      tagIds: [],
      principalIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    updateConfig: vi.fn(),
    deleteConfig: vi.fn(async () => true),
    resolveHooksForStep: vi.fn(),
    executeHook: vi.fn(),
    listExecutions: vi.fn(async () => []),
    listCatalog: vi.fn(async () => ({ canonical: [], shared: [], local: [] })),
    invalidateEnforcedCache: vi.fn(),
    _internals: { isKillSwitchOn: () => false },
    ...over,
  } as unknown as WorkflowHooksService;
}

function makeApp(svc: WorkflowHooksService) {
  const app = express();
  app.use(express.json());
  // Inject a fake req.actor so handlers can read userId without breaking.
  app.use((req, _res, next) => {
    (req as unknown as { actor: unknown }).actor = {
      type: "board",
      userId: "user-A",
      companyIds: ["00000000-0000-0000-0000-000000000001"],
    };
    next();
  });
  // db is unused (requirePermission is stubbed) — pass an empty object.
  app.use(workflowHooksRoutes({} as never, svc));
  // Error handler so async throws map to JSON 4xx/5xx — supports both
  // HttpError (`status`) and Express-style errors (`statusCode`).
  app.use(
    (
      err: { status?: number; statusCode?: number; message: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res
        .status(err.status ?? err.statusCode ?? 500)
        .json({ error: err.message });
    },
  );
  return app;
}

const COMPANY = "00000000-0000-0000-0000-000000000001";
const CFG_PATH = `/companies/${COMPANY}/workflow-hooks/configs`;

describe("workflow-hooks REST routes — shape", () => {
  it("GET /configs returns { configs: [] }", async () => {
    const svc = makeService();
    const res = await request(makeApp(svc)).get(CFG_PATH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configs: [] });
    expect(svc.listConfigs).toHaveBeenCalledWith(COMPANY, "user-A");
  });

  it("GET /configs/:id returns 404 when service returns null", async () => {
    const svc = makeService();
    const res = await request(makeApp(svc)).get(
      `${CFG_PATH}/00000000-0000-0000-0000-000000000010`,
    );
    expect(res.status).toBe(404);
  });

  it("POST /configs validates payload — bad hookRef → 400", async () => {
    const svc = makeService();
    const res = await request(makeApp(svc))
      .post(CFG_PATH)
      .send({
        name: "x",
        hookRef: "BadCamelCase",
        visibility: "private",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/canonical\|shared\|local/);
  });

  it("POST /configs creates a config and returns 201", async () => {
    const svc = makeService();
    const res = await request(makeApp(svc))
      .post(CFG_PATH)
      .send({
        name: "demo",
        hookRef: "canonical:jira-comment-on-complete",
        visibility: "private",
      });
    expect(res.status).toBe(201);
    expect(res.body.config.name).toBe("demo");
    expect(svc.createConfig).toHaveBeenCalled();
  });

  it("DELETE /configs/:id returns 204 on success", async () => {
    const svc = makeService();
    const res = await request(makeApp(svc)).delete(
      `${CFG_PATH}/00000000-0000-0000-0000-000000000010`,
    );
    expect(res.status).toBe(204);
  });

  it("DELETE /configs/:id returns 404 when service returns false", async () => {
    const svc = makeService({ deleteConfig: vi.fn(async () => false) } as never);
    const res = await request(makeApp(svc)).delete(
      `${CFG_PATH}/00000000-0000-0000-0000-000000000010`,
    );
    expect(res.status).toBe(404);
  });

  it("GET /executions accepts query filters", async () => {
    const svc = makeService();
    const res = await request(makeApp(svc))
      .get(`/companies/${COMPANY}/workflow-hooks/executions`)
      .query({
        config_id: "00000000-0000-0000-0000-000000000005",
        run_id: "00000000-0000-0000-0000-000000000006",
        status: "failed",
        limit: 50,
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ executions: [] });
    expect(svc.listExecutions).toHaveBeenCalledWith(COMPANY, {
      configId: "00000000-0000-0000-0000-000000000005",
      runId: "00000000-0000-0000-0000-000000000006",
      status: "failed",
      limit: 50,
    });
  });

  it("GET /catalog returns canonical/shared/local lists", async () => {
    const svc = makeService();
    const res = await request(makeApp(svc)).get(
      `/companies/${COMPANY}/workflow-hooks/catalog`,
    );
    expect(res.status).toBe(200);
    expect(res.body.catalog).toEqual({ canonical: [], shared: [], local: [] });
    expect(svc.listCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY,
        actorUserId: "user-A",
        includeShared: true,
        includeLocal: false,
      }),
    );
  });
});
