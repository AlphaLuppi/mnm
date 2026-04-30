import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

/**
 * Regression tests for upstream Paperclip PR #4122 zone Z7 — peer agents
 * MUST NOT mutate someone else's actively checked-out issue.
 *
 * Before this fix, an agent X could PATCH/DELETE/comment on an issue
 * with status="in_progress" and assigneeAgentId=agentY, even though
 * agentY currently owned the work-in-progress.
 *
 * Override is granted by:
 *   (a) explicit `tasks:manage_active_checkouts` permission slug, OR
 *   (b) the actor being in the assignee's reporting chain (manager).
 *
 * Tests target the PATCH /companies/:companyId/issues/:id route which
 * goes through assertAgentRunCheckoutOwnership; the same helper is now
 * called from DELETE and attachment POST as well (verified by the
 * shared call-site grep — see commit body).
 */

const issueSvc = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  listAttachments: vi.fn(),
  assertCheckoutOwner: vi.fn(),
  list: vi.fn(),
}));

const accessSvc = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  canUser: vi.fn(),
  ensureMembership: vi.fn(),
}));

const agentsSvc = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
}));

const heartbeatSvc = vi.hoisted(() => ({
  wakeup: vi.fn(),
}));

const projectsSvc = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const goalsSvc = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const issueApprovalsSvc = vi.hoisted(() => ({
  list: vi.fn(),
}));

const tagFilterSvc = vi.hoisted(() => ({
  isIssueVisible: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/index.js", () => ({
  issueService: () => issueSvc,
  accessService: () => accessSvc,
  agentService: () => agentsSvc,
  heartbeatService: () => heartbeatSvc,
  projectService: () => projectsSvc,
  goalService: () => goalsSvc,
  issueApprovalService: () => issueApprovalsSvc,
  emitAudit: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("../services/tag-filter.js", () => ({
  tagFilterService: () => tagFilterSvc,
}));

vi.mock("../middleware/require-permission.js", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  assertCompanyPermission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./authz.js", () => ({
  assertCompanyAccess: vi.fn(),
  getActorInfo: vi.fn(() => ({ actorType: "agent", actorId: "agent-X", agentId: "agent-X", runId: "run-1" })),
}));

vi.mock("./issues-checkout-wakeup.js", () => ({
  shouldWakeAssigneeOnCheckout: vi.fn(() => false),
}));

const ASSIGNEE_AGENT_ID = "agent-assignee";
const PEER_AGENT_ID = "agent-peer";
const MANAGER_AGENT_ID = "agent-manager";

function makeApp(actorAgentId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "agent",
      agentId: actorAgentId,
      companyId: "company-1",
      runId: "run-X",
      source: "agent_key",
    };
    next();
  });
  return app;
}

describe("Phase 1.2 Z7 — peer agent checkout ownership enforcement (PR #4122)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    tagFilterSvc.isIssueVisible.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 409 when a peer agent tries to PATCH an active checkout owned by another agent (no override)", async () => {
    issueSvc.getById.mockResolvedValueOnce({
      id: "issue-1",
      companyId: "company-1",
      status: "in_progress",
      assigneeAgentId: ASSIGNEE_AGENT_ID,
      title: "WIP",
    });
    accessSvc.hasPermission.mockResolvedValueOnce(false); // no grant
    agentsSvc.list.mockResolvedValueOnce([
      { id: ASSIGNEE_AGENT_ID, reportsTo: null },
      { id: PEER_AGENT_ID, reportsTo: null }, // not in reporting chain
    ]);

    const { issueRoutes } = await import("../routes/issues.js");
    const app = makeApp(PEER_AGENT_ID);
    app.use("/api", issueRoutes({} as any, {} as any));
    app.use(errorHandler);

    const res = await request(app)
      .patch("/api/companies/company-1/issues/issue-1")
      .set("x-mnm-run-id", "run-X")
      .send({ title: "Hijacked title" });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: "Issue is checked out by another agent",
      code: "ACTIVE_CHECKOUT_OWNED_BY_PEER",
    });
    expect(issueSvc.update).not.toHaveBeenCalled();
  });

  it("allows a peer agent to PATCH when they hold tasks:manage_active_checkouts", async () => {
    issueSvc.getById.mockResolvedValue({
      id: "issue-2",
      companyId: "company-1",
      status: "in_progress",
      assigneeAgentId: ASSIGNEE_AGENT_ID,
      title: "WIP",
    });
    accessSvc.hasPermission.mockResolvedValueOnce(true); // explicit grant
    issueSvc.update.mockResolvedValueOnce({ id: "issue-2", title: "Updated" });

    const { issueRoutes } = await import("../routes/issues.js");
    const app = makeApp(PEER_AGENT_ID);
    app.use("/api", issueRoutes({} as any, {} as any));
    app.use(errorHandler);

    const res = await request(app)
      .patch("/api/companies/company-1/issues/issue-2")
      .send({ title: "Updated" });

    expect(accessSvc.hasPermission).toHaveBeenCalledWith(
      "company-1",
      "agent",
      PEER_AGENT_ID,
      "tasks:manage_active_checkouts",
    );
    // No 409 returned
    expect(res.status).not.toBe(409);
  });

  it("allows a manager (in assignee's reporting chain) to PATCH without explicit grant", async () => {
    issueSvc.getById.mockResolvedValue({
      id: "issue-3",
      companyId: "company-1",
      status: "in_progress",
      assigneeAgentId: ASSIGNEE_AGENT_ID,
      title: "WIP",
    });
    accessSvc.hasPermission.mockResolvedValueOnce(false); // no grant
    agentsSvc.list.mockResolvedValueOnce([
      { id: ASSIGNEE_AGENT_ID, reportsTo: MANAGER_AGENT_ID },
      { id: MANAGER_AGENT_ID, reportsTo: null },
    ]);
    issueSvc.update.mockResolvedValueOnce({ id: "issue-3", title: "Updated" });

    const { issueRoutes } = await import("../routes/issues.js");
    const app = makeApp(MANAGER_AGENT_ID);
    app.use("/api", issueRoutes({} as any, {} as any));
    app.use(errorHandler);

    const res = await request(app)
      .patch("/api/companies/company-1/issues/issue-3")
      .send({ title: "Updated" });

    expect(res.status).not.toBe(409);
  });

  it("does NOT enforce the check when the issue is not in active checkout (status != in_progress)", async () => {
    issueSvc.getById.mockResolvedValue({
      id: "issue-4",
      companyId: "company-1",
      status: "todo",
      assigneeAgentId: ASSIGNEE_AGENT_ID,
      title: "Backlog",
    });
    issueSvc.update.mockResolvedValueOnce({ id: "issue-4", title: "Updated" });

    const { issueRoutes } = await import("../routes/issues.js");
    const app = makeApp(PEER_AGENT_ID);
    app.use("/api", issueRoutes({} as any, {} as any));
    app.use(errorHandler);

    const res = await request(app)
      .patch("/api/companies/company-1/issues/issue-4")
      .send({ title: "Updated" });

    expect(res.status).not.toBe(409);
    expect(accessSvc.hasPermission).not.toHaveBeenCalled();
  });

  it("does NOT enforce the check when no agent currently owns the active checkout (assigneeAgentId=null)", async () => {
    issueSvc.getById.mockResolvedValue({
      id: "issue-5",
      companyId: "company-1",
      status: "in_progress",
      assigneeAgentId: null,
      title: "Unassigned WIP",
    });
    issueSvc.update.mockResolvedValueOnce({ id: "issue-5", title: "Updated" });

    const { issueRoutes } = await import("../routes/issues.js");
    const app = makeApp(PEER_AGENT_ID);
    app.use("/api", issueRoutes({} as any, {} as any));
    app.use(errorHandler);

    const res = await request(app)
      .patch("/api/companies/company-1/issues/issue-5")
      .send({ title: "Updated" });

    expect(res.status).not.toBe(409);
    expect(accessSvc.hasPermission).not.toHaveBeenCalled();
  });

  it("does NOT apply checkout ownership to board users (only agents)", async () => {
    issueSvc.getById.mockResolvedValue({
      id: "issue-6",
      companyId: "company-1",
      status: "in_progress",
      assigneeAgentId: ASSIGNEE_AGENT_ID,
      title: "WIP",
    });
    issueSvc.update.mockResolvedValueOnce({ id: "issue-6", title: "Updated" });

    const { issueRoutes } = await import("../routes/issues.js");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = {
        type: "board",
        userId: "board-user",
        source: "session",
        isInstanceAdmin: false,
        companyIds: ["company-1"],
      };
      next();
    });
    app.use("/api", issueRoutes({} as any, {} as any));
    app.use(errorHandler);

    const res = await request(app)
      .patch("/api/companies/company-1/issues/issue-6")
      .send({ title: "Updated" });

    expect(res.status).not.toBe(409);
    expect(accessSvc.hasPermission).not.toHaveBeenCalled();
  });
});
