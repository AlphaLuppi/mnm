# Story 6.3: Edition de Noeuds Workflow

Status: ready-for-dev

## Story

As a **user**,
I want **to edit workflow step properties from the diagram view**,
So that **I can customize my development workflow**.

## Context

Depends on: Story 6.2. POST-MVP feature — editing BMAD workflow files from the UI.

## Acceptance Criteria

### AC1 — Edit step properties

**Given** I double-click a workflow step node
**When** the edit panel opens
**Then** I can modify: step name, instructions summary, role assignment

### AC2 — Save changes to file

**Given** I edit step properties
**When** I click Save
**Then** the changes are written to the workflow YAML/markdown files

### AC3 — Add new step

**Given** I'm viewing a workflow diagram
**When** I click "Add step" between two existing steps
**Then** a new step node is created and I can configure it

## Tasks / Subtasks

- [ ] Task 1: Step edit panel (AC: #1)
  - [ ] 1.1 Create `ui/src/components/WorkflowStepEditor.tsx` — form with step properties
  - [ ] 1.2 Open as slide-over panel when step is double-clicked

- [ ] Task 2: Save to file (AC: #2)
  - [ ] 2.1 Add `PUT /api/projects/:id/bmad/workflows/:workflowId/steps/:stepId` endpoint
  - [ ] 2.2 Update the YAML file with new step config

- [ ] Task 3: Add step (AC: #3)
  - [ ] 3.1 Add "+" button between nodes in the diagram
  - [ ] 3.2 On click → create new step and open editor

- [ ] Task 4: Tests
  - [ ] 4.1 Test: step edit saves to file correctly
  - [ ] 4.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### What NOT to do
- Do NOT create IPC/Electron code
- Keep editing simple — full workflow editor is out of MVP scope

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
