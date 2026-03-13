# Story 0.3: Domain Models

Status: ready-for-dev

## Story

As a developer,
I want clean TypeScript domain types with no external dependencies,
so that I have a solid foundation for business logic across the application.

## Acceptance Criteria

1. All domain types are defined in `src/lib/models/` with zero dependencies on other MnM modules (DB, Git, UI)
2. The following interfaces/types exist: `Agent`, `Spec`, `DriftDetection`, `FileLock`, `ImportantFile`, `SpecChange`
3. The following enums exist: `AgentStatus`, `SpecType`, `DriftSeverity`, `DriftType`, `LockType`, `UserDecision`
4. All types include Zod validation schemas for runtime type safety
5. Type exports are organized with barrel exports from `src/lib/models/index.ts`
6. Types are compatible with Drizzle schema inference (can be used with `InferSelectModel`)

## Tasks / Subtasks

- [ ] Task 1: Create enum types (AC: #3)
  - [ ] Define `AgentStatus`: idle, pending, running, paused, completed, error
  - [ ] Define `SpecType`: product_brief, prd, story, architecture, config
  - [ ] Define `DriftSeverity`: minor, moderate, critical
  - [ ] Define `DriftType`: scope_expansion, approach_change, design_deviation
  - [ ] Define `LockType`: read, write
  - [ ] Define `UserDecision`: accepted, rejected, pending
- [ ] Task 2: Create domain interfaces (AC: #2)
  - [ ] Define `Agent` type with all fields from architecture
  - [ ] Define `Spec` type with all fields
  - [ ] Define `DriftDetection` type with all fields
  - [ ] Define `FileLock` type with all fields
  - [ ] Define `ImportantFile` type with all fields
  - [ ] Define `SpecChange` type with all fields
- [ ] Task 3: Create Zod validation schemas (AC: #4)
  - [ ] Create Zod schema for each domain type
  - [ ] Ensure schemas validate enum values correctly
  - [ ] Export inferred types from Zod schemas as the canonical types
- [ ] Task 4: Create barrel exports (AC: #5)
  - [ ] Create `src/lib/models/index.ts` exporting all types and schemas

## Dev Notes

### File Structure

```
src/lib/models/
├── index.ts          # Barrel exports
├── enums.ts          # All enum definitions (as const objects + type unions)
├── agent.ts          # Agent type + Zod schema
├── spec.ts           # Spec type + Zod schema
├── drift.ts          # DriftDetection type + Zod schema
├── file-lock.ts      # FileLock type + Zod schema
├── important-file.ts # ImportantFile type + Zod schema
└── spec-change.ts    # SpecChange type + Zod schema
```

### Enum Pattern

Use `as const` objects with derived union types (TypeScript idiomatic pattern):

```typescript
// src/lib/models/enums.ts
export const AgentStatus = {
  Idle: 'idle',
  Pending: 'pending',
  Running: 'running',
  Paused: 'paused',
  Completed: 'completed',
  Error: 'error',
} as const

export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus]
```

This pattern is preferred over TypeScript `enum` because:
- Works with Zod `z.enum()` directly
- Compatible with Drizzle text columns
- No runtime overhead from enum compilation
- Values are plain strings (serialization-friendly)

### Zod Schema Pattern

```typescript
// src/lib/models/agent.ts
import { z } from 'zod'
import { AgentStatus } from './enums'

export const agentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: z.enum([AgentStatus.Idle, AgentStatus.Pending, ...]),
  specId: z.string().uuid().nullable(),
  scope: z.array(z.string()),  // JSON array of file paths
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type Agent = z.infer<typeof agentSchema>
```

### Domain Type Fields (from Architecture Section 3.2)

**Agent:** id, name, status, specId, scope (string[]), startedAt, completedAt, errorMessage, createdAt, updatedAt

**Spec:** id, filePath, specType, title, lastModified, gitCommitSha, contentHash, createdAt, updatedAt

**DriftDetection:** id, agentId, specId, severity, driftType, summary, recommendation, diffContent, userDecision, decidedAt, createdAt, updatedAt

**FileLock:** id, filePath, agentId, lockType, acquiredAt, releasedAt

**ImportantFile:** id, filePath, fileType, detectedAt, userConfirmed, createdAt, updatedAt

**SpecChange:** id, filePath, oldCommitSha, newCommitSha, changeSummary, detectedAt, userViewed, createdAt

### Critical Constraints

- ZERO imports from `src/lib/db/`, `src/lib/git/`, `src/components/`, or any non-model module
- Only allowed imports: `zod` (for validation)
- Use camelCase for TypeScript field names (not snake_case from SQL)
- Timestamps are Unix epoch seconds (number type), not Date objects
- `scope` on Agent is `string[]` in TypeScript but stored as JSON TEXT in SQLite

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Section 4.2 - mnm-core]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 3.2 - Schema Design]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 7.3 - Error Hierarchy]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.3]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
