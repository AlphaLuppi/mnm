# Story 5.4: Navigation One-Click depuis le Cockpit

Status: ready-for-dev

## Story

As a **user**,
I want **to navigate from any dashboard widget to the relevant detail in one click**,
So that **I can quickly drill down into any aspect of my project**.

## Context

Depends on: Stories 5.1-5.3. Ensures all clickable elements in the dashboard navigate to the right place.

## Acceptance Criteria

### AC1 — Agent click → project cockpit with agent selected

**Given** I click an active agent in the dashboard
**When** navigation occurs
**Then** I'm on the project page with that agent's detail in the Work pane

### AC2 — Drift click → project cockpit with drift view

**Given** I click a drift alert in the dashboard
**When** navigation occurs
**Then** I'm on the project page with the drift diff view in the Work pane

### AC3 — Story/Epic click → project cockpit with spec selected

**Given** I click a story or epic in the progress widget
**When** navigation occurs
**Then** I'm on the project page with that item selected in the Context pane

### AC4 — Activity click → relevant detail

**Given** I click an activity event in the dashboard
**When** navigation occurs
**Then** I navigate to the relevant agent, story, or file view

## Tasks / Subtasks

- [ ] Task 1: Implement navigation helpers (AC: #1, #2, #3, #4)
  - [ ] 1.1 Create `ui/src/lib/cockpitNavigation.ts` — helper functions to build URLs for cockpit navigation with query params: `buildCockpitUrl(companyPrefix, projectId, { type: 'agent'|'story'|'drift'|'epic', id: string })`
  - [ ] 1.2 Use URL query params to pass initial selection state: `?view=agent&id=xxx` or `?view=story&epicId=1&storyId=2`
  - [ ] 1.3 Update ProjectDetail page to read query params on mount and set initial selection in ProjectNavigationContext

- [ ] Task 2: Wire all dashboard widgets (AC: #1, #2, #3, #4)
  - [ ] 2.1 ActiveAgentsWidget: onClick → `navigate(buildCockpitUrl(...))`
  - [ ] 2.2 DriftAlertsWidget: onClick → same pattern
  - [ ] 2.3 StoriesProgressWidget: onClick → same pattern
  - [ ] 2.4 Activity events: onClick → same pattern

- [ ] Task 3: Tests
  - [ ] 3.1 Test: buildCockpitUrl generates correct URLs
  - [ ] 3.2 Test: ProjectDetail reads query params and sets initial selection
  - [ ] 3.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create complex routing — simple query params are sufficient
- Do NOT create IPC/Electron code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
