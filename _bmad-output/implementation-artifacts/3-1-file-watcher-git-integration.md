# Story 3.1: File Watcher & Git Integration

Status: ready-for-dev

## Story

As a **user**,
I want **MnM to detect file changes in my project workspace in real-time**,
So that **I know when agents modify files and can track changes**.

## Context

Depends on: Epic 1. The server has access to project workspace paths. This story adds a file watcher service that monitors the workspace and emits events via WebSocket.

## Acceptance Criteria

### AC1 — File changes detected

**Given** a project workspace is being monitored
**When** a file is created, modified, or deleted in the workspace
**Then** an event is emitted via WebSocket within 1 second

### AC2 — Git integration

**Given** the workspace is a git repository
**When** I request git info via the API
**Then** I get: current branch, recent commits (last 20), changed files vs HEAD

### AC3 — BMAD file changes trigger refresh

**Given** a file in `_bmad-output/` is modified (e.g., story file updated by an agent)
**When** the file watcher detects the change
**Then** the BMAD data cache is invalidated and the UI refreshes

## Tasks / Subtasks

- [ ] Task 1: Create file watcher service (AC: #1)
  - [ ] 1.1 Create `server/src/services/file-watcher.ts` using `fs.watch` (recursive) or `chokidar` if needed
  - [ ] 1.2 Watch the project `workspacePath` directory recursively
  - [ ] 1.3 Debounce events (100ms) to avoid flooding on rapid changes
  - [ ] 1.4 Emit events via existing `live-events` system: `{ type: 'file:changed', path, changeType: 'create'|'modify'|'delete' }`
  - [ ] 1.5 Ignore `node_modules/`, `.git/`, `dist/`, `target/` directories

- [ ] Task 2: Git info API (AC: #2)
  - [ ] 2.1 Create `server/src/services/git-info.ts` — uses `child_process.execFile('git', ...)` to query git
  - [ ] 2.2 Functions: `getCurrentBranch(path)`, `getRecentCommits(path, limit)`, `getChangedFiles(path)`, `getBranches(path)`
  - [ ] 2.3 Create `GET /api/projects/:id/git` endpoint returning branch, commits, changed files
  - [ ] 2.4 Add `ui/src/api/git.ts` API client

- [ ] Task 3: BMAD cache invalidation (AC: #3)
  - [ ] 3.1 When file watcher detects change in `_bmad-output/` → emit specific event `bmad:updated`
  - [ ] 3.2 UI listens for `bmad:updated` WebSocket event → invalidate TanStack Query cache for `['bmad', projectId]`
  - [ ] 3.3 This triggers automatic refetch of BMAD data in all panes

- [ ] Task 4: Tests
  - [ ] 4.1 Test: git-info service parses git output correctly
  - [ ] 4.2 Test: file watcher ignores node_modules
  - [ ] 4.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### File Watching Approach
Use Node.js native `fs.watch({ recursive: true })` first — it works on macOS and Linux. Only add `chokidar` if native watching proves unreliable.

### Git Commands
```bash
git rev-parse --abbrev-ref HEAD          # current branch
git log --oneline -20                     # recent commits
git diff --name-status HEAD              # changed files
git branch -a                             # all branches
```

### What NOT to do
- Do NOT create IPC/Electron code — use REST API + WebSocket
- Do NOT watch files from the frontend — server-side only
- Do NOT install heavy dependencies — prefer native fs.watch

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
