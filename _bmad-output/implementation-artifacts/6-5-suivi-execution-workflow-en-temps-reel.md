# Story 6.5: Suivi d'Execution Workflow en Temps Reel

Status: ready-for-dev

## Story

As a **user**,
I want **to see workflow execution in real-time with the active step highlighted**,
So that **I can follow where a workflow is at any moment**.

## Acceptance Criteria

### AC1 — Active node visual highlighting

**Given** un workflow est en cours d'execution par un agent
**When** je visualise le diagramme
**Then** le noeud actif est mis en evidence visuellement (classe CSS `node-active`, bordure pulsante accent) (FR32)
**And** les noeuds termines sont marques (classe `node-done`, bordure verte)

### AC2 — Real-time status update via stream

**Given** un workflow est en cours d'execution
**When** l'agent passe a l'etape suivante
**Then** le changement de statut est reflete en < 500ms (NFR1) via `stream:workflow-node`
**And** une transition animee montre la progression

### AC3 — Error state on node failure

**Given** un noeud rencontre une erreur pendant l'execution
**When** l'evenement `workflow:node-status` indique une erreur
**Then** le noeud passe en etat `node-error` (bordure rouge)
**And** un tooltip affiche le message d'erreur

### AC4 — Workflow completion state

**Given** le workflow est termine
**When** tous les noeuds sont passes en `done`
**Then** le diagramme affiche un etat "Workflow termine" avec tous les noeuds en vert

## Tasks / Subtasks

- [ ] Task 1: Extend shared types for execution tracking (AC: #1, #2, #3, #4)
  - [ ] 1.1 Extend `WorkflowNodeStatus` in `src/shared/types/workflow.types.ts` — already defined as `'pending' | 'active' | 'done' | 'error'`
  - [ ] 1.2 Add `WorkflowExecutionState` type: `{ workflowId: string; nodeStatuses: Map<string, WorkflowNodeStatus>; startedAt: number; completedAt?: number; error?: string }`
  - [ ] 1.3 Add `WorkflowNodeStatusEvent` type: `{ workflowId: string; nodeId: string; status: WorkflowNodeStatus; error?: string; timestamp: number }`
  - [ ] 1.4 Verify `stream:workflow-node` channel type in `IpcStreamChannels` matches these types

- [ ] Task 2: Implement execution event correlator in main process (AC: #2)
  - [ ] 2.1 Create `src/main/services/workflow-parser/workflow-execution-tracker.ts`
  - [ ] 2.2 Implement `WorkflowExecutionTracker` class that listens to `agent:status` and `agent:output` events on the main event bus
  - [ ] 2.3 Correlate agent activity to workflow nodes: when an agent working on a workflow-associated task produces output matching a step name/id, update node status
  - [ ] 2.4 Emit `workflow:node-status` event on the main event bus when a node status changes
  - [ ] 2.5 Track execution state: maintain a `Map<string, WorkflowNodeStatus>` per active workflow execution
  - [ ] 2.6 Detect workflow completion: when all nodes are `done`, emit a completion event
  - [ ] 2.7 Detect node errors: when agent reports error during a step, set node to `error` with error message
  - [ ] 2.8 Write unit tests: agent output correlates to node status changes, completion detection, error detection

- [ ] Task 3: Wire execution events to IPC stream (AC: #2)
  - [ ] 3.1 In `src/main/ipc/streams.ts`, add forwarding for `workflow:node-status` events to `stream:workflow-node` IPC channel
  - [ ] 3.2 Include all fields: `workflowId`, `nodeId`, `status`, `error`, `timestamp`
  - [ ] 3.3 Ensure events are forwarded with < 100ms overhead (event bus -> IPC bridge should be near-instant)
  - [ ] 3.4 Write integration test: event emitted in main -> received in renderer via stream

- [ ] Task 4: Extend workflow store for execution state (AC: #1, #2, #3, #4)
  - [ ] 4.1 Add `executionState: WorkflowExecutionState | null` to `workflow.store.ts`
  - [ ] 4.2 Add `nodeStatuses: Map<string, WorkflowNodeStatus>` for the selected workflow
  - [ ] 4.3 Add `updateNodeStatus(nodeId: string, status: WorkflowNodeStatus, error?: string)` action
  - [ ] 4.4 Add `startExecution(workflowId: string)` action that initializes all nodes to `pending`
  - [ ] 4.5 Add `clearExecution()` action that resets execution state
  - [ ] 4.6 Add computed selector `isExecuting: boolean` (true if any node is `active`)
  - [ ] 4.7 Add computed selector `isCompleted: boolean` (true if all nodes are `done`)
  - [ ] 4.8 Write unit tests: status transitions, execution start/clear, computed selectors

- [ ] Task 5: Create useWorkflowExecution hook (AC: #2)
  - [ ] 5.1 Create `src/renderer/src/features/workflow/hooks/useWorkflowExecution.ts`
  - [ ] 5.2 Listen to `stream:workflow-node` IPC stream using `useIpcStream`
  - [ ] 5.3 Filter events by `selectedWorkflowId` — only process events for the displayed workflow
  - [ ] 5.4 Call `updateNodeStatus()` store action on each received event
  - [ ] 5.5 Track latency: measure time between event timestamp and UI update (target < 500ms per NFR1)
  - [ ] 5.6 Write unit tests: stream events update store, filtering by workflow id works

- [ ] Task 6: Create execution-aware node styles (AC: #1, #3)
  - [ ] 6.1 Create `src/renderer/src/features/workflow/components/NodeExecutionOverlay.tsx`
  - [ ] 6.2 Define CSS classes / Tailwind variants for each execution state:
    - `pending`: default style (no overlay), slightly dimmed
    - `active`: border `--accent` with pulse animation (subtle, 2s cycle), glow effect
    - `done`: border `--status-green`, checkmark icon overlay, solid green indicator
    - `error`: border `--status-red`, error icon overlay, red indicator
  - [ ] 6.3 Implement pulse animation: `@keyframes node-pulse { 0%, 100% { border-color: var(--accent); box-shadow: 0 0 0 0 var(--accent); } 50% { border-color: var(--accent); box-shadow: 0 0 8px 2px var(--accent); } }`
  - [ ] 6.4 Respect `prefers-reduced-motion`: replace pulse with static border color change
  - [ ] 6.5 Write unit tests: correct CSS classes applied per status

- [ ] Task 7: Update custom node components with execution status (AC: #1, #3, #4)
  - [ ] 7.1 Modify `BmadStepNode.tsx` to accept `executionStatus?: WorkflowNodeStatus` in data
  - [ ] 7.2 Modify `BmadCheckNode.tsx` to accept `executionStatus`
  - [ ] 7.3 Modify `BmadActionNode.tsx` to accept `executionStatus`
  - [ ] 7.4 Apply `NodeExecutionOverlay` styles based on `executionStatus`
  - [ ] 7.5 Show status icon in node: checkmark (done), spinner (active), X (error)
  - [ ] 7.6 For error nodes: show error message in tooltip (extend existing tooltip)
  - [ ] 7.7 Write unit tests: each node type renders correct status styles, error tooltip shown

- [ ] Task 8: Update WorkflowCanvas for execution mode (AC: #1, #2, #4)
  - [ ] 8.1 When execution is active (`isExecuting === true`), merge node statuses into React Flow node data
  - [ ] 8.2 Auto-scroll / pan to keep the active node visible in the viewport
  - [ ] 8.3 Animate edges leading to the active node (React Flow `animated: true` on the incoming edge)
  - [ ] 8.4 Disable editing interactions during execution (view-only mode forced)
  - [ ] 8.5 Write integration test: execution state changes update node visuals

- [ ] Task 9: Create execution progress indicator (AC: #4)
  - [ ] 9.1 Create `src/renderer/src/features/workflow/components/WorkflowExecutionProgress.tsx`
  - [ ] 9.2 Show a progress bar: `{doneNodes} / {totalNodes} etapes completees`
  - [ ] 9.3 Show execution timer: time elapsed since `startedAt`
  - [ ] 9.4 Show completion state: when `isCompleted`, display "Workflow termine" with green indicator and total duration
  - [ ] 9.5 Position in WorkflowToolbar area or above the canvas
  - [ ] 9.6 Style with design tokens and animation (progress bar width transition 300ms ease-out)
  - [ ] 9.7 Write unit tests: progress calculation, completion message, timer display

- [ ] Task 10: Add execution-related toolbar actions (AC: #1)
  - [ ] 10.1 Extend `WorkflowToolbar.tsx` with execution status indicator (when execution is active)
  - [ ] 10.2 Add "Centrer sur le noeud actif" button that pans to the currently active node
  - [ ] 10.3 Add visual badge showing execution status: "En cours..." (orange pulse), "Termine" (green), "Erreur" (red)
  - [ ] 10.4 Disable "Mode Edition" toggle during execution
  - [ ] 10.5 Write unit tests: toolbar shows execution controls when executing

- [ ] Task 11: Update WorkflowEditor for execution integration (AC: all)
  - [ ] 11.1 Wire `useWorkflowExecution` hook in `WorkflowEditor.tsx`
  - [ ] 11.2 Pass execution state to `WorkflowCanvas` and `WorkflowToolbar`
  - [ ] 11.3 Handle transition between states: not executing -> executing -> completed
  - [ ] 11.4 Show toast on workflow completion: "Workflow '{name}' termine" (auto-dismiss 3s)
  - [ ] 11.5 Show error toast on node failure: "Erreur sur le noeud '{label}'" (persistent, dismiss manual)
  - [ ] 11.6 Write integration test: full execution flow from start to completion

## Dev Notes

### FRs Covered

- **FR32** (complete): L'utilisateur peut voir l'execution d'un workflow en continu (etape en cours mise en evidence visuellement) — latence definie par NFR1.

### Dependencies on Previous Stories

- **Story 1.1** (Project Scaffold): IPC streams (`useIpcStream`), event bus (main + renderer), `AppError`, design tokens, toast system.
- **Story 2.1** (Agent Harness): Agent process management — provides `agent:status` and `agent:output` events that are correlated to workflow nodes. The agent harness must be operational for execution tracking to receive events.
- **Story 6.1** (BMAD Workflow Parser): `WorkflowGraph`, `WorkflowNode` types, workflow parsing service.
- **Story 6.2** (Workflow Diagram Viewer): `WorkflowCanvas`, `WorkflowEditor`, `BmadStepNode`, `BmadCheckNode`, `BmadActionNode`, `WorkflowToolbar`, `workflow.store.ts`. This story extends these components with execution-aware rendering.
- **Story 6.3** (Node Editing): Edit mode management (execution tracking disables editing). Store structure with edit mode flag.

### Execution State Types

```typescript
// src/shared/types/workflow.types.ts — additions for Story 6.5

export type WorkflowExecutionState = {
  workflowId: string;
  nodeStatuses: Record<string, WorkflowNodeStatus>;
  startedAt: number;
  completedAt?: number;
  error?: string;
};

export type WorkflowNodeStatusEvent = {
  workflowId: string;
  nodeId: string;
  status: WorkflowNodeStatus;
  error?: string;
  timestamp: number;
};
```

### IPC Stream Channel (already declared)

```typescript
// src/shared/ipc-channels.ts — already exists from Story 1.1
type IpcStreamChannels = {
  // ...
  'stream:workflow-node': { workflowId: string; nodeId: string; status: 'pending' | 'active' | 'done' | 'error' };
  // ...
};
```

[Source: architecture.md#IPC-Channel-Design — stream:workflow-node]

### Event Correlator Pattern

```typescript
// src/main/services/workflow-parser/workflow-execution-tracker.ts
import { EventEmitter } from 'node:events';
import type { WorkflowGraph, WorkflowNodeStatus } from '@shared/types/workflow.types';

type ExecutionState = {
  workflowId: string;
  nodeStatuses: Map<string, WorkflowNodeStatus>;
  startedAt: number;
};

export class WorkflowExecutionTracker {
  private executions = new Map<string, ExecutionState>();

  constructor(private eventBus: EventEmitter) {
    this.eventBus.on('agent:status', this.handleAgentStatus.bind(this));
    this.eventBus.on('agent:output', this.handleAgentOutput.bind(this));
  }

  startTracking(workflowId: string, graph: WorkflowGraph): void {
    const nodeStatuses = new Map<string, WorkflowNodeStatus>();
    for (const node of graph.nodes) {
      nodeStatuses.set(node.id, 'pending');
    }
    // Set entry node as active
    if (graph.entryNodeId) {
      nodeStatuses.set(graph.entryNodeId, 'active');
      this.emitNodeStatus(workflowId, graph.entryNodeId, 'active');
    }
    this.executions.set(workflowId, {
      workflowId,
      nodeStatuses,
      startedAt: Date.now(),
    });
  }

  stopTracking(workflowId: string): void {
    this.executions.delete(workflowId);
  }

  private handleAgentStatus(data: { agentId: string; status: string }): void {
    // Correlate agent → workflow node
    // Implementation: lookup which workflow/node this agent is executing
    // Update node status accordingly
  }

  private handleAgentOutput(data: { agentId: string; data: string; timestamp: number }): void {
    // Parse agent output for step completion markers
    // Update node status when a step is detected as complete
  }

  private updateNodeStatus(workflowId: string, nodeId: string, status: WorkflowNodeStatus, error?: string): void {
    const execution = this.executions.get(workflowId);
    if (!execution) return;

    execution.nodeStatuses.set(nodeId, status);
    this.emitNodeStatus(workflowId, nodeId, status, error);

    // Check if workflow is complete
    const allDone = Array.from(execution.nodeStatuses.values()).every(s => s === 'done');
    if (allDone) {
      this.eventBus.emit('workflow:completed', { workflowId, duration: Date.now() - execution.startedAt });
    }
  }

  private emitNodeStatus(workflowId: string, nodeId: string, status: WorkflowNodeStatus, error?: string): void {
    this.eventBus.emit('workflow:node-status', {
      workflowId,
      nodeId,
      status,
      error,
      timestamp: Date.now(),
    });
  }

  dispose(): void {
    this.eventBus.removeAllListeners('agent:status');
    this.eventBus.removeAllListeners('agent:output');
    this.executions.clear();
  }
}
```

[Source: architecture.md#Gap-Resolution GAP-4 — Workflow Execution Tracking via events]

### Execution-Aware Node Styles

```css
/* Tailwind CSS classes / custom utilities for execution states */

/* Pending: default, slightly dimmed */
.node-pending {
  opacity: 0.6;
}

/* Active: accent border with pulse */
.node-active {
  border-color: var(--color-accent);
  animation: node-pulse 2s ease-in-out infinite;
}

@keyframes node-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow: 0 0 12px 4px rgba(59, 130, 246, 0.2);
  }
}

/* Done: green border + checkmark */
.node-done {
  border-color: var(--color-status-green);
  opacity: 1;
}

/* Error: red border */
.node-error {
  border-color: var(--color-status-red);
  opacity: 1;
}

/* Reduced motion: no pulse, instant transitions */
@media (prefers-reduced-motion: reduce) {
  .node-active {
    animation: none;
    box-shadow: 0 0 0 2px var(--color-accent);
  }
}
```

### Updated Node Component Pattern

```typescript
// Example: BmadStepNode.tsx with execution status
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WorkflowNodeStatus } from '@shared/types/workflow.types';

type StepNodeData = {
  label: string;
  role?: string;
  instructions?: string;
  sourceFile: string;
  sourceLine?: number;
  executionStatus?: WorkflowNodeStatus;
  executionError?: string;
};

const statusStyles: Record<WorkflowNodeStatus, string> = {
  pending: 'opacity-60',
  active: 'border-accent node-active',
  done: 'border-status-green',
  error: 'border-status-red',
};

const statusIcons: Record<WorkflowNodeStatus, string> = {
  pending: '',
  active: 'animate-spin',  // spinner
  done: 'checkmark',
  error: 'x-mark',
};

export function BmadStepNode({ data, selected }: NodeProps<StepNodeData>) {
  const execClass = data.executionStatus ? statusStyles[data.executionStatus] : '';

  return (
    <div
      className={`
        rounded-lg border-2 px-4 py-3 min-w-[200px]
        bg-bg-surface border-border-default text-text-primary
        ${selected ? 'ring-2 ring-accent/30' : ''}
        ${execClass}
        transition-all duration-200
      `}
      role="button"
      tabIndex={0}
      aria-label={`Etape: ${data.label}${data.executionStatus ? ` — ${data.executionStatus}` : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-accent" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-accent">STEP</span>
          {data.role && (
            <span className="text-xs bg-bg-elevated px-1.5 py-0.5 rounded text-text-muted">
              {data.role}
            </span>
          )}
        </div>
        {data.executionStatus && data.executionStatus !== 'pending' && (
          <ExecutionStatusIcon status={data.executionStatus} />
        )}
      </div>
      <div className="text-sm font-medium mt-1">{data.label}</div>
      {data.executionStatus === 'error' && data.executionError && (
        <div className="text-xs text-status-red mt-1 truncate" title={data.executionError}>
          {data.executionError}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-accent" />
    </div>
  );
}
```

### Execution Progress Component Pattern

```typescript
// src/renderer/src/features/workflow/components/WorkflowExecutionProgress.tsx
import { useWorkflowStore } from '../workflow.store';

export function WorkflowExecutionProgress() {
  const { executionState, isExecuting, isCompleted } = useWorkflowStore((s) => ({
    executionState: s.executionState,
    isExecuting: s.isExecuting,
    isCompleted: s.isCompleted,
  }));

  if (!executionState) return null;

  const total = Object.keys(executionState.nodeStatuses).length;
  const done = Object.values(executionState.nodeStatuses).filter(s => s === 'done').length;
  const hasError = Object.values(executionState.nodeStatuses).some(s => s === 'error');
  const ratio = total > 0 ? done / total : 0;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 bg-bg-surface rounded border border-border-default"
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Progression du workflow: ${done} sur ${total} etapes completees`}
    >
      <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${
            hasError ? 'bg-status-red' : isCompleted ? 'bg-status-green' : 'bg-accent'
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary whitespace-nowrap">
        {done}/{total} etapes
      </span>
      {isCompleted && (
        <span className="text-xs text-status-green font-medium">Termine</span>
      )}
      {hasError && (
        <span className="text-xs text-status-red font-medium">Erreur</span>
      )}
    </div>
  );
}
```

### File Structure (additions)

```
src/
  main/
    services/
      workflow-parser/
        ... (existing) ...
        workflow-execution-tracker.ts           # NEW
        workflow-execution-tracker.test.ts      # NEW
  shared/
    types/
      workflow.types.ts                         # MODIFIED (add ExecutionState, NodeStatusEvent)
  renderer/src/features/workflow/
    components/
      ... (existing) ...
      NodeExecutionOverlay.tsx                  # NEW
      NodeExecutionOverlay.test.tsx             # NEW
      WorkflowExecutionProgress.tsx             # NEW
      WorkflowExecutionProgress.test.tsx        # NEW
      ExecutionStatusIcon.tsx                   # NEW
    hooks/
      ... (existing) ...
      useWorkflowExecution.ts                  # NEW
      useWorkflowExecution.test.ts             # NEW
    workflow.store.ts                           # MODIFIED (add executionState, computed selectors)
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Tracker class | PascalCase | `WorkflowExecutionTracker` |
| Tracker file | kebab-case | `workflow-execution-tracker.ts` |
| CSS animation | kebab-case | `node-pulse` |
| CSS class per status | `node-{status}` | `node-active`, `node-done`, `node-error` |
| Store computed selectors | camelCase boolean | `isExecuting`, `isCompleted` |
| Event names | namespace:action | `workflow:node-status`, `workflow:completed` |
| Stream channel | `stream:` prefix | `stream:workflow-node` |

[Source: architecture.md#Naming-Patterns]

### Testing Strategy

**Unit tests (co-located):**
- `workflow-execution-tracker.test.ts`: Start tracking initializes all nodes to pending, entry node set to active. Agent status event updates correct node. Agent output correlation detects step completion. Error event sets node to error status. Completion detected when all nodes are done. Dispose cleans up listeners.
- `useWorkflowExecution.test.ts`: Stream events update store. Events filtered by workflow id. Latency target verified (mock timing).
- `NodeExecutionOverlay.test.tsx`: Correct CSS classes applied for each status. Pulse animation present for active, absent for done/error. Reduced motion media query respected.
- `WorkflowExecutionProgress.test.tsx`: Progress bar width matches ratio. Completion message shown. Error state shown. ARIA attributes correct.
- `workflow.store.test.ts` (extended): `updateNodeStatus` transitions correctly, `startExecution` initializes all to pending, `clearExecution` resets, computed selectors (`isExecuting`, `isCompleted`) return correct values.

**Integration tests:**
- Full execution flow test: mock IPC stream -> emit node status events -> verify node visual updates -> verify progress bar -> verify completion state.
- Timing test: measure time from event emission to UI update, verify < 500ms (NFR1 compliance).

**Performance (NFR3):**
- Verify that execution state updates don't cause unnecessary re-renders of non-affected nodes. Use React Flow node data comparison to avoid re-rendering nodes whose status hasn't changed.
- Profile with 50-node workflow executing rapidly (all nodes transitioning) — should maintain > 30 FPS.

### Accessibility

- Execution status announced via `aria-label` on each node (includes status text)
- Progress bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- Error messages: `aria-live="polite"` on error toast, error text in node tooltip accessible via keyboard
- Reduced motion: all pulse animations disabled, replaced with static color indicators
- Color not sole indicator: each status has both color AND icon (checkmark/spinner/X-mark)

[Source: ux-design-specification.md#Accessibility-Strategy]
[Source: ux-design-specification.md#Real-Time-Update-Patterns — Fade 200ms, animations conditional on prefers-reduced-motion]

### What NOT to Do

- Do NOT poll for execution status — use the IPC stream (`stream:workflow-node`), which is push-based.
- Do NOT block the UI thread with execution tracking — all updates are async via events.
- Do NOT implement agent launching from the workflow editor — agent management is in Epic 2. This story only tracks execution events passively.
- Do NOT allow editing during execution — force view-only mode.
- Do NOT use intrusive animations — pulse is subtle (2s cycle, low-opacity shadow). No flashing, no color strobing.
- Do NOT use `any` — type all execution state strictly.
- Do NOT use `export default` — named exports only.
- Do NOT hardcode status colors — use Tailwind design token classes (`text-status-green`, `border-status-red`).
- Do NOT create execution state from scratch — the `WorkflowExecutionTracker` in main process manages the source of truth, renderer only reflects it.
- Do NOT re-render the entire graph on each status update — only update the affected node's data.

### References

- [Source: architecture.md#Gap-Resolution GAP-4] — Workflow execution tracking via events, event correlator, CSS classes for node states
- [Source: architecture.md#IPC-Channel-Design] — `stream:workflow-node` channel definition
- [Source: architecture.md#Event-Bus-Architecture] — MainEvents `workflow:node-status` event
- [Source: architecture.md#Communication-Patterns] — `useIpcStream` hook pattern
- [Source: architecture.md#Process-Patterns] — Error handling, `AppError` normalization
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Fade 200ms, progress bar transition 300ms ease-out
- [Source: ux-design-specification.md#Component-Strategy] — WorkflowCanvas states: view/edit/executing
- [Source: ux-design-specification.md#Accessibility-Strategy] — `aria-live`, `prefers-reduced-motion`, color + icon redundancy
- [Source: ux-design-specification.md#Feedback-Patterns] — Toast for completion (auto-dismiss 3s), error toast (persistent)
- [Source: epics.md#Story-6.5] — Original acceptance criteria
- [Source: epics.md#FR32] — Functional requirement: execution workflow en temps reel

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
