# Story 1.8: Git Diff Viewer (Side-by-Side)

Status: ready-for-dev

## Story

As a user,
I want to view git diffs side-by-side with syntax highlighting,
so that I can review changes for drift detection or spec updates.

## Acceptance Criteria

1. A diff view displays changes in side-by-side format: original (left) and modified (right)
2. Changes are highlighted: green for added lines, red for removed lines, yellow/amber for modified lines
3. Syntax highlighting is preserved in both panes
4. The diff is scrollable in sync (scrolling one pane scrolls the other)
5. Diffs up to 2000 LOC render in < 500ms
6. The diff viewer can be used from multiple contexts: drift alerts, spec change notifications, file browser

## Tasks / Subtasks

- [ ] Task 1: Create git diff API route (AC: #1)
  - [ ] Create `src/app/api/git/diff/route.ts`
  - [ ] GET handler with query params: `?file=<path>&base=<sha>&head=<sha>`
  - [ ] Use simple-git to generate diff between two commits or between working tree and a commit
  - [ ] Return structured diff data: `{ filePath, hunks: [{ oldStart, newStart, lines }] }`
  - [ ] Parse unified diff format into structured hunks
- [ ] Task 2: Create diff parser utility (AC: #1)
  - [ ] Create `src/lib/git/diff-parser.ts`
  - [ ] Parse unified diff output from simple-git into structured format
  - [ ] Each line tagged as: `added`, `removed`, `unchanged`, `modified`
  - [ ] Group lines into hunks with context lines
- [ ] Task 3: Build side-by-side diff component (AC: #1, #2, #3)
  - [ ] Create `src/components/shared/diff-viewer.tsx` (client component)
  - [ ] Two-column layout: old version (left), new version (right)
  - [ ] Line-by-line rendering with color coding:
    - Added lines: `bg-green-950/50` (dark) or `bg-green-100` (light) background
    - Removed lines: `bg-red-950/50` (dark) or `bg-red-100` (light) background
    - Modified lines: `bg-amber-950/50` (dark) or `bg-amber-100` (light) background
    - Unchanged lines: no highlight
  - [ ] Display line numbers in both columns (old line number, new line number)
  - [ ] Apply syntax highlighting to diff content (use same highlighter as code viewer)
- [ ] Task 4: Implement synchronized scrolling (AC: #4)
  - [ ] Both panes share a single scroll container, or
  - [ ] Use `onScroll` event handler to synchronize scroll positions between two `ScrollArea` components
  - [ ] Ensure horizontal scroll is also synchronized
- [ ] Task 5: Build unified diff fallback (AC: #1)
  - [ ] Create `src/components/shared/diff-viewer-unified.tsx` as an alternative view
  - [ ] Single-column view with inline additions/removals (simpler, mobile-friendly)
  - [ ] Toggle button to switch between side-by-side and unified views
- [ ] Task 6: Performance optimization (AC: #5)
  - [ ] For diffs > 2000 lines, render in chunks (virtual scrolling or pagination)
  - [ ] Show hunk headers as collapsible sections for large diffs
  - [ ] Display total additions/deletions count in header

## Dev Notes

### Diff Rendering Approach

Two viable approaches:

1. **Custom component (recommended for POC)**: Build a diff viewer using `<table>` or `<div>` grid with Tailwind styling. Full control over appearance. Sync scrolling via shared scroll container.

2. **Third-party library**: Use `react-diff-viewer-continued` (`npm install react-diff-viewer-continued`). Provides side-by-side and inline views out of the box, with syntax highlighting. Less customizable but faster to implement.

For the POC, using the third-party library is acceptable to save time. Can be replaced with a custom component later.

### Shared Component

This diff viewer is a **shared component** used in multiple contexts:
- **Drift alerts** (Story 3.5): Show spec vs. code diff
- **Spec change notifications** (Story 4.6): Show old vs. new spec
- **File browser**: Show uncommitted changes

Design it with a clean interface:

```typescript
interface DiffViewerProps {
  oldContent: string
  newContent: string
  oldTitle?: string   // e.g., "Original (commit abc123)"
  newTitle?: string   // e.g., "Modified (working tree)"
  language?: string   // For syntax highlighting
  mode?: 'side-by-side' | 'unified'
}
```

### Synchronized Scrolling Pattern

```tsx
const leftRef = useRef<HTMLDivElement>(null)
const rightRef = useRef<HTMLDivElement>(null)
const syncing = useRef(false)

const handleScroll = (source: 'left' | 'right') => {
  if (syncing.current) return
  syncing.current = true
  const srcEl = source === 'left' ? leftRef.current : rightRef.current
  const tgtEl = source === 'left' ? rightRef.current : leftRef.current
  if (srcEl && tgtEl) {
    tgtEl.scrollTop = srcEl.scrollTop
    tgtEl.scrollLeft = srcEl.scrollLeft
  }
  syncing.current = false
}
```

### Project Structure Notes

- `src/components/shared/diff-viewer.tsx` -- reusable diff viewer (shared, not in specs/ or files/)
- `src/components/shared/diff-viewer-unified.tsx` -- unified mode alternative
- `src/lib/git/diff-parser.ts` -- diff parsing utility
- `src/app/api/git/diff/route.ts` -- git diff API route

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8: Git Diff Viewer (Side-by-Side)]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5 - API Routes Design]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7 - Agent Orchestration]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
