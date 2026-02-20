# Story 5.4: Agent Sandboxing & Scope Enforcement

Status: ready-for-dev

## Story

As a user,
I want agents to be restricted to their declared file scope,
so that they cannot accidentally modify unrelated files.

## Acceptance Criteria

1. When an agent is launched with a file scope, MnM validates any file modification against the declared scope: allow if within scope, block and log warning if outside scope
2. Blocking is enforced at the IPC bridge level (before command reaches subprocess), intercepting file write operations
3. User is notified when a scope violation occurs: "Agent X attempted to modify file outside scope: [path]"
4. User can choose to: expand scope (add file to allowed list), deny and continue, or terminate agent
5. Destructive operations require explicit confirmation: file deletion, git reset/revert, large file modifications (> 1000 LOC changed)
6. Sandbox violations are logged for audit with agent ID, file path, operation type, and timestamp

## Tasks / Subtasks

- [ ] Task 1: Implement scope validation logic (AC: #1)
  - [ ] Create `src/lib/agent/scope-validator.ts` with `isInScope(filePath: string, scope: string[]): boolean`
  - [ ] Support glob patterns in scope definitions (e.g., `src/lib/agent/**`)
  - [ ] Normalize file paths before comparison (resolve relative paths, handle trailing slashes)
  - [ ] Use `micromatch` or `picomatch` npm package for glob matching
- [ ] Task 2: Integrate scope checking into IPC bridge (AC: #2)
  - [ ] In `src/lib/agent/claude-code.ts` (ClaudeCodeBridge), intercept agent output for file operations
  - [ ] Parse agent IPC messages for file write/delete commands
  - [ ] Before forwarding to filesystem, validate path against agent's declared scope
  - [ ] If out of scope, emit `scopeViolation` event on AgentEventBus instead of executing
- [ ] Task 3: Build scope violation notification UI (AC: #3, #4)
  - [ ] Create `src/components/agents/scope-violation-dialog.tsx` using shadcn/ui AlertDialog
  - [ ] Show: agent name, attempted file path, declared scope
  - [ ] Action buttons: "Expand Scope" (adds file to scope), "Deny" (block operation), "Terminate Agent"
  - [ ] "Expand Scope" calls `PATCH /api/agents/[id]` to update scope array
- [ ] Task 4: Implement destructive operation confirmation (AC: #5)
  - [ ] Create `src/lib/agent/destructive-detector.ts` that classifies operations as destructive
  - [ ] Detect: file deletion, git reset/revert commands, modifications > 1000 LOC
  - [ ] For destructive operations, pause agent and show confirmation dialog before proceeding
  - [ ] Use shadcn/ui AlertDialog with clear description of the destructive action
- [ ] Task 5: Create violation audit log (AC: #6)
  - [ ] Log violations via structured logger with: `agentId`, `filePath`, `operation`, `scopeDefinition`, `userDecision`, `timestamp`
  - [ ] Store in a log file at `.mnm/logs/scope-violations.log` for audit trail
  - [ ] Optionally add a `scope_violations` view in the agent detail page
- [ ] Task 6: Create API endpoints (AC: #3, #4)
  - [ ] `PATCH /api/agents/[id]/scope` -- expand or modify agent scope
  - [ ] `POST /api/agents/[id]/approve-operation` -- approve a pending destructive operation
  - [ ] `GET /api/agents/[id]/violations` -- list scope violations for an agent
- [ ] Task 7: Write tests (AC: #1, #2, #5, #6)
  - [ ] Unit tests for scope validation with exact paths and glob patterns
  - [ ] Unit tests for destructive operation detection
  - [ ] Integration test for IPC interception flow
  - [ ] Test violation logging output format

## Dev Notes

- Scope enforcement in the web POC is "best effort" since Claude Code subprocess has direct filesystem access. The IPC bridge can intercept and warn, but cannot fully prevent a subprocess from writing outside scope. For the POC, monitoring + warning is the primary mechanism.
- The `scope` field on the agent is a JSON array of file paths/globs stored in the `agents` table
- Use `picomatch` (lightweight glob matcher) rather than `micromatch` for minimal dependency footprint
- AgentEventBus events for scope violations: `{ type: "scopeViolation"; agentId: string; filePath: string; operation: string }`
- Destructive operation detection is heuristic-based: parse agent stdout for git commands and file operations
- LOC counting for "large modifications" can use a simple line-count diff on the output

### Project Structure Notes

- `src/lib/agent/scope-validator.ts` -- scope validation logic
- `src/lib/agent/destructive-detector.ts` -- destructive operation classification
- `src/components/agents/scope-violation-dialog.tsx` -- violation notification UI
- `src/app/api/agents/[id]/scope/route.ts` -- scope modification endpoint
- `src/app/api/agents/[id]/approve-operation/route.ts` -- destructive op approval

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.1 - Claude Code Subprocess]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.2 - File Lock Manager]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.3 - Agent Event Bus]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
