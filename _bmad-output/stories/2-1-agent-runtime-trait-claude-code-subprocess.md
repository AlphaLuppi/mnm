# Story 2.1: Agent Runtime & Claude Code Subprocess Spawn

Status: ready-for-dev

## Story

As a developer,
I want a clean abstraction for agent runtimes with Claude Code subprocess spawning,
so that I can integrate Claude Code now and other frameworks later.

## Acceptance Criteria

1. An `AgentOrchestrator` class exists at `src/lib/agent/orchestrator.ts` that manages agent lifecycle
2. A `ClaudeCodeBridge` class exists at `src/lib/agent/claude-code.ts` that spawns Claude Code as a subprocess
3. The orchestrator provides methods: `spawn`, `pause`, `resume`, `terminate`, `getStatus`, `list`
4. `spawn` uses Node.js `child_process.spawn` to start the `claude` CLI with spec file and scope arguments
5. `spawn` captures stdin, stdout, and stderr streams from the subprocess
6. If spawn fails (e.g., `claude` not installed), throws `AgentError.spawnFailed` with clear message
7. Agent state (id, name, status, specId, scope) is persisted to the `agents` table via the repository
8. The orchestrator tracks running processes in-memory via a `Map<string, ChildProcess>`

## Tasks / Subtasks

- [ ] Task 1: Create ClaudeCodeBridge class (AC: #2, #4, #5)
  - [ ] Implement `static spawn(specPath, scope, repoRoot)` using `child_process.spawn`
  - [ ] Configure subprocess: `stdio: ['pipe', 'pipe', 'pipe']`, inherit `process.env`
  - [ ] Store `ChildProcess` reference, expose `stdout`, `stderr`, `stdin` streams
  - [ ] Implement `terminate()` that sends SIGTERM
  - [ ] Implement `pause()` that sends SIGSTOP and `resume()` that sends SIGCONT
  - [ ] Handle subprocess `exit` and `error` events
- [ ] Task 2: Create AgentOrchestrator class (AC: #1, #3, #7, #8)
  - [ ] Constructor takes `db` (Drizzle instance) as dependency
  - [ ] Implement `spawn(specId, agentType, scope)`: create DB record, spawn subprocess, store in process map
  - [ ] Implement `terminate(agentId)`: send SIGTERM, update DB status, remove from process map
  - [ ] Implement `pause(agentId)` and `resume(agentId)`: delegate to bridge, update DB
  - [ ] Implement `getStatus(agentId)`: return agent record from DB
  - [ ] Implement `list()`: return all agents from DB
  - [ ] Implement `getProcess(agentId)`: return ChildProcess for SSE log streaming
- [ ] Task 3: Handle spawn errors (AC: #6)
  - [ ] Catch ENOENT (claude CLI not found) and throw `AgentError.spawnFailed`
  - [ ] Catch EACCES (permission denied) and throw `AgentError.spawnFailed`
  - [ ] Log all spawn errors with context (specId, scope, error message)
- [ ] Task 4: Create API route for agent operations (AC: #3)
  - [ ] `POST /api/agents` -- spawn new agent (body: specId, agentType, scope)
  - [ ] `GET /api/agents` -- list all agents
  - [ ] `GET /api/agents/[id]` -- get agent detail
  - [ ] `PATCH /api/agents/[id]` -- pause/resume/terminate (body: action)
  - [ ] `DELETE /api/agents/[id]` -- terminate and cleanup

## Dev Notes

### File Structure

```
src/lib/agent/
├── index.ts              # Barrel exports
├── orchestrator.ts       # AgentOrchestrator class
├── claude-code.ts        # ClaudeCodeBridge class
├── event-bus.ts          # AgentEventBus (Story 2.2 prep)
└── file-lock.ts          # FileLockManager (Story 2.3)

src/app/api/agents/
├── route.ts              # GET (list), POST (spawn)
└── [id]/
    ├── route.ts          # GET (detail), PATCH (control), DELETE (terminate)
    └── logs/
        └── route.ts      # GET (SSE stream - Story 2.6)
```

### ClaudeCodeBridge Implementation

```typescript
// src/lib/agent/claude-code.ts
import { spawn, type ChildProcess } from 'child_process'
import { AgentError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger({ module: 'claude-code' })

export class ClaudeCodeBridge {
  private constructor(public readonly process: ChildProcess) {}

  static spawn(specPath: string, scope: string[], repoRoot: string): ClaudeCodeBridge {
    try {
      const child = spawn('claude', [
        '--print',
        '--output-format', 'stream-json',
        '-p', `Implement the spec at ${specPath}. Only modify files in scope: ${scope.join(', ')}`,
      ], {
        cwd: repoRoot,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      child.on('error', (err) => {
        log.error('Subprocess error', { error: err.message, specPath })
      })

      return new ClaudeCodeBridge(child)
    } catch (err) {
      throw AgentError.spawnFailed(
        err instanceof Error ? err.message : 'Unknown error spawning claude CLI'
      )
    }
  }

  get stdout() { return this.process.stdout }
  get stderr() { return this.process.stderr }
  get stdin() { return this.process.stdin }
  get pid() { return this.process.pid }

  pause(): void {
    this.process.kill('SIGSTOP')
  }

  resume(): void {
    this.process.kill('SIGCONT')
  }

  terminate(): void {
    this.process.kill('SIGTERM')
  }

  get exitCode(): number | null {
    return this.process.exitCode
  }
}
```

### AgentOrchestrator Pattern

```typescript
// src/lib/agent/orchestrator.ts
import { ClaudeCodeBridge } from './claude-code'
import * as agentRepo from '@/lib/db/repositories/agents'
import type { ChildProcess } from 'child_process'

export class AgentOrchestrator {
  private processes = new Map<string, ClaudeCodeBridge>()

  constructor(private db: Db) {}

  spawn(specId: string, agentType: string, scope: string[]): Agent {
    const id = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // Create DB record
    const agent = agentRepo.insert(this.db, {
      id,
      name: `${agentType} Agent`,
      status: 'running',
      specId,
      scope: JSON.stringify(scope),
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    // Spawn subprocess
    const bridge = ClaudeCodeBridge.spawn(specPath, scope, repoRoot)
    this.processes.set(id, bridge)

    // Handle exit
    bridge.process.on('close', (code) => {
      const status = code === 0 ? 'completed' : 'error'
      agentRepo.update(this.db, id, {
        status,
        completedAt: Math.floor(Date.now() / 1000),
        errorMessage: code !== 0 ? `Process exited with code ${code}` : null,
      })
      this.processes.delete(id)
    })

    return agent
  }

  getProcess(agentId: string): ClaudeCodeBridge | undefined {
    return this.processes.get(agentId)
  }
}
```

### API Route Pattern

```typescript
// src/app/api/agents/route.ts
import { NextResponse } from 'next/server'
import { getOrchestrator } from '@/lib/agent'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { specId, agentType, scope } = body
    const agent = getOrchestrator().spawn(specId, agentType, scope)
    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    // Error handling per architecture-web.md Section 11.2
  }
}
```

### Critical Constraints

- The `claude` CLI must be installed and in PATH -- spawn will throw ENOENT if not found
- Use `spawn` (not `exec`) to get streaming stdout/stderr access
- `stdio: ['pipe', 'pipe', 'pipe']` is required for IPC and log streaming
- Store processes in-memory Map -- they are NOT serializable to DB
- Agent DB records persist across server restarts; in-memory process map does not (handled by Story 2.9)
- SIGSTOP/SIGCONT are Unix-only; on Windows, pause/resume will need alternative implementation (acceptable for POC)
- The orchestrator should be a singleton (one instance per server process)

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.1 - Claude Code Subprocess]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5.1 - Route Overview]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 5.4 - Claude Code Integration]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
