# Story 3.1: Drift Detection Engine

Status: review

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

- [x] Task 1: Drift types (AC: #2)
  - [x] 1.1 Add `DriftReport`, `DriftItem`, `DriftCheckRequest` to `packages/shared/src/types/drift.ts`
  - [x] 1.2 Export from shared package, build

- [x] Task 2: Drift detection service (AC: #1, #2)
  - [x] 2.1 Implement `server/src/services/drift.ts` — `checkDrift(workspacePath, docA, docB): Promise<DriftReport>`
  - [x] 2.2 Read both documents from filesystem
  - [x] 2.3 Build LLM prompt asking for structured comparison
  - [x] 2.4 Parse LLM response into DriftReport
  - [x] 2.5 Use existing LLM infrastructure (check `server/src/routes/llms.ts`)

- [x] Task 3: API endpoints (AC: #3, #4)
  - [x] 3.1 Add `POST /projects/:id/drift/check` to routes
  - [x] 3.2 Add `GET /projects/:id/drift/results` — in-memory cache per project
  - [x] 3.3 Validate request with Zod

- [x] Task 4: API client (AC: #3, #4)
  - [x] 4.1 Create `ui/src/api/drift.ts`: `driftApi.check()`, `driftApi.getResults()`

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
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

Tous les ACs couverts. Implementation au-dela des specs :

**Deviations de nommage :**
- Service split en 2 fichiers : `drift-analyzer.ts` (LLM call) + `drift.ts` (cache, scans)
- Severity utilise `critical/moderate/minor` au lieu de `critical/warning/info`

**Fonctionnalites supplementaires non prevues :**
- `POST /projects/:id/drift/scan` — scan background complet du projet
- `GET /projects/:id/drift/status` — polling de progression du scan
- `DELETE /projects/:id/drift/scan` — annulation du scan
- `PATCH /projects/:id/drift/:driftId` — resolution de drift (accept/reject)
- Fallback Claude CLI si pas d'API key
- Retry avec exponential backoff
- Validation Zod du response LLM
- Cache in-memory (50 reports par projet)

**Gap : Task 5 (tests) non implementee**

### File List
- `packages/shared/src/types/drift.ts` (DriftSeverity, DriftType, DriftItem, DriftReport, DriftCheckRequest, DriftResolveRequest, DriftScanRequest, DriftScanStatus)
- `server/src/services/drift-analyzer.ts` (appel LLM + parsing)
- `server/src/services/drift.ts` (cache, scans background, resolution)
- `server/src/routes/drift.ts` (5 endpoints)
- `ui/src/api/drift.ts` (client complet avec check, scan, results, status, resolve, cancel)
- `ui/src/hooks/useDriftResults.ts` (hooks TanStack Query)

### Change Log
- 2026-03-12: Reconciliation — tous ACs couverts + extras documentes. Tests manquants.
