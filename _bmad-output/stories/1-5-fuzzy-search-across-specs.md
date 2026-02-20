# Story 1.5: Fuzzy Search Across Specs

Status: ready-for-dev

## Story

As a user,
I want to search across all specs using fuzzy matching,
so that I can quickly find relevant content without remembering exact file names.

## Acceptance Criteria

1. A search panel opens via keyboard shortcut (Cmd+K)
2. A search input appears with fuzzy matching
3. As I type, results update in real-time (< 200ms latency)
4. Results show: spec title, file path, spec type badge
5. Results are ranked by relevance (title match > path match)
6. Pressing Enter on a result navigates to that spec
7. Search works across 500 specs with < 300ms response time
8. Keyboard navigation works (arrow keys to select, Enter to open, Escape to close)

## Tasks / Subtasks

- [ ] Task 1: Install and configure shadcn/ui Command component (AC: #1, #2)
  - [ ] Add `command` and `dialog` components: `npx shadcn@latest add command dialog`
  - [ ] The shadcn/ui Command component is built on `cmdk` which provides fuzzy search out of the box
- [ ] Task 2: Create search dialog component (AC: #1, #2, #8)
  - [ ] Create `src/components/specs/spec-search.tsx` (client component)
  - [ ] Use `CommandDialog` (Command inside a Dialog) for the search overlay
  - [ ] Register Cmd+K keyboard shortcut to open the dialog
  - [ ] Escape key closes the dialog
  - [ ] Arrow keys navigate results, Enter selects
- [ ] Task 3: Implement search data loading (AC: #3, #5, #7)
  - [ ] Fetch all specs on component mount (or use SWR with caching)
  - [ ] Use `cmdk`'s built-in fuzzy filtering (searches across value string)
  - [ ] Set `CommandItem` value to include both title and file path for broader matching
  - [ ] Results are automatically ranked by `cmdk`'s fuzzy scoring
- [ ] Task 4: Render search results (AC: #4)
  - [ ] Group results by spec type using `CommandGroup`
  - [ ] Each result displays:
    - Spec type icon (Lucide, matching tree view icons)
    - Spec title (primary text)
    - File path (secondary text, muted)
    - Spec type badge (using shadcn/ui `Badge`)
  - [ ] Show "No results found" when search yields nothing
- [ ] Task 5: Implement navigation on select (AC: #6)
  - [ ] On `CommandItem` select (Enter or click), navigate to `/specs/[id]`
  - [ ] Close the dialog after navigation
  - [ ] Use `useRouter` from Next.js for client-side navigation
- [ ] Task 6: Create search API route (AC: #7)
  - [ ] Create `src/app/api/specs/search/route.ts`
  - [ ] GET handler with `?q=` query parameter
  - [ ] Search across title and file_path fields using SQL LIKE
  - [ ] Return matching specs ordered by relevance

## Dev Notes

### Key Components

- **shadcn/ui Command**: Built on `cmdk` library, provides fuzzy search, keyboard navigation, and grouping out of the box. This is the standard "command palette" pattern (like Cmd+K in VS Code, Spotlight, etc.)
- **shadcn/ui Dialog**: Wraps the Command in a modal overlay
- **shadcn/ui Badge**: For spec type indicators in search results

### Architecture Decision

Two approaches for search:
1. **Client-side fuzzy search (recommended for POC)**: Load all specs into memory, use `cmdk`'s built-in filtering. Simple, fast for < 500 specs.
2. **Server-side search**: API route with SQL LIKE queries. Better for large datasets but adds network latency.

For the POC, use approach #1 (client-side). The API route in Task 6 is provided as a fallback.

### Command Palette Pattern

```tsx
// Simplified usage
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Search specs..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Stories">
      <CommandItem onSelect={() => router.push(`/specs/${id}`)}>
        <BookOpen className="mr-2 h-4 w-4" />
        <span>Story 1.1: App Layout</span>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

### Keyboard Shortcut Registration

Register the Cmd+K shortcut globally in the root layout or a dedicated keyboard handler:

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setOpen(true)
    }
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [])
```

### Project Structure Notes

- `src/components/specs/spec-search.tsx` -- search dialog (Client Component)
- `src/app/api/specs/search/route.ts` -- search API route (fallback)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5: Fuzzy Search Across Specs]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.2 - Component Library]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
