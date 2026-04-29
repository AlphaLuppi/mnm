---
id: SEC-T8-10
severity: medium
category: CWE-362 Race Condition / CWE-367 TOCTOU
title: Tag-scope cache warm-up race — first event for an agent may be delivered before visibility is resolved
file: server/src/realtime/live-events-ws.ts:264-328
status: open
---

## Description

The live-events WS server uses an async pre-warm strategy to populate the per-connection `agentVisibilityCache`:

```ts
const resolveAgentTagOverlap = (agentId: string): boolean => {
  const cached = ctx.agentVisibilityCache.get(agentId);
  if (cached !== undefined) return cached;
  // Synchronous check: we pre-warm the cache async below
  // If not cached yet, conservatively return false (will be resolved next event)
  return false;
};
```

When an event arrives for an agent not yet in the cache:
1. The uncached agent IDs are detected.
2. `warmAgentCache(uncached)` is called asynchronously.
3. The event is held **only if there are uncached agents** — then re-dispatched after the cache warms.
4. **BUT**: `return false` (deny) is returned synchronously if the cache miss path exits the `if` block before the async warm completes.

The problematic race is on the second code path at line 326:
```ts
if (!canReceiveEvent(event, actor, resolveAgentTagOverlap)) return;
sendFiltered(socket, event, ctx.companyId);
```

If `vis.scope !== "agents"` (i.e. `scope === "tag-filtered"` or `scope === "company-wide"`), the async pre-warm for agents is never triggered at all for that event, so `agentVisibilityCache` stays empty. The next time an `agents`-scoped event arrives, `resolveAgentTagOverlap` returns `false` (deny) — the async warm fires, but by then the event has already been dropped.

Additionally, the dedup guard `warmUpInFlight` prevents duplicate DB queries for the same agent, but two separate events arriving within milliseconds of each other for the same uncached agent will both see `uncached.length > 0`, both enter the `warmAgentCache` path, and the **second event will be re-dispatched after the warm**. If the warm resolves `overlap = false`, the second event is correctly dropped. If `overlap = true`, the second event is sent — but the **first event was already dropped** (it entered the `warmAgentCache` path too, but a re-dispatch race means only one survives).

## Impact

- **Event loss** (availability): A user who should receive an agent-scoped event may miss the first event for a newly-seen agent. Subsequent events for the same agent are delivered correctly (cache is warm). The practical impact depends on event frequency — low-traffic agents are more exposed.
- **Incorrect deny** (information leakage in reverse): A user who should NOT see an agent's events gets them anyway if a `company-wide` event warms the cache pathway for them — this is not currently possible with the current code, but is a fragile invariant.
- **Non-deterministic behavior**: The cache warm timing depends on DB query latency. Under load, the first N events for a new agent may be dropped before the cache is hot.

## Reproduction

1. Connect user A (tagged with tag T1) to live events.
2. Create a new agent also tagged with T1 (visible to A).
3. Immediately trigger an `agents`-scoped event for this new agent.
4. Observe that the event is silently dropped because the cache is cold.
5. Trigger a second event 100ms later — it arrives correctly.

## Recommendation

1. **Pre-warm eagerly at connection time**: on WS connect, load ALL agent→tag mappings visible to this actor into `agentVisibilityCache`. This eliminates the race entirely at the cost of one DB query on connect.
2. **If lazy warm is kept**: ensure the first event is re-dispatched, not dropped. The current code does this correctly for `scope === "agents"` events — but verify that the re-dispatch is ordered (await the warm before checking the second `canReceiveEvent` call).
3. **Add integration test**: the existing `ws-filtering-integration.test.ts` should cover the "first event for a new agent" scenario.
