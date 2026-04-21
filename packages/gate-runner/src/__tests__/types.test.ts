import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  GateEvaluationResult,
  GateBlockResult,
  RunnerOptions,
  RunSingleGateArgs,
  RunGateBlockArgs,
} from "../types.js";
import { GATE_ERROR_CODES, type GateContext } from "@mnm/governed-workflows";

describe("gate-runner types", () => {
  it("GateEvaluationResult carries the DB-row-equivalent shape", () => {
    const sample: GateEvaluationResult = {
      gate_id_in_json: "greeting-ok",
      gate_git_sha: "deadbeef",
      gate_source_path: "hello-world/gates/greet-exit.gate.ts",
      kind: "exit",
      pass: true,
      report: "ok",
      evaluated_at: "2026-04-21T12:00:00.000Z",
      duration_ms: 42,
    };
    expect(sample.pass).toBe(true);
  });

  it("GateEvaluationResult allows error_code + hints on failure", () => {
    const sample: GateEvaluationResult = {
      gate_id_in_json: "greeting-ok",
      gate_git_sha: "deadbeef",
      gate_source_path: "hello-world/gates/greet-exit.gate.ts",
      kind: "exit",
      pass: false,
      report: "timed out",
      error_code: GATE_ERROR_CODES.GATE_TIMEOUT,
      hints: ["gate exceeded 5s"],
      evaluated_at: "2026-04-21T12:00:00.000Z",
      duration_ms: 5001,
    };
    expect(sample.error_code).toBe("GATE_TIMEOUT");
  });

  it("GateBlockResult aggregates evaluation results", () => {
    const block: GateBlockResult = { pass: true, gate_results: [] };
    expect(block.gate_results).toEqual([]);
  });

  it("RunnerOptions allows overriding timeout + memory + retry", () => {
    expectTypeOf<RunnerOptions>().toEqualTypeOf<{
      timeoutMs?: number;
      memoryLimitMb?: number;
      retryOnSandboxCrash?: boolean;
    }>();
  });

  it("RunSingleGateArgs carries everything the runner needs", () => {
    const args: RunSingleGateArgs = {
      gateItem: { id: "g1", source: "./gates/x.gate.ts" },
      source: "export default async () => ({ pass: true, report: 'ok' });",
      gateSourcePath: "hello-world/gates/x.gate.ts",
      gitSha: "deadbeef",
      kind: "exit",
      context: {} as GateContext,
    };
    expect(args.kind).toBe("exit");
  });

  it("RunGateBlockArgs takes a source resolver", () => {
    const args: RunGateBlockArgs = {
      block: [],
      kind: "exit",
      gitSha: "deadbeef",
      resolveSource: async (p: string) => ({
        source: "",
        gateSourcePath: p,
      }),
      context: {} as GateContext,
    };
    expect(args.kind).toBe("exit");
  });
});
