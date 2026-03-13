# Story 3.8: Progress Tracking UI (Roadmap-Style)

Status: ready-for-dev

## Story

As a user,
I want to see project progress with drift annotations,
so that I understand where the project stands versus where it should be.

## Acceptance Criteria

1. A Progress page (`/progress`) displays a roadmap-style view of epics and stories
2. Each story shows a completion status: Not Started, In Progress, Completed, Drifted
3. Completion percentage is displayed per story (0%, 25%, 50%, 75%, 100%)
4. Drift indicators are shown inline (warning icon if critical drift detected on a story)
5. Clicking a story shows: associated agents, drift detections, and linked commits
6. Progress updates in near-real-time as agents complete work (SWR polling)
7. The view handles up to 500 stories without performance issues

## Tasks / Subtasks

- [ ] Task 1: Create progress page (AC: #1, #6)
  - [ ] Create `src/app/progress/page.tsx`
  - [ ] Fetch specs (grouped by type/epic) from `GET /api/specs`
  - [ ] Fetch drift detections from `GET /api/drift`
  - [ ] Fetch agents from `GET /api/agents`
  - [ ] Use SWR with polling (10s) for near-real-time updates
- [ ] Task 2: Build progress list component (AC: #1, #2, #3, #7)
  - [ ] Create `src/components/progress/progress-list.tsx`
  - [ ] Group stories by epic or spec type
  - [ ] Each story row displays:
    - Story title
    - Status badge (Not Started / In Progress / Completed / Drifted)
    - Progress bar or percentage indicator
    - Drift warning icon (if critical drift pending)
  - [ ] Use shadcn/ui `Progress` component for progress bars
  - [ ] Use shadcn/ui `Badge` for status
  - [ ] Collapsible epic sections with aggregate progress
- [ ] Task 3: Compute progress (AC: #3)
  - [ ] Create `src/lib/core/progress.ts` with progress calculation logic
  - [ ] Progress heuristics for POC:
    - 0%: No agents have worked on this spec
    - 25%: Agent launched but not completed
    - 50%: Agent completed, drift detection pending
    - 75%: Agent completed, drift detected and pending resolution
    - 100%: Agent completed, no drift or drift resolved
  - [ ] Mark as "Drifted" if any critical drift is pending
- [ ] Task 4: Build story detail panel (AC: #5)
  - [ ] Create `src/components/progress/story-detail-panel.tsx`
  - [ ] Clicking a story expands or opens a side panel showing:
    - List of agents that worked on this spec (with status)
    - List of drift detections (with severity and resolution status)
    - List of commits associated with the spec (if available from Story 4.8)
  - [ ] Use shadcn/ui `Sheet` for side panel or `Collapsible` for inline expand
- [ ] Task 5: Drift annotation overlay (AC: #4)
  - [ ] Create `src/components/shared/drift-indicator.tsx`
  - [ ] Small warning icon (Lucide `AlertTriangle`) with tooltip showing drift summary
  - [ ] Color-coded by severity (green/amber/red)
  - [ ] Clicking navigates to the drift detail page

## Dev Notes

### Key Components

- **shadcn/ui Progress**: For progress bar per story
- **shadcn/ui Badge**: For status indicators
- **shadcn/ui Sheet**: For story detail side panel
- **shadcn/ui Tooltip**: For drift indicator hover information
- **Lucide icons**: `AlertTriangle` (drift warning), `CheckCircle` (completed), `Circle` (not started), `Loader` (in progress)

### Progress Page Layout

```
+-------------------------------------------------------+
| Progress                                               |
|                                                        |
| Epic 0: Infrastructure (85%)                           |
| ======================================== [||||||||  ]  |
|   Story 0.1: Project Init         [DONE]  100%        |
|   Story 0.2: Database Setup       [DONE]  100%        |
|   Story 0.3: Domain Models     [IN PROG]   50%        |
|   Story 0.4: Repository        [DRIFTED]   75% [!]    |
|                                                        |
| Epic 1: Spec Visibility (20%)                          |
| ======================================== [||        ]  |
|   Story 1.1: App Layout       [IN PROG]   25%        |
|   Story 1.2: Spec Indexing    [NOT STARTED] 0%        |
|   ...                                                  |
+-------------------------------------------------------+
```

### Progress Calculation

For the POC, progress is computed client-side by joining spec, agent, and drift data. No additional database columns needed.

```typescript
function computeProgress(spec: Spec, agents: Agent[], drifts: DriftDetection[]): number {
  const specAgents = agents.filter(a => a.specId === spec.id)
  const specDrifts = drifts.filter(d => d.specId === spec.id)

  if (specAgents.length === 0) return 0
  if (specAgents.some(a => a.status === 'running')) return 25
  if (specAgents.some(a => a.status === 'completed')) {
    if (specDrifts.some(d => d.userDecision === 'pending')) return 75
    return 100
  }
  return 50
}
```

### Project Structure Notes

- `src/app/progress/page.tsx` -- progress page
- `src/components/progress/progress-list.tsx` -- main list component
- `src/components/progress/story-detail-panel.tsx` -- expandable detail
- `src/components/shared/drift-indicator.tsx` -- reusable drift warning icon
- `src/lib/core/progress.ts` -- progress calculation logic

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.8: Progress Tracking UI]
- [Source: _bmad-output/planning-artifacts/prd.md#FR3.5 - Progress Reporting]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
