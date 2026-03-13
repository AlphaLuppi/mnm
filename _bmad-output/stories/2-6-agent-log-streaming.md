# Story 2.6: Agent Log Streaming (Real-Time stdout/stderr via SSE)

Status: ready-for-dev

## Story

As a user,
I want to see agent logs in real-time,
so that I can monitor progress and debug issues.

## Acceptance Criteria

1. Clicking an agent in the dashboard opens an expandable log panel
2. Logs stream in real-time from the agent's stdout/stderr via Server-Sent Events
3. The SSE endpoint is `GET /api/agents/[id]/logs`
4. Logs distinguish between stdout and stderr (different styling)
5. Logs auto-scroll to the latest entry with an option to pause auto-scroll
6. Logs persist after agent completion (displayed from stored log data)
7. Log rendering handles large output without freezing the browser

## Tasks / Subtasks

- [ ] Task 1: Create SSE API route (AC: #2, #3)
  - [ ] Create `src/app/api/agents/[id]/logs/route.ts`
  - [ ] Implement GET handler that returns a ReadableStream with SSE format
  - [ ] Pipe subprocess stdout/stderr to SSE events with type annotation
  - [ ] Close the stream when subprocess exits (send exit event)
  - [ ] Set headers: Content-Type text/event-stream, Cache-Control no-cache, Connection keep-alive
- [ ] Task 2: Create AgentLogViewer component (AC: #1, #4, #7)
  - [ ] Create `src/components/agents/agent-log-viewer.tsx`
  - [ ] Use shadcn ScrollArea for the log container
  - [ ] Connect to SSE endpoint via `EventSource` API
  - [ ] Render stdout lines in default color, stderr lines in red/amber
  - [ ] Use virtualization or limit displayed lines (last 1000) for performance
- [ ] Task 3: Implement auto-scroll behavior (AC: #5)
  - [ ] Auto-scroll to bottom on new log entries
  - [ ] Detect when user scrolls up -- pause auto-scroll
  - [ ] Show "Scroll to bottom" button when auto-scroll is paused
  - [ ] Resume auto-scroll when user clicks the button or scrolls to bottom
- [ ] Task 4: Handle completed agents (AC: #6)
  - [ ] If agent is completed/error, display stored logs (not SSE)
  - [ ] Store log output to a file at `.mnm/logs/{agentId}.log` during streaming
  - [ ] Read log file for completed agents and display in the same viewer
- [ ] Task 5: Integrate log panel with dashboard
  - [ ] Add expandable row or sheet panel to the agent table
  - [ ] Click agent row to toggle log viewer visibility

## Dev Notes

### SSE API Route Implementation

```typescript
// src/app/api/agents/[id]/logs/route.ts
import { getOrchestrator } from '@/lib/agent'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const orchestrator = getOrchestrator()
  const bridge = orchestrator.getProcess(id)

  if (!bridge) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Agent not found or not running' } }, { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (type: string, content: string) => {
        const data = JSON.stringify({ type, content, timestamp: Date.now() })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      bridge.stdout?.on('data', (chunk: Buffer) => {
        sendEvent('stdout', chunk.toString())
      })

      bridge.stderr?.on('data', (chunk: Buffer) => {
        sendEvent('stderr', chunk.toString())
      })

      bridge.process.on('close', (code: number | null) => {
        sendEvent('exit', JSON.stringify({ code }))
        controller.close()
      })

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

### Client-Side EventSource Hook

```typescript
// src/hooks/use-agent-logs.ts
'use client'
import { useState, useEffect, useRef } from 'react'

interface LogEntry {
  type: 'stdout' | 'stderr' | 'exit'
  content: string
  timestamp: number
}

export function useAgentLogs(agentId: string, isRunning: boolean) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!isRunning) return

    const es = new EventSource(`/api/agents/${agentId}/logs`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      const entry: LogEntry = JSON.parse(event.data)
      setLogs(prev => [...prev, entry])
    }

    es.onerror = () => {
      es.close()
    }

    return () => es.close()
  }, [agentId, isRunning])

  return { logs }
}
```

### Log Storage Pattern

During streaming, also write logs to a file:

```typescript
import { createWriteStream, mkdirSync } from 'fs'
import { join } from 'path'

function createLogWriter(agentId: string, repoRoot: string) {
  const logsDir = join(repoRoot, '.mnm', 'logs')
  mkdirSync(logsDir, { recursive: true })
  return createWriteStream(join(logsDir, `${agentId}.log`), { flags: 'a' })
}
```

### Critical Constraints

- SSE uses `text/event-stream` content type -- Next.js Route Handlers support this via ReadableStream
- EventSource reconnects automatically on connection drop (browser-native behavior)
- Limit in-memory log entries on the client (e.g., last 1000 lines) to prevent memory bloat
- The SSE endpoint should handle client disconnection gracefully (listen for `request.signal` abort)
- Completed agents should NOT create an EventSource -- read from stored log file instead
- ANSI color codes from the subprocess should be stripped or converted to HTML for display
- Consider using a monospace font (`font-mono` in Tailwind) for log output

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 6.1 - SSE for Agent Logs]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#ADR-W03 - Server-Sent Events]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
