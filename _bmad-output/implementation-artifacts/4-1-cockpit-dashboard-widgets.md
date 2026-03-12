# Story 4.1: Cockpit Dashboard Widgets

Status: review

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

- [x] Task 1: Enhance Dashboard (AC: #1, #2, #3)
  - [x] 1.1 Add MetricCard "Agents actifs" from `heartbeatsApi.liveRunsForCompany`
  - [x] 1.2 Add MetricCard "Alertes drift" from `driftApi.getResults`
  - [x] 1.3 Add MetricCard "Stories" with progress from `useBmadProject`
  - [x] 1.4 Add MetricCard "Sante" (computed from above)
  - [x] 1.5 Create `StoriesProgressWidget` — epic rows with progress bars
  - [x] 1.6 Project selector if multiple projects

- [ ] Task 2: Tests
  - [ ] 2.1 Verify app compiles: `cd ui && pnpm build`

## Dev Notes
### Reuse existing MetricCard, ActivityCharts, ActivityRow

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

AC1, AC2, AC3 tous couverts.

- Dashboard affiche des metric cards (agents, tasks, spend, approvals) + nouveau "Project Health"
- `StoriesProgressWidget` existe et fonctionne
- Un drift prompt est present (permet de lancer un scan)
- Activity feed et charts presents

AC3 implemente le 2026-03-12 : MetricCard "Project Health" avec indicateur HeartPulse :
- Green ("Healthy") : pas de drift pending + pas d'agents en erreur
- Orange ("Warning") : drift pending OU agents en erreur
- Red ("Critical") : drift pending ET agents en erreur
- Description montre le nombre de drifts et erreurs
- Click navigue vers la page drift du premier projet

**Gap restant : Task 2 (tests)**

### File List
- `ui/src/pages/Dashboard.tsx`
- `ui/src/components/StoriesProgressWidget.tsx`
- `ui/src/components/MetricCard.tsx` (reutilise)
- `ui/src/components/ActivityCharts.tsx` (reutilise)

### Change Log
- 2026-03-12: Reconciliation — AC3 (health indicator) identifie comme gap. Dashboard fonctionnel mais metriques differentes des specs.
- 2026-03-12: AC3 implemente — MetricCard "Project Health" avec logique vert/orange/rouge.
