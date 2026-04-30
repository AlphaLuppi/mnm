// Phase 3 — Pluggable execution-target abstraction (port of upstream PR #4415).
// An ExecutionTarget is the concrete place where an agent adapter process runs.
// Drivers: local (default), ssh, sandbox (Docker), plugin (third-party — e2b etc.).
//
// Design principles:
// - Side-effect free at module-load (factory-driven)
// - Provider lifecycle = setup() -> run() (N times) -> teardown()
// - Streaming-friendly via onStdout/onStderr callbacks
// - Driver-agnostic Result shape so heartbeat.ts can consume any provider
//
// Server consumers should NEVER `new` a provider directly — go through the
// `getExecutionTarget(env)` factory in `./factory.ts` so we can swap drivers
// (local <-> sandbox <-> plugin) by config, without changing call sites.

/** Provider driver — must match `environments.driver` in the DB. */
export type ExecutionTargetDriver = "local" | "ssh" | "sandbox" | "plugin";

/** Stream callback for line-buffered process output. */
export type StreamCallback = (chunk: string) => void;

/** Options passed to a single command invocation. */
export interface RunOptions {
  /** Command to execute (absolute path or PATH-resolved name). */
  command: string;
  /** Argv (excluding command itself). */
  args: readonly string[];
  /** Working directory (absolute). Provider may sandbox/translate this. */
  cwd?: string;
  /** Env vars merged on top of provider defaults. */
  env?: Record<string, string>;
  /** Soft timeout in ms — provider will attempt to gracefully kill. */
  timeoutMs?: number;
  /** Stdout streaming callback (receives raw chunks, not lines). */
  onStdout?: StreamCallback;
  /** Stderr streaming callback. */
  onStderr?: StreamCallback;
  /** Optional AbortSignal — caller can cancel mid-run. */
  signal?: AbortSignal;
}

/** Result of a completed run. */
export interface RunResult {
  /** Exit code; null if killed by signal/timeout. */
  exitCode: number | null;
  /** Captured stdout (full, even if streamed via onStdout). */
  stdout: string;
  /** Captured stderr. */
  stderr: string;
  /** True if killed due to timeout. */
  timedOut: boolean;
  /** True if killed due to signal/abort. */
  aborted: boolean;
  /** Provider-specific opaque data (PID, container id, lease id, ...). */
  providerMeta?: Record<string, unknown>;
}

/** Optional per-run setup state passed back to teardown. */
export interface SetupState {
  /** Provider-specific lease/token to attach to the env_lease row. */
  providerLeaseId?: string;
  /** Free-form data the provider needs for run/teardown. */
  data?: Record<string, unknown>;
}

/**
 * Core execution-target contract. A provider is a factory that returns a
 * stateful instance bound to a single Environment row + lease.
 */
export interface ExecutionTarget {
  /** Driver tag, equals `environments.driver`. */
  readonly driver: ExecutionTargetDriver;
  /** Stable id (matches `environments.id` for DB-backed envs). */
  readonly environmentId: string;

  /**
   * Acquire any provider-side resources (lease a sandbox, open SSH conn,
   * negotiate plugin token, etc.). Idempotent: calling twice should not
   * leak resources. Returns SetupState the caller (heartbeat) writes into
   * the env_lease row before any run().
   */
  setup(): Promise<SetupState>;

  /** Execute a single command and resolve when it has fully terminated. */
  run(options: RunOptions): Promise<RunResult>;

  /**
   * Release resources. MUST be called even if setup() failed partway, and
   * MUST be safe to call multiple times. The caller updates the env_lease
   * row (status=released|failed) after a successful teardown.
   */
  teardown(): Promise<void>;
}
