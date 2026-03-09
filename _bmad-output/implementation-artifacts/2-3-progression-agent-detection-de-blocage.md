# Story 2.3: Progression Agent & Detection de Blocage

Status: ready-for-dev

## Story

As a **user**,
I want **to see agent progress as completed/remaining steps and access blocage points in one click**,
So that **I can quickly identify and unblock stuck agents**.

## Acceptance Criteria

### AC1 — Progress bar with step ratio

**Given** un agent est actif
**When** je regarde son `AgentCard`
**Then** je vois une `AgentProgressBar` avec le ratio etapes completees / restantes
**And** les etapes sont extraites des checkpoints ou todolist de l'agent (FR8)

### AC2 — Blocked agent visual emphasis

**Given** un agent est bloque (indicateur rouge)
**When** je regarde la liste des agents
**Then** le blocage est visuellement mis en evidence (badge "Bloque" + rouge)
**And** je peux acceder au point de blocage en un clic (FR5)

### AC3 — One-click navigation to blocage point

**Given** je clique sur un agent bloque
**When** la vue detail s'ouvre
**Then** je suis positionne directement sur le message/output qui a cause le blocage

## Tasks / Subtasks

- [ ] Task 1: Extend stdout-parser for progress extraction (AC: #1)
  - [ ] 1.1 Add progress detection in `src/main/services/agent/stdout-parser.ts`
  - [ ] 1.2 Detect Claude Code todolist patterns: `- [x] completed task` and `- [ ] pending task`
  - [ ] 1.3 Detect numerical progress patterns (e.g., "Step 3/7", "Task 2 of 5")
  - [ ] 1.4 Emit `progress` event type with `{ completed: number, total: number }`
  - [ ] 1.5 Update `stdout-parser.test.ts` with progress detection test cases

- [ ] Task 2: Extend agent harness for progress tracking (AC: #1)
  - [ ] 2.1 Update `AgentInfo.progress` field on progress events from parser
  - [ ] 2.2 Include progress data in `stream:agent-status` events
  - [ ] 2.3 Update agent harness tests for progress tracking

- [ ] Task 3: Implement blocking detection heuristic (AC: #2)
  - [ ] 3.1 Create `src/main/services/agent/blocking-detector.ts`
  - [ ] 3.2 Implement heuristic: no output for N seconds (configurable, default 60s) AND agent is ACTIVE
  - [ ] 3.3 Detect stderr patterns indicating blocking (permission denied, rate limit, etc.)
  - [ ] 3.4 Detect repeated error patterns in stdout (retry loops)
  - [ ] 3.5 When blocking detected: update agent status to BLOCKED, store the blocking context (last output, stderr, timestamp)
  - [ ] 3.6 Emit `agent:status` event with BLOCKED status
  - [ ] 3.7 Create `src/main/services/agent/blocking-detector.test.ts`

- [ ] Task 4: Update agents store with progress and blocking (AC: #1, #2)
  - [ ] 4.1 Add `progress` field to store state per agent (already in AgentInfo)
  - [ ] 4.2 Add `blockingContext` field: `{ lastMessage: string; timestamp: number; stderrSnippet?: string }`
  - [ ] 4.3 Update `updateStatus` action to handle BLOCKED status with blocking context
  - [ ] 4.4 Create selector `getBlockedAgents` returning agents with BLOCKED status
  - [ ] 4.5 Update store tests

- [ ] Task 5: Create AgentProgressBar component (AC: #1)
  - [ ] 5.1 Create `src/renderer/src/features/agents/components/AgentProgressBar.tsx`
  - [ ] 5.2 Display horizontal progress bar with fill based on completed/total ratio
  - [ ] 5.3 Color the fill based on health: green (active), red (blocked/crashed), striped pattern (stalled)
  - [ ] 5.4 Show label: "3/7 etapes" or percentage
  - [ ] 5.5 Transition fill width with 300ms ease-out animation
  - [ ] 5.6 Respect `prefers-reduced-motion`
  - [ ] 5.7 Handle edge cases: progress unknown (indeterminate bar), 0/0, completed (100% green solid)
  - [ ] 5.8 Add `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
  - [ ] 5.9 Create `src/renderer/src/features/agents/components/AgentProgressBar.test.tsx`

- [ ] Task 6: Create BlockedBadge component (AC: #2)
  - [ ] 6.1 Create `src/renderer/src/features/agents/components/BlockedBadge.tsx`
  - [ ] 6.2 Display "Bloque" text with red background badge
  - [ ] 6.3 Clickable — triggers navigation to blocking point
  - [ ] 6.4 Add `role="alert"` for screen readers
  - [ ] 6.5 Create test file

- [ ] Task 7: Integrate into AgentCard (AC: #1, #2, #3)
  - [ ] 7.1 Add AgentProgressBar to AgentCard below the task description
  - [ ] 7.2 Add BlockedBadge to AgentCard when agent status is BLOCKED
  - [ ] 7.3 Wire BlockedBadge click to navigate to blocking point (emit navigation event or callback)
  - [ ] 7.4 Update AgentCard tests

- [ ] Task 8: Implement one-click navigation to blocking point (AC: #3)
  - [ ] 8.1 Store blocking checkpoint ID in agent's blocking context
  - [ ] 8.2 On BlockedBadge click: invoke callback that opens ChatViewer at the blocking checkpoint
  - [ ] 8.3 The actual ChatViewer is Story 2.5 — here we just emit the navigation intent with the checkpoint ID
  - [ ] 8.4 Write integration test for the navigation flow

## Dev Notes

### FRs Covered

- **FR8**: L'utilisateur peut voir la progression d'un agent sous forme d'etapes (taches du todolist ou checkpoints emis par l'agent) avec distinction entre completees et restantes
- **FR5**: L'utilisateur peut voir quand un agent est bloque et acceder au point de blocage en un clic

### Dependencies on Previous Stories

- **Story 1.1**: IPC bridge, event bus, shared types, Tailwind tokens
- **Story 2.1**: Agent harness service (AgentInfo with progress field, stdout-parser, chat-segmenter, event bus wiring)
- **Story 2.2**: Agents store, HealthIndicator, AgentCard (this story extends them), useAgentStream hook

### Architecture Overview

This story adds two capabilities: progress tracking and blocking detection. Both originate in the main process (stdout analysis) and surface in the renderer (visual components).

```
Main Process                               Renderer Process
                                              |
StdoutParser                                  |
  |-- progress event (completed/total)        |
  |                                           |
BlockingDetector                              |
  |-- monitors output frequency               |
  |-- detects error patterns                  |
  |-- sets BLOCKED status                     |
  |                                           |
  v                                           |
AgentHarnessService                           |
  |-- stream:agent-status (with progress) --> agents.store.ts
                                              |
                                         AgentCard.tsx
                                           |-- AgentProgressBar.tsx
                                           |-- BlockedBadge.tsx
                                              |
                                         (click) --> navigation intent
                                              |      to ChatViewer (Story 2.5)
```

### Progress Detection in StdoutParser

```typescript
// Extensions to src/main/services/agent/stdout-parser.ts

// Add to StdoutEvent union:
// | { type: 'progress'; completed: number; total: number }

// Add detection in parseLine:
private detectProgress(content: string): void {
  // Pattern 1: Markdown todolist
  // Count [x] and [ ] occurrences
  const completedMatches = content.match(/- \[x\]/gi);
  const pendingMatches = content.match(/- \[ \]/gi);

  if (completedMatches || pendingMatches) {
    const completed = completedMatches?.length ?? 0;
    const total = completed + (pendingMatches?.length ?? 0);
    if (total > 0) {
      this.emit('event', {
        type: 'progress',
        completed,
        total,
      });
    }
  }

  // Pattern 2: "Step X/Y" or "Task X of Y"
  const stepPattern = /(?:step|task|etape)\s+(\d+)\s*(?:\/|of|sur)\s*(\d+)/i;
  const match = content.match(stepPattern);
  if (match) {
    this.emit('event', {
      type: 'progress',
      completed: parseInt(match[1], 10),
      total: parseInt(match[2], 10),
    });
  }
}
```

### BlockingDetector Implementation

```typescript
// src/main/services/agent/blocking-detector.ts

type BlockingContext = {
  lastMessage: string;
  timestamp: number;
  stderrSnippet?: string;
  checkpointId?: string;
  reason: 'timeout' | 'error-pattern' | 'stderr-error';
};

type BlockingDetectorConfig = {
  timeoutMs: number;           // Default: 60000 (60s)
  errorPatterns: RegExp[];     // Patterns in stdout indicating blocking
  stderrPatterns: RegExp[];    // Patterns in stderr indicating blocking
};

const DEFAULT_CONFIG: BlockingDetectorConfig = {
  timeoutMs: 60_000,
  errorPatterns: [
    /rate.?limit/i,
    /permission.?denied/i,
    /authentication.?failed/i,
    /connection.?refused/i,
    /timed?\s*out/i,
    /quota.?exceeded/i,
  ],
  stderrPatterns: [
    /error/i,
    /fatal/i,
    /permission.?denied/i,
  ],
};

export class BlockingDetector {
  private config: BlockingDetectorConfig;
  private lastOutputTimestamp: number;
  private lastOutputContent = '';
  private stderrBuffer = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onBlocked: (context: BlockingContext) => void;
  private isBlocked = false;

  constructor(
    onBlocked: (context: BlockingContext) => void,
    config?: Partial<BlockingDetectorConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lastOutputTimestamp = Date.now();
    this.onBlocked = onBlocked;
    this.startTimer();
  }

  /**
   * Call when stdout data is received. Resets the timeout timer.
   */
  onOutput(content: string): void {
    this.lastOutputTimestamp = Date.now();
    this.lastOutputContent = content;
    this.isBlocked = false;
    this.resetTimer();

    // Check for error patterns in stdout
    for (const pattern of this.config.errorPatterns) {
      if (pattern.test(content)) {
        this.triggerBlocked({
          lastMessage: content,
          timestamp: Date.now(),
          reason: 'error-pattern',
        });
        return;
      }
    }
  }

  /**
   * Call when stderr data is received.
   */
  onStderr(data: string): void {
    this.stderrBuffer += data;

    // Check for blocking patterns in stderr
    for (const pattern of this.config.stderrPatterns) {
      if (pattern.test(data)) {
        this.triggerBlocked({
          lastMessage: this.lastOutputContent,
          timestamp: Date.now(),
          stderrSnippet: this.stderrBuffer.slice(-500),
          reason: 'stderr-error',
        });
        return;
      }
    }
  }

  /**
   * Set a checkpoint ID for the current position.
   */
  setCheckpoint(checkpointId: string): void {
    // Store for use in blocking context
    this._lastCheckpointId = checkpointId;
  }
  private _lastCheckpointId?: string;

  /**
   * Stop monitoring.
   */
  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private startTimer(): void {
    this.timer = setTimeout(() => {
      if (!this.isBlocked) {
        this.triggerBlocked({
          lastMessage: this.lastOutputContent,
          timestamp: Date.now(),
          stderrSnippet: this.stderrBuffer.slice(-500) || undefined,
          reason: 'timeout',
        });
      }
    }, this.config.timeoutMs);
  }

  private resetTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.startTimer();
  }

  private triggerBlocked(context: BlockingContext): void {
    if (this.isBlocked) return; // Prevent duplicate triggers
    this.isBlocked = true;
    context.checkpointId = this._lastCheckpointId;
    this.onBlocked(context);
  }
}

export type { BlockingContext, BlockingDetectorConfig };
```

### Integration with AgentHarnessService

```typescript
// Updates to src/main/services/agent/agent-harness.service.ts

import { BlockingDetector } from './blocking-detector';
import type { BlockingContext } from './blocking-detector';

// In AgentProcess type, add:
// blockingDetector: BlockingDetector;
// blockingContext?: BlockingContext;

// In launchAgent(), after creating parser and segmenter:
const blockingDetector = new BlockingDetector(
  (context: BlockingContext) => {
    info.status = AgentStatus.BLOCKED;
    agentProcess.blockingContext = context;
    this.onStatusChange(agentId, AgentStatus.BLOCKED, context.lastMessage);
    logger.warn('agent-harness', `Agent ${agentId} blocked: ${context.reason}`);
  },
  { timeoutMs: this.blockingTimeoutMs }
);

// Wire stdout to blocking detector:
child.stdout?.on('data', (data: Buffer) => {
  const text = data.toString();
  info.lastOutputAt = Date.now();
  blockingDetector.onOutput(text);
  this.onOutput(agentId, text);
  parser.feed(text);
});

child.stderr?.on('data', (data: Buffer) => {
  const text = data.toString();
  agentProcess.stderrBuffer += text;
  blockingDetector.onStderr(text);
});

// Wire checkpoint detection:
parser.on('event', (event) => {
  const entry = segmenter.process(event);
  if (entry) {
    if (entry.checkpoint) {
      blockingDetector.setCheckpoint(entry.checkpoint);
    }
    this.onChatEntry(entry);
  }

  // Handle progress events
  if (event.type === 'progress') {
    info.progress = { completed: event.completed, total: event.total };
    this.onStatusChange(agentId, info.status); // Re-emit status with progress
  }
});

// In stopAgent or close handler: blockingDetector.destroy();
```

### Agents Store Extensions

```typescript
// Extensions to src/renderer/src/features/agents/agents.store.ts

import type { BlockingContext } from '@shared/types/agent.types';

// Add to AgentsState:
// blockingContexts: Map<string, BlockingContext>;

// Add actions:
// setBlockingContext: (agentId: string, context: BlockingContext) => void;
// getBlockedAgents: () => AgentInfo[];

// Add BlockingContext to shared types:
// src/shared/types/agent.types.ts
export type BlockingContext = {
  lastMessage: string;
  timestamp: number;
  stderrSnippet?: string;
  checkpointId?: string;
  reason: 'timeout' | 'error-pattern' | 'stderr-error';
};

// Extension to stream:agent-status to include blockingContext:
// In IpcStreamChannels:
// 'stream:agent-status': {
//   agentId: string;
//   status: AgentStatus;
//   lastError?: string;
//   progress?: { completed: number; total: number };
//   blockingContext?: BlockingContext;
// };
```

### AgentProgressBar Component

```tsx
// src/renderer/src/features/agents/components/AgentProgressBar.tsx

type AgentProgressBarProps = {
  completed: number;
  total: number;
  status: 'active' | 'blocked' | 'stalled' | 'complete';
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-status-green',
  blocked: 'bg-status-red',
  stalled: 'bg-status-orange bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.15)_4px,rgba(0,0,0,0.15)_8px)]',
  complete: 'bg-status-green',
};

export function AgentProgressBar({ completed, total, status }: AgentProgressBarProps) {
  const isIndeterminate = total === 0;
  const percentage = isIndeterminate ? 0 : Math.round((completed / total) * 100);
  const fillWidth = isIndeterminate ? 30 : percentage; // 30% for indeterminate

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1.5 bg-border-default rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          isIndeterminate
            ? 'Progression inconnue'
            : `${completed} sur ${total} etapes completees`
        }
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none ${
            isIndeterminate ? 'animate-indeterminate' : ''
          } ${STATUS_COLORS[status]}`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>

      <span className="text-xs text-text-muted font-mono shrink-0 min-w-[4ch] text-right">
        {isIndeterminate ? '...' : `${completed}/${total}`}
      </span>
    </div>
  );
}

export type { AgentProgressBarProps };
```

### Indeterminate Animation (add to app.css)

```css
/* Add to src/renderer/src/app.css */

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

.animate-indeterminate {
  animation: indeterminate 1.5s ease-in-out infinite;
  width: 30% !important;
}
```

### BlockedBadge Component

```tsx
// src/renderer/src/features/agents/components/BlockedBadge.tsx

type BlockedBadgeProps = {
  onClick?: () => void;
  reason?: string;
};

export function BlockedBadge({ onClick, reason }: BlockedBadgeProps) {
  return (
    <button
      role="alert"
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
        bg-status-red/15 text-status-red border border-status-red/30
        hover:bg-status-red/25 transition-colors cursor-pointer
        focus-visible:ring-2 focus-visible:ring-accent
      `}
      onClick={onClick}
      aria-label={`Agent bloque${reason ? `: ${reason}` : ''}. Cliquer pour voir le point de blocage.`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-red animate-pulse-alert motion-reduce:animate-none" />
      Bloque
    </button>
  );
}

export type { BlockedBadgeProps };
```

### Updated AgentCard Integration

```tsx
// Updates to src/renderer/src/features/agents/components/AgentCard.tsx

import { AgentProgressBar } from './AgentProgressBar';
import { BlockedBadge } from './BlockedBadge';
import { AgentStatus } from '@shared/types/agent.types';

// Inside AgentCard component, after the task description paragraph:

// Determine progress bar status
const progressStatus = (() => {
  if (agent.status === AgentStatus.BLOCKED || agent.status === AgentStatus.CRASHED) return 'blocked';
  if (healthColor === 'orange') return 'stalled';
  if (agent.status === AgentStatus.STOPPED && agent.progress?.completed === agent.progress?.total) return 'complete';
  return 'active';
})();

// In the JSX, after the task <p>:
{agent.progress && (
  <AgentProgressBar
    completed={agent.progress.completed}
    total={agent.progress.total}
    status={progressStatus}
  />
)}

{agent.status === AgentStatus.BLOCKED && (
  <BlockedBadge
    onClick={() => onNavigateToBlockage?.(agentId)}
    reason={agent.lastError?.slice(0, 50)}
  />
)}
```

### Navigation Intent for Blocking Point

```typescript
// When BlockedBadge is clicked, the AgentCard emits a navigation intent.
// This is consumed by a parent component that will open the ChatViewer (Story 2.5).
// For now, we define the callback type and pass it through.

// AgentCardProps update:
type AgentCardProps = {
  agentId: string;
  isSelected?: boolean;
  onSelect?: (agentId: string) => void;
  onDoubleClick?: (agentId: string) => void;
  onNavigateToBlockage?: (agentId: string) => void;
};

// The parent (AgentList) receives the callback and can:
// 1. Look up the blockingContext.checkpointId from the store
// 2. Emit a navigation event to open ChatViewer at that checkpoint
// Example:
// const handleNavigateToBlockage = (agentId: string) => {
//   const context = blockingContexts.get(agentId);
//   if (context?.checkpointId) {
//     // Navigate to ChatViewer with checkpoint (Story 2.5 will implement the viewer)
//     navigationStore.navigateToAgentChat(agentId, context.checkpointId);
//   }
// };
```

### File Structure (Story 2.3 scope)

```
src/
  shared/
    types/
      agent.types.ts              # Updated: BlockingContext type, progress in AgentInfo
    ipc-channels.ts               # Updated: progress + blockingContext in stream:agent-status
  main/
    services/
      agent/
        stdout-parser.ts          # Updated: progress detection
        stdout-parser.test.ts     # Updated: progress detection tests
        blocking-detector.ts      # NEW: Blocking detection heuristic
        blocking-detector.test.ts # NEW: Blocking detection tests
        agent-harness.service.ts  # Updated: BlockingDetector integration
        agent-harness.service.test.ts # Updated: blocking tests
  renderer/
    src/
      features/
        agents/
          components/
            AgentProgressBar.tsx      # NEW: Progress bar component
            AgentProgressBar.test.tsx
            BlockedBadge.tsx           # NEW: Blocked badge
            BlockedBadge.test.tsx
            AgentCard.tsx              # Updated: integrates ProgressBar + BlockedBadge
            AgentCard.test.tsx         # Updated
          agents.store.ts             # Updated: blockingContexts, progress handling
          agents.store.test.ts        # Updated
      app.css                         # Updated: indeterminate animation
```

### Naming Conventions

| Element | Convention | This Story |
|---|---|---|
| Service file | kebab-case.ts | `blocking-detector.ts` |
| React components | PascalCase.tsx | `AgentProgressBar.tsx`, `BlockedBadge.tsx` |
| Tests | same name + `.test.ts(x)` co-located | `blocking-detector.test.ts` |
| Types | PascalCase | `BlockingContext`, `BlockingDetectorConfig` |
| CSS animation class | kebab-case | `animate-indeterminate` |

### Testing Strategy

**Unit tests:**

1. **blocking-detector.test.ts**
   - Calls onBlocked after timeout with reason 'timeout'
   - Resets timer on output received
   - Detects error patterns in stdout (rate limit, permission denied, etc.)
   - Detects error patterns in stderr
   - Does not double-trigger blocking
   - Includes last checkpoint ID in blocking context
   - Configurable timeout value
   - destroy() stops the timer

2. **stdout-parser.test.ts (additions)**
   - Detects todolist progress patterns `[x]` and `[ ]`
   - Detects "Step X/Y" patterns
   - Detects "Task X of Y" patterns
   - Emits progress event with correct completed/total
   - Case-insensitive matching

3. **AgentProgressBar.test.tsx**
   - Renders correct fill width for given ratio
   - Shows correct label "3/7"
   - Shows indeterminate state when total is 0
   - Applies green color for active status
   - Applies red color for blocked status
   - Applies striped pattern for stalled status
   - Has correct ARIA attributes (role, aria-valuenow, etc.)
   - Respects reduced motion

4. **BlockedBadge.test.tsx**
   - Renders "Bloque" text
   - Calls onClick when clicked
   - Has role="alert"
   - Displays reason in aria-label when provided
   - Is keyboard accessible

5. **AgentCard.test.tsx (additions)**
   - Renders AgentProgressBar when progress data exists
   - Renders BlockedBadge when status is BLOCKED
   - BlockedBadge click calls onNavigateToBlockage
   - No progress bar when progress is undefined

6. **agents.store.test.ts (additions)**
   - Stores blocking context on BLOCKED status
   - getBlockedAgents returns only blocked agents
   - Progress updates reflected in agent info

### What NOT to Do

- Do NOT implement the ChatViewer in this story — that is Story 2.5. Only emit the navigation intent.
- Do NOT use `setInterval` in the main process for blocking detection — use `setTimeout` with reset pattern
- Do NOT hardcode the blocking timeout — make it configurable
- Do NOT ignore stderr entirely — it contains valuable blocking signals
- Do NOT make the progress bar clickable — only the BlockedBadge navigates
- Do NOT use `any` for event types or callback parameters
- Do NOT create separate blocking detection in the renderer — all detection is in the main process
- Do NOT block the main thread with synchronous operations in the blocking detector
- Do NOT forget to call `blockingDetector.destroy()` when the agent process ends
- Do NOT make blocking detection too aggressive — false positives are worse than false negatives for user trust

### References

- [Source: architecture.md#Event-Bus-Architecture] — Event types and patterns
- [Source: architecture.md#Process-Patterns] — Error handling, async patterns
- [Source: architecture.md#IPC-Channel-Design] — stream:agent-status structure
- [Source: ux-design-specification.md#Custom-Components] — AgentProgressBar spec (fill color, striped, label %)
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Width transition 300ms ease-out
- [Source: ux-design-specification.md#Accessibility-Strategy] — role="progressbar", aria attributes
- [Source: ux-design-specification.md#Feedback-Patterns] — Badge change patterns
- [Source: ux-design-specification.md#Emotional-Design-Principles] — Urgence maitrisee, not panic
- [Source: epics.md#Story-2.3] — Acceptance criteria
- [Source: prd.md#FR5] — Detection agent bloque + acces 1 clic
- [Source: prd.md#FR8] — Progression agent (etapes completees/restantes)
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — Base patterns, aliases
- [Source: 2-1-agent-harness-lancer-arreter-des-agents.md] — Harness, parser, segmenter
- [Source: 2-2-liste-des-agents-avec-indicateurs-de-sante.md] — Agents store, AgentCard, HealthIndicator

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
