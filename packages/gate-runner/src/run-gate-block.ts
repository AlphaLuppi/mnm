import type { GateItem } from "@mnm/governed-workflows";
import { runSingleGate, type RunSingleGateDeps } from "./run-single-gate.js";
import type {
  GateBlockResult,
  GateEvaluationResult,
  RunGateBlockArgs,
} from "./types.js";

/**
 * Execute a `GateBlock` — the nested-array composition declared in
 * workflow.json under `gates.entry` / `gates.exit`.
 *
 *   - Outer array entries run **sequentially** and short-circuit on the
 *     first failing result.
 *   - Inner arrays (one level deep, guaranteed by `gateBlockSchema`) run
 *     **in parallel** via `Promise.all`. All parallel gates are awaited to
 *     settlement even when one fails early, so every invocation is recorded
 *     in `gate_results`. The block is marked `pass:false` as soon as any
 *     inner gate reports `pass:false`.
 *
 * The runner is `kind`-agnostic — the same function handles `entry`,
 * `exit`, and any future lifecycle hook. Adding a new kind = one new call
 * site in the orchestrator (T5), zero change here.
 */
export async function runGateBlock(
  args: RunGateBlockArgs,
  deps: RunSingleGateDeps,
): Promise<GateBlockResult> {
  const collected: GateEvaluationResult[] = [];

  for (const entry of args.block) {
    if (Array.isArray(entry)) {
      const results = await Promise.all(
        entry.map((item) => evalOne(item, args, deps)),
      );
      collected.push(...results);
      if (results.some((r) => !r.pass)) {
        return { pass: false, gate_results: collected };
      }
    } else {
      const r = await evalOne(entry, args, deps);
      collected.push(r);
      if (!r.pass) return { pass: false, gate_results: collected };
    }
  }
  return { pass: true, gate_results: collected };
}

async function evalOne(
  item: GateItem,
  args: RunGateBlockArgs,
  deps: RunSingleGateDeps,
): Promise<GateEvaluationResult> {
  const { source, gateSourcePath } = await args.resolveSource(item.source);
  return runSingleGate(
    {
      gateItem: item,
      source,
      gateSourcePath,
      gitSha: args.gitSha,
      kind: args.kind,
      context: {
        ...args.context,
        config: (item.config ?? {}) as Record<string, unknown>,
        kind: args.kind,
      },
    },
    deps,
  );
}
