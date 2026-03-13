# Story 3.9: Workflow Stage Tracking

Status: ready-for-dev

## Story

As a user,
I want to track which workflow stage each story is in,
so that I understand the full development lifecycle.

## Acceptance Criteria

1. Each spec has a workflow stage: `prd`, `stories`, `architecture`, `dev`, `test`, `deploy`
2. Workflow stage is updated automatically when agents complete work (e.g., agent completion sets stage to `dev`)
3. The progress UI (Story 3.8) shows the workflow stage per story
4. Workflow stage is filterable (e.g., "Show all stories in dev")
5. Manual stage transitions are supported via UI (for stages not yet automated: `test`, `deploy`)

## Tasks / Subtasks

- [ ] Task 1: Add workflow stage to schema (AC: #1)
  - [ ] Update `src/lib/db/schema.ts` to add `workflowStage` column to the `specs` table
  - [ ] Type: `text` with default value `'backlog'`
  - [ ] Valid values: `backlog`, `prd`, `stories`, `architecture`, `dev`, `test`, `deploy`
  - [ ] Run Drizzle migration: `npx drizzle-kit push` or generate migration
- [ ] Task 2: Add workflow stage type (AC: #1)
  - [ ] Update `src/lib/core/types.ts` with `WorkflowStage` type:
    ```typescript
    type WorkflowStage = 'backlog' | 'prd' | 'stories' | 'architecture' | 'dev' | 'test' | 'deploy'
    ```
  - [ ] Define stage display labels and ordering for UI
- [ ] Task 3: Implement automatic stage transitions (AC: #2)
  - [ ] Update spec indexer (Story 1.2) to set initial stage:
    - If spec_type is `prd` -> stage `prd`
    - If spec_type is `story` -> stage `stories`
    - If spec_type is `architecture` -> stage `architecture`
    - Otherwise -> `backlog`
  - [ ] Listen to agent event bus for `completed` events:
    - When an agent working on a story completes -> set spec's stage to `dev`
  - [ ] Future: hook into test runner output to set `test` stage
- [ ] Task 4: Update specs API (AC: #4)
  - [ ] Update `GET /api/specs` to include `workflowStage` in response
  - [ ] Add filter support: `GET /api/specs?stage=dev`
  - [ ] Add `PATCH /api/specs/[id]` for manual stage updates
- [ ] Task 5: Update progress UI (AC: #3, #4, #5)
  - [ ] Update the progress list component (Story 3.8) to display workflow stage as a badge
  - [ ] Use color-coded badges:
    - `backlog`: gray
    - `prd`: blue
    - `stories`: indigo
    - `architecture`: purple
    - `dev`: amber
    - `test`: green
    - `deploy`: emerald
  - [ ] Add a filter dropdown or tabs to filter by stage
  - [ ] Add a context menu or button to manually change stage (for `test` and `deploy`)
- [ ] Task 6: Workflow stage visualization (AC: #3)
  - [ ] Create `src/components/progress/workflow-stage-badge.tsx`
  - [ ] Display as a horizontal pipeline: `PRD -> Stories -> Arch -> Dev -> Test -> Deploy`
  - [ ] Highlight the current stage, dim completed stages, gray out future stages

## Dev Notes

### Workflow Stages

```
backlog -> prd -> stories -> architecture -> dev -> test -> deploy
```

Each spec can only be in one stage at a time. Stages generally progress forward but can be moved backward (e.g., from `dev` back to `stories` if requirements change).

### Stage Display

| Stage | Label | Color | Icon |
|-------|-------|-------|------|
| `backlog` | Backlog | gray | Circle |
| `prd` | PRD | blue | FileText |
| `stories` | Stories | indigo | BookOpen |
| `architecture` | Architecture | purple | Blocks |
| `dev` | Development | amber | Code |
| `test` | Testing | green | TestTube |
| `deploy` | Deployed | emerald | Rocket |

### Pipeline Badge Component

A horizontal row of circles connected by lines, showing progression:

```
(PRD) ----> (Stories) ----> (Arch) ----> [Dev] ----> (Test) ----> (Deploy)
 done        done           done       current       future       future
```

Use filled circles for completed stages, an accented circle for current stage, and empty circles for future stages.

### Schema Migration

```typescript
// Add to specs table in schema.ts
workflowStage: text('workflow_stage').default('backlog'),
```

This is a non-breaking change (new column with default value).

### Project Structure Notes

- `src/lib/db/schema.ts` -- add workflowStage column
- `src/lib/core/types.ts` -- add WorkflowStage type
- `src/components/progress/workflow-stage-badge.tsx` -- pipeline visualization
- Updates to `src/app/progress/page.tsx` and related components

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.9: Workflow Stage Tracking]
- [Source: _bmad-output/planning-artifacts/prd.md#FR3.1 - Track Workflow and Story Completion]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
