# Story 7.4: Exécution des Tests depuis MnM

Status: ready-for-dev

## Story

As a **user**,
I want **to run tests associated with a spec directly from MnM**,
So that **I can validate implementation without switching to a terminal**.

## Acceptance Criteria

### AC1 — Lancement des tests via test:run IPC

**Given** je suis sur une spec avec des tests associés
**When** je clique sur "Lancer les tests" (ou `Cmd+Enter` dans le volet Tests)
**Then** MnM exécute les tests via `test:run` IPC qui spawne vitest (ou la commande configurée) (FR36)
**And** les résultats arrivent en streaming via `stream:test-result`

### AC2 — Progress bar et résultats temps réel

**Given** les tests sont en cours d'exécution
**When** je regarde le volet Tests
**Then** une progress bar s'affiche avec le nombre de tests exécutés / total
**And** les résultats apparaissent au fur et à mesure (pass en vert, fail en rouge)

### AC3 — Détail des erreurs de test

**Given** un test échoue
**When** le résultat arrive
**Then** le détail de l'erreur est affiché : nom du test, message d'erreur, stack trace
**And** un clic sur le fichier source ouvre la ligne en question

### AC4 — Toast de succès à la fin

**Given** tous les tests sont passés
**When** l'exécution est terminée
**Then** un toast de succès s'affiche : "X tests passés" (auto-dismiss 3s)

### AC5 — Non-blocage du thread UI avec agents actifs

**Given** je lance des tests alors que des agents sont actifs
**When** l'exécution commence
**Then** le thread UI n'est pas bloqué (< 100ms, NFR6)
**And** les agents continuent de fonctionner normalement

## Tasks / Subtasks

- [ ] Task 1: Implement test-runner.service.ts execution logic (AC: #1, #5)
  - [ ] 1.1 Extend `src/main/services/test-runner/test-runner.service.ts` with `runTests()` method
  - [ ] 1.2 Spawn vitest (or configured command from `.mnm/settings.json`) as child process
  - [ ] 1.3 Parse vitest JSON reporter output to extract individual test results
  - [ ] 1.4 Support run scopes: `all` (all tests), `spec` (by specId), `single` (by testId)
  - [ ] 1.5 Emit `stream:test-result` events for each test result as they arrive
  - [ ] 1.6 Emit `stream:test-run-complete` event when all tests finish
  - [ ] 1.7 Handle process errors: test runner not found, crash, timeout
  - [ ] 1.8 Ensure subprocess does not block main process event loop (NFR6)
  - [ ] 1.9 Create `src/main/services/test-runner/test-runner.service.test.ts` (extend existing)

- [ ] Task 2: Implement test:run IPC handler (AC: #1)
  - [ ] 2.1 Add `test:run` handler in `src/main/ipc/handlers.ts`
  - [ ] 2.2 Handler validates args: `specId` (optional), `scope` (unit/integration/e2e)
  - [ ] 2.3 Calls `testRunnerService.runTests()` with scope and optional filter
  - [ ] 2.4 Returns `{ runId: string }` immediately (execution is async)
  - [ ] 2.5 Error handling: return `AppError` if test runner not configured or files not found

- [ ] Task 3: Create test output parser (AC: #1, #3)
  - [ ] 3.1 Create `src/main/services/test-runner/test-output-parser.ts`
  - [ ] 3.2 Parse vitest JSON reporter output format into `TestRunResult` objects
  - [ ] 3.3 Extract: test name, status (pass/fail/skip), duration, error message, stack trace, file + line number
  - [ ] 3.4 Handle partial output (streaming: parse as chunks arrive)
  - [ ] 3.5 Create `src/main/services/test-runner/test-output-parser.test.ts`

- [ ] Task 4: Create TestRunButton component (AC: #1)
  - [ ] 4.1 Create `src/renderer/src/features/tests/components/TestRunButton.tsx`
  - [ ] 4.2 States: idle (primary button "Lancer les tests"), running (disabled, spinner), complete (re-enables)
  - [ ] 4.3 Click triggers `test:run` IPC invoke
  - [ ] 4.4 Keyboard shortcut: `Cmd+Enter` when Tests pane is focused
  - [ ] 4.5 Dropdown for scope selection: "Tous les tests", "Tests de cette spec", "Ce test uniquement"
  - [ ] 4.6 `aria-label`: "Lancer les tests" / "Tests en cours d'exécution"
  - [ ] 4.7 Create `src/renderer/src/features/tests/components/TestRunButton.test.tsx`

- [ ] Task 5: Create TestRunProgress component (AC: #2)
  - [ ] 5.1 Create `src/renderer/src/features/tests/components/TestRunProgress.tsx`
  - [ ] 5.2 Display: progress bar (executed / total), count of pass/fail/pending
  - [ ] 5.3 Progress bar: green fill for pass, red fill segment for fails
  - [ ] 5.4 Text: "12 / 25 tests exécutés" with live counter
  - [ ] 5.5 Width transition 300ms ease-out, counter animation 300ms
  - [ ] 5.6 Respect `prefers-reduced-motion`
  - [ ] 5.7 `role="progressbar"` with `aria-valuenow`, `aria-valuemax`, `aria-label`
  - [ ] 5.8 Create `src/renderer/src/features/tests/components/TestRunProgress.test.tsx`

- [ ] Task 6: Create TestErrorView component (AC: #3)
  - [ ] 6.1 Create `src/renderer/src/features/tests/components/TestErrorView.tsx`
  - [ ] 6.2 Display: test name, file path (clickable), error message, stack trace (monospace)
  - [ ] 6.3 File path click: emit `nav:open-file` event with `{ path: string; line: number }`
  - [ ] 6.4 Stack trace: collapsible, syntax-highlighted, limited to 20 lines (expandable)
  - [ ] 6.5 Error message: displayed prominently in `--status-red` color
  - [ ] 6.6 Create `src/renderer/src/features/tests/components/TestErrorView.test.tsx`

- [ ] Task 7: Extend tests store with run state (AC: #1, #2, #4)
  - [ ] 7.1 Add `runState: AsyncState<{ runId: string; total: number; executed: number }>` to `useTestsStore`
  - [ ] 7.2 Add `startRun(runId: string, total: number)` action
  - [ ] 7.3 Add `completeRun()` action
  - [ ] 7.4 Update `updateTestResult()` to increment `executed` counter during active run
  - [ ] 7.5 Add `isRunning` derived boolean

- [ ] Task 8: Create useTestExecution hook (AC: #1, #2, #4)
  - [ ] 8.1 Create `src/renderer/src/features/tests/hooks/useTestExecution.ts`
  - [ ] 8.2 `executeTests(scope, specId?)`: calls `test:run` IPC, sets `runState` to loading
  - [ ] 8.3 Subscribes to `stream:test-result` for live updates (delegates to `useTestResults`)
  - [ ] 8.4 On completion: sets `runState` to success, shows toast
  - [ ] 8.5 On error: sets `runState` to error, shows error toast (persistent)
  - [ ] 8.6 Create `src/renderer/src/features/tests/hooks/useTestExecution.test.ts`

- [ ] Task 9: Implement success/failure toast notifications (AC: #4)
  - [ ] 9.1 On all tests pass: toast "X tests passés" (auto-dismiss 3s, green indicator)
  - [ ] 9.2 On some failures: toast "X passés, Y échoués" (persistent, red indicator)
  - [ ] 9.3 On test runner error: toast "Erreur d'exécution des tests" (persistent, red, with details button)
  - [ ] 9.4 Use shadcn/ui Toast component via toast system from Story 1.2

- [ ] Task 10: Integrate components into Tests pane (AC: #1, #2, #3, #4, #5)
  - [ ] 10.1 Add `TestRunButton` to Tests pane header (next to pane title)
  - [ ] 10.2 Add `TestRunProgress` below header when run is active
  - [ ] 10.3 Expand `TestErrorView` inline when a failed test is clicked in TestHierarchy
  - [ ] 10.4 Register `Cmd+Enter` keyboard shortcut for the Tests pane

- [ ] Task 11: Add test runner configuration (AC: #1)
  - [ ] 11.1 Read test runner command from `.mnm/settings.json` field `testRunner.command` (default: `npx vitest run --reporter=json`)
  - [ ] 11.2 Read test runner args from `.mnm/settings.json` field `testRunner.args`
  - [ ] 11.3 Fallback to vitest if no configuration found
  - [ ] 11.4 Log runner command at `info` level before execution

- [ ] Task 12: Update barrel export (AC: #1, #2, #3, #4)
  - [ ] 12.1 Update `src/renderer/src/features/tests/index.ts` to re-export new components and hooks

## Dev Notes

### FRs Covered

- **FR36** : L'utilisateur peut lancer l'exécution des tests associés à une spec depuis MnM

### Dependencies on Previous Stories

- **Story 7.1** (Test Discovery) — `TestInfo` type, `useTestsStore`, test-runner service skeleton, spec-mapper for test file resolution
- **Story 7.2** (Test Status) — `TestStatusBadge`, `TestSummaryBadge`, `testResults` in store, `useTestResults` streaming hook, `TestResultDetail` component
- **Story 7.3** (Bidirectional Navigation) — Navigation hooks for spec context, filtered test views
- **Story 1.1** (Project Scaffold, IPC Bridge & Event Bus) — IPC bridge, `useIpcInvoke`, `useIpcStream`, `AppError`, `AsyncState<T>`
- **Story 1.2** (Three-Pane Layout) — Tests pane structure, Toast system
- **Story 3.1** (File Watcher) — `.mnm/settings.json` reading pattern for test runner config

### IPC Channels Used

```typescript
// src/shared/ipc-channels.ts
// [Source: architecture.md#IPC-Channel-Design]

// Invoke (request-response)
'test:run': {
  args: { specId?: string; scope: 'unit' | 'integration' | 'e2e' };
  result: { runId: string };
};

// Stream (push) — already declared, used for results
'stream:test-result': {
  testId: string;
  specId: string;
  status: 'pass' | 'fail' | 'pending';
  duration: number;
  output?: string;
};
```

### Test Runner Service Implementation

```typescript
// src/main/services/test-runner/test-runner.service.ts
// [Source: architecture.md#GAP-5]

import { spawn, ChildProcess } from 'child_process';
import type { TestInfo, TestRunResult } from '@shared/types/test.types';
import type { AppError } from '@shared/types/error.types';

type TestRunnerConfig = {
  command: string;      // Default: 'npx'
  args: string[];       // Default: ['vitest', 'run', '--reporter=json']
  cwd: string;          // Project root
  timeout?: number;     // Default: 300000 (5 min)
};

type TestRunOptions = {
  scope: 'unit' | 'integration' | 'e2e';
  specId?: string;
  testId?: string;
};

/**
 * Spawns test runner as child process and streams results.
 *
 * Key design decisions:
 * - Subprocess runs in project cwd, NOT in MnM's process
 * - JSON reporter output parsed line-by-line as it streams
 * - Each parsed result emitted as 'test:result' event on the event bus
 * - IPC streams layer forwards events to renderer
 * - Process is non-blocking: uses child_process.spawn (not execSync)
 *
 * Error handling:
 * - Test runner not found: AppError code 'TEST_RUNNER_NOT_FOUND'
 * - Process crash: AppError code 'TEST_RUNNER_CRASH'
 * - Timeout: AppError code 'TEST_RUNNER_TIMEOUT'
 */
export class TestRunnerService {
  private activeProcess: ChildProcess | null = null;
  private config: TestRunnerConfig;

  constructor(config: TestRunnerConfig) {
    this.config = config;
  }

  async runTests(options: TestRunOptions): Promise<string> {
    // Generate runId
    const runId = crypto.randomUUID();

    // Build command args based on scope and filters
    const args = this.buildArgs(options);

    // Spawn child process (non-blocking)
    this.activeProcess = spawn(this.config.command, args, {
      cwd: this.config.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    // Parse stdout as JSON results stream
    // Emit events via event bus for each result
    // Handle exit/error events

    return runId;
  }

  cancelRun(): void {
    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM');
      // SIGKILL after 5s timeout if not exited
    }
  }

  private buildArgs(options: TestRunOptions): string[] {
    const args = [...this.config.args];

    // Add scope-based filtering
    if (options.specId) {
      // Use spec-mapper to resolve test file paths
      // Add file paths as vitest arguments
    }

    return args;
  }
}
```

### Test Output Parser

```typescript
// src/main/services/test-runner/test-output-parser.ts

import type { TestRunResult } from '@shared/types/test.types';

/**
 * Parses vitest JSON reporter output into TestRunResult objects.
 *
 * Vitest JSON output format (--reporter=json):
 * {
 *   "testResults": [{
 *     "name": "test name",
 *     "status": "passed" | "failed" | "skipped",
 *     "duration": 123,
 *     "assertionResults": [{
 *       "fullName": "describe > test name",
 *       "status": "passed" | "failed",
 *       "duration": 45,
 *       "failureMessages": ["Error: expected..."]
 *     }]
 *   }]
 * }
 *
 * Handles:
 * - Complete JSON output (post-execution)
 * - Partial/streaming output (line-by-line parsing)
 * - Malformed output (returns AppError)
 */
export function parseVitestOutput(output: string): TestRunResult[];

export function parseVitestLine(line: string): TestRunResult | null;

// Map vitest status to our status
function mapStatus(vitestStatus: string): 'pass' | 'fail' | 'pending' {
  switch (vitestStatus) {
    case 'passed': return 'pass';
    case 'failed': return 'fail';
    case 'skipped':
    case 'pending':
    case 'todo':
    default: return 'pending';
  }
}
```

### TestRunButton Component

```typescript
// src/renderer/src/features/tests/components/TestRunButton.tsx

type TestRunButtonProps = {
  onRun: (scope: 'unit' | 'integration' | 'e2e', specId?: string) => void;
  isRunning: boolean;
  currentSpecId?: string;
};

/**
 * Primary action button for test execution.
 *
 * States:
 * - idle: "Lancer les tests" (primary button, accent background)
 * - running: "En cours..." (disabled, spinner icon)
 * - complete: re-enables to idle
 *
 * Dropdown menu for scope:
 * - "Tous les tests" -> scope: all scopes
 * - "Tests de cette spec" -> scope based on navigation level
 * - "Ce test uniquement" -> scope: single test (if test selected)
 *
 * Keyboard: Cmd+Enter (macOS) / Ctrl+Enter (Linux/Windows)
 *
 * Accessibility:
 * - aria-label: "Lancer les tests" | "Tests en cours d'exécution"
 * - aria-disabled when running
 * - Dropdown keyboard navigable
 */
```

### TestRunProgress Component

```typescript
// src/renderer/src/features/tests/components/TestRunProgress.tsx

type TestRunProgressProps = {
  executed: number;
  total: number;
  pass: number;
  fail: number;
};

/**
 * Progress indicator during test execution.
 *
 * +------------------------------------------+
 * | [=========>               ] 12 / 25      |
 * | 10 pass  2 fail                          |
 * +------------------------------------------+
 *
 * Bar segments:
 * - Green fill: pass proportion
 * - Red fill: fail proportion
 * - Gray remaining: pending/not yet run
 *
 * Animations:
 * - Width: transition 300ms ease-out
 * - Counter: transition 300ms
 * - Respects prefers-reduced-motion
 *
 * ARIA:
 * - role="progressbar"
 * - aria-valuenow={executed}
 * - aria-valuemax={total}
 * - aria-label="Progression des tests : {executed} sur {total}"
 */
```

### TestErrorView Component

```typescript
// src/renderer/src/features/tests/components/TestErrorView.tsx

import type { TestInfo, TestRunResult } from '@shared/types/test.types';

type TestErrorViewProps = {
  testInfo: TestInfo;
  result: TestRunResult;
  onFileClick: (filePath: string, line: number) => void;
};

/**
 * Detailed error display for a failed test.
 *
 * +-----------------------------------------+
 * | [X] spec-mapper.test.ts          0.8s   |
 * | src/main/services/test-runner/           |
 * |   spec-mapper.test.ts:42 (click)       |
 * |                                          |
 * | Error:                                   |
 * | AssertionError: expected 3 to be 4       |
 * |                                          |
 * | [v] Stack Trace                          |
 * | |  at Object.<anonymous>                 |
 * | |    (/src/main/services/test-runner/    |
 * | |     spec-mapper.test.ts:42:10)         |
 * +-----------------------------------------+
 *
 * - File path is clickable -> emits nav:open-file event
 * - Stack trace in monospace (JetBrains Mono)
 * - Stack trace collapsible (collapsed by default if > 5 lines)
 * - Error message in --status-red
 */
```

### Store Extension for Run State

```typescript
// Extension to src/renderer/src/features/tests/tests.store.ts
// [Source: architecture.md#Communication-Patterns]

type TestRunState = {
  runId: string;
  total: number;
  executed: number;
  startTime: number;
};

// Add to TestsState:
type TestsState = {
  // ... existing from Story 7.1 + 7.2
  runState: AsyncState<TestRunState>;
  isRunning: boolean;                      // Derived from runState.status === 'loading'
  startRun: (runId: string, total: number) => void;
  incrementExecuted: () => void;
  completeRun: () => void;
  failRun: (error: AppError) => void;
};

// startRun action:
// set({ runState: { status: 'loading', data: { runId, total, executed: 0, startTime: Date.now() } } })

// completeRun action:
// set((state) => ({
//   runState: { status: 'success', data: state.runState.status === 'loading' ? state.runState.data : undefined }
// }))
```

### useTestExecution Hook

```typescript
// src/renderer/src/features/tests/hooks/useTestExecution.ts

import { useCallback } from 'react';
import { useTestsStore } from '../tests.store';
import type { AppError } from '@shared/types/error.types';

type TestExecution = {
  executeTests: (scope: 'unit' | 'integration' | 'e2e', specId?: string) => Promise<void>;
  cancelTests: () => void;
  isRunning: boolean;
  progress: { executed: number; total: number } | null;
};

/**
 * Orchestrates test execution from the renderer:
 *
 * 1. Calls test:run IPC invoke -> gets runId
 * 2. Sets store runState to loading
 * 3. stream:test-result events update results + increment executed counter
 * 4. On completion: set runState to success, show toast
 * 5. On error: set runState to error, show error toast
 *
 * Toast patterns:
 * - All pass: "X tests passés" (auto-dismiss 3s, green)
 * - Some fail: "X passés, Y échoués" (persistent, red)
 * - Runner error: "Erreur d'exécution des tests" (persistent, red, details)
 */
export function useTestExecution(): TestExecution {
  const startRun = useTestsStore((s) => s.startRun);
  const completeRun = useTestsStore((s) => s.completeRun);
  const failRun = useTestsStore((s) => s.failRun);
  const isRunning = useTestsStore((s) => s.isRunning);
  const runState = useTestsStore((s) => s.runState);

  const executeTests = useCallback(
    async (scope: 'unit' | 'integration' | 'e2e', specId?: string) => {
      try {
        const { runId } = await window.electronAPI.invoke('test:run', { scope, specId });
        // Total count comes from test:list (already in store)
        const total = /* get from store */ 0;
        startRun(runId, total);
        // Results arrive via stream:test-result (handled by useTestResults)
      } catch (error) {
        failRun(error as AppError);
      }
    },
    [startRun, failRun]
  );

  const cancelTests = useCallback(() => {
    // Could invoke a test:cancel IPC if needed
    completeRun();
  }, [completeRun]);

  const progress = runState.status === 'loading'
    ? { executed: runState.data?.executed ?? 0, total: runState.data?.total ?? 0 }
    : null;

  return { executeTests, cancelTests, isRunning, progress };
}
```

### Settings Configuration

```json
// .mnm/settings.json — testRunner section
{
  "testRunner": {
    "command": "npx",
    "args": ["vitest", "run", "--reporter=json"],
    "timeout": 300000
  }
}
```

### Keyboard Shortcut Registration

```typescript
// Register Cmd+Enter for test execution in Tests pane
// [Source: ux-design-specification.md#Keyboard-Shortcuts]

// In Tests pane component:
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      // Only trigger if Tests pane is focused
      if (isTestsPaneFocused) {
        executeTests(currentScope, currentSpecId);
      }
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [executeTests, currentScope, currentSpecId, isTestsPaneFocused]);
```

### Non-Blocking Execution (NFR6)

```typescript
/**
 * CRITICAL: Test execution MUST NOT block the UI thread.
 *
 * Guarantees:
 * 1. child_process.spawn() is async — does not block main process event loop
 * 2. stdout parsing uses stream events (data/end) — not synchronous read
 * 3. IPC streams use webContents.send() — non-blocking fire-and-forget
 * 4. Zustand updates are synchronous but < 1ms per update
 * 5. React re-renders are batched by React 19 automatic batching
 *
 * Test: With 3 agents running + test execution:
 * - UI thread blocked < 100ms (NFR6)
 * - Agent streams continue normally
 */
```

### Project File Structure (Story 7.4 scope)

```
src/
  main/
    services/
      test-runner/
        test-runner.service.ts           # EXTENDED: runTests(), cancelRun()
        test-runner.service.test.ts       # EXTENDED: execution tests
        test-output-parser.ts            # NEW: vitest JSON output parser
        test-output-parser.test.ts
    ipc/
      handlers.ts                        # UPDATED: add test:run handler
  renderer/
    src/
      features/
        tests/
          components/
            TestRunButton.tsx             # Run action button with scope dropdown
            TestRunButton.test.tsx
            TestRunProgress.tsx            # Progress bar during execution
            TestRunProgress.test.tsx
            TestErrorView.tsx             # Failed test detail with stack trace
            TestErrorView.test.tsx
            TestHierarchy.tsx              # UPDATED: integrate run button, progress, errors
          hooks/
            useTestExecution.ts           # Orchestrates test:run + results
            useTestExecution.test.ts
          tests.store.ts                  # UPDATED: add runState, run actions
          index.ts                        # UPDATED: re-export new components/hooks
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Service extension | kebab-case + `.service.ts` | `test-runner.service.ts` |
| Parser | kebab-case + `.ts` | `test-output-parser.ts` |
| Components | PascalCase + `.tsx` | `TestRunButton.tsx`, `TestRunProgress.tsx` |
| Hooks | camelCase, prefix `use` | `useTestExecution.ts` |
| IPC channels | `namespace:action` | `test:run` |
| Stream channels | `stream:namespace-action` | `stream:test-result` |
| AppError codes | UPPER_SNAKE_CASE | `TEST_RUNNER_NOT_FOUND`, `TEST_RUNNER_CRASH` |
| Settings keys | camelCase nested | `testRunner.command`, `testRunner.args` |

### Testing Strategy

- **Unit tests for test-runner.service (execution)**: mock child_process.spawn, verify correct args for each scope, verify event emission for results, verify error handling (not found, crash, timeout)
- **Unit tests for test-output-parser**: parse complete vitest JSON output, parse malformed output, parse individual lines, verify status mapping (passed->pass, failed->fail, skipped->pending)
- **Unit tests for TestRunButton**: render idle/running states, click triggers execution, dropdown scope selection, keyboard shortcut
- **Unit tests for TestRunProgress**: render progress bar with various values, verify ARIA attributes, animation classes
- **Unit tests for TestErrorView**: render error detail, clickable file path, collapsible stack trace
- **Unit tests for useTestExecution**: mock IPC invoke, verify store state transitions (idle -> loading -> success/error), toast triggers
- **Integration test**: full round-trip test:run IPC -> subprocess -> stream:test-result -> UI update
- **Performance test**: verify UI responsiveness during test execution with mock agent activity (NFR6)
- **Accessibility**: ARIA progressbar, keyboard shortcut discoverability, focus management

### What NOT to Do

- Do NOT use `child_process.execSync` or any synchronous process execution — always use `spawn` with streaming
- Do NOT block the main process event loop while waiting for test results
- Do NOT hardcode vitest as the only test runner — read from `.mnm/settings.json`
- Do NOT parse test output with regex alone — use the JSON reporter format for structured parsing
- Do NOT show raw test output in the UI — always parse and format it
- Do NOT use `any` for parsed test output — define strict types
- Do NOT use `export default`
- Do NOT create a new IPC channel for cancellation at this point — use process.kill via the existing service
- Do NOT show more than 3 toasts simultaneously (max toast stack rule)
- Do NOT create popup modals for test results — use inline expansion in the Tests pane

### References

- [Source: architecture.md#GAP-5] — Test Runner Service + spec-mapper resolution
- [Source: architecture.md#IPC-Channel-Design] — `test:run`, `stream:test-result` channel definitions
- [Source: architecture.md#Process-Patterns] — Error handling per layer, `AppError` normalization
- [Source: architecture.md#Format-Patterns] — `AsyncState<T>` for run state
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern
- [Source: architecture.md#Local-Data-Persistence] — `.mnm/settings.json` for test runner config
- [Source: ux-design-specification.md#Feedback-Patterns] — Toast auto-dismiss 3s (success), persistent (errors)
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Progress bar 300ms ease-out, counter 300ms
- [Source: ux-design-specification.md#Keyboard-Shortcuts] — `Cmd+Enter` for primary action
- [Source: ux-design-specification.md#Accessibility-Strategy] — ARIA progressbar, reduced motion
- [Source: ux-design-specification.md#Button-Hierarchy] — Primary button for run action
- [Source: epics.md#Story-7.4] — Original acceptance criteria
- NFR6: UI thread < 100ms blocked during concurrent agents + test execution

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
