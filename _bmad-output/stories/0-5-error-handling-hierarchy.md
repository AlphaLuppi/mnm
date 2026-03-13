# Story 0.5: Error Handling Hierarchy

Status: ready-for-dev

## Story

As a developer,
I want a well-structured error hierarchy with typed error classes,
so that I can handle errors gracefully and provide clear user feedback.

## Acceptance Criteria

1. A base `MnMError` class exists that all domain errors extend
2. Specific error classes exist: `AgentError`, `DriftError`, `GitError`, `DatabaseError`, `SpecParsingError`
3. Each error class includes a `code` property for programmatic handling and a `userMessage` for display
4. Error classes have factory methods for common error cases (e.g., `AgentError.notFound(id)`)
5. Errors are defined in `src/lib/errors/` with barrel exports
6. A `toUserMessage(error)` utility converts any error to a user-friendly string

## Tasks / Subtasks

- [ ] Task 1: Create base error class (AC: #1)
  - [ ] Define `MnMError` extending `Error` with `code` and `userMessage` properties
- [ ] Task 2: Create domain error classes (AC: #2, #3, #4)
  - [ ] `AgentError` with codes: NOT_FOUND, ALREADY_RUNNING, LOCK_CONFLICT, SPAWN_FAILED
  - [ ] `DriftError` with codes: API_ERROR, INVALID_RESPONSE, SPEC_NOT_FOUND
  - [ ] `GitError` with codes: REPO_NOT_FOUND, OPERATION_FAILED, HOOK_FAILED
  - [ ] `DatabaseError` with codes: CONNECTION_FAILED, QUERY_FAILED, MIGRATION_FAILED
  - [ ] `SpecParsingError` with codes: INVALID_FORMAT, MISSING_FRONTMATTER, FILE_NOT_FOUND
- [ ] Task 3: Create error utility functions (AC: #6)
  - [ ] `toUserMessage(error: unknown): string` -- extracts user-friendly message from any error
  - [ ] `isMnMError(error: unknown): error is MnMError` -- type guard
- [ ] Task 4: Create barrel exports (AC: #5)
  - [ ] Export all errors and utilities from `src/lib/errors/index.ts`

## Dev Notes

### File Structure

```
src/lib/errors/
├── index.ts          # Barrel exports
├── base.ts           # MnMError base class
├── agent.ts          # AgentError
├── drift.ts          # DriftError
├── git.ts            # GitError
├── database.ts       # DatabaseError
├── spec-parsing.ts   # SpecParsingError
└── utils.ts          # toUserMessage, isMnMError
```

### Error Class Pattern

```typescript
// src/lib/errors/base.ts
export class MnMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}
```

```typescript
// src/lib/errors/agent.ts
import { MnMError } from './base'

export class AgentError extends MnMError {
  static notFound(id: string) {
    return new AgentError(
      `Agent not found: ${id}`,
      'AGENT_NOT_FOUND',
      `Agent "${id}" was not found. It may have been removed.`,
    )
  }

  static alreadyRunning(id: string) {
    return new AgentError(
      `Agent already running: ${id}`,
      'AGENT_ALREADY_RUNNING',
      `Agent "${id}" is already running. Pause or terminate it first.`,
    )
  }

  static lockConflict(filePath: string, conflictingAgentId: string) {
    return new AgentError(
      `File lock conflict: ${filePath} locked by ${conflictingAgentId}`,
      'AGENT_LOCK_CONFLICT',
      `Cannot proceed: "${filePath}" is being modified by another agent. Wait for it to complete or modify your scope.`,
    )
  }

  static spawnFailed(reason: string) {
    return new AgentError(
      `Agent spawn failed: ${reason}`,
      'AGENT_SPAWN_FAILED',
      `Failed to start agent: ${reason}. Check that Claude Code is installed and accessible.`,
    )
  }
}
```

### User Message Utility

```typescript
// src/lib/errors/utils.ts
import { MnMError } from './base'

export function isMnMError(error: unknown): error is MnMError {
  return error instanceof MnMError
}

export function toUserMessage(error: unknown): string {
  if (isMnMError(error)) return error.userMessage
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred.'
}
```

### Critical Constraints

- All error classes must extend `MnMError`
- `userMessage` must be human-readable and actionable (explain what happened AND what to do)
- `code` must be a unique uppercase string constant per error type
- Use factory methods (static methods) for all known error cases -- do NOT use the constructor directly outside the class
- The `cause` parameter allows wrapping underlying errors (e.g., wrapping a `better-sqlite3` error in `DatabaseError`)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Section 7.3 - Error Hierarchy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 8 - Error Handling Strategy]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.5]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
