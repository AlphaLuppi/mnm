# Story 1.3: Open Project & BMAD Detection

Status: ready-for-dev

## Story

As a **user**,
I want **the Context pane to display my project's BMAD specs (planning artifacts + epic/story tree) when I open a project**,
So that **I can see and navigate all my project documentation in one place**.

## Context

Depends on: Story 1.1 (BMAD analyzer API), Story 1.2 (three-pane layout with placeholder panes).

This story fills the **Context pane** (left) with real BMAD data from the project workspace.

## Acceptance Criteria

### AC1 — Planning artifacts section

**Given** a project with BMAD structure is open
**When** I look at the Context pane
**Then** I see a "Planning" section listing all planning artifacts (Product Brief, PRD, Architecture, UX Spec, etc.)
**And** each artifact shows its type icon and title

### AC2 — Epic/Story tree

**Given** a project with BMAD implementation artifacts
**When** I look at the Context pane below Planning
**Then** I see a collapsible tree: Epics → Stories
**And** each story shows a status badge (backlog, ready-for-dev, in-progress, review, done)
**And** each epic shows a progress indicator (e.g., "3/8 done")

### AC3 — Click artifact opens in center pane

**Given** the Context pane shows planning artifacts
**When** I click on a planning artifact (e.g., PRD)
**Then** the center pane displays the markdown content of that artifact rendered as HTML

### AC4 — Click story opens detail in center pane

**Given** the Context pane shows the epic/story tree
**When** I click on a story
**Then** the center pane shows the story detail: title, status, description, acceptance criteria, and task list

### AC5 — BMAD not detected state

**Given** a project workspace has no `_bmad-output/` directory
**When** I open the project
**Then** the Context pane shows an empty state: "No BMAD structure detected" with a brief explanation

## Tasks / Subtasks

- [ ] Task 1: Create ProjectNavigationContext (AC: #3, #4)
  - [ ] 1.1 Create `ui/src/context/ProjectNavigationContext.tsx` with state: `selectedItem: { type: 'artifact' | 'epic' | 'story'; id: string; path?: string } | null`
  - [ ] 1.2 Provide `selectArtifact(path)`, `selectEpic(epicId)`, `selectStory(epicId, storyId)` actions
  - [ ] 1.3 Wrap the ThreePaneLayout in ProjectDetail with this provider

- [ ] Task 2: Build ContextPane with BMAD data (AC: #1, #2, #5)
  - [ ] 2.1 Update `ui/src/components/ContextPane.tsx` to use `useBmadProject(projectId)` hook from Story 1.1
  - [ ] 2.2 Render "Planning" section with collapsible list of planning artifacts — each shows icon (FileText for PRD, Building for Architecture, etc.) + title
  - [ ] 2.3 Render "Epics" section with collapsible tree — each epic is a collapsible node containing its stories
  - [ ] 2.4 Each story row shows: status icon (circle colors matching StatusBadge patterns), story title (truncated), story ID badge
  - [ ] 2.5 Each epic header shows: epic name, progress text (e.g., "2/5 done")
  - [ ] 2.6 On click artifact → call `selectArtifact(path)` from navigation context
  - [ ] 2.7 On click story → call `selectStory(epicId, storyId)` from navigation context
  - [ ] 2.8 Handle loading state (skeleton) and error state
  - [ ] 2.9 Handle empty state when BMAD not detected

- [ ] Task 3: Build SpecViewer for center pane (AC: #3, #4)
  - [ ] 3.1 Create `ui/src/components/SpecViewer.tsx` — renders markdown content from BMAD file API
  - [ ] 3.2 Use `bmadApi.getFile(projectId, path)` to fetch markdown content
  - [ ] 3.3 Use existing `MarkdownBody` component (already in codebase) to render the markdown
  - [ ] 3.4 Show loading skeleton while fetching
  - [ ] 3.5 Create `ui/src/components/StoryViewer.tsx` — structured view of a story: title, status badge, acceptance criteria as cards, task list with checkboxes (read-only)

- [ ] Task 4: Wire center pane to navigation context (AC: #3, #4)
  - [ ] 4.1 Update `ui/src/components/WorkPane.tsx` to read `selectedItem` from ProjectNavigationContext
  - [ ] 4.2 If `type === 'artifact'` → render `<SpecViewer path={selectedItem.path} />`
  - [ ] 4.3 If `type === 'story'` → render `<StoryViewer epicId={...} storyId={...} />`
  - [ ] 4.4 If `type === 'epic'` → render epic overview (list of stories with progress)
  - [ ] 4.5 If no selection → render default project overview (existing ProjectDetail content)

- [ ] Task 5: Tests (AC: #1, #2, #3, #4, #5)
  - [ ] 5.1 Test: ContextPane renders planning artifacts from BMAD data
  - [ ] 5.2 Test: ContextPane renders epic/story tree
  - [ ] 5.3 Test: Empty state shown when no BMAD structure
  - [ ] 5.4 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Existing Components to Reuse

- `MarkdownBody` (`ui/src/components/MarkdownBody.tsx`) — already renders markdown
- `StatusBadge` / `StatusIcon` — for story status display
- `SidebarSection` / `SidebarNavItem` — for tree structure patterns (study their style)
- `EmptyState` (`ui/src/components/EmptyState.tsx`) — for no-BMAD state
- `PageSkeleton` — for loading states
- Collapsible from shadcn: `npx shadcn@latest add collapsible` if not already installed

### Status Colors (match existing StatusIcon patterns)

| Status | Color | Icon |
|---|---|---|
| backlog | gray | circle outline |
| ready-for-dev | blue | circle dot |
| in-progress | yellow | circle half |
| review | purple | circle check outline |
| done | green | circle check filled |

### What NOT to do

- Do NOT modify Layout.tsx
- Do NOT create IPC/Electron code
- Do NOT duplicate the MarkdownBody component — reuse existing one
- Do NOT create database tables — BMAD data comes from REST API (filesystem)

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
