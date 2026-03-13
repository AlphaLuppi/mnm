# Story 2.7: Agent Control Actions (Pause, Resume, Terminate)

Status: ready-for-dev

## Story

As a user,
I want to pause, resume, or terminate agents,
so that I can control agent execution when needed.

## Acceptance Criteria

1. Clicking "Pause" on a running agent sends SIGSTOP to the subprocess and updates status to `paused`
2. Clicking "Resume" on a paused agent sends SIGCONT and updates status to `running`
3. Clicking "Terminate" sends SIGTERM, releases file locks, and updates status to `completed` (exit 0) or `error` (non-zero)
4. UI buttons update immediately to reflect new state (Pause button becomes Resume, etc.)
5. Terminate shows a confirmation dialog before proceeding
6. Agent record persists in the database for history after termination
7. The `PATCH /api/agents/[id]` endpoint handles `pause`, `resume`, and `terminate` actions

## Tasks / Subtasks

- [ ] Task 1: Implement PATCH API route (AC: #1, #2, #3, #7)
  - [ ] Create/update `src/app/api/agents/[id]/route.ts` PATCH handler
  - [ ] Accept body: `{ action: 'pause' | 'resume' | 'terminate' }`
  - [ ] For `pause`: call `bridge.pause()` (SIGSTOP), update DB status to `paused`
  - [ ] For `resume`: call `bridge.resume()` (SIGCONT), update DB status to `running`
  - [ ] For `terminate`: call `bridge.terminate()` (SIGTERM), release locks, await exit, update DB
  - [ ] Return updated agent record
- [ ] Task 2: Create agent control buttons component (AC: #4)
  - [ ] Create `src/components/agents/agent-controls.tsx`
  - [ ] Show Pause button when status is `running`
  - [ ] Show Resume button when status is `paused`
  - [ ] Show Terminate button for any active status (running, paused)
  - [ ] Disable buttons during action (loading state)
  - [ ] Use SWR `mutate` for optimistic UI update
- [ ] Task 3: Create terminate confirmation dialog (AC: #5)
  - [ ] Use shadcn AlertDialog component
  - [ ] Message: "Terminate {agentName}? This will stop the agent and release all file locks."
  - [ ] Actions: "Cancel" and "Terminate" (destructive variant)
- [ ] Task 4: Implement lock release on terminate (AC: #3, #6)
  - [ ] Call `fileLockManager.releaseLocks(agentId)` in the terminate handler
  - [ ] Emit `fileLockReleased` events via AgentEventBus
  - [ ] Ensure agent record remains in DB with final status

## Dev Notes

### Process Signal Reference

| Action | Signal | Effect |
|---|---|---|
| Pause | `SIGSTOP` | Suspends the process (cannot be caught or ignored) |
| Resume | `SIGCONT` | Resumes a stopped process |
| Terminate | `SIGTERM` | Requests graceful termination (can be caught) |
| Force Kill | `SIGKILL` | Immediately kills (fallback if SIGTERM fails after timeout) |

### API Route Implementation

```typescript
// src/app/api/agents/[id]/route.ts
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { action } = await request.json()
  const orchestrator = getOrchestrator()

  switch (action) {
    case 'pause':
      orchestrator.pause(id)
      break
    case 'resume':
      orchestrator.resume(id)
      break
    case 'terminate':
      orchestrator.terminate(id)
      break
    default:
      return Response.json(
        { error: { code: 'INVALID_ACTION', message: `Unknown action: ${action}` } },
        { status: 400 }
      )
  }

  const agent = orchestrator.getStatus(id)
  return Response.json(agent)
}
```

### Control Buttons Component

```tsx
// src/components/agents/agent-controls.tsx
'use client'

export function AgentControls({ agent, onAction }: Props) {
  const isActive = agent.status === 'running' || agent.status === 'paused'

  return (
    <div className="flex gap-2">
      {agent.status === 'running' && (
        <Button variant="outline" size="sm" onClick={() => onAction('pause')}>
          <Pause className="h-4 w-4 mr-1" /> Pause
        </Button>
      )}
      {agent.status === 'paused' && (
        <Button variant="outline" size="sm" onClick={() => onAction('resume')}>
          <Play className="h-4 w-4 mr-1" /> Resume
        </Button>
      )}
      {isActive && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Square className="h-4 w-4 mr-1" /> Terminate
            </Button>
          </AlertDialogTrigger>
          {/* ... confirmation dialog content */}
        </AlertDialog>
      )}
    </div>
  )
}
```

### Terminate with Timeout

If SIGTERM does not cause the process to exit within 5 seconds, escalate to SIGKILL:

```typescript
async terminate(agentId: string): Promise<void> {
  const bridge = this.processes.get(agentId)
  if (!bridge) return

  bridge.terminate() // SIGTERM

  const timeout = setTimeout(() => {
    bridge.process.kill('SIGKILL') // Force kill after 5s
  }, 5000)

  bridge.process.on('close', () => {
    clearTimeout(timeout)
    this.fileLockManager.releaseLocks(agentId)
    this.processes.delete(agentId)
  })
}
```

### Critical Constraints

- SIGSTOP/SIGCONT are Unix-only -- on Windows these signals do not exist (acceptable for macOS/Linux POC)
- `process.kill(signal)` in Node.js sends the signal to the process; it does NOT kill it (despite the method name)
- SIGSTOP cannot be caught or blocked by the target process -- it always works
- Always release file locks after terminate, regardless of exit code
- The DB update must happen AFTER the process actually exits (listen for `close` event)
- Use optimistic UI updates: change button state immediately, revert if API call fails

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.1 - subprocess control]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 5.5 - Agent Lifecycle State Machine]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
