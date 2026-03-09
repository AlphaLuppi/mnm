# Story 5.2: Agents Actifs & Alertes Drift dans le Cockpit

Status: ready-for-dev

## Story

As a **user**,
I want **the cockpit dashboard to highlight active agents and drift alerts prominently**,
So that **I immediately see what needs my attention**.

## Context

Depends on: Story 5.1. Enhances the dashboard with live agent status and drift alert widgets.

## Acceptance Criteria

### AC1 — Active agents widget

**Given** agents are currently running
**When** I view the dashboard
**Then** I see a widget showing each active agent: name, current task, elapsed time, progress

### AC2 — Drift alerts widget

**Given** drift alerts exist
**When** I view the dashboard
**Then** I see a widget showing recent drift alerts sorted by severity
**And** critical drifts are highlighted in red

### AC3 — Quick actions

**Given** the dashboard shows active items
**When** I click an agent → navigate to agent detail in project cockpit
**When** I click a drift alert → navigate to drift diff view in project cockpit

## Tasks / Subtasks

- [ ] Task 1: Active agents widget (AC: #1, #3)
  - [ ] 1.1 Create `ui/src/components/ActiveAgentsWidget.tsx` — compact list of running agents
  - [ ] 1.2 Show: agent icon, name, current issue title, elapsed time, mini progress bar
  - [ ] 1.3 Click → navigate to `/:prefix/projects/:id` with agent selected

- [ ] Task 2: Drift alerts widget (AC: #2, #3)
  - [ ] 2.1 Create `ui/src/components/DriftAlertsWidget.tsx` — compact list of recent drift alerts
  - [ ] 2.2 Show: severity icon, description (truncated), source↔target docs
  - [ ] 2.3 Sorted by severity (critical first), then by recency
  - [ ] 2.4 Click → navigate to project cockpit with drift selected

- [ ] Task 3: Wire into Dashboard (AC: #1, #2)
  - [ ] 3.1 Add both widgets to Dashboard page below metric cards
  - [ ] 3.2 Layout: side by side on desktop, stacked on mobile

- [ ] Task 4: Tests
  - [ ] 4.1 Test: widgets render correctly with mock data
  - [ ] 4.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
