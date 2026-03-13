# Story 1.4: Work Pane — Content Viewer

Status: review

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

- [x] Task 1: SpecViewer component (AC: #1)
  - [x] 1.1 Create `ui/src/components/SpecViewer.tsx`
  - [x] 1.2 Fetch file content via `bmadApi.getFile(projectId, path)`
  - [x] 1.3 Render with existing `MarkdownBody` component
  - [x] 1.4 Loading skeleton while fetching

- [x] Task 2: StoryViewer component (AC: #2)
  - [x] 2.1 Create `ui/src/components/StoryViewer.tsx`
  - [x] 2.2 Show title + status badge at top
  - [x] 2.3 Acceptance criteria as cards with Given/When/Then text
  - [x] 2.4 Task list with checkboxes (read-only, showing done/not-done)

- [x] Task 3: Wire WorkPane to navigation context (AC: #1, #2, #3, #4)
  - [x] 3.1 Update WorkPane to read `selectedItem` from ProjectNavigationContext
  - [x] 3.2 artifact → SpecViewer, story → StoryViewer, epic → overview, null → default

- [x] Task 4: Breadcrumb (AC: #2, #3)
  - [x] 4.1 Show breadcrumb in WorkPane: "Project > Epic N > Story N.M"
  - [x] 4.2 Clickable segments navigate to that level

- [ ] Task 5: Tests
  - [ ] 5.1 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Reuse `MarkdownBody` — already in the codebase, renders markdown to HTML.

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

Tous les ACs couverts. Deviation structurelle :
- Pas de composants separes `SpecViewer.tsx` et `StoryViewer.tsx` — toute la logique est inlinee dans `WorkPane.tsx` (937 lignes)
- WorkPane inclut aussi des fonctionnalites de stories futures (drift UI, agent launch)
- Vue par defaut : affiche `ProjectAgentsDashboard` si workspace detecte, sinon `OnboardBanner`
- Breadcrumb avec navigation cliquable confirme

**Gap : Task 5 (tests) non implementee**

### File List
- `ui/src/components/WorkPane.tsx` (937 lignes — contient SpecViewer + StoryViewer + epic overview inline)
- `ui/src/components/MarkdownBody.tsx` (reutilise)

### Change Log
- 2026-03-12: Reconciliation — ACs couverts via WorkPane monolithique (pas de composants separes). Tests manquants.
