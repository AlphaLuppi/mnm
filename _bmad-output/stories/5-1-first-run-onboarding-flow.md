# Story 5.1: First-Run Onboarding Flow

Status: ready-for-dev

> **⚠️ SUPERSEDED BY STORY 6.3**
>
> This story describes a **wizard-based** onboarding flow. Per Sprint Change Proposal (2026-02-20),
> onboarding should be **conversational chat-based** instead. See **Story 6.3** for the approved approach.
>
> This story is retained for reference but should be implemented as described in Story 6.3.
> The acceptance criteria below represent the **fallback** if chat-based onboarding cannot be delivered.

## Story

As a new user,
I want a smooth onboarding experience,
so that I can start using MnM in under 2 minutes.

## Acceptance Criteria

1. When MnM is launched for the first time, an onboarding wizard appears with 5 steps: Welcome, Select Repository, Configure Claude API Key, Detect Important Files, Complete
2. Step 1 (Welcome): Shows "Welcome to MnM - Product-First ADE" with brief explanation and "Get Started" button
3. Step 2 (Select Repository): Provides input to select/enter the git repository folder path; validates it is a git repo; shows error if not a git-initialized folder
4. Step 3 (Configure Claude API Key): Input for API key, "Where to find your key" help link, key is validated via test API call, key is stored in `.env.local` (web POC)
5. Step 4 (Detect Important Files): Shows "Analyzing your repository..." with progress indicator, then results listing detected important files with review/adjust UI
6. Step 5 (Complete): Shows "Setup complete!" with "Open Dashboard" button
7. Onboarding completes in < 2 minutes for typical repos
8. Onboarding can be skipped (advanced users)
9. Onboarding state is saved (never shown again unless reset via settings)

## Tasks / Subtasks

- [ ] Task 1: Create onboarding wizard layout (AC: #1, #8)
  - [ ] Create `src/components/onboarding/onboarding-wizard.tsx` with step-based navigation
  - [ ] Use shadcn/ui Card for each step container, Button for navigation (Back, Next, Skip)
  - [ ] Implement step indicator (dots or progress bar) showing current position
  - [ ] Add "Skip Setup" link that bypasses all steps and goes to dashboard
- [ ] Task 2: Build Step 1 - Welcome (AC: #2)
  - [ ] Create `src/components/onboarding/steps/welcome-step.tsx`
  - [ ] Display welcome message, app description (2-3 sentences), and "Get Started" button
- [ ] Task 3: Build Step 2 - Select Repository (AC: #3)
  - [ ] Create `src/components/onboarding/steps/repo-select-step.tsx`
  - [ ] Text input for repository path (web POC uses path input, not native file picker)
  - [ ] Validate path is a git repo via `GET /api/git/status?path=...`
  - [ ] Show validation status: success checkmark or error message
- [ ] Task 4: Build Step 3 - API Key Configuration (AC: #4)
  - [ ] Create `src/components/onboarding/steps/api-key-step.tsx`
  - [ ] Password-type input for Claude API key
  - [ ] "Where to find your key" link to Anthropic console
  - [ ] Validate key via test API call (`POST /api/settings/validate-key`)
  - [ ] Show validation result (valid/invalid/error)
- [ ] Task 5: Build Step 4 - Detect Important Files (AC: #5)
  - [ ] Create `src/components/onboarding/steps/detect-files-step.tsx`
  - [ ] Show progress spinner during detection
  - [ ] Display results as checklist (shadcn/ui Checkbox) with file path and detected type
  - [ ] Allow user to add/remove files from the detected list
  - [ ] "Save" button to finalize selection
- [ ] Task 6: Build Step 5 - Complete (AC: #6)
  - [ ] Create `src/components/onboarding/steps/complete-step.tsx`
  - [ ] Show success message and summary of what was configured
  - [ ] "Open Dashboard" button that navigates to main app
- [ ] Task 7: Implement onboarding state persistence (AC: #9)
  - [ ] Store onboarding completion flag in `.mnm/config.json` via settings API
  - [ ] On app load, check flag and redirect to onboarding if not completed
  - [ ] Add "Re-run Setup" option in settings panel (Story 5.2)
- [ ] Task 8: Create onboarding API routes (AC: #3, #4, #5)
  - [ ] `POST /api/settings/validate-key` -- validate Claude API key
  - [ ] `POST /api/onboarding/detect-files` -- trigger important file detection
  - [ ] `POST /api/onboarding/complete` -- mark onboarding as done, save all config
- [ ] Task 9: Write tests (AC: #1, #7, #8)
  - [ ] Component tests for each step rendering correctly
  - [ ] Test wizard navigation (forward, backward, skip)
  - [ ] Integration test for onboarding completion flow
  - [ ] Test that onboarding is not shown after completion

## Dev Notes

- For the web POC, the API key is stored in `.env.local` or in `.mnm/config.json` (not system keychain). The validate-key endpoint makes a minimal Claude API call to confirm the key works.
- Repository path is entered as text (no native file picker in web). The path must be accessible from the server process.
- Important file detection reuses logic from Story 4.2; if 4.2 is not yet implemented, stub it with a file scan that returns all `.md` files.
- The onboarding wizard should use a dedicated route `/onboarding` with middleware redirect logic.
- Consider using Next.js middleware or layout-level check to redirect unonboarded users.

### Project Structure Notes

- `src/components/onboarding/` -- new directory for all onboarding components
- `src/app/onboarding/page.tsx` -- dedicated onboarding page
- `src/app/api/onboarding/` -- onboarding-specific API routes
- `src/app/api/settings/validate-key/route.ts` -- API key validation endpoint

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.2 - Component Library: Card, Button, Dialog]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 3.1 - Directory Layout]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
