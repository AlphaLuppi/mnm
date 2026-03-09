# Story 5.2: Agents Actifs & Alertes Drift dans le Cockpit

Status: ready-for-dev

## Story

As a **user**,
I want **to see active agents with their status and current drift alerts directly in the cockpit**,
So that **I know immediately if something needs my attention**.

## Acceptance Criteria

### AC1 — Agents widget with status summary

**Given** le cockpit est affiche
**When** des agents sont actifs
**Then** je vois un widget "Agents" avec : nombre d'agents par statut (actif/bloque/termine), les `HealthIndicator` des agents actifs, le nom et la tache de chaque agent (FR22)

### AC2 — Drift widget with alert summary

**Given** le cockpit est affiche
**When** des alertes drift sont en cours
**Then** je vois un widget "Drift" avec : nombre total d'alertes, les alertes triees par confiance, un resume de chaque drift (paire de documents + score) (FR22)

### AC3 — Real-time widget updates

**Given** les agents ou les drifts changent d'etat
**When** une mise a jour arrive
**Then** les widgets se mettent a jour en temps reel (badges fade 200ms, compteurs animes 300ms)

### AC4 — Empty state for agents widget

**Given** aucun agent n'est actif
**When** je regarde le widget Agents
**Then** un empty state s'affiche : "Aucun agent actif" + bouton "Lancer un agent"

### AC5 — Empty state for drift widget

**Given** aucun drift n'est detecte
**When** je regarde le widget Drift
**Then** un empty state s'affiche : indicateur vert + "Aucun drift detecte"

## Tasks / Subtasks

- [ ] Task 1: Implement AgentsSummaryWidget component (AC: #1, #4)
  - [ ] 1.1 Create `src/renderer/src/features/dashboard/components/AgentsSummaryWidget.tsx` — widget showing agent count by status
  - [ ] 1.2 Display agent count badges: active (green), blocked (red), terminated (gray)
  - [ ] 1.3 Render a compact `HealthIndicator` + agent name + task label for each active agent (max 5 visible, scroll for more)
  - [ ] 1.4 Implement empty state: "Aucun agent actif" illustration + "Lancer un agent" ghost button
  - [ ] 1.5 Create `src/renderer/src/features/dashboard/components/AgentsSummaryWidget.test.tsx` — test with agents, without agents, mixed statuses

- [ ] Task 2: Implement DriftSummaryWidget component (AC: #2, #5)
  - [ ] 2.1 Create `src/renderer/src/features/dashboard/components/DriftSummaryWidget.tsx` — widget showing drift alert summary
  - [ ] 2.2 Display total count badge + breakdown by severity (critical red, warning orange)
  - [ ] 2.3 Render compact drift alert items: document pair, confidence score, severity badge (sorted by confidence desc)
  - [ ] 2.4 Implement empty state: green `HealthIndicator` + "Aucun drift detecte"
  - [ ] 2.5 Create `src/renderer/src/features/dashboard/components/DriftSummaryWidget.test.tsx` — test with alerts, without alerts, sorted order

- [ ] Task 3: Implement useAgentsSummary hook (AC: #1, #3)
  - [ ] 3.1 Create `src/renderer/src/features/dashboard/hooks/useAgentsSummary.ts` — reads from `agents.store.ts`, computes per-status counts
  - [ ] 3.2 Return typed summary: `{ total, active, blocked, terminated, agents: AgentSummaryItem[] }`
  - [ ] 3.3 Subscribe to `stream:agent-status` for real-time updates
  - [ ] 3.4 Create `src/renderer/src/features/dashboard/hooks/useAgentsSummary.test.ts` — test count computation, empty state

- [ ] Task 4: Implement useDriftSummary hook (AC: #2, #3)
  - [ ] 4.1 Create `src/renderer/src/features/dashboard/hooks/useDriftSummary.ts` — reads from `drift.store.ts`, computes severity counts
  - [ ] 4.2 Return typed summary: `{ total, critical, warning, alerts: DriftSummaryItem[] }` sorted by confidence descending
  - [ ] 4.3 Subscribe to `stream:drift-alert` for real-time updates
  - [ ] 4.4 Create `src/renderer/src/features/dashboard/hooks/useDriftSummary.test.ts` — test count computation, sorting, empty state

- [ ] Task 5: Wire widgets into CockpitDashboard (AC: #1, #2)
  - [ ] 5.1 Import `AgentsSummaryWidget` and `DriftSummaryWidget` into `CockpitDashboard.tsx`
  - [ ] 5.2 Replace placeholder widget slots (`#widget-agents`, `#widget-drift`) with actual widget components wrapped in `WidgetCard`
  - [ ] 5.3 Update `useDashboardData` to include agents and drift summary in health computation

- [ ] Task 6: Implement real-time update animations (AC: #3)
  - [ ] 6.1 Add CSS transition classes for badge status changes: `transition-colors duration-200` (fade 200ms)
  - [ ] 6.2 Implement animated counter component for number changes (300ms ease-out transition)
  - [ ] 6.3 Create `src/renderer/src/features/dashboard/components/AnimatedCounter.tsx` — smoothly transitions between number values
  - [ ] 6.4 Respect `prefers-reduced-motion` — instant transitions when motion is reduced
  - [ ] 6.5 Create `src/renderer/src/features/dashboard/components/AnimatedCounter.test.tsx`

- [ ] Task 7: Accessibility (AC: #1, #2, #4, #5)
  - [ ] 7.1 Add `role="status"` and `aria-live="polite"` on agent count and drift count badges
  - [ ] 7.2 Add `aria-label` on each widget section ("Widget Agents", "Widget Drift")
  - [ ] 7.3 Ensure empty states are accessible: `role="status"` with descriptive text
  - [ ] 7.4 Ensure `HealthIndicator` has `role="img"` and `aria-label` describing the status (not color-only)
  - [ ] 7.5 Keyboard-navigable: Tab through agent items and drift alert items

## Dev Notes

### FRs Covered

- **FR22** — L'utilisateur peut voir le nombre d'agents actifs, leur statut, et les alertes de drift en cours depuis le cockpit

### Dependencies on Previous Stories

- **Story 5.1** — Dashboard layout, `CockpitDashboard`, `WidgetCard`, `DashboardSkeleton`
- **Story 2.2** — `agents.store.ts` with agent data, `HealthIndicator` component from `features/agents/`
- **Story 4.1** — `drift.store.ts` with drift alert data
- **Story 4.2** — `stream:drift-alert` IPC stream for real-time drift updates
- **Story 2.1** — `stream:agent-status` IPC stream for real-time agent updates
- **Story 1.1** — IPC hooks (`useIpcStream`), event bus, `AppError`, `AsyncState<T>`

### Dashboard Types (additions to dashboard.types.ts)

```typescript
// Add to src/renderer/src/features/dashboard/dashboard.types.ts

export type AgentSummaryItem = {
  id: string;
  name: string;
  task: string;
  status: 'active' | 'blocked' | 'stalled' | 'terminated';
  health: 'healthy' | 'warning' | 'critical' | 'inactive';
};

export type AgentsSummary = {
  total: number;
  active: number;
  blocked: number;
  terminated: number;
  agents: AgentSummaryItem[];
};

export type DriftSummaryItem = {
  id: string;
  documentA: string;
  documentB: string;
  confidence: number; // 0-100
  severity: 'critical' | 'warning' | 'info';
  summary: string;
};

export type DriftSummary = {
  total: number;
  critical: number;
  warning: number;
  alerts: DriftSummaryItem[];
};
```

### AgentsSummaryWidget Component Pattern

```typescript
// src/renderer/src/features/dashboard/components/AgentsSummaryWidget.tsx
import { WidgetCard } from './WidgetCard';
import { AnimatedCounter } from './AnimatedCounter';
import { useAgentsSummary } from '../hooks/useAgentsSummary';
import { HealthIndicator } from '@renderer/features/agents/components/AgentHealthBadge';

export function AgentsSummaryWidget() {
  const summary = useAgentsSummary();

  if (summary.total === 0) {
    return (
      <WidgetCard title="Agents">
        <div role="status" className="flex flex-col items-center gap-3 py-6 text-text-muted">
          <span className="text-sm">Aucun agent actif</span>
          <button className="text-sm text-accent hover:text-accent-hover transition-colors">
            Lancer un agent
          </button>
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Agents">
      {/* Status count badges */}
      <div className="flex gap-4 mb-3" aria-live="polite">
        <StatusCount label="Actifs" count={summary.active} color="text-status-green" />
        <StatusCount label="Bloques" count={summary.blocked} color="text-status-red" />
        <StatusCount label="Termines" count={summary.terminated} color="text-status-gray" />
      </div>

      {/* Agent list (compact) */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {summary.agents
          .filter((a) => a.status === 'active' || a.status === 'blocked')
          .map((agent) => (
            <button
              key={agent.id}
              className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-bg-elevated transition-colors"
              aria-label={`Agent ${agent.name}: ${agent.task}`}
            >
              <HealthIndicator health={agent.health} size={8} />
              <span className="text-sm text-text-primary truncate">{agent.name}</span>
              <span className="text-xs text-text-muted truncate ml-auto">{agent.task}</span>
            </button>
          ))}
      </div>
    </WidgetCard>
  );
}

type StatusCountProps = {
  label: string;
  count: number;
  color: string;
};

function StatusCount({ label, count, color }: StatusCountProps) {
  return (
    <div className="flex items-center gap-1.5">
      <AnimatedCounter value={count} className={`text-md font-semibold ${color}`} />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
```

### DriftSummaryWidget Component Pattern

```typescript
// src/renderer/src/features/dashboard/components/DriftSummaryWidget.tsx
import { WidgetCard } from './WidgetCard';
import { AnimatedCounter } from './AnimatedCounter';
import { useDriftSummary } from '../hooks/useDriftSummary';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-status-red/20 text-status-red',
  warning: 'bg-status-orange/20 text-status-orange',
  info: 'bg-border-default text-text-muted',
};

export function DriftSummaryWidget() {
  const summary = useDriftSummary();

  if (summary.total === 0) {
    return (
      <WidgetCard title="Drift">
        <div role="status" className="flex items-center gap-3 py-6 justify-center">
          <div
            className="h-3 w-3 rounded-full bg-status-green"
            role="img"
            aria-label="Aucun drift"
          />
          <span className="text-sm text-text-muted">Aucun drift detecte</span>
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Drift">
      {/* Severity count badges */}
      <div className="flex gap-4 mb-3" aria-live="polite">
        <div className="flex items-center gap-1.5">
          <AnimatedCounter value={summary.total} className="text-md font-semibold text-text-primary" />
          <span className="text-xs text-text-muted">total</span>
        </div>
        {summary.critical > 0 && (
          <div className="flex items-center gap-1.5">
            <AnimatedCounter value={summary.critical} className="text-md font-semibold text-status-red" />
            <span className="text-xs text-text-muted">critiques</span>
          </div>
        )}
        {summary.warning > 0 && (
          <div className="flex items-center gap-1.5">
            <AnimatedCounter value={summary.warning} className="text-md font-semibold text-status-orange" />
            <span className="text-xs text-text-muted">warnings</span>
          </div>
        )}
      </div>

      {/* Alert list (compact, sorted by confidence desc) */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {summary.alerts.map((alert) => (
          <button
            key={alert.id}
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-bg-elevated transition-colors"
            aria-label={`Drift: ${alert.documentA} vs ${alert.documentB}, confiance ${alert.confidence}%`}
          >
            <span className={`text-xs px-1.5 py-0.5 rounded ${SEVERITY_STYLES[alert.severity]}`}>
              {alert.severity}
            </span>
            <span className="text-sm text-text-primary truncate">
              {alert.documentA} / {alert.documentB}
            </span>
            <span className="text-xs text-text-muted ml-auto font-mono">
              {alert.confidence}%
            </span>
          </button>
        ))}
      </div>
    </WidgetCard>
  );
}
```

### AnimatedCounter Component Pattern

```typescript
// src/renderer/src/features/dashboard/components/AnimatedCounter.tsx
import { useEffect, useRef, useState } from 'react';

type AnimatedCounterProps = {
  value: number;
  className?: string;
  duration?: number; // ms, default 300
};

export function AnimatedCounter({ value, className = '', duration = 300 }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    if (prefersReducedMotion.current || prevValueRef.current === value) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const startValue = prevValueRef.current;
    const diff = value - startValue;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + diff * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
    prevValueRef.current = value;
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
}
```

### useAgentsSummary Hook Pattern

```typescript
// src/renderer/src/features/dashboard/hooks/useAgentsSummary.ts
import { useAgentsStore } from '@renderer/features/agents/agents.store';
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream';
import { useCallback } from 'react';
import type { AgentsSummary, AgentSummaryItem } from '../dashboard.types';

export function useAgentsSummary(): AgentsSummary {
  const agents = useAgentsStore((s) => s.agents);
  const updateStatus = useAgentsStore((s) => s.updateStatus);

  // Subscribe to real-time agent status updates
  useIpcStream('stream:agent-status', useCallback((data) => {
    updateStatus(data.agentId, data.status);
  }, [updateStatus]));

  const agentsList = Array.from(agents.values());

  const items: AgentSummaryItem[] = agentsList.map((agent) => ({
    id: agent.id,
    name: agent.name,
    task: agent.task,
    status: agent.status,
    health: agent.health,
  }));

  return {
    total: agentsList.length,
    active: agentsList.filter((a) => a.status === 'active').length,
    blocked: agentsList.filter((a) => a.status === 'blocked').length,
    terminated: agentsList.filter((a) => a.status === 'terminated').length,
    agents: items,
  };
}
```

### useDriftSummary Hook Pattern

```typescript
// src/renderer/src/features/dashboard/hooks/useDriftSummary.ts
import { useDriftStore } from '@renderer/features/drift/drift.store';
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream';
import { useCallback } from 'react';
import type { DriftSummary, DriftSummaryItem } from '../dashboard.types';

export function useDriftSummary(): DriftSummary {
  const alerts = useDriftStore((s) => s.alerts);
  const addAlert = useDriftStore((s) => s.addAlert);

  // Subscribe to real-time drift alerts
  useIpcStream('stream:drift-alert', useCallback((data) => {
    addAlert(data);
  }, [addAlert]));

  const alertsList = Array.from(alerts.values());

  const items: DriftSummaryItem[] = alertsList
    .map((alert) => ({
      id: alert.id,
      documentA: alert.documents[0],
      documentB: alert.documents[1],
      confidence: alert.confidence,
      severity: alert.severity,
      summary: alert.summary,
    }))
    .sort((a, b) => b.confidence - a.confidence); // highest confidence first

  return {
    total: alertsList.length,
    critical: alertsList.filter((a) => a.severity === 'critical').length,
    warning: alertsList.filter((a) => a.severity === 'warning').length,
    alerts: items,
  };
}
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Widget components | PascalCase + `Widget` suffix | `AgentsSummaryWidget.tsx` |
| Summary hooks | camelCase, prefix `use` + `Summary` | `useAgentsSummary.ts` |
| Utility components | PascalCase | `AnimatedCounter.tsx` |
| Tests | same name + `.test.ts(x)` co-located | `AgentsSummaryWidget.test.tsx` |
| Type definitions | PascalCase types in `dashboard.types.ts` | `AgentSummaryItem` |

### Testing Strategy

- **Unit tests** for `AgentsSummaryWidget`: render with 0 agents (empty state), render with mixed statuses, verify health indicators present
- **Unit tests** for `DriftSummaryWidget`: render with 0 alerts (empty state with green indicator), render with alerts sorted by confidence, verify severity badges
- **Unit tests** for `AnimatedCounter`: renders correct value, handles value changes, respects `prefers-reduced-motion`
- **Unit tests** for `useAgentsSummary`: mock `agents.store.ts`, verify count computations
- **Unit tests** for `useDriftSummary`: mock `drift.store.ts`, verify sorting by confidence, severity counts
- **Accessibility tests**: verify `aria-live="polite"` on count badges, `role="status"` on empty states, `role="img"` + `aria-label` on HealthIndicator
- **Animation tests**: verify counter transitions, verify reduced motion fallback
- **Co-located** — all test files next to their source files

### What NOT to Do

- Do NOT implement click handlers on agent/drift items for navigation — that is Story 5.4
- Do NOT duplicate agent store logic — read from `agents.store.ts` via hooks
- Do NOT duplicate drift store logic — read from `drift.store.ts` via hooks
- Do NOT create new IPC channels — use existing `stream:agent-status` and `stream:drift-alert`
- Do NOT use polling — subscribe to IPC streams for real-time updates
- Do NOT use `export default` — named exports only
- Do NOT use `any` — use `unknown` + type guards
- Do NOT hardcode animation durations — use design token values (200ms badge fade, 300ms counter)
- Do NOT skip empty states — every widget must have a meaningful empty state
- Do NOT use color alone for status — always pair with text label or icon (`aria-label`)

### References

- [Source: epics.md#Story-5.2] — Full acceptance criteria
- [Source: architecture.md#Frontend-Component-Architecture] — `features/dashboard/` folder, component list
- [Source: architecture.md#Complete-Project-Directory-Structure] — `AlertsSummary.tsx` in dashboard
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, selectors
- [Source: architecture.md#Event-Bus-Architecture] — `agent:status`, `drift:detected` events
- [Source: architecture.md#IPC-Channel-Design] — `stream:agent-status`, `stream:drift-alert` streams
- [Source: ux-design-specification.md#Custom-Components] — `HealthIndicator` spec (8/12/16px, states)
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Badge fade 200ms, number animation 300ms
- [Source: ux-design-specification.md#Empty-States-Loading] — "Volet vide: illustration + texte + bouton d'action"
- [Source: ux-design-specification.md#Design-Implications] — "Couleur n'est jamais decorative"
- [Source: ux-design-specification.md#Accessibility-Strategy] — `aria-live`, status not color-only
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — IPC hooks, TypeScript rules

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
