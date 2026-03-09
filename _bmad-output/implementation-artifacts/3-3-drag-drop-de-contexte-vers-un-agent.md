# Story 3.3: Drag & Drop de Contexte vers un Agent

Status: ready-for-dev

## Story

As a **user**,
I want **to add or remove context files from an agent via drag & drop or selection**,
So that **I can control what context an agent works with**.

## Acceptance Criteria

### AC1 — Drag ContextFileCard to AgentCard

**Given** un fichier est visible dans le volet Contexte
**When** je drag la `ContextFileCard` vers un `AgentCard` dans le volet Agents
**Then** le fichier est ajouté au contexte de cet agent (FR10)
**And** la card affiche le feedback visuel pendant le drag (état "dragging")
**And** l'`AgentCard` cible montre un drop zone highlight

### AC2 — Remove context file from agent

**Given** un fichier est dans le contexte d'un agent
**When** je clique sur le bouton "Retirer" de la card (ou via clic droit)
**Then** le fichier est retiré du contexte de l'agent (FR11)
**And** la card disparaît avec fade-out 200ms

### AC3 — File picker to add context

**Given** je veux ajouter un fichier qui n'est pas visible
**When** j'utilise la sélection de fichier (bouton "Ajouter contexte")
**Then** un file picker s'ouvre avec les fichiers du projet
**And** le fichier sélectionné est ajouté au contexte de l'agent

## Tasks / Subtasks

- [ ] Task 1: Create drag-and-drop context types (AC: #1, #2)
  - [ ] 1.1 Create `src/renderer/src/features/context/context-dnd.types.ts`
  - [ ] 1.2 Define `DragItemType` enum: `CONTEXT_FILE = 'context-file'`
  - [ ] 1.3 Define `ContextFileDragData`: `{ type: DragItemType; filePath: string; fileName: string }`
  - [ ] 1.4 Define `DropResult`: `{ agentId: string; accepted: boolean }`

- [ ] Task 2: Create ContextDragDrop component (AC: #1)
  - [ ] 2.1 Create `src/renderer/src/features/context/components/ContextDragDrop.tsx`
  - [ ] 2.2 Implement HTML5 Drag API on `ContextFileCard`:
    - `onDragStart`: set `dataTransfer` with `ContextFileDragData` as JSON, set drag image, add `dragging` CSS class
    - `onDragEnd`: remove `dragging` CSS class, handle drop result
  - [ ] 2.3 Style dragging state: reduced opacity (0.5), dashed border, visual ghost
  - [ ] 2.4 Set `dataTransfer.effectAllowed = 'copy'` for visual cursor feedback
  - [ ] 2.5 Create `src/renderer/src/features/context/components/ContextDragDrop.test.tsx`

- [ ] Task 3: Create AgentDropZone component (AC: #1)
  - [ ] 3.1 Create `src/renderer/src/features/agents/components/AgentDropZone.tsx`
  - [ ] 3.2 Wrap `AgentCard` with drop zone handlers:
    - `onDragOver`: check `dataTransfer` type, call `preventDefault()` to allow drop, add highlight class
    - `onDragEnter`: add `drop-active` visual state (accent border + background tint)
    - `onDragLeave`: remove `drop-active` visual state
    - `onDrop`: parse `ContextFileDragData` from `dataTransfer`, trigger `addContextToAgent` IPC
  - [ ] 3.3 Style drop zone active state: `border-accent`, `bg-accent/10` overlay, scale-up subtle
  - [ ] 3.4 Ensure drop zone only accepts `DragItemType.CONTEXT_FILE`
  - [ ] 3.5 Create `src/renderer/src/features/agents/components/AgentDropZone.test.tsx`

- [ ] Task 4: Implement IPC for context association (AC: #1, #2, #3)
  - [ ] 4.1 Add `context:add-to-agent` IPC channel in `src/shared/ipc-channels.ts`: `{ args: { agentId: string; filePath: string }; result: void }`
  - [ ] 4.2 Add `context:remove-from-agent` IPC channel: `{ args: { agentId: string; filePath: string }; result: void }`
  - [ ] 4.3 Add `context:list-project-files` IPC channel: `{ args: { projectPath: string }; result: FileInfo[] }` (for file picker)
  - [ ] 4.4 Implement handlers in `src/main/ipc/handlers.ts` — update agent context state in main process
  - [ ] 4.5 Persist agent-context associations in `.mnm/project-state.json`

- [ ] Task 5: Implement remove context action (AC: #2)
  - [ ] 5.1 Add "Retirer" button to `ContextFileCard` — visible on hover or via context menu
  - [ ] 5.2 On click: call `context:remove-from-agent` IPC with `agentId` and `filePath`
  - [ ] 5.3 On success: remove file from store, animate card fade-out (200ms)
  - [ ] 5.4 Add right-click context menu with "Retirer du contexte de [agent]" option for each agent
  - [ ] 5.5 Style removal: `fade-out 200ms` animation, then remove from DOM

- [ ] Task 6: Implement file picker (AC: #3)
  - [ ] 6.1 Add "Ajouter contexte" button in `ContextPanel` header
  - [ ] 6.2 On click: call `context:list-project-files` IPC to get available files
  - [ ] 6.3 Display file picker as a Dialog/Popover with searchable file list (use shadcn Command component)
  - [ ] 6.4 On file selection: call `context:add-to-agent` IPC with the target agent
  - [ ] 6.5 Agent target selection: if only one agent active, auto-select; if multiple, show agent selector dropdown

- [ ] Task 7: Update ContextFileCard for drag support (AC: #1)
  - [ ] 7.1 Update `ContextFileCard` to use `ContextDragDrop` wrapper
  - [ ] 7.2 Add visual states: `default`, `dragging` (opacity + dashed border), `drag-over` (not applicable for source)
  - [ ] 7.3 Ensure drag handle is the entire card (or a grip icon on the left)
  - [ ] 7.4 Maintain accessibility: `aria-roledescription="draggable"`, `aria-grabbed` state

- [ ] Task 8: Update context store for D&D operations (AC: #1, #2)
  - [ ] 8.1 Add `addFileToAgent(agentId: string, filePath: string)` action to context store
  - [ ] 8.2 Add `removeFileFromAgent(agentId: string, filePath: string)` action
  - [ ] 8.3 Wire actions to IPC calls (optimistic update + rollback on error)

- [ ] Task 9: Integration tests (AC: #1, #2, #3)
  - [ ] 9.1 Test: drag file card -> drop on agent card -> file associated with agent
  - [ ] 9.2 Test: click "Retirer" -> file removed from agent context
  - [ ] 9.3 Test: click "Ajouter contexte" -> file picker opens -> select file -> file added

## Dev Notes

### FRs Covered

- **FR10** — L'utilisateur peut ajouter un fichier de contexte à un agent (drag & drop ou sélection)
- **FR11** — L'utilisateur peut retirer un fichier de contexte d'un agent
- **FR43** — L'utilisateur peut voir l'historique Git du projet et des fichiers de contexte (indirectly — context files are the entry point to history in Story 3.5)

### Dependencies on Previous Stories

- **Story 1.1** — IPC bridge, preload API, shared types
- **Story 1.2** — `ThreePaneLayout` with volet Contexte (left) and volet Agents (center)
- **Story 2.2** — `AgentCard` component in the Agents pane (drop target)
- **Story 3.1** — `FileWatcherService` (file picker needs project file listing)
- **Story 3.2** — `ContextFileCard`, `ContextPanel`, `context.store.ts` (drag source)

### HTML5 Drag API vs react-dnd

For the MVP, use the **native HTML5 Drag and Drop API** directly:
- No extra dependency
- Sufficient for card-to-card drag across panes
- Simple to implement for this use case

If drag behavior becomes more complex post-MVP (multi-select, nested drop zones, keyboard DnD), consider migrating to `react-dnd` or `@dnd-kit/core`.

### Drag & Drop Implementation Pattern

```typescript
// src/renderer/src/features/context/components/ContextDragDrop.tsx
import type { ContextFileDragData, DragItemType } from '../context-dnd.types';

const DRAG_ITEM_TYPE: DragItemType = 'context-file';

type ContextDragWrapperProps = {
  filePath: string;
  fileName: string;
  children: React.ReactNode;
};

export function ContextDragWrapper({
  filePath,
  fileName,
  children,
}: ContextDragWrapperProps) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const dragData: ContextFileDragData = {
      type: DRAG_ITEM_TYPE,
      filePath,
      fileName,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
    e.currentTarget.classList.add('opacity-50', 'border-dashed');
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-50', 'border-dashed');
  };

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      aria-roledescription="draggable"
    >
      {children}
    </div>
  );
}
```

### AgentDropZone Pattern

```tsx
// src/renderer/src/features/agents/components/AgentDropZone.tsx
import { useState, useCallback } from 'react';
import type { ContextFileDragData } from '@renderer/features/context/context-dnd.types';

type AgentDropZoneProps = {
  agentId: string;
  onFileDrop: (agentId: string, filePath: string) => void;
  children: React.ReactNode;
};

export function AgentDropZone({
  agentId,
  onFileDrop,
  children,
}: AgentDropZoneProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsOver(false);

      try {
        const raw = e.dataTransfer.getData('application/json');
        const data: ContextFileDragData = JSON.parse(raw);

        if (data.type === 'context-file') {
          onFileDrop(agentId, data.filePath);
        }
      } catch {
        // Invalid drag data — ignore silently
      }
    },
    [agentId, onFileDrop],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={
        isOver
          ? 'rounded-lg border-2 border-accent bg-accent/10 transition-colors duration-150'
          : 'rounded-lg border-2 border-transparent transition-colors duration-150'
      }
      aria-dropeffect="copy"
      aria-label={`Zone de dépôt pour l'agent ${agentId}`}
    >
      {children}
    </div>
  );
}
```

[Source: ux-design-specification.md#Effortless-Interactions — Drag & drop depuis le volet contexte]
[Source: ux-design-specification.md#Transferable-UX-Patterns — Drag & drop Figma-like]

### Remove Context — Fade Out Animation

```css
@keyframes fade-out {
  from {
    opacity: 1;
    max-height: 100px;
  }
  to {
    opacity: 0;
    max-height: 0;
    padding: 0;
    margin: 0;
  }
}

.animate-fade-out {
  animation: fade-out 200ms ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  .animate-fade-out {
    animation: none;
    display: none;
  }
}
```

[Source: ux-design-specification.md#Real-Time-Update-Patterns — Fade-out 200ms]

### File Picker Pattern (using shadcn Command)

```tsx
// Inside ContextPanel or as a separate component
import { Command, CommandInput, CommandList, CommandItem } from '@renderer/shared/components/Command';
import { Dialog, DialogContent, DialogTrigger } from '@renderer/shared/components/Dialog';

export function ContextFilePicker({
  onFileSelect,
}: {
  onFileSelect: (filePath: string) => void;
}) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [open, setOpen] = useState(false);

  const loadFiles = async () => {
    const result = await window.electronAPI.invoke('context:list-project-files', {
      projectPath: currentProjectPath,
    });
    setFiles(result);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" onClick={loadFiles}>
          Ajouter contexte
        </Button>
      </DialogTrigger>
      <DialogContent>
        <Command>
          <CommandInput placeholder="Rechercher un fichier..." />
          <CommandList>
            {files.map((file) => (
              <CommandItem
                key={file.path}
                onSelect={() => {
                  onFileSelect(file.path);
                  setOpen(false);
                }}
              >
                {file.name} — {file.relativePath}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
```

[Source: ux-design-specification.md#Component-Strategy — Command palette (cmdk)]

### IPC Channels to Add

```typescript
// Add to src/shared/ipc-channels.ts — IpcInvokeChannels
'context:add-to-agent': {
  args: { agentId: string; filePath: string };
  result: void;
};
'context:remove-from-agent': {
  args: { agentId: string; filePath: string };
  result: void;
};
'context:list-project-files': {
  args: { projectPath: string };
  result: FileInfo[];
};
```

### Context Association Persistence

Agent-context associations are stored in `.mnm/project-state.json`:

```json
{
  "agentContexts": {
    "agent-1": ["/path/to/file1.ts", "/path/to/file2.md"],
    "agent-2": ["/path/to/file1.ts", "/path/to/file3.yaml"]
  }
}
```

[Source: architecture.md#Local-Data-Persistence — .mnm/project-state.json]

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Component | PascalCase.tsx | `ContextDragDrop.tsx`, `AgentDropZone.tsx` |
| Types file | kebab-case + `.types.ts` | `context-dnd.types.ts` |
| IPC channel | namespace:action | `context:add-to-agent`, `context:remove-from-agent` |
| CSS animation | kebab-case | `animate-fade-out` |
| ARIA attributes | standard HTML | `aria-roledescription`, `aria-dropeffect` |

[Source: architecture.md#Naming-Patterns]

### Testing Strategy

**Unit tests:**
- `ContextDragDrop.test.tsx` — Verify `dragStart` sets correct `dataTransfer` data, verify `dragging` class toggle, verify `aria-roledescription`
- `AgentDropZone.test.tsx` — Verify `drop` event parses data correctly and calls `onFileDrop`, verify highlight on `dragEnter`/`dragLeave`, verify rejects non-context-file drags

**Integration tests:**
- Full drag-drop flow: render both panes, simulate drag from context to agent, verify store updated
- Remove flow: click "Retirer", verify IPC called, verify card fade-out, verify store updated
- File picker flow: click "Ajouter contexte", verify dialog opens, select file, verify IPC called

**Accessibility tests:**
- `aria-roledescription="draggable"` on drag source
- `aria-dropeffect="copy"` on drop target
- `aria-label` on drop zone
- Keyboard alternative: "Ajouter contexte" button provides equivalent functionality for keyboard users

### What NOT to Do

- Do NOT use `react-dnd` or `@dnd-kit` in MVP — native HTML5 API is sufficient for card-to-card drag
- Do NOT use `any` for `dataTransfer.getData` — parse and validate with type guard
- Do NOT allow dropping non-context-file items on agent cards
- Do NOT forget to clean up drag visual state in `onDragEnd` (even if drop is cancelled)
- Do NOT block the UI during IPC calls — use optimistic updates in the store, rollback on error
- Do NOT put agent-specific drop zone logic in the context feature — `AgentDropZone` lives in `features/agents/`
- Do NOT remove `draggable="true"` from `ContextFileCard` — it was added in Story 3.2 intentionally
- Do NOT forget reduced motion: fade-out animation must respect `prefers-reduced-motion`
- Do NOT use inline styles for drag states — use Tailwind classes

### References

- [Source: architecture.md#IPC-Channel-Design] — IPC invoke pattern
- [Source: architecture.md#Local-Data-Persistence] — `.mnm/project-state.json` for associations
- [Source: architecture.md#Frontend-Component-Architecture] — Feature structure
- [Source: architecture.md#Naming-Patterns] — Naming conventions
- [Source: architecture.md#Architectural-Boundaries] — Feature-to-feature communication via stores
- [Source: ux-design-specification.md#Effortless-Interactions] — Drag & drop pattern
- [Source: ux-design-specification.md#Custom-Components] — ContextFileCard draggable state
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Fade-out 200ms
- [Source: ux-design-specification.md#Component-Strategy] — Command palette for file picker
- [Source: ux-design-specification.md#Accessibility-Strategy] — ARIA for drag-and-drop
- [Source: epics.md#Story-3.3] — Acceptance criteria source
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — IPC patterns

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
