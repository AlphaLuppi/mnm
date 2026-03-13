# Story 5.3: Keyboard Shortcuts & Accessibility

Status: ready-for-dev

## Story

As a user,
I want keyboard shortcuts and accessibility features,
so that I can navigate MnM efficiently and accessibly.

## Acceptance Criteria

1. Navigation shortcuts work: Cmd+K (open search/command palette), Cmd+1/2/3/4 (switch tabs: Specs, Agents, Drift, Progress), Cmd+B (toggle sidebar), Cmd+Shift+P (command palette)
2. Agent control shortcuts work: Cmd+Shift+L (launch agent from current spec), Cmd+Shift+T (terminate selected agent), Space (pause/resume selected agent)
3. General shortcuts work: Cmd+, (settings), Cmd+Q (quit/close), Cmd+W (close current view)
4. Accessibility features implemented: screen reader support (ARIA labels on all interactive elements), high-contrast mode via theme, visible keyboard focus indicators (outline), tab navigation works on all interactive elements
5. Shortcuts are documented and viewable via Help menu or Cmd+/ shortcut reference

## Tasks / Subtasks

- [ ] Task 1: Implement keyboard shortcut system (AC: #1, #2, #3)
  - [ ] Create `src/lib/core/keyboard-shortcuts.ts` defining all shortcut mappings
  - [ ] Create `src/components/shared/shortcut-provider.tsx` React context that registers global keyboard listeners
  - [ ] Use `useEffect` with `keydown` event listener on `document` for global shortcuts
  - [ ] Handle platform differences (Cmd on macOS, Ctrl on others) with a `getModifierKey()` utility
  - [ ] Prevent shortcuts from firing when user is typing in input/textarea fields
- [ ] Task 2: Wire navigation shortcuts (AC: #1)
  - [ ] Cmd+K / Cmd+Shift+P: Open command palette (shadcn/ui Command component)
  - [ ] Cmd+1/2/3/4: Use Next.js `router.push()` to navigate to /specs, /agents, /drift, /progress
  - [ ] Cmd+B: Toggle sidebar collapsed/expanded state via React context
  - [ ] Cmd+,: Navigate to /settings
- [ ] Task 3: Wire agent control shortcuts (AC: #2)
  - [ ] Cmd+Shift+L: Open agent launch dialog (reuse Story 2.5)
  - [ ] Cmd+Shift+T: Terminate currently focused/selected agent (with confirmation dialog)
  - [ ] Space: Pause/resume currently focused agent (only when agent is selected, not in text input)
- [ ] Task 4: Build command palette (AC: #1)
  - [ ] Create `src/components/shared/command-palette.tsx` using shadcn/ui Command (cmdk)
  - [ ] Include all available actions: navigation, agent launch, settings, help
  - [ ] Fuzzy search across commands
  - [ ] Show keyboard shortcut hints next to each command
- [ ] Task 5: Implement accessibility features (AC: #4)
  - [ ] Audit all interactive components for ARIA labels (`aria-label`, `aria-labelledby`, `aria-describedby`)
  - [ ] Add `role` attributes where semantic HTML is insufficient
  - [ ] Ensure visible focus indicators on all focusable elements (`:focus-visible` outline)
  - [ ] Test tab navigation order is logical (left-to-right, top-to-bottom)
  - [ ] shadcn/ui components include accessibility by default; verify and supplement where needed
- [ ] Task 6: Create shortcut reference UI (AC: #5)
  - [ ] Create `src/components/shared/shortcut-reference.tsx` showing all shortcuts in a categorized list
  - [ ] Open via Help menu or Cmd+/ shortcut
  - [ ] Use shadcn/ui Dialog with searchable shortcut list
- [ ] Task 7: Write tests (AC: #1, #2, #4)
  - [ ] Unit tests for shortcut registration and key event handling
  - [ ] Test that shortcuts are disabled in input/textarea contexts
  - [ ] Accessibility audit: test ARIA labels present on key components
  - [ ] Test command palette search filtering

## Dev Notes

- shadcn/ui's Command component is built on `cmdk` (command menu for React) and provides an excellent command palette out of the box
- Keyboard shortcuts should be registered at the app layout level (`src/app/layout.tsx`) via the ShortcutProvider
- Use `e.metaKey` for Cmd on macOS; consider a helper that checks `navigator.platform` for cross-platform support
- Focus management: when opening a dialog via shortcut, focus should move to the dialog; when closing, focus returns to the trigger element
- ARIA considerations: shadcn/ui components are generally accessible but custom components need manual ARIA attributes
- The `Space` key for pause/resume should only work when an agent row/card has explicit focus, not globally

### Project Structure Notes

- `src/lib/core/keyboard-shortcuts.ts` -- shortcut definitions and key mappings
- `src/components/shared/shortcut-provider.tsx` -- React context for global shortcut handling
- `src/components/shared/command-palette.tsx` -- command palette component (cmdk-based)
- `src/components/shared/shortcut-reference.tsx` -- shortcut reference dialog

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.2 - Component Library: Command (cmdk)]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.1 - Page Layout]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
