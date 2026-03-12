# Story 2.2: Agent Output in Cockpit

Status: review

## Story

As a **user**,
I want **to see agent output in real-time within the cockpit Work pane**,
So that **I can follow what an agent is doing without leaving the cockpit**.

## Context

Depends on: 2.1. Paperclip has `LiveRunWidget` for real-time output. This story embeds it in the cockpit.

## Acceptance Criteria

### AC1 — Live output in Work pane

**Given** an agent is running on a story
**When** I view that story in the cockpit
**Then** the Work pane shows live agent output below the story detail

### AC2 — Running indicator in Context pane

**Given** an agent is running on a story
**When** I view the Context pane
**Then** that story shows a running indicator (animated dot)

## Tasks / Subtasks

- [x] Task 1: Embed LiveRunWidget (AC: #1)
  - [x] 1.1 In StoryViewer, detect if an active run is linked to this story
  - [x] 1.2 Query `heartbeatsApi.liveRunsForCompany()` and match by issue title/metadata
  - [x] 1.3 If running → show `LiveRunWidget` below story content

- [x] Task 2: Running indicator (AC: #2)
  - [x] 2.1 In ContextPane, check live runs against stories
  - [x] 2.2 Show animated dot (`animate-pulse`) next to running stories

- [ ] Task 3: Tests
  - [ ] 3.1 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Reuse `LiveRunWidget` — don't rebuild agent output viewer.

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

Tous les ACs couverts :
- AC1 : LiveRunWidget (21k lignes) integre avec streaming en temps reel, transcript, tool calls
- AC2 : `RunningDot` composant anime (vert, `animate-ping`) affiche a cote des stories en cours dans ContextPane
- Detection des runs via `runningTitles.has(node.title)` dans ContextPane
- ActiveAgentsPanel (17k lignes) fournit aussi un suivi en temps reel

**Gap : Task 3 (tests) non implementee**

### File List
- `ui/src/components/LiveRunWidget.tsx` (21k lignes)
- `ui/src/components/ActiveAgentsPanel.tsx` (17k lignes)
- `ui/src/components/ContextPane.tsx` (RunningDot composant)
- `ui/src/components/WorkPane.tsx` (integration LiveRunWidget)

### Change Log
- 2026-03-12: Reconciliation — tous ACs couverts. Tests manquants.
