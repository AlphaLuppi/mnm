# Story 5.10: Crash Recovery & State Persistence

Status: ready-for-dev

## Story

As a user,
I want MnM to recover gracefully from crashes,
so that I do not lose work or corrupt state.

## Acceptance Criteria

1. After a crash and restart, agent state is recovered: running agents are marked as "Error", file locks are released, agent logs are preserved
2. After a crash and restart, UI state is recovered: last opened spec is restored, last selected tab is restored, window/viewport state is restored
3. Database integrity is maintained: SQLite transactions ensure no corruption; if corruption is detected, a backup is restored from last clean shutdown
4. On startup after crash, MnM displays a recovery summary: "Recovered from crash", "2 agents were terminated", "No data loss detected"
5. Crash logs are saved to `.mnm/logs/crash-YYYY-MM-DD.log`
6. User can report crash via Help > Report Issue

## Tasks / Subtasks

- [ ] Task 1: Implement agent state recovery (AC: #1)
  - [ ] On startup, query `agents` table for records with `status = "running"` or `status = "paused"`
  - [ ] For each, verify subprocess is actually running (check PID if stored, or assume crashed)
  - [ ] Mark orphaned agents as `status = "error"` with `error_message = "Terminated by crash recovery"`
  - [ ] Release all file locks held by orphaned agents via `fileLocks` table update
  - [ ] Reuse recovery logic from Story 2.9 (Agent Fault Tolerance)
- [ ] Task 2: Implement UI state persistence (AC: #2)
  - [ ] Create `src/lib/core/ui-state.ts` managing persistent UI state
  - [ ] Save to `.mnm/config.json` or a dedicated `.mnm/ui-state.json`: `lastSpecId`, `lastTab`, `sidebarCollapsed`
  - [ ] Save state on navigation events (route changes, tab switches, spec selections)
  - [ ] On startup, read saved state and restore: navigate to last tab, select last spec
  - [ ] Debounce saves (500ms) to avoid excessive writes
- [ ] Task 3: Implement database integrity checks (AC: #3)
  - [ ] On startup, run SQLite `PRAGMA integrity_check` via Drizzle/better-sqlite3
  - [ ] If integrity check fails, attempt recovery: rename corrupt db, restore from backup
  - [ ] Create automatic backup on clean shutdown: copy `state.db` to `state.db.backup`
  - [ ] Log integrity check results via structured logger
- [ ] Task 4: Build crash recovery summary UI (AC: #4)
  - [ ] Create `src/components/shared/recovery-summary.tsx` using shadcn/ui Alert with info variant
  - [ ] Show: recovery message, number of agents terminated, data integrity status
  - [ ] Display as a dismissible banner at the top of the dashboard on first load after recovery
  - [ ] Auto-dismiss after 30 seconds or on user click
- [ ] Task 5: Implement crash logging (AC: #5)
  - [ ] Register `process.on("uncaughtException")` and `process.on("unhandledRejection")` handlers in the Next.js server
  - [ ] Write crash details to `.mnm/logs/crash-YYYY-MM-DD.log`: timestamp, error message, stack trace, active agents, memory usage
  - [ ] Use `next.config.ts` `serverRuntimeConfig` or custom server setup for process-level handlers
  - [ ] Rotate crash logs (keep last 10 files)
- [ ] Task 6: Implement graceful shutdown (AC: #3)
  - [ ] Register `SIGTERM` and `SIGINT` handlers for the server process
  - [ ] On shutdown: terminate all running agents gracefully (SIGTERM with 5s timeout), release all file locks, create database backup, save UI state, log "Clean shutdown" message
  - [ ] Set a `lastCleanShutdown` timestamp in config for crash detection
- [ ] Task 7: Integrate Report Issue for crashes (AC: #6)
  - [ ] After crash recovery, include "Report this crash" button in recovery summary
  - [ ] Pre-fill GitHub issue with crash log content (last 50 lines)
  - [ ] Reuse `issue-reporter.ts` from Story 5.6
- [ ] Task 8: Write tests (AC: #1, #2, #3, #4)
  - [ ] Unit test for agent recovery: agents with stale "running" status are marked "error"
  - [ ] Unit test for file lock cleanup on recovery
  - [ ] Unit test for UI state save/restore round-trip
  - [ ] Unit test for database integrity check handling
  - [ ] Integration test for crash detection (check lastCleanShutdown timestamp)
  - [ ] Component test for recovery summary banner rendering

## Dev Notes

- Crash detection strategy: on startup, check for `lastCleanShutdown` timestamp in config. If absent or stale (server process was not shut down cleanly), assume crash and run recovery.
- SQLite is robust against crashes due to WAL (Write-Ahead Logging) mode; enable WAL mode in the db initialization: `PRAGMA journal_mode=WAL`
- UI state persistence uses `localStorage` on the client side as a primary store, with server-side backup in `.mnm/ui-state.json`
- For the web POC, "crash" means the Next.js server process dies (not browser tab close). Browser tab close is normal and should just save UI state.
- Agent PID tracking: store the subprocess PID in the agents table when spawning; on recovery, check if PID is still alive with `process.kill(pid, 0)` (signal 0 = existence check)
- This story has significant overlap with Story 2.9 (Agent Fault Tolerance); coordinate to avoid duplication

### Project Structure Notes

- `src/lib/core/ui-state.ts` -- UI state persistence manager
- `src/lib/core/crash-recovery.ts` -- crash detection and recovery orchestrator
- `src/components/shared/recovery-summary.tsx` -- recovery banner component
- `.mnm/logs/crash-*.log` -- crash log files
- `.mnm/state.db.backup` -- database backup from last clean shutdown

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 4.2 - Drizzle Schema: agents table, file_locks table]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.1 - Claude Code Subprocess: process management]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 4.4 - Data Lifecycle]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.10]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
