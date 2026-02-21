---
story_id: "6.1"
title: "Workflow Viewer UI"
epic: "Epic 6: LLM-Powered Discovery & Interaction"
status: ready-for-dev
priority: high
estimate: 1.5 days
created: 2026-02-20
tags: [frontend, workflow, FR7]
blocked_by: ["1-2"]
---

# Story 6.1: Workflow Viewer UI

## User Story

**As a** user,
**I want to** see discovered workflows as visual pipelines,
**So that** I understand the available development phases and steps.

## Background

The PRD (FR7.1, FR7.2, FR7.3) specifies a Workflow Viewer that displays discovered workflows as node-and-edge diagrams. Currently, BMAD workflows are discovered via `/api/discovery/agents` but there is no UI to visualize them.

The brainstorm-v2 document envisions the Workflow Editor as "le cœur de l'expérience MnM" — this story implements the read-only viewer as the foundation.

## Acceptance Criteria

### AC1: Workflow List View
**Given** MnM has discovered workflows from the repository
**When** I navigate to the Workflows page
**Then** I see a list of all discovered workflows with:
- Workflow name
- Description (from workflow metadata)
- Phase indicator (analysis, planning, solutioning, implementation)
- Agent association badge

### AC2: Workflow Detail View
**Given** I click on a workflow in the list
**When** the detail view opens
**Then** I see:
- Workflow steps as a visual pipeline (nodes connected by edges)
- Each step shows: name, description, required/optional indicator
- Step dependencies are visualized with connecting lines
- Current execution status on nodes (if running)

### AC3: Launch Workflow Action
**Given** I am viewing a workflow
**When** I click "Launch Workflow"
**Then** the Launch Agent dialog opens pre-populated with:
- Agent type set to the workflow command
- Workflow description as context
- File scope selector

### AC4: Workflow Metadata Display
**Given** I am viewing a workflow detail
**When** I look at the workflow panel
**Then** I see metadata:
- Workflow name and code
- Phase (1-analysis, 2-planning, 3-solutioning, 4-implementation)
- Required inputs (e.g., PRD, Architecture)
- Expected outputs (e.g., epics, stories)

### AC5: Empty State
**Given** no workflows are discovered
**When** I navigate to Workflows
**Then** I see a helpful message: "No workflows discovered. Run discovery to scan for BMAD workflows."

## Technical Notes

### Data Source
- Workflows are discovered by `src/lib/discovery/discovery-service.ts`
- Stored in `workflows` table via Drizzle ORM
- API endpoint: `GET /api/discovery/workflows` (may need to create)

### UI Components
- Use shadcn/ui `Card`, `Badge`, `Button`
- Consider `react-flow` or simple CSS grid for pipeline visualization
- Match existing design system (sidebar, header pattern)

### File Locations
- Page: `src/app/workflows/page.tsx`
- Components: `src/components/workflows/`
  - `workflow-list.tsx`
  - `workflow-card.tsx`
  - `workflow-pipeline.tsx`
  - `workflow-detail-panel.tsx`

## Out of Scope
- Workflow editing (post-MVP)
- Drag-and-drop workflow builder (post-MVP)
- Real-time execution visualization beyond status badges

## Definition of Done
- [ ] Workflow list page renders discovered workflows
- [ ] Workflow detail view shows steps as visual pipeline
- [ ] Launch Workflow action opens agent launch dialog
- [ ] Empty state displays when no workflows found
- [ ] Unit tests for workflow components
- [ ] Accessible (keyboard navigation, ARIA labels)

## Dependencies
- Story 1.2 (Spec File Detection) — for discovery infrastructure

## References
- PRD: FR7.1, FR7.2, FR7.3
- Architecture: Section 9 (UI Architecture)
- Brainstorm-v2: Section 2 (Workflow Editor)
