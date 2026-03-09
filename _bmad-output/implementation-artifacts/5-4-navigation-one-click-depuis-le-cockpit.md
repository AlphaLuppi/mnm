# Story 5.4: Navigation One-Click depuis le Cockpit

Status: ready-for-dev

## Story

As a **user**,
I want **to navigate from any cockpit element to its detail view in one click**,
So that **I can go from overview to action instantly**.

## Acceptance Criteria

### AC1 — Click agent in cockpit navigates to agent detail

**Given** le cockpit affiche un agent
**When** je clique sur un agent dans le widget Agents
**Then** la navigation passe au niveau de cet agent : le volet Agents affiche son `AgentCard` en focus, le volet Contexte affiche ses fichiers, le volet Tests affiche ses tests (FR24)

### AC2 — Click drift alert in cockpit navigates to DriftDiffView

**Given** le cockpit affiche une alerte drift
**When** je clique sur une alerte dans le widget Drift
**Then** la `DriftDiffView` s'ouvre directement avec les documents concernes (FR24)

### AC3 — Click story in cockpit navigates to story level

**Given** le cockpit affiche une story
**When** je clique sur une story dans le widget Stories
**Then** la navigation passe au niveau Story dans la sidebar et les 3 volets se synchronisent (FR24)

### AC4 — Return to cockpit from detail views

**Given** je suis dans une vue detail (agent, drift, story)
**When** je clique sur "Projet" dans le breadcrumb (ou `Esc` au niveau Epic)
**Then** je reviens au cockpit dashboard

## Tasks / Subtasks

- [ ] Task 1: Define navigation action types for cockpit (AC: #1, #2, #3)
  - [ ] 1.1 Add navigation action types to `src/renderer/src/stores/navigation.store.ts`: `navigateToAgent(agentId)`, `navigateToDrift(driftId)`, `navigateToStory(storyId)`
  - [ ] 1.2 Add `navigateToProject()` action to reset navigation to project/cockpit level
  - [ ] 1.3 Add `previousLevel` tracking to enable Esc-back navigation
  - [ ] 1.4 Create `src/renderer/src/stores/navigation.store.test.ts` (or update existing) — test all navigation actions

- [ ] Task 2: Implement agent navigation from cockpit (AC: #1)
  - [ ] 2.1 Add `onClick` handler to agent items in `AgentsSummaryWidget.tsx` — calls `navigateToAgent(agentId)`
  - [ ] 2.2 In `navigation.store.ts`, `navigateToAgent` sets: `level: 'agent'`, `selectedId: agentId`, triggers pane synchronization
  - [ ] 2.3 When navigation level is `'agent'`, central pane renders agent detail view with `AgentCard` in focus
  - [ ] 2.4 Context pane filters to agent's context files, Tests pane filters to agent's tests
  - [ ] 2.5 Create test: click agent in widget -> navigation store updated -> panes synchronized

- [ ] Task 3: Implement drift navigation from cockpit (AC: #2)
  - [ ] 3.1 Add `onClick` handler to drift items in `DriftSummaryWidget.tsx` — calls `navigateToDrift(driftId)`
  - [ ] 3.2 In `navigation.store.ts`, `navigateToDrift` sets: `level: 'drift-detail'`, `selectedId: driftId`
  - [ ] 3.3 When navigation level is `'drift-detail'`, render `DriftDiffView` with the document pair from the selected drift alert
  - [ ] 3.4 Pass drift data (documents, summary, score) to `DriftDiffView` via drift store lookup
  - [ ] 3.5 Create test: click drift alert -> DriftDiffView opens with correct documents

- [ ] Task 4: Implement story navigation from cockpit (AC: #3)
  - [ ] 4.1 Add `onClick` handler to story items in `StoriesProgress.tsx` — calls `navigateToStory(storyId)`
  - [ ] 4.2 In `navigation.store.ts`, `navigateToStory` sets: `level: 'story'`, `selectedId: storyId`, `epicId` derived from story
  - [ ] 4.3 Sidebar selection syncs to the story level (story highlighted in hierarchy tree)
  - [ ] 4.4 Three panes synchronize: Context shows story context files, Agents shows agents working on story, Tests shows story tests
  - [ ] 4.5 Breadcrumb updates to "Projet > Epic X > Story Y"
  - [ ] 4.6 Create test: click story -> sidebar + breadcrumb + panes synchronized

- [ ] Task 5: Implement return-to-cockpit navigation (AC: #4)
  - [ ] 5.1 Ensure clicking "Projet" in breadcrumb calls `navigateToProject()` — resets to `level: 'project'`
  - [ ] 5.2 Implement `Esc` key handler at epic level: when at epic level, `Esc` navigates to project (cockpit)
  - [ ] 5.3 Implement `Esc` key handler at detail level: when at agent/drift/story detail, `Esc` navigates up one level
  - [ ] 5.4 When `level` returns to `'project'`, `CockpitDashboard` renders in central pane
  - [ ] 5.5 Create test: Esc at epic -> cockpit, breadcrumb "Projet" click -> cockpit

- [ ] Task 6: Implement useCockpitNavigation hook (AC: #1, #2, #3, #4)
  - [ ] 6.1 Create `src/renderer/src/features/dashboard/hooks/useCockpitNavigation.ts` — encapsulates all cockpit navigation actions
  - [ ] 6.2 Expose: `goToAgent(agentId)`, `goToDrift(driftId)`, `goToStory(storyId)`, `goToProject()`
  - [ ] 6.3 Each method calls the corresponding navigation store action
  - [ ] 6.4 Create `src/renderer/src/features/dashboard/hooks/useCockpitNavigation.test.ts` — test each navigation path

- [ ] Task 7: Add keyboard navigation support (AC: #1, #2, #3, #4)
  - [ ] 7.1 Make widget items focusable (`tabIndex={0}`) and activatable with `Enter`/`Space`
  - [ ] 7.2 Add `onKeyDown` handlers: `Enter`/`Space` = navigate, `Esc` = go back
  - [ ] 7.3 Use `role="link"` or `role="button"` with `aria-label` describing the navigation target
  - [ ] 7.4 Add visual focus indicator (2px ring `--accent`) on focused widget items

- [ ] Task 8: Add cursor and hover feedback (AC: #1, #2, #3)
  - [ ] 8.1 Add `cursor-pointer` to all clickable widget items
  - [ ] 8.2 Add hover state: `hover:bg-bg-elevated` with `transition-colors duration-150`
  - [ ] 8.3 Add focus-visible state: `focus-visible:ring-2 focus-visible:ring-accent`
  - [ ] 8.4 Respect `prefers-reduced-motion` for hover transitions

## Dev Notes

### FRs Covered

- **FR24** — L'utilisateur peut naviguer du cockpit vers n'importe quel agent, alerte, ou story en un clic

### Dependencies on Previous Stories

- **Story 5.1** — Dashboard layout (`CockpitDashboard`)
- **Story 5.2** — `AgentsSummaryWidget`, `DriftSummaryWidget` with clickable items
- **Story 5.3** — `StoriesProgress` with clickable story rows
- **Story 1.4** — Navigation store (`navigation.store.ts`), breadcrumb, sidebar synchronization, pane sync
- **Story 2.2** — Agent detail view, `AgentCard` focus
- **Story 4.4** — `DriftDiffView` component for drift detail

### Navigation Store Additions

```typescript
// Additions to src/renderer/src/stores/navigation.store.ts
import { create } from 'zustand';

type NavigationLevel = 'project' | 'epic' | 'story' | 'task' | 'agent' | 'drift-detail';

type NavigationState = {
  level: NavigationLevel;
  selectedId: string | null;
  epicId: string | null;
  storyId: string | null;
  previousLevel: NavigationLevel | null;

  // Existing actions (from Story 1.4)
  selectLevel: (level: NavigationLevel, id: string) => void;

  // New actions for cockpit navigation (Story 5.4)
  navigateToAgent: (agentId: string) => void;
  navigateToDrift: (driftId: string) => void;
  navigateToStory: (storyId: string, epicId: string) => void;
  navigateToProject: () => void;
  navigateBack: () => void;
};

export const useNavigationStore = create<NavigationState>((set, get) => ({
  level: 'project',
  selectedId: null,
  epicId: null,
  storyId: null,
  previousLevel: null,

  selectLevel: (level, id) => set((state) => ({
    previousLevel: state.level,
    level,
    selectedId: id,
  })),

  navigateToAgent: (agentId) => set((state) => ({
    previousLevel: state.level,
    level: 'agent',
    selectedId: agentId,
  })),

  navigateToDrift: (driftId) => set((state) => ({
    previousLevel: state.level,
    level: 'drift-detail',
    selectedId: driftId,
  })),

  navigateToStory: (storyId, epicId) => set((state) => ({
    previousLevel: state.level,
    level: 'story',
    selectedId: storyId,
    epicId,
    storyId,
  })),

  navigateToProject: () => set({
    previousLevel: null,
    level: 'project',
    selectedId: null,
    epicId: null,
    storyId: null,
  }),

  navigateBack: () => {
    const { previousLevel } = get();
    if (previousLevel) {
      set({ level: previousLevel, previousLevel: null });
    } else {
      set({ level: 'project', selectedId: null });
    }
  },
}));
```

### useCockpitNavigation Hook Pattern

```typescript
// src/renderer/src/features/dashboard/hooks/useCockpitNavigation.ts
import { useCallback } from 'react';
import { useNavigationStore } from '@renderer/stores/navigation.store';

export function useCockpitNavigation() {
  const navigateToAgent = useNavigationStore((s) => s.navigateToAgent);
  const navigateToDrift = useNavigationStore((s) => s.navigateToDrift);
  const navigateToStory = useNavigationStore((s) => s.navigateToStory);
  const navigateToProject = useNavigationStore((s) => s.navigateToProject);
  const navigateBack = useNavigationStore((s) => s.navigateBack);

  const goToAgent = useCallback(
    (agentId: string) => {
      navigateToAgent(agentId);
    },
    [navigateToAgent]
  );

  const goToDrift = useCallback(
    (driftId: string) => {
      navigateToDrift(driftId);
    },
    [navigateToDrift]
  );

  const goToStory = useCallback(
    (storyId: string, epicId: string) => {
      navigateToStory(storyId, epicId);
    },
    [navigateToStory]
  );

  const goToProject = useCallback(() => {
    navigateToProject();
  }, [navigateToProject]);

  const goBack = useCallback(() => {
    navigateBack();
  }, [navigateBack]);

  return { goToAgent, goToDrift, goToStory, goToProject, goBack };
}
```

### Widget Click Integration Patterns

```typescript
// In AgentsSummaryWidget.tsx — add onClick to agent items
import { useCockpitNavigation } from '../hooks/useCockpitNavigation';

export function AgentsSummaryWidget() {
  const { goToAgent } = useCockpitNavigation();
  // ...
  return (
    // ...
    <button
      key={agent.id}
      onClick={() => goToAgent(agent.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToAgent(agent.id);
        }
      }}
      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded
                 cursor-pointer hover:bg-bg-elevated transition-colors duration-150
                 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      aria-label={`Naviguer vers l'agent ${agent.name}`}
    >
      {/* ... agent content ... */}
    </button>
  );
}
```

```typescript
// In DriftSummaryWidget.tsx — add onClick to drift items
import { useCockpitNavigation } from '../hooks/useCockpitNavigation';

export function DriftSummaryWidget() {
  const { goToDrift } = useCockpitNavigation();
  // ...
  return (
    // ...
    <button
      key={alert.id}
      onClick={() => goToDrift(alert.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToDrift(alert.id);
        }
      }}
      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded
                 cursor-pointer hover:bg-bg-elevated transition-colors duration-150
                 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      aria-label={`Voir le drift: ${alert.documentA} vs ${alert.documentB}`}
    >
      {/* ... drift content ... */}
    </button>
  );
}
```

```typescript
// In StoriesProgress.tsx — add onClick to story rows
import { useCockpitNavigation } from '../hooks/useCockpitNavigation';

function StoryRow({ story }: StoryRowProps) {
  const { goToStory } = useCockpitNavigation();
  // ...
  return (
    <button
      onClick={() => goToStory(story.id, story.epicId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToStory(story.id, story.epicId);
        }
      }}
      className="flex items-center gap-3 w-full text-left px-2 py-1 rounded
                 cursor-pointer hover:bg-bg-elevated transition-colors duration-150
                 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      aria-label={`Naviguer vers Story ${story.id}: ${story.title}`}
    >
      {/* ... story content ... */}
    </button>
  );
}
```

### Esc Key Handler Pattern

```typescript
// In App.tsx or a global keyboard handler
import { useEffect } from 'react';
import { useNavigationStore } from '@renderer/stores/navigation.store';

export function useGlobalKeyboardNavigation() {
  const level = useNavigationStore((s) => s.level);
  const navigateBack = useNavigationStore((s) => s.navigateBack);
  const navigateToProject = useNavigationStore((s) => s.navigateToProject);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Don't handle if inside an input or dialog
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('[role="dialog"]')) {
          return;
        }

        if (level === 'agent' || level === 'drift-detail') {
          navigateBack();
        } else if (level === 'story') {
          // Navigate up to epic level
          navigateBack();
        } else if (level === 'epic') {
          navigateToProject();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [level, navigateBack, navigateToProject]);
}
```

### Central Pane Routing Pattern

```typescript
// Updated routing logic in the central pane
import { useNavigationStore } from '@renderer/stores/navigation.store';
import { CockpitDashboard } from '@renderer/features/dashboard';

export function CentralPane() {
  const level = useNavigationStore((s) => s.level);
  const selectedId = useNavigationStore((s) => s.selectedId);

  switch (level) {
    case 'project':
      return <CockpitDashboard />;
    case 'agent':
      return <AgentDetailView agentId={selectedId!} />;
    case 'drift-detail':
      return <DriftDetailView driftId={selectedId!} />;
    case 'story':
      return <StoryDetailView storyId={selectedId!} />;
    case 'epic':
      return <EpicOverview epicId={selectedId!} />;
    default:
      return <CockpitDashboard />;
  }
}
```

### File Structure (Story 5.4 additions)

```
src/renderer/src/stores/
└── navigation.store.ts                # UPDATE — add navigateToAgent, navigateToDrift, navigateToStory, navigateToProject, navigateBack
    navigation.store.test.ts           # UPDATE — test new navigation actions

src/renderer/src/features/dashboard/
├── components/
│   ├── AgentsSummaryWidget.tsx        # UPDATE — add onClick handlers
│   ├── DriftSummaryWidget.tsx         # UPDATE — add onClick handlers
│   └── StoriesProgress.tsx            # UPDATE — add onClick handlers
├── hooks/
│   ├── useCockpitNavigation.ts        # NEW — cockpit navigation actions hook
│   └── useCockpitNavigation.test.ts   # NEW
└── index.ts                           # UPDATE — export useCockpitNavigation
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Navigation actions | camelCase verb + noun | `navigateToAgent`, `navigateBack` |
| Hook | camelCase, prefix `use` | `useCockpitNavigation.ts` |
| Navigation levels | kebab-case string literal | `'drift-detail'`, `'project'` |
| Event handlers | camelCase prefix `handle` / `on` | `onClick`, `onKeyDown` |
| Tests | same name + `.test.ts(x)` | `useCockpitNavigation.test.ts` |

### Testing Strategy

- **Unit tests** for navigation store: test each navigation action (`navigateToAgent`, `navigateToDrift`, `navigateToStory`, `navigateToProject`, `navigateBack`), verify state transitions
- **Unit tests** for `useCockpitNavigation`: mock navigation store, verify each `goTo*` method calls the correct store action
- **Integration tests** for `AgentsSummaryWidget`: simulate click on agent item, verify `navigateToAgent` called with correct ID
- **Integration tests** for `DriftSummaryWidget`: simulate click on drift item, verify `navigateToDrift` called with correct ID
- **Integration tests** for `StoriesProgress`: simulate click on story row, verify `navigateToStory` called with correct IDs
- **Keyboard tests**: simulate `Enter`/`Space` on widget items, verify navigation triggered; simulate `Esc`, verify navigation back
- **Accessibility tests**: verify `aria-label` on all clickable items, `focus-visible` ring present, `role="button"` semantics
- **Co-located** — all test files next to their source files

### What NOT to Do

- Do NOT create a router (React Router) — navigation is managed via Zustand store, not URL-based routing
- Do NOT implement the detail views themselves (AgentDetailView, DriftDetailView, StoryDetailView) — those exist in their respective feature folders from earlier stories
- Do NOT use `window.location` or `history.pushState` — Electron app uses store-based navigation
- Do NOT add navigation to widgets that don't exist yet — only wire up widgets created in Stories 5.2 and 5.3
- Do NOT use `export default` — named exports only
- Do NOT use `any` — use `unknown` + type guards
- Do NOT bypass the navigation store — all navigation must go through `navigation.store.ts` to maintain pane synchronization
- Do NOT forget `previousLevel` tracking — required for `Esc` back navigation
- Do NOT use `<a href>` for internal navigation — use `<button>` with click handlers
- Do NOT skip keyboard handlers — `Enter`/`Space` must work on all clickable items (WCAG 2.1 AA)

### References

- [Source: epics.md#Story-5.4] — Full acceptance criteria
- [Source: architecture.md#Frontend-Component-Architecture] — `stores/navigation.ts` shared between features
- [Source: architecture.md#Architectural-Boundaries] — "Feature -> Feature: Communication via shared Zustand stores (navigation.store.ts)"
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, actions in store
- [Source: ux-design-specification.md#Navigation-Patterns] — Breadcrumb, Esc back, volet sync, focus agent
- [Source: ux-design-specification.md#Flow-Optimization-Principles] — "Max 2 clics du cockpit a la resolution"
- [Source: ux-design-specification.md#Keyboard-Shortcuts] — `Esc` = remonter/fermer, `Enter` = selectionner
- [Source: ux-design-specification.md#Accessibility-Strategy] — Keyboard-first, focus visible 2px ring
- [Source: ux-design-specification.md#Experience-Mechanics] — "Cockpit Glance" flow: scan -> focus -> act
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — TypeScript rules, naming conventions

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
