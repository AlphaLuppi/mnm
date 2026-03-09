# Story 7.1: Test Discovery & Hiérarchie en Miroir des Specs

Status: ready-for-dev

## Story

As a **user**,
I want **to see tests organized as a mirror of the spec hierarchy (task -> unit, story -> grouped units, epic -> integration, project -> e2e)**,
So that **I can understand test coverage at each level of my project**.

## Acceptance Criteria

### AC1 — Test Discovery via spec-mapper

**Given** un projet est ouvert
**When** MnM scanne les fichiers de test du projet
**Then** les tests sont découverts via `test:list` IPC et le `spec-mapper.ts` les associe aux specs par convention de nommage (FR33)

### AC2 — Hiérarchie en miroir dans le volet Tests

**Given** les tests sont découverts
**When** je regarde le volet Tests
**Then** la hiérarchie affiche : Projet (e2e) -> Epic (intégration) -> Story (unitaires groupés) -> Tâche (unitaires) (FR33)
**And** chaque niveau affiche le nombre de tests et un résumé de couverture

### AC3 — Empty state pour specs sans tests

**Given** une spec n'a aucun test associé
**When** je regarde son niveau dans la hiérarchie
**Then** un indicateur "Pas de tests" s'affiche (empty state avec icône)

### AC4 — Mise à jour automatique sur changement de fichiers

**Given** les fichiers de test changent
**When** le file watcher détecte une modification
**Then** la hiérarchie est mise à jour automatiquement

## Tasks / Subtasks

- [ ] Task 1: Create shared test types (AC: #1, #2)
  - [ ] 1.1 Create `src/shared/types/test.types.ts` with `TestInfo`, `TestRunResult`, `TestScope`, `TestHierarchyNode` types
  - [ ] 1.2 Add `test:list` channel definition in `src/shared/ipc-channels.ts` if not already present
  - [ ] 1.3 Add `stream:test-result` channel definition in `src/shared/ipc-channels.ts` if not already present

- [ ] Task 2: Implement spec-mapper service (AC: #1)
  - [ ] 2.1 Create `src/main/services/test-runner/spec-mapper.ts` with `mapSpecsToTests()` function
  - [ ] 2.2 Implement convention-based matching: test file named after spec ID (e.g., `FR33.test.ts`, `story-7-1.test.ts`)
  - [ ] 2.3 Support file extensions: `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`
  - [ ] 2.4 Support directory-based grouping: `__tests__/` directories mirroring spec structure
  - [ ] 2.5 Create `src/main/services/test-runner/spec-mapper.test.ts` with unit tests

- [ ] Task 3: Implement test-runner.types.ts (AC: #1)
  - [ ] 3.1 Create `src/main/services/test-runner/test-runner.types.ts` with internal service types
  - [ ] 3.2 Define `TestDiscoveryResult`, `SpecTestMapping`, `TestFileInfo` types

- [ ] Task 4: Implement test discovery in test-runner service (AC: #1, #4)
  - [ ] 4.1 Create `src/main/services/test-runner/test-runner.service.ts` with `discoverTests()` method
  - [ ] 4.2 Scan project directory for test files by convention (`.test.ts`, `.spec.ts`, `.test.tsx`, `.spec.tsx`)
  - [ ] 4.3 Use spec-mapper to associate discovered tests with specs
  - [ ] 4.4 Classify tests by scope: unit (task-level), integration (epic-level), e2e (project-level)
  - [ ] 4.5 Create `src/main/services/test-runner/test-runner.service.test.ts` with unit tests

- [ ] Task 5: Implement `test:list` IPC handler (AC: #1)
  - [ ] 5.1 Add `test:list` handler in `src/main/ipc/handlers.ts`
  - [ ] 5.2 Handler calls `testRunnerService.discoverTests()` with optional `specId` filter
  - [ ] 5.3 Return `TestInfo[]` with spec association metadata

- [ ] Task 6: Build test hierarchy data structure (AC: #2)
  - [ ] 6.1 Create `src/renderer/src/features/tests/hooks/useTestHierarchy.ts` to transform flat `TestInfo[]` into tree
  - [ ] 6.2 Build hierarchy: Project (e2e) -> Epic (integration) -> Story (unit groups) -> Task (unit)
  - [ ] 6.3 Compute count and coverage summary per hierarchy node
  - [ ] 6.4 Create `src/renderer/src/features/tests/hooks/useTestHierarchy.test.ts`

- [ ] Task 7: Create TestHierarchy component (AC: #2, #3)
  - [ ] 7.1 Create `src/renderer/src/features/tests/components/TestHierarchy.tsx` with tree rendering
  - [ ] 7.2 Each tree node displays: name, test count, coverage summary badge
  - [ ] 7.3 Collapsible nodes with expand/collapse toggle
  - [ ] 7.4 Implement empty state for nodes with no tests (icon + "Pas de tests" message)
  - [ ] 7.5 Create `src/renderer/src/features/tests/components/TestHierarchy.test.tsx`

- [ ] Task 8: Create tests Zustand store (AC: #1, #2, #4)
  - [ ] 8.1 Create `src/renderer/src/features/tests/tests.store.ts` with `useTestsStore`
  - [ ] 8.2 Store holds: `tests: Map<string, TestInfo>`, `hierarchy: TestHierarchyNode`, `discoveryState: AsyncState<TestInfo[]>`
  - [ ] 8.3 Actions: `loadTests()`, `updateTest()`, `refreshHierarchy()`

- [ ] Task 9: Wire file watcher to test re-discovery (AC: #4)
  - [ ] 9.1 Create `src/renderer/src/features/tests/hooks/useTestDiscovery.ts`
  - [ ] 9.2 Listen to `stream:file-change` events for test file patterns (`.test.ts`, `.spec.ts`)
  - [ ] 9.3 On matching file change, trigger `test:list` re-invoke and update store
  - [ ] 9.4 Debounce re-discovery with 500ms delay to batch rapid changes

- [ ] Task 10: Create feature barrel export (AC: #1, #2, #3, #4)
  - [ ] 10.1 Create `src/renderer/src/features/tests/index.ts` re-exporting public API

## Dev Notes

### FRs Covered

- **FR33** : L'utilisateur peut voir les tests organisés en miroir de la hiérarchie des specs (tâche -> unitaires, story -> unitaires groupés, epic -> intégration, projet -> e2e)

### Dependencies on Previous Stories

- **Story 1.1** (Project Scaffold, IPC Bridge & Event Bus) — IPC bridge, event bus, shared types infrastructure, `useIpcInvoke`, `useIpcStream` hooks
- **Story 1.3** (Open Project & BMAD Detection) — Project loaded state, BMAD structure detection for spec hierarchy
- **Story 1.4** (Hierarchical Navigation & Pane Synchronization) — Navigation store for hierarchy level context, pane sync mechanism
- **Story 3.1** (File Watcher & Git Integration) — `stream:file-change` events for auto-refresh

### Shared Types Definition

```typescript
// src/shared/types/test.types.ts
// [Source: architecture.md#GAP-5]

export type TestScope = 'unit' | 'integration' | 'e2e';

export type TestInfo = {
  id: string;
  name: string;
  filePath: string;
  specId?: string;       // ID de la spec BMAD associée (convention-based)
  scope: TestScope;
};

export type TestRunResult = {
  testId: string;
  status: 'pass' | 'fail' | 'pending';
  duration: number;
  output?: string;       // Sortie de test en cas d'échec
};

export type TestHierarchyNode = {
  id: string;
  label: string;
  level: 'project' | 'epic' | 'story' | 'task';
  specId?: string;
  scope: TestScope;
  tests: TestInfo[];
  children: TestHierarchyNode[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    pending: number;
  };
};
```

### IPC Channels Used

```typescript
// Already declared in src/shared/ipc-channels.ts
// [Source: architecture.md#IPC-Channel-Design]

// Invoke (request-response)
'test:list': { args: { specId?: string }; result: TestInfo[] };

// Stream (push)
'stream:test-result': { testId: string; specId: string; status: 'pass' | 'fail' | 'pending'; duration: number; output?: string };
'stream:file-change': { path: string; type: 'create' | 'modify' | 'delete'; agentId?: string };
```

### Spec-Mapper Convention

The `spec-mapper.ts` maps spec files to test files using convention-based matching. The conventions are:

```typescript
// src/main/services/test-runner/spec-mapper.ts
// [Source: architecture.md#GAP-5]

/**
 * Convention-based mapping spec -> tests:
 *
 * 1. Filename match: spec ID in test filename
 *    - Spec "story-7-1" -> `story-7-1.test.ts`, `story-7-1.spec.ts`
 *    - Spec "FR33" -> `FR33.test.ts`
 *
 * 2. Directory structure match:
 *    - Spec at epic level -> tests in `__tests__/integration/epic-7/`
 *    - Spec at story level -> tests in `__tests__/unit/story-7-1/`
 *    - Project root -> tests in `e2e/`
 *
 * 3. Scope inference from location:
 *    - Files in `e2e/` -> scope: 'e2e'
 *    - Files in `__tests__/integration/` or containing `.integration.` -> scope: 'integration'
 *    - All other test files -> scope: 'unit'
 */

export type SpecTestMapping = {
  specId: string;
  specLevel: 'project' | 'epic' | 'story' | 'task';
  testFiles: string[];
};

export function mapSpecsToTests(
  specIds: string[],
  testFiles: string[],
  projectRoot: string
): SpecTestMapping[];

export function inferTestScope(filePath: string): TestScope;

export function discoverTestFiles(projectRoot: string): Promise<string[]>;
```

### Zustand Store Pattern

```typescript
// src/renderer/src/features/tests/tests.store.ts
// [Source: architecture.md#Communication-Patterns]

import { create } from 'zustand';
import type { TestInfo, TestHierarchyNode } from '@shared/types/test.types';
import type { AsyncState } from '@shared/types/async-state.types';

type TestsState = {
  tests: Map<string, TestInfo>;
  hierarchy: TestHierarchyNode | null;
  discoveryState: AsyncState<TestInfo[]>;
  loadTests: (specId?: string) => Promise<void>;
  updateTest: (testId: string, update: Partial<TestInfo>) => void;
  refreshHierarchy: () => void;
};

export const useTestsStore = create<TestsState>((set, get) => ({
  tests: new Map(),
  hierarchy: null,
  discoveryState: { status: 'idle' },
  loadTests: async (specId) => {
    set({ discoveryState: { status: 'loading' } });
    try {
      const tests = await window.electronAPI.invoke('test:list', { specId });
      const testMap = new Map(tests.map((t) => [t.id, t]));
      set({
        tests: testMap,
        discoveryState: { status: 'success', data: tests },
      });
      get().refreshHierarchy();
    } catch (error) {
      set({
        discoveryState: {
          status: 'error',
          error: error as AppError,
        },
      });
    }
  },
  updateTest: (testId, update) =>
    set((state) => {
      const next = new Map(state.tests);
      const existing = next.get(testId);
      if (existing) next.set(testId, { ...existing, ...update });
      return { tests: next };
    }),
  refreshHierarchy: () => {
    // Build hierarchy tree from flat test list
    // Implementation in useTestHierarchy hook
  },
}));
```

### TestHierarchy Component Structure

```typescript
// src/renderer/src/features/tests/components/TestHierarchy.tsx

type TestHierarchyProps = {
  rootNode: TestHierarchyNode;
  onSelectTest: (testId: string) => void;
  onSelectSpec: (specId: string) => void;
};

/**
 * Renders a collapsible tree mirroring spec hierarchy:
 *
 * [v] Projet MnM (e2e: 3 tests)
 *   [v] Epic 7: Test Visualization (integration: 5 tests)
 *     [v] Story 7.1: Test Discovery (unit: 8 tests)
 *       [ ] Task: spec-mapper (unit: 3 tests)
 *       [ ] Task: test-runner service (unit: 5 tests)
 *     [>] Story 7.2: Statut des Tests (unit: 6 tests)
 *
 * Each node shows:
 * - Expand/collapse chevron
 * - Label (spec name)
 * - Test count badge
 * - Coverage summary (colored indicators)
 * - Empty state if no tests
 */
```

### File Watcher Integration

```typescript
// src/renderer/src/features/tests/hooks/useTestDiscovery.ts

import { useCallback, useEffect, useRef } from 'react';
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream';
import { useTestsStore } from '../tests.store';

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;
const DEBOUNCE_MS = 500;

export function useTestDiscovery(): void {
  const loadTests = useTestsStore((s) => s.loadTests);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFileChange = useCallback(
    (data: { path: string; type: 'create' | 'modify' | 'delete' }) => {
      if (!TEST_FILE_PATTERN.test(data.path)) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        loadTests();
      }, DEBOUNCE_MS);
    },
    [loadTests]
  );

  useIpcStream('stream:file-change', handleFileChange);
}
```

### Project File Structure (Story 7.1 scope)

```
src/
  main/
    services/
      test-runner/
        spec-mapper.ts              # Convention-based spec -> test mapping
        spec-mapper.test.ts
        test-runner.service.ts       # Test discovery (discoverTests)
        test-runner.service.test.ts
        test-runner.types.ts         # Internal service types
  renderer/
    src/
      features/
        tests/
          components/
            TestHierarchy.tsx        # Tree view mirroring spec hierarchy
            TestHierarchy.test.tsx
          hooks/
            useTestHierarchy.ts      # Transform flat TestInfo[] -> tree
            useTestHierarchy.test.ts
            useTestDiscovery.ts      # File watcher -> re-discovery
          tests.store.ts             # Zustand store for tests feature
          index.ts                   # Barrel export
  shared/
    types/
      test.types.ts                  # TestInfo, TestRunResult, TestHierarchyNode
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Service file | kebab-case + `.service.ts` | `test-runner.service.ts` |
| Mapper file | kebab-case + `.ts` | `spec-mapper.ts` |
| Internal types | kebab-case + `.types.ts` | `test-runner.types.ts` |
| Component | PascalCase + `.tsx` | `TestHierarchy.tsx` |
| Hook | camelCase, prefix `use` | `useTestHierarchy.ts` |
| Store | camelCase + `.store.ts` | `tests.store.ts` |
| Test files | same name + `.test.ts` | `spec-mapper.test.ts` |
| IPC channels | `namespace:action` | `test:list` |

### Testing Strategy

- **Unit tests for spec-mapper**: verify convention matching with various file naming patterns, edge cases (no match, multiple matches, nested directories)
- **Unit tests for test-runner.service**: mock filesystem scanning, verify test classification by scope
- **Unit tests for useTestHierarchy hook**: verify tree building from flat list, count aggregation, empty state handling
- **Component tests for TestHierarchy**: render tree, expand/collapse, empty states, accessibility (keyboard navigation, ARIA tree role)
- **All tests co-located** with source files per architecture convention

### What NOT to Do

- Do NOT implement test execution logic — that is Story 7.4
- Do NOT implement test status badges or pass/fail indicators — that is Story 7.2
- Do NOT implement spec-to-test navigation clicks — that is Story 7.3
- Do NOT use `any` — use `unknown` + type guards for parsed test output
- Do NOT use `export default` — named exports only
- Do NOT hardcode test runner (vitest) — keep runner-agnostic for discovery; execution comes in Story 7.4
- Do NOT scan `node_modules/` or `.git/` directories during test file discovery
- Do NOT create a global singleton for the test runner service — inject via constructor

### References

- [Source: architecture.md#GAP-5] — Test Runner Service + spec-mapper resolution
- [Source: architecture.md#IPC-Channel-Design] — `test:list`, `stream:test-result` channel definitions
- [Source: architecture.md#Complete-Project-Directory-Structure] — `services/test-runner/` location
- [Source: architecture.md#Naming-Patterns] — File and code naming conventions
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, `AsyncState<T>`
- [Source: architecture.md#Format-Patterns] — `AppError`, TypeScript rules
- [Source: ux-design-specification.md#Empty-States-Loading] — Empty state pattern ("Pas de tests")
- [Source: ux-design-specification.md#Component-Strategy] — TestHierarchy in Phase 3
- [Source: epics.md#Story-7.1] — Original acceptance criteria

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
