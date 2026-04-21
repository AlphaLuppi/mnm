import { describe, it, expect } from "vitest";
import type { GateBlock, GateContext } from "@mnm/governed-workflows";
import { runGateBlock } from "../run-gate-block.js";
import { runSingleGate } from "../run-single-gate.js";
import { CompiledCache } from "../compiled-cache.js";

/**
 * Gate source written exactly as a real .gate.ts in a workflow repo would
 * be — import from the bare specifier, use GateContext types at author time,
 * return the gateOutputSchema-compatible shape.
 */
const HAS_FIELD_GATE = `
import { defineGate } from "@mnm/governed-workflows";
import type { GateContext } from "@mnm/governed-workflows";

export default defineGate<
  Record<string, unknown>,
  { field: string; type: "string" | "number" }
>(async (ctx: GateContext<Record<string, unknown>, { field: string; type: "string" | "number" }>) => {
  const artifact = ctx.artifact;
  if (!artifact || typeof artifact !== "object") {
    return { pass: false, report: "artifact missing", error_code: "NO_ARTIFACT" };
  }
  const value = (artifact as Record<string, unknown>)[ctx.config.field];
  if (ctx.config.type === "string" && typeof value !== "string") {
    return {
      pass: false,
      report: "field " + ctx.config.field + " is not a string",
      error_code: "FIELD_TYPE_MISMATCH",
      hints: ["Return " + ctx.config.field + " as a string"],
    };
  }
  if (ctx.config.type === "number" && typeof value !== "number") {
    return {
      pass: false,
      report: "field " + ctx.config.field + " is not a number",
      error_code: "FIELD_TYPE_MISMATCH",
    };
  }
  return { pass: true, report: "field " + ctx.config.field + " ok" };
});
`;

function baseCtx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    artifact: undefined,
    run: { id: "run-1", workflow_name: "hello-world", git_tag: "v1.0.0", params: { name: "Tom" } },
    step: { id: "greet", previous_artifacts: {} },
    config: {},
    kind: "exit",
    helpers: {},
    ...overrides,
  };
}

describe("gate-runner integration", () => {
  it("runs a config-parameterised gate end-to-end (T1 follow-up #3)", async () => {
    const result = await runSingleGate(
      {
        gateItem: { id: "has-greeting", source: "./gates/has-field.gate.ts", config: { field: "greeting", type: "string" } },
        source: HAS_FIELD_GATE,
        gateSourcePath: "hello-world/gates/has-field.gate.ts",
        gitSha: "deadbeef",
        kind: "exit",
        context: baseCtx({
          artifact: { greeting: "Hello, Tom!" },
          config: { field: "greeting", type: "string" },
        }),
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.report).toBe("field greeting ok");
  });

  it("returns a structured FIELD_TYPE_MISMATCH when config contract is violated", async () => {
    const result = await runSingleGate(
      {
        gateItem: { id: "has-greeting", source: "./gates/has-field.gate.ts", config: { field: "greeting", type: "string" } },
        source: HAS_FIELD_GATE,
        gateSourcePath: "hello-world/gates/has-field.gate.ts",
        gitSha: "deadbeef",
        kind: "exit",
        context: baseCtx({
          artifact: { greeting: 42 },
          config: { field: "greeting", type: "string" },
        }),
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("FIELD_TYPE_MISMATCH");
    expect(result.hints).toEqual(["Return greeting as a string"]);
  });

  it("drives the hello-world greet-exit scenario through runGateBlock with two parallel gates", async () => {
    const block: GateBlock = [[
      { id: "has-greeting", source: "./gates/has-field.gate.ts", config: { field: "greeting", type: "string" } },
      { id: "has-greeting-again", source: "./gates/has-field.gate.ts", config: { field: "greeting", type: "string" } },
    ]];
    const result = await runGateBlock(
      {
        block,
        kind: "exit",
        gitSha: "deadbeef",
        context: baseCtx({ artifact: { greeting: "Hi" } }),
        resolveSource: async (sourcePath: string) => ({
          source: HAS_FIELD_GATE,
          gateSourcePath: "hello-world/" + sourcePath.replace(/^\.\//, ""),
        }),
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.gate_results).toHaveLength(2);
    expect(result.gate_results.every((r) => r.pass)).toBe(true);
    expect(result.gate_results[0]?.kind).toBe("exit");
  });
});
