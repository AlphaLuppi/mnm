# Story 4.1: Cockpit Dashboard Widgets

Status: ready-for-dev

## Story

As a **user**,
I want **the Dashboard to show cockpit widgets with project health metrics**,
So that **I see everything important at a glance**.

## Context

Depends on: Epics 1-3. Paperclip has `Dashboard.tsx` with `MetricCard` components. Enhance it.

## Acceptance Criteria

### AC1 — BMAD metric cards

**Given** I navigate to Dashboard
**When** it loads
**Then** I see: active agents count, drift alerts count, story progress (done/total), global health

### AC2 — Stories progress widget

**Given** BMAD data available
**When** Dashboard loads
**Then** progress widget shows each epic with progress bar

### AC3 — Global health indicator

**Given** all data loaded
**When** Dashboard displays
**Then** health is green (no drift + no failed agents), orange (drift or failed), red (both)

## Tasks / Subtasks

- [ ] Task 1: Enhance Dashboard (AC: #1, #2, #3)
  - [ ] 1.1 Add MetricCard "Agents actifs" from `heartbeatsApi.liveRunsForCompany`
  - [ ] 1.2 Add MetricCard "Alertes drift" from `driftApi.getResults`
  - [ ] 1.3 Add MetricCard "Stories" with progress from `useBmadProject`
  - [ ] 1.4 Add MetricCard "Santé" (computed from above)
  - [ ] 1.5 Create `StoriesProgressWidget` — epic rows with progress bars
  - [ ] 1.6 Project selector if multiple projects

- [ ] Task 2: Tests
  - [ ] 2.1 Verify app compiles: `cd ui && pnpm build`

## Dev Notes
### Reuse existing MetricCard, ActivityCharts, ActivityRow

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
