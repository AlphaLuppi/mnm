# Story 2.3: Stop Agent from Cockpit

Status: ready-for-dev

## Story

As a **user**,
I want **to stop a running agent from the cockpit**,
So that **I can intervene quickly when needed**.

## Context

Depends on: 2.2. Paperclip already has agent stop functionality.

## Acceptance Criteria

### AC1 — Stop button visible when agent running

**Given** an agent is running on a story
**When** I view the story in Work pane
**Then** a "Stop" button is visible next to the live output

### AC2 — Stop cancels the run

**Given** I click "Stop"
**When** the request completes
**Then** the agent run is cancelled and status updates to "cancelled"

## Tasks / Subtasks

- [ ] Task 1: Stop button (AC: #1, #2)
  - [ ] 1.1 Add stop button in StoryViewer when agent is running
  - [ ] 1.2 Use existing agent stop API (check heartbeats or issues API)
  - [ ] 1.3 Show confirmation toast on stop

- [ ] Task 2: Tests
  - [ ] 2.1 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
