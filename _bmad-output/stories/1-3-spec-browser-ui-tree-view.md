# Story 1.3: Spec Browser UI (Tree View)

Status: ready-for-dev

## Story

As a user,
I want to browse my specs in a hierarchical tree view,
so that I can quickly find and navigate to specific documents.

## Acceptance Criteria

1. A left sidebar area (within the main content) displays a tree view of specs organized by type: Product Brief, PRD, Architecture, Stories, Config
2. Each spec shows its title and file path
3. Clicking a spec navigates to its detail view (`/specs/[id]`)
4. The tree supports collapse/expand per section
5. Keyboard navigation works (arrow keys to navigate, Enter to open)
6. The tree renders smoothly even with 500 specs (no jank or freezing)
7. Empty sections are hidden or show "No specs found"

## Tasks / Subtasks

- [ ] Task 1: Create spec browser page (AC: #1, #7)
  - [ ] Create `src/app/specs/page.tsx` as a Server Component
  - [ ] Fetch specs from `/api/specs` endpoint (or direct DB query in Server Component)
  - [ ] Group specs by `specType` for tree structure
  - [ ] Pass grouped data to the client tree component
- [ ] Task 2: Build tree view component (AC: #1, #2, #4)
  - [ ] Create `src/components/specs/spec-tree.tsx` (client component)
  - [ ] Use shadcn/ui `Collapsible` for expand/collapse sections
  - [ ] Use Lucide icons per spec type:
    - Product Brief: `FileText`
    - PRD: `FileSpreadsheet`
    - Architecture: `Blocks`
    - Stories: `BookOpen`
    - Config: `Settings`
  - [ ] Display title (primary) and file path (secondary, muted text)
  - [ ] Add expand/collapse chevron icons (ChevronRight / ChevronDown)
- [ ] Task 3: Implement navigation (AC: #3)
  - [ ] Use Next.js `Link` component or `useRouter` for navigation to `/specs/[id]`
  - [ ] Highlight currently selected spec in the tree
  - [ ] Generate spec `id` from SHA256 hash of file path (matching DB schema)
- [ ] Task 4: Add keyboard navigation (AC: #5)
  - [ ] Implement arrow key navigation (up/down to move, right to expand, left to collapse)
  - [ ] Enter key opens the selected spec
  - [ ] Maintain focus state for accessibility
- [ ] Task 5: Install additional shadcn/ui components
  - [ ] Add `collapsible` component: `npx shadcn@latest add collapsible`

## Dev Notes

### Key Components

- **shadcn/ui Collapsible**: For expand/collapse sections per spec type
- **Next.js Link**: Client-side navigation to spec detail pages
- **Lucide React icons**: Visual type indicators

### Tree Structure

```
Specs
├── Product Brief (1)
│   └── MnM Product Brief
├── PRD (1)
│   └── MnM PRD v1.0
├── Architecture (2)
│   ├── System Architecture
│   └── Web Architecture
├── Stories (47)
│   ├── Story 0.1: Next.js Project Init
│   ├── Story 0.2: SQLite Setup
│   └── ...
└── Config (0)
    (hidden or "No specs")
```

### Data Flow

```
Server Component (page.tsx)
  -> fetch specs from DB
  -> group by specType
  -> pass to SpecTree (client component)
    -> render collapsible sections
    -> navigate on click
```

### Styling Notes

- Tree items should have hover state (subtle background highlight)
- Selected item should have active state (accent color left border or background)
- Use `text-sm` for file paths, `text-base` for titles
- Indent nested items with `pl-4` or similar
- Use `ScrollArea` from shadcn/ui if the tree exceeds viewport height

### Project Structure Notes

- `src/app/specs/page.tsx` -- spec browser page (Server Component)
- `src/components/specs/spec-tree.tsx` -- tree view (Client Component)
- `src/app/specs/[id]/page.tsx` -- spec detail page (created in Story 1.4)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: Spec Browser UI (Tree View)]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9 - UI Architecture]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
