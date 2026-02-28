# Story 1.2: Three-Pane Resizable Layout with Timeline Bar

Status: ready-for-dev

## Story

As a **user**,
I want **to see the 3-pane layout (Contexte / Agents / Tests) with a bottom timeline bar**,
So that **I have the cockpit structure for supervising my project**.

## Acceptance Criteria

### AC1 — Three-pane layout visible with correct proportions

**Given** l'app est ouverte
**When** je vois l'interface principale
**Then** 3 volets sont visibles : Contexte (gauche, 25%), Agents (centre, 50%), Tests (droite, 25%)
**And** une timeline bar est visible en bas (120px)

### AC2 — Resizable panes with min/max constraints

**Given** les volets sont affichés
**When** je drag le separateur entre deux volets
**Then** les volets se redimensionnent en respectant les contraintes min/max (Contexte: 200px-40%, Agents: 400px-70%, Tests: 200px-40%)

### AC3 — Double-click to maximize/restore a pane

**Given** un volet est visible
**When** je double-clique sur son header
**Then** le volet se maximise (occupe tout l'espace horizontal)
**And** un second double-clic restaure la taille precedente

### AC4 — Minimum resolution overlay

**Given** l'app est affichee sur un ecran < 1024px
**When** la fenetre est en dessous du breakpoint minimum
**Then** un overlay "Resolution insuffisante" s'affiche

### AC5 — Narrow breakpoint (2-pane + toggle)

**Given** l'app est entre 1024-1279px (narrow)
**When** le breakpoint narrow est actif
**Then** seuls 2 volets sont visibles avec un toggle pour le 3eme

## Tasks / Subtasks

- [ ] Task 1: Install shadcn/ui components required for layout (AC: #1, #2)
  - [ ] 1.1 Run `npx shadcn@latest add resizable` (installs `react-resizable-panels`)
  - [ ] 1.2 Run `npx shadcn@latest add tabs`
  - [ ] 1.3 Run `npx shadcn@latest add scroll-area`
  - [ ] 1.4 Run `npx shadcn@latest add toast` (+ `npx shadcn@latest add sonner` if shadcn uses sonner)
  - [ ] 1.5 Verify all components are generated in `src/renderer/src/components/ui/`

- [ ] Task 2: Create Zustand navigation store for panel state (AC: #1, #2, #3)
  - [ ] 2.1 Create `src/renderer/src/stores/navigation.store.ts` with panel sizes, collapsed states, maximized state, active breakpoint
  - [ ] 2.2 Implement actions: `resizePanel`, `togglePane`, `maximizePane`, `restorePane`, `setBreakpoint`
  - [ ] 2.3 Write unit test `src/renderer/src/stores/navigation.store.test.ts`

- [ ] Task 3: Create AppShell layout component (AC: #1, #4, #5)
  - [ ] 3.1 Create `src/renderer/src/shared/layout/AppShell.tsx` — top-level layout container with AppHeader + ThreePaneLayout + TimelineBar
  - [ ] 3.2 Add window resize listener to detect breakpoint changes and update navigation store
  - [ ] 3.3 Render `MinResolutionOverlay` when width < 1024px
  - [ ] 3.4 Add ARIA landmarks: `<header>`, `<main>`, `<footer>`
  - [ ] 3.5 Add skip links at top: "Aller au volet Contexte", "Aller au volet Agents", "Aller au volet Tests", "Aller a la timeline"

- [ ] Task 4: Create AppHeader component (AC: #1)
  - [ ] 4.1 Create `src/renderer/src/shared/layout/AppHeader.tsx` — project name placeholder, breadcrumb placeholder, summary badges placeholder area
  - [ ] 4.2 Style with `bg-bg-surface`, `border-b border-border-default`, fixed height 48px
  - [ ] 4.3 Add `role="banner"` and ARIA landmark

- [ ] Task 5: Create ThreePaneLayout component (AC: #1, #2, #3, #5)
  - [ ] 5.1 Create `src/renderer/src/shared/layout/ThreePaneLayout.tsx` using shadcn `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`
  - [ ] 5.2 Set default sizes: left 25%, center 50%, right 25%
  - [ ] 5.3 Apply min/max constraints via `minSize`/`maxSize` props (convert px constraints to percentages based on container width)
  - [ ] 5.4 Add double-click handler on each pane header to maximize/restore
  - [ ] 5.5 Wire panel size changes to navigation store via `onLayout` callback
  - [ ] 5.6 Implement narrow breakpoint behavior: show 2 panes + Tabs toggle for the hidden 3rd pane
  - [ ] 5.7 Add `id` attributes for skip link targets: `pane-context`, `pane-agents`, `pane-tests`
  - [ ] 5.8 Each pane renders a PaneHeader (title + collapse/maximize controls) + empty state placeholder
  - [ ] 5.9 Write unit test `src/renderer/src/shared/layout/ThreePaneLayout.test.tsx`

- [ ] Task 6: Create TimelineBar component (AC: #1)
  - [ ] 6.1 Create `src/renderer/src/shared/layout/TimelineBar.tsx` — horizontal bar at bottom, 120px default height
  - [ ] 6.2 Style with `bg-bg-surface`, `border-t border-border-default`
  - [ ] 6.3 Render empty state: illustration + "Aucune activite" message
  - [ ] 6.4 Add `role="region"` with `aria-label="Timeline d'activite"`
  - [ ] 6.5 Add `id="timeline-bar"` for skip link target

- [ ] Task 7: Create MinResolutionOverlay component (AC: #4)
  - [ ] 7.1 Create `src/renderer/src/shared/layout/MinResolutionOverlay.tsx` — fixed overlay covering entire viewport
  - [ ] 7.2 Display message: "Resolution insuffisante — MnM necessite un ecran d'au moins 1024px de large"
  - [ ] 7.3 Style with `bg-bg-base/95`, centered text, `z-50`

- [ ] Task 8: Create PaneHeader sub-component (AC: #3)
  - [ ] 8.1 Create `src/renderer/src/shared/layout/PaneHeader.tsx` — title + icon buttons (collapse, maximize/restore)
  - [ ] 8.2 Double-click on header triggers maximize/restore via navigation store
  - [ ] 8.3 Style with `text-lg font-semibold text-text-primary`, `h-10`, `px-3`

- [ ] Task 9: Create PaneEmptyState sub-component (AC: #1)
  - [ ] 9.1 Create `src/renderer/src/shared/layout/PaneEmptyState.tsx` — illustration placeholder + descriptive text + optional action button
  - [ ] 9.2 Context pane: "Aucun fichier de contexte" + "Ouvrez un projet pour voir les fichiers"
  - [ ] 9.3 Agents pane: "Aucun agent actif" + "Lancez un agent pour commencer"
  - [ ] 9.4 Tests pane: "Aucun test disponible" + "Les tests apparaitront une fois le projet charge"
  - [ ] 9.5 Style centered vertically and horizontally within pane, `text-text-muted`

- [ ] Task 10: Wire keyboard shortcuts (AC: #1)
  - [ ] 10.1 Add global keydown listener in `AppShell.tsx`
  - [ ] 10.2 `1` / `2` / `3` keys focus respective panes (Contexte / Agents / Tests)
  - [ ] 10.3 `Esc` moves up one level in hierarchy (placeholder — navigates to previous state)
  - [ ] 10.4 Ensure shortcuts only fire when no input/textarea is focused

- [ ] Task 11: Update App.tsx to use AppShell (AC: #1)
  - [ ] 11.1 Replace minimal dark shell in `src/renderer/src/App.tsx` with `<AppShell />`
  - [ ] 11.2 Verify `npm run dev` renders the 3-pane layout with timeline bar
  - [ ] 11.3 Verify `npm run build` produces working production build
  - [ ] 11.4 Run `npx vitest run` — all tests pass (existing + new)

- [ ] Task 12: Responsive behavior and animations (AC: #4, #5)
  - [ ] 12.1 Add CSS transitions for pane resize: `transition: flex-basis 150ms ease-out`
  - [ ] 12.2 Add `@media (prefers-reduced-motion: reduce)` to disable all transitions
  - [ ] 12.3 Verify Full breakpoint (>= 1440px): 3 panes + full timeline
  - [ ] 12.4 Verify Compact breakpoint (1280-1439px): 3 panes, icons without labels in pane headers
  - [ ] 12.5 Verify Narrow breakpoint (1024-1279px): 2 panes + tab toggle for 3rd
  - [ ] 12.6 Verify Minimum breakpoint (< 1024px): overlay displayed

## Dev Notes

### FRs Covered

| FR | Description | How addressed |
|---|---|---|
| FR37 | Layout 3 volets : Contexte / Agents / Tests | ThreePaneLayout with shadcn Resizable (react-resizable-panels) |
| FR39 | Redimensionner, maximiser ou masquer chaque volet | Drag resize handles, double-click maximize, collapse buttons |
| FR40 | Timeline panneau bas persistant | TimelineBar component, 120px fixed at bottom |

### Dependencies on Story 1.1

Story 1.2 builds directly on the foundation established by Story 1.1. The following files and patterns from 1.1 MUST be reused:

| From Story 1.1 | Usage in Story 1.2 |
|---|---|
| `src/renderer/src/app.css` | Design tokens (`bg-base`, `bg-surface`, `border-default`, `text-primary`, etc.) already defined via `@theme` |
| `src/renderer/src/App.tsx` | Replace minimal shell with `<AppShell />` — keep the existing root structure |
| `electron.vite.config.ts` | Import aliases (`@renderer/`, `@shared/`) already configured |
| `src/renderer/src/shared/hooks/useEventBus.ts` | Reuse for panel resize events via mitt |
| `src/renderer/src/shared/hooks/useIpcInvoke.ts` | Available for future IPC calls (not directly used in 1.2 but pattern is set) |
| `src/renderer/src/shared/hooks/useIpcStream.ts` | Available for timeline events in later stories |
| `src/shared/events.ts` | `RendererEvents` includes `'panel:resize'` event type already declared |
| `components.json` | shadcn/ui already initialized (rsc=false, css-variables=yes). Components install to `src/renderer/src/components/ui/` |
| `vitest.config.ts` | Test config with jsdom environment, path aliases, co-located pattern |
| Naming conventions | PascalCase components, camelCase hooks, named exports only, no `export default` |

### shadcn/ui Components to Install

Run these commands from the project root directory:

```bash
npx shadcn@latest add resizable
npx shadcn@latest add tabs
npx shadcn@latest add scroll-area
npx shadcn@latest add toast
```

**`resizable`** is based on `react-resizable-panels` by Bryan Vaughn. It provides `ResizablePanelGroup`, `ResizablePanel`, and `ResizableHandle` components. This is the backbone of the 3-pane layout.

**`tabs`** is needed for the narrow breakpoint behavior (2 panes + tab toggle for the 3rd pane).

**`scroll-area`** wraps each pane's content area for consistent scrollbar styling.

**`toast`** (or `sonner` if shadcn defaults to it) is needed for future feedback patterns but should be installed now so the toast provider is in the layout.

### Layout Specifications

All values sourced from the UX Design Specification.

**Pane dimensions:**

| Pane | Min Width | Default | Max Width |
|---|---|---|---|
| Contexte (left) | 200px | 25% | 40% |
| Agents (center) | 400px | 50% | 70% |
| Tests (right) | 200px | 25% | 40% |

[Source: ux-design-specification.md#Breakpoint-Strategy]

**Timeline bar:**

| Property | Value |
|---|---|
| Min height | 80px |
| Default height | 120px |
| Max height | 200px |
| Width | 100% |
| Position | Bottom, persistent |

[Source: ux-design-specification.md#Spacing-&-Layout-Foundation]

**Breakpoint behavior:**

| Breakpoint | Width Range | Behavior |
|---|---|---|
| Full | >= 1440px | 3 panes visible, all labels, full timeline |
| Compact | 1280 - 1439px | 3 panes, icons without labels in pane headers, tooltips compensate |
| Narrow | 1024 - 1279px | 2 panes visible + tab toggle for 3rd pane, timeline reduced to status bar |
| Minimum | < 1024px | Full-viewport overlay: "Resolution insuffisante" — not supported |

[Source: ux-design-specification.md#Responsive-Strategy]

**Note on `react-resizable-panels` min/max:** The library uses percentage-based `minSize` and `maxSize` props. The pixel constraints from the UX spec must be converted to percentages based on the current container width. Use a `useEffect` + resize observer to recalculate constraints dynamically, or use the `minSize`/`maxSize` props with reasonable percentage equivalents (e.g., at 1440px, 200px = ~14%).

### Component Architecture

```
src/renderer/src/
├── App.tsx                              # Renders <AppShell />
├── shared/
│   └── layout/
│       ├── AppShell.tsx                 # Top-level: skip links + AppHeader + ThreePaneLayout + TimelineBar
│       ├── AppHeader.tsx                # Banner: project name + breadcrumb + badges (placeholders)
│       ├── ThreePaneLayout.tsx          # ResizablePanelGroup with 3 ResizablePanels
│       ├── ThreePaneLayout.test.tsx     # Unit tests for layout behavior
│       ├── TimelineBar.tsx              # Bottom bar, 120px, empty state
│       ├── PaneHeader.tsx               # Sub-component: title + collapse/maximize buttons
│       ├── PaneEmptyState.tsx           # Sub-component: illustration + text + optional CTA
│       └── MinResolutionOverlay.tsx     # Full-viewport overlay for < 1024px
├── stores/
│   ├── navigation.store.ts             # Panel sizes, collapsed/maximized state, breakpoint
│   └── navigation.store.test.ts        # Unit tests for store
└── components/
    └── ui/                             # shadcn/ui generated components
        ├── resizable.tsx               # Generated by shadcn add resizable
        ├── tabs.tsx                     # Generated by shadcn add tabs
        ├── scroll-area.tsx             # Generated by shadcn add scroll-area
        └── toast.tsx / sonner.tsx       # Generated by shadcn add toast
```

**`AppShell.tsx`** is the root layout component rendered by `App.tsx`. It orchestrates:
- Skip links (accessibility, visually hidden until focused)
- `<AppHeader />` at the top (48px fixed)
- `<ThreePaneLayout />` filling the remaining vertical space
- `<TimelineBar />` at the bottom (120px default)
- Window resize listener to update the breakpoint in the navigation store
- `<MinResolutionOverlay />` conditionally rendered when breakpoint is "minimum"
- Global keyboard shortcut listener for `1`/`2`/`3`/`Esc`

**`ThreePaneLayout.tsx`** wraps shadcn's `ResizablePanelGroup` (horizontal direction) with 3 `ResizablePanel` children separated by `ResizableHandle`. Each panel contains a `PaneHeader` and either feature content (later stories) or `PaneEmptyState` (this story). In narrow breakpoint, it switches to a 2-panel layout with shadcn `Tabs` to toggle the hidden pane.

**`TimelineBar.tsx`** is a horizontal region at the bottom. For Story 1.2, it renders only an empty state. Actual timeline events, scrubbing, and checkpoint navigation come in Story 2.4.

**`AppHeader.tsx`** is a thin header bar with placeholder content. The breadcrumb, project name, and summary badges will be populated by Stories 1.3 and 1.4.

### Zustand Store Pattern

```typescript
// src/renderer/src/stores/navigation.store.ts
import { create } from 'zustand';

type Breakpoint = 'full' | 'compact' | 'narrow' | 'minimum';

type PaneId = 'context' | 'agents' | 'tests';

type PaneSizes = {
  context: number; // percentage (0-100)
  agents: number;
  tests: number;
};

type NavigationState = {
  // Panel layout
  paneSizes: PaneSizes;
  collapsedPanes: Set<PaneId>;
  maximizedPane: PaneId | null;
  previousSizes: PaneSizes | null; // for restore after maximize

  // Breakpoint
  breakpoint: Breakpoint;

  // Timeline
  timelineHeight: number; // px

  // Actions
  setPaneSizes: (sizes: PaneSizes) => void;
  togglePane: (pane: PaneId) => void;
  maximizePane: (pane: PaneId) => void;
  restorePane: () => void;
  setBreakpoint: (bp: Breakpoint) => void;
  setTimelineHeight: (height: number) => void;
};

export const useNavigationStore = create<NavigationState>((set) => ({
  paneSizes: { context: 25, agents: 50, tests: 25 },
  collapsedPanes: new Set(),
  maximizedPane: null,
  previousSizes: null,
  breakpoint: 'full',
  timelineHeight: 120,

  setPaneSizes: (sizes) => set({ paneSizes: sizes }),

  togglePane: (pane) =>
    set((state) => {
      const next = new Set(state.collapsedPanes);
      if (next.has(pane)) {
        next.delete(pane);
      } else {
        next.add(pane);
      }
      return { collapsedPanes: next };
    }),

  maximizePane: (pane) =>
    set((state) => ({
      maximizedPane: pane,
      previousSizes: { ...state.paneSizes },
      paneSizes: {
        context: pane === 'context' ? 100 : 0,
        agents: pane === 'agents' ? 100 : 0,
        tests: pane === 'tests' ? 100 : 0,
      },
    })),

  restorePane: () =>
    set((state) => ({
      maximizedPane: null,
      paneSizes: state.previousSizes ?? { context: 25, agents: 50, tests: 25 },
      previousSizes: null,
    })),

  setBreakpoint: (bp) => set({ breakpoint: bp }),

  setTimelineHeight: (height) =>
    set({ timelineHeight: Math.min(200, Math.max(80, height)) }),
}));
```

**Rules:**
- One store per feature (this is the `navigation` store, shared between features)
- Actions live inside the store, not externally
- Immutable updates only (never mutate state directly)
- Use `useShallow` for multi-value selectors to avoid unnecessary re-renders

[Source: architecture.md#Communication-Patterns]

### Component Structure Pattern

```tsx
// src/renderer/src/shared/layout/ThreePaneLayout.tsx
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@renderer/components/ui/resizable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { PaneHeader } from '@renderer/shared/layout/PaneHeader';
import { PaneEmptyState } from '@renderer/shared/layout/PaneEmptyState';
import { useNavigationStore } from '@renderer/stores/navigation.store';

type ThreePaneLayoutProps = {
  contextContent?: React.ReactNode;
  agentsContent?: React.ReactNode;
  testsContent?: React.ReactNode;
};

export function ThreePaneLayout({
  contextContent,
  agentsContent,
  testsContent,
}: ThreePaneLayoutProps) {
  const { paneSizes, maximizedPane, breakpoint, setPaneSizes, maximizePane, restorePane } =
    useNavigationStore();

  const handleLayout = (sizes: number[]) => {
    setPaneSizes({
      context: sizes[0],
      agents: sizes[1],
      tests: sizes[2],
    });
  };

  const handleDoubleClick = (pane: 'context' | 'agents' | 'tests') => {
    if (maximizedPane === pane) {
      restorePane();
    } else {
      maximizePane(pane);
    }
  };

  if (breakpoint === 'narrow') {
    // Render 2 panes + Tabs toggle for 3rd
    return <NarrowLayout /* ... */ />;
  }

  return (
    <ResizablePanelGroup direction="horizontal" onLayout={handleLayout}>
      <ResizablePanel
        id="pane-context"
        defaultSize={25}
        minSize={14} // ~200px at 1440px
        maxSize={40}
        order={1}
      >
        <PaneHeader
          title="Contexte"
          onDoubleClick={() => handleDoubleClick('context')}
        />
        <ScrollArea className="flex-1">
          {contextContent ?? (
            <PaneEmptyState
              title="Aucun fichier de contexte"
              description="Ouvrez un projet pour voir les fichiers"
            />
          )}
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        id="pane-agents"
        defaultSize={50}
        minSize={28} // ~400px at 1440px
        maxSize={70}
        order={2}
      >
        <PaneHeader
          title="Agents"
          onDoubleClick={() => handleDoubleClick('agents')}
        />
        <ScrollArea className="flex-1">
          {agentsContent ?? (
            <PaneEmptyState
              title="Aucun agent actif"
              description="Lancez un agent pour commencer"
            />
          )}
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        id="pane-tests"
        defaultSize={25}
        minSize={14} // ~200px at 1440px
        maxSize={40}
        order={3}
      >
        <PaneHeader
          title="Tests & Validation"
          onDoubleClick={() => handleDoubleClick('tests')}
        />
        <ScrollArea className="flex-1">
          {testsContent ?? (
            <PaneEmptyState
              title="Aucun test disponible"
              description="Les tests apparaitront une fois le projet charge"
            />
          )}
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

### AppShell Structure Pattern

```tsx
// src/renderer/src/shared/layout/AppShell.tsx
import { useEffect, useCallback } from 'react';
import { AppHeader } from '@renderer/shared/layout/AppHeader';
import { ThreePaneLayout } from '@renderer/shared/layout/ThreePaneLayout';
import { TimelineBar } from '@renderer/shared/layout/TimelineBar';
import { MinResolutionOverlay } from '@renderer/shared/layout/MinResolutionOverlay';
import { useNavigationStore } from '@renderer/stores/navigation.store';

function getBreakpoint(width: number) {
  if (width < 1024) return 'minimum' as const;
  if (width < 1280) return 'narrow' as const;
  if (width < 1440) return 'compact' as const;
  return 'full' as const;
}

export function AppShell() {
  const { breakpoint, setBreakpoint } = useNavigationStore();

  useEffect(() => {
    const handleResize = () => {
      setBreakpoint(getBreakpoint(window.innerWidth));
    };
    handleResize(); // initial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setBreakpoint]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.key) {
        case '1':
          document.getElementById('pane-context')?.focus();
          break;
        case '2':
          document.getElementById('pane-agents')?.focus();
          break;
        case '3':
          document.getElementById('pane-tests')?.focus();
          break;
        case 'Escape':
          // Placeholder: navigate up one level (Story 1.4)
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-bg-base text-text-primary">
      {/* Skip links */}
      <a href="#pane-context" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-accent focus:text-white">
        Aller au volet Contexte
      </a>
      <a href="#pane-agents" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-accent focus:text-white">
        Aller au volet Agents
      </a>
      <a href="#pane-tests" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-accent focus:text-white">
        Aller au volet Tests
      </a>
      <a href="#timeline-bar" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-accent focus:text-white">
        Aller a la timeline
      </a>

      <AppHeader />

      <main className="flex-1 overflow-hidden">
        <ThreePaneLayout />
      </main>

      <TimelineBar />

      {breakpoint === 'minimum' && <MinResolutionOverlay />}
    </div>
  );
}
```

### Keyboard Shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| `1` | Focus pane Contexte | Global (when no input focused) |
| `2` | Focus pane Agents | Global (when no input focused) |
| `3` | Focus pane Tests | Global (when no input focused) |
| `Esc` | Go back / up one level | Global (placeholder in Story 1.2, implemented in Story 1.4) |

[Source: ux-design-specification.md#Keyboard-Shortcuts]

**Implementation note:** Keyboard shortcuts MUST check that the active element is not an `<input>`, `<textarea>`, or `contentEditable` before firing. Use `e.target` inspection in the keydown handler.

### Accessibility Requirements

| Requirement | Implementation |
|---|---|
| Skip links | 4 visually-hidden links at top of `AppShell`, visible on focus, linking to `#pane-context`, `#pane-agents`, `#pane-tests`, `#timeline-bar` |
| Tab order | Left pane -> Center pane -> Right pane -> Timeline bar (natural DOM order) |
| ARIA landmarks | `<header role="banner">` for AppHeader, `<main>` for ThreePaneLayout, `<footer role="contentinfo">` or `role="region"` with label for TimelineBar |
| Focus visible | 2px ring using `--accent` color on all interactive elements (inherited from shadcn/Radix defaults) |
| `tabindex` | Each pane wrapper should have `tabindex="0"` so `1`/`2`/`3` shortcuts can focus them |
| Screen readers | Pane headers have descriptive text; resize handles have `aria-label="Redimensionner"` |
| `prefers-reduced-motion` | All transition/animation CSS wrapped in `@media (prefers-reduced-motion: no-preference)` |

[Source: ux-design-specification.md#Accessibility-Strategy]
[Source: ux-design-specification.md#Implementation-Guidelines]

### Animation & Transitions

| Animation | Duration | Easing | Condition |
|---|---|---|---|
| Pane resize transition | 150ms | ease-out | Only on maximize/restore, not during drag |
| Badge status change | 200ms | fade | Not applicable in this story (no badges yet) |
| New list item | 150ms | slide-in + fade | Not applicable in this story |
| Element disappear | 200ms | fade-out | Not applicable in this story |
| Toast appear | 200ms | slide-in right | Toast provider setup only |

**`prefers-reduced-motion` support:** All CSS transitions and animations MUST be wrapped in:

```css
@media (prefers-reduced-motion: no-preference) {
  .pane-transition {
    transition: flex-basis 150ms ease-out;
  }
}
```

When `prefers-reduced-motion: reduce` is active, all changes are instantaneous.

[Source: ux-design-specification.md#Real-Time-Update-Patterns]

### Empty States

Each pane and the timeline bar must show a meaningful empty state — never a blank white/dark area.

| Component | Empty State Text | Description |
|---|---|---|
| Contexte pane | "Aucun fichier de contexte" | "Ouvrez un projet pour voir les fichiers" |
| Agents pane | "Aucun agent actif" | "Lancez un agent pour commencer" |
| Tests pane | "Aucun test disponible" | "Les tests apparaitront une fois le projet charge" |
| TimelineBar | "Aucune activite" | "L'activite des agents apparaitra ici" |

Each empty state includes:
1. A placeholder illustration area (simple SVG icon or Lucide icon, muted color)
2. A title (`text-text-secondary`, `text-md`)
3. A description (`text-text-muted`, `text-sm`)
4. An optional action button (ghost style) for future use

[Source: ux-design-specification.md#Empty-States-&-Loading]

### Design Tokens Reference

All design tokens are already defined in `src/renderer/src/app.css` from Story 1.1. Use Tailwind utility classes referencing these tokens:

| Tailwind Class | Token | Usage in Story 1.2 |
|---|---|---|
| `bg-bg-base` | `#0a0a0b` | AppShell background |
| `bg-bg-surface` | `#141416` | Pane backgrounds, AppHeader, TimelineBar |
| `bg-bg-elevated` | `#1e1e22` | Hover states, PaneHeader active |
| `border-border-default` | `#27272a` | Resize handles, pane borders |
| `border-border-active` | `#3f3f46` | Focused pane border |
| `text-text-primary` | `#fafafa` | Pane titles, main text |
| `text-text-secondary` | `#a1a1aa` | Empty state titles |
| `text-text-muted` | `#71717a` | Empty state descriptions, metadata |
| `bg-accent` | `#3b82f6` | Skip link focus background, focus ring |
| `font-sans` | Inter | All UI text |
| `font-mono` | JetBrains Mono | Timeline timestamps (future) |

[Source: ux-design-specification.md#Color-System]
[Source: 1-1-project-scaffold-ipc-bridge-event-bus.md#Tailwind-CSS-4-Setup]

### Naming Conventions (must follow)

| Element | Convention | Example |
|---|---|---|
| React components | PascalCase.tsx | `ThreePaneLayout.tsx` |
| Hooks | camelCase, prefix `use` | `useNavigationStore` (via Zustand) |
| Zustand stores | camelCase + `.store.ts` | `navigation.store.ts` |
| Types | PascalCase for type names | `type PaneId = ...` |
| Tests | same name + `.test.ts(x)` co-located | `ThreePaneLayout.test.tsx` |
| CSS classes | Tailwind utilities only | `bg-bg-surface text-text-primary` |
| Exports | Named exports only | `export function AppShell() {}` |
| IDs | kebab-case | `pane-context`, `timeline-bar` |

[Source: architecture.md#Naming-Patterns]

### What NOT to Do

- **Do NOT implement content inside the panes.** Pane content (agent cards, context file cards, test hierarchy) comes in Stories 1.3, 1.4, 2.x, 3.x, 7.x. Story 1.2 renders only empty states inside each pane.
- **Do NOT add feature-specific Zustand stores** (agents.store.ts, drift.store.ts, etc.). Only `navigation.store.ts` is created in this story.
- **Do NOT implement actual timeline events, checkpoints, or scrubbing.** TimelineBar in Story 1.2 is an empty shell. Timeline functionality comes in Story 2.4.
- **Do NOT implement the breadcrumb or project name in AppHeader.** Use placeholder text. Real breadcrumb comes in Story 1.4.
- **Do NOT implement the NavigationSidebar.** The sidebar for hierarchical navigation comes in Story 1.4.
- **Do NOT implement the Command palette (Cmd+K).** That's a separate concern.
- **Do NOT use `export default`.** Named exports only.
- **Do NOT use `any` type.** Use `unknown` + type guards.
- **Do NOT hardcode color values.** Always use Tailwind utility classes referencing design tokens.
- **Do NOT use `forwardRef`.** React 19 supports `ref` as a regular prop.
- **Do NOT create `tailwind.config.ts`.** Tailwind 4 uses CSS-only config via `@theme` (already set up in Story 1.1).

### Testing Strategy

- **Unit tests for navigation store:** Verify `setPaneSizes`, `maximizePane`, `restorePane`, `togglePane`, `setBreakpoint` actions produce correct state.
- **Unit tests for ThreePaneLayout:** Use `@testing-library/react` to verify:
  - 3 panes render with correct default content
  - Empty states appear when no content is provided
  - Pane headers display correct titles
- **Unit tests for AppShell:** Verify skip links are present, keyboard shortcuts register.
- **Manual verification:** Resize window through all 4 breakpoints, verify pane resize constraints, verify double-click maximize/restore.

### References

- [Source: epics.md#Story-1.2] — User story, acceptance criteria
- [Source: architecture.md#Frontend-Component-Architecture] — `shared/layout/` directory, component structure
- [Source: architecture.md#Complete-Project-Directory-Structure] — `AppShell.tsx`, `ThreePaneLayout.tsx`, `TimelineBar.tsx` file paths
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, `navigation.store.ts`
- [Source: architecture.md#Naming-Patterns] — All naming conventions
- [Source: architecture.md#Architectural-Boundaries] — Feature isolation rules
- [Source: ux-design-specification.md#Spacing-&-Layout-Foundation] — 3-pane default sizes, timeline height
- [Source: ux-design-specification.md#Breakpoint-Strategy] — Pane min/max constraints, breakpoint behavior
- [Source: ux-design-specification.md#Responsive-Strategy] — Desktop-only, 4 breakpoints
- [Source: ux-design-specification.md#Implementation-Guidelines] — ResizablePanel usage, CSS Container Queries, skip links, tabindex order
- [Source: ux-design-specification.md#Keyboard-Shortcuts] — `1`/`2`/`3` focus panes, `Esc` go back
- [Source: ux-design-specification.md#Accessibility-Strategy] — WCAG 2.1 AA, focus visible, ARIA landmarks
- [Source: ux-design-specification.md#Empty-States-&-Loading] — Never blank screens, empty state pattern
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Animation durations, `prefers-reduced-motion`
- [Source: ux-design-specification.md#Color-System] — All color tokens
- [Source: ux-design-specification.md#Typography-System] — Font sizes, weights
- [Source: ux-design-specification.md#Design-System-Foundation] — shadcn/ui selection, Resizable component
- [Source: ux-design-specification.md#Component-Strategy] — Custom components list, shadcn components list
- [Source: ux-design-specification.md#Implementation-Approach] — AppHeader, ThreePaneLayout, TimelineBar descriptions
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — Foundation: aliases, hooks, tokens, app.css, shadcn init

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
