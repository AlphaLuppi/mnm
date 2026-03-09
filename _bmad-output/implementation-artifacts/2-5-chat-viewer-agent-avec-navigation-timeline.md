# Story 2.5: Chat Viewer Agent avec Navigation Timeline

Status: ready-for-dev

## Story

As a **user**,
I want **to click a timeline checkpoint and navigate to the exact moment in the agent's chat**,
So that **I can understand what an agent was doing at any point in time**.

## Acceptance Criteria

### AC1 — Timeline checkpoint click opens chat viewer

**Given** la timeline affiche des checkpoints
**When** je clique sur un checkpoint
**Then** l'`AgentChatViewer` s'ouvre et scroll automatiquement au message correspondant (FR4)
**And** le message est mis en surbrillance

### AC2 — Chat messages with roles and timestamps

**Given** le chat viewer est ouvert
**When** je lis les messages
**Then** chaque message affiche : role (user/assistant/system), contenu, timestamp
**And** les checkpoints sont visuellement separes par des marqueurs

### AC3 — Live chat updates

**Given** un agent est actif
**When** de nouveaux messages arrivent
**Then** le chat viewer se met a jour en temps reel via `stream:agent-chat`
**And** `aria-live="polite"` annonce les nouveaux messages

### AC4 — Cross-pane synchronization on checkpoint click

**Given** je suis dans le chat viewer
**When** je clique sur un checkpoint dans la timeline
**Then** les 3 volets se synchronisent au contexte de ce moment (FR38)

## Tasks / Subtasks

- [ ] Task 1: Create useAgentChat hook (AC: #1, #2, #3)
  - [ ] 1.1 Create `src/renderer/src/features/agents/hooks/useAgentChat.ts`
  - [ ] 1.2 On mount: invoke `agent:get-chat` IPC to fetch initial chat history
  - [ ] 1.3 Subscribe to `stream:agent-chat` for live updates (filter by agentId)
  - [ ] 1.4 Merge initial history with live entries (avoid duplicates by entry ID)
  - [ ] 1.5 Expose: entries, isLoading, error (using AsyncState<T> pattern)
  - [ ] 1.6 Create `src/renderer/src/features/agents/hooks/useAgentChat.test.ts`

- [ ] Task 2: Create ChatMessage component (AC: #2)
  - [ ] 2.1 Create `src/renderer/src/features/agents/components/ChatMessage.tsx`
  - [ ] 2.2 Display message with role indicator (icon + color: user=blue, assistant=green, system=gray)
  - [ ] 2.3 Display message content with Markdown rendering (simple: code blocks, bold, italic, links)
  - [ ] 2.4 Display timestamp in JetBrains Mono font
  - [ ] 2.5 Support highlighted state (for scroll-to-checkpoint)
  - [ ] 2.6 Add `role="listitem"` for screen reader
  - [ ] 2.7 Create `src/renderer/src/features/agents/components/ChatMessage.test.tsx`

- [ ] Task 3: Create CheckpointMarker component (AC: #2)
  - [ ] 3.1 Create `src/renderer/src/features/agents/components/CheckpointMarker.tsx`
  - [ ] 3.2 Render a horizontal divider with checkpoint label centered
  - [ ] 3.3 Include checkpoint ID as data attribute (for scroll targeting)
  - [ ] 3.4 Clickable: emits checkpoint selection event
  - [ ] 3.5 Visual: dashed border line with label badge
  - [ ] 3.6 Create test file

- [ ] Task 4: Create AgentChatViewer component (AC: #1, #2, #3)
  - [ ] 4.1 Create `src/renderer/src/features/agents/components/AgentChatViewer.tsx`
  - [ ] 4.2 Use useAgentChat hook for data
  - [ ] 4.3 Render chat messages list with ChatMessage and CheckpointMarker components
  - [ ] 4.4 Auto-scroll to bottom on new messages (unless user has scrolled up)
  - [ ] 4.5 Scroll-to-checkpoint: when a checkpointId prop changes, smooth-scroll to that checkpoint
  - [ ] 4.6 Highlight the target checkpoint message temporarily (2s yellow flash)
  - [ ] 4.7 Loading state: skeleton placeholders
  - [ ] 4.8 Empty state: "Aucun message" message
  - [ ] 4.9 Add `role="log"` and `aria-live="polite"` on the message container
  - [ ] 4.10 Create `src/renderer/src/features/agents/components/AgentChatViewer.test.tsx`

- [ ] Task 5: Implement scroll-to-checkpoint logic (AC: #1)
  - [ ] 5.1 Use `useRef` + `scrollIntoView` with smooth behavior
  - [ ] 5.2 Assign `data-checkpoint-id` to CheckpointMarker elements
  - [ ] 5.3 On checkpointId prop change: find element by data attribute, scroll into view, apply highlight
  - [ ] 5.4 Handle edge case: checkpoint not yet loaded (fetch more history if needed)
  - [ ] 5.5 Respect `prefers-reduced-motion` for scroll behavior

- [ ] Task 6: Wire timeline click to chat viewer (AC: #1, #4)
  - [ ] 6.1 In parent layout component: listen to TimelineBar onEventClick
  - [ ] 6.2 Extract agentId and checkpointId from clicked event
  - [ ] 6.3 Open AgentChatViewer with the target agentId
  - [ ] 6.4 Pass checkpointId to AgentChatViewer for scroll-to
  - [ ] 6.5 Update navigation store to reflect agent focus
  - [ ] 6.6 Write integration test for timeline click -> chat viewer scroll

- [ ] Task 7: Wire cross-pane synchronization (AC: #4)
  - [ ] 7.1 On checkpoint navigation: update navigation store with agent context
  - [ ] 7.2 Volet Contexte should show files related to the agent at that checkpoint
  - [ ] 7.3 Volet Tests should show tests related to the agent's current story
  - [ ] 7.4 This is mediated by the navigation store from Story 1.4 — here we just emit the correct nav event
  - [ ] 7.5 Write test for navigation event emission

- [ ] Task 8: Double-click AgentCard opens ChatViewer (AC: #1)
  - [ ] 8.1 Wire the AgentCard double-click callback (from Story 2.2) to open AgentChatViewer
  - [ ] 8.2 Open ChatViewer in the Agents pane (replace agent list) or as a slide-in panel
  - [ ] 8.3 Add back button to return to agent list
  - [ ] 8.4 Update AgentCard tests

- [ ] Task 9: Update barrel exports (AC: all)
  - [ ] 9.1 Update `src/renderer/src/features/agents/index.ts` to export new components and hooks

## Dev Notes

### FRs Covered

- **FR4**: L'utilisateur peut cliquer sur un checkpoint de la timeline pour naviguer au moment exact dans le chat de l'agent
- **FR8** (partial): Chat viewer shows the progression context
- **FR38** (partial): Cross-pane synchronization on checkpoint click (mediated by navigation store)

### Dependencies on Previous Stories

- **Story 1.1**: IPC bridge (`useIpcInvoke`, `useIpcStream`), shared types, import aliases, Tailwind tokens
- **Story 1.2**: ThreePaneLayout (Agents pane hosts the ChatViewer)
- **Story 1.4**: Navigation store for cross-pane synchronization
- **Story 2.1**: Agent harness (`agent:get-chat` IPC, `stream:agent-chat` stream, ChatEntry type)
- **Story 2.2**: AgentCard (double-click callback), agents store
- **Story 2.4**: TimelineBar (onEventClick with checkpointId), timeline store

### Architecture Overview

The ChatViewer is the deepest level of agent inspection. It is opened from either a timeline checkpoint click or an AgentCard double-click, and shows the full conversation history of an agent.

```
TimelineBar                    AgentCard
  |                               |
  |-- click checkpoint            |-- double-click
  |                               |
  v                               v
  +-------------------------------+
  |                               |
  v                               v
Parent Layout Component
  |
  |-- sets agentId + checkpointId
  |
  v
AgentChatViewer.tsx
  |-- useAgentChat(agentId)
  |     |-- invoke agent:get-chat (initial)
  |     |-- stream:agent-chat (live)
  |
  |-- ChatMessage.tsx (per entry)
  |-- CheckpointMarker.tsx (entries with checkpoint)
  |
  |-- scroll-to-checkpoint(checkpointId)
  |
  |-- emit nav event -> navigation.store.ts -> sync 3 panes
```

### useAgentChat Hook

```typescript
// src/renderer/src/features/agents/hooks/useAgentChat.ts
import { useEffect, useCallback, useRef, useState } from 'react';
import type { ChatEntry } from '@shared/types/chat.types';
import type { AppError } from '@shared/types/error.types';

type AgentChatState = {
  entries: ChatEntry[];
  isLoading: boolean;
  error: AppError | null;
};

/**
 * Hook that provides the full chat history for an agent,
 * combining initial fetch with live stream updates.
 */
export function useAgentChat(agentId: string | null): AgentChatState {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const entryIdsRef = useRef(new Set<string>());

  // Initial fetch
  useEffect(() => {
    if (!agentId) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    window.electronAPI
      .invoke('agent:get-chat', { agentId })
      .then((history) => {
        setEntries(history);
        entryIdsRef.current = new Set(history.map((e) => e.id));
        setIsLoading(false);
      })
      .catch((err) => {
        setError({
          code: 'AGENT_CHAT_FETCH_FAILED',
          message: 'Impossible de charger le chat de l\'agent',
          source: 'useAgentChat',
          details: err,
        });
        setIsLoading(false);
      });
  }, [agentId]);

  // Live stream subscription
  useEffect(() => {
    if (!agentId) return;

    const cleanup = window.electronAPI.on('stream:agent-chat', (entry) => {
      if (entry.agentId !== agentId) return;
      if (entryIdsRef.current.has(entry.id)) return; // Deduplicate

      entryIdsRef.current.add(entry.id);
      setEntries((prev) => [...prev, entry]);
    });

    return cleanup;
  }, [agentId]);

  return { entries, isLoading, error };
}
```

### ChatMessage Component

```tsx
// src/renderer/src/features/agents/components/ChatMessage.tsx
import type { ChatRole } from '@shared/types/chat.types';

type ChatMessageProps = {
  role: ChatRole;
  content: string;
  timestamp: number;
  isHighlighted?: boolean;
};

const ROLE_CONFIG: Record<ChatRole, { icon: string; color: string; label: string }> = {
  user: { icon: 'U', color: 'text-accent', label: 'Utilisateur' },
  assistant: { icon: 'A', color: 'text-status-green', label: 'Assistant' },
  system: { icon: 'S', color: 'text-text-muted', label: 'Systeme' },
};

export function ChatMessage({ role, content, timestamp, isHighlighted }: ChatMessageProps) {
  const config = ROLE_CONFIG[role];
  const time = new Date(timestamp);

  return (
    <div
      role="listitem"
      className={`
        flex gap-3 px-4 py-3 transition-colors duration-200
        ${isHighlighted ? 'bg-accent/10 ring-1 ring-accent/30' : 'hover:bg-bg-elevated/50'}
      `}
    >
      {/* Role indicator */}
      <div
        className={`
          flex items-center justify-center h-7 w-7 rounded-full shrink-0
          bg-bg-elevated border border-border-default text-xs font-bold
          ${config.color}
        `}
        aria-label={config.label}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
          <span className="text-xs text-text-muted font-mono">
            {time.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>

        <div className="text-sm text-text-primary whitespace-pre-wrap break-words">
          {renderContent(content)}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple Markdown-like rendering for chat content.
 * Handles code blocks, inline code, bold, and tool call formatting.
 */
function renderContent(content: string): React.ReactNode {
  // Detect code blocks (```...```)
  if (content.includes('```')) {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const code = part.slice(3, -3).replace(/^\w+\n/, ''); // Remove language hint
            return (
              <pre
                key={i}
                className="mt-2 p-3 bg-bg-base rounded-md text-xs font-mono overflow-x-auto border border-border-default"
              >
                <code>{code.trim()}</code>
              </pre>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  }

  // Detect tool call markers
  if (content.startsWith('[Tool Call:') || content.startsWith('[Tool Result:')) {
    return (
      <div className="p-2 bg-bg-base rounded-md border border-border-default text-xs font-mono">
        {content}
      </div>
    );
  }

  // Detect error markers
  if (content.startsWith('[Error]')) {
    return (
      <div className="p-2 bg-status-red/10 rounded-md border border-status-red/30 text-xs text-status-red">
        {content}
      </div>
    );
  }

  return content;
}

export type { ChatMessageProps };
```

### CheckpointMarker Component

```tsx
// src/renderer/src/features/agents/components/CheckpointMarker.tsx

type CheckpointMarkerProps = {
  checkpointId: string;
  label: string;
  timestamp: number;
  onClick?: (checkpointId: string) => void;
};

export function CheckpointMarker({ checkpointId, label, timestamp, onClick }: CheckpointMarkerProps) {
  const time = new Date(timestamp);

  return (
    <div
      className="relative flex items-center gap-2 py-2 px-4"
      data-checkpoint-id={checkpointId}
    >
      {/* Dashed line */}
      <div className="flex-1 border-t border-dashed border-border-active" />

      {/* Checkpoint badge */}
      <button
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
          bg-bg-elevated border border-border-active text-xs text-text-secondary
          hover:bg-accent/10 hover:border-accent/50 hover:text-text-primary
          transition-colors cursor-pointer
          focus-visible:ring-2 focus-visible:ring-accent
        `}
        onClick={() => onClick?.(checkpointId)}
        aria-label={`Checkpoint: ${label}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="max-w-[200px] truncate">{label}</span>
        <span className="text-text-muted font-mono">
          {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </button>

      {/* Dashed line */}
      <div className="flex-1 border-t border-dashed border-border-active" />
    </div>
  );
}

export type { CheckpointMarkerProps };
```

### AgentChatViewer Component

```tsx
// src/renderer/src/features/agents/components/AgentChatViewer.tsx
import { useRef, useEffect, useState, useCallback } from 'react';
import { useAgentChat } from '../hooks/useAgentChat';
import { ChatMessage } from './ChatMessage';
import { CheckpointMarker } from './CheckpointMarker';
import type { ChatEntry } from '@shared/types/chat.types';

type AgentChatViewerProps = {
  agentId: string;
  scrollToCheckpoint?: string;
  onCheckpointClick?: (checkpointId: string) => void;
  onBack?: () => void;
};

export function AgentChatViewer({
  agentId,
  scrollToCheckpoint,
  onCheckpointClick,
  onBack,
}: AgentChatViewerProps) {
  const { entries, isLoading, error } = useAgentChat(agentId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevEntriesLengthRef = useRef(0);

  // --- Scroll to checkpoint when prop changes ---
  useEffect(() => {
    if (!scrollToCheckpoint || entries.length === 0) return;

    const element = scrollContainerRef.current?.querySelector(
      `[data-checkpoint-id="${scrollToCheckpoint}"]`
    );

    if (element) {
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      element.scrollIntoView({
        behavior: prefersReducedMotion ? 'instant' : 'smooth',
        block: 'center',
      });

      // Find the entry associated with this checkpoint for highlighting
      const entry = entries.find((e) => e.checkpoint === scrollToCheckpoint);
      if (entry) {
        setHighlightedId(entry.id);
        // Remove highlight after 2 seconds
        setTimeout(() => setHighlightedId(null), 2000);
      }
    }
  }, [scrollToCheckpoint, entries]);

  // --- Auto-scroll to bottom on new messages ---
  useEffect(() => {
    if (!autoScroll) return;
    if (entries.length > prevEntriesLengthRef.current) {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
    prevEntriesLengthRef.current = entries.length;
  }, [entries.length, autoScroll]);

  // --- Detect user scroll (disable auto-scroll when user scrolls up) ---
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-7 w-7 rounded-full bg-bg-elevated" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-bg-elevated rounded" />
              <div className="h-4 w-full bg-bg-elevated rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-text-muted">
        <p className="text-sm text-status-red">{error.message}</p>
        <button
          className="px-3 py-1.5 text-xs bg-bg-elevated border border-border-default rounded-md hover:bg-accent/10 transition-colors"
          onClick={() => {
            // Re-trigger by forcing agentId change — or parent could handle this
          }}
        >
          Reessayer
        </button>
      </div>
    );
  }

  // --- Empty state ---
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
        <p className="text-sm">Aucun message</p>
        <p className="text-xs">L'agent n'a pas encore produit d'output.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border-default bg-bg-surface">
        {onBack && (
          <button
            className="text-xs text-text-secondary hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent rounded px-2 py-1"
            onClick={onBack}
            aria-label="Retour a la liste des agents"
          >
            &larr; Retour
          </button>
        )}
        <span className="text-sm font-medium text-text-primary">
          Chat — Agent {agentId.slice(0, 8)}
        </span>
        <span className="text-xs text-text-muted ml-auto">
          {entries.length} messages
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label={`Chat de l'agent ${agentId.slice(0, 8)}`}
        onScroll={handleScroll}
      >
        {entries.map((entry) => (
          <EntryRenderer
            key={entry.id}
            entry={entry}
            isHighlighted={entry.id === highlightedId}
            onCheckpointClick={onCheckpointClick}
          />
        ))}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && entries.length > 0 && (
        <button
          className="absolute bottom-4 right-4 px-3 py-1.5 text-xs bg-accent text-white rounded-full shadow-lg hover:bg-accent-hover transition-colors"
          onClick={() => {
            setAutoScroll(true);
            const container = scrollContainerRef.current;
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }}
        >
          Defiler vers le bas
        </button>
      )}
    </div>
  );
}

type EntryRendererProps = {
  entry: ChatEntry;
  isHighlighted: boolean;
  onCheckpointClick?: (checkpointId: string) => void;
};

function EntryRenderer({ entry, isHighlighted, onCheckpointClick }: EntryRendererProps) {
  if (entry.checkpoint) {
    return (
      <>
        <CheckpointMarker
          checkpointId={entry.checkpoint}
          label={entry.content}
          timestamp={entry.timestamp}
          onClick={onCheckpointClick}
        />
        <ChatMessage
          role={entry.role}
          content={entry.content}
          timestamp={entry.timestamp}
          isHighlighted={isHighlighted}
        />
      </>
    );
  }

  return (
    <ChatMessage
      role={entry.role}
      content={entry.content}
      timestamp={entry.timestamp}
      isHighlighted={isHighlighted}
    />
  );
}

export type { AgentChatViewerProps };
```

### Wiring Timeline Click to ChatViewer

```tsx
// In the parent layout component (e.g., AgentsPane or ThreePaneLayout):

import { useState } from 'react';
import { AgentList } from '@renderer/features/agents';
import { AgentChatViewer } from '@renderer/features/agents/components/AgentChatViewer';
import { TimelineBar } from '@renderer/shared/layout/TimelineBar';

// State management for agent pane view:
type AgentsPaneView =
  | { mode: 'list' }
  | { mode: 'chat'; agentId: string; scrollToCheckpoint?: string };

export function AgentsPane() {
  const [view, setView] = useState<AgentsPaneView>({ mode: 'list' });

  const handleTimelineEventClick = (
    eventId: string,
    checkpointId?: string,
    agentId?: string
  ) => {
    if (agentId && checkpointId) {
      setView({ mode: 'chat', agentId, scrollToCheckpoint: checkpointId });
    }
  };

  const handleAgentDoubleClick = (agentId: string) => {
    setView({ mode: 'chat', agentId });
  };

  const handleBack = () => {
    setView({ mode: 'list' });
  };

  const handleCheckpointClick = (checkpointId: string) => {
    // Update navigation store for cross-pane sync
    // navigationStore.setAgentCheckpoint(view.mode === 'chat' ? view.agentId : null, checkpointId);
  };

  return (
    <>
      {/* Agents pane content */}
      {view.mode === 'list' ? (
        <AgentList
          onOpenChatViewer={handleAgentDoubleClick}
        />
      ) : (
        <AgentChatViewer
          agentId={view.agentId}
          scrollToCheckpoint={view.scrollToCheckpoint}
          onCheckpointClick={handleCheckpointClick}
          onBack={handleBack}
        />
      )}

      {/* Timeline bar (in layout bottom slot) */}
      {/* <TimelineBar onEventClick={handleTimelineEventClick} /> */}
    </>
  );
}
```

### Cross-Pane Synchronization

```typescript
// When a checkpoint is clicked in the chat viewer or timeline,
// emit a navigation event to sync all 3 panes.

// Navigation store integration (from Story 1.4):
// The navigation store exposes:
// - setLevel(level, id) — sets the current navigation level
// - setAgentFocus(agentId) — focuses on a specific agent

// In the handler:
const handleCheckpointClick = (checkpointId: string) => {
  // 1. Scroll chat to checkpoint (handled by AgentChatViewer internally)
  // 2. Update navigation store to sync panes:
  //    - Context pane shows files the agent was using at this point
  //    - Tests pane shows tests related to the agent's story
  // 3. Update timeline store to highlight this checkpoint

  if (view.mode === 'chat') {
    setView({ ...view, scrollToCheckpoint: checkpointId });
  }

  // Emit to navigation store (Story 1.4 provides this):
  // navigationStore.getState().setAgentFocus(view.agentId, checkpointId);

  // Highlight in timeline:
  // timelineStore.getState().selectEvent(eventIdForCheckpoint);
};
```

### File Structure (Story 2.5 scope)

```
src/
  renderer/
    src/
      features/
        agents/
          components/
            AgentChatViewer.tsx         # NEW: Main chat viewer component
            AgentChatViewer.test.tsx
            ChatMessage.tsx             # NEW: Individual chat message
            ChatMessage.test.tsx
            CheckpointMarker.tsx        # NEW: Checkpoint divider
            CheckpointMarker.test.tsx
          hooks/
            useAgentChat.ts             # NEW: Chat data hook (invoke + stream)
            useAgentChat.test.ts
          index.ts                      # Updated: export new components
```

### Naming Conventions

| Element | Convention | This Story |
|---|---|---|
| React components | PascalCase.tsx | `AgentChatViewer.tsx`, `ChatMessage.tsx`, `CheckpointMarker.tsx` |
| Hooks | camelCase, prefix `use` | `useAgentChat.ts` |
| Tests | same name + `.test.ts(x)` co-located | `AgentChatViewer.test.tsx` |
| Data attributes | kebab-case | `data-checkpoint-id` |

### Testing Strategy

**Unit tests:**

1. **useAgentChat.test.ts**
   - Fetches initial history via agent:get-chat on mount
   - Sets isLoading true during fetch, false after
   - Sets error on fetch failure
   - Subscribes to stream:agent-chat and adds new entries
   - Filters stream entries by agentId
   - Deduplicates entries by ID
   - Returns empty entries when agentId is null
   - Cleans up stream subscription on unmount

2. **ChatMessage.test.tsx**
   - Renders role indicator with correct letter and color
   - Renders message content
   - Renders timestamp in correct format
   - Applies highlight class when isHighlighted is true
   - Renders code blocks in pre/code elements
   - Renders tool calls in styled container
   - Renders error messages in red container
   - Has role="listitem"

3. **CheckpointMarker.test.tsx**
   - Renders checkpoint label
   - Renders timestamp
   - Has data-checkpoint-id attribute
   - Calls onClick with checkpointId when clicked
   - Is keyboard accessible (button)

4. **AgentChatViewer.test.tsx**
   - Renders loading skeletons when isLoading
   - Renders empty state when no entries
   - Renders error message on error
   - Renders ChatMessage for each entry
   - Renders CheckpointMarker for entries with checkpoint
   - Auto-scrolls to bottom on new messages
   - Scrolls to checkpoint when scrollToCheckpoint prop changes
   - Highlights target message temporarily
   - Shows back button when onBack provided
   - Has role="log" and aria-live="polite"
   - Shows "scroll to bottom" button when not at bottom

5. **Integration tests:**
   - Timeline click -> AgentChatViewer opens with correct agent
   - AgentCard double-click -> ChatViewer opens
   - Checkpoint in viewer click -> timeline highlight updates
   - Live message arrives -> auto-scrolls to bottom

**Mocking approach:**
```typescript
// Mock window.electronAPI for tests
const mockInvoke = vi.fn();
const mockOn = vi.fn(() => vi.fn()); // Returns cleanup

beforeEach(() => {
  window.electronAPI = {
    invoke: mockInvoke,
    on: mockOn,
  } as unknown as typeof window.electronAPI;
});
```

### What NOT to Do

- Do NOT use a third-party Markdown renderer (remark-react, etc.) for chat messages — keep it simple with basic string parsing. Full Markdown rendering is not needed for chat bubbles.
- Do NOT load the entire chat history at once for long-running agents — implement pagination or virtual scrolling if entries exceed 1000 (can be deferred post-MVP)
- Do NOT use `dangerouslySetInnerHTML` for message content — parse safely
- Do NOT use `any` for callback parameters or chat entry data
- Do NOT use `export default`
- Do NOT forget `role="log"` and `aria-live="polite"` on the chat container
- Do NOT auto-scroll when the user has scrolled up to read previous messages
- Do NOT make the highlight permanent — it should fade after 2 seconds
- Do NOT implement the full cross-pane sync logic here — just emit the navigation intent via the store. The actual sync is mediated by the navigation store from Story 1.4.
- Do NOT use `innerHTML` or `dangerouslySetInnerHTML` for rendering chat content
- Do NOT create a new store for chat state — use local component state via the useAgentChat hook (chat state is per-viewer, not global)
- Do NOT forget to handle the case where a checkpoint is not yet loaded (the user clicked a checkpoint from early in the session but the viewer only has recent messages)

### References

- [Source: architecture.md#GAP-1] — Chat Segmenter, AgentChatViewer, useAgentChat, ChatEntry type
- [Source: architecture.md#IPC-Channel-Design] — agent:get-chat, stream:agent-chat
- [Source: architecture.md#Communication-Patterns] — useIpcInvoke, useIpcStream patterns
- [Source: architecture.md#Frontend-Component-Architecture] — Feature structure
- [Source: ux-design-specification.md#Custom-Components] — AgentChatViewer spec (messages with roles, checkpoints, role="log", aria-live)
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Slide-in + fade transitions
- [Source: ux-design-specification.md#Empty-States-Loading] — Loading skeletons, empty state messages
- [Source: ux-design-specification.md#Accessibility-Strategy] — aria-live, keyboard navigation, focus management
- [Source: ux-design-specification.md#User-Journey-Flows] — Tom's journey: badge -> card -> timeline -> ChatViewer
- [Source: ux-design-specification.md#Flow-Optimization-Principles] — Max 2 clicks from cockpit to resolution
- [Source: epics.md#Story-2.5] — Acceptance criteria
- [Source: prd.md#FR4] — Navigation checkpoint timeline -> chat agent
- [Source: prd.md#FR38] — Navigation hierarchique synchronisee (3 volets sync)
- [Source: 2-1-agent-harness-lancer-arreter-des-agents.md] — agent:get-chat IPC, ChatEntry, ChatSegmenter
- [Source: 2-2-liste-des-agents-avec-indicateurs-de-sante.md] — AgentCard double-click, agents store
- [Source: 2-4-timeline-activite-des-agents.md] — TimelineBar onEventClick, checkpoint navigation

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
