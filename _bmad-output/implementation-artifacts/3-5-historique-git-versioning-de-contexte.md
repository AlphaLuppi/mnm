# Story 3.5: Historique Git & Versioning de Contexte

Status: ready-for-dev

## Story

As a **user**,
I want **to see the git history of my project and view context files as they were at any commit**,
So that **I can understand how my project evolved and compare versions**.

## Context

Depends on: Stories 3.1 (git integration), 3.2 (context files). Uses the git-info service.

## Acceptance Criteria

### AC1 — Git history in Context pane

**Given** the project is a git repository
**When** I expand a "Git History" section in the Context pane
**Then** I see the last 20 commits with: hash, message, author, relative date

### AC2 — View file at commit

**Given** I click on a commit in the git history
**When** I select a file
**Then** I see the file content as it was at that commit (via `git show hash:path`)

### AC3 — Branch info

**Given** the project has multiple branches
**When** I view the git section
**Then** I see the current branch name and can see other branches

## Tasks / Subtasks

- [ ] Task 1: Git history in ContextPane (AC: #1, #3)
  - [ ] 1.1 Add "Git" section to ContextPane (collapsible, below Epics)
  - [ ] 1.2 Fetch commits from `gitApi.getInfo(projectId)` (created in Story 3.1)
  - [ ] 1.3 Render commit list: short hash, message (truncated), relative date
  - [ ] 1.4 Show current branch name at top of section

- [ ] Task 2: File at commit viewer (AC: #2)
  - [ ] 2.1 Add `GET /api/projects/:id/git/show?ref=<hash>&path=<file>` endpoint — runs `git show hash:path`
  - [ ] 2.2 On click commit → show list of changed files in that commit
  - [ ] 2.3 On click file → show file content at that commit in Work pane via SpecViewer

- [ ] Task 3: Tests
  - [ ] 3.1 Test: git show endpoint returns file content
  - [ ] 3.2 Test: path traversal rejected
  - [ ] 3.3 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Git Commands
```bash
git show <hash>:<path>                    # file at commit
git log --oneline -20 -- <path>           # file history
git diff <hash1> <hash2> -- <path>        # diff between commits
```

### What NOT to do
- Do NOT create IPC/Electron code
- Do NOT implement a full git GUI — minimal history view only

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
