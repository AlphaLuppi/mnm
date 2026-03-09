# Story 5.3: Stories Progress Widget

Status: ready-for-dev

## Story

As a **user**,
I want **to see stories in progress with their completion ratio in the cockpit**,
So that **I know where the project stands without digging into files**.

## Acceptance Criteria

### AC1 — StoriesProgress widget displays stories with progress bars

**Given** le cockpit est affiche et un projet BMAD est charge
**When** des stories existent dans les fichiers Markdown BMAD
**Then** le widget `StoriesProgress` affiche : liste des stories en cours, mini progress bar par story, ratio taches completees / totales (FR23)
**And** les taches sont parsees depuis les checkboxes Markdown (`- [ ]` / `- [x]`) via `story-parser.ts`

### AC2 — Completed stories marked as Done

**Given** une story a toutes ses taches completees
**When** le ratio atteint 100%
**Then** la progress bar passe en vert solide et la story est marquee "Done"

### AC3 — Auto-refresh on file changes

**Given** les fichiers de stories sont modifies
**When** le file watcher detecte un changement
**Then** le widget se met a jour automatiquement (ratios recalcules)

## Tasks / Subtasks

- [ ] Task 1: Implement story-parser.ts in main process (AC: #1)
  - [ ] 1.1 Create `src/main/services/project/story-parser.ts` — parses BMAD Markdown story files, extracts task checkboxes
  - [ ] 1.2 Implement `parseStoryFile(filePath: string): StoryProgress` — reads a single story file, counts `- [ ]` and `- [x]` patterns
  - [ ] 1.3 Implement `parseAllStories(projectPath: string): StoryProgress[]` — scans `_bmad-output/` for story files, parses each
  - [ ] 1.4 Handle edge cases: no tasks in file, malformed markdown, nested checkboxes, files without checkboxes
  - [ ] 1.5 Create `src/main/services/project/story-parser.test.ts` — test parsing with various markdown formats

- [ ] Task 2: Implement stories:list IPC handler (AC: #1)
  - [ ] 2.1 Add handler for `stories:list` in `src/main/ipc/handlers.ts` — calls `parseAllStories()` and returns `StoryProgress[]`
  - [ ] 2.2 Wrap handler in try/catch with `AppError` normalization (code: `STORIES_PARSE_FAILED`)
  - [ ] 2.3 Verify IPC type in `src/shared/ipc-channels.ts` — `'stories:list': { args: void; result: StoryProgress[] }`

- [ ] Task 3: Create StoryProgress shared type (AC: #1)
  - [ ] 3.1 Create `src/shared/types/story.types.ts` with `StoryProgress` type (if not already created by scaffold)
  - [ ] 3.2 Ensure type includes: `id`, `title`, `epicTitle`, `filePath`, `tasksTotal`, `tasksCompleted`, `ratio`

- [ ] Task 4: Implement useStoriesProgress hook (AC: #1, #3)
  - [ ] 4.1 Create `src/renderer/src/features/dashboard/hooks/useStoriesProgress.ts` — calls `stories:list` IPC on mount
  - [ ] 4.2 Return `AsyncState<StoryProgress[]>` for loading/error states
  - [ ] 4.3 Subscribe to `stream:file-change` — re-fetch stories when a story file changes (filter by `_bmad-output/` path)
  - [ ] 4.4 Debounce re-fetch (300ms) to avoid rapid-fire updates during bulk file changes
  - [ ] 4.5 Create `src/renderer/src/features/dashboard/hooks/useStoriesProgress.test.ts` — test loading, success, error, re-fetch on file change

- [ ] Task 5: Implement StoriesProgress component (AC: #1, #2)
  - [ ] 5.1 Create `src/renderer/src/features/dashboard/components/StoriesProgress.tsx` — widget displaying story list with progress bars
  - [ ] 5.2 Group stories by epic (collapsible sections with epic title)
  - [ ] 5.3 Render per-story row: story title + mini progress bar + ratio text ("3/7")
  - [ ] 5.4 Implement 100% completed state: green solid bar + "Done" badge
  - [ ] 5.5 Implement 0% state: empty bar + "0/N" text
  - [ ] 5.6 Implement loading state: skeleton placeholder bars
  - [ ] 5.7 Implement empty state: "Aucune story detectee" + help text
  - [ ] 5.8 Create `src/renderer/src/features/dashboard/components/StoriesProgress.test.tsx` — test all states

- [ ] Task 6: Implement StoryProgressBar sub-component (AC: #1, #2)
  - [ ] 6.1 Create `src/renderer/src/features/dashboard/components/StoryProgressBar.tsx` — mini horizontal progress bar
  - [ ] 6.2 Width transitions: `transition-[width] duration-300 ease-out` for smooth progress updates
  - [ ] 6.3 Color logic: < 100% = `bg-accent`, 100% = `bg-status-green`
  - [ ] 6.4 Respect `prefers-reduced-motion` — instant width changes
  - [ ] 6.5 Create `src/renderer/src/features/dashboard/components/StoryProgressBar.test.tsx` — test 0%, 50%, 100% states

- [ ] Task 7: Wire StoriesProgress into CockpitDashboard (AC: #1)
  - [ ] 7.1 Import `StoriesProgress` into `CockpitDashboard.tsx`
  - [ ] 7.2 Replace `#widget-stories` placeholder with `StoriesProgress` wrapped in `WidgetCard`
  - [ ] 7.3 Update `useDashboardData` to include stories summary from `useStoriesProgress` in overall health computation

- [ ] Task 8: Wire file-change stream for auto-refresh (AC: #3)
  - [ ] 8.1 In `useStoriesProgress`, filter `stream:file-change` events to only trigger re-fetch for paths matching `_bmad-output/**/*.md` or implementation artifact patterns
  - [ ] 8.2 Debounce re-fetch with 300ms delay
  - [ ] 8.3 Show subtle "Mise a jour..." indicator during re-fetch

- [ ] Task 9: Accessibility (AC: #1, #2)
  - [ ] 9.1 Add `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"` on each progress bar
  - [ ] 9.2 Add `aria-label` on each story row: "Story {title}: {completed}/{total} taches"
  - [ ] 9.3 Add `role="region"` and `aria-label="Progression des stories"` on the widget
  - [ ] 9.4 Ensure "Done" badge announced by screen reader via `aria-live="polite"` when status changes

## Dev Notes

### FRs Covered

- **FR23** — L'utilisateur peut voir les stories en cours avec leur etat d'avancement (ratio taches completees / taches totales, source : fichiers Markdown BMAD)

### Dependencies on Previous Stories

- **Story 5.1** — Dashboard layout, `CockpitDashboard`, `WidgetCard`
- **Story 1.1** — IPC bridge (`useIpcInvoke`, `useIpcStream`), shared types
- **Story 1.3** — Project loader, BMAD detection (project path available)
- **Story 3.1** — File watcher (`stream:file-change`) for auto-refresh on story file changes

### GAP-2 Resolution

This story implements the GAP-2 resolution from the architecture document:
- **Service** `story-parser.ts` in `services/project/` — parses BMAD Markdown story files
- **IPC** `stories:list` — returns `StoryProgress[]`
- **Component** `StoriesProgress.tsx` in `features/dashboard/` — displays progress bars
- **Hook** `useStoriesProgress.ts` — calls IPC + listens for file changes

[Source: architecture.md#GAP-2]

### StoryProgress Type

```typescript
// src/shared/types/story.types.ts
export type StoryProgress = {
  id: string;          // e.g., "1.1", "5.3"
  title: string;       // e.g., "Project Scaffold, IPC Bridge & Event Bus"
  epicId: string;      // e.g., "1"
  epicTitle: string;   // e.g., "Application Foundation & Project Shell"
  filePath: string;    // e.g., "_bmad-output/implementation-artifacts/1-1-project-scaffold-ipc-bridge-event-bus.md"
  tasksTotal: number;
  tasksCompleted: number;
  ratio: number;       // 0.0 to 1.0
  status: 'pending' | 'in-progress' | 'done';
};
```

### story-parser.ts Implementation Pattern

```typescript
// src/main/services/project/story-parser.ts
import { readFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import type { StoryProgress } from '@shared/types/story.types';

const CHECKBOX_UNCHECKED = /^[\s]*-\s\[\s\]/gm;
const CHECKBOX_CHECKED = /^[\s]*-\s\[x\]/gm;
const STORY_TITLE_REGEX = /^#\s+Story\s+(\d+\.\d+):\s*(.+)$/m;
const STATUS_REGEX = /^Status:\s*(.+)$/m;

export function parseStoryContent(content: string, filePath: string): StoryProgress | null {
  const titleMatch = content.match(STORY_TITLE_REGEX);
  if (!titleMatch) return null;

  const id = titleMatch[1];
  const title = titleMatch[2].trim();
  const epicId = id.split('.')[0];

  const statusMatch = content.match(STATUS_REGEX);
  const rawStatus = statusMatch ? statusMatch[1].trim().toLowerCase() : 'pending';

  const uncheckedMatches = content.match(CHECKBOX_UNCHECKED);
  const checkedMatches = content.match(CHECKBOX_CHECKED);

  const tasksCompleted = checkedMatches ? checkedMatches.length : 0;
  const tasksUnchecked = uncheckedMatches ? uncheckedMatches.length : 0;
  const tasksTotal = tasksCompleted + tasksUnchecked;

  const ratio = tasksTotal > 0 ? tasksCompleted / tasksTotal : 0;
  const status = ratio >= 1.0 ? 'done' : ratio > 0 ? 'in-progress' : 'pending';

  return {
    id,
    title,
    epicId,
    epicTitle: '', // resolved by parseAllStories
    filePath,
    tasksTotal,
    tasksCompleted,
    ratio,
    status,
  };
}

export async function parseAllStories(projectPath: string): Promise<StoryProgress[]> {
  const artifactsDir = join(projectPath, '_bmad-output', 'implementation-artifacts');

  let files: string[];
  try {
    files = await readdir(artifactsDir);
  } catch {
    return []; // No implementation artifacts directory
  }

  const storyFiles = files.filter((f) => f.endsWith('.md'));
  const stories: StoryProgress[] = [];

  for (const file of storyFiles) {
    const filePath = join(artifactsDir, file);
    const content = await readFile(filePath, 'utf-8');
    const story = parseStoryContent(content, filePath);
    if (story) {
      stories.push(story);
    }
  }

  // Sort by story ID (numeric)
  stories.sort((a, b) => {
    const [aEpic, aStory] = a.id.split('.').map(Number);
    const [bEpic, bStory] = b.id.split('.').map(Number);
    return aEpic - bEpic || aStory - bStory;
  });

  return stories;
}
```

### useStoriesProgress Hook Pattern

```typescript
// src/renderer/src/features/dashboard/hooks/useStoriesProgress.ts
import { useEffect, useCallback, useRef } from 'react';
import { useIpcInvoke } from '@renderer/shared/hooks/useIpcInvoke';
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream';
import type { StoryProgress } from '@shared/types/story.types';
import type { AsyncState } from '@shared/types/async-state.types';
import { useState } from 'react';

export function useStoriesProgress(): AsyncState<StoryProgress[]> {
  const [state, setState] = useState<AsyncState<StoryProgress[]>>({ status: 'loading' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStories = useCallback(async () => {
    try {
      setState({ status: 'loading' });
      const stories = await window.electronAPI.invoke('stories:list', undefined);
      setState({ status: 'success', data: stories });
    } catch (err) {
      setState({
        status: 'error',
        error: {
          code: 'STORIES_FETCH_FAILED',
          message: 'Impossible de charger les stories',
          source: 'dashboard',
          details: err,
        },
      });
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Auto-refresh on file changes (debounced)
  useIpcStream(
    'stream:file-change',
    useCallback(
      (data) => {
        // Only re-fetch if the changed file is in the implementation artifacts
        if (data.path.includes('_bmad-output') && data.path.endsWith('.md')) {
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(() => {
            fetchStories();
          }, 300);
        }
      },
      [fetchStories]
    )
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return state;
}
```

### StoriesProgress Component Pattern

```typescript
// src/renderer/src/features/dashboard/components/StoriesProgress.tsx
import { WidgetCard } from './WidgetCard';
import { StoryProgressBar } from './StoryProgressBar';
import { useStoriesProgress } from '../hooks/useStoriesProgress';
import type { StoryProgress as StoryProgressType } from '@shared/types/story.types';

export function StoriesProgress() {
  const storiesState = useStoriesProgress();

  if (storiesState.status === 'loading') {
    return (
      <WidgetCard title="Stories">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-border-default animate-pulse" />
          ))}
        </div>
      </WidgetCard>
    );
  }

  if (storiesState.status === 'error') {
    return (
      <WidgetCard title="Stories">
        <div role="alert" className="text-sm text-status-red p-2">
          {storiesState.error.message}
        </div>
      </WidgetCard>
    );
  }

  if (storiesState.status === 'idle') {
    return null;
  }

  const stories = storiesState.data;

  if (stories.length === 0) {
    return (
      <WidgetCard title="Stories">
        <div role="status" className="flex flex-col items-center gap-2 py-6 text-text-muted">
          <span className="text-sm">Aucune story detectee</span>
          <span className="text-xs">Les stories sont parsees depuis les fichiers _bmad-output/</span>
        </div>
      </WidgetCard>
    );
  }

  // Group by epic
  const byEpic = groupByEpic(stories);

  return (
    <WidgetCard title="Stories">
      <div role="region" aria-label="Progression des stories" className="space-y-4">
        {Object.entries(byEpic).map(([epicId, epicStories]) => (
          <EpicGroup key={epicId} epicId={epicId} stories={epicStories} />
        ))}
      </div>
    </WidgetCard>
  );
}

type EpicGroupProps = {
  epicId: string;
  stories: StoryProgressType[];
};

function EpicGroup({ epicId, stories }: EpicGroupProps) {
  const epicTitle = stories[0]?.epicTitle || `Epic ${epicId}`;
  const epicCompleted = stories.filter((s) => s.status === 'done').length;
  const epicTotal = stories.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-text-secondary">{epicTitle}</h4>
        <span className="text-xs text-text-muted">{epicCompleted}/{epicTotal}</span>
      </div>
      <div className="space-y-1.5">
        {stories.map((story) => (
          <StoryRow key={story.id} story={story} />
        ))}
      </div>
    </div>
  );
}

type StoryRowProps = {
  story: StoryProgressType;
};

function StoryRow({ story }: StoryRowProps) {
  const isDone = story.ratio >= 1.0;

  return (
    <button
      className="flex items-center gap-3 w-full text-left px-2 py-1 rounded hover:bg-bg-elevated transition-colors"
      aria-label={`Story ${story.id} ${story.title}: ${story.tasksCompleted}/${story.tasksTotal} taches${isDone ? ' - termine' : ''}`}
    >
      <span className="text-xs text-text-muted w-8 shrink-0 font-mono">{story.id}</span>
      <span className="text-sm text-text-primary truncate flex-1">{story.title}</span>
      <StoryProgressBar ratio={story.ratio} className="w-24 shrink-0" />
      <span className="text-xs text-text-muted w-10 text-right shrink-0">
        {story.tasksCompleted}/{story.tasksTotal}
      </span>
      {isDone && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-status-green/20 text-status-green shrink-0">
          Done
        </span>
      )}
    </button>
  );
}

function groupByEpic(stories: StoryProgressType[]): Record<string, StoryProgressType[]> {
  const groups: Record<string, StoryProgressType[]> = {};
  for (const story of stories) {
    if (!groups[story.epicId]) {
      groups[story.epicId] = [];
    }
    groups[story.epicId].push(story);
  }
  return groups;
}
```

### StoryProgressBar Component Pattern

```typescript
// src/renderer/src/features/dashboard/components/StoryProgressBar.tsx

type StoryProgressBarProps = {
  ratio: number; // 0.0 to 1.0
  className?: string;
};

export function StoryProgressBar({ ratio, className = '' }: StoryProgressBarProps) {
  const percentage = Math.round(ratio * 100);
  const isDone = ratio >= 1.0;
  const barColor = isDone ? 'bg-status-green' : 'bg-accent';

  return (
    <div
      className={`h-1.5 rounded-full bg-border-default overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percentage}% complete`}
    >
      <div
        className={`h-full rounded-full ${barColor} transition-[width] duration-300 ease-out motion-reduce:transition-none`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
```

### File Structure (Story 5.3 additions)

```
src/main/services/project/
├── story-parser.ts                    # NEW — Parses BMAD Markdown → StoryProgress[]
└── story-parser.test.ts               # NEW — Tests for parser

src/shared/types/
└── story.types.ts                     # NEW (or update) — StoryProgress type

src/renderer/src/features/dashboard/
├── components/
│   ├── StoriesProgress.tsx            # NEW — Stories progress widget
│   ├── StoriesProgress.test.tsx       # NEW
│   ├── StoryProgressBar.tsx           # NEW — Mini progress bar
│   └── StoryProgressBar.test.tsx      # NEW
├── hooks/
│   ├── useStoriesProgress.ts          # NEW — IPC + file-change auto-refresh
│   └── useStoriesProgress.test.ts     # NEW
└── dashboard.types.ts                 # UPDATE — (no changes needed, StoryProgress in shared)
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Main service | kebab-case + `.ts` | `story-parser.ts` |
| Shared type | kebab-case + `.types.ts` | `story.types.ts` |
| Widget component | PascalCase | `StoriesProgress.tsx` |
| Sub-component | PascalCase | `StoryProgressBar.tsx` |
| Hook | camelCase, prefix `use` | `useStoriesProgress.ts` |
| Tests | same name + `.test.ts(x)` | `story-parser.test.ts` |

### Testing Strategy

- **Unit tests** for `parseStoryContent`: test with valid story markdown (checkboxes), no checkboxes, malformed content, 100% complete story
- **Unit tests** for `parseAllStories`: test with mock filesystem (multiple story files), empty directory, missing directory
- **Unit tests** for `StoriesProgress`: test loading state (skeleton), empty state, stories grouped by epic, 100% stories show "Done" badge
- **Unit tests** for `StoryProgressBar`: test 0%, 50%, 100% states, verify `role="progressbar"` and `aria-valuenow`
- **Unit tests** for `useStoriesProgress`: mock IPC invoke, test loading/success/error states, test re-fetch on file-change stream
- **Accessibility tests**: verify `role="progressbar"` with correct aria attributes, `aria-label` on story rows
- **Co-located** — all test files next to their source files

### What NOT to Do

- Do NOT implement click handlers on story rows for navigation — that is Story 5.4
- Do NOT parse epics.md for epic titles in story-parser — extract from story file headers or use IDs
- Do NOT use `remark/unified` for parsing task checkboxes — simple regex is sufficient for `- [ ]` / `- [x]` patterns
- Do NOT watch individual story files with chokidar — rely on the existing `stream:file-change` IPC stream from Story 3.1
- Do NOT use `export default` — named exports only
- Do NOT use `any` — use `unknown` + type guards
- Do NOT skip debounce on file-change re-fetch — multiple rapid file changes should batch into one re-fetch
- Do NOT block the main process thread — `parseAllStories` uses async file I/O

### References

- [Source: epics.md#Story-5.3] — Full acceptance criteria
- [Source: architecture.md#GAP-2] — Story Parser resolution: `story-parser.ts`, `stories:list` IPC, `StoriesProgress.tsx`, `useStoriesProgress.ts`
- [Source: architecture.md#Complete-Project-Directory-Structure] — `services/project/story-parser.ts`, `features/dashboard/StoriesProgress.tsx`
- [Source: architecture.md#IPC-Channel-Design] — `stories:list: { args: void; result: StoryProgress[] }`
- [Source: architecture.md#Communication-Patterns] — IPC invoke pattern, `AsyncState<T>`
- [Source: ux-design-specification.md#Custom-Components] — `StoriesProgress` spec: "Widget avancement stories BMAD, mini progress bars + ratio taches"
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — "Progress bar: width transition 300ms ease-out"
- [Source: ux-design-specification.md#Empty-States-Loading] — Skeleton placeholders, empty state patterns
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — IPC hooks, event bus, TypeScript rules

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
