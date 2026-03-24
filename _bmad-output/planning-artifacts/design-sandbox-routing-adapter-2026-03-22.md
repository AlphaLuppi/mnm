# Design: Sandbox Routing for Agent Execution
**Date:** 2026-03-22
**Author:** Architect A
**Status:** Proposal — Pending team review

---

## Executive Summary

Currently, `executeRun()` in `heartbeat.ts` calls `adapter.execute()`, which spawns a local subprocess on the MnM server host. The goal is to route ALL agent execution through the user's per-user Docker sandbox container via `docker exec`, so each agent run is isolated inside the right user's container.

**Chosen approach: Sandbox Execution Wrapper in `executeRun()` — not a new adapter type.**

---

## System Understanding (Current State)

### Execution Flow (Today)

```
enqueueWakeup(agentId, { requestedByActorId: userId })
  → heartbeat_runs inserted (no actorId column — only on wakeup_requests)
  → executeRun(runId)
      → getAgent(run.agentId)
      → adapter = getServerAdapter(agent.adapterType)   // e.g. claude_local
      → adapter.execute(ctx)                            // spawns local process
          → buildClaudeRuntimeConfig()
          → runChildProcess(cmd, args, { cwd, env })    // node spawn()
```

### Key observations

1. **`heartbeat_runs` has no `actorId` column.** The requesting user ID lives only on `agent_wakeup_requests.requestedByActorId`. The run does carry `wakeupRequestId` as a FK.

2. **Three invocation sources with different user signals:**
   - `on_demand` (manual trigger): `requestedByActorId` = the user who clicked Run
   - `timer`: no human actor — system-scheduled, no user association
   - `issue` runs: `issues.assigneeUserId` = the user the issue is assigned to

3. **Adapters are pure functions** — `ServerAdapterModule.execute(ctx)` receives no user/sandbox context. They know the agent and run, not the triggering user.

4. **`sandbox-exec.ts` already knows how to `docker exec`** — it uses `dockerode` to exec a command in a container and demux stdout/stderr streams. This is exactly the primitive we need.

5. **`sandbox-manager.ts` looks up sandboxes by `(userId, companyId)`** — so we need a resolved `userId` to find the container.

6. **The existing `dockerAdapter` is a tombstone** — it always returns an error. We are not reusing it.

---

## Design Decisions

### Decision 1: WHERE to intercept

**Choice: Wrap inside `executeRun()`, before calling `adapter.execute()`**

**Rejected: New adapter type `claude_sandbox`**
Would require users to change agent config. All existing agents use `claude_local`, `codex_local`, etc. We'd have to duplicate all adapter logic. The sandbox is a runtime concern (WHERE to execute), not a different agent capability.

**Rejected: Wrap the `ServerAdapterModule` interface**
Could create a `sandboxAdapter(inner)` decorator but this complicates `registry.ts` and session codec resolution. The adapter already builds a full env + command — we just need to redirect WHERE that command runs.

**Chosen: Intercept in `executeRun()` with a `SandboxExecutionRouter`**

The router sits between `executeRun()` and `adapter.execute()`. It:
1. Resolves which user's sandbox to use (see Decision 2)
2. Decides whether to use sandbox routing or fall back to local
3. Builds a `docker exec` invocation that runs the adapter's command inside the container
4. Returns an `AdapterExecutionResult` with the same shape

This is the minimal-surface change: one function call in `heartbeat.ts`, everything else unchanged.

---

### Decision 2: HOW to resolve the user

The challenge: `heartbeat_runs` does not store `actorId`. We must reconstruct the user from available signals.

**Resolution priority chain (evaluated in order):**

```typescript
async function resolveExecutingUserId(
  run: HeartbeatRun,
  agent: Agent,
  context: Record<string, unknown>,
  db: Db,
): Promise<string | null> {

  // 1. Manual/on_demand run: actor is in the wakeup request
  if (run.wakeupRequestId) {
    const wakeup = await db.select()
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.id, run.wakeupRequestId))
      .then(r => r[0] ?? null);
    if (wakeup?.requestedByActorType === "user" && wakeup?.requestedByActorId) {
      return wakeup.requestedByActorId;
    }
  }

  // 2. Issue run: use the issue's assigneeUserId
  const issueId = typeof context.issueId === "string" ? context.issueId : null;
  if (issueId) {
    const issue = await db.select({ assigneeUserId: issues.assigneeUserId })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.companyId, agent.companyId)))
      .then(r => r[0] ?? null);
    if (issue?.assigneeUserId) {
      return issue.assigneeUserId;
    }
  }

  // 3. Timer run: no user — fall back to local or error
  return null;
}
```

**Timer runs:** Return `null` → fall back to local execution (no sandbox). Timer runs are system-scheduled and have no owning user. Alternatively, we could use the agent owner's sandbox if the agent table gains an `ownerUserId` column — but that's a separate design decision.

---

### Decision 3: HOW to replace spawn with docker exec

> **UPDATE 2026-03-24 (SANDBOX-AUTH implemented):** Credential injection is now resolved. The `claude_oauth_token` is stored in `user_pods` (DB), fetched by the heartbeat at run start, and injected as `CLAUDE_CODE_OAUTH_TOKEN` env var via `docker exec`. The old `copyClaudeCredentials` function (which copied `.credentials.json` from host into the container) has been removed — OAuth access tokens expire in ~5h and get invalidated when the host CLI refreshes, making file-based copy unreliable. Users generate a 1-year token via `claude setup-token` and provide it through the UI (onboarding wizard or Settings > Claude tab).

The claude adapter's `runChildProcess` call looks like:
```
spawn("claude", ["--print", "-", "--output-format", "stream-json", ...], {
  cwd: "/workspace/project",
  env: { MNM_AGENT_ID: ..., CLAUDE_CODE_OAUTH_TOKEN: ..., ... },
  stdin: prompt,
})
```

In sandbox mode, we need to run this same command inside the container. The approach:

**We do NOT run the adapter's `execute()` at all in sandbox mode.** Instead we build the same command arguments independently and run `docker exec`.

Actually — a cleaner approach: **intercept `runChildProcess` via a transport layer passed into the adapter context.** But `AdapterExecutionContext` has no such field today.

**Pragmatic approach for Phase 1:** The `SandboxExecutionRouter` only handles `claude_local` and `codex_local` (the "local spawn" adapters). It:

1. Calls `buildClaudeRuntimeConfig()` (already exported) to get `{ command, args, env, cwd, stdin }`
2. Runs that command via `docker exec` instead of `spawn`
3. Returns the parsed result using the adapter's existing parse logic

**Docker exec mechanics:**

```typescript
async function runCommandInSandbox(
  containerId: string,
  command: string,
  args: string[],
  opts: {
    cwd: string;
    env: Record<string, string>;
    stdin?: string;
    timeoutSec: number;
    onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
  },
): Promise<RunProcessResult>
```

Implementation:
```typescript
const docker = getDockerClient();
const container = docker.getContainer(containerId);

// Build docker exec options
const exec = await container.exec({
  Cmd: [command, ...args],
  Env: Object.entries(opts.env).map(([k, v]) => `${k}=${v}`),
  WorkingDir: opts.cwd,
  AttachStdin: opts.stdin != null,
  AttachStdout: true,
  AttachStderr: true,
  Tty: false,
});

const stream = await exec.start({ Detach: false, hijack: opts.stdin != null });

// Write stdin if present
if (opts.stdin && stream.writable) {
  stream.write(opts.stdin);
  stream.end();
}

// Collect stdout/stderr via dockerode demux
// Apply timeout via setTimeout + exec.inspect() for exit code
```

**Stdout/stderr demux:** Docker multiplexes stdout/stderr in the same stream (8-byte header: stream type + length). The `demuxDockerStream()` in `sandbox-exec.ts` already handles this for non-TTY mode. We reuse that function.

**Stdin delivery:** `docker exec` supports stdin when `AttachStdin: true` and `hijack: true` in `start()`. The Claude adapter pipes its prompt via stdin. This works with the hijacked stream.

**Exit code:** After the stream closes, call `exec.inspect()` to get the exit code. Note: `exec.inspect()` returns `ExitCode: 0` while still running — must wait for stream close first.

**Timeout:** We manage our own `setTimeout` that calls `docker.getContainer(containerId).exec({ Cmd: ["kill", pid] })` or simply kills the exec handle. Simpler: track a flag and reject the Promise after timeoutSec.

---

### Decision 4: HOW to handle the workspace

**Critical insight:** The workspace `cwd` resolved by `resolveWorkspaceForRun()` is a host filesystem path. Inside the container, paths are different.

**Volume mapping in sandbox containers (from `sandbox-manager.ts`):**
- `mnm-sandbox-home-{userId}` → `/home/agent`
- `mnm-sandbox-workspace-{userId}` → `/workspace`

**Translation rules:**

```typescript
function translateCwdForSandbox(hostCwd: string): string {
  // If cwd is under the host workspace volume mount point:
  // Host: /var/lib/docker/volumes/mnm-sandbox-workspace-{userId}/_data/my-project
  // → We can't use that path. Workspace must be inside the container's /workspace.

  // Rule 1: If cwd is under the agent's home dir equivalent → /home/agent
  // Rule 2: If cwd is a project workspace → /workspace/<project-name>
  // Rule 3: Fallback → /workspace

  return "/workspace";  // safe default
}
```

**Bigger issue: workspaces must BE in the container's volumes.** If a workspace is on the host filesystem (e.g. `/Users/andri/projects/foo`), it is NOT accessible inside the sandbox container. Two sub-cases:

1. **MnM-managed workspaces** (workspace resolver creates dirs under a configurable base): Can be configured to use paths within Docker volumes mounted into sandboxes.

2. **User-configured cwds** (arbitrary host paths): Cannot be accessed inside containers.

**Phase 1 recommendation:** Only run in sandbox mode when:
- `resolvedWorkspace.source === "sandbox_workspace"` (new source type), OR
- `resolvedWorkspace.workspaceId` matches a sandbox volume

**Fallback:** If workspace is not sandbox-compatible, warn and fall back to local execution (or fail with a clear error message for users who have sandboxes enabled and a non-sandbox workspace).

**Phase 2:** Add `sandbox_workspace` as a workspace source type. When a sandbox exists for the user, the workspace resolver creates dirs under `/workspace/<name>` inside the sandbox volume. The container mounts this volume, so the paths are consistent.

---

### Decision 5: WHAT happens if user has no sandbox yet

**Option A: Auto-provision**
Pro: transparent. Con: provisioning is async (takes 5-10s), the run would stall. Could lead to double provisioning under load.

**Option B: Fail the run with a clear error**
Pro: explicit, auditable. Con: bad UX if it happens silently.

**Option C: Fall back to local execution**
Pro: zero downtime. Con: no isolation, defeats the purpose.

**Option D: Auto-provision + wait (with timeout)**
Pro: good UX. Con: complex, can time out.

**Recommendation: Option C for timer runs, Option B for on_demand runs.**

The reasoning:
- Timer runs (no user) → local execution is acceptable since no sandbox owner anyway
- Manual runs where sandbox is expected but missing → fail immediately with `errorCode: "sandbox_required"` and a human-readable message explaining they need to provision their sandbox. The UI can then prompt them to provision.
- Issue runs where `assigneeUserId` has no sandbox → fall back to local with a warning in stderr, or fail if company policy requires sandboxes (future: `company.requiresSandbox` flag)

**For the transition period (opt-in):** The agent's `adapterConfig` can have a `useSandbox: true | false` flag. When false (default), local execution continues unchanged. When true, sandbox routing applies.

---

## Proposed Architecture

### New file: `server/src/services/sandbox-exec-runner.ts`

```typescript
/**
 * Sandbox execution router: runs adapter commands inside user's Docker sandbox.
 * Used by executeRun() when sandbox routing is enabled.
 */
export interface SandboxRunnerOptions {
  userId: string;
  companyId: string;
  runId: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;       // path INSIDE the container
  stdin?: string;
  timeoutSec: number;
  graceSec: number;
  onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
}

export async function runInSandbox(
  db: Db,
  opts: SandboxRunnerOptions,
): Promise<RunProcessResult>
```

This function:
1. Looks up the sandbox by `(userId, companyId)` — checks it is running
2. Builds the `docker exec` call with the right env, cwd, stdin
3. Streams stdout/stderr through `onLog`
4. Returns a `RunProcessResult` (same shape as `runChildProcess`)

### Changes to `executeRun()` in `heartbeat.ts`

After resolving `runtimeConfig` and before `adapter.execute()`:

```typescript
// Resolve sandbox routing
const sandboxUserId = await resolveExecutingUserId(run, agent, context, db);
const useSandbox = sandboxUserId != null && asBoolean(config.useSandbox, false);

let adapterResult: AdapterExecutionResult;

if (useSandbox) {
  // Build the command config without running it
  const runtimeConfig = await buildClaudeRuntimeConfig({ runId, agent, config, context, authToken });
  const containerCwd = translateCwdForSandbox(runtimeConfig.cwd);

  try {
    const proc = await runInSandbox(db, {
      userId: sandboxUserId,
      companyId: agent.companyId,
      runId,
      command: runtimeConfig.command,
      args: buildClaudeArgs(runtimeConfig),
      env: runtimeConfig.env,
      cwd: containerCwd,
      stdin: prompt,
      timeoutSec: runtimeConfig.timeoutSec,
      graceSec: runtimeConfig.graceSec,
      onLog,
    });
    adapterResult = parseClaudeResult(proc, runtimeConfig);
  } catch (err) {
    // sandbox unavailable → fail run
    adapterResult = { exitCode: 1, signal: null, timedOut: false, errorMessage: String(err), errorCode: "sandbox_exec_failed" };
  }
} else {
  adapterResult = await adapter.execute(ctx);
}
```

**Problem with this approach:** We'd be duplicating `buildClaudeRuntimeConfig` and `buildClaudeArgs` logic from the adapter package. They are not currently exported for external use.

**Better approach: Inject a transport into the adapter context.**

---

## Preferred Architecture: Transport Injection

Add an optional `spawnTransport` to `AdapterExecutionContext`:

```typescript
// In packages/adapter-utils/src/types.ts
export interface SpawnTransport {
  run(
    runId: string,
    command: string,
    args: string[],
    opts: {
      cwd: string;
      env: Record<string, string>;
      stdin?: string;
      timeoutSec: number;
      graceSec: number;
      onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
    },
  ): Promise<RunProcessResult>;
}

export interface AdapterExecutionContext {
  // ... existing fields ...
  spawnTransport?: SpawnTransport;  // If undefined, use default local spawn
}
```

The adapter's `runChildProcess` call becomes:
```typescript
const transport = ctx.spawnTransport ?? localSpawnTransport;
const proc = await transport.run(runId, command, args, opts);
```

In `executeRun()`, we build a `sandboxTransport` that wraps `runInSandbox()`:
```typescript
const spawnTransport: SpawnTransport | undefined = useSandbox
  ? makeSandboxTransport(db, sandboxUserId, agent.companyId)
  : undefined;

const adapterResult = await adapter.execute({
  ...ctx,
  spawnTransport,
});
```

**Advantages of transport injection:**
- Zero duplication of adapter command-building logic
- Adapters stay unaware of Docker — they call `transport.run()` regardless
- Testable: swap transport in tests
- Future: HTTP transport, remote machine transport, etc.
- All adapters (claude, codex, opencode, pi, cursor) automatically get sandbox routing when they adopt the pattern

**Required changes to adapters:** Each adapter that currently calls `runChildProcess` directly needs to route through `ctx.spawnTransport?.run(...)` or a helper. This is a one-line change per adapter call site.

---

## Migration Path

### Phase 1 (Opt-in, per agent)

1. Add `spawnTransport?: SpawnTransport` to `AdapterExecutionContext`
2. Create `server/src/services/sandbox-exec-runner.ts` with `makeSandboxTransport()`
3. Modify `runChildProcess` calls in claude adapter to use transport
4. In `executeRun()`: resolve userId, build transport if sandbox available + `config.useSandbox === true`
5. Add `useSandbox` flag to agent `adapterConfig` schema
6. Workspace: for now, only sandbox-route when `cwd` resolves to `/workspace` or `/home/agent`

### Phase 2 (Workspace integration)

1. Add `sandbox_workspace` source type to workspace resolver
2. When user has a sandbox, workspace resolver returns paths under the sandbox volume
3. `useSandbox` defaults to `true` when sandbox exists and workspace source is `sandbox_workspace`

### Phase 3 (Company policy)

1. Add `company.requiresSandbox` flag
2. On-demand runs without sandbox → fail with clear error + UI prompt to provision

---

## User Identification Gaps and Mitigations

| Scenario | User Signal | Strategy |
|----------|-------------|----------|
| Manual run (on_demand) | `wakeup.requestedByActorId` (type=user) | Direct lookup |
| Issue run | `issues.assigneeUserId` | FK join |
| Timer run | None | Local exec (no sandbox) |
| A2A run (agent-to-agent) | `wakeup.requestedByActorId` (type=agent) | Use triggering agent's owner, or local exec |
| Workflow run (orchestrated) | Depends on workflow designer | Need `workflow_instances.ownerUserId` (future) |

**Database gap:** `heartbeat_runs` has no `sandboxUserId` column. For observability, we should add one. Otherwise, after the fact, we cannot tell which sandbox a run used.

**Recommendation:** Add `sandboxUserId text` and `sandboxContainerId text` to `heartbeat_runs`. Set them in `executeRun()` when sandbox routing is used.

---

## Security Considerations

1. **Env var leakage:** All env vars passed to `docker exec` are visible via `docker inspect` on the host. Secrets (API keys, oauth tokens) are already in env. No change in attack surface vs. local spawn — both run on the same host.

2. **Command injection:** `command` and `args` are constructed by the adapter, not from user input. No injection risk. Env vars with user-provided values are already present in local spawn too.

3. **Container escape:** We rely on Docker's isolation. The sandbox container has `no-new-privileges` and `CapDrop: ALL`. The MnM server has Docker socket access — this is a privileged position either way.

4. **Cross-user contamination:** The `(userId, companyId)` lookup is strict. A run for user A cannot accidentally route to user B's container.

5. **Sandbox status check:** If sandbox is `hibernated`, we wake it automatically before exec, or fail the run. We should NOT exec into a hibernated container (it would fail with Docker error).

---

## Open Questions for Team Review

1. **Timer runs:** Should we add an `ownerUserId` column to agents so timer runs can use the agent owner's sandbox? Or keep timer runs on local exec?

2. **Multiple adapters:** The transport injection pattern requires modifying all adapters. For Phase 1, should we only implement it for `claude_local` (most common)?

3. **Workspace path translation:** The current workspace resolver returns host paths. Do we want to change the resolver to be sandbox-aware, or add a separate translation step in the routing layer?

4. **Session continuity:** Claude sessions are stored by `sessionId` which maps to a Claude Code session on the host (or in the container). If a run switches from local to sandbox mid-lifecycle, the session ID won't be resumable. How do we handle the transition?

5. **Skills directory:** The claude adapter creates a temp dir on the host filesystem and passes it via `--add-dir`. Inside the container, this path doesn't exist. We need to either (a) mount this dir into the container, or (b) pre-install skills into the sandbox image.

---

## Summary of Recommendations

| Decision | Recommendation |
|----------|---------------|
| Intercept point | `executeRun()` — inject `spawnTransport` into adapter context |
| User resolution | Priority chain: wakeup actor → issue assignee → null (timer) |
| Exec mechanism | `docker exec` via dockerode, demux stdout/stderr, hijacked stdin for prompt |
| Workspace | Phase 1: translate to `/workspace`; Phase 2: sandbox-aware workspace source |
| No sandbox | Phase 1: fall back to local; Phase 3: company policy enforces error |
| Skills dir | Mount into container or pre-bake into image |
| DB tracking | Add `sandboxUserId` + `sandboxContainerId` to `heartbeat_runs` |
| Config | `useSandbox: boolean` in agent `adapterConfig` (opt-in for Phase 1) |
