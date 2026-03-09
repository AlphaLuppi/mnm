# Story 2.1: Agent Harness — Lancer & Arreter des Agents

Status: ready-for-dev

## Story

As a **user**,
I want **to launch and stop agents from the Work pane when viewing a story or epic**,
So that **I can assign work to agents directly from the spec context**.

## Context

Depends on: Epic 1 (three-pane layout with BMAD navigation).

Paperclip fork already has full agent management: `NewAgentDialog`, `AgentDetail`, agent API (`ui/src/api/agents.ts`), heartbeat engine, adapters. The existing flow is: go to Agents page → create agent → create issue → agent runs via heartbeat.

This story adds the ability to **launch an agent on a specific story/epic directly from the cockpit view**. It creates an issue linked to the BMAD story and assigns it to an agent.

## Acceptance Criteria

### AC1 — Launch agent from story view

**Given** I'm viewing a story in the Work pane
**When** I click "Lancer un agent" button
**Then** a dialog opens where I can select an existing agent (or create a new one)
**And** an issue is created with the story content as description
**And** the agent starts working on it via the heartbeat engine

### AC2 — Launch agent from epic view

**Given** I'm viewing an epic overview in the Work pane
**When** I click "Lancer un agent" on a specific story within the epic
**Then** same behavior as AC1 for that story

### AC3 — Stop agent from cockpit

**Given** an agent is running on a story
**When** I click "Stop" on the running agent indicator
**Then** the agent's current run is cancelled

### AC4 — Agent status visible in cockpit

**Given** an agent is running on a story
**When** I look at the Work pane or Context pane
**Then** I see an indicator showing which agent is working on which story
**And** the story in the Context pane tree shows a running indicator

## Tasks / Subtasks

- [ ] Task 1: Create LaunchAgentDialog (AC: #1, #2)
  - [ ] 1.1 Create `ui/src/components/LaunchAgentDialog.tsx` — dialog with agent selector dropdown (lists existing agents from `agentsApi.list()`)
  - [ ] 1.2 Add option to select BMAD workflow type: "dev-story" (default), "correct-course", "code-review", "brainstorm"
  - [ ] 1.3 On confirm: create issue via `issuesApi.create()` with story title as issue title, story markdown as description, link to BMAD file path in metadata
  - [ ] 1.4 The issue triggers the agent via the existing heartbeat engine (no new backend needed)

- [ ] Task 2: Add launch button to StoryViewer (AC: #1)
  - [ ] 2.1 Add "Lancer un agent" button in `StoryViewer.tsx` header area (rocket icon + text)
  - [ ] 2.2 On click → open `LaunchAgentDialog` with story context pre-filled
  - [ ] 2.3 Style as primary button when no agent running, disabled when agent active

- [ ] Task 3: Add launch buttons to epic overview (AC: #2)
  - [ ] 3.1 In the epic overview (WorkPane when epic selected), add a small launch icon button next to each story row
  - [ ] 3.2 Same behavior: opens `LaunchAgentDialog` with that story's context

- [ ] Task 4: Stop agent from cockpit (AC: #3)
  - [ ] 4.1 Add stop button next to running agent indicator — calls existing agent stop API
  - [ ] 4.2 Use `heartbeatsApi.cancelRun()` or equivalent existing API

- [ ] Task 5: Agent status in Context pane (AC: #4)
  - [ ] 5.1 Query `heartbeatsApi.liveRunsForCompany()` (already used by Sidebar) to get running agents
  - [ ] 5.2 Match running issues to BMAD stories by issue title or metadata
  - [ ] 5.3 Show a small animated dot or agent icon next to stories that have an active agent
  - [ ] 5.4 In WorkPane, show `LiveRunWidget` (already exists) when viewing a story with active agent

- [ ] Task 6: Tests
  - [ ] 6.1 Test: LaunchAgentDialog lists available agents
  - [ ] 6.2 Test: Issue is created with correct story content
  - [ ] 6.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Existing Agent Infrastructure (DO NOT rebuild)

- Agent CRUD: `ui/src/api/agents.ts` + `server/src/routes/agents.ts`
- Heartbeat engine: `server/src/services/heartbeat.ts` — runs agents on schedule
- Live runs: `heartbeatsApi.liveRunsForCompany()` — returns currently running agents
- Live run widget: `ui/src/components/LiveRunWidget.tsx` — shows agent output in real-time
- Agent adapters: `packages/adapters/` — claude-local, codex-local, etc.
- Issue creation: `ui/src/api/issues.ts` + `server/src/routes/issues.ts`

### Key Insight

The "launch agent on story" flow is essentially:
1. Create an issue with the story content
2. Assign it to an agent
3. The heartbeat engine picks it up automatically

No new backend infrastructure needed — just UI to bridge BMAD stories → Paperclip issues.

### What NOT to do

- Do NOT create a new agent execution engine — use existing heartbeat
- Do NOT create new adapters
- Do NOT modify the heartbeat service
- Do NOT create IPC/Electron code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
