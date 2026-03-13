# Story 2.9: Agent Fault Tolerance & Recovery

Status: ready-for-dev

## Story

As a user,
I want agents to recover gracefully from crashes,
so that I don't lose work or corrupt state.

## Acceptance Criteria

1. When an agent subprocess crashes unexpectedly, the error is logged with full context (agentId, specId, error message)
2. Agent status is updated to `error` in the database with the error message
3. File locks are released immediately on crash
4. The dashboard shows a red error badge for crashed agents
5. User can view the full error log for crashed agents
6. Other running agents are unaffected by one agent's crash (process isolation)
7. On application restart, orphaned agent sessions are marked as `error` and orphaned locks are released
8. A recovery summary is available: "N agents failed during last session"

## Tasks / Subtasks

- [ ] Task 1: Handle subprocess crash detection (AC: #1, #2, #3, #6)
  - [ ] In AgentOrchestrator: listen for `close` event with non-zero exit code
  - [ ] On non-zero exit: update agent status to `error`, set errorMessage
  - [ ] Release all file locks for the crashed agent via FileLockManager
  - [ ] Log error with full context (agentId, specId, exit code, last stderr output)
  - [ ] Emit `error` event via AgentEventBus
  - [ ] Ensure no other agent processes are affected
- [ ] Task 2: Handle unexpected process errors (AC: #1, #2)
  - [ ] Listen for `error` event on ChildProcess (e.g., ENOENT, EPERM)
  - [ ] Update agent status to `error` with the error message
  - [ ] Release file locks
- [ ] Task 3: Implement startup recovery (AC: #7, #8)
  - [ ] Create `src/lib/agent/recovery.ts`
  - [ ] `recoverFromCrash(db)`: find agents with status `running` or `paused` (orphaned)
  - [ ] Update orphaned agents to status `error` with message "Agent terminated due to server restart"
  - [ ] Release all orphaned file locks
  - [ ] Return recovery summary: { orphanedAgents: number, releasedLocks: number }
  - [ ] Call this function on application startup (e.g., in `src/lib/db/index.ts` or a dedicated init module)
- [ ] Task 4: Display error state in UI (AC: #4, #5)
  - [ ] Status badge shows red "Error" for crashed agents
  - [ ] Clicking a crashed agent shows the error message and last log output
  - [ ] Log viewer for completed/error agents reads from stored log file
- [ ] Task 5: Create recovery summary API (AC: #8)
  - [ ] On startup, store recovery summary in memory or config
  - [ ] Dashboard can display: "Recovered from crash: 2 agents were terminated"
  - [ ] Dismissible notification using shadcn Alert

## Dev Notes

### Crash Detection in Orchestrator

```typescript
// In AgentOrchestrator.spawn() -- add exit handler
bridge.process.on('close', (code: number | null) => {
  const status = code === 0 ? 'completed' : 'error'
  const errorMsg = code !== 0 ? `Process exited with code ${code}` : null

  agentRepo.update(this.db, id, {
    status,
    completedAt: Math.floor(Date.now() / 1000),
    errorMessage: errorMsg,
  })

  this.fileLockManager.releaseLocks(id)
  this.processes.delete(id)

  agentEventBus.emitAgentEvent(
    status === 'completed'
      ? { type: 'completed', agentId: id, filesModified: [] }
      : { type: 'error', agentId: id, error: errorMsg! }
  )
})

bridge.process.on('error', (err: Error) => {
  log.error('Agent process error', { agentId: id, error: err.message })
  agentRepo.update(this.db, id, {
    status: 'error',
    errorMessage: err.message,
    completedAt: Math.floor(Date.now() / 1000),
  })
  this.fileLockManager.releaseLocks(id)
  this.processes.delete(id)
})
```

### Startup Recovery

```typescript
// src/lib/agent/recovery.ts
import { eq, or } from 'drizzle-orm'
import { agents, fileLocks } from '@/lib/db/schema'

interface RecoverySummary {
  orphanedAgents: number
  releasedLocks: number
}

export function recoverFromCrash(db: Db): RecoverySummary {
  const now = Math.floor(Date.now() / 1000)

  // Find orphaned agents (still marked as running/paused but server restarted)
  const orphaned = db
    .select()
    .from(agents)
    .where(or(eq(agents.status, 'running'), eq(agents.status, 'paused')))
    .all()

  // Mark as error
  for (const agent of orphaned) {
    db.update(agents)
      .set({
        status: 'error',
        errorMessage: 'Agent terminated due to server restart',
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(agents.id, agent.id))
      .run()
  }

  // Release orphaned locks
  const activeLocks = db
    .select()
    .from(fileLocks)
    .where(isNull(fileLocks.releasedAt))
    .all()

  for (const lock of activeLocks) {
    db.update(fileLocks)
      .set({ releasedAt: now })
      .where(eq(fileLocks.id, lock.id))
      .run()
  }

  return {
    orphanedAgents: orphaned.length,
    releasedLocks: activeLocks.length,
  }
}
```

### Process Isolation

Node.js `child_process.spawn` provides natural process isolation:
- Each agent runs in a separate OS process
- A crash in one process does not affect the Node.js server or other agent processes
- The `close` event is always emitted, even on crashes (with exit code)
- The `error` event fires for spawn-level failures (ENOENT, EPERM)

### Critical Constraints

- Both `close` and `error` events must be handled -- they cover different failure modes
- `close` fires when the process exits (any reason); `error` fires when the process cannot be spawned or killed
- The `error` event may fire WITHOUT a subsequent `close` event in some cases -- handle both independently
- Recovery runs synchronously at startup BEFORE the server accepts requests
- Do NOT attempt to restart crashed agents automatically -- let the user decide
- Store the last N lines of stderr when a crash occurs for the error log display

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Section 8.3 - Error Recovery Strategies]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 5.5 - Agent Lifecycle State Machine]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.9]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
