# Story 3.2: Manual Drift Check UI

Status: done

## Story

As a **user**,
I want **to trigger a drift check from the cockpit and see results**,
So that **I can verify my specs are consistent**.

## Context

Depends on: 3.1 (engine), Epic 1 (cockpit).

## Acceptance Criteria

### AC1 — Drift check button

**Given** I'm viewing a spec in WorkPane
**When** I click "Vérifier le drift"
**Then** drift check runs for that document against related documents

### AC2 — Results in Tests pane

**Given** drift check completes
**When** results arrive
**Then** Tests pane shows drift alert cards: severity icon, description, confidence, source↔target names

### AC3 — Diff view

**Given** I click a drift alert card
**When** the diff opens
**Then** I see side-by-side excerpts with the conflict highlighted

### AC4 — Drift badges in Context pane

**Given** drift alerts exist
**When** I view Context pane
**Then** affected documents show a drift count badge

## Tasks / Subtasks

- [ ] Task 1: Drift check button (AC: #1)
  - [ ] 1.1 Add "Vérifier le drift" button in SpecViewer and StoryViewer headers
  - [ ] 1.2 On click: determine comparison pairs (PRD↔stories, archi↔stories, brief↔PRD)
  - [ ] 1.3 Call `driftApi.check()` for each pair
  - [ ] 1.4 Show loading state

- [ ] Task 2: DriftAlertCard (AC: #2)
  - [ ] 2.1 Create `ui/src/components/DriftAlertCard.tsx` — severity icon, description, confidence badge
  - [ ] 2.2 Add "Drift Alerts" section in TestsPane above ACs
  - [ ] 2.3 Create `ui/src/hooks/useDriftResults.ts` hook

- [ ] Task 3: DriftDiffViewer (AC: #3)
  - [ ] 3.1 Create `ui/src/components/DriftDiffViewer.tsx` — side-by-side text excerpts
  - [ ] 3.2 Click alert card → show diff in WorkPane

- [ ] Task 4: Drift badges (AC: #4)
  - [ ] 4.1 Count drifts per document, show red pill badge in ContextPane

- [ ] Task 5: Tests
  - [ ] 5.1 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
