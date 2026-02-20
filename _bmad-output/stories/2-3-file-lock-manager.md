# Story 2.3: File Lock Manager (Pre-Work Conflict Detection)

Status: ready-for-dev

## Story

As a user,
I want agents to declare file scope before starting,
so that conflicts are detected and prevented upfront.

## Acceptance Criteria

1. A `FileLockManager` class exists at `src/lib/agent/file-lock.ts`
2. `acquireLocks(agentId, filePaths, lockType)` acquires locks for multiple files atomically
3. Read lock: multiple agents can acquire read locks on the same file
4. Write lock: exclusive -- no other read or write locks allowed
5. If conflict detected, throws `AgentError.lockConflict(filePath, conflictingAgentId)`
6. Locks are stored in the `file_locks` table via the repository
7. `releaseLocks(agentId)` releases all locks held by an agent
8. On application startup, orphaned locks (from crashed agents) are cleaned up

## Tasks / Subtasks

- [ ] Task 1: Implement FileLockManager class (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Constructor takes `db` (Drizzle instance)
  - [ ] `acquireLocks(agentId, filePaths, lockType)` -- check conflicts for each file, then insert all locks
  - [ ] Read lock conflict check: only conflicts with existing write locks
  - [ ] Write lock conflict check: conflicts with any existing lock (read or write)
  - [ ] If any file conflicts, throw before inserting any locks (atomic: all-or-nothing)
  - [ ] `releaseLocks(agentId)` -- set `releasedAt` on all active locks for the agent
- [ ] Task 2: Implement lock query helpers (AC: #6)
  - [ ] `getActiveLocks(filePath)` -- find locks where releasedAt is null
  - [ ] `getAgentLocks(agentId)` -- find all active locks for an agent
  - [ ] `getConflicts(filePaths, lockType)` -- return list of conflicting locks
- [ ] Task 3: Implement orphan cleanup (AC: #8)
  - [ ] `cleanupOrphanedLocks()` -- release locks for agents with status error/completed
  - [ ] Call this on application startup (in db initialization or server startup)
- [ ] Task 4: Integrate with AgentOrchestrator
  - [ ] Before spawning agent: acquire locks for declared scope
  - [ ] On agent completion/termination/error: release all locks
  - [ ] Emit `fileLockReleased` event via AgentEventBus

## Dev Notes

### FileLockManager Implementation

```typescript
// src/lib/agent/file-lock.ts
import { eq, and, isNull } from 'drizzle-orm'
import { fileLocks } from '@/lib/db/schema'
import { AgentError } from '@/lib/errors'

export class FileLockManager {
  constructor(private db: Db) {}

  acquireLocks(agentId: string, filePaths: string[], lockType: 'read' | 'write') {
    // Check all files for conflicts FIRST (atomic check)
    for (const filePath of filePaths) {
      const active = this.db
        .select()
        .from(fileLocks)
        .where(and(eq(fileLocks.filePath, filePath), isNull(fileLocks.releasedAt)))
        .all()

      if (lockType === 'write' && active.length > 0) {
        throw AgentError.lockConflict(filePath, active[0].agentId)
      }
      if (lockType === 'read' && active.some(l => l.lockType === 'write')) {
        throw AgentError.lockConflict(filePath, active.find(l => l.lockType === 'write')!.agentId)
      }
    }

    // All checks passed -- insert all locks
    const now = Math.floor(Date.now() / 1000)
    for (const filePath of filePaths) {
      this.db.insert(fileLocks).values({
        id: crypto.randomUUID(),
        filePath,
        agentId,
        lockType,
        acquiredAt: now,
      }).run()
    }
  }

  releaseLocks(agentId: string) {
    const now = Math.floor(Date.now() / 1000)
    this.db
      .update(fileLocks)
      .set({ releasedAt: now })
      .where(and(eq(fileLocks.agentId, agentId), isNull(fileLocks.releasedAt)))
      .run()
  }

  cleanupOrphanedLocks() {
    // Find agents that are error/completed but still have active locks
    // Release those locks
  }
}
```

### Lock Semantics

| Existing Lock | New Read | New Write |
|---|---|---|
| None | Allowed | Allowed |
| Read (by other agent) | Allowed | **BLOCKED** |
| Write (by other agent) | **BLOCKED** | **BLOCKED** |
| Any (by same agent) | Allowed | Allowed |

Note: Same agent re-acquiring is allowed (idempotent). Different agent conflicts follow the matrix above.

### Integration with Orchestrator

The `AgentOrchestrator.spawn()` method should:
1. Validate scope is non-empty
2. Call `fileLockManager.acquireLocks(agentId, scope, 'write')`
3. If lock acquisition throws `LockConflict`, propagate to caller (API route returns 409)
4. If successful, proceed with subprocess spawn
5. On any exit: call `fileLockManager.releaseLocks(agentId)`

### Critical Constraints

- Lock acquisition must be atomic: if any file conflicts, NO locks should be inserted
- better-sqlite3 is synchronous, so the check-then-insert pattern is safe (no race conditions in single-threaded Node.js)
- Always release locks in the `close` event handler (even on crashes)
- The `releasedAt` column being null means the lock is active; non-null means released
- `cleanupOrphanedLocks` should run once on server startup, not on every request

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.2 - File Lock Manager]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 5.2 - File Locking Mechanism]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
