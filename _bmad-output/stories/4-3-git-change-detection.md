# Story 4.3: Git Change Detection

Status: ready-for-dev

## Story

As a user,
I want MnM to detect when important files change in git,
so that I'm aware of updates from teammates or branch switches.

## Acceptance Criteria

1. When important files are configured, MnM compares old git ref vs. new git ref to detect changes
2. Only important files are checked (performance optimization)
3. For each changed file: old commit SHA and new commit SHA are recorded, diff is generated, change is stored in `spec_changes` database table
4. Change detection runs via periodic polling of git state (web adaptation of git hooks)
5. Change detection completes in < 500ms (web target)
6. If detection fails, error is logged but does not crash MnM

## Tasks / Subtasks

- [ ] Task 1: Implement change detector (AC: #1, #2, #3, #5)
  - [ ] Create `src/lib/git/change-detector.ts`
  - [ ] Implement `detectChanges(importantFiles, lastKnownSha, currentSha)` comparing two git refs
  - [ ] Use `simple-git` to generate diffs for only the important files (filter by path)
  - [ ] Return structured change objects with old SHA, new SHA, diff content
- [ ] Task 2: Implement spec changes repository (AC: #3)
  - [ ] Create `src/lib/db/repositories/spec-changes.ts` with insert and query operations
  - [ ] Store detected changes with file path, commit SHAs, and placeholder for AI summary
  - [ ] Support querying changes by "since last session" and "unviewed"
- [ ] Task 3: Create change detection API routes (AC: #1, #4)
  - [ ] Create `GET /api/git/changes` to list spec changes since last session
  - [ ] Create `POST /api/git/changes/detect` to trigger manual change detection
  - [ ] Store last known git SHA in database or `.mnm/` state for session tracking
- [ ] Task 4: Implement background polling (AC: #4, #6)
  - [ ] Set up SWR polling (10s interval per architecture spec) on the client to poll git state
  - [ ] Server-side: compare current HEAD with last known HEAD on each poll
  - [ ] Trigger change detection when HEAD changes (checkout, pull, fetch)
  - [ ] Wrap detection in try/catch to prevent crashes on failure
- [ ] Task 5: Write tests (AC: #1, #2, #5, #6)
  - [ ] Unit tests for change detector (mock simple-git)
  - [ ] Unit tests for spec changes repository
  - [ ] Integration test for change detection API route
  - [ ] Test error handling: detection failure should not propagate

## Dev Notes

- The native architecture uses git hooks (post-checkout, post-merge). For the web POC, we use periodic polling instead since we cannot reliably install git hooks from a web server. If needed, git hook support can be added later.
- The change detector only diffs important files (from Story 4.2), not the entire repo, for performance.
- Last known SHA should be persisted in the database so it survives server restarts.
- The `spec_changes` table has a `change_summary` field that will be populated by Story 4.4 (AI summaries).

### Project Structure Notes

- `src/lib/git/change-detector.ts` -- core change detection logic
- `src/lib/db/repositories/spec-changes.ts` -- database repository for changes
- `src/app/api/git/changes/route.ts` -- API route for listing and triggering detection

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5.1 - Route Overview: `/api/git/changes`]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 6.3 - Real-Time Strategy: Spec changes SWR polling 10s]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 4.2 - Drizzle Schema: `spec_changes` table]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
