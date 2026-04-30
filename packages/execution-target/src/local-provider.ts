// Phase 3 — Local execution-target provider.
// Spawns commands on the host machine using node:child_process.spawn.
// This is the legacy MnM behavior, now wrapped in the provider contract so
// heartbeat.ts can later be flipped to ssh/sandbox/plugin without code surgery.

import { spawn } from "node:child_process";
import type {
  ExecutionTarget,
  ExecutionTargetDriver,
  RunOptions,
  RunResult,
  SetupState,
} from "./types.js";

export interface LocalProviderConfig {
  /** Optional default cwd applied when RunOptions.cwd is absent. */
  defaultCwd?: string;
  /** Optional env injected into every run (RunOptions.env wins on conflict). */
  defaultEnv?: Record<string, string>;
  /** Hard ceiling on per-run wall time (ms). 0/undefined = unlimited. */
  defaultTimeoutMs?: number;
}

export class LocalProvider implements ExecutionTarget {
  public readonly driver: ExecutionTargetDriver = "local";
  public readonly environmentId: string;
  private readonly config: LocalProviderConfig;

  constructor(environmentId: string, config: LocalProviderConfig = {}) {
    this.environmentId = environmentId;
    this.config = config;
  }

  async setup(): Promise<SetupState> {
    // Local has no remote handshake. We surface the host pid namespace
    // marker so the lease has *something* provider-meta-ish.
    return {
      data: { driver: "local", host: process.platform, hostPid: process.pid },
    };
  }

  async run(options: RunOptions): Promise<RunResult> {
    const cwd = options.cwd ?? this.config.defaultCwd ?? process.cwd();
    const env = { ...process.env, ...this.config.defaultEnv, ...options.env };
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;

    return new Promise<RunResult>((resolve) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let aborted = false;
      let timeoutHandle: NodeJS.Timeout | undefined;

      const child = spawn(options.command, [...options.args], {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        // shell: false is the default — keep it that way for safety.
        shell: false,
      });

      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      };

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");

      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
        options.onStdout?.(chunk);
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
        options.onStderr?.(chunk);
      });

      child.on("error", (err) => {
        cleanup();
        resolve({
          exitCode: null,
          stdout,
          stderr: stderr + `\n[local-provider] spawn error: ${err.message}`,
          timedOut,
          aborted,
          providerMeta: { pid: child.pid ?? null, error: err.message },
        });
      });

      child.on("close", (code, signal) => {
        cleanup();
        resolve({
          exitCode: code,
          stdout,
          stderr,
          timedOut,
          aborted,
          providerMeta: { pid: child.pid ?? null, signal: signal ?? null },
        });
      });

      if (timeoutMs && timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          // SIGTERM first, escalate to SIGKILL after 5s
          child.kill("SIGTERM");
          setTimeout(() => {
            if (!child.killed) child.kill("SIGKILL");
          }, 5_000);
        }, timeoutMs);
      }

      if (options.signal) {
        if (options.signal.aborted) {
          aborted = true;
          child.kill("SIGTERM");
        } else {
          options.signal.addEventListener("abort", () => {
            aborted = true;
            child.kill("SIGTERM");
            setTimeout(() => {
              if (!child.killed) child.kill("SIGKILL");
            }, 5_000);
          });
        }
      }
    });
  }

  async teardown(): Promise<void> {
    // No-op: spawn() already cleaned up on close().
  }
}
