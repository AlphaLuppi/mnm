# Story 6.4: Synchronisation Workflow - Fichier Source

Status: ready-for-dev

## Story

As a **user**,
I want **visual workflow edits to be saved back to the source file (YAML/XML)**,
So that **my changes are persistent and the source of truth is always the file**.

## Acceptance Criteria

### AC1 — Save graph to source file format

**Given** j'ai modifie un workflow visuellement
**When** je clique "Sauvegarder" (ou `Cmd+S`)
**Then** le graph est serialise vers le format source du fichier (YAML via `yaml-serializer.ts` ou XML via `xml-serializer.ts`) (FR31)
**And** le fichier est ecrit de maniere atomique (write temp + rename)

### AC2 — YAML format preservation

**Given** le fichier source est en YAML
**When** le serializer ecrit le fichier
**Then** le format YAML est preserve (indentation, commentaires si possible)
**And** le fichier resultant est valide et parsable

### AC3 — XML format preservation

**Given** le fichier source est en XML
**When** le serializer ecrit le fichier
**Then** le format XML est preserve avec la structure correcte
**And** le fichier resultant est valide

### AC4 — Unsaved changes warning

**Given** j'ai des modifications non sauvegardees
**When** je tente de naviguer ailleurs
**Then** un avertissement s'affiche : "Modifications non sauvegardees. Sauvegarder ?"

## Tasks / Subtasks

- [ ] Task 1: Implement YAML serializer (AC: #1, #2)
  - [ ] 1.1 Create `src/main/services/workflow-parser/yaml-serializer.ts`
  - [ ] 1.2 Implement `serializeToYaml(graph: WorkflowGraph): string` that converts a `WorkflowGraph` back to YAML string
  - [ ] 1.3 Map `WorkflowNode[]` back to YAML steps structure with fields: `id`, `name`, `role`, `instructions`, `next`
  - [ ] 1.4 Map `WorkflowEdge[]` to `transitions` / `next` fields in each step
  - [ ] 1.5 Handle conditional edges: output as `branches` or `conditions` in YAML structure
  - [ ] 1.6 Configure `js-yaml.dump()` with: `indent: 2`, `lineWidth: 120`, `sortKeys: false`, `noRefs: true`
  - [ ] 1.7 Preserve workflow metadata (name, description, etc.) in YAML output header
  - [ ] 1.8 Write unit tests: serialize linear graph, branching graph, round-trip (parse -> serialize -> parse produces equivalent graph)
  - [ ] 1.9 Write unit tests: output is valid YAML parsable by `js-yaml.load()`

- [ ] Task 2: Implement XML serializer (AC: #1, #3)
  - [ ] 2.1 Create `src/main/services/workflow-parser/xml-serializer.ts`
  - [ ] 2.2 Implement `serializeToXml(graph: WorkflowGraph): string` using `fast-xml-parser` `XMLBuilder`
  - [ ] 2.3 Map `WorkflowNode[]` to XML elements: `<task>` for step, `<gateway>` for check, `<serviceTask>` for action
  - [ ] 2.4 Map `WorkflowEdge[]` to `<sequenceFlow>` elements with `sourceRef` and `targetRef` attributes
  - [ ] 2.5 Wrap in `<process>` root element with workflow metadata attributes
  - [ ] 2.6 Configure XMLBuilder with: `format: true`, `indentBy: '  '`, `ignoreAttributes: false`
  - [ ] 2.7 Add XML declaration header `<?xml version="1.0" encoding="UTF-8"?>`
  - [ ] 2.8 Write unit tests: serialize linear graph, branching graph, round-trip consistency
  - [ ] 2.9 Write unit tests: output is valid XML parsable by `fast-xml-parser`

- [ ] Task 3: Implement Markdown serializer (AC: #1)
  - [ ] 3.1 Create `src/main/services/workflow-parser/markdown-serializer.ts`
  - [ ] 3.2 Implement `serializeToMarkdown(graph: WorkflowGraph): string` for workflows originally parsed from Markdown
  - [ ] 3.3 Map nodes back to Markdown headers (## for top-level steps, ### for sub-steps)
  - [ ] 3.4 Map sequential edges to numbered list ordering
  - [ ] 3.5 Include node instructions as body text under each header
  - [ ] 3.6 Write unit tests: round-trip Markdown serialization

- [ ] Task 4: Implement atomic file writer (AC: #1)
  - [ ] 4.1 Create `src/main/services/workflow-parser/file-writer.ts`
  - [ ] 4.2 Implement `writeFileAtomic(filePath: string, content: string): Promise<void>`
  - [ ] 4.3 Pattern: write to `{filePath}.tmp` then `fs.rename()` to `{filePath}` (atomic on most filesystems)
  - [ ] 4.4 Handle errors: cleanup temp file on failure, emit `AppError` with `code: 'WORKFLOW_SAVE_ERROR'`
  - [ ] 4.5 Verify file permissions before writing
  - [ ] 4.6 Write unit tests: successful atomic write, cleanup on failure, permission error handling

- [ ] Task 5: Implement workflow save service (AC: #1, #2, #3)
  - [ ] 5.1 Create `src/main/services/workflow-parser/workflow-save.service.ts`
  - [ ] 5.2 Implement `saveWorkflow(graph: WorkflowGraph): Promise<void>` that:
    - Determines the serializer from `graph.sourceFormat` (yaml/xml/markdown)
    - Serializes the graph to string
    - Writes the file atomically
  - [ ] 5.3 Validate graph before serialization (no empty labels, no orphan nodes)
  - [ ] 5.4 Log save operation: `logger.info('workflow-parser', 'Workflow saved', { file: graph.sourceFile })`
  - [ ] 5.5 Write unit tests: correct serializer selected based on format, validation rejects invalid graphs

- [ ] Task 6: Register `workflow:save` IPC handler (AC: #1)
  - [ ] 6.1 Add `workflow:save` handler in `src/main/ipc/handlers.ts`
  - [ ] 6.2 Handler receives `{ workflowId: string; graph: WorkflowGraph }`, calls `saveWorkflow()`
  - [ ] 6.3 Return success/error to renderer
  - [ ] 6.4 After successful save, emit `file:changed` event on the event bus (triggers file watcher and potential drift detection)
  - [ ] 6.5 Write integration test: IPC round-trip for workflow save

- [ ] Task 7: Implement save UI in renderer (AC: #1, #4)
  - [ ] 7.1 Add "Sauvegarder" button in `WorkflowToolbar.tsx` (visible in edit mode when `unsavedChanges === true`)
  - [ ] 7.2 Wire `Cmd+S` keyboard shortcut to save action (only when workflow editor is focused)
  - [ ] 7.3 Create `src/renderer/src/features/workflow/hooks/useWorkflowSave.ts`
  - [ ] 7.4 Implement save flow: call `workflow:save` IPC -> on success: show toast "Workflow sauvegarde", reset `unsavedChanges` to false -> on error: show error toast with details
  - [ ] 7.5 Disable save button during save operation (loading state)
  - [ ] 7.6 Write unit test: save hook calls IPC, resets dirty flag on success, shows error on failure

- [ ] Task 8: Implement unsaved changes warning (AC: #4)
  - [ ] 8.1 Create `src/renderer/src/features/workflow/hooks/useUnsavedChangesGuard.ts`
  - [ ] 8.2 Listen for navigation events (sidebar clicks, breadcrumb clicks, Esc) when `unsavedChanges === true`
  - [ ] 8.3 Show shadcn `Dialog`: "Modifications non sauvegardees" with 3 buttons: "Sauvegarder" (save then navigate), "Ne pas sauvegarder" (discard and navigate), "Annuler" (stay)
  - [ ] 8.4 Listen for Electron window `close` event via IPC to warn before app quit with unsaved changes
  - [ ] 8.5 Write unit tests: guard blocks navigation when dirty, allows navigation when clean, dialog actions work correctly

- [ ] Task 9: Update workflow store for save state (AC: #1, #4)
  - [ ] 9.1 Extend `workflow.store.ts` with `saveState: AsyncState<void>`
  - [ ] 9.2 Add `saveWorkflow()` async action that calls IPC and manages state transitions
  - [ ] 9.3 On successful save: set `unsavedChanges: false`, `saveState: { status: 'success', data: undefined }`
  - [ ] 9.4 On failed save: set `saveState: { status: 'error', error }`, keep `unsavedChanges: true`
  - [ ] 9.5 Write unit tests for save state transitions

## Dev Notes

### FRs Covered

- **FR31** (complete): Le systeme peut synchroniser les modifications visuelles avec le fichier source du workflow (YAML/XML). Round-trip complet: parse -> edit -> serialize -> write.
- **FR48** (extends Story 6.1): Le parsing est bidirectionnel — les fichiers workflow BMAD peuvent etre lus et reecrits.

### Dependencies on Previous Stories

- **Story 1.1** (Project Scaffold): IPC infrastructure, `AppError`, event bus, logger, design tokens, shadcn/ui Dialog and Toast components.
- **Story 6.1** (BMAD Workflow Parser): `WorkflowGraph` types, `yaml-parser.ts`, `xml-parser.ts` (parsers needed for round-trip validation), `workflow-parser.types.ts`.
- **Story 6.2** (Workflow Diagram Viewer): `WorkflowEditor`, `WorkflowToolbar`, `workflow.store.ts` (store base).
- **Story 6.3** (Node Editing): `unsavedChanges` flag in store, edit mode, all mutation actions that produce dirty state.

### YAML Serializer Implementation

```typescript
// src/main/services/workflow-parser/yaml-serializer.ts
import jsYaml from 'js-yaml';
import type { WorkflowGraph, WorkflowNode, WorkflowEdge } from '@shared/types/workflow.types';

export function serializeToYaml(graph: WorkflowGraph): string {
  const doc: Record<string, unknown> = {
    name: graph.name,
    ...(graph.metadata ?? {}),
    steps: graph.nodes.map((node) => serializeNode(node, graph.edges)),
  };

  return jsYaml.dump(doc, {
    indent: 2,
    lineWidth: 120,
    sortKeys: false,
    noRefs: true,
    quotingType: '"',
  });
}

function serializeNode(
  node: WorkflowNode,
  edges: WorkflowEdge[]
): Record<string, unknown> {
  const outgoing = edges.filter(e => e.source === node.id);
  const step: Record<string, unknown> = {
    id: node.id,
    name: node.label,
    type: node.type,
  };

  if (node.role) step.role = node.role;
  if (node.instructions) step.instructions = node.instructions;
  if (node.conditions) step.conditions = node.conditions;

  // Single next step
  if (outgoing.length === 1 && outgoing[0].type === 'sequential') {
    step.next = outgoing[0].target;
  }

  // Multiple next steps (branches)
  if (outgoing.length > 1) {
    step.branches = outgoing.map(e => ({
      target: e.target,
      condition: e.label ?? undefined,
    }));
  }

  return step;
}
```

[Source: architecture.md#Gap-Resolution GAP-3 — yaml-serializer.ts]

### XML Serializer Implementation

```typescript
// src/main/services/workflow-parser/xml-serializer.ts
import { XMLBuilder } from 'fast-xml-parser';
import type { WorkflowGraph } from '@shared/types/workflow.types';

const xmlBuilderOptions = {
  format: true,
  indentBy: '  ',
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  suppressEmptyNode: true,
};

export function serializeToXml(graph: WorkflowGraph): string {
  const builder = new XMLBuilder(xmlBuilderOptions);

  const processElements: Record<string, unknown>[] = [];

  // Map nodes to XML elements
  for (const node of graph.nodes) {
    const elementName = node.type === 'check' ? 'gateway' : node.type === 'action' ? 'serviceTask' : 'task';
    processElements.push({
      [elementName]: {
        '@_id': node.id,
        '@_name': node.label,
        ...(node.role ? { '@_role': node.role } : {}),
        ...(node.instructions ? { documentation: node.instructions } : {}),
      },
    });
  }

  // Map edges to sequence flows
  for (const edge of graph.edges) {
    processElements.push({
      sequenceFlow: {
        '@_id': edge.id,
        '@_sourceRef': edge.source,
        '@_targetRef': edge.target,
        ...(edge.label ? { '@_name': edge.label } : {}),
      },
    });
  }

  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    process: {
      '@_id': graph.id,
      '@_name': graph.name,
      ...Object.assign({}, ...processElements),
    },
  };

  return builder.build(doc);
}
```

[Source: architecture.md#Gap-Resolution GAP-3 — xml-serializer.ts]

### Atomic File Write Pattern

```typescript
// src/main/services/workflow-parser/file-writer.ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AppError } from '@shared/types/error.types';

export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;

  try {
    // Write to temp file
    await fs.writeFile(tempPath, content, 'utf-8');

    // Atomic rename
    await fs.rename(tempPath, filePath);
  } catch (err) {
    // Cleanup temp file on failure
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    const appError: AppError = {
      code: 'WORKFLOW_SAVE_ERROR',
      message: `Echec de l'ecriture du fichier workflow: ${filePath}`,
      source: 'workflow-parser',
      details: err,
    };
    throw appError;
  }
}
```

[Source: architecture.md#Local-Data-Persistence — Ecriture atomique: write temp + rename]

### IPC Handler for workflow:save

```typescript
// In src/main/ipc/handlers.ts — add to registerInvokeHandlers()

ipcMain.handle('workflow:save', async (_event, args: { workflowId: string; graph: WorkflowGraph }) => {
  try {
    await workflowSaveService.saveWorkflow(args.graph);
    // Emit file:changed event to trigger file watcher / drift detection
    eventBus.emit('file:changed', {
      path: args.graph.sourceFile,
      type: 'modify',
    });
    return { success: true };
  } catch (err) {
    throw normalizeToAppError(err, 'workflow-parser');
  }
});
```

[Source: architecture.md#IPC-Channel-Design — workflow:save channel]

### Unsaved Changes Dialog Pattern

```typescript
// src/renderer/src/features/workflow/components/UnsavedChangesDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@renderer/shared/components/ui/dialog';
import { Button } from '@renderer/shared/components/ui/button';

type UnsavedChangesDialogProps = {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedChangesDialog({ open, onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifications non sauvegardees</DialogTitle>
          <DialogDescription>
            Le workflow contient des modifications non sauvegardees. Que souhaitez-vous faire ?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button variant="ghost" onClick={onDiscard}>Ne pas sauvegarder</Button>
          <Button variant="default" onClick={onSave}>Sauvegarder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Save Hook Pattern

```typescript
// src/renderer/src/features/workflow/hooks/useWorkflowSave.ts
import { useCallback } from 'react';
import { useWorkflowStore } from '../workflow.store';

export function useWorkflowSave() {
  const { selectedWorkflowId, workflows, saveState } = useWorkflowStore(
    (s) => ({
      selectedWorkflowId: s.selectedWorkflowId,
      workflows: s.workflows,
      saveState: s.saveState,
    })
  );

  const saveWorkflow = useWorkflowStore((s) => s.saveWorkflow);

  const handleSave = useCallback(async () => {
    if (!selectedWorkflowId || workflows.status !== 'success') return;
    const graph = workflows.data.find((w) => w.id === selectedWorkflowId);
    if (!graph) return;
    await saveWorkflow();
  }, [selectedWorkflowId, workflows, saveWorkflow]);

  return {
    save: handleSave,
    isSaving: saveState.status === 'loading',
    saveError: saveState.status === 'error' ? saveState.error : null,
  };
}
```

### File Structure (additions)

```
src/
  main/
    services/
      workflow-parser/
        ... (existing from Story 6.1) ...
        yaml-serializer.ts              # NEW
        yaml-serializer.test.ts         # NEW
        xml-serializer.ts               # NEW
        xml-serializer.test.ts          # NEW
        markdown-serializer.ts          # NEW
        markdown-serializer.test.ts     # NEW
        file-writer.ts                  # NEW
        file-writer.test.ts             # NEW
        workflow-save.service.ts        # NEW
        workflow-save.service.test.ts   # NEW
  renderer/src/features/workflow/
    components/
      ... (existing) ...
      UnsavedChangesDialog.tsx          # NEW
      UnsavedChangesDialog.test.tsx     # NEW
    hooks/
      ... (existing) ...
      useWorkflowSave.ts               # NEW
      useWorkflowSave.test.ts          # NEW
      useUnsavedChangesGuard.ts        # NEW
      useUnsavedChangesGuard.test.ts   # NEW
    workflow.store.ts                   # MODIFIED (add saveState, saveWorkflow action)
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Serializer files | kebab-case + `-serializer.ts` | `yaml-serializer.ts` |
| Service file | kebab-case + `.service.ts` | `workflow-save.service.ts` |
| Utility file | kebab-case + `.ts` | `file-writer.ts` |
| Functions | camelCase, named export | `export function serializeToYaml()` |
| IPC channel | namespace:action | `'workflow:save'` |
| Error codes | UPPER_SNAKE | `'WORKFLOW_SAVE_ERROR'` |
| Dialog components | PascalCase + Dialog suffix | `UnsavedChangesDialog.tsx` |
| Hooks | camelCase, prefix `use` | `useWorkflowSave.ts` |

[Source: architecture.md#Naming-Patterns]

### Testing Strategy

**Unit tests (co-located):**
- `yaml-serializer.test.ts`: Serialize linear graph, branching graph, graph with metadata. Round-trip test: `parseYaml(serializeToYaml(graph))` produces equivalent graph. Output is valid YAML.
- `xml-serializer.test.ts`: Serialize to valid XML structure. Round-trip test with `parseXml`. BPMN elements mapped correctly.
- `markdown-serializer.test.ts`: Serialize to valid Markdown with headers and numbered lists. Round-trip consistency.
- `file-writer.test.ts`: Atomic write success (temp file created then renamed). Cleanup on failure. Permission error handling. Mock `fs` module.
- `workflow-save.service.test.ts`: Correct serializer chosen based on `sourceFormat`. Validation rejects invalid graphs. Save calls file writer.
- `useWorkflowSave.test.ts`: Save calls IPC, resets dirty flag on success, sets error on failure.
- `useUnsavedChangesGuard.test.ts`: Guard blocks navigation when dirty, allows when clean, dialog responses trigger correct actions.
- `UnsavedChangesDialog.test.tsx`: 3 buttons render, each triggers correct callback.

**Round-trip tests (critical):**
The most critical tests are round-trip tests ensuring: `parse(serialize(graph)) === graph` (structural equivalence). These validate that no data is lost during serialization. Test with various graph structures: linear, branching, parallel, single node, complex multi-branch.

### What NOT to Do

- Do NOT attempt to preserve YAML comments — `js-yaml` does not support comment preservation. Document this limitation.
- Do NOT implement auto-save — only explicit save via button or `Cmd+S`.
- Do NOT modify the original file without atomic write — always use temp + rename.
- Do NOT save to a different file format than the source — YAML in = YAML out.
- Do NOT save if the graph has validation errors — block save and show errors.
- Do NOT use `any` — type all serializer functions strictly.
- Do NOT use `export default` — named exports only.
- Do NOT use `fs.writeFileSync` — all file I/O must be async.
- Do NOT swallow errors — all errors must be normalized to `AppError` and propagated.

### References

- [Source: architecture.md#Gap-Resolution GAP-3] — YAML/XML serializer design, `workflow:save` IPC
- [Source: architecture.md#IPC-Channel-Design] — `workflow:save` channel definition
- [Source: architecture.md#Local-Data-Persistence] — Atomic write pattern (write temp + rename)
- [Source: architecture.md#Process-Patterns] — Error handling, `AppError` normalization, logging
- [Source: architecture.md#Dependencies-to-Add] — js-yaml, fast-xml-parser
- [Source: ux-design-specification.md#Feedback-Patterns] — Toast for save confirmation (auto-dismiss 3s), error toast persistent
- [Source: ux-design-specification.md#Keyboard-Shortcuts] — `Cmd+S` not listed but standard save shortcut
- [Source: ux-design-specification.md#Journey-3-Nikou] — Step 5: Sauvegarde (1 clic) -> serialiseur ecrit le fichier source
- [Source: epics.md#Story-6.4] — Original acceptance criteria
- [Source: epics.md#FR31-FR48] — Functional requirements

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
