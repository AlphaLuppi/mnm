# Story 3.5: Historique Git & Versioning de Contexte

Status: ready-for-dev

## Story

As a **user**,
I want **to see Git history for project files and view context as it was at a given commit**,
So that **I can understand how context evolved over time**.

## Acceptance Criteria

### AC1 — Git history for a context file

**Given** un projet Git est ouvert
**When** je sélectionne un fichier de contexte
**Then** je peux voir son historique Git : liste des commits avec date, auteur, message (FR43)

### AC2 — View file at a specific commit

**Given** l'historique d'un fichier est affiché
**When** je clique sur un commit
**Then** je vois le contenu du fichier tel qu'il était à ce commit (FR44)
**And** la vue utilise `git:show-file` IPC pour récupérer la version

### AC3 — Diff between versions

**Given** je suis sur une vue historique d'un fichier
**When** je compare avec la version actuelle
**Then** un diff visuel montre les changements entre les deux versions

## Tasks / Subtasks

- [ ] Task 1: Create Git history types (AC: #1, #2, #3)
  - [ ] 1.1 Create `src/renderer/src/features/context/git-history.types.ts`
  - [ ] 1.2 Define `FileHistoryEntry`: `hash`, `date`, `author`, `message`, `isSelected`
  - [ ] 1.3 Define `FileVersionView`: `content`, `commitHash`, `commitDate`, `commitMessage`
  - [ ] 1.4 Define `FileDiffView`: `additions`, `deletions`, `hunks` (or raw diff string for simple rendering)

- [ ] Task 2: Create useFileHistory hook (AC: #1)
  - [ ] 2.1 Create `src/renderer/src/features/context/hooks/useFileHistory.ts`
  - [ ] 2.2 Implement `useFileHistory(filePath: string)` — calls `git:log` IPC with file path filter (via a new `git:file-history` channel or extend `git:log` with file filter)
  - [ ] 2.3 Return `AsyncState<FileHistoryEntry[]>` — idle, loading, success, error
  - [ ] 2.4 Create `src/renderer/src/features/context/hooks/useFileHistory.test.ts`

- [ ] Task 3: Create useFileVersion hook (AC: #2)
  - [ ] 3.1 Create `src/renderer/src/features/context/hooks/useFileVersion.ts`
  - [ ] 3.2 Implement `useFileVersion(filePath: string, commitHash: string)` — calls `git:show-file` IPC
  - [ ] 3.3 Return `AsyncState<string>` (file content at commit)
  - [ ] 3.4 Create `src/renderer/src/features/context/hooks/useFileVersion.test.ts`

- [ ] Task 4: Create FileHistoryPanel component (AC: #1)
  - [ ] 4.1 Create `src/renderer/src/features/context/components/FileHistoryPanel.tsx`
  - [ ] 4.2 Display commit list: each entry shows hash (abbreviated 7 chars), date (relative format), author, message (truncated)
  - [ ] 4.3 Highlight selected commit with accent border
  - [ ] 4.4 Loading state: skeleton placeholders for commit list
  - [ ] 4.5 Empty state: "Aucun historique Git disponible" message
  - [ ] 4.6 Error state: inline error message with "Réessayer" button
  - [ ] 4.7 Create `src/renderer/src/features/context/components/FileHistoryPanel.test.tsx`

- [ ] Task 5: Create FileVersionViewer component (AC: #2)
  - [ ] 5.1 Create `src/renderer/src/features/context/components/FileVersionViewer.tsx`
  - [ ] 5.2 Display file content at selected commit with syntax highlighting (monospace, line numbers)
  - [ ] 5.3 Show header: commit hash + date + author + message
  - [ ] 5.4 Loading state: skeleton for content area
  - [ ] 5.5 Add "Comparer avec l'actuel" button to trigger diff view
  - [ ] 5.6 Create `src/renderer/src/features/context/components/FileVersionViewer.test.tsx`

- [ ] Task 6: Create FileDiffViewer component (AC: #3)
  - [ ] 6.1 Create `src/renderer/src/features/context/components/FileDiffViewer.tsx`
  - [ ] 6.2 Implement split-view or unified diff display:
    - Green background for additions (`bg-status-green/10`)
    - Red background for deletions (`bg-status-red/10`)
    - Line numbers on both sides
  - [ ] 6.3 Show diff header: "Commit abc1234 vs Actuel"
  - [ ] 6.4 Parse raw diff string into renderable hunks (simple line-by-line parser)
  - [ ] 6.5 Loading state: skeleton for diff area
  - [ ] 6.6 Create `src/renderer/src/features/context/components/FileDiffViewer.test.tsx`

- [ ] Task 7: Add IPC handler for file-specific history (AC: #1)
  - [ ] 7.1 Add `git:file-history` IPC channel in `src/shared/ipc-channels.ts`: `{ args: { filePath: string; count: number }; result: GitLogEntry[] }`
  - [ ] 7.2 Implement handler in `src/main/ipc/handlers.ts` — delegates to `GitService.getFileHistory()`
  - [ ] 7.3 Add `git:file-diff` IPC channel: `{ args: { filePath: string; commitA: string; commitB: string }; result: string }` (raw diff)
  - [ ] 7.4 Implement handler — delegates to `GitService.getFileDiff()`

- [ ] Task 8: Create context versioning timeline (AC: #1, #2, #3)
  - [ ] 8.1 Create `src/renderer/src/features/context/components/ContextVersionTimeline.tsx`
  - [ ] 8.2 Display a vertical timeline of commits for the selected file
  - [ ] 8.3 Each timeline node: commit dot (colored by author), abbreviated hash, relative date, message
  - [ ] 8.4 Clicking a node: loads file version (AC2) or triggers diff (AC3)
  - [ ] 8.5 Current version at the top, oldest at the bottom

- [ ] Task 9: Integrate into ContextFileCard (AC: #1)
  - [ ] 9.1 Add "Historique" button/icon to `ContextFileCard` — opens file history in a side panel or drawer
  - [ ] 9.2 Wire button click to open `FileHistoryPanel` with the file's path
  - [ ] 9.3 Panel opens as a drawer/overlay in the context pane (does not replace the file list)

- [ ] Task 10: Wire diff view for version comparison (AC: #3)
  - [ ] 10.1 In `FileVersionViewer`, "Comparer avec l'actuel" triggers `git:file-diff` IPC with `commitA = selectedHash`, `commitB = 'HEAD'`
  - [ ] 10.2 Display `FileDiffViewer` with the returned diff
  - [ ] 10.3 Add toggle to switch between version view and diff view

## Dev Notes

### FRs Covered

- **FR43** — L'utilisateur peut voir l'historique Git du projet et des fichiers de contexte
- **FR44** — L'utilisateur peut voir le contexte tel qu'il était à un commit donné (versioning de contexte via Git)
- **FR47** — Le système peut lire l'historique Git du projet (commits, branches, diffs) sans nécessiter de privilèges élevés

### Dependencies on Previous Stories

- **Story 1.1** — IPC bridge, preload API, `AsyncState<T>`, `AppError`, shared hooks
- **Story 3.1** — `GitService` with `getFileHistory()`, `showFile()`, `getFileDiff()` methods; `git:log`, `git:show-file` IPC handlers
- **Story 3.2** — `ContextFileCard` component (entry point to history), `context.store.ts`

### Feature Structure Addition

```
src/renderer/src/features/context/
├── components/
│   ├── ContextFileCard.tsx           # (Story 3.2, updated here)
│   ├── ContextPanel.tsx              # (Story 3.2)
│   ├── ContextDragDrop.tsx           # (Story 3.3)
│   ├── FileHistoryPanel.tsx          # NEW — commit list for a file
│   ├── FileHistoryPanel.test.tsx
│   ├── FileVersionViewer.tsx         # NEW — file content at commit
│   ├── FileVersionViewer.test.tsx
│   ├── FileDiffViewer.tsx            # NEW — diff between versions
│   ├── FileDiffViewer.test.tsx
│   ├── ContextVersionTimeline.tsx    # NEW — vertical timeline of commits
│   └── FileChangeToast.tsx           # (Story 3.4)
├── hooks/
│   ├── useContextFiles.ts            # (Story 3.2)
│   ├── useFileNotifications.ts       # (Story 3.4)
│   ├── useFileHistory.ts             # NEW — fetch file git history
│   ├── useFileHistory.test.ts
│   ├── useFileVersion.ts             # NEW — fetch file at commit
│   └── useFileVersion.test.ts
├── utils/
│   └── diff-parser.ts               # NEW — parse raw diff to renderable hunks
├── git-history.types.ts              # NEW — types for history/version/diff
├── context.store.ts                  # (Story 3.2)
├── context.types.ts                  # (Story 3.2)
└── index.ts
```

### IPC Channels to Add

```typescript
// Add to src/shared/ipc-channels.ts — IpcInvokeChannels
'git:file-history': {
  args: { filePath: string; count: number };
  result: GitLogEntry[];
};
'git:file-diff': {
  args: { filePath: string; commitA: string; commitB: string };
  result: string;
};
```

Note: `git:show-file` is already declared in Story 1.1 and implemented in Story 3.1.

[Source: architecture.md#IPC-Channel-Design — git:show-file]

### FileHistoryPanel Component Pattern

```tsx
// src/renderer/src/features/context/components/FileHistoryPanel.tsx
import { ScrollArea } from '@renderer/shared/components/ScrollArea';
import { useFileHistory } from '../hooks/useFileHistory';
import type { FileHistoryEntry } from '../git-history.types';

type FileHistoryPanelProps = {
  filePath: string;
  onSelectCommit: (hash: string) => void;
  selectedHash: string | null;
};

export function FileHistoryPanel({
  filePath,
  onSelectCommit,
  selectedHash,
}: FileHistoryPanelProps) {
  const historyState = useFileHistory(filePath);

  if (historyState.status === 'loading') {
    return <HistorySkeleton />;
  }

  if (historyState.status === 'error') {
    return (
      <div className="p-4 text-text-muted">
        <p>Erreur lors du chargement de l'historique</p>
        <p className="text-sm text-status-red">{historyState.error.message}</p>
        <Button variant="ghost" size="sm" onClick={() => { /* retry */ }}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (historyState.status === 'success' && historyState.data.length === 0) {
    return (
      <div className="p-4 text-text-muted">
        Aucun historique Git disponible
      </div>
    );
  }

  if (historyState.status !== 'success') return null;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 p-3" role="list" aria-label="Historique Git">
        {historyState.data.map((entry) => (
          <button
            key={entry.hash}
            onClick={() => onSelectCommit(entry.hash)}
            className={`flex flex-col gap-1 rounded-md p-3 text-left transition-colors
              ${selectedHash === entry.hash
                ? 'border border-accent bg-bg-elevated'
                : 'border border-transparent hover:bg-bg-elevated'
              }`}
            role="listitem"
            aria-selected={selectedHash === entry.hash}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-accent">
                {entry.hash.slice(0, 7)}
              </span>
              <span className="text-xs text-text-muted">
                {formatRelativeDate(entry.date)}
              </span>
            </div>
            <p className="truncate text-sm text-text-primary">
              {entry.message}
            </p>
            <p className="text-xs text-text-muted">{entry.author}</p>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
```

[Source: ux-design-specification.md#Empty-States-Loading — Skeleton, error, empty patterns]

### useFileHistory Hook Pattern

```typescript
// src/renderer/src/features/context/hooks/useFileHistory.ts
import { useState, useEffect } from 'react';
import type { AsyncState } from '@shared/types/async-state.types';
import type { FileHistoryEntry } from '../git-history.types';
import type { AppError } from '@shared/types/error.types';

export function useFileHistory(
  filePath: string,
  count: number = 20,
): AsyncState<FileHistoryEntry[]> {
  const [state, setState] = useState<AsyncState<FileHistoryEntry[]>>({
    status: 'idle',
  });

  useEffect(() => {
    if (!filePath) return;

    setState({ status: 'loading' });

    window.electronAPI
      .invoke('git:file-history', { filePath, count })
      .then((data) => {
        setState({ status: 'success', data });
      })
      .catch((error: AppError) => {
        setState({ status: 'error', error });
      });
  }, [filePath, count]);

  return state;
}
```

[Source: architecture.md#Process-Patterns — AsyncState<T> pattern]

### useFileVersion Hook Pattern

```typescript
// src/renderer/src/features/context/hooks/useFileVersion.ts
import { useState, useEffect } from 'react';
import type { AsyncState } from '@shared/types/async-state.types';
import type { AppError } from '@shared/types/error.types';

export function useFileVersion(
  filePath: string,
  commitHash: string | null,
): AsyncState<string> {
  const [state, setState] = useState<AsyncState<string>>({
    status: 'idle',
  });

  useEffect(() => {
    if (!filePath || !commitHash) {
      setState({ status: 'idle' });
      return;
    }

    setState({ status: 'loading' });

    window.electronAPI
      .invoke('git:show-file', { path: filePath, commitHash })
      .then((content) => {
        setState({ status: 'success', data: content });
      })
      .catch((error: AppError) => {
        setState({ status: 'error', error });
      });
  }, [filePath, commitHash]);

  return state;
}
```

### FileDiffViewer Component Pattern

```tsx
// src/renderer/src/features/context/components/FileDiffViewer.tsx
import { parseDiffHunks } from '../utils/diff-parser';

type FileDiffViewerProps = {
  diff: string;
  commitA: string;
  commitB: string;
};

export function FileDiffViewer({
  diff,
  commitA,
  commitB,
}: FileDiffViewerProps) {
  const hunks = parseDiffHunks(diff);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted">
        <span className="font-mono text-xs">{commitA.slice(0, 7)}</span>
        <span>vs</span>
        <span className="font-mono text-xs">{commitB === 'HEAD' ? 'Actuel' : commitB.slice(0, 7)}</span>
      </div>

      <div className="overflow-auto rounded-md border border-border-default bg-bg-base font-mono text-sm">
        {hunks.map((hunk, i) => (
          <div key={i}>
            <div className="bg-bg-elevated px-4 py-1 text-xs text-text-muted">
              {hunk.header}
            </div>
            {hunk.lines.map((line, j) => (
              <div
                key={j}
                className={`px-4 py-0.5 ${getDiffLineClass(line.type)}`}
              >
                <span className="mr-3 inline-block w-8 text-right text-text-muted">
                  {line.lineNumber ?? ''}
                </span>
                <span className="mr-2 text-text-muted">{line.prefix}</span>
                {line.content}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function getDiffLineClass(type: 'addition' | 'deletion' | 'context'): string {
  switch (type) {
    case 'addition':
      return 'bg-status-green/10 text-status-green';
    case 'deletion':
      return 'bg-status-red/10 text-status-red';
    case 'context':
      return 'text-text-secondary';
  }
}
```

### Diff Parser Utility

```typescript
// src/renderer/src/features/context/utils/diff-parser.ts
type DiffLine = {
  type: 'addition' | 'deletion' | 'context';
  content: string;
  prefix: string;
  lineNumber: number | null;
};

type DiffHunk = {
  header: string;
  lines: DiffLine[];
};

export function parseDiffHunks(rawDiff: string): DiffHunk[] {
  const lines = rawDiff.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let lineCounter = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      currentHunk = { header: line, lines: [] };
      hunks.push(currentHunk);
      // Parse line number from @@ -a,b +c,d @@
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      lineCounter = match ? parseInt(match[1], 10) : 0;
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('+')) {
      currentHunk.lines.push({
        type: 'addition',
        content: line.slice(1),
        prefix: '+',
        lineNumber: lineCounter++,
      });
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({
        type: 'deletion',
        content: line.slice(1),
        prefix: '-',
        lineNumber: null,
      });
    } else {
      currentHunk.lines.push({
        type: 'context',
        content: line.startsWith(' ') ? line.slice(1) : line,
        prefix: ' ',
        lineNumber: lineCounter++,
      });
    }
  }

  return hunks;
}
```

### Context Versioning Timeline Pattern

```tsx
// src/renderer/src/features/context/components/ContextVersionTimeline.tsx
import type { FileHistoryEntry } from '../git-history.types';

type ContextVersionTimelineProps = {
  entries: FileHistoryEntry[];
  selectedHash: string | null;
  onSelectCommit: (hash: string) => void;
  onCompareWithCurrent: (hash: string) => void;
};

export function ContextVersionTimeline({
  entries,
  selectedHash,
  onSelectCommit,
  onCompareWithCurrent,
}: ContextVersionTimelineProps) {
  return (
    <div className="relative pl-6" role="list" aria-label="Timeline de versioning">
      {/* Vertical line */}
      <div className="absolute left-3 top-0 h-full w-px bg-border-default" />

      {entries.map((entry, index) => (
        <div key={entry.hash} className="relative mb-4" role="listitem">
          {/* Timeline dot */}
          <div
            className={`absolute -left-3 top-2 h-3 w-3 rounded-full border-2
              ${selectedHash === entry.hash
                ? 'border-accent bg-accent'
                : 'border-border-active bg-bg-surface'
              }`}
          />

          <button
            onClick={() => onSelectCommit(entry.hash)}
            className="block w-full rounded-md p-2 text-left hover:bg-bg-elevated"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-accent">
                {entry.hash.slice(0, 7)}
              </span>
              {index === 0 && (
                <span className="text-xs font-medium text-status-green">
                  dernier
                </span>
              )}
            </div>
            <p className="truncate text-sm text-text-primary">
              {entry.message}
            </p>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>{entry.author}</span>
              <span>{formatRelativeDate(entry.date)}</span>
            </div>
          </button>

          {selectedHash === entry.hash && (
            <button
              onClick={() => onCompareWithCurrent(entry.hash)}
              className="mt-1 text-xs text-accent hover:underline"
            >
              Comparer avec l'actuel
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### File History Integration in ContextFileCard

```tsx
// Add to ContextFileCard (Story 3.2) — "Historique" button
<button
  onClick={() => onShowHistory(file.path)}
  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-text-muted hover:text-accent"
  aria-label={`Voir l'historique Git de ${file.name}`}
>
  Historique
</button>
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Component | PascalCase.tsx | `FileHistoryPanel.tsx`, `FileDiffViewer.tsx` |
| Hook | camelCase, prefix `use` | `useFileHistory.ts`, `useFileVersion.ts` |
| Types file | kebab-case + `.types.ts` | `git-history.types.ts` |
| Utility | kebab-case | `diff-parser.ts` |
| IPC channel | namespace:action | `git:file-history`, `git:file-diff`, `git:show-file` |
| Test file | same name + `.test.ts(x)` | `FileHistoryPanel.test.tsx` |

[Source: architecture.md#Naming-Patterns]

### Testing Strategy

**Unit tests:**
- `FileHistoryPanel.test.tsx` — Renders commit list correctly. Shows skeleton during loading. Shows empty state. Shows error with retry button. Highlights selected commit.
- `FileVersionViewer.test.tsx` — Renders file content. Shows commit metadata header. Loading skeleton. "Comparer" button triggers diff.
- `FileDiffViewer.test.tsx` — Renders additions in green, deletions in red. Renders line numbers. Handles empty diff.
- `useFileHistory.test.ts` — Returns loading then success. Returns error on failure. Re-fetches on filePath change.
- `useFileVersion.test.ts` — Returns loading then content. Returns idle when commitHash is null. Returns error on failure.
- `diff-parser.ts` — Parses unified diff format correctly. Handles multiple hunks. Handles additions-only and deletions-only diffs.

**Integration tests:**
- Full flow: select file -> load history -> select commit -> view version -> compare with current -> see diff
- Error handling: git service fails -> error state displayed -> retry loads correctly

**Accessibility tests:**
- `role="list"` and `role="listitem"` on commit list and timeline
- `aria-selected` on selected commit
- `aria-label` on history button in ContextFileCard
- Keyboard navigation: arrow keys in commit list, Enter to select
- Diff colors combined with `+`/`-` prefix (not color-only)

### What NOT to Do

- Do NOT import `simple-git` in the renderer — all git operations go through IPC to the main process
- Do NOT cache file versions in the renderer store — fetch on demand, git is fast enough for single files
- Do NOT implement a full-featured diff editor (like Monaco diff) — a simple line-by-line diff viewer is sufficient for MVP
- Do NOT use `any` for diff parsing — type the parsed structures
- Do NOT use `export default` — named exports only
- Do NOT use synchronous IPC calls — always async with `AsyncState<T>`
- Do NOT forget loading states — skeletons for commit list and file content, never blank screens
- Do NOT make diff colors the only indicator — always include `+`/`-` prefix for accessibility
- Do NOT hard-code commit count — pass as parameter with sensible default (20)
- Do NOT forget to handle the case where a file doesn't exist at a given commit (deleted file)

### References

- [Source: architecture.md#IPC-Channel-Design] — `git:show-file`, `git:log` channels
- [Source: architecture.md#Process-Patterns] — AsyncState<T> pattern, error handling
- [Source: architecture.md#Frontend-Component-Architecture] — Feature folder structure
- [Source: architecture.md#Naming-Patterns] — All naming conventions
- [Source: ux-design-specification.md#Empty-States-Loading] — Skeleton, error, empty patterns
- [Source: ux-design-specification.md#Color-System] — Status colors for diff (green/red)
- [Source: ux-design-specification.md#Typography-System] — JetBrains Mono for code/diffs
- [Source: ux-design-specification.md#Accessibility-Strategy] — Color not sole indicator
- [Source: epics.md#Story-3.5] — Acceptance criteria source
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — IPC patterns, AsyncState

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
