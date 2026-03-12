# Story 3.3: Drift Resolution Actions

Status: review

## Story

As a **user**,
I want **to resolve drift alerts by fixing, delegating to an agent, or ignoring**,
So that **I can maintain consistency across my specs**.

## Context

Depends on: 3.2.

## Acceptance Criteria

### AC1 — Resolution buttons

**Given** a drift alert is displayed
**When** I view the card
**Then** I see: "Corriger source", "Corriger cible", "Ignorer"

### AC2 — Fix navigates to document

**Given** I click "Corriger source" or "Corriger cible"
**When** navigation occurs
**Then** the document opens in WorkPane with option to launch a correct-course agent

### AC3 — Ignore dismisses alert

**Given** I click "Ignorer"
**When** the action triggers
**Then** alert is hidden (stored in localStorage by drift hash)

## Tasks / Subtasks

- [x] Task 1: Resolution buttons (AC: #1, #2, #3)
  - [x] 1.1 Add buttons to DriftAlertCard
  - [x] 1.2 "Corriger" → navigate to doc + offer LaunchAgentDialog with "correct-course" preset
  - [x] 1.3 "Ignorer" → store in localStorage, filter from display

- [ ] Task 2: Tests
  - [ ] 2.1 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

Tous les ACs fonctionnellement couverts avec deviations :

**Deviations :**
- Vocabulaire : "accept/reject/acknowledge" au lieu de "Corriger source/Corriger cible/Ignorer"
- Stockage : resolution cote serveur via `PATCH /projects/:id/drift/:driftId` au lieu de localStorage
- Types de decision : `accepted | rejected | pending` (enum DriftDecision) — plus robuste que localStorage
- La resolution est persistee dans le cache serveur (50 reports par projet)

L'approche server-side est un meilleur choix architectural (pas de perte de donnees si localStorage efface).

**Gap : Task 2 (tests) non implementee**

### File List
- `ui/src/components/DriftAlertCard.tsx` (boutons resolution)
- `ui/src/hooks/useDriftResults.ts` (useDriftResolve mutation)
- `ui/src/api/drift.ts` (resolve() API call)
- `server/src/routes/drift.ts` (PATCH endpoint)
- `server/src/services/drift.ts` (resolution logic)

### Change Log
- 2026-03-12: Reconciliation — ACs couverts avec approche server-side (vs localStorage). Tests manquants.
