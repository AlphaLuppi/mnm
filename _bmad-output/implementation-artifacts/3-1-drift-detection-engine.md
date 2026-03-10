# Story 3.1: Drift Detection Engine

Status: done

## Story

As a **developer**,
I want **a backend service that compares two documents via LLM and detects inconsistencies**,
So that **MnM can alert users when specs diverge**.

## Context

Core differentiator of MnM. Compares documents in BMAD hierarchy: Product Brief → PRD → Architecture → Stories.

## Acceptance Criteria

### AC1 — LLM-based comparison

**Given** two documents
**When** drift detection runs
**Then** returns inconsistencies with severity (critical/warning/info) and confidence score (0-1)

### AC2 — Structured report

**Given** drift is detected
**When** comparison completes
**Then** returns: `{ drifts: [{ severity, confidence, description, sourceExcerpt, targetExcerpt }] }`

### AC3 — REST API endpoint

**Given** a project exists
**When** `POST /api/projects/:id/drift/check` with `{ docA, docB }`
**Then** runs comparison and returns report

### AC4 — Results cached

**Given** drift check completed
**When** `GET /api/projects/:id/drift/results` called
**Then** returns all recent drift reports for this project

## Tasks / Subtasks

- [ ] Task 1: Drift types (AC: #2)
  - [ ] 1.1 Add `DriftReport`, `DriftItem`, `DriftCheckRequest` to `packages/shared/src/types/drift.ts`
  - [ ] 1.2 Export from shared package, build

- [ ] Task 2: Drift detection service (AC: #1, #2)
  - [ ] 2.1 Implement `server/src/services/drift.ts` — `checkDrift(workspacePath, docA, docB): Promise<DriftReport>`
  - [ ] 2.2 Read both documents from filesystem
  - [ ] 2.3 Build LLM prompt asking for structured comparison
  - [ ] 2.4 Parse LLM response into DriftReport
  - [ ] 2.5 Use existing LLM infrastructure (check `server/src/routes/llms.ts`)

- [ ] Task 3: API endpoints (AC: #3, #4)
  - [ ] 3.1 Add `POST /projects/:id/drift/check` to routes
  - [ ] 3.2 Add `GET /projects/:id/drift/results` — in-memory cache per project
  - [ ] 3.3 Validate request with Zod

- [ ] Task 4: API client (AC: #3, #4)
  - [ ] 4.1 Create `ui/src/api/drift.ts`: `driftApi.check()`, `driftApi.getResults()`

- [ ] Task 5: Tests
  - [ ] 5.1 Test: drift prompt is well-formed
  - [ ] 5.2 Test: results cached correctly
  - [ ] 5.3 Verify: `pnpm build` succeeds

## Dev Notes

### LLM Prompt
```
Compare these two software project documents for inconsistencies.
Document A (source of truth): [content]
Document B (derived): [content]
Return JSON: [{ "severity": "critical|warning|info", "confidence": 0.0-1.0, "description": "...", "sourceExcerpt": "...", "targetExcerpt": "..." }]
Focus on: requirement contradictions, missing requirements, scope creep, architectural violations.
```

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
