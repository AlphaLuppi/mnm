# Story 1.2: Three-Pane Resizable Layout

Status: review

## Story

As a **user**,
I want **to see a 3-pane resizable layout when viewing a project**,
So that **I have the cockpit structure for supervising my project**.

## Context

The existing layout: `CompanyRail | Sidebar | <Outlet /> | PropertiesPanel`. This story modifies ONLY `ProjectDetail.tsx` to replace its content with a 3-pane layout. Layout.tsx stays untouched.

## Acceptance Criteria

### AC1 — Three-pane visible on project page

**Given** I navigate to a project detail page
**When** the page loads
**Then** 3 resizable panes: Context (25%) | Work (50%) | Tests (25%)

### AC2 — Resizable with constraints

**Given** panes are displayed
**When** I drag a separator
**Then** panes resize respecting min widths (Context 200px, Work 400px, Tests 200px)

### AC3 — Maximize/restore pane

**Given** a pane is visible
**When** I double-click its header
**Then** it maximizes; double-click again restores

### AC4 — Other pages unchanged

**Given** I navigate to Dashboard or Issues
**When** the page loads
**Then** standard single-content layout (no 3-pane)

## Tasks / Subtasks

- [x] Task 1: Install shadcn resizable (AC: #1, #2)
  - [x] 1.1 Run `cd ui && npx shadcn@latest add resizable`
  - [x] 1.2 Verify `ui/src/components/ui/resizable.tsx` created
  - [x] 1.3 Run `pnpm install`

- [x] Task 2: Create ThreePaneLayout (AC: #1, #2, #3)
  - [x] 2.1 Create `ui/src/components/ThreePaneLayout.tsx` using ResizablePanelGroup/Panel/Handle
  - [x] 2.2 Props: `left`, `center`, `right` as ReactNode, optional `bottom`
  - [x] 2.3 Default sizes 25/50/25, min sizes ~15% each
  - [x] 2.4 PaneHeader sub-component: title, double-click to maximize
  - [x] 2.5 Maximize state via useState — maximized panel gets 100%, others 0%

- [x] Task 3: Create placeholder panes (AC: #1)
  - [x] 3.1 Create `ui/src/components/ContextPane.tsx` — "Contexte" title + empty state
  - [x] 3.2 Create `ui/src/components/WorkPane.tsx` — renders existing project content
  - [x] 3.3 Create `ui/src/components/TestsPane.tsx` — "Tests & Validation" title + empty state
  - [x] 3.4 Create `ui/src/components/TimelineBar.tsx` — 120px bottom bar, placeholder text

- [x] Task 4: Integrate into ProjectDetail (AC: #1, #4)
  - [x] 4.1 Modify `ui/src/pages/ProjectDetail.tsx` to use ThreePaneLayout
  - [x] 4.2 Verify other pages unaffected

- [ ] Task 5: Tests (AC: #1-#4)
  - [ ] 5.1 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### shadcn Resizable usage
```tsx
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={25} minSize={15}>{left}</ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={50} minSize={30}>{center}</ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={25} minSize={15}>{right}</ResizablePanel>
</ResizablePanelGroup>
```

### Styling — follow existing patterns
- `bg-background`, `border-border`, `text-foreground`, `text-muted-foreground`
- Use `cn()` from `ui/src/lib/utils`
- Do NOT modify Layout.tsx

## Dev Agent Record
### Agent Model Used
Implemented by Tom (pre-workflow, manual development)

### Completion Notes List
**Reconciliation — 2026-03-12**

AC1, AC2, AC3, AC4 tous couverts.

- AC3 implemente le 2026-03-12 : double-clic sur le header de n'importe quel pane le maximise (100%), les autres panes sont masques. Double-clic a nouveau restaure le layout normal.
- Le bottom bar (timeline) est masque en mode maximize.

**Gap restant : Task 5 (tests)**

### File List
- `ui/src/components/ThreePaneLayout.tsx`
- `ui/src/components/ContextPane.tsx`
- `ui/src/components/WorkPane.tsx`
- `ui/src/components/TestsPane.tsx`
- `ui/src/components/TimelineBar.tsx`
- `ui/src/components/ui/resizable.tsx`
- `ui/src/pages/ProjectDetail.tsx` (modifie)

### Change Log
- 2026-03-12: Reconciliation — AC3 (maximize/restore) identifie comme gap. Tests manquants.
- 2026-03-12: AC3 implemente — double-clic maximize/restore sur les 3 panes.
