# Story 4.4: Alerte Drift & Vue Diff

Status: ready-for-dev

## Story

As a **user**,
I want **to see drift alerts with the exact diff between conflicting documents**,
So that **I understand precisely what's inconsistent**.

## Context

Depends on: Stories 4.1-4.3.

## Acceptance Criteria

### AC1 — Drift alerts in Tests pane

**Given** drift has been detected
**When** I view the Tests pane
**Then** drift alerts appear as cards with: severity icon, description, confidence score, source/target doc names

### AC2 — Diff view

**Given** I click on a drift alert
**When** the diff view opens
**Then** I see a side-by-side view highlighting the conflicting excerpts from both documents
**And** the inconsistency description is shown above the diff

### AC3 — Drift count in Context pane

**Given** drift alerts exist for a document
**When** I view the Context pane spec tree
**Then** the affected document shows a drift count badge (e.g., "2 drifts")

## Tasks / Subtasks

- [ ] Task 1: DriftAlertCard component (AC: #1)
  - [ ] 1.1 Create `ui/src/components/DriftAlertCard.tsx` — severity icon (🔴 critical, 🟡 warning, 🔵 info), description, confidence badge, source↔target doc names
  - [ ] 1.2 Display in Tests pane when drift results exist — add a "Drift Alerts" section above ACs
  - [ ] 1.3 Use `useDriftResults(projectId)` hook to fetch results from `driftApi.getResults()`

- [ ] Task 2: Diff viewer (AC: #2)
  - [ ] 2.1 Create `ui/src/components/DriftDiffViewer.tsx` — side-by-side view with source excerpt (left) and target excerpt (right)
  - [ ] 2.2 Highlight the conflicting text using background color
  - [ ] 2.3 Show inconsistency description at top
  - [ ] 2.4 Open in Work pane when drift card is clicked

- [ ] Task 3: Drift badges in Context pane (AC: #3)
  - [ ] 3.1 Count drifts per document from drift results
  - [ ] 3.2 Show badge next to document name in ContextPane: small red pill with count

- [ ] Task 4: Tests
  - [ ] 4.1 Test: DriftAlertCard renders all fields
  - [ ] 4.2 Test: DriftDiffViewer shows side-by-side excerpts
  - [ ] 4.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT use a complex diff library — simple side-by-side text excerpts with highlight is sufficient
- Do NOT create IPC/Electron code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
