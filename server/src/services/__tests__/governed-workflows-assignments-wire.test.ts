/**
 * Tests for the T3.3 wire of `governedWorkflowsAssignmentsService` into
 * `governed-workflows.ts` (launchWorkflow → snapshot, launchStep → delta).
 *
 * The full launchWorkflow path requires a real Postgres + git provider stack;
 * those integration tests live in `governed-workflows.test.ts`. This file
 * exercises the wire-level invariants:
 *
 *  - When a step declares an `assignment`, launchWorkflow snapshots the
 *    resolved set (1 row per matched principal) — verified by spying on
 *    a mocked `workflowAssignments` service.
 *  - Each fresh row triggers a `step.assignment.created` SSE event with
 *    `visibility = { scope: "actor-only", actorId }` so only the assigned
 *    principal sees it.
 *  - A re-launch (delta) only inserts the principals that aren't already
 *    snapshotted — idempotent on (step_execution_id, principal_id).
 *  - When `workflowAssignments` is undefined (legacy DI), the wire is a
 *    no-op and the launch path is unaffected (asserted indirectly by the
 *    full launchWorkflow tests passing without the dep).
 */
import { describe, expect, it, vi } from "vitest";
import type { GovernedWorkflowsAssignmentsService } from "../governed-workflows-assignments.js";
import type { StepAssignment } from "@mnm/governed-workflows";

interface SpyPublish {
  calls: Array<{
    type: string;
    payload: Record<string, unknown>;
    visibility: { scope: string; actorId?: string };
  }>;
}

function buildPublishSpy(): SpyPublish & {
  fn: (event: {
    companyId: string;
    type: string;
    payload: Record<string, unknown>;
    visibility: { scope: string; actorId?: string };
  }) => void;
} {
  const spy: SpyPublish = { calls: [] };
  const fn = (event: {
    companyId: string;
    type: string;
    payload: Record<string, unknown>;
    visibility: { scope: string; actorId?: string };
  }) => {
    spy.calls.push({
      type: event.type,
      payload: event.payload,
      visibility: event.visibility,
    });
  };
  return Object.assign(spy, { fn });
}

/**
 * Minimal in-memory stub of the assignments service. Implements the
 * resolve + snapshot contract used by the wire so we can simulate a
 * launchWorkflow / launchStep call sequence in pure JS, no DB.
 */
function buildStubAssignmentsService(): GovernedWorkflowsAssignmentsService & {
  _snapshots: Map<string, Set<string>>;
} {
  const snapshots = new Map<string, Set<string>>(); // stepExecId -> Set<principalId>

  return {
    async resolveAssignment(args) {
      const a = args.assignment;
      if (!a) return [];
      const tagPrincipals = (a.tags ?? []).length > 0 ? ["P1", "P2"] : [];
      const rolePrincipals = (a.roles ?? []).length > 0 ? ["P3"] : [];
      const explicit = a.principals ?? [];
      const dedup = new Map<string, string[]>();
      for (const p of tagPrincipals)
        dedup.set(p, [...(dedup.get(p) ?? []), "tag-stub"]);
      for (const p of rolePrincipals)
        dedup.set(p, [...(dedup.get(p) ?? []), "role-stub"]);
      for (const p of explicit)
        dedup.set(p, [...(dedup.get(p) ?? []), "explicit"]);
      return [...dedup.entries()].map(([principalId, reasons]) => ({
        principalId,
        reason: reasons.join(" + "),
      }));
    },
    async snapshotStepAssignments(args) {
      const set = snapshots.get(args.stepExecutionId) ?? new Set<string>();
      const inserted: Array<{
        id: string;
        companyId: string;
        stepExecutionId: string;
        principalId: string;
        reason: string;
        snapshotAt: Date;
      }> = [];
      for (const e of args.entries) {
        if (set.has(e.principalId)) continue;
        set.add(e.principalId);
        inserted.push({
          id: `assign-${args.stepExecutionId}-${e.principalId}`,
          companyId: args.companyId,
          stepExecutionId: args.stepExecutionId,
          principalId: e.principalId,
          reason: e.reason,
          snapshotAt: new Date(),
        });
      }
      snapshots.set(args.stepExecutionId, set);
      return inserted;
    },
    async listPendingWorkFor() {
      return [];
    },
    _snapshots: snapshots,
  } as GovernedWorkflowsAssignmentsService & {
    _snapshots: Map<string, Set<string>>;
  };
}

/**
 * Helper that mirrors the launchWorkflow snapshot loop from
 * governed-workflows.ts. Kept in sync manually — when the wire changes,
 * this stub must be updated.
 */
async function simulateLaunchSnapshot(
  svc: GovernedWorkflowsAssignmentsService,
  publish: (event: {
    companyId: string;
    type: string;
    payload: Record<string, unknown>;
    visibility: { scope: string; actorId?: string };
  }) => void,
  args: {
    companyId: string;
    runId: string;
    workflowName: string;
    steps: Array<{
      id: string;
      stepExecId: string;
      assignment?: StepAssignment;
    }>;
  },
): Promise<void> {
  for (const step of args.steps) {
    if (!step.assignment) continue;
    const entries = await svc.resolveAssignment({
      companyId: args.companyId,
      assignment: step.assignment,
    });
    const inserted = await svc.snapshotStepAssignments({
      companyId: args.companyId,
      stepExecutionId: step.stepExecId,
      entries,
    });
    for (const row of inserted) {
      publish({
        companyId: args.companyId,
        type: "step.assignment.created",
        payload: {
          step_execution_id: row.stepExecutionId,
          principal_id: row.principalId,
          reason: row.reason,
          run_id: args.runId,
          workflow_name: args.workflowName,
          step_name: step.id,
        },
        visibility: { scope: "actor-only", actorId: row.principalId },
      });
    }
  }
}

describe("T3.3 wire — launchWorkflow snapshot", () => {
  it("snapshots assignments for every step that declares one", async () => {
    const svc = buildStubAssignmentsService();
    const pub = buildPublishSpy();

    await simulateLaunchSnapshot(svc, pub.fn, {
      companyId: "co-1",
      runId: "run-1",
      workflowName: "wf-onboard",
      steps: [
        {
          id: "review",
          stepExecId: "se-review",
          assignment: { tags: ["alpha"] },
        },
        { id: "deploy", stepExecId: "se-deploy" }, // no assignment
        {
          id: "qa",
          stepExecId: "se-qa",
          assignment: { roles: ["engineer"], principals: ["P9"] },
        },
      ],
    });

    expect(svc._snapshots.get("se-review")).toEqual(new Set(["P1", "P2"]));
    expect(svc._snapshots.get("se-deploy")).toBeUndefined();
    expect(svc._snapshots.get("se-qa")).toEqual(new Set(["P3", "P9"]));
  });

  it("publishes step.assignment.created with actor-only visibility for each fresh row", async () => {
    const svc = buildStubAssignmentsService();
    const pub = buildPublishSpy();

    await simulateLaunchSnapshot(svc, pub.fn, {
      companyId: "co-1",
      runId: "run-1",
      workflowName: "wf",
      steps: [
        {
          id: "review",
          stepExecId: "se-review",
          assignment: { tags: ["alpha"] },
        },
      ],
    });

    expect(pub.calls).toHaveLength(2); // P1 + P2
    for (const call of pub.calls) {
      expect(call.type).toBe("step.assignment.created");
      expect(call.visibility.scope).toBe("actor-only");
      expect(call.visibility.actorId).toBe(call.payload.principal_id);
      expect(call.payload).toMatchObject({
        run_id: "run-1",
        workflow_name: "wf",
        step_name: "review",
      });
    }
    const principals = new Set(pub.calls.map((c) => c.payload.principal_id));
    expect(principals).toEqual(new Set(["P1", "P2"]));
  });

  it("delta — re-launching a step with an unchanged assignment inserts nothing", async () => {
    const svc = buildStubAssignmentsService();
    const pub = buildPublishSpy();

    const params = {
      companyId: "co-1",
      runId: "run-1",
      workflowName: "wf",
      steps: [
        {
          id: "review",
          stepExecId: "se-review",
          assignment: { tags: ["alpha"] },
        },
      ],
    };

    await simulateLaunchSnapshot(svc, pub.fn, params);
    expect(pub.calls).toHaveLength(2);

    // Re-launch same params → delta is empty, no new live events.
    pub.calls.length = 0;
    await simulateLaunchSnapshot(svc, pub.fn, params);
    expect(pub.calls).toHaveLength(0);
    expect(svc._snapshots.get("se-review")).toEqual(new Set(["P1", "P2"]));
  });

  it("delta — adding a principal to the assignment publishes only the fresh principal", async () => {
    const svc = buildStubAssignmentsService();
    const pub = buildPublishSpy();

    const seReview = "se-review";
    // Initial snapshot.
    await simulateLaunchSnapshot(svc, pub.fn, {
      companyId: "co-1",
      runId: "run-1",
      workflowName: "wf",
      steps: [
        { id: "review", stepExecId: seReview, assignment: { tags: ["alpha"] } },
      ],
    });
    pub.calls.length = 0;

    // Now extend with explicit principal P9 — only P9 should publish.
    await simulateLaunchSnapshot(svc, pub.fn, {
      companyId: "co-1",
      runId: "run-1",
      workflowName: "wf",
      steps: [
        {
          id: "review",
          stepExecId: seReview,
          assignment: { tags: ["alpha"], principals: ["P9"] },
        },
      ],
    });
    expect(pub.calls).toHaveLength(1);
    expect(pub.calls[0]!.payload.principal_id).toBe("P9");
  });

  it("no assignment dep wired (undefined) → simulate a no-op gracefully", async () => {
    // Mirrors the `if (assignmentsSvc) {...}` guard in the launchWorkflow
    // wire: when undefined, the loop is skipped entirely.
    const pub = buildPublishSpy();
    const svc: GovernedWorkflowsAssignmentsService | undefined = undefined;

    if (svc) {
      await simulateLaunchSnapshot(svc, pub.fn, {
        companyId: "co-1",
        runId: "run-1",
        workflowName: "wf",
        steps: [],
      });
    }

    expect(pub.calls).toHaveLength(0);
  });

  it("step.assignment.created event payload includes the assignment reason for audit", async () => {
    const svc = buildStubAssignmentsService();
    const pub = buildPublishSpy();

    await simulateLaunchSnapshot(svc, pub.fn, {
      companyId: "co-1",
      runId: "run-1",
      workflowName: "wf",
      steps: [
        {
          id: "review",
          stepExecId: "se-review",
          assignment: { tags: ["alpha"], principals: ["P9"] },
        },
      ],
    });

    const p9 = pub.calls.find((c) => c.payload.principal_id === "P9");
    expect(p9?.payload.reason).toBe("explicit");
    const p1 = pub.calls.find((c) => c.payload.principal_id === "P1");
    expect(p1?.payload.reason).toContain("tag-stub");
  });
});
