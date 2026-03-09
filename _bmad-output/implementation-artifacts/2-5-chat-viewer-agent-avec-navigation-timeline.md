# Story 2.5: Chat Viewer Agent avec Navigation Timeline

Status: ready-for-dev

## Story

As a **user**,
I want **to view an agent's chat/output log with the ability to jump to specific moments via the timeline**,
So that **I can review what an agent did at any point during its run**.

## Context

Depends on: Stories 2.1-2.4. Paperclip has `LiveRunWidget` showing real-time output and `run-log-store` persisting run logs. This story adds a scrollable chat viewer in the Work pane with timeline integration.

## Acceptance Criteria

### AC1 — Chat viewer shows agent output

**Given** I click on an agent (from agent list or from a running story)
**When** the agent detail loads in the Work pane
**Then** I see a scrollable chat/log viewer showing the agent's output chronologically
**And** it distinguishes between: agent messages, file changes, tool calls, errors

### AC2 — Timeline click jumps to moment

**Given** the TimelineBar shows an event for this agent
**When** I click that event in the timeline
**Then** the chat viewer scrolls to that exact moment in the log

### AC3 — Live streaming for active runs

**Given** an agent is currently running
**When** I view its chat log
**Then** new output appears in real-time (streamed via WebSocket)
**And** the view auto-scrolls to follow new output

## Tasks / Subtasks

- [ ] Task 1: Create AgentChatViewer component (AC: #1, #3)
  - [ ] 1.1 Create `ui/src/components/AgentChatViewer.tsx` — fetches run log from `heartbeatsApi` or run log API
  - [ ] 1.2 Render log entries as chat bubbles: agent output (left), tool calls (monospace), file changes (with file icon), errors (red)
  - [ ] 1.3 For active runs, subscribe to WebSocket stream for real-time updates
  - [ ] 1.4 Auto-scroll to bottom on new messages (unless user has scrolled up)
  - [ ] 1.5 Show run metadata at top: started at, duration, status, cost

- [ ] Task 2: Timeline integration (AC: #2)
  - [ ] 2.1 Each log entry has a timestamp ID that can be targeted
  - [ ] 2.2 TimelineBar click emits the event timestamp via ProjectNavigationContext
  - [ ] 2.3 AgentChatViewer listens for timeline navigation and scrolls to matching entry

- [ ] Task 3: Wire into WorkPane (AC: #1)
  - [ ] 3.1 Add `'agent'` type to ProjectNavigationContext selectedItem
  - [ ] 3.2 When agent selected → WorkPane renders AgentChatViewer
  - [ ] 3.3 Embed existing `LiveRunWidget` content for active runs

- [ ] Task 4: Tests
  - [ ] 4.1 Test: AgentChatViewer renders log entries
  - [ ] 4.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Existing Infrastructure
- `LiveRunWidget` (`ui/src/components/LiveRunWidget.tsx`) — real-time agent output
- `run-log-store` (`server/src/services/run-log-store.ts`) — persists run logs
- WebSocket events for run output already implemented

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT rebuild the run log system
- Do NOT create a full terminal emulator — simple formatted log viewer is sufficient

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
