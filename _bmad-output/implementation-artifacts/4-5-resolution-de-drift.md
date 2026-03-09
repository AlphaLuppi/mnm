# Story 4.5: Resolution de Drift

Status: ready-for-dev

## Story

As a **user**,
I want **to resolve drift alerts by choosing an action: fix source, fix target, or ignore**,
So that **I can maintain consistency across my project documents**.

## Context

Depends on: Story 4.4.

## Acceptance Criteria

### AC1 — Resolution actions on drift alert

**Given** a drift alert is displayed
**When** I view the alert card
**Then** I see 3 action buttons: "Corriger la source", "Corriger la cible", "Ignorer"

### AC2 — Fix source opens editor

**Given** I click "Corriger la source"
**When** the action triggers
**Then** the source document opens in the Work pane with the conflicting section highlighted
**And** I can launch an agent to fix it (using LaunchAgentDialog with "correct-course" workflow)

### AC3 — Fix target opens editor

**Given** I click "Corriger la cible"
**When** the action triggers
**Then** the target document opens in the Work pane
**And** I can launch an agent to fix it

### AC4 — Ignore dismisses alert

**Given** I click "Ignorer"
**When** the action triggers
**Then** the drift alert is dismissed and won't show again for that specific drift (until next scan)

## Tasks / Subtasks

- [ ] Task 1: Resolution buttons (AC: #1)
  - [ ] 1.1 Add 3 action buttons to DriftAlertCard: "Corriger source", "Corriger cible", "Ignorer"
  - [ ] 1.2 Style: "Corriger" as secondary buttons, "Ignorer" as ghost/muted

- [ ] Task 2: Fix actions (AC: #2, #3)
  - [ ] 2.1 "Corriger source/cible" → navigate to that document in Work pane via ProjectNavigationContext
  - [ ] 2.2 Show a prompt: "Lancer un agent correct-course ?" with one-click to open LaunchAgentDialog pre-filled with "correct-course" workflow and the drift context
  - [ ] 2.3 The agent task description includes the drift details: what's inconsistent, which excerpts, suggestion

- [ ] Task 3: Ignore action (AC: #4)
  - [ ] 3.1 Store ignored drift IDs in localStorage (keyed by project + drift hash)
  - [ ] 3.2 Filter out ignored drifts when displaying results
  - [ ] 3.3 Add "Voir les ignorés" toggle to show/hide dismissed drifts

- [ ] Task 4: Tests
  - [ ] 4.1 Test: ignore action hides the alert
  - [ ] 4.2 Test: fix action navigates to correct document
  - [ ] 4.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT implement automatic fixing — always route through agent with human approval
- Do NOT persist ignore state in backend — localStorage is fine for MVP
- Do NOT create IPC/Electron code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
