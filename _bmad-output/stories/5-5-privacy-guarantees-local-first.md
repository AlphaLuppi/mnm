# Story 5.5: Privacy Guarantees & Local-First Verification

Status: ready-for-dev

## Story

As a user,
I want guaranteed local-first operation with no cloud sync,
so that my code and specs never leave my machine (except Claude API calls).

## Acceptance Criteria

1. The only external network requests are: Claude API calls (api.anthropic.com) and optional update checks (github.com)
2. No telemetry, analytics, or background sync to cloud services
3. All MnM data is stored in `.mnm/` directory (git-ignored) except `.mnm/important-files.json` which is git-tracked
4. Privacy policy is displayed in onboarding (Step 3) and in settings, clearly stating: "All data local except Claude API calls"
5. User can verify privacy via: network request logging in developer tools, `.mnm/` directory inspection showing all stored data

## Tasks / Subtasks

- [ ] Task 1: Audit and enforce network boundaries (AC: #1, #2)
  - [ ] Review all `fetch()` calls in the codebase and document each external endpoint
  - [ ] Ensure only `api.anthropic.com` is called for Claude API and optionally `github.com` for update checks
  - [ ] Create `src/lib/core/network-allowlist.ts` with allowed domains constant
  - [ ] Add a middleware or wrapper around `fetch()` that logs/warns on unexpected external calls (dev mode only)
- [ ] Task 2: Verify data storage locality (AC: #3)
  - [ ] Confirm all Drizzle ORM operations write to `.mnm/state.db`
  - [ ] Confirm logs write to `.mnm/logs/`
  - [ ] Confirm config writes to `.mnm/config.json`
  - [ ] Add `.mnm/` to `.gitignore` template (except `important-files.json`)
  - [ ] Create `src/lib/core/paths.ts` centralizing all `.mnm/` path constants
- [ ] Task 3: Create privacy policy component (AC: #4)
  - [ ] Create `src/components/shared/privacy-notice.tsx` with clear, concise privacy statement
  - [ ] Include bullet points: "All data stored locally in .mnm/", "Only external calls: Claude API", "No telemetry by default", "You can inspect all data in .mnm/"
  - [ ] Integrate into onboarding Step 3 (API key page) as an expandable section
  - [ ] Add to settings Privacy tab as a persistent reference
- [ ] Task 4: Implement telemetry opt-in system (AC: #2)
  - [ ] Create `src/lib/core/telemetry.ts` with `isTelemetryEnabled()` function reading from config
  - [ ] Default to `false` (opt-in, not opt-out)
  - [ ] If enabled, only collect anonymous usage stats (no code content, no file paths)
  - [ ] For POC, telemetry collection is stubbed (no actual endpoint) -- just the opt-in UI and config
- [ ] Task 5: Add network request logging for verification (AC: #5)
  - [ ] In development mode, log all outgoing fetch requests with destination URL to console
  - [ ] Create a simple network log viewer in settings (debug panel) showing recent external calls
  - [ ] Allow user to export network log for inspection
- [ ] Task 6: Create .mnm directory documentation (AC: #3, #5)
  - [ ] Add a `.mnm/README.md` file (auto-generated on first run) explaining each file/folder
  - [ ] Document: `state.db` (SQLite database), `config.json` (settings), `logs/` (log files), `important-files.json` (git-tracked)
- [ ] Task 7: Write tests (AC: #1, #2, #3)
  - [ ] Test that network allowlist rejects unexpected domains
  - [ ] Test that all file paths resolve within `.mnm/` directory
  - [ ] Test telemetry default is disabled
  - [ ] Test privacy notice renders correctly in onboarding and settings

## Dev Notes

- Local-first is a core architectural principle preserved from the native Rust app
- The web POC runs a local Next.js server, so "local-first" means the server process and browser are on the same machine
- Claude API calls are the only expected external traffic; the API key is stored server-side (`.env.local` or `.mnm/config.json`)
- The fetch wrapper/logger is for development verification only; it should not affect production performance
- `.mnm/important-files.json` is intentionally git-tracked so teams can share important file configurations

### Project Structure Notes

- `src/lib/core/network-allowlist.ts` -- allowed external domains
- `src/lib/core/paths.ts` -- centralized .mnm/ path constants
- `src/lib/core/telemetry.ts` -- telemetry opt-in logic
- `src/components/shared/privacy-notice.tsx` -- privacy statement component

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 1.4 - External Dependencies]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 3.1 - Directory Layout: `.mnm/`]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 2.2 - Boring Technology Principle: local-first compatible]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.5]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
