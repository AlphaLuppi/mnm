# Story 3.4: Notifications de Modification de Fichiers de Contexte

Status: ready-for-dev

## Story

As a **user**,
I want **to be notified when an agent modifies a context file**,
So that **I can review changes immediately**.

## Context

Depends on: Stories 3.1 (file watcher), 3.2 (context files per agent). When an agent modifies a file, the user should know.

## Acceptance Criteria

### AC1 — Notification on file change by agent

**Given** file watcher is active and an agent modifies a file
**When** the change is detected
**Then** a toast notification appears: "[Agent] modified [filename]"
**And** the notification is clickable to view the file

### AC2 — Change attribution to agent

**Given** a file change is detected
**When** an agent has an active run with that workspace
**Then** the change is attributed to that agent (best-effort based on timing)

### AC3 — Notification in timeline

**Given** an agent modifies a file
**When** the event is logged
**Then** it appears in the TimelineBar with file icon and agent attribution

## Tasks / Subtasks

- [ ] Task 1: File change attribution (AC: #2)
  - [ ] 1.1 In file watcher event handler, check if any agent has an active run for that project workspace
  - [ ] 1.2 Attribute the change to the active agent (if only one running) or mark as "unknown" if multiple
  - [ ] 1.3 Include `agentId` in the `file:changed` WebSocket event payload

- [ ] Task 2: Toast notifications (AC: #1)
  - [ ] 2.1 In LiveUpdatesProvider, listen for `file:changed` events
  - [ ] 2.2 Show toast with agent name + filename using existing toast system
  - [ ] 2.3 On toast click → navigate to file viewer in Work pane

- [ ] Task 3: Timeline integration (AC: #3)
  - [ ] 3.1 Log file changes to activity_log with agent attribution
  - [ ] 3.2 TimelineBar already picks up activity events (from Story 2.4)

- [ ] Task 4: Tests
  - [ ] 4.1 Test: file change event includes agent attribution
  - [ ] 4.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT create complex attribution logic — simple "was an agent running in that workspace?" check

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
