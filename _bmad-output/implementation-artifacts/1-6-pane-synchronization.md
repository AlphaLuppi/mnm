# Story 1.6: Pane Synchronization

Status: review

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

- [x] Task 1: Context → Work + Tests sync (AC: #1, #2)
  - [x] 1.1 WorkPane reads `selectedItem` from context → renders appropriate view
  - [x] 1.2 TestsPane reads `selectedItem` → filters ACs to selected epic/story

- [x] Task 2: Tests → Context + Work sync (AC: #3)
  - [x] 2.1 Click AC in TestsPane → calls `selectStory()` in navigation context
  - [x] 2.2 Context pane auto-expands and highlights the story

- [x] Task 3: Visual selection state (AC: #2)
  - [x] 3.1 Selected item in Context pane gets `bg-accent/10` highlight
  - [x] 3.2 Auto-expand parent epic when child story selected

- [ ] Task 4: Tests
  - [ ] 4.1 Verify sync works end-to-end
  - [ ] 4.2 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

Tous les ACs couverts via `ProjectNavigationContext` :
- AC1 : Click epic → WorkPane et TestsPane lisent `selectedItem` et s'adaptent
- AC2 : Click story → selection propagee, highlight dans ContextPane
- AC3 : Click AC dans TestsPane → `selectNode()` appele → navigation vers la story

Implementation fidele aux specs. Deviation mineure : `selectNode()` au lieu de `selectStory()`.

**Gap : Task 4 (tests) non implementee**

### File List
- `ui/src/context/ProjectNavigationContext.tsx` (context partage)
- `ui/src/components/ContextPane.tsx` (lit selectedItem, highlight)
- `ui/src/components/WorkPane.tsx` (lit selectedItem, route vers vue)
- `ui/src/components/TestsPane.tsx` (lit selectedItem, filtre ACs, onClick → selectNode)

### Change Log
- 2026-03-12: Reconciliation — tous ACs couverts. Tests manquants.
