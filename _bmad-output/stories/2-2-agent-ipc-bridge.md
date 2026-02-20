# Story 2.2: Agent IPC Bridge (JSON Messages over stdin/stdout)

Status: ready-for-dev

## Story

As a developer,
I want bidirectional communication with Claude Code agents via stdin/stdout,
so that I can send commands and receive structured status updates.

## Acceptance Criteria

1. The `ClaudeCodeBridge` can write JSON messages to the subprocess stdin
2. stdout output is parsed line-by-line and emitted as typed events
3. stderr output is captured separately for error logging
4. If the subprocess exits unexpectedly, agent status is updated to `error` in the database
5. IPC errors are logged with full context and surfaced as `AgentError`
6. An `AgentEventBus` (Node.js EventEmitter) broadcasts agent lifecycle events to subscribers
7. The event bus supports events: started, progress, completed, error, fileLockReleased

## Tasks / Subtasks

- [ ] Task 1: Implement stdout/stderr stream processing (AC: #2, #3)
  - [ ] Add `onStdout(callback)` method to ClaudeCodeBridge that emits parsed line data
  - [ ] Add `onStderr(callback)` method for error stream capture
  - [ ] Buffer partial lines (stream chunks may split across line boundaries)
  - [ ] Parse JSON lines from stdout when claude uses `--output-format stream-json`
- [ ] Task 2: Implement stdin command sending (AC: #1)
  - [ ] Add `sendCommand(data: string)` method that writes to subprocess stdin
  - [ ] Handle backpressure (stdin.write returns false)
- [ ] Task 3: Handle unexpected subprocess exit (AC: #4, #5)
  - [ ] Listen for `close` event on subprocess
  - [ ] On non-zero exit code: update agent status to `error` in DB, log error
  - [ ] On zero exit code: update status to `completed`
  - [ ] Release file locks on any exit (delegate to FileLockManager in Story 2.3)
- [ ] Task 4: Create AgentEventBus (AC: #6, #7)
  - [ ] Create `src/lib/agent/event-bus.ts` using Node.js EventEmitter
  - [ ] Define typed events: AgentStarted, AgentProgress, AgentCompleted, AgentError, FileLockReleased
  - [ ] Wire orchestrator to emit events on state changes
  - [ ] Export singleton `agentEventBus` instance
- [ ] Task 5: Integrate event bus with orchestrator
  - [ ] Emit `started` when agent spawns
  - [ ] Emit `progress` on meaningful stdout lines
  - [ ] Emit `completed` or `error` on subprocess exit
  - [ ] Emit `fileLockReleased` when locks are freed

## Dev Notes

### Stream Processing Pattern

```typescript
// Buffered line reader for subprocess stdout
import { createInterface } from 'readline'

function processStdout(bridge: ClaudeCodeBridge, onLine: (line: string) => void) {
  if (!bridge.stdout) return

  const rl = createInterface({ input: bridge.stdout })
  rl.on('line', (line) => {
    try {
      const parsed = JSON.parse(line)
      onLine(parsed)
    } catch {
      // Not JSON -- treat as plain text log line
      onLine(line)
    }
  })
}
```

### AgentEventBus Implementation

```typescript
// src/lib/agent/event-bus.ts
import { EventEmitter } from 'events'

export type AgentEvent =
  | { type: 'started'; agentId: string; specId: string }
  | { type: 'progress'; agentId: string; message: string }
  | { type: 'completed'; agentId: string; filesModified: string[] }
  | { type: 'error'; agentId: string; error: string }
  | { type: 'fileLockReleased'; filePath: string }

class AgentEventBus extends EventEmitter {
  emitAgentEvent(event: AgentEvent) {
    this.emit('agent-event', event)
    this.emit(event.type, event)
  }

  onAgentEvent(handler: (event: AgentEvent) => void) {
    this.on('agent-event', handler)
    return () => this.off('agent-event', handler)
  }
}

export const agentEventBus = new AgentEventBus()
```

### Claude CLI Output Formats

When using `claude --output-format stream-json`, stdout produces JSON lines:
```json
{"type":"assistant","message":{"content":[{"type":"text","text":"Working on..."}]}}
{"type":"result","result":"completed","cost":{"input_tokens":1000,"output_tokens":500}}
```

When using `claude --print`, stdout is plain text output.

For the POC, start with `--print` mode (simpler) and upgrade to `stream-json` later.

### Critical Constraints

- Use `readline.createInterface` for line-by-line stream processing (handles buffering correctly)
- The `close` event fires AFTER all stdout/stderr data has been consumed
- EventEmitter is synchronous by default -- handlers run in the order they were registered
- Keep the event bus as a singleton module-level export (not a class constructor)
- Do NOT import the event bus in client components -- it's server-only (Node.js EventEmitter)
- Subprocess streams may emit data as Buffer -- always call `.toString()` before processing

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.1 - Claude Code Subprocess]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.3 - Agent Event Bus]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 5.4 - IPC Protocol]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
