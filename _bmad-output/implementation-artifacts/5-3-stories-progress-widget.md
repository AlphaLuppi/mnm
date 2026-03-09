# Story 5.3: Stories Progress Widget

Status: ready-for-dev

## Story

As a **user**,
I want **to see story progress in the cockpit dashboard with completion ratios**,
So that **I know how far along my project is**.

## Context

Depends on: Stories 5.1, 1.1 (BMAD analyzer).

## Acceptance Criteria

### AC1 — Progress widget shows epic breakdown

**Given** the project has BMAD stories
**When** I view the dashboard
**Then** I see a progress widget: each epic as a row with progress bar (stories done / total)

### AC2 — Overall project progress

**Given** the progress widget is displayed
**When** I look at the header
**Then** I see overall project progress: "12/35 stories done — 34%"

### AC3 — Click navigates to epic

**Given** the progress widget shows epics
**When** I click an epic row
**Then** I navigate to the project cockpit with that epic selected

## Tasks / Subtasks

- [ ] Task 1: Create StoriesProgressWidget (AC: #1, #2, #3)
  - [ ] 1.1 Create `ui/src/components/StoriesProgressWidget.tsx`
  - [ ] 1.2 Fetch BMAD data via `useBmadProject(projectId)` — compute progress per epic
  - [ ] 1.3 Render each epic as: name, progress bar (shadcn Progress), "N/M done" text
  - [ ] 1.4 Header shows overall: "Stories: N/M done — X%"
  - [ ] 1.5 Color: completed stories green, in-progress yellow, backlog gray
  - [ ] 1.6 Click epic → navigate to project cockpit

- [ ] Task 2: Wire into Dashboard (AC: #1)
  - [ ] 2.1 Add StoriesProgressWidget to Dashboard page

- [ ] Task 3: Tests
  - [ ] 3.1 Test: progress computation is correct
  - [ ] 3.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT install shadcn Progress if not already available — check first

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
