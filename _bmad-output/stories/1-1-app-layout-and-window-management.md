# Story 1.1: App Layout & Window Management

Status: ready-for-dev

## Story

As a user,
I want MnM to load quickly with a clean, professional layout,
so that I can start working immediately.

## Acceptance Criteria

1. The root layout renders a sidebar + main content area structure
2. The sidebar contains navigation links: Specs, Agents, Drift, Progress, Settings
3. The main content area renders the active page via App Router
4. A header bar displays the project name, current git branch, and a notification badge area
5. A status bar at the bottom shows agent count and drift count
6. Light and dark themes are supported (default: system preference via `next-themes`)
7. The layout is responsive with a minimum supported width of 800px
8. The app loads at `http://localhost:3000` within 2 seconds in development mode

## Tasks / Subtasks

- [ ] Task 1: Create root layout with sidebar (AC: #1, #2)
  - [ ] Install shadcn/ui `sidebar` component: `npx shadcn@latest add sidebar`
  - [ ] Create `src/components/layout/app-sidebar.tsx` with nav items (Specs, Agents, Drift, Progress, Settings)
  - [ ] Use `SidebarProvider` and `SidebarInset` in `src/app/layout.tsx`
  - [ ] Add Lucide icons for each nav item (FileText, Bot, GitCompare, BarChart3, Settings)
- [ ] Task 2: Create header bar (AC: #4)
  - [ ] Create `src/components/layout/app-header.tsx`
  - [ ] Display project name (from config or repo directory name)
  - [ ] Display current git branch (fetched server-side via simple-git)
  - [ ] Add notification badge placeholder for drift/spec change alerts
- [ ] Task 3: Create status bar (AC: #5)
  - [ ] Create `src/components/layout/status-bar.tsx`
  - [ ] Display running agent count and pending drift count (placeholder values for now)
- [ ] Task 4: Set up theming (AC: #6)
  - [ ] Install `next-themes`: `npm install next-themes`
  - [ ] Add `ThemeProvider` to root layout
  - [ ] Add theme toggle button in sidebar footer (Sun/Moon icon)
  - [ ] Configure shadcn/ui dark mode via CSS class strategy
- [ ] Task 5: Create page shells (AC: #3)
  - [ ] Create `src/app/specs/page.tsx` with placeholder content
  - [ ] Create `src/app/agents/page.tsx` with placeholder content
  - [ ] Create `src/app/drift/page.tsx` with placeholder content
  - [ ] Create `src/app/progress/page.tsx` with placeholder content
  - [ ] Create `src/app/settings/page.tsx` with placeholder content
  - [ ] Set `src/app/page.tsx` as dashboard home with welcome message
- [ ] Task 6: Verify responsive layout (AC: #7, #8)
  - [ ] Ensure sidebar collapses on narrow viewports
  - [ ] Verify minimum 800px width works properly
  - [ ] Test that `npm run dev` loads the app within 2 seconds

## Dev Notes

### Key Components

- **shadcn/ui Sidebar**: Use the full sidebar component (SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton)
- **next-themes**: Handles system preference detection and theme persistence
- **Lucide React**: Icon set (already included with shadcn/ui)

### Layout Architecture

```
src/app/layout.tsx (ThemeProvider + SidebarProvider)
  +-- AppSidebar (navigation)
  +-- SidebarInset
       +-- AppHeader (breadcrumb, git branch, alerts)
       +-- {children} (page content)
       +-- StatusBar (agent/drift counts)
```

### Design System

- Follow the Zed-inspired aesthetic: clean, minimal, monospace-friendly
- Use `font-mono` for code-related content, default sans for UI
- Primary accent color: blue (consistent with shadcn/ui defaults)
- Sidebar width: ~240px (shadcn/ui default)

### Critical Constraints

- The header's git branch display requires a server-side data fetch (simple-git runs server-side only)
- Use a Server Component for the header or fetch via API route
- Theme toggle must work without page reload (client-side via next-themes)

### Project Structure Notes

- `src/components/layout/` -- new directory for layout components
- `src/app/` -- page shells for all 5 main sections
- All layout components are client components (interactivity required)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: GPUI App Initialization & Window Management]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9 - UI Architecture]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 3 - Project Structure]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
