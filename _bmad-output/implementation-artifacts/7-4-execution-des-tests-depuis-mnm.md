# Story 7.4: Execution des Tests depuis MnM

Status: ready-for-dev

## Story

As a **user**,
I want **to run tests directly from MnM**,
So that **I can validate my work without switching to a terminal**.

## Context

Depends on: Stories 7.1-7.3.

## Acceptance Criteria

### AC1 — Run all tests for a story

**Given** I'm viewing a story
**When** I click "Lancer les tests"
**Then** tests associated with that story are executed
**And** results update in real-time in the Tests pane

### AC2 — Run single test

**Given** I'm viewing a specific test
**When** I click the run button on that test
**Then** only that test runs
**And** the result updates immediately

### AC3 — Run all project tests

**Given** I'm on the cockpit dashboard
**When** I click "Lancer tous les tests"
**Then** the full test suite runs
**And** a progress indicator shows completion

### AC4 — Test output visible

**Given** tests are running
**When** I want to see output
**Then** I can view the test runner output in a panel (similar to agent output)

## Tasks / Subtasks

- [ ] Task 1: Test runner service (AC: #1, #2, #3)
  - [ ] 1.1 Create `server/src/services/test-runner.ts`
  - [ ] 1.2 Execute tests via shell: `pnpm test --filter=<pattern>` or `npx vitest run <file>`
  - [ ] 1.3 Stream output via WebSocket
  - [ ] 1.4 Parse results from Vitest JSON output

- [ ] Task 2: API endpoints (AC: #1, #2, #3)
  - [ ] 2.1 Add `POST /api/projects/:id/tests/run` with body `{ scope: 'story'|'test'|'all', storyId?, testId? }`
  - [ ] 2.2 Add `GET /api/projects/:id/tests/run-status` for current run status
  - [ ] 2.3 WebSocket events: `test:started`, `test:output`, `test:completed`

- [ ] Task 3: UI integration (AC: #1, #2, #3, #4)
  - [ ] 3.1 Add "Lancer les tests" button in StoryViewer
  - [ ] 3.2 Add run button on each test card
  - [ ] 3.3 Add "Lancer tous les tests" in dashboard
  - [ ] 3.4 Create TestOutputPanel similar to LiveRunWidget for viewing output

- [ ] Task 4: Tests
  - [ ] 4.1 Test: test runner executes correct command
  - [ ] 4.2 Test: output streams correctly
  - [ ] 4.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Test Execution Commands
```bash
# Vitest - run specific file
npx vitest run tests/story-1-2.test.ts

# Vitest - run all
npx vitest run

# With JSON output
npx vitest run --reporter=json --outputFile=test-results.json
```

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT support every test framework — Vitest + Jest are sufficient for MVP

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
