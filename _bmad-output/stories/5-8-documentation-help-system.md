# Story 5.8: Documentation & Help System

Status: ready-for-dev

## Story

As a user,
I want in-app help and documentation,
so that I can learn MnM without leaving the app.

## Acceptance Criteria

1. Help menu is accessible from the app header and shows options: Quick Start Guide, Keyboard Shortcuts, Documentation, Report Issue, About
2. Quick Start Guide provides an interactive tutorial with overlay tooltips walking through: browse specs, launch agent, view drift
3. Keyboard Shortcuts section shows full searchable list of all shortcuts (reuse from Story 5.3)
4. Documentation link opens external docs site (or in-app markdown viewer for POC)
5. Report Issue opens GitHub Issues page with pre-filled MnM version and OS version
6. About section shows: MnM version, Next.js version, License (Apache 2.0 or similar), Credits
7. Tooltips appear on hover for complex UI elements throughout the app
8. First-time users see contextual help hints that can be dismissed and re-enabled in settings

## Tasks / Subtasks

- [ ] Task 1: Create Help menu dropdown (AC: #1)
  - [ ] Create `src/components/layout/help-menu.tsx` using shadcn/ui DropdownMenu
  - [ ] Menu items: Quick Start Guide, Keyboard Shortcuts, Documentation, Report Issue, About
  - [ ] Place in app header next to settings icon
  - [ ] Wire Cmd+? shortcut to open help menu
- [ ] Task 2: Build Quick Start Guide (AC: #2)
  - [ ] Create `src/components/help/quick-start-guide.tsx` as an overlay tutorial
  - [ ] Implement step-by-step walkthrough: highlight UI element, show tooltip with instruction, "Next" button
  - [ ] Steps: (1) "This is the spec browser" -> (2) "Click to view a spec" -> (3) "Launch an agent here" -> (4) "View drift alerts here"
  - [ ] Use a spotlight/overlay approach: dim everything except the highlighted element
  - [ ] Store completion state in config (do not show again unless re-triggered)
- [ ] Task 3: Integrate keyboard shortcuts reference (AC: #3)
  - [ ] Reuse `shortcut-reference.tsx` from Story 5.3
  - [ ] Wire "Keyboard Shortcuts" menu item to open the shortcut dialog
- [ ] Task 4: Build About dialog (AC: #6)
  - [ ] Create `src/components/help/about-dialog.tsx` using shadcn/ui Dialog
  - [ ] Display: app name, version (from package.json), Next.js version, Node.js version
  - [ ] License information (Apache 2.0 or project license)
  - [ ] Credits section with team/contributor info
  - [ ] Read version from `package.json` at build time via Next.js publicRuntimeConfig or env var
- [ ] Task 5: Implement Report Issue link (AC: #5)
  - [ ] Reuse `issue-reporter.ts` from Story 5.6 for URL generation
  - [ ] Pre-fill: MnM version, OS (from `navigator.userAgent`), "Steps to reproduce" template
  - [ ] Open in new browser tab
- [ ] Task 6: Add contextual tooltips (AC: #7)
  - [ ] Audit key UI elements that benefit from tooltips (agent status badges, drift severity indicators, spec type badges)
  - [ ] Use shadcn/ui Tooltip component wrapping relevant elements
  - [ ] Tooltip content should be concise (1 sentence max)
- [ ] Task 7: Implement first-time help hints (AC: #8)
  - [ ] Create `src/components/help/contextual-hint.tsx` - small hint banners that appear near relevant UI elements
  - [ ] Track which hints have been dismissed in config
  - [ ] "Don't show again" checkbox per hint
  - [ ] Re-enable all hints via Settings option
- [ ] Task 8: Write tests (AC: #1, #2, #6)
  - [ ] Component test for help menu rendering all items
  - [ ] Test quick start guide step navigation
  - [ ] Test about dialog displays correct version info
  - [ ] Test contextual hints dismiss and persist state

## Dev Notes

- The Quick Start Guide overlay is the most complex part; for the POC, a simple step-by-step dialog with screenshots/descriptions is sufficient (no need for pixel-perfect spotlight overlay)
- Consider using a lightweight tour library like `react-joyride` if the custom spotlight approach proves too complex
- Version information: use `process.env.npm_package_version` or read `package.json` at build time
- Tooltips via shadcn/ui Tooltip are built on Radix UI and handle positioning, delays, and accessibility automatically
- Documentation link for the POC can point to the project README or a simple in-app markdown page

### Project Structure Notes

- `src/components/layout/help-menu.tsx` -- help dropdown in header
- `src/components/help/` -- new directory for help-related components
- `src/components/help/quick-start-guide.tsx` -- interactive tutorial
- `src/components/help/about-dialog.tsx` -- about information
- `src/components/help/contextual-hint.tsx` -- first-time hints

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.2 - Component Library: DropdownMenu, Dialog, Tooltip]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.1 - Page Layout: Header area]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.8]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
