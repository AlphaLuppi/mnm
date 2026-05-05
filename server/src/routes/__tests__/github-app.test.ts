import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { generateKeyPairSync } from "node:crypto";

// ── Test PEM (PKCS#8) ────────────────────────────────────────────────────────

let TEST_PRIVATE_KEY_PEM = "";

beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  TEST_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
});

// ── Mock the github-app service so the route layer can be exercised in
// isolation (no DB, no GitHub API, no msw — service unit tests cover that). ─

const createGitHubAppMock = vi.fn();
const getGitHubAppByConnectorMock = vi.fn();
const listInstallationsMock = vi.fn();
const revokeGitHubAppMock = vi.fn();

vi.mock("../../services/github-app.js", () => ({
  githubAppService: () => ({
    createGitHubApp: createGitHubAppMock,
    getGitHubAppByConnector: getGitHubAppByConnectorMock,
    listInstallations: listInstallationsMock,
    revokeGitHubApp: revokeGitHubAppMock,
  }),
  GitHubAppError: class GitHubAppError extends Error {
    constructor(public code: string, message?: string) {
      super(message ?? code);
    }
  },
}));

// Bypass the real RBAC middleware: the route handler logic is what we want
// to test, not the middleware chain (covered elsewhere).
vi.mock("../../middleware/require-permission.js", () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../authz.js", () => ({
  assertCompanyAccess: vi.fn(),
  assertBoard: vi.fn(),
}));

// ── Import the route factory AFTER the mocks ─────────────────────────────────

import { githubAppRoutes } from "../github-app.js";
import { HttpError } from "../../errors.js";

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";
const CONNECTOR_ID = "00000000-0000-0000-0000-000000000002";

function withActor(app: Express) {
  app.use((req, _res, next) => {
    (req as unknown as { actor: unknown }).actor = {
      type: "board",
      source: "local_implicit",
      userId: "user-tom",
      companyIds: [COMPANY_ID],
      isInstanceAdmin: true,
    };
    next();
  });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  withActor(app);
  app.use(githubAppRoutes({} as unknown as Parameters<typeof githubAppRoutes>[0]));
  // Minimal HttpError → JSON err handler so tests can assert on status codes.
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      return res.status(500).json({ error: (err as Error).message });
    },
  );
  return app;
}

beforeEach(() => {
  createGitHubAppMock.mockReset();
  getGitHubAppByConnectorMock.mockReset();
  listInstallationsMock.mockReset();
  revokeGitHubAppMock.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /companies/:companyId/connectors/:connectorId/github/app", () => {
  it("rejects request body with non-numeric appId (zod 400)", async () => {
    const app = makeApp();
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/connectors/${CONNECTOR_ID}/github/app`)
      .send({ appId: "abc", privateKey: TEST_PRIVATE_KEY_PEM });
    expect(res.status).toBe(400);
    expect(createGitHubAppMock).not.toHaveBeenCalled();
  });

  it("rejects body without a PEM-shaped privateKey (zod 400)", async () => {
    const app = makeApp();
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/connectors/${CONNECTOR_ID}/github/app`)
      .send({ appId: "12345", privateKey: "not-a-pem-but-long-enough-to-pass-min-length-check-".repeat(3) });
    expect(res.status).toBe(400);
  });

  it("returns 201 + app payload on happy path", async () => {
    const fakeApp = {
      id: "app-row",
      appId: "12345",
      appSlug: "mnm-app",
      createdAt: new Date(),
      revokedAt: null,
    };
    createGitHubAppMock.mockResolvedValueOnce(fakeApp);
    const app = makeApp();
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/connectors/${CONNECTOR_ID}/github/app`)
      .send({ appId: "12345", privateKey: TEST_PRIVATE_KEY_PEM });
    expect(res.status).toBe(201);
    expect(res.body.app.appSlug).toBe("mnm-app");
    expect(createGitHubAppMock).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      connectorId: CONNECTOR_ID,
      userId: "user-tom",
      appId: "12345",
      privateKey: TEST_PRIVATE_KEY_PEM,
      webhookSecret: null,
    });
  });

  it("propagates 409 conflict from the service (App already attached)", async () => {
    createGitHubAppMock.mockRejectedValueOnce(
      new HttpError(409, "A GitHub App is already attached"),
    );
    const app = makeApp();
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/connectors/${CONNECTOR_ID}/github/app`)
      .send({ appId: "12345", privateKey: TEST_PRIVATE_KEY_PEM });
    expect(res.status).toBe(409);
  });
});

describe("GET /companies/:companyId/connectors/:connectorId/github/app", () => {
  it("404 when no App is attached", async () => {
    getGitHubAppByConnectorMock.mockResolvedValueOnce(null);
    const app = makeApp();
    const res = await request(app).get(
      `/companies/${COMPANY_ID}/connectors/${CONNECTOR_ID}/github/app`,
    );
    expect(res.status).toBe(404);
  });

  it("200 with app + installations payload", async () => {
    const fakeApp = {
      id: "app-row",
      appId: "12345",
      appSlug: "mnm-app",
      createdAt: new Date(),
      revokedAt: null,
    };
    const fakeInstalls = [
      {
        id: "inst-row",
        installationId: "999",
        accountLogin: "acme",
        accountType: "Organization",
        // MEDIUM-1 — service now returns accountId as a decimal string (not
        // bigint) so JSON.stringify in res.json() never throws TypeError on
        // a real installation row. The route forwards this verbatim.
        accountId: "123456789012345",
        repositorySelection: "all",
        suspendedAt: null,
        createdAt: new Date(),
      },
    ];
    getGitHubAppByConnectorMock.mockResolvedValueOnce(fakeApp);
    listInstallationsMock.mockResolvedValueOnce(fakeInstalls);
    const app = makeApp();
    const res = await request(app).get(
      `/companies/${COMPANY_ID}/connectors/${CONNECTOR_ID}/github/app`,
    );
    expect(res.status).toBe(200);
    expect(res.body.app.appSlug).toBe("mnm-app");
    expect(res.body.installations).toHaveLength(1);
    expect(res.body.installations[0].accountLogin).toBe("acme");
    // accountId reaches the wire as a string — proves no BigInt → JSON crash.
    expect(res.body.installations[0].accountId).toBe("123456789012345");
  });
});

describe("POST .../installations/sync", () => {
  it("404 when no App attached", async () => {
    getGitHubAppByConnectorMock.mockResolvedValueOnce(null);
    const app = makeApp();
    const res = await request(app).post(
      `/companies/${COMPANY_ID}/connectors/${CONNECTOR_ID}/github/app/installations/sync`,
    );
    expect(res.status).toBe(404);
  });

  it("200 with synced installations", async () => {
    getGitHubAppByConnectorMock.mockResolvedValueOnce({
      id: "app-row",
      appId: "12345",
      appSlug: "mnm-app",
      createdAt: new Date(),
      revokedAt: null,
    });
    listInstallationsMock.mockResolvedValueOnce([]);
    const app = makeApp();
    const res = await request(app).post(
      `/companies/${COMPANY_ID}/connectors/${CONNECTOR_ID}/github/app/installations/sync`,
    );
    expect(res.status).toBe(200);
    expect(res.body.installations).toEqual([]);
  });
});

describe("DELETE /companies/:companyId/connectors/:connectorId/github/app", () => {
  it("204 on successful soft-delete", async () => {
    getGitHubAppByConnectorMock.mockResolvedValueOnce({
      id: "app-row",
      appId: "12345",
      appSlug: "mnm-app",
      createdAt: new Date(),
      revokedAt: null,
    });
    revokeGitHubAppMock.mockResolvedValueOnce(undefined);
    const app = makeApp();
    const res = await request(app).delete(
      `/companies/${COMPANY_ID}/connectors/${CONNECTOR_ID}/github/app`,
    );
    expect(res.status).toBe(204);
    expect(revokeGitHubAppMock).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      githubAppId: "app-row",
      actorUserId: "user-tom",
    });
  });

  it("404 when no App attached", async () => {
    getGitHubAppByConnectorMock.mockResolvedValueOnce(null);
    const app = makeApp();
    const res = await request(app).delete(
      `/companies/${COMPANY_ID}/connectors/${CONNECTOR_ID}/github/app`,
    );
    expect(res.status).toBe(404);
  });
});
