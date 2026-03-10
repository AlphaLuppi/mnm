# Story 2.2: Agent Output in Cockpit

Status: done

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

- [ ] Task 1: Embed LiveRunWidget (AC: #1)
  - [ ] 1.1 In StoryViewer, detect if an active run is linked to this story
  - [ ] 1.2 Query `heartbeatsApi.liveRunsForCompany()` and match by issue title/metadata
  - [ ] 1.3 If running → show `LiveRunWidget` below story content

- [ ] Task 2: Running indicator (AC: #2)
  - [ ] 2.1 In ContextPane, check live runs against stories
  - [ ] 2.2 Show animated dot (`animate-pulse`) next to running stories

- [ ] Task 3: Tests
  - [ ] 3.1 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Reuse `LiveRunWidget` — don't rebuild agent output viewer.

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
