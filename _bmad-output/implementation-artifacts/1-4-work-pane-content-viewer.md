# Story 1.4: Work Pane — Content Viewer

Status: ready-for-dev

## Story

As a **user**,
I want **the Work pane to show the content of whatever I select in the Context pane**,
So that **I can read specs, stories, and agent info in detail**.

## Context

Depends on: 1.3 (Context pane + navigation context).

## Acceptance Criteria

### AC1 — Artifact markdown viewer

**Given** I select a planning artifact in the Context pane
**When** the Work pane updates
**Then** it shows the rendered markdown content of that artifact

### AC2 — Story detail viewer

**Given** I select a story in the Context pane
**When** the Work pane updates
**Then** it shows: title, status badge, acceptance criteria as cards, task checklist (read-only)

### AC3 — Epic overview

**Given** I select an epic in the Context pane
**When** the Work pane updates
**Then** it shows the epic's stories with progress bars

### AC4 — Default view (no selection)

**Given** nothing is selected
**When** the Work pane loads
**Then** it shows the existing project detail content (agents list, issues summary)

## Tasks / Subtasks

- [ ] Task 1: SpecViewer component (AC: #1)
  - [ ] 1.1 Create `ui/src/components/SpecViewer.tsx`
  - [ ] 1.2 Fetch file content via `bmadApi.getFile(projectId, path)`
  - [ ] 1.3 Render with existing `MarkdownBody` component
  - [ ] 1.4 Loading skeleton while fetching

- [ ] Task 2: StoryViewer component (AC: #2)
  - [ ] 2.1 Create `ui/src/components/StoryViewer.tsx`
  - [ ] 2.2 Show title + status badge at top
  - [ ] 2.3 Acceptance criteria as cards with Given/When/Then text
  - [ ] 2.4 Task list with checkboxes (read-only, showing done/not-done)

- [ ] Task 3: Wire WorkPane to navigation context (AC: #1, #2, #3, #4)
  - [ ] 3.1 Update WorkPane to read `selectedItem` from ProjectNavigationContext
  - [ ] 3.2 artifact → SpecViewer, story → StoryViewer, epic → overview, null → default

- [ ] Task 4: Breadcrumb (AC: #2, #3)
  - [ ] 4.1 Show breadcrumb in WorkPane: "Project > Epic N > Story N.M"
  - [ ] 4.2 Clickable segments navigate to that level

- [ ] Task 5: Tests
  - [ ] 5.1 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Reuse `MarkdownBody` — already in the codebase, renders markdown to HTML.

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
