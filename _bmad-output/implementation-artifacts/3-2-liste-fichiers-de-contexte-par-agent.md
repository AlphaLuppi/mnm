# Story 3.2: Liste des Fichiers de Contexte par Agent

Status: ready-for-dev

## Story

As a **user**,
I want **to see which context files each agent is using**,
So that **I understand what information agents have access to**.

## Context

Depends on: Stories 3.1, Epic 1. In BMAD projects, agents have context files (CLAUDE.md, AGENTS.md, story files, etc.). This story shows those files per agent in the Context pane.

## Acceptance Criteria

### AC1 — Context files listed per agent

**Given** I select an agent in the cockpit
**When** the Context pane updates
**Then** it shows the files this agent has in its context (from agent config or working directory)

### AC2 — File badges show which agents use them

**Given** context files are displayed
**When** I look at a file in the Context pane
**Then** I see small badges indicating which agent(s) reference that file

### AC3 — File modification indicator

**Given** context files are displayed
**When** a file was recently modified (within last 5 minutes)
**Then** it shows a "modified" indicator with relative timestamp

## Tasks / Subtasks

- [ ] Task 1: Agent context file resolution (AC: #1)
  - [ ] 1.1 Create `server/src/services/agent-context.ts` — given an agent config and workspace path, list the files the agent would have in context
  - [ ] 1.2 For Claude Code agents: scan for `CLAUDE.md`, `.claude/` directory, linked story files
  - [ ] 1.3 For generic agents: list files in the agent's working directory matching common patterns (*.md, *.yaml, *.json in root and _bmad/)
  - [ ] 1.4 Add `GET /api/agents/:id/context-files` endpoint

- [ ] Task 2: UI for context files (AC: #1, #2, #3)
  - [ ] 2.1 Create `ui/src/components/AgentContextFiles.tsx` — list of files with icons, relative paths, agent badges
  - [ ] 2.2 Show in ContextPane when an agent is selected (below the spec tree)
  - [ ] 2.3 Use file watcher events to highlight recently modified files
  - [ ] 2.4 Click file → show its content in the Work pane via `bmadApi.getFile()` (generalized to any workspace file)

- [ ] Task 3: Tests
  - [ ] 3.1 Test: context file resolution finds CLAUDE.md
  - [ ] 3.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT read file contents at list time — only paths and metadata

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
