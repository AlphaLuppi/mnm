# Story 2.4: Timeline d'Activite des Agents

Status: ready-for-dev

## Story

As a **user**,
I want **to see a timeline of agent activity in the bottom bar**,
So that **I can track what happened and when across all agents**.

## Context

Depends on: Stories 1.2 (TimelineBar placeholder), 2.1-2.3. Paperclip has `Activity` page and `ActivityRow` component, plus `activity_log` DB table tracking all events.

## Acceptance Criteria

### AC1 — Timeline shows agent events chronologically

**Given** agents have run history
**When** I view the TimelineBar at the bottom
**Then** I see a chronological list of events: agent started, task completed, run finished, run failed
**And** each event shows timestamp, agent name, and brief description

### AC2 — Clickable events

**Given** the timeline shows events
**When** I click on an event
**Then** the Work pane navigates to the relevant context (agent detail, story, or run log)

### AC3 — Filterable by agent

**Given** the timeline has events from multiple agents
**When** I select a specific agent from a filter dropdown
**Then** only that agent's events are shown

### AC4 — Auto-scroll to latest

**Given** new events arrive while viewing the timeline
**When** an agent completes a task or finishes a run
**Then** the timeline auto-scrolls to show the latest event (unless user has scrolled up)

## Tasks / Subtasks

- [ ] Task 1: Build TimelineBar with real data (AC: #1, #4)
  - [ ] 1.1 Update `ui/src/components/TimelineBar.tsx` to fetch activity via `activityApi.list(companyId)` (existing API)
  - [ ] 1.2 Render each activity as a compact row: timestamp (relative), agent icon, event description
  - [ ] 1.3 Subscribe to WebSocket live events for real-time updates via `LiveUpdatesProvider`
  - [ ] 1.4 Auto-scroll to bottom on new events (unless user has scrolled up — detect with scroll position)
  - [ ] 1.5 Use `ActivityRow` component patterns for consistent styling

- [ ] Task 2: Clickable events (AC: #2)
  - [ ] 2.1 On click event → update ProjectNavigationContext to show relevant item
  - [ ] 2.2 If event is about a specific story → select that story in Context pane
  - [ ] 2.3 If event is about an agent → show agent detail in Work pane

- [ ] Task 3: Agent filter (AC: #3)
  - [ ] 3.1 Add small dropdown in TimelineBar header to filter by agent (or "All")
  - [ ] 3.2 Filter client-side from the fetched activity list

- [ ] Task 4: Tests
  - [ ] 4.1 Test: TimelineBar renders activity events
  - [ ] 4.2 Test: Filter reduces displayed events
  - [ ] 4.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Existing Infrastructure
- Activity API: `ui/src/api/activity.ts` + `server/src/routes/activity.ts`
- Activity DB: `packages/db/src/schema/activity_log.ts`
- ActivityRow component: `ui/src/components/ActivityRow.tsx`
- WebSocket: `LiveUpdatesProvider` already listens for live events

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT create a new activity system — use existing one
- Do NOT create complex visualization (Gantt charts etc.) — simple chronological list

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
