import { describe, it, expect } from "vitest";
import type { GateBlock, GateContext } from "@mnm/governed-workflows";
import { runGateBlock } from "../run-gate-block.js";
import { CompiledCache } from "../compiled-cache.js";
import {
  PASSING,
  FAILING,
  THROWING,
} from "./fixtures/gate-sources.js";

function ctx(): GateContext {
  return {
    artifact: { greeting: "Hi" },
    run: { id: "run-1", workflow_name: "hello-world", git_tag: "v1.0.0", params: {} },
    step: { id: "greet", previous_artifacts: {} },
    config: {},
    kind: "exit",
    helpers: {},
  };
}

function resolverFor(map: Record<string, string>) {
  return async (itemSource: string) => ({
    source: map[itemSource] ?? (() => { throw new Error("unknown source: " + itemSource); })(),
    gateSourcePath: itemSource.replace(/^\.\//, "hello-world/"),
  });
}

const BASE = { kind: "exit" as const, gitSha: "deadbeef" };

describe("runGateBlock", () => {
  it("returns pass:true + empty results for an empty block", async () => {
    const result = await runGateBlock(
      { block: [], context: ctx(), resolveSource: async () => { throw new Error("unreached"); }, ...BASE },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.gate_results).toEqual([]);
  });

  it("evaluates a single sequential gate", async () => {
    const block: GateBlock = [{ id: "g1", source: "./gates/pass.gate.ts" }];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({ "./gates/pass.gate.ts": PASSING }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.gate_results).toHaveLength(1);
    expect(result.gate_results[0]?.gate_id_in_json).toBe("g1");
  });

  it("short-circuits sequential evaluation on the first failure", async () => {
    const block: GateBlock = [
      { id: "g1", source: "./gates/pass.gate.ts" },
      { id: "g2", source: "./gates/fail.gate.ts" },
      { id: "g3", source: "./gates/pass.gate.ts" },
    ];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({
          "./gates/pass.gate.ts": PASSING,
          "./gates/fail.gate.ts": FAILING,
        }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.gate_results).toHaveLength(2);
    expect(result.gate_results[1]?.pass).toBe(false);
  });

  it("runs an inner array in parallel and succeeds when all pass", async () => {
    const block: GateBlock = [[
      { id: "g1", source: "./gates/pass.gate.ts" },
      { id: "g2", source: "./gates/pass.gate.ts" },
    ]];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({ "./gates/pass.gate.ts": PASSING }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(true);
    expect(result.gate_results).toHaveLength(2);
  });

  it("fails fast when any parallel gate fails; still records all settled gates", async () => {
    const block: GateBlock = [[
      { id: "g1", source: "./gates/pass.gate.ts" },
      { id: "g2", source: "./gates/fail.gate.ts" },
    ]];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({
          "./gates/pass.gate.ts": PASSING,
          "./gates/fail.gate.ts": FAILING,
        }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.gate_results).toHaveLength(2);
    expect(result.gate_results.some((r) => r.pass === false)).toBe(true);
  });

  it("mixes sequential and parallel entries, short-circuits after the failing group", async () => {
    const block: GateBlock = [
      [
        { id: "p1", source: "./gates/pass.gate.ts" },
        { id: "p2", source: "./gates/pass.gate.ts" },
      ],
      { id: "s1", source: "./gates/fail.gate.ts" },
      { id: "s2", source: "./gates/pass.gate.ts" },
    ];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({
          "./gates/pass.gate.ts": PASSING,
          "./gates/fail.gate.ts": FAILING,
        }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.gate_results.map((r) => r.gate_id_in_json)).toEqual(["p1", "p2", "s1"]);
  });

  it("classifies a throwing gate without aborting the whole block computation", async () => {
    const block: GateBlock = [{ id: "g1", source: "./gates/throw.gate.ts" }];
    const result = await runGateBlock(
      {
        block,
        context: ctx(),
        resolveSource: resolverFor({ "./gates/throw.gate.ts": THROWING }),
        ...BASE,
      },
      { compiledCache: new CompiledCache() },
    );
    expect(result.pass).toBe(false);
    expect(result.gate_results[0]?.error_code).toBe("GATE_EXCEPTION");
  });
});
