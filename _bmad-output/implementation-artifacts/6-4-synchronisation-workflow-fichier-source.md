# Story 6.4: Synchronisation Workflow - Fichier Source

Status: ready-for-dev

## Story

As a **user**,
I want **the diagram to stay in sync with the workflow source files**,
So that **manual edits to files are reflected in the UI**.

## Context

Depends on: Stories 6.1-6.3, 3.1 (file watcher).

## Acceptance Criteria

### AC1 — File change updates diagram

**Given** a workflow YAML file is modified externally (by an agent or editor)
**When** the file watcher detects the change
**Then** the diagram refreshes to show the updated structure

### AC2 — Bidirectional sync

**Given** I edit a step in the UI
**When** the change is saved to the file
**Then** other users viewing the same workflow see the update (via file watcher → WebSocket)

## Tasks / Subtasks

- [ ] Task 1: File watcher integration (AC: #1, #2)
  - [ ] 1.1 File watcher emits `workflow:updated` event when files in `_bmad/` change
  - [ ] 1.2 UI listens for `workflow:updated` → invalidate workflow query cache → refetch

- [ ] Task 2: Tests
  - [ ] 2.1 Test: file change triggers cache invalidation
  - [ ] 2.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT implement conflict resolution — last write wins

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
