# Story 1.5: Tests Pane — ACs Mirror

Status: done

## Story

As a **user**,
I want **the Tests pane to show acceptance criteria organized by spec hierarchy**,
So that **I can see what needs to be validated at every level**.

## Context

Depends on: 1.1 (BMAD data), 1.2 (three-pane layout).

## Acceptance Criteria

### AC1 — Full AC hierarchy

**Given** BMAD project loaded
**When** no selection → Tests pane shows all ACs grouped by Epic → Story

### AC2 — AC cards with status

**Given** ACs displayed
**When** I view a card
**Then** shows: AC id, title, Given/When/Then, status (pending by default)

### AC3 — Summary counts

**Given** a story in the hierarchy
**When** I view its header
**Then** shows "N ACs: X pending, Y pass, Z fail"

## Tasks / Subtasks

- [ ] Task 1: TestCard component (AC: #2)
  - [ ] 1.1 Create `ui/src/components/TestCard.tsx` — AC id, title, Given/When/Then, status badge
  - [ ] 1.2 Status: pending (gray circle), pass (green check), fail (red X)

- [ ] Task 2: TestsPane with hierarchy (AC: #1, #3)
  - [ ] 2.1 Update `ui/src/components/TestsPane.tsx` to use BMAD data
  - [ ] 2.2 Render collapsible hierarchy: Epic → Story → AC cards
  - [ ] 2.3 Summary counts per story and per epic

- [ ] Task 3: Tests
  - [ ] 3.1 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
