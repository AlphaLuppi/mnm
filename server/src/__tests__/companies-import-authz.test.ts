import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { companyRoutes } from "../routes/companies.js";
import { errorHandler } from "../middleware/error-handler.js";

const mockPortabilityService = vi.hoisted(() => ({
  exportBundle: vi.fn(),
  previewImport: vi.fn().mockResolvedValue({ ok: true }),
  importBundle: vi.fn().mockResolvedValue({
    company: { id: "company-new", action: "created" },
    agents: [],
    warnings: [],
  }),
}));

vi.mock("../services/index.js", () => ({
  companyService: () => ({
    list: vi.fn(),
    stats: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    remove: vi.fn(),
  }),
  companyPortabilityService: () => mockPortabilityService,
  accessService: () => ({
    canUser: vi.fn(),
    ensureMembership: vi.fn(),
  }),
  emitAudit: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("../services/cao.js", () => ({
  bootstrapCompany: vi.fn(),
}));

type Actor = {
  type: "board";
  userId: string;
  source: "session" | "local_implicit";
  isInstanceAdmin: boolean;
  companyIds: string[];
};

function createApp(actor: Actor) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api/companies", companyRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("companies import authz (regression for upstream GHSA-68qg-g8mg-6pr7 / PR #3315)", () => {
  const nonAdminBoard: Actor = {
    type: "board",
    userId: "user-1",
    source: "session",
    isInstanceAdmin: false,
    companyIds: ["company-1"],
  };

  const adminBoard: Actor = {
    type: "board",
    userId: "admin-user",
    source: "session",
    isInstanceAdmin: true,
    companyIds: [],
  };

  it("rejects new-company import preview when actor is not instance admin", async () => {
    mockPortabilityService.previewImport.mockClear();
    const app = createApp(nonAdminBoard);

    const res = await request(app)
      .post("/api/companies/import/preview")
      .send({
        source: { type: "url", url: "https://example.com/bundle.json" },
        target: { mode: "new_company" },
      });

    expect(res.status).toBe(403);
    expect(mockPortabilityService.previewImport).not.toHaveBeenCalled();
  });

  it("rejects new-company import apply when actor is not instance admin", async () => {
    mockPortabilityService.importBundle.mockClear();
    const app = createApp(nonAdminBoard);

    const res = await request(app)
      .post("/api/companies/import")
      .send({
        source: { type: "url", url: "https://example.com/bundle.json" },
        target: { mode: "new_company" },
      });

    expect(res.status).toBe(403);
    expect(mockPortabilityService.importBundle).not.toHaveBeenCalled();
  });

  it("allows new-company import preview when actor is instance admin", async () => {
    mockPortabilityService.previewImport.mockClear();
    mockPortabilityService.previewImport.mockResolvedValueOnce({ ok: true });
    const app = createApp(adminBoard);

    const res = await request(app)
      .post("/api/companies/import/preview")
      .send({
        source: { type: "url", url: "https://example.com/bundle.json" },
        target: { mode: "new_company" },
      });

    expect(res.status).toBe(200);
    expect(mockPortabilityService.previewImport).toHaveBeenCalledTimes(1);
  });

  it("rejects direct company creation when actor is not instance admin", async () => {
    const app = createApp(nonAdminBoard);

    const res = await request(app)
      .post("/api/companies")
      .send({ name: "Evil Company" });

    expect(res.status).toBe(403);
  });
});
