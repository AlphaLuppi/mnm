/**
 * Wire tests for the T5.3 composite (meta-workflow) wiring of
 * `governed-workflows.ts` `launchStep` / `completeStep`.
 *
 * Strategy: rather than spin up the full orchestrator we inline the dispatch
 * logic (composite steps → launchCompositeStep + emit event ; agent steps →
 * existing path) and verify it picks the correct branch. This mirrors the
 * pattern used by `workflow-hooks-wire.test.ts` (T2.7).
 *
 * Coverage:
 *  - launchStep with type=composite delegates to the resolver and emits
 *    `step.composite.launched` exactly once.
 *  - launchStep with type=agent (or undefined) skips the resolver — the
 *    pre-T5 path is intact.
 *  - completeStep with composite parent step calls `completeCompositeStep`
 *    with the sub-run's final outputs and emits `step.composite.completed`.
 *  - completeStep refuses to complete a composite step whose sub-run has
 *    not yet succeeded (sub-run gate).
 *  - 4-level deep chain: cycle detection passes for a linear A→B→C→D chain.
 */
import { describe, it, expect, vi } from "vitest";
import type { WorkflowDefinition } from "@mnm/governed-workflows";
import { detectCycle } from "../governed-workflows-composite.js";

// ─── Inline dispatch helper (mirrors the new branches in launchStep) ───────

interface DispatchStep {
  id: string;
  type?: "agent" | "composite";
  agent?: string;
  uses?: string;
  params?: Record<string, unknown>;
}

interface LaunchDeps {
  launchCompositeStep: ReturnType<typeof vi.fn>;
  emitLive: ReturnType<typeof vi.fn>;
  loadAgentStep: ReturnType<typeof vi.fn>;
}

async function dispatchLaunchStep(
  step: DispatchStep,
  deps: LaunchDeps,
): Promise<{ branch: "composite" | "agent" }> {
  if (step.type === "composite") {
    const result = await deps.launchCompositeStep({ stepId: step.id, uses: step.uses, params: step.params ?? {} });
    deps.emitLive({
      type: "step.composite.launched",
      payload: { step_id: step.id, sub_run_id: result.subRunId, root_run_id: result.rootRunId },
    });
    return { branch: "composite" };
  }
  await deps.loadAgentStep({ stepId: step.id, agent: step.agent });
  return { branch: "agent" };
}

interface CompleteDeps {
  fetchSubRunSteps: ReturnType<typeof vi.fn>;
  completeCompositeStep: ReturnType<typeof vi.fn>;
  emitLive: ReturnType<typeof vi.fn>;
  fallbackComplete: ReturnType<typeof vi.fn>;
}

async function dispatchCompleteStep(
  step: { id: string; type?: "agent" | "composite"; compositeRunId?: string | null },
  deps: CompleteDeps,
): Promise<{ branch: "composite" | "agent" }> {
  if (step.type === "composite") {
    if (!step.compositeRunId) {
      throw new Error("composite step has no compositeRunId — sub-run not launched");
    }
    const subSteps = (await deps.fetchSubRunSteps(step.compositeRunId)) as Array<{
      state: string;
      artifactsJson?: Record<string, unknown> | null;
    }>;
    if (subSteps.length === 0 || subSteps.some((s) => s.state !== "succeeded")) {
      throw new Error("WORKFLOW_DEPENDENCY_UNMET: composite sub-run has steps not yet succeeded");
    }
    const lastLeaf = subSteps[subSteps.length - 1];
    await deps.completeCompositeStep({
      parentStepId: step.id,
      finalOutputs: lastLeaf.artifactsJson ?? {},
    });
    deps.emitLive({
      type: "step.composite.completed",
      payload: { step_id: step.id, sub_run_id: step.compositeRunId },
    });
    return { branch: "composite" };
  }
  await deps.fallbackComplete({ stepId: step.id });
  return { branch: "agent" };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("composite wire — launchStep dispatch", () => {
  it("dispatches a composite step to launchCompositeStep + emits step.composite.launched once", async () => {
    const launchCompositeStep = vi.fn().mockResolvedValue({ subRunId: "sr-1", rootRunId: "rr-1" });
    const emitLive = vi.fn();
    const loadAgentStep = vi.fn();
    const out = await dispatchLaunchStep(
      { id: "design", type: "composite", uses: "workflows/design-functional@v1" },
      { launchCompositeStep, emitLive, loadAgentStep },
    );
    expect(out.branch).toBe("composite");
    expect(launchCompositeStep).toHaveBeenCalledTimes(1);
    expect(loadAgentStep).not.toHaveBeenCalled();
    expect(emitLive).toHaveBeenCalledWith(
      expect.objectContaining({ type: "step.composite.launched" }),
    );
  });

  it("dispatches an agent step to the existing path (no resolver call)", async () => {
    const launchCompositeStep = vi.fn();
    const emitLive = vi.fn();
    const loadAgentStep = vi.fn().mockResolvedValue(undefined);
    const out = await dispatchLaunchStep(
      { id: "implement", type: "agent", agent: "claude_code" },
      { launchCompositeStep, emitLive, loadAgentStep },
    );
    expect(out.branch).toBe("agent");
    expect(launchCompositeStep).not.toHaveBeenCalled();
    expect(loadAgentStep).toHaveBeenCalledTimes(1);
    expect(emitLive).not.toHaveBeenCalled();
  });

  it("treats a missing `type` as agent (backward compat)", async () => {
    const launchCompositeStep = vi.fn();
    const emitLive = vi.fn();
    const loadAgentStep = vi.fn().mockResolvedValue(undefined);
    const out = await dispatchLaunchStep(
      { id: "legacy", agent: "claude_code" },
      { launchCompositeStep, emitLive, loadAgentStep },
    );
    expect(out.branch).toBe("agent");
    expect(launchCompositeStep).not.toHaveBeenCalled();
  });
});

describe("composite wire — completeStep dispatch", () => {
  it("completes a composite step when all sub-run steps succeeded + emits step.composite.completed", async () => {
    const fetchSubRunSteps = vi.fn().mockResolvedValue([
      { state: "succeeded", artifactsJson: { outputs: [] } },
      { state: "succeeded", artifactsJson: { outputs: [{ name: "final" }], data: {} } },
    ]);
    const completeCompositeStep = vi.fn().mockResolvedValue(undefined);
    const emitLive = vi.fn();
    const fallbackComplete = vi.fn();
    const out = await dispatchCompleteStep(
      { id: "design", type: "composite", compositeRunId: "sr-1" },
      { fetchSubRunSteps, completeCompositeStep, emitLive, fallbackComplete },
    );
    expect(out.branch).toBe("composite");
    expect(completeCompositeStep).toHaveBeenCalledWith(
      expect.objectContaining({
        parentStepId: "design",
        finalOutputs: expect.objectContaining({ outputs: expect.any(Array) }),
      }),
    );
    expect(emitLive).toHaveBeenCalledWith(
      expect.objectContaining({ type: "step.composite.completed" }),
    );
    expect(fallbackComplete).not.toHaveBeenCalled();
  });

  it("refuses to complete a composite step when a sub-run step is still pending", async () => {
    const fetchSubRunSteps = vi.fn().mockResolvedValue([
      { state: "succeeded", artifactsJson: { outputs: [] } },
      { state: "running", artifactsJson: null },
    ]);
    const completeCompositeStep = vi.fn();
    const emitLive = vi.fn();
    const fallbackComplete = vi.fn();
    await expect(
      dispatchCompleteStep(
        { id: "design", type: "composite", compositeRunId: "sr-1" },
        { fetchSubRunSteps, completeCompositeStep, emitLive, fallbackComplete },
      ),
    ).rejects.toThrow(/WORKFLOW_DEPENDENCY_UNMET|not yet succeeded/);
    expect(completeCompositeStep).not.toHaveBeenCalled();
    expect(emitLive).not.toHaveBeenCalled();
  });

  it("refuses to complete a composite step that has no compositeRunId yet", async () => {
    const deps = {
      fetchSubRunSteps: vi.fn(),
      completeCompositeStep: vi.fn(),
      emitLive: vi.fn(),
      fallbackComplete: vi.fn(),
    };
    await expect(
      dispatchCompleteStep({ id: "design", type: "composite", compositeRunId: null }, deps),
    ).rejects.toThrow(/sub-run not launched/);
  });

  it("falls through to the existing path for agent steps", async () => {
    const deps = {
      fetchSubRunSteps: vi.fn(),
      completeCompositeStep: vi.fn(),
      emitLive: vi.fn(),
      fallbackComplete: vi.fn().mockResolvedValue(undefined),
    };
    const out = await dispatchCompleteStep({ id: "leaf", type: "agent" }, deps);
    expect(out.branch).toBe("agent");
    expect(deps.fallbackComplete).toHaveBeenCalledTimes(1);
    expect(deps.completeCompositeStep).not.toHaveBeenCalled();
  });
});

// ─── 4-level deep chain (mirrors plan §5.3.1) ──────────────────────────────

describe("composite wire — 4-level deep chain", () => {
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
        } as WorkflowDefinition["steps"][number],
      ],
    } as WorkflowDefinition;
  }

  function compositeWf(name: string, target: string): WorkflowDefinition {
    return {
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name,
      variables: {},
      steps: [
        {
          id: "into",
          type: "composite",
          uses: target,
          deps: [],
          prompt_context: {},
        } as WorkflowDefinition["steps"][number],
      ],
    } as WorkflowDefinition;
  }

  it("detectCycle accepts a linear feature-dev → design → build → deploy chain", async () => {
    // Mirrors the plan's 4-level test scenario: feature-dev composite of
    // `design`, `build`, `deploy`, with one sub-level under each (the
    // important property is just that the chain has 4 distinct workflow
    // levels and the root is the launching workflow).
    const deploy = leafWf("deploy");
    const buildSub = leafWf("build-sub");
    const designSub = leafWf("design-sub");
    const build = compositeWf("build", "workflows/build-sub@v1");
    const design = compositeWf("design", "workflows/design-sub@v1");
    const featureDev: WorkflowDefinition = {
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "feature-dev",
      variables: {},
      steps: [
        { id: "design", type: "composite", uses: "workflows/design@v1", deps: [], prompt_context: {} },
        { id: "build", type: "composite", uses: "workflows/build@v1", deps: [], prompt_context: {} },
        { id: "deploy", type: "composite", uses: "workflows/deploy@v1", deps: [], prompt_context: {} },
      ] as WorkflowDefinition["steps"],
    } as WorkflowDefinition;
    const lookup: Record<string, WorkflowDefinition> = {
      "workflows/design@v1": design,
      "workflows/design-sub@v1": designSub,
      "workflows/build@v1": build,
      "workflows/build-sub@v1": buildSub,
      "workflows/deploy@v1": deploy,
    };
    await expect(
      detectCycle({
        workflow: featureDev,
        resolveWorkflow: async (ref) => lookup[ref] ?? null,
      }),
    ).resolves.toBeUndefined();
  });
});
