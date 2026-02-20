# Story 4.6: View Full Diff for Spec Changes

Status: ready-for-dev

## Story

As a user,
I want to view full diffs for changed specs,
so that I can understand details beyond the AI summary.

## Acceptance Criteria

1. From the spec change notification panel, clicking "View Full Diff" opens a diff viewer
2. The diff viewer shows side-by-side view with old version (left pane) and new version (right pane) with highlighted changes (green for additions, red for deletions)
3. Diff is scrollable and syntax-highlighted for Markdown content
4. Diff matches the git diff exactly (generated via `simple-git`)
5. User can navigate between multiple diffs if multiple files changed (previous/next buttons)

## Tasks / Subtasks

- [ ] Task 1: Create diff viewer component (AC: #1, #2, #3)
  - [ ] Create `src/components/specs/spec-diff-viewer.tsx` with side-by-side pane layout
  - [ ] Use a lightweight diff rendering approach: parse unified diff and render left/right panes
  - [ ] Apply syntax highlighting for Markdown using CSS classes (green bg for additions, red bg for deletions)
  - [ ] Wrap in shadcn/ui ScrollArea for scrollable content
  - [ ] Consider using `react-diff-viewer-continued` npm package for robust diff display
- [ ] Task 2: Create diff generation API route (AC: #4)
  - [ ] Create `src/app/api/git/diff/route.ts` (GET) with query params: `?filePath=...&fromSha=...&toSha=...`
  - [ ] Use `simple-git` to generate diff between two commit SHAs for a specific file
  - [ ] Return both unified diff format and split old/new content for side-by-side rendering
  - [ ] Handle edge cases: file added (no old content), file deleted (no new content), binary files
- [ ] Task 3: Build multi-file diff navigation (AC: #5)
  - [ ] Create `src/components/specs/diff-navigator.tsx` with Previous/Next buttons
  - [ ] Show "File 2 of 5" indicator
  - [ ] Allow clicking file name in a file list sidebar to jump directly to a specific diff
  - [ ] Use shadcn/ui Button for navigation and Badge for file count
- [ ] Task 4: Integrate with change summary panel (AC: #1)
  - [ ] Wire "View Full Diff" button in change-summary-panel.tsx to open diff viewer
  - [ ] Use shadcn/ui Dialog (full-screen modal) to display the diff viewer
  - [ ] Pass `filePath`, `oldCommitSha`, `newCommitSha` from the spec change record
- [ ] Task 5: Write tests (AC: #2, #4)
  - [ ] Unit tests for diff rendering with additions, deletions, and mixed changes
  - [ ] Unit tests for multi-file navigation state
  - [ ] Integration test for diff API route with mocked simple-git
  - [ ] Test edge cases: empty diff, large diff, binary file

## Dev Notes

- The diff viewer reuses patterns from Story 1.8 (Git Diff Viewer); if 1.8 is implemented first, extend that component rather than building from scratch
- For the POC, a simple CSS-based diff highlight is sufficient; consider `react-diff-viewer-continued` (npm) for a more polished experience
- Diff generation via `simple-git`: `git.diff(['fromSha..toSha', '--', filePath])` returns unified diff
- For side-by-side rendering, split the unified diff into old/new content arrays
- Performance: for large diffs (>1000 lines), consider virtualizing the scroll list or truncating with "Show more" button

### Project Structure Notes

- `src/components/specs/spec-diff-viewer.tsx` -- main diff viewer component
- `src/components/specs/diff-navigator.tsx` -- multi-file navigation controls
- `src/app/api/git/diff/route.ts` -- diff generation API route
- Reuses `src/lib/git/diff.ts` from architecture for diff generation logic

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5.1 - Route Overview: `/api/git/diff`]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 3.1 - Directory Layout: `src/lib/git/diff.ts`]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.2 - Component Library: Dialog, ScrollArea, Button]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
