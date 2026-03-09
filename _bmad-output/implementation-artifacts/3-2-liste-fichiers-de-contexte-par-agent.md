# Story 3.2: Liste des Fichiers de Contexte par Agent

Status: ready-for-dev

## Story

As a **user**,
I want **to see which context files each agent is using, displayed as visual cards with agent badges**,
So that **I know exactly what each agent "sees"**.

## Acceptance Criteria

### AC1 — ContextFileCard display with agent badges

**Given** un agent est actif et consulte des fichiers
**When** je regarde le volet Contexte
**Then** je vois des `ContextFileCard` pour chaque fichier : icône type, nom, chemin relatif
**And** chaque card affiche des badges indiquant quel(s) agent(s) utilisent ce fichier (FR12)

### AC2 — Real-time context list update (< 500ms)

**Given** la liste de contexte est affichée
**When** un agent commence à consulter un nouveau fichier
**Then** la liste se met à jour en continu (< 500ms, NFR1) (FR9)
**And** la nouvelle card apparaît avec animation slide-in

### AC3 — Story-level context filtering

**Given** je suis au niveau Story dans la navigation
**When** les volets sont synchronisés
**Then** le volet Contexte filtre les fichiers pertinents pour cette story

### AC4 — Modified badge on file change

**Given** un fichier de contexte est modifié
**When** la modification est détectée par le file watcher
**Then** la card du fichier affiche un badge "Modifié" avec un indicateur visuel

## Tasks / Subtasks

- [ ] Task 1: Create context Zustand store (AC: #1, #2, #3)
  - [ ] 1.1 Create `src/renderer/src/features/context/context.store.ts` with `useContextStore`
  - [ ] 1.2 Define store state: `contextFiles: Map<string, ContextFile>`, `filesByAgent: Map<string, string[]>`, `selectedStoryId: string | null`
  - [ ] 1.3 Implement actions: `addFile`, `removeFile`, `updateFileStatus`, `setAgentFiles`, `filterByStory`
  - [ ] 1.4 Implement computed selector: `getFilesForCurrentView()` — filters by selected story or returns all
  - [ ] 1.5 Implement computed selector: `getAgentsForFile(filePath: string)` — returns agent IDs using a file

- [ ] Task 2: Create context types (AC: #1, #4)
  - [ ] 2.1 Create `src/renderer/src/features/context/context.types.ts`
  - [ ] 2.2 Define `ContextFile` type: `path`, `name`, `extension`, `relativePath`, `agentIds: string[]`, `isModified: boolean`, `lastModified: number`
  - [ ] 2.3 Define `ContextFileCardProps` type

- [ ] Task 3: Create ContextFileCard component (AC: #1, #4)
  - [ ] 3.1 Create `src/renderer/src/features/context/components/ContextFileCard.tsx`
  - [ ] 3.2 Implement file type icon based on extension (`.ts`, `.md`, `.yaml`, `.json`, etc.)
  - [ ] 3.3 Implement agent badges — colored pill badges showing agent name/id for each agent using the file
  - [ ] 3.4 Implement "Modifié" badge — yellow/orange badge visible when `isModified` is true
  - [ ] 3.5 Display file name (bold) + relative path (muted text)
  - [ ] 3.6 Add `draggable="true"` attribute and `data-file-path` for drag-and-drop (Story 3.3)
  - [ ] 3.7 Animate entry with `slide-in 150ms` (respect `prefers-reduced-motion`)
  - [ ] 3.8 Create `src/renderer/src/features/context/components/ContextFileCard.test.tsx`

- [ ] Task 4: Create ContextPanel component (AC: #1, #2, #3)
  - [ ] 4.1 Create `src/renderer/src/features/context/components/ContextPanel.tsx`
  - [ ] 4.2 Implement header with title "Contexte" + file count badge
  - [ ] 4.3 Implement ScrollArea containing list of `ContextFileCard`
  - [ ] 4.4 Implement empty state: illustration + "Aucun fichier de contexte" + action hint
  - [ ] 4.5 Implement story-level filtering via navigation store subscription
  - [ ] 4.6 Create `src/renderer/src/features/context/components/ContextPanel.test.tsx`

- [ ] Task 5: Create useContextFiles hook (AC: #2, #4)
  - [ ] 5.1 Create `src/renderer/src/features/context/hooks/useContextFiles.ts`
  - [ ] 5.2 Subscribe to `stream:file-change` via `useIpcStream` — update store on file modification
  - [ ] 5.3 Mark files as modified when `stream:file-change` arrives for a tracked file
  - [ ] 5.4 Listen to navigation store changes — re-filter context files when story selection changes
  - [ ] 5.5 Create `src/renderer/src/features/context/hooks/useContextFiles.test.ts`

- [ ] Task 6: Create file type icon utility (AC: #1)
  - [ ] 6.1 Create `src/renderer/src/features/context/utils/file-icons.ts`
  - [ ] 6.2 Map common extensions to icons: `.ts`/`.tsx` -> TypeScript icon, `.md` -> Markdown, `.yaml`/`.yml` -> YAML, `.json` -> JSON, `.css` -> CSS, default -> generic file
  - [ ] 6.3 Use Lucide icons (bundled with shadcn/ui) or simple SVG icons

- [ ] Task 7: Create barrel export (AC: #1)
  - [ ] 7.1 Create `src/renderer/src/features/context/index.ts` — re-export `ContextPanel`, `ContextFileCard`, `useContextFiles`, `useContextStore`

- [ ] Task 8: Integrate into layout (AC: #1, #3)
  - [ ] 8.1 Import `ContextPanel` in the left pane of `ThreePaneLayout` (Story 1.2)
  - [ ] 8.2 Wire navigation store subscription for story-level filtering
  - [ ] 8.3 Verify panel renders with mock data and responds to navigation changes

## Dev Notes

### FRs Covered

- **FR9** — L'utilisateur peut voir la liste des fichiers de contexte que chaque agent consulte, mise à jour en continu
- **FR10** — L'utilisateur peut ajouter un fichier de contexte à un agent (drag & drop ou sélection) — partially (draggable attribute set, full D&D in Story 3.3)
- **FR12** — L'utilisateur peut voir les fichiers de contexte sous forme de cards visuelles avec badges indiquant quel agent les utilise
- **FR42** — Le système peut attribuer une modification de fichier à l'agent qui l'a produite (consumed from Story 3.1)

### Dependencies on Previous Stories

- **Story 1.1** — IPC bridge, event bus hooks (`useIpcStream`), shared types, `AppError`
- **Story 1.2** — `ThreePaneLayout` with left pane slot for `ContextPanel`
- **Story 1.4** — Navigation store (`navigation.store.ts`) for story-level filtering
- **Story 3.1** — `FileWatcherService` emitting `stream:file-change`, `EventCorrelator` providing `agentId`

### Feature Structure

```
src/renderer/src/features/context/
├── components/
│   ├── ContextFileCard.tsx         # Visual file card with badges
│   ├── ContextFileCard.test.tsx
│   ├── ContextPanel.tsx            # Left pane content — list of cards
│   ├── ContextPanel.test.tsx
│   └── ContextDragDrop.tsx         # (Story 3.3)
├── hooks/
│   ├── useContextFiles.ts          # Stream subscription + store sync
│   └── useContextFiles.test.ts
├── utils/
│   └── file-icons.ts               # Extension -> icon mapping
├── context.store.ts                # Zustand store
├── context.types.ts                # Types
└── index.ts                        # Barrel export
```

[Source: architecture.md#Frontend-Component-Architecture]

### Context Store Pattern

```typescript
// src/renderer/src/features/context/context.store.ts
import { create } from 'zustand';
import type { ContextFile } from './context.types';

type ContextState = {
  files: Map<string, ContextFile>;
  selectedStoryFilter: string | null;

  addFile: (file: ContextFile) => void;
  removeFile: (path: string) => void;
  updateFileStatus: (path: string, updates: Partial<ContextFile>) => void;
  setAgentFiles: (agentId: string, filePaths: string[]) => void;
  removeAgentFromFiles: (agentId: string) => void;
  setStoryFilter: (storyId: string | null) => void;
  markFileModified: (path: string, agentId?: string) => void;
};

export const useContextStore = create<ContextState>((set, get) => ({
  files: new Map(),
  selectedStoryFilter: null,

  addFile: (file) =>
    set((state) => {
      const next = new Map(state.files);
      next.set(file.path, file);
      return { files: next };
    }),

  removeFile: (path) =>
    set((state) => {
      const next = new Map(state.files);
      next.delete(path);
      return { files: next };
    }),

  updateFileStatus: (path, updates) =>
    set((state) => {
      const next = new Map(state.files);
      const existing = next.get(path);
      if (existing) {
        next.set(path, { ...existing, ...updates });
      }
      return { files: next };
    }),

  setAgentFiles: (agentId, filePaths) =>
    set((state) => {
      const next = new Map(state.files);
      for (const [path, file] of next) {
        // Remove agent from files no longer in the list
        if (!filePaths.includes(path) && file.agentIds.includes(agentId)) {
          next.set(path, {
            ...file,
            agentIds: file.agentIds.filter((id) => id !== agentId),
          });
        }
      }
      // Add agent to new files
      for (const filePath of filePaths) {
        const existing = next.get(filePath);
        if (existing && !existing.agentIds.includes(agentId)) {
          next.set(filePath, {
            ...existing,
            agentIds: [...existing.agentIds, agentId],
          });
        }
      }
      return { files: next };
    }),

  removeAgentFromFiles: (agentId) =>
    set((state) => {
      const next = new Map(state.files);
      for (const [path, file] of next) {
        if (file.agentIds.includes(agentId)) {
          next.set(path, {
            ...file,
            agentIds: file.agentIds.filter((id) => id !== agentId),
          });
        }
      }
      return { files: next };
    }),

  setStoryFilter: (storyId) => set({ selectedStoryFilter: storyId }),

  markFileModified: (path, agentId) =>
    set((state) => {
      const next = new Map(state.files);
      const existing = next.get(path);
      if (existing) {
        next.set(path, {
          ...existing,
          isModified: true,
          lastModified: Date.now(),
          lastModifiedBy: agentId,
        });
      }
      return { files: next };
    }),
}));
```

[Source: architecture.md#Communication-Patterns — Zustand Store pattern]

### ContextFileCard Component Pattern

```tsx
// src/renderer/src/features/context/components/ContextFileCard.tsx
import { Badge } from '@renderer/shared/components/Badge';
import { getFileIcon } from '../utils/file-icons';
import type { ContextFile } from '../context.types';

type ContextFileCardProps = {
  file: ContextFile;
  onRemoveFromAgent?: (agentId: string) => void;
};

export function ContextFileCard({ file, onRemoveFromAgent }: ContextFileCardProps) {
  const FileIcon = getFileIcon(file.extension);

  return (
    <div
      className="group flex items-center gap-3 rounded-lg bg-bg-surface p-3
                 border border-border-default hover:border-border-active
                 transition-colors duration-150
                 motion-safe:animate-slide-in"
      draggable="true"
      data-file-path={file.path}
      role="listitem"
      aria-label={`Fichier ${file.name}, utilisé par ${file.agentIds.length} agent(s)`}
    >
      <FileIcon className="h-5 w-5 shrink-0 text-text-muted" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-text-primary">
          {file.name}
        </p>
        <p className="truncate text-sm text-text-muted">
          {file.relativePath}
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {file.isModified && (
          <Badge variant="warning" size="sm">
            Modifié
          </Badge>
        )}
        {file.agentIds.map((agentId) => (
          <Badge key={agentId} variant="agent" size="sm">
            {agentId}
          </Badge>
        ))}
      </div>
    </div>
  );
}
```

[Source: ux-design-specification.md#Custom-Components — ContextFileCard]
[Source: ux-design-specification.md#Real-Time-Update-Patterns — slide-in 150ms]

### ContextPanel Component Pattern

```tsx
// src/renderer/src/features/context/components/ContextPanel.tsx
import { ScrollArea } from '@renderer/shared/components/ScrollArea';
import { ContextFileCard } from './ContextFileCard';
import { useContextFiles } from '../hooks/useContextFiles';
import { useContextStore } from '../context.store';
import { useShallow } from 'zustand/react/shallow';

export function ContextPanel() {
  useContextFiles(); // Subscribe to streams

  const files = useContextStore(
    useShallow((state) => Array.from(state.files.values())),
  );

  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-text-muted">
        <FileIcon className="h-12 w-12" />
        <p className="text-base">Aucun fichier de contexte</p>
        <p className="text-sm">
          Les fichiers apparaîtront ici quand un agent les consultera
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <h2 className="text-lg font-semibold text-text-primary">Contexte</h2>
        <Badge variant="secondary">{files.length}</Badge>
      </div>

      <ScrollArea className="flex-1">
        <div
          className="flex flex-col gap-2 p-3"
          role="list"
          aria-label="Fichiers de contexte"
        >
          {files.map((file) => (
            <ContextFileCard key={file.path} file={file} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

[Source: ux-design-specification.md#Empty-States-Loading]
[Source: ux-design-specification.md#Accessibility-Strategy — ARIA, keyboard]

### useContextFiles Hook Pattern

```typescript
// src/renderer/src/features/context/hooks/useContextFiles.ts
import { useCallback } from 'react';
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream';
import { useContextStore } from '../context.store';

export function useContextFiles(): void {
  const markFileModified = useContextStore((s) => s.markFileModified);

  const handleFileChange = useCallback(
    (data: { path: string; type: string; agentId?: string }) => {
      if (data.type === 'modify') {
        markFileModified(data.path, data.agentId);
      }
    },
    [markFileModified],
  );

  useIpcStream('stream:file-change', handleFileChange);
}
```

[Source: architecture.md#Communication-Patterns — Hook IPC standard]

### Animation CSS

```css
/* In app.css or component-level */
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in {
  animation: slide-in 150ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .animate-slide-in {
    animation: none;
  }
}
```

[Source: ux-design-specification.md#Real-Time-Update-Patterns — Slide-in + fade 150ms]

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Store | camelCase + `.store.ts` | `context.store.ts` |
| Store hook | `use` + PascalCase + `Store` | `useContextStore` |
| Component | PascalCase.tsx | `ContextFileCard.tsx`, `ContextPanel.tsx` |
| Hook | camelCase, prefix `use` | `useContextFiles.ts` |
| Types | kebab-case + `.types.ts` | `context.types.ts` |
| Utility | kebab-case | `file-icons.ts` |
| Barrel | `index.ts` | re-exports public API |

[Source: architecture.md#Naming-Patterns]

### Testing Strategy

**Unit tests:**
- `ContextFileCard.test.tsx` — Renders file name, relative path, agent badges, "Modifié" badge. Verifies `draggable` attribute. Verifies ARIA label.
- `ContextPanel.test.tsx` — Renders list of cards from store. Renders empty state when no files. Renders file count badge.
- `useContextFiles.test.ts` — Verifies `stream:file-change` handler updates store. Verifies modified flag set correctly.

**Integration tests:**
- Store subscription: add file to store -> card appears in panel
- Stream reception: `stream:file-change` -> file marked as modified -> badge appears
- Story filter: change navigation store story -> context panel filters

**Accessibility tests:**
- `role="list"` and `role="listitem"` present
- `aria-label` on cards with meaningful description
- Keyboard focusable cards
- Agent badges are descriptive (not just color)

### What NOT to Do

- Do NOT use `any` for store state or component props — type everything
- Do NOT use `export default` — named exports only
- Do NOT put the store outside the feature folder — keep `context.store.ts` co-located
- Do NOT import from other features directly — use shared stores or event bus for cross-feature communication
- Do NOT hard-code file icons — use the utility mapper
- Do NOT forget `prefers-reduced-motion` — all animations must be conditional
- Do NOT forget the empty state — jamais d'écran blanc
- Do NOT make badges color-only — always include text label for accessibility
- Do NOT use `useEffect` for stream subscriptions when `useIpcStream` hook exists

### References

- [Source: architecture.md#Frontend-Component-Architecture] — Feature structure
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, useIpcStream
- [Source: architecture.md#Naming-Patterns] — All naming conventions
- [Source: architecture.md#IPC-Channel-Design] — `stream:file-change` definition
- [Source: ux-design-specification.md#Custom-Components] — ContextFileCard spec
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Animations
- [Source: ux-design-specification.md#Empty-States-Loading] — Empty state patterns
- [Source: ux-design-specification.md#Accessibility-Strategy] — ARIA, keyboard, contrast
- [Source: ux-design-specification.md#Color-System] — Design tokens
- [Source: epics.md#Story-3.2] — Acceptance criteria source
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — IPC hooks, event bus patterns

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
