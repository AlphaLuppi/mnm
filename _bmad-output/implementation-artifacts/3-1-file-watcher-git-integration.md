# Story 3.1: File Watcher & Git Integration

Status: ready-for-dev

## Story

As a **user**,
I want **MnM to detect file changes in my project in real-time and read Git history**,
So that **the system is always aware of what's happening in my codebase**.

## Acceptance Criteria

### AC1 — File change detection via chokidar (< 1s)

**Given** un projet est ouvert
**When** un fichier est modifié dans le repo
**Then** MnM détecte la modification en < 1 seconde (NFR9) via chokidar
**And** un événement `stream:file-change` est émis vers le renderer

### AC2 — CPU idle < 5%

**Given** le file watcher est actif
**When** aucun agent ne tourne et aucun fichier ne change
**Then** la consommation CPU du watcher reste < 5% (NFR2)

### AC3 — Git history via simple-git

**Given** un projet Git est ouvert
**When** je demande l'historique Git
**Then** MnM lit les commits, branches et diffs via `simple-git` (FR47)
**And** aucun privilège élevé n'est requis (NFR10)

### AC4 — File change attribution to agent

**Given** le watcher détecte une modification
**When** un agent est actif et a modifié ce fichier
**Then** la modification est attribuée à l'agent correspondant (FR42) via corrélation process -> fichier

## Tasks / Subtasks

- [ ] Task 1: Install dependencies (AC: #1, #3)
  - [ ] 1.1 Install `chokidar` (latest) as production dependency
  - [ ] 1.2 Install `simple-git` (latest) as production dependency
  - [ ] 1.3 Verify both packages resolve correctly in electron-vite main config

- [ ] Task 2: Create file watcher service (AC: #1, #2)
  - [ ] 2.1 Create `src/main/services/file-watcher/file-watcher.service.ts` with `FileWatcherService` class
  - [ ] 2.2 Implement `start(projectPath: string)` — init chokidar watcher on project root
  - [ ] 2.3 Configure chokidar options: `ignored` patterns (`.git`, `node_modules`, `.mnm`), `persistent: true`, `ignoreInitial: true`, `awaitWriteFinish: { stabilityThreshold: 100 }`
  - [ ] 2.4 Implement `stop()` — close watcher, clean up listeners
  - [ ] 2.5 Implement internal event emission on `add`, `change`, `unlink` events
  - [ ] 2.6 Wire watcher events to main event bus (`file:changed`)
  - [ ] 2.7 Create `src/main/services/file-watcher/file-watcher.service.test.ts` — unit tests with mocked chokidar

- [ ] Task 3: Create file watcher types (AC: #1, #4)
  - [ ] 3.1 Create `src/main/services/file-watcher/file-watcher.types.ts` with `FileChangeEvent`, `WatcherOptions`, `WatcherStatus`
  - [ ] 3.2 Ensure `FileChangeEvent` includes: `path`, `type` (`create` | `modify` | `delete`), `timestamp`, optional `agentId`

- [ ] Task 4: Create event correlator (AC: #4)
  - [ ] 4.1 Create `src/main/services/file-watcher/event-correlator.ts` with `EventCorrelator` class
  - [ ] 4.2 Implement `registerAgentProcess(agentId: string, pid: number)` — track active agent PIDs
  - [ ] 4.3 Implement `unregisterAgentProcess(agentId: string)` — remove agent from tracking
  - [ ] 4.4 Implement `correlate(fileChangeEvent: FileChangeEvent): FileChangeEvent` — attempt to attribute a file change to an active agent
  - [ ] 4.5 Correlation strategy: time-window heuristic (file change within 2s of agent activity on that path) + optional lsof/fuser for PID-based correlation
  - [ ] 4.6 Create `src/main/services/file-watcher/event-correlator.test.ts` — unit tests for correlation logic

- [ ] Task 5: Create Git service (AC: #3)
  - [ ] 5.1 Create `src/main/services/git/git.service.ts` with `GitService` class
  - [ ] 5.2 Implement constructor accepting `projectPath: string`, init `simpleGit(projectPath)`
  - [ ] 5.3 Implement `getLog(count: number): Promise<GitLogEntry[]>` — wraps `git.log({ maxCount })`
  - [ ] 5.4 Implement `getStatus(): Promise<GitStatus>` — wraps `git.status()`
  - [ ] 5.5 Implement `getFileHistory(filePath: string, count: number): Promise<GitLogEntry[]>` — log for a single file
  - [ ] 5.6 Implement `showFile(filePath: string, commitHash: string): Promise<string>` — wraps `git.show([commitHash + ':' + filePath])`
  - [ ] 5.7 Implement `getDiff(commitA: string, commitB: string): Promise<string>` — wraps `git.diff([commitA, commitB])`
  - [ ] 5.8 Create `src/main/services/git/git.service.test.ts` — unit tests with mocked simple-git

- [ ] Task 6: Create Git types (AC: #3)
  - [ ] 6.1 Extend `src/shared/types/` with git-related types if not already present
  - [ ] 6.2 Define `GitLogEntry`, `GitStatus`, `GitFileChange` types

- [ ] Task 7: Register IPC handlers (AC: #1, #3)
  - [ ] 7.1 Add `git:status` handler in `src/main/ipc/handlers.ts` — delegates to `GitService.getStatus()`
  - [ ] 7.2 Add `git:log` handler — delegates to `GitService.getLog()`
  - [ ] 7.3 Add `git:show-file` handler — delegates to `GitService.showFile()`
  - [ ] 7.4 Wire file watcher events to IPC stream: `file:changed` event -> `stream:file-change` via `webContents.send()`
  - [ ] 7.5 Register `FileWatcherService.start()` call during project open flow

- [ ] Task 8: Integration wiring (AC: #1, #3, #4)
  - [ ] 8.1 In `src/main/index.ts` (or project loader), instantiate `FileWatcherService` and `GitService` when a project is opened
  - [ ] 8.2 Wire `EventCorrelator` between file watcher events and agent harness (agent registry)
  - [ ] 8.3 Ensure watcher is stopped when project is closed or app quits
  - [ ] 8.4 Write integration test: file change -> event bus -> IPC stream emission

## Dev Notes

### FRs Covered

- **FR9** — L'utilisateur peut voir la liste des fichiers de contexte que chaque agent consulte, mise à jour en continu (file watcher feeds the context panel)
- **FR41** — Le système peut détecter les modifications de fichiers par événement (file watching) - délai < 1s (NFR9)
- **FR42** — Le système peut attribuer une modification de fichier à l'agent qui l'a produite (event correlator)
- **FR47** — Le système peut lire l'historique Git du projet (commits, branches, diffs) sans nécessiter de privilèges élevés

### Dependencies on Previous Stories

- **Story 1.1** — IPC bridge, event bus, shared types, preload bridge, `AppError` pattern
- **Story 1.3** — Project open flow (`project:open` handler, `ProjectInfo` with `projectPath`)

The file watcher and git service must be initialized when a project is opened (Story 1.3 provides the project loader). The IPC channels `git:status`, `git:log`, `git:show-file` are declared in Story 1.1's `IpcInvokeChannels`. The `stream:file-change` is declared in `IpcStreamChannels`.

### File Watcher Service Architecture

```
src/main/services/file-watcher/
├── file-watcher.service.ts       # Main watcher service using chokidar
├── file-watcher.service.test.ts  # Unit tests
├── file-watcher.types.ts         # FileChangeEvent, WatcherOptions, WatcherStatus
├── event-correlator.ts           # Maps file changes to agent PIDs
└── event-correlator.test.ts      # Correlation tests
```

[Source: architecture.md#Complete-Project-Directory-Structure]

### FileWatcherService Implementation Pattern

```typescript
// src/main/services/file-watcher/file-watcher.service.ts
import chokidar from 'chokidar';
import { mainEventBus } from '@main/utils/event-bus';
import type { FileChangeEvent, WatcherOptions } from './file-watcher.types';
import { EventCorrelator } from './event-correlator';

export class FileWatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private correlator: EventCorrelator;

  constructor(private options: WatcherOptions) {
    this.correlator = new EventCorrelator();
  }

  start(projectPath: string): void {
    if (this.watcher) {
      this.stop();
    }

    this.watcher = chokidar.watch(projectPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.mnm/**',
        '**/dist/**',
        '**/out/**',
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
      // Use native FSEvents on macOS for performance (NFR2)
      usePolling: false,
    });

    this.watcher.on('add', (path) => this.handleChange(path, 'create'));
    this.watcher.on('change', (path) => this.handleChange(path, 'modify'));
    this.watcher.on('unlink', (path) => this.handleChange(path, 'delete'));

    this.watcher.on('error', (error) => {
      logger.error('file-watcher', 'Watcher error', { error });
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  getCorrelator(): EventCorrelator {
    return this.correlator;
  }

  private handleChange(path: string, type: FileChangeEvent['type']): void {
    const event: FileChangeEvent = {
      path,
      type,
      timestamp: Date.now(),
    };

    // Attempt to correlate with an active agent
    const correlated = this.correlator.correlate(event);

    mainEventBus.emit('file:changed', {
      path: correlated.path,
      type: correlated.type,
    });
  }
}
```

[Source: architecture.md#Event-Bus-Architecture]
[Source: architecture.md#Structure-Patterns]

### FileChangeEvent Type

```typescript
// src/main/services/file-watcher/file-watcher.types.ts
export type FileChangeEvent = {
  path: string;
  type: 'create' | 'modify' | 'delete';
  timestamp: number;
  agentId?: string;
};

export type WatcherOptions = {
  ignoredPatterns?: string[];
  stabilityThreshold?: number;
};

export type WatcherStatus = 'idle' | 'watching' | 'error';
```

### Event Correlator Pattern

```typescript
// src/main/services/file-watcher/event-correlator.ts
import type { FileChangeEvent } from './file-watcher.types';

type AgentActivity = {
  agentId: string;
  pid: number;
  lastActivityTimestamp: number;
  watchedPaths: Set<string>;
};

const CORRELATION_WINDOW_MS = 2000;

export class EventCorrelator {
  private activeAgents: Map<string, AgentActivity> = new Map();

  registerAgentProcess(agentId: string, pid: number): void {
    this.activeAgents.set(agentId, {
      agentId,
      pid,
      lastActivityTimestamp: Date.now(),
      watchedPaths: new Set(),
    });
  }

  unregisterAgentProcess(agentId: string): void {
    this.activeAgents.delete(agentId);
  }

  updateAgentActivity(agentId: string, paths?: string[]): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      agent.lastActivityTimestamp = Date.now();
      if (paths) {
        for (const p of paths) {
          agent.watchedPaths.add(p);
        }
      }
    }
  }

  correlate(event: FileChangeEvent): FileChangeEvent {
    const now = Date.now();

    for (const [, agent] of this.activeAgents) {
      const timeDelta = now - agent.lastActivityTimestamp;
      if (timeDelta <= CORRELATION_WINDOW_MS) {
        // Agent was recently active — attribute file change
        return { ...event, agentId: agent.agentId };
      }
    }

    return event;
  }
}
```

[Source: architecture.md#Complete-Project-Directory-Structure — event-correlator.ts]

### Git Service Architecture

```
src/main/services/git/
├── git.service.ts       # Git operations via simple-git
├── git.service.test.ts  # Unit tests with mocked simple-git
└── git.types.ts         # GitLogEntry, GitStatus (if not in shared)
```

[Source: architecture.md#Complete-Project-Directory-Structure]

### GitService Implementation Pattern

```typescript
// src/main/services/git/git.service.ts
import simpleGit from 'simple-git';
import type { SimpleGit } from 'simple-git';

export type GitLogEntry = {
  hash: string;
  date: string;
  message: string;
  author: string;
  files: string[];
};

export type GitFileStatus = {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
};

export type GitStatusResult = {
  current: string | null;
  tracking: string | null;
  files: GitFileStatus[];
  ahead: number;
  behind: number;
};

export class GitService {
  private git: SimpleGit;

  constructor(projectPath: string) {
    this.git = simpleGit(projectPath);
  }

  async getLog(count: number = 50): Promise<GitLogEntry[]> {
    const log = await this.git.log({ maxCount: count });
    return log.all.map((entry) => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author_name,
      files: [],
    }));
  }

  async getStatus(): Promise<GitStatusResult> {
    const status = await this.git.status();
    return {
      current: status.current,
      tracking: status.tracking,
      files: status.files.map((f) => ({
        path: f.path,
        status: this.mapFileStatus(f.working_dir, f.index),
      })),
      ahead: status.ahead,
      behind: status.behind,
    };
  }

  async getFileHistory(
    filePath: string,
    count: number = 20,
  ): Promise<GitLogEntry[]> {
    const log = await this.git.log({
      maxCount: count,
      file: filePath,
    });
    return log.all.map((entry) => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author_name,
      files: [filePath],
    }));
  }

  async showFile(filePath: string, commitHash: string): Promise<string> {
    return this.git.show([`${commitHash}:${filePath}`]);
  }

  async getDiff(commitA: string, commitB: string): Promise<string> {
    return this.git.diff([commitA, commitB]);
  }

  async getFileDiff(
    filePath: string,
    commitA: string,
    commitB: string,
  ): Promise<string> {
    return this.git.diff([commitA, commitB, '--', filePath]);
  }

  private mapFileStatus(
    workingDir: string,
    index: string,
  ): GitFileStatus['status'] {
    if (workingDir === '?' || index === '?') return 'untracked';
    if (workingDir === 'D' || index === 'D') return 'deleted';
    if (workingDir === 'A' || index === 'A') return 'added';
    if (workingDir === 'R' || index === 'R') return 'renamed';
    return 'modified';
  }
}
```

[Source: architecture.md#IPC-Channel-Design — git:status, git:log, git:show-file]

### IPC Handler Registration

```typescript
// In src/main/ipc/handlers.ts — add to registerInvokeHandlers()

import { GitService } from '@main/services/git/git.service';

// Git handlers (Story 3.1)
ipcMain.handle('git:status', async () => {
  try {
    return gitService.getStatus();
  } catch (error) {
    throw normalizeToAppError(error, 'git');
  }
});

ipcMain.handle('git:log', async (_event, args: { count: number }) => {
  try {
    return gitService.getLog(args.count);
  } catch (error) {
    throw normalizeToAppError(error, 'git');
  }
});

ipcMain.handle(
  'git:show-file',
  async (_event, args: { path: string; commitHash: string }) => {
    try {
      return gitService.showFile(args.path, args.commitHash);
    } catch (error) {
      throw normalizeToAppError(error, 'git');
    }
  },
);
```

[Source: architecture.md#Process-Patterns — Error handling par couche]

### IPC Stream Wiring

```typescript
// In src/main/ipc/streams.ts — add stream forwarding for file changes

import { mainEventBus } from '@main/utils/event-bus';

export function registerFileWatcherStreams(
  webContents: Electron.WebContents,
): void {
  mainEventBus.on('file:changed', (data) => {
    webContents.send('stream:file-change', {
      path: data.path,
      type: data.type,
      agentId: data.agentId,
      timestamp: Date.now(),
    });
  });
}
```

[Source: architecture.md#IPC-Channel-Design — IpcStreamChannels]

### Chokidar Configuration Rationale

- **`ignoreInitial: true`** — Ne pas émettre d'événements pour les fichiers existants au démarrage
- **`awaitWriteFinish`** — Évite les faux positifs pendant les écritures longues (agents qui écrivent progressivement)
- **`usePolling: false`** — Utilise les événements natifs OS (FSEvents macOS, inotify Linux, ReadDirectoryChangesW Windows) pour < 5% CPU (NFR2)
- **`ignored` patterns** — Exclut `.git`, `node_modules`, `.mnm`, `dist`, `out` pour réduire la charge

[Source: architecture.md#Core-Architectural-Decisions — Technical Constraints]

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Service class | PascalCase | `FileWatcherService`, `GitService` |
| Service file | kebab-case + `.service.ts` | `file-watcher.service.ts`, `git.service.ts` |
| Types file | kebab-case + `.types.ts` | `file-watcher.types.ts` |
| Test file | same name + `.test.ts` | `file-watcher.service.test.ts` |
| Helper file | kebab-case | `event-correlator.ts` |
| IPC channels | namespace:action | `git:status`, `git:log`, `git:show-file` |
| Stream channels | `stream:` prefix | `stream:file-change` |
| Event bus events | namespace:action | `file:changed`, `git:commit` |

[Source: architecture.md#Naming-Patterns]

### Testing Strategy

**Unit tests:**
- `file-watcher.service.test.ts` — Mock chokidar, verify event emission on file add/change/unlink, verify `stop()` cleans up
- `event-correlator.test.ts` — Verify agent registration/unregistration, time-window correlation, no-match returns original event
- `git.service.test.ts` — Mock simple-git, verify `getLog`, `getStatus`, `showFile`, `getDiff` return correct structures

**Integration tests:**
- File watcher -> event bus -> IPC stream round-trip (verify `stream:file-change` emitted with correct payload)
- Git service -> IPC handler -> response (verify `git:log` returns structured data)

**Performance tests (manual):**
- Idle CPU measurement with watcher active and no file changes (target: < 5% CPU, NFR2)
- File change detection latency (target: < 1 second, NFR9)

### What NOT to Do

- Do NOT use `usePolling: true` — it causes high CPU usage and breaks NFR2
- Do NOT watch the `.git` directory — it generates massive event noise on every git operation
- Do NOT watch `node_modules` — too many files, performance disaster
- Do NOT use synchronous git operations — always use async `simple-git` methods
- Do NOT store `simple-git` instance as a global singleton — instantiate per project with the project path
- Do NOT try to directly detect which process wrote a file via OS APIs in the MVP — use the time-window correlation heuristic instead (event correlator)
- Do NOT emit file events before `awaitWriteFinish` resolves — partial writes cause false positives
- Do NOT import `chokidar` or `simple-git` in renderer — they are main-process only, accessed via IPC

### References

- [Source: architecture.md#Core-Architectural-Decisions] — Event bus, IPC channel design
- [Source: architecture.md#Complete-Project-Directory-Structure] — File watcher and git service locations
- [Source: architecture.md#Implementation-Patterns] — Naming, structure, error handling
- [Source: architecture.md#IPC-Channel-Design] — `git:status`, `git:log`, `git:show-file` channel definitions, `stream:file-change` stream
- [Source: architecture.md#Event-Bus-Architecture] — `file:changed` event type
- [Source: architecture.md#Architectural-Boundaries] — Main process only for filesystem/Git access
- [Source: prd.md#NFR2] — File watching < 5% CPU au repos
- [Source: prd.md#NFR9] — File watching < 1s de délai
- [Source: prd.md#NFR10] — Pas de privilèges élevés
- [Source: epics.md#Story-3.1] — Acceptance criteria source
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — IPC and event bus patterns

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
