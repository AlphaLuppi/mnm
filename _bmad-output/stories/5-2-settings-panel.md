# Story 5.2: Settings Panel (Preferences)

Status: ready-for-dev

## Story

As a user,
I want to configure MnM settings,
so that I can customize behavior to my preferences.

## Acceptance Criteria

1. When Settings is opened (via Cmd+, or navigation), a settings panel appears with tabs: General, Git, Agent, API, Privacy
2. General tab: Theme (Light, Dark, System), Font size (12-20px slider), Enable/disable drift detection toggle
3. Git tab: Auto-detect important files on startup toggle, Re-run important file detection button, Git hooks enable/disable toggle
4. Agent tab: Default agent type dropdown (TDD, Implementation, E2E, Review), Max concurrent agents (1-10 number input), Agent timeout in seconds
5. API tab: Claude API key (update/remove with masked display), Custom drift instructions path input
6. Privacy tab: Telemetry opt-in toggle (disabled by default), Clear local database button with confirmation
7. Settings are saved to `.mnm/config.json` via settings API
8. Changes apply immediately without restart (except where noted)

## Tasks / Subtasks

- [ ] Task 1: Create settings page layout (AC: #1)
  - [ ] Create `src/app/settings/page.tsx` with tabbed layout using shadcn/ui Tabs
  - [ ] Define 5 tabs: General, Git, Agent, API, Privacy
  - [ ] Wire Cmd+, keyboard shortcut to navigate to settings page
- [ ] Task 2: Build General tab (AC: #2)
  - [ ] Create `src/components/settings/general-tab.tsx`
  - [ ] Theme selector using shadcn/ui Select (Light, Dark, System)
  - [ ] Font size slider using shadcn/ui Slider (12-20px range)
  - [ ] Drift detection toggle using shadcn/ui Switch
  - [ ] Apply theme changes immediately via CSS class on document root
- [ ] Task 3: Build Git tab (AC: #3)
  - [ ] Create `src/components/settings/git-tab.tsx`
  - [ ] Auto-detect important files toggle (Switch)
  - [ ] "Re-run Detection" button that triggers `POST /api/onboarding/detect-files`
  - [ ] Git hooks enable/disable toggle
- [ ] Task 4: Build Agent tab (AC: #4)
  - [ ] Create `src/components/settings/agent-tab.tsx`
  - [ ] Default agent type dropdown (Select) with options: TDD, Implementation, E2E, Review
  - [ ] Max concurrent agents number input (Input with min=1, max=10)
  - [ ] Agent timeout input in seconds (Input with reasonable defaults)
- [ ] Task 5: Build API tab (AC: #5)
  - [ ] Create `src/components/settings/api-tab.tsx`
  - [ ] Claude API key display (masked: "sk-...xxxx") with "Update" and "Remove" buttons
  - [ ] "Update Key" opens inline input with validation (reuse validate-key endpoint)
  - [ ] Custom drift instructions path input with file path validation
- [ ] Task 6: Build Privacy tab (AC: #6)
  - [ ] Create `src/components/settings/privacy-tab.tsx`
  - [ ] Telemetry opt-in toggle (Switch, default off) with explanation text
  - [ ] "Clear Local Database" button with shadcn/ui AlertDialog confirmation
  - [ ] On confirm, call `POST /api/settings/clear-database` to reset `.mnm/state.db`
- [ ] Task 7: Implement settings API (AC: #7, #8)
  - [ ] `GET /api/settings` returns current settings from `.mnm/config.json`
  - [ ] `PATCH /api/settings` updates individual settings fields
  - [ ] `POST /api/settings/clear-database` drops and recreates database
  - [ ] Validate settings values with Zod schema before persisting
- [ ] Task 8: Write tests (AC: #1, #7, #8)
  - [ ] Component tests for each tab rendering
  - [ ] Test settings persistence round-trip (save and reload)
  - [ ] Test immediate theme application
  - [ ] Integration test for settings API endpoints

## Dev Notes

- Settings are persisted in `.mnm/config.json` (Story 0.7 establishes the config pattern)
- Theme switching uses the `class` strategy on `<html>` element: `dark` class for dark mode, no class for light, `prefers-color-scheme` media query for system
- Tailwind CSS v4 supports dark mode via the `dark:` variant prefix
- "Clear Local Database" is a destructive action: use AlertDialog with "This will delete all agent history, drift detections, and spec index. This cannot be undone." warning
- Font size change applies to the main content area via CSS custom property `--mnm-font-size`
- The settings page is a standard Next.js page at `/settings`, not a modal

### Project Structure Notes

- `src/app/settings/page.tsx` -- settings page
- `src/components/settings/` -- new directory for all settings tab components
- `src/app/api/settings/route.ts` -- settings CRUD API (GET/PATCH)
- `src/app/api/settings/clear-database/route.ts` -- database reset endpoint
- Reuses config management from `src/lib/core/` (Story 0.7)

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 3.1 - Directory Layout: `src/app/settings/`]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5.1 - Route Overview: `/api/settings`]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.2 - Component Library: Tabs, Switch, Select, Slider, AlertDialog]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
