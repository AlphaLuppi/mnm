# Story 1.2: Three-Pane Resizable Layout

Status: ready-for-dev

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

- [ ] Task 1: Install shadcn resizable (AC: #1, #2)
  - [ ] 1.1 Run `cd ui && npx shadcn@latest add resizable`
  - [ ] 1.2 Verify `ui/src/components/ui/resizable.tsx` created
  - [ ] 1.3 Run `pnpm install`

- [ ] Task 2: Create ThreePaneLayout (AC: #1, #2, #3)
  - [ ] 2.1 Create `ui/src/components/ThreePaneLayout.tsx` using ResizablePanelGroup/Panel/Handle
  - [ ] 2.2 Props: `left`, `center`, `right` as ReactNode, optional `bottom`
  - [ ] 2.3 Default sizes 25/50/25, min sizes ~15% each
  - [ ] 2.4 PaneHeader sub-component: title, double-click to maximize
  - [ ] 2.5 Maximize state via useState — maximized panel gets 100%, others 0%

- [ ] Task 3: Create placeholder panes (AC: #1)
  - [ ] 3.1 Create `ui/src/components/ContextPane.tsx` — "Contexte" title + empty state
  - [ ] 3.2 Create `ui/src/components/WorkPane.tsx` — renders existing project content
  - [ ] 3.3 Create `ui/src/components/TestsPane.tsx` — "Tests & Validation" title + empty state
  - [ ] 3.4 Create `ui/src/components/TimelineBar.tsx` — 120px bottom bar, placeholder text

- [ ] Task 4: Integrate into ProjectDetail (AC: #1, #4)
  - [ ] 4.1 Modify `ui/src/pages/ProjectDetail.tsx` to use ThreePaneLayout
  - [ ] 4.2 Verify other pages unaffected

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
### Completion Notes List
### File List
