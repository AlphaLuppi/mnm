import { describe, it, expect } from "vitest";
import { runHook } from "../runner.js";
import type { HookContext, HostHelpers, ResolvedHook } from "../types.js";

const NOOP_HELPERS: HostHelpers = {
  http: async () => ({ status: 200, body: {}, headers: {} }),
  llm: async () => ({ text: "", usage: { input_tokens: 0, output_tokens: 0 } }),
  fetchHandoff: async () => "",
};

const CTX: HookContext = {
  artifact: undefined,
  run: { id: "r", workflow_name: "w", git_tag: "v1", params: {} },
  step: { id: "s", previous_artifacts: {} },
  config: {},
  phase: "after_step",
  helpers: NOOP_HELPERS,
};

function hookSource(body: string): ResolvedHook {
  return {
    source: "canonical",
    name: "iso",
    code: `
const { defineHook } = require("@mnm/workflow-hooks");
module.exports.default = defineHook(async (ctx) => {
  ${body}
});
`,
    sha: "test-sha",
    sourcePath: "canonical/iso.hook.ts",
  };
}

describe("isolation — sandbox boundary [security tests 8/9/10/11]", () => {
  it("[T11a] require('fs') is blocked", async () => {
    const result = await runHook(
      hookSource(`
        try {
          require("fs");
          return { ok: false, report: "fs require succeeded" };
        } catch (err) {
          return { ok: true, report: "fs blocked: " + err.message };
        }
      `),
      CTX,
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(true);
    expect(result.result?.report).toContain("not available in hook sandbox");
  });

  it("[T11b] require('http') is blocked", async () => {
    const result = await runHook(
      hookSource(`
        try {
          require("http");
          return { ok: false, report: "http require succeeded" };
        } catch (err) {
          return { ok: true, report: "http blocked: " + err.message };
        }
      `),
      CTX,
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(true);
    expect(result.result?.report).toContain("not available in hook sandbox");
  });

  it("[T11c] process is undefined inside the isolate", async () => {
    const result = await runHook(
      hookSource(`
        const hasProcess = typeof process !== "undefined";
        return { ok: !hasProcess, report: "hasProcess=" + hasProcess };
      `),
      CTX,
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(true);
    expect(result.result?.report).toBe("hasProcess=false");
  });

  it("[T8] __proto__ pollution does not leak to host", async () => {
    // Hook returns an object with a polluted __proto__. The runner uses
    // freezeDeep + JSON.stringify round-trip on the way back so the
    // host never receives the __proto__ chain. Here we just assert the
    // pollution does not change Object.prototype on the host side.
    const before = (Object.prototype as { polluted?: boolean }).polluted;
    expect(before).toBeUndefined();
    const result = await runHook(
      hookSource(`
        return JSON.parse('{"ok": true, "data": {"__proto__": {"polluted": true}}, "report": "tried pollution"}');
      `),
      CTX,
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(true);
    const after = (Object.prototype as { polluted?: boolean }).polluted;
    expect(after).toBeUndefined();
  });

  it("[T9] __mnm_call_helper recursion is blocked (helper name forbidden in HookResult)", async () => {
    // The hook tries to inject a __mnm_call_helper-like field into the
    // result. Schema rejects unknown top-level keys, so this surfaces
    // as HOOK_INVALID_OUTPUT (no recursion possible).
    const result = await runHook(
      hookSource(`
        return { ok: true, __mnm_call_helper: ["http", []] };
      `),
      CTX,
      NOOP_HELPERS,
    );
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe("HOOK_INVALID_OUTPUT");
  });

  it("[T10] memory limit kills isolate on huge allocation", async () => {
    // Allocate a string of 256 MiB (over the default memoryLimit). The
    // isolate should be disposed and surface HOOK_SANDBOX_CRASH (with
    // a single retry that also crashes — fail-closed).
    // We pass a tighter memoryLimitMb to make the test fast and
    // deterministic.
    const result = await runHook(
      hookSource(`
        const huge = new Array(50 * 1024 * 1024).fill("x").join("");
        return { ok: true, report: "len=" + huge.length };
      `),
      CTX,
      NOOP_HELPERS,
      { options: { memoryLimitMb: 16, retryOnSandboxCrash: false } },
    );
    expect(result.ok).toBe(false);
    // Could be HOOK_SANDBOX_CRASH or HOOK_EXCEPTION depending on which
    // limit fires first — we assert it's at least one of the failure
    // codes (NOT a successful return).
    expect([
      "HOOK_SANDBOX_CRASH",
      "HOOK_EXCEPTION",
    ]).toContain(result.error_code);
  }, 15_000);

  it("[T17] inject > maxInjectBytes is rejected with HOOK_INJECT_TOO_LARGE", async () => {
    const result = await runHook(
      hookSource(`
        const big = "x".repeat(200);
        return { ok: true, inject: { context_md: big } };
      `),
      CTX,
      NOOP_HELPERS,
      { options: { maxInjectBytes: 100 } },
    );
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe("HOOK_INJECT_TOO_LARGE");
  });
});
