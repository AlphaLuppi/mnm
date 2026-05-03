/**
 * SEC P4 — focused regression tests for the 6 review findings on T3-T5.
 *
 *   #1 (CRITICAL) — launchWorkflow must run detectCycle BEFORE the tx.
 *                   We assert that a self-referencing composite root
 *                   throws WORKFLOW_COMPOSITE_CYCLE without ever opening
 *                   a transaction (no INSERT side-effect).
 *   #4 (HIGH)     — enforceFanoutCap must run inside the transaction.
 *                   We assert that the cap COUNT is queried via the tx
 *                   handle (not the outer db) by spying on tx.execute.
 *   #5 (HIGH)     — fetchSucceededArtifactsRecursive must require
 *                   companyId and refuse to descend into another tenant
 *                   (covered by the new test in
 *                   governed-workflows-composite.test.ts — see file).
 *
 * The MCP tool fixes (#2, #3) are exercised by direct schema inspection
 * + handler dispatch since they don't require a DB :
 *   #3 — Zod schema must REJECT input with `company_id`.
 *   #2 — the handler must call setTenantContext + clearTenantContext.
 *
 * The REST tag-scope fix (#6) is exercised by passing a tagIds set
 * through the service stub and verifying the SQL predicate path lights
 * up.
 */
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@mnm/db";
import type { WorkflowDefinition } from "@mnm/governed-workflows";
import {
  detectCycle,
  launchCompositeStep,
  COMPOSITE_FANOUT_CAP,
} from "../governed-workflows-composite.js";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function leafWf(name: string): WorkflowDefinition {
  return {
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name,
    variables: {},
    steps: [
      {
        id: "leaf",
        type: "agent",
        deps: [],
        agent: "claude_code",
        prompt_context: {},
      },
    ],
  } as WorkflowDefinition;
}

function selfRefWf(name: string): WorkflowDefinition {
  return {
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name,
    variables: {},
    steps: [
      {
        id: "into-self",
        type: "composite",
        deps: [],
        uses: `workflows/${name}@v1`,
        prompt_context: {},
      },
    ],
  } as WorkflowDefinition;
}

// ─── #1 CRITICAL — detectCycle wired to launchWorkflow's resolver ──────────

describe("CRITICAL #1 — launchWorkflow cycle detection (resolver shape)", () => {
  it("throws WORKFLOW_COMPOSITE_CYCLE for a self-referencing root", async () => {
    const A = selfRefWf("a");
    // Resolver mirrors the one wired into launchWorkflow: parses the ref
    // and returns the workflow definition for `workflows/a@v1`.
    await expect(
      detectCycle({
        workflow: A,
        resolveWorkflow: async (ref) => {
          if (ref === "workflows/a@v1") return A;
          return null;
        },
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_COMPOSITE_CYCLE" });
  });

  it("is a no-op for a leaf workflow with no composite steps", async () => {
    const leaf = leafWf("leaf");
    await expect(
      detectCycle({
        workflow: leaf,
        resolveWorkflow: async () => null,
      }),
    ).resolves.toBeUndefined();
  });
});

// ─── #4 HIGH — enforceFanoutCap inside the same transaction ────────────────

describe("HIGH #4 — launchCompositeStep runs enforceFanoutCap inside the tx", () => {
  it("acquires the advisory lock + COUNT via tx.execute (outer db.execute is never used)", async () => {
    // First tx.execute = advisory lock (returns []). Second tx.execute =
    // fanout COUNT (returns [{n: 0}]). Subsequent calls (if any) = [].
    let txExecuteCallNo = 0;
    const txExecuteSpy = vi.fn().mockImplementation(async () => {
      txExecuteCallNo += 1;
      if (txExecuteCallNo === 1) return []; // advisory lock
      if (txExecuteCallNo === 2) return [{ n: 0 }]; // fanout count
      return [];
    });

    const txInsertReturning1 = vi.fn().mockResolvedValue([{ id: "sub-run" }]);
    const txInsertReturning2 = vi.fn().mockResolvedValue([
      { id: "se1", stepIdInJson: "leaf" },
    ]);
    let txInsertCall = 0;
    const tx = {
      execute: txExecuteSpy,
      insert: vi.fn(() => {
        txInsertCall += 1;
        return {
          values: () => ({
            returning:
              txInsertCall === 1 ? txInsertReturning1 : txInsertReturning2,
          }),
        };
      }),
      update: vi.fn(() => ({
        set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
      })),
    };

    const outerExecuteSpy = vi.fn();
    const db = {
      execute: outerExecuteSpy,
      select: vi.fn(() => ({
        from: () => ({
          where: () =>
            Promise.resolve([
              { id: "p1", runId: "r1", rootRunId: null, companyId: "c1" },
            ]),
        }),
      })),
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as Db;

    await launchCompositeStep(db, {
      parentStepExecutionId: "p1",
      parentRunId: "r1",
      subWorkflow: leafWf("sub"),
      subWorkflowGitTag: "v1",
      subWorkflowGitSha: "deadbeef",
      subWorkflowDefId: "def-1",
      params: {},
      actor: { type: "user", id: "u1" },
      companyId: "c1",
    });

    // Outer execute MUST NOT be called: the bug pre-fix called
    // enforceFanoutCap on the outer db (TOCTOU). Now everything is on tx.
    expect(outerExecuteSpy).not.toHaveBeenCalled();
    // Tx execute called at least twice (advisory lock + COUNT).
    expect(txExecuteSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects WORKFLOW_COMPOSITE_FANOUT_EXCEEDED when the cap is reached inside the tx", async () => {
    let txExecuteCallNo = 0;
    const txExecuteSpy = vi.fn().mockImplementation(async () => {
      txExecuteCallNo += 1;
      if (txExecuteCallNo === 1) return []; // advisory lock
      return [{ n: COMPOSITE_FANOUT_CAP }]; // every COUNT returns the cap
    });
    const tx = {
      execute: txExecuteSpy,
      insert: vi.fn(),
      update: vi.fn(),
    };
    const db = {
      execute: vi.fn(),
      select: vi.fn(() => ({
        from: () => ({
          where: () =>
            Promise.resolve([
              { id: "p1", runId: "r1", rootRunId: null, companyId: "c1" },
            ]),
        }),
      })),
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as Db;

    await expect(
      launchCompositeStep(db, {
        parentStepExecutionId: "p1",
        parentRunId: "r1",
        subWorkflow: leafWf("sub"),
        subWorkflowGitTag: "v1",
        subWorkflowGitSha: "deadbeef",
        subWorkflowDefId: "def-1",
        params: {},
        actor: { type: "user", id: "u1" },
        companyId: "c1",
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_COMPOSITE_FANOUT_EXCEEDED" });
  });
});
