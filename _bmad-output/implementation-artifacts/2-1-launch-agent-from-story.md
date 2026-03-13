# Story 2.1: Launch Agent from Story

Status: review

## Story

As a **user**,
I want **to launch an agent on a BMAD story directly from the cockpit**,
So that **I can assign work to agents from the spec context**.

## Context

Depends on: Epic 1. Paperclip already has: agent CRUD, heartbeat engine, adapters, issue creation. This story bridges BMAD stories → Paperclip issues to trigger agent execution.

## Acceptance Criteria

### AC1 — Launch button on story view

**Given** I'm viewing a story in WorkPane
**When** I click "Lancer un agent"
**Then** a dialog opens to select agent + BMAD workflow type

### AC2 — Issue created from story

**Given** I select an agent and confirm
**When** the dialog submits
**Then** an issue is created with story title + content, assigned to the agent

### AC3 — Agent starts working

**Given** the issue is created
**When** the heartbeat engine picks it up
**Then** the agent runs on the story in the project workspace

## Tasks / Subtasks

- [x] Task 1: LaunchAgentDialog (AC: #1, #2)
  - [x] 1.1 Create `ui/src/components/LaunchAgentDialog.tsx`
  - [x] 1.2 Agent selector dropdown (from `agentsApi.list()`)
  - [x] 1.3 Workflow type selector: "dev-story" (default), "correct-course", "code-review"
  - [x] 1.4 On confirm: call `issuesApi.create()` with story content

- [x] Task 2: Launch button in StoryViewer (AC: #1)
  - [x] 2.1 Add "Lancer un agent" button (Rocket icon) in StoryViewer header
  - [x] 2.2 Also add small launch icon per story in epic overview

- [ ] Task 3: Tests
  - [ ] 3.1 Test: dialog lists available agents
  - [ ] 3.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Key insight: "launch agent on story" = create issue with story content → heartbeat picks it up. No new backend needed.

### Existing APIs used
- `agentsApi.list(companyId)` — list available agents
- `issuesApi.create(companyId, data)` — create issue → triggers heartbeat

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

Tous les ACs couverts. Implementation bien au-dela des specs :
- `LaunchAgentDialog.tsx` fait 18k lignes (massif vs. le dialog simple prevu)
- Inclut : selection d'agent, configuration d'adapter, context d'issue, integration workflow, BMAD agent trigger
- Le bouton launch est integre dans WorkPane (pas dans un StoryViewer separe)
- Le heartbeat engine (79k lignes) gere l'execution

**Gap : Task 3 (tests) non implementee**

### File List
- `ui/src/components/LaunchAgentDialog.tsx` (18k lignes)
- `ui/src/components/WorkPane.tsx` (bouton launch integre)
- `server/src/services/heartbeat.ts` (79k lignes — engine d'execution)

### Change Log
- 2026-03-12: Reconciliation — ACs couverts. LaunchAgentDialog sur-dimensionne par rapport aux specs. Tests manquants.
