# Story 4.2: One-Click Navigation from Dashboard

Status: ready-for-dev

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

- [ ] Task 1: Navigation helpers (AC: #1)
  - [ ] 1.1 Create `ui/src/lib/cockpitNavigation.ts` — build URLs with query params
  - [ ] 1.2 Update ProjectDetail to read query params → set initial selection
  - [ ] 1.3 Wire all dashboard widgets to use navigation helpers

- [ ] Task 2: Tests
  - [ ] 2.1 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
