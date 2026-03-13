# Story 3.1: Git Diff Generation

Status: ready-for-dev

## Story

As a developer,
I want to generate structured git diffs for files modified by agents,
so that drift detection can analyze the delta between spec intent and actual implementation.

## Acceptance Criteria

1. A `DiffGenerator` module generates git diffs between a base commit and the current working tree (or a target commit)
2. The diff includes: file path, added lines (with line numbers), removed lines (with line numbers), and context lines
3. The diff is returned as structured TypeScript data (`GitDiff` type), not raw text
4. Diff generation works for files up to 5000 LOC
5. Diff is generated in < 200ms for typical files (< 1000 LOC)
6. An API route `GET /api/git/diff` accepts file path and optional base/head SHA parameters

## Tasks / Subtasks

- [ ] Task 1: Define GitDiff types (AC: #2, #3)
  - [ ] Create or extend `src/lib/core/types.ts` with diff types:
    - `GitDiff`: `{ filePath, baseSha, headSha, hunks: DiffHunk[] }`
    - `DiffHunk`: `{ oldStart, oldLines, newStart, newLines, lines: DiffLine[] }`
    - `DiffLine`: `{ type: 'added' | 'removed' | 'context', content, oldLineNumber?, newLineNumber? }`
  - [ ] Export types for use by drift detection module
- [ ] Task 2: Implement DiffGenerator (AC: #1, #3, #4)
  - [ ] Create `src/lib/git/diff.ts`
  - [ ] Use `simple-git` to run `git diff` between base and head
  - [ ] Parse unified diff output into structured `GitDiff` objects
  - [ ] Support modes:
    - Working tree vs. commit: `git diff <sha> -- <file>`
    - Commit vs. commit: `git diff <sha1> <sha2> -- <file>`
    - Unstaged changes: `git diff -- <file>`
  - [ ] Handle edge cases: new files (all added), deleted files (all removed), binary files (skip)
- [ ] Task 3: Implement diff parser (AC: #2, #3)
  - [ ] Create `src/lib/git/diff-parser.ts`
  - [ ] Parse unified diff format line by line:
    - Lines starting with `+` (not `+++`) -> `added`
    - Lines starting with `-` (not `---`) -> `removed`
    - Lines starting with ` ` (space) -> `context`
    - Lines starting with `@@` -> hunk header (extract line numbers)
  - [ ] Track line numbers for both old and new file sides
  - [ ] Group lines into hunks based on `@@` headers
- [ ] Task 4: Create API route (AC: #6)
  - [ ] Create `src/app/api/git/diff/route.ts`
  - [ ] GET handler with query params: `?file=<path>&base=<sha>&head=<sha>`
  - [ ] If `base` omitted, diff against latest commit (HEAD)
  - [ ] If `head` omitted, diff against working tree
  - [ ] Validate file path exists and is within repo root
  - [ ] Return structured `GitDiff` as JSON
- [ ] Task 5: Performance validation (AC: #5)
  - [ ] Test diff generation on files of various sizes (100, 1000, 5000 LOC)
  - [ ] Ensure < 200ms for typical files

## Dev Notes

### simple-git Diff API

```typescript
import simpleGit from 'simple-git'

const git = simpleGit(repoPath)

// Diff working tree against HEAD
const diff = await git.diff(['HEAD', '--', filePath])

// Diff between two commits
const diff = await git.diff([baseSha, headSha, '--', filePath])

// Diff with unified format (default)
const diff = await git.diff(['--unified=3', 'HEAD', '--', filePath])
```

### Diff Parsing Strategy

The unified diff format is well-defined. Each hunk starts with:
```
@@ -oldStart,oldCount +newStart,newCount @@ optional section header
```

Lines within a hunk:
- ` ` (space prefix): context line (unchanged)
- `+`: added line
- `-`: removed line

### Project Structure Notes

- `src/lib/git/diff.ts` -- DiffGenerator class
- `src/lib/git/diff-parser.ts` -- Unified diff parser
- `src/lib/core/types.ts` -- GitDiff, DiffHunk, DiffLine types
- `src/app/api/git/diff/route.ts` -- API route

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: Git Diff Generation]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 8 - Drift Detection Pipeline]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5 - API Routes Design]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
