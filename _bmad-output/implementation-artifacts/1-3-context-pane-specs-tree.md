# Story 1.3: Context Pane — Specs Tree

Status: review

## Story

As a **user**,
I want **the Context pane to display my BMAD specs (planning artifacts + epic/story tree)**,
So that **I can navigate all my project documentation**.

## Context

Depends on: 1.1 (BMAD API), 1.2 (three-pane layout). Fills the left pane with real BMAD data.

## Acceptance Criteria

### AC1 — Planning artifacts listed

**Given** project has BMAD structure
**When** Context pane loads
**Then** "Planning" section lists: Product Brief, PRD, Architecture, etc. with type icons

### AC2 — Epic/Story tree

**Given** implementation artifacts exist
**When** Context pane loads
**Then** collapsible tree: Epics → Stories with status badges and epic progress

### AC3 — Click artifact selects it

**Given** planning artifacts listed
**When** I click one
**Then** it's marked as selected (highlight) and the event propagates to other panes

### AC4 — Empty state

**Given** no BMAD structure found
**When** Context pane loads
**Then** shows "No BMAD structure detected" empty state

## Tasks / Subtasks

- [x] Task 1: ProjectNavigationContext (AC: #3)
  - [x] 1.1 Create `ui/src/context/ProjectNavigationContext.tsx`
  - [x] 1.2 State: `selectedItem: { type: 'artifact'|'epic'|'story'; id: string; path?: string } | null`
  - [x] 1.3 Actions: `selectArtifact(path)`, `selectEpic(epicId)`, `selectStory(epicId, storyId)`
  - [x] 1.4 Wrap ThreePaneLayout in ProjectDetail with this provider

- [x] Task 2: ContextPane with BMAD data (AC: #1, #2, #3, #4)
  - [x] 2.1 Update ContextPane to use `useBmadProject(projectId)`
  - [x] 2.2 "Planning" collapsible section — artifact icons (FileText, Building, etc.) + titles
  - [x] 2.3 "Epics" collapsible tree — epic headers with progress, story rows with status
  - [x] 2.4 Click handlers call navigation context actions
  - [x] 2.5 Handle loading (skeleton), error, and empty states
  - [x] 2.6 Install shadcn collapsible if needed: `npx shadcn@latest add collapsible`

- [ ] Task 3: Tests
  - [ ] 3.1 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Status badge colors (match existing StatusIcon)
- backlog: gray
- ready-for-dev: blue
- in-progress: yellow
- review: purple
- done: green

### Reuse existing components
- `EmptyState`, `SidebarSection`/`SidebarNavItem` (for tree style), `ScrollArea`

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

Tous les ACs couverts. Deviations mineures de nommage :
- Utilise `useWorkspaceContext` au lieu de `useBmadProject`
- `selectNode()` au lieu de `selectEpic()`/`selectStory()` (API plus generique)
- Hierarchie basee sur `ContextNode` (profondeur infinie) au lieu de Epic/Story fixe
- Empty state confirme : affiche "No workspace structure detected" quand `wsCtx.detected=false`

**Gap : Task 3 (tests) non implementee**

### File List
- `ui/src/context/ProjectNavigationContext.tsx`
- `ui/src/components/ContextPane.tsx`
- `ui/src/pages/ProjectDetail.tsx` (modifie — provider wrapping)

### Change Log
- 2026-03-12: Reconciliation — tous ACs couverts, deviations de nommage documentees. Tests manquants.
