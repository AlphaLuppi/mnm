# Story 4.2: One-Click Navigation from Dashboard

Status: review

## Story

As a **user**,
I want **to click any dashboard widget and navigate to the detail in the cockpit**,
So that **I can drill down quickly**.

## Context

Depends on: 4.1.

## Acceptance Criteria

### AC1 — Widget clicks navigate to cockpit

**Given** I click a widget (agents, drift, story progress)
**When** navigation occurs
**Then** I'm on the project cockpit with the relevant item selected

## Tasks / Subtasks

- [x] Task 1: Navigation helpers (AC: #1)
  - [x] 1.1 Create `ui/src/lib/cockpitNavigation.ts` — build URLs with query params
  - [x] 1.2 Update ProjectDetail to read query params → set initial selection
  - [x] 1.3 Wire all dashboard widgets to use navigation helpers

- [ ] Task 2: Tests
  - [ ] 2.1 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

AC1 couvert :
- `cockpitNavigation.ts` implemente avec `cockpitUrl()` et `parseCockpitParams()`
- ProjectDetail lit les query params pour definir la selection initiale
- Widgets du Dashboard utilisent les helpers de navigation

**Gap : Task 2 (tests) non implementee**

### File List
- `ui/src/lib/cockpitNavigation.ts`
- `ui/src/pages/ProjectDetail.tsx` (lecture query params)
- `ui/src/pages/Dashboard.tsx` (widgets avec navigation)

### Change Log
- 2026-03-12: Reconciliation — AC couvert. Tests manquants.
