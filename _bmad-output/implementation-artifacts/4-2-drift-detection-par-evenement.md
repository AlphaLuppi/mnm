# Story 4.2: Drift Detection par Evenement

Status: ready-for-dev

## Story

As a **user**,
I want **drift detection to run automatically when context files change**,
So that **I'm alerted to inconsistencies as soon as they appear**.

## Context

Depends on: Stories 3.1 (file watcher), 4.1 (drift engine). When a BMAD document changes, automatically check for drift against related documents.

## Acceptance Criteria

### AC1 — Automatic drift check on file change

**Given** file watcher detects a change in `_bmad-output/`
**When** the changed file is a planning artifact or story
**Then** drift detection runs against related documents in the hierarchy

### AC2 — Hierarchy-aware comparison pairs

**Given** a PRD is modified
**When** drift detection triggers
**Then** it compares PRD vs each story derived from it
**And** it compares PRD vs architecture document

### AC3 — Drift results cached

**Given** drift detection has run
**When** the results are available
**Then** they are stored in memory (or DB) and accessible via `GET /api/projects/:id/drift/results`

## Tasks / Subtasks

- [ ] Task 1: Event-driven drift triggering (AC: #1, #2)
  - [ ] 1.1 In file watcher, when a `_bmad-output/` file changes, determine its type (planning artifact or story)
  - [ ] 1.2 Build comparison pairs based on BMAD hierarchy: PRD↔stories, architecture↔stories, product-brief↔PRD
  - [ ] 1.3 Queue drift checks (don't block — run async, debounce 30s to avoid rapid re-checks)
  - [ ] 1.4 Emit `drift:started` and `drift:completed` WebSocket events

- [ ] Task 2: Drift results API (AC: #3)
  - [ ] 2.1 Store drift results in memory with TTL (or simple JSON store per project)
  - [ ] 2.2 Add `GET /api/projects/:id/drift/results` — returns all recent drift reports for the project
  - [ ] 2.3 Add `ui/src/api/drift.ts` with `driftApi.getResults(projectId, companyId)`

- [ ] Task 3: Tests
  - [ ] 3.1 Test: correct comparison pairs generated for hierarchy
  - [ ] 3.2 Test: debounce prevents rapid re-checks
  - [ ] 3.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Hierarchy Pairs
```
product-brief → prd (parent→child)
prd → architecture (sibling)
prd → each story (parent→children)
architecture → each story (constraint→implementation)
```

### What NOT to do
- Do NOT persist drift results in database (for now) — in-memory cache is fine
- Do NOT create IPC/Electron code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
