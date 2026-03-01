# Story 5.1: Cockpit Dashboard Layout

Status: ready-for-dev

## Story

As a **user**,
I want **to see a cockpit dashboard when I open MnM showing the overall health of my project**,
So that **I understand project state at a glance without clicking anything**.

## Acceptance Criteria

### AC1 — Dashboard visible at project open and on "Projet" level

**Given** un projet est ouvert
**When** MnM s'ouvre (ou je clique sur le niveau "Projet" dans la sidebar)
**Then** le cockpit dashboard s'affiche dans le volet central
**And** le dashboard est visible en < 5 secondes apres le cold start (NFR5)

### AC2 — ProjectHealthSummary with global indicators

**Given** le cockpit est affiche
**When** je regarde la vue d'ensemble
**Then** je vois : un `ProjectHealthSummary` avec indicateur global (vert/orange/rouge), le nombre d'agents actifs, le nombre d'alertes drift en cours, la progression des stories

### AC3 — Skeleton loading state (never blank screen)

**Given** les donnees du projet ne sont pas encore chargees
**When** le cockpit est en cours de chargement
**Then** des skeletons animes s'affichent a la place des widgets
**And** jamais d'ecran blanc

## Tasks / Subtasks

- [ ] Task 1: Create dashboard feature folder structure (AC: #1, #2, #3)
  - [ ] 1.1 Create `src/renderer/src/features/dashboard/` folder with `components/`, `hooks/`, and `index.ts` barrel file
  - [ ] 1.2 Create `src/renderer/src/features/dashboard/dashboard.types.ts` with `DashboardData`, `ProjectHealth`, `WidgetProps` types

- [ ] Task 2: Implement CockpitDashboard layout component (AC: #1, #2)
  - [ ] 2.1 Create `src/renderer/src/features/dashboard/components/CockpitDashboard.tsx` — grid layout container for all widgets
  - [ ] 2.2 Implement CSS Grid layout: 2-column grid for widgets at top, full-width `StoriesProgress` below
  - [ ] 2.3 Create `src/renderer/src/features/dashboard/components/CockpitDashboard.test.tsx` — renders all widget slots, matches snapshot
  - [ ] 2.4 Create `src/renderer/src/features/dashboard/components/WidgetCard.tsx` — reusable card wrapper for each widget (title, icon, content area)

- [ ] Task 3: Implement ProjectHealthSummary widget (AC: #2)
  - [ ] 3.1 Create `src/renderer/src/features/dashboard/components/ProjectHealthSummary.tsx` — global health indicator + summary badges
  - [ ] 3.2 Implement health computation logic: all green = healthy, any orange = warning, any red = critical
  - [ ] 3.3 Display summary badges: agents count, drift alerts count, stories progress percentage
  - [ ] 3.4 Create `src/renderer/src/features/dashboard/components/ProjectHealthSummary.test.tsx` — test all health states

- [ ] Task 4: Implement useDashboardData hook (AC: #1, #2, #3)
  - [ ] 4.1 Create `src/renderer/src/features/dashboard/hooks/useDashboardData.ts` — aggregates data from `agents.store.ts`, `drift.store.ts`, and stories IPC
  - [ ] 4.2 Return `AsyncState<DashboardData>` for proper loading/error states
  - [ ] 4.3 Subscribe to IPC streams for real-time updates (`stream:agent-status`, `stream:drift-alert`)
  - [ ] 4.4 Create `src/renderer/src/features/dashboard/hooks/useDashboardData.test.ts` — test loading, success, error states

- [ ] Task 5: Implement skeleton loading states (AC: #3)
  - [ ] 5.1 Create `src/renderer/src/features/dashboard/components/DashboardSkeleton.tsx` — animated skeleton placeholders matching widget layout
  - [ ] 5.2 Use Tailwind `animate-pulse` on skeleton elements
  - [ ] 5.3 Create `src/renderer/src/features/dashboard/components/DashboardSkeleton.test.tsx` — renders without error

- [ ] Task 6: Integrate dashboard with navigation store (AC: #1)
  - [ ] 6.1 Update `src/renderer/src/App.tsx` (or routing logic) to render `CockpitDashboard` when navigation level is `'project'`
  - [ ] 6.2 Read navigation level from `navigation.store.ts` — when `level === 'project'`, display dashboard in central pane
  - [ ] 6.3 Ensure clicking "Projet" in sidebar breadcrumb switches to dashboard view

- [ ] Task 7: Accessibility & responsive (AC: #1, #2, #3)
  - [ ] 7.1 Add `role="region"` and `aria-label` to dashboard and each widget section
  - [ ] 7.2 Ensure keyboard tab order flows logically through widgets
  - [ ] 7.3 Add `aria-live="polite"` on summary badges for real-time counter updates
  - [ ] 7.4 Implement responsive grid: 2 columns at >= 1440px, 1 column at narrow breakpoints
  - [ ] 7.5 Respect `prefers-reduced-motion` — disable skeleton pulse animation

## Dev Notes

### FRs Covered

- **FR21** — L'utilisateur peut voir un dashboard cockpit a l'ouverture de MnM avec la sante globale du projet

### Dependencies on Previous Stories

- **Story 1.1** — Project scaffold, IPC bridge, event bus, shared types (`AppError`, `AsyncState<T>`)
- **Story 1.2** — Three-pane layout (`ThreePaneLayout.tsx`) — dashboard renders in the central pane
- **Story 1.3** — Open project & BMAD detection — project must be loaded for dashboard data
- **Story 1.4** — Navigation store (`navigation.store.ts`) — dashboard displays when `level === 'project'`
- **Story 2.2** — Agent store (`agents.store.ts`) — provides agent count/status data
- **Story 4.1** — Drift store (`drift.store.ts`) — provides drift alert count data

### Feature Folder Structure

```
src/renderer/src/features/dashboard/
├── components/
│   ├── CockpitDashboard.tsx          # Main dashboard grid container
│   ├── CockpitDashboard.test.tsx
│   ├── ProjectHealthSummary.tsx      # Global health + summary badges
│   ├── ProjectHealthSummary.test.tsx
│   ├── WidgetCard.tsx                # Reusable widget wrapper
│   ├── WidgetCard.test.tsx
│   ├── DashboardSkeleton.tsx         # Loading skeleton state
│   ├── DashboardSkeleton.test.tsx
│   ├── AgentsSummaryWidget.tsx       # (Story 5.2)
│   ├── DriftSummaryWidget.tsx        # (Story 5.2)
│   └── StoriesProgress.tsx           # (Story 5.3)
├── hooks/
│   ├── useDashboardData.ts           # Aggregated dashboard data hook
│   ├── useDashboardData.test.ts
│   └── useStoriesProgress.ts         # (Story 5.3)
├── dashboard.types.ts
└── index.ts                          # Barrel: export { CockpitDashboard }
```

### Dashboard Types

```typescript
// src/renderer/src/features/dashboard/dashboard.types.ts
import type { AsyncState } from '@shared/types/async-state.types';

export type ProjectHealth = 'healthy' | 'warning' | 'critical';

export type DashboardData = {
  health: ProjectHealth;
  agentsSummary: {
    total: number;
    active: number;
    blocked: number;
    terminated: number;
  };
  driftSummary: {
    total: number;
    critical: number;
    warning: number;
  };
  storiesSummary: {
    total: number;
    completed: number;
    inProgress: number;
    ratio: number; // 0.0 to 1.0
  };
};

export type DashboardState = AsyncState<DashboardData>;

export type WidgetCardProps = {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};
```

### CockpitDashboard Component Pattern

```typescript
// src/renderer/src/features/dashboard/components/CockpitDashboard.tsx
import { useDashboardData } from '../hooks/useDashboardData';
import { ProjectHealthSummary } from './ProjectHealthSummary';
import { DashboardSkeleton } from './DashboardSkeleton';

export function CockpitDashboard() {
  const dashboardState = useDashboardData();

  if (dashboardState.status === 'loading') {
    return <DashboardSkeleton />;
  }

  if (dashboardState.status === 'error') {
    return (
      <div role="alert" className="p-6 text-status-red">
        {dashboardState.error.message}
      </div>
    );
  }

  if (dashboardState.status === 'idle') {
    return <DashboardSkeleton />;
  }

  const { data } = dashboardState;

  return (
    <div
      role="region"
      aria-label="Cockpit Dashboard"
      className="grid grid-cols-1 2xl:grid-cols-2 gap-4 p-6"
    >
      <div className="col-span-full">
        <ProjectHealthSummary
          health={data.health}
          agents={data.agentsSummary}
          drifts={data.driftSummary}
          stories={data.storiesSummary}
        />
      </div>

      {/* Agent widget slot — Story 5.2 */}
      <div id="widget-agents" />

      {/* Drift widget slot — Story 5.2 */}
      <div id="widget-drift" />

      {/* Stories progress — Story 5.3, full width */}
      <div id="widget-stories" className="col-span-full" />
    </div>
  );
}
```

### ProjectHealthSummary Pattern

```typescript
// src/renderer/src/features/dashboard/components/ProjectHealthSummary.tsx
import type { ProjectHealth, DashboardData } from '../dashboard.types';

type ProjectHealthSummaryProps = {
  health: ProjectHealth;
  agents: DashboardData['agentsSummary'];
  drifts: DashboardData['driftSummary'];
  stories: DashboardData['storiesSummary'];
};

const HEALTH_COLORS: Record<ProjectHealth, string> = {
  healthy: 'bg-status-green',
  warning: 'bg-status-orange',
  critical: 'bg-status-red',
};

const HEALTH_LABELS: Record<ProjectHealth, string> = {
  healthy: 'Projet sain',
  warning: 'Attention requise',
  critical: 'Action urgente',
};

export function ProjectHealthSummary({
  health,
  agents,
  drifts,
  stories,
}: ProjectHealthSummaryProps) {
  return (
    <div className="flex items-center gap-6 rounded-lg bg-bg-surface p-4 border border-border-default">
      {/* Global health indicator */}
      <div className="flex items-center gap-3">
        <div
          className={`h-4 w-4 rounded-full ${HEALTH_COLORS[health]}`}
          role="img"
          aria-label={HEALTH_LABELS[health]}
        />
        <span className="text-md font-medium text-text-primary">
          {HEALTH_LABELS[health]}
        </span>
      </div>

      {/* Summary badges */}
      <div className="flex gap-4" aria-live="polite">
        <SummaryBadge label="Agents actifs" value={agents.active} />
        <SummaryBadge label="Agents bloques" value={agents.blocked} variant="critical" />
        <SummaryBadge label="Alertes drift" value={drifts.total} variant={drifts.critical > 0 ? 'critical' : 'default'} />
        <SummaryBadge label="Stories" value={`${Math.round(stories.ratio * 100)}%`} />
      </div>
    </div>
  );
}

type SummaryBadgeProps = {
  label: string;
  value: number | string;
  variant?: 'default' | 'critical';
};

function SummaryBadge({ label, value, variant = 'default' }: SummaryBadgeProps) {
  const textColor = variant === 'critical' && value !== 0
    ? 'text-status-red'
    : 'text-text-primary';

  return (
    <div className="flex flex-col items-center">
      <span className={`text-lg font-semibold ${textColor}`}>{value}</span>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
```

### WidgetCard Reusable Wrapper

```typescript
// src/renderer/src/features/dashboard/components/WidgetCard.tsx
import type { WidgetCardProps } from '../dashboard.types';

export function WidgetCard({ title, icon, children, className = '' }: WidgetCardProps) {
  return (
    <section
      aria-label={title}
      className={`rounded-lg bg-bg-surface border border-border-default p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-3 border-b border-border-default pb-2">
        {icon && <span className="text-text-muted">{icon}</span>}
        <h3 className="text-md font-medium text-text-primary">{title}</h3>
      </div>
      <div>{children}</div>
    </section>
  );
}
```

### useDashboardData Hook Pattern

```typescript
// src/renderer/src/features/dashboard/hooks/useDashboardData.ts
import { useEffect, useState, useCallback } from 'react';
import { useAgentsStore } from '@renderer/features/agents/agents.store';
import { useDriftStore } from '@renderer/features/drift/drift.store';
import type { DashboardData, DashboardState, ProjectHealth } from '../dashboard.types';

function computeHealth(agents: DashboardData['agentsSummary'], drifts: DashboardData['driftSummary']): ProjectHealth {
  if (agents.blocked > 0 || drifts.critical > 0) return 'critical';
  if (drifts.warning > 0) return 'warning';
  return 'healthy';
}

export function useDashboardData(): DashboardState {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });

  const agents = useAgentsStore((s) => s.agents);
  const driftAlerts = useDriftStore((s) => s.alerts);

  const refresh = useCallback(() => {
    try {
      const agentsList = Array.from(agents.values());
      const agentsSummary = {
        total: agentsList.length,
        active: agentsList.filter((a) => a.status === 'active').length,
        blocked: agentsList.filter((a) => a.status === 'blocked').length,
        terminated: agentsList.filter((a) => a.status === 'terminated').length,
      };

      const alertsList = Array.from(driftAlerts.values());
      const driftSummary = {
        total: alertsList.length,
        critical: alertsList.filter((a) => a.severity === 'critical').length,
        warning: alertsList.filter((a) => a.severity === 'warning').length,
      };

      // Stories summary will be populated by Story 5.3
      const storiesSummary = { total: 0, completed: 0, inProgress: 0, ratio: 0 };

      const data: DashboardData = {
        health: computeHealth(agentsSummary, driftSummary),
        agentsSummary,
        driftSummary,
        storiesSummary,
      };

      setState({ status: 'success', data });
    } catch (err) {
      setState({
        status: 'error',
        error: {
          code: 'DASHBOARD_LOAD_FAILED',
          message: 'Impossible de charger les donnees du cockpit',
          source: 'dashboard',
          details: err,
        },
      });
    }
  }, [agents, driftAlerts]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return state;
}
```

### Navigation Integration Pattern

```typescript
// In App.tsx or a routing component — conditional rendering based on navigation level
import { useNavigationStore } from '@renderer/stores/navigation.store';
import { CockpitDashboard } from '@renderer/features/dashboard';

export function CentralPane() {
  const level = useNavigationStore((s) => s.level);

  if (level === 'project') {
    return <CockpitDashboard />;
  }

  // ... other views (agent detail, story detail, etc.)
  return <ThreePaneContent />;
}
```

### DashboardSkeleton Pattern

```typescript
// src/renderer/src/features/dashboard/components/DashboardSkeleton.tsx
export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Chargement du cockpit"
      className="grid grid-cols-1 2xl:grid-cols-2 gap-4 p-6"
    >
      {/* Health summary skeleton */}
      <div className="col-span-full rounded-lg bg-bg-surface border border-border-default p-4">
        <div className="flex items-center gap-6">
          <div className="h-4 w-4 rounded-full bg-border-default animate-pulse" />
          <div className="h-5 w-40 rounded bg-border-default animate-pulse" />
          <div className="flex gap-4 ml-auto">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-6 w-10 rounded bg-border-default animate-pulse" />
                <div className="h-3 w-16 rounded bg-border-default animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Widget skeletons */}
      <WidgetSkeleton />
      <WidgetSkeleton />

      {/* Stories skeleton — full width */}
      <div className="col-span-full rounded-lg bg-bg-surface border border-border-default p-4 h-48 animate-pulse" />

      <span className="sr-only">Chargement en cours...</span>
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <div className="rounded-lg bg-bg-surface border border-border-default p-4">
      <div className="h-5 w-32 rounded bg-border-default animate-pulse mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded bg-border-default animate-pulse" />
        ))}
      </div>
    </div>
  );
}
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Feature folder | kebab-case | `features/dashboard/` |
| Components | PascalCase.tsx | `CockpitDashboard.tsx` |
| Hooks | camelCase, prefix `use` | `useDashboardData.ts` |
| Types file | kebab-case + `.types.ts` | `dashboard.types.ts` |
| Tests | same name + `.test.ts(x)` co-located | `CockpitDashboard.test.tsx` |
| Barrel | `index.ts` | Exports `CockpitDashboard` |

### Testing Strategy

- **Unit tests** for `useDashboardData` hook: test `loading`, `success`, `error` states with mocked stores
- **Unit tests** for `ProjectHealthSummary`: test all 3 health states (healthy/warning/critical), verify correct badges render
- **Unit tests** for `DashboardSkeleton`: renders without error, has `role="status"` and `aria-label`
- **Unit tests** for `WidgetCard`: renders title, children, optional icon
- **Integration test**: `CockpitDashboard` renders skeleton during loading, renders health summary on success, renders error message on failure
- **Accessibility tests**: `@testing-library/jest-dom` assertions — `.toHaveAccessibleName()`, verify `aria-live` regions
- **Co-located** — all test files next to their source files

### What NOT to Do

- Do NOT create a separate route/page for the dashboard — it renders in the central pane of `ThreePaneLayout` when navigation level is `'project'`
- Do NOT implement the Agents widget content — that is Story 5.2
- Do NOT implement the Drift widget content — that is Story 5.2
- Do NOT implement `StoriesProgress` — that is Story 5.3
- Do NOT implement click navigation from widgets — that is Story 5.4
- Do NOT use `export default` — named exports only
- Do NOT use `any` — use `unknown` + type guards
- Do NOT create a separate Zustand store for dashboard — use `useDashboardData` hook aggregating from existing stores
- Do NOT use polling for data refresh — use reactive store subscriptions and IPC streams
- Do NOT hardcode color values — use Tailwind design tokens (`bg-status-green`, `text-text-primary`, etc.)
- Do NOT skip skeleton states — NFR5 requires < 5s cold start with visual feedback during load

### References

- [Source: epics.md#Story-5.1] — Full acceptance criteria
- [Source: architecture.md#Frontend-Component-Architecture] — Feature folder structure, `features/dashboard/`
- [Source: architecture.md#Complete-Project-Directory-Structure] — Dashboard component list (`CockpitDashboard`, `ProjectHealthSummary`, `AlertsSummary`, `StoriesProgress`)
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, `AsyncState<T>` usage
- [Source: architecture.md#Requirements-to-Structure-Mapping] — FR21-FR24 mapped to `features/dashboard/`
- [Source: ux-design-specification.md#Defining-Core-Experience] — "Cockpit Glance" < 5 seconds, glance-first principle
- [Source: ux-design-specification.md#Design-Direction-Decision] — Hybrid Cockpit direction C (density/space balance)
- [Source: ux-design-specification.md#Empty-States-Loading] — Skeleton placeholders, never blank screen
- [Source: ux-design-specification.md#Color-System] — Status colors, background tokens
- [Source: ux-design-specification.md#Component-Strategy] — `StoriesProgress` custom component spec
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Badge fade 200ms, number animation 300ms
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — Base patterns (IPC hooks, event bus, TypeScript rules)

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
