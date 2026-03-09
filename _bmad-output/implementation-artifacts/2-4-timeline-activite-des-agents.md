# Story 2.4: Timeline d'Activite des Agents

Status: ready-for-dev

## Story

As a **user**,
I want **to see a visual activity timeline for all agents as a horizontal bar with checkpoints**,
So that **I can follow agent activity over time without reading logs**.

## Acceptance Criteria

### AC1 — Timeline with colored dots per agent

**Given** des agents sont actifs
**When** je regarde la `TimelineBar` en bas de l'ecran
**Then** je vois une frise chronologique horizontale avec des points colores par agent
**And** chaque point represente un checkpoint ou evenement significatif

### AC2 — Live checkpoint appearance

**Given** la timeline affiche les activites
**When** un agent produit un nouveau checkpoint
**Then** un nouveau point apparait sur la timeline avec animation (slide-in 150ms)
**And** un label court decrit l'evenement

### AC3 — Tooltip on hover

**Given** la timeline est affichee
**When** je survole un point
**Then** un tooltip affiche le detail de l'evenement (timestamp, agent, description)

### AC4 — Temporal scrubbing

**Given** la timeline a du contenu
**When** je drag horizontalement sur la timeline
**Then** je peux naviguer dans le temps (temporal scrubbing)

## Tasks / Subtasks

- [ ] Task 1: Create timeline shared types (AC: #1, #2)
  - [ ] 1.1 Create `src/shared/types/timeline.types.ts` with `TimelineEvent`, `TimelinePoint` types
  - [ ] 1.2 Define event categories: checkpoint, file-write, tool-call, error, status-change
  - [ ] 1.3 Define color assignment strategy: each agent gets a consistent color from palette

- [ ] Task 2: Create timeline Zustand store (AC: #1, #2, #4)
  - [ ] 2.1 Create `src/renderer/src/features/agents/timeline.store.ts`
  - [ ] 2.2 Define state: events array, time range (start/end), current view window, selected event
  - [ ] 2.3 Actions: addEvent, setViewWindow, selectEvent, clearEvents
  - [ ] 2.4 Derived: eventsInView (filtered to current time window), agentColors Map
  - [ ] 2.5 Create `src/renderer/src/features/agents/timeline.store.test.ts`

- [ ] Task 3: Create useTimelineStream hook (AC: #2)
  - [ ] 3.1 Create `src/renderer/src/features/agents/hooks/useTimelineStream.ts`
  - [ ] 3.2 Listen to `stream:agent-chat` for checkpoint events (entries with checkpoint field)
  - [ ] 3.3 Listen to `stream:agent-status` for status change events
  - [ ] 3.4 Convert incoming stream data to TimelineEvent and add to store
  - [ ] 3.5 Create hook test

- [ ] Task 4: Create TimelineBar component (AC: #1, #2, #3, #4)
  - [ ] 4.1 Create `src/renderer/src/shared/layout/TimelineBar.tsx`
  - [ ] 4.2 Render horizontal bar with time axis (timestamps at intervals)
  - [ ] 4.3 Position TimelinePoint dots based on event timestamp relative to view window
  - [ ] 4.4 Color dots per agent (consistent color assignment)
  - [ ] 4.5 Render short labels below dots for event description
  - [ ] 4.6 Fixed height 120px, full width, positioned at bottom of layout
  - [ ] 4.7 Add `role="slider"` with `aria-label="Timeline d'activite des agents"`
  - [ ] 4.8 Create `src/renderer/src/shared/layout/TimelineBar.test.tsx`

- [ ] Task 5: Create TimelinePoint component (AC: #1, #2, #3)
  - [ ] 5.1 Create `src/renderer/src/features/agents/components/TimelinePoint.tsx`
  - [ ] 5.2 Render colored dot (10px) with agent-specific color
  - [ ] 5.3 Slide-in animation on first render (150ms)
  - [ ] 5.4 Respect `prefers-reduced-motion`
  - [ ] 5.5 Click handler to select event (emits to store and parent)
  - [ ] 5.6 Hover state: scale up slightly + show tooltip trigger
  - [ ] 5.7 Selected state: ring border + enlarged
  - [ ] 5.8 Create `src/renderer/src/features/agents/components/TimelinePoint.test.tsx`

- [ ] Task 6: Implement tooltip on hover (AC: #3)
  - [ ] 6.1 Use shadcn/ui Tooltip component wrapping TimelinePoint
  - [ ] 6.2 Tooltip content: timestamp (JetBrains Mono), agent name, event description
  - [ ] 6.3 Tooltip positioning: above the timeline bar
  - [ ] 6.4 Test tooltip rendering

- [ ] Task 7: Implement temporal scrubbing (AC: #4)
  - [ ] 7.1 Add mouse drag handler on TimelineBar for horizontal scrubbing
  - [ ] 7.2 On drag: update view window start/end in timeline store
  - [ ] 7.3 Implement scroll wheel horizontal zoom (zoom in/out on time range)
  - [ ] 7.4 Add visual indicator for current view window bounds
  - [ ] 7.5 Keyboard support: left/right arrows move view window, +/- zoom
  - [ ] 7.6 Create scrubbing interaction tests

- [ ] Task 8: Connect timeline events from main process (AC: #1, #2)
  - [ ] 8.1 In main process: ensure chat-segmenter checkpoint events include enough data for timeline
  - [ ] 8.2 Ensure `stream:agent-chat` entries with `checkpoint` field carry the label and agent info
  - [ ] 8.3 Ensure `stream:agent-status` events include timestamp for timeline positioning
  - [ ] 8.4 Verify event flow end-to-end: agent output -> parser -> segmenter -> event bus -> IPC stream -> timeline store -> render

- [ ] Task 9: Agent color assignment (AC: #1)
  - [ ] 9.1 Create color palette for agents (8-10 distinct colors for up to 10 concurrent agents)
  - [ ] 9.2 Assign colors consistently by agent ID (hash-based or sequential)
  - [ ] 9.3 Store color assignments in timeline store
  - [ ] 9.4 Expose `getAgentColor(agentId)` from store

## Dev Notes

### FRs Covered

- **FR3**: L'utilisateur peut voir la timeline d'activite de chaque agent sous forme de frise chronologique avec des checkpoints
- **FR4** (partial): Checkpoint click navigation prepared (full navigation to chat is Story 2.5)
- **FR40**: L'utilisateur peut voir la timeline d'activite dans un panneau bas persistant

### Dependencies on Previous Stories

- **Story 1.1**: IPC bridge, event bus, useIpcStream hook, Tailwind tokens, import aliases
- **Story 1.2**: ThreePaneLayout (TimelineBar is rendered in the bottom slot of the layout)
- **Story 2.1**: Agent harness (provides stream:agent-chat with checkpoints, stream:agent-status)
- **Story 2.2**: Agents store (agent info for color and name)

### Architecture Overview

The TimelineBar is a shared layout component (bottom 120px bar) that visualizes agent activity chronologically. It consumes events from both the agent chat stream (checkpoints) and agent status stream (status changes).

```
Main Process                              Renderer Process
                                             |
AgentHarnessService                          |
  |-- stream:agent-chat (checkpoints) -->  useTimelineStream hook
  |-- stream:agent-status (changes) -->        |
                                          timeline.store.ts
                                             |
                              ThreePaneLayout (Story 1.2)
                                |-- bottom slot: TimelineBar.tsx
                                                  |-- TimelinePoint.tsx (per event)
                                                  |   |-- Tooltip (shadcn)
                                                  |-- Time axis
                                                  |-- Scrub controls
```

### Shared Types

```typescript
// src/shared/types/timeline.types.ts

export type TimelineEventCategory =
  | 'checkpoint'
  | 'file-write'
  | 'tool-call'
  | 'error'
  | 'status-change'
  | 'progress';

export type TimelineEvent = {
  id: string;
  agentId: string;
  category: TimelineEventCategory;
  label: string;
  description?: string;
  timestamp: number;
  checkpointId?: string;  // Links to ChatEntry checkpoint for navigation
  metadata?: Record<string, unknown>;
};
```

### Timeline Store

```typescript
// src/renderer/src/features/agents/timeline.store.ts
import { create } from 'zustand';
import type { TimelineEvent } from '@shared/types/timeline.types';

// Agent color palette — 10 distinct colors for dark backgrounds
const AGENT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
];

type TimelineState = {
  events: TimelineEvent[];
  viewWindow: { start: number; end: number };
  selectedEventId: string | null;
  agentColorMap: Map<string, string>;

  // Actions
  addEvent: (event: TimelineEvent) => void;
  setViewWindow: (start: number, end: number) => void;
  selectEvent: (eventId: string | null) => void;
  clearEvents: () => void;

  // Derived
  getEventsInView: () => TimelineEvent[];
  getAgentColor: (agentId: string) => string;
};

export const useTimelineStore = create<TimelineState>((set, get) => ({
  events: [],
  viewWindow: {
    start: Date.now() - 60 * 60 * 1000, // Last 1 hour
    end: Date.now(),
  },
  selectedEventId: null,
  agentColorMap: new Map(),

  addEvent: (event) =>
    set((state) => {
      const newEvents = [...state.events, event].sort((a, b) => a.timestamp - b.timestamp);

      // Assign color if new agent
      const colorMap = new Map(state.agentColorMap);
      if (!colorMap.has(event.agentId)) {
        const colorIndex = colorMap.size % AGENT_COLORS.length;
        colorMap.set(event.agentId, AGENT_COLORS[colorIndex]);
      }

      // Auto-expand view window if event is beyond current window
      let { start, end } = state.viewWindow;
      if (event.timestamp > end) {
        end = event.timestamp + 60_000; // 1 min buffer
      }
      if (event.timestamp < start) {
        start = event.timestamp - 60_000;
      }

      return {
        events: newEvents,
        agentColorMap: colorMap,
        viewWindow: { start, end },
      };
    }),

  setViewWindow: (start, end) =>
    set({ viewWindow: { start, end } }),

  selectEvent: (eventId) =>
    set({ selectedEventId: eventId }),

  clearEvents: () =>
    set({ events: [], selectedEventId: null }),

  getEventsInView: () => {
    const { events, viewWindow } = get();
    return events.filter(
      (e) => e.timestamp >= viewWindow.start && e.timestamp <= viewWindow.end
    );
  },

  getAgentColor: (agentId) => {
    const colorMap = get().agentColorMap;
    return colorMap.get(agentId) ?? AGENT_COLORS[0];
  },
}));
```

### useTimelineStream Hook

```typescript
// src/renderer/src/features/agents/hooks/useTimelineStream.ts
import { useEffect } from 'react';
import { randomUUID } from 'crypto';
import { useTimelineStore } from '../timeline.store';
import type { TimelineEvent } from '@shared/types/timeline.types';

/**
 * Subscribes to IPC streams and converts agent events into timeline events.
 * Mount once at the layout level.
 */
export function useTimelineStream(): void {
  const addEvent = useTimelineStore((state) => state.addEvent);

  useEffect(() => {
    // Listen for chat entries with checkpoints
    const cleanupChat = window.electronAPI.on('stream:agent-chat', (entry) => {
      if (entry.checkpoint) {
        const timelineEvent: TimelineEvent = {
          id: `tl-${entry.id}`,
          agentId: entry.agentId,
          category: 'checkpoint',
          label: entry.content.slice(0, 60),
          description: entry.content,
          timestamp: entry.timestamp,
          checkpointId: entry.checkpoint,
        };
        addEvent(timelineEvent);
      }
    });

    // Listen for status changes
    const cleanupStatus = window.electronAPI.on('stream:agent-status', (data) => {
      const timelineEvent: TimelineEvent = {
        id: `tl-status-${data.agentId}-${Date.now()}`,
        agentId: data.agentId,
        category: 'status-change',
        label: `Status: ${data.status}`,
        description: data.lastError ?? `Agent status changed to ${data.status}`,
        timestamp: Date.now(),
      };
      addEvent(timelineEvent);
    });

    return () => {
      cleanupChat();
      cleanupStatus();
    };
  }, [addEvent]);
}
```

### TimelineBar Component

```tsx
// src/renderer/src/shared/layout/TimelineBar.tsx
import { useRef, useState, useCallback } from 'react';
import { useTimelineStore } from '@renderer/features/agents/timeline.store';
import { useShallow } from 'zustand/react/shallow';
import { TimelinePoint } from '@renderer/features/agents/components/TimelinePoint';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@renderer/shared/components/Tooltip';

type TimelineBarProps = {
  onEventClick?: (eventId: string, checkpointId?: string, agentId?: string) => void;
};

export function TimelineBar({ onEventClick }: TimelineBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);

  const events = useTimelineStore((state) => state.getEventsInView());
  const viewWindow = useTimelineStore(useShallow((state) => state.viewWindow));
  const selectedEventId = useTimelineStore((state) => state.selectedEventId);
  const selectEvent = useTimelineStore((state) => state.selectEvent);
  const setViewWindow = useTimelineStore((state) => state.setViewWindow);
  const getAgentColor = useTimelineStore((state) => state.getAgentColor);

  const timeRange = viewWindow.end - viewWindow.start;

  /**
   * Calculate horizontal position (0-100%) for a given timestamp.
   */
  const getPositionPercent = useCallback(
    (timestamp: number): number => {
      if (timeRange <= 0) return 50;
      return ((timestamp - viewWindow.start) / timeRange) * 100;
    },
    [viewWindow.start, timeRange]
  );

  /**
   * Generate time axis labels.
   */
  const getTimeLabels = useCallback((): { label: string; position: number }[] => {
    const labels: { label: string; position: number }[] = [];
    const labelCount = 6;
    for (let i = 0; i <= labelCount; i++) {
      const timestamp = viewWindow.start + (timeRange * i) / labelCount;
      const date = new Date(timestamp);
      labels.push({
        label: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        position: (i / labelCount) * 100,
      });
    }
    return labels;
  }, [viewWindow.start, timeRange]);

  // --- Scrubbing handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const deltaX = e.clientX - dragStartX;
    const timeDelta = (deltaX / containerWidth) * timeRange;

    setViewWindow(viewWindow.start - timeDelta, viewWindow.end - timeDelta);
    setDragStartX(e.clientX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;
    const center = (viewWindow.start + viewWindow.end) / 2;
    const halfRange = (timeRange * zoomFactor) / 2;
    setViewWindow(center - halfRange, center + halfRange);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = timeRange * 0.1;
    switch (e.key) {
      case 'ArrowLeft':
        setViewWindow(viewWindow.start - step, viewWindow.end - step);
        break;
      case 'ArrowRight':
        setViewWindow(viewWindow.start + step, viewWindow.end + step);
        break;
      case '+':
      case '=':
        handleZoom(0.8);
        break;
      case '-':
        handleZoom(1.2);
        break;
    }
  };

  const handleZoom = (factor: number) => {
    const center = (viewWindow.start + viewWindow.end) / 2;
    const halfRange = (timeRange * factor) / 2;
    setViewWindow(center - halfRange, center + halfRange);
  };

  const handleEventClick = (eventId: string) => {
    selectEvent(eventId);
    const event = events.find((e) => e.id === eventId);
    if (event) {
      onEventClick?.(eventId, event.checkpointId, event.agentId);
    }
  };

  const timeLabels = getTimeLabels();

  return (
    <div
      ref={containerRef}
      className="relative h-[120px] w-full bg-bg-surface border-t border-border-default select-none overflow-hidden"
      role="slider"
      aria-label="Timeline d'activite des agents"
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Time axis labels */}
      <div className="absolute bottom-0 left-0 right-0 h-6 flex items-center border-t border-border-default/50">
        {timeLabels.map(({ label, position }) => (
          <span
            key={label}
            className="absolute text-xs text-text-muted font-mono transform -translate-x-1/2"
            style={{ left: `${position}%` }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Event dots area */}
      <div className="absolute top-4 left-0 right-0 bottom-8 px-4">
        <TooltipProvider>
          {events.map((event) => {
            const position = getPositionPercent(event.timestamp);
            const color = getAgentColor(event.agentId);

            return (
              <Tooltip key={event.id}>
                <TooltipTrigger asChild>
                  <div
                    className="absolute transform -translate-x-1/2"
                    style={{ left: `${position}%`, top: `${getAgentRow(event.agentId)}px` }}
                  >
                    <TimelinePoint
                      color={color}
                      isSelected={event.id === selectedEventId}
                      category={event.category}
                      onClick={() => handleEventClick(event.id)}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-bg-elevated border border-border-default">
                  <div className="flex flex-col gap-1 max-w-[250px]">
                    <span className="text-xs text-text-muted font-mono">
                      {new Date(event.timestamp).toLocaleTimeString('fr-FR')}
                    </span>
                    <span className="text-sm text-text-primary font-medium">
                      Agent {event.agentId.slice(0, 8)}
                    </span>
                    <span className="text-xs text-text-secondary line-clamp-2">
                      {event.description ?? event.label}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}

/**
 * Calculate vertical row position for an agent (spread agents on different rows).
 * Simple: hash agent ID to a row between 0-60px.
 */
function getAgentRow(agentId: string): number {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) % 4;
  }
  return hash * 18; // 4 rows, 18px apart
}

export type { TimelineBarProps };
```

### TimelinePoint Component

```tsx
// src/renderer/src/features/agents/components/TimelinePoint.tsx
import type { TimelineEventCategory } from '@shared/types/timeline.types';

type TimelinePointProps = {
  color: string;
  isSelected: boolean;
  category: TimelineEventCategory;
  onClick: () => void;
};

const CATEGORY_SHAPES: Record<TimelineEventCategory, string> = {
  checkpoint: 'rounded-full',          // Circle for checkpoints
  'file-write': 'rounded-sm',          // Square for file writes
  'tool-call': 'rounded-full',         // Circle for tool calls
  error: 'rotate-45 rounded-sm',       // Diamond for errors
  'status-change': 'rounded-full',     // Circle for status changes
  progress: 'rounded-full',            // Circle for progress
};

export function TimelinePoint({ color, isSelected, category, onClick }: TimelinePointProps) {
  const shape = CATEGORY_SHAPES[category] ?? 'rounded-full';

  return (
    <button
      className={`
        h-2.5 w-2.5 ${shape} transition-transform duration-150
        hover:scale-150 focus-visible:ring-2 focus-visible:ring-accent
        motion-reduce:transition-none
        animate-slide-in motion-reduce:animate-none
        ${isSelected ? 'ring-2 ring-white/50 scale-150' : ''}
      `}
      style={{ backgroundColor: color }}
      onClick={onClick}
      aria-label={`Evenement ${category}`}
    />
  );
}

export type { TimelinePointProps };
```

### Timeline Animations (add to app.css)

```css
/* Add to src/renderer/src/app.css */

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-8px) translateX(-50%);
  }
  to {
    opacity: 1;
    transform: translateY(0) translateX(-50%);
  }
}

.animate-slide-in {
  animation: slide-in 150ms ease-out;
}
```

### File Structure (Story 2.4 scope)

```
src/
  shared/
    types/
      timeline.types.ts              # NEW: TimelineEvent, TimelineEventCategory
  renderer/
    src/
      features/
        agents/
          components/
            TimelinePoint.tsx         # NEW: Colored dot for timeline
            TimelinePoint.test.tsx
          hooks/
            useTimelineStream.ts      # NEW: Stream subscription for timeline
            useTimelineStream.test.ts
          timeline.store.ts           # NEW: Timeline Zustand store
          timeline.store.test.ts
      shared/
        layout/
          TimelineBar.tsx             # NEW (or updated from Story 1.2 if stub exists)
          TimelineBar.test.tsx
      app.css                         # Updated: slide-in animation
```

### Naming Conventions

| Element | Convention | This Story |
|---|---|---|
| React components | PascalCase.tsx | `TimelineBar.tsx`, `TimelinePoint.tsx` |
| Hooks | camelCase, prefix `use` | `useTimelineStream.ts` |
| Zustand store | camelCase + `.store.ts` | `timeline.store.ts` |
| Shared types | kebab-case.types.ts | `timeline.types.ts` |
| Tests | same name + `.test.ts(x)` co-located | `TimelineBar.test.tsx` |
| CSS animation class | kebab-case | `animate-slide-in` |

### Testing Strategy

**Unit tests:**

1. **timeline.store.test.ts**
   - `addEvent` adds event and sorts by timestamp
   - `addEvent` auto-assigns color to new agents
   - `addEvent` auto-expands view window for out-of-range events
   - `setViewWindow` updates start/end
   - `selectEvent` sets selectedEventId
   - `getEventsInView` returns only events within view window
   - `getAgentColor` returns consistent color for same agentId
   - Color assignment is deterministic (same order = same colors)

2. **TimelineBar.test.tsx**
   - Renders time axis labels
   - Renders TimelinePoint for each event in view
   - Calls onEventClick with correct eventId and checkpointId
   - Drag interaction updates view window
   - Keyboard navigation (arrow keys, +/- zoom)
   - Has correct ARIA attributes (role="slider", aria-label)
   - Renders empty state gracefully

3. **TimelinePoint.test.tsx**
   - Renders with correct background color
   - Applies correct shape class per category
   - Calls onClick when clicked
   - Shows selected state with ring
   - Has slide-in animation class
   - Is keyboard accessible (button role)

4. **useTimelineStream.test.ts**
   - Subscribes to stream:agent-chat on mount
   - Subscribes to stream:agent-status on mount
   - Converts chat entry with checkpoint to timeline event
   - Converts status change to timeline event
   - Cleans up subscriptions on unmount

**Integration testing approach:**
- Mount TimelineBar with pre-populated store
- Verify dots render at correct horizontal positions
- Verify tooltip content matches event data
- Verify scrubbing changes visible events

### What NOT to Do

- Do NOT use `<canvas>` for the timeline — use DOM elements for accessibility and simplicity (canvas only if perf becomes an issue with 1000+ events)
- Do NOT poll for timeline events — use stream subscriptions
- Do NOT store the entire raw stdout in the timeline — only store structured TimelineEvent objects
- Do NOT make the timeline scrollable vertically — it should fit in 120px with row assignment per agent
- Do NOT use `any` for event data or callback parameters
- Do NOT use `export default`
- Do NOT hardcode agent colors — use the deterministic color assignment from the palette
- Do NOT implement the full ChatViewer navigation in this story — only emit the click event with checkpointId. Story 2.5 handles the ChatViewer.
- Do NOT forget `role="slider"` and keyboard accessibility on the TimelineBar
- Do NOT use `setInterval` for auto-scrolling — the timeline auto-expands when new events arrive
- Do NOT create a separate feature folder for timeline — it lives under `features/agents/` since it's tightly coupled to agent monitoring
- Do NOT forget `motion-reduce:animate-none` on all animations

### References

- [Source: architecture.md#IPC-Channel-Design] — stream:agent-chat, stream:agent-status
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, useIpcStream
- [Source: architecture.md#Frontend-Component-Architecture] — Feature structure, shared layout
- [Source: architecture.md#GAP-1] — ChatEntry with checkpoint field
- [Source: ux-design-specification.md#Custom-Components] — TimelineBar spec (120px, colored dots, labels, role="slider")
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Slide-in + fade 150ms
- [Source: ux-design-specification.md#Transferable-UX-Patterns] — Timeline scrubbing (Datadog inspiration)
- [Source: ux-design-specification.md#Spacing-Layout-Foundation] — Timeline: 100% width, 120px height
- [Source: ux-design-specification.md#Accessibility-Strategy] — Keyboard navigation, ARIA, reduced motion
- [Source: ux-design-specification.md#Keyboard-Shortcuts] — Arrow keys, Esc navigation
- [Source: epics.md#Story-2.4] — Acceptance criteria
- [Source: prd.md#FR3] — Timeline d'activite agent (frise chronologique)
- [Source: prd.md#FR40] — Timeline panneau bas persistant
- [Source: prd.md#NFR1] — Timeline update < 500ms
- [Source: 2-1-agent-harness-lancer-arreter-des-agents.md] — Stream channels, ChatEntry
- [Source: 2-2-liste-des-agents-avec-indicateurs-de-sante.md] — Agents store, agent info

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
