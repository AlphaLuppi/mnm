# Story 2.3: Progression Agent & Detection de Blocage

Status: ready-for-dev

## Story

As a **user**,
I want **to see agent progress as task checkpoints and be alerted when an agent is blocked**,
So that **I can intervene quickly when an agent gets stuck**.

## Context

Depends on: Story 2.2. Paperclip fork has `LiveRunWidget` showing real-time agent output and `heartbeat_run_events` tracking run states.

## Acceptance Criteria

### AC1 — Progress from BMAD task checkboxes

**Given** an agent is working on a BMAD story
**When** the agent marks tasks as done (`- [x]`) in the story file
**Then** the progress bar updates (e.g., "5/12 tasks done — 42%")
**And** the file watcher detects the change (if implemented) or polling refreshes

### AC2 — Blockage detection

**Given** an agent has been running for >10 minutes without any file change or output
**When** the system checks agent activity
**Then** the agent is flagged as "potentially blocked" with an orange indicator
**And** a notification appears in the cockpit

### AC3 — One-click jump to blocked agent

**Given** a blocked agent notification is shown
**When** I click on it
**Then** I navigate to the agent's live run output to diagnose the issue

## Tasks / Subtasks

- [ ] Task 1: Progress tracking from story file (AC: #1)
  - [ ] 1.1 Add `GET /api/projects/:id/bmad/story-progress?path=<story-path>` endpoint — reads story file, counts `[x]` vs `[ ]` tasks
  - [ ] 1.2 Create `ui/src/hooks/useStoryProgress.ts` — polls story progress every 15 seconds when agent is running
  - [ ] 1.3 Create `ui/src/components/StoryProgressBar.tsx` — visual progress bar with "N/M tasks" label
  - [ ] 1.4 Display in StoryViewer header and in ContextPane story row

- [ ] Task 2: Blockage detection (AC: #2)
  - [ ] 2.1 Add server-side check in heartbeat service: if a run has been active >10min with no `heartbeat_run_events` updates, flag as `potentially_blocked`
  - [ ] 2.2 Expose blockage status in `heartbeatsApi.liveRunsForCompany()` response (add `blocked: boolean` field)
  - [ ] 2.3 Show orange pulsing indicator in AgentHealthList for blocked agents

- [ ] Task 3: Blockage notification (AC: #2, #3)
  - [ ] 3.1 Use existing toast system (`useToast`) to show blockage notification
  - [ ] 3.2 Toast includes agent name + "potentiellement bloque" + action button "Voir"
  - [ ] 3.3 "Voir" click navigates to agent detail with LiveRunWidget

- [ ] Task 4: Tests
  - [ ] 4.1 Test: story progress counts tasks correctly
  - [ ] 4.2 Test: blockage flag triggers after inactivity threshold
  - [ ] 4.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT rebuild the heartbeat engine — extend it minimally
- Do NOT create complex ML-based blockage detection — simple time-based heuristic is fine

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
