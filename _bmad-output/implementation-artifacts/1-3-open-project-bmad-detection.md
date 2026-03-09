# Story 1.3: Open Project & BMAD Detection

Status: ready-for-dev

## Story

As a **user**,
I want **to open a Git project directory and have MnM detect the BMAD structure**,
So that **my project is loaded and ready for supervision**.

## Acceptance Criteria

### AC1 — First launch "Ouvrir un projet" screen

**Given** aucun projet n'est ouvert
**When** je lance MnM
**Then** je vois l'ecran "Ouvrir un projet" avec un bouton de selection de repertoire

### AC2 — Open project with BMAD detection

**Given** je clique sur "Ouvrir un projet"
**When** je selectionne un repertoire Git contenant `_bmad/` et `_bmad-output/`
**Then** MnM charge le projet et affiche son nom dans le header
**And** la structure BMAD est detectee et la sidebar affiche la hierarchie

### AC3 — Error on non-Git directory

**Given** je selectionne un repertoire sans `.git`
**When** MnM tente de charger
**Then** un message d'erreur inline s'affiche : "Ce repertoire n'est pas un repo Git"

### AC4 — Warning on Git repo without BMAD

**Given** je selectionne un repo Git sans `_bmad/`
**When** MnM charge le projet
**Then** le projet s'ouvre mais un avertissement s'affiche : "Structure BMAD non detectee"

### AC5 — `.mnm/` directory initialization

**Given** un projet est charge
**When** les fichiers `.mnm/` n'existent pas encore
**Then** MnM cree le repertoire `.mnm/` avec `settings.json` et `project-state.json` par defaut

## Tasks / Subtasks

- [ ] Task 1: Create shared project types (AC: #2, #4, #5)
  - [ ] 1.1 Create `src/shared/types/project.types.ts` with `ProjectInfo`, `BmadStructure`, `ProjectSettings`, `ProjectState` types
  - [ ] 1.2 Ensure types are re-exported from `src/shared/types/` barrel (if exists) or importable via `@shared/types/project.types`

- [ ] Task 2: Create BMAD detector service (AC: #2, #4)
  - [ ] 2.1 Create `src/main/services/project/bmad-detector.ts` with `detectBmadStructure(projectPath: string): Promise<BmadStructure>` function
  - [ ] 2.2 Implement detection logic: check for `_bmad/` dir, `_bmad-output/` dir, scan for workflow files (`.yaml`, `.md`) inside `_bmad/`
  - [ ] 2.3 Return a `BmadStructure` object with `hasBmad`, `hasBmadOutput`, `workflowFiles[]`, `agentFiles[]`, `outputArtifacts[]`
  - [ ] 2.4 Write unit test `src/main/services/project/bmad-detector.test.ts` with mocked filesystem (mock `fs.promises`)

- [ ] Task 3: Create project loader service (AC: #2, #3, #4, #5)
  - [ ] 3.1 Create `src/main/services/project/project-loader.service.ts` with `loadProject(directoryPath: string): Promise<ProjectInfo>` function
  - [ ] 3.2 Implement Git validation: check for `.git` directory using `fs.promises.access()`. If absent, throw `AppError` with code `NOT_GIT_REPO`
  - [ ] 3.3 Call `detectBmadStructure()` on the directory
  - [ ] 3.4 Create `.mnm/` directory if it does not exist, with default `settings.json` and `project-state.json`
  - [ ] 3.5 Read existing `.mnm/settings.json` if present (merge with defaults)
  - [ ] 3.6 Extract project name from directory basename (or from `package.json` name field if present)
  - [ ] 3.7 Return a complete `ProjectInfo` object
  - [ ] 3.8 Write unit test `src/main/services/project/project-loader.service.test.ts` with mocked filesystem and mocked bmad-detector

- [ ] Task 4: Create project types file for main services (AC: #2)
  - [ ] 4.1 Create `src/main/services/project/project.types.ts` for internal main-process types if needed (or reuse shared types directly)

- [ ] Task 5: Implement `project:open` IPC handler (AC: #1, #2, #3, #4)
  - [ ] 5.1 In `src/main/ipc/handlers.ts`, replace the placeholder `project:open` handler with the real implementation
  - [ ] 5.2 Handler logic: if `args.path` is empty/undefined, show `dialog.showOpenDialog({ properties: ['openDirectory'] })` and use the selected path
  - [ ] 5.3 If `args.path` is provided, use it directly (for recent projects)
  - [ ] 5.4 Call `loadProject(path)` and return the `ProjectInfo` result
  - [ ] 5.5 Catch errors and return normalized `AppError` (codes: `NOT_GIT_REPO`, `INVALID_DIRECTORY`, `PERMISSION_DENIED`, `PROJECT_LOAD_FAILED`)
  - [ ] 5.6 On success, store the project path in main process state for reference by other services

- [ ] Task 6: Create Zustand project store (AC: #1, #2, #3, #4)
  - [ ] 6.1 Create `src/renderer/src/stores/project.store.ts` with project state using `AsyncState<ProjectInfo>` pattern
  - [ ] 6.2 Implement actions: `openProject(path?: string)`, `clearProject()`, `setError(error: AppError)`
  - [ ] 6.3 `openProject` calls `window.electronAPI.invoke('project:open', { path })` and updates store state through `idle` -> `loading` -> `success`/`error`
  - [ ] 6.4 Write unit test `src/renderer/src/stores/project.store.test.ts`

- [ ] Task 7: Create "Ouvrir un projet" screen component (AC: #1)
  - [ ] 7.1 Create `src/renderer/src/shared/layout/OpenProjectScreen.tsx` — full-screen centered layout replacing the 3-pane layout when no project is loaded
  - [ ] 7.2 Display: MnM logo/title, "Ouvrir un projet" heading, directory selection button (primary style), recent projects list (from store, initially empty)
  - [ ] 7.3 On button click, call `openProject()` action from project store (no path = triggers native dialog)
  - [ ] 7.4 Show inline error messages for `NOT_GIT_REPO`, `INVALID_DIRECTORY`, `PERMISSION_DENIED`
  - [ ] 7.5 Show loading skeleton while project loads
  - [ ] 7.6 Style with design tokens: `bg-bg-base`, centered `text-text-primary`, button with `bg-accent`
  - [ ] 7.7 Add keyboard support: `Enter` triggers the open button when focused
  - [ ] 7.8 Write unit test `src/renderer/src/shared/layout/OpenProjectScreen.test.tsx`

- [ ] Task 8: Create BMAD warning banner component (AC: #4)
  - [ ] 8.1 Create `src/renderer/src/shared/components/BmadWarningBanner.tsx` — inline warning banner displayed when project is loaded but BMAD is not detected
  - [ ] 8.2 Display: warning icon + "Structure BMAD non detectee" text + description of what's expected (`_bmad/`, `_bmad-output/`)
  - [ ] 8.3 Style with `bg-status-orange/10`, `text-status-orange`, `border-status-orange/30`
  - [ ] 8.4 Include a dismiss button (ghost style)

- [ ] Task 9: Wire AppShell to conditionally render OpenProjectScreen or ThreePaneLayout (AC: #1, #2)
  - [ ] 9.1 Update `src/renderer/src/shared/layout/AppShell.tsx` to read project store state
  - [ ] 9.2 When `project.status === 'idle'` or `project.status === 'error'`, render `<OpenProjectScreen />`
  - [ ] 9.3 When `project.status === 'loading'`, render loading skeleton
  - [ ] 9.4 When `project.status === 'success'`, render `<AppHeader />` + `<ThreePaneLayout />` + `<TimelineBar />`
  - [ ] 9.5 When BMAD is not detected (`project.data.bmadStructure.hasBmad === false`), render `<BmadWarningBanner />` above `<ThreePaneLayout />`

- [ ] Task 10: Update AppHeader with project name (AC: #2)
  - [ ] 10.1 Update `src/renderer/src/shared/layout/AppHeader.tsx` to display `project.data.name` from project store when loaded
  - [ ] 10.2 Display BMAD indicator badge next to project name (green if BMAD detected, gray if not)

- [ ] Task 11: Integration verification (AC: #1, #2, #3, #4, #5)
  - [ ] 11.1 Verify: launch MnM with no project -> "Ouvrir un projet" screen appears
  - [ ] 11.2 Verify: select a Git + BMAD directory -> project loads, name shows in header, no warning
  - [ ] 11.3 Verify: select a non-Git directory -> inline error "Ce repertoire n'est pas un repo Git"
  - [ ] 11.4 Verify: select a Git directory without `_bmad/` -> project loads with BMAD warning banner
  - [ ] 11.5 Verify: `.mnm/` directory is created with `settings.json` and `project-state.json`
  - [ ] 11.6 Verify: `npm run build` produces working production build
  - [ ] 11.7 Run `npx vitest run` — all tests pass (existing + new)

## Dev Notes

### FRs Covered

| FR | Description | How addressed |
|---|---|---|
| FR45 | L'utilisateur peut ouvrir un projet en selectionnant un repertoire Git local | `project:open` IPC handler with `dialog.showOpenDialog()`, Git validation in `project-loader.service.ts` |
| FR46 | Le systeme peut detecter automatiquement la structure BMAD dans un repertoire de projet (presence de `_bmad/`, `_bmad-output/`, fichiers de workflow) | `bmad-detector.ts` scans the directory for BMAD markers and returns `BmadStructure` |

### Dependencies on Story 1.1

Story 1.3 builds directly on the IPC bridge, event bus, and type system established by Story 1.1. The following files and patterns from 1.1 MUST be reused:

| From Story 1.1 | Usage in Story 1.3 |
|---|---|
| `src/shared/ipc-channels.ts` | `IpcInvokeChannels['project:open']` is already declared with `{ args: { path: string }; result: ProjectInfo }`. Story 1.3 implements the real handler. |
| `src/main/ipc/handlers.ts` | Contains `registerInvokeHandlers()` with a placeholder `project:open` handler. Story 1.3 replaces it with the real implementation. |
| `src/main/ipc/streams.ts` | `createStreamSender()` is available if needed for streaming project events (not primary in 1.3 but available). |
| `src/preload/index.ts` + `src/preload/api.ts` | Typed `window.electronAPI.invoke('project:open', ...)` — already exposed via contextBridge. |
| `src/renderer/src/shared/hooks/useIpcInvoke.ts` | Typed hook for calling IPC invoke from renderer components. Used in `openProject` action. |
| `src/shared/types/error.types.ts` | `AppError` type used for error normalization. |
| `src/shared/types/async-state.types.ts` | `AsyncState<T>` discriminated union pattern used in the project store. |
| `src/main/utils/logger.ts` | Logger for main process diagnostics: `logger.info('project-loader', 'Project loaded', { path })`. |
| `src/main/utils/event-bus.ts` | Typed EventEmitter wrapper — can emit project-related events if needed. |
| `electron.vite.config.ts` | Import aliases (`@main/`, `@renderer/`, `@shared/`) already configured. |
| `vitest.config.ts` | Test config with jsdom environment, path aliases, co-located test pattern. |
| Naming conventions | kebab-case services, PascalCase components, named exports only, no `export default`. |

[Source: 1-1-project-scaffold-ipc-bridge-event-bus.md]

### Dependencies on Story 1.2

Story 1.3 depends on the layout shell created in Story 1.2:

| From Story 1.2 | Usage in Story 1.3 |
|---|---|
| `src/renderer/src/shared/layout/AppShell.tsx` | Story 1.3 modifies AppShell to conditionally render `<OpenProjectScreen />` when no project is loaded, or `<ThreePaneLayout />` when a project is loaded. |
| `src/renderer/src/shared/layout/AppHeader.tsx` | Story 1.3 updates AppHeader to display the loaded project name and BMAD indicator badge. AppHeader currently has placeholder text. |
| `src/renderer/src/shared/layout/ThreePaneLayout.tsx` | The 3-pane layout is shown only after a project is successfully loaded. |
| `src/renderer/src/shared/layout/TimelineBar.tsx` | Timeline is shown only after project load. |
| `src/renderer/src/shared/layout/PaneEmptyState.tsx` | Reuse empty state pattern for the "no project" state. |
| `src/renderer/src/stores/navigation.store.ts` | Navigation store already exists. Project store is a new separate store (one store per feature). |
| `src/renderer/src/components/ui/toast.tsx` | Toast component already installed. Used for BMAD warning dismiss and error feedback. |
| Design tokens in `src/renderer/src/app.css` | All color, font, and spacing tokens already defined. |

[Source: 1-2-three-pane-resizable-layout-with-timeline-bar.md]

### Main Process Services to Create

#### `src/main/services/project/project.types.ts`

Internal types for the project service domain. The shared types in `src/shared/types/project.types.ts` are what gets transmitted over IPC.

#### `src/main/services/project/bmad-detector.ts`

Scans a project directory for BMAD structure indicators. Pure function, no side effects.

```typescript
// src/main/services/project/bmad-detector.ts
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { BmadStructure } from '@shared/types/project.types';

export async function detectBmadStructure(projectPath: string): Promise<BmadStructure> {
  const bmadDir = join(projectPath, '_bmad');
  const bmadOutputDir = join(projectPath, '_bmad-output');

  const hasBmad = await directoryExists(bmadDir);
  const hasBmadOutput = await directoryExists(bmadOutputDir);

  let workflowFiles: string[] = [];
  let agentFiles: string[] = [];
  let outputArtifacts: string[] = [];

  if (hasBmad) {
    const entries = await scanDirectory(bmadDir);
    workflowFiles = entries.filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.md')
    );
    agentFiles = entries.filter(
      (f) => f.includes('/agents/') || f.includes('/personas/')
    );
  }

  if (hasBmadOutput) {
    outputArtifacts = await scanDirectory(bmadOutputDir);
  }

  return {
    detected: hasBmad,
    hasBmadDir: hasBmad,
    hasBmadOutputDir: hasBmadOutput,
    workflowFiles,
    agentFiles,
    outputArtifacts,
  };
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function scanDirectory(dirPath: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const relativePath = join(entry.parentPath ?? entry.path, entry.name);
        results.push(relativePath);
      }
    }
  } catch {
    // Directory not readable — return empty
  }
  return results;
}
```

[Source: architecture.md#Complete-Project-Directory-Structure — `services/project/bmad-detector.ts`]
[Source: epics.md — FR46: detect `_bmad/`, `_bmad-output/`, workflow files]

#### `src/main/services/project/project-loader.service.ts`

Orchestrates the full project loading flow: validate Git, detect BMAD, initialize `.mnm/`, return ProjectInfo.

```typescript
// src/main/services/project/project-loader.service.ts
import { promises as fs } from 'node:fs';
import { join, basename } from 'node:path';
import type { ProjectInfo } from '@shared/types/project.types';
import type { AppError } from '@shared/types/error.types';
import { detectBmadStructure } from '@main/services/project/bmad-detector';
import { logger } from '@main/utils/logger';

const DEFAULT_SETTINGS = {
  version: 1,
  driftThreshold: 50,
  recentProjects: [] as string[],
};

const DEFAULT_PROJECT_STATE = {
  version: 1,
  lastOpenedAt: null as string | null,
  navigationState: null,
};

export async function loadProject(directoryPath: string): Promise<ProjectInfo> {
  logger.info('project-loader', 'Loading project', { path: directoryPath });

  // 1. Validate directory exists
  try {
    const stat = await fs.stat(directoryPath);
    if (!stat.isDirectory()) {
      throw createAppError('INVALID_DIRECTORY', 'Le chemin specifie n\'est pas un repertoire', directoryPath);
    }
  } catch (err) {
    if ((err as AppError).code === 'INVALID_DIRECTORY') throw err;
    throw createAppError('INVALID_DIRECTORY', 'Repertoire inaccessible', directoryPath);
  }

  // 2. Validate Git repo
  const gitDir = join(directoryPath, '.git');
  try {
    await fs.access(gitDir);
  } catch {
    throw createAppError('NOT_GIT_REPO', 'Ce repertoire n\'est pas un repo Git', directoryPath);
  }

  // 3. Detect BMAD structure
  const bmadStructure = await detectBmadStructure(directoryPath);

  // 4. Initialize .mnm/ directory
  const mnmDir = join(directoryPath, '.mnm');
  await initializeMnmDirectory(mnmDir);

  // 5. Read or create settings
  const settingsPath = join(mnmDir, 'settings.json');
  const settings = await readOrCreateJson(settingsPath, DEFAULT_SETTINGS);

  // 6. Update project state
  const projectStatePath = join(mnmDir, 'project-state.json');
  const projectState = {
    ...DEFAULT_PROJECT_STATE,
    lastOpenedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(projectStatePath, projectState);

  // 7. Extract project name
  const name = await resolveProjectName(directoryPath);

  logger.info('project-loader', 'Project loaded successfully', {
    path: directoryPath,
    name,
    bmadDetected: bmadStructure.detected,
  });

  return {
    path: directoryPath,
    name,
    bmadStructure,
    settings,
  };
}

function createAppError(code: string, message: string, path: string): AppError {
  return {
    code,
    message,
    source: 'project-loader',
    details: { path },
  };
}

async function initializeMnmDirectory(mnmDir: string): Promise<void> {
  try {
    await fs.mkdir(mnmDir, { recursive: true });
  } catch (err) {
    throw createAppError('PERMISSION_DENIED', 'Impossible de creer le repertoire .mnm/', mnmDir);
  }
}

async function readOrCreateJson<T extends Record<string, unknown>>(
  filePath: string,
  defaults: T
): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<T>;
    return { ...defaults, ...parsed };
  } catch {
    await writeJsonAtomic(filePath, defaults);
    return defaults;
  }
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tempPath = filePath + '.tmp';
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
}

async function resolveProjectName(directoryPath: string): Promise<string> {
  try {
    const pkgPath = join(directoryPath, 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);
    if (typeof pkg.name === 'string' && pkg.name.length > 0) {
      return pkg.name;
    }
  } catch {
    // No package.json or invalid — fallback to directory name
  }
  return basename(directoryPath);
}
```

[Source: architecture.md#Local-Data-Persistence — `.mnm/` structure, atomic writes]
[Source: architecture.md#Process-Patterns — AppError normalization, logging]

### Shared Types — `src/shared/types/project.types.ts`

```typescript
// src/shared/types/project.types.ts

export type BmadStructure = {
  detected: boolean;
  hasBmadDir: boolean;
  hasBmadOutputDir: boolean;
  workflowFiles: string[];
  agentFiles: string[];
  outputArtifacts: string[];
};

export type ProjectSettings = {
  version: number;
  driftThreshold: number;
  recentProjects: string[];
  apiKey?: string;
};

export type ProjectState = {
  version: number;
  lastOpenedAt: string | null;
  navigationState: unknown;
};

export type ProjectInfo = {
  path: string;
  name: string;
  bmadStructure: BmadStructure;
  settings: ProjectSettings;
};
```

[Source: architecture.md#Local-Data-Persistence — settings.json structure]
[Source: architecture.md#Complete-Project-Directory-Structure — `src/shared/types/project.types.ts`]

### IPC Flow

The complete flow for opening a project:

```
Renderer                          Preload                         Main Process
   |                                |                                |
   | user clicks "Ouvrir un projet" |                                |
   |-------- invoke('project:open', { path: '' }) ------------------>|
   |                                |                                |
   |                                |      args.path is empty:       |
   |                                |      dialog.showOpenDialog()   |
   |                                |      user selects directory    |
   |                                |                                |
   |                                |      loadProject(selectedPath) |
   |                                |        -> validate .git        |
   |                                |        -> detectBmadStructure  |
   |                                |        -> init .mnm/           |
   |                                |        -> read settings        |
   |                                |        -> build ProjectInfo    |
   |                                |                                |
   |<---------- ProjectInfo result ---------------------------------|
   |                                |                                |
   | useProjectStore.openProject()  |                                |
   | -> status: loading -> success  |                                |
   | -> AppShell re-renders         |                                |
   |    -> hides OpenProjectScreen  |                                |
   |    -> shows AppHeader + Layout |                                |
```

[Source: architecture.md#IPC-Channel-Design — `project:open` channel]
[Source: architecture.md#Data-Flow — Filesystem -> Services -> IPC -> Zustand -> React UI]

### IPC Handler Implementation

```typescript
// In src/main/ipc/handlers.ts — replace placeholder project:open handler

import { dialog, BrowserWindow } from 'electron';
import { loadProject } from '@main/services/project/project-loader.service';

// Inside registerInvokeHandlers():
ipcMain.handle('project:open', async (_event, args: { path: string }) => {
  try {
    let projectPath = args.path;

    if (!projectPath) {
      const mainWindow = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory'],
        title: 'Ouvrir un projet',
        buttonLabel: 'Ouvrir',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: { code: 'USER_CANCELLED', message: 'Selection annulee', source: 'project:open' } };
      }

      projectPath = result.filePaths[0];
    }

    const projectInfo = await loadProject(projectPath);
    return { success: true, data: projectInfo };
  } catch (error) {
    const appError = error as AppError;
    return {
      success: false,
      error: {
        code: appError.code ?? 'PROJECT_LOAD_FAILED',
        message: appError.message ?? 'Erreur lors du chargement du projet',
        source: appError.source ?? 'project:open',
        details: appError.details,
      },
    };
  }
});
```

**Note on IPC return pattern:** The handler wraps responses in `{ success: true, data }` or `{ success: false, error }`. This is consistent with the `AppError` normalization pattern from Story 1.1 where all main process errors are normalized before IPC transmission.

[Source: architecture.md#Process-Patterns — Error handling by layer, IPC invoke handlers]

### Zustand Project Store

```typescript
// src/renderer/src/stores/project.store.ts
import { create } from 'zustand';
import type { ProjectInfo } from '@shared/types/project.types';
import type { AppError } from '@shared/types/error.types';
import type { AsyncState } from '@shared/types/async-state.types';

type ProjectStoreState = {
  project: AsyncState<ProjectInfo>;
  openProject: (path?: string) => Promise<void>;
  clearProject: () => void;
};

export const useProjectStore = create<ProjectStoreState>((set) => ({
  project: { status: 'idle' },

  openProject: async (path?: string) => {
    set({ project: { status: 'loading' } });

    try {
      const result = await window.electronAPI.invoke('project:open', {
        path: path ?? '',
      });

      if (result.success) {
        set({ project: { status: 'success', data: result.data } });
      } else {
        if (result.error.code === 'USER_CANCELLED') {
          set({ project: { status: 'idle' } });
          return;
        }
        set({ project: { status: 'error', error: result.error } });
      }
    } catch (err) {
      set({
        project: {
          status: 'error',
          error: {
            code: 'IPC_ERROR',
            message: 'Erreur de communication avec le processus principal',
            source: 'project-store',
          },
        },
      });
    }
  },

  clearProject: () => set({ project: { status: 'idle' } }),
}));
```

[Source: architecture.md#Communication-Patterns — Zustand store pattern, AsyncState, one store per feature]

### BMAD Detection Rules

The `bmad-detector.ts` checks for the following markers, derived from the MnM project structure and the BMAD framework convention:

| Marker | Path | Required for `detected: true` |
|---|---|---|
| BMAD directory | `{projectRoot}/_bmad/` | Yes (primary marker) |
| BMAD output directory | `{projectRoot}/_bmad-output/` | No (secondary marker) |
| Workflow files | `_bmad/**/*.yaml`, `_bmad/**/*.yml`, `_bmad/**/*.md` | No (informational) |
| Agent/persona files | `_bmad/**/agents/**`, `_bmad/**/personas/**` | No (informational) |

**Detection logic:**
- `detected` is `true` if and only if `_bmad/` directory exists
- `hasBmadOutputDir` is independently checked
- Workflow files and agent files are discovered via recursive directory scan
- The scan is non-blocking and tolerant (permission errors are silently caught)

[Source: epics.md — FR46: `_bmad/`, `_bmad-output/`, fichiers de workflow]
[Source: architecture.md#Requirements-to-Structure-Mapping — Project domain: `services/project/bmad-detector.ts`]

### `.mnm/` Directory Structure

```
.mnm/
├── settings.json            # User preferences (drift threshold, layout, API key)
└── project-state.json       # Last project state (navigation, panels, last opened)
```

**`settings.json` default content:**

```json
{
  "version": 1,
  "driftThreshold": 50,
  "recentProjects": []
}
```

**`project-state.json` default content:**

```json
{
  "version": 1,
  "lastOpenedAt": "2026-02-28T10:00:00.000Z",
  "navigationState": null
}
```

**Rules:**
- `.mnm/` MUST be added to the project's `.gitignore` (data is local, not versioned). Story 1.3 does NOT modify `.gitignore` automatically, but a warning in the UI or documentation should mention this.
- All writes are atomic: write to `.tmp` file then rename. This prevents corruption on crash.
- No schema migration at MVP. Format is simple and extensible.
- Additional directories (`drift-cache/`, `agent-history/`) are NOT created in Story 1.3. They will be created by their respective stories (4.x, 2.x).

[Source: architecture.md#Local-Data-Persistence — `.mnm/` structure, atomic writes, gitignore]

### First Launch UX

When no project is loaded (store status is `idle`), the `AppShell` renders the `OpenProjectScreen` instead of the 3-pane layout.

**`OpenProjectScreen` layout:**

```
+-----------------------------------------------------------+
|                                                           |
|                                                           |
|                      MnM                                  |
|              IDE de supervision agentique                 |
|                                                           |
|               [ Ouvrir un projet ]                        |
|                                                           |
|         Selectionnez un repertoire Git local              |
|                                                           |
|   --- Projets recents ---                                 |
|   (empty initially, populated from settings.json)         |
|                                                           |
|                                                           |
+-----------------------------------------------------------+
```

**Behavior:**
- Clicking "Ouvrir un projet" calls `openProject()` with no path, triggering `dialog.showOpenDialog()` in the main process
- Recent projects list shows entries from `settings.json.recentProjects` (populated after first successful load)
- Clicking a recent project calls `openProject(path)` with the stored path
- Inline error messages appear below the button area for errors (`NOT_GIT_REPO`, `INVALID_DIRECTORY`, `PERMISSION_DENIED`)
- Loading state shows a skeleton placeholder while the project loads

**Empty state rule:** Never a blank screen. The `OpenProjectScreen` is the empty state for "no project loaded".

[Source: ux-design-specification.md#Empty-States-&-Loading — "Premier lancement: Ecran 'Ouvrir un projet' + bouton selection repertoire"]
[Source: ux-design-specification.md#Experience-Mechanics — "1. Initiation: L'app s'ouvre sur le Dashboard Cockpit. Dernier projet charge automatiquement."]

### Error Handling

All errors follow the `AppError` pattern established in Story 1.1:

| Error Code | Trigger | User-Facing Message | Recovery |
|---|---|---|---|
| `NOT_GIT_REPO` | Selected directory has no `.git` folder | "Ce repertoire n'est pas un repo Git" | User selects a different directory |
| `INVALID_DIRECTORY` | Path doesn't exist or isn't a directory | "Repertoire invalide ou inaccessible" | User selects a different directory |
| `PERMISSION_DENIED` | Cannot read directory or create `.mnm/` | "Permission refusee. Verifiez les droits d'acces." | User fixes filesystem permissions |
| `PROJECT_LOAD_FAILED` | Unexpected error during loading | "Erreur lors du chargement du projet" | User retries or selects a different directory |
| `USER_CANCELLED` | User cancels the native file dialog | (no message, return to idle state) | No action needed |

**Error display strategy:**
- Errors are displayed inline on the `OpenProjectScreen`, below the "Ouvrir un projet" button
- Error messages use `text-status-red` color with a warning icon
- A "Reessayer" (retry) button is shown alongside the error message
- The error state does NOT block the user from trying again

[Source: architecture.md#Format-Patterns — AppError type]
[Source: architecture.md#Process-Patterns — Error handling by layer]
[Source: ux-design-specification.md#Feedback-Patterns — Error patterns: inline, no popup blocking]
[Source: ux-design-specification.md#Empty-States-&-Loading — "Erreur chargement: Message inline + bouton Reessayer"]

### Conditional Rendering in AppShell

```tsx
// Updated src/renderer/src/shared/layout/AppShell.tsx (conceptual)
import { useProjectStore } from '@renderer/stores/project.store';
import { OpenProjectScreen } from '@renderer/shared/layout/OpenProjectScreen';
import { BmadWarningBanner } from '@renderer/shared/components/BmadWarningBanner';

export function AppShell() {
  const { project } = useProjectStore();
  const { breakpoint, setBreakpoint } = useNavigationStore();

  // ... existing resize + keyboard handlers from Story 1.2

  // No project loaded — show OpenProjectScreen
  if (project.status === 'idle' || project.status === 'error') {
    return (
      <div className="flex h-screen flex-col bg-bg-base text-text-primary">
        <OpenProjectScreen error={project.status === 'error' ? project.error : undefined} />
      </div>
    );
  }

  // Loading project
  if (project.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base text-text-primary">
        {/* Skeleton loader */}
        <div className="animate-pulse text-text-muted">Chargement du projet...</div>
      </div>
    );
  }

  // Project loaded — render the full layout
  const showBmadWarning = !project.data.bmadStructure.detected;

  return (
    <div className="flex h-screen flex-col bg-bg-base text-text-primary">
      {/* Skip links */}
      {/* ... existing skip links from Story 1.2 ... */}

      <AppHeader projectName={project.data.name} bmadDetected={project.data.bmadStructure.detected} />

      {showBmadWarning && <BmadWarningBanner />}

      <main className="flex-1 overflow-hidden">
        <ThreePaneLayout />
      </main>

      <TimelineBar />

      {breakpoint === 'minimum' && <MinResolutionOverlay />}
    </div>
  );
}
```

[Source: 1-2-three-pane-resizable-layout-with-timeline-bar.md#AppShell-Structure-Pattern]

### Testing Strategy

**Unit tests for `bmad-detector.ts`:**
- Mock `fs.promises.stat`, `fs.promises.readdir` to simulate different directory structures
- Test case: directory with `_bmad/` and `_bmad-output/` containing workflow files -> `detected: true`, files listed
- Test case: directory with `_bmad/` but no `_bmad-output/` -> `detected: true`, `hasBmadOutputDir: false`
- Test case: directory with neither -> `detected: false`, empty arrays
- Test case: `_bmad/` exists but is not readable (permission error) -> `detected: false`, graceful handling

**Unit tests for `project-loader.service.ts`:**
- Mock `fs.promises`, mock `bmad-detector`
- Test case: valid Git + BMAD directory -> returns complete `ProjectInfo`
- Test case: non-Git directory -> throws `AppError` with code `NOT_GIT_REPO`
- Test case: non-existent directory -> throws `AppError` with code `INVALID_DIRECTORY`
- Test case: `.mnm/` doesn't exist -> creates it with default files
- Test case: `.mnm/settings.json` exists -> merges with defaults
- Test case: `package.json` with name field -> uses that as project name
- Test case: no `package.json` -> uses directory basename

**Unit tests for `project.store.ts`:**
- Mock `window.electronAPI.invoke`
- Test case: `openProject()` transitions from `idle` to `loading` to `success`
- Test case: `openProject()` with error transitions to `error` state
- Test case: `clearProject()` resets to `idle`
- Test case: user cancels dialog -> returns to `idle`

**Unit tests for `OpenProjectScreen.tsx`:**
- Renders "Ouvrir un projet" button
- Clicking button calls `openProject()`
- Displays error message when error is provided
- Shows loading state appropriately

**Integration verification:**
- Full round-trip: renderer calls IPC -> main shows dialog -> loads project -> renderer updates

### Component Architecture (Story 1.3 scope)

```
src/
├── main/
│   ├── ipc/
│   │   └── handlers.ts                # Updated: real project:open handler
│   └── services/
│       └── project/
│           ├── project-loader.service.ts       # NEW
│           ├── project-loader.service.test.ts  # NEW
│           ├── bmad-detector.ts                # NEW
│           ├── bmad-detector.test.ts           # NEW
│           └── project.types.ts                # NEW (optional, can reuse shared types)
├── renderer/
│   └── src/
│       ├── shared/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx                # UPDATED: conditional rendering
│       │   │   ├── AppHeader.tsx               # UPDATED: project name + BMAD badge
│       │   │   ├── OpenProjectScreen.tsx       # NEW
│       │   │   └── OpenProjectScreen.test.tsx  # NEW
│       │   └── components/
│       │       ├── BmadWarningBanner.tsx       # NEW
│       │       └── BmadWarningBanner.test.tsx  # NEW (optional)
│       └── stores/
│           ├── project.store.ts               # NEW
│           └── project.store.test.ts          # NEW
└── shared/
    └── types/
        └── project.types.ts                   # NEW
```

### Naming Conventions (must follow)

| Element | Convention | Example |
|---|---|---|
| Main services | kebab-case + `.service.ts` | `project-loader.service.ts` |
| Main utilities | kebab-case + `.ts` | `bmad-detector.ts` |
| Types files | kebab-case + `.types.ts` | `project.types.ts` |
| Tests | same name + `.test.ts` co-located | `bmad-detector.test.ts` |
| React components | PascalCase.tsx | `OpenProjectScreen.tsx` |
| Zustand stores | camelCase + `.store.ts` | `project.store.ts` |
| IPC channels | namespace:action kebab | `'project:open'` |
| Exports | Named exports only | `export function loadProject() {}` |

[Source: architecture.md#Naming-Patterns]

### What NOT to Do

- **Do NOT implement file watching.** File watching (`chokidar`) comes in Story 3.1. Story 1.3 only detects the initial project structure.
- **Do NOT implement Git service beyond basic `.git` detection.** Full Git integration (`simple-git`, commit history, branches, diffs) comes in Story 3.1. Story 1.3 only checks for the presence of `.git` directory.
- **Do NOT build the navigation tree / sidebar hierarchy.** Hierarchical navigation (Projet -> Epic -> Story -> Tache) comes in Story 1.4. Story 1.3 loads the project and detects BMAD, but does not parse the hierarchy.
- **Do NOT parse BMAD workflow files.** Workflow file parsing (YAML/Markdown -> graph structure) comes in Story 6.1. Story 1.3 only lists the files found.
- **Do NOT parse story files for progress.** Story parsing (`story-parser.ts`) comes in Story 5.3. Story 1.3 does not calculate task completion ratios.
- **Do NOT create `drift-cache/` or `agent-history/` directories.** These subdirectories of `.mnm/` are created by their respective features (Stories 4.x, 2.x).
- **Do NOT implement auto-reload of last project.** The UX spec mentions "Dernier projet charge automatiquement" as a future enhancement. For Story 1.3, always show the "Ouvrir un projet" screen on launch.
- **Do NOT use `export default`.** Named exports only.
- **Do NOT use `any` type.** Use `unknown` + type guards.
- **Do NOT hardcode color values.** Always use Tailwind utility classes referencing design tokens.
- **Do NOT use `forwardRef`.** React 19 supports `ref` as a regular prop.
- **Do NOT install new npm dependencies.** All required packages (`electron`, `fs`, `path`) are built-in. No external dependencies needed for Story 1.3.

### References

- [Source: epics.md#Story-1.3] -- User story, acceptance criteria, FR45/FR46 mapping
- [Source: architecture.md#IPC-Channel-Design] -- `project:open` channel definition in `IpcInvokeChannels`
- [Source: architecture.md#Local-Data-Persistence] -- `.mnm/` directory structure, `settings.json`, `project-state.json`, atomic writes, gitignore
- [Source: architecture.md#Complete-Project-Directory-Structure] -- `services/project/` directory, `bmad-detector.ts`, `project-loader.service.ts`, `project.types.ts` file paths
- [Source: architecture.md#Requirements-to-Structure-Mapping] -- FR45/FR46 -> `services/project/`
- [Source: architecture.md#Naming-Patterns] -- kebab-case services, PascalCase components, named exports
- [Source: architecture.md#Format-Patterns] -- `AppError` normalization, TypeScript conventions
- [Source: architecture.md#Process-Patterns] -- Error handling by layer, `AsyncState<T>`, logging format
- [Source: architecture.md#Communication-Patterns] -- Zustand store pattern, one store per feature
- [Source: architecture.md#Architectural-Boundaries] -- Renderer/Main boundary, shared types
- [Source: architecture.md#Data-Flow] -- Filesystem -> Services -> IPC -> Zustand -> React UI
- [Source: ux-design-specification.md#Empty-States-&-Loading] -- "Premier lancement: Ecran 'Ouvrir un projet' + bouton selection repertoire"
- [Source: ux-design-specification.md#Feedback-Patterns] -- Error display (inline, no popup), toast system
- [Source: ux-design-specification.md#Experience-Mechanics] -- App opens on Dashboard Cockpit, initiation flow
- [Source: ux-design-specification.md#Color-System] -- All design tokens for styling
- [Source: ux-design-specification.md#Accessibility-Strategy] -- WCAG 2.1 AA, keyboard navigation
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] -- IPC bridge, event bus, preload pattern, AppError, AsyncState, import aliases
- [Source: 1-2-three-pane-resizable-layout-with-timeline-bar.md] -- AppShell, AppHeader, ThreePaneLayout, navigation store, design tokens in app.css

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
