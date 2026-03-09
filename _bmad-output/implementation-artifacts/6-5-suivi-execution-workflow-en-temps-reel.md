# Story 6.5: Suivi d'Execution Workflow en Temps Reel

Status: ready-for-dev

## Story

As a **user**,
I want **to see workflow execution progress in real-time**,
So that **I know which step an agent is on and can follow along**.

## Context

Depends on: Stories 6.2, 2.1 (agent launch). When an agent runs a BMAD workflow (e.g., `/dev-story`), MnM tracks which step it's on.

## Acceptance Criteria

### AC1 — Current step tracking

**Given** an agent is executing a BMAD workflow
**When** the agent moves to a new step (detected via output parsing or file changes)
**Then** the workflow diagram updates to highlight the current step

### AC2 — Step completion history

**Given** a workflow execution is in progress
**When** steps are completed
**Then** completed steps show a checkmark and execution time

### AC3 — Timeline integration

**Given** a workflow is executing
**When** I view the TimelineBar
**Then** step transitions appear as events

## Tasks / Subtasks

- [ ] Task 1: Step tracking service (AC: #1)
  - [ ] 1.1 Create `server/src/services/workflow-execution-tracker.ts`
  - [ ] 1.2 Parse agent output for BMAD step markers (e.g., "Step 2: Implement" patterns)
  - [ ] 1.3 Emit `workflow:step-changed` WebSocket event with step ID

- [ ] Task 2: Diagram updates (AC: #1, #2)
  - [ ] 2.1 WorkflowDiagram listens for `workflow:step-changed` events
  - [ ] 2.2 Highlight current step with pulse, mark completed steps with checkmark
  - [ ] 2.3 Show elapsed time per step

- [ ] Task 3: Timeline events (AC: #3)
  - [ ] 3.1 Log step transitions to activity log
  - [ ] 3.2 TimelineBar shows: "Agent moved to step: [step name]"

- [ ] Task 4: Tests
  - [ ] 4.1 Test: step change emits correct event
  - [ ] 4.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT block on perfect step detection — best-effort parsing is fine

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
