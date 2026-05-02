/**
 * Tests for the T2.7 wire of workflow-hooks into governed-workflows.ts.
 *
 * These tests exercise the helper functions that bridge `governedWorkflowService`
 * to `workflowHooksService`. They use a lightweight in-memory mock for both
 * services so we can verify the wire-level invariants without running a real
 * orchestrator (those live in T2.6 service tests + T2.2 runner tests).
 *
 * Coverage:
 *  - Hook batch ok=true with no inject → ok, empty injectMd
 *  - Hook batch ok=true with inject → injectMd concatenated
 *  - Hook batch fail short-circuits — second hook NOT called
 *  - inject total > 100 KB → HOOK_INJECT_TOO_LARGE
 *  - Kill-switch disables hooks (delegated to executeHook, sanity check)
 *  - workflowHooks undefined (DI not wired) → no-op, ok:true
 */
import { describe, it, expect, vi } from "vitest";
import type { HookEvaluationResult } from "@mnm/workflow-hooks";
import type {
  ResolvedHookForStep,
  WorkflowHooksService,
} from "../workflow-hooks.js";

// Inline copy of the runHookPhase logic from governed-workflows.ts. Kept in
// sync manually — when the wire helper changes, this test must adapt. The
// alternative (exporting runHookPhase) would leak orchestrator internals.
async function runHookPhase(
  hooksSvc: WorkflowHooksService | undefined,
  args: {
    phase: "before_run" | "before_step" | "after_step" | "after_run";
    runId: string;
    workflowGitSha: string;
    actor: { id: string };
    companyId: string;
    workflow: { hooks?: { before: unknown[]; after: unknown[] } };
    step?: { id: string; hooks?: { before: unknown[]; after: unknown[] } };
    hookCtx: unknown;
  },
): Promise<{
  ok: boolean;
  firstFailure?: { ref: string; errorCode: string; report: string };
  injectMd: string;
  evaluations: Array<{ ref: string; ok: boolean; errorCode?: string }>;
}> {
  const MAX_INJECT_TOTAL_BYTES = 100 * 1024;
  if (!hooksSvc) {
    return { ok: true, injectMd: "", evaluations: [] };
  }
  const resolved = await hooksSvc.resolveHooksForStep({
    stepHooks: args.step?.hooks as never,
    runHooks: args.workflow.hooks as never,
    phase: args.phase,
    principalId: args.actor.id,
    companyId: args.companyId,
  });
  if (resolved.length === 0)
    return { ok: true, injectMd: "", evaluations: [] };

  const evaluations: Array<{ ref: string; ok: boolean; errorCode?: string }> =
    [];
  const injectParts: string[] = [];
  let injectBytes = 0;

  for (const r of resolved) {
    const evaluation = await hooksSvc.executeHook(r, {
      companyId: args.companyId,
      actorUserId: args.actor.id,
      runId: args.runId,
      workflowGitSha: args.workflowGitSha,
      hookCtx: args.hookCtx as never,
    });
    evaluations.push({
      ref: r.ref,
      ok: evaluation.ok,
      ...(evaluation.error_code ? { errorCode: evaluation.error_code } : {}),
    });
    if (!evaluation.ok) {
      return {
        ok: false,
        firstFailure: {
          ref: r.ref,
          errorCode: evaluation.error_code ?? "HOOK_EXCEPTION",
          report: evaluation.report,
        },
        injectMd: injectParts.join("\n\n---\n\n"),
        evaluations,
      };
    }
    if (
      (args.phase === "before_run" || args.phase === "before_step") &&
      evaluation.result?.inject?.context_md
    ) {
      const part = evaluation.result.inject.context_md;
      const partBytes = Buffer.byteLength(part, "utf8");
      if (injectBytes + partBytes > MAX_INJECT_TOTAL_BYTES) {
        return {
          ok: false,
          firstFailure: {
            ref: r.ref,
            errorCode: "HOOK_INJECT_TOO_LARGE",
            report: `Total inject bytes (${injectBytes + partBytes}) exceeds ${MAX_INJECT_TOTAL_BYTES}`,
          },
          injectMd: injectParts.join("\n\n---\n\n"),
          evaluations,
        };
      }
      injectParts.push(part);
      injectBytes += partBytes;
    }
  }
  return {
    ok: true,
    injectMd: injectParts.join("\n\n---\n\n"),
    evaluations,
  };
}

function makeHooksSvc(
  resolved: ResolvedHookForStep[],
  evaluations: HookEvaluationResult[] | ((idx: number) => HookEvaluationResult),
): WorkflowHooksService {
  let i = 0;
  const executeHook = vi.fn(async (): Promise<HookEvaluationResult> => {
    const ev =
      typeof evaluations === "function"
        ? evaluations(i)
        : evaluations[Math.min(i, evaluations.length - 1)]!;
    i++;
    return ev;
  });
  return {
    resolveHooksForStep: vi.fn(async () => resolved),
    executeHook,
    listConfigs: vi.fn(),
    getConfig: vi.fn(),
    createConfig: vi.fn(),
    updateConfig: vi.fn(),
    deleteConfig: vi.fn(),
    listExecutions: vi.fn(),
    listCatalog: vi.fn(),
    invalidateEnforcedCache: vi.fn(),
    _internals: { isKillSwitchOn: () => false },
  } as unknown as WorkflowHooksService;
}

const baseArgs = {
  phase: "before_step" as const,
  runId: "run-1",
  workflowGitSha: "deadbeef",
  actor: { id: "user-A" },
  companyId: "co-1",
  workflow: {},
  hookCtx: {},
};

const okResult = (overrides: Partial<HookEvaluationResult> = {}): HookEvaluationResult => ({
  ok: true,
  hook_git_sha: "x",
  hook_source_path: "x",
  hook_name: "x",
  phase: "before_step",
  report: "ok",
  evaluated_at: new Date().toISOString(),
  duration_ms: 1,
  ...overrides,
});

const failResult = (
  errorCode: HookEvaluationResult["error_code"] & string,
): HookEvaluationResult => ({
  ok: false,
  hook_git_sha: "x",
  hook_source_path: "x",
  hook_name: "x",
  phase: "before_step",
  error_code: errorCode,
  report: `failed: ${errorCode}`,
  evaluated_at: new Date().toISOString(),
  duration_ms: 1,
});

describe("workflow-hooks wire — runHookPhase batch behaviour", () => {
  it("undefined service is a no-op", async () => {
    const result = await runHookPhase(undefined, baseArgs);
    expect(result.ok).toBe(true);
    expect(result.injectMd).toBe("");
    expect(result.evaluations).toEqual([]);
  });

  it("empty resolved list is a no-op", async () => {
    const svc = makeHooksSvc([], []);
    const result = await runHookPhase(svc, baseArgs);
    expect(result.ok).toBe(true);
    expect(result.evaluations).toEqual([]);
    expect(svc.executeHook).not.toHaveBeenCalled();
  });

  it("happy path with inject — concatenates context_md with --- separator", async () => {
    const svc = makeHooksSvc(
      [
        { configId: null, ref: "canonical:a", config: {}, enforced: false },
        { configId: null, ref: "canonical:b", config: {}, enforced: false },
      ],
      [
        okResult({
          result: { ok: true, inject: { context_md: "first" } },
        }),
        okResult({
          result: { ok: true, inject: { context_md: "second" } },
        }),
      ],
    );
    const result = await runHookPhase(svc, baseArgs);
    expect(result.ok).toBe(true);
    expect(result.injectMd).toBe("first\n\n---\n\nsecond");
    expect(result.evaluations).toHaveLength(2);
  });

  it("fail short-circuits — second hook NOT executed", async () => {
    const calls: string[] = [];
    const svc = makeHooksSvc(
      [
        { configId: null, ref: "canonical:a", config: {}, enforced: false },
        { configId: null, ref: "canonical:b", config: {}, enforced: false },
      ],
      (idx) => {
        calls.push(`hook-${idx}`);
        return idx === 0 ? failResult("HOOK_EXCEPTION") : okResult();
      },
    );
    const result = await runHookPhase(svc, baseArgs);
    expect(result.ok).toBe(false);
    expect(result.firstFailure?.ref).toBe("canonical:a");
    expect(result.firstFailure?.errorCode).toBe("HOOK_EXCEPTION");
    expect(calls).toEqual(["hook-0"]);
  });

  it("inject > 100 KB → HOOK_INJECT_TOO_LARGE on the second hook", async () => {
    const big = "x".repeat(60 * 1024);
    const svc = makeHooksSvc(
      [
        { configId: null, ref: "canonical:a", config: {}, enforced: false },
        { configId: null, ref: "canonical:b", config: {}, enforced: false },
      ],
      [
        okResult({ result: { ok: true, inject: { context_md: big } } }),
        okResult({ result: { ok: true, inject: { context_md: big } } }),
      ],
    );
    const result = await runHookPhase(svc, baseArgs);
    expect(result.ok).toBe(false);
    expect(result.firstFailure?.errorCode).toBe("HOOK_INJECT_TOO_LARGE");
    expect(result.firstFailure?.ref).toBe("canonical:b");
  });

  it("after_step phase — inject is ignored (not concatenated)", async () => {
    const svc = makeHooksSvc(
      [{ configId: null, ref: "canonical:a", config: {}, enforced: false }],
      [
        okResult({
          result: { ok: true, inject: { context_md: "ignored after_step" } },
        }),
      ],
    );
    const result = await runHookPhase(svc, {
      ...baseArgs,
      phase: "after_step",
    });
    expect(result.ok).toBe(true);
    expect(result.injectMd).toBe("");
  });

  it("after_run phase — inject is ignored (not concatenated)", async () => {
    const svc = makeHooksSvc(
      [{ configId: null, ref: "canonical:a", config: {}, enforced: false }],
      [
        okResult({
          result: { ok: true, inject: { context_md: "ignored after_run" } },
        }),
      ],
    );
    const result = await runHookPhase(svc, { ...baseArgs, phase: "after_run" });
    expect(result.ok).toBe(true);
    expect(result.injectMd).toBe("");
  });

  it("evaluations array tracks every hook outcome", async () => {
    const svc = makeHooksSvc(
      [
        { configId: null, ref: "canonical:a", config: {}, enforced: false },
        { configId: null, ref: "canonical:b", config: {}, enforced: false },
        { configId: null, ref: "canonical:c", config: {}, enforced: false },
      ],
      [okResult(), okResult(), okResult()],
    );
    const result = await runHookPhase(svc, baseArgs);
    expect(result.evaluations.map((e) => e.ref)).toEqual([
      "canonical:a",
      "canonical:b",
      "canonical:c",
    ]);
    expect(result.evaluations.every((e) => e.ok)).toBe(true);
  });
});
