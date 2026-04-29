# Sprint Plan — Epic 3 (Dashboard Intelligent), Epic 5 (Inbox Interactive), F1-Admin Gaps

> **Author**: PM/PO Agent
> **Date**: 2026-04-06
> **Status**: COMPLETE — ready for development
> **Sources**: `blocks-platform-architecture.md`, `blocks-platform-ux-spec.md`, `brainstorming-mnm-blocks-platform-unifie-2026-04-05.md`

---

## Sprint Order (Critical Path)

The stories below depend on **Epic 2 (Blocks Foundation)** and **Epic 4 (Agent Forms)**. Cross-epic dependencies use the following prefixes:

- **BF-xx**: Epic 2 — Blocks Foundation stories (shared types, block components, BlockRenderer, ContentRenderer, useBlockActions)
- **AF-xx**: Epic 4 — Agent Forms in Issues stories (content_blocks column, CommentThread integration)

### Execution Sequence

```
PHASE A — Migrations & Backend (can start once BF-01 shared types are merged)
  DI-01 → DI-02 → DI-03          (Dashboard: migration → API → frontend hooks)
  II-01 → II-02 → II-03          (Inbox: migration → API → frontend hooks)
  [DI-01 and II-01 can run in PARALLEL]

PHASE B — Frontend Integration (requires BF-02..BF-05 block components + BF-06 BlockRenderer)
  DI-04 → DI-05                  (Dashboard: hybrid grid → custom widget rendering)
  II-04 → II-05 → II-06          (Inbox: UI refactor → action handler → rich notifications)
  [DI-04..05 and II-04..06 can run in PARALLEL]

PHASE C — CAO Integration (requires DI-04 + DI-05)
  DI-06 → DI-07 → DI-08 → DI-09 (Add Widget → CAO prompt → CAO generation → widget management)

PHASE D — Migration of existing sources (requires II-04)
  II-07                           (Migrate failed_runs, approvals to inbox_items)

PHASE E — F1 Admin (can start as soon as BF-01 types exist, parallel to everything)
  F1-ADMIN-01 → F1-ADMIN-02 → F1-ADMIN-03
```

### Critical Path

```
BF-01 (shared types) → DI-01 (migration) → DI-02 (API) → DI-03 (hooks)
                                                              ↓
BF-02..06 (block components + renderer) → DI-04 (hybrid grid) → DI-05 (custom widget card)
                                                                       ↓
                                                              DI-06 (Add Widget dialog)
                                                                       ↓
                                                              DI-07 (CAO prompt enrichment)
                                                                       ↓
                                                              DI-08 (CAO generation flow)
                                                                       ↓
                                                              DI-09 (Widget management)
```

---

## Epic 3: Dashboard Intelligent

### DI-01: Migration — `user_widgets` table
**Epic**: Epic 3
**Priority**: P0 (blocker)
**Depends on**: BF-01 (shared types must exist for schema alignment)
**Estimated effort**: XS

#### Description
Create the `user_widgets` database table and Drizzle schema to store AI-generated custom dashboard widgets per user. This is the data foundation for the entire Dashboard Intelligent feature.

#### Acceptance Criteria
- [ ] Migration `0058_blocks_foundation.sql` creates `user_widgets` table with correct columns (id, company_id, user_id, title, description, blocks JSONB, data_source JSONB, position, span, created_by_agent_id, created_at, updated_at)
- [ ] Index `idx_user_widgets_company_user` on (company_id, user_id) is created
- [ ] Drizzle schema file `packages/db/src/schema/user_widgets.ts` matches the migration exactly
- [ ] Schema is exported from `packages/db/src/schema/index.ts`
- [ ] Migration is idempotent (uses `IF NOT EXISTS`)
- [ ] `bun run typecheck` passes

#### Technical Details
- Files to create:
  - `packages/db/src/migrations/0058_blocks_foundation.sql` (the `user_widgets` portion — note: this migration also contains `issue_comments.content_blocks` for AF-01, coordinate with Epic 4 PM)
  - `packages/db/src/schema/user_widgets.ts`
- Files to modify:
  - `packages/db/src/schema/index.ts` (add export)
- Migration SQL: See architecture blueprint section 2, Migration 0058
- Key implementation notes: The `blocks` column is `JSONB NOT NULL` and stores a `ContentDocument`. The `data_source` is nullable JSONB storing `{ endpoint, params, refreshInterval }`. The `created_by_agent_id` FK references `agents(id)` with `ON DELETE SET NULL`.

#### UX Requirements
- N/A (backend only)

#### Testing Requirements
- Migration runs cleanly on a fresh DB
- Migration is re-runnable (idempotent)
- Drizzle schema aligns with SQL (run typecheck)

---

### DI-02: API — 4 CRUD routes for `my-widgets`
**Epic**: Epic 3
**Priority**: P0 (blocker)
**Depends on**: DI-01, BF-01 (shared validators `createUserWidgetSchema`, `updateUserWidgetSchema`)
**Estimated effort**: S

#### Description
Create the 4 REST API routes for user widget CRUD operations. These routes are user-scoped (no admin permission needed — users manage their own widgets).

#### Acceptance Criteria
- [ ] `GET /companies/:companyId/my-widgets` returns all widgets for the current user, ordered by position
- [ ] `POST /companies/:companyId/my-widgets` creates a widget with validated `blocks` (ContentDocument), returns 201
- [ ] `PATCH /companies/:companyId/my-widgets/:widgetId` updates widget fields (title, blocks, dataSource, position, span), returns updated widget
- [ ] `DELETE /companies/:companyId/my-widgets/:widgetId` deletes a widget, returns 204
- [ ] All routes enforce user ownership (user can only CRUD their own widgets)
- [ ] Blocks field is validated against `ContentDocument` Zod schema on create/update
- [ ] Routes mounted in `server/src/app.ts`
- [ ] Route exported from `server/src/routes/index.ts`

#### Technical Details
- Files to create:
  - `server/src/routes/user-widgets.ts`
- Files to modify:
  - `server/src/routes/index.ts` (add export)
  - `server/src/app.ts` (mount route)
- Key implementation notes: Follow the route factory pattern `userWidgetRoutes(db: Db)`. No `requirePermission` needed since routes are self-scoped via `req.actor?.userId`. Use `validate()` middleware with the shared Zod schemas. See architecture blueprint section 4.2 for complete implementation.

#### UX Requirements
- N/A (backend only)

#### Testing Requirements
- Unit test: CRUD operations with valid data
- Unit test: validation rejection for invalid blocks (bad ContentDocument)
- Unit test: ownership enforcement (user A cannot modify user B's widget)
- Unit test: 404 for non-existent widget
- Edge case: creating a widget with no `dataSource` (nullable)

---

### DI-03: Frontend API client + React Query hooks for user widgets
**Epic**: Epic 3
**Priority**: P1 (critical)
**Depends on**: DI-02, BF-01
**Estimated effort**: XS

#### Description
Create the frontend API client and React Query integration for user widgets. This provides the data layer that the Dashboard UI will consume.

#### Acceptance Criteria
- [ ] API client `ui/src/api/user-widgets.ts` exposes `list`, `create`, `update`, `delete` methods
- [ ] Query key `userWidgets.list(companyId)` added to `ui/src/lib/queryKeys.ts`
- [ ] React Query hooks can be used from Dashboard.tsx to fetch/mutate user widgets
- [ ] Mutations invalidate the widget list query on success
- [ ] TypeScript types from `@mnm/shared` (UserWidget) are used correctly

#### Technical Details
- Files to create:
  - `ui/src/api/user-widgets.ts`
- Files to modify:
  - `ui/src/lib/queryKeys.ts` (add `userWidgets` key)
- Key implementation notes: Follow the pattern from `ui/src/api/view-presets.ts`. See architecture blueprint section 5.6. The API client uses the `api` singleton from `./client`.

#### UX Requirements
- N/A (data layer)

#### Testing Requirements
- TypeScript compiles with correct types
- Verify query key uniqueness

---

### DI-04: Dashboard hybrid grid — predefined + custom widgets zone
**Epic**: Epic 3
**Priority**: P1 (critical)
**Depends on**: DI-03, BF-06 (BlockRenderer), BF-07 (ContentRenderer), BF-08 (useBlockActions)
**Estimated effort**: M

#### Description
Modify the existing `DashboardGrid.tsx` to support hybrid rendering: predefined widgets from the View Preset (rendered via WIDGET_REGISTRY React components) in the top zone, plus a "My Widgets" section below for custom AI-generated widgets (rendered via BlockRenderer). Also modify `Dashboard.tsx` to fetch custom widgets and pass them to the grid.

#### Acceptance Criteria
- [ ] `DashboardGrid` accepts new `customWidgets` and `blockContext` props
- [ ] Predefined widgets render as before (no regression)
- [ ] Custom widgets section appears below predefined widgets with "MY WIDGETS" header and "+ Add" button
- [ ] Custom widget cards render their `blocks` via `BlockRenderer`
- [ ] Each custom widget card shows title and a "..." dropdown menu (placeholder for DI-09)
- [ ] Widget `span` (1-4) maps to `col-span-{n}` correctly
- [ ] Empty state shown when no custom widgets exist: "No custom widgets yet. Ask CAO to create a personalized widget for your dashboard." with [+ Add your first widget] button
- [ ] Dashboard.tsx fetches custom widgets via React Query and passes to DashboardGrid
- [ ] Dashboard.tsx creates a `useBlockActions({ surface: "dashboard" })` context
- [ ] Responsive: 1-col < 768px (spans ignored), 2-col 768-1024px (span capped at 2), 4-col > 1024px

#### Technical Details
- Files to modify:
  - `ui/src/components/DashboardGrid.tsx` (add hybrid rendering)
  - `ui/src/pages/Dashboard.tsx` (fetch custom widgets, create block context)
- Key implementation notes: See architecture blueprint sections 5.10 and 5.11. The "My Widgets" section header uses `text-sm font-medium text-muted-foreground uppercase tracking-wider`. The "+ Add" button uses `Button variant="outline" size="sm"` with `Plus` icon.

#### UX Requirements
- Section separator between predefined and custom widgets: `mt-6 mb-3`
- Custom widget card: `border border-border rounded-lg bg-card overflow-hidden`, header with `px-4 py-3 border-b border-border/50`, content `p-4`
- Empty state: `Sparkles` icon (h-8 w-8), contextual copy, centered layout
- Grid: `grid grid-cols-1 md:grid-cols-4 gap-4` (same as existing)

#### Testing Requirements
- Visual: predefined widgets unchanged
- Visual: empty state displays correctly
- Visual: custom widgets render with BlockRenderer
- Responsive: verify 1-col, 2-col, 4-col breakpoints
- Edge case: 0 custom widgets + 0 predefined widgets

---

### DI-05: Custom widget card rendering via BlockRenderer + data_source refresh
**Epic**: Epic 3
**Priority**: P1 (critical)
**Depends on**: DI-04
**Estimated effort**: S

#### Description
Implement the full custom widget card component with proper rendering, data source refresh behavior, and loading/error states. Each widget fetches its `data_source.endpoint` and re-renders blocks with fresh data.

#### Acceptance Criteria
- [ ] Custom widget card renders blocks via `BlockRenderer` using the widget's `blocks` ContentDocument
- [ ] If `data_source` exists, the widget fetches the endpoint on mount and at `refreshInterval` (minimum 60s)
- [ ] Data refresh does NOT use polling/setInterval — uses React Query `refetchInterval` (which is React Query's built-in mechanism, not manual setInterval) OR SSE for live data
- [ ] Loading state: `Skeleton` blocks while data is loading
- [ ] Error state: subtle error indicator within the card (not a toast)
- [ ] Widget cards respect `span` for grid column width

#### Technical Details
- Files to modify:
  - `ui/src/components/DashboardGrid.tsx` (enhance custom widget card rendering)
- Files to create (optional):
  - `ui/src/components/CustomWidgetCard.tsx` (extract if DashboardGrid gets too large)
- Key implementation notes: The `data_source.endpoint` is a relative API path. The widget fetches it and the response populates the block data. For v1, the simplest approach is a useQuery per widget with the endpoint. IMPORTANT: per CLAUDE.md rules, do NOT use `setInterval` — use React Query's `refetchInterval` which is acceptable as it's a declarative React Query feature, not manual polling. If SSE is preferred, wire into the existing `/events/ws` system.

#### UX Requirements
- Widget card skeleton: match the card dimensions with `animate-pulse bg-muted rounded-lg min-h-[120px]`
- Error: small `text-xs text-destructive` line at bottom of card, not blocking content

#### Testing Requirements
- Unit test: widget renders blocks correctly
- Unit test: data source refresh triggers re-fetch
- Edge case: widget with no data_source (static blocks only)
- Edge case: data_source endpoint returns error

---

### DI-06: "Add Widget" dialog — choose from templates or ask CAO
**Epic**: Epic 3
**Priority**: P1 (critical)
**Depends on**: DI-04
**Estimated effort**: M

#### Description
Build the "Add Widget" dialog that opens when the user clicks the "+ Add" button. The dialog offers two paths: (a) choose from pre-built widget templates, or (b) describe what they want and send the request to CAO.

#### Acceptance Criteria
- [ ] Dialog opens from the "+ Add" button in the My Widgets section header
- [ ] Templates section shows a 2-column grid of template cards (Burn-down, Velocity, Cost Tracking, Health Check — at minimum 4 templates)
- [ ] Clicking a template creates the widget immediately (pre-built blocks) and closes the dialog
- [ ] "Ask CAO" section shows a Textarea + "Send to CAO" button
- [ ] "Send to CAO" is disabled until text is non-empty
- [ ] Clicking "Send to CAO" transitions to a loading state: "CAO is generating your widget..." with skeleton blocks
- [ ] On success: dialog closes, new widget appears at bottom of custom section with `animate-in fade-in-0 slide-in-from-bottom-2 duration-300`
- [ ] On error: error message in dialog with "Retry" button

#### Technical Details
- Files to create:
  - `ui/src/components/AddWidgetDialog.tsx`
- Files to modify:
  - `ui/src/components/DashboardGrid.tsx` or `ui/src/pages/Dashboard.tsx` (wire up dialog trigger)
- Key implementation notes: Templates are pre-built `ContentDocument` objects stored client-side. The "Send to CAO" flow will be wired in DI-08 (for now, the button can show "Coming soon" or call a placeholder). The dialog uses shadcn `Dialog`, `DialogContent`, `DialogHeader`.

#### UX Requirements
- Dialog layout: as specified in UX spec section 4.3
- Template cards: `border border-border rounded-md p-3 hover:border-primary/50 hover:bg-accent/30 cursor-pointer transition-all text-center space-y-1.5`
- Template icons: `h-5 w-5 text-muted-foreground mx-auto`
- CAO input: `Textarea rows=2`, placeholder "e.g., Show me issue burn-down for my team..."
- Loading state: Skeleton blocks + text message

#### Testing Requirements
- Visual: dialog renders correctly
- Interaction: template click creates widget
- Interaction: CAO input enables/disables button
- Edge case: dialog cancel/close doesn't create widget

---

### DI-07: CAO prompt enrichment — role + permissions + tags + endpoints + catalogue Zod
**Epic**: Epic 3
**Priority**: P1 (critical)
**Depends on**: DI-02 (widget API exists), BF-09 (block-catalogue route exists)
**Estimated effort**: M

#### Description
Enrich the CAO's system prompt so it knows: (1) the requesting user's role, permissions, and tags, (2) the list of API endpoints the user can access, (3) the Zod block catalogue (JSON Schema), and (4) instructions for generating valid `ContentDocument` widgets. This is the backend intelligence that makes CAO-generated widgets possible.

#### Acceptance Criteria
- [ ] CAO system prompt includes the user's role name and list of permissions
- [ ] CAO system prompt includes the user's tag list
- [ ] CAO system prompt includes a filtered list of API endpoints the user can access (based on permissions)
- [ ] CAO system prompt includes the ContentDocument JSON Schema (from `GET /block-catalogue`)
- [ ] CAO system prompt includes explicit instructions: "Generate valid ContentDocument JSON using only the block types from the catalogue"
- [ ] CAO system prompt includes widget template examples for common requests (burn-down, velocity, etc.)
- [ ] The enriched prompt is injected when the CAO is invoked in "widget generation" mode

#### Technical Details
- Files to modify:
  - Server-side CAO prompt construction (likely in `server/src/services/cao.ts` or similar — locate the CAO system prompt builder)
- Key implementation notes: The CAO already exists with adapter `claude_local`. This story enriches its context. The block catalogue can be fetched internally via the Zod schema (no HTTP call needed server-side — just serialize `ContentDocument` to JSON Schema using `zod-to-json-schema`). The endpoint list should be curated, not a raw dump — filter to the endpoints useful for data fetching (issues, agents, runs, costs, etc.).

#### UX Requirements
- N/A (backend — prompt engineering)

#### Testing Requirements
- Unit test: prompt includes user role and permissions
- Unit test: prompt includes block catalogue schema
- Unit test: prompt is correctly structured for LLM consumption
- Edge case: user with no tags (empty array, not error)
- Edge case: user with minimal permissions

---

### DI-08: CAO widget generation flow — user asks, CAO generates, stores, displays
**Epic**: Epic 3
**Priority**: P1 (critical)
**Depends on**: DI-06, DI-07
**Estimated effort**: L

#### Description
Implement the end-to-end flow: user types a request in the "Add Widget" dialog's CAO input, the request is sent to CAO, CAO generates a valid `ContentDocument`, the document is validated, stored as a `user_widget`, and displayed on the dashboard. This is the core value proposition of the Dashboard Intelligent feature.

#### Acceptance Criteria
- [ ] User types a description in the Add Widget dialog and clicks "Send to CAO"
- [ ] Request is sent to CAO with the enriched prompt (DI-07) + user's description
- [ ] CAO returns a JSON response containing a valid `ContentDocument` + widget metadata (title, description, data_source)
- [ ] Response is validated against `ContentDocument` Zod schema
- [ ] If valid: widget is created via `POST /my-widgets` and appears on dashboard
- [ ] If invalid: CAO is re-prompted once with the validation error for self-correction
- [ ] If still invalid after retry: error shown to user with "The widget couldn't be generated. Try rephrasing your request."
- [ ] The widget is created with `created_by_agent_id` pointing to the CAO agent
- [ ] The new widget appears with a highlight animation on the dashboard
- [ ] Dialog loading state shows "CAO is generating your widget..." with skeleton

#### Technical Details
- Files to create:
  - `server/src/services/cao-widget-generator.ts` (or add to existing CAO service)
  - `ui/src/hooks/useCAOWidgetGeneration.ts` (mutation hook)
- Files to modify:
  - `ui/src/components/AddWidgetDialog.tsx` (wire "Send to CAO" to the actual flow)
  - Server-side: add a route or use existing CAO interaction mechanism
- Key implementation notes: The CAO runs via `claude -p --model haiku` (per CLAUDE.md). The prompt should include the user's request, the enriched context from DI-07, and explicit output format instructions. Parse the CAO's response to extract the ContentDocument JSON. Validate server-side before storing. The frontend mutation should optimistically show loading, then refetch the widget list on success.

#### UX Requirements
- Loading: Dialog stays open with skeleton blocks + "CAO is generating your widget..." text
- Success: Dialog closes, widget appears at bottom of custom section with `animate-in fade-in-0 slide-in-from-bottom-2 duration-300`
- Error: Error message replaces loading in dialog, "Retry" button available
- CAO-generated widgets should have a subtle "AI" badge or sparkle icon on the card (optional, nice-to-have)

#### Testing Requirements
- Integration test: full flow from request to widget display
- Unit test: ContentDocument validation on CAO response
- Unit test: retry logic on invalid CAO output
- Edge case: CAO timeout
- Edge case: CAO returns valid JSON but with unknown block types (validation catches it)
- Edge case: user submits empty/very short description

---

### DI-09: Widget management — edit (via CAO chat), resize, reorder, delete
**Epic**: Epic 3
**Priority**: P2 (important)
**Depends on**: DI-04, DI-05, DI-08
**Estimated effort**: M

#### Description
Implement the widget management actions: edit via CAO chat, resize (change span), reorder (change position), and delete. These actions are accessible via the "..." dropdown menu on each custom widget card.

#### Acceptance Criteria
- [ ] Each custom widget card has a "..." (MoreHorizontal) dropdown menu
- [ ] Menu items: "Edit with CAO", "Resize" (submenu: 1, 2, 3, 4 columns), "Delete" (destructive)
- [ ] "Edit with CAO": opens the CAO chat panel pre-filled with widget context ("Edit widget: {title}. Current blocks: {summary}. What changes would you like?")
- [ ] "Resize": updates widget `span` via `PATCH /my-widgets/:id`, widget resizes in grid immediately
- [ ] "Delete": shows confirmation dialog, then deletes via `DELETE /my-widgets/:id`
- [ ] Reorder: widgets can be reordered via drag-and-drop or up/down arrow buttons. Position updates via `PATCH /my-widgets/:id`
- [ ] All mutations invalidate the `userWidgets.list` query
- [ ] Optimistic updates for resize and reorder (instant feedback)

#### Technical Details
- Files to modify:
  - `ui/src/components/DashboardGrid.tsx` or `ui/src/components/CustomWidgetCard.tsx` (add dropdown menu)
- Key implementation notes: The dropdown uses shadcn `DropdownMenu`. Resize submenu uses `DropdownMenuSub`. Delete uses a confirmation `Dialog`. "Edit with CAO" needs to interface with the CAO chat panel (existing pattern) — this may be a link to the CAO chat with a pre-filled message. Drag-and-drop for reorder can use a simple library or up/down arrows for v1.

#### UX Requirements
- Menu trigger: `Button ghost icon-xs` with `MoreHorizontal` icon
- Delete confirmation: standard Dialog with "Are you sure?" + destructive button
- Resize: immediate visual feedback (grid re-flows)
- Reorder: position updates persist across page reload

#### Testing Requirements
- Interaction: resize changes column span
- Interaction: delete removes widget after confirmation
- Interaction: reorder persists position
- Edge case: delete the last widget shows empty state
- Edge case: resize a span-4 widget on a 2-column screen

---

## Epic 5: Inbox Interactive

### II-01: Migration — `inbox_items` table
**Epic**: Epic 5
**Priority**: P0 (blocker)
**Depends on**: BF-01 (shared types for schema alignment)
**Estimated effort**: XS

#### Description
Create the `inbox_items` database table and Drizzle schema to store rich, interactive notifications from agents to users.

#### Acceptance Criteria
- [ ] Migration `0059_inbox_items.sql` creates `inbox_items` table with correct columns (id, company_id, recipient_id, sender_agent_id, sender_user_id, title, body, content_blocks JSONB, category, priority, status, action_taken JSONB, related_issue_id, related_agent_id, expires_at, created_at)
- [ ] Three indexes created: `idx_inbox_items_recipient`, `idx_inbox_items_created`, `idx_inbox_items_category`
- [ ] Drizzle schema file `packages/db/src/schema/inbox_items.ts` matches migration exactly
- [ ] Schema exported from `packages/db/src/schema/index.ts`
- [ ] Migration is idempotent (uses `IF NOT EXISTS`)
- [ ] `bun run typecheck` passes

#### Technical Details
- Files to create:
  - `packages/db/src/migrations/0059_inbox_items.sql`
  - `packages/db/src/schema/inbox_items.ts`
- Files to modify:
  - `packages/db/src/schema/index.ts` (add export)
- Migration SQL: See architecture blueprint section 2, Migration 0059
- Key implementation notes: `content_blocks` is nullable JSONB (not all inbox items need structured blocks). `action_taken` is nullable JSONB that gets populated when a user takes an action. FKs to `agents` use `ON DELETE SET NULL`. `status` defaults to `'unread'`.

#### UX Requirements
- N/A (backend only)

#### Testing Requirements
- Migration runs cleanly
- Migration is re-runnable
- Schema typecheck passes

---

### II-02: API — 5 routes for inbox items
**Epic**: Epic 5
**Priority**: P0 (blocker)
**Depends on**: II-01, BF-01 (shared validators)
**Estimated effort**: S

#### Description
Create the 5 REST API routes for inbox items: list, create, update status, execute action, and delete.

#### Acceptance Criteria
- [ ] `GET /companies/:companyId/inbox-items` returns paginated inbox items for current user, with optional filters (status, category, priority, limit, offset), returns `{ items, total }`
- [ ] `POST /companies/:companyId/inbox-items` creates an inbox item (agent API), validates content_blocks against ContentDocument, returns 201
- [ ] `PATCH /companies/:companyId/inbox-items/:itemId` updates item status (read, dismissed), returns updated item
- [ ] `POST /companies/:companyId/inbox-items/:itemId/action` executes an action, sets `action_taken` JSONB and `status="actioned"`, returns updated item. Rejects if already actioned.
- [ ] `DELETE /companies/:companyId/inbox-items/:itemId` deletes an item, returns 204
- [ ] All user-facing routes enforce recipient ownership
- [ ] Create route accepts `senderAgentId` from agent actor context
- [ ] SSE event emitted on item creation (TODO comment acceptable for v1)
- [ ] Routes mounted in `server/src/app.ts`

#### Technical Details
- Files to create:
  - `server/src/routes/inbox-items.ts`
- Files to modify:
  - `server/src/routes/index.ts` (add export)
  - `server/src/app.ts` (mount route)
- Key implementation notes: See architecture blueprint section 4.2 (`inboxItemRoutes`). The list endpoint uses `inboxItemFiltersSchema` for query parameter validation. The action endpoint records the action and marks the item as `actioned` — the actual action routing (API calls, etc.) happens client-side via `useBlockActions`. The create endpoint is designed to be called by agents (via their API context).

#### UX Requirements
- N/A (backend only)

#### Testing Requirements
- Unit test: list with filters (status, category, priority)
- Unit test: pagination (limit, offset, total count)
- Unit test: create with valid/invalid content_blocks
- Unit test: action on already-actioned item returns 400
- Unit test: recipient ownership enforcement
- Edge case: create with no content_blocks (text-only notification)
- Edge case: filter with no results returns `{ items: [], total: 0 }`

---

### II-03: Frontend API client + React Query hooks for inbox items
**Epic**: Epic 5
**Priority**: P1 (critical)
**Depends on**: II-02, BF-01
**Estimated effort**: XS

#### Description
Create the frontend API client and React Query integration for inbox items. This provides the data layer for the inbox UI.

#### Acceptance Criteria
- [ ] API client `ui/src/api/inbox-items.ts` exposes `list`, `create`, `update`, `action`, `delete` methods
- [ ] Query keys `inboxItems.list(companyId)` and `inboxItems.detail(companyId, itemId)` added to `ui/src/lib/queryKeys.ts`
- [ ] `InboxItemsListResponse` type with `{ items, total }` is exported
- [ ] TypeScript types from `@mnm/shared` (InboxItem, etc.) are used correctly

#### Technical Details
- Files to create:
  - `ui/src/api/inbox-items.ts`
- Files to modify:
  - `ui/src/lib/queryKeys.ts` (add `inboxItems` keys)
- Key implementation notes: See architecture blueprint section 5.7. Follow the pattern from existing API clients.

#### UX Requirements
- N/A (data layer)

#### Testing Requirements
- TypeScript compiles with correct types
- Verify query key uniqueness

---

### II-04: Inbox UI refactor — add inbox_items section with ContentRenderer
**Epic**: Epic 5
**Priority**: P1 (critical)
**Depends on**: II-03, BF-06 (BlockRenderer), BF-07 (ContentRenderer), BF-08 (useBlockActions)
**Estimated effort**: M

#### Description
Refactor the existing Inbox page to add a new "Agent Notifications" section that renders `inbox_items` with rich content blocks via ContentRenderer. Existing inbox sections (failed_runs, approvals, stale_work, issues_i_touched) remain unchanged.

#### Acceptance Criteria
- [ ] New "Agent Notifications" section added to the Inbox page
- [ ] Section shows inbox_items with `status="unread"` in the "New" tab
- [ ] Section header shows title + count badge ("3 new")
- [ ] Each inbox item renders as a rich card: priority indicator, category badge, title, agent name + time, content blocks area, action buttons
- [ ] Items with `content_blocks` render via `ContentRenderer` / `BlockRenderer`
- [ ] Items without `content_blocks` render `body` as markdown
- [ ] Visual status indicators: unread (blue left border + bold title), read (standard), actioned (green left border), dismissed (fade out)
- [ ] Priority visual treatment: low (subtle bar), normal (no bar), high (amber bar), urgent (red pulsing bar)
- [ ] "All" tab shows all inbox items across all statuses
- [ ] Empty state: "No notifications. Your agents haven't sent any notifications yet." with Inbox icon
- [ ] Dismiss button (X) on each card, opacity-0 by default, visible on hover

#### Technical Details
- Files to create:
  - `ui/src/components/InboxItemCard.tsx` (the rich inbox item card)
- Files to modify:
  - `ui/src/pages/Inbox.tsx` (add section, fetch inbox_items)
- Key implementation notes: See UX spec section 6. The `useBlockActions({ surface: "inbox", surfaceId: item.id })` context is created per item. Existing inbox sections remain — this is additive. The new section uses React Query to fetch from `GET /inbox-items?status=unread`. Category filter should include the new "notifications" option.

#### UX Requirements
- Card layout: See UX spec section 6.1 for full Tailwind classes
- Unread: `border-l-2 border-l-primary bg-primary/[0.02]`, title `font-semibold`
- Actioned: `border-l-2 border-l-success/50 bg-success/[0.02]`
- Priority bar: absolute left-0 w-1, colors per spec section 6.3
- Block area: `mt-3 rounded-md border border-border/30 bg-accent/5 p-3 space-y-3`
- Expand/collapse for long content: max-h-[200px] with gradient fade and "Show more"
- Responsive: cards stack full-width on mobile

#### Testing Requirements
- Visual: all status states render correctly (unread, read, actioned, dismissed)
- Visual: all priority levels display correctly
- Visual: content blocks render inside cards
- Interaction: dismiss button works
- Edge case: item with no content_blocks falls back to markdown body
- Edge case: expired items show disabled action buttons

---

### II-05: Action handler integration — ActionButton/QuickForm in inbox items
**Epic**: Epic 5
**Priority**: P1 (critical)
**Depends on**: II-04, BF-08 (useBlockActions)
**Estimated effort**: S

#### Description
Wire up the action handler system for inbox items. When a user clicks an ActionButton or submits a QuickForm inside an inbox item, the action is recorded via `POST /inbox-items/:id/action` and the item transitions to "actioned" status.

#### Acceptance Criteria
- [ ] Clicking an ActionButton in an inbox item triggers `context.onAction(action, payload)`
- [ ] `useBlockActions` routes inbox actions to `POST /inbox-items/:id/action`
- [ ] Button enters loading state (spinner) during action execution
- [ ] On success: button flashes green briefly, item status updates to "actioned", green left border appears, "Action completed: {label}" text shows below actions
- [ ] On error: toast with error message, button returns to default state
- [ ] QuickForm submission in inbox items follows same flow (submits form data as action payload)
- [ ] Confirmation dialog shows for ActionButtons with `confirm` prop
- [ ] Permission-disabled buttons show tooltip "You don't have permission for this action"
- [ ] Already-actioned items show disabled action buttons

#### Technical Details
- Files to modify:
  - `ui/src/hooks/useBlockActions.ts` (the inbox branch is already defined in architecture — verify it works end-to-end)
  - `ui/src/components/InboxItemCard.tsx` (wire context to BlockRenderer)
- Key implementation notes: The `useBlockActions` hook (from BF-08) already has the inbox routing logic. This story is about integration testing and ensuring the full flow works: click → API call → status update → UI feedback. The mutation should invalidate `queryKeys.inboxItems.list` on success.

#### UX Requirements
- Loading state: button shows spinner, all other buttons in same card disabled
- Success flash: 200ms green border/bg on button
- Action result line: `text-xs text-success` below the actions area
- Error: toast via existing toast system

#### Testing Requirements
- Integration test: ActionButton click → API call → status change → UI update
- Integration test: QuickForm submit → action recorded
- Interaction: confirmation dialog flow (confirm/cancel)
- Edge case: double-click prevention (button disabled during execution)
- Edge case: action on expired item

---

### II-06: Rich failed run notifications — StatusBadge + CodeBlock + ActionButtons
**Epic**: Epic 5
**Priority**: P2 (important)
**Depends on**: II-04, II-05
**Estimated effort**: S

#### Description
Create rich structured notifications for failed agent runs. Instead of plain text "Agent X failed: timeout", generate inbox items with StatusBadge (error), CodeBlock (stderr extract), and ActionButtons (Retry, Assign, Dismiss). This demonstrates the power of content blocks in the inbox.

#### Acceptance Criteria
- [ ] When an agent run fails, a rich inbox item is created for the relevant user(s)
- [ ] The inbox item contains `content_blocks` with:
  - `StatusBadge` (variant: "error", text: failure type)
  - `CodeBlock` (stderr or error message extract, max ~20 lines)
  - `Stack` (horizontal) with `ActionButton`s: "Retry" (action: retry-run), "Assign" (action: assign-issue), "Dismiss" (variant: ghost, action: dismiss)
- [ ] The item has `category: "failed_run"`, `priority: "high"`, `related_agent_id` set
- [ ] Item title: "Run failed — {Agent Name}"
- [ ] Item body: plain text fallback of the error message

#### Technical Details
- Files to modify:
  - Server-side run failure handler (locate where `failed_runs` are currently generated — likely in `server/src/services/heartbeat.ts` or similar)
  - Add inbox item creation via `db.insert(inboxItems)` with structured content_blocks
- Key implementation notes: This replaces (or augments) the existing failed_runs inbox category. The content_blocks are constructed server-side as a valid `ContentDocument`. The "Retry" action will need a server-side action handler to re-trigger the run — for v1, this can create an issue comment or trigger via existing mechanisms.

#### UX Requirements
- Card renders with red priority bar (high priority)
- CodeBlock shows error with copy button
- Action buttons in horizontal stack at bottom

#### Testing Requirements
- Unit test: failed run creates inbox item with correct structure
- Unit test: content_blocks are valid ContentDocument
- Visual: rich notification renders correctly in inbox
- Edge case: very long stderr (truncated to ~20 lines in CodeBlock)

---

### II-07: Migration of existing sources (failed_runs, approvals) to inbox_items format
**Epic**: Epic 5
**Priority**: P2 (important)
**Depends on**: II-06
**Estimated effort**: M

#### Description
Migrate the existing inbox data sources (failed_runs and approvals) to create `inbox_items` entries. This unifies the inbox into a single data model. Existing category-specific renderers continue to work alongside the new system during transition.

#### Acceptance Criteria
- [ ] Failed run events create inbox_items (in addition to or replacing the existing failed_runs query)
- [ ] Approval requests create inbox_items with QuickForm content_blocks
- [ ] Existing inbox sections still function during migration (no breaking changes)
- [ ] New unified inbox_items appear in the "Agent Notifications" section
- [ ] A migration plan is documented for fully deprecating the old category-specific queries in a future sprint

#### Technical Details
- Files to modify:
  - Server-side approval creation logic
  - Server-side run failure handling
  - `ui/src/pages/Inbox.tsx` (potentially consolidate sections)
- Key implementation notes: This is a GRADUAL migration. Phase 1 (this story) is dual-write: existing systems continue AND inbox_items are also created. Phase 2 (future) will deprecate the old queries. Approval inbox items should use QuickForm blocks with `submitAction: "approve"` or `submitAction: "reject"`.

#### UX Requirements
- No visual changes to existing sections
- New items appear in the "Agent Notifications" section
- Approvals rendered as QuickForm blocks should look like the existing approval UI

#### Testing Requirements
- Integration test: failed run creates both old format and new inbox_item
- Integration test: approval creates inbox_item with QuickForm
- Regression: existing inbox sections still work
- Edge case: duplicate notifications (old + new) are acceptable during migration

---

## F1-Admin Gaps

### F1-ADMIN-01: Admin View Presets page — list, create, edit, delete presets
**Epic**: F1-Admin
**Priority**: P1 (critical)
**Depends on**: None (F1 backend is DONE, this is the missing admin UI)
**Estimated effort**: M

#### Description
Create the admin page at `/admin/view-presets` for managing view presets. This page lists all presets as cards, allows creating new presets, and provides entry points for editing and deleting.

#### Acceptance Criteria
- [ ] Page accessible at `/admin/view-presets`, gated by `roles:manage` permission
- [ ] Page registered in router and in `NAV_ITEM_REGISTRY` (NavItemId `"view-presets"`, icon `LayoutGrid`, route `/admin/view-presets`)
- [ ] Page shows a responsive grid of preset cards (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`)
- [ ] Each card shows: icon (colored), name, description (line-clamp-2), role assignment count ("3 roles assigned"), "Default" badge if applicable, Edit and Delete action buttons
- [ ] "+ Create Preset" button in page header opens a creation form/dialog
- [ ] Create preset: name (required), slug (auto-generated from name, editable), description, icon, color
- [ ] Delete preset: confirmation dialog, cannot delete the default preset
- [ ] Page fetches presets via existing `GET /view-presets` API
- [ ] CRUD operations use existing API endpoints (already built in F1)

#### Technical Details
- Files to create:
  - `ui/src/pages/AdminViewPresets.tsx`
- Files to modify:
  - `ui/src/App.tsx` or router config (add route)
  - `ui/src/lib/nav-registry.ts` (add `"view-presets"` NavItemId)
- Key implementation notes: Follow the patterns from `AdminRoles.tsx` and `AdminTags.tsx`. The API endpoints already exist (`server/src/routes/view-presets.ts` — 6 endpoints). Use existing API client `ui/src/api/view-presets.ts`. The preset card hover: `hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer`.

#### UX Requirements
- Preset card: See UX spec section 3.2 for full Tailwind classes
- Icon area: `h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center`
- Action buttons: `Button ghost icon-xs` for Edit (Pencil) and Delete (Trash2)
- Default badge: `Badge variant="secondary"` with "Default" text
- Page header: standard admin page layout with title + action button

#### Testing Requirements
- Visual: preset cards render correctly
- Interaction: create → card appears
- Interaction: delete → confirmation → card removed
- Edge case: no presets (empty state)
- Edge case: cannot delete default preset

---

### F1-ADMIN-02: Preset editor — sidebar sections reorder, dashboard widgets config, landing page
**Epic**: F1-Admin
**Priority**: P1 (critical)
**Depends on**: F1-ADMIN-01
**Estimated effort**: L

#### Description
Build the preset editor page/sheet that allows admins to configure a view preset's layout: general info (name, slug, description, icon, color), sidebar sections (reorderable with drag handles, items togglable via checkboxes), dashboard widgets (sortable list from WIDGET_REGISTRY), and landing page (radio group).

#### Acceptance Criteria
- [ ] Editor opens as a full page (`/admin/view-presets/:id/edit`) or wide Sheet
- [ ] **General section**: name input, slug input (auto-generated, editable), description textarea, icon picker (select of lucide icons), color picker (8 preset colors)
- [ ] **Sidebar sections**: sortable list with drag handles (`GripVertical` icon). Each section expandable to show checkbox items from `NAV_ITEM_REGISTRY`. Checkboxes toggle item visibility for the preset.
- [ ] **Dashboard widgets**: sortable list. Each row shows widget label + span selector (1-4 dropdown). Add widget from WIDGET_REGISTRY dropdown. Remove with X button.
- [ ] **Landing page**: radio group of available pages (Dashboard, Issues, Inbox, Chat, etc.) from `NAV_ITEM_REGISTRY`
- [ ] Save button calls `PATCH /view-presets/:id` with the updated layout
- [ ] Toast on save: "Preset saved"
- [ ] Back button returns to preset list
- [ ] Inline validation: name is required, slug is unique

#### Technical Details
- Files to create:
  - `ui/src/pages/AdminViewPresetEditor.tsx`
- Files to modify:
  - `ui/src/App.tsx` or router config (add route)
- Key implementation notes: The layout structure is `ViewPresetLayout` from `packages/shared/src/types/view-preset.ts`. Sidebar sections use `SidebarSection[]`, dashboard widgets use `DashboardWidget[]`. The drag-and-drop for sortable lists can use `@dnd-kit/sortable` or a simpler approach with up/down arrow buttons for v1. The icon picker is a simple `Select` with lucide icon names. Color picker is 8 colored circles in a row.

#### UX Requirements
- Editor layout: See UX spec section 3.3 for full wireframe
- Section cards: `border border-border rounded-lg p-4`
- Drag handle: `GripVertical` icon, `text-muted-foreground cursor-grab`
- Checkbox items: `flex items-center gap-2`, shadcn `Checkbox` + label
- Save button: `Button variant="default"` in top-right header
- Color picker: 8 circles `h-6 w-6 rounded-full`, selected has ring

#### Testing Requirements
- Visual: all sections render correctly
- Interaction: drag to reorder sidebar sections
- Interaction: toggle sidebar items via checkboxes
- Interaction: add/remove dashboard widgets
- Interaction: change landing page selection
- Interaction: save persists changes
- Edge case: empty sidebar sections (all items unchecked)
- Edge case: no dashboard widgets selected

---

### F1-ADMIN-03: Role → Preset assignment interface
**Epic**: F1-Admin
**Priority**: P1 (critical)
**Depends on**: F1-ADMIN-01
**Estimated effort**: S

#### Description
Build the interface for assigning view presets to roles. This can be a section within the preset editor (F1-ADMIN-02) or a standalone section. Each role has a `view_preset_id` FK that determines which preset it uses.

#### Acceptance Criteria
- [ ] Role assignment section shows a table/list of all roles
- [ ] Each role row shows: role name, current preset assignment, action button
- [ ] "Assign this" button changes the role's `view_preset_id` to the current preset
- [ ] "Already assigned" indicator for roles already using this preset
- [ ] Roles with no preset show "(none)" and an "Assign" button
- [ ] Changes are saved via the existing role update API (`PATCH /roles/:id` with `{ viewPresetId }`)
- [ ] Reassigning a role from another preset updates immediately

#### Technical Details
- Files to modify:
  - `ui/src/pages/AdminViewPresetEditor.tsx` (add role assignment section at bottom) OR
  - `ui/src/pages/AdminViewPresets.tsx` (add as a separate section/dialog)
- Key implementation notes: Fetch roles via existing `GET /roles` API. The `roles` table already has `view_preset_id` column (from F1 migration 0057). Update via existing `PATCH /roles/:id`. See UX spec section 3.4.

#### UX Requirements
- Table layout with 3 columns: Role, Current Preset, Action
- "Assign this" button: `Button variant="outline" size="sm"`
- "Already assigned": `Badge variant="secondary"` or disabled state
- Section title: "ROLE ASSIGNMENT" with standard section styling

#### Testing Requirements
- Interaction: assign a role to a preset
- Interaction: reassign a role from one preset to another
- Visual: already-assigned roles show correct indicator
- Edge case: no roles exist (empty table)
- Edge case: preset is deleted while roles are assigned (handled by DB FK — roles fall back to no preset)

---

## Dependency Summary

### Cross-Epic Dependencies (from Epic 2 / Epic 4)

| This Plan's Story | Depends on (Epic 2/4) | What It Needs |
|---|---|---|
| DI-01, II-01 | BF-01 | Shared types (content-blocks.ts, user-widget.ts, inbox-item.ts) |
| DI-02, II-02 | BF-01 | Shared validators (createUserWidgetSchema, etc.) |
| DI-04, II-04 | BF-06 | BlockRenderer.tsx component |
| DI-04, II-04 | BF-07 | ContentRenderer.tsx component |
| DI-04, II-04, II-05 | BF-08 | useBlockActions.ts hook |
| DI-07 | BF-09 | block-catalogue route (GET /block-catalogue) |

### Intra-Plan Dependencies

```
DI-01 → DI-02 → DI-03 → DI-04 → DI-05
                                ↘ DI-06 → DI-08 → DI-09
                         DI-07 ↗

II-01 → II-02 → II-03 → II-04 → II-05 → II-06 → II-07

F1-ADMIN-01 → F1-ADMIN-02
            → F1-ADMIN-03
```

### Effort Summary

| Story | Effort | Epic |
|---|---|---|
| DI-01 | XS | Epic 3 |
| DI-02 | S | Epic 3 |
| DI-03 | XS | Epic 3 |
| DI-04 | M | Epic 3 |
| DI-05 | S | Epic 3 |
| DI-06 | M | Epic 3 |
| DI-07 | M | Epic 3 |
| DI-08 | L | Epic 3 |
| DI-09 | M | Epic 3 |
| II-01 | XS | Epic 5 |
| II-02 | S | Epic 5 |
| II-03 | XS | Epic 5 |
| II-04 | M | Epic 5 |
| II-05 | S | Epic 5 |
| II-06 | S | Epic 5 |
| II-07 | M | Epic 5 |
| F1-ADMIN-01 | M | F1-Admin |
| F1-ADMIN-02 | L | F1-Admin |
| F1-ADMIN-03 | S | F1-Admin |

**Total: 19 stories** (9 Epic 3 + 7 Epic 5 + 3 F1-Admin)

**Effort distribution:**
- XS: 4 stories
- S: 6 stories
- M: 6 stories
- L: 2 stories
- XL: 0 stories
