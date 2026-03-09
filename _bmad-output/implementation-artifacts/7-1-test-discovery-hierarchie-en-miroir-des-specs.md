# Story 7.1: Test Discovery & Hierarchie en Miroir des Specs

Status: ready-for-dev

## Story

As a **user**,
I want **to see tests organized as a mirror of the spec hierarchy**,
So that **I can understand test coverage at each level of my project**.

## Context

Depends on: Epic 1 (BMAD analyzer), Story 1.4 (Tests pane). The Tests pane currently shows acceptance criteria as "tests". This story adds discovery of actual test files in the workspace.

## Acceptance Criteria

### AC1 — Test file discovery

**Given** a project workspace has test files (`*.test.ts`, `*.spec.ts`, etc.)
**When** MnM scans the workspace
**Then** test files are discovered and associated with specs by naming convention

### AC2 — Hierarchy in Tests pane

**Given** tests are discovered
**When** I view the Tests pane
**Then** the hierarchy shows: Project (e2e) → Epic (integration) → Story (unit groups) → Acceptance Criteria

### AC3 — Coverage indicators

**Given** specs and tests are mapped
**When** I view a spec in the hierarchy
**Then** I see a coverage indicator: "3/5 ACs have tests"

## Tasks / Subtasks

- [ ] Task 1: Test discovery service (AC: #1)
  - [ ] 1.1 Create `server/src/services/test-discovery.ts`
  - [ ] 1.2 Scan workspace for test files: `**/*.test.{ts,tsx,js}`, `**/*.spec.{ts,tsx,js}`, `**/__tests__/**`
  - [ ] 1.3 Associate tests with specs by naming convention: `story-1-2.test.ts` → Story 1.2, `AC1.test.ts` → AC1
  - [ ] 1.4 Add `GET /api/projects/:id/tests` endpoint returning discovered tests

- [ ] Task 2: Tests pane hierarchy (AC: #2)
  - [ ] 2.1 Update TestsPane to fetch tests from `testsApi.list(projectId)`
  - [ ] 2.2 Merge discovered tests with BMAD acceptance criteria hierarchy
  - [ ] 2.3 Show: AC from spec + associated test files (if any)

- [ ] Task 3: Coverage indicators (AC: #3)
  - [ ] 3.1 Compute coverage per story: ACs with at least one associated test / total ACs
  - [ ] 3.2 Show coverage badge in story header: "2/4 ACs covered"

- [ ] Task 4: Tests
  - [ ] 4.1 Test: test discovery finds test files
  - [ ] 4.2 Test: naming convention mapping works
  - [ ] 4.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Naming Convention for Test-to-Spec Mapping
```
tests/story-1-2.test.ts      → Story 1.2
tests/1-2/AC1.test.ts        → Story 1.2, AC1
tests/epic-1.integration.ts  → Epic 1 integration test
e2e/full-flow.spec.ts        → Project-level e2e
```

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT require perfect mapping — unmapped tests show as "unassociated"

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
