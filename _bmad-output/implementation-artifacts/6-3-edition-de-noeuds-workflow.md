# Story 6.3: Edition de Noeuds Workflow

Status: ready-for-dev

## Story

As a **user**,
I want **to add, remove, and reorganize workflow nodes and connections visually**,
So that **I can edit workflows graphiquement sans toucher au YAML/XML**.

## Acceptance Criteria

### AC1 — Insert node on connection

**Given** le workflow est en mode edition
**When** je clique sur une connexion entre deux noeuds
**Then** un nouveau noeud est insere a cet emplacement avec un formulaire de configuration (FR27)
**And** les connexions se reorganisent automatiquement

### AC2 — Delete node with confirmation

**Given** un noeud existe dans le workflow
**When** je le selectionne et clique "Supprimer" (ou touche Delete)
**Then** une Dialog de confirmation s'affiche (action destructive)
**And** apres confirmation, le noeud est supprime et les connexions sont reconnectees (FR28)

### AC3 — Reorganize connections via drag

**Given** des noeuds existent dans le workflow
**When** je drag une connexion d'un noeud source vers un noeud cible
**Then** les connexions sont reorganisees selon le nouveau lien (FR29)

### AC4 — Edit node properties panel

**Given** je selectionne un noeud
**When** j'ouvre son panneau de proprietes
**Then** je peux modifier : titre, role, instructions, conditions de branchement (FR30)
**And** les modifications sont refletees en temps reel dans le diagramme

## Tasks / Subtasks

- [ ] Task 1: Add edit mode to workflow store (AC: #1, #2, #3, #4)
  - [ ] 1.1 Extend `workflow.store.ts` with `isEditMode: boolean`, `toggleEditMode()` action
  - [ ] 1.2 Add `unsavedChanges: boolean` flag to track dirty state
  - [ ] 1.3 Add `updateNode(nodeId: string, updates: Partial<WorkflowNode>)` action
  - [ ] 1.4 Add `addNode(node: WorkflowNode, afterEdgeId: string)` action
  - [ ] 1.5 Add `removeNode(nodeId: string)` action
  - [ ] 1.6 Add `addEdge(edge: WorkflowEdge)` action
  - [ ] 1.7 Add `removeEdge(edgeId: string)` action
  - [ ] 1.8 Add `reconnectEdge(edgeId: string, newSource: string, newTarget: string)` action
  - [ ] 1.9 Implement graph integrity validation after each mutation (no orphan nodes, no cycles in sequential flows)
  - [ ] 1.10 Write unit tests for all store mutations and validation

- [ ] Task 2: Implement node insertion on edge click (AC: #1)
  - [ ] 2.1 Create `src/renderer/src/features/workflow/hooks/useNodeInsertion.ts`
  - [ ] 2.2 Add click handler on edges: when edit mode is active and user clicks an edge, show insertion UI
  - [ ] 2.3 Create `src/renderer/src/features/workflow/components/NodeInsertButton.tsx` — a "+" button rendered at edge midpoint in edit mode
  - [ ] 2.4 On click of "+" button: create a new node with default values, split the clicked edge into two edges (source->new, new->target)
  - [ ] 2.5 Trigger re-layout via dagre after insertion
  - [ ] 2.6 Auto-select the new node to open the properties panel for configuration
  - [ ] 2.7 Write unit tests: edge click creates new node, edges are correctly rewired, layout updates

- [ ] Task 3: Implement node deletion with confirmation (AC: #2)
  - [ ] 3.1 Create `src/renderer/src/features/workflow/hooks/useNodeDeletion.ts`
  - [ ] 3.2 Listen for `Delete` key press when a node is selected and edit mode is active
  - [ ] 3.3 Add "Supprimer" button in the WorkflowToolbar (visible in edit mode only)
  - [ ] 3.4 On delete action: show shadcn `Dialog` confirmation — "Supprimer le noeud '{label}' ? Cette action est irreversible."
  - [ ] 3.5 On confirmation: remove node from store, reconnect edges (if node had one incoming and one outgoing edge, connect them directly; otherwise remove all connected edges)
  - [ ] 3.6 Trigger re-layout after deletion
  - [ ] 3.7 Write unit tests: delete node reconnects edges, delete node with multiple edges removes them, dialog shown before deletion

- [ ] Task 4: Implement connection reorganization (AC: #3)
  - [ ] 4.1 Enable React Flow `onConnect` callback in edit mode
  - [ ] 4.2 Enable `onEdgeUpdate` callback for dragging existing edges to new targets
  - [ ] 4.3 Create `src/renderer/src/features/workflow/hooks/useEdgeManagement.ts`
  - [ ] 4.4 Validate new connections: no self-loops, no duplicate edges, target node exists
  - [ ] 4.5 Update store with new edge configuration
  - [ ] 4.6 Enable node dragging in edit mode (`nodesDraggable: true` when `isEditMode`)
  - [ ] 4.7 Trigger re-layout option after manual drag (with button "Re-layout" in toolbar)
  - [ ] 4.8 Write unit tests: new connection validation, edge update, self-loop prevention

- [ ] Task 5: Create node properties panel (AC: #4)
  - [ ] 5.1 Create `src/renderer/src/features/workflow/components/NodePropertiesPanel.tsx`
  - [ ] 5.2 Render as a side panel (right side, 320px width) when a node is selected in edit mode
  - [ ] 5.3 Display editable fields: `label` (text input), `type` (select: step/check/action), `role` (text input), `instructions` (textarea), `conditions` (textarea, visible only for check nodes)
  - [ ] 5.4 Use controlled form inputs bound to the selected node's data
  - [ ] 5.5 On field change: call `updateNode()` store action immediately (real-time reflection in diagram)
  - [ ] 5.6 Add validation: `label` is required, `label` max 100 chars, `instructions` max 2000 chars
  - [ ] 5.7 Show validation errors inline below fields
  - [ ] 5.8 Add "Fermer" button and keyboard shortcut `Esc` to close the panel
  - [ ] 5.9 Style with design tokens: `--bg-surface`, `--border-default`, `--text-primary`, `--text-secondary`
  - [ ] 5.10 Write unit tests: panel renders for selected node, field changes update store, validation errors shown

- [ ] Task 6: Create node type selector for new nodes (AC: #1)
  - [ ] 6.1 Create `src/renderer/src/features/workflow/components/NodeTypeSelector.tsx`
  - [ ] 6.2 Show as a small popover when inserting a new node (after clicking "+" on edge)
  - [ ] 6.3 Offer 3 choices: "Etape" (step), "Verification" (check), "Action" (action) with icons
  - [ ] 6.4 On selection: create node of chosen type, open properties panel
  - [ ] 6.5 Write unit test: selector renders 3 options, selection creates correct node type

- [ ] Task 7: Update WorkflowEditor for edit mode (AC: all)
  - [ ] 7.1 Add edit mode toggle button in `WorkflowToolbar.tsx` — "Mode Edition" / "Mode Lecture"
  - [ ] 7.2 When edit mode is active: enable node dragging, show "+" buttons on edges, enable connection handles, show delete button
  - [ ] 7.3 When edit mode is inactive (view mode): read-only, no dragging, no insert buttons, no handles visible
  - [ ] 7.4 Visual indicator for edit mode: border accent on canvas, "Edition" badge in toolbar
  - [ ] 7.5 Conditionally pass React Flow props based on edit mode: `nodesDraggable`, `nodesConnectable`, `elementsSelectable`
  - [ ] 7.6 Write integration test: toggle edit mode changes canvas behavior

- [ ] Task 8: Update WorkflowCanvas for interactive editing (AC: #1, #2, #3)
  - [ ] 8.1 Pass `onConnect`, `onEdgeUpdate`, `onNodeClick`, `onEdgeClick` handlers based on edit mode
  - [ ] 8.2 Add `isValidConnection` callback to prevent invalid connections
  - [ ] 8.3 Update `useNodesState` / `useEdgesState` to sync bidirectionally with Zustand store
  - [ ] 8.4 Apply `fitView` after layout changes (insertion/deletion)
  - [ ] 8.5 Write integration test: full editing flow (insert, edit, delete, reconnect)

## Dev Notes

### FRs Covered

- **FR27** (complete): L'utilisateur peut ajouter un noeud (etape) a un workflow existant via l'editeur visuel.
- **FR28** (complete): L'utilisateur peut supprimer un noeud d'un workflow.
- **FR29** (complete): L'utilisateur peut reorganiser les connexions entre noeuds.
- **FR30** (complete): L'utilisateur peut configurer les proprietes d'un noeud (role, instructions).

### Dependencies on Previous Stories

- **Story 1.1** (Project Scaffold): IPC infrastructure, `AppError`, design tokens, shadcn/ui Dialog component.
- **Story 6.1** (BMAD Workflow Parser): `WorkflowGraph`, `WorkflowNode`, `WorkflowEdge` types. Parser provides the initial graph data.
- **Story 6.2** (Workflow Diagram Viewer): `WorkflowCanvas`, `WorkflowEditor`, `BmadStepNode`, `BmadCheckNode`, `BmadActionNode`, `useWorkflowLayout`, `workflow.store.ts`. This story extends them with editing capabilities.

### Extended Zustand Store

```typescript
// src/renderer/src/features/workflow/workflow.store.ts — extensions for Story 6.3

type WorkflowState = {
  // ... existing from Story 6.2 ...
  isEditMode: boolean;
  unsavedChanges: boolean;

  // Edit mode
  toggleEditMode: () => void;

  // Node mutations
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  addNode: (node: WorkflowNode, splitEdgeId: string) => void;
  removeNode: (nodeId: string) => void;

  // Edge mutations
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (edgeId: string) => void;
  reconnectEdge: (edgeId: string, newSource: string, newTarget: string) => void;

  // Dirty tracking
  markDirty: () => void;
  markClean: () => void;
};
```

**addNode logic (insert on edge):**
```typescript
addNode: (newNode, splitEdgeId) => set((state) => {
  if (state.workflows.status !== 'success') return state;
  const graph = state.workflows.data.find(w => w.id === state.selectedWorkflowId);
  if (!graph) return state;

  // Find the edge to split
  const edgeToSplit = graph.edges.find(e => e.id === splitEdgeId);
  if (!edgeToSplit) return state;

  // Remove old edge, add two new edges
  const newEdges = graph.edges
    .filter(e => e.id !== splitEdgeId)
    .concat([
      { id: `edge-${edgeToSplit.source}-${newNode.id}`, source: edgeToSplit.source, target: newNode.id, type: 'sequential' as const },
      { id: `edge-${newNode.id}-${edgeToSplit.target}`, source: newNode.id, target: edgeToSplit.target, type: 'sequential' as const },
    ]);

  const updatedGraph = {
    ...graph,
    nodes: [...graph.nodes, newNode],
    edges: newEdges,
  };

  return {
    workflows: {
      status: 'success' as const,
      data: state.workflows.data.map(w => w.id === graph.id ? updatedGraph : w),
    },
    unsavedChanges: true,
    selectedNodeId: newNode.id, // auto-select for properties panel
  };
}),
```

[Source: architecture.md#Communication-Patterns — Zustand store immutable updates]

### Node Properties Panel Pattern

```typescript
// src/renderer/src/features/workflow/components/NodePropertiesPanel.tsx
import type { WorkflowNode, WorkflowNodeType } from '@shared/types/workflow.types';
import { useWorkflowStore } from '../workflow.store';

type NodePropertiesPanelProps = {
  node: WorkflowNode;
  onClose: () => void;
};

export function NodePropertiesPanel({ node, onClose }: NodePropertiesPanelProps) {
  const updateNode = useWorkflowStore((s) => s.updateNode);

  const handleChange = (field: keyof WorkflowNode, value: string) => {
    updateNode(node.id, { [field]: value });
  };

  return (
    <aside
      className="w-80 border-l border-border-default bg-bg-surface p-4 overflow-y-auto"
      role="complementary"
      aria-label={`Proprietes du noeud: ${node.label}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-medium text-text-primary">Proprietes</h3>
        <button onClick={onClose} aria-label="Fermer le panneau" className="text-text-muted hover:text-text-primary">
          {/* Close icon */}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-text-secondary block mb-1">Titre</label>
          <input
            type="text"
            value={node.label}
            onChange={(e) => handleChange('label', e.target.value)}
            maxLength={100}
            required
            className="w-full bg-bg-elevated border border-border-default rounded px-3 py-2 text-text-primary text-sm focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="text-sm text-text-secondary block mb-1">Type</label>
          <select
            value={node.type}
            onChange={(e) => handleChange('type', e.target.value as WorkflowNodeType)}
            className="w-full bg-bg-elevated border border-border-default rounded px-3 py-2 text-text-primary text-sm"
          >
            <option value="step">Etape</option>
            <option value="check">Verification</option>
            <option value="action">Action</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-text-secondary block mb-1">Role</label>
          <input
            type="text"
            value={node.role ?? ''}
            onChange={(e) => handleChange('role', e.target.value)}
            className="w-full bg-bg-elevated border border-border-default rounded px-3 py-2 text-text-primary text-sm"
          />
        </div>

        <div>
          <label className="text-sm text-text-secondary block mb-1">Instructions</label>
          <textarea
            value={node.instructions ?? ''}
            onChange={(e) => handleChange('instructions', e.target.value)}
            maxLength={2000}
            rows={6}
            className="w-full bg-bg-elevated border border-border-default rounded px-3 py-2 text-text-primary text-sm resize-y"
          />
        </div>

        {node.type === 'check' && (
          <div>
            <label className="text-sm text-text-secondary block mb-1">Conditions</label>
            <textarea
              value={node.conditions ?? ''}
              onChange={(e) => handleChange('conditions', e.target.value)}
              rows={4}
              className="w-full bg-bg-elevated border border-border-default rounded px-3 py-2 text-text-primary text-sm resize-y"
            />
          </div>
        )}
      </div>
    </aside>
  );
}
```

[Source: ux-design-specification.md#UX-Pattern-Analysis — Canvas + panneau proprietes (Figma)]

### Delete Confirmation Dialog Pattern

```typescript
// Using shadcn/ui Dialog
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@renderer/shared/components/ui/dialog';
import { Button } from '@renderer/shared/components/ui/button';

type DeleteNodeDialogProps = {
  open: boolean;
  nodeLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteNodeDialog({ open, nodeLabel, onConfirm, onCancel }: DeleteNodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer le noeud</DialogTitle>
          <DialogDescription>
            Supprimer le noeud &laquo;{nodeLabel}&raquo; ? Les connexions seront reconnectees automatiquement. Cette action est irreversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button variant="destructive" onClick={onConfirm}>Supprimer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

[Source: ux-design-specification.md#Button-Hierarchy — Destructive actions require Dialog confirmation]

### Node Reconnection Logic on Delete

```
Before deletion of node B:
  A --edge1--> B --edge2--> C

After deletion:
  A --edge-new--> C

Before deletion of node B (multiple connections):
  A --edge1--> B --edge2--> C
  D --edge3--> B --edge4--> E

After deletion:
  All edges to/from B are removed. No auto-reconnection for multi-connection nodes.
  A (no outgoing), C (no incoming), D (no outgoing), E (no incoming)
```

### File Structure (additions to Story 6.2)

```
src/renderer/src/features/workflow/
  components/
    ... (existing from Story 6.2) ...
    NodePropertiesPanel.tsx          # NEW
    NodePropertiesPanel.test.tsx     # NEW
    NodeInsertButton.tsx             # NEW
    NodeInsertButton.test.tsx        # NEW
    NodeTypeSelector.tsx             # NEW
    NodeTypeSelector.test.tsx        # NEW
    DeleteNodeDialog.tsx             # NEW
    DeleteNodeDialog.test.tsx        # NEW
  hooks/
    ... (existing from Story 6.2) ...
    useNodeInsertion.ts              # NEW
    useNodeInsertion.test.ts         # NEW
    useNodeDeletion.ts               # NEW
    useNodeDeletion.test.ts          # NEW
    useEdgeManagement.ts             # NEW
    useEdgeManagement.test.ts        # NEW
  workflow.store.ts                  # MODIFIED (extended with edit actions)
  workflow.store.test.ts             # MODIFIED (new tests for edit actions)
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Panel components | PascalCase + Panel suffix | `NodePropertiesPanel.tsx` |
| Dialog components | PascalCase + Dialog suffix | `DeleteNodeDialog.tsx` |
| Hooks for behavior | camelCase, prefix `use` + action noun | `useNodeInsertion.ts` |
| Store actions | camelCase verb + noun | `addNode`, `removeNode`, `updateNode` |
| Edge IDs | `edge-{sourceId}-{targetId}` | `edge-step-1-step-2` |
| Node IDs (new) | `node-{timestamp}` or `node-{uuid}` | `node-1709123456789` |

[Source: architecture.md#Naming-Patterns]

### Testing Strategy

**Unit tests (co-located):**
- `workflow.store.test.ts` (extended): `addNode` splits edge correctly, `removeNode` reconnects simple chains, `removeNode` removes all edges for multi-connection nodes, `updateNode` updates specific fields, `reconnectEdge` validates no self-loops, `unsavedChanges` flag set on mutations
- `NodePropertiesPanel.test.tsx`: Renders correct fields for each node type, field changes call `updateNode`, validation errors shown for empty label, conditions field only visible for `check` type
- `NodeInsertButton.test.tsx`: "+" button rendered at edge midpoint in edit mode, not rendered in view mode, click triggers insertion flow
- `NodeTypeSelector.test.tsx`: Renders 3 options, selection callback fires with correct type
- `DeleteNodeDialog.test.tsx`: Dialog shown/hidden based on `open` prop, confirm button triggers callback, cancel closes dialog
- `useNodeInsertion.test.ts`: Edge click in edit mode triggers insertion, generated node has unique id
- `useNodeDeletion.test.ts`: Delete key fires deletion flow only in edit mode, deletion not triggered in view mode
- `useEdgeManagement.test.ts`: New connections validated, self-loops rejected, duplicate edges rejected

**Integration tests:**
- Full editing flow: toggle edit mode -> insert node on edge -> edit properties -> delete node -> verify graph integrity

### Accessibility

- Properties panel: `role="complementary"`, `aria-label` with node name
- Delete dialog: managed by Radix Dialog (focus trap, Esc to close, ARIA roles)
- Node type selector: keyboard navigable (arrow keys + Enter)
- "+" insert buttons: `aria-label="Inserer un noeud"`, focusable with Tab
- Edit mode toggle: `aria-pressed` state on the toggle button
- All form inputs: proper `<label>` associations

[Source: ux-design-specification.md#Accessibility-Strategy]

### What NOT to Do

- Do NOT implement file saving — that is Story 6.4. All edits stay in the Zustand store until saved.
- Do NOT implement undo/redo — out of MVP scope.
- Do NOT implement execution tracking — that is Story 6.5.
- Do NOT allow editing in view mode — strict separation between read and edit modes.
- Do NOT use `any` for node data — use proper `WorkflowNode` types.
- Do NOT use `export default` — named exports only.
- Do NOT use inline styles — Tailwind classes with design tokens only.
- Do NOT allow creation of cycles in sequential edge flows (conditional edges can create loops if intentional).
- Do NOT auto-save — explicit save is in Story 6.4.

### References

- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, immutable updates
- [Source: architecture.md#Frontend-Component-Architecture] — Feature folder structure
- [Source: architecture.md#Naming-Patterns] — Naming conventions
- [Source: ux-design-specification.md#Component-Strategy] — WorkflowCanvas states (view/edit/executing)
- [Source: ux-design-specification.md#UX-Pattern-Analysis] — Canvas + panneau proprietes (Figma-inspired)
- [Source: ux-design-specification.md#Button-Hierarchy] — Destructive button style + Dialog confirmation
- [Source: ux-design-specification.md#Journey-3-Nikou] — User journey: Visual -> Edit -> Save
- [Source: ux-design-specification.md#Keyboard-Shortcuts] — Esc to close panels
- [Source: epics.md#Story-6.3] — Original acceptance criteria
- [Source: epics.md#FR27-FR30] — Functional requirements

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
