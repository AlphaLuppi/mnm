# Story 3.3: Drift Resolution Actions

Status: ready-for-dev

## Story

As a **user**,
I want **to resolve drift alerts by fixing, delegating to an agent, or ignoring**,
So that **I can maintain consistency across my specs**.

## Context

Depends on: 3.2.

## Acceptance Criteria

### AC1 — Resolution buttons

**Given** a drift alert is displayed
**When** I view the card
**Then** I see: "Corriger source", "Corriger cible", "Ignorer"

### AC2 — Fix navigates to document

**Given** I click "Corriger source" or "Corriger cible"
**When** navigation occurs
**Then** the document opens in WorkPane with option to launch a correct-course agent

### AC3 — Ignore dismisses alert

**Given** I click "Ignorer"
**When** the action triggers
**Then** alert is hidden (stored in localStorage by drift hash)

## Tasks / Subtasks

- [ ] Task 1: Resolution buttons (AC: #1, #2, #3)
  - [ ] 1.1 Add buttons to DriftAlertCard
  - [ ] 1.2 "Corriger" → navigate to doc + offer LaunchAgentDialog with "correct-course" preset
  - [ ] 1.3 "Ignorer" → store in localStorage, filter from display

- [ ] Task 2: Tests
  - [ ] 2.1 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
