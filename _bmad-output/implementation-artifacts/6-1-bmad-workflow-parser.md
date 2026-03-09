# Story 6.1: BMAD Workflow Parser

Status: ready-for-dev

## Story

As a **user**,
I want **MnM to parse BMAD workflow definitions (YAML/Markdown) into a visual structure**,
So that **I can see my development workflow as a diagram**.

## Context

Depends on: Story 1.1 (BMAD analyzer). BMAD workflows live in `_bmad/bmm/workflows/` as YAML files with step definitions in markdown. This story parses them into a data structure the UI can render as a diagram.

## Acceptance Criteria

### AC1 — Workflow YAML parsed

**Given** a BMAD workflow YAML exists (e.g., `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`)
**When** the parser reads it
**Then** it returns a structured representation: nodes (steps), edges (transitions), metadata

### AC2 — Step markdown parsed

**Given** a workflow step references a markdown file
**When** the parser reads it
**Then** it extracts: step name, instructions summary, inputs/outputs

### AC3 — REST API endpoint

**Given** a project has BMAD workflows
**When** `GET /api/projects/:id/bmad/workflows` is called
**Then** it returns a list of available workflows with their parsed structures

## Tasks / Subtasks

- [ ] Task 1: Workflow parser service (AC: #1, #2)
  - [ ] 1.1 Create `server/src/services/bmad-workflow-parser.ts`
  - [ ] 1.2 Implement `parseWorkflowYaml(yamlPath)` — read YAML, extract steps, transitions, config
  - [ ] 1.3 Implement `parseWorkflowStep(mdPath)` — read step markdown, extract name, instructions summary (first paragraph)
  - [ ] 1.4 Implement `scanWorkflows(bmadPath)` — recursively find all `workflow.yaml` files in `_bmad/`
  - [ ] 1.5 Return structured data: `BmadWorkflow { name, steps: BmadWorkflowStep[], edges: BmadWorkflowEdge[] }`

- [ ] Task 2: Shared types and API (AC: #3)
  - [ ] 2.1 Add `BmadWorkflow`, `BmadWorkflowStep`, `BmadWorkflowEdge` to shared types
  - [ ] 2.2 Add `GET /api/projects/:id/bmad/workflows` endpoint
  - [ ] 2.3 Add `bmadApi.getWorkflows(projectId, companyId)` to API client

- [ ] Task 3: Tests
  - [ ] 3.1 Test: workflow YAML parsing extracts steps and transitions
  - [ ] 3.2 Test: step markdown parsing extracts summary
  - [ ] 3.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### BMAD Workflow YAML Format Example
```yaml
# _bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml
name: "Dev Story"
steps:
  - step-01-preflight
  - step-02-implement
  - step-03-test
  - step-04-review
```

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT confuse with MnM's own `workflow_templates` table — these are BMAD workflow definitions (files)

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
