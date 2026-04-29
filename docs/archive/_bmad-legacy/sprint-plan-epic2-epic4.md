# Sprint Plan — Epic 2 (Blocks Foundation) & Epic 4 (Agent Forms in Issues)

> **Author**: PM/PO Agent
> **Date**: 2026-04-06
> **Source**: `blocks-platform-architecture.md`, `blocks-platform-ux-spec.md`
> **Status**: READY FOR DEVELOPMENT

---

## Sprint Order (Critical Path)

```
Phase 1 — Shared Foundation (must be first, everything depends on this)
  BF-01  Zod catalogue in shared package
  BF-02  Server-side validation middleware + block catalogue API

Phase 2 — Simple Display Blocks (parallelizable)
  BF-03a  Display blocks: MetricCard, StatusBadge, ProgressBar, Divider
  BF-03b  Data blocks: DataTable, CodeBlock, Markdown
  BF-03c  Chart block (recharts dependency)

Phase 3 — Layout + Orchestrator (depends on Phase 2)
  BF-04  Layout blocks: Stack, Section
  BF-05  BlockRenderer orchestrator + ContentRenderer meta-component

Phase 4 — Interactive Blocks (depends on Phase 3)
  BF-06  useBlockActions() hook
  BF-07  Interactive blocks: ActionButton, QuickForm

Phase 5 — Epic 4: Agent Forms in Issues (depends on Phase 4)
  AF-01  Migration — content_blocks JSONB column on issue_comments
  AF-02  Server — accept content_blocks in POST/GET comments
  AF-03  UI — CommentThread uses ContentRenderer
  AF-04  Enriched CAO watchdog reports using blocks
```

### Critical Path

```
BF-01 → BF-02 → BF-03a/b/c → BF-04 → BF-05 → BF-06 → BF-07 → AF-01 → AF-02 → AF-03 → AF-04
                 (parallel)
```

**Blockers**: BF-01 blocks EVERYTHING. BF-05 blocks all integration work. BF-06 blocks interactive blocks and Epic 4.

---

## Epic 2: Blocks Foundation

---

### BF-01: Zod Content Blocks Catalogue in Shared Package
**Epic**: Epic 2 — Blocks Foundation
**Priority**: P0 (blocker — everything depends on this)
**Depends on**: None
**Estimated effort**: S

#### Description
Create the complete Zod schema catalogue defining all 14 content block types (8 display + 2 interactive + 2 layout + 2 utility). This is the single source of truth for block validation across server and client. Also create type exports for UserWidget, InboxItem, and ContentDocument.

#### Acceptance Criteria
- [ ] `packages/shared/src/types/content-blocks.ts` created with all 14 block Zod schemas
- [ ] `ContentBlock` discriminated union covers all 12 non-utility types (metric-card, status-badge, data-table, code-block, progress-bar, markdown, chart, divider, action-button, quick-form, stack, section)
- [ ] `ContentDocument` schema with `schemaVersion: z.literal(1)` and `blocks` array
- [ ] Recursive types work correctly (Stack/Section contain ContentBlock children)
- [ ] `BLOCK_TYPES` const array exported for catalogue endpoint
- [ ] All TypeScript type exports (`ContentBlock`, `ContentDocument`, `MetricCardBlock`, etc.)
- [ ] `packages/shared/src/validators/content-blocks.ts` created with `contentBlocksSchema` and `validateContentDocumentSchema`
- [ ] `packages/shared/src/types/index.ts` updated with new exports
- [ ] `packages/shared/src/validators/index.ts` updated with new exports
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to create**:
  - `packages/shared/src/types/content-blocks.ts` — Full Zod catalogue (see architecture blueprint section 3.1)
  - `packages/shared/src/validators/content-blocks.ts` — Validation wrappers (section 3.4)
- **Files to modify**:
  - `packages/shared/src/types/index.ts` — Add all type exports (section 3.10)
  - `packages/shared/src/validators/index.ts` — Add validator exports (section 3.9)
- **Key implementation notes**:
  - Use `z.lazy()` for recursive `ContentBlock` type (Stack/Section children reference ContentBlock)
  - Use `z.discriminatedUnion("type", [...])` for the main ContentBlock union
  - All block types follow the pattern: `z.object({ type: z.literal("block-name"), ...fields })`

#### Testing Requirements
- Unit test: validate each of the 14 block types individually with valid/invalid data
- Unit test: validate `ContentDocument` with nested Stack > MetricCard structures
- Unit test: reject unknown block types
- Edge cases: empty blocks array, deeply nested stacks (3+ levels), missing required fields

---

### BF-02: Server-Side Validation Middleware + Block Catalogue API
**Epic**: Epic 2 — Blocks Foundation
**Priority**: P0 (blocker — agents need this to generate valid blocks)
**Depends on**: BF-01
**Estimated effort**: S

#### Description
Create the block catalogue API endpoint that serves JSON Schema to agents (so they know how to produce valid blocks), and a POST validate endpoint for pre-flight validation. Also install the `zod-to-json-schema` dependency.

#### Acceptance Criteria
- [ ] `GET /companies/:companyId/block-catalogue` returns `{ schemaVersion, blockTypes, jsonSchema }`
- [ ] `jsonSchema` is valid JSON Schema generated from the Zod `ContentDocument`
- [ ] `POST /companies/:companyId/blocks/validate` with valid document returns `{ valid: true }`
- [ ] `POST /companies/:companyId/blocks/validate` with invalid document returns 400 with validation errors
- [ ] Routes mounted in `server/src/app.ts`
- [ ] `zod-to-json-schema` added to `server/package.json`
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to create**:
  - `server/src/routes/block-catalogue.ts` — Two routes: GET catalogue + POST validate (section 4.2)
- **Files to modify**:
  - `server/src/routes/index.ts` — Export `blockCatalogueRoutes`
  - `server/src/app.ts` — Mount `blockCatalogueRoutes(db)` (section 4.5)
- **New dependency**: `zod-to-json-schema` in `server/package.json`
- **Key notes**:
  - Use `$refStrategy: "none"` in `zodToJsonSchema` to flatten the output (no $ref, easier for agents to parse)
  - The validate endpoint uses the existing `validate` middleware pattern

#### Testing Requirements
- Integration test: GET /block-catalogue returns valid JSON Schema with all 12 block types listed
- Integration test: POST /blocks/validate with a valid ContentDocument returns `{ valid: true }`
- Integration test: POST /blocks/validate with missing `schemaVersion` returns 400
- Edge case: POST /blocks/validate with unknown block type returns 400

---

### BF-03a: Display Blocks — MetricCard, StatusBadge, ProgressBar, Divider
**Epic**: Epic 2 — Blocks Foundation
**Priority**: P1 (critical — simplest blocks, fast to ship)
**Depends on**: BF-01
**Estimated effort**: S

#### Description
Implement the 4 simplest display-only block components. These are pure rendering components with no interactivity.

#### Acceptance Criteria
- [ ] `ui/src/components/blocks/MetricCardBlock.tsx` renders label, value, trend icon, description
- [ ] `ui/src/components/blocks/StatusBadgeBlock.tsx` renders colored Badge with 5 variant mappings
- [ ] `ui/src/components/blocks/ProgressBarBlock.tsx` renders label + animated bar with 4 color variants
- [ ] `ui/src/components/blocks/DividerBlock.tsx` renders shadcn `Separator`
- [ ] All components accept `{ block, context }` props matching `BlockContext` interface
- [ ] Components use shadcn/ui primitives (Badge, Card, Separator) — no custom/inline implementations
- [ ] Dark mode works for all 4 components
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to create**:
  - `ui/src/components/blocks/MetricCardBlock.tsx` (section 5.4 + UX spec 2.1)
  - `ui/src/components/blocks/StatusBadgeBlock.tsx` (UX spec 2.2)
  - `ui/src/components/blocks/ProgressBarBlock.tsx` (UX spec 2.5)
  - `ui/src/components/blocks/DividerBlock.tsx` (UX spec 2.8)
- **Key UX requirements**:
  - MetricCard: `px-4 py-3 rounded-lg border border-border bg-card`, trend icons from lucide (TrendingUp/TrendingDown/Minus), semantic colors for trends
  - StatusBadge: Map `variant` to semantic color tokens (`--success`, `--warning`, `--error`, `--info`), inline pill layout
  - ProgressBar: `h-2 rounded-full` track, animated fill via `transition-all duration-500`, variant colors for fill
  - Divider: `<Separator className="my-3" />`

#### UX Requirements
- MetricCard: min-width 120px in horizontal Stack, stack label above value in narrow containers (<300px)
- StatusBadge: always inline, no responsive changes
- ProgressBar: always full-width of container
- All display-only: no hover/focus states

#### Testing Requirements
- Unit test: each component renders correct HTML structure with given props
- Unit test: MetricCard shows/hides trend icon based on `trend` prop
- Unit test: StatusBadge applies correct CSS class per variant
- Unit test: ProgressBar width matches `value` percentage
- Edge case: MetricCard with value=0, ProgressBar with value=0 and value=100

---

### BF-03b: Data Blocks — DataTable, CodeBlock, Markdown
**Epic**: Epic 2 — Blocks Foundation
**Priority**: P1 (critical — needed for agent reports)
**Depends on**: BF-01
**Estimated effort**: M

#### Description
Implement the 3 data-display block components. These handle structured data rendering: tables with alignment/maxRows, code with copy button, and markdown passthrough.

#### Acceptance Criteria
- [ ] `ui/src/components/blocks/DataTableBlock.tsx` renders HTML table with columns, rows, alignment, maxRows truncation
- [ ] `ui/src/components/blocks/CodeBlockComp.tsx` renders code with optional title, copy-to-clipboard button, max-height scroll
- [ ] `ui/src/components/blocks/MarkdownBlock.tsx` delegates to existing `MarkdownBody` component
- [ ] DataTable shows "and X more rows" when `maxRows` truncates
- [ ] DataTable shows "No data" for empty rows
- [ ] CodeBlock copy button shows Check icon for 2s after click (same pattern as existing CopyMarkdownButton)
- [ ] All components accept `{ block, context }` props
- [ ] Dark mode works
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to create**:
  - `ui/src/components/blocks/DataTableBlock.tsx` (UX spec 2.3)
  - `ui/src/components/blocks/CodeBlockComp.tsx` (UX spec 2.4)
  - `ui/src/components/blocks/MarkdownBlock.tsx` (UX spec 2.6)
- **Key UX requirements**:
  - DataTable: native `<table>` styled with Tailwind (no data-grid library). `overflow-x-auto` for horizontal scroll. `hover:bg-accent/30` on rows. Columns support `align: "left" | "center" | "right"`
  - CodeBlock: `font-mono` via JetBrains Mono. `max-h-[300px] overflow-y-auto`. Header bar with title + copy button. `whitespace-pre-wrap break-words`
  - MarkdownBlock: reuse existing `MarkdownBody` component, wrap with `prose prose-sm dark:prose-invert max-w-none`
- **Existing component to reuse**: `MarkdownBody` (already exists in ui/src/components/)

#### UX Requirements
- DataTable: horizontal scroll on overflow, `-mx-4 px-4` bleed in narrow containers
- CodeBlock: max height 300px with vertical scroll, horizontal scroll for long lines
- Markdown: text flows naturally, full width

#### Testing Requirements
- Unit test: DataTable renders correct number of columns and rows
- Unit test: DataTable maxRows shows truncation message
- Unit test: DataTable empty state shows "No data"
- Unit test: DataTable column alignment applies correct text-align
- Unit test: CodeBlock copy button triggers clipboard API
- Unit test: MarkdownBlock delegates to MarkdownBody
- Edge case: DataTable with 0 rows, CodeBlock with empty code string

---

### BF-03c: Chart Block (recharts)
**Epic**: Epic 2 — Blocks Foundation
**Priority**: P2 (important but not blocking)
**Depends on**: BF-01
**Estimated effort**: S

#### Description
Implement the Chart block component supporting line, bar, pie, and donut chart types. Uses recharts library (or CSS-based simple charts if recharts not yet in the project).

#### Acceptance Criteria
- [ ] `ui/src/components/blocks/ChartBlock.tsx` renders 4 chart types: line, bar, pie, donut
- [ ] Charts use `ResponsiveContainer` to resize with parent container
- [ ] Optional title rendered above chart
- [ ] Colors use CSS vars `--chart-1` through `--chart-5`, or `color` from data items
- [ ] Chart height: 200px default, 160px in narrow containers (span-1)
- [ ] Dark mode works
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to create**:
  - `ui/src/components/blocks/ChartBlock.tsx` (UX spec 2.7)
- **New dependency**: `recharts` in `ui/package.json` (check if already present)
- **Key UX requirements**:
  - line: smooth curves with dots on data points
  - bar: vertical bars
  - pie: standard pie with labels outside
  - donut: pie with cutout center
  - All wrapped in `ResponsiveContainer` for auto-sizing

#### UX Requirements
- Chart area: `w-full h-[200px]` default, `h-[160px]` in span-1 widgets
- Title: `text-sm font-medium text-foreground` above chart

#### Testing Requirements
- Unit test: ChartBlock renders without error for each chart type
- Unit test: ChartBlock renders title when provided
- Edge case: empty data array, single data point

---

### BF-04: Layout Blocks — Stack, Section
**Epic**: Epic 2 — Blocks Foundation
**Priority**: P1 (critical — needed for any composed block layout)
**Depends on**: BF-03a (uses child blocks for rendering)
**Estimated effort**: S

#### Description
Implement the 2 layout container blocks that wrap child blocks. These are recursive — they render children via BlockRenderer, which must exist first (or they can be built alongside BF-05).

#### Acceptance Criteria
- [ ] `ui/src/components/blocks/StackBlock.tsx` renders children in flex layout (horizontal/vertical)
- [ ] Stack supports 3 gap sizes: sm (gap-2), md (gap-3), lg (gap-4)
- [ ] Stack horizontal mode uses `flex-row flex-wrap`
- [ ] `ui/src/components/blocks/SectionBlock.tsx` renders optional title + children
- [ ] Section collapsible mode uses shadcn `Collapsible` with chevron animation
- [ ] Section non-collapsible mode renders plain title + children
- [ ] Both components recursively render children via `BlockRenderer`
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to create**:
  - `ui/src/components/blocks/StackBlock.tsx` (section 5.4, UX spec 2.11)
  - `ui/src/components/blocks/SectionBlock.tsx` (section 5.4, UX spec 2.12)
- **Depends on**: `BlockRenderer` (BF-05) for recursive rendering — these can be built simultaneously since they import from each other
- **Key UX requirements**:
  - Stack horizontal: `flex flex-row flex-wrap items-start` + gap class
  - Stack vertical: `flex flex-col` + gap class (default)
  - Section collapsible: shadcn `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`. ChevronRight icon rotates 90deg when open
  - Section non-collapsible: just `space-y-2` with title + children

#### UX Requirements
- Horizontal stacks with >3 children wrap on narrow screens (`flex-wrap`)
- Horizontal stacks of MetricCards: each child gets `flex-1 min-w-[120px]`
- Section default state: open

#### Testing Requirements
- Unit test: StackBlock renders children in correct flex direction
- Unit test: StackBlock applies correct gap class
- Unit test: SectionBlock renders title when provided
- Unit test: SectionBlock collapsible toggle works
- Edge case: Stack with 0 children, Section with no title

---

### BF-05: BlockRenderer Orchestrator + ContentRenderer Meta-Component
**Epic**: Epic 2 — Blocks Foundation
**Priority**: P0 (blocker — all surfaces use this)
**Depends on**: BF-03a, BF-03b, BF-04 (needs all block components registered)
**Estimated effort**: S

#### Description
Create the two core rendering components: `BlockRenderer` (dispatches a single `ContentBlock` to its renderer by type) and `ContentRenderer` (decides between structured blocks vs markdown fallback). Also create the barrel exports file and the `BlockContext` interface.

#### Acceptance Criteria
- [ ] `ui/src/components/blocks/BlockRenderer.tsx` with `BLOCK_COMPONENTS` map dispatching to all 12 component types
- [ ] `BlockRenderer` renders "Unknown block type: X" for unrecognized types (graceful degradation)
- [ ] `BlockContext` interface defined with `surface`, `surfaceId`, `companyId`, `onAction`, `hasPermission`
- [ ] `ui/src/components/blocks/ContentRenderer.tsx` auto-detects blocks vs markdown
- [ ] ContentRenderer: if `contentBlocks?.schemaVersion === 1` and blocks array non-empty, render blocks
- [ ] ContentRenderer: otherwise fall back to `<MarkdownBody>`
- [ ] `ui/src/components/blocks/index.ts` barrel exports all public components
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to create**:
  - `ui/src/components/blocks/BlockRenderer.tsx` (section 5.2)
  - `ui/src/components/blocks/ContentRenderer.tsx` (section 5.3)
  - `ui/src/components/blocks/index.ts` — barrel exports
- **Key implementation notes**:
  - `BLOCK_COMPONENTS` is a `Record<string, React.ComponentType<{ block: any; context: BlockContext }>>` mapping block type strings to components
  - ContentRenderer imports `MarkdownBody` from `../MarkdownBody` for fallback
  - Both components are used by CommentThread (AF-03), DashboardGrid (E3), and Inbox (E5)

#### UX Requirements
- ContentRenderer blocks mode: `space-y-2` between blocks
- ContentRenderer markdown fallback: existing `MarkdownBody` styling unchanged

#### Testing Requirements
- Unit test: BlockRenderer dispatches to correct component for each block type
- Unit test: BlockRenderer renders fallback for unknown type
- Unit test: ContentRenderer renders blocks when `contentBlocks` is valid
- Unit test: ContentRenderer renders markdown when `contentBlocks` is null/undefined
- Unit test: ContentRenderer renders markdown when `contentBlocks.blocks` is empty array
- Edge case: ContentRenderer with both body and contentBlocks (blocks take priority)

---

### BF-06: useBlockActions() Hook — Unified Action Handler
**Epic**: Epic 2 — Blocks Foundation
**Priority**: P1 (critical — needed for interactive blocks)
**Depends on**: BF-05
**Estimated effort**: S

#### Description
Create the unified React hook that handles all block actions across surfaces (issue comments, inbox items, dashboard). Uses react-query mutations to route actions to the correct API endpoints.

#### Acceptance Criteria
- [ ] `ui/src/hooks/useBlockActions.ts` created
- [ ] Returns `{ context: BlockContext, isExecuting: boolean }`
- [ ] `surface: "issue"` — posts a reply comment with action data to `POST /issues/:id/comments`
- [ ] `surface: "inbox"` — calls `POST /inbox-items/:id/action`
- [ ] `surface: "dashboard"` — throws error (display only, no actions)
- [ ] Invalidates correct query keys after action success (issue comments, inbox items)
- [ ] Uses `useCompany()` for `selectedCompanyId`
- [ ] Uses `usePermissions()` for `hasPermission` in BlockContext
- [ ] `ui/src/lib/queryKeys.ts` updated with `inboxItems` keys
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to create**:
  - `ui/src/hooks/useBlockActions.ts` (section 5.5)
- **Files to modify**:
  - `ui/src/lib/queryKeys.ts` — Add `inboxItems.list()` and `inboxItems.detail()` keys (section 5.8)
- **Key implementation notes**:
  - Uses `useMutation` from `@tanstack/react-query`
  - Issue surface: posts `body` with markdown-formatted action + JSON payload as a new comment
  - Inbox surface: posts to the action endpoint which records the action and marks item as "actioned"
  - `onAction` callback is memoized with `useCallback`

#### Testing Requirements
- Unit test: hook returns valid BlockContext with correct surface
- Unit test: issue action posts correct payload to comments endpoint
- Unit test: inbox action posts correct payload to action endpoint
- Unit test: query invalidation fires on success
- Edge case: action when no companyId selected throws error

---

### BF-07: Interactive Blocks — ActionButton, QuickForm
**Epic**: Epic 2 — Blocks Foundation
**Priority**: P1 (critical — core interactivity)
**Depends on**: BF-06 (needs useBlockActions/onAction)
**Estimated effort**: M

#### Description
Implement the 2 interactive block components that trigger actions. ActionButton handles single-click actions with optional confirmation dialog. QuickForm renders inline forms that submit structured data.

#### Acceptance Criteria
- [ ] `ui/src/components/blocks/ActionButtonBlock.tsx` renders shadcn Button with variant mapping
- [ ] ActionButton: optional `confirm` prop opens confirmation Dialog before executing
- [ ] ActionButton: `permission` prop disables button if user lacks permission (via `context.hasPermission`)
- [ ] ActionButton: loading state during execution (disabled + "..." text)
- [ ] ActionButton: optional lucide icon via `icon` prop with ICON_MAP lookup
- [ ] `ui/src/components/blocks/QuickFormBlock.tsx` renders inline form with all 6 field types
- [ ] QuickForm: supports text, textarea, select, checkbox, number, date fields
- [ ] QuickForm: required field validation on submit (red border + "Required" text)
- [ ] QuickForm: submitting state disables all fields + shows spinner on submit button
- [ ] QuickForm: calls `context.onAction(submitAction, { ...submitPayload, formData })` on submit
- [ ] Both components use shadcn/ui primitives (Button, Dialog, Input, Label, Select, Checkbox, Textarea)
- [ ] Dark mode works
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to create**:
  - `ui/src/components/blocks/ActionButtonBlock.tsx` (section 5.4, UX spec 2.9)
  - `ui/src/components/blocks/QuickFormBlock.tsx` (section 5.4, UX spec 2.10)
- **Key UX requirements**:
  - ActionButton variant mapping: default→"default", destructive→"destructive", outline→"outline", ghost→"ghost"
  - ActionButton icon resolution: Map of lucide icon names to components (RefreshCw, GitMerge, UserPlus, Pause, Play, X, Check, etc.)
  - QuickForm: `space-y-3` fields layout. Submit button at bottom-right via `flex justify-end`. `w-full` on mobile, `w-auto` on sm+
  - QuickForm fields use shadcn `Input`, `Select` (with SelectContent/SelectItem), `Checkbox`, `Textarea`, `Label`
  - Validation on submit only, not on blur

#### UX Requirements
- ActionButton: `size="sm"` (h-9), icon `h-3.5 w-3.5 mr-1.5`
- ActionButton disabled (no permission): `opacity-50 cursor-not-allowed` + tooltip
- ActionButton confirm dialog: uses shadcn Dialog with Cancel + Confirm buttons
- QuickForm container: `space-y-4`, border rounded-md p-3
- QuickForm submit: `Button variant="default" size="sm"`
- QuickForm error: red border on required fields + `text-xs text-destructive mt-1`

#### Testing Requirements
- Unit test: ActionButton renders correct variant
- Unit test: ActionButton confirmation dialog opens on click when `confirm` is set
- Unit test: ActionButton disabled when permission check fails
- Unit test: ActionButton calls onAction with correct action + payload
- Unit test: QuickForm renders all 6 field types
- Unit test: QuickForm required validation prevents submit
- Unit test: QuickForm calls onAction with formData on submit
- Unit test: QuickForm loading state disables fields
- Edge case: ActionButton with no icon, QuickForm with 0 fields

---

## Epic 4: Agent Forms in Issues

---

### AF-01: Migration — content_blocks JSONB Column on issue_comments
**Epic**: Epic 4 — Agent Forms in Issues
**Priority**: P0 (blocker for Epic 4)
**Depends on**: None (can run in parallel with Epic 2, but must be done before AF-02)
**Estimated effort**: XS

#### Description
Add the `content_blocks` JSONB column to the `issue_comments` table. This column stores structured block data alongside the existing `body` text field. Also update the Drizzle schema file.

#### Acceptance Criteria
- [ ] Migration file `packages/db/src/migrations/0058_blocks_foundation.sql` created
- [ ] Migration adds `content_blocks JSONB` column to `issue_comments` (nullable, no default)
- [ ] `packages/db/src/schema/issue_comments.ts` updated with `contentBlocks: jsonb("content_blocks")` column
- [ ] Migration is idempotent (`ADD COLUMN IF NOT EXISTS`)
- [ ] `bun run dev` applies migration without error
- [ ] Existing comments are unaffected (null content_blocks)

#### Technical Details
- **Files to create**:
  - `packages/db/src/migrations/0058_blocks_foundation.sql` — Only the `issue_comments.content_blocks` part from architecture section 2 (NOT the `user_widgets` table — that's Epic 3)
- **Files to modify**:
  - `packages/db/src/schema/issue_comments.ts` — Add `contentBlocks: jsonb("content_blocks")` (section 4.1)
- **Key notes**:
  - Migration numbering: latest is `0057_view_presets.sql`. This is `0058`.
  - Only add the `ALTER TABLE issue_comments ADD COLUMN` part. The `user_widgets` CREATE TABLE belongs to Epic 3 and should NOT be in this migration.
  - Column is nullable — existing comments continue to work with `content_blocks = NULL`

#### Testing Requirements
- Verify migration applies cleanly on fresh DB
- Verify migration is re-runnable (IF NOT EXISTS)
- Verify existing issue_comments rows have NULL content_blocks

---

### AF-02: Server — Accept content_blocks in POST/GET Issue Comments
**Epic**: Epic 4 — Agent Forms in Issues
**Priority**: P1 (critical)
**Depends on**: AF-01, BF-01
**Estimated effort**: S

#### Description
Update the issue comments API to accept and return `content_blocks` in POST and GET endpoints. Update the shared validator and type definitions.

#### Acceptance Criteria
- [ ] `POST /issues/:id/comments` accepts optional `contentBlocks` field in body (validated via Zod)
- [ ] `GET /issues/:id/comments` returns `contentBlocks` field on each comment (null if absent)
- [ ] `packages/shared/src/validators/issue.ts` — `addIssueCommentSchema` includes `contentBlocks: ContentDocument.optional().nullable()`
- [ ] `packages/shared/src/types/issue.ts` — `IssueComment` interface includes `contentBlocks: ContentDocument | null`
- [ ] `server/src/services/issues.ts` — `addComment` accepts and stores `contentBlocks` parameter
- [ ] `server/src/routes/issues.ts` — comment handler passes `contentBlocks` through
- [ ] Agents can post comments with structured blocks
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to modify**:
  - `packages/shared/src/validators/issue.ts` — Add `contentBlocks` to `addIssueCommentSchema` (section 3.7)
  - `packages/shared/src/types/issue.ts` — Add `contentBlocks` to `IssueComment` interface (section 3.8)
  - `server/src/routes/issues.ts` — Extract `contentBlocks` from `req.body`, pass to `svc.addComment` (section 4.3)
  - `server/src/services/issues.ts` — `addComment` method accepts 4th param `contentBlocks`, inserts into DB (section 4.3)
- **Key notes**:
  - The `body` field remains required (backward compatibility — agents always send body as markdown fallback)
  - `contentBlocks` is optional — old API consumers continue to work unchanged
  - Server-side validation via the `addIssueCommentSchema` Zod validator which now includes `ContentDocument`

#### Testing Requirements
- Integration test: POST comment with body only (no contentBlocks) — works as before
- Integration test: POST comment with body + contentBlocks — both stored
- Integration test: GET comments returns contentBlocks field
- Integration test: POST comment with invalid contentBlocks returns 400
- Edge case: contentBlocks with empty blocks array

---

### AF-03: UI — CommentThread Uses ContentRenderer
**Epic**: Epic 4 — Agent Forms in Issues
**Priority**: P1 (critical — this is the visible feature)
**Depends on**: AF-02, BF-05, BF-06, BF-07
**Estimated effort**: M

#### Description
Update the CommentThread component to render structured block content when `contentBlocks` is present on a comment, falling back to markdown for plain comments. Integrate the `useBlockActions` hook for interactive blocks (ActionButton, QuickForm) within issue comments.

#### Acceptance Criteria
- [ ] `CommentThread.tsx` uses `<ContentRenderer>` instead of `<MarkdownBody>` for comment body rendering
- [ ] Comments with `contentBlocks` render structured blocks (MetricCards, tables, forms, etc.)
- [ ] Comments without `contentBlocks` render markdown as before (no visual regression)
- [ ] `useBlockActions({ surface: "issue", surfaceId: issueId })` provides action context
- [ ] ActionButton clicks in comments post a reply comment with action data
- [ ] QuickForm submissions in comments post a reply comment with form data
- [ ] Block content area has distinct visual treatment: `rounded-md border border-border/50 bg-accent/10 p-3 space-y-3`
- [ ] Mixed content (body + blocks): blocks render first, body below with separator in `text-xs text-muted-foreground`
- [ ] No visual regression for existing plain-text comments
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to modify**:
  - `ui/src/components/CommentThread.tsx` — Replace `<MarkdownBody>` with `<ContentRenderer>` in comment rendering (section 5.9). Add `useBlockActions` hook call. Pass `blockContext` to `ContentRenderer`
- **Key implementation notes**:
  - `CommentThread` already has `issueId` as a prop — use it for `useBlockActions({ surface: "issue", surfaceId: issueId })`
  - The `TimelineList` sub-component renders each comment — it needs the `blockContext` passed as a prop from the parent `CommentThread`
  - Import `ContentRenderer` from `./blocks/ContentRenderer`
  - Import `useBlockActions` from `../hooks/useBlockActions`

#### UX Requirements
- Block comment visual: inner block area with `bg-accent/10` tint distinguishes from plain markdown
- Plain comments: `border p-3 rounded-sm` + `<MarkdownBody>` — unchanged
- Mixed content: blocks render first (primary), body below as `text-xs text-muted-foreground` context
- ActionButton in comments: click → loading → posts reply comment → button returns to default
- QuickForm in comments: submit → loading → form replaced by success StatusBadge → reply comment posted

#### Testing Requirements
- Unit test: comment with contentBlocks renders BlockRenderer
- Unit test: comment without contentBlocks renders MarkdownBody
- Unit test: ActionButton click in comment posts reply comment
- Unit test: QuickForm submit in comment posts reply with formData
- E2E test: agent posts comment with blocks → user sees structured content
- Visual regression: existing plain comments look identical

---

### AF-04: Enriched CAO Watchdog Reports Using Blocks
**Epic**: Epic 4 — Agent Forms in Issues
**Priority**: P2 (important — improves CAO output quality)
**Depends on**: AF-02
**Estimated effort**: S

#### Description
Update the CAO watchdog to generate structured block content alongside the text body when auto-commenting on failures. The watchdog report should use MetricCards for key stats, StatusBadges for status, and optionally an ActionButton for retry.

#### Acceptance Criteria
- [ ] `server/src/services/cao-watchdog.ts` generates `contentBlocks` for failure reports
- [ ] Failure report includes: StatusBadge (error status), MetricCard (failure count, duration), and optionally ActionButton (retry)
- [ ] `contentBlocks` passed to `addComment` call with the structured report
- [ ] Markdown `body` still contains a readable text summary (backward compatibility)
- [ ] Reports degrade gracefully if blocks rendering fails (body is always readable)
- [ ] `bun run typecheck` passes

#### Technical Details
- **Files to modify**:
  - `server/src/services/cao-watchdog.ts` — In the auto-comment generation, construct a `ContentDocument` with relevant blocks and pass as `contentBlocks` to `svc.addComment()`
- **Key implementation notes**:
  - Import `ContentDocument` type from `@mnm/shared`
  - Construct blocks programmatically: `{ schemaVersion: 1, blocks: [...] }`
  - The `body` field continues to contain the full text report (non-block consumers still work)
  - This is an enhancement — if block generation fails, catch error and fall back to body-only

#### UX Requirements
- Example watchdog report structure:
  - Section: "Failure Report"
    - Stack horizontal: StatusBadge("error", "Failed") + StatusBadge("info", agentName)
    - Stack horizontal: MetricCard("Failures", count) + MetricCard("Duration", time)
    - Markdown: error details
    - ActionButton: "Retry Run" (variant: "outline", action: "retry_run", payload: { runId })

#### Testing Requirements
- Unit test: watchdog generates valid ContentDocument
- Unit test: generated blocks pass Zod validation
- Unit test: body still contains readable text summary
- Edge case: watchdog gracefully falls back if block construction fails

---

## Summary

| Story | Epic | Priority | Effort | Depends On |
|-------|------|----------|--------|------------|
| BF-01 | E2 | P0 | S | — |
| BF-02 | E2 | P0 | S | BF-01 |
| BF-03a | E2 | P1 | S | BF-01 |
| BF-03b | E2 | P1 | M | BF-01 |
| BF-03c | E2 | P2 | S | BF-01 |
| BF-04 | E2 | P1 | S | BF-03a |
| BF-05 | E2 | P0 | S | BF-03a, BF-03b, BF-04 |
| BF-06 | E2 | P1 | S | BF-05 |
| BF-07 | E2 | P1 | M | BF-06 |
| AF-01 | E4 | P0 | XS | — |
| AF-02 | E4 | P1 | S | AF-01, BF-01 |
| AF-03 | E4 | P1 | M | AF-02, BF-05, BF-06, BF-07 |
| AF-04 | E4 | P2 | S | AF-02 |

**Total estimated effort**: ~6-8 dev days for a single developer

### Parallelization Opportunities
- **BF-03a, BF-03b, BF-03c** can all run in parallel after BF-01
- **AF-01** can run in parallel with any Epic 2 story (no dependency)
- **AF-04** can run in parallel with AF-03 (only needs AF-02)
- **BF-02** (server) and **BF-03a** (UI) can run in parallel after BF-01

### Minimum Viable Slice
If time is constrained, the minimum to ship "agent forms in issues" is:
```
BF-01 → BF-03a → BF-03b → BF-04 → BF-05 → AF-01 → AF-02 → AF-03
```
This gives display blocks in comments but skips interactive blocks (ActionButton, QuickForm), Charts, and the catalogue API. Interactive blocks (BF-06, BF-07) can follow immediately after.
