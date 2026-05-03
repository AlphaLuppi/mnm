/**
 * Tests for the T3.4 REST route
 * `GET /companies/:companyId/inbox/pending-workflow-steps`.
 *
 * Coverage:
 *  - 200 with `{ items: [...] }` snake_case payload (parity with MCP).
 *  - 403 when the actor has no userId/agentId.
 *  - 400 on invalid status query string.
 *  - status query string parses 'pending,running' into the array.
 *  - companyId resolves from the path param (multi-tenant).
 */
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { workflowAssignmentsRoutes } from "../routes/workflow-assignments.js";
import { errorHandler } from "../middleware/error-handler.js";

// requirePermission calls accessService(db).canUser internally. Mock the
// module so the middleware grants access without DB IO.
vi.mock("../services/access.js", () => ({
  accessService: () => ({
    canUser: vi.fn().mockResolvedValue(true),
    hasPermission: vi.fn().mockResolvedValue(true),
    ensureMembership: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));

vi.mock("../services/audit.js", () => ({
  auditService: () => ({
    emit: vi.fn().mockResolvedValue(undefined),
  }),
}));

interface Actor {
  type: "board" | "agent" | "none";
  userId?: string;
  agentId?: string;
  source?: "session" | "local_implicit";
  isInstanceAdmin?: boolean;
  companyIds?: string[];
}

function buildApp(
  actor: Actor,
  listImpl: (...args: unknown[]) => Promise<unknown[]> = async () => [],
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { actor: Actor }).actor = actor;
    next();
  });
  const fakeDb = {} as never;
  const fakeService = {
    listPendingWorkFor: vi.fn().mockImplementation(listImpl),
    resolveAssignment: vi.fn(),
    snapshotStepAssignments: vi.fn(),
  };
  app.use(workflowAssignmentsRoutes(fakeDb, fakeService as never));
  app.use(errorHandler);
  return { app, fakeService };
}

const COMPANY = "00000000-0000-0000-0000-000000ace001";

const SAMPLE_ROW = {
  stepExecutionId: "se-1",
  stepName: "review",
  runId: "run-1",
  runStatus: "active",
  workflowName: "wf-onboard",
  workflowGitTag: "v1.0.0",
  parentStepExecutionId: null,
  assignedAt: new Date("2026-05-01T10:00:00Z"),
  assignmentReason: "tag-intersection:alpha,beta",
  hasArtifacts: false,
  depsCompleted: true,
};

describe("GET /companies/:companyId/inbox/pending-workflow-steps", () => {
  it("returns 200 with snake_case items array", async () => {
    const { app, fakeService } = buildApp(
      {
        type: "board",
        userId: "user-1",
        source: "session",
        isInstanceAdmin: false,
        companyIds: [COMPANY],
      },
      async () => [SAMPLE_ROW],
    );

    const res = await request(app).get(
      `/companies/${COMPANY}/inbox/pending-workflow-steps`,
    );
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    const it0 = res.body.items[0];
    expect(it0).toMatchObject({
      step_execution_id: "se-1",
      step_name: "review",
      run_id: "run-1",
      run_status: "active",
      workflow_name: "wf-onboard",
      workflow_git_tag: "v1.0.0",
      parent_step_execution_id: null,
      assignment_reason: "tag-intersection:alpha,beta",
      has_artifacts: false,
      deps_completed: true,
    });
    expect(typeof it0.assigned_at).toBe("string");

    expect(fakeService.listPendingWorkFor).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY,
        principalId: "user-1",
      }),
    );
  });

  it("returns 403 when no userId/agentId on the actor", async () => {
    const { app } = buildApp({
      type: "board",
      // userId omitted on purpose
      source: "session",
    });
    const res = await request(app).get(
      `/companies/${COMPANY}/inbox/pending-workflow-steps`,
    );
    expect(res.status).toBe(403);
  });

  it("uses agentId as principalId when actor.type=agent", async () => {
    const { app, fakeService } = buildApp(
      {
        type: "agent",
        agentId: "agent-7",
      },
      async () => [],
    );
    const res = await request(app).get(
      `/companies/${COMPANY}/inbox/pending-workflow-steps`,
    );
    expect(res.status).toBe(200);
    expect(fakeService.listPendingWorkFor).toHaveBeenCalledWith(
      expect.objectContaining({ principalId: "agent-7" }),
    );
  });

  it("parses status='pending,running' into the array", async () => {
    const { app, fakeService } = buildApp(
      {
        type: "board",
        userId: "u",
        source: "session",
        isInstanceAdmin: false,
        companyIds: [COMPANY],
      },
      async () => [],
    );
    await request(app)
      .get(`/companies/${COMPANY}/inbox/pending-workflow-steps`)
      .query({ status: "pending,running" });
    expect(fakeService.listPendingWorkFor).toHaveBeenCalledWith(
      expect.objectContaining({ status: ["pending", "running"] }),
    );
  });

  it("propagates limit query param", async () => {
    const { app, fakeService } = buildApp(
      {
        type: "board",
        userId: "u",
        source: "session",
        isInstanceAdmin: false,
        companyIds: [COMPANY],
      },
      async () => [],
    );
    await request(app)
      .get(`/companies/${COMPANY}/inbox/pending-workflow-steps`)
      .query({ limit: "25" });
    expect(fakeService.listPendingWorkFor).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });

  it("returns 400 on invalid limit", async () => {
    const { app } = buildApp({
      type: "board",
      userId: "u",
      source: "session",
      isInstanceAdmin: false,
      companyIds: [COMPANY],
    });
    const res = await request(app)
      .get(`/companies/${COMPANY}/inbox/pending-workflow-steps`)
      .query({ limit: "0" });
    expect(res.status).toBe(400);
  });
});
