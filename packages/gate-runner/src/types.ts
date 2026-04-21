import type { GateBlock, GateContext, GateItem } from "@mnm/governed-workflows";

/**
 * Result of one gate invocation. Mirrors the `gate_results` DB row minus the
 * DB-only columns (id, run_id, step_exec_id, company_id) which are added by
 * the orchestrator (T5) when it persists the result.
 */
export interface GateEvaluationResult {
  /** `id` field from the workflow.json gate item. */
  gate_id_in_json: string;
  /** Pinned git sha of the run. Immutable — matches the DB column. */
  gate_git_sha: string;
  /** Repo-relative POSIX path of the .gate.ts source that was evaluated. */
  gate_source_path: string;
  /** Lifecycle kind — "entry", "exit", or future extension. Opaque string. */
  kind: string;
  /** True if the gate returned `{ pass: true }`; false for every failure. */
  pass: boolean;
  /** Human-readable explanation. Always present, even on failure. */
  report: string;
  /** Populated on failure. Value is a `GATE_ERROR_CODES` member OR an author-defined code string. */
  error_code?: string;
  /** Remediation hints for the harness / human reader. */
  hints?: string[];
  /** ISO-8601 timestamp stamped when the runner recorded the result. */
  evaluated_at: string;
  /** Wall-clock duration of the invocation, milliseconds. Includes compile + isolate spin-up on cold path. */
  duration_ms: number;
}

/**
 * Result of a full `GateBlock` — the nested-array composition from
 * workflow.json. `pass` is false as soon as any single gate fails
 * (short-circuit). `gate_results` contains every gate that was actually
 * invoked, in evaluation order; parallel-inner-array entries appear
 * contiguously but their relative order matches the original inner array.
 */
export interface GateBlockResult {
  pass: boolean;
  gate_results: GateEvaluationResult[];
}

/**
 * Runner-wide tunables. Defaults mirror spec §6: 5 s timeout, 256 MB memory,
 * retry-once on sandbox crash.
 */
export interface RunnerOptions {
  timeoutMs?: number;
  memoryLimitMb?: number;
  retryOnSandboxCrash?: boolean;
}

/**
 * Arguments for `runSingleGate`. Source fetching is the caller's job — pass
 * the literal source string and the path it came from so the cache key can
 * include the path.
 */
export interface RunSingleGateArgs {
  gateItem: GateItem;
  /** Raw TypeScript source of the gate file, exactly as stored in git. */
  source: string;
  /** Repo-relative POSIX path of the gate source. Used in the compile cache key and stamped on the result. */
  gateSourcePath: string;
  /** Pinned git sha of the run. Used in the compile cache key. */
  gitSha: string;
  /** Lifecycle kind ("entry" / "exit" / future). Opaque to the runner. */
  kind: string;
  /** Read-only runtime context injected into the isolate. */
  context: GateContext;
}

/**
 * Arguments for `runGateBlock`. The runner iterates the block and calls
 * `resolveSource` on demand for each gate item. `resolveSource` is where the
 * caller plugs in `GitProvider.fetchBlob` + `ShaCache`.
 */
export interface RunGateBlockArgs {
  block: GateBlock;
  kind: string;
  gitSha: string;
  context: GateContext;
  resolveSource: (gateItemSource: string) => Promise<{
    source: string;
    gateSourcePath: string;
  }>;
}
