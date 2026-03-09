# Story 5.1: Cockpit Dashboard Layout

Status: ready-for-dev

## Story

As a **user**,
I want **the MnM Dashboard to show a cockpit overview of project health**,
So that **I see everything important at a glance when I open MnM**.

## Context

Depends on: Epics 1-4. Paperclip has a `Dashboard` page (`ui/src/pages/Dashboard.tsx`) with `MetricCard` components. This story enhances it to be the MnM cockpit.

## Acceptance Criteria

### AC1 — Dashboard shows project health summary

**Given** I navigate to the Dashboard
**When** it loads
**Then** I see: active agents count, active drift alerts count, story progress (done/total), recent activity

### AC2 — Metric cards are clickable

**Given** the dashboard shows metrics
**When** I click on "Active Agents"
**Then** I navigate to the agent list view

### AC3 — Project selector

**Given** the company has multiple projects
**When** I view the dashboard
**Then** I can select which project to view cockpit for (or "All projects" overview)

## Tasks / Subtasks

- [ ] Task 1: Enhance Dashboard page (AC: #1, #2, #3)
  - [ ] 1.1 Update `ui/src/pages/Dashboard.tsx` — add BMAD-specific metric cards
  - [ ] 1.2 Add MetricCard: "Agents actifs" (count from `heartbeatsApi.liveRunsForCompany`)
  - [ ] 1.3 Add MetricCard: "Alertes drift" (count from `driftApi.getResults`)
  - [ ] 1.4 Add MetricCard: "Stories" with progress bar (done/total from `bmadApi.getProject`)
  - [ ] 1.5 Add MetricCard: "Sante globale" (computed: green if no drift + all agents healthy)
  - [ ] 1.6 Each card is clickable → navigates to relevant section
  - [ ] 1.7 Add project selector dropdown at top (if multiple projects exist)

- [ ] Task 2: Recent activity section (AC: #1)
  - [ ] 2.1 Show last 10 activity events below metric cards (reuse ActivityRow)
  - [ ] 2.2 Include: agent runs, file changes, drift alerts

- [ ] Task 3: Tests
  - [ ] 3.1 Test: Dashboard renders metric cards with correct counts
  - [ ] 3.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Existing Components
- `Dashboard.tsx` — already exists with some metrics
- `MetricCard` — already exists
- `ActivityCharts` — already exists

### What NOT to do
- Do NOT rebuild the Dashboard from scratch — enhance existing one
- Do NOT create IPC/Electron code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
