# Story 1.7: Code-to-Spec Linking

Status: ready-for-dev

## Story

As a user,
I want to see which specs are related to a code file,
so that I can understand the context and requirements behind the implementation.

## Acceptance Criteria

1. When a code file is open in the viewer, a "Related Specs" panel is displayed
2. The panel shows specs that reference this file (via agent scope, file path mention, or git history)
3. Clicking a related spec navigates to the spec detail view (`/specs/[id]`)
4. If no specs are found, the panel displays "No related specs found"
5. The linking is updated when agents work on files (agent scope creates association)

## Tasks / Subtasks

- [ ] Task 1: Implement linking logic (AC: #2, #5)
  - [ ] Create `src/lib/spec/linker.ts`
  - [ ] Strategy 1: Check `agents` table for agents whose `scope` JSON array includes this file path, then follow `specId` to get the related spec
  - [ ] Strategy 2: Search `specs` table content for mentions of the file path
  - [ ] Strategy 3: Use git log to find commits that touched both the code file and a spec file
  - [ ] Combine results and deduplicate
  - [ ] Return list of related specs with link reason ("Agent worked on this file", "Mentioned in spec", "Co-committed")
- [ ] Task 2: Create related specs API route (AC: #2)
  - [ ] Create `src/app/api/files/[...path]/related-specs/route.ts`
  - [ ] GET handler: given a file path, return related specs using the linker
  - [ ] Return: `{ specs: [{ id, title, specType, filePath, linkReason }] }`
- [ ] Task 3: Build Related Specs panel component (AC: #1, #3, #4)
  - [ ] Create `src/components/files/related-specs-panel.tsx` (client component)
  - [ ] Display as a sidebar panel or collapsible section next to the code viewer
  - [ ] Each spec shows: type icon, title, link reason (muted text)
  - [ ] Clicking navigates to `/specs/[id]`
  - [ ] Show "No related specs found" with a subtle icon when empty
  - [ ] Use shadcn/ui `Card` for each related spec entry
- [ ] Task 4: Integrate into files page (AC: #1)
  - [ ] Update `src/app/files/page.tsx` to include the Related Specs panel
  - [ ] Three-panel layout: file tree (left) + code viewer (center) + related specs (right)
  - [ ] Or: two-panel with related specs as a collapsible section within the code viewer pane
  - [ ] Fetch related specs when a file is selected

## Dev Notes

### Linking Strategy Priority

For the POC, the simplest and most reliable linking strategy is:

1. **Agent scope (primary)**: When an agent is launched against a spec with a file scope, that creates a direct link between the spec and the files in scope. This is already stored in the `agents` table.
2. **Path mention (secondary)**: Simple string search of spec content for the file path. Fast but may produce false positives.
3. **Git co-commits (tertiary)**: More sophisticated but slower. Defer full implementation to post-POC if needed.

Start with strategy #1 (agent scope) as it is the most reliable and directly supported by the data model.

### Panel Layout Options

**Option A: Three-panel (recommended)**
```
[File Tree] | [Code Viewer] | [Related Specs]
   ~250px   |    flex-1     |    ~250px
```

**Option B: Inline section**
```
[File Tree] | [Code Viewer          ]
   ~250px   | [Related Specs (below)]
```

Use `ResizablePanelGroup` (already added in Story 1.6) for adjustable panels.

### Project Structure Notes

- `src/lib/spec/linker.ts` -- linking logic
- `src/app/api/files/[...path]/related-specs/route.ts` -- API route
- `src/components/files/related-specs-panel.tsx` -- UI panel

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7: Code-to-Spec Linking]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 4 - Data Model (agents table)]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
