# Story 1.5: Tests Pane — ACs Mirror

Status: review

## Story

As a **user**,
I want **the Tests pane to show acceptance criteria organized by spec hierarchy**,
So that **I can see what needs to be validated at every level**.

## Context

Depends on: 1.1 (BMAD data), 1.2 (three-pane layout).

## Acceptance Criteria

### AC1 — Full AC hierarchy

**Given** BMAD project loaded
**When** no selection → Tests pane shows all ACs grouped by Epic → Story

### AC2 — AC cards with status

**Given** ACs displayed
**When** I view a card
**Then** shows: AC id, title, Given/When/Then, status (pending by default)

### AC3 — Summary counts

**Given** a story in the hierarchy
**When** I view its header
**Then** shows "N ACs: X pending, Y pass, Z fail"

## Tasks / Subtasks

- [x] Task 1: TestCard component (AC: #2)
  - [x] 1.1 Create `ui/src/components/TestCard.tsx` — AC id, title, Given/When/Then, status badge
  - [x] 1.2 Status: pending (gray circle), pass (green check), fail (red X)

- [x] Task 2: TestsPane with hierarchy (AC: #1, #3)
  - [x] 2.1 Update `ui/src/components/TestsPane.tsx` to use BMAD data
  - [x] 2.2 Render collapsible hierarchy: Epic → Story → AC cards
  - [x] 2.3 Summary counts per story and per epic

- [ ] Task 3: Tests
  - [ ] 3.1 Verify app compiles: `cd ui && pnpm build`

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

AC1, AC2, AC3 tous couverts.

- TestCard est inline dans TestsPane.tsx (pas un composant separe)
- `SummaryCounts` composant avec structure dynamique basee sur `ACStatusMap`
- Les counts sont calcules via `computeCounts()` a partir d'un Map<acId, status>
- Actuellement tous les ACs sont "pending" car pas de moteur d'execution de tests (Epic 6)
- Quand Epic 6 sera implemente, il suffira de peupler le `acStatusMap` pour que les counts soient dynamiques

**Gap restant : Task 3 (tests)**

### File List
- `ui/src/components/TestsPane.tsx` (260 lignes — TestCard inline + SummaryCounts)

### Change Log
- 2026-03-12: Reconciliation — AC3 (summary counts dynamiques) identifie comme gap partiel. Tests manquants.
- 2026-03-12: AC3 implemente — infrastructure ACStatusMap + computeCounts dynamique.
