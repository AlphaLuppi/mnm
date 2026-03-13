# Story 4.8: Commit Association (Link Commits to Specs/Stories)

Status: ready-for-dev

## Story

As a user,
I want commits to be linked to specs/stories,
so that I can track implementation history per requirement.

## Acceptance Criteria

1. When a git commit message follows convention (`refs: story-1.2.md`, `implements: FR3.2`, `closes: story-1.2.md`), MnM parses the commit message and creates associations: Commit SHA to Spec ID
2. Associations are stored in a `commit_associations` table (or in `specs` table with a JSON column)
3. Associations are displayed: in spec view as "Implemented by commits: abc123, def456" and in progress view as "Story 1.2: 3 commits"
4. Clicking a commit SHA shows full commit details (message, diff, author, date)
5. Parsing is forgiving and handles various reference formats (case-insensitive, with/without file extensions, hash references)

## Tasks / Subtasks

- [ ] Task 1: Create commit message parser (AC: #1, #5)
  - [ ] Create `src/lib/git/commit-parser.ts` with `parseCommitReferences(message: string): CommitReference[]`
  - [ ] Support patterns: `refs: <spec>`, `implements: <spec>`, `closes: <spec>`, `story: <spec>`, `spec: <spec>`
  - [ ] Handle variations: `story-1.2.md`, `story-1.2`, `#story-1.2`, `FR3.2`, `fr3.2`
  - [ ] Return array of `{ type: "refs"|"implements"|"closes", specPath: string }` objects
  - [ ] Use regex with case-insensitive matching for forgiving parsing
- [ ] Task 2: Create commit_associations table and repository (AC: #2)
  - [ ] Add Drizzle schema for `commit_associations` table: `id`, `commitSha`, `specId`, `referenceType`, `commitMessage`, `commitAuthor`, `commitDate`, `createdAt`
  - [ ] Create `src/lib/db/repositories/commit-associations.ts` with `create()`, `findBySpecId()`, `findByCommitSha()` functions
  - [ ] Generate and run Drizzle migration for new table
- [ ] Task 3: Implement commit scanning pipeline (AC: #1, #2)
  - [ ] Create `src/lib/git/commit-scanner.ts` that scans new commits since last known SHA
  - [ ] For each commit, run `parseCommitReferences()` on the message
  - [ ] Match parsed references to known specs in `specs` table (fuzzy match on file path)
  - [ ] Store associations via commit-associations repository
  - [ ] Trigger on startup (scan recent commits) and on detected git operations (post-fetch/pull)
- [ ] Task 4: Build commit association UI (AC: #3, #4)
  - [ ] In spec detail view, add "Related Commits" section showing linked commit SHAs with truncated messages
  - [ ] In progress/roadmap view, show commit count per story
  - [ ] Create `src/components/specs/commit-list.tsx` using shadcn/ui Table with commit SHA, message preview, author, date
  - [ ] Clicking a commit SHA opens a commit detail dialog (shadcn/ui Dialog) showing full message, author, date, and diff
- [ ] Task 5: Create API endpoints (AC: #3, #4)
  - [ ] Add `GET /api/specs/[id]/commits` returning associated commits for a spec
  - [ ] Add `GET /api/git/commits/[sha]` returning full commit detail (message, diff, author, date)
  - [ ] Use `simple-git` `log()` and `show()` for commit data retrieval
- [ ] Task 6: Write tests (AC: #1, #5)
  - [ ] Unit tests for commit message parser with all supported patterns
  - [ ] Unit tests for edge cases: no references, multiple references, malformed references
  - [ ] Integration test for commit scanning pipeline with mocked git log
  - [ ] Component test for commit list rendering

## Dev Notes

- Commit message parsing should be generous/forgiving -- better to create a false association than miss a real one
- The `commit_associations` table is a new addition beyond the original 7-table schema; keep it lightweight
- Commit scanning should be incremental: store last scanned commit SHA and only scan new commits
- For the POC, scanning recent commits on startup (last 100 commits) is sufficient; real-time scanning via git hooks is a future enhancement
- Use `simple-git` `log({ from: lastScannedSha, to: 'HEAD' })` for efficient incremental scanning
- Commit detail view reuses the diff viewer component from Story 4.6

### Project Structure Notes

- `src/lib/git/commit-parser.ts` -- new module for commit message parsing
- `src/lib/git/commit-scanner.ts` -- new module for commit scanning pipeline
- `src/lib/db/schema.ts` -- add `commitAssociations` table definition
- `src/lib/db/repositories/commit-associations.ts` -- new repository
- `src/components/specs/commit-list.tsx` -- commit list UI component
- `src/app/api/specs/[id]/commits/route.ts` -- new API endpoint
- `src/app/api/git/commits/[sha]/route.ts` -- new API endpoint

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 4.2 - Drizzle Schema (extend with commit_associations)]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 3.1 - Directory Layout: `src/lib/git/`]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5.1 - Route Overview: `/api/specs/[id]`, `/api/git/`]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.8]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
