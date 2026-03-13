# Story 4.4: AI-Generated Change Summaries

Status: ready-for-dev

## Story

As a user,
I want AI-generated summaries of spec changes,
so that I can quickly understand what changed without reading full diffs.

## Acceptance Criteria

1. When an important file has changed, Claude API is called with old file content, new file content (or diff), and a prompt: "Summarize what changed and why it matters"
2. Response is a natural language summary (1-3 sentences), e.g.: "Product vision updated: new feature X added to roadmap" or "Architecture decision: switched from PostgreSQL to SQLite"
3. Summary is stored in `spec_changes.change_summary` column via Drizzle ORM
4. Summary generation is async and does not block git operations or UI rendering
5. If Claude API call fails, fallback to "File changed: [file_path]" (no crash, graceful degradation)

## Tasks / Subtasks

- [ ] Task 1: Create change summary analyzer (AC: #1, #2)
  - [ ] Create `src/lib/git/change-summarizer.ts` with `summarizeChange(oldContent, newContent, filePath)` function
  - [ ] Build Claude API prompt template for spec change summarization
  - [ ] Parse Claude API response and extract 1-3 sentence summary
  - [ ] Validate response with Zod schema before persisting
- [ ] Task 2: Integrate with spec change detection pipeline (AC: #3, #4)
  - [ ] After `spec_changes` record is created (Story 4.3), trigger summary generation asynchronously
  - [ ] Use `Promise.allSettled()` for multiple simultaneous changes so one failure does not block others
  - [ ] Update `spec_changes.change_summary` via spec-changes repository after AI response
- [ ] Task 3: Create API route for change summaries (AC: #1, #3)
  - [ ] Extend `GET /api/git/changes` response to include `changeSummary` field
  - [ ] Add `POST /api/git/changes/[id]/summarize` endpoint to re-generate summary on demand
- [ ] Task 4: Implement fallback handling (AC: #5)
  - [ ] Catch Claude API errors (network, auth, rate limit) and set fallback summary
  - [ ] Log API failures with full context via structured logger
  - [ ] Set `change_summary` to `"File changed: ${filePath}"` on failure
- [ ] Task 5: Write tests (AC: #1, #2, #5)
  - [ ] Unit tests for prompt template construction
  - [ ] Unit tests for response parsing with valid and malformed responses
  - [ ] Unit test for fallback behavior on API failure
  - [ ] Integration test for API route with mocked Claude API

## Dev Notes

- Claude API integration follows the same pattern as drift analysis in `src/lib/drift/analyzer.ts` (see architecture-web.md Section 8.2)
- API key is read from `process.env.CLAUDE_API_KEY` in server-side code only
- Use `claude-sonnet-4-20250514` model with `temperature: 0` and `max_tokens: 1024` (summaries are short)
- Summary generation should be fire-and-forget from the change detection pipeline perspective; the UI can show "Generating summary..." placeholder via SWR refresh
- Rate limiting: if many files change at once (e.g., branch switch), queue requests with a concurrency limit (e.g., 3 concurrent API calls)

### Project Structure Notes

- `src/lib/git/change-summarizer.ts` -- new module in git lib (maps to `mnm-git` crate)
- `src/lib/db/repositories/spec-changes.ts` -- update function to set change_summary
- `src/app/api/git/changes/route.ts` -- extended response shape

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 8.2 - Claude API Integration]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 4.2 - Drizzle Schema: spec_changes table]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5.1 - Route Overview: `/api/git/changes`]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
