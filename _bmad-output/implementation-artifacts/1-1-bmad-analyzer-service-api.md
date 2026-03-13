# Story 1.1: BMAD Analyzer Service & API

Status: review

## Story

As a **developer**,
I want **a backend service that scans a project workspace for BMAD structure and exposes it via REST API**,
So that **the UI can display specs, epics, stories, and acceptance criteria from BMAD projects**.

## Context

MnM is a Paperclip AI fork — a web app. The scaffold exists:
- **UI**: `ui/src/` — React 19 + Vite + TanStack Query + Tailwind + shadcn/ui
- **Server**: `server/src/` — Express + Drizzle + embedded Postgres
- **Packages**: `packages/shared/src/` — shared types
- **Realtime**: WebSocket via `server/src/realtime/live-events-ws.ts`
- **API pattern**: `server/src/routes/*.ts` → `ui/src/api/*.ts` → TanStack Query hooks

## Acceptance Criteria

### AC1 — BMAD structure detection

**Given** a project has a `workspacePath` configured
**When** the server scans that path
**Then** it detects `_bmad-output/planning-artifacts/` and `_bmad-output/implementation-artifacts/`
**And** returns a structured response with all found documents

### AC2 — Planning artifacts parsed

**Given** a BMAD workspace is detected
**When** planning artifacts are scanned
**Then** the API returns a list of planning docs with their titles, types, and file paths

### AC3 — Stories parsed with ACs and tasks

**Given** implementation artifacts exist (pattern: `{epicNum}-{storyNum}-*.md`)
**When** the parser reads them
**Then** it returns a hierarchy: Epic → Stories with status, acceptance criteria (Given/When/Then), and tasks (checkbox status)

### AC4 — Sprint status parsed

**Given** `sprint-status.yaml` exists
**When** the parser reads it
**Then** story statuses are extracted and merged into the hierarchy

### AC5 — REST API available

**Given** a project with a valid workspacePath
**When** `GET /api/projects/:id/bmad` is called
**Then** it returns the full BMAD structure or 404 if no BMAD found

### AC6 — File content endpoint with path protection

**Given** a file exists in `_bmad-output/`
**When** `GET /api/projects/:id/bmad/file?path=<relative-path>` is called
**Then** it returns raw markdown content
**And** rejects paths containing `..` or starting with `/`

## Tasks / Subtasks

- [x] Task 1: Create BMAD shared types (AC: #1, #2, #3, #4)
  - [x] 1.1 Create `packages/shared/src/types/bmad.ts` with: `BmadProject`, `BmadPlanningArtifact`, `BmadEpic`, `BmadStory`, `BmadAcceptanceCriterion`, `BmadTask`, `BmadSprintStatus`
  - [x] 1.2 Export from `packages/shared/src/index.ts`
  - [x] 1.3 Build: `cd packages/shared && pnpm build`

- [x] Task 2: Create BMAD analyzer service (AC: #1, #2, #3, #4)
  - [x] 2.1 Create `server/src/services/bmad-analyzer.ts` with `analyzeBmadWorkspace(workspacePath: string): Promise<BmadProject | null>`
  - [x] 2.2 Implement `scanPlanningArtifacts()` — glob `planning-artifacts/*.md`, classify by filename
  - [x] 2.3 Implement `scanImplementationArtifacts()` — glob `implementation-artifacts/[0-9]*.md`, parse epic/story from filename
  - [x] 2.4 Implement `parseStoryFile()` — extract title, status, ACs (Given/When/Then), tasks (checkboxes)
  - [x] 2.5 Implement `parseSprintStatus()` — read YAML, extract status map
  - [x] 2.6 Implement `buildHierarchy()` — group stories by epic, merge status, compute progress

- [x] Task 3: Create API routes (AC: #5, #6)
  - [x] 3.1 Create `server/src/routes/bmad.ts` with Express router
  - [x] 3.2 `GET /projects/:id/bmad` — resolve workspacePath, run analyzer, return result
  - [x] 3.3 `GET /projects/:id/bmad/file` — validate path, return markdown content
  - [x] 3.4 Path traversal protection: reject `..` and absolute paths
  - [x] 3.5 Register in `server/src/routes/index.ts`

- [x] Task 4: Create API client + hook (AC: #5, #6)
  - [x] 4.1 Create `ui/src/api/bmad.ts`: `bmadApi.getProject()`, `bmadApi.getFile()`
  - [x] 4.2 Create `ui/src/hooks/useBmadProject.ts` — TanStack Query hook
  - [x] 4.3 Add query key to `ui/src/lib/queryKeys.ts`

- [ ] Task 5: Tests (AC: #1-#6)
  - [ ] 5.1 Create `server/src/__tests__/bmad-analyzer.test.ts`
  - [ ] 5.2 Test: returns null for non-BMAD workspace
  - [ ] 5.3 Test: planning artifacts classified correctly
  - [ ] 5.4 Test: story parsing extracts ACs
  - [ ] 5.5 Test: task checkbox parsing
  - [ ] 5.6 Test: path traversal rejected
  - [ ] 5.7 Verify: `pnpm build` succeeds

## Dev Notes

### Patterns to follow

**Route** (see `server/src/routes/projects.ts`):
```typescript
export function bmadRoutes(db: Db) {
  const router = Router();
  // handlers...
  return router;
}
```

**API client** (see `ui/src/api/projects.ts`):
```typescript
export const bmadApi = {
  getProject: (projectId: string, companyId?: string) =>
    api.get<BmadProject>(withScope(`/projects/${projectId}/bmad`, companyId)),
  getFile: (projectId: string, path: string, companyId?: string) =>
    api.get<string>(withScope(`/projects/${projectId}/bmad/file?path=${encodeURIComponent(path)}`, companyId)),
};
```

**Hook** (see existing hooks):
```typescript
export function useBmadProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bmad(projectId!),
    queryFn: () => bmadApi.getProject(projectId!),
    enabled: !!projectId,
  });
}
```

### BMAD file structure (reference)
```
_bmad-output/
├── planning-artifacts/
│   ├── product-brief.md
│   ├── prd.md
│   ├── architecture.md
│   └── epics.md
└── implementation-artifacts/
    ├── sprint-status.yaml
    ├── 1-1-bmad-analyzer-service-api.md
    └── 1-2-three-pane-resizable-layout.md
```

### What NOT to do
- Do NOT create IPC/Electron code — REST API only
- Do NOT create database tables — filesystem only
- Do NOT use Zustand — TanStack Query for server state
- Do NOT modify existing routes/services

### Dependencies
- `js-yaml` — for sprint-status.yaml parsing (check if already in deps)

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

Tasks 1-4 are functionally complete with the following architectural deviations:

**Deviation majeure : approche config-driven vs. scan direct**
- L'implementation utilise `_mnm-context/config.yaml` comme source de donnees au lieu de scanner `_bmad-output/` directement
- Choix architectural plus flexible (supporte des fichiers projet arbitraires, pas seulement BMAD)

**Deviations de nommage :**
| Story prevoit | Code reel |
|---|---|
| `packages/shared/src/types/bmad.ts` | `packages/shared/src/types/workspace-context.ts` + alias `Bmad*` dans index.ts |
| `server/src/services/bmad-analyzer.ts` | `server/src/services/workspace-analyzer.ts` |
| `server/src/routes/bmad.ts` | `server/src/routes/workspace-context.ts` |
| `GET /projects/:id/bmad` | `POST /projects/:id/context/analyze` + `GET /projects/:id/context` |
| `ui/src/api/bmad.ts` | `ui/src/api/workspaceContext.ts` |
| `ui/src/hooks/useBmadProject.ts` | `ui/src/hooks/useWorkspaceContext.ts` |
| `BmadProject`, `BmadStory`, etc. | `WorkspaceContext`, `ContextNode` (profondeur infinie) + alias legacy |

**Fonctionnalites supplementaires non prevues :**
- Workspace file watcher (`workspace-context-watcher.ts`)
- Support hierarchie infinie via `ContextNode` (vs Epic/Story fixe)
- Scan de commandes IDE (.claude/commands, .cursor/commands)

**Gap : Task 5 (tests) non implementee — aucun test unitaire**

### File List
- `packages/shared/src/types/workspace-context.ts` (types principaux : WorkspaceContext, ContextNode, AcceptanceCriterion, WorkspaceTask, PlanningArtifact, SprintStatus)
- `packages/shared/src/index.ts` (exports + alias Bmad*)
- `server/src/services/workspace-analyzer.ts` (service d'analyse workspace)
- `server/src/services/workspace-context-watcher.ts` (file watcher)
- `server/src/routes/workspace-context.ts` (routes API)
- `ui/src/api/workspaceContext.ts` (client API)
- `ui/src/hooks/useWorkspaceContext.ts` (hook TanStack Query)
- `ui/src/lib/queryKeys.ts` (query keys)

### Change Log
- 2026-03-12: Reconciliation — alignement story file avec code existant (deviations documentees, taches cochees). Tests toujours manquants.
