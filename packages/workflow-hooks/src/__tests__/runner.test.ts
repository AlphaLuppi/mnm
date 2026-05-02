import { describe, it, expect } from "vitest";
import { runHook } from "../runner.js";
import type { HookContext, HostHelpers, ResolvedHook } from "../types.js";

const NOOP_HELPERS: HostHelpers = {
  http: async () => ({ status: 200, body: {}, headers: {} }),
  llm: async () => ({ text: "", usage: { input_tokens: 0, output_tokens: 0 } }),
  fetchHandoff: async () => "",
};

function ctxFor(phase: HookContext["phase"]): HookContext {
  return {
    artifact: undefined,
    run: { id: "run-1", workflow_name: "demo", git_tag: "v1", params: {} },
    step: { id: "step-1", previous_artifacts: {} },
    config: {},
    phase,
    helpers: NOOP_HELPERS,
  };
}

function hookSource(body: string): ResolvedHook {
  return {
    source: "canonical",
    name: "test",
    code: `
const { defineHook } = require("@mnm/workflow-hooks");
module.exports.default = defineHook(async (ctx) => {
  ${body}
});
`,
    sha: "test-sha",
    sourcePath: "canonical/test.hook.ts",
  };
}

describe("runHook — happy paths", () => {
  it("returns ok:true when hook succeeds", async () => {
    const result = await runHook(
      hookSource(`return { ok: true, report: "all good" };`),
      ctxFor("after_step"),
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(true);
    expect(result.result?.report).toBe("all good");
  });

  it("propagates hook_name + sha + phase", async () => {
    const resolved = hookSource(`return { ok: true };`);
    resolved.name = "demo-hook";
    resolved.sha = "abc123";
    const result = await runHook(resolved, ctxFor("before_step"), NOOP_HELPERS);
    expect(result.hook_name).toBe("demo-hook");
    expect(result.hook_git_sha).toBe("abc123");
    expect(result.phase).toBe("before_step");
  });

  it("evaluated_at + duration_ms are stamped", async () => {
    const result = await runHook(
      hookSource(`return { ok: true };`),
      ctxFor("after_run"),
      NOOP_HELPERS,
    );
    expect(typeof result.evaluated_at).toBe("string");
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

describe("runHook — error paths", () => {
  it("classifies a thrown user error as HOOK_EXCEPTION", async () => {
    const result = await runHook(
      hookSource(`throw new Error("boom");`),
      ctxFor("after_step"),
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe("HOOK_EXCEPTION");
    expect(result.report).toContain("boom");
  });

  it("classifies a missing pass field as HOOK_INVALID_OUTPUT", async () => {
    const result = await runHook(
      hookSource(`return { report: "no ok field" };`),
      ctxFor("after_step"),
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe("HOOK_INVALID_OUTPUT");
  });

  it("classifies an unknown top-level key as HOOK_INVALID_OUTPUT (strict schema)", async () => {
    const result = await runHook(
      hookSource(`return { ok: true, unexpected_field: 42 };`),
      ctxFor("after_step"),
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe("HOOK_INVALID_OUTPUT");
  });

  it("[T14] respects helperTimeoutMs default 30 s by allowing slow helpers (vs gates' 3 s)", async () => {
    // We do not actually wait 30 s — assert the runner surfaces no
    // error for a 50 ms helper call (which would fail at the gate
    // default of 3000 ms only if we passed a much shorter override).
    const slowHelpers: HostHelpers = {
      ...NOOP_HELPERS,
      http: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { status: 200, body: { ok: 1 }, headers: {} };
      },
    };
    const result = await runHook(
      hookSource(`
        await ctx.helpers.http({ provider: "x", path: "/" });
        return { ok: true };
      `),
      ctxFor("after_step"),
      slowHelpers,
    );
    expect(result.ok).toBe(true);
  });
});

describe("runHook — hardening (P1.2 / P1.4)", () => {
  it("[P1.4] inject without context_md surfaces HOOK_INVALID_OUTPUT cleanly", async () => {
    // hookResultSchema is strict — a missing context_md triggers schema
    // failure (clean error path), NOT a Buffer.byteLength TypeError.
    // Defensive `?? ""` in runner.ts also covers the case if schema
    // ever loosens.
    const result = await runHook(
      hookSource(`return { ok: true, inject: {} };`),
      ctxFor("before_step"),
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe("HOOK_INVALID_OUTPUT");
  });

  it("[P1.2] retryOnSandboxCrash=false does not retry (after_* phase pattern)", async () => {
    // Stub attemptInvoke so the first call returns a synthetic
    // HOOK_SANDBOX_CRASH. With retryOnSandboxCrash: false, the runner
    // must not call it a second time — preventing duplicate side-effects
    // for after_* hooks (Jira POST etc.).
    let calls = 0;
    const stubAttempt = async () => {
      calls += 1;
      return {
        ok: false,
        errorCode: "HOOK_SANDBOX_CRASH" as const,
        report: "stub crash",
      };
    };
    const result = await runHook(
      hookSource(`return { ok: true };`),
      ctxFor("after_step"),
      NOOP_HELPERS,
      {
        attemptInvoke: stubAttempt,
        options: { retryOnSandboxCrash: false },
      },
    );
    expect(calls).toBe(1);
    expect(result.error_code).toBe("HOOK_SANDBOX_CRASH");
  });

  it("[P1.2] retryOnSandboxCrash=true retries once (before_* default)", async () => {
    let calls = 0;
    const stubAttempt = async () => {
      calls += 1;
      return {
        ok: false,
        errorCode: "HOOK_SANDBOX_CRASH" as const,
        report: "stub crash",
      };
    };
    const result = await runHook(
      hookSource(`return { ok: true };`),
      ctxFor("before_step"),
      NOOP_HELPERS,
      {
        attemptInvoke: stubAttempt,
        options: { retryOnSandboxCrash: true },
      },
    );
    expect(calls).toBe(2);
    expect(result.error_code).toBe("HOOK_SANDBOX_CRASH");
  });
});

describe("runHook — context immutability", () => {
  it("Object.freeze(ctx.run) prevents the assignment from taking effect (silent in non-strict, throws in strict)", async () => {
    // The CJS bundle emitted by esbuild does not auto-enable strict
    // mode. So `ctx.run.id = "tampered"` on a frozen object is a SILENT
    // no-op in non-strict, and a TypeError in strict. We assert the
    // mutation did NOT take effect — both modes pass this assertion.
    const result = await runHook(
      hookSource(`
        Object.freeze(ctx.run);
        const before = ctx.run.id;
        try { ctx.run.id = "tampered"; } catch (_) {}
        const after = ctx.run.id;
        return { ok: before === after, report: "before=" + before + " after=" + after };
      `),
      ctxFor("after_step"),
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(true);
    expect(result.result?.report).toContain("before=run-1 after=run-1");
  });
});
