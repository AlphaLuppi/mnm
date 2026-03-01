# Story 6.2: Workflow Diagram Viewer

Status: ready-for-dev

## Story

As a **user**,
I want **to see a BMAD workflow as a visual flow diagram with nodes and connections**,
So that **I can understand workflow structure without reading YAML/XML**.

## Acceptance Criteria

### AC1 — Workflow rendered as React Flow diagram

**Given** un workflow est parse
**When** je selectionne un workflow dans la navigation
**Then** le `WorkflowCanvas` (React Flow) affiche le diagramme : noeuds positionnes, connexions flechees entre les etapes (FR25)

### AC2 — Node display with metadata

**Given** le diagramme est affiche
**When** je regarde les noeuds
**Then** chaque noeud affiche : titre de l'etape, role/agent assigne, icone de type
**And** l'ordre d'execution est clair visuellement (top-to-bottom ou left-to-right)

### AC3 — Parallel branches visualization

**Given** un workflow contient des branches paralleles
**When** le diagramme les rend
**Then** les branches paralleles sont affichees cote a cote avec des points de fork/join (FR26)

### AC4 — Smooth interactions (zoom, pan, select)

**Given** le diagramme est affiche
**When** je zoom, pan, ou selectionne un noeud
**Then** les interactions sont fluides (> 30 FPS, NFR3) pour des workflows jusqu'a 50 noeuds

### AC5 — Node tooltip with full details

**Given** je survole un noeud
**When** le tooltip s'affiche
**Then** je vois les details complets : instructions, fichier source, ligne

## Tasks / Subtasks

- [ ] Task 1: Install and configure React Flow + dagre (AC: #1, #3)
  - [ ] 1.1 Install `@xyflow/react` and `dagre` packages
  - [ ] 1.2 Install `@types/dagre` (or verify bundled types)
  - [ ] 1.3 Import React Flow CSS in the workflow feature entry point
  - [ ] 1.4 Verify React Flow renders a basic graph in Electron renderer

- [ ] Task 2: Create workflow Zustand store (AC: #1)
  - [ ] 2.1 Create `src/renderer/src/features/workflow/workflow.store.ts`
  - [ ] 2.2 Define `WorkflowState` with: `workflows: AsyncState<WorkflowGraph[]>`, `selectedWorkflowId: string | null`, `selectedNodeId: string | null`
  - [ ] 2.3 Implement `loadWorkflows()` action calling `workflow:list` IPC
  - [ ] 2.4 Implement `selectWorkflow(id: string)` action
  - [ ] 2.5 Implement `selectNode(id: string | null)` action
  - [ ] 2.6 Write unit tests for store actions and selectors

- [ ] Task 3: Implement dagre auto-layout engine (AC: #1, #3)
  - [ ] 3.1 Create `src/renderer/src/features/workflow/hooks/useWorkflowLayout.ts`
  - [ ] 3.2 Implement `layoutWorkflowGraph(graph: WorkflowGraph): { nodes: Node[]; edges: Edge[] }` that converts `WorkflowGraph` to React Flow `Node[]` and `Edge[]` with dagre positions
  - [ ] 3.3 Configure dagre with: `rankdir: 'TB'` (top-to-bottom), `nodesep: 60`, `ranksep: 80`, `align: 'UL'`
  - [ ] 3.4 Handle parallel branches: fork nodes create multiple ranks at the same level
  - [ ] 3.5 Handle entry/exit node positioning (entry at top, exit at bottom)
  - [ ] 3.6 Write unit tests: linear layout, branching layout, parallel layout, single node

- [ ] Task 4: Create custom node components (AC: #2)
  - [ ] 4.1 Create `src/renderer/src/features/workflow/components/BmadStepNode.tsx` — default step node with title, role badge, step icon
  - [ ] 4.2 Create `src/renderer/src/features/workflow/components/BmadCheckNode.tsx` — diamond-shaped decision/check node with condition text
  - [ ] 4.3 Create `src/renderer/src/features/workflow/components/BmadActionNode.tsx` — action node with action icon and label
  - [ ] 4.4 Style all nodes with Tailwind classes using design tokens (`--bg-surface`, `--border-default`, `--text-primary`)
  - [ ] 4.5 Add `Handle` components for connection points (top input, bottom output for TB layout)
  - [ ] 4.6 Register custom node types in React Flow `nodeTypes` map
  - [ ] 4.7 Write unit tests: each node type renders correctly with props

- [ ] Task 5: Create custom edge components (AC: #1, #3)
  - [ ] 5.1 Create `src/renderer/src/features/workflow/components/WorkflowEdge.tsx` with animated arrow markers
  - [ ] 5.2 Style sequential edges as solid lines with arrowheads
  - [ ] 5.3 Style conditional edges as dashed lines with label text
  - [ ] 5.4 Register custom edge types in React Flow `edgeTypes` map
  - [ ] 5.5 Write unit tests: edge rendering with labels

- [ ] Task 6: Create WorkflowCanvas component (AC: #1, #4)
  - [ ] 6.1 Create `src/renderer/src/features/workflow/components/WorkflowCanvas.tsx`
  - [ ] 6.2 Initialize `ReactFlow` with `nodes`, `edges`, `nodeTypes`, `edgeTypes`, `fitView`
  - [ ] 6.3 Enable built-in controls: `<Controls />` (zoom buttons), `<MiniMap />` (overview), `<Background />` (grid dots)
  - [ ] 6.4 Configure interaction props: `zoomOnScroll`, `panOnDrag`, `selectable`, `nodesFocusable`
  - [ ] 6.5 Apply `fitView` on initial render and on workflow change
  - [ ] 6.6 Set `minZoom: 0.1`, `maxZoom: 2` for comfortable navigation
  - [ ] 6.7 Style the canvas background with `--bg-base` token
  - [ ] 6.8 Write unit test: renders nodes and edges from a WorkflowGraph

- [ ] Task 7: Implement node tooltip (AC: #5)
  - [ ] 7.1 Create `src/renderer/src/features/workflow/components/NodeTooltip.tsx`
  - [ ] 7.2 Show on hover over any node: full instructions text, source file path, source line number, role details
  - [ ] 7.3 Position tooltip relative to node (above or beside, avoid viewport overflow)
  - [ ] 7.4 Style with `--bg-elevated`, `--text-primary`, `--border-active`
  - [ ] 7.5 Use `aria-describedby` for accessibility
  - [ ] 7.6 Write unit test: tooltip renders correct content on hover

- [ ] Task 8: Create WorkflowEditor wrapper component (AC: #1, #4)
  - [ ] 8.1 Create `src/renderer/src/features/workflow/components/WorkflowEditor.tsx` as the main entry component
  - [ ] 8.2 Integrate WorkflowCanvas with workflow store (read selected workflow, convert to React Flow nodes/edges via layout hook)
  - [ ] 8.3 Add workflow selector dropdown/tabs when multiple workflows exist
  - [ ] 8.4 Handle loading state with skeleton placeholder
  - [ ] 8.5 Handle error state with inline error message and retry button
  - [ ] 8.6 Handle empty state: "Aucun workflow detecte" + guidance text
  - [ ] 8.7 Write integration test: component loads workflows via IPC and renders diagram

- [ ] Task 9: Create useWorkflowGraph hook (AC: #1)
  - [ ] 9.1 Create `src/renderer/src/features/workflow/hooks/useWorkflowGraph.ts`
  - [ ] 9.2 Combine store state + layout computation into a single hook
  - [ ] 9.3 Memoize layout computation with `useMemo` to avoid recomputation on unrelated re-renders
  - [ ] 9.4 Return `{ nodes, edges, isLoading, error, selectedNodeId }`
  - [ ] 9.5 Write unit test: hook returns correctly shaped data

- [ ] Task 10: Create WorkflowToolbar component (AC: #4)
  - [ ] 10.1 Create `src/renderer/src/features/workflow/components/WorkflowToolbar.tsx`
  - [ ] 10.2 Add buttons: Fit to View, Zoom In, Zoom Out, Toggle MiniMap
  - [ ] 10.3 Style with ghost/icon buttons from shadcn/ui pattern
  - [ ] 10.4 Wire to React Flow instance methods (`fitView()`, `zoomIn()`, `zoomOut()`)
  - [ ] 10.5 Add keyboard shortcuts: `Cmd+0` fit view, `Cmd++` zoom in, `Cmd+-` zoom out
  - [ ] 10.6 Write unit test: toolbar buttons trigger correct actions

- [ ] Task 11: Create barrel export and feature index (AC: all)
  - [ ] 11.1 Create `src/renderer/src/features/workflow/index.ts` barrel file
  - [ ] 11.2 Export `WorkflowEditor`, `useWorkflowGraph`, `useWorkflowStore`
  - [ ] 11.3 Verify all exports are named (no default exports)

## Dev Notes

### FRs Covered

- **FR25** (complete): L'utilisateur peut voir un workflow BMAD sous forme de diagramme de flux visuel (noeuds et connexions).
- **FR26** (complete): L'utilisateur peut voir l'ordre d'execution des etapes et les branches paralleles dans le diagramme.
- **FR27** (partial): Le canvas est pret pour l'ajout de noeuds. L'implementation d'edition interactive est dans Story 6.3.
- **FR28** (partial): Le canvas est pret pour la suppression de noeuds. L'implementation interactive est dans Story 6.3.

### Dependencies on Previous Stories

- **Story 1.1** (Project Scaffold, IPC Bridge & Event Bus): IPC hooks (`useIpcInvoke`, `useIpcStream`), event bus, `AppError`, `AsyncState<T>`, Tailwind CSS 4 design tokens.
- **Story 1.2** (Three-Pane Layout): The `ThreePaneLayout` provides the pane where WorkflowEditor will be rendered. The workflow feature will be displayed in the relevant pane context.
- **Story 6.1** (BMAD Workflow Parser): Provides `WorkflowGraph` type, `workflow:list` and `workflow:parse` IPC channels, and the parser service that produces the graph data.

### React Flow Setup

```typescript
// Required imports
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
```

**Critical:** React Flow v12+ uses `@xyflow/react` (not `react-flow-renderer` or `reactflow`). Ensure correct package name.

[Source: architecture.md#Dependencies-to-Add — @xyflow/react]

### Dagre Layout Configuration

```typescript
// src/renderer/src/features/workflow/hooks/useWorkflowLayout.ts
import dagre from 'dagre';
import type { WorkflowGraph } from '@shared/types/workflow.types';
import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 80;
const CHECK_NODE_SIZE = 100;

export function layoutWorkflowGraph(
  graph: WorkflowGraph
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',       // Top-to-bottom
    nodesep: 60,         // Horizontal spacing between nodes
    ranksep: 80,         // Vertical spacing between ranks
    align: 'UL',         // Align upper-left
    marginx: 20,
    marginy: 20,
  });

  // Add nodes to dagre
  for (const node of graph.nodes) {
    const isCheck = node.type === 'check';
    g.setNode(node.id, {
      width: isCheck ? CHECK_NODE_SIZE : NODE_WIDTH,
      height: isCheck ? CHECK_NODE_SIZE : NODE_HEIGHT,
    });
  }

  // Add edges to dagre
  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // Convert dagre positions to React Flow nodes
  const nodes: Node[] = graph.nodes.map((wfNode) => {
    const pos = g.node(wfNode.id);
    return {
      id: wfNode.id,
      type: wfNode.type,        // maps to nodeTypes: 'step' | 'check' | 'action'
      position: {
        x: pos.x - pos.width / 2,
        y: pos.y - pos.height / 2,
      },
      data: {
        label: wfNode.label,
        role: wfNode.role,
        instructions: wfNode.instructions,
        conditions: wfNode.conditions,
        sourceFile: wfNode.sourceFile,
        sourceLine: wfNode.sourceLine,
      },
    };
  });

  // Convert to React Flow edges
  const edges: Edge[] = graph.edges.map((wfEdge) => ({
    id: wfEdge.id,
    source: wfEdge.source,
    target: wfEdge.target,
    type: wfEdge.type === 'conditional' ? 'conditional' : 'default',
    label: wfEdge.label,
    animated: false,
    markerEnd: { type: 'arrowclosed' },
  }));

  return { nodes, edges };
}
```

[Source: architecture.md#Dependencies-to-Add — dagre]

### Custom Node Components Pattern

```typescript
// src/renderer/src/features/workflow/components/BmadStepNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';

type StepNodeData = {
  label: string;
  role?: string;
  instructions?: string;
  sourceFile: string;
  sourceLine?: number;
};

export function BmadStepNode({ data, selected }: NodeProps<StepNodeData>) {
  return (
    <div
      className={`
        rounded-lg border px-4 py-3 min-w-[200px]
        bg-bg-surface border-border-default text-text-primary
        ${selected ? 'border-accent ring-2 ring-accent/30' : ''}
        transition-colors duration-200
      `}
      role="button"
      tabIndex={0}
      aria-label={`Etape: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-accent" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-accent">STEP</span>
        {data.role && (
          <span className="text-xs bg-bg-elevated px-1.5 py-0.5 rounded text-text-muted">
            {data.role}
          </span>
        )}
      </div>
      <div className="text-sm font-medium mt-1">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-accent" />
    </div>
  );
}
```

### WorkflowCanvas Component Pattern

```typescript
// src/renderer/src/features/workflow/components/WorkflowCanvas.tsx
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BmadStepNode } from './BmadStepNode';
import { BmadCheckNode } from './BmadCheckNode';
import { BmadActionNode } from './BmadActionNode';

const nodeTypes: NodeTypes = {
  step: BmadStepNode,
  check: BmadCheckNode,
  action: BmadActionNode,
};

type WorkflowCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodeSelect?: (nodeId: string | null) => void;
};

export function WorkflowCanvas({ nodes: initialNodes, edges: initialEdges, onNodeSelect }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="h-full w-full bg-bg-base" role="img" aria-label="Diagramme de workflow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        nodesFocusable
        edgesFocusable={false}
        onNodeClick={(_event, node) => onNodeSelect?.(node.id)}
        onPaneClick={() => onNodeSelect?.(null)}
      >
        <Controls className="!bg-bg-surface !border-border-default" />
        <MiniMap
          className="!bg-bg-surface !border-border-default"
          nodeColor="#3b82f6"
          maskColor="rgba(0,0,0,0.7)"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#27272a" />
      </ReactFlow>
    </div>
  );
}
```

### Zustand Store Pattern

```typescript
// src/renderer/src/features/workflow/workflow.store.ts
import { create } from 'zustand';
import type { WorkflowGraph } from '@shared/types/workflow.types';
import type { AsyncState } from '@shared/types/async-state.types';

type WorkflowState = {
  workflows: AsyncState<WorkflowGraph[]>;
  selectedWorkflowId: string | null;
  selectedNodeId: string | null;
  loadWorkflows: (projectPath: string) => Promise<void>;
  selectWorkflow: (id: string) => void;
  selectNode: (id: string | null) => void;
};

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: { status: 'idle' },
  selectedWorkflowId: null,
  selectedNodeId: null,

  loadWorkflows: async (projectPath) => {
    set({ workflows: { status: 'loading' } });
    try {
      const graphs = await window.electronAPI.invoke('workflow:list', { projectPath });
      set({
        workflows: { status: 'success', data: graphs },
        selectedWorkflowId: graphs.length > 0 ? graphs[0].id : null,
      });
    } catch (err) {
      set({ workflows: { status: 'error', error: err as AppError } });
    }
  },

  selectWorkflow: (id) => set({ selectedWorkflowId: id, selectedNodeId: null }),
  selectNode: (id) => set({ selectedNodeId: id }),
}));
```

[Source: architecture.md#Communication-Patterns — Zustand Store pattern]

### File Structure

```
src/renderer/src/features/workflow/
  components/
    WorkflowEditor.tsx
    WorkflowEditor.test.tsx
    WorkflowCanvas.tsx
    WorkflowCanvas.test.tsx
    BmadStepNode.tsx
    BmadStepNode.test.tsx
    BmadCheckNode.tsx
    BmadCheckNode.test.tsx
    BmadActionNode.tsx
    BmadActionNode.test.tsx
    WorkflowEdge.tsx
    WorkflowToolbar.tsx
    WorkflowToolbar.test.tsx
    NodeTooltip.tsx
    NodeTooltip.test.tsx
  hooks/
    useWorkflowGraph.ts
    useWorkflowGraph.test.ts
    useWorkflowLayout.ts
    useWorkflowLayout.test.ts
  workflow.store.ts
  workflow.store.test.ts
  index.ts
```

[Source: architecture.md#Frontend-Component-Architecture]

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| React components | PascalCase.tsx | `WorkflowCanvas.tsx`, `BmadStepNode.tsx` |
| Hooks | camelCase, prefix `use` | `useWorkflowGraph.ts` |
| Zustand store | camelCase + `.store.ts` | `workflow.store.ts` |
| Tests | co-located, same name + `.test.ts` | `WorkflowCanvas.test.tsx` |
| Node type keys | lowercase string | `'step'`, `'check'`, `'action'` |
| CSS classes | Tailwind utilities + design tokens | `bg-bg-surface text-text-primary` |

[Source: architecture.md#Naming-Patterns]

### Testing Strategy

**Unit tests (co-located):**
- `useWorkflowLayout.test.ts`: Verify dagre produces valid positions for linear, branching, and parallel graphs. Verify check nodes get diamond dimensions.
- `BmadStepNode.test.tsx`: Renders label, role badge, handles. Renders selected state.
- `BmadCheckNode.test.tsx`: Renders diamond shape, condition text.
- `BmadActionNode.test.tsx`: Renders action icon, label.
- `WorkflowCanvas.test.tsx`: Renders React Flow with correct node count and edge count from graph.
- `WorkflowToolbar.test.tsx`: Buttons trigger fitView, zoomIn, zoomOut.
- `NodeTooltip.test.tsx`: Shows instructions, source file, line on hover.
- `workflow.store.test.ts`: Actions update state correctly, `AsyncState` transitions work.

**Integration tests:**
- `WorkflowEditor.test.tsx`: Full integration: mock IPC, load workflows, render diagram, verify node count.

**Performance (NFR3):**
- Verify > 30 FPS with 50 nodes by rendering a large mock graph and checking React Flow doesn't drop frames. Use `requestAnimationFrame` measurement in test.
- Memoize layout computation to avoid recomputation on unrelated state changes.

### Accessibility

- `role="img"` + `aria-label` on the canvas container
- `role="button"` + `tabIndex={0}` on each node for keyboard focus
- `aria-label` on each node describing its step name
- `aria-describedby` linking nodes to their tooltip content
- Focus ring (2px accent) on selected nodes
- `prefers-reduced-motion`: disable animated edges and transitions

[Source: ux-design-specification.md#Accessibility-Strategy]

### What NOT to Do

- Do NOT implement node editing (add/remove/modify) — that is Story 6.3.
- Do NOT implement file saving/serialization — that is Story 6.4.
- Do NOT implement execution tracking (active node highlighting) — that is Story 6.5.
- Do NOT use `react-flow-renderer` or `reactflow` — use `@xyflow/react` (v12+).
- Do NOT use `export default` — named exports only.
- Do NOT use `any` — React Flow types are well-defined.
- Do NOT hardcode colors — use Tailwind design token classes.
- Do NOT allow node dragging in this story — viewer is read-only. Dragging comes in Story 6.3.
- Do NOT create a separate page/route — WorkflowEditor renders inside the pane system.

### References

- [Source: architecture.md#Dependencies-to-Add] — @xyflow/react, dagre
- [Source: architecture.md#Frontend-Component-Architecture] — Feature folder structure, workflow components list
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, `useIpcInvoke` hook
- [Source: architecture.md#Complete-Project-Directory-Structure] — Target file layout
- [Source: ux-design-specification.md#Component-Strategy] — WorkflowCanvas custom component spec
- [Source: ux-design-specification.md#Journey-3-Nikou] — User journey for workflow visualization
- [Source: ux-design-specification.md#Visual-Design-Foundation] — Color tokens, dark mode palette
- [Source: ux-design-specification.md#Accessibility-Strategy] — WCAG AA, keyboard nav, focus visible
- [Source: epics.md#Story-6.2] — Original acceptance criteria
- [Source: epics.md#FR25-FR26] — Functional requirements

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
