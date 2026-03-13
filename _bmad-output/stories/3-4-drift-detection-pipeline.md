# Story 3.4: Drift Detection Pipeline (End-to-End)

Status: ready-for-dev

## Story

As a user,
I want drift detection to run automatically when an agent completes work,
so that I am alerted to misalignment without manual checks.

## Acceptance Criteria

1. When an agent completes work, drift detection runs automatically (triggered via the agent event bus)
2. The pipeline executes the 6-step process: load spec, generate diff, load instructions, call Claude API, classify drift, persist results
3. Drift detection results are stored in the `drift_detections` table with links to agent_id and spec_id
4. Drift detection runs asynchronously (does not block the API response or UI)
5. Drift detection completes in < 5 seconds for files < 1000 LOC (API-bound)
6. If drift detection fails, the error is logged but does not crash the application
7. An API route `POST /api/drift` allows manual drift detection trigger
8. An API route `GET /api/drift` returns all drift detection results

## Tasks / Subtasks

- [ ] Task 1: Create DriftDetector orchestrator (AC: #1, #2)
  - [ ] Create `src/lib/drift/detector.ts`
  - [ ] Implement `detectDrift(agentId: string, specId: string): Promise<DriftDetection>`
  - [ ] Pipeline steps:
    1. Load spec from database (via spec repository)
    2. Read spec file content from disk
    3. Get agent's file scope from database
    4. Generate git diff for each file in scope (via DiffGenerator from Story 3.1)
    5. Load custom instructions (via instruction loader from Story 3.3)
    6. Call Claude API with spec + combined diff + instructions (via DriftAnalyzer from Story 3.2)
    7. Parse result into DriftDetection model
    8. Insert into `drift_detections` table
    9. Return the detection result
- [ ] Task 2: Create drift repository (AC: #3)
  - [ ] Create `src/lib/db/repositories/drift.ts`
  - [ ] Implement: `findAll()`, `findByAgent(agentId)`, `findBySpec(specId)`, `findPending()`, `insert(detection)`, `update(id, fields)`
  - [ ] Use Drizzle ORM query builder
- [ ] Task 3: Wire automatic trigger (AC: #1, #4)
  - [ ] Listen to agent event bus for `completed` events
  - [ ] On agent completion, call `detectDrift()` asynchronously (fire-and-forget with error logging)
  - [ ] Use `Promise.resolve().then(...)` or `setImmediate()` to avoid blocking the completion handler
- [ ] Task 4: Create drift API routes (AC: #7, #8)
  - [ ] Create `src/app/api/drift/route.ts`
  - [ ] GET handler: return all drift detections, support filters `?status=pending`, `?specId=`, `?agentId=`
  - [ ] POST handler: accept `{ specId, agentId? }` to trigger manual drift detection
    - If `agentId` provided, use agent's scope for diff
    - If not, diff entire spec-related files against HEAD
  - [ ] Return drift detection result
- [ ] Task 5: Create single drift API route (AC: #3)
  - [ ] Create `src/app/api/drift/[id]/route.ts`
  - [ ] GET handler: return single drift detection with full details
  - [ ] PATCH handler: update user decision (for Stories 3.6, 3.7)
- [ ] Task 6: Error handling (AC: #6)
  - [ ] Wrap entire pipeline in try/catch
  - [ ] Log errors with context: agentId, specId, step that failed
  - [ ] If Claude API fails after retries, store a "failed" drift record with error message
  - [ ] Never throw unhandled exceptions from the async trigger

## Dev Notes

### Pipeline Data Flow

```
Agent Completes
  |
  v
Load Spec (DB) --> Read Spec Content (disk) --> Get Agent Scope (DB)
  |
  v
Generate Git Diff (simple-git, per file in scope)
  |
  v
Load Custom Instructions (.mnm/drift-instructions.md)
  |
  v
Call Claude API (spec + diff + instructions)
  |
  v
Parse & Validate Response (Zod)
  |
  v
Insert into drift_detections table (Drizzle)
  |
  v
Emit drift_detected event (for UI notification)
```

### Combining Diffs from Multiple Files

When an agent works on multiple files, combine all diffs into a single string for the Claude API call:

```typescript
const diffs = await Promise.all(
  scope.map(file => diffGenerator.generateDiff(file, baseSha))
)
const combinedDiff = diffs
  .filter(d => d !== null)
  .map(d => `--- ${d.filePath} ---\n${d.raw}`)
  .join('\n\n')
```

### Async Fire-and-Forget Pattern

```typescript
agentEventBus.on('completed', (event) => {
  // Don't await -- fire and forget
  detectDrift(event.agentId, event.specId).catch((err) => {
    console.error('Drift detection failed:', err)
  })
})
```

### Project Structure Notes

- `src/lib/drift/detector.ts` -- DriftDetector (pipeline orchestrator)
- `src/lib/db/repositories/drift.ts` -- DriftRepository
- `src/app/api/drift/route.ts` -- GET/POST handlers
- `src/app/api/drift/[id]/route.ts` -- GET/PATCH handlers

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4: Drift Detection Pipeline]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 8.1 - Pipeline]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 6.2 - Detection Pipeline]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
