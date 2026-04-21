import { describe, it, expect } from "vitest";
import { GATE_ERROR_CODES, type GateContext } from "@mnm/governed-workflows";
import { runSingleGate } from "../run-single-gate.js";
import { CompiledCache } from "../compiled-cache.js";
import {
  PASSING,
  FAILING,
  THROWING,
  INFINITE_LOOP,
  INVALID_OUTPUT_NON_OBJECT,
  INVALID_OUTPUT_MISSING_PASS,
  EXTRA_KEYS,
  CONFIG_ECHO,
  READS_PREVIOUS_ARTIFACT,
} from "./fixtures/gate-sources.js";

function ctx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    artifact: undefined,
    run: { id: "run-1", workflow_name: "hello-world", git_tag: "v1.0.0", params: {} },
    step: { id: "greet", previous_artifacts: {} },
    config: {},
    kind: "exit",
    helpers: {},
    ...overrides,
  };
}

const BASE = {
  gateItem: { id: "g1", source: "./gates/x.gate.ts" },
  gateSourcePath: "hello-world/gates/x.gate.ts",
  gitSha: "deadbeef",
  kind: "exit",
};

describe("runSingleGate", () => {
  it("returns pass:true when the gate passes", async () => {
    const result = await runSingleGate(
      { ...BASE, source: PASSING, context: ctx({ artifact: { greeting: "Hi" } }) },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.report).toBe("ok: Hi");
    expect(result.error_code).toBeUndefined();
    expect(result.gate_id_in_json).toBe("g1");
    expect(result.gate_source_path).toBe("hello-world/gates/x.gate.ts");
    expect(result.gate_git_sha).toBe("deadbeef");
    expect(result.kind).toBe("exit");
    expect(typeof result.evaluated_at).toBe("string");
    expect(typeof result.duration_ms).toBe("number");
  });

  it("returns pass:false with the gate-authored report + hints on deterministic failure", async () => {
    const result = await runSingleGate(
      { ...BASE, source: FAILING, context: ctx() },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.report).toBe("always fail");
    expect(result.error_code).toBe("ALWAYS_FAIL");
    expect(result.hints).toEqual(["try something else"]);
  });

  it("maps thrown errors to GATE_EXCEPTION", async () => {
    const result = await runSingleGate(
      { ...BASE, source: THROWING, context: ctx() },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe(GATE_ERROR_CODES.GATE_EXCEPTION);
    expect(result.report).toContain("boom from user gate");
  });

  it("maps infinite loops to GATE_TIMEOUT via timeoutMs", async () => {
    const result = await runSingleGate(
      { ...BASE, source: INFINITE_LOOP, context: ctx() },
      { compiledCache: new CompiledCache(), options: { timeoutMs: 300 } },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe(GATE_ERROR_CODES.GATE_TIMEOUT);
    expect(result.duration_ms).toBeGreaterThanOrEqual(300);
  }, 10000);

  it("maps non-object returns to GATE_INVALID_OUTPUT", async () => {
    const result = await runSingleGate(
      { ...BASE, source: INVALID_OUTPUT_NON_OBJECT, context: ctx() },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe(GATE_ERROR_CODES.GATE_INVALID_OUTPUT);
  });

  it("maps missing required fields to GATE_INVALID_OUTPUT", async () => {
    const result = await runSingleGate(
      { ...BASE, source: INVALID_OUTPUT_MISSING_PASS, context: ctx() },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe(GATE_ERROR_CODES.GATE_INVALID_OUTPUT);
  });

  it("maps extra keys to GATE_INVALID_OUTPUT (strict schema)", async () => {
    const result = await runSingleGate(
      { ...BASE, source: EXTRA_KEYS, context: ctx() },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe(GATE_ERROR_CODES.GATE_INVALID_OUTPUT);
    expect(result.report).toMatch(/debug_note|unrecognized/i);
  });

  it("forwards gateItem.config into ctx.config inside the isolate", async () => {
    const result = await runSingleGate(
      {
        ...BASE,
        source: CONFIG_ECHO,
        gateItem: { id: "g1", source: "./gates/x.gate.ts", config: { field: "greeting" } },
        context: ctx({ config: { field: "greeting" } }),
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.report).toBe("field=greeting,kind=exit");
  });

  it("exposes previous_artifacts to the gate", async () => {
    const result = await runSingleGate(
      {
        ...BASE,
        source: READS_PREVIOUS_ARTIFACT,
        context: ctx({
          step: { id: "shout", previous_artifacts: { greet: { greeting: "Hello, Tom!" } } },
        }),
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.report).toBe("previous greeting: Hello, Tom!");
  });

  it("reuses the compiled cache on the second invocation", async () => {
    const cache = new CompiledCache();
    await runSingleGate(
      { ...BASE, source: PASSING, context: ctx({ artifact: { greeting: "A" } }) },
      { compiledCache: cache },
    );
    expect(cache.size()).toBe(1);
    await runSingleGate(
      { ...BASE, source: PASSING, context: ctx({ artifact: { greeting: "B" } }) },
      { compiledCache: cache },
    );
    expect(cache.size()).toBe(1);
  });

  it("always stamps evaluated_at as a valid ISO-8601 timestamp", async () => {
    const result = await runSingleGate(
      { ...BASE, source: PASSING, context: ctx({ artifact: { greeting: "X" } }) },
      { compiledCache: new CompiledCache() },
    );
    expect(() => new Date(result.evaluated_at).toISOString()).not.toThrow();
  });
});
