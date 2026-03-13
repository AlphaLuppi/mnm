# Story 5.6: Error Handling & User-Friendly Error Messages

Status: ready-for-dev

## Story

As a user,
I want clear, actionable error messages,
so that I can resolve issues without frustration.

## Acceptance Criteria

1. Error messages are user-friendly and follow the pattern: what happened, why it happened (if known), and what to do next (actionable steps)
2. Bad examples avoided: "Error: SQLITE_CONSTRAINT", "Drift detection failed". Good examples used: "Git operation failed: repository not found. Please check that you are in a git-initialized folder.", "Drift detection failed: Claude API key is invalid. Update your key in Settings."
3. Technical details are collapsible (hidden by default, expandable for advanced users)
4. Errors are logged with full context (stack trace, input data, timestamp) via structured logger
5. Critical errors display a "Report Issue" link pointing to the GitHub Issues page

## Tasks / Subtasks

- [ ] Task 1: Create error display components (AC: #1, #2, #3)
  - [ ] Create `src/components/shared/error-display.tsx` with user-friendly message, collapsible technical details, and action suggestions
  - [ ] Use shadcn/ui Alert for inline errors and AlertDialog for blocking errors
  - [ ] Include "Show Technical Details" collapsible section using shadcn/ui Collapsible
  - [ ] Include "Report Issue" link for critical errors
- [ ] Task 2: Create error boundary component (AC: #1, #3, #5)
  - [ ] Create `src/components/shared/error-boundary.tsx` React Error Boundary wrapping key page sections
  - [ ] On catch, display `ErrorDisplay` with recovery options: "Retry", "Go to Dashboard", "Report Issue"
  - [ ] Log caught errors via structured logger
  - [ ] Add error boundaries at page level and around key sections (agent dashboard, spec viewer, drift panel)
- [ ] Task 3: Map all error codes to user-friendly messages (AC: #1, #2)
  - [ ] Create `src/lib/core/error-messages.ts` with a mapping from `MnMError` codes to user-friendly messages
  - [ ] Cover all error types from Story 0.5: `GitError`, `DatabaseError`, `AgentError`, `DriftError`, `ConfigError`, `ApiError`
  - [ ] Each mapping includes: `title`, `description`, `suggestion` (actionable next step), `isCritical` flag
  - [ ] Use the `toUserMessage()` utility from MnMError base class (Story 0.5)
- [ ] Task 4: Implement API error response formatting (AC: #1, #2)
  - [ ] Ensure all API routes return consistent error format: `{ error: { code, message, details } }`
  - [ ] Create `src/lib/core/api-error-handler.ts` utility to standardize API error responses
  - [ ] Map MnMError instances to appropriate HTTP status codes (400, 404, 409, 500)
  - [ ] Include user-friendly message in the `message` field; technical details in `details`
- [ ] Task 5: Add "Report Issue" functionality (AC: #5)
  - [ ] Create `src/lib/core/issue-reporter.ts` with `getReportUrl(error: MnMError): string`
  - [ ] Generate GitHub Issues URL with pre-filled template: error code, MnM version, OS, reproduction steps
  - [ ] URL-encode error details into query parameters for the new issue form
  - [ ] Include "Report Issue" button in error display and error boundary components
- [ ] Task 6: Integrate error display into existing views (AC: #1)
  - [ ] Replace raw error renders in agent dashboard, spec viewer, drift panel with ErrorDisplay component
  - [ ] Add SWR `onError` handlers that show toast notifications for background errors
  - [ ] Use shadcn/ui Toast for non-blocking error notifications
- [ ] Task 7: Write tests (AC: #1, #2, #4, #5)
  - [ ] Unit tests for error code to message mapping (all error types covered)
  - [ ] Component tests for ErrorDisplay rendering with different error types
  - [ ] Test error boundary catches and displays recovery UI
  - [ ] Test API error response format consistency
  - [ ] Test Report Issue URL generation with correct pre-filled data

## Dev Notes

- This story builds on Story 0.5 (Error Handling Hierarchy) which establishes the `MnMError` base class and error types
- The error message mapping is a separate module from the error classes themselves, following separation of concerns (error definition vs. display)
- For API errors, the architecture specifies consistent error format in Section 5.3 of architecture-web.md
- Use shadcn/ui Toast (via Sonner) for non-blocking errors (API timeouts, background failures) and AlertDialog for blocking errors (database corruption, critical failures)
- The GitHub Issues pre-fill URL format: `https://github.com/[org]/[repo]/issues/new?title=...&body=...`

### Project Structure Notes

- `src/components/shared/error-display.tsx` -- user-friendly error UI
- `src/components/shared/error-boundary.tsx` -- React Error Boundary
- `src/lib/core/error-messages.ts` -- error code to message mapping
- `src/lib/core/api-error-handler.ts` -- API error response utility
- `src/lib/core/issue-reporter.ts` -- GitHub issue URL generator

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5.3 - Error Response Format]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.2 - Component Library: Alert, AlertDialog, Toast]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
