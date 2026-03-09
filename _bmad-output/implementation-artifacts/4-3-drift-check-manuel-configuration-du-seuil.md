# Story 4.3: Drift Check Manuel & Configuration du Seuil

Status: ready-for-dev

## Story

As a **user**,
I want **to manually trigger drift checks and configure the confidence threshold**,
So that **I control when checks run and filter out low-confidence alerts**.

## Context

Depends on: Stories 4.1, 4.2.

## Acceptance Criteria

### AC1 — Manual drift check from UI

**Given** I'm viewing a spec in the Work pane
**When** I click "Verifier le drift" button
**Then** a drift check runs for that document against its related documents
**And** results appear in the Tests pane

### AC2 — Confidence threshold configuration

**Given** I access project settings
**When** I set the drift confidence threshold (e.g., 0.7)
**Then** only drift alerts with confidence >= threshold are shown in the UI

### AC3 — Full project drift scan

**Given** I'm on the cockpit dashboard
**When** I click "Scan complet du drift"
**Then** all hierarchy pairs are checked for drift
**And** a summary report is generated

## Tasks / Subtasks

- [ ] Task 1: Manual drift check button (AC: #1)
  - [ ] 1.1 Add "Verifier le drift" button in SpecViewer and StoryViewer header
  - [ ] 1.2 On click → call `driftApi.check(projectId, docPath, relatedDocPath)`
  - [ ] 1.3 Show loading state while checking
  - [ ] 1.4 Display results in Tests pane as drift cards

- [ ] Task 2: Confidence threshold (AC: #2)
  - [ ] 2.1 Add `driftConfidenceThreshold` to company settings (or project settings)
  - [ ] 2.2 Add UI control in project settings page — slider 0.0 to 1.0 (default 0.5)
  - [ ] 2.3 Filter drift results client-side based on threshold

- [ ] Task 3: Full project scan (AC: #3)
  - [ ] 3.1 Add `POST /api/projects/:id/drift/scan` — generates all hierarchy pairs and queues checks
  - [ ] 3.2 Add "Scan complet" button in cockpit dashboard
  - [ ] 3.3 Show progress (N/M pairs checked) and summary when complete

- [ ] Task 4: Tests
  - [ ] 4.1 Test: threshold filters low-confidence results
  - [ ] 4.2 Test: full scan generates correct pairs
  - [ ] 4.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT run drift checks synchronously in the API handler — use async queue

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
