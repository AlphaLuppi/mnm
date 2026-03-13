# Story 4.5: Spec Change Notification UI

Status: ready-for-dev

## Story

As a user,
I want to see notifications when important specs change,
so that I stay aware of updates without constantly checking git.

## Acceptance Criteria

1. When spec changes are detected, a notification badge appears in the header: "3 important files changed since last session"
2. Clicking the notification opens a change summary panel showing: list of changed files, AI-generated change summary per file, links to view full diff, and option to mark as "Viewed"
3. Changes are grouped by: since last MnM session, since last commit, since last branch switch
4. Viewed changes are hidden from the notification list but accessible in history
5. Notification badge is dismissible and auto-updates via SWR polling (10s interval)

## Tasks / Subtasks

- [ ] Task 1: Create notification badge component (AC: #1, #5)
  - [ ] Create `src/components/layout/spec-change-badge.tsx` using shadcn/ui Badge and Button
  - [ ] Show unviewed change count fetched via SWR from `/api/git/changes?viewed=false`
  - [ ] Use SWR with 10-second polling interval per architecture spec
  - [ ] Hide badge when count is 0
- [ ] Task 2: Build change summary panel (AC: #2, #3)
  - [ ] Create `src/components/specs/change-summary-panel.tsx` using shadcn/ui Sheet (side panel)
  - [ ] List changed files with file path, spec type badge, AI summary text
  - [ ] Group changes with collapsible sections: "Since last session", "Since last commit", "Since last branch switch"
  - [ ] Add "View Full Diff" link per change (navigates to diff viewer from Story 4.6)
  - [ ] Add "Mark as Viewed" button per change and "Mark All Viewed" bulk action
- [ ] Task 3: Create spec changes API endpoints (AC: #2, #3, #4)
  - [ ] Extend `GET /api/git/changes` with query params: `?viewed=false`, `?groupBy=session|commit|branch`
  - [ ] Add `PATCH /api/git/changes/[id]` endpoint to mark change as viewed (`user_viewed = 1`)
  - [ ] Add `PATCH /api/git/changes/bulk-view` endpoint for "Mark All Viewed"
- [ ] Task 4: Integrate badge into app layout (AC: #1)
  - [ ] Add `SpecChangeBadge` to root layout header, next to git status bar
  - [ ] Wire click handler to open/close the Sheet panel
- [ ] Task 5: Write tests (AC: #1, #2, #4)
  - [ ] Unit tests for badge rendering with 0, 1, and many changes
  - [ ] Unit tests for change grouping logic
  - [ ] Integration test for mark-as-viewed API endpoint
  - [ ] Test SWR polling updates badge count after viewing

## Dev Notes

- The notification badge lives in the header bar alongside the git status component (Story 4.1)
- Use shadcn/ui Sheet component for the side panel (slides in from right) to avoid navigating away from current view
- Change grouping requires tracking session timestamps; store last session start time in the config or a dedicated table
- SWR polling at 10s for spec changes per architecture-web.md Section 6.3
- The "View Full Diff" link depends on Story 4.6; if not yet implemented, show the link as disabled

### Project Structure Notes

- `src/components/layout/spec-change-badge.tsx` -- notification badge in header
- `src/components/specs/change-summary-panel.tsx` -- Sheet panel with change list
- `src/app/api/git/changes/route.ts` -- extended with query params and grouping
- `src/app/api/git/changes/[id]/route.ts` -- PATCH for mark-as-viewed

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 6.3 - Real-Time Strategy: Spec changes SWR polling 10s]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.2 - Component Library: Badge, Sheet, Button]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.1 - Page Layout: Header area]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
