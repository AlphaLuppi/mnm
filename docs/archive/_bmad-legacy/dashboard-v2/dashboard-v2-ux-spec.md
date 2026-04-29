# Dashboard V2 — UX/UI Specification

> Version: 1.0 | Date: 2026-04-07
> Scope: Unified grid, drag-and-drop, resize, add-widget dialog, responsive design

---

## 1. Grid Layout

### 1.1 Grid Structure

The dashboard uses a single unified grid powered by `react-grid-layout`. No more split between "predefined" and "custom" widget sections — all widgets live in one flat grid.

```
+-------------------------------------------------------+
| Dashboard Header (Live indicator, Add Widget button)   |
+-------------------------------------------------------+
| [Widget 1: span 4]                                     |
+-------------------------------------------------------+
| [Widget 2: span 2]     | [Widget 3: span 1] | [W4: 1] |
+-------------------------------------------------------+
| [Widget 5: span 2]     | [Widget 6: span 2]           |
+-------------------------------------------------------+
```

### 1.2 Grid Configuration

| Property           | Value                                      |
|--------------------|--------------------------------------------|
| Columns (desktop)  | 4                                          |
| Column gap         | `16px` (`gap-4`)                           |
| Row gap            | `16px` (`gap-4`)                           |
| Row height         | `140px` base unit                          |
| Container padding  | `0` (inherits page padding)               |
| Min widget width   | 1 column                                   |
| Max widget width   | 4 columns                                  |
| Min widget height  | 1 row (140px)                              |
| Max widget height  | 6 rows (840px)                             |

### 1.3 Grid Background During Drag/Resize

When a user initiates a drag or resize, the grid reveals a subtle background guide:

- **Grid cells**: Faint dashed borders appear on the column/row grid using `border-dashed border-border/20`
- **Valid drop zone**: Highlighted with `bg-primary/5 border-primary/30 border-dashed` on the target cell(s)
- **Invalid zone**: No highlight (widgets cannot overlap)
- Background guide disappears immediately when drag/resize ends

```
During drag:
+- - - - -+- - - - -+- - - - -+- - - - -+
:         :         : /////// : /////// :  <-- target cells highlighted
+- - - - -+- - - - -+/////////+/////////+
:         :         :         :         :
+- - - - -+- - - - -+- - - - -+- - - - -+
```

---

## 2. Widget Card Design

### 2.1 Component Hierarchy

```
<DashboardGridV2>                          -- react-grid-layout wrapper
  <WidgetCard>                             -- unified card wrapper (all widget types)
    <WidgetCardHeader>                     -- drag handle + title + actions
      <GripVertical />                     -- drag handle icon (left)
      <CardTitle />                        -- widget title (center, truncated)
      <WidgetActions />                    -- dropdown menu (right)
    </WidgetCardHeader>
    <WidgetCardContent>                    -- content area
      <Suspense fallback={<Skeleton />}>
        <WidgetComponent />                -- actual widget (preset or custom)
      </Suspense>
    </WidgetCardContent>
  </WidgetCard>
</DashboardGridV2>
```

### 2.2 Card Wrapper

Every widget — whether from the preset registry (`WIDGET_REGISTRY`) or user-generated (custom/CAO) — is wrapped in a unified `WidgetCard`. This replaces the current divergence between bare preset rendering and `CustomWidgetCard`.

**Tailwind classes for the card wrapper:**

```
rounded-lg border border-border bg-card shadow-sm overflow-hidden
transition-shadow duration-150
```

This aligns with the existing shadcn `Card` component (`ui/src/components/ui/card.tsx`). Use `Card`, `CardHeader`, `CardContent` as the base, with custom slots for drag handle and actions.

### 2.3 Card Header

The header is always visible and contains three zones:

```
+---[=]---[Widget Title]----------------[...]---+
  drag     title (truncated)              actions
  handle                                  menu
```

| Zone         | Component                   | Tailwind Classes                                          |
|--------------|-----------------------------|-----------------------------------------------------------|
| Drag handle  | `GripVertical` (lucide)     | `h-4 w-4 text-muted-foreground/50 cursor-grab`           |
| Title        | `<CardTitle>`               | `text-sm font-medium text-foreground truncate flex-1`     |
| Actions menu | `<DropdownMenu>` (shadcn)   | Triggered by `MoreHorizontal` icon button                 |

**Header container:**
```
flex items-center gap-2 px-3 py-2.5 border-b border-border/50
```

**Actions dropdown menu items:**
- "Configure" (Wrench icon) — opens widget-specific settings (future)
- "Resize" submenu — Span 1, Span 2, Span 3, Span 4 (current span shown bold)
- Separator
- "Delete" (Trash2 icon, `text-destructive`) — opens confirm dialog

Use existing `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuSeparator` from `ui/src/components/ui/dropdown-menu.tsx`.

### 2.4 Card Content Area

```
<CardContent className="p-4 overflow-hidden">
  {children}
</CardContent>
```

For widgets with content taller than the card height, use `ScrollArea` from `ui/src/components/ui/scroll-area.tsx` inside the content area. The scroll container uses `max-h-full overflow-auto`.

### 2.5 Card States

| State       | Visual Treatment                                                               |
|-------------|--------------------------------------------------------------------------------|
| **Default** | `border-border bg-card shadow-sm`. Drag handle and actions menu are at reduced opacity (`opacity-0`). |
| **Hover**   | Drag handle and actions menu fade in (`opacity-100` transition). Card gets `shadow-md` on hover. Border remains unchanged. |
| **Focus**   | `ring-2 ring-ring ring-offset-2 ring-offset-background` (keyboard navigation). |
| **Dragging**| Card gets `shadow-xl opacity-80 z-50`. A dashed placeholder outline (`border-2 border-dashed border-primary/30 bg-primary/5 rounded-lg`) appears in the original position. |
| **Resizing**| Card border changes to `border-primary/50`. Resize handle pulses subtly. Dimensions overlay appears (e.g., "2x1"). |
| **Loading** | Content area shows `Skeleton` component (`ui/src/components/ui/skeleton.tsx`). Header remains visible and interactive. |
| **Error**   | Content area shows inline error: red `AlertCircle` icon + message `text-xs text-destructive`. Retry button optional. |

**Hover reveal for handles (CSS):**
```css
/* On card hover, reveal drag handle + actions */
.widget-card:hover .widget-handle,
.widget-card:hover .widget-actions {
  opacity: 1;
}

/* Tailwind equivalent on the handle/actions elements: */
opacity-0 group-hover/widget:opacity-100 transition-opacity duration-150
```

The card itself uses `group/widget` so children can reference `group-hover/widget`.

---

## 3. Drag & Drop

### 3.1 Drag Handle

| Property         | Value                                                      |
|------------------|------------------------------------------------------------|
| Icon             | `GripVertical` from lucide-react                           |
| Position         | Left side of widget header                                 |
| Size             | `h-4 w-4`                                                 |
| Cursor           | `cursor-grab` (default), `cursor-grabbing` (while dragging)|
| Visibility       | Hidden by default (`opacity-0`), shown on card hover       |
| Touch            | 44px minimum tap target (padded area)                      |

### 3.2 Drag Visual Feedback

**Dragged widget:**
- Elevation rises: `shadow-xl`
- Slight transparency: `opacity-80`
- Rotation hint: `rotate-1` (1 degree clockwise) for a natural "picked up" feel
- Z-index lifted above all other widgets: `z-50`

**Placeholder (original position):**
- Dashed outline: `border-2 border-dashed border-primary/30 rounded-lg`
- Subtle fill: `bg-primary/5`
- Matches exact dimensions of the dragged widget
- Smooth size transitions as the placeholder moves to new positions

**Other widgets:**
- Widgets that shift to accommodate the dragged widget animate smoothly via `transition-transform duration-200 ease-out`
- No opacity change on other widgets (keeps dashboard readable during drag)

### 3.3 Drop Target Indicators

When the dragged widget hovers over a valid position:
- The placeholder snaps to the nearest valid grid position
- `react-grid-layout` handles collision detection natively
- No explicit "drop target" highlight beyond the moving placeholder

### 3.4 Snap-to-Grid

- All positions snap to column boundaries (1/4 increments)
- Heights snap to row increments (140px units)
- `react-grid-layout` provides `compactType="vertical"` to automatically collapse empty spaces
- Animation on drop: `transition-all duration-300 ease-out` as the widget settles into its final position

---

## 4. Resize

### 4.1 Resize Handle

| Property   | Value                                                                  |
|------------|------------------------------------------------------------------------|
| Position   | Bottom-right corner of the widget card                                 |
| Icon       | Custom SVG grip dots (3x2 dot grid) — standard react-grid-layout style |
| Size       | `14px x 14px`                                                          |
| Color      | `text-muted-foreground/30` default, `text-muted-foreground/70` on hover|
| Cursor     | `cursor-se-resize`                                                     |
| Visibility | Hidden by default, shown on card hover (same pattern as drag handle)   |

**Tailwind for resize handle:**
```
absolute bottom-1 right-1 opacity-0 group-hover/widget:opacity-100
transition-opacity duration-150 cursor-se-resize text-muted-foreground/30
hover:text-muted-foreground/70
```

### 4.2 Resize Visual Feedback

During resize:
- Widget border changes to `border-primary/50`
- A small overlay badge appears near the resize handle showing current dimensions: `"{cols}x{rows}"` in `text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md`
- The grid background guide activates (same as during drag — dashed cell outlines)

### 4.3 Size Constraints

| Widget Type      | Min Width | Max Width | Min Height | Max Height |
|------------------|-----------|-----------|------------|------------|
| KPI / Metric     | 1 col     | 4 cols    | 1 row      | 2 rows     |
| Chart            | 1 col     | 4 cols    | 2 rows     | 4 rows     |
| Table / List     | 2 cols    | 4 cols    | 2 rows     | 6 rows     |
| Custom (CAO)     | 1 col     | 4 cols    | 1 row      | 6 rows     |
| KPI Bar (full)   | 4 cols    | 4 cols    | 1 row      | 2 rows     |

These constraints are enforced via react-grid-layout's `minW`, `maxW`, `minH`, `maxH` per layout item.

### 4.4 Height Behavior

- **Default**: Widget height is driven by content (`autoSize: true` where supported). react-grid-layout snaps to the nearest row unit.
- **Fixed-height widgets** (charts, tables): Content area uses `ScrollArea` when content exceeds the allocated height.
- **Auto-height widgets** (KPIs, metric cards): Expand naturally, grid row allocation adjusts.

---

## 5. Add Widget Dialog

### 5.1 Trigger

- **Button**: `"+"` icon with `"Add Widget"` label in the dashboard header area
- **Position**: Right side of the dashboard header, next to the Live indicator line
- **Component**: `Button` (shadcn) with `variant="outline"` and `size="sm"`
- **Icon**: `Plus` from lucide-react, `mr-1.5 h-3.5 w-3.5`

```
+-- Dashboard Header ----------------------------------------+
| [*] Live  Last updated 2m ago            [+ Add Widget]    |
+------------------------------------------------------------+
```

### 5.2 Dialog Structure

Uses `Dialog` and `DialogContent` from shadcn (`ui/src/components/ui/dialog.tsx`). Max width: `sm:max-w-[560px]`.

```
+--[ Add Widget ]------------------------------------------+
|                                                          |
|  [Gallery]  [Create with AI]         <-- Tabs            |
|                                                          |
|  +----------------------------------------------------+  |
|  |  Tab content area                                  |  |
|  +----------------------------------------------------+  |
|                                                          |
+----------------------------------------------------------+
```

Uses `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `ui/src/components/ui/tabs.tsx`.

### 5.3 Gallery Tab

Displays all available widgets from `WIDGET_REGISTRY` plus any saved custom templates.

**Layout**: 2-column grid of widget preview cards.

```
+--[ Gallery ]---------------------------------------------+
|                                                          |
|  +----------------------+  +----------------------+      |
|  | [icon]               |  | [icon]               |     |
|  | KPI Bar              |  | Run Activity         |     |
|  | Full-width KPIs      |  | Recent run timeline  |     |
|  | Default: 4 cols      |  | Default: 1 col       |     |
|  | [ Add ]              |  | [ Add ]              |     |
|  +----------------------+  +----------------------+      |
|                                                          |
|  +----------------------+  +----------------------+      |
|  | [icon]               |  | [icon]               |     |
|  | Issues by Status     |  | Active Agents        |     |
|  | Status distribution  |  | Currently running    |     |
|  | Default: 1 col       |  | Default: 2 cols      |     |
|  | [ Add ]              |  | [ Add ]              |     |
|  +----------------------+  +----------------------+      |
+----------------------------------------------------------+
```

**Widget preview card:**
```
rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-accent/30
transition-all cursor-pointer space-y-2
```

Each card shows:
- Widget icon (from a mapping per widget type, or `Package` as fallback) — `h-5 w-5 text-muted-foreground`
- Widget name — `text-sm font-medium text-foreground`
- Description — `text-xs text-muted-foreground line-clamp-2`
- Default size — `text-xs text-muted-foreground/60` (e.g., "4 columns" or "2 columns")
- **Add button**: `Button` variant `outline` size `sm`, full width at bottom of card

**Size override**: Before adding, user can optionally change span via a small `Select` dropdown (1-4) next to the Add button. Defaults to the widget's `defaultSpan` from the registry.

### 5.4 Create with AI Tab (CAO)

```
+--[ Create with AI ]--------------------------------------+
|                                                          |
|  Describe the widget you want CAO to create:             |
|                                                          |
|  +----------------------------------------------------+  |
|  | e.g., Show me a burn-down chart for issues          |  |
|  | tagged "backend" over the last 30 days...           |  |
|  +----------------------------------------------------+  |
|                                                          |
|  Suggested prompts:                                      |
|  [Issue burn-down] [Agent cost breakdown] [Sprint vel.]  |
|                                                          |
|  Size: [1] [2] [3] [4]      <-- toggle group             |
|                                                          |
|                                  [Generate Widget]       |
|                                                          |
|  +- - - - - - - - - - - - - - - - - - - - - - - - - -+  |
|  : Widget preview area (appears after generation)     :  |
|  : Shows rendered ContentRenderer output              :  |
|  : [Add to Dashboard]  [Regenerate]                   :  |
|  +- - - - - - - - - - - - - - - - - - - - - - - - - -+  |
+----------------------------------------------------------+
```

**Components used:**
- `Textarea` (shadcn) — 3 rows, for prompt input
- Suggestion chips — `Button` variant `outline` size `sm` with rounded-full styling: `rounded-full text-xs`
- Size selector — group of 4 small buttons (1-4), active one uses `variant="default"`, others `variant="outline"`
- Generate button — `Button` variant `default` size `sm`, disabled when prompt is empty or generating
- Preview — bordered area using same `ContentRenderer` pattern as existing custom widgets
- Post-generation buttons: "Add to Dashboard" (`variant="default"`), "Regenerate" (`variant="outline"`)

**Loading state during generation:**
- Generate button shows spinner + "CAO is generating..."
- Preview area shows `Skeleton` blocks

**Error state:**
- `text-xs text-destructive` message below the textarea
- Prompt remains editable for retry

### 5.5 Dialog Behavior

- Closes on successful widget addition
- Closes on backdrop click or Escape
- Preserves CAO prompt text if user switches tabs within the dialog
- Clears state fully when dialog closes

---

## 6. Responsive Design

### 6.1 Breakpoint Layout

| Breakpoint        | Columns | Behavior                                    |
|-------------------|---------|---------------------------------------------|
| Desktop (>=1024px)| 4       | Full grid, drag + resize enabled             |
| Tablet (768-1023) | 2       | Widgets reflow to 2 columns, drag enabled, resize disabled |
| Mobile (<768px)   | 1       | Single column stack, drag + resize disabled  |

### 6.2 react-grid-layout Responsive Configuration

```typescript
const breakpoints = { lg: 1024, md: 768, sm: 0 };
const cols = { lg: 4, md: 2, sm: 1 };
```

### 6.3 Widget Adaptation per Breakpoint

**Desktop (lg):**
- Widgets render at their configured span (1-4 columns)
- Drag handles and resize handles visible on hover
- Full actions menu

**Tablet (md):**
- Widgets wider than 2 columns are clamped to 2 columns
- Drag handles visible on hover (drag still works for reordering)
- Resize handles hidden (resize disabled)
- Actions menu still available (resize submenu hidden)

**Mobile (sm):**
- All widgets stack vertically at full width (1 column)
- Drag handles hidden, drag disabled
- Resize handles hidden, resize disabled
- Actions menu: only "Delete" and "Configure" shown
- Widget cards become full-bleed (no horizontal padding on container)
- Widget order follows the layout `y` coordinate (top to bottom)

### 6.4 Widget Content Responsive Behavior

Individual widgets should adapt internally:
- `KpiBar`: On mobile, its internal `grid-cols-5` becomes `grid-cols-2` then `grid-cols-1` (already handled via existing responsive classes)
- Chart widgets: Maintain aspect ratio, scale down via container query or percentage widths
- Table/list widgets: Horizontal scroll on narrow containers via `ScrollArea`

---

## 7. Empty States

### 7.1 New User — No Widgets at All

Shown when the layout has zero widgets (both preset and custom).

```
+----------------------------------------------------------+
|                                                          |
|           [LayoutDashboard icon, h-12 w-12]              |
|           text-muted-foreground/40                        |
|                                                          |
|        Your dashboard is empty                           |
|        text-lg font-medium text-foreground               |
|                                                          |
|        Add widgets to monitor your agents,               |
|        track issues, and stay on top of costs.           |
|        text-sm text-muted-foreground                     |
|                                                          |
|              [+ Add Your First Widget]                   |
|              Button variant="default"                    |
|                                                          |
+----------------------------------------------------------+
```

**Container styling:**
```
flex flex-col items-center justify-center rounded-lg border-2 border-dashed
border-border py-16 text-center bg-card/50
```

### 7.2 All Widgets Deleted

Shown when the user had widgets and deleted them all.

```
+----------------------------------------------------------+
|                                                          |
|              [Sparkles icon, h-10 w-10]                  |
|              text-muted-foreground/40                     |
|                                                          |
|        No widgets on your dashboard                      |
|        text-sm font-medium text-foreground               |
|                                                          |
|        Add a preset widget or ask CAO to create          |
|        something custom for you.                         |
|        text-xs text-muted-foreground                     |
|                                                          |
|              [+ Add Widget]                              |
|              Button variant="outline" size="sm"          |
|                                                          |
+----------------------------------------------------------+
```

**Container styling:**
```
flex flex-col items-center justify-center rounded-lg border border-dashed
border-border py-10 text-center
```

This is visually lighter than the first-time empty state to convey "you've been here before."

---

## 8. Accessibility

### 8.1 Keyboard Navigation

| Key                   | Action                                                    |
|-----------------------|-----------------------------------------------------------|
| `Tab`                 | Move focus between widgets (in DOM order = layout order)  |
| `Enter` / `Space`     | Open actions menu on focused widget                       |
| `Escape`              | Close any open menu or dialog                             |
| `Arrow keys`          | Within actions menu: navigate items                       |
| `Alt + Arrow keys`    | Move focused widget in grid (up/down/left/right)          |
| `Alt + Shift + Arrow` | Resize focused widget (right = wider, down = taller)      |

### 8.2 Focus Indicators

- All interactive elements use the existing shadcn focus ring: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- The widget card itself is focusable (`tabIndex={0}`) and receives the ring on focus
- Drag handle has its own focus ring when tabbed to directly

### 8.3 Screen Reader Support

**Widget card:**
```html
<div role="article" aria-label="Widget: {title}" aria-roledescription="dashboard widget">
```

**Drag handle:**
```html
<button aria-label="Drag to reorder {title}" aria-roledescription="drag handle">
```

**Resize handle:**
```html
<div role="separator" aria-label="Resize {title}" aria-orientation="both"
     aria-valuenow="{currentCols}" aria-valuemin="{minCols}" aria-valuemax="{maxCols}">
```

**Live region for state changes:**
```html
<div aria-live="polite" className="sr-only">
  <!-- Announced on drop: "Widget {title} moved to row {y}, column {x}" -->
  <!-- Announced on resize: "Widget {title} resized to {cols} columns, {rows} rows" -->
</div>
```

### 8.4 Aria Labels on Interactive Elements

| Element                | aria-label                                       |
|------------------------|--------------------------------------------------|
| Add Widget button      | `"Add a new widget to the dashboard"`            |
| Actions menu trigger   | `"Widget actions for {title}"`                   |
| Delete menu item       | `"Delete widget {title}"`                        |
| Resize submenu         | `"Resize widget {title}"`                        |
| Gallery tab            | `"Browse preset widgets"`                        |
| Create with AI tab     | `"Create a custom widget with AI"`               |
| Size selector buttons  | `"Set widget width to {n} column(s)"`            |

---

## 9. Design Tokens & Consistency

### 9.1 Colors (from existing theme)

All colors reference CSS custom properties defined in `ui/src/index.css`:

| Usage                  | Token                          | Tailwind Class                   |
|------------------------|--------------------------------|----------------------------------|
| Card background        | `--card`                       | `bg-card`                        |
| Card text              | `--card-foreground`            | `text-card-foreground`           |
| Card border            | `--border`                     | `border-border`                  |
| Primary accent         | `--primary`                    | `bg-primary`, `text-primary`     |
| Muted text             | `--muted-foreground`           | `text-muted-foreground`          |
| Destructive            | `--destructive`                | `text-destructive`               |
| Focus ring             | `--ring`                       | `ring-ring`                      |
| Drag placeholder fill  | `--primary` at 5% opacity     | `bg-primary/5`                   |
| Drag placeholder border| `--primary` at 30% opacity    | `border-primary/30`              |
| Grid guide lines       | `--border` at 20% opacity     | `border-border/20`               |
| Success states          | `--success`                   | `text-success`                   |
| Error states            | `--error`                     | `text-error`                     |

### 9.2 Spacing

Consistent with existing app spacing patterns observed in `MetricCard`, `DashboardGrid`, and `EmptyState`:

| Context                | Value     | Tailwind    |
|------------------------|-----------|-------------|
| Grid gap               | `16px`    | `gap-4`     |
| Card outer padding     | `0`       | (border-based separation) |
| Card header padding    | `12px H / 10px V` | `px-3 py-2.5` |
| Card content padding   | `16px`    | `p-4`       |
| Section spacing        | `24px`    | `space-y-6` |
| Icon-to-text gap       | `8px`     | `gap-2`     |
| Button icon margin     | `6px`     | `mr-1.5`    |

### 9.3 Border Radius

Following the theme (`--radius: 0.375rem`):

| Element            | Value        | Tailwind      |
|--------------------|--------------|---------------|
| Widget card        | `0.5rem`     | `rounded-lg`  |
| Buttons            | Theme radius | (handled by shadcn Button) |
| Dialog             | `0.75rem`    | `rounded-xl`  |
| Badge / chip       | `9999px`     | `rounded-full`|
| Inner containers   | `0.375rem`   | `rounded-md`  |

### 9.4 Shadows

| State             | Tailwind Class     |
|-------------------|--------------------|
| Card default      | `shadow-sm`        |
| Card hover        | `shadow-md`        |
| Card dragging     | `shadow-xl`        |
| Dialog            | `shadow-lg`        |
| Dropdown menu     | (shadcn default)   |

### 9.5 Typography

Following existing patterns (Inter font, weights from 400-700):

| Element                        | Tailwind Classes                                    |
|--------------------------------|-----------------------------------------------------|
| Widget title                   | `text-sm font-medium text-foreground`               |
| Widget description             | `text-xs text-muted-foreground`                     |
| Section heading (if any)       | `text-sm font-medium text-muted-foreground uppercase tracking-wider` |
| Empty state heading            | `text-lg font-medium text-foreground`               |
| Empty state description        | `text-sm text-muted-foreground`                     |
| Resize dimension overlay       | `text-xs font-medium bg-primary text-primary-foreground` |
| Dialog title                   | (shadcn `DialogTitle` default)                      |

### 9.6 Transitions & Animations

| Interaction        | Transition                                           |
|--------------------|------------------------------------------------------|
| Hover effects      | `transition-all duration-150`                        |
| Handle reveal      | `transition-opacity duration-150`                    |
| Widget movement    | `transition-transform duration-200 ease-out`         |
| Drop settle        | `transition-all duration-300 ease-out`               |
| Skeleton pulse     | `animate-pulse` (existing Tailwind animation)        |
| Dialog open/close  | (shadcn Dialog default animations)                   |

---

## 10. Component Reference — shadcn/ui Components Used

| Component          | File                                      | Usage                            |
|--------------------|-------------------------------------------|----------------------------------|
| `Card` family      | `ui/src/components/ui/card.tsx`           | Widget card wrapper              |
| `Button`           | `ui/src/components/ui/button.tsx`         | Add widget, actions, CTA         |
| `Dialog` family    | `ui/src/components/ui/dialog.tsx`         | Add widget dialog, delete confirm|
| `DropdownMenu`     | `ui/src/components/ui/dropdown-menu.tsx`  | Widget actions menu              |
| `Tabs` family      | `ui/src/components/ui/tabs.tsx`           | Gallery / Create with AI tabs    |
| `Textarea`         | `ui/src/components/ui/textarea.tsx`       | CAO prompt input                 |
| `Select`           | `ui/src/components/ui/select.tsx`         | Size selector in gallery         |
| `ScrollArea`       | `ui/src/components/ui/scroll-area.tsx`    | Overflow content in widgets      |
| `Skeleton`         | `ui/src/components/ui/skeleton.tsx`       | Loading states                   |
| `Tooltip`          | `ui/src/components/ui/tooltip.tsx`        | Handle/button descriptions       |
| `Separator`        | `ui/src/components/ui/separator.tsx`      | Visual dividers                  |

**Lucide icons used:**
`GripVertical`, `MoreHorizontal`, `Plus`, `Trash2`, `Maximize2`, `Wrench`, `Sparkles`, `LayoutDashboard`, `Package`, `AlertCircle`

---

## 11. Migration Notes

### 11.1 What Changes from V1

| Aspect              | V1 (current)                               | V2 (target)                                  |
|---------------------|---------------------------------------------|-----------------------------------------------|
| Grid engine         | CSS Grid (`grid-cols-4`)                   | `react-grid-layout` (draggable/resizable)     |
| Widget sections     | 2 sections (preset + custom)               | 1 unified grid                                |
| Widget wrapper      | Divergent (bare vs. CustomWidgetCard)      | Single `WidgetCard` for all types             |
| Resize              | Dropdown menu only (span 1-4)             | Visual resize handles + dropdown fallback     |
| Reorder             | Not possible                               | Drag-and-drop                                 |
| Add widget          | "My Widgets" section button                | Dashboard header button, unified dialog       |
| Layout persistence  | Server-side per view preset                | Server-side per user (position + size)        |

### 11.2 Data Model Impact

Each widget's layout position needs to be stored. The `user_widgets` and `dashboard_widgets` tables need `x`, `y`, `w`, `h` columns (or a `layout` JSONB field) to persist react-grid-layout positions.

### 11.3 Backward Compatibility

- Existing view presets continue to work — their widgets gain default grid positions computed by react-grid-layout's auto-placement
- Existing custom widgets are migrated into the unified grid with their current `span` mapped to `w` and auto-assigned `y` positions
