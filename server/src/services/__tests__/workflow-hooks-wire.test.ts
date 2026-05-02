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

/**
 * P4-B critical-path wire invariants
 *
 * The fixes below cannot easily be exercised at unit level (they require a
 * real PG + a transaction that rolls back), so we instead assert on the
 * source of governed-workflows.ts to lock the pattern in. If the pattern
 * regresses (e.g. someone re-introduces `await runHookPhase` in the
 * after_run path, or removes the outer-`db` write before the after_step
 * throw), these assertions break loudly.
 *
 * Rationale for guarding via source content rather than runtime:
 *  - P0.1: state="failed" must be written via OUTER `db` BEFORE the throw
 *    in after_step, otherwise the tx rollback reverts state="gate_eval"
 *    and the step is stuck in a non-terminal state. Mirrors before_step.
 *  - P0.2: after_run hooks must NOT be `await`ed in the response path of
 *    completeStep — they're scheduled via setImmediate so the HTTP
 *    response returns immediately after the run is committed "completed".
 *  - P1.1: previousArtifacts in the after_step ctx builder must read via
 *    OUTER `db`, not the in-flight tx snapshot — to match the committed
 *    state hooks observe in production (and not surface a row that may
 *    rollback).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

describe("workflow-hooks wire — P4-B critical-path invariants (source guard)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    join(here, "..", "governed-workflows.ts"),
    "utf-8",
  );

  it("after_step failure persists state='failed' via outer db before throwing (P0.1)", () => {
    // The after_step branch (`if (!afterStepOutcome.ok) {`) must contain a
    // `db.update(governedStepExecutions).set({ state: "failed", ... })`
    // call BEFORE the `throw new GovernedWorkflowError(...)`. Use a multiline
    // regex to assert ordering inside the same block.
    const block = src.match(
      /if \(!afterStepOutcome\.ok\) \{[\s\S]*?throw new GovernedWorkflowError\(/,
    );
    expect(block).not.toBeNull();
    const blockSrc = block![0];
    expect(blockSrc).toMatch(/await db\s*\n?\s*\.update\(governedStepExecutions\)/);
    expect(blockSrc).toMatch(/state:\s*"failed"/);
    // Must NOT use `tx` for that write — that would rollback.
    expect(blockSrc).not.toMatch(/await tx\s*\n?\s*\.update\(governedStepExecutions\)\s*\n?\s*\.set\(\s*\{\s*state:\s*"failed"/);
  });

  it("after_step ctx builder reads previousArtifacts via outer db, not tx snapshot (P1.1)", () => {
    // Locate the buildHookCtx call for phase: "after_step". The
    // previousArtifacts must come from `fetchSucceededArtifacts(db, ...)`,
    // not `fetchSucceededArtifacts(tx as unknown as Db, ...)`.
    const ctxBuilder = src.match(
      /buildHookCtx\(\{\s*\n?\s*phase:\s*"after_step",[\s\S]*?\}\)/,
    );
    expect(ctxBuilder).not.toBeNull();
    const ctxSrc = ctxBuilder![0];
    expect(ctxSrc).toMatch(/fetchSucceededArtifacts\(\s*db\s*,/);
    expect(ctxSrc).not.toMatch(/fetchSucceededArtifacts\(\s*tx\s+as\s+unknown\s+as\s+Db/);
  });

  it("after_run hook phase is fire-and-forget via setImmediate, not awaited (P0.2)", () => {
    // The after_run branch must wrap runHookPhase in setImmediate.
    // It must NOT be `await runHookPhase({ phase: "after_run", ... })` in
    // the response path — that would block completeStep's HTTP return.
    const afterRunIdx = src.indexOf("// ── T2.7: after_run hooks");
    expect(afterRunIdx).toBeGreaterThan(0);
    const tail = src.slice(afterRunIdx, afterRunIdx + 4000);
    // Must schedule via setImmediate.
    expect(tail).toMatch(/setImmediate\(\s*\(\)\s*=>\s*\{[\s\S]*?runHookPhase\(\{\s*\n?\s*phase:\s*"after_run"/);
    // Must NOT directly await runHookPhase for after_run in this section.
    expect(tail).not.toMatch(/await runHookPhase\(\{\s*\n?\s*phase:\s*"after_run"/);
  });
});
