---
id: SEC-T8-15
severity: info
category: Architecture / Defense-in-Depth
title: Tag-based event filtering is server-side (correct) — visibility field correctly stripped before sending
file: server/src/realtime/live-events-ws.ts:206-213 / server/src/realtime/event-visibility.ts
status: open
---

## Description

This is a **positive finding** confirming correct implementation. Tag-based event filtering is performed server-side before events reach the client.

The `sendFiltered` function in `live-events-ws.ts` strips the `visibility` field from every event before sending:
```ts
function sendFiltered(socket: WsSocket, event: LiveEvent, companyId: string) {
  const { visibility: _vis, ...clientEvent } = event;
  socket.send(JSON.stringify(clientEvent));
}
```

The `canReceiveEvent` function in `event-visibility.ts` implements a complete, server-enforced authorization check covering all four scopes: `company-wide`, `actor-only`, `tag-filtered`, and `agents`. The default case denies access for unknown scopes.

The `agentTagCache` implements a global LRU-style cache (10,000 entries, 60s TTL) with a per-connection `agentVisibilityCache` overlay. This prevents repeated DB queries on high-frequency agent-scoped events.

**No client-side filtering is performed** — the UI (`LiveUpdatesProvider.tsx`) only applies a secondary `companyId` check as a sanity assertion (`if (event.companyId !== expectedCompanyId) return;`), not as a primary security control.

**Cross-tenant isolation confirmed**: The `subscribeCompanyLiveEvents` function uses `companyId` as the EventEmitter channel key, so events from company A are never delivered to a listener registered for company B at the in-process bus level.

## Notes for reviewers

- The per-connection `agentVisibilityCache` is an optimization that introduces a race condition (see SEC-T8-10) — the correctness of the cache warm-up strategy deserves specific testing.
- The 60s TTL on the global `agentTagCache` means tag assignment changes take up to 60 seconds to propagate to existing WS connections. This is acceptable but should be documented as a known lag.
- The `bypassTagFilter: true` path (admin/CAO/instance_admin) is a correct and intentional privilege escalation. Ensure the `bypassTagFilter` field on the resolved context cannot be spoofed via any client-controlled input (currently safe: it is derived from DB role queries, not from client headers).

## Recommendation

No action required for this finding. Document the 60s tag-change propagation lag in the security architecture document.
