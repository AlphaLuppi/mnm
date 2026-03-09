# MnM — Architecture Document

**Version**: 3.0 — Fork Paperclip
**Date**: 2026-03-09

---

## 1. Architecture Overview

MnM est un fork de Paperclip AI. L'architecture est héritée : monorepo Node.js avec un serveur Express, une UI React, et des packages partagés.

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ CompanyRail   │  │ Sidebar      │  │ 3-Pane    │ │
│  │ (navigation)  │  │ (navigation) │  │ Cockpit   │ │
│  │               │  │              │  │           │ │
│  │               │  │ Dashboard    │  │ Context   │ │
│  │               │  │ Issues       │  │ Work      │ │
│  │               │  │ Agents       │  │ Tests     │ │
│  │               │  │ Projects →   │  │           │ │
│  │               │  │ Workflows    │  │ Timeline  │ │
│  │               │  │ Costs        │  │           │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                     │
│  React 19 + Vite + TanStack Query + Tailwind        │
│  shadcn/ui + WebSocket (live events)                 │
└─────────────────────────┬───────────────────────────┘
                          │ REST API + WebSocket
┌─────────────────────────┴───────────────────────────┐
│                  Server (Express)                    │
│                                                     │
│  Routes:     /api/projects, /api/agents, /api/bmad  │
│  Services:   bmad-analyzer, drift, file-watcher,    │
│              heartbeat, agents, projects, costs      │
│  Realtime:   WebSocket (live-events-ws)              │
│  Auth:       better-auth (sessions, roles)           │
│  Adapters:   claude-local, codex-local, cursor, ...  │
│                                                     │
│  Express + Drizzle ORM + embedded/external Postgres  │
└─────────────────────────────────────────────────────┘
```

## 2. Monorepo Structure

```
mnm/
├── server/src/              # Express backend
│   ├── routes/              # API endpoints
│   ├── services/            # Business logic
│   │   ├── bmad-analyzer.ts # [NEW] BMAD workspace parser
│   │   ├── drift.ts         # [NEW] LLM drift detection
│   │   ├── file-watcher.ts  # [NEW] Workspace file monitoring
│   │   ├── git-info.ts      # [NEW] Git integration
│   │   ├── test-discovery.ts# [NEW] Test file scanner
│   │   ├── heartbeat.ts     # [INHERITED] Agent execution engine
│   │   ├── agents.ts        # [INHERITED] Agent CRUD
│   │   ├── projects.ts      # [INHERITED] Project management
│   │   └── ...
│   ├── realtime/            # WebSocket server
│   ├── middleware/           # Auth, validation, logging
│   └── adapters/            # Agent adapters (local process)
├── ui/src/                  # React frontend
│   ├── pages/               # Route pages
│   ├── components/          # Shared components
│   │   ├── ThreePaneLayout.tsx  # [NEW] 3-pane resizable layout
│   │   ├── ContextPane.tsx      # [NEW] Left pane — specs tree
│   │   ├── WorkPane.tsx         # [NEW] Center pane — content
│   │   ├── TestsPane.tsx        # [NEW] Right pane — ACs/tests
│   │   ├── TimelineBar.tsx      # [NEW] Bottom timeline
│   │   ├── Layout.tsx           # [INHERITED] Main app layout
│   │   ├── Sidebar.tsx          # [INHERITED] Navigation sidebar
│   │   └── ...
│   ├── api/                 # API client functions
│   ├── hooks/               # Custom hooks
│   ├── context/             # React contexts
│   │   ├── ProjectNavigationContext.tsx  # [NEW] Pane sync state
│   │   ├── CompanyContext.tsx            # [INHERITED]
│   │   ├── LiveUpdatesProvider.tsx       # [INHERITED] WebSocket
│   │   └── ...
│   └── lib/                 # Utilities
├── packages/
│   ├── shared/src/          # Shared types & validators
│   │   └── types/
│   │       ├── bmad.ts      # [NEW] BMAD data types
│   │       ├── drift.ts     # [NEW] Drift detection types
│   │       └── ...          # [INHERITED] Existing types
│   ├── db/src/              # Database schema (Drizzle)
│   │   └── schema/          # All tables
│   └── adapters/            # Agent adapters
│       ├── claude-local/    # [INHERITED]
│       ├── codex-local/     # [INHERITED]
│       └── ...
├── _bmad/                   # BMAD framework config
├── _bmad-output/            # BMAD outputs (specs, stories)
├── docker-compose.yml       # Deployment
├── Dockerfile               # Container build
└── pnpm-workspace.yaml      # Monorepo config
```

## 3. Data Flow

### 3.1 BMAD Data Flow (filesystem → UI)

```
Filesystem (_bmad-output/)
    ↓ fs.readFile + parser
server/src/services/bmad-analyzer.ts
    ↓ REST API
GET /api/projects/:id/bmad
    ↓ TanStack Query
ui/src/hooks/useBmadProject.ts
    ↓ React
ContextPane + WorkPane + TestsPane
```

### 3.2 Agent Execution Flow (unchanged from Paperclip)

```
User clicks "Launch agent on story"
    ↓
Create issue (issuesApi.create) with story content
    ↓
Heartbeat engine picks up issue → spawns agent process
    ↓ adapter (claude-local, codex, etc.)
Agent executes in workspace
    ↓ WebSocket
LiveUpdatesProvider → UI updates in real-time
```

### 3.3 Drift Detection Flow

```
User clicks "Check drift" (or file watcher triggers)
    ↓
POST /api/projects/:id/drift/check { docA, docB }
    ↓
server reads both files from workspace
    ↓
LLM compares documents → returns structured drift report
    ↓ REST response
UI shows DriftAlertCards in Tests pane
```

## 4. New Services (MnM additions)

### 4.1 BMAD Analyzer (`server/src/services/bmad-analyzer.ts`)

Scans a workspace path for BMAD structure. Returns:
```typescript
interface BmadProject {
  planningArtifacts: BmadPlanningArtifact[];
  epics: BmadEpic[];
}

interface BmadPlanningArtifact {
  type: 'product-brief' | 'prd' | 'architecture' | 'ux-spec' | 'epics' | 'technical-research' | 'other';
  title: string;
  path: string;  // relative to _bmad-output/
}

interface BmadEpic {
  id: string;
  name: string;
  status: string;
  progress: { done: number; total: number };
  stories: BmadStory[];
}

interface BmadStory {
  id: string;
  name: string;
  status: string;
  filePath: string;
  acceptanceCriteria: BmadAcceptanceCriterion[];
  tasks: BmadTask[];
}

interface BmadAcceptanceCriterion {
  id: string;
  title: string;
  given: string;
  when: string;
  then: string;
  status: 'pending' | 'pass' | 'fail';
}

interface BmadTask {
  description: string;
  done: boolean;
  subtasks: { description: string; done: boolean }[];
}
```

### 4.2 Drift Detection (`server/src/services/drift.ts`)

Compares two documents using an LLM. Returns:
```typescript
interface DriftReport {
  docA: string;
  docB: string;
  checkedAt: string;
  drifts: DriftItem[];
}

interface DriftItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: number;  // 0.0 - 1.0
  description: string;
  sourceExcerpt: string;
  targetExcerpt: string;
}
```

### 4.3 File Watcher (`server/src/services/file-watcher.ts`) [Post-MVP]

Monitors workspace using `fs.watch({ recursive: true })`. Emits events via WebSocket.

### 4.4 Git Info (`server/src/services/git-info.ts`) [Post-MVP]

Queries git via `child_process.execFile`. Provides branch, commits, changed files.

### 4.5 Test Discovery (`server/src/services/test-discovery.ts`) [Post-MVP]

Scans workspace for test files, maps to specs by naming convention.

## 5. New API Endpoints

| Method | Endpoint | Description | MVP |
|---|---|---|---|
| GET | `/api/projects/:id/bmad` | BMAD structure for project | ✅ |
| GET | `/api/projects/:id/bmad/file?path=` | Raw markdown file content | ✅ |
| POST | `/api/projects/:id/drift/check` | Run drift check on 2 docs | ✅ |
| GET | `/api/projects/:id/drift/results` | Get cached drift results | ✅ |
| GET | `/api/projects/:id/git` | Git info (branch, commits) | ❌ |
| GET | `/api/projects/:id/git/show` | File at commit | ❌ |
| GET | `/api/projects/:id/tests` | Discovered tests | ❌ |
| POST | `/api/projects/:id/tests/run` | Execute tests | ❌ |

## 6. UI Architecture

### 6.1 Layout Hierarchy

```
Layout.tsx (all pages)
├── CompanyRail
├── Sidebar
├── <Outlet /> ← page-specific content
│   ├── Dashboard.tsx (enhanced with cockpit widgets)
│   ├── ProjectDetail.tsx ← uses ThreePaneLayout
│   │   ├── ThreePaneLayout.tsx
│   │   │   ├── ContextPane.tsx (left 25%)
│   │   │   ├── WorkPane.tsx (center 50%)
│   │   │   └── TestsPane.tsx (right 25%)
│   │   └── TimelineBar.tsx (bottom)
│   ├── Issues.tsx (unchanged)
│   ├── Agents.tsx (unchanged)
│   └── ... other pages (unchanged)
└── PropertiesPanel
```

### 6.2 State Management

| State | Pattern | Scope |
|---|---|---|
| Server data (BMAD, agents, issues) | TanStack Query | Global cache |
| Selected item in cockpit | ProjectNavigationContext | ProjectDetail page |
| Panel sizes | Component local state | ThreePaneLayout |
| Theme, sidebar | React Context | App-wide |
| Live events | WebSocket → TanStack Query invalidation | Global |

### 6.3 Key Principle: Modify ProjectDetail, NOT Layout

The 3-pane cockpit replaces the content of `ProjectDetail.tsx` only. The `Layout.tsx` component is NOT modified. All other pages keep the standard single-content layout.

## 7. Inherited Paperclip Components (DO NOT REBUILD)

| Component | Purpose |
|---|---|
| `Layout.tsx` | App shell with rail + sidebar + content |
| `Sidebar.tsx` | Navigation with sections and nav items |
| `LiveRunWidget.tsx` | Real-time agent output viewer |
| `ActiveAgentsPanel.tsx` | List of running agents |
| `StatusBadge.tsx` / `StatusIcon.tsx` | Status indicators |
| `MarkdownBody.tsx` | Markdown renderer |
| `EmptyState.tsx` | Empty state placeholder |
| `CommandPalette.tsx` | Cmd+K search |
| `KanbanBoard.tsx` | Issue board |
| `OnboardingWizard.tsx` | First-time setup |
| `MetricCard.tsx` | Dashboard metrics |
| `ActivityRow.tsx` | Activity feed items |
| `FilterBar.tsx` | Filtering UI |

## 8. Database (no new tables for MVP)

BMAD data is read from the **filesystem** via the project's `workspacePath`. No new database tables are needed for MVP.

Existing Paperclip tables used:
- `projects` (with `workspacePath`)
- `agents`, `heartbeat_runs`, `heartbeat_run_events`
- `issues`, `issue_comments`
- `cost_events`
- `activity_log`

## 9. Security

- File API (`/bmad/file`) validates paths against directory traversal (reject `..`, absolute paths)
- All endpoints require authentication (inherited from Paperclip)
- Drift detection uses company-configured LLM keys (no MnM keys)
- Agent execution sandboxed via adapter (inherited from Paperclip)

## 10. Dependencies

### New dependencies (to add)
- `yaml` or `js-yaml` — parse sprint-status.yaml
- `react-resizable-panels` — 3-pane layout (via shadcn/ui resizable)

### Inherited (already in Paperclip)
- React 19, Vite, TanStack Query, Tailwind, shadcn/ui
- Express, Drizzle, better-auth
- ws (WebSocket)
- All agent adapter dependencies
