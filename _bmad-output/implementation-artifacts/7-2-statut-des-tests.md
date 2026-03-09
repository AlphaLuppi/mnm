# Story 7.2: Statut des Tests (Pass/Fail/Pending)

Status: ready-for-dev

## Story

As a **user**,
I want **to see the status of each test (pass/fail/pending)**,
So that **I know which tests are working and which need attention**.

## Context

Depends on: Story 7.1.

## Acceptance Criteria

### AC1 — Test status display

**Given** tests have been run
**When** I view the Tests pane
**Then** each test shows its status: pass (green check), fail (red X), pending (gray circle)

### AC2 — Status from test results file

**Given** a test run has produced results (e.g., `test-results.json`, Vitest output)
**When** MnM reads the results
**Then** test statuses are updated accordingly

### AC3 — Aggregated status per story/epic

**Given** tests have various statuses
**When** I view a story or epic in the hierarchy
**Then** I see aggregated status: "5 pass, 2 fail, 1 pending"

## Tasks / Subtasks

- [ ] Task 1: Test results parser (AC: #2)
  - [ ] 1.1 Create `server/src/services/test-results-parser.ts`
  - [ ] 1.2 Parse Vitest JSON output (`vitest.config.ts` with `reporters: ['json']`)
  - [ ] 1.3 Parse Jest JSON output (for compatibility)
  - [ ] 1.4 Store results in memory with TTL

- [ ] Task 2: API for test status (AC: #1, #2)
  - [ ] 2.1 Add `GET /api/projects/:id/tests/results` endpoint
  - [ ] 2.2 Return test statuses merged with discovered tests

- [ ] Task 3: UI status display (AC: #1, #3)
  - [ ] 3.1 Update TestCard to show pass/fail/pending icon
  - [ ] 3.2 Show aggregated counts in story/epic headers

- [ ] Task 4: Tests
  - [ ] 4.1 Test: Vitest JSON parsing extracts statuses correctly
  - [ ] 4.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT persist test results in database — in-memory or file-based is fine

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
