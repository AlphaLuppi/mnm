# Story 1.1: Project Scaffold, IPC Bridge & Event Bus

Status: ready-for-dev

## Story

As a **developer**,
I want **the MnM Electron app initialized with typed IPC channels and event bus**,
So that **I have a solid foundation for building all features**.

## Acceptance Criteria

### AC1 — Electron scaffold + HMR + TypeScript strict

**Given** le scaffold electron-vite est exécuté
**When** je lance `npm run dev`
**Then** l'app Electron s'ouvre avec HMR fonctionnel sur le renderer
**And** TypeScript est en mode `strict: true` avec `any` interdit

### AC2 — Typed IPC channels via preload

**Given** les fichiers de types IPC existent (`src/shared/ipc-channels.ts`, `src/shared/events.ts`)
**When** le renderer appelle `window.electronAPI.invoke(channel, args)`
**Then** l'appel est routé via le preload script typé vers le main process
**And** seuls les channels déclarés dans `IpcInvokeChannels` sont exposés

### AC3 — Event bus (main EventEmitter + renderer mitt)

**Given** l'event bus est configuré
**When** un événement est émis dans le main process (EventEmitter)
**Then** il peut être relayé au renderer via IPC stream
**And** le renderer écoute via mitt avec les types de `RendererEvents`

### AC4 — Import aliases

**Given** les alias d'import sont configurés
**When** un fichier importe `@shared/events`
**Then** l'import se résout correctement (`@main/`, `@renderer/`, `@shared/`)

## Tasks / Subtasks

- [ ] Task 1: Scaffold electron-vite project (AC: #1)
  - [ ] 1.1 Run `npm create @quick-start/electron@latest mnm -- --template react-ts` in a temp dir, then move contents to project root (or scaffold in-place)
  - [ ] 1.2 Configure `tsconfig.json` + `tsconfig.node.json` + `tsconfig.web.json` with `strict: true`, `noImplicitAny: true`, path aliases
  - [ ] 1.3 Install deps: `tailwindcss`, `@tailwindcss/vite`, `zustand`, `mitt`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
  - [ ] 1.4 Configure `electron.vite.config.ts` with React plugin, Tailwind plugin, path aliases
  - [ ] 1.5 Configure `vitest.config.ts` with jsdom environment, path aliases, co-located test pattern
  - [ ] 1.6 Setup Tailwind CSS 4 in `src/renderer/src/app.css` with `@import "tailwindcss"` + `@theme` design tokens
  - [ ] 1.7 Verify `npm run dev` launches Electron with HMR on renderer
  - [ ] 1.8 Verify TypeScript strict mode catches `any` usage

- [ ] Task 2: Create shared types — IPC channels + events (AC: #2, #3)
  - [ ] 2.1 Create `src/shared/ipc-channels.ts` with `IpcInvokeChannels` and `IpcStreamChannels` type maps
  - [ ] 2.2 Create `src/shared/events.ts` with `MainEvents` and `RendererEvents` type maps
  - [ ] 2.3 Create `src/shared/types/error.types.ts` with `AppError` type
  - [ ] 2.4 Create `src/shared/types/async-state.types.ts` with `AsyncState<T>` discriminated union

- [ ] Task 3: Implement typed preload bridge (AC: #2)
  - [ ] 3.1 Create `src/preload/index.ts` with `contextBridge.exposeInMainWorld('electronAPI', ...)`
  - [ ] 3.2 Expose only: `invoke(channel, args)`, `on(channel, callback)` returning cleanup function
  - [ ] 3.3 Type-constrain exposed channels to `IpcInvokeChannels` and `IpcStreamChannels` keys only
  - [ ] 3.4 Create `src/preload/api.ts` with the typed API definition

- [ ] Task 4: Implement main process IPC handlers (AC: #2)
  - [ ] 4.1 Create `src/main/ipc/handlers.ts` with `registerInvokeHandlers()` using `ipcMain.handle()`
  - [ ] 4.2 Create `src/main/ipc/streams.ts` with `createStreamSender()` using `webContents.send()`
  - [ ] 4.3 Register handlers in `src/main/index.ts` at app ready
  - [ ] 4.4 Add placeholder handlers for a few channels (e.g., `project:open`) to verify round-trip

- [ ] Task 5: Implement event bus (AC: #3)
  - [ ] 5.1 Create `src/main/utils/event-bus.ts` — typed EventEmitter wrapper for `MainEvents`
  - [ ] 5.2 Wire event bus to IPC streams: main events → `webContents.send()` → renderer
  - [ ] 5.3 Create `src/renderer/src/shared/hooks/useEventBus.ts` — mitt-based hook for `RendererEvents`
  - [ ] 5.4 Create `src/renderer/src/shared/hooks/useIpcInvoke.ts` — typed invoke hook
  - [ ] 5.5 Create `src/renderer/src/shared/hooks/useIpcStream.ts` — typed stream listener hook
  - [ ] 5.6 Verify: emit event in main → arrives in renderer via mitt

- [ ] Task 6: Configure import aliases (AC: #4)
  - [ ] 6.1 Add paths in `tsconfig.node.json`: `@main/*`, `@shared/*`
  - [ ] 6.2 Add paths in `tsconfig.web.json`: `@renderer/*`, `@shared/*`
  - [ ] 6.3 Add resolve aliases in `electron.vite.config.ts` for both main and renderer
  - [ ] 6.4 Verify: import `@shared/events` resolves in both main and renderer

- [ ] Task 7: Minimal App shell + tests (AC: #1, #2, #3, #4)
  - [ ] 7.1 Update `src/renderer/src/App.tsx` — minimal dark-themed shell confirming "MnM" + connection status
  - [ ] 7.2 Write unit test for event bus (main): emit → receive
  - [ ] 7.3 Write unit test for IPC channel types: verify type safety
  - [ ] 7.4 Verify `npm run build` produces working production build
  - [ ] 7.5 Run `npx vitest run` — all tests pass

## Dev Notes

### Technical Stack (exact versions)

| Technology | Version | Notes |
|---|---|---|
| Electron | 40.6.0 | Chromium 144, Node.js 24.11.1 |
| electron-vite | 5.0.0 | Use `build.externalizeDeps: true` (not the deprecated plugin) |
| React | 19.x | `ref` as prop (no `forwardRef`), mandatory `jsx: "react-jsx"` |
| TypeScript | 5.9.x | Stable. Do NOT use 6.0 beta |
| Tailwind CSS | 4.x | `@tailwindcss/vite` plugin, NO `tailwind.config.ts` file |
| Zustand | 5.0.x | `useShallow` for multi-value selectors |
| mitt | latest | ~200 bytes, typed event emitter for renderer |
| Vitest | 4.0.x | `jsdom` environment, co-located tests |
| shadcn/ui | latest CLI | `npx shadcn@latest init`, set `rsc: false` |

### Critical Architecture Decisions

**TypeScript rules:**
- `strict: true`, `any` interdit → use `unknown` + type guards
- `type` by default, `interface` only for service contracts
- Named exports only — NO `export default`
- Barrel files: one `index.ts` per feature re-exporting public API

**IPC pattern — Hybrid invoke + streaming:**
- Request-response: `ipcRenderer.invoke()` / `ipcMain.handle()`
- Push streams: `webContents.send()` / `ipcRenderer.on()`
- NEVER expose full `ipcRenderer` via contextBridge
- All channels whitelisted in type definitions

**Security (non-negotiable):**
- `contextIsolation: true` (default, do not change)
- `nodeIntegration: false` (default, do not change)
- `sandbox: true`
- Renderer has ZERO direct access to Node.js
- All communication goes through preload contextBridge

**Error normalization:**
- All main process errors normalized to `AppError` before IPC transmission
- Pattern: `{ code: string; message: string; source: string; details?: unknown }`

**Async state pattern:**
```typescript
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: AppError };
```

### IPC Channel Types (complete for scaffold)

Only declare the type maps now. Handlers will be implemented by later stories. For Story 1.1, add placeholder handlers for `project:open` to verify the round-trip.

```typescript
// src/shared/ipc-channels.ts
export type IpcInvokeChannels = {
  'project:open': { args: { path: string }; result: ProjectInfo };
  'git:status': { args: void; result: GitStatus };
  'agent:launch': { args: { task: string; context: string[] }; result: { agentId: string } };
  'agent:stop': { args: { agentId: string }; result: void };
  'drift:check': { args: { docA: string; docB: string }; result: DriftReport };
  // ... remaining channels declared as types only
};

export type IpcStreamChannels = {
  'stream:agent-output': { agentId: string; data: string; timestamp: number };
  'stream:file-change': { path: string; type: 'create' | 'modify' | 'delete'; agentId?: string };
  'stream:drift-alert': { id: string; severity: string; summary: string };
  'stream:agent-status': { agentId: string; status: AgentStatus };
  // ... remaining channels declared as types only
};
```

### Event Bus Types (complete for scaffold)

```typescript
// src/shared/events.ts
export type MainEvents = {
  'agent:output': { agentId: string; data: string; timestamp: number };
  'agent:status': { agentId: string; status: AgentStatus };
  'file:changed': { path: string; type: 'create' | 'modify' | 'delete' };
  'drift:detected': { id: string; severity: 'critical' | 'warning' | 'info'; documents: [string, string] };
  'git:commit': { hash: string; message: string };
};

export type RendererEvents = {
  'nav:select': { level: 'project' | 'epic' | 'story' | 'task'; id: string };
  'panel:resize': { panel: 'context' | 'agents' | 'tests'; width: number };
  'agent:launch': { task: string; context: string[] };
};
```

### Preload Bridge Pattern

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: <T extends keyof IpcInvokeChannels>(
    channel: T,
    args: IpcInvokeChannels[T]['args']
  ): Promise<IpcInvokeChannels[T]['result']> =>
    ipcRenderer.invoke(channel, args),

  on: <T extends keyof IpcStreamChannels>(
    channel: T,
    callback: (data: IpcStreamChannels[T]) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: IpcStreamChannels[T]) =>
      callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
```

### electron-vite Config Pattern

```typescript
// electron.vite.config.ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: { externalizeDeps: true },
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared'),
      },
    },
  },
  preload: {
    build: { externalizeDeps: true },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
  },
});
```

### Tailwind CSS 4 Setup (NO config file)

```css
/* src/renderer/src/app.css */
@import "tailwindcss";

@theme {
  /* Backgrounds */
  --color-bg-base: #0a0a0b;
  --color-bg-surface: #141416;
  --color-bg-elevated: #1e1e22;

  /* Borders */
  --color-border-default: #27272a;
  --color-border-active: #3f3f46;

  /* Text */
  --color-text-primary: #fafafa;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #71717a;

  /* Status (functional only) */
  --color-status-green: #22c55e;
  --color-status-orange: #f59e0b;
  --color-status-red: #ef4444;
  --color-status-gray: #6b7280;

  /* Accent */
  --color-accent: #3b82f6;
  --color-accent-hover: #2563eb;
  --color-accent-muted: #1d4ed8;

  /* Fonts */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Font sizes (base 14px) */
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 14px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 24px;
}
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| React components | PascalCase.tsx | `AgentTimeline.tsx` |
| Hooks | camelCase, prefix `use` | `useAgentStatus.ts` |
| Zustand stores | camelCase + `.store.ts` | `agents.store.ts` |
| Main services | kebab-case + `.service.ts` | `file-watcher.service.ts` |
| Types | kebab-case + `.types.ts` | `agent.types.ts` |
| Tests | same name + `.test.ts` co-located | `event-bus.test.ts` |
| IPC channels | namespace:action kebab | `'agent:launch'` |
| Variables/functions | camelCase | `getAgentStatus()` |
| Constants | UPPER_SNAKE_CASE | `MAX_AGENTS` |
| Enums | PascalCase + UPPER_SNAKE members | `enum Status { ACTIVE }` |

### shadcn/ui Init

Run after scaffold:
```bash
npx shadcn@latest init
```
Settings: style=new-york, base-color=neutral, css-variables=yes, rsc=false, tailwind-config="" (blank for v4).

Do NOT install components yet — Story 1.2 will add Resizable, Button, etc.

### Project Structure (Story 1.1 scope only)

```
mnm/
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── vitest.config.ts
├── components.json              # shadcn/ui config
├── src/
│   ├── main/
│   │   ├── index.ts             # Entry: create window, register IPC, init event bus
│   │   ├── ipc/
│   │   │   ├── handlers.ts      # registerInvokeHandlers() — placeholder handlers
│   │   │   └── streams.ts       # createStreamSender() — webContents.send wrapper
│   │   └── utils/
│   │       ├── event-bus.ts     # Typed EventEmitter wrapper for MainEvents
│   │       ├── event-bus.test.ts
│   │       └── logger.ts        # [timestamp] [level] [source] message
│   ├── preload/
│   │   ├── index.ts             # contextBridge.exposeInMainWorld
│   │   └── api.ts               # Typed API definition (ElectronAPI interface)
│   ├── renderer/
│   │   └── src/
│   │       ├── index.html
│   │       ├── main.tsx         # React root mount
│   │       ├── App.tsx          # Minimal dark shell — "MnM" title
│   │       ├── app.css          # Tailwind + @theme tokens
│   │       └── shared/
│   │           └── hooks/
│   │               ├── useIpcInvoke.ts
│   │               ├── useIpcStream.ts
│   │               └── useEventBus.ts
│   └── shared/
│       ├── ipc-channels.ts      # IpcInvokeChannels + IpcStreamChannels
│       ├── events.ts            # MainEvents + RendererEvents
│       └── types/
│           ├── error.types.ts   # AppError
│           └── async-state.types.ts # AsyncState<T>
├── resources/
│   └── icon.png                 # Placeholder app icon
└── e2e/
    └── .gitkeep
```

### Boundary Rules (MUST follow)

| Rule | Description |
|---|---|
| Renderer → Main | Only via `window.electronAPI` (preload). Never import Node.js directly |
| Main → Renderer | Only via `webContents.send()` for streams. Never reference DOM |
| Feature → Feature | Via shared Zustand stores. No cross-feature imports |
| Shared types | `src/shared/` is the ONLY folder importable by both main AND renderer |

### Logger Pattern

```typescript
// src/main/utils/logger.ts
// Format: [timestamp] [level] [source] message
// Levels: debug, info, warn, error
// Example: logger.info('agent-harness', 'Agent launched', { agentId, task });
```

### What NOT to do

- Do NOT create `tailwind.config.ts` — Tailwind 4 uses CSS-only config via `@theme`
- Do NOT use `externalizeDepsPlugin()` — deprecated in electron-vite 5, use `build: { externalizeDeps: true }`
- Do NOT use `export default` anywhere — named exports only
- Do NOT use `any` — use `unknown` + type guards
- Do NOT expose full `ipcRenderer` in preload — expose narrow typed API only
- Do NOT create feature folders yet (agents/, context/, etc.) — those come in later stories
- Do NOT install shadcn/ui components — only run `init`. Components come in Story 1.2+
- Do NOT use `forwardRef` — React 19 supports `ref` as a regular prop

### References

- [Source: architecture.md#Starter-Template-Evaluation] — Scaffold selection rationale
- [Source: architecture.md#IPC-Channel-Design] — Full IPC type definitions
- [Source: architecture.md#Event-Bus-Architecture] — Event bus design
- [Source: architecture.md#Complete-Project-Directory-Structure] — Target file structure
- [Source: architecture.md#Naming-Patterns] — All naming conventions
- [Source: architecture.md#Architectural-Boundaries] — Security and boundary rules
- [Source: architecture.md#Format-Patterns] — TypeScript conventions, error handling
- [Source: architecture.md#Process-Patterns] — Async state, logging
- [Source: ux-design-specification.md#Color-System] — Design tokens
- [Source: ux-design-specification.md#Typography-System] — Font system
- [Source: ux-design-specification.md#Design-System-Foundation] — shadcn/ui setup rationale

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
