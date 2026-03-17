# RT-S01: Remove all frontend polling — rely on WebSocket push events

**Epic:** Realtime Infrastructure (RT)
**Priority:** Must Have
**Story Points:** 8
**Status:** Done
**Created:** 2026-03-17
**Sprint:** Current

---

## User Story

As a **board operator** using the MnM supervision cockpit,
I want the **UI to update instantly via WebSocket push** without any HTTP polling,
So that **I see real-time status with zero latency and minimal server load**.

---

## Description

### Background

The frontend had **26 `refetchInterval` polling queries** across 14 files (2s-60s intervals) alongside an existing WebSocket infrastructure (`LiveUpdatesProvider`). The WS was already handling some event types, but many pages still polled because:

1. `LiveUpdatesProvider` didn't handle `container.*`, `drift.*`, `chat.*` events
2. `invalidateHeartbeatQueries` didn't invalidate issue-level queries (liveRuns, activeRun per issueId)
3. Several WS client implementations had robustness issues (zombie connections, no backoff, no reconnect cache refresh)
4. 4 backend routes didn't emit live events at all

### Scope

**In scope:**
- Extend `LiveUpdatesProvider` to handle all event types that feed polled queries
- Remove all `refetchInterval` from React Query hooks (26 instances)
- Harden all 4 WS clients (LiveUpdatesProvider, useAgentChat, AgentDetail, LiveRunWidget)
- Fix 4 backend routes missing `publishLiveEvent` calls
- Graceful WS shutdown on server SIGINT/SIGTERM
- Network recovery via `online` event listener

**Out of scope:**
- Replacing WebSocket with SSE (WS is already bidirectional, needed for chat)
- Adding WS authentication re-validation post-connect (tracked separately)
- Rate-limiting `typing_start` floods (tracked separately)
- `maxPayload` limit on WS server (tracked separately)

**Kept as-is (legitimate):**
- `useDriftScanStatus` conditional 2s poll while scan is active (no live event for scan progress)
- `JiraImport` conditional 2s poll while import job is active (no live event for job progress)
- `AgentDetail` WS-fallback `setInterval` for events/logs (guarded by `!isStreamingConnected`)

---

## Changes Made

### 1. Frontend — `LiveUpdatesProvider.tsx`

| Change | Detail |
|--------|--------|
| **New event handlers** | `container.*` (8 events) -> invalidate containers.list/health/detail |
| | `drift.*` (4 events) -> invalidate drift.alerts, drift.monitoringStatus |
| | `chat.*` (6 events) -> invalidate all chat queries (prefix match) |
| **Heartbeat fix** | `invalidateHeartbeatQueries` now also invalidates `issues.liveRuns(issueId)`, `issues.activeRun(issueId)`, `issues.runs(issueId)` when `issueId` is in payload |
| **Reconnect cache refresh** | On `onopen` after reconnect, invalidates liveRuns, heartbeats, agents.list, sidebarBadges, dashboard, issues.list |
| **try/catch** | `handleLiveEvent()` call wrapped in try/catch to prevent one bad event from killing the WS message handler |
| **Network recovery** | `window.addEventListener("online", handleOnline)` — force reconnect on network restore |

### 2. Frontend — Polling removal (14 files, 26 instances)

| File | Queries | Was |
|------|---------|-----|
| `Agents.tsx` | heartbeats | 15s |
| `IssueDetail.tsx` | issues.runs, issues.liveRuns, issues.activeRun | 5s, 3s, 3s |
| `Issues.tsx` | liveRuns | 5s |
| `Chat.tsx` | chat.channels | 15s |
| `AgentChatPanel.tsx` | chat.pipeStatus | 10s |
| `Containers.tsx` | containers.health, containers.list | 30s, 10s |
| `useDriftAlerts.ts` | drift.alerts, drift.monitoringStatus | 30s, 60s |
| `ProjectDetail.tsx` | liveRuns (x2) | 5s |
| `ContextPane.tsx` | liveRuns, issues (in_progress) | 5s, 10s |
| `CompanyRail.tsx` | liveRuns, sidebarBadges | 10s, 15s |
| `LiveRunWidget.tsx` | issues.liveRuns, issues.activeRun | 3s |
| `Sidebar.tsx` | liveRuns | 10s |
| `SidebarAgents.tsx` | liveRuns | 10s |
| `WorkPane.tsx` | issues (story-match), liveRuns, issues | 10s, 5s, 10s |

### 3. Frontend — WS client hardening

| Fix | Files | Detail |
|-----|-------|--------|
| **C1: Zombie connections** | `useAgentChat.ts` | Rewrote to closure-based `closed` flag pattern (matching LiveUpdatesProvider). Eliminates race condition where reconnect timer fires after unmount. |
| **C2: Optimistic message** | `useAgentChat.ts` | `sendMessage` now checks socket readyState BEFORE adding optimistic message. Removes optimistic message from state if `socket.send()` throws. |
| **C3: onclose guard** | `LiveRunWidget.tsx` | Added `if (closed) return` in `onclose` handler before `scheduleReconnect()`. |
| **H6: Dependency thrashing** | `LiveRunWidget.tsx` | Changed WS useEffect dependency from `activeRunIds` (new Set every render) to `runIdsKey` (stable string). |
| **H7: Exponential backoff** | `AgentDetail.tsx`, `LiveRunWidget.tsx` | Replaced fixed 1500ms reconnect with `Math.min(15000, 1000 * 2^attempt)` (1s -> 15s cap). |
| **H10: Log poll guard** | `LiveRunWidget.tsx` | Added `wsConnected` state. Log HTTP poll now only runs when `wsConnected === false` (WS fallback pattern). |

### 4. Backend — Server robustness

| Fix | File | Detail |
|-----|------|--------|
| **H1: try/catch send** | `live-events-ws.ts` | Wrapped `JSON.stringify(event)` + `socket.send()` in try/catch with logger.warn. Prevents one bad payload from crashing the EventEmitter loop for all subscribers. |
| **H2: Graceful shutdown** | `index.ts` | Store `liveEventsWss` and `chatWss` references. On SIGINT/SIGTERM, `terminate()` all WS clients before closing HTTP server. |
| **H4: pingInterval.unref()** | `chat-ws.ts` | Added `.unref()` to the 30s heartbeat interval so it doesn't block process exit. |

### 5. Backend — Missing event emission (4 routes)

| Route | File | Event added |
|-------|------|-------------|
| `PATCH /stages/:id` | `stages.ts` | `stage.transitioned` |
| `POST /workspace-context/assignments` | `workspace-context.ts` | `workspace.context.changed` |
| `POST /workspace-context/import-agents` | `workspace-context.ts` | `activity.logged` (entityType: agent) |
| `PATCH /chat/messages/:id` (edit+delete) | `chat.ts` | `chat.message_sent` (with action: edited/deleted) |

---

## Acceptance Criteria

- [x] Zero `refetchInterval` remaining except `useDriftScanStatus` (conditional) and `JiraImport` (conditional)
- [x] All 14 previously-polled query key families are invalidated by at least one WS event type in `LiveUpdatesProvider`
- [x] All WS clients use `closed` flag pattern to prevent zombie connections after unmount
- [x] All WS clients use exponential backoff for reconnection (1s -> 15s cap)
- [x] `LiveUpdatesProvider` refreshes critical caches on reconnect
- [x] `LiveUpdatesProvider` recovers from network drop via `online` event
- [x] `handleLiveEvent` errors are caught and logged (don't kill the WS handler)
- [x] Server `JSON.stringify`/`socket.send` errors are caught (don't crash emit loop)
- [x] Server closes all WS connections on SIGINT/SIGTERM
- [x] `LiveRunWidget` log poll only runs when WS is disconnected
- [x] `LiveRunWidget` WS effect uses stable string dependency (no reconnect thrashing)
- [x] All 4 backend mutation routes emit appropriate live events
- [x] TypeScript compiles with zero new errors

---

## Technical Notes

### Architecture Decision: Single Global WS

We kept the existing pattern of **1 global WS** (`LiveUpdatesProvider`) for cache invalidation + **per-component WS** for streaming (chat, logs). Multiple isolated WS per feature was considered but rejected:

- More connections = more server load and complexity
- Each would need its own auth, reconnection, error handling
- The real fix is making the single WS bulletproof (which we did)
- If the global WS dies, exponential backoff (15s max) + `online` event + cache refresh on reconnect covers recovery

### Event Coverage

The backend emits **62 live event types**. `LiveUpdatesProvider` now explicitly handles all types that correspond to polled queries. 31 event types (stage sub-events, hitl, enforcement, compaction, a2a) are not handled because they either:
- Don't have corresponding React Query caches (compaction, a2a)
- Are already covered by paired `activity.logged` events (hitl, enforcement)
- Are covered by `workflow.*` handler (stage sub-events)

### Known Remaining Issues (Future Work)

| ID | Severity | Issue |
|----|----------|-------|
| H3 | HIGH | No post-connect token re-validation (revoked keys keep receiving events) |
| M1 | MEDIUM | `setMaxListeners(0)` silences EventEmitter leak detection |
| M3 | MEDIUM | Race condition in chat-ws-manager addConnection (async) vs removeConnection (sync) |
| M4 | MEDIUM | No `maxPayload` limit on WS servers (default 100MB) |
| M5 | MEDIUM | Token allowed in URL query param (appears in logs) |
| L3 | LOW | `typing_start` flood not rate-limited |

---

## Definition of Done

- [x] Code implemented on `feature/b2b-enterprise-transformation` branch
- [x] TypeScript compiles with zero new errors (UI + server)
- [x] All `refetchInterval` removed (verified by grep)
- [x] All WS clients hardened (closed flag, backoff, reconnect cache refresh)
- [x] Backend routes emit events (4 gaps filled)
- [x] Server graceful shutdown closes WS connections
- [x] Audit by 5 specialized agents confirmed coverage

---

## Files Changed

### Frontend (ui/src/)
- `context/LiveUpdatesProvider.tsx` — event handlers, heartbeat fix, reconnect refresh, try/catch, online listener
- `hooks/useAgentChat.ts` — rewrite to closed-flag pattern, optimistic message fix
- `hooks/useDriftAlerts.ts` — remove 2 refetchIntervals
- `pages/Agents.tsx` — remove refetchInterval
- `pages/AgentDetail.tsx` — exponential backoff, onclose guard
- `pages/Chat.tsx` — remove refetchInterval
- `pages/Containers.tsx` — remove 2 refetchIntervals + AUTO_REFRESH_INTERVAL const
- `pages/IssueDetail.tsx` — remove 3 refetchIntervals
- `pages/Issues.tsx` — remove refetchInterval
- `pages/ProjectDetail.tsx` — remove 2 refetchIntervals
- `components/AgentChatPanel.tsx` — remove refetchInterval
- `components/CompanyRail.tsx` — remove 2 refetchIntervals
- `components/ContextPane.tsx` — remove 2 refetchIntervals
- `components/LiveRunWidget.tsx` — closed guard, backoff, wsConnected state, log poll guard, dependency fix
- `components/Sidebar.tsx` — remove refetchInterval
- `components/SidebarAgents.tsx` — remove refetchInterval
- `components/WorkPane.tsx` — remove 3 refetchIntervals

### Backend (server/src/)
- `realtime/live-events-ws.ts` — try/catch on send
- `realtime/chat-ws.ts` — pingInterval.unref()
- `routes/stages.ts` — publishLiveEvent on PATCH
- `routes/workspace-context.ts` — publishLiveEvent on assignments + import-agents
- `routes/chat.ts` — publishLiveEvent on message edit/delete
- `index.ts` — store wss refs, terminate on shutdown
