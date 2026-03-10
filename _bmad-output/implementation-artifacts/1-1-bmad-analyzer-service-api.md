# Story 1.1: BMAD Analyzer Service & API

Status: done

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

- [ ] Task 1: Create BMAD shared types (AC: #1, #2, #3, #4)
  - [ ] 1.1 Create `packages/shared/src/types/bmad.ts` with: `BmadProject`, `BmadPlanningArtifact`, `BmadEpic`, `BmadStory`, `BmadAcceptanceCriterion`, `BmadTask`, `BmadSprintStatus`
  - [ ] 1.2 Export from `packages/shared/src/index.ts`
  - [ ] 1.3 Build: `cd packages/shared && pnpm build`

- [ ] Task 2: Create BMAD analyzer service (AC: #1, #2, #3, #4)
  - [ ] 2.1 Create `server/src/services/bmad-analyzer.ts` with `analyzeBmadWorkspace(workspacePath: string): Promise<BmadProject | null>`
  - [ ] 2.2 Implement `scanPlanningArtifacts()` — glob `planning-artifacts/*.md`, classify by filename
  - [ ] 2.3 Implement `scanImplementationArtifacts()` — glob `implementation-artifacts/[0-9]*.md`, parse epic/story from filename
  - [ ] 2.4 Implement `parseStoryFile()` — extract title, status, ACs (Given/When/Then), tasks (checkboxes)
  - [ ] 2.5 Implement `parseSprintStatus()` — read YAML, extract status map
  - [ ] 2.6 Implement `buildHierarchy()` — group stories by epic, merge status, compute progress

- [ ] Task 3: Create API routes (AC: #5, #6)
  - [ ] 3.1 Create `server/src/routes/bmad.ts` with Express router
  - [ ] 3.2 `GET /projects/:id/bmad` — resolve workspacePath, run analyzer, return result
  - [ ] 3.3 `GET /projects/:id/bmad/file` — validate path, return markdown content
  - [ ] 3.4 Path traversal protection: reject `..` and absolute paths
  - [ ] 3.5 Register in `server/src/routes/index.ts`

- [ ] Task 4: Create API client + hook (AC: #5, #6)
  - [ ] 4.1 Create `ui/src/api/bmad.ts`: `bmadApi.getProject()`, `bmadApi.getFile()`
  - [ ] 4.2 Create `ui/src/hooks/useBmadProject.ts` — TanStack Query hook
  - [ ] 4.3 Add query key to `ui/src/lib/queryKeys.ts`

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
### Completion Notes List
### File List
