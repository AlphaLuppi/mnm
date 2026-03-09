# Story 4.1: LLM Service & Drift Detection Engine

Status: ready-for-dev

## Story

As a **developer**,
I want **a backend service that uses an LLM to compare two documents and detect inconsistencies (drift)**,
So that **MnM can alert users when specs, architecture, or code diverge**.

## Context

Depends on: Epic 1 (BMAD analyzer). Drift detection is the core differentiator of MnM. It compares documents in the BMAD hierarchy: Product Brief → PRD → Architecture → Stories → Code.

The existing `server/src/services/drift.ts` has a placeholder. This story implements it.

## Acceptance Criteria

### AC1 — LLM-based comparison

**Given** two documents (e.g., PRD and a story)
**When** the drift detection service compares them
**Then** it returns a list of inconsistencies with severity (critical/warning/info) and confidence score

### AC2 — Configurable LLM provider

**Given** the server has LLM configuration (API key, model)
**When** drift detection runs
**Then** it uses the configured LLM (default: company's configured LLM, or fall back to Anthropic)

### AC3 — Structured drift report

**Given** drift is detected
**When** the comparison completes
**Then** it returns: `{ drifts: [{ id, severity, confidence, sourceDoc, targetDoc, sourceExcerpt, targetExcerpt, description }] }`

### AC4 — REST API endpoint

**Given** a project exists
**When** `POST /api/projects/:id/drift/check` is called with `{ docA: path, docB: path }`
**Then** the drift detection runs and returns the report

## Tasks / Subtasks

- [ ] Task 1: Implement drift detection service (AC: #1, #2, #3)
  - [ ] 1.1 Update `server/src/services/drift.ts` with `checkDrift(workspacePath, docAPath, docBPath, llmConfig): Promise<DriftReport>`
  - [ ] 1.2 Read both documents from the workspace filesystem
  - [ ] 1.3 Build a prompt that asks the LLM to compare the documents and find inconsistencies, returning structured JSON
  - [ ] 1.4 Parse LLM response into `DriftReport` type
  - [ ] 1.5 Use existing LLM service infrastructure (check `server/src/routes/llms.ts` for patterns)

- [ ] Task 2: Create shared drift types (AC: #3)
  - [ ] 2.1 Add to `packages/shared/src/types/drift.ts`: `DriftReport`, `DriftItem`, `DriftSeverity`, `DriftCheckRequest`
  - [ ] 2.2 Export from shared package

- [ ] Task 3: Create API endpoint (AC: #4)
  - [ ] 3.1 Add `POST /api/projects/:id/drift/check` to `server/src/routes/bmad.ts` (or create `server/src/routes/drift.ts`)
  - [ ] 3.2 Validate request body with Zod schema
  - [ ] 3.3 Resolve project workspace path from DB
  - [ ] 3.4 Run drift check and return report

- [ ] Task 4: API client (AC: #4)
  - [ ] 4.1 Add `driftApi.check(projectId, docA, docB, companyId)` to `ui/src/api/bmad.ts` or create `ui/src/api/drift.ts`

- [ ] Task 5: Tests
  - [ ] 5.1 Test: drift service builds correct prompt
  - [ ] 5.2 Test: drift report parsing handles structured LLM output
  - [ ] 5.3 Test: API validates request body
  - [ ] 5.4 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### LLM Prompt Strategy
```
You are a document consistency checker. Compare these two documents from a software project and find inconsistencies.

Document A (source of truth): [PRD content]
Document B (derived document): [Story content]

Return a JSON array of inconsistencies found:
[{ "severity": "critical|warning|info", "confidence": 0.0-1.0, "description": "...", "sourceExcerpt": "...", "targetExcerpt": "..." }]

Focus on: requirements contradictions, missing requirements in derived doc, architectural violations, scope creep.
```

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT implement complex NLP — use LLM for comparison
- Do NOT run drift checks automatically yet (Story 4.2 handles event-driven triggering)

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
