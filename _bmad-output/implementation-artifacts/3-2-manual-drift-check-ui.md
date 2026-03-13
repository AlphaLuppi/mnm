# Story 3.2: Manual Drift Check UI

Status: review

## Story

As a **user**,
I want **to trigger a drift check from the cockpit and see results**,
So that **I can verify my specs are consistent**.

## Context

Depends on: 3.1 (engine), Epic 1 (cockpit).

## Acceptance Criteria

### AC1 — Drift check button

**Given** I'm viewing a spec in WorkPane
**When** I click "Vérifier le drift"
**Then** drift check runs for that document against related documents

### AC2 — Results in Tests pane

**Given** drift check completes
**When** results arrive
**Then** Tests pane shows drift alert cards: severity icon, description, confidence, source↔target names

### AC3 — Diff view

**Given** I click a drift alert card
**When** the diff opens
**Then** I see side-by-side excerpts with the conflict highlighted

### AC4 — Drift badges in Context pane

**Given** drift alerts exist
**When** I view Context pane
**Then** affected documents show a drift count badge

## Tasks / Subtasks

- [x] Task 1: Drift check button (AC: #1)
  - [x] 1.1 Add "Vérifier le drift" button in SpecViewer and StoryViewer headers
  - [x] 1.2 On click: determine comparison pairs (PRD↔stories, archi↔stories, brief↔PRD)
  - [x] 1.3 Call `driftApi.check()` for each pair
  - [x] 1.4 Show loading state

- [x] Task 2: DriftAlertCard (AC: #2)
  - [x] 2.1 Create `ui/src/components/DriftAlertCard.tsx` — severity icon, description, confidence badge
  - [x] 2.2 Add "Drift Alerts" section in TestsPane above ACs
  - [x] 2.3 Create `ui/src/hooks/useDriftResults.ts` hook

- [x] Task 3: DriftDiffViewer (AC: #3)
  - [x] 3.1 Create `ui/src/components/DriftDiffViewer.tsx` — side-by-side text excerpts
  - [x] 3.2 Click alert card → show diff in WorkPane

- [x] Task 4: Drift badges (AC: #4)
  - [x] 4.1 Count drifts per document, show red pill badge in ContextPane

- [ ] Task 5: Tests
  - [ ] 5.1 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

AC1, AC2, AC3, AC4 tous couverts.

**Deviation architecturale :**
- Les resultats drift sont affiches dans une page dediee `Drift.tsx` (page-level) en plus du WorkPane
- Le scan se fait par projet entier via `POST /drift/scan` (pas doc par doc comme prevu)
- La page Drift a son propre selecteur de projet, progression, et resultats stockes

AC4 implemente le 2026-03-12 : `DriftBadge` composant (pill rouge) affiche sur les artifacts et nodes dans ContextPane. Compte uniquement les drifts `pending` (pas ceux deja resolus). Badge sur sourceDoc et targetDoc.

**Gap restant : Task 5 (tests)**

### File List
- `ui/src/components/WorkPane.tsx` (bouton drift integre)
- `ui/src/components/DriftAlertCard.tsx`
- `ui/src/components/DriftDiffViewer.tsx`
- `ui/src/hooks/useDriftResults.ts`
- `ui/src/pages/Drift.tsx` (page dediee — non prevue dans la story)

### Change Log
- 2026-03-12: Reconciliation — AC4 (drift badges) identifie comme gap. Page Drift.tsx supplementaire documentee.
- 2026-03-12: AC4 implemente — DriftBadge dans ContextPane (artifacts + nodes).
