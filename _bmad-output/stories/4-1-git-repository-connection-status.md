# Story 4.1: Git Repository Connection & Status

Status: ready-for-dev

## Story

As a user,
I want MnM to connect to my git repository,
so that it can track changes and provide git-driven features.

## Acceptance Criteria

1. When a git repository is detected in the working directory, MnM connects using `simple-git`
2. The following information is displayed: repository path, current branch name, latest commit SHA, remotes (origin, upstream, etc.), git status (staged, unstaged, untracked files count)
3. If no git repository is found, MnM displays: "No git repository detected. Please open a git-initialized project."
4. Git connection is established in < 500ms (web target, simple-git CLI wrapper)
5. Git operations are non-blocking (async)

## Tasks / Subtasks

- [ ] Task 1: Implement git repository wrapper (AC: #1, #4, #5)
  - [ ] Create `src/lib/git/repository.ts` using `simple-git` to wrap git operations
  - [ ] Implement `getRepoInfo()` returning repo path, branch, latest SHA, remotes, status counts
  - [ ] Ensure all operations are async and non-blocking
- [ ] Task 2: Create git status API route (AC: #1, #2)
  - [ ] Create `src/app/api/git/status/route.ts` (GET) returning repository info as JSON
  - [ ] Handle case where no git repository is found (return 404 with descriptive message)
  - [ ] Validate response shape with Zod schema
- [ ] Task 3: Build git status UI component (AC: #2, #3)
  - [ ] Create `src/components/layout/git-status-bar.tsx` showing branch name, commit SHA, remotes
  - [ ] Show staged/unstaged/untracked file counts using shadcn/ui Badge
  - [ ] Display "No git repository detected" message when repo is not found
  - [ ] Integrate into root layout header area
- [ ] Task 4: Add SWR polling for git status (AC: #5)
  - [ ] Use SWR with 10-second polling interval per architecture spec
  - [ ] Handle loading and error states gracefully
- [ ] Task 5: Write tests (AC: #1, #4)
  - [ ] Unit tests for repository wrapper (mock simple-git)
  - [ ] Integration test for API route

## Dev Notes

- This story uses `simple-git` which is a Node.js CLI wrapper around the git binary (replaces `git2-rs` from native architecture)
- All git operations happen server-side in API routes; the client polls via SWR
- Performance target is relaxed to < 500ms for web (vs. < 200ms for native) since simple-git spawns CLI processes
- The git status bar should be visible in the root layout header, always showing current state

### Project Structure Notes

- `src/lib/git/repository.ts` -- main git wrapper module (maps to `mnm-git` crate)
- `src/app/api/git/status/route.ts` -- API route for git status
- `src/components/layout/git-status-bar.tsx` -- UI component in layout area

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5.1 - Route Overview: `/api/git/status`]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 6.3 - Real-Time Strategy: Git status SWR polling 10s]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 3.1 - Directory Layout: `src/lib/git/`]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
