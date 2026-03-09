# Story 1.4: Hierarchical Navigation & Pane Synchronization

Status: ready-for-dev

## Story

As a **user**,
I want **the 3 panes to stay synchronized when I navigate the spec hierarchy**,
So that **clicking an epic/story in Context updates both the Work pane and Tests pane**.

## Context

Depends on: Stories 1.1, 1.2, 1.3.

This story implements the **Tests pane** (right) and the **synchronization** between all 3 panes. When the user selects an item in the Context pane, the Work pane shows the detail and the Tests pane shows the relevant acceptance criteria.

## Acceptance Criteria

### AC1 — Tests pane mirrors spec hierarchy

**Given** a BMAD project is loaded
**When** no specific item is selected
**Then** the Tests pane shows the full AC hierarchy: Project → Epics → Stories → ACs
**And** each AC shows a status: pending (default), pass, or fail

### AC2 — Selecting an epic syncs all panes

**Given** I click an epic in the Context pane
**When** the selection changes
**Then** the Work pane shows the epic overview (stories list with progress)
**And** the Tests pane filters to show only ACs for stories in that epic

### AC3 — Selecting a story syncs all panes

**Given** I click a story in the Context pane
**When** the selection changes
**Then** the Work pane shows the story detail (description, ACs, tasks)
**And** the Tests pane filters to show only ACs for that story
**And** the selected story is highlighted in the Context pane tree

### AC4 — Breadcrumb navigation

**Given** a story is selected
**When** I look at the Work pane header
**Then** I see a breadcrumb: Project > Epic N > Story N.M
**And** clicking a breadcrumb segment navigates to that level

### AC5 — ACs extracted as test items

**Given** a story has acceptance criteria (Given/When/Then)
**When** the Tests pane shows that story's tests
**Then** each AC is displayed as a test card with: ID, title, Given/When/Then text
**And** status is "pending" by default (will be updatable in future stories)

## Tasks / Subtasks

- [ ] Task 1: Build TestsPane component (AC: #1, #5)
  - [ ] 1.1 Update `ui/src/components/TestsPane.tsx` to use `useBmadProject(projectId)` hook
  - [ ] 1.2 Create `ui/src/components/TestCard.tsx` — card showing AC id, title, Given/When/Then blocks, status badge (pending/pass/fail)
  - [ ] 1.3 Render full hierarchy when no selection: collapsible Epics → Stories → ACs
  - [ ] 1.4 Each AC card has a status indicator: pending (gray), pass (green), fail (red)
  - [ ] 1.5 Show total counts per story: "3 ACs: 0 pass, 0 fail, 3 pending"

- [ ] Task 2: Implement pane synchronization (AC: #2, #3)
  - [ ] 2.1 Update `ProjectNavigationContext` to expose `selectedEpicId` and `selectedStoryId` derived from `selectedItem`
  - [ ] 2.2 Update `TestsPane` to read selection from context and filter displayed ACs
  - [ ] 2.3 When epic selected → TestsPane shows all ACs for all stories in that epic
  - [ ] 2.4 When story selected → TestsPane shows only that story's ACs
  - [ ] 2.5 When nothing selected → TestsPane shows full project hierarchy
  - [ ] 2.6 Add visual highlight to selected item in ContextPane (bg-accent/10 or similar)

- [ ] Task 3: Breadcrumb navigation (AC: #4)
  - [ ] 3.1 Create `ui/src/components/PaneBreadcrumb.tsx` — renders clickable breadcrumb segments
  - [ ] 3.2 Show in WorkPane header area: "Project" > "Epic 1: Title" > "Story 1.2: Title"
  - [ ] 3.3 Clicking "Project" clears selection, clicking "Epic" selects that epic level
  - [ ] 3.4 Use existing `BreadcrumbBar` patterns for styling consistency

- [ ] Task 4: Tests (AC: #1, #2, #3, #5)
  - [ ] 4.1 Test: TestsPane renders all ACs when no selection
  - [ ] 4.2 Test: TestsPane filters to story ACs when story selected
  - [ ] 4.3 Test: Breadcrumb renders correct segments for story selection
  - [ ] 4.4 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### TestCard Design

```
┌─────────────────────────────────────┐
│ ○ AC1 — Title here           pending│
│                                     │
│ Given: the user is logged in        │
│ When: they click the button         │
│ Then: the action completes          │
└─────────────────────────────────────┘
```

Status indicators:
- pending: `text-muted-foreground` + gray circle
- pass: `text-green-500` + check circle
- fail: `text-red-500` + x circle

### Sync Flow

```
User clicks in ContextPane
  → setSelectedItem() in ProjectNavigationContext
  → WorkPane reads selectedItem → renders appropriate view
  → TestsPane reads selectedItem → filters ACs accordingly
```

### What NOT to do

- Do NOT persist selection state to backend — it's local UI state only
- Do NOT implement test execution (Story 7.x)
- Do NOT implement status updates for ACs (future story)
- Do NOT modify Layout.tsx

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
