# Story 1.6: Pane Synchronization

Status: ready-for-dev

## Story

As a **user**,
I want **all 3 panes to stay synchronized when I navigate**,
So that **clicking in one pane updates the other two**.

## Context

Depends on: 1.3, 1.4, 1.5.

## Acceptance Criteria

### AC1 — Click epic syncs all panes

**Given** I click an epic in Context
**Then** Work shows epic overview, Tests filters to that epic's ACs

### AC2 — Click story syncs all panes

**Given** I click a story in Context
**Then** Work shows story detail, Tests shows that story's ACs, story highlighted in Context

### AC3 — Click test navigates to spec

**Given** I click a test/AC in Tests pane
**Then** Work shows the associated story, Context highlights it

## Tasks / Subtasks

- [ ] Task 1: Context → Work + Tests sync (AC: #1, #2)
  - [ ] 1.1 WorkPane reads `selectedItem` from context → renders appropriate view
  - [ ] 1.2 TestsPane reads `selectedItem` → filters ACs to selected epic/story

- [ ] Task 2: Tests → Context + Work sync (AC: #3)
  - [ ] 2.1 Click AC in TestsPane → calls `selectStory()` in navigation context
  - [ ] 2.2 Context pane auto-expands and highlights the story

- [ ] Task 3: Visual selection state (AC: #2)
  - [ ] 3.1 Selected item in Context pane gets `bg-accent/10` highlight
  - [ ] 3.2 Auto-expand parent epic when child story selected

- [ ] Task 4: Tests
  - [ ] 4.1 Verify sync works end-to-end
  - [ ] 4.2 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
