# Story 7.3: Navigation Bidirectionnelle Spec <-> Tests

Status: ready-for-dev

## Story

As a **user**,
I want **to navigate from a spec to its tests and vice versa**,
So that **I can quickly switch between requirements and their validation**.

## Context

Depends on: Stories 7.1, 7.2.

## Acceptance Criteria

### AC1 — Spec to tests navigation

**Given** I'm viewing a story/AC in the Work pane
**When** I click "Voir les tests"
**Then** the Tests pane scrolls to and highlights the associated tests

### AC2 — Tests to spec navigation

**Given** I click a test in the Tests pane
**When** the navigation occurs
**Then** the Work pane shows the associated spec (story or AC detail)
**And** the Context pane highlights that spec in the tree

### AC3 — Visual link indicator

**Given** a spec has associated tests
**When** I view the spec
**Then** a small link icon indicates clickable navigation to tests

## Tasks / Subtasks

- [ ] Task 1: Spec → Tests navigation (AC: #1, #3)
  - [ ] 1.1 Add "Voir les tests" button in StoryViewer for each AC
  - [ ] 1.2 On click → emit navigation event to TestsPane to scroll to that test
  - [ ] 1.3 Add link icon next to ACs that have associated tests

- [ ] Task 2: Tests → Spec navigation (AC: #2)
  - [ ] 2.1 On click test in TestsPane → update ProjectNavigationContext to select the associated spec
  - [ ] 2.2 Work pane shows spec detail, Context pane highlights it

- [ ] Task 3: Tests
  - [ ] 3.1 Test: navigation updates correct pane
  - [ ] 3.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
