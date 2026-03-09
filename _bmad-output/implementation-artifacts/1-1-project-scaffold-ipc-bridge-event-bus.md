# Story 1.1: BMAD Analyzer Service & API

Status: ready-for-dev

## Story

As a **developer**,
I want **a backend service that scans a project workspace for BMAD structure and exposes it via REST API**,
So that **the UI can display specs, epics, stories, and acceptance criteria from BMAD projects**.

## Context

MnM is a Paperclip AI fork — a web app (not Electron). The scaffold already exists:
- **UI**: `ui/src/` — React 19 + Vite + TanStack Query + Tailwind + shadcn/ui
- **Server**: `server/src/` — Express + Drizzle + embedded Postgres
- **Packages**: `packages/shared/src/` — shared types, `packages/db/` — database
- **Realtime**: WebSocket via `server/src/realtime/live-events-ws.ts` + `ui/src/context/LiveUpdatesProvider.tsx`
- **API pattern**: `server/src/routes/*.ts` → `ui/src/api/*.ts` → TanStack Query hooks in pages
- **Existing features**: projects, agents, issues, workflows, costs, heartbeats all already work

This story adds the BMAD workspace analyzer — the foundation for the 3-pane cockpit view.

## Acceptance Criteria

### AC1 — BMAD structure detection

**Given** a project has a `workspacePath` configured
**When** the server scans that path
**Then** it detects the presence of `_bmad-output/planning-artifacts/` and `_bmad-output/implementation-artifacts/`
**And** returns a structured response with all found documents

### AC2 — Planning artifacts parsed

**Given** a BMAD workspace is detected
**When** planning artifacts are scanned
**Then** the API returns a list of planning docs (product-brief, prd, architecture, ux-spec, epics, technical-research) with their titles and file paths

### AC3 — Epics and stories parsed from implementation artifacts

**Given** implementation artifacts exist (pattern: `{epicNum}-{storyNum}-*.md`)
**When** the parser reads them
**Then** it returns a hierarchy: Epic → Stories with each story's status, title, acceptance criteria (Given/When/Then), and tasks (checkbox status)

### AC4 — Sprint status parsed

**Given** `sprint-status.yaml` exists in implementation artifacts
**When** the parser reads it
**Then** story statuses are extracted and merged into the hierarchy (backlog, ready-for-dev, in-progress, review, done)

### AC5 — REST API endpoint available

**Given** a project exists with a valid workspacePath
**When** `GET /api/projects/:id/bmad` is called
**Then** it returns the full BMAD structure (planning artifacts + epics/stories hierarchy)
**And** returns 404 if no BMAD structure found

### AC6 — Markdown content endpoint

**Given** a planning artifact or story file exists
**When** `GET /api/projects/:id/bmad/file?path=<relative-path>` is called
**Then** it returns the raw markdown content of that file
**And** the path is validated to be within `_bmad-output/` (no directory traversal)

## Tasks / Subtasks

- [ ] Task 1: Create BMAD shared types (AC: #1, #2, #3, #4)
  - [ ] 1.1 Create `packages/shared/src/types/bmad.ts` with types: `BmadProject`, `BmadPlanningArtifact`, `BmadEpic`, `BmadStory`, `BmadAcceptanceCriterion`, `BmadTask`, `BmadSprintStatus`
  - [ ] 1.2 Export types from `packages/shared/src/index.ts`
  - [ ] 1.3 Build shared package: `cd packages/shared && pnpm build`

- [ ] Task 2: Create BMAD analyzer service (AC: #1, #2, #3, #4)
  - [ ] 2.1 Create `server/src/services/bmad-analyzer.ts` with function `analyzeBmadWorkspace(workspacePath: string): Promise<BmadProject | null>`
  - [ ] 2.2 Implement `scanPlanningArtifacts(bmadOutputPath)` — glob `_bmad-output/planning-artifacts/*.md`, extract title from first `# ` line, classify type by filename patterns (product-brief, prd, architecture, ux-design, epics, technical-research, implementation-readiness)
  - [ ] 2.3 Implement `scanImplementationArtifacts(bmadOutputPath)` — glob `_bmad-output/implementation-artifacts/[0-9]*.md`, parse epic/story numbers from filename pattern `{epic}-{story}-*.md`
  - [ ] 2.4 Implement `parseStoryFile(filePath)` — extract: title (first `# ` line), status (line after `Status: `), acceptance criteria (parse `### AC{n}` sections with Given/When/Then blocks), tasks (parse `- [ ]` / `- [x]` with nested subtasks)
  - [ ] 2.5 Implement `parseSprintStatus(yamlPath)` — read `sprint-status.yaml`, parse YAML, extract `development_status` map
  - [ ] 2.6 Implement `buildHierarchy(stories, sprintStatus)` — group stories by epic number, merge sprint status, compute epic-level progress (done/total stories)
  - [ ] 2.7 Implement `parseEpicsFile(epicsFilePath)` — parse the `epics.md` planning artifact to extract epic names and descriptions

- [ ] Task 3: Create BMAD API routes (AC: #5, #6)
  - [ ] 3.1 Create `server/src/routes/bmad.ts` with Express router
  - [ ] 3.2 Implement `GET /api/projects/:id/bmad` — resolve project workspacePath from DB, run analyzer, return `BmadProject` or 404
  - [ ] 3.3 Implement `GET /api/projects/:id/bmad/file` — accept `?path=` query param, validate path is within `_bmad-output/` (reject `..`), read and return raw markdown
  - [ ] 3.4 Add path traversal protection: reject any path containing `..` or starting with `/`
  - [ ] 3.5 Register routes in `server/src/routes/index.ts`

- [ ] Task 4: Create API client (AC: #5, #6)
  - [ ] 4.1 Create `ui/src/api/bmad.ts` following existing pattern (see `ui/src/api/projects.ts`): `bmadApi.getProject(projectId, companyId)` and `bmadApi.getFile(projectId, path, companyId)`
  - [ ] 4.2 Create `ui/src/hooks/useBmadProject.ts` — TanStack Query hook wrapping `bmadApi.getProject()` with `queryKey: ['bmad', projectId]`

- [ ] Task 5: Write tests (AC: #1, #2, #3, #4)
  - [ ] 5.1 Create `server/src/__tests__/bmad-analyzer.test.ts`
  - [ ] 5.2 Test: `analyzeBmadWorkspace` returns null for non-BMAD workspace
  - [ ] 5.3 Test: planning artifacts are correctly classified by type
  - [ ] 5.4 Test: story file parsing extracts ACs with Given/When/Then
  - [ ] 5.5 Test: task checkbox parsing handles nested subtasks
  - [ ] 5.6 Test: sprint-status.yaml parsing extracts story statuses
  - [ ] 5.7 Test: hierarchy groups stories by epic correctly
  - [ ] 5.8 Test: path traversal is rejected in file endpoint

## Dev Notes

### BMAD Structure Reference

```
_bmad-output/
├── planning-artifacts/
│   ├── product-brief-mnm-2026-02-22.md
│   ├── prd.md (or prd-v2-collaborative.md)
│   ├── architecture.md
│   ├── epics.md
│   ├── ux-design-specification.md
│   ├── technical-research-mnm-2026-02-22.md
│   └── implementation-readiness-report-2026-02-28.md
├── implementation-artifacts/
│   ├── sprint-status.yaml
│   ├── 1-1-project-scaffold-ipc-bridge-event-bus.md
│   ├── 1-2-three-pane-resizable-layout-with-timeline-bar.md
│   ├── 2-1-agent-harness-lancer-arreter-des-agents.md
│   └── ... (pattern: {epicNum}-{storyNum}-slug.md)
└── brainstorming/
    └── *.md
```

### Story File Format

```markdown
# Story 1.2: Title Here

Status: ready-for-dev

## Story
As a **user**, I want...

## Acceptance Criteria

### AC1 — Title
**Given** ...
**When** ...
**Then** ...

## Tasks / Subtasks
- [ ] Task 1: Description (AC: #1, #2)
  - [ ] 1.1 Subtask
  - [x] 1.2 Done subtask
```

### Sprint Status Format

```yaml
development_status:
  epic-1: in-progress
  1-1-slug: ready-for-dev
  1-2-slug: in-progress
  epic-1-retrospective: optional
```

### Existing Patterns to Follow

**API route pattern** (see `server/src/routes/projects.ts`):
```typescript
export function bmadRoutes(db: Db) {
  const router = Router();
  // ... handlers
  return router;
}
```

**API client pattern** (see `ui/src/api/projects.ts`):
```typescript
export const bmadApi = {
  getProject: (projectId: string, companyId?: string) =>
    api.get<BmadProject>(`/projects/${projectId}/bmad${companyId ? `?companyId=${companyId}` : ''}`),
};
```

**TanStack Query hook pattern** (see existing hooks):
```typescript
export function useBmadProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['bmad', projectId],
    queryFn: () => bmadApi.getProject(projectId!),
    enabled: !!projectId,
  });
}
```

### What NOT to do

- Do NOT create IPC channels — this is a web app, use REST API
- Do NOT use Zustand — use TanStack Query for server state, React Context for UI state
- Do NOT create Electron-specific code
- Do NOT create database tables — BMAD data is read from filesystem
- Do NOT modify existing routes/services — only add new ones
- Do NOT install new dependencies unless absolutely necessary (yaml parser may be needed for sprint-status)

### Dependencies to check

- `yaml` or `js-yaml` package may be needed for parsing sprint-status.yaml — check if already in deps, otherwise install

### References

- Existing project routes: `server/src/routes/projects.ts`
- Existing project service: `server/src/services/projects.ts`
- API client pattern: `ui/src/api/projects.ts`
- LiveUpdatesProvider: `ui/src/context/LiveUpdatesProvider.tsx`
- Query keys: `ui/src/lib/queryKeys.ts`

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
