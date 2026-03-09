# Story 2.1: Agent Harness — Lancer & Arreter des Agents

Status: ready-for-dev

## Story

As a **user**,
I want **to launch a Claude Code agent on a task and stop it when needed**,
So that **I can control agent execution directly from MnM**.

## Acceptance Criteria

### AC1 — Launch agent via subprocess spawn

**Given** un projet est ouvert
**When** je clique sur "Lancer un agent" et je specifie une tache
**Then** MnM spawne un process Claude Code CLI en subprocess
**And** le stdout/stderr est intercepte en temps reel (< 500ms, NFR8)
**And** l'agent apparait dans la liste des agents actifs

### AC2 — Stop agent gracefully

**Given** un agent est en cours d'execution
**When** je clique sur "Arreter" sur cet agent
**Then** le process est termine proprement (SIGTERM puis SIGKILL apres timeout)
**And** le statut passe a "termine"

### AC3 — Natural process completion

**Given** un agent est lance
**When** le process se termine naturellement
**Then** le statut passe a "termine" automatiquement
**And** le timestamp de fin est enregistre

### AC4 — Process crash detection

**Given** un agent est lance
**When** le process crash (exit code non-zero)
**Then** le statut passe a "bloque" avec l'indicateur rouge
**And** le dernier output stderr est accessible

## Tasks / Subtasks

- [ ] Task 1: Create shared agent types (AC: #1, #2, #3, #4)
  - [ ] 1.1 Create `src/shared/types/agent.types.ts` with `AgentStatus` enum, `AgentInfo` type, `AgentLaunchParams` type
  - [ ] 1.2 Create `src/shared/types/chat.types.ts` with `ChatEntry` type, `ChatRole` type
  - [ ] 1.3 Add agent IPC channels to `src/shared/ipc-channels.ts` if not already present: `agent:launch`, `agent:stop`, `agent:list`
  - [ ] 1.4 Add agent stream channels: `stream:agent-output`, `stream:agent-status`, `stream:agent-chat`
  - [ ] 1.5 Add agent events to `src/shared/events.ts`: `agent:output`, `agent:status`, `agent:chat-entry`

- [ ] Task 2: Implement stdout-parser.ts (AC: #1)
  - [ ] 2.1 Create `src/main/services/agent/stdout-parser.ts`
  - [ ] 2.2 Implement `StdoutParser` class that receives raw stdout chunks and emits structured events
  - [ ] 2.3 Detect Claude Code markers: assistant responses, tool calls, tool results, system messages
  - [ ] 2.4 Handle partial line buffering (chunks may split mid-line)
  - [ ] 2.5 Create `src/main/services/agent/stdout-parser.test.ts` with test cases for each marker type

- [ ] Task 3: Implement chat-segmenter.ts (AC: #1)
  - [ ] 3.1 Create `src/main/services/agent/chat-segmenter.ts`
  - [ ] 3.2 Implement `ChatSegmenter` class that converts parsed stdout into `ChatEntry[]`
  - [ ] 3.3 Assign roles (user/assistant/system) based on stdout parser output
  - [ ] 3.4 Detect and tag checkpoints (task completions, file writes, tool usage milestones)
  - [ ] 3.5 Generate unique IDs and timestamps for each entry
  - [ ] 3.6 Create `src/main/services/agent/chat-segmenter.test.ts`

- [ ] Task 4: Implement agent-harness.service.ts (AC: #1, #2, #3, #4)
  - [ ] 4.1 Create `src/main/services/agent/agent-harness.service.ts`
  - [ ] 4.2 Implement `launchAgent(params: AgentLaunchParams)`: spawn `claude` CLI via `child_process.spawn()`
  - [ ] 4.3 Capture stdout/stderr streams, pipe through StdoutParser and ChatSegmenter
  - [ ] 4.4 Manage agent registry (Map<string, AgentProcess>) tracking all active agents
  - [ ] 4.5 Implement `stopAgent(agentId: string)`: send SIGTERM, wait grace period (5s), then SIGKILL
  - [ ] 4.6 Handle process `close` event: update status to STOPPED (exit 0) or CRASHED (exit non-zero)
  - [ ] 4.7 Handle process `error` event: update status to CRASHED, store stderr
  - [ ] 4.8 Emit events via main event bus: `agent:output`, `agent:status`, `agent:chat-entry`
  - [ ] 4.9 Store agent session data in `.mnm/agent-history/session-{timestamp}.json`
  - [ ] 4.10 Create `src/main/services/agent/agent-harness.service.test.ts`

- [ ] Task 5: Register IPC handlers (AC: #1, #2)
  - [ ] 5.1 Add `agent:launch` handler in `src/main/ipc/handlers.ts`
  - [ ] 5.2 Add `agent:stop` handler in `src/main/ipc/handlers.ts`
  - [ ] 5.3 Add `agent:list` handler returning current agent registry state
  - [ ] 5.4 Wire event bus events to IPC streams in `src/main/ipc/streams.ts`: `agent:output` -> `stream:agent-output`, `agent:status` -> `stream:agent-status`, `agent:chat-entry` -> `stream:agent-chat`

- [ ] Task 6: Agent types file (AC: #1, #2, #3, #4)
  - [ ] 6.1 Create `src/main/services/agent/agent.types.ts` with internal process types (AgentProcess, SpawnOptions)
  - [ ] 6.2 Ensure separation between shared types (renderer-safe) and main-only types (Node.js-specific)

- [ ] Task 7: Integration tests (AC: #1, #2, #3, #4)
  - [ ] 7.1 Write integration test: launch agent -> receives stdout -> status is ACTIVE
  - [ ] 7.2 Write integration test: stop agent -> SIGTERM sent -> status is STOPPED
  - [ ] 7.3 Write integration test: process exits naturally -> status is STOPPED
  - [ ] 7.4 Write integration test: process crashes -> status is CRASHED, stderr captured
  - [ ] 7.5 Write test: concurrent agents tracked independently

## Dev Notes

### FRs Covered

- **FR6**: L'utilisateur peut lancer un agent sur une tache depuis MnM
- **FR7**: L'utilisateur peut arreter un agent en cours d'execution
- **FR1** (partial): Agent apparait dans la liste des agents actifs (harness side)
- **FR2** (partial): Agent status tracking enables health indicators (harness side)

### Dependencies on Previous Stories

- **Story 1.1**: IPC bridge, event bus, shared types infrastructure, import aliases, logger
- Requires `src/shared/ipc-channels.ts`, `src/shared/events.ts`, `src/main/utils/event-bus.ts`, `src/main/utils/logger.ts` to exist

### Architecture Overview

The Agent Harness is the core main-process service that manages Claude Code CLI subprocesses. It sits in the main process and communicates with the renderer exclusively through the IPC bridge established in Story 1.1.

```
Renderer                    Main Process
   |                           |
   |-- agent:launch IPC -->    |
   |                    AgentHarnessService.launchAgent()
   |                           |
   |                    child_process.spawn('claude', [...args])
   |                           |
   |                    StdoutParser (raw chunks -> structured events)
   |                           |
   |                    ChatSegmenter (structured events -> ChatEntry[])
   |                           |
   |                    Event Bus (agent:output, agent:status, agent:chat-entry)
   |                           |
   |<-- stream:agent-output ---|
   |<-- stream:agent-status ---|
   |<-- stream:agent-chat -----|
```

### Shared Types

```typescript
// src/shared/types/agent.types.ts

export enum AgentStatus {
  LAUNCHING = 'LAUNCHING',
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  CRASHED = 'CRASHED',
}

export type AgentInfo = {
  id: string;
  task: string;
  status: AgentStatus;
  contextFiles: string[];
  startedAt: number;
  stoppedAt?: number;
  lastOutputAt?: number;
  lastError?: string;
  progress?: {
    completed: number;
    total: number;
  };
};

export type AgentLaunchParams = {
  task: string;
  context: string[];
  workingDirectory?: string;
};
```

```typescript
// src/shared/types/chat.types.ts

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatEntry = {
  id: string;
  agentId: string;
  role: ChatRole;
  content: string;
  checkpoint?: string;
  timestamp: number;
};
```

### IPC Channels to Add/Verify

```typescript
// Additions to src/shared/ipc-channels.ts

// In IpcInvokeChannels:
'agent:launch': { args: AgentLaunchParams; result: { agentId: string } };
'agent:stop': { args: { agentId: string }; result: void };
'agent:list': { args: void; result: AgentInfo[] };
'agent:get-chat': { args: { agentId: string; fromCheckpoint?: string }; result: ChatEntry[] };

// In IpcStreamChannels:
'stream:agent-output': { agentId: string; data: string; timestamp: number };
'stream:agent-status': { agentId: string; status: AgentStatus; lastError?: string };
'stream:agent-chat': ChatEntry;
```

### Event Bus Events to Add/Verify

```typescript
// Additions to src/shared/events.ts

// In MainEvents:
'agent:output': { agentId: string; data: string; timestamp: number };
'agent:status': { agentId: string; status: AgentStatus; lastError?: string };
'agent:chat-entry': ChatEntry;
```

### StdoutParser Implementation

```typescript
// src/main/services/agent/stdout-parser.ts
import { EventEmitter } from 'node:events';

type StdoutEvent =
  | { type: 'text'; role: ChatRole; content: string }
  | { type: 'tool-call'; tool: string; args: string }
  | { type: 'tool-result'; tool: string; result: string }
  | { type: 'checkpoint'; label: string }
  | { type: 'error'; message: string };

export class StdoutParser extends EventEmitter {
  private buffer = '';

  /**
   * Feed raw stdout data chunks. The parser buffers partial lines
   * and emits structured events when complete lines are detected.
   *
   * Claude Code CLI outputs JSON-structured messages when run with
   * appropriate flags. The parser handles:
   * - Assistant text responses
   * - Tool call invocations (file edits, bash commands, etc.)
   * - Tool results
   * - System messages and errors
   */
  feed(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    // Keep the last potentially incomplete line in the buffer
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim() === '') continue;
      this.parseLine(line.trim());
    }
  }

  /**
   * Flush remaining buffer content (call on process close).
   */
  flush(): void {
    if (this.buffer.trim()) {
      this.parseLine(this.buffer.trim());
      this.buffer = '';
    }
  }

  private parseLine(line: string): void {
    // Try JSON parsing first (Claude Code structured output)
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed === 'object' && parsed !== null) {
        this.handleJsonMessage(parsed as Record<string, unknown>);
        return;
      }
    } catch {
      // Not JSON — treat as plain text
    }

    // Plain text fallback
    this.emit('event', { type: 'text', role: 'assistant', content: line } satisfies StdoutEvent);
  }

  private handleJsonMessage(msg: Record<string, unknown>): void {
    // Adapt to Claude Code CLI output format
    // The exact format depends on the CLI version and flags used
    const msgType = msg['type'] as string | undefined;

    switch (msgType) {
      case 'assistant':
        this.emit('event', {
          type: 'text',
          role: 'assistant',
          content: String(msg['content'] ?? ''),
        } satisfies StdoutEvent);
        break;
      case 'user':
        this.emit('event', {
          type: 'text',
          role: 'user',
          content: String(msg['content'] ?? ''),
        } satisfies StdoutEvent);
        break;
      case 'system':
        this.emit('event', {
          type: 'text',
          role: 'system',
          content: String(msg['content'] ?? ''),
        } satisfies StdoutEvent);
        break;
      case 'tool_use':
        this.emit('event', {
          type: 'tool-call',
          tool: String(msg['name'] ?? 'unknown'),
          args: JSON.stringify(msg['input'] ?? {}),
        } satisfies StdoutEvent);
        break;
      case 'tool_result':
        this.emit('event', {
          type: 'tool-result',
          tool: String(msg['name'] ?? 'unknown'),
          result: String(msg['content'] ?? ''),
        } satisfies StdoutEvent);
        // Detect checkpoint-worthy tool results
        this.detectCheckpoint(msg);
        break;
      default:
        this.emit('event', {
          type: 'text',
          role: 'system',
          content: line,
        } satisfies StdoutEvent);
    }
  }

  private detectCheckpoint(msg: Record<string, unknown>): void {
    // Checkpoint heuristics: file writes, task completions
    const tool = String(msg['name'] ?? '');
    if (['Write', 'Edit', 'NotebookEdit'].includes(tool)) {
      this.emit('event', {
        type: 'checkpoint',
        label: `File modified via ${tool}`,
      } satisfies StdoutEvent);
    }
  }
}

export type { StdoutEvent };
```

### ChatSegmenter Implementation

```typescript
// src/main/services/agent/chat-segmenter.ts
import { randomUUID } from 'node:crypto';
import type { ChatEntry } from '@shared/types/chat.types';
import type { StdoutEvent } from './stdout-parser';

export class ChatSegmenter {
  private entries: ChatEntry[] = [];
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  /**
   * Process a parsed stdout event and convert it to a ChatEntry
   * if applicable. Returns the entry if one was created, null otherwise.
   */
  process(event: StdoutEvent): ChatEntry | null {
    switch (event.type) {
      case 'text': {
        const entry: ChatEntry = {
          id: randomUUID(),
          agentId: this.agentId,
          role: event.role,
          content: event.content,
          timestamp: Date.now(),
        };
        this.entries.push(entry);
        return entry;
      }
      case 'tool-call': {
        const entry: ChatEntry = {
          id: randomUUID(),
          agentId: this.agentId,
          role: 'assistant',
          content: `[Tool Call: ${event.tool}]\n${event.args}`,
          timestamp: Date.now(),
        };
        this.entries.push(entry);
        return entry;
      }
      case 'tool-result': {
        const entry: ChatEntry = {
          id: randomUUID(),
          agentId: this.agentId,
          role: 'system',
          content: `[Tool Result: ${event.tool}]\n${event.result}`,
          timestamp: Date.now(),
        };
        this.entries.push(entry);
        return entry;
      }
      case 'checkpoint': {
        const entry: ChatEntry = {
          id: randomUUID(),
          agentId: this.agentId,
          role: 'system',
          content: event.label,
          checkpoint: `cp-${randomUUID().slice(0, 8)}`,
          timestamp: Date.now(),
        };
        this.entries.push(entry);
        return entry;
      }
      case 'error': {
        const entry: ChatEntry = {
          id: randomUUID(),
          agentId: this.agentId,
          role: 'system',
          content: `[Error] ${event.message}`,
          timestamp: Date.now(),
        };
        this.entries.push(entry);
        return entry;
      }
      default:
        return null;
    }
  }

  /**
   * Get all entries, optionally filtered from a checkpoint.
   */
  getEntries(fromCheckpoint?: string): ChatEntry[] {
    if (!fromCheckpoint) return [...this.entries];

    const idx = this.entries.findIndex((e) => e.checkpoint === fromCheckpoint);
    if (idx === -1) return [...this.entries];
    return this.entries.slice(idx);
  }

  /**
   * Get the total number of entries.
   */
  get size(): number {
    return this.entries.length;
  }
}
```

### AgentHarnessService Implementation

```typescript
// src/main/services/agent/agent-harness.service.ts
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { AgentStatus } from '@shared/types/agent.types';
import type { AgentInfo, AgentLaunchParams } from '@shared/types/agent.types';
import type { ChatEntry } from '@shared/types/chat.types';
import { StdoutParser } from './stdout-parser';
import { ChatSegmenter } from './chat-segmenter';
// import { mainEventBus } from '@main/utils/event-bus';
// import { logger } from '@main/utils/logger';

type AgentProcess = {
  info: AgentInfo;
  process: ChildProcess;
  parser: StdoutParser;
  segmenter: ChatSegmenter;
  stderrBuffer: string;
};

const STOP_GRACE_PERIOD_MS = 5000;

export class AgentHarnessService {
  private agents = new Map<string, AgentProcess>();
  private projectPath: string;
  private onStatusChange: (agentId: string, status: AgentStatus, lastError?: string) => void;
  private onOutput: (agentId: string, data: string) => void;
  private onChatEntry: (entry: ChatEntry) => void;

  constructor(config: {
    projectPath: string;
    onStatusChange: (agentId: string, status: AgentStatus, lastError?: string) => void;
    onOutput: (agentId: string, data: string) => void;
    onChatEntry: (entry: ChatEntry) => void;
  }) {
    this.projectPath = config.projectPath;
    this.onStatusChange = config.onStatusChange;
    this.onOutput = config.onOutput;
    this.onChatEntry = config.onChatEntry;
  }

  /**
   * Launch a new Claude Code agent as a subprocess.
   * Returns the agent ID.
   */
  launchAgent(params: AgentLaunchParams): string {
    const agentId = randomUUID();
    const { task, context, workingDirectory } = params;

    const info: AgentInfo = {
      id: agentId,
      task,
      status: AgentStatus.LAUNCHING,
      contextFiles: context,
      startedAt: Date.now(),
    };

    // Build CLI arguments
    // Claude Code CLI: claude --print --output-format json "task description"
    const args = this.buildCliArgs(task, context);

    const child = spawn('claude', args, {
      cwd: workingDirectory ?? this.projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const parser = new StdoutParser();
    const segmenter = new ChatSegmenter(agentId);

    const agentProcess: AgentProcess = {
      info,
      process: child,
      parser,
      segmenter,
      stderrBuffer: '',
    };

    this.agents.set(agentId, agentProcess);

    // Wire stdout -> parser -> segmenter -> events
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      info.lastOutputAt = Date.now();
      this.onOutput(agentId, text);
      parser.feed(text);
    });

    child.stderr?.on('data', (data: Buffer) => {
      agentProcess.stderrBuffer += data.toString();
    });

    parser.on('event', (event) => {
      const entry = segmenter.process(event);
      if (entry) {
        this.onChatEntry(entry);
      }
    });

    // Process lifecycle events
    child.on('spawn', () => {
      info.status = AgentStatus.ACTIVE;
      this.onStatusChange(agentId, AgentStatus.ACTIVE);
    });

    child.on('close', (code) => {
      parser.flush();

      info.stoppedAt = Date.now();

      if (info.status === AgentStatus.STOPPING) {
        // Graceful stop was requested
        info.status = AgentStatus.STOPPED;
        this.onStatusChange(agentId, AgentStatus.STOPPED);
      } else if (code === 0 || code === null) {
        // Natural completion
        info.status = AgentStatus.STOPPED;
        this.onStatusChange(agentId, AgentStatus.STOPPED);
      } else {
        // Non-zero exit = crash
        info.status = AgentStatus.CRASHED;
        info.lastError = agentProcess.stderrBuffer.slice(-2000); // Keep last 2KB
        this.onStatusChange(agentId, AgentStatus.CRASHED, info.lastError);
      }

      // Persist session history
      this.persistSession(agentProcess).catch(() => {
        // Silently fail persistence — not critical
      });
    });

    child.on('error', (err) => {
      info.status = AgentStatus.CRASHED;
      info.stoppedAt = Date.now();
      info.lastError = err.message;
      this.onStatusChange(agentId, AgentStatus.CRASHED, err.message);
    });

    this.onStatusChange(agentId, AgentStatus.LAUNCHING);

    return agentId;
  }

  /**
   * Stop an agent gracefully. Sends SIGTERM, then SIGKILL after timeout.
   */
  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.info.status === AgentStatus.STOPPED || agent.info.status === AgentStatus.CRASHED) {
      return; // Already stopped
    }

    agent.info.status = AgentStatus.STOPPING;
    this.onStatusChange(agentId, AgentStatus.STOPPING);

    const child = agent.process;

    // Send SIGTERM
    child.kill('SIGTERM');

    // Wait for graceful shutdown, then force kill
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
        resolve();
      }, STOP_GRACE_PERIOD_MS);

      child.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Get info for all tracked agents.
   */
  listAgents(): AgentInfo[] {
    return Array.from(this.agents.values()).map((a) => ({ ...a.info }));
  }

  /**
   * Get chat entries for a specific agent.
   */
  getAgentChat(agentId: string, fromCheckpoint?: string): ChatEntry[] {
    const agent = this.agents.get(agentId);
    if (!agent) return [];
    return agent.segmenter.getEntries(fromCheckpoint);
  }

  /**
   * Get agent info by ID.
   */
  getAgent(agentId: string): AgentInfo | undefined {
    const agent = this.agents.get(agentId);
    return agent ? { ...agent.info } : undefined;
  }

  /**
   * Build CLI arguments for Claude Code.
   */
  private buildCliArgs(task: string, context: string[]): string[] {
    const args: string[] = [
      '--print',           // Non-interactive mode
      '--output-format',
      'json',              // Structured output for parsing
    ];

    // Add context files as allowed files
    for (const file of context) {
      args.push('--allowedTools', `Read(${file})`);
    }

    // Task description as the prompt
    args.push(task);

    return args;
  }

  /**
   * Persist agent session data to .mnm/agent-history/
   */
  private async persistSession(agent: AgentProcess): Promise<void> {
    const historyDir = join(this.projectPath, '.mnm', 'agent-history');
    await mkdir(historyDir, { recursive: true });

    const session = {
      id: agent.info.id,
      task: agent.info.task,
      status: agent.info.status,
      startedAt: agent.info.startedAt,
      stoppedAt: agent.info.stoppedAt,
      chatEntries: agent.segmenter.getEntries(),
      lastError: agent.info.lastError,
    };

    const filename = `session-${agent.info.startedAt}.json`;
    const tempPath = join(historyDir, `.${filename}.tmp`);
    const finalPath = join(historyDir, filename);

    // Atomic write: write temp + rename
    await writeFile(tempPath, JSON.stringify(session, null, 2), 'utf-8');
    const { rename } = await import('node:fs/promises');
    await rename(tempPath, finalPath);
  }

  /**
   * Cleanup: stop all agents on app shutdown.
   */
  async shutdown(): Promise<void> {
    const stopPromises = Array.from(this.agents.keys()).map((id) =>
      this.stopAgent(id).catch(() => {
        // Force kill on shutdown errors
        const agent = this.agents.get(id);
        if (agent && !agent.process.killed) {
          agent.process.kill('SIGKILL');
        }
      })
    );
    await Promise.all(stopPromises);
  }
}
```

### IPC Handler Wiring

```typescript
// Additions to src/main/ipc/handlers.ts

import { AgentHarnessService } from '@main/services/agent/agent-harness.service';
import type { AgentLaunchParams } from '@shared/types/agent.types';

// Initialize the harness (in registerInvokeHandlers or a setup function)
// const agentHarness = new AgentHarnessService({ ... });

// In registerInvokeHandlers():
ipcMain.handle('agent:launch', async (_event, params: AgentLaunchParams) => {
  try {
    const agentId = agentHarness.launchAgent(params);
    return { agentId };
  } catch (err) {
    throw normalizeToAppError(err, 'agent-harness');
  }
});

ipcMain.handle('agent:stop', async (_event, { agentId }: { agentId: string }) => {
  try {
    await agentHarness.stopAgent(agentId);
  } catch (err) {
    throw normalizeToAppError(err, 'agent-harness');
  }
});

ipcMain.handle('agent:list', async () => {
  return agentHarness.listAgents();
});

ipcMain.handle('agent:get-chat', async (_event, { agentId, fromCheckpoint }) => {
  return agentHarness.getAgentChat(agentId, fromCheckpoint);
});
```

```typescript
// Additions to src/main/ipc/streams.ts

// Wire main event bus -> renderer IPC streams
// In the stream setup function:

mainEventBus.on('agent:output', (data) => {
  sendToRenderer('stream:agent-output', data);
});

mainEventBus.on('agent:status', (data) => {
  sendToRenderer('stream:agent-status', data);
});

mainEventBus.on('agent:chat-entry', (data) => {
  sendToRenderer('stream:agent-chat', data);
});
```

### AgentHarnessService Initialization

```typescript
// In src/main/index.ts (or a service registry)

const agentHarness = new AgentHarnessService({
  projectPath: currentProjectPath,
  onStatusChange: (agentId, status, lastError) => {
    mainEventBus.emit('agent:status', { agentId, status, lastError });
    logger.info('agent-harness', `Agent ${agentId} status: ${status}`);
  },
  onOutput: (agentId, data) => {
    mainEventBus.emit('agent:output', { agentId, data, timestamp: Date.now() });
  },
  onChatEntry: (entry) => {
    mainEventBus.emit('agent:chat-entry', entry);
  },
});

// On app quit:
app.on('before-quit', async () => {
  await agentHarness.shutdown();
});
```

### File Structure (Story 2.1 scope)

```
src/
  shared/
    types/
      agent.types.ts          # AgentStatus, AgentInfo, AgentLaunchParams
      chat.types.ts            # ChatEntry, ChatRole
    ipc-channels.ts            # Updated with agent channels
    events.ts                  # Updated with agent events
  main/
    services/
      agent/
        agent-harness.service.ts      # Core service
        agent-harness.service.test.ts # Unit + integration tests
        stdout-parser.ts              # Raw stdout -> structured events
        stdout-parser.test.ts         # Parser tests
        chat-segmenter.ts             # Structured events -> ChatEntry[]
        chat-segmenter.test.ts        # Segmenter tests
        agent.types.ts                # Internal types (AgentProcess, etc.)
    ipc/
      handlers.ts              # Updated with agent handlers
      streams.ts               # Updated with agent stream wiring
```

### Naming Conventions

| Element | Convention | This Story |
|---|---|---|
| Service file | kebab-case.service.ts | `agent-harness.service.ts` |
| Parser file | kebab-case.ts | `stdout-parser.ts`, `chat-segmenter.ts` |
| Internal types | kebab-case.types.ts | `agent.types.ts` |
| Shared types | kebab-case.types.ts in `src/shared/types/` | `agent.types.ts`, `chat.types.ts` |
| Tests | co-located, same name + `.test.ts` | `agent-harness.service.test.ts` |
| IPC channels | `namespace:action` kebab | `agent:launch`, `agent:stop` |
| Stream channels | `stream:` prefix | `stream:agent-output` |
| Enum members | UPPER_SNAKE_CASE | `AgentStatus.ACTIVE` |

### Testing Strategy

**Unit tests (co-located):**

1. **stdout-parser.test.ts**
   - Parses JSON-formatted Claude Code output correctly
   - Handles partial line buffering
   - Emits correct event types for assistant, tool-call, tool-result
   - Detects checkpoints on file write tools
   - Handles malformed JSON gracefully (falls back to plain text)
   - Flush emits remaining buffer content

2. **chat-segmenter.test.ts**
   - Converts text events to ChatEntry with correct role
   - Converts tool-call events to assistant entries
   - Converts checkpoint events with checkpoint ID
   - getEntries returns all entries
   - getEntries(fromCheckpoint) filters correctly
   - Generates unique IDs for each entry

3. **agent-harness.service.test.ts**
   - Mock `child_process.spawn` to simulate agent processes
   - launchAgent returns agentId and sets status LAUNCHING -> ACTIVE
   - stopAgent sends SIGTERM, then SIGKILL after timeout
   - Natural process exit sets status STOPPED
   - Non-zero exit code sets status CRASHED with stderr
   - Process error event sets status CRASHED
   - listAgents returns all tracked agents
   - getAgentChat returns segmented entries
   - Multiple agents tracked independently
   - Session data persisted to .mnm/agent-history/

**Mocking approach:**
```typescript
// Mock child_process.spawn for tests
import { vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';

function createMockProcess(): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  proc.stdout = new EventEmitter() as Readable;
  proc.stderr = new EventEmitter() as Readable;
  proc.killed = false;
  proc.kill = vi.fn((signal?: string) => {
    proc.killed = true;
    return true;
  });
  proc.pid = 12345;
  return proc;
}
```

### What NOT to Do

- Do NOT import `child_process` in the renderer — it is main-process only
- Do NOT use `exec` or `execSync` — use `spawn` for streaming stdout
- Do NOT store the full stdout buffer in memory indefinitely — the ChatSegmenter keeps structured entries, raw data is transient
- Do NOT hardcode the Claude CLI path — use `'claude'` and rely on PATH resolution
- Do NOT block the main process during agent stop — use async/await with timeout
- Do NOT use `any` for the spawn options or process events — type everything
- Do NOT create renderer components in this story — this is main-process only
- Do NOT use `export default` — named exports only
- Do NOT create `agent.store.ts` or any Zustand store — that belongs to Story 2.2
- Do NOT forget to handle the `error` event on the child process (unhandled error crashes the main process)
- Do NOT use synchronous file writes for session persistence — use async with atomic write pattern

### References

- [Source: architecture.md#Event-Bus-Architecture] — Event bus pattern
- [Source: architecture.md#IPC-Channel-Design] — IPC invoke + streaming types
- [Source: architecture.md#Process-Patterns] — Error handling, logging
- [Source: architecture.md#Complete-Project-Directory-Structure] — File locations
- [Source: architecture.md#GAP-1] — ChatSegmenter and ChatEntry design
- [Source: architecture.md#Local-Data-Persistence] — .mnm/agent-history/ structure
- [Source: architecture.md#Naming-Patterns] — Naming conventions
- [Source: epics.md#Story-2.1] — Acceptance criteria
- [Source: prd.md#FR6] — Launch agent
- [Source: prd.md#FR7] — Stop agent
- [Source: prd.md#NFR8] — Interception stdout < 500ms
- [Source: prd.md#NFR10] — No elevated privileges

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
