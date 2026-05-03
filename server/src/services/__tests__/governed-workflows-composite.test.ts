/**
 * Unit tests for the composite (meta-workflow) resolver — T5.2.
 *
 * Covers the no-DB-required pieces: parseCompositeUses, detectCycle (static
 * walk), enforceFanoutCap (mocked db.execute), fetchSucceededArtifactsRecursive
 * (mocked db.select), and launchCompositeStep cycle/fanout error paths
 * (mocked db.transaction). The wired-into-launchStep flow is exercised by
 * `governed-workflows-composite-wire.test.ts` (T5.3.1).
 *
 * Why mocks vs setupTestDb: cycle detection / fanout cap are pure logic over
 * the workflow graph and a row count — exercising them via Postgres adds
 * latency without coverage. The wire test (T5.3) uses a real DB fixture for
 * the end-to-end flow.
 */
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@mnm/db";
import type { WorkflowDefinition } from "@mnm/governed-workflows";
import {
  COMPOSITE_FANOUT_CAP,
  detectCycle,
  enforceFanoutCap,
  fetchSucceededArtifactsRecursive,
  launchCompositeStep,
  parseCompositeUses,
} from "../governed-workflows-composite.js";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function wf(
  name: string,
  steps: Array<{ id: string; type?: "agent" | "composite"; uses?: string; agent?: string }>,
): WorkflowDefinition {
  return {
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name,
    variables: {},
    steps: steps.map((s) => ({
      id: s.id,
      type: s.type ?? "agent",
      deps: [],
      agent: s.agent ?? (s.type === "composite" ? undefined : "claude_code"),
      uses: s.uses,
      prompt_context: {},
    })) as WorkflowDefinition["steps"],
  } as WorkflowDefinition;
}

// ─── parseCompositeUses ─────────────────────────────────────────────────────

describe("parseCompositeUses", () => {
  it("parses a canonical workflows/<name>@<ref>", () => {
    expect(parseCompositeUses("workflows/feature-dev@v1.2.3")).toEqual({
      name: "feature-dev",
      ref: "v1.2.3",
    });
  });

  it("parses a sha-like ref", () => {
    expect(parseCompositeUses("workflows/build@abc123def")).toEqual({
      name: "build",
      ref: "abc123def",
    });
  });

  it("throws WORKFLOW_USES_INVALID for malformed refs", () => {
    expect(() => parseCompositeUses("agents/x@v1")).toThrow(
      /workflows\/<name>@<ref>/,
    );
    expect(() => parseCompositeUses("workflows/X@v1")).toThrow();
    expect(() => parseCompositeUses("workflows/x")).toThrow();
  });
});

// ─── detectCycle (static, launch-time) ─────────────────────────────────────

describe("detectCycle", () => {
  it("accepts a leaf workflow with no composite steps", async () => {
    const root = wf("leaf", [{ id: "s1", agent: "claude_code" }]);
    await expect(
      detectCycle({
        workflow: root,
        resolveWorkflow: async () => null,
      }),
    ).resolves.toBeUndefined();
  });

  it("accepts a 4-level deep linear composite chain", async () => {
    // root → A → B → C  (every level is a composite step pointing to next)
    const C = wf("c", [{ id: "leaf", agent: "claude_code" }]);
    const B = wf("b", [{ id: "into-c", type: "composite", uses: "workflows/c@v1" }]);
    const A = wf("a", [{ id: "into-b", type: "composite", uses: "workflows/b@v1" }]);
    const root = wf("root", [{ id: "into-a", type: "composite", uses: "workflows/a@v1" }]);

    const lookup: Record<string, WorkflowDefinition> = {
      "workflows/a@v1": A,
      "workflows/b@v1": B,
      "workflows/c@v1": C,
    };
    await expect(
      detectCycle({
        workflow: root,
        resolveWorkflow: async (ref) => lookup[ref] ?? null,
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects a direct cycle A → B → A", async () => {
    const B = wf("b", [{ id: "back-to-a", type: "composite", uses: "workflows/a@v1" }]);
    const A = wf("a", [{ id: "into-b", type: "composite", uses: "workflows/b@v1" }]);
    const lookup: Record<string, WorkflowDefinition> = {
      "workflows/a@v1": A,
      "workflows/b@v1": B,
    };
    // Root is A itself — but we synthesise rootRef so the cycle bites at the
    // second visit of `workflows/a@v1`.
    await expect(
      detectCycle({
        workflow: A,
        resolveWorkflow: async (ref) => lookup[ref] ?? null,
      }),
    ).rejects.toThrow(/cycle detected/);
  });

  it("rejects a self-reference workflow A → A", async () => {
    const A = wf("a", [{ id: "self", type: "composite", uses: "workflows/a@v1" }]);
    await expect(
      detectCycle({
        workflow: A,
        resolveWorkflow: async () => A,
      }),
    ).rejects.toThrow(/cycle detected/);
  });

  it("accepts a diamond (A → B + A → C, both → D)", async () => {
    const D = wf("d", [{ id: "leaf", agent: "claude_code" }]);
    const C = wf("c", [{ id: "into-d", type: "composite", uses: "workflows/d@v1" }]);
    const B = wf("b", [{ id: "into-d", type: "composite", uses: "workflows/d@v1" }]);
    const A = wf("a", [
      { id: "into-b", type: "composite", uses: "workflows/b@v1" },
      { id: "into-c", type: "composite", uses: "workflows/c@v1" },
    ]);
    const lookup: Record<string, WorkflowDefinition> = {
      "workflows/b@v1": B,
      "workflows/c@v1": C,
      "workflows/d@v1": D,
    };
    await expect(
      detectCycle({
        workflow: A,
        resolveWorkflow: async (ref) => lookup[ref] ?? null,
      }),
    ).resolves.toBeUndefined();
  });

  it("throws WORKFLOW_COMPOSITE_USES_NOT_FOUND when sub-workflow is unknown", async () => {
    const root = wf("root", [{ id: "ghost", type: "composite", uses: "workflows/missing@v1" }]);
    await expect(
      detectCycle({
        workflow: root,
        resolveWorkflow: async () => null,
      }),
    ).rejects.toThrow(/unknown workflow/);
  });

  it("throws WORKFLOW_COMPOSITE_DEPTH_EXCEEDED on chain longer than maxDepth", async () => {
    // A → A (self-ref) but with `visited` defeated by always returning a
    // fresh def per level — simulate adversarial resolver.
    let i = 0;
    const adversarial = async (): Promise<WorkflowDefinition> => {
      i += 1;
      // Each level returns a workflow whose composite step uses a unique ref.
      return wf(`gen-${i}`, [
        { id: "next", type: "composite", uses: `workflows/gen-${i + 1}@v1` },
      ]);
    };
    const root = wf("root", [{ id: "into", type: "composite", uses: "workflows/gen-1@v1" }]);
    await expect(
      detectCycle({
        workflow: root,
        resolveWorkflow: adversarial,
        maxDepth: 5,
      }),
    ).rejects.toThrow(/max depth/);
  });
});

// ─── enforceFanoutCap (runtime) ────────────────────────────────────────────

describe("enforceFanoutCap", () => {
  function mockDbWithCount(n: number): Db {
    return {
      execute: vi.fn().mockResolvedValue([{ n }]),
    } as unknown as Db;
  }

  it("passes when count is below cap", async () => {
    const db = mockDbWithCount(500);
    await expect(
      enforceFanoutCap({ db, companyId: "c1", rootRunId: "r1" }),
    ).resolves.toBeUndefined();
  });

  it("passes when count is exactly cap-1 (edge below)", async () => {
    const db = mockDbWithCount(COMPOSITE_FANOUT_CAP - 1);
    await expect(
      enforceFanoutCap({ db, companyId: "c1", rootRunId: "r1" }),
    ).resolves.toBeUndefined();
  });

  it("throws when count equals cap (edge at)", async () => {
    const db = mockDbWithCount(COMPOSITE_FANOUT_CAP);
    await expect(
      enforceFanoutCap({ db, companyId: "c1", rootRunId: "r1" }),
    ).rejects.toThrow(/fan-out cap/);
  });

  it("throws when count exceeds cap (1001)", async () => {
    const db = mockDbWithCount(1001);
    await expect(
      enforceFanoutCap({ db, companyId: "c1", rootRunId: "r1" }),
    ).rejects.toThrow(/fan-out cap/);
  });

  it("attaches the canonical error code on the thrown error", async () => {
    const db = mockDbWithCount(COMPOSITE_FANOUT_CAP);
    try {
      await enforceFanoutCap({ db, companyId: "c1", rootRunId: "r1" });
      throw new Error("expected throw");
    } catch (e) {
      const err = e as { code?: string };
      expect(err.code).toBe("WORKFLOW_COMPOSITE_FANOUT_EXCEEDED");
    }
  });

  it("respects custom cap arg", async () => {
    const db = mockDbWithCount(11);
    await expect(
      enforceFanoutCap({ db, companyId: "c1", rootRunId: "r1", cap: 10 }),
    ).rejects.toThrow(/cap 10/);
  });
});

// ─── fetchSucceededArtifactsRecursive ──────────────────────────────────────

describe("fetchSucceededArtifactsRecursive", () => {
  const COMPANY = "00000000-0000-0000-0000-000000000c01";

  /**
   * Build a chainable Drizzle stub that returns step rows in FIFO order
   * for the step-execution BFS and always reports same-company for the
   * child-run tenant verification probe (so descent proceeds).
   * The "different tenant" path is exercised separately below.
   */
  function mockDbSimple(rowSets: Array<Array<Record<string, unknown>>>): Db {
    const queue = [...rowSets];
    const select = vi.fn((cols?: Record<string, unknown>) => {
      const isChildProbe =
        cols !== undefined &&
        Object.keys(cols).length === 1 &&
        Object.prototype.hasOwnProperty.call(cols, "companyId");
      const chain = {
        from: () => chain,
        where: () => {
          if (isChildProbe) {
            // Tenant probe: always return same-company so descent proceeds.
            return Promise.resolve([{ companyId: COMPANY }]);
          }
          return Promise.resolve(queue.shift() ?? []);
        },
      };
      return chain;
    });
    return { select } as unknown as Db;
  }

  it("returns the root run's succeeded artifacts when no composite children", async () => {
    const db = mockDbSimple([
      [
        { stepId: "s1", artifacts: { outputs: [{ name: "a" }] }, compositeRunId: null },
        { stepId: "s2", artifacts: { outputs: [{ name: "b" }] }, compositeRunId: null },
      ],
    ]);
    const out = await fetchSucceededArtifactsRecursive(db, "r1", COMPANY);
    expect(Object.keys(out).sort()).toEqual(["s1", "s2"]);
  });

  it("descends into composite sub-runs via compositeRunId", async () => {
    const db = mockDbSimple([
      // r1
      [{ stepId: "design", artifacts: { outputs: [{ name: "spec" }] }, compositeRunId: "r2" }],
      // r2 (descended into)
      [{ stepId: "leaf-step", artifacts: { outputs: [{ name: "x" }] }, compositeRunId: null }],
    ]);
    const out = await fetchSucceededArtifactsRecursive(db, "r1", COMPANY);
    expect(out["design"]).toBeDefined();
    expect(out["leaf-step"]).toBeDefined();
  });

  it("guards against revisiting the same runId (prevents infinite loops)", async () => {
    const db = mockDbSimple([
      // r1
      [{ stepId: "s1", artifacts: { outputs: [] }, compositeRunId: "r2" }],
      // r2 (back-pointer to r1, must not re-fetch)
      [{ stepId: "s2", artifacts: { outputs: [] }, compositeRunId: "r1" }],
    ]);
    // Should terminate — no throw, no hang.
    const out = await fetchSucceededArtifactsRecursive(db, "r1", COMPANY);
    expect(Object.keys(out).sort()).toEqual(["s1", "s2"]);
  });

  it("does not descend into a child run from another tenant (defense in depth)", async () => {
    // The step row points to compositeRunId 'r-other' which lives in a
    // DIFFERENT company. The BFS must NOT descend into it — so the second
    // step ("leaf-step") never appears in the output.
    let stepCalls = 0;
    let childCalls = 0;
    const select = vi.fn((cols?: Record<string, unknown>) => {
      const isChildProbe =
        cols !== undefined &&
        Object.keys(cols).length === 1 &&
        Object.prototype.hasOwnProperty.call(cols, "companyId");
      const chain = {
        from: () => chain,
        where: () => {
          if (isChildProbe) {
            childCalls += 1;
            // Foreign tenant — caller MUST NOT enqueue 'r-other'.
            return Promise.resolve([
              { companyId: "00000000-0000-0000-0000-0000000other" },
            ]);
          }
          stepCalls += 1;
          if (stepCalls === 1) {
            return Promise.resolve([
              { stepId: "design", artifacts: { x: 1 }, compositeRunId: "r-other" },
            ]);
          }
          // BFS should never hit this branch — assert via expect below.
          return Promise.resolve([
            { stepId: "leaf-step", artifacts: { y: 2 }, compositeRunId: null },
          ]);
        },
      };
      return chain;
    });
    const db = { select } as unknown as Db;
    const out = await fetchSucceededArtifactsRecursive(db, "r1", COMPANY);
    expect(out["design"]).toBeDefined();
    expect(out["leaf-step"]).toBeUndefined();
    expect(stepCalls).toBe(1);
    expect(childCalls).toBe(1);
  });
});

// ─── launchCompositeStep (failure paths via mocked db) ─────────────────────

describe("launchCompositeStep — input/safety paths", () => {
  function mockDb(opts: {
    parentRow: { id: string; runId: string; rootRunId: string | null; companyId: string } | null;
    fanoutCount?: number;
  }): Db {
    const row = opts.parentRow;
    const select = vi.fn(() => {
      const chain = {
        from: () => chain,
        where: () => Promise.resolve(row ? [row] : []),
      };
      return chain;
    });
    // Outer execute should not be hit after the SEC P4 fix moved fanout
    // accounting inside the transaction, but keep the mock for safety.
    const execute = vi.fn().mockResolvedValue([{ n: opts.fanoutCount ?? 0 }]);
    // Tx mock now needs `execute` because enforceFanoutCap + the new
    // advisory lock both run via tx.execute.
    const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        execute: vi.fn().mockResolvedValue([{ n: opts.fanoutCount ?? 0 }]),
      };
      return fn(tx);
    });
    return { select, execute, transaction } as unknown as Db;
  }

  it("throws WORKFLOW_STEP_NOT_FOUND when parent row is missing", async () => {
    const db = mockDb({ parentRow: null });
    await expect(
      launchCompositeStep(db, {
        parentStepExecutionId: "missing",
        parentRunId: "r1",
        subWorkflow: wf("sub", [{ id: "leaf", agent: "claude_code" }]),
        subWorkflowGitTag: "v1",
        subWorkflowGitSha: "deadbeef",
        subWorkflowDefId: "def-1",
        params: {},
        actor: { type: "user", id: "u1" },
        companyId: "c1",
      }),
    ).rejects.toThrow(/composite parent step/);
  });

  it("throws WORKFLOW_COMPOSITE_FANOUT_EXCEEDED at the cap", async () => {
    const db = mockDb({
      parentRow: { id: "p1", runId: "r1", rootRunId: null, companyId: "c1" },
      fanoutCount: COMPOSITE_FANOUT_CAP,
    });
    await expect(
      launchCompositeStep(db, {
        parentStepExecutionId: "p1",
        parentRunId: "r1",
        subWorkflow: wf("sub", [{ id: "leaf", agent: "claude_code" }]),
        subWorkflowGitTag: "v1",
        subWorkflowGitSha: "deadbeef",
        subWorkflowDefId: "def-1",
        params: {},
        actor: { type: "user", id: "u1" },
        companyId: "c1",
      }),
    ).rejects.toThrow(/fan-out cap/);
  });
});
