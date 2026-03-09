# Story 3.3: Drag & Drop de Contexte vers un Agent

Status: ready-for-dev

## Story

As a **user**,
I want **to drag a context file onto an agent to add it to that agent's context**,
So that **I can easily control what information agents work with**.

## Context

Depends on: Story 3.2. This story adds drag-and-drop from the Context pane to an agent in the Work pane.

## Acceptance Criteria

### AC1 — Drag file from Context pane

**Given** context files are listed in the Context pane
**When** I start dragging a file
**Then** a drag preview shows the filename
**And** valid drop targets (agents) highlight

### AC2 — Drop onto agent

**Given** I'm dragging a context file
**When** I drop it onto an agent in the Work pane
**Then** the file is added to that agent's context configuration
**And** a confirmation toast appears

### AC3 — Remove context file

**Given** an agent has context files
**When** I click the remove button on a file in the agent's context list
**Then** the file is removed from the agent's context

## Tasks / Subtasks

- [ ] Task 1: Implement drag source (AC: #1)
  - [ ] 1.1 Add HTML5 drag handlers to file items in ContextPane and AgentContextFiles
  - [ ] 1.2 Set drag data with file path and project ID
  - [ ] 1.3 Visual drag preview with file icon + name

- [ ] Task 2: Implement drop target (AC: #2)
  - [ ] 2.1 Add drop handler to agent cards in AgentHealthList
  - [ ] 2.2 On drop: call API to add file to agent's context config
  - [ ] 2.3 Create `POST /api/agents/:id/context-files` endpoint
  - [ ] 2.4 Show success toast on drop

- [ ] Task 3: Remove context file (AC: #3)
  - [ ] 3.1 Add remove button (X icon) to each file in AgentContextFiles
  - [ ] 3.2 Create `DELETE /api/agents/:id/context-files/:path` endpoint
  - [ ] 3.3 Confirm removal with toast

- [ ] Task 4: Tests
  - [ ] 4.1 Test: drag data is set correctly
  - [ ] 4.2 Test: API creates and removes context file associations
  - [ ] 4.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Context file storage
Agent context file associations can be stored in agent config JSON (existing `agents.config` field) or a new `agent_context_files` table. Prefer the config JSON approach to avoid schema changes.

### What NOT to do
- Do NOT use a heavy drag-drop library — HTML5 native drag-drop is sufficient
- Do NOT create IPC/Electron code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
