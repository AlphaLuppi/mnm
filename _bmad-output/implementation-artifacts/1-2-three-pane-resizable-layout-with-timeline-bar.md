# Story 1.2: Three-Pane Resizable Layout with Timeline Bar

Status: ready-for-dev

## Story

As a **user**,
I want **to see the 3-pane layout (Contexte / Agents / Tests) with a bottom timeline bar when viewing a project**,
So that **I have the cockpit structure for supervising my project**.

## Context

MnM is a Paperclip AI fork (web app, not Electron). The existing layout is:
`CompanyRail | Sidebar | Main Content (Outlet) | PropertiesPanel`

This story transforms the **ProjectDetail page** (`ui/src/pages/ProjectDetail.tsx`) to use a 3-pane layout instead of the standard single-content area. Other pages (Dashboard, Issues, Costs, etc.) keep the existing layout unchanged.

The 3 panes replace the main `<Outlet />` content area when viewing a project:
- **Left (Context)**: Specs tree — planning artifacts + epic/story hierarchy
- **Center (Work)**: Current view — agent detail, story content, markdown viewer
- **Right (Tests)**: Acceptance criteria mirror of the spec hierarchy

## Acceptance Criteria

### AC1 — Three-pane layout visible on project page

**Given** I navigate to a project detail page
**When** the page loads
**Then** 3 resizable panes are visible: Context (left, 25%), Work (center, 50%), Tests (right, 25%)
**And** each pane has a header with its title

### AC2 — Resizable panes with constraints

**Given** the panes are displayed
**When** I drag the separator between two panes
**Then** the panes resize respecting constraints: Context min 200px, Work min 400px, Tests min 200px

### AC3 — Double-click to maximize/restore

**Given** a pane is visible
**When** I double-click on its header
**Then** that pane maximizes (takes full width)
**And** a second double-click restores the previous size

### AC4 — Timeline bar at bottom

**Given** the project view is loaded
**When** I see the layout
**Then** a timeline bar is visible at the bottom (120px height)
**And** it shows a placeholder "Timeline — activite des agents" text

### AC5 — Non-project pages unchanged

**Given** I navigate to Dashboard, Issues, or any non-project page
**When** the page loads
**Then** the standard single-content layout is used (no 3-pane)

## Tasks / Subtasks

- [ ] Task 1: Install shadcn/ui resizable component (AC: #1, #2)
  - [ ] 1.1 Run `npx shadcn@latest add resizable` in `ui/` directory (installs `react-resizable-panels`)
  - [ ] 1.2 Verify `ui/src/components/ui/resizable.tsx` is created
  - [ ] 1.3 Run `pnpm install` to ensure `react-resizable-panels` is in lockfile

- [ ] Task 2: Create ThreePaneLayout component (AC: #1, #2, #3)
  - [ ] 2.1 Create `ui/src/components/ThreePaneLayout.tsx` using shadcn `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`
  - [ ] 2.2 Set direction="horizontal", default sizes: left 25%, center 50%, right 25%
  - [ ] 2.3 Apply min size constraints via `minSize` prop (convert px to % based on a 1440px reference)
  - [ ] 2.4 Each panel renders a `PaneHeader` (title text + maximize button) and a `ScrollArea` for content
  - [ ] 2.5 Create `PaneHeader` sub-component with: title, icon, double-click to maximize/restore handler
  - [ ] 2.6 Track maximized pane state with `useState` — when maximized, set that panel to 100% and others to 0%
  - [ ] 2.7 Accept `left`, `center`, `right` as React.ReactNode children props

- [ ] Task 3: Create TimelineBar component (AC: #4)
  - [ ] 3.1 Create `ui/src/components/TimelineBar.tsx` — horizontal bar, fixed 120px height, border-t
  - [ ] 3.2 Placeholder content: "Timeline — activite des agents" with muted text
  - [ ] 3.3 Style consistent with existing app: `bg-background`, `border-border`, `text-muted-foreground`

- [ ] Task 4: Create placeholder pane components (AC: #1)
  - [ ] 4.1 Create `ui/src/components/ContextPane.tsx` — placeholder with "Contexte" title and empty state
  - [ ] 4.2 Create `ui/src/components/WorkPane.tsx` — placeholder showing existing project detail content
  - [ ] 4.3 Create `ui/src/components/TestsPane.tsx` — placeholder with "Tests & Validation" title and empty state

- [ ] Task 5: Integrate into ProjectDetail page (AC: #1, #5)
  - [ ] 5.1 Modify `ui/src/pages/ProjectDetail.tsx` to wrap content in `<ThreePaneLayout>`
  - [ ] 5.2 Pass `<ContextPane />` as left, existing project content as center, `<TestsPane />` as right
  - [ ] 5.3 Add `<TimelineBar />` below the ThreePaneLayout
  - [ ] 5.4 Verify other pages (Dashboard, Issues, etc.) are not affected

- [ ] Task 6: Tests (AC: #1, #2, #3)
  - [ ] 6.1 Write test: ThreePaneLayout renders 3 panels with correct default sizes
  - [ ] 6.2 Write test: PaneHeader displays title correctly
  - [ ] 6.3 Verify the app compiles without errors: `cd ui && pnpm build`

## Dev Notes

### Existing Layout Structure

The current `Layout.tsx` renders:
```
CompanyRail | Sidebar | <main><Outlet /></main> | PropertiesPanel
```

`ProjectDetail.tsx` is rendered inside `<Outlet />`. We modify ONLY ProjectDetail — the Layout component stays untouched.

### shadcn Resizable Usage

```tsx
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={25} minSize={15}>
    {left}
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={50} minSize={30}>
    {center}
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={25} minSize={15}>
    {right}
  </ResizablePanel>
</ResizablePanelGroup>
```

### Styling

Follow existing patterns in the codebase:
- Backgrounds: `bg-background`
- Borders: `border-border`
- Text: `text-foreground`, `text-muted-foreground`
- Spacing: `p-4 md:p-6` (like existing main content)
- Use `cn()` from `ui/src/lib/utils` for conditional classes

### What NOT to do

- Do NOT modify `Layout.tsx` — only modify `ProjectDetail.tsx`
- Do NOT create Zustand stores — use local component state for maximize toggle
- Do NOT add routing — the 3-pane is all within the ProjectDetail page
- Do NOT create IPC/Electron code
- Do NOT implement content for the panes yet (that's stories 1.3 and 1.4)

### References

- Existing layout: `ui/src/components/Layout.tsx`
- Project detail page: `ui/src/pages/ProjectDetail.tsx`
- shadcn/ui resizable: https://ui.shadcn.com/docs/components/resizable
- Existing component patterns: `ui/src/components/Sidebar.tsx`, `ui/src/components/PropertiesPanel.tsx`

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
