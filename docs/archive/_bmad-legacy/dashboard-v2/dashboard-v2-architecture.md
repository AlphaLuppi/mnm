# Dashboard V2 Architecture Blueprint

**Date**: 2026-04-07
**Author**: System Architect Agent
**Status**: DRAFT — Pending Review

---

## Section 1: WebSocket Tag-Based Filtering

### 1.1 Problem Statement

The current WebSocket live-events system broadcasts ALL events to ALL connected users within a company. This violates the tag-based isolation model: a user with tag "marketing" receives events about agents tagged "engineering". The `publishLiveEvent` function accepts only `{companyId, type, payload}` with no visibility metadata, and the WS handler in `live-events-ws.ts` forwards every event to every socket for that company.

### 1.2 Current State Analysis

**`packages/shared/src/types/live.ts`** — LiveEvent type:
```ts
interface LiveEvent {
  id: number;
  companyId: string;
  type: LiveEventType;
  createdAt: string;
  payload: Record<string, unknown>;
}
```

**`server/src/services/live-events.ts`** — Event bus:
- `publishLiveEvent({companyId, type, payload})` — emits on EventEmitter keyed by companyId
- `subscribeCompanyLiveEvents(companyId, listener)` — subscribes to ALL events for a company
- `subscribeAllLiveEvents(listener)` — global listener (used by dashboard-refresh debouncer)

**`server/src/realtime/live-events-ws.ts`** — WebSocket server:
- `authorizeUpgrade()` resolves `UpgradeContext {companyId, actorType: "board"|"agent", actorId}`
- On connection: `subscribeCompanyLiveEvents(context.companyId, (event) => socket.send(...))`
- No filtering whatsoever — every event goes to every socket

**`server/src/middleware/tag-scope.ts`** — TagScope (existing infrastructure):
```ts
interface TagScope {
  readonly __brand: "TagScope";
  readonly userId: string;
  readonly companyId: string;
  readonly tagIds: ReadonlySet<string>;
  readonly bypassTagFilter: boolean;
}
```
- Created by middleware for HTTP requests
- Uses `accessService.getTagIds()` (cached 5 min) and `accessService.resolveRole()` for bypass

### 1.3 Call Site Inventory

Total: **~50 publishLiveEvent call sites** across 25+ files. Grouped by visibility pattern:

#### Group A: Agent-Scoped Events (tag-filtered via agent's tags)

These events relate to a specific agent. Visibility = users who share at least 1 tag with the agent.

| File | Event Type(s) | Tag Source |
|------|---------------|------------|
| `heartbeat.ts` (9 calls) | `heartbeat.run.queued`, `heartbeat.run.status`, `heartbeat.run.event`, `heartbeat.run.log`, `heartbeat.run.completed`, `heartbeat.issue_created`, `heartbeat.issue_updated` | `agentId` in payload — look up agent's tags |
| `bronze-trace-capture.ts` (5 calls) | `trace.created`, `trace.observation_created`, `trace.observation_completed`, `trace.completed` | `opts.agentId` / `state.agentId` — agent's tags |
| `trace-service.ts` (4 calls) | `trace.created`, `trace.completed` | `agentId` field on trace |
| `orchestrator.ts` (2 calls) | `orchestrator.*` | Agent ID from orchestration context |
| `compaction-watcher.ts` (4 calls) | `compaction.detected`, `compaction.snapshot_created`, `compaction.watching_started`, `compaction.watching_stopped` | Agent being watched |
| `compaction-reinjection.ts` (2 calls) | `compaction.*` | Agent being compacted |
| `compaction-kill-relaunch.ts` (2 calls) | `compaction.*` | Agent being relaunched |
| `cursor-enforcement.ts` (2 calls) | `cursor.*` | Agent cursor belongs to |
| `mcp-connectors.ts` (5 calls) | `a2a.mcp_connector_changed` | Agent owning the connector |
| `workflow-enforcer.ts` (3 calls) | `workflow.*` | Agent executing workflow |
| `hitl-validation.ts` (3 calls) | `hitl.*` | Agent requesting validation |
| `routines.ts` (7 calls) | `routine.created`, `routine.updated`, `routine.run_created`, `routine.run_completed` | Agent executing routine |

#### Group B: Chat-Scoped Events (channel membership / actor-scoped)

Chat events are visible to participants of the channel. Since chat channels are tied to agents, visibility follows agent tag rules.

| File | Event Type(s) | Tag Source |
|------|---------------|------------|
| `chat.ts` (3 calls) | `chat.channel_created`, `chat.channel_closed`, `chat.message_sent` | `agentId` on channel |
| `routes/chat.ts` (2 calls) | `chat.message_sent` (edit/delete) | `agentId` on channel |
| `chat-sharing.ts` (2 calls) | `chat.shared`, `chat.forked` | Channel's agent |
| `chat-context-link.ts` (1 call) | `chat.context_linked` | Channel's agent |

#### Group C: Company-Wide Events (no filtering)

These events are relevant to ALL users in the company regardless of tags.

| File | Event Type(s) | Reason |
|------|---------------|--------|
| `audit.ts` | `audit.event_created` | Audit trail is company-wide (permission-gated at API level) |
| `activity-log.ts` | `activity.logged` | General activity, already coarse |
| `dashboard-refresh.ts` | `dashboard.refresh` | Debounced trigger for dashboard reload — company-wide |
| `workspace-context.ts` (2 calls) | `activity.logged` | Import events — company-wide |
| `workflows.ts` (3 calls) | `workflow.created`, `workflow.updated`, `workflow.deleted` | Workflow definitions are company-wide config |
| `stages.ts` | `stage.transitioned` | Stage transitions are workflow config |

#### Group D: User/Artifact-Scoped Events (actor-only or owner-scoped)

| File | Event Type(s) | Visibility |
|------|---------------|------------|
| `artifact.ts` (3 calls) | `artifact.created`, `artifact.updated`, `artifact.deleted` | Agent-scoped (artifact belongs to agent) |
| `document.ts` / `document-ingestion.ts` (4 calls) | `document.uploaded`, `document.ingestion_complete`, `document.ingestion_error` | Agent-scoped (document belongs to channel/agent) |
| `folder.ts` (3 calls) | `folder.created`, `folder.updated`, `folder.deleted` | Owner-scoped (folder belongs to user) |
| `feedback.ts` (2 calls) | `feedback.updated` | Agent-scoped (feedback on agent runs) |
| `drift-monitor.ts` (4 calls) | `drift.*` | Project-scoped — company-wide (project visibility TBD) |

### 1.4 Proposed Design

#### 1.4.1 Visibility Model

Add a `visibility` field to the event publication input:

```ts
// packages/shared/src/types/live.ts

export type EventVisibility =
  | { scope: "company-wide" }                           // everyone in company
  | { scope: "tag-filtered"; tagIds: string[] }         // users sharing >= 1 tag
  | { scope: "actor-only"; actorId: string }            // single user only
  | { scope: "agents"; agentIds: string[] };            // users who can see these agents

export interface LiveEvent {
  id: number;
  companyId: string;
  type: LiveEventType;
  createdAt: string;
  payload: Record<string, unknown>;
  visibility: EventVisibility;  // NEW
}
```

**Why `agents` scope?** Most events are agent-scoped. Rather than pre-resolving agent tags at publish time (which adds a DB query at every publish), we store `agentIds` and resolve at the WS filter layer. The WS handler already has the user's tags cached — it just needs to check if any of the event's agent's tags overlap.

#### 1.4.2 Publisher Changes — `live-events.ts`

```ts
// server/src/services/live-events.ts

export function publishLiveEvent(input: {
  companyId: string;
  type: LiveEventType;
  payload?: LiveEventPayload;
  visibility?: EventVisibility;  // NEW — defaults to company-wide
}) {
  const event = toLiveEvent(input);
  emitter.emit(input.companyId, event);
  for (const listener of globalListeners) {
    listener(event);
  }
  return event;
}

function toLiveEvent(input: {
  companyId: string;
  type: LiveEventType;
  payload?: LiveEventPayload;
  visibility?: EventVisibility;
}): LiveEvent {
  nextEventId += 1;
  return {
    id: nextEventId,
    companyId: input.companyId,
    type: input.type,
    createdAt: new Date().toISOString(),
    payload: input.payload ?? {},
    visibility: input.visibility ?? { scope: "company-wide" },
  };
}
```

**Migration strategy**: The `visibility` parameter is optional with a default of `company-wide`. This means ALL existing call sites continue to work unchanged. We migrate call sites incrementally — each one is a small, independent change.

#### 1.4.3 WebSocket Actor Context — `live-events-ws.ts`

At WS handshake, load the connecting user's tags and cache them in the connection closure:

```ts
// server/src/realtime/live-events-ws.ts

interface WsActorContext {
  companyId: string;
  actorType: "board" | "agent";
  actorId: string;
  // NEW: tag-based filtering context
  tagIds: ReadonlySet<string>;
  bypassTagFilter: boolean;
  // Cache of agent visibility: agentId -> boolean (lazy-populated)
  agentVisibilityCache: Map<string, boolean>;
}
```

During `authorizeUpgrade`, after resolving the session, also load the user's role and tags:

```ts
// In authorizeUpgrade(), after userId is resolved:
const access = accessService(db);
const role = await access.resolveRole(companyId, "user", userId);
const bypassTagFilter = role?.bypassTagFilter ?? false;
const tagIds = bypassTagFilter
  ? new Set<string>()
  : await access.getTagIds(companyId, "user", userId);

return {
  companyId,
  actorType: "board",
  actorId: userId,
  tagIds,
  bypassTagFilter,
  agentVisibilityCache: new Map(),
};
```

For agent actors: `bypassTagFilter = false`, `tagIds` = agent's own tags (or bypass if CAO).

#### 1.4.4 Filter Function — `canReceiveEvent`

```ts
// server/src/realtime/event-visibility.ts (NEW FILE)

import type { LiveEvent, EventVisibility } from "@mnm/shared";

interface ActorContext {
  actorId: string;
  actorType: "board" | "agent";
  tagIds: ReadonlySet<string>;
  bypassTagFilter: boolean;
}

/**
 * Determines if the connected actor should receive this event.
 * Called BEFORE socket.send() — must be fast (no DB queries).
 */
export function canReceiveEvent(
  event: LiveEvent,
  actor: ActorContext,
  resolveAgentTagOverlap: (agentId: string) => boolean,
): boolean {
  // Admin / CAO bypass → receive everything
  if (actor.bypassTagFilter) return true;

  const vis = event.visibility;

  switch (vis.scope) {
    case "company-wide":
      return true;

    case "actor-only":
      return actor.actorId === vis.actorId;

    case "tag-filtered":
      // User must share at least 1 tag with the event's tag set
      if (actor.tagIds.size === 0 || vis.tagIds.length === 0) return false;
      return vis.tagIds.some((tagId) => actor.tagIds.has(tagId));

    case "agents":
      // User must be able to see at least 1 of the event's agents
      return vis.agentIds.some(resolveAgentTagOverlap);

    default:
      return false;
  }
}
```

#### 1.4.5 Agent Tag Resolution Cache

The `agents` scope requires knowing each agent's tags. We need a shared, in-process cache:

```ts
// server/src/realtime/agent-tag-cache.ts (NEW FILE)

import type { Db } from "@mnm/db";
import { tagAssignments } from "@mnm/db";
import { and, eq } from "drizzle-orm";

const CACHE_TTL_MS = 60_000; // 1 minute

interface CachedAgentTags {
  tagIds: Set<string>;
  cachedAt: number;
}

const cache = new Map<string, CachedAgentTags>(); // key = agentId

export function agentTagCache(db: Db) {
  async function getAgentTags(companyId: string, agentId: string): Promise<Set<string>> {
    const cached = cache.get(agentId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.tagIds;
    }

    const rows = await db
      .select({ tagId: tagAssignments.tagId })
      .from(tagAssignments)
      .where(and(
        eq(tagAssignments.companyId, companyId),
        eq(tagAssignments.targetType, "agent"),
        eq(tagAssignments.targetId, agentId),
      ));

    const tagIds = new Set(rows.map((r) => r.tagId));
    cache.set(agentId, { tagIds, cachedAt: Date.now() });
    return tagIds;
  }

  function invalidate(agentId: string) {
    cache.delete(agentId);
  }

  return { getAgentTags, invalidate };
}
```

#### 1.4.6 WS Connection Handler Update

```ts
// In setupLiveEventsWebSocketServer, on "connection":

wss.on("connection", (socket: WsSocket, req: IncomingMessage) => {
  const context = (req as IncomingMessageWithContext).mnmUpgradeContext;
  if (!context) { socket.close(1008, "missing context"); return; }

  const tagCacheSvc = agentTagCache(db);

  // Lazy agent visibility resolver (no DB hit unless needed)
  const resolveAgentTagOverlap = (agentId: string): boolean => {
    if (context.bypassTagFilter) return true;
    // Check local cache first (per-connection)
    const cached = context.agentVisibilityCache.get(agentId);
    if (cached !== undefined) return cached;

    // Sync check against pre-warmed agent tag cache
    // NOTE: getAgentTags is async but we need sync here.
    // Solution: pre-warm on first event, use stale cache for filter.
    // See 1.4.7 for the async warming strategy.
    return true; // Optimistic default — see warming strategy
  };

  const unsubscribe = subscribeCompanyLiveEvents(context.companyId, (event) => {
    if (socket.readyState !== WebSocket.OPEN) return;

    if (!canReceiveEvent(event, context, resolveAgentTagOverlap)) return;

    try {
      // Strip visibility before sending to client (internal metadata)
      const { visibility, ...clientEvent } = event;
      socket.send(JSON.stringify(clientEvent));
    } catch (err) {
      logger.warn({ err, companyId: context.companyId }, "failed to send live event");
    }
  });

  // ... rest unchanged
});
```

#### 1.4.7 Async Agent Tag Warming Strategy

The `canReceiveEvent` filter runs synchronously in the EventEmitter callback. For `agents` scope, we need agent tags. Strategy:

1. **On WS connect**: Pre-warm the agent tag cache by loading all agents visible to this user (same query as tag-filter service)
2. **On cache miss**: Allow the event through (optimistic), then async-load and cache for next time
3. **On tag assignment change**: Invalidate the agent tag cache entry (listen for `activity.logged` events with tag changes)

This means the very first event for an uncached agent may be incorrectly delivered, but subsequent events will be correctly filtered. This is acceptable because:
- Cache warms within 1 minute
- Over-delivery is safe (under-delivery would be a bug)
- Admin users bypass anyway

#### 1.4.8 Migration Plan — Incremental Call Site Updates

**Phase 1 — Infrastructure** (this sprint):
1. Add `EventVisibility` type to `@mnm/shared`
2. Update `publishLiveEvent` signature (optional `visibility` param)
3. Update `LiveEvent` type with visibility field
4. Add `canReceiveEvent` filter function
5. Add `agentTagCache` service
6. Update WS handler to load user tags at connect and filter events

**Phase 2 — High-Impact Call Sites** (next sprint):
Migrate the most frequent events first:
1. `heartbeat.ts` — all 9 calls → `{ scope: "agents", agentIds: [agentId] }`
2. `bronze-trace-capture.ts` — 5 calls → `{ scope: "agents", agentIds: [agentId] }`
3. `chat.ts` + `routes/chat.ts` — 5 calls → `{ scope: "agents", agentIds: [agentId] }`

**Phase 3 — Remaining Call Sites**:
Migrate remaining ~35 call sites grouped by service. Each call site change is a 1-line addition.

Example migration for a heartbeat call site:
```ts
// BEFORE:
publishLiveEvent({
  companyId,
  type: "heartbeat.run.status",
  payload: { agentId, runId, status },
});

// AFTER:
publishLiveEvent({
  companyId,
  type: "heartbeat.run.status",
  payload: { agentId, runId, status },
  visibility: { scope: "agents", agentIds: [agentId] },
});
```

### 1.5 Risks & Open Decisions

| Risk | Severity | Mitigation |
|------|----------|------------|
| Agent tag cache staleness (1 min TTL) | LOW | Over-delivery is safe; invalidate on tag assignment changes |
| Performance: tag overlap check per event per socket | LOW | Sets are O(1) lookup; typical user has <10 tags |
| Backward compat: old clients receiving `visibility` field | NONE | Stripped before `socket.send()` |
| Agent actors connecting via WS | LOW | Agents use their own tags; agent-to-agent visibility follows same model |
| `subscribeAllLiveEvents` (global listeners like dashboard-refresh) | NONE | Global listeners are server-side only, not user-facing |

**Open decision**: Should `folder.*` events be `actor-only` (folder owner) or `company-wide`? Currently folders have a `createdByUserId` — recommend `actor-only` for personal folders, `company-wide` for shared folders.

---

## Section 2: Dashboard V2 Unified Grid

### 2.1 Problem Statement

The current dashboard has a visual and architectural split: predefined widgets (from view presets) render in a static CSS grid at the top, and custom widgets (user_widgets) render separately below with their own header. V2 merges both into a single draggable/resizable grid where users can freely arrange all widget types.

### 2.2 Current State Analysis

**`ui/src/components/DashboardGrid.tsx`**:
- Two separate grid sections: predefined widgets (from `widgets: DashboardWidget[]`) and custom widgets (from `customWidgets?: UserWidget[]`)
- Static CSS grid: `grid-cols-1 md:grid-cols-4` with `SPAN_CLASSES` for column spanning
- No drag/resize — widget positions are implicit from array order
- `WIDGET_REGISTRY[widget.type]` resolves predefined widgets to lazy-loaded React components
- Custom widgets render via `<ContentRenderer blocks={...} />`

**`ui/src/pages/Dashboard.tsx`**:
- `useViewPreset()` → resolves preset layout + user overrides → `layout.dashboard.widgets`
- `useUserWidgets()` → loads user's custom widgets
- Passes both to `<DashboardGrid>`
- `<AddWidgetDialog>` for creating/generating custom widgets
- `<ActiveAgentsPanel>` renders above the grid

**`packages/shared/src/types/view-preset.ts`**:
```ts
interface DashboardWidget { type: string; span?: 1|2|3|4; props?: Record<string, unknown> }
interface LayoutOverrides {
  dashboard?: {
    hiddenWidgets?: string[];     // preset widget types to hide
    extraWidgets?: DashboardWidget[];  // additional preset widgets
  }
}
```

**`ui/src/lib/resolve-layout.ts`**:
- Merges preset + overrides: filters `hiddenWidgets`, appends `extraWidgets`
- No position/coordinate data — order-based only

**`ui/src/lib/widget-registry.ts`**:
- `WIDGET_REGISTRY`: 18 registered widget types
- Each: `{ component: LazyComponent, defaultSpan: 1|2|3|4, label: string }`

**`packages/shared/src/types/user-widget.ts`**:
```ts
interface UserWidget {
  id: string; companyId: string; userId: string;
  title: string; description: string | null;
  blocks: ContentDocument;
  dataSource: UserWidgetDataSource | null;
  position: number; span: number;
  createdByAgentId: string | null;
  createdAt: string; updatedAt: string;
}
```

**`server/src/routes/view-presets.ts`**:
- `GET /my-view` — returns `{preset, overrides}` for the current user
- `PATCH /my-view/overrides` — saves the full `LayoutOverrides` object
- `layoutOverrides` is a JSONB column on `company_memberships`

**`packages/db/src/schema/company_memberships.ts`**:
- `layoutOverrides: jsonb("layout_overrides")` — untyped JSONB

### 2.3 Proposed Design

#### 2.3.1 WidgetPlacement Type

```ts
// packages/shared/src/types/view-preset.ts

/** Grid placement for a single widget in the unified dashboard grid */
export interface WidgetPlacement {
  /** Unique widget identifier:
   *  - "preset:{type}" for predefined registry widgets (e.g. "preset:kpi-bar")
   *  - UUID for user_widgets (e.g. "d4e5f6a7-...")
   */
  widgetId: string;
  /** Grid column (0-based, cols=12 for finer granularity) */
  x: number;
  /** Grid row (0-based, auto-compacted) */
  y: number;
  /** Width in grid units (1-12) */
  w: number;
  /** Height in grid units (1 unit = ~120px) */
  h: number;
  /** Hidden from view but preserved in layout */
  hidden?: boolean;
  /** Optional override props for preset widgets */
  props?: Record<string, unknown>;
}
```

**ID convention**:
- `preset:kpi-bar` — predefined widget from WIDGET_REGISTRY
- `d4e5f6a7-...` (UUID) — user_widget from the user_widgets table

This makes it unambiguous which rendering path to take.

#### 2.3.2 Evolved LayoutOverrides

```ts
// packages/shared/src/types/view-preset.ts

export interface LayoutOverrides {
  landingPage?: string;
  sidebar?: {
    pinnedItems?: NavItemId[];
    hiddenItems?: NavItemId[];
    sectionOrder?: string[];
  };
  dashboard?: {
    /** V1 (deprecated, still supported for migration): */
    hiddenWidgets?: string[];
    extraWidgets?: DashboardWidget[];
    /** V2: Full grid layout — if present, takes precedence over V1 fields */
    layout?: WidgetPlacement[];
  };
}
```

**Migration**: If `dashboard.layout` is present, it is the source of truth. If absent, fall back to the V1 `hiddenWidgets` + `extraWidgets` merge logic. This provides zero-downtime migration — existing users keep working, new layouts are saved in V2 format.

#### 2.3.3 Default Layout Materialization

When a user has no V2 `layout` override, the backend auto-generates a `WidgetPlacement[]` from the preset widgets + user widgets:

```ts
// server/src/services/layout-materializer.ts (NEW FILE)

import type { DashboardWidget, WidgetPlacement } from "@mnm/shared";
import type { UserWidget } from "@mnm/shared";
import { WIDGET_DEFAULT_HEIGHTS } from "@mnm/shared";

const GRID_COLS = 12;

/** Span-to-grid-width mapping: span 1=3cols, 2=6cols, 3=9cols, 4=12cols */
function spanToWidth(span: 1|2|3|4): number {
  return span * 3;
}

/** Default height by widget type (overridable) */
const DEFAULT_HEIGHT: Record<string, number> = {
  "kpi-bar": 2,
  "kpi-enterprise": 2,
  "run-activity": 3,
  "priority-chart": 3,
  "status-chart": 3,
  "success-rate": 3,
  "active-agents": 4,
  "recent-issues": 4,
  "recent-activity": 4,
  "timeline": 4,
  "breakdown": 4,
};

export function materializeLayout(
  presetWidgets: DashboardWidget[],
  userWidgets: UserWidget[],
): WidgetPlacement[] {
  const placements: WidgetPlacement[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;

  // Place preset widgets first (in order)
  for (const w of presetWidgets) {
    const span = w.span ?? 2;
    const gridW = spanToWidth(span as 1|2|3|4);
    const gridH = DEFAULT_HEIGHT[w.type] ?? 3;

    // Wrap to next row if doesn't fit
    if (cursorX + gridW > GRID_COLS) {
      cursorY += rowMaxH;
      cursorX = 0;
      rowMaxH = 0;
    }

    placements.push({
      widgetId: `preset:${w.type}`,
      x: cursorX,
      y: cursorY,
      w: gridW,
      h: gridH,
      props: w.props,
    });

    cursorX += gridW;
    rowMaxH = Math.max(rowMaxH, gridH);
  }

  // Advance past preset widgets
  if (cursorX > 0) {
    cursorY += rowMaxH;
    cursorX = 0;
    rowMaxH = 0;
  }

  // Place user widgets after presets
  for (const uw of userWidgets) {
    const gridW = spanToWidth((uw.span || 2) as 1|2|3|4);
    const gridH = 3; // Default height for custom widgets

    if (cursorX + gridW > GRID_COLS) {
      cursorY += rowMaxH;
      cursorX = 0;
      rowMaxH = 0;
    }

    placements.push({
      widgetId: uw.id,
      x: cursorX,
      y: cursorY,
      w: gridW,
      h: gridH,
    });

    cursorX += gridW;
    rowMaxH = Math.max(rowMaxH, gridH);
  }

  return placements;
}
```

#### 2.3.4 Backend API Changes — `view-presets.ts`

**GET /my-view** — Enhanced response:

```ts
// Add to the existing GET /my-view handler:

// After resolving preset + overrides...
// If user has V2 layout, return it directly
// If not, materialize from preset + user widgets

const userWidgetRows = await db
  .select()
  .from(userWidgets)
  .where(and(
    eq(userWidgets.companyId, companyId),
    eq(userWidgets.userId, userId),
  ))
  .orderBy(userWidgets.position);

const dashboardOverrides = membership.layoutOverrides?.dashboard;

let materializedLayout: WidgetPlacement[] | null = null;
if (dashboardOverrides?.layout) {
  // V2 layout exists — use it, but merge in any new user widgets not yet placed
  materializedLayout = mergeNewWidgets(
    dashboardOverrides.layout,
    presetWidgets,
    userWidgetRows,
  );
} else {
  // No V2 layout — auto-generate from preset + user widgets
  materializedLayout = materializeLayout(presetWidgets, userWidgetRows);
}

res.json({
  preset: preset ? { ... } : null,
  overrides: membership.layoutOverrides ?? null,
  // NEW: materialized grid layout for the frontend
  grid: materializedLayout,
});
```

**Helper: mergeNewWidgets** — handles the case where user has a saved V2 layout but new widgets were added (new preset widget or new user widget):

```ts
function mergeNewWidgets(
  savedLayout: WidgetPlacement[],
  presetWidgets: DashboardWidget[],
  userWidgets: UserWidget[],
): WidgetPlacement[] {
  const existingIds = new Set(savedLayout.map((p) => p.widgetId));

  const missingPlacements: WidgetPlacement[] = [];

  // Check for new preset widgets not in saved layout
  for (const w of presetWidgets) {
    const id = `preset:${w.type}`;
    if (!existingIds.has(id)) {
      missingPlacements.push({
        widgetId: id,
        x: 0, y: 9999, // Bottom of grid
        w: spanToWidth((w.span ?? 2) as 1|2|3|4),
        h: DEFAULT_HEIGHT[w.type] ?? 3,
        props: w.props,
      });
    }
  }

  // Check for new user widgets not in saved layout
  for (const uw of userWidgets) {
    if (!existingIds.has(uw.id)) {
      missingPlacements.push({
        widgetId: uw.id,
        x: 0, y: 9999,
        w: spanToWidth((uw.span || 2) as 1|2|3|4),
        h: 3,
      });
    }
  }

  return [...savedLayout, ...missingPlacements];
}
```

**PATCH /my-view/overrides** — Accept V2 layout:

No change needed to the endpoint — it already accepts the full `LayoutOverrides` object. The frontend sends `{ dashboard: { layout: WidgetPlacement[] } }` which overwrites the previous V1 fields. The backend stores it as-is in the JSONB column.

#### 2.3.5 Frontend — UnifiedDashboardGrid Component

Replace `DashboardGrid` with a new `UnifiedDashboardGrid` using `react-grid-layout`:

```tsx
// ui/src/components/UnifiedDashboardGrid.tsx

import { Responsive, WidthProvider } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import type { WidgetPlacement, UserWidget } from "@mnm/shared";
import { WIDGET_REGISTRY } from "../lib/widget-registry";
import { ContentRenderer } from "./blocks/ContentRenderer";

const ResponsiveGrid = WidthProvider(Responsive);

interface UnifiedDashboardGridProps {
  companyId: string;
  placements: WidgetPlacement[];
  userWidgets: UserWidget[];
  onLayoutChange: (placements: WidgetPlacement[]) => void;
  onAddWidget?: () => void;
  onDeleteWidget?: (widgetId: string) => void;
}

export function UnifiedDashboardGrid({
  companyId,
  placements,
  userWidgets,
  onLayoutChange,
  onAddWidget,
  onDeleteWidget,
}: UnifiedDashboardGridProps) {
  // Convert WidgetPlacement[] to react-grid-layout Layout[]
  const rglLayout: Layout[] = placements
    .filter((p) => !p.hidden)
    .map((p) => ({
      i: p.widgetId,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      minW: 3,  // Minimum 1 "span"
      minH: 2,
    }));

  const userWidgetMap = new Map(userWidgets.map((w) => [w.id, w]));

  function handleLayoutChange(_: Layout[], allLayouts: { lg: Layout[] }) {
    const updated: WidgetPlacement[] = allLayouts.lg.map((item) => {
      const existing = placements.find((p) => p.widgetId === item.i);
      return {
        widgetId: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        hidden: existing?.hidden,
        props: existing?.props,
      };
    });
    // Re-add hidden widgets (not in the visual layout)
    const visibleIds = new Set(updated.map((p) => p.widgetId));
    for (const p of placements) {
      if (p.hidden && !visibleIds.has(p.widgetId)) {
        updated.push(p);
      }
    }
    onLayoutChange(updated);
  }

  function renderWidget(widgetId: string) {
    if (widgetId.startsWith("preset:")) {
      // Predefined widget from registry
      const type = widgetId.slice("preset:".length);
      const def = WIDGET_REGISTRY[type];
      if (!def) return <div>Unknown widget: {type}</div>;
      const Widget = def.component;
      const placement = placements.find((p) => p.widgetId === widgetId);
      return (
        <Suspense fallback={<WidgetSkeleton />}>
          <Widget
            companyId={companyId}
            span={Math.ceil((placement?.w ?? 6) / 3) as 1|2|3|4}
            props={placement?.props}
          />
        </Suspense>
      );
    }

    // User widget (UUID)
    const uw = userWidgetMap.get(widgetId);
    if (!uw) return <div>Widget not found</div>;
    return (
      <CustomWidgetCard
        widget={uw}
        onDelete={onDeleteWidget}
      />
    );
  }

  return (
    <ResponsiveGrid
      className="unified-dashboard-grid"
      layouts={{ lg: rglLayout }}
      breakpoints={{ lg: 1200, md: 768, sm: 0 }}
      cols={{ lg: 12, md: 8, sm: 4 }}
      rowHeight={40}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".widget-drag-handle"
      isResizable
      isDraggable
    >
      {rglLayout.map((item) => (
        <div key={item.i} className="widget-container">
          {renderWidget(item.i)}
        </div>
      ))}
    </ResponsiveGrid>
  );
}
```

#### 2.3.6 Dashboard.tsx Integration

```tsx
// ui/src/pages/Dashboard.tsx — key changes

export function Dashboard() {
  // ... existing hooks ...
  const { layout, grid } = useViewPreset(); // grid = WidgetPlacement[] (new field)
  const { widgets: customWidgets } = useUserWidgets();
  const saveLayout = useSaveLayoutOverrides();

  // Debounced save on layout change
  const handleLayoutChange = useDebouncedCallback(
    (placements: WidgetPlacement[]) => {
      saveLayout.mutate({
        dashboard: { layout: placements },
      });
    },
    1000, // 1s debounce — don't save on every drag pixel
  );

  return (
    <div className="space-y-6">
      {/* Live indicator, alerts, etc. — unchanged */}
      <ActiveAgentsPanel companyId={selectedCompanyId!} />

      <UnifiedDashboardGrid
        companyId={selectedCompanyId!}
        placements={grid}
        userWidgets={customWidgets}
        onLayoutChange={handleLayoutChange}
        onAddWidget={() => setAddWidgetOpen(true)}
        onDeleteWidget={(widgetId) => deleteWidget.mutate(widgetId)}
      />

      <AddWidgetDialog ... />
    </div>
  );
}
```

#### 2.3.7 useViewPreset Hook Update

```ts
// ui/src/hooks/useViewPreset.ts

export function useViewPreset() {
  // ... existing logic ...

  return {
    layout,          // ResolvedLayout (existing — used for sidebar/landing)
    grid,            // WidgetPlacement[] (NEW — from server materialization)
    isLoading,
    presetName: data?.preset?.name ?? null,
    presetSlug: data?.preset?.slug ?? null,
  };
}
```

#### 2.3.8 Add Widget Dialog — Unified Search

The existing `AddWidgetDialog` supports creating custom widgets and generating via CAO. For V2, extend it to also allow adding predefined widgets from the registry:

```tsx
// In AddWidgetDialog:

// Tab 1: "Preset Widgets" — grid of WIDGET_REGISTRY entries not yet placed
// Tab 2: "Custom Widget" — existing create form
// Tab 3: "Ask CAO" — existing generate form

// When adding a preset widget:
const newPlacement: WidgetPlacement = {
  widgetId: `preset:${selectedType}`,
  x: 0, y: 9999, // append to bottom
  w: WIDGET_REGISTRY[selectedType].defaultSpan * 3,
  h: DEFAULT_HEIGHT[selectedType] ?? 3,
};
onLayoutChange([...currentPlacements, newPlacement]);
```

#### 2.3.9 Responsive Breakpoints

The grid uses 3 breakpoints:
- **lg (>=1200px)**: 12 columns — full layout
- **md (>=768px)**: 8 columns — auto-reflow (react-grid-layout handles this)
- **sm (<768px)**: 4 columns — stack to single column-ish

On smaller screens, react-grid-layout auto-compacts widgets. No separate mobile layout is stored — only `lg` is persisted.

### 2.4 Data Flow

```
                         ┌──────────────────────┐
                         │   view_presets table  │
                         │  (preset.layout.      │
                         │   dashboard.widgets)  │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │  GET /my-view         │
                         │  materializeLayout()  │◄── user_widgets table
                         │  mergeNewWidgets()    │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │  Response: { preset,  │
                         │    overrides, grid }   │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │  useViewPreset()               │
                    │  → grid: WidgetPlacement[]     │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │  <UnifiedDashboardGrid>        │
                    │  react-grid-layout (RGL)       │
                    │  ┌─────────┐ ┌─────────┐      │
                    │  │preset:  │ │ uuid     │      │
                    │  │kpi-bar  │ │ (custom) │      │
                    │  └─────────┘ └─────────┘      │
                    └───────────────┬───────────────┘
                                    │ onLayoutChange
                    ┌───────────────▼───────────────┐
                    │  PATCH /my-view/overrides       │
                    │  { dashboard: { layout: [...] }}│
                    │  → company_memberships JSONB    │
                    └───────────────────────────────┘
```

### 2.5 Migration Strategy

**Phase 1 — Backend** (non-breaking):
1. Add `WidgetPlacement` type to `@mnm/shared`
2. Add `materializeLayout()` and `mergeNewWidgets()` server-side
3. Extend `GET /my-view` response to include `grid` field
4. V1 `LayoutOverrides.dashboard` fields remain supported

**Phase 2 — Frontend** (feature-flagged if needed):
1. Install `react-grid-layout` + `@types/react-grid-layout`
2. Build `UnifiedDashboardGrid` component
3. Update `Dashboard.tsx` to use new grid
4. Update `AddWidgetDialog` with preset widget tab
5. Add debounced layout save on drag/resize

**Phase 3 — Cleanup**:
1. Remove old `DashboardGrid` component
2. Remove `SPAN_CLASSES` constant
3. Remove V1 `hiddenWidgets` / `extraWidgets` from `LayoutOverrides` (once all users have migrated)

**Zero-downtime**: The V2 `layout` field in `LayoutOverrides.dashboard` is additive. Existing V1 users continue working until they first interact with the grid, at which point a V2 layout is auto-materialized and saved.

### 2.6 Risks & Open Decisions

| Risk | Severity | Mitigation |
|------|----------|------------|
| react-grid-layout bundle size (~40KB gzipped) | LOW | Already lazy-loaded on dashboard route only |
| Layout JSONB growing large (many widgets) | LOW | Typical layout = 10-20 widgets = ~2KB JSON |
| New preset widget added to preset after user saved V2 layout | MEDIUM | `mergeNewWidgets()` auto-appends at bottom of grid |
| User widget deleted but still in saved layout | LOW | `renderWidget()` handles missing widgets gracefully |
| Responsive layout: mobile users drag on touch | LOW | react-grid-layout supports touch; disable drag on sm breakpoint if needed |
| Performance: frequent PATCH on drag | LOW | 1s debounce; only saves final position |

**Open decisions**:
1. **Column count**: 12 columns (recommended, standard for grid systems) vs keeping 4 (current). 12 provides finer control.
2. **Row height**: 40px per row unit is a good default. Widgets get `h` values of 2-5 (80-200px).
3. **Lock mode**: Should there be a "lock layout" toggle to prevent accidental drags? Recommend yes — simple boolean in user preferences.
4. **Widget min/max sizes**: Should the registry define `minW/minH/maxW/maxH` per widget type? Recommend adding to `WidgetDef`.

---

## Appendix A: New Dependencies

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `react-grid-layout` | ^1.4.x | Draggable/resizable grid | ~40KB gz |
| `@types/react-grid-layout` | ^1.4.x | TypeScript types | dev only |

No new backend dependencies required.

## Appendix B: New Files Summary

| File | Purpose |
|------|---------|
| `server/src/realtime/event-visibility.ts` | `canReceiveEvent()` filter function |
| `server/src/realtime/agent-tag-cache.ts` | In-process agent tag cache for WS filtering |
| `server/src/services/layout-materializer.ts` | Auto-generate `WidgetPlacement[]` from preset + user widgets |
| `ui/src/components/UnifiedDashboardGrid.tsx` | New unified grid component |

## Appendix C: Modified Files Summary

| File | Changes |
|------|---------|
| `packages/shared/src/types/live.ts` | Add `EventVisibility` type, add `visibility` to `LiveEvent` |
| `packages/shared/src/types/view-preset.ts` | Add `WidgetPlacement`, evolve `LayoutOverrides.dashboard` |
| `server/src/services/live-events.ts` | Add optional `visibility` param to `publishLiveEvent` |
| `server/src/realtime/live-events-ws.ts` | Load user tags at connect, apply `canReceiveEvent` filter |
| `server/src/routes/view-presets.ts` | Extend `GET /my-view` to return `grid`, support `mergeNewWidgets` |
| `ui/src/pages/Dashboard.tsx` | Use `UnifiedDashboardGrid`, add layout save |
| `ui/src/hooks/useViewPreset.ts` | Return `grid` from API response |
| `ui/src/lib/widget-registry.ts` | Add `minW/minH` to `WidgetDef` (optional) |
| ~50 `publishLiveEvent` call sites | Add `visibility` parameter (incremental) |
