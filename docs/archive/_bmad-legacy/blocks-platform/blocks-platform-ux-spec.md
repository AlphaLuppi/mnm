# MnM Blocks Platform -- Complete UX/UI Specification

> **Date:** 6 avril 2026
> **Author:** UX/UI Designer (Claude)
> **Source:** `brainstorming-mnm-blocks-platform-unifie-2026-04-05.md`
> **Status:** Ready for implementation

---

## Table of Contents

1. [Design System Foundation](#1-design-system-foundation)
2. [Block Component Designs (14 components)](#2-block-component-designs)
3. [F1 -- Admin View Presets Page](#3-f1-admin-view-presets-page)
4. [F2 -- Dashboard Intelligent](#4-f2-dashboard-intelligent)
5. [F3 -- Comment Thread Blocks](#5-f3-comment-thread-blocks)
6. [F4 -- Inbox Interactive](#6-f4-inbox-interactive)
7. [Interaction Patterns](#7-interaction-patterns)
8. [Accessibility](#8-accessibility)

---

## 1. Design System Foundation

### Existing Patterns (from codebase analysis)

**Typography:**
- Font: Inter (400, 500, 600, 700) + JetBrains Mono (code)
- Headings: `font-semibold` with `leading-none`
- Body: `text-sm` (14px)
- Small: `text-xs` (12px)
- Monospace: `font-mono` for IDs, code, run identifiers

**Colors (oklch-based, warm tone):**
- Background: warm white `oklch(0.98 0.003 80)`
- Card: `oklch(0.993 0.002 80)` with `border-border` (`oklch(0.82 0.025 70)`)
- Primary: blue `oklch(0.5 0.16 250)`
- Destructive: red `oklch(0.55 0.2 25)`
- Semantic: `--success` green, `--warning` amber, `--error` red, `--info` blue
- Muted: `text-muted-foreground` for secondary text

**Spacing:**
- Cards: `px-4 py-4 sm:px-5 sm:py-5` (MetricCard pattern)
- Sections: `space-y-6` between major sections, `space-y-3` within
- Gaps: `gap-2` (compact), `gap-4` (standard), `gap-6` (spacious)

**Borders & Shadows:**
- Cards: `border border-border rounded-lg` (no rounded-xl for content blocks, matching MetricCard)
- Shadow: `shadow-sm` on cards, `shadow-md` on dialogs
- Hover: `hover:bg-accent/50` for interactive cards

**Existing shadcn/ui Components:**
`avatar`, `badge`, `breadcrumb`, `button`, `card`, `checkbox`, `collapsible`, `command`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `resizable`, `scroll-area`, `select`, `separator`, `skeleton`, `switch`, `tabs`, `textarea`, `tooltip`, `sheet`

**Button Variants:**
- `default` (primary blue), `destructive` (red), `outline` (bordered), `secondary`, `ghost`, `link`
- Sizes: `default` (h-10), `sm` (h-9), `xs` (h-6), `lg` (h-10), `icon`, `icon-xs`, `icon-sm`

### Design Principles for Blocks

1. **Reuse shadcn/ui** -- every block wraps existing primitives
2. **Consistent card density** -- match MetricCard's compact feel (px-4 py-4)
3. **Semantic color tokens** -- use `--success`, `--warning`, `--error`, `--info` for variants, not raw Tailwind colors
4. **Responsive first** -- blocks must work in 1-column (comment thread ~650px), 2-column (widget ~350px), and full-width contexts
5. **Dark mode** -- all blocks must work with the existing `.dark` theme variables

---

## 2. Block Component Designs

### 2.1 MetricCard (`type: "metric-card"`)

**Reuses:** Existing `MetricCard` component pattern from `ui/src/components/MetricCard.tsx`

**Visual design:**
```
.---------------------------------------.
| Label                      [trend ^]  |
| 42                                    |
| Optional description text             |
'---------------------------------------'
```

**Tailwind classes:**
```
Container: px-4 py-3 rounded-lg border border-border bg-card
Value:     text-2xl font-semibold tracking-tight text-foreground
Label:     text-xs font-medium text-muted-foreground mt-0.5
Desc:      text-xs text-muted-foreground/70 mt-1
Trend up:  text-success (green arrow-up icon, h-3.5 w-3.5)
Trend down: text-error (red arrow-down icon)
Trend flat: text-muted-foreground (minus icon)
```

**Responsive behavior:**
- In a horizontal Stack: min-width 120px, flex-1
- In narrow containers (<300px): stack label above value
- In dashboard widget (span=1): single metric fills the card

**States:**
- Default: as described
- No hover/focus (display-only)
- Loading: `Skeleton` with `h-8 w-20` for value, `h-3 w-24` for label

**Component hierarchy:**
```tsx
<div className="px-4 py-3 rounded-lg border border-border bg-card">
  <div className="flex items-start justify-between gap-2">
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight mt-0.5">{value}</p>
      {description && <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>}
    </div>
    {trend && <TrendIcon trend={trend} />}
  </div>
</div>
```

---

### 2.2 StatusBadge (`type: "status-badge"`)

**Reuses:** shadcn `Badge` component with custom semantic variants

**Visual design:**
Inline pill badge: `[text]`

**Variant mapping to Tailwind:**
```
success:  bg-success-bg text-success border-success/20
warning:  bg-warning-bg text-warning border-warning/20
error:    bg-error-bg text-error border-error/20
info:     bg-info-bg text-info border-info/20
neutral:  bg-muted text-muted-foreground border-border
```

**Tailwind classes:**
```
Base: inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
      whitespace-nowrap shrink-0 border
```

**Responsive:** No change -- badges are always inline.

**States:**
- Default: colored pill
- No interactive states (display-only)

**Component hierarchy:**
```tsx
<Badge className={variantClasses[variant]}>{text}</Badge>
```

---

### 2.3 DataTable (`type: "data-table"`)

**Reuses:** Native HTML `<table>` styled with Tailwind (no heavy data-grid library)

**Visual design:**
```
Optional Title
.--------------------------------------------.
| Column A      | Column B    | Column C     |
|---------------|-------------|--------------|
| Value 1       | Value 2     | Right-aligned|
| Value 3       | Value 4     | Right-aligned|
'--------------------------------------------'
maxRows: shows "and X more rows" link
```

**Tailwind classes:**
```
Container: w-full overflow-x-auto
Title:     text-sm font-medium text-foreground mb-2
Table:     w-full text-sm
Thead:     border-b border-border
Th:        px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider
           text-left (default) | text-center | text-right
Td:        px-3 py-2 text-sm text-foreground border-b border-border/50
           last:border-b-0
Tr hover:  hover:bg-accent/30 transition-colors
More link: text-xs text-muted-foreground mt-1.5 pl-3
```

**Responsive behavior:**
- Horizontal scroll on overflow (`overflow-x-auto`)
- In narrow containers: horizontal scroll with `-mx-4 px-4` bleed pattern
- Columns with `align: "right"` use `text-right`

**States:**
- Default: as described
- Empty rows: "No data" centered in a single-cell row
- Loading: 3 skeleton rows with `Skeleton h-4 w-full`

**maxRows behavior:**
- Show first N rows, then a `text-xs text-muted-foreground` line: "and {total - maxRows} more rows"

---

### 2.4 CodeBlock (`type: "code-block"`)

**Reuses:** `<pre>` + `<code>` with JetBrains Mono

**Visual design:**
```
[Optional Title]            [Copy button]
.-------------------------------------------.
| code content here                         |
| with syntax highlighting                  |
'-------------------------------------------'
```

**Tailwind classes:**
```
Container:  rounded-md border border-border bg-muted/50 overflow-hidden
Header:     flex items-center justify-between px-3 py-1.5 border-b border-border/50
            bg-muted/30 (only if title or always for copy button)
Title:      text-xs font-medium text-muted-foreground
Copy btn:   text-muted-foreground hover:text-foreground transition-colors p-1
Code area:  px-3 py-3 overflow-x-auto
Pre:        text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap
            break-words max-h-[300px] overflow-y-auto
```

**Responsive:** Code scrolls horizontally. Max height 300px with vertical scroll.

**States:**
- Default: as above
- Copy: show `Check` icon for 2s after click (same pattern as `CopyMarkdownButton` in CommentThread)

---

### 2.5 ProgressBar (`type: "progress-bar"`)

**Visual design:**
```
Label                                   75%
[=============================          ]
```

**Tailwind classes:**
```
Container: space-y-1.5
Header:    flex items-center justify-between
Label:     text-xs font-medium text-muted-foreground
Value:     text-xs font-medium text-foreground
Track:     h-2 w-full rounded-full bg-muted overflow-hidden
Fill:      h-full rounded-full transition-all duration-500 ease-out
```

**Variant colors for fill:**
```
default:  bg-primary
success:  bg-success
warning:  bg-warning
error:    bg-error
```

**Responsive:** Always full width of container.

**States:**
- Default: filled to `value`%
- Animated: `transition-all duration-500` on width change

---

### 2.6 Markdown (`type: "markdown"`)

**Reuses:** Existing `MarkdownBody` component

**Visual design:** Standard markdown rendering using the Tailwind Typography plugin (`@tailwindcss/typography`).

**Tailwind classes:**
```
Container: prose prose-sm dark:prose-invert max-w-none
           [same classes as MarkdownBody]
```

**Responsive:** Text flows naturally.

---

### 2.7 Chart (`type: "chart"`)

**Visual design:**
Simple chart rendered via a lightweight library (recharts, already common in React).

```
[Optional Title]
.-------------------------------------------.
|                                           |
|          chart visualization              |
|                                           |
'-------------------------------------------'
```

**Tailwind classes:**
```
Container:  space-y-2
Title:      text-sm font-medium text-foreground
Chart area: w-full h-[200px] (dashboard widget default)
            Responsive: h-[160px] in span-1, h-[200px] in span-2+
```

**Chart types:**
- `line`: Line chart with smooth curves, dots on data points
- `bar`: Vertical bar chart
- `pie`: Standard pie (labels outside)
- `donut`: Pie with cutout center

**Colors:** Use CSS vars `--chart-1` through `--chart-5`, or `color` from data items.

**Responsive:** Chart resizes with container via `ResponsiveContainer` from recharts.

---

### 2.8 Divider (`type: "divider"`)

**Reuses:** shadcn `Separator`

**Tailwind classes:**
```
<Separator className="my-3" />
```

Simple horizontal rule. `my-3` gap above/below.

---

### 2.9 ActionButton (`type: "action-button"`)

**Reuses:** shadcn `Button`

**Visual design:** Standard button with optional icon prefix.

**Variant mapping:**
```
default:     Button variant="default"    (primary blue)
destructive: Button variant="destructive" (red)
outline:     Button variant="outline"     (bordered)
ghost:       Button variant="ghost"       (text only)
```

**Tailwind classes:**
```
Base: Button size="sm" (h-9)
Icon: lucide icon, h-3.5 w-3.5, mr-1.5 (icon name from "icon" prop, resolved via a lookup map)
```

**States:**
- Default: button as-is
- Hover: standard Button hover per variant
- Loading (action in flight): `disabled opacity-50` + spinner icon replacing the lucide icon
- Disabled (no permission): `disabled opacity-50 cursor-not-allowed`
  + Tooltip wrapping the button: "You don't have permission to perform this action"
- Confirm required (`confirm` prop): click opens a confirmation Dialog before executing
- Success: brief green check flash (200ms), then button returns to default
- Error: toast notification with error message

**Keyboard:** `Enter` or `Space` triggers the action. Focus ring per shadcn default.

**Icon resolution:** Map of common lucide icon names to components:
```tsx
const ICON_MAP: Record<string, LucideIcon> = {
  "refresh-cw": RefreshCw,
  "git-merge": GitMerge,
  "user-plus": UserPlus,
  "pause": Pause,
  "play": Play,
  "x": X,
  "check": Check,
  "trending-down": TrendingDown,
  // ...extensible
};
```

---

### 2.10 QuickForm (`type: "quick-form"`)

**Reuses:** shadcn `Input`, `Select`, `Checkbox`, `Label`, `Textarea`, `Button`

**Visual design:**
```
.-------------------------------------------.
| [Optional Title]                          |
| Optional description text                 |
|                                           |
| Label 1                                   |
| [text input                            ]  |
|                                           |
| Label 2                                   |
| [select dropdown               v       ]  |
|                                           |
| [x] Checkbox label                        |
|                                           |
|                          [Submit Button]  |
'-------------------------------------------'
```

**Tailwind classes:**
```
Container:  space-y-4
Title:      text-sm font-semibold text-foreground
Desc:       text-xs text-muted-foreground
Fields:     space-y-3
Field wrap: space-y-1.5
Label:      Label component (text-sm font-medium)
Inputs:     shadcn Input, Select, Checkbox, Textarea -- all use their default styling
Submit:     Button variant="default" size="sm" className="w-full sm:w-auto"
            at bottom-right via flex justify-end
```

**Field types:**
- `text`: shadcn `Input`
- `textarea`: shadcn `Textarea` (max 3 rows by default)
- `select`: shadcn `Select` with `SelectContent`, `SelectItem` for each option
- `checkbox`: shadcn `Checkbox` + label inline
- `number`: `Input` with `type="number"`
- `date`: `Input` with `type="date"`

**Validation:**
- Required fields: red border + "Required" text below (`text-xs text-destructive mt-1`)
- Validate on submit, not on blur (keep it simple)

**States:**
- Default: form rendered with default values
- Submitting: Submit button shows spinner + "Submitting..." text, all fields disabled
- Success: form replaced by success message: `StatusBadge variant="success"` + "Response submitted"
- Error: toast notification + form remains editable

**Responsive:** Fields always stack vertically. Submit button is `w-full` on mobile, `w-auto` on sm+.

**Design constraint:** 2-3 fields max per brainstorming guideline. The schema allows more, but the design is optimized for short forms.

---

### 2.11 Stack (`type: "stack"`)

**Layout container.** No visual chrome -- just flex layout.

**Direction + gap mapping:**
```
direction: "horizontal" → flex flex-row flex-wrap
direction: "vertical"   → flex flex-col (default)

gap: "sm" → gap-2
gap: "md" → gap-3
gap: "lg" → gap-4
```

**Responsive:**
- Horizontal stacks with >3 children: `flex-wrap` so items wrap on narrow screens
- Horizontal stacks of MetricCards: each child gets `flex-1 min-w-[120px]`

**Component:**
```tsx
<div className={cn(
  "flex",
  direction === "horizontal" ? "flex-row flex-wrap" : "flex-col",
  gapClass
)}>
  {children.map(child => <BlockRenderer block={child} />)}
</div>
```

---

### 2.12 Section (`type: "section"`)

**Visual design:**
```
[v] Section Title                    (collapsible toggle)
.-------------------------------------------.
| children blocks rendered here             |
'-------------------------------------------'
```

**Reuses:** shadcn `Collapsible` (if `collapsible: true`)

**Tailwind classes:**
```
Container:  space-y-2
Header:     flex items-center justify-between
Title:      text-sm font-semibold text-foreground
Toggle btn: Collapsible trigger, ghost variant, icon-sm size
Children:   space-y-3 (same as a vertical Stack)
```

**When `collapsible: false` or absent:** Just title + children, no toggle.

**When `collapsible: true`:** Uses shadcn `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`. Chevron icon rotates on open/close.

---

## 3. F1 -- Admin View Presets Page

### 3.1 Page Layout (`/admin/view-presets`)

**Route:** `/admin/view-presets` (in Admin section of sidebar)

**Page structure:**
```
.================================================================.
| View Presets                              [+ Create Preset]    |
|================================================================|
|                                                                |
| .--------------------. .--------------------. .---------------.|
| | [icon] Default     | | [icon] Product     | | [icon] Exec  ||
| | 3 roles assigned   | | 1 role assigned    | | 1 role       ||
| | [Default badge]    | | [Edit] [Delete]    | | [Edit] [Del] ||
| '--------------------' '--------------------' '---------------'|
|                                                                |
'================================================================'
```

**Layout:** Responsive grid of preset cards.
```
Grid: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4
```

### 3.2 Preset Card

**Tailwind classes:**
```
Card:       border border-border rounded-lg p-5 bg-card
            hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer
Header:     flex items-start justify-between gap-3
Icon area:  h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center
            (icon colored with preset.color or primary)
Name:       text-sm font-semibold text-foreground
Desc:       text-xs text-muted-foreground mt-1 line-clamp-2
Roles:      text-xs text-muted-foreground mt-3
            "Assigned to: Admin, Developer" or "No roles assigned"
Default:    Badge variant="secondary" text-xs -- "Default" if is_default
Actions:    flex items-center gap-1 mt-3 pt-3 border-t border-border/50
            Button ghost icon-xs for Edit (Pencil), Delete (Trash2)
```

**Click:** Opens the preset editor (full page or sheet).

### 3.3 Preset Editor

**Opens as:** Full-page view at `/admin/view-presets/:id/edit` or a wide Sheet (from right).

**Layout:**
```
.================================================================.
| < Back to Presets     Edit: "Product Manager"      [Save]      |
|================================================================|
|                                                                |
| GENERAL                                                        |
| .-----------------------------------------------------------. |
| | Name:  [Product Manager              ]                    | |
| | Slug:  product-manager (auto-generated, editable)         | |
| | Desc:  [Optional description                    ]         | |
| | Icon:  [icon picker dropdown]  Color: [color picker]      | |
| '-----------------------------------------------------------' |
|                                                                |
| SIDEBAR SECTIONS                                               |
| .-----------------------------------------------------------. |
| | [drag handle] Work                                        | |
| |   [x] Dashboard   [x] Issues   [x] Agents               | |
| |   [ ] Drift       [x] Inbox    [ ] Costs                 | |
| | [drag handle] Company                                     | |
| |   [x] Members     [ ] Settings  [x] Projects             | |
| '-----------------------------------------------------------' |
|                                                                |
| DASHBOARD WIDGETS                                              |
| .-----------------------------------------------------------. |
| | Active widgets for this preset:                           | |
| | [drag] KPI Bar (span: 4)                    [x remove]   | |
| | [drag] Run Activity (span: 1)               [x remove]   | |
| | [drag] Recent Issues (span: 2)              [x remove]   | |
| |                                                           | |
| | [+ Add Widget]  (dropdown of WIDGET_REGISTRY items)       | |
| '-----------------------------------------------------------' |
|                                                                |
| LANDING PAGE                                                   |
| .-----------------------------------------------------------. |
| | Redirect after login to:                                  | |
| | ( ) Dashboard   (o) Issues   ( ) Inbox   ( ) Chat        | |
| '-----------------------------------------------------------' |
|                                                                |
'================================================================'
```

**Component mapping:**
- General: shadcn `Input`, `Textarea`, icon picker (simple select of lucide icons), color picker (preset list of 8 colors)
- Sidebar sections: Sortable list (drag handle = `GripVertical` icon). Each section has checkbox items from `NAV_ITEM_REGISTRY`
- Dashboard widgets: Sortable list. Each row shows widget label + span selector (1-4). Add via dropdown
- Landing page: Radio group of available pages

**Save behavior:**
- Button `variant="default"` in top-right
- Saves via `PATCH /view-presets/:id`
- Toast on success: "Preset saved"
- Inline validation errors below fields

### 3.4 Role Assignment Interface

**Location:** Either on the preset editor page (section at bottom) or as a dedicated tab.

**Design:**
```
ROLE ASSIGNMENT
.------------------------------------------------------------.
| Role              | Current Preset     | Action            |
|--------------------|--------------------|--------------------|
| Admin              | Default            | [Assign this]     |
| Developer          | Developer          | [Already assigned]|
| Product Manager    | (none)             | [Assign this]     |
'------------------------------------------------------------'
```

**Implementation:** DataTable-like layout. Each role row shows current preset assignment. "Assign this" button (outline, sm) to change the FK `roles.view_preset_id`.

### 3.5 Preview Mode

**Button:** "Preview as [Role]" in the preset editor header area.

**Behavior:**
- Select dropdown of roles assigned to this preset
- Click "Preview" opens the sidebar in a side-by-side view or overlays a preview panel showing what the sidebar and dashboard would look like for that role
- Implementation: render `Sidebar` with the preset's layout data in a bordered preview container

**Preview container:**
```
Container: border-2 border-dashed border-primary/30 rounded-lg p-4 bg-muted/20
Label:     absolute -top-3 left-3 bg-background px-2 text-xs font-medium text-primary
           "Preview: Product Manager"
```

---

## 4. F2 -- Dashboard Intelligent

### 4.1 Hybrid Dashboard Layout

The dashboard renders in two zones within a single grid:

```
.================================================================.
| Live indicator                                                 |
|                                                                |
| [Predefined widgets from View Preset layout]                  |
| (rendered via WIDGET_REGISTRY -- React components)             |
|                                                                |
| [Separator or natural gap]                                     |
|                                                                |
| MY WIDGETS                                         [+ Add]    |
| .------------------. .------------------. .------------------. |
| | Custom widget 1  | | Custom widget 2  | | Custom widget 3  | |
| | (BlockRenderer)  | | (BlockRenderer)  | | (BlockRenderer)  | |
| '------------------' '------------------' '------------------' |
|                                                                |
'================================================================'
```

**Grid:** Same `grid grid-cols-1 md:grid-cols-4 gap-4` as existing `DashboardGrid`.

**Section header for custom widgets:**
```
Header: flex items-center justify-between mt-6 mb-3
Title:  text-sm font-medium text-muted-foreground uppercase tracking-wider
Button: Button variant="outline" size="sm" with Plus icon
```

### 4.2 Custom Widget Card

Each AI-generated widget is wrapped in a card:

```
.--------------------------------------------.
| Widget Title                    [... menu] |
|--------------------------------------------|
|                                            |
|  <BlockRenderer blocks={widget.blocks} />  |
|                                            |
'--------------------------------------------'
```

**Tailwind classes:**
```
Card:       border border-border rounded-lg bg-card overflow-hidden
Header:     flex items-center justify-between px-4 py-3 border-b border-border/50
Title:      text-sm font-medium text-foreground truncate
Menu:       DropdownMenu trigger = Button ghost icon-xs (MoreHorizontal icon)
            Items: "Edit with CAO", "Resize" (submenu 1-4), "Delete" (destructive)
Content:    p-4
```

**Grid span:** Widget `span` (1-4) maps to `col-span-{n}` via `SPAN_CLASSES` (same as DashboardGrid).

### 4.3 "Add Widget" Flow

**Button click opens a Dialog:**

```
.--------------------------------------------.
| Add Widget                           [x]   |
|--------------------------------------------|
|                                            |
| Choose a template or describe what you     |
| want to see:                               |
|                                            |
| TEMPLATES                                  |
| .------------------. .------------------. |
| | [chart] Burn-down| | [bar] Velocity   | |
| '---w-full---------' '------------------' |
| .------------------. .------------------. |
| | [$] Cost Track   | | [heart] Health   | |
| '------------------' '------------------' |
|                                            |
| -- or --                                   |
|                                            |
| ASK CAO                                   |
| [Describe what you want to see...       ]  |
| [Send to CAO]                             |
|                                            |
'--------------------------------------------'
```

**Template cards:**
```
Card:   border border-border rounded-md p-3 hover:border-primary/50
        hover:bg-accent/30 cursor-pointer transition-all
        text-center space-y-1.5
Icon:   h-5 w-5 text-muted-foreground mx-auto
Label:  text-xs font-medium text-foreground
Grid:   grid grid-cols-2 gap-2
```

**CAO input:**
```
Input:  Textarea rows=2, placeholder="e.g., Show me issue burn-down for my team..."
Button: Button variant="default" size="sm" "Send to CAO"
        disabled until text is non-empty
```

**After CAO generates:**
- Dialog shows a loading state: `Skeleton` blocks + "CAO is generating your widget..."
- On success: Dialog closes, new widget appears at bottom of custom widgets section with a brief highlight animation (`animate-in fade-in-0 slide-in-from-bottom-2 duration-300`)
- On error: Error message in the dialog with "Retry" button

### 4.4 Widget Edit via CAO

When user clicks "Edit with CAO" from widget menu:
- Opens the CAO chat panel (existing pattern) pre-filled with: "Edit widget: {widget.title}. Current blocks: {JSON summary}. What changes would you like?"
- CAO generates updated blocks, widget updates in-place

### 4.5 Empty State (No Custom Widgets)

```
.--------------------------------------------.
| MY WIDGETS                        [+ Add]  |
|--------------------------------------------|
|                                            |
|     [sparkles icon, h-8 w-8]              |
|     No custom widgets yet                  |
|     Ask CAO to create a personalized       |
|     widget for your dashboard.             |
|                                            |
|     [+ Add your first widget]             |
|                                            |
'--------------------------------------------'
```

Uses existing `EmptyState` pattern but with `Sparkles` icon and contextual copy.

### 4.6 Responsive Grid

```
1 column:   < 768px (md)  -- all widgets stack vertically, spans ignored
2 columns:  768px-1024px   -- span capped at 2
4 columns:  > 1024px       -- full span support (1-4)
```

---

## 5. F3 -- Comment Thread Blocks

### 5.1 ContentRenderer Logic

The `<ContentRenderer>` component detects comment format:
- If `content_blocks` is present and valid: render with `<BlockRenderer>`
- If only `body` (TEXT): render with `<MarkdownBody>` (existing behavior)
- If both: render blocks first, then body below as secondary context

### 5.2 Block Comment Visual Treatment

Block comments get a distinct visual container to differentiate from plain markdown:

```
.-----------------------------------------------------------.
| [Agent Icon] Agent Name                    timestamp [copy]|
|-----------------------------------------------------------|
| .-------------------------------------------------------. |
| | [content_blocks rendered here via BlockRenderer]       | |
| | MetricCards, StatusBadges, forms, etc.                 | |
| '-------------------------------------------------------' |
|                                                           |
| [Feedback vote buttons]                                   |
| run xxxxxxxx                                              |
'-----------------------------------------------------------'
```

**The block area within the comment:**
```
Block area: rounded-md border border-border/50 bg-accent/10 p-3 space-y-3
            (subtle background tint to distinguish from markdown text)
```

**Key difference from plain comments:**
- Plain comments: `border p-3 rounded-sm` + `<MarkdownBody>`
- Block comments: same outer frame + inner block area with `bg-accent/10` tint

**Mixed content (body + blocks):**
- Blocks render first (main content)
- If `body` also exists: rendered below blocks with a thin separator, in `text-xs text-muted-foreground` as context/fallback

### 5.3 ActionButton in Comments

When an ActionButton is clicked in a comment:
1. Button enters loading state
2. Action handler posts the result as a new comment on the issue (via existing `onAdd`)
3. The new comment contains a StatusBadge showing the action result
4. Original ActionButton stays enabled (actions may be repeatable unless the agent sends a new comment)

### 5.4 QuickForm in Comments

```
.-----------------------------------------------------------.
| [Agent] CI/CD Agent                         2 min ago      |
|-----------------------------------------------------------|
| .-------------------------------------------------------. |
| | Deploy Review                                         | |
| | Review the deployment before proceeding.              | |
| |                                                       | |
| | Environment                                          | |
| | [Production           v]                              | |
| |                                                       | |
| | [x] Run smoke tests after deploy                      | |
| |                                                       | |
| |                              [Deploy]                 | |
| '-------------------------------------------------------' |
'-----------------------------------------------------------'
```

**After form submission:**
- Form is replaced by: `StatusBadge variant="success"` + "Submitted: Deploy to Production with smoke tests"
- A new comment is automatically posted with the form data (structured response for the agent)
- The submitted state persists (form does not re-appear on page refresh -- stored via `action_taken` or a local flag)

---

## 6. F4 -- Inbox Interactive

### 6.1 Inbox Item Card (Rich)

**Current pattern:** The inbox uses sections (failed_runs, approvals, stale_work, etc.) each with specialized card components. The new `inbox_items` table will introduce a unified card.

**New inbox item card design:**

```
.================================================================.
| [priority indicator]                                           |
| .------------------------------------------------------------. |
| | [StatusBadge: category]  Title of the notification    [x]  | |
| | Agent Name  ·  2 min ago                                   | |
| |                                                            | |
| | .--------------------------------------------------------. | |
| | | content_blocks rendered here                           | | |
| | | MetricCards, text, charts, etc.                        | | |
| | '--------------------------------------------------------' | |
| |                                                            | |
| | [Action Button 1]  [Action Button 2]  [Dismiss]          | |
| '------------------------------------------------------------' |
'================================================================'
```

**Tailwind classes:**
```
Outer:      group relative
Priority:   absolute left-0 top-0 bottom-0 w-1 rounded-l-lg
            low: bg-muted-foreground/20
            normal: bg-transparent (hidden)
            high: bg-warning
            urgent: bg-error animate-pulse
Card:       border border-border rounded-lg p-4 bg-card
            transition-all duration-200
Unread:     border-l-2 border-l-primary bg-primary/[0.02]
Read:       opacity-80
Actioned:   border-l-2 border-l-success/50 bg-success/[0.02]
Dismissed:  opacity-50 (or hidden)

Header:     flex items-start justify-between gap-3
Category:   StatusBadge (existing component) with category text
Title:      text-sm font-medium text-foreground line-clamp-1
Dismiss:    Button ghost icon-xs (X icon), opacity-0 group-hover:opacity-100
Meta:       text-xs text-muted-foreground flex items-center gap-1.5
            Agent identity (Identity component) + "·" + timeAgo

Block area: mt-3 rounded-md border border-border/30 bg-accent/5 p-3 space-y-3
            (only if content_blocks present)

Actions:    mt-3 pt-3 border-t border-border/50
            flex items-center gap-2 flex-wrap
            (ActionButtons from content_blocks, or inline action buttons)
```

### 6.2 Status Indicators

**Unread:**
- Left border: `border-l-2 border-l-primary`
- Subtle background: `bg-primary/[0.02]`
- Title: `font-semibold` (bolder)

**Read:**
- No left border highlight
- Standard opacity

**Actioned:**
- Left border: `border-l-2 border-l-success/50`
- Subtle green tint: `bg-success/[0.02]`
- Shows action result inline: `StatusBadge variant="success"` + action description

**Dismissed:**
- `opacity-50` briefly, then removed from list with exit animation

### 6.3 Priority Visual Treatment

| Priority | Left bar color | Sort weight | Extra |
|----------|----------------|-------------|-------|
| `low` | `bg-muted-foreground/20` (barely visible) | lowest | -- |
| `normal` | none | default | -- |
| `high` | `bg-warning` (amber) | elevated | -- |
| `urgent` | `bg-error` (red) | highest | `animate-pulse` on the bar |

### 6.4 Expand/Collapse for Long Content

If `content_blocks` renders taller than 200px:
- Initially collapsed to 200px with a gradient fade
- "Show more" button at the bottom: `text-xs text-primary hover:underline`
- Click expands to full height with `transition-all duration-300`

```
Collapsed:  max-h-[200px] overflow-hidden relative
Gradient:   after:absolute after:inset-x-0 after:bottom-0 after:h-12
            after:bg-gradient-to-t after:from-card after:to-transparent
Show more:  absolute bottom-2 left-1/2 -translate-x-1/2
            text-xs text-primary bg-card px-3 py-1 rounded-full
            border border-border shadow-sm hover:shadow-md
```

### 6.5 Inbox Page Integration

The existing Inbox page sections (failed_runs, approvals, stale_work, issues_i_touched) remain. A new section for `inbox_items` is added:

**Tab structure (enhanced):**
```
Tabs: [New] [All]

New tab:
  - Failed Runs section (existing FailedRunCard)
  - Alerts section (existing)
  - Approvals section (existing ApprovalCard)
  - ** Agent Notifications ** (NEW -- inbox_items with status="unread")
  - Issues I touched (existing)
  - Stale work (existing)

All tab:
  - Category filter dropdown (existing + new "notifications" category)
  - All sections visible
```

**The "Agent Notifications" section renders inbox_items:**
```
Section header:  flex items-center justify-between mb-3
Title:           text-sm font-medium text-foreground
Count badge:     Badge variant="secondary" text-xs -- "3 new"
```

Each item rendered as the rich inbox item card from 6.1.

### 6.6 Empty State

```
.--------------------------------------------.
|                                            |
|     [inbox icon, h-8 w-8]                 |
|     No notifications                       |
|     Your agents haven't sent any          |
|     notifications yet.                     |
|                                            |
'--------------------------------------------'
```

Uses `EmptyState` component with `Inbox` icon.

### 6.7 Action Result Feedback

When user clicks an ActionButton in an inbox item:

1. Button enters loading state (spinner)
2. `POST /inbox/:id/action` with action payload
3. On success:
   - Button briefly flashes green (200ms)
   - Item status updates to "actioned"
   - `action_taken` JSONB is set
   - Visual treatment changes to "actioned" state (green left border)
   - A small success line appears below the actions: `text-xs text-success` "Action completed: {action label}"
4. On error:
   - Toast with error message
   - Button returns to default state

---

## 7. Interaction Patterns

### 7.1 Confirmation Dialog for Destructive Actions

When an `ActionButton` has a `confirm` string:

```
.--------------------------------------------.
| Confirm Action                       [x]   |
|--------------------------------------------|
|                                            |
| {confirm text from ActionButton}           |
|                                            |
|                     [Cancel]  [Confirm]    |
'--------------------------------------------'
```

**Implementation:**
```tsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>{block.confirm}</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button
        variant={block.variant === "destructive" ? "destructive" : "default"}
        onClick={executeAction}
      >
        Confirm
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 7.2 Form Validation (QuickForm)

**Required fields:**
- On submit, check all `required: true` fields have values
- Invalid fields: `aria-invalid="true"` on the input (triggers built-in shadcn red ring)
- Error message below field: `text-xs text-destructive mt-1` "This field is required"

**Validation timing:** On submit only (not on blur). Keep it simple -- forms are 2-3 fields max.

### 7.3 Toast Notifications

**For action results:** Use a lightweight toast system (already available or use shadcn/ui Sonner pattern).

```
Success: green-tinted toast, auto-dismiss 3s
Error:   red-tinted toast, stays until dismissed
Info:    neutral toast, auto-dismiss 3s
```

**Toast positioning:** Bottom-right corner.

### 7.4 Loading States During API Calls

**ActionButton loading:**
```tsx
<Button disabled>
  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
  {label}...
</Button>
```

**QuickForm submitting:**
```tsx
// All inputs disabled, submit button loading
<Button disabled>
  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
  Submitting...
</Button>
```

**Widget loading (dashboard):**
```tsx
<div className="animate-pulse bg-muted rounded-lg min-h-[120px]" />
```
(Same as existing `WidgetSkeleton`)

### 7.5 Error States

**Block render error (invalid JSON):**
- Show a subtle error banner within the block area:
```
.----------------------------------------------.
| [AlertTriangle icon] Unable to render content |
| The content blocks could not be displayed.    |
| Falling back to text view.                    |
'----------------------------------------------'
```
```
Container: rounded-md border border-warning/30 bg-warning-bg/30 p-3
           flex items-start gap-2
Icon:      AlertTriangle h-4 w-4 text-warning shrink-0 mt-0.5
Text:      text-xs text-warning
```
Then fall back to `<MarkdownBody>` on the `body` field.

**API error on action:**
- Toast notification (see 7.3)
- Button returns to default state

### 7.6 Permission-Disabled States

When an `ActionButton` has a `permission` prop and the user lacks that permission:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span tabIndex={0}>
      <Button disabled variant={block.variant} size="sm">
        {icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}
        {label}
      </Button>
    </span>
  </TooltipTrigger>
  <TooltipContent>
    You don't have permission to perform this action.
  </TooltipContent>
</Tooltip>
```

Note: The `<span>` wrapper is needed because disabled buttons don't fire hover events for tooltips.

---

## 8. Accessibility

### 8.1 Keyboard Navigation

**All interactive blocks:**
- `ActionButton`: focusable, activates on `Enter`/`Space`
- `QuickForm`: standard form Tab navigation, submit on `Enter` in last field or button focus + `Enter`
- `Section` (collapsible): toggle via `Enter`/`Space` on the header (uses Collapsible trigger)

**DataTable:**
- No special keyboard nav needed (display-only)
- If rows are linkable in future: add `tabIndex={0}` and `onKeyDown` handler

### 8.2 ARIA Labels and Roles

```tsx
// MetricCard
<div role="group" aria-label={`${label}: ${value}`}>

// StatusBadge
<span role="status" aria-label={`Status: ${text}`}>

// ProgressBar
<div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>

// ActionButton
<button aria-label={label} aria-disabled={!hasPermission}>

// QuickForm
<form aria-label={title || "Quick form"}>
  <label htmlFor={field.name}>{field.label}</label>
  <input id={field.name} aria-required={field.required} />

// Section (collapsible)
<div role="group" aria-label={title}>
  <button aria-expanded={isOpen} aria-controls={contentId}>

// CodeBlock
<div role="group" aria-label={title || "Code block"}>
  <pre><code aria-label="Code content">

// Inbox item
<article aria-label={title} aria-live="polite">
  // status changes announce to screen readers
```

### 8.3 Focus Management

**QuickForm after submit:**
- Focus moves to the success message or first action button

**Confirmation Dialog:**
- Focus trapped inside dialog (handled by Radix Dialog)
- On close, focus returns to the triggering ActionButton

**Inbox item after action:**
- Focus stays on the item (no jump)
- `aria-live="polite"` region announces the status change

### 8.4 Screen Reader Considerations

**MetricCard:** Read as "Agents Enabled: 42, trend up"
**Chart:** Include `aria-label` with chart title + summary data. Charts are inherently visual -- provide a table fallback for screen readers via `sr-only` DataTable.
**ProgressBar:** Standard progressbar role, screen reader announces "{label}: {value}%"
**Divider:** `role="separator"` (default for `<hr>` / Separator)

### 8.5 Color Contrast

All semantic color tokens (success, warning, error, info) have been designed with WCAG AA contrast ratios against their respective backgrounds. The oklch values in `index.css` ensure:
- Text on colored backgrounds: minimum 4.5:1 ratio
- Large text / icons: minimum 3:1 ratio

---

## Appendix A: Component File Structure

```
ui/src/components/blocks/
  BlockRenderer.tsx          -- Main router: ContentBlock -> component
  ContentRenderer.tsx        -- Detects blocks vs markdown, routes accordingly
  useBlockActions.ts         -- Unified action handler hook
  blocks/
    MetricCardBlock.tsx      -- Wraps existing MetricCard pattern
    StatusBadgeBlock.tsx     -- Wraps shadcn Badge
    DataTableBlock.tsx       -- Custom table
    CodeBlockBlock.tsx       -- Pre/code with copy
    ProgressBarBlock.tsx     -- Custom progress bar
    MarkdownBlock.tsx        -- Wraps MarkdownBody
    ChartBlock.tsx           -- Recharts wrapper
    DividerBlock.tsx         -- Wraps Separator
    ActionButtonBlock.tsx    -- Wraps shadcn Button + action logic
    QuickFormBlock.tsx       -- Form with shadcn inputs
    StackBlock.tsx           -- Flex layout
    SectionBlock.tsx         -- Collapsible section
  iconMap.ts                 -- Lucide icon name -> component mapping
```

## Appendix B: Responsive Breakpoints Reference

| Breakpoint | Width | Dashboard cols | Widget behavior |
|------------|-------|----------------|-----------------|
| Default | <640px | 1 | All spans = 1, full width stack |
| `sm` | 640px | 1 | Minor padding adjustments |
| `md` | 768px | 4 | Full grid, spans respected |
| `lg` | 1024px | 4 | Wider cards, more padding |
| `xl` | 1280px | 4 | Max content width, comfortable |

## Appendix C: Animation Tokens

```css
/* New widget appears */
animate-in fade-in-0 slide-in-from-bottom-2 duration-300

/* Item dismissed */
animate-out fade-out-0 duration-200

/* Action success flash */
transition-colors duration-200  (bg -> bg-success/10 -> bg)

/* Collapsible expand */
Handled by Radix Collapsible default animation

/* Progress bar fill */
transition-all duration-500 ease-out
```

---

*Generated for the MnM Blocks Platform -- 4 features, 14 block components, 0 breaking changes.*
