---
story_id: "6.2"
title: "Cross-Document Drift UI"
epic: "Epic 6: LLM-Powered Discovery & Interaction"
status: ready-for-dev
priority: high
estimate: 2 days
created: 2026-02-20
tags: [frontend, drift, FR8]
blocked_by: []
---

# Story 6.2: Cross-Document Drift UI

## User Story

**As a** user,
**I want to** see cross-document drift alerts with side-by-side comparison,
**So that** I can identify and resolve spec inconsistencies before they cascade into code.

## Background

The PRD (FR8.1-FR8.4) specifies Cross-Document Drift Detection. The backend implementation exists in `src/lib/drift/cross-doc-detector.ts` but there is no UI to display results.

The brainstorm-v2 describes the use case: "Le Product Brief spécifie 'SSE' mais une story mentionne 'websocket' — personne ne l'a alerté."

## Acceptance Criteria

### AC1: Cross-Doc Drift Panel
**Given** cross-document drift has been detected
**When** I view the Drift page
**Then** I see a "Cross-Document Drift" section with:
- List of detected inconsistencies
- Each item shows: severity badge (minor/moderate/critical), drift type, summary

### AC2: Alert Detail Display
**Given** I click on a cross-doc drift alert
**When** the detail view opens
**Then** I see:
- Summary: "Story S-007 mentions 'websocket' but Architecture specifies 'SSE'"
- Upstream document excerpt (source of truth)
- Downstream document excerpt (divergent document)
- Highlighted inconsistency text

### AC3: Side-by-Side Comparison
**Given** I am viewing a cross-doc drift detail
**When** I click "Compare Documents"
**Then** I see:
- Left pane: upstream document (e.g., Architecture)
- Right pane: downstream document (e.g., Story)
- Inconsistent sections highlighted in yellow

### AC4: Resolution Actions
**Given** I am viewing a cross-doc drift alert
**When** I see the resolution options
**Then** I can:
- Click "Update Downstream" → Opens downstream doc for editing
- Click "Update Source" → Opens upstream doc for editing
- Click "Ignore" → Marks drift as ignored with reason input
- Resolution is logged with timestamp and decision

### AC5: Drift Severity Indicators
**Given** cross-doc drift is displayed
**When** I view the list
**Then** severity is clearly indicated:
- 🔴 Critical: Contradictory decisions (e.g., REST vs GraphQL)
- 🟠 Moderate: Approach differences (e.g., SSE vs websocket)
- 🟡 Minor: Terminology inconsistency (e.g., "auth" vs "authentication")

### AC6: Document Hierarchy Context
**Given** I am viewing a cross-doc drift
**When** I look at the context panel
**Then** I see the document hierarchy:
- Product Brief → PRD → Architecture → Epic → Story
- Arrows showing where drift propagated

## Technical Notes

### Data Source
- Backend: `src/lib/drift/cross-doc-detector.ts`
- Database: `cross_doc_drifts` table
- API: `GET /api/drift/cross-doc` (list), `PATCH /api/drift/cross-doc/[id]` (resolve)

### UI Components
- Use shadcn/ui `Card`, `Badge`, `Dialog`, `Tabs`
- Side-by-side diff viewer from Story 1.8 pattern
- Severity badges with color coding

### File Locations
- Page: `src/app/drift/page.tsx` (add Cross-Doc section)
- Components: `src/components/drift/`
  - `cross-doc-drift-list.tsx`
  - `cross-doc-drift-card.tsx`
  - `cross-doc-comparison-view.tsx`
  - `document-hierarchy-tree.tsx`

## Out of Scope
- Automatic resolution (always requires user decision)
- Batch resolution of multiple drifts
- AI-suggested resolutions (post-MVP)

## Definition of Done
- [ ] Cross-doc drift list renders detected inconsistencies
- [ ] Alert detail shows upstream/downstream excerpts
- [ ] Side-by-side comparison view works
- [ ] Resolution actions update database
- [ ] Severity badges display correctly
- [ ] Unit tests for cross-doc drift components
- [ ] Accessible (keyboard navigation, ARIA labels)

## Dependencies
- Cross-doc detector backend (already exists)

## References
- PRD: FR8.1, FR8.2, FR8.3, FR8.4
- Brainstorm-v2: Section 1 (Cross-Document Drift)
