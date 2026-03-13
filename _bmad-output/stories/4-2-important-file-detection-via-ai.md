# Story 4.2: Important File Detection via AI

Status: ready-for-dev

## Story

As a user,
I want MnM to automatically identify important spec files in my repository,
so that I'm notified when they change without manual configuration.

## Acceptance Criteria

1. On first run in a repository, MnM scans for files and classifies them via Claude API
2. Each file is classified by type: ProductBrief, Prd, Story, Architecture, Config, Code (not important) with confidence: High, Medium, Low
3. Files classified as ProductBrief, Prd, Story, Architecture, Config are stored in the `important_files` database table
4. Classification result is saved to `.mnm/important-files.json` (git-tracked)
5. User is shown a review UI: list of detected important files, option to confirm/add/remove files, "Save" button to finalize
6. Detection completes in < 30 seconds for repos with 500 files
7. User can manually re-run detection via settings

## Tasks / Subtasks

- [ ] Task 1: Implement file classifier (AC: #1, #2, #6)
  - [ ] Create `src/lib/git/file-classifier.ts` with logic to scan repo for candidate files (markdown, yaml, json, etc.)
  - [ ] Filter out obvious non-spec files (node_modules, .git, binary files, etc.)
  - [ ] Implement Claude API call to classify each file (batch where possible)
  - [ ] Parse structured classification response (type + confidence)
- [ ] Task 2: Implement important files repository (AC: #3, #4)
  - [ ] Create `src/lib/db/repositories/important-files.ts` with CRUD operations
  - [ ] Implement save to `.mnm/important-files.json` for git-tracked persistence
  - [ ] Implement load from `.mnm/important-files.json` on subsequent runs
- [ ] Task 3: Create important files API routes (AC: #1, #5, #7)
  - [ ] Create `POST /api/git/important-files/detect` to trigger detection
  - [ ] Create `GET /api/git/important-files` to list detected files
  - [ ] Create `PATCH /api/git/important-files` to update user confirmations (add/remove)
- [ ] Task 4: Build review UI component (AC: #5)
  - [ ] Create `src/components/specs/important-files-review.tsx`
  - [ ] Display file list with type badges and confidence indicators using shadcn/ui Table, Badge
  - [ ] Add checkboxes for confirm/remove, text input for manually adding files
  - [ ] "Save" button to finalize selection
  - [ ] Progress indicator during detection ("Analyzing your repository...")
- [ ] Task 5: Write tests (AC: #1, #2, #6)
  - [ ] Unit tests for file classifier logic (mock Claude API with MSW)
  - [ ] Unit tests for important files repository
  - [ ] Integration test for detection API route

## Dev Notes

- Claude API call happens server-side in the API route to protect the API key
- For performance, batch file classification: send groups of file paths + first N lines of content in a single Claude API call rather than one call per file
- The `.mnm/important-files.json` format matches the native architecture spec
- The review UI can be reused in the onboarding flow (Story 5.1, Step 4)
- Use `simple-git` to list files in the repo (avoid filesystem scanning for git-ignored files)

### Project Structure Notes

- `src/lib/git/file-classifier.ts` -- AI-powered file classification
- `src/lib/db/repositories/important-files.ts` -- database repository
- `src/app/api/git/important-files/` -- API routes for detection and management
- `src/components/specs/important-files-review.tsx` -- review UI

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 3.1 - Directory Layout: `src/lib/git/file-classifier.ts`]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 8.2 - Claude API Integration]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 4.2 - Drizzle Schema: `important_files` table]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
