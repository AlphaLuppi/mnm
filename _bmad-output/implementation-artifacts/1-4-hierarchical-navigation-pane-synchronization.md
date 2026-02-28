# Story 1.4: Hierarchical Navigation & Pane Synchronization

Status: ready-for-dev

## Story

As a **user**,
I want **to navigate the project hierarchy (Projet -> Epic -> Story -> Tache) and have all 3 panes synchronize**,
So that **I always see the context, agents, and tests relevant to my current focus**.

## Acceptance Criteria

### AC1 — Sidebar displays BMAD hierarchy (Project -> Epics -> Stories -> Tasks)

**Given** un projet BMAD est charge
**When** je vois la sidebar
**Then** la hierarchie est affichee : Projet -> Epics -> Stories -> Taches (parsees depuis les fichiers BMAD)

### AC2 — Pane synchronization on Story selection

**Given** je clique sur une Story dans la sidebar
**When** la navigation se met a jour
**Then** le volet Contexte affiche les fichiers de contexte lies a cette story
**And** le volet Agents affiche les agents travaillant sur cette story
**And** le volet Tests affiche les tests associes a cette story
**And** le breadcrumb en haut affiche "Projet > Epic X > Story Y"

### AC3 — Breadcrumb navigation (click to go up)

**Given** je suis au niveau Story
**When** je clique sur le breadcrumb "Epic X"
**Then** je remonte au niveau Epic et les 3 volets se synchronisent a ce niveau

### AC4 — Escape key navigates up one level

**Given** je navigue dans la hierarchie
**When** je presse `Esc`
**Then** je remonte d'un niveau dans la hierarchie

## Tasks / Subtasks

- [ ] Task 1: Create shared navigation types (AC: #1, #2)
  - [ ] 1.1 Create `src/shared/types/navigation.types.ts` with `NavigationLevel`, `NavigationNode`, `BreadcrumbSegment`, and `NavigationState` types
  - [ ] 1.2 Create `src/shared/types/story.types.ts` with `EpicInfo`, `StoryInfo`, `TaskInfo`, `StoryProgress`, `ProjectHierarchy` types (if not already created by Story 1.1)
  - [ ] 1.3 Add `'stories:list'` channel to `IpcInvokeChannels` in `src/shared/ipc-channels.ts` (type declaration only, verify not already declared)

- [ ] Task 2: Implement story-parser service in main process (AC: #1)
  - [ ] 2.1 Create `src/main/services/project/story-parser.ts` — parses `_bmad-output/planning-artifacts/epics.md` to extract the full hierarchy (Epics -> Stories -> Tasks)
  - [ ] 2.2 Implement Markdown parsing: extract Epic headers (`### Epic N`), Story headers (`### Story N.M`), task checkboxes (`- [ ]` / `- [x]`)
  - [ ] 2.3 Build a `ProjectHierarchy` tree from the parsed data
  - [ ] 2.4 Create `src/main/services/project/story-parser.test.ts` — unit tests with sample BMAD content
  - [ ] 2.5 Register `'stories:list'` IPC handler in `src/main/ipc/handlers.ts` that calls `story-parser.ts`

- [ ] Task 3: Create Zustand navigation store (AC: #1, #2, #3, #4)
  - [ ] 3.1 Create `src/renderer/src/stores/navigation.store.ts` with state: `selectedProject`, `selectedEpic`, `selectedStory`, `selectedTask`, `breadcrumb`, `hierarchy`
  - [ ] 3.2 Implement actions: `selectProject()`, `selectEpic()`, `selectStory()`, `selectTask()`, `navigateUp()`, `navigateTo(level, id)`
  - [ ] 3.3 Implement `loadHierarchy()` action that calls `stories:list` IPC and populates the tree
  - [ ] 3.4 Implement computed `breadcrumb` based on current selection (derives from selectedProject/Epic/Story/Task)
  - [ ] 3.5 Implement `navigateUp()` logic: Task -> Story -> Epic -> Project
  - [ ] 3.6 Create `src/renderer/src/stores/navigation.store.test.ts` — unit tests for all navigation actions

- [ ] Task 4: Create NavigationSidebar component (AC: #1, #4)
  - [ ] 4.1 Create `src/renderer/src/shared/layout/NavigationSidebar.tsx` — tree view with collapsible nodes
  - [ ] 4.2 Implement tree rendering: Project (root) -> Epics (collapsible) -> Stories (collapsible) -> Tasks (leaf)
  - [ ] 4.3 Implement click handler: clicking a node calls the appropriate navigation store action
  - [ ] 4.4 Implement expand/collapse: clicking chevron toggles children visibility
  - [ ] 4.5 Implement visual selection state: selected node highlighted with `--accent` background
  - [ ] 4.6 Implement ARIA tree attributes: `role="tree"`, `role="treeitem"`, `aria-expanded`, `aria-selected`, `aria-level`
  - [ ] 4.7 Implement keyboard navigation: `ArrowUp`/`ArrowDown` to move focus, `Enter` to select, `ArrowRight` to expand, `ArrowLeft` to collapse
  - [ ] 4.8 Implement `Esc` key handler: calls `navigateUp()` from navigation store
  - [ ] 4.9 Create `src/renderer/src/shared/layout/NavigationSidebar.test.tsx` — render tests, keyboard nav tests, ARIA tests

- [ ] Task 5: Update AppHeader with breadcrumb (AC: #2, #3)
  - [ ] 5.1 Update `src/renderer/src/shared/layout/AppHeader.tsx` (or create if not existing) — add breadcrumb section
  - [ ] 5.2 Implement `Breadcrumb` subcomponent: renders each `BreadcrumbSegment` as a clickable link, separated by `>`
  - [ ] 5.3 Each breadcrumb segment calls `navigateTo(level, id)` on click
  - [ ] 5.4 Current level is displayed as non-clickable text (last segment)
  - [ ] 5.5 Add ARIA: `nav` element with `aria-label="Breadcrumb"`, `aria-current="page"` on last segment
  - [ ] 5.6 Create `src/renderer/src/shared/layout/AppHeader.test.tsx` — breadcrumb rendering + click tests

- [ ] Task 6: Implement pane synchronization mechanism (AC: #2, #3, #4)
  - [ ] 6.1 Create `src/renderer/src/shared/hooks/useNavigationSync.ts` — hook that subscribes to navigation store and provides current context for each pane
  - [ ] 6.2 The hook returns `{ contextPaneData, agentsPaneData, testsPaneData }` based on current navigation level and selection
  - [ ] 6.3 At this stage (Story 1.4), pane data is stub/placeholder content — actual agent/context/test data comes from Epic 2-7
  - [ ] 6.4 Each pane shows a placeholder message: "Contexte pour [Story Y]", "Agents pour [Story Y]", "Tests pour [Story Y]" indicating synchronization works
  - [ ] 6.5 Wire synchronization into ThreePaneLayout: left pane reads contextPaneData, center reads agentsPaneData, right reads testsPaneData
  - [ ] 6.6 Create `src/renderer/src/shared/hooks/useNavigationSync.test.ts` — tests verifying pane data changes when navigation changes

- [ ] Task 7: Implement Command Palette (Cmd+K) (AC: related to navigation UX)
  - [ ] 7.1 Install shadcn Command component: `npx shadcn@latest add command`
  - [ ] 7.2 Also install shadcn Dialog if not already installed: `npx shadcn@latest add dialog`
  - [ ] 7.3 Create `src/renderer/src/shared/components/CommandPalette.tsx` — wraps shadcn `Command` in a `Dialog`
  - [ ] 7.4 Populate command items from the navigation hierarchy: list all Epics, Stories, Tasks as searchable items
  - [ ] 7.5 On item selection, call the appropriate navigation store action and close the dialog
  - [ ] 7.6 Register global keyboard shortcut `Cmd+K` (macOS) / `Ctrl+K` (Linux/Windows) to toggle the palette
  - [ ] 7.7 Add ARIA: `role="combobox"`, `aria-label="Command palette"`, managed by shadcn Command internally
  - [ ] 7.8 Create `src/renderer/src/shared/components/CommandPalette.test.tsx` — open/close, search, selection tests

- [ ] Task 8: Implement pane focus keyboard shortcuts (AC: related to navigation UX)
  - [ ] 8.1 Create `src/renderer/src/shared/hooks/useKeyboardShortcuts.ts` — global keyboard shortcut handler
  - [ ] 8.2 Register shortcuts: `1` -> focus Context pane, `2` -> focus Agents pane, `3` -> focus Tests pane
  - [ ] 8.3 Implement focus management: each pane has a `tabindex="-1"` container, shortcut calls `.focus()` on target pane
  - [ ] 8.4 Ensure shortcuts only fire when no input/textarea has focus (prevent conflicts with text entry)
  - [ ] 8.5 Add screen reader announcement via `aria-live` region when pane focus changes
  - [ ] 8.6 Create `src/renderer/src/shared/hooks/useKeyboardShortcuts.test.ts` — tests for shortcut registration, focus behavior

- [ ] Task 9: Wire everything into AppShell (AC: #1, #2, #3, #4)
  - [ ] 9.1 Update `src/renderer/src/shared/layout/AppShell.tsx` — integrate NavigationSidebar on the left side (outside the 3-pane layout)
  - [ ] 9.2 Update AppShell to render AppHeader with breadcrumb at the top
  - [ ] 9.3 Wire CommandPalette to render as an overlay (always mounted, toggled by Cmd+K)
  - [ ] 9.4 Wire useKeyboardShortcuts at AppShell level
  - [ ] 9.5 On project load (from Story 1.3 project loader), call `loadHierarchy()` from navigation store
  - [ ] 9.6 Verify full flow: project loads -> sidebar populates -> click Story -> breadcrumb updates -> panes show stub content -> Esc goes up -> breadcrumb click navigates -> Cmd+K searches

- [ ] Task 10: Verify all tests pass and accessibility audit (AC: #1, #2, #3, #4)
  - [ ] 10.1 Run `npx vitest run` — all tests pass
  - [ ] 10.2 Verify keyboard-only navigation works end-to-end (no mouse needed)
  - [ ] 10.3 Verify screen reader output with ARIA tree, breadcrumb, and live regions
  - [ ] 10.4 Verify `npm run build` produces working production build

## Dev Notes

### FR Covered

**FR38** — L'utilisateur peut naviguer dans la hierarchie du projet (Projet -> Epic -> Story -> Tache) et les 3 volets se synchronisent automatiquement.

This is the primary FR addressed by Story 1.4. The navigation skeleton and synchronization mechanism are built here, but actual pane content (agents, context files, tests) will be populated by later Epics (2-7). [Source: epics.md#FR-Coverage-Map]

### Dependencies on Stories 1.1-1.3

| Dependency | From Story | What it provides | How Story 1.4 uses it |
|---|---|---|---|
| IPC bridge + typed channels | 1.1 | `window.electronAPI.invoke()`, `IpcInvokeChannels`, `useIpcInvoke` hook | Calling `stories:list` to load hierarchy data from main process |
| Event bus (mitt renderer) | 1.1 | `useEventBus` hook, `RendererEvents` with `nav:select` | Emitting `nav:select` events when navigation changes |
| Shared types infrastructure | 1.1 | `src/shared/types/`, `AppError`, `AsyncState<T>` | `AsyncState<ProjectHierarchy>` for loading state of hierarchy |
| Import aliases | 1.1 | `@main/`, `@renderer/`, `@shared/` | All imports use aliases |
| ThreePaneLayout | 1.2 (expected) | Resizable 3-pane container (Contexte / Agents / Tests) | Story 1.4 wires synchronization into each pane's content |
| AppShell + AppHeader | 1.2 (expected) | Shell layout with header area | Story 1.4 adds breadcrumb to AppHeader, sidebar to AppShell |
| TimelineBar | 1.2 (expected) | Bottom timeline bar (120px) | Not directly used by Story 1.4, but coexists in layout |
| Project loader | 1.3 (expected) | `project:open` IPC, `ProjectInfo`, project loading flow | After project loads, Story 1.4 calls `loadHierarchy()` to parse BMAD files |
| BMAD detection | 1.3 (expected) | Detection of `_bmad/` and `_bmad-output/` directories | Story parser needs confirmed BMAD project to find `epics.md` |
| `.mnm/` initialization | 1.3 (expected) | `project-state.json` | Navigation state (last selected level) can be persisted here |

**Important:** If Stories 1.2 and 1.3 are not yet implemented when developing Story 1.4, create minimal stubs for ThreePaneLayout, AppShell, AppHeader, and the project loader. The stubs should expose the same API that Stories 1.2/1.3 will implement. [Source: architecture.md#Implementation-Sequence]

### Navigation Hierarchy Data Model

The navigation hierarchy follows this structure, parsed from BMAD files:

```
Project (root)
  +-- Epic 1: Application Foundation & Project Shell
  |     +-- Story 1.1: Project Scaffold, IPC Bridge & Event Bus
  |     |     +-- Task: Scaffold electron-vite project
  |     |     +-- Task: Create shared types
  |     |     +-- ...
  |     +-- Story 1.2: Three-Pane Resizable Layout with Timeline Bar
  |     +-- Story 1.3: Open Project & BMAD Detection
  |     +-- Story 1.4: Hierarchical Navigation & Pane Synchronization
  +-- Epic 2: Agent Monitoring & Supervision
  |     +-- Story 2.1: Agent Harness
  |     +-- ...
  +-- ... (Epics 3-8)
```

[Source: epics.md#Epic-List]

### Shared Types

```typescript
// src/shared/types/navigation.types.ts

export type NavigationLevel = 'project' | 'epic' | 'story' | 'task';

export type NavigationNode = {
  id: string;           // Unique identifier (e.g., "epic-1", "story-1.4", "task-1.4.3")
  label: string;        // Display name
  level: NavigationLevel;
  children: NavigationNode[];
  parentId: string | null;
  metadata?: {
    frsCovered?: string[];   // e.g., ["FR37", "FR38"]
    status?: string;         // e.g., "ready-for-dev", "in-progress", "done"
    tasksTotal?: number;
    tasksCompleted?: number;
  };
};

export type BreadcrumbSegment = {
  id: string;
  label: string;
  level: NavigationLevel;
};

export type NavigationState = {
  hierarchy: NavigationNode | null;   // Root of the tree (project)
  selectedPath: string[];             // Array of IDs from root to current: ["project-mnm", "epic-1", "story-1.4"]
  expandedNodes: Set<string>;         // IDs of expanded nodes in the sidebar
};
```

```typescript
// src/shared/types/story.types.ts

export type EpicInfo = {
  id: string;           // "epic-1"
  number: number;       // 1
  title: string;        // "Application Foundation & Project Shell"
  description: string;
  frsCovered: string[]; // ["FR37", "FR38", "FR39", "FR40", "FR45", "FR46"]
  stories: StoryInfo[];
};

export type StoryInfo = {
  id: string;           // "story-1.4"
  epicId: string;       // "epic-1"
  number: string;       // "1.4"
  title: string;        // "Hierarchical Navigation & Pane Synchronization"
  userStory: string;    // "As a user, I want..."
  tasks: TaskInfo[];
};

export type TaskInfo = {
  id: string;           // "task-1.4.3"
  storyId: string;      // "story-1.4"
  title: string;        // "Create Zustand navigation store"
  completed: boolean;   // Parsed from `- [x]` vs `- [ ]`
};

export type StoryProgress = {
  id: string;
  title: string;
  filePath: string;
  tasksTotal: number;
  tasksCompleted: number;
  ratio: number;        // 0.0 to 1.0
};

export type ProjectHierarchy = {
  projectName: string;
  epics: EpicInfo[];
};
```

[Source: architecture.md#GAP-2-BMAD-Story-Parser]

### Zustand Navigation Store

```typescript
// src/renderer/src/stores/navigation.store.ts
import { create } from 'zustand';
import type { NavigationLevel, NavigationNode, BreadcrumbSegment } from '@shared/types/navigation.types';
import type { ProjectHierarchy } from '@shared/types/story.types';
import type { AsyncState } from '@shared/types/async-state.types';

type NavigationStore = {
  // State
  hierarchy: AsyncState<ProjectHierarchy>;
  selectedProjectId: string | null;
  selectedEpicId: string | null;
  selectedStoryId: string | null;
  selectedTaskId: string | null;
  expandedNodes: Set<string>;

  // Computed-like (derived in selectors)
  currentLevel: () => NavigationLevel;
  breadcrumb: () => BreadcrumbSegment[];

  // Actions
  loadHierarchy: () => Promise<void>;
  selectProject: (id: string) => void;
  selectEpic: (id: string) => void;
  selectStory: (id: string) => void;
  selectTask: (id: string) => void;
  navigateUp: () => void;
  navigateTo: (level: NavigationLevel, id: string) => void;
  toggleExpanded: (nodeId: string) => void;
};

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  hierarchy: { status: 'idle' },
  selectedProjectId: null,
  selectedEpicId: null,
  selectedStoryId: null,
  selectedTaskId: null,
  expandedNodes: new Set<string>(),

  currentLevel: () => {
    const state = get();
    if (state.selectedTaskId) return 'task';
    if (state.selectedStoryId) return 'story';
    if (state.selectedEpicId) return 'epic';
    return 'project';
  },

  breadcrumb: () => {
    const state = get();
    const segments: BreadcrumbSegment[] = [];
    if (state.hierarchy.status !== 'success') return segments;

    const data = state.hierarchy.data;
    segments.push({ id: 'project', label: data.projectName, level: 'project' });

    if (state.selectedEpicId) {
      const epic = data.epics.find((e) => e.id === state.selectedEpicId);
      if (epic) segments.push({ id: epic.id, label: `Epic ${epic.number}`, level: 'epic' });
    }

    if (state.selectedStoryId && state.selectedEpicId) {
      const epic = data.epics.find((e) => e.id === state.selectedEpicId);
      const story = epic?.stories.find((s) => s.id === state.selectedStoryId);
      if (story) segments.push({ id: story.id, label: `Story ${story.number}`, level: 'story' });
    }

    if (state.selectedTaskId && state.selectedStoryId && state.selectedEpicId) {
      const epic = data.epics.find((e) => e.id === state.selectedEpicId);
      const story = epic?.stories.find((s) => s.id === state.selectedStoryId);
      const task = story?.tasks.find((t) => t.id === state.selectedTaskId);
      if (task) segments.push({ id: task.id, label: task.title, level: 'task' });
    }

    return segments;
  },

  loadHierarchy: async () => {
    set({ hierarchy: { status: 'loading' } });
    try {
      const data = await window.electronAPI.invoke('stories:list', undefined);
      // Transform StoryProgress[] into ProjectHierarchy
      // (actual transformation depends on stories:list return shape)
      set({ hierarchy: { status: 'success', data: data as unknown as ProjectHierarchy } });
    } catch (error) {
      set({
        hierarchy: {
          status: 'error',
          error: { code: 'HIERARCHY_LOAD_FAILED', message: String(error), source: 'navigation' },
        },
      });
    }
  },

  selectProject: (id) =>
    set({ selectedProjectId: id, selectedEpicId: null, selectedStoryId: null, selectedTaskId: null }),

  selectEpic: (id) =>
    set((state) => ({
      selectedEpicId: id,
      selectedStoryId: null,
      selectedTaskId: null,
      expandedNodes: new Set([...state.expandedNodes, id]),
    })),

  selectStory: (id) =>
    set((state) => ({
      selectedStoryId: id,
      selectedTaskId: null,
      expandedNodes: new Set([...state.expandedNodes, id]),
    })),

  selectTask: (id) => set({ selectedTaskId: id }),

  navigateUp: () => {
    const state = get();
    if (state.selectedTaskId) {
      set({ selectedTaskId: null });
    } else if (state.selectedStoryId) {
      set({ selectedStoryId: null });
    } else if (state.selectedEpicId) {
      set({ selectedEpicId: null });
    }
    // At project level, Esc does nothing
  },

  navigateTo: (level, id) => {
    const actions = get();
    switch (level) {
      case 'project':
        actions.selectProject(id);
        break;
      case 'epic':
        actions.selectEpic(id);
        break;
      case 'story':
        actions.selectStory(id);
        break;
      case 'task':
        actions.selectTask(id);
        break;
    }
  },

  toggleExpanded: (nodeId) =>
    set((state) => {
      const next = new Set(state.expandedNodes);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return { expandedNodes: next };
    }),
}));
```

**Rules (from architecture):**
- One store per feature (navigation is a shared store used by all features) [Source: architecture.md#Communication-Patterns]
- Actions inside the store, not external functions [Source: architecture.md#Communication-Patterns]
- Immutable updates (never mutate state directly) [Source: architecture.md#Communication-Patterns]
- Use `useShallow` for multi-value selectors in components [Source: Story 1.1 Dev Notes]

### Story Parser Service (Main Process)

```typescript
// src/main/services/project/story-parser.ts
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ProjectHierarchy, EpicInfo, StoryInfo, TaskInfo } from '@shared/types/story.types';

export async function parseProjectHierarchy(projectPath: string): Promise<ProjectHierarchy> {
  const epicsPath = join(projectPath, '_bmad-output', 'planning-artifacts', 'epics.md');
  const content = await readFile(epicsPath, 'utf-8');
  return parseEpicsMarkdown(content, projectPath);
}

export function parseEpicsMarkdown(content: string, projectName: string): ProjectHierarchy {
  const epics: EpicInfo[] = [];
  const lines = content.split('\n');

  let currentEpic: EpicInfo | null = null;
  let currentStory: StoryInfo | null = null;
  let inDetailedSection = false; // Track if we're in the detailed epic breakdown

  for (const line of lines) {
    // Match Epic headers: "### Epic N : Title" or "## Epic N : Title"
    const epicMatch = line.match(/^#{2,3}\s+Epic\s+(\d+)\s*[:\.]\s*(.+)/);
    if (epicMatch) {
      // Push previous story if exists
      if (currentStory && currentEpic) {
        currentEpic.stories.push(currentStory);
        currentStory = null;
      }
      // Push previous epic if exists (avoid duplicates from summary vs detail)
      if (currentEpic && !epics.find((e) => e.number === currentEpic!.number)) {
        epics.push(currentEpic);
      }
      const epicNum = parseInt(epicMatch[1], 10);
      // Check if we already have this epic from the summary section
      const existing = epics.find((e) => e.number === epicNum);
      if (existing) {
        currentEpic = existing;
      } else {
        currentEpic = {
          id: `epic-${epicNum}`,
          number: epicNum,
          title: epicMatch[2].trim(),
          description: '',
          frsCovered: [],
          stories: [],
        };
      }
      continue;
    }

    // Match Story headers: "### Story N.M : Title"
    const storyMatch = line.match(/^#{2,3}\s+Story\s+(\d+\.\d+)\s*[:\.]\s*(.+)/);
    if (storyMatch && currentEpic) {
      if (currentStory) {
        currentEpic.stories.push(currentStory);
      }
      currentStory = {
        id: `story-${storyMatch[1]}`,
        epicId: currentEpic.id,
        number: storyMatch[1],
        title: storyMatch[2].trim(),
        userStory: '',
        tasks: [],
      };
      continue;
    }

    // Match task checkboxes: "- [ ] Task N: Description" or "- [x] Task N: Description"
    const taskMatch = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)/);
    if (taskMatch && currentStory) {
      const taskId = `task-${currentStory.number}.${currentStory.tasks.length + 1}`;
      currentStory.tasks.push({
        id: taskId,
        storyId: currentStory.id,
        title: taskMatch[2].trim(),
        completed: taskMatch[1].toLowerCase() === 'x',
      });
      continue;
    }

    // Capture FRs covered line
    const frsMatch = line.match(/\*\*FRs?\s+couvertes?\s*:\*\*\s*(.+)/i);
    if (frsMatch && currentEpic) {
      const frs = frsMatch[1].match(/FR\d+/g);
      if (frs) currentEpic.frsCovered = frs;
    }
  }

  // Push last story and epic
  if (currentStory && currentEpic) {
    currentEpic.stories.push(currentStory);
  }
  if (currentEpic && !epics.find((e) => e.number === currentEpic!.number)) {
    epics.push(currentEpic);
  }

  return { projectName, epics };
}
```

**Key parsing rules:**
- The primary source is `_bmad-output/planning-artifacts/epics.md` [Source: architecture.md#GAP-2-BMAD-Story-Parser]
- The file has both a summary section (Epic List) and a detailed breakdown section. The parser must handle both without creating duplicates.
- Tasks are parsed from checkbox syntax (`- [ ]` / `- [x]`) [Source: epics.md#Story-5.3]
- Story files in `_bmad-output/implementation-artifacts/` can also be parsed for additional task detail, but `epics.md` is the primary navigation source.

### NavigationSidebar Component Structure

```tsx
// src/renderer/src/shared/layout/NavigationSidebar.tsx
import { useNavigationStore } from '@renderer/stores/navigation.store';
import { useShallow } from 'zustand/react/shallow';
import type { NavigationNode } from '@shared/types/navigation.types';

export function NavigationSidebar() {
  const { hierarchy, selectedEpicId, selectedStoryId, selectedTaskId, expandedNodes } =
    useNavigationStore(
      useShallow((s) => ({
        hierarchy: s.hierarchy,
        selectedEpicId: s.selectedEpicId,
        selectedStoryId: s.selectedStoryId,
        selectedTaskId: s.selectedTaskId,
        expandedNodes: s.expandedNodes,
      }))
    );

  if (hierarchy.status !== 'success') {
    return <SidebarSkeleton />;
  }

  return (
    <nav
      className="w-60 bg-bg-surface border-r border-border-default overflow-y-auto"
      aria-label="Project navigation"
    >
      <div role="tree" aria-label={hierarchy.data.projectName}>
        {hierarchy.data.epics.map((epic) => (
          <TreeNode
            key={epic.id}
            id={epic.id}
            label={`Epic ${epic.number}: ${epic.title}`}
            level={1}
            isExpanded={expandedNodes.has(epic.id)}
            isSelected={selectedEpicId === epic.id && !selectedStoryId}
            hasChildren={epic.stories.length > 0}
          >
            {epic.stories.map((story) => (
              <TreeNode
                key={story.id}
                id={story.id}
                label={`Story ${story.number}: ${story.title}`}
                level={2}
                isExpanded={expandedNodes.has(story.id)}
                isSelected={selectedStoryId === story.id && !selectedTaskId}
                hasChildren={story.tasks.length > 0}
              >
                {story.tasks.map((task) => (
                  <TreeNode
                    key={task.id}
                    id={task.id}
                    label={task.title}
                    level={3}
                    isSelected={selectedTaskId === task.id}
                    hasChildren={false}
                    isCompleted={task.completed}
                  />
                ))}
              </TreeNode>
            ))}
          </TreeNode>
        ))}
      </div>
    </nav>
  );
}

// TreeNode subcomponent with ARIA tree role support
function TreeNode({
  id,
  label,
  level,
  isExpanded,
  isSelected,
  hasChildren,
  isCompleted,
  children,
}: {
  id: string;
  label: string;
  level: number;
  isExpanded?: boolean;
  isSelected: boolean;
  hasChildren: boolean;
  isCompleted?: boolean;
  children?: React.ReactNode;
}) {
  const { toggleExpanded, navigateTo } = useNavigationStore(
    useShallow((s) => ({ toggleExpanded: s.toggleExpanded, navigateTo: s.navigateTo }))
  );

  const nodeLevel: 'epic' | 'story' | 'task' =
    level === 1 ? 'epic' : level === 2 ? 'story' : 'task';

  const handleClick = () => {
    navigateTo(nodeLevel, id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        handleClick();
        break;
      case 'ArrowRight':
        if (hasChildren && !isExpanded) toggleExpanded(id);
        break;
      case 'ArrowLeft':
        if (hasChildren && isExpanded) toggleExpanded(id);
        break;
    }
  };

  return (
    <div
      role="treeitem"
      aria-level={level}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
    >
      <div
        className={`
          flex items-center gap-1 px-2 py-1 cursor-pointer text-sm
          hover:bg-bg-elevated transition-colors duration-150
          ${isSelected ? 'bg-accent/10 text-text-primary border-l-2 border-accent' : 'text-text-secondary'}
        `}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {hasChildren && (
          <button
            className="w-4 h-4 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(id);
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon rotated={isExpanded} />
          </button>
        )}
        {isCompleted !== undefined && (
          <span className={isCompleted ? 'text-status-green' : 'text-text-muted'}>
            {isCompleted ? '\u2713' : '\u25CB'}
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>
      {hasChildren && isExpanded && <div role="group">{children}</div>}
    </div>
  );
}
```

**Sidebar width:** 240px (w-60 in Tailwind), placed to the left of the ThreePaneLayout. Not a resizable pane itself — it is always visible when a BMAD project is loaded. [Source: ux-design-specification.md#Design-Direction-Decision]

### Breadcrumb Pattern (in AppHeader)

```tsx
// Breadcrumb section within AppHeader
function NavigationBreadcrumb() {
  const breadcrumb = useNavigationStore((s) => s.breadcrumb());
  const navigateTo = useNavigationStore((s) => s.navigateTo);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <ol className="flex items-center gap-1">
        {breadcrumb.map((segment, index) => {
          const isLast = index === breadcrumb.length - 1;
          return (
            <li key={segment.id} className="flex items-center gap-1">
              {index > 0 && <span className="text-text-muted">&gt;</span>}
              {isLast ? (
                <span className="text-text-primary font-medium" aria-current="page">
                  {segment.label}
                </span>
              ) : (
                <button
                  className="text-text-secondary hover:text-text-primary transition-colors"
                  onClick={() => navigateTo(segment.level, segment.id)}
                >
                  {segment.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

[Source: ux-design-specification.md#Navigation-Patterns] [Source: ux-design-specification.md#Transferable-UX-Patterns]

### Pane Synchronization Mechanism

The synchronization is **store-driven**, not event-driven. All 3 panes subscribe to the same Zustand navigation store. When the user navigates (via sidebar click, breadcrumb click, Esc key, or Cmd+K), the store updates, and React re-renders each pane with the new context.

```typescript
// src/renderer/src/shared/hooks/useNavigationSync.ts
import { useNavigationStore } from '@renderer/stores/navigation.store';
import { useShallow } from 'zustand/react/shallow';
import type { NavigationLevel } from '@shared/types/navigation.types';

export type PaneSyncData = {
  level: NavigationLevel;
  label: string;          // Human-readable label for the current selection
  epicId: string | null;
  storyId: string | null;
  taskId: string | null;
};

export function useNavigationSync(): PaneSyncData {
  return useNavigationStore(
    useShallow((s) => ({
      level: s.currentLevel(),
      label: s.breadcrumb().map((seg) => seg.label).join(' > ') || 'Project',
      epicId: s.selectedEpicId,
      storyId: s.selectedStoryId,
      taskId: s.selectedTaskId,
    }))
  );
}
```

**How each pane uses it (Story 1.4 scope = stubs):**

```tsx
// Inside ThreePaneLayout — each pane renders based on sync data
function ContextPane() {
  const sync = useNavigationSync();
  // Story 1.4: placeholder. Epic 3+ will populate with real ContextFileCards
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-text-primary">Contexte</h2>
      <p className="text-sm text-text-muted mt-2">
        Fichiers de contexte pour: {sync.label}
      </p>
      {/* Future: <ContextFileCard> list filtered by sync.storyId */}
    </div>
  );
}

function AgentsPane() {
  const sync = useNavigationSync();
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-text-primary">Agents</h2>
      <p className="text-sm text-text-muted mt-2">
        Agents pour: {sync.label}
      </p>
      {/* Future: <AgentCard> list filtered by sync.storyId */}
    </div>
  );
}

function TestsPane() {
  const sync = useNavigationSync();
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-text-primary">Tests</h2>
      <p className="text-sm text-text-muted mt-2">
        Tests pour: {sync.label}
      </p>
      {/* Future: <TestHierarchy> filtered by sync.storyId */}
    </div>
  );
}
```

**Synchronization rule:** Navigation is ALWAYS automatic and synchronous between all 3 panes. There is no manual "sync" button. Clicking any navigation element (sidebar, breadcrumb, command palette, cockpit widget) updates the single navigation store, and all panes react. [Source: ux-design-specification.md#Navigation-Patterns]

### IPC Channels Needed

| Channel | Type | Declared in | Handler location |
|---|---|---|---|
| `stories:list` | invoke | `src/shared/ipc-channels.ts` (`IpcInvokeChannels`) | `src/main/ipc/handlers.ts` calling `story-parser.ts` |

The `stories:list` IPC channel should already be declared in the type map from Story 1.1. Story 1.4 implements the actual handler.

```typescript
// In src/main/ipc/handlers.ts
import { parseProjectHierarchy } from '@main/services/project/story-parser';

// Inside registerInvokeHandlers():
ipcMain.handle('stories:list', async () => {
  const projectPath = getActiveProjectPath(); // From project loader (Story 1.3)
  return parseProjectHierarchy(projectPath);
});
```

[Source: architecture.md#IPC-Channel-Design]

### Command Palette (Cmd+K)

Install shadcn Command component:
```bash
npx shadcn@latest add command
npx shadcn@latest add dialog
```

The Command component is based on `cmdk` (by pacocoursey) which provides search, keyboard navigation, and grouping out of the box. [Source: ux-design-specification.md#Design-System-Components]

```tsx
// src/renderer/src/shared/components/CommandPalette.tsx
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@renderer/components/ui/command';
import { useNavigationStore } from '@renderer/stores/navigation.store';
import { useShallow } from 'zustand/react/shallow';
import { useEffect, useState } from 'react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { hierarchy, navigateTo, selectEpic, selectStory } = useNavigationStore(
    useShallow((s) => ({
      hierarchy: s.hierarchy,
      navigateTo: s.navigateTo,
      selectEpic: s.selectEpic,
      selectStory: s.selectStory,
    }))
  );

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (hierarchy.status !== 'success') return null;

  const data = hierarchy.data;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Naviguer vers..." />
      <CommandList>
        <CommandEmpty>Aucun resultat.</CommandEmpty>
        <CommandGroup heading="Epics">
          {data.epics.map((epic) => (
            <CommandItem
              key={epic.id}
              value={`Epic ${epic.number} ${epic.title}`}
              onSelect={() => {
                selectEpic(epic.id);
                setOpen(false);
              }}
            >
              Epic {epic.number}: {epic.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Stories">
          {data.epics.flatMap((epic) =>
            epic.stories.map((story) => (
              <CommandItem
                key={story.id}
                value={`Story ${story.number} ${story.title}`}
                onSelect={() => {
                  selectEpic(epic.id);
                  selectStory(story.id);
                  setOpen(false);
                }}
              >
                Story {story.number}: {story.title}
              </CommandItem>
            ))
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

[Source: ux-design-specification.md#Component-Strategy] [Source: ux-design-specification.md#Keyboard-Shortcuts]

### Keyboard Navigation

| Shortcut | Action | Scope | Implementation |
|---|---|---|---|
| `ArrowUp` / `ArrowDown` | Move focus between tree nodes | NavigationSidebar (when tree has focus) | Managed via `role="tree"` + `tabindex` roving |
| `ArrowRight` | Expand node / move to first child | NavigationSidebar tree node | `toggleExpanded(id)` if collapsed |
| `ArrowLeft` | Collapse node / move to parent | NavigationSidebar tree node | `toggleExpanded(id)` if expanded |
| `Enter` | Select focused node (triggers pane sync) | NavigationSidebar tree node | `navigateTo(level, id)` |
| `Esc` | Navigate up one level in hierarchy | Global (when not in input/dialog) | `navigateUp()` on navigation store |
| `1` | Focus Context pane (left) | Global (when not in input) | `.focus()` on left pane container |
| `2` | Focus Agents pane (center) | Global (when not in input) | `.focus()` on center pane container |
| `3` | Focus Tests pane (right) | Global (when not in input) | `.focus()` on right pane container |
| `Cmd+K` / `Ctrl+K` | Open/close command palette | Global | Toggle CommandPalette dialog |

[Source: ux-design-specification.md#Keyboard-Shortcuts] [Source: ux-design-specification.md#Navigation-Patterns]

**Implementation note for `useKeyboardShortcuts`:**

```typescript
// src/renderer/src/shared/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { useNavigationStore } from '@renderer/stores/navigation.store';

export function useKeyboardShortcuts() {
  const navigateUp = useNavigationStore((s) => s.navigateUp);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Also skip if a dialog (command palette) is open
      if (document.querySelector('[role="dialog"]')) {
        if (e.key !== 'Escape') return; // Allow Esc to close dialog
      }

      switch (e.key) {
        case 'Escape':
          navigateUp();
          break;
        case '1':
          document.querySelector<HTMLElement>('[data-pane="context"]')?.focus();
          break;
        case '2':
          document.querySelector<HTMLElement>('[data-pane="agents"]')?.focus();
          break;
        case '3':
          document.querySelector<HTMLElement>('[data-pane="tests"]')?.focus();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateUp]);
}
```

### Accessibility Requirements

| Requirement | Implementation | WCAG Criterion |
|---|---|---|
| Tree view ARIA roles | `role="tree"`, `role="treeitem"`, `role="group"` | 4.1.2 Name, Role, Value |
| Expand/collapse state | `aria-expanded="true/false"` on parent nodes | 4.1.2 |
| Selection state | `aria-selected="true"` on active node | 4.1.2 |
| Tree level indication | `aria-level="1/2/3"` on each node | 1.3.1 Info and Relationships |
| Breadcrumb landmark | `<nav aria-label="Breadcrumb">` | 1.3.1 |
| Current page in breadcrumb | `aria-current="page"` on last segment | 1.3.1 |
| Focus management | Roving tabindex in tree (only selected node is `tabindex="0"`) | 2.4.3 Focus Order |
| Focus visible | 2px ring `--accent` on keyboard focus | 2.4.7 Focus Visible |
| Screen reader announcements | `aria-live="polite"` region announcing current navigation level on change | 4.1.3 Status Messages |
| Keyboard operability | Full tree navigation via arrow keys, Enter, Esc | 2.1.1 Keyboard |
| Skip links | Skip to sidebar, skip to main content links at top of AppShell | 2.4.1 Bypass Blocks |

[Source: ux-design-specification.md#Accessibility-Strategy] [Source: ux-design-specification.md#Implementation-Guidelines]

### UX Patterns From Spec

- **Breadcrumb**: Clickable at each level. Separator is `>`. Current level is non-clickable. Inspiration: Linear's hierarchical navigation. [Source: ux-design-specification.md#Transferable-UX-Patterns]
- **Panel switching contextuel**: When user clicks a Story in sidebar, all 3 panes update to show content relevant to that Story. The sync is automatic and instant. [Source: ux-design-specification.md#Navigation-Patterns]
- **Command palette (Cmd+K)**: Quick access to any Epic, Story, or Task via fuzzy search. Inspiration: Linear. [Source: ux-design-specification.md#Transferable-UX-Patterns]
- **Progressive disclosure**: Sidebar tree is collapsed by default. User expands to reveal deeper levels. Each pane shows summary first, detail on interaction. [Source: ux-design-specification.md#Experience-Principles]
- **Skeleton loading**: While hierarchy is loading (`AsyncState.loading`), show skeleton placeholders. Never a blank screen. [Source: ux-design-specification.md#Empty-States-and-Loading]

### shadcn Components to Install

| Component | Install command | Usage in Story 1.4 |
|---|---|---|
| `command` | `npx shadcn@latest add command` | Command palette (Cmd+K) — based on cmdk |
| `dialog` | `npx shadcn@latest add dialog` | CommandDialog wrapper for Cmd+K |

Note: `Resizable` (for ThreePaneLayout) and `Button` should already be installed by Story 1.2. If not available, install them:
```bash
npx shadcn@latest add resizable button
```

### Project File Structure (Story 1.4 scope)

```
src/
  main/
    services/
      project/
        story-parser.ts              # NEW — Parse epics.md into ProjectHierarchy
        story-parser.test.ts         # NEW — Unit tests for parser
    ipc/
      handlers.ts                    # MODIFIED — Add stories:list handler
  renderer/
    src/
      shared/
        layout/
          NavigationSidebar.tsx       # NEW — Tree view sidebar
          NavigationSidebar.test.tsx  # NEW — Sidebar tests
          AppHeader.tsx              # MODIFIED — Add breadcrumb
          AppHeader.test.tsx         # NEW — Breadcrumb tests
          AppShell.tsx               # MODIFIED — Integrate sidebar + shortcuts
        components/
          CommandPalette.tsx          # NEW — Cmd+K command palette
          CommandPalette.test.tsx     # NEW — Palette tests
        hooks/
          useNavigationSync.ts       # NEW — Pane sync hook
          useNavigationSync.test.ts  # NEW — Sync tests
          useKeyboardShortcuts.ts    # NEW — Global keyboard shortcuts
          useKeyboardShortcuts.test.ts # NEW
      stores/
        navigation.store.ts          # NEW — Zustand navigation store
        navigation.store.test.ts     # NEW — Store tests
      components/
        ui/
          command.tsx                # AUTO — Generated by shadcn CLI
          dialog.tsx                 # AUTO — Generated by shadcn CLI (if not already)
  shared/
    types/
      navigation.types.ts           # NEW — NavigationLevel, NavigationNode, BreadcrumbSegment
      story.types.ts                 # NEW — EpicInfo, StoryInfo, TaskInfo, ProjectHierarchy
    ipc-channels.ts                  # MODIFIED — Verify stories:list is declared
```

### What NOT to Do

- **Do NOT implement actual pane content.** Context files (ContextFileCard), agents (AgentCard), and tests (TestHierarchy) are Epic 2, 3, and 7 respectively. Story 1.4 only builds the navigation skeleton that will DRIVE pane content. Panes show placeholder text indicating what will go there.
- **Do NOT implement file watching or Git features.** Those are Epic 3 (Story 3.1). The story parser reads files once on project load; it does not watch for changes.
- **Do NOT implement the full cockpit dashboard.** That is Epic 5. Story 1.4 provides the navigation store that the cockpit will use to link to stories, but the dashboard itself is not built here.
- **Do NOT create agent, drift, or workflow features.** Those are Epics 2, 4, and 6. The navigation store and sidebar are generic and will be consumed by those features later.
- **Do NOT implement drag & drop.** That is Story 3.3 (Context drag & drop).
- **Do NOT use `export default`.** Named exports only. [Source: architecture.md#Format-Patterns]
- **Do NOT use `any`.** Use `unknown` + type guards. [Source: architecture.md#Format-Patterns]
- **Do NOT use `forwardRef`.** React 19 supports `ref` as a regular prop. [Source: Story 1.1 Dev Notes]
- **Do NOT create a `tailwind.config.ts` file.** Tailwind 4 uses CSS-only config. [Source: Story 1.1 Dev Notes]
- **Do NOT persist navigation state to disk yet.** `project-state.json` persistence is a nice-to-have for later. The store is in-memory for now.

### References

- [Source: epics.md#Story-1.4] -- Story definition, acceptance criteria
- [Source: epics.md#FR-Coverage-Map] -- FR38 -> Epic 1
- [Source: architecture.md#IPC-Channel-Design] -- `stories:list` IPC channel declaration
- [Source: architecture.md#Event-Bus-Architecture] -- `nav:select` renderer event
- [Source: architecture.md#GAP-2-BMAD-Story-Parser] -- Story parser service design, StoryProgress type
- [Source: architecture.md#Frontend-Component-Architecture] -- Feature-based + shared layer structure
- [Source: architecture.md#Complete-Project-Directory-Structure] -- NavigationSidebar.tsx, navigation.store.ts locations
- [Source: architecture.md#Communication-Patterns] -- Zustand store pattern, useShallow, actions-in-store rule
- [Source: architecture.md#Architectural-Boundaries] -- Feature-to-feature via shared stores, boundary rules
- [Source: architecture.md#Naming-Patterns] -- File naming, variable naming conventions
- [Source: architecture.md#Format-Patterns] -- TypeScript rules, AppError, AsyncState
- [Source: architecture.md#Requirements-to-Structure-Mapping] -- FR37-FR40 -> shared/layout + stores
- [Source: ux-design-specification.md#Navigation-Patterns] -- Sidebar hierarchy, breadcrumb, Cmd+K, Esc, volet sync
- [Source: ux-design-specification.md#Keyboard-Shortcuts] -- All keyboard shortcuts (1/2/3, Esc, Cmd+K, arrows)
- [Source: ux-design-specification.md#Transferable-UX-Patterns] -- Linear breadcrumb, Cmd+K, panel switching
- [Source: ux-design-specification.md#Component-Strategy] -- shadcn Command component for palette
- [Source: ux-design-specification.md#Implementation-Approach] -- AppHeader with breadcrumb + Command palette
- [Source: ux-design-specification.md#Accessibility-Strategy] -- WCAG 2.1 AA, keyboard-first, Radix ARIA
- [Source: ux-design-specification.md#Implementation-Guidelines] -- ARIA tree, focus management, tabindex, skip links
- [Source: ux-design-specification.md#Empty-States-and-Loading] -- Skeleton loading, never blank screen
- [Source: ux-design-specification.md#Design-System-Foundation] -- shadcn/ui + Radix UI
- [Source: ux-design-specification.md#Experience-Principles] -- Glance-first, progressive disclosure
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] -- IPC hooks, event bus, preload bridge, import aliases, naming conventions

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
