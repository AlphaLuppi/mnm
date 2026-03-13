# Story 3.5: Drift Alert UI (Summary + Diff View)

Status: ready-for-dev

## Story

As a user,
I want to see drift alerts with clear summaries and diffs,
so that I can understand what drifted and why.

## Acceptance Criteria

1. When drift is detected, a notification appears in the UI header area (badge count on "Drift" nav item)
2. The Drift page (`/drift`) shows a list of all drift detections sorted by creation date (newest first)
3. Each drift card displays: severity badge (Minor/Moderate/Critical), drift type, spec name, AI-generated summary, recommendation
4. Clicking a drift card opens a detail view with side-by-side diff (reusing the diff viewer from Story 1.8)
5. The detail view shows "Accept Drift" and "Reject Drift" action buttons
6. Drift alerts are color-coded by severity: green (minor), amber (moderate), red (critical)
7. Pending drifts are visually distinct from resolved ones
8. **[COLD-START] Drift panel shows "Scan for Drift" button prominently when no results exist**
9. **[COLD-START] Empty state shows "No drift detected" with helpful text, NOT a blank page**
10. **[COLD-START] "Last scanned: X minutes ago" timestamp displays below the filter tabs**
11. **[COLD-START] Drift panel works even when no agents have run (integrates with Story 6.5)**

## Tasks / Subtasks

- [ ] Task 1: Create drift list page (AC: #2, #3, #7)
  - [ ] Create `src/app/drift/page.tsx`
  - [ ] Fetch drift detections from `GET /api/drift`
  - [ ] Display as a list of cards using shadcn/ui `Card`
  - [ ] Each card shows:
    - Severity badge (shadcn `Badge` with variant: `default` for minor, `secondary` for moderate, `destructive` for critical)
    - Drift type label
    - Spec title (clickable link to spec)
    - AI summary (1-2 sentences)
    - Recommendation tag ("Update Spec" or "Recenter Code")
    - Timestamp ("2 hours ago" using relative time)
    - Status indicator: pending (outlined) vs. resolved (muted)
  - [ ] Add filter tabs: All / Pending / Resolved
- [ ] Task 2: Create drift detail view (AC: #4, #5)
  - [ ] Create `src/app/drift/[id]/page.tsx`
  - [ ] Fetch drift detail from `GET /api/drift/[id]`
  - [ ] Display full details:
    - Severity, drift type, and recommendation in a header section
    - Full AI summary
    - Link to associated spec and agent
    - Side-by-side diff viewer (reuse `DiffViewer` component from Story 1.8)
  - [ ] Action buttons at bottom: "Accept Drift" and "Reject Drift" (wired in Stories 3.6, 3.7)
- [ ] Task 3: Notification badge (AC: #1)
  - [ ] Update the sidebar nav item for "Drift" to show a count badge
  - [ ] Badge shows number of pending (unresolved) drifts
  - [ ] Fetch count from `GET /api/drift?status=pending` (or a lightweight count endpoint)
  - [ ] Use SWR with polling (5s) to keep badge current
  - [ ] Badge uses `destructive` variant if any critical drifts are pending
- [ ] Task 4: Severity color coding (AC: #6)
  - [ ] Define severity color mapping:
    - `minor`: green (text-green-600, bg-green-100 / dark: text-green-400, bg-green-950)
    - `moderate`: amber (text-amber-600, bg-amber-100 / dark: text-amber-400, bg-amber-950)
    - `critical`: red (text-red-600, bg-red-100 / dark: text-red-400, bg-red-950)
  - [ ] Create `src/components/shared/severity-badge.tsx` reusable component
  - [ ] Apply colors consistently to badges, card borders, and detail headers
- [ ] Task 5: Empty and loading states (AC: #8, #9, #10, #11) **[ENHANCED]**
  - [ ] Show "No drift detected" with helpful message when the list is empty
  - [ ] Add prominent "Scan for Drift" button in empty state (opens scan dialog)
  - [ ] Show skeleton cards while loading (shadcn `Skeleton`)
  - [ ] Show error state if API fails
  - [ ] Display "Last scanned: X minutes ago" below filter tabs
  - [ ] Fetch last scan time from `GET /api/drift/status` endpoint
- [ ] Task 6: Scan for Drift button (AC: #8) **[NEW]**
  - [ ] Add "Scan for Drift" button in page header (always visible)
  - [ ] Button opens a dialog from Story 6.5 (or inline spec selector)
  - [ ] After scan completes, refresh drift list automatically

## Dev Notes

### Key Components

- **shadcn/ui Card**: For drift detection list items
- **shadcn/ui Badge**: For severity and status indicators
- **shadcn/ui Tabs**: For All/Pending/Resolved filter
- **DiffViewer** (from Story 1.8): Reuse for spec vs. code diff display
- **SWR**: For data fetching with polling

### Drift Card Layout

```
+-------------------------------------------------------+
| [CRITICAL] scope_expansion         2 hours ago        |
|                                                        |
| Story 1.2: Spec File Detection                        |
|                                                        |
| Implementation uses WebSocket instead of SSE as        |
| specified in architecture.                             |
|                                                        |
| Recommendation: Recenter Code                 PENDING  |
+-------------------------------------------------------+
```

### Drift Detail Layout

```
+-------------------------------------------------------+
| < Back to Drift List                                   |
|                                                        |
| [CRITICAL] Design Deviation                            |
| Spec: Story 1.2 | Agent: TDD Agent                    |
|                                                        |
| Summary:                                               |
| Implementation uses WebSocket instead of SSE...        |
|                                                        |
| Recommendation: Recenter Code                          |
|                                                        |
| +---------------------------------------------------+ |
| |  Diff Viewer (side-by-side)                        | |
| |  [old version]  |  [new version]                   | |
| +---------------------------------------------------+ |
|                                                        |
| [Accept Drift]  [Reject Drift]                         |
+-------------------------------------------------------+
```

### Project Structure Notes

- `src/app/drift/page.tsx` -- drift list page
- `src/app/drift/[id]/page.tsx` -- drift detail page
- `src/components/drift/drift-card.tsx` -- individual drift card
- `src/components/shared/severity-badge.tsx` -- reusable severity badge

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5: Drift Alert UI]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9 - UI Architecture]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
