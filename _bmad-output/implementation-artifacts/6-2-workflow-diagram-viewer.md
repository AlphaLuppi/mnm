# Story 6.2: Workflow Diagram Viewer

Status: ready-for-dev

## Story

As a **user**,
I want **to see my BMAD workflow as a visual diagram in the Work pane**,
So that **I understand the development process flow**.

## Context

Depends on: Story 6.1 (workflow parser).

## Acceptance Criteria

### AC1 — Workflow diagram renders

**Given** I select a workflow in the Context pane
**When** the diagram view loads
**Then** I see nodes (steps) connected by edges showing the flow

### AC2 — Step nodes are interactive

**Given** the diagram is displayed
**When** I click a step node
**Then** the step details appear in a panel (instructions, inputs/outputs)

### AC3 — Current step highlighted

**Given** an agent is executing a workflow
**When** I view the diagram
**Then** the current step is highlighted with a pulse animation

## Tasks / Subtasks

- [ ] Task 1: Create WorkflowDiagram component (AC: #1, #2)
  - [ ] 1.1 Create `ui/src/components/WorkflowDiagram.tsx`
  - [ ] 1.2 Use simple CSS/SVG layout: nodes as rounded rectangles, edges as lines with arrows
  - [ ] 1.3 Layout: vertical flow (top to bottom) with branching support
  - [ ] 1.4 On click node → show step details in side panel or popover

- [ ] Task 2: Current step highlighting (AC: #3)
  - [ ] 2.1 If an agent run is active and linked to this workflow, highlight the current step
  - [ ] 2.2 Use `animate-pulse` class or custom CSS animation

- [ ] Task 3: Wire into Work pane (AC: #1)
  - [ ] 3.1 Add "Workflows" to Context pane (list of available workflows from `bmadApi.getWorkflows`)
  - [ ] 3.2 Click workflow → show WorkflowDiagram in Work pane

- [ ] Task 4: Tests
  - [ ] 4.1 Test: WorkflowDiagram renders nodes and edges
  - [ ] 4.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Simple Diagram Approach
Do NOT use a heavy diagram library (reactflow, dagre, etc.) for MVP. Use simple flexbox/grid layout with SVG lines. The workflow is linear or simple branching, not a complex DAG.

### What NOT to do
- Do NOT install heavy diagram libraries
- Do NOT create IPC/Electron code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
