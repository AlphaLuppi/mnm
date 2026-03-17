# UI/UX Design Audit Report -- MnM

> **Version**: 1.0 | **Date**: 2026-03-17 | **Auditor**: Claude Opus 4.6 (1M context)
> **Scope**: All files in `ui/src/pages/` and `ui/src/components/` -- 38 pages, ~95 components
> **Reference**: `ux-design-b2b.md` (UX Design Spec v1.0)

---

## Executive Summary

**Overall Rating: 7.2 / 10**

MnM's UI is a **solid, functional enterprise cockpit** built on a well-chosen stack (shadcn/ui + Tailwind + React Query). The 69 B2B stories have been implemented with consistent patterns and good data-fetching discipline. The codebase shows clear evidence of a unified engineering vision: every page follows the same layout, uses the same component vocabulary, and handles loading/error/empty states.

### Top 3 Strengths
1. **Consistent architecture** -- Every page follows the same pattern: breadcrumbs, loading skeleton, error state, empty state, data state. React Query is used uniformly with proper query keys.
2. **Comprehensive B2B feature set** -- RBAC with permission-gated sidebar items, audit log with hash chain verification, SSO configuration, automation cursors with hierarchy resolution, drift detection with diff viewer, onboarding wizard. All 69 stories are represented in the UI.
3. **Good mobile foundation** -- Mobile bottom nav, swipe-to-open sidebar, touch target enforcement (44px min-height), responsive table column hiding, and safe-area-inset handling.

### Top 3 Issues
1. **[P0] Missing semantic color tokens for B2B domain** -- The UX spec defines `--agent`, `--success`, `--warning`, `--error`, `--role-admin`, etc., but the actual CSS (`index.css`) only has grayscale oklch tokens. All B2B colors (role badges, status badges, drift severity, container status) are hardcoded as Tailwind utility classes (`bg-rose-100`, `text-blue-700`, etc.), making theme customization impossible and dark mode fragile.
2. **[P1] Inconsistent native vs shadcn/ui form elements** -- Auth page, WorkflowEditor, InviteLanding, and CompanySettings use raw `<input>`, `<select>`, `<textarea>` HTML elements instead of the shadcn/ui `Input`, `Select`, `Textarea` components, breaking visual consistency and losing built-in accessibility features.
3. **[P1] No Inter/JetBrains Mono font loading** -- The UX spec mandates Inter for body and JetBrains Mono for code. The CSS never imports or references either font. The app falls back to system fonts, losing the "Linear/Notion-class" typographic polish that the spec explicitly targets.

---

## Page-by-Page Review

### Auth Page
**Files**: `ui/src/pages/Auth.tsx`, `ui/src/components/AsciiArtAnimation.tsx`
**Rating**: 7/10

**Strengths**:
- Clean split layout (form left, ASCII animation right)
- Responsive: animation hidden on mobile, form full-width
- Proper session check with redirect, `autoComplete` attributes set correctly
- Loading state for session check
- Mode toggle (sign-in/sign-up) is smooth

**Issues**:
- [P1] Uses raw `<input>` elements instead of shadcn/ui `Input` -- loses consistent focus ring styling, aria attributes, and height normalization
- [P1] No `<label htmlFor>` association on inputs -- labels exist visually but use `className` text styling, not semantic `<Label>` with `htmlFor`
- [P2] Password field lacks "show/hide password" toggle -- common enterprise UX expectation
- [P2] No password strength indicator on sign-up
- [P2] Error message placement is below the form; could be more prominent

---

### Dashboard
**Files**: `ui/src/pages/Dashboard.tsx`, `ui/src/components/DashboardKpiCards.tsx`, `ui/src/components/DashboardTimeline.tsx`, `ui/src/components/DashboardBreakdownPanel.tsx`, `ui/src/components/ActiveAgentsPanel.tsx`, `ui/src/components/ActivityCharts.tsx`, `ui/src/components/MetricCard.tsx`
**Rating**: 8/10

**Strengths**:
- Rich, data-dense dashboard with KPI cards, charts, timeline, breakdown panel, active agents, and recent activity/tasks
- Live indicator (green dot with ping animation) -- excellent real-time feedback
- PageSkeleton with `variant="dashboard"` provides good loading UX
- Warning banners (no agents, drift prompt) are well-styled with dismiss options
- Activity row entry animation with reduced-motion support

**Issues**:
- [P1] MetricCard has no visible border or card wrapper -- on a white background the cards are invisible; only the text provides contrast. The grid `gap-1` is very tight for a dashboard.
- [P2] Recent Activity table has no rounded corners (`overflow-hidden` but `border` without `rounded-md`), breaking the pattern used elsewhere
- [P2] Recent Tasks "No tasks yet" state is a plain border box with text; inconsistent with the full `EmptyState` component used elsewhere
- [P2] The 5-column KPI grid breaks to 2 columns on smaller screens but the 5th card (Project Health) might feel orphaned on a 2-col layout

---

### Members
**Files**: `ui/src/pages/Members.tsx`, `ui/src/components/BulkInviteTab.tsx`, `ui/src/components/RoleBadge.tsx`
**Rating**: 8.5/10

**Strengths**:
- Full CRUD: table with avatar, role selector, status badge, actions dropdown
- Proper shadcn/ui components throughout (Select, Dialog, Tabs, Badge, Avatar, DropdownMenu)
- Responsive: columns hide progressively (`hidden sm:table-cell`, `hidden md:table-cell`, `hidden lg:table-cell`)
- Invite dialog with tabs (Single / Bulk Import) is well-structured
- Filter bar with role + status dropdowns + search
- Footer with "Showing X of Y members" count

**Issues**:
- [P2] No confirmation dialog for role changes -- immediate mutation on select change could be dangerous
- [P2] Actions dropdown only has Suspend/Reactivate; no "Remove member" option visible
- [P2] Bulk invite tab delegates to BulkInviteTab component; integration quality depends on that sub-component

---

### Admin Roles & Permissions
**Files**: `ui/src/pages/AdminRoles.tsx`, `ui/src/components/PermissionMatrix.tsx`, `ui/src/components/RoleOverviewCard.tsx`
**Rating**: 8/10

**Strengths**:
- Three-tab layout (Overview, Permission Matrix, Members by Role) is clear
- Permission matrix table is well-structured with category groupings, green check / gray minus icons, and semantic labels for every permission key
- Role overview cards show member count and permission count per role
- Members-by-role tab reuses the same filter/table pattern as the Members page

**Issues**:
- [P1] PermissionMatrix renders `<>` (Fragment) with `key` on the Fragment, which is a React anti-pattern that may produce warnings; the category header row and permission rows should be wrapped in a `<tbody>` or use a different key strategy
- [P2] Permission matrix is read-only (presets only); if custom overrides exist, there's no way to edit them from this UI
- [P2] No tooltip explaining what each permission actually controls

---

### Agents List
**Files**: `ui/src/pages/Agents.tsx`, `ui/src/components/EntityRow.tsx`, `ui/src/components/StatusBadge.tsx`
**Rating**: 8/10

**Strengths**:
- Dual view (list + org chart tree) with toggle
- Filter tabs (All/Active/Paused/Error) using URL segments
- "Show terminated" filter with custom checkbox implementation
- Live run indicator with ping animation and link to run detail
- Org chart hierarchy view with indentation
- Mobile-aware: forces list view on mobile

**Issues**:
- [P1] Custom checkbox implementation (`.h-3.5 .w-3.5` span with `&#10003;`) instead of shadcn/ui `Checkbox` -- inconsistent with the rest of the app and lacks ARIA attributes
- [P2] View toggle buttons (list/org) lack `aria-label` and `aria-pressed` attributes
- [P2] Filter dropdown is a custom popover with no focus trap -- clicking outside closes it, but keyboard navigation may not work properly

---

### Agent Detail
**Files**: `ui/src/pages/AgentDetail.tsx` (32K+ tokens -- very large file)
**Rating**: 6.5/10

**Issues**:
- [P0] File is extremely large (32K+ tokens) -- this is the largest page in the app and should be decomposed into smaller components for maintainability
- [P1] Could not fully read due to size limits; likely contains multiple tabs/sections that should be separate component files
- [P2] Large files are a maintenance risk and make code review difficult

---

### Workflow Editor
**Files**: `ui/src/pages/WorkflowEditor.tsx`, `ui/src/components/StageEditorCard.tsx`, `ui/src/components/WorkflowEditorPreview.tsx`
**Rating**: 7.5/10

**Strengths**:
- Clean CRUD flow: create/edit/delete with proper loading states
- Preview toggle button
- Stage reordering (move up/down) and deletion
- Max width constraint (`max-w-3xl`) for readability
- Proper error display for save/delete failures

**Issues**:
- [P1] Uses raw `<input>` and `<textarea>` instead of shadcn/ui components for template name and description
- [P2] Delete confirmation delegates to `ConfirmDeleteTemplateDialog` -- good separation
- [P2] Stage cards use `key={index}` which can cause bugs when reordering; should use a stable ID

---

### Workflow Detail (Pipeline View)
**Files**: `ui/src/pages/WorkflowDetail.tsx`
**Rating**: 7/10

**Strengths**:
- Horizontal pipeline visualization with stage cards and arrows
- Progress bar showing completion percentage
- Stage transition buttons (Start, Skip, Done, Fail, Retry) with appropriate icons
- Color-coded status (pending/running/review/done/failed/skipped)

**Issues**:
- [P1] Pipeline is horizontal-scroll only; on narrow screens the stages are hidden with `overflow-x-auto` but no visual indication of scroll
- [P2] Status badge on the header uses inline Tailwind classes (`bg-green-500/10 text-green-500`) instead of the StatusBadge component
- [P2] Stage cards have a `min-w-[200px]` but no max-width; long names could cause layout issues

---

### Chat
**Files**: `ui/src/pages/Chat.tsx`, `ui/src/components/AgentChatPanel.tsx`, `ui/src/components/chat/MessageBubble.tsx`, `ui/src/components/chat/TypingIndicator.tsx`, `ui/src/components/chat/ConnectionStatus.tsx`
**Rating**: 7.5/10

**Strengths**:
- Split layout: channel list + chat panel
- Connection status indicator (WebSocket state)
- Typing indicator with sender name
- Auto-scroll with "new messages" button when scrolled up
- Pipe status indicator for agent processing state
- Proper textarea with Shift+Enter for multiline

**Issues**:
- [P1] Channel list and chat panel are side by side with no responsive breakpoint -- on mobile, both try to render simultaneously (`flex h-full`); the chat panel is hardcoded `w-80` which may not fit
- [P2] Channel selection is a `<button>` with role-based styling but no `aria-selected` attribute
- [P2] Empty channel state message references "Use the Agents page" -- could include a direct link

---

### Containers
**Files**: `ui/src/pages/Containers.tsx`, `ui/src/components/ContainerStatusBadge.tsx`, `ui/src/components/StopContainerDialog.tsx`, `ui/src/components/DestroyContainerDialog.tsx`
**Rating**: 8/10

**Strengths**:
- Docker health indicator with version display
- Resource bars (CPU/Memory) with color thresholds (green/amber/red)
- Proper confirmation dialogs for Stop and Destroy actions
- Filter by status with clear button
- Tabular layout with good column structure

**Issues**:
- [P2] ResourceBar is a custom component; `tabular-nums` class on values is good but the bar width (w-16) might be too small on mobile
- [P2] Auto-refresh indicator shows spinning icon when fetching but no actual interval configuration is visible to the user
- [P2] Table uses `rounded-lg` while other tables in the app use `rounded-md` -- minor inconsistency

---

### Audit Log
**Files**: `ui/src/pages/AuditLog.tsx`, `ui/src/components/AuditEventDetail.tsx`
**Rating**: 8.5/10

**Strengths**:
- Comprehensive filter bar: search, actor type, severity, action, target type, target ID, date range (2 rows of filters)
- Hash chain verification with visual result (green/red banner)
- CSV and JSON export via dropdown menu with permission gating
- Pagination with page info and prev/next buttons
- Sort order toggle on timestamp column
- Row click opens detail modal; keyboard navigation with tabIndex and Enter/Space
- Debounced search input
- Clear filters button

**Issues**:
- [P2] Two rows of filters may be overwhelming; could benefit from a collapsible "Advanced Filters" section
- [P2] Export silently fails on error -- should show a toast notification
- [P2] Pagination uses offset-based approach; with very large audit logs, this could be slow

---

### Drift Detection
**Files**: `ui/src/pages/Drift.tsx`, `ui/src/components/DriftAlertCard.tsx`, `ui/src/components/DriftAlertPanel.tsx`, `ui/src/components/DriftMonitorToggle.tsx`, `ui/src/components/DriftDiffViewer.tsx`
**Rating**: 7.5/10

**Strengths**:
- Two-tab layout: Documents (spec drift) + Execution Alerts (runtime drift)
- Scan progress with percentage bar and status text
- Active alert count badge on the Execution tab
- Drift monitoring toggle component
- DriftDiffViewer shows source/target side by side
- Multiple resolution actions (Accept, Reject, Ignore)
- Filter bar for execution alerts (severity, type, status)

**Issues**:
- [P1] DriftDiffViewer uses French text `(aucun extrait)` while the rest of the app is in English -- language inconsistency
- [P2] Scan stats bar has many items that could wrap awkwardly on narrow screens
- [P2] Ignored drift IDs are persisted in localStorage without any size limit

---

### SSO Configuration
**Files**: `ui/src/pages/SsoConfig.tsx`, `ui/src/components/SsoProviderCard.tsx`, `ui/src/components/CreateSsoDialog.tsx`, `ui/src/components/EditSsoDialog.tsx`, `ui/src/components/DeleteSsoDialog.tsx`
**Rating**: 8/10

**Strengths**:
- Provider card-based layout with toggle, verify, sync, edit, delete actions
- Per-action loading states tracked by config ID
- Full CRUD with create/edit/delete dialogs
- Provider count badge

**Issues**:
- [P2] No visual distinction between SAML and OIDC providers in the card list
- [P2] Empty state description is quite long -- could be shortened

---

### Automation Cursors
**Files**: `ui/src/pages/AutomationCursors.tsx`, `ui/src/components/CursorPositionBadge.tsx`, `ui/src/components/CursorHierarchyChain.tsx`
**Rating**: 8/10

**Strengths**:
- Segmented position control (Manual/Assisted/Auto) with color coding inline in the table
- CursorPositionBadge with icon + label + color for each position
- CursorHierarchyChain for visualizing resolution hierarchy
- "Resolve Effective Cursor" section for testing hierarchy resolution
- Add cursor dialog with level/target/position/ceiling fields

**Issues**:
- [P2] The "Resolve" section at the bottom is always visible; could be collapsible for cleaner UI
- [P2] Delete button triggers mutation immediately without confirmation dialog -- destructive action without confirmation
- [P2] Grid layout in resolve section (`grid-cols-2 sm:grid-cols-4`) may not look great on all breakpoints

---

### Onboarding Wizard
**Files**: `ui/src/components/OnboardingWizard.tsx`, `ui/src/components/OnboardingProgressBar.tsx`, `ui/src/components/OnboardingInviteStep.tsx`, `ui/src/components/OnboardingDualModeStep.tsx`
**Rating**: 7/10

**Strengths**:
- Multi-step wizard with progress bar (Company, Agent, Task, Invite, Speed, Launch)
- Step icons with completed/current/upcoming visual states
- Comprehensive agent configuration (adapter type, model, paths)
- ASCII art animation on the welcome step

**Issues**:
- [P1] OnboardingWizard.tsx is extremely large (66K+ tokens); should be decomposed into per-step components
- [P1] OnboardingProgressBar connector lines between steps are `className="hidden"` -- they're defined but never shown, creating a progress bar with no visual connectors between steps
- [P2] Wizard uses raw `<input>`, `<select>`, `<textarea>` elements instead of shadcn/ui throughout

---

### Forbidden Page (403)
**Files**: `ui/src/pages/Forbidden.tsx`
**Rating**: 7/10

**Strengths**:
- Clean centered layout with icon, title, message, and action link
- Uses `role="alert"` and `aria-live="polite"` for screen readers
- Link styled as a primary button for clear call-to-action

**Issues**:
- [P1] Text is in French without accents (`Acces refuse`, `Vous n'avez pas acces`) -- should either have proper French diacritics or be in English for consistency with the rest of the app
- [P2] No company context shown; user has no indication which resource they were trying to access

---

### Invite Landing
**Files**: `ui/src/pages/InviteLanding.tsx`
**Rating**: 7/10

**Strengths**:
- Handles both human and agent join types
- Bootstrap CEO flow vs regular join
- Shows claim secret and onboarding instructions for agents
- Connectivity diagnostics display with severity-based coloring
- Sign-in redirect for authenticated deployments

**Issues**:
- [P1] Uses raw `<input>`, `<select>`, `<textarea>` instead of shadcn/ui components
- [P2] Join type toggle buttons are custom styled; could use shadcn/ui ToggleGroup
- [P2] Long diagnostic/onboarding info blocks might need better visual hierarchy

---

### Projects List
**Files**: `ui/src/pages/Projects.tsx`
**Rating**: 7.5/10

**Strengths**:
- Simple, clean list using EntityRow component
- StatusBadge for project status
- Target date display
- Empty state with action

**Issues**:
- [P2] No search or filter functionality -- could be problematic with many projects
- [P2] No sorting capability

---

### Project Detail
**Files**: `ui/src/pages/ProjectDetail.tsx`
**Rating**: 8/10

**Strengths**:
- Multi-tab layout (Cockpit, Agents, Workflows, Drift, Access, Settings) with URL-driven tab state
- Three-pane layout for cockpit (Context, Work, Tests) with timeline bar
- Permission-gated Access tab
- Workspace agent sync with scoped/global distinction
- Inline description editing

**Issues**:
- [P2] Tab bar uses custom button styling; not using shadcn/ui Tabs component
- [P2] Workflows tab search placeholder is in French (`Rechercher...`) -- language inconsistency
- [P2] Some search results text is also French (`Aucun workflow ne correspond a la recherche`)

---

### Company Settings
**Files**: `ui/src/pages/CompanySettings.tsx`
**Rating**: 8/10

**Strengths**:
- Five-tab organization (General, Agents, Invites, Preferences, Advanced)
- Theme switcher (Light/Dark/System) with icon buttons
- Font size slider with real-time preview
- Brand color picker with color input + hex input + clear button
- Danger zone with archive functionality and confirmation
- OpenClaw invite snippet generator with clipboard copy

**Issues**:
- [P1] Uses raw `<input>` and `<select>` in several places instead of shadcn/ui
- [P2] Preferences are stored in localStorage only -- lost when clearing browser data
- [P2] The invite snippet textarea is very tall (`h-[28rem]`) -- may cause scrolling issues

---

### Design Guide
**Files**: `ui/src/pages/DesignGuide.tsx`
**Rating**: 8/10

**Strengths**:
- Comprehensive showcase of all shadcn/ui components used in the app
- Shows buttons, badges, cards, dialogs, dropdowns, forms, tabs, tooltips, and skeletons
- Color palette display with semantic colors
- Good reference for developers building new features

**Issues**:
- [P2] This is an internal tool; its existence is good but it should be hidden from production builds
- [P2] Does not showcase the custom B2B components (RoleBadge, ContainerStatusBadge, CursorPositionBadge, etc.)

---

### Sidebar & Navigation
**Files**: `ui/src/components/Sidebar.tsx`, `ui/src/components/Layout.tsx`, `ui/src/components/CompanyRail.tsx`, `ui/src/components/SidebarNavItem.tsx`, `ui/src/components/SidebarSection.tsx`, `ui/src/components/BreadcrumbBar.tsx`, `ui/src/components/CommandPalette.tsx`, `ui/src/components/MobileBottomNav.tsx`
**Rating**: 8/10

**Strengths**:
- Company rail for multi-tenant switching
- Permission-gated sidebar items (hidden, not grayed -- matches UX spec)
- Collapsible sidebar with smooth transition (`transition-[width] duration-100`)
- Command Palette (Ctrl+K) with search across issues, agents, projects, and pages
- Permission-gated actions in command palette
- Mobile bottom nav with 5 core items
- Swipe gesture to open/close sidebar on mobile
- Auto-hide bottom nav on scroll
- Skip-to-content link for accessibility
- Breadcrumb bar with hamburger menu on mobile
- Brand color dot in sidebar header
- Live run count on Dashboard nav item

**Issues**:
- [P2] Sidebar width is hardcoded at `w-60` (240px); the UX spec says 256px -- minor discrepancy
- [P2] No keyboard shortcut indicator in sidebar items (e.g., "C" for create issue)
- [P2] Mobile bottom nav uses `Users` icon for "Agents" -- should be `Bot` for consistency with the sidebar

---

## Cross-Cutting Issues

### CX-01 [P0]: Missing Semantic Design Tokens
The UX spec defines a comprehensive token system (`--success`, `--warning`, `--error`, `--info`, `--agent`, `--role-admin`, `--role-manager`, `--role-contributor`, `--role-viewer`). The actual `index.css` only defines grayscale oklch tokens for the core shadcn/ui palette. All B2B semantic colors are hardcoded as Tailwind utility classes scattered across components:
- `RoleBadge`: `bg-rose-100 text-rose-700` (admin), `bg-blue-100 text-blue-700` (manager), etc.
- `ContainerStatusBadge`: `bg-green-100 text-green-700` (running), `bg-red-100 text-red-700` (failed)
- `CursorPositionBadge`: `bg-blue-100 text-blue-700` (assisted), `bg-green-100 text-green-700` (auto)

**Impact**: No centralized theming. Changing brand colors or creating a white-label version requires editing 50+ component files.

**Recommended fix**: Define semantic CSS custom properties in `index.css` and create Tailwind utility classes that reference them (e.g., `text-role-admin`, `bg-status-running`).

### CX-02 [P1]: Inconsistent Form Elements
At least 5 pages use raw HTML `<input>`, `<select>`, `<textarea>` instead of shadcn/ui `Input`, `Select`, `Textarea`:
- `Auth.tsx` -- all 3 inputs
- `WorkflowEditor.tsx` -- template name and description
- `InviteLanding.tsx` -- agent name, adapter type, capabilities
- `CompanySettings.tsx` -- company name, description, various settings
- `OnboardingWizard.tsx` -- most form fields

**Impact**: Inconsistent focus styles, heights, border radius, and missing built-in ARIA attributes.

**Recommended fix**: Replace all raw form elements with their shadcn/ui equivalents. This is a straightforward find-and-replace task.

### CX-03 [P1]: Language Inconsistency (French/English)
The app is predominantly English, but French appears in several places:
- `Forbidden.tsx`: "Acces refuse", "Vous n'avez pas acces"
- `DriftDiffViewer.tsx`: "(aucun extrait)"
- `ProjectDetail.tsx` workflows tab: "Rechercher...", "Aucun workflow ne correspond"
- Multiple planning docs reference French terminology

**Impact**: Mixed-language UI is confusing for enterprise users and unprofessional for a CBA demo.

**Recommended fix**: Decide on a single UI language (English for international enterprise) and audit all user-facing strings. Consider i18n infrastructure (e.g., `react-intl`) for future localization.

### CX-04 [P1]: No Font Loading
The UX spec explicitly requires Inter (body) and JetBrains Mono (code). Neither font is loaded anywhere -- no `@import`, no `<link>`, no `@font-face` declarations. The CSS relies entirely on system fonts via Tailwind defaults.

**Recommended fix**: Add `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap')` to `index.css` and set `font-family: 'Inter', sans-serif` on body and `font-family: 'JetBrains Mono', monospace` on `.font-mono`.

### CX-05 [P1]: `timeAgo` Helper Duplicated in 4+ Files
The same `timeAgo(iso: string)` function is copy-pasted in:
- `Chat.tsx`
- `Containers.tsx`
- `Drift.tsx`
- `AutomationCursors.tsx`
- (Also exists as `timeAgo` in `lib/timeAgo.ts`)

**Impact**: Bug risk from diverging implementations; wasted bytes.

**Recommended fix**: Import from `lib/timeAgo` everywhere.

### CX-06 [P2]: No Toast Notifications for Mutations
Many mutations (role change, status change, invite, cursor delete, export) complete silently. The app has a `ToastViewport` component rendered in `Layout.tsx`, but most mutations don't trigger toast notifications on success or failure.

**Recommended fix**: Add toast notifications for all destructive actions and important mutations using the existing toast infrastructure.

### CX-07 [P2]: No Confirmation for Destructive Inline Actions
Several destructive actions happen on click without confirmation:
- Automation cursor delete (immediate)
- Member role change (immediate)
- Member suspend/reactivate (immediate)

**Recommended fix**: Add confirmation dialogs or at minimum an undo toast for destructive actions.

---

## Design System Assessment

### Token Usage
- **Adopted from spec**: Grayscale palette (oklch), radius, border, ring, chart colors
- **Missing from spec**: Semantic colors (success, warning, error, info, agent), role colors, spacing tokens, transition tokens, z-index tokens
- **Unique to implementation**: Sidebar-specific tokens, MDXEditor theme variables

### shadcn/ui Usage
22 shadcn/ui components are installed and properly used:
`avatar`, `badge`, `breadcrumb`, `button`, `card`, `checkbox`, `collapsible`, `command`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `tabs`, `textarea`, `tooltip`

**Missing from the spec's recommended additions**: DataTable (using custom tables), Toggle, Switch (custom implementations), Progress (custom bars), Slider (only in settings), Alert (using custom banners), Form (using raw forms), RadioGroup, HoverCard, NavigationMenu, Accordion.

### Spacing Consistency
- Pages consistently use `space-y-4` or `space-y-6` for vertical rhythm
- Padding is consistently `p-4 md:p-6` for main content
- Table cells use `px-4 py-2.5` consistently
- Headers use `gap-3` between icon and title

### Border Radius
The design system uses `--radius-lg: 0px` and `--radius-xl: 0px`, giving a sharp, rectilinear aesthetic. Components use `rounded-md` (8px) and `rounded-lg` (12px from Tailwind, overridden to 0px). This creates a **distinctive, opinionated visual identity** that is clean and professional, aligning with the "cockpit" metaphor.

---

## Accessibility Assessment

### What's Done Well
- Skip-to-content link in Layout (`sr-only focus:not-sr-only`)
- `role="alert"` and `aria-live="polite"` on Forbidden page
- `aria-label` on several interactive elements (sidebar toggle, chat send button, filter inputs)
- Keyboard navigation on audit log rows (`tabIndex={0}`, Enter/Space handling)
- Touch target enforcement via CSS `@media (pointer: coarse)` with 44px minimum
- `prefers-reduced-motion` media query disabling activity row animation
- `touch-action: manipulation` to prevent double-tap zoom
- Color scheme meta properly set for dark mode scrollbars

### What Needs Improvement
- [P1] **Auth page inputs lack proper label association** -- `<label>` elements exist but without `htmlFor` on the raw inputs
- [P1] **Custom checkbox in Agents filter** -- no ARIA attributes (`role="checkbox"`, `aria-checked`)
- [P1] **Audit log table rows use `role="button"`** which is good, but other clickable table rows (Members, Containers) don't
- [P2] **No focus visible outline on custom buttons** -- Agents view toggle, filters dropdown, and segment controls use custom focus styles that may not meet WCAG 2.1 AA
- [P2] **No `aria-label` on icon-only buttons** where text context is missing (view toggle, filter toggle in Agents)
- [P2] **Color-only status indicators** -- Some status dots rely solely on color (green/red/amber) without icon or text. The UX spec mandates "triple encoding" (color + icon + text).

### WCAG 2.1 AA Compliance Estimate
**Score: ~65-70% compliant.** The foundation is solid (skip nav, touch targets, reduced motion), but form accessibility, custom control ARIA attributes, and consistent focus management need attention before a formal audit.

---

## Recommended Priority Fixes

Ordered by impact for a CBA demo:

| # | Priority | Issue | Effort | Impact |
|---|----------|-------|--------|--------|
| 1 | P0 | Add semantic CSS custom properties for B2B domain colors (role, status, severity, cursor) | 2h | Enables theming, dark mode consistency |
| 2 | P1 | Load Inter + JetBrains Mono fonts | 15min | Immediate visual polish lift |
| 3 | P1 | Replace raw `<input>`/`<select>`/`<textarea>` with shadcn/ui components (Auth, WorkflowEditor, InviteLanding, CompanySettings, Onboarding) | 4h | Visual consistency + a11y |
| 4 | P1 | Fix language inconsistencies -- remove all French strings from UI code | 1h | Professional consistency |
| 5 | P1 | Deduplicate `timeAgo` helper -- import from `lib/timeAgo.ts` everywhere | 30min | Code hygiene |
| 6 | P1 | Fix OnboardingProgressBar connector lines (currently `hidden`) | 30min | Progress bar looks broken without them |
| 7 | P1 | Add MetricCard visible boundaries (border or subtle background) | 30min | Dashboard KPIs are invisible on white background |
| 8 | P1 | Add ARIA attributes to custom form controls (Agents checkbox, segment controls) | 2h | Accessibility compliance |
| 9 | P1 | Fix PermissionMatrix React Fragment key warning | 15min | Console clean-up |
| 10 | P2 | Add toast notifications for all mutations | 3h | User feedback on actions |
| 11 | P2 | Add confirmation dialogs for inline destructive actions (cursor delete, role change) | 2h | Prevent accidental changes |
| 12 | P2 | Decompose AgentDetail.tsx and OnboardingWizard.tsx into smaller components | 4h | Maintainability |
| 13 | P2 | Add search/filter to Projects list | 1h | Usability at scale |
| 14 | P2 | Fix Chat page responsive layout (channel list + panel) | 2h | Mobile usability |
| 15 | P2 | Add B2B components to DesignGuide page | 2h | Developer reference |

**Total estimated effort for P0+P1 fixes: ~11 hours**

---

## Comparison to UX Design Spec

| Spec Requirement | Implementation Status | Gap |
|-----------------|----------------------|-----|
| 5 coexisting modes (ORAL/VISUEL/CODE/BOARD/TEST) | Partial -- Cockpit exists but no mode switcher | Large |
| Automation Cursor slider (3 positions x 4 levels) | Implemented | Resolved OK (segment control, not slider) |
| Command Palette (Ctrl+K) | Implemented with permission gating | Good |
| Sidebar adapted to role (hidden, not grayed) | Implemented | Good |
| Dark/Light mode with per-persona defaults | Implemented (manual toggle, system detection) | OK -- no per-persona default |
| Real-time WebSocket indicators | Implemented (Live dot, connection status, typing) | Good |
| Breadcrumbs on all pages | Implemented | Good |
| Skeleton loading states | Implemented with 8 variants | Good |
| Error boundaries | Not observed | Missing |
| 403 page with redirect | Implemented (Forbidden.tsx) | OK -- lacks French accents |
| Inter + JetBrains Mono typography | Not implemented | Missing |
| Semantic design tokens | Partially implemented (grayscale only) | Significant gap |
| Triple encoding (color + icon + text) for status | Partially -- StatusBadge is text + color; some indicators are color-only | Gap |
| `prefers-reduced-motion` | Implemented for activity animations | OK |
| 44px touch targets | Implemented via CSS | Good |
| Onboarding cascade (CEO -> team) | Implemented as wizard | OK -- not conversational as spec envisions |

---

*End of audit. All findings are based on static code review of the `ui/src/` directory. No code was modified during this audit.*
