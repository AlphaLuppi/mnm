# Story 7.2: Statut des Tests (Pass/Fail/Pending)

Status: ready-for-dev

## Story

As a **user**,
I want **to see the status of each test (pass/fail/pending) with visual indicators**,
So that **I know immediately which tests are green and which need attention**.

## Acceptance Criteria

### AC1 — Badge de statut par test

**Given** des tests existent dans la hiérarchie
**When** je regarde la liste des tests
**Then** chaque test affiche un badge de statut : vert (pass), rouge (fail), gris (pending/not run) (FR34)

### AC2 — Détail du test en échec

**Given** un test a échoué
**When** je regarde le badge rouge
**Then** je vois le nom du test, et un clic ouvre le détail avec le message d'erreur

### AC3 — Mise à jour en temps réel via streaming

**Given** des tests sont en cours d'exécution
**When** les résultats arrivent via `stream:test-result`
**Then** les badges se mettent à jour en temps réel (fade 200ms)
**And** les compteurs pass/fail se mettent à jour avec animation (300ms)

### AC4 — Statut agrégé par niveau hiérarchique

**Given** je regarde un niveau de la hiérarchie (ex: Story)
**When** des tests enfants ont des statuts mixtes
**Then** le niveau parent affiche un résumé agrégé : "5 pass, 2 fail, 1 pending"
**And** l'indicateur du parent est rouge si au moins un test fail

## Tasks / Subtasks

- [ ] Task 1: Create TestStatusBadge component (AC: #1)
  - [ ] 1.1 Create `src/renderer/src/features/tests/components/TestStatusBadge.tsx`
  - [ ] 1.2 Implement 3 states: `pass` (green circle + checkmark icon), `fail` (red circle + X icon), `pending` (gray circle + clock icon)
  - [ ] 1.3 Support 2 sizes: `sm` (16px, for inline lists) and `md` (24px, for headers)
  - [ ] 1.4 Add `aria-label` with status text ("Test réussi", "Test échoué", "Test en attente")
  - [ ] 1.5 Color tokens: `--status-green` (#22c55e), `--status-red` (#ef4444), `--status-gray` (#6b7280)
  - [ ] 1.6 Create `src/renderer/src/features/tests/components/TestStatusBadge.test.tsx`

- [ ] Task 2: Create TestResultDetail component (AC: #2)
  - [ ] 2.1 Create `src/renderer/src/features/tests/components/TestResultDetail.tsx`
  - [ ] 2.2 Display: test name, file path, status badge, duration, error message (if fail)
  - [ ] 2.3 Error output rendered in monospace (`font-mono`) with syntax highlighting for stack traces
  - [ ] 2.4 Collapsible error detail section (collapsed by default for long outputs)
  - [ ] 2.5 Create `src/renderer/src/features/tests/components/TestResultDetail.test.tsx`

- [ ] Task 3: Create TestSummaryBadge component for aggregate status (AC: #4)
  - [ ] 3.1 Create `src/renderer/src/features/tests/components/TestSummaryBadge.tsx`
  - [ ] 3.2 Display format: "5 pass, 2 fail, 1 pending" with colored counts
  - [ ] 3.3 Overall indicator: red if any fail, green if all pass, gray if all pending
  - [ ] 3.4 Compact mode: just the icon + total count for narrow spaces
  - [ ] 3.5 Create `src/renderer/src/features/tests/components/TestSummaryBadge.test.tsx`

- [ ] Task 4: Extend tests store with test results (AC: #1, #3, #4)
  - [ ] 4.1 Add `testResults: Map<string, TestRunResult>` to `useTestsStore`
  - [ ] 4.2 Add `updateTestResult(result: TestRunResult)` action
  - [ ] 4.3 Add `getAggregateStatus(nodeId: string)` derived selector computing pass/fail/pending counts
  - [ ] 4.4 Add `resultState: AsyncState<void>` for tracking active test run state

- [ ] Task 5: Create useTestResults hook for streaming (AC: #3)
  - [ ] 5.1 Create `src/renderer/src/features/tests/hooks/useTestResults.ts`
  - [ ] 5.2 Subscribe to `stream:test-result` IPC stream
  - [ ] 5.3 On each result, call `updateTestResult()` in store
  - [ ] 5.4 Propagate aggregate status changes up the hierarchy tree
  - [ ] 5.5 Create `src/renderer/src/features/tests/hooks/useTestResults.test.ts`

- [ ] Task 6: Integrate badges into TestHierarchy (AC: #1, #4)
  - [ ] 6.1 Update `TestHierarchy.tsx` to render `TestStatusBadge` next to each leaf test
  - [ ] 6.2 Render `TestSummaryBadge` next to each parent node (epic, story, task)
  - [ ] 6.3 Add click handler on failed test badges to expand `TestResultDetail` inline

- [ ] Task 7: Implement real-time update animations (AC: #3)
  - [ ] 7.1 Badge status change: CSS transition `opacity 200ms ease-in-out` (fade)
  - [ ] 7.2 Counter update: CSS transition `transform 300ms ease-out` (number animation)
  - [ ] 7.3 Respect `prefers-reduced-motion`: replace animations with instant transitions
  - [ ] 7.4 Add `aria-live="polite"` on summary counters for screen reader updates

- [ ] Task 8: Update barrel export (AC: #1, #2, #3, #4)
  - [ ] 8.1 Update `src/renderer/src/features/tests/index.ts` to re-export new components and hooks

## Dev Notes

### FRs Covered

- **FR34** : L'utilisateur peut voir le statut de chaque test (pass/fail/pending)

### Dependencies on Previous Stories

- **Story 7.1** (Test Discovery) — `TestInfo` type, `useTestsStore`, `TestHierarchy` component, test hierarchy data structure
- **Story 1.1** (Project Scaffold, IPC Bridge & Event Bus) — `useIpcStream` hook, shared types, event bus
- **Story 1.2** (Three-Pane Layout) — Tests pane where TestHierarchy is rendered

### TestStatusBadge Component

```typescript
// src/renderer/src/features/tests/components/TestStatusBadge.tsx
// [Source: ux-design-specification.md#Component-Strategy] — Phase 3 component

import type { TestRunResult } from '@shared/types/test.types';

type TestStatus = 'pass' | 'fail' | 'pending';

type TestStatusBadgeProps = {
  status: TestStatus;
  size?: 'sm' | 'md';
};

/**
 * Visual indicator for test status:
 *
 * - pass:    green circle + checkmark  (--status-green #22c55e)
 * - fail:    red circle + X            (--status-red #ef4444)
 * - pending: gray circle + clock       (--status-gray #6b7280)
 *
 * Size:
 * - sm: 16px (inline in test lists)
 * - md: 24px (in headers, summary views)
 *
 * Accessibility:
 * - aria-label: "Test réussi" | "Test échoué" | "Test en attente"
 * - Status is NOT conveyed by color alone: icon shape differentiates states
 *
 * Animation:
 * - Status transition: opacity fade 200ms
 * - Respects prefers-reduced-motion
 */
```

### TestSummaryBadge for Aggregate Status

```typescript
// src/renderer/src/features/tests/components/TestSummaryBadge.tsx

type TestSummaryBadgeProps = {
  pass: number;
  fail: number;
  pending: number;
  compact?: boolean;   // true = icon + total count only
};

/**
 * Aggregate status indicator for hierarchy nodes:
 *
 * Full mode:  "5 pass, 2 fail, 1 pending"
 *             Each count colored: green/red/gray
 *
 * Compact:    [red icon] 8
 *
 * Overall indicator logic:
 * - ANY fail -> red indicator
 * - ALL pass -> green indicator
 * - ALL pending -> gray indicator
 * - Mixed pass+pending (no fail) -> green indicator
 *
 * Animation:
 * - Counter transitions: 300ms ease-out (number animation)
 * - aria-live="polite" for screen reader updates
 */
```

### TestResultDetail for Failed Tests

```typescript
// src/renderer/src/features/tests/components/TestResultDetail.tsx

type TestResultDetailProps = {
  testInfo: TestInfo;
  result: TestRunResult;
  onClose: () => void;
};

/**
 * Expanded detail view for a test result (especially failures):
 *
 * +-----------------------------------------+
 * | [X badge] test-name.test.ts      1.2s   |
 * | src/main/services/spec-mapper.test.ts    |
 * |                                          |
 * | [v] Error Output                        |
 * | | AssertionError: expected 3 to be 4    |
 * | |   at Object.<anonymous> (line 42)     |
 * | |   at processTicksAndRejections        |
 * +-----------------------------------------+
 *
 * - Error output in monospace (font-mono / JetBrains Mono)
 * - Collapsible for long stack traces
 * - Click on file path -> could navigate to source (deferred to Story 7.3)
 */
```

### Store Extension for Test Results

```typescript
// Extension to src/renderer/src/features/tests/tests.store.ts
// [Source: architecture.md#Communication-Patterns]

import type { TestRunResult } from '@shared/types/test.types';

// Add to TestsState:
type TestsState = {
  // ... existing from Story 7.1
  testResults: Map<string, TestRunResult>;
  resultState: AsyncState<void>;
  updateTestResult: (result: TestRunResult) => void;
  clearResults: () => void;
  getAggregateStatus: (testIds: string[]) => {
    pass: number;
    fail: number;
    pending: number;
  };
};

// updateTestResult action:
// set((state) => {
//   const next = new Map(state.testResults);
//   next.set(result.testId, result);
//   return { testResults: next };
// })
```

### useTestResults Streaming Hook

```typescript
// src/renderer/src/features/tests/hooks/useTestResults.ts
// [Source: architecture.md#IPC-Channel-Design] — stream:test-result

import { useCallback } from 'react';
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream';
import { useTestsStore } from '../tests.store';

/**
 * Subscribes to stream:test-result and updates the store.
 *
 * Each incoming result:
 * 1. Updates testResults Map in store
 * 2. Triggers re-computation of aggregate status for parent nodes
 * 3. Badge re-renders via Zustand reactivity
 *
 * Stream payload:
 * { testId: string; specId: string; status: 'pass' | 'fail' | 'pending'; duration: number; output?: string }
 */
export function useTestResults(): void {
  const updateTestResult = useTestsStore((s) => s.updateTestResult);

  const handleResult = useCallback(
    (data: { testId: string; specId: string; status: 'pass' | 'fail' | 'pending'; duration: number; output?: string }) => {
      updateTestResult({
        testId: data.testId,
        status: data.status,
        duration: data.duration,
        output: data.output,
      });
    },
    [updateTestResult]
  );

  useIpcStream('stream:test-result', handleResult);
}
```

### Animation CSS Patterns

```css
/* Status badge transition */
.test-status-badge {
  transition: opacity 200ms ease-in-out;
}

/* Counter number animation */
.test-counter {
  transition: transform 300ms ease-out;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .test-status-badge,
  .test-counter {
    transition: none;
  }
}
```

### Color Tokens Used

| Token | Value | Usage |
|---|---|---|
| `--status-green` | `#22c55e` | Pass status — badge, text, indicator |
| `--status-red` | `#ef4444` | Fail status — badge, text, indicator |
| `--status-gray` | `#6b7280` | Pending/not run — badge, text, indicator |
| `--bg-surface` | `#141416` | TestResultDetail background |
| `--text-primary` | `#fafafa` | Test name, error text |
| `--text-muted` | `#71717a` | File path, duration |
| `--font-mono` | `JetBrains Mono` | Error output, stack traces |

[Source: ux-design-specification.md#Color-System]

### Project File Structure (Story 7.2 scope)

```
src/
  renderer/
    src/
      features/
        tests/
          components/
            TestStatusBadge.tsx          # Per-test status indicator
            TestStatusBadge.test.tsx
            TestResultDetail.tsx         # Expanded fail detail view
            TestResultDetail.test.tsx
            TestSummaryBadge.tsx          # Aggregate status for hierarchy nodes
            TestSummaryBadge.test.tsx
            TestHierarchy.tsx             # UPDATED: integrate badges
          hooks/
            useTestResults.ts            # Stream subscription for results
            useTestResults.test.ts
          tests.store.ts                 # UPDATED: add testResults, aggregate selectors
          index.ts                       # UPDATED: re-export new components
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Status badge | PascalCase + `.tsx` | `TestStatusBadge.tsx` |
| Summary badge | PascalCase + `.tsx` | `TestSummaryBadge.tsx` |
| Result detail | PascalCase + `.tsx` | `TestResultDetail.tsx` |
| Hook | camelCase, prefix `use` | `useTestResults.ts` |
| Test files | same name + `.test.ts(x)` | `TestStatusBadge.test.tsx` |
| CSS classes | kebab-case | `test-status-badge`, `test-counter` |

### Testing Strategy

- **Unit tests for TestStatusBadge**: render all 3 states (pass/fail/pending), verify correct colors, icons, aria-labels, both sizes
- **Unit tests for TestSummaryBadge**: verify aggregate logic (any fail = red, all pass = green), compact vs full mode, counter display
- **Unit tests for TestResultDetail**: render with pass/fail results, expandable error section, monospace formatting
- **Unit tests for useTestResults hook**: mock `stream:test-result`, verify store updates, aggregate propagation
- **Accessibility tests**: `aria-label` on badges, `aria-live` on counters, keyboard focusable detail expansion
- **Animation tests**: verify `prefers-reduced-motion` disables transitions (via matchMedia mock)

### What NOT to Do

- Do NOT implement test execution (run button, progress bar) — that is Story 7.4
- Do NOT implement navigation from test to spec or spec to test — that is Story 7.3
- Do NOT poll for test results — use streaming only via `stream:test-result`
- Do NOT use color alone to convey status — always include an icon shape (checkmark, X, clock)
- Do NOT use `any` for stream payloads — type fully against `IpcStreamChannels`
- Do NOT use `export default`
- Do NOT create popup modals for test detail — use inline expansion within the hierarchy tree
- Do NOT animate if `prefers-reduced-motion` is set

### References

- [Source: architecture.md#GAP-5] — TestRunResult type definition
- [Source: architecture.md#IPC-Channel-Design] — `stream:test-result` payload definition
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, selectors
- [Source: architecture.md#Format-Patterns] — `AsyncState<T>` for result state
- [Source: ux-design-specification.md#Color-System] — Status color tokens
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Badge fade 200ms, counter animation 300ms
- [Source: ux-design-specification.md#Accessibility-Strategy] — WCAG AA, aria-live, prefers-reduced-motion
- [Source: ux-design-specification.md#Component-Strategy] — TestStatusBadge in Phase 3
- [Source: ux-design-specification.md#Design-Direction-Decision] — Volet validation: TestStatusBadge agrégé
- [Source: epics.md#Story-7.2] — Original acceptance criteria

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
