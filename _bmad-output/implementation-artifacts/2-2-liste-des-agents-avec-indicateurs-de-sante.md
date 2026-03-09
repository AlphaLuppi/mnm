# Story 2.2: Liste des Agents avec Indicateurs de Sante

Status: ready-for-dev

## Story

As a **user**,
I want **to see all active agents with real-time health indicators**,
So that **I know at a glance which agents are healthy, struggling, or blocked**.

## Acceptance Criteria

### AC1 — Agent list with AgentCards

**Given** des agents sont actifs
**When** je regarde le volet Agents
**Then** je vois une liste d'`AgentCard` avec pour chacun : nom, `HealthIndicator` (vert/orange/rouge/gris), tache en cours
**And** la liste se met a jour en continu (< 500ms, NFR1)

### AC2 — Green indicator for healthy agent

**Given** un agent fonctionne normalement
**When** il produit de l'output regulierement
**Then** son `HealthIndicator` est vert

### AC3 — Orange indicator for stalled agent

**Given** un agent n'a pas produit d'output depuis un seuil configurable
**When** le timeout est atteint
**Then** son `HealthIndicator` passe a orange (stalled)

### AC4 — Red indicator for crashed/blocked agent

**Given** un agent a crashe ou est bloque
**When** son process retourne une erreur
**Then** son `HealthIndicator` passe a rouge
**And** le badge est visible sans navigation depuis la vue principale (FR2)

### AC5 — Gray indicator for stopped agent

**Given** un agent est termine
**When** il n'est plus actif
**Then** son `HealthIndicator` est gris

## Tasks / Subtasks

- [ ] Task 1: Create Zustand agents store (AC: #1, #2, #3, #4, #5)
  - [ ] 1.1 Create `src/renderer/src/features/agents/agents.store.ts`
  - [ ] 1.2 Define `AgentsState` type with agents Map, actions (addAgent, updateStatus, removeAgent, updateLastOutput)
  - [ ] 1.3 Implement health derivation logic: status + lastOutputAt -> health color
  - [ ] 1.4 Create `src/renderer/src/features/agents/agents.store.test.ts`

- [ ] Task 2: Create IPC stream hooks for agents (AC: #1)
  - [ ] 2.1 Create `src/renderer/src/features/agents/hooks/useAgentStream.ts` — listens to `stream:agent-status` and `stream:agent-output`
  - [ ] 2.2 Wire stream events to agents store actions
  - [ ] 2.3 Create `src/renderer/src/features/agents/hooks/useAgentStatus.ts` — selector hook for individual agent status
  - [ ] 2.4 Create hook tests

- [ ] Task 3: Create HealthIndicator component (AC: #2, #3, #4, #5)
  - [ ] 3.1 Create `src/renderer/src/features/agents/components/HealthIndicator.tsx`
  - [ ] 3.2 Implement colored dot: green (active + recent output), orange (stalled), red (crashed/blocked), gray (stopped)
  - [ ] 3.3 Add subtle pulse animation for green (healthy) state
  - [ ] 3.4 Support sizes: 8px, 12px, 16px via prop
  - [ ] 3.5 Add `aria-label` describing current health state
  - [ ] 3.6 Respect `prefers-reduced-motion` for pulse animation
  - [ ] 3.7 Create `src/renderer/src/features/agents/components/HealthIndicator.test.tsx`

- [ ] Task 4: Create AgentCard component (AC: #1, #2, #3, #4, #5)
  - [ ] 4.1 Create `src/renderer/src/features/agents/components/AgentCard.tsx`
  - [ ] 4.2 Display: HealthIndicator + agent name + task description + timestamp
  - [ ] 4.3 Selected state with accent border
  - [ ] 4.4 Click handler for agent selection (sync with navigation store)
  - [ ] 4.5 Show condensed last message/output
  - [ ] 4.6 Add `role="listitem"` and keyboard navigation support
  - [ ] 4.7 Create `src/renderer/src/features/agents/components/AgentCard.test.tsx`

- [ ] Task 5: Create AgentList container (AC: #1)
  - [ ] 5.1 Create `src/renderer/src/features/agents/components/AgentList.tsx`
  - [ ] 5.2 Fetch initial agent list via `agent:list` IPC invoke on mount
  - [ ] 5.3 Subscribe to `stream:agent-status` for live updates via useAgentStream
  - [ ] 5.4 Render list of AgentCards from agents store
  - [ ] 5.5 Handle empty state: "Aucun agent actif" + "Lancer un agent" button
  - [ ] 5.6 Add `role="list"` and `aria-label="Liste des agents"`
  - [ ] 5.7 Create `src/renderer/src/features/agents/components/AgentList.test.tsx`

- [ ] Task 6: Create feature barrel export (AC: #1)
  - [ ] 6.1 Create `src/renderer/src/features/agents/index.ts` re-exporting public API
  - [ ] 6.2 Export: AgentList, AgentCard, HealthIndicator, useAgentsStore, useAgentStatus

- [ ] Task 7: Stall detection timer (AC: #3)
  - [ ] 7.1 Implement stall detection in agents store: track `lastOutputAt` per agent
  - [ ] 7.2 Create `useStallDetection` hook or interval-based check in store
  - [ ] 7.3 Default stall threshold: 30 seconds (configurable via settings)
  - [ ] 7.4 When threshold exceeded and agent is ACTIVE: derive health as 'stalled'
  - [ ] 7.5 Write tests for stall detection timing

## Dev Notes

### FRs Covered

- **FR1**: L'utilisateur peut voir la liste de tous les agents actifs avec leur statut mis a jour en continu
- **FR2**: L'utilisateur peut voir l'indicateur de sante de chaque agent (vert/orange/rouge) sans navigation
- **FR3** (partial): La timeline integration reuses agent data from this store
- **FR5** (partial): Blocked agent visible with red indicator

### Dependencies on Previous Stories

- **Story 1.1**: IPC bridge (`useIpcInvoke`, `useIpcStream` hooks), event bus, shared types, import aliases, Tailwind CSS tokens
- **Story 2.1**: Agent harness service (provides `agent:list` IPC, `stream:agent-status`, `stream:agent-output` streams), `AgentStatus` enum, `AgentInfo` type

### Architecture Overview

This story creates the renderer-side agent monitoring UI. It connects to the agent harness (Story 2.1) via IPC streams and displays real-time agent health in the Agents pane.

```
Main Process                          Renderer Process
                                         |
AgentHarnessService                      |
  |-- stream:agent-status -->      useAgentStream hook
  |-- stream:agent-output -->            |
                                   agents.store.ts (Zustand)
                                         |
                                   AgentList.tsx
                                     |-- AgentCard.tsx
                                         |-- HealthIndicator.tsx
```

### Zustand Store Pattern

```typescript
// src/renderer/src/features/agents/agents.store.ts
import { create } from 'zustand';
import type { AgentInfo } from '@shared/types/agent.types';
import { AgentStatus } from '@shared/types/agent.types';

type HealthColor = 'green' | 'orange' | 'red' | 'gray';

type AgentsState = {
  agents: Map<string, AgentInfo>;
  stallThresholdMs: number;

  // Actions
  setAgents: (agents: AgentInfo[]) => void;
  addAgent: (agent: AgentInfo) => void;
  updateStatus: (agentId: string, status: AgentStatus, lastError?: string) => void;
  updateLastOutput: (agentId: string, timestamp: number) => void;
  removeAgent: (agentId: string) => void;
  setStallThreshold: (ms: number) => void;

  // Derived
  getHealthColor: (agentId: string) => HealthColor;
};

const DEFAULT_STALL_THRESHOLD_MS = 30_000; // 30 seconds

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: new Map(),
  stallThresholdMs: DEFAULT_STALL_THRESHOLD_MS,

  setAgents: (agents) =>
    set(() => {
      const map = new Map<string, AgentInfo>();
      for (const agent of agents) {
        map.set(agent.id, agent);
      }
      return { agents: map };
    }),

  addAgent: (agent) =>
    set((state) => {
      const next = new Map(state.agents);
      next.set(agent.id, agent);
      return { agents: next };
    }),

  updateStatus: (agentId, status, lastError) =>
    set((state) => {
      const next = new Map(state.agents);
      const agent = next.get(agentId);
      if (agent) {
        next.set(agentId, {
          ...agent,
          status,
          lastError: lastError ?? agent.lastError,
          stoppedAt: [AgentStatus.STOPPED, AgentStatus.CRASHED].includes(status)
            ? Date.now()
            : agent.stoppedAt,
        });
      }
      return { agents: next };
    }),

  updateLastOutput: (agentId, timestamp) =>
    set((state) => {
      const next = new Map(state.agents);
      const agent = next.get(agentId);
      if (agent) {
        next.set(agentId, { ...agent, lastOutputAt: timestamp });
      }
      return { agents: next };
    }),

  removeAgent: (agentId) =>
    set((state) => {
      const next = new Map(state.agents);
      next.delete(agentId);
      return { agents: next };
    }),

  setStallThreshold: (ms) => set({ stallThresholdMs: ms }),

  getHealthColor: (agentId) => {
    const state = get();
    const agent = state.agents.get(agentId);
    if (!agent) return 'gray';

    switch (agent.status) {
      case AgentStatus.CRASHED:
      case AgentStatus.BLOCKED:
        return 'red';
      case AgentStatus.STOPPED:
        return 'gray';
      case AgentStatus.LAUNCHING:
      case AgentStatus.STOPPING:
        return 'orange';
      case AgentStatus.ACTIVE: {
        // Check for stall
        if (agent.lastOutputAt) {
          const elapsed = Date.now() - agent.lastOutputAt;
          if (elapsed > state.stallThresholdMs) {
            return 'orange';
          }
        }
        return 'green';
      }
      default:
        return 'gray';
    }
  },
}));
```

### HealthIndicator Component

```tsx
// src/renderer/src/features/agents/components/HealthIndicator.tsx
import { type ComponentProps } from 'react';

type HealthColor = 'green' | 'orange' | 'red' | 'gray';

type HealthIndicatorProps = {
  color: HealthColor;
  size?: 8 | 12 | 16;
} & Omit<ComponentProps<'span'>, 'children'>;

const COLOR_MAP: Record<HealthColor, { bg: string; pulse: string; label: string }> = {
  green: {
    bg: 'bg-status-green',
    pulse: 'animate-pulse-subtle',
    label: 'Agent actif',
  },
  orange: {
    bg: 'bg-status-orange',
    pulse: '',
    label: 'Agent en attente',
  },
  red: {
    bg: 'bg-status-red',
    pulse: 'animate-pulse-alert',
    label: 'Agent bloque ou crashe',
  },
  gray: {
    bg: 'bg-status-gray',
    pulse: '',
    label: 'Agent termine',
  },
};

const SIZE_MAP: Record<number, string> = {
  8: 'h-2 w-2',
  12: 'h-3 w-3',
  16: 'h-4 w-4',
};

export function HealthIndicator({
  color,
  size = 12,
  className = '',
  ...props
}: HealthIndicatorProps) {
  const colorConfig = COLOR_MAP[color];
  const sizeClass = SIZE_MAP[size];

  return (
    <span
      className={`inline-block rounded-full ${colorConfig.bg} ${sizeClass} ${colorConfig.pulse} motion-reduce:animate-none ${className}`}
      role="img"
      aria-label={colorConfig.label}
      {...props}
    />
  );
}

export type { HealthColor, HealthIndicatorProps };
```

### Tailwind Animations (add to app.css)

```css
/* Add to src/renderer/src/app.css after @theme block */

@layer utilities {
  .animate-pulse-subtle {
    animation: pulse-subtle 2s ease-in-out infinite;
  }

  .animate-pulse-alert {
    animation: pulse-alert 1.5s ease-in-out infinite;
  }
}

@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes pulse-alert {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.15); }
}
```

### AgentCard Component

```tsx
// src/renderer/src/features/agents/components/AgentCard.tsx
import { useAgentsStore } from '../agents.store';
import { HealthIndicator } from './HealthIndicator';
import { useShallow } from 'zustand/react/shallow';
import type { AgentInfo } from '@shared/types/agent.types';

type AgentCardProps = {
  agentId: string;
  isSelected?: boolean;
  onSelect?: (agentId: string) => void;
  onDoubleClick?: (agentId: string) => void;
};

export function AgentCard({ agentId, isSelected, onSelect, onDoubleClick }: AgentCardProps) {
  const agent = useAgentsStore(
    useShallow((state) => state.agents.get(agentId))
  );
  const healthColor = useAgentsStore((state) => state.getHealthColor(agentId));

  if (!agent) return null;

  const handleClick = () => onSelect?.(agentId);
  const handleDoubleClick = () => onDoubleClick?.(agentId);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSelect?.(agentId);
    if (e.key === ' ') {
      e.preventDefault();
      onSelect?.(agentId);
    }
  };

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={`
        flex items-start gap-3 p-3 rounded-lg cursor-pointer
        bg-bg-surface border transition-colors duration-200
        hover:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-accent
        ${isSelected ? 'border-accent' : 'border-border-default'}
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      aria-selected={isSelected}
    >
      <HealthIndicator color={healthColor} size={12} className="mt-1 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-md font-medium text-text-primary truncate">
            Agent {agent.id.slice(0, 8)}
          </span>
          <span className="text-xs text-text-muted font-mono shrink-0">
            {formatRelativeTime(agent.lastOutputAt ?? agent.startedAt)}
          </span>
        </div>

        <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">
          {agent.task}
        </p>

        {agent.lastError && (
          <p className="text-xs text-status-red mt-1 line-clamp-1 font-mono">
            {agent.lastError}
          </p>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export type { AgentCardProps };
```

### AgentList Container

```tsx
// src/renderer/src/features/agents/components/AgentList.tsx
import { useEffect, useState } from 'react';
import { useAgentsStore } from '../agents.store';
import { useShallow } from 'zustand/react/shallow';
import { AgentCard } from './AgentCard';

type AgentListProps = {
  onSelectAgent?: (agentId: string) => void;
  onOpenChatViewer?: (agentId: string) => void;
};

export function AgentList({ onSelectAgent, onOpenChatViewer }: AgentListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const agentIds = useAgentsStore(
    useShallow((state) => Array.from(state.agents.keys()))
  );
  const setAgents = useAgentsStore((state) => state.setAgents);
  const updateStatus = useAgentsStore((state) => state.updateStatus);
  const updateLastOutput = useAgentsStore((state) => state.updateLastOutput);

  // Fetch initial agent list on mount
  useEffect(() => {
    window.electronAPI
      .invoke('agent:list', undefined)
      .then((agents) => setAgents(agents))
      .catch(() => {
        // Handle error — store remains empty
      });
  }, [setAgents]);

  // Subscribe to live status updates
  useEffect(() => {
    const cleanupStatus = window.electronAPI.on('stream:agent-status', (data) => {
      updateStatus(data.agentId, data.status, data.lastError);
    });

    const cleanupOutput = window.electronAPI.on('stream:agent-output', (data) => {
      updateLastOutput(data.agentId, data.timestamp);
    });

    return () => {
      cleanupStatus();
      cleanupOutput();
    };
  }, [updateStatus, updateLastOutput]);

  const handleSelect = (agentId: string) => {
    setSelectedId(agentId);
    onSelectAgent?.(agentId);
  };

  const handleDoubleClick = (agentId: string) => {
    onOpenChatViewer?.(agentId);
  };

  if (agentIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <p className="text-sm">Aucun agent actif</p>
        <button
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-hover transition-colors"
          onClick={() => {
            // TODO: Wire to agent launch dialog (Story 2.1 provides the IPC)
          }}
        >
          Lancer un agent
        </button>
      </div>
    );
  }

  return (
    <div role="list" aria-label="Liste des agents" className="flex flex-col gap-2 p-2">
      {agentIds.map((id) => (
        <AgentCard
          key={id}
          agentId={id}
          isSelected={id === selectedId}
          onSelect={handleSelect}
          onDoubleClick={handleDoubleClick}
        />
      ))}
    </div>
  );
}

export type { AgentListProps };
```

### useAgentStream Hook

```typescript
// src/renderer/src/features/agents/hooks/useAgentStream.ts
import { useEffect } from 'react';
import { useAgentsStore } from '../agents.store';

/**
 * Hook that subscribes to agent IPC streams and updates the agents store.
 * Should be mounted once at a high level (e.g., AgentList or App shell).
 */
export function useAgentStream(): void {
  const updateStatus = useAgentsStore((state) => state.updateStatus);
  const updateLastOutput = useAgentsStore((state) => state.updateLastOutput);
  const addAgent = useAgentsStore((state) => state.addAgent);

  useEffect(() => {
    const cleanupStatus = window.electronAPI.on('stream:agent-status', (data) => {
      updateStatus(data.agentId, data.status, data.lastError);
    });

    const cleanupOutput = window.electronAPI.on('stream:agent-output', (data) => {
      updateLastOutput(data.agentId, data.timestamp);
    });

    return () => {
      cleanupStatus();
      cleanupOutput();
    };
  }, [updateStatus, updateLastOutput, addAgent]);
}
```

### useAgentStatus Hook

```typescript
// src/renderer/src/features/agents/hooks/useAgentStatus.ts
import { useAgentsStore } from '../agents.store';
import { useShallow } from 'zustand/react/shallow';
import type { AgentInfo } from '@shared/types/agent.types';
import type { HealthColor } from '../components/HealthIndicator';

type AgentStatusResult = {
  agent: AgentInfo | undefined;
  healthColor: HealthColor;
};

/**
 * Hook to get the status and health color of a specific agent.
 */
export function useAgentStatus(agentId: string): AgentStatusResult {
  const agent = useAgentsStore(
    useShallow((state) => state.agents.get(agentId))
  );
  const healthColor = useAgentsStore((state) => state.getHealthColor(agentId));

  return { agent, healthColor };
}
```

### Stall Detection

```typescript
// Stall detection is implemented as an interval that rechecks health colors.
// Since getHealthColor already checks lastOutputAt vs stallThresholdMs,
// we just need to trigger re-renders periodically.

// In agents.store.ts, add a tick mechanism:
// Option A: A useStallDetection hook with setInterval that forces store update

// src/renderer/src/features/agents/hooks/useStallDetection.ts
import { useEffect } from 'react';
import { useAgentsStore } from '../agents.store';
import { AgentStatus } from '@shared/types/agent.types';

const STALL_CHECK_INTERVAL_MS = 5_000; // Check every 5s

/**
 * Periodically checks for stalled agents by incrementing a tick counter
 * in the store, forcing re-evaluation of health colors.
 */
export function useStallDetection(): void {
  const agents = useAgentsStore((state) => state.agents);
  const stallThresholdMs = useAgentsStore((state) => state.stallThresholdMs);

  useEffect(() => {
    const interval = setInterval(() => {
      // Force a minimal state update to trigger re-renders
      // so getHealthColor re-evaluates stall conditions.
      // We use a tick approach: increment a counter in state.
      useAgentsStore.setState((state) => ({ ...state, _tick: Date.now() }));
    }, STALL_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}
```

### File Structure (Story 2.2 scope)

```
src/
  renderer/
    src/
      features/
        agents/
          components/
            HealthIndicator.tsx          # Colored dot component
            HealthIndicator.test.tsx
            AgentCard.tsx                # Agent summary card
            AgentCard.test.tsx
            AgentList.tsx                # Agent list container
            AgentList.test.tsx
          hooks/
            useAgentStream.ts            # IPC stream subscription
            useAgentStatus.ts            # Individual agent status selector
            useStallDetection.ts         # Stall detection timer
          agents.store.ts                # Zustand store
          agents.store.test.ts
          index.ts                       # Barrel export
      app.css                            # Updated with pulse animations
```

### Naming Conventions

| Element | Convention | This Story |
|---|---|---|
| React components | PascalCase.tsx | `HealthIndicator.tsx`, `AgentCard.tsx`, `AgentList.tsx` |
| Hooks | camelCase, prefix `use` | `useAgentStream.ts`, `useAgentStatus.ts`, `useStallDetection.ts` |
| Zustand store | camelCase + `.store.ts` | `agents.store.ts` |
| Tests | same name + `.test.ts(x)` co-located | `HealthIndicator.test.tsx` |
| CSS classes | Tailwind utility-first | `bg-status-green`, `text-text-primary` |

### Testing Strategy

**Unit tests:**

1. **agents.store.test.ts**
   - `setAgents` populates the Map correctly
   - `addAgent` adds a new agent
   - `updateStatus` changes agent status and sets stoppedAt for terminal states
   - `updateLastOutput` updates the timestamp
   - `removeAgent` removes from Map
   - `getHealthColor` returns green for ACTIVE with recent output
   - `getHealthColor` returns orange for ACTIVE with stale output (> threshold)
   - `getHealthColor` returns red for CRASHED
   - `getHealthColor` returns red for BLOCKED
   - `getHealthColor` returns gray for STOPPED
   - `getHealthColor` returns gray for unknown agentId

2. **HealthIndicator.test.tsx**
   - Renders correct color class for each HealthColor value
   - Renders correct size class for 8, 12, 16
   - Has correct `aria-label` for each color
   - Applies `motion-reduce:animate-none` class
   - Default size is 12

3. **AgentCard.test.tsx**
   - Renders agent name, task, and health indicator
   - Calls onSelect on click
   - Calls onDoubleClick on double-click
   - Shows accent border when selected
   - Displays error message for crashed agents
   - Shows relative timestamp
   - Is keyboard accessible (Enter and Space)

4. **AgentList.test.tsx**
   - Renders empty state when no agents
   - Renders list of AgentCards for each agent
   - Fetches initial agent list via IPC on mount
   - Updates on stream:agent-status events
   - Has correct ARIA attributes

**Testing approach:**
```typescript
// Use @testing-library/react for component tests
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

// Mock window.electronAPI
const mockElectronAPI = {
  invoke: vi.fn(),
  on: vi.fn(() => vi.fn()), // Returns cleanup function
};
window.electronAPI = mockElectronAPI as unknown as typeof window.electronAPI;
```

### What NOT to Do

- Do NOT use `any` for store state or component props — type everything
- Do NOT use `export default` — named exports only
- Do NOT put actions outside the Zustand store — all state mutations inside the store
- Do NOT use `useEffect` to derive health color — use the store's `getHealthColor` method
- Do NOT hardcode the stall threshold — make it configurable in the store
- Do NOT create a mega-store combining agents with other features — one store per feature
- Do NOT use polling to fetch agent list — use the initial fetch + stream updates pattern
- Do NOT forget `role` and `aria-label` attributes on list and items
- Do NOT use inline colors — use Tailwind design tokens (`bg-status-green`, etc.)
- Do NOT create the AgentProgressBar here — that belongs to Story 2.3
- Do NOT create the AgentChatViewer here — that belongs to Story 2.5
- Do NOT use `forwardRef` — React 19 supports `ref` as a regular prop
- Do NOT import from other features directly — use shared stores for cross-feature communication

### References

- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, useIpcStream hook
- [Source: architecture.md#Frontend-Component-Architecture] — Feature-based structure
- [Source: architecture.md#IPC-Channel-Design] — stream:agent-status, stream:agent-output
- [Source: architecture.md#Naming-Patterns] — File and code naming conventions
- [Source: architecture.md#Architectural-Boundaries] — Feature isolation rules
- [Source: ux-design-specification.md#Custom-Components] — HealthIndicator spec (8/12/16px, pulse, colors)
- [Source: ux-design-specification.md#Custom-Components] — AgentCard spec (anatomy, states)
- [Source: ux-design-specification.md#Color-System] — Status colors (green/orange/red/gray)
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Fade 200ms transitions
- [Source: ux-design-specification.md#Empty-States-Loading] — Empty state pattern
- [Source: ux-design-specification.md#Accessibility-Strategy] — ARIA, keyboard, reduced motion
- [Source: epics.md#Story-2.2] — Acceptance criteria
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — IPC hooks, Tailwind tokens, import aliases

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
