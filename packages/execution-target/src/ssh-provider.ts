// Phase 3 — SSH execution-target provider (STUB).
// Port of upstream PR #4358 (SSH environment support). MnM ships a stub
// implementation: the contract is wired up, the actual SSH transport is
// deferred to a follow-up because it pulls in `ssh2` and credential plumbing
// that needs a security review before going live.
//
// To enable: implement `setup()` (open ssh2.Client connection),
// `run()` (issue a remote command via the ssh2 client API),
// and `teardown()` (client.end). All three methods currently throw
// `SshProviderNotImplementedError` so accidental flips to driver="ssh"
// fail fast at boot, not at heartbeat time.

import type {
  ExecutionTarget,
  ExecutionTargetDriver,
  RunOptions,
  RunResult,
  SetupState,
} from "./types.js";

export class SshProviderNotImplementedError extends Error {
  constructor() {
    super(
      "SSH execution-target driver is not yet implemented. " +
        "Set environments.driver to 'local' or 'plugin' for now.",
    );
    this.name = "SshProviderNotImplementedError";
  }
}

export interface SshProviderConfig {
  host: string;
  port?: number;
  username: string;
  /** Either privateKey or password — passed via secret store, never inline. */
  privateKey?: string;
  password?: string;
  /** Optional cwd to cd into before each run. */
  defaultCwd?: string;
  /** Default env to export per session. */
  defaultEnv?: Record<string, string>;
}

export class SshProvider implements ExecutionTarget {
  public readonly driver: ExecutionTargetDriver = "ssh";
  public readonly environmentId: string;
  // Held for symmetry with LocalProvider — used once the real impl lands.
  public readonly config: SshProviderConfig;

  constructor(environmentId: string, config: SshProviderConfig) {
    this.environmentId = environmentId;
    this.config = config;
  }

  // TODO(phase-3.5): wire up `ssh2.Client` in setup(), expose a Pool so
  // multiple runs on the same host reuse the connection.
  async setup(): Promise<SetupState> {
    throw new SshProviderNotImplementedError();
  }

  // TODO(phase-3.5): use the ssh2 client to issue a remote command with
  // argv preserved; pipe its stream into onStdout/onStderr like LocalProvider.
  async run(_options: RunOptions): Promise<RunResult> {
    throw new SshProviderNotImplementedError();
  }

  // TODO(phase-3.5): client.end() + dispose connection pool entry.
  async teardown(): Promise<void> {
    // No-op stub: harmless to call repeatedly.
  }
}
