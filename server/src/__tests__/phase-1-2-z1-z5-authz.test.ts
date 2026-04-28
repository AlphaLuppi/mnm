import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

/**
 * Regression tests for upstream Paperclip PR #4122 — zones Z1 + Z5.
 *
 * Z1 (budget mutation cross-company): an agent's budget can only be modified
 * via /companies/:companyId/agents/:agentId/budgets if the agent actually
 * belongs to that company. Without the explicit check, a board user with
 * access to companyA could mutate budgets for an agent in companyB.
 *
 * Z5 (direct agent creation bypass): if a company sets
 * `requireBoardApprovalForNewAgents=true`, direct POST to /companies/:id/agents
 * must reject with 409 and direct callers to /agent-hires (the gated flow).
 */

// -- Z1: cross-company budget mutation -------------------------------------------

const z1AgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
}));

const z1CompanyService = vi.hoisted(() => ({
  update: vi.fn(),
}));

const z1CostsService = vi.hoisted(() => ({
  byProject: vi.fn(),
  byAgent: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  agentService: () => z1AgentService,
  companyService: () => z1CompanyService,
  costService: () => z1CostsService,
  emitAudit: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("./authz.js", () => ({
  assertBoard: vi.fn(),
  assertCompanyAccess: vi.fn(),
  getActorInfo: vi.fn(() => ({ actorType: "user", actorId: "user-1", agentId: null, runId: null })),
}));

describe("Phase 1.2 Z1 — budget mutation must verify agent belongs to path company", () => {
  it("returns 404 when targeted agent belongs to a different company than the path", async () => {
    z1AgentService.getById.mockResolvedValueOnce({
      id: "agent-in-companyB",
      companyId: "company-B",
      budgetMonthlyCents: 1000,
    });

    const { costRoutes } = await import("../routes/costs.js");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = {
        type: "board",
        userId: "user-1",
        source: "session",
        isInstanceAdmin: false,
        companyIds: ["company-A", "company-B"],
      };
      next();
    });
    app.use("/api", costRoutes({} as any));
    app.use(errorHandler);

    const res = await request(app)
      .patch("/api/companies/company-A/agents/agent-in-companyB/budgets")
      .send({ budgetMonthlyCents: 5000 });

    expect(res.status).toBe(404);
    expect(z1AgentService.update).not.toHaveBeenCalled();
  });

  it("allows budget mutation when agent belongs to the path company", async () => {
    z1AgentService.getById.mockResolvedValueOnce({
      id: "agent-in-companyA",
      companyId: "company-A",
      budgetMonthlyCents: 1000,
    });
    z1AgentService.update.mockResolvedValueOnce({
      id: "agent-in-companyA",
      companyId: "company-A",
      budgetMonthlyCents: 5000,
    });

    const { costRoutes } = await import("../routes/costs.js");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = {
        type: "board",
        userId: "user-1",
        source: "session",
        isInstanceAdmin: false,
        companyIds: ["company-A"],
      };
      next();
    });
    app.use("/api", costRoutes({} as any));
    app.use(errorHandler);

    const res = await request(app)
      .patch("/api/companies/company-A/agents/agent-in-companyA/budgets")
      .send({ budgetMonthlyCents: 5000 });

    expect(res.status).toBe(200);
    expect(z1AgentService.update).toHaveBeenCalledWith("agent-in-companyA", {
      budgetMonthlyCents: 5000,
    });
  });
});
