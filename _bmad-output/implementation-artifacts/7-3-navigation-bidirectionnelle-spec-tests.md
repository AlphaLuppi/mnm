# Story 7.3: Navigation Bidirectionnelle Spec <-> Tests

Status: ready-for-dev

## Story

As a **user**,
I want **to navigate from a spec to its associated tests and vice versa**,
So that **I can quickly verify test coverage for any requirement**.

## Acceptance Criteria

### AC1 — Navigation spec vers tests

**Given** je suis sur une spec (story ou tâche) dans la sidebar
**When** je clique sur "Voir les tests" (ou le volet Tests est synchronisé)
**Then** le volet Tests filtre et affiche uniquement les tests associés à cette spec (FR35)

### AC2 — Navigation test vers spec

**Given** je suis sur un test dans le volet Tests
**When** je clique sur "Voir la spec"
**Then** la navigation passe à la spec associée dans la sidebar
**And** les volets Contexte et Agents se synchronisent à ce niveau (FR35)

### AC3 — Vue agrégée au niveau Epic

**Given** je suis au niveau Epic
**When** les volets sont synchronisés
**Then** le volet Tests affiche les tests d'intégration de cet epic + un résumé des tests unitaires des stories enfants

## Tasks / Subtasks

- [ ] Task 1: Extend navigation store for spec-test linking (AC: #1, #2)
  - [ ] 1.1 Add `selectedSpecId: string | null` and `selectedTestId: string | null` to `navigation.store.ts`
  - [ ] 1.2 Add `navigateToSpec(specId: string)` action that updates navigation level + syncs all panes
  - [ ] 1.3 Add `navigateToTest(testId: string)` action that focuses the test in the Tests pane
  - [ ] 1.4 Add `getTestsForCurrentSpec()` derived selector using spec-mapper data

- [ ] Task 2: Create useSpecTestNavigation hook (AC: #1, #2)
  - [ ] 2.1 Create `src/renderer/src/features/tests/hooks/useSpecTestNavigation.ts`
  - [ ] 2.2 Implement `goToTestsForSpec(specId: string)` — filters tests pane to show only associated tests
  - [ ] 2.3 Implement `goToSpecForTest(testId: string)` — navigates sidebar to associated spec, syncs all panes
  - [ ] 2.4 Handle case where test has no `specId` — show warning "Test non associé à une spec"
  - [ ] 2.5 Create `src/renderer/src/features/tests/hooks/useSpecTestNavigation.test.ts`

- [ ] Task 3: Add "Voir les tests" action to spec items (AC: #1)
  - [ ] 3.1 Add a "Voir les tests" button/link to spec items in the NavigationSidebar
  - [ ] 3.2 Button renders a test tube icon + "Tests" label (ghost button style)
  - [ ] 3.3 On click, call `goToTestsForSpec(specId)`
  - [ ] 3.4 Keyboard accessible: `Enter` or `Space` to activate
  - [ ] 3.5 If no tests associated, button is disabled with tooltip "Pas de tests associés"

- [ ] Task 4: Add "Voir la spec" action to test items (AC: #2)
  - [ ] 4.1 Add a "Voir la spec" button/link to test items in TestHierarchy
  - [ ] 4.2 Button renders a document icon + "Spec" label (ghost button style)
  - [ ] 4.3 On click, call `goToSpecForTest(testId)`
  - [ ] 4.4 If test has no `specId`, button is hidden
  - [ ] 4.5 Keyboard accessible: `Enter` or `Space` to activate

- [ ] Task 5: Implement pane synchronization on navigation (AC: #1, #2)
  - [ ] 5.1 When navigating spec -> tests: Tests pane scrolls to and highlights the relevant test group
  - [ ] 5.2 When navigating test -> spec: Sidebar selects the spec, Contexte pane shows related context files, Agents pane shows related agents
  - [ ] 5.3 Use existing navigation store subscription mechanism from Story 1.4
  - [ ] 5.4 Add highlight animation: brief accent border pulse (200ms) on the target element

- [ ] Task 6: Implement filtered test view for spec context (AC: #1, #3)
  - [ ] 6.1 Create `src/renderer/src/features/tests/hooks/useFilteredTests.ts`
  - [ ] 6.2 When a spec is selected in navigation, filter `TestHierarchy` to show only tests matching that spec
  - [ ] 6.3 At project level: show all e2e tests + summary of all other tests
  - [ ] 6.4 At epic level: show integration tests for that epic + summary of child story unit tests
  - [ ] 6.5 At story level: show unit tests for that story
  - [ ] 6.6 At task level: show unit tests for that specific task
  - [ ] 6.7 Create `src/renderer/src/features/tests/hooks/useFilteredTests.test.ts`

- [ ] Task 7: Implement visual highlight for active mapping (AC: #1, #2)
  - [ ] 7.1 When navigating from spec to tests, highlight the linked tests with accent left border
  - [ ] 7.2 When navigating from test to spec, highlight the linked spec in sidebar with accent left border
  - [ ] 7.3 Highlight clears when user navigates elsewhere or after 3 seconds
  - [ ] 7.4 Use `--accent` (#3b82f6) for highlight color

- [ ] Task 8: Handle Epic-level aggregate view (AC: #3)
  - [ ] 8.1 When at Epic level, Tests pane shows 2 sections: "Tests d'intégration" (epic-scoped) + "Résumé tests unitaires" (child stories summary)
  - [ ] 8.2 Integration tests section: full test list with status badges
  - [ ] 8.3 Unit tests summary section: collapsible list of stories with `TestSummaryBadge` per story
  - [ ] 8.4 Click on a story summary expands to show individual tests (or navigates to story level)

- [ ] Task 9: Update barrel export (AC: #1, #2, #3)
  - [ ] 9.1 Update `src/renderer/src/features/tests/index.ts` to re-export new hooks

## Dev Notes

### FRs Covered

- **FR35** : L'utilisateur peut naviguer d'une spec vers ses tests associés et inversement

### Dependencies on Previous Stories

- **Story 7.1** (Test Discovery) — `TestInfo` with `specId`, `TestHierarchyNode`, `useTestsStore`, `TestHierarchy` component, spec-mapper data
- **Story 7.2** (Test Status) — `TestStatusBadge`, `TestSummaryBadge`, `testResults` in store, aggregate status logic
- **Story 1.4** (Hierarchical Navigation & Pane Synchronization) — `navigation.store.ts`, pane sync mechanism, sidebar navigation, breadcrumb
- **Story 1.2** (Three-Pane Layout) — Pane structure, resizable panels

### Navigation Flow: Spec -> Tests

```
User clicks spec in sidebar
  |
  v
navigation.store: setSelectedSpec(specId)
  |
  v
useFilteredTests: filters TestHierarchy to specId-associated tests
  |
  v
Tests pane re-renders with filtered view
  |
  v
Target test group highlighted with accent border (200ms pulse)
```

### Navigation Flow: Test -> Spec

```
User clicks "Voir la spec" on a test item
  |
  v
useSpecTestNavigation: goToSpecForTest(testId)
  |
  v
Looks up test.specId from TestInfo
  |
  v
navigation.store: navigateToSpec(specId)
  |
  v
Sidebar selects spec -> Contexte pane syncs -> Agents pane syncs
  |
  v
Spec item in sidebar highlighted with accent border (200ms pulse)
```

### useSpecTestNavigation Hook

```typescript
// src/renderer/src/features/tests/hooks/useSpecTestNavigation.ts

import { useCallback } from 'react';
import { useNavigationStore } from '@renderer/stores/navigation.store';
import { useTestsStore } from '../tests.store';

type SpecTestNavigation = {
  goToTestsForSpec: (specId: string) => void;
  goToSpecForTest: (testId: string) => void;
  hasTestsForSpec: (specId: string) => boolean;
  hasSpecForTest: (testId: string) => boolean;
};

/**
 * Provides bidirectional navigation between specs and tests.
 *
 * goToTestsForSpec:
 * 1. Sets selectedSpecId in navigation store
 * 2. Tests pane auto-filters via useFilteredTests subscription
 * 3. Scrolls to and highlights the relevant test group
 *
 * goToSpecForTest:
 * 1. Reads specId from TestInfo
 * 2. Calls navigateToSpec(specId) on navigation store
 * 3. All 3 panes synchronize to that spec level
 */
export function useSpecTestNavigation(): SpecTestNavigation {
  const navigateToSpec = useNavigationStore((s) => s.navigateToSpec);
  const tests = useTestsStore((s) => s.tests);

  const goToTestsForSpec = useCallback(
    (specId: string) => {
      // Navigation store handles pane sync
      // Tests pane will filter based on selectedSpecId
      navigateToSpec(specId);
    },
    [navigateToSpec]
  );

  const goToSpecForTest = useCallback(
    (testId: string) => {
      const test = tests.get(testId);
      if (!test?.specId) return;
      navigateToSpec(test.specId);
    },
    [tests, navigateToSpec]
  );

  const hasTestsForSpec = useCallback(
    (specId: string) => {
      return Array.from(tests.values()).some((t) => t.specId === specId);
    },
    [tests]
  );

  const hasSpecForTest = useCallback(
    (testId: string) => {
      const test = tests.get(testId);
      return !!test?.specId;
    },
    [tests]
  );

  return { goToTestsForSpec, goToSpecForTest, hasTestsForSpec, hasSpecForTest };
}
```

### useFilteredTests Hook

```typescript
// src/renderer/src/features/tests/hooks/useFilteredTests.ts

import { useMemo } from 'react';
import { useNavigationStore } from '@renderer/stores/navigation.store';
import { useTestsStore } from '../tests.store';
import type { TestInfo, TestHierarchyNode } from '@shared/types/test.types';

type FilteredTestsResult = {
  filteredTests: TestInfo[];
  filteredHierarchy: TestHierarchyNode | null;
  isFiltered: boolean;
};

/**
 * Filters the test hierarchy based on the currently selected navigation level.
 *
 * Filtering logic by navigation level:
 * - Project: all e2e tests + summary of all other
 * - Epic: integration tests for this epic + summary of child story unit tests
 * - Story: unit tests for this story
 * - Task: unit tests for this task
 */
export function useFilteredTests(): FilteredTestsResult {
  const currentLevel = useNavigationStore((s) => s.currentLevel);
  const selectedId = useNavigationStore((s) => s.selectedId);
  const tests = useTestsStore((s) => s.tests);
  const hierarchy = useTestsStore((s) => s.hierarchy);

  return useMemo(() => {
    if (!selectedId || !hierarchy) {
      return { filteredTests: Array.from(tests.values()), filteredHierarchy: hierarchy, isFiltered: false };
    }

    // Filter based on current navigation level
    const filtered = Array.from(tests.values()).filter((test) => {
      if (currentLevel === 'project') return test.scope === 'e2e';
      if (currentLevel === 'epic') return test.specId?.startsWith(selectedId) && (test.scope === 'integration' || test.scope === 'unit');
      return test.specId === selectedId;
    });

    return { filteredTests: filtered, filteredHierarchy: hierarchy, isFiltered: true };
  }, [currentLevel, selectedId, tests, hierarchy]);
}
```

### Highlight Animation

```css
/* Highlight for navigation target */
.spec-test-highlight {
  border-left: 3px solid var(--accent);
  background-color: color-mix(in srgb, var(--accent) 10%, transparent);
  animation: highlight-pulse 200ms ease-out;
}

@keyframes highlight-pulse {
  0% { border-left-color: transparent; }
  100% { border-left-color: var(--accent); }
}

/* Auto-clear after 3 seconds */
.spec-test-highlight-auto-clear {
  animation: highlight-pulse 200ms ease-out, highlight-fade 500ms ease-out 3s forwards;
}

@keyframes highlight-fade {
  to {
    border-left-color: transparent;
    background-color: transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spec-test-highlight,
  .spec-test-highlight-auto-clear {
    animation: none;
  }
}
```

### Epic-Level Aggregate View

```typescript
/**
 * When at Epic level, the Tests pane shows:
 *
 * +---------------------------------------------+
 * | Epic 7: Test Visualization                   |
 * |                                              |
 * | -- Tests d'intégration (3) --------          |
 * | [green] test-hierarchy-renders.integration   |
 * | [red]   spec-nav-syncs.integration           |
 * | [gray]  full-pipeline.integration            |
 * |                                              |
 * | -- Résumé tests unitaires ----------         |
 * | [>] Story 7.1: Test Discovery  [8 tests]    |
 * |     5 pass, 2 fail, 1 pending               |
 * | [>] Story 7.2: Statut Tests    [6 tests]    |
 * |     6 pass, 0 fail, 0 pending               |
 * +---------------------------------------------+
 *
 * Click on story summary -> navigates to story level
 */
```

### Project File Structure (Story 7.3 scope)

```
src/
  renderer/
    src/
      features/
        tests/
          components/
            TestHierarchy.tsx              # UPDATED: add navigation links, highlight
          hooks/
            useSpecTestNavigation.ts       # Bidirectional spec <-> test navigation
            useSpecTestNavigation.test.ts
            useFilteredTests.ts            # Filter tests by selected spec level
            useFilteredTests.test.ts
          tests.store.ts                   # UPDATED (minor): add filtered selectors
          index.ts                         # UPDATED: re-export new hooks
      stores/
        navigation.store.ts               # UPDATED: add selectedSpecId, selectedTestId, navigateToSpec
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Navigation hook | camelCase, prefix `use` | `useSpecTestNavigation.ts` |
| Filter hook | camelCase, prefix `use` | `useFilteredTests.ts` |
| CSS highlight class | kebab-case | `spec-test-highlight` |
| Navigation actions | camelCase verbs | `goToTestsForSpec`, `goToSpecForTest` |
| Button labels (FR) | French user-facing text | "Voir les tests", "Voir la spec" |

### Testing Strategy

- **Unit tests for useSpecTestNavigation**: verify `goToTestsForSpec` updates navigation store, `goToSpecForTest` looks up specId and navigates, handles missing specId gracefully
- **Unit tests for useFilteredTests**: verify filtering at each level (project/epic/story/task), empty filter results, unfiltered state
- **Component tests for TestHierarchy (updated)**: verify "Voir la spec" button renders when test has specId, hidden when no specId, click triggers navigation
- **Component tests for NavigationSidebar (updated)**: verify "Voir les tests" button renders, disabled when no tests, click triggers test pane filtering
- **Integration test**: verify full round-trip spec -> tests -> spec navigation with pane synchronization
- **Accessibility tests**: keyboard navigation between spec and test links, focus management after navigation

### What NOT to Do

- Do NOT implement test execution from this navigation — that is Story 7.4
- Do NOT modify the spec-mapper logic — that was completed in Story 7.1
- Do NOT create separate pages or routes for test views — use in-pane filtering and highlighting
- Do NOT use modals for navigation — use inline pane updates
- Do NOT use `any` for navigation state types
- Do NOT use `export default`
- Do NOT break existing pane synchronization from Story 1.4 — extend it, don't replace it
- Do NOT hardcode spec IDs in the navigation logic — always derive from `TestInfo.specId`

### References

- [Source: architecture.md#IPC-Channel-Design] — `test:list` with `specId` filter parameter
- [Source: architecture.md#GAP-5] — `TestInfo.specId` convention-based mapping
- [Source: architecture.md#Complete-Project-Directory-Structure] — `stores/navigation.store.ts`, `features/tests/`
- [Source: architecture.md#Architectural-Boundaries] — Feature-to-feature communication via shared stores only
- [Source: ux-design-specification.md#Navigation-Patterns] — Volet sync on element click, Esc to go up
- [Source: ux-design-specification.md#Design-Direction-Decision] — 3-pane sync, contextual panel switching
- [Source: ux-design-specification.md#Experience-Principles] — "Show the chain" (specs -> tests -> code)
- [Source: ux-design-specification.md#Keyboard-Shortcuts] — `1`/`2`/`3` for pane focus
- [Source: epics.md#Story-7.3] — Original acceptance criteria

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
