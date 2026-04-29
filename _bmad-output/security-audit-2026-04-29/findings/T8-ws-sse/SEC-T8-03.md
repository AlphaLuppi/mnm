---
id: SEC-T8-03
severity: high
category: CWE-400 Uncontrolled Resource Consumption / OWASP A05 - Security Misconfiguration
title: No per-connection or per-user WS connection limit — connection flooding / DoS
file: server/src/realtime/live-events-ws.ts:215-388 / server/src/realtime/chat-ws.ts:272-461
status: open
---

## Description

The WebSocket server has no limit on:
- Number of simultaneous connections per IP address
- Number of simultaneous connections per authenticated user
- Number of simultaneous connections per company

Any authenticated user (or unauthenticated requester in `local_trusted` mode) can open an unbounded number of WebSocket connections. Each connection registers a subscription via `subscribeCompanyLiveEvents` (a Node.js `EventEmitter.on`) and creates several in-memory data structures:

- `cleanupByClient`: `Map<WsSocket, () => void>` (live-events)
- `aliveByClient`: `Map<WsSocket, boolean>` (both WS servers)
- `channelConnections`: `Map<string, Set<ConnectionInfo>>` (chat)
- `rateLimitStore`, `channelBuffers`, `typingTimers` (chat)
- An `agentVisibilityCache` per connection (live-events, `UpgradeContext`)

The EventEmitter in `live-events.ts` is global with `setMaxListeners(0)` (unlimited), so it will never throw on excessive listeners.

## Impact

**DoS / Memory exhaustion.** A single attacker (or a single compromised browser tab with a loop) can:
1. Open 10,000+ WS connections in seconds — Node.js has no built-in WS connection limit.
2. Each connection consumes an event listener, a Map entry, and a closure with a visibility cache.
3. Memory grows unboundedly until the process OOMs or becomes unresponsive.
4. The ping/pong loop runs over `wss.clients` (a `Set`) — iterating 10,000 clients every 30s adds non-trivial CPU cost.
5. Existing legitimate users are denied real-time updates.

This applies to both `/events/ws` (live-events) and `/ws/chat/:channelId` (chat).

In `local_trusted` mode no authentication is required at all — the attack needs only network access to localhost.

## Reproduction

```bash
# Authenticated flood (adjust token/company):
for i in $(seq 1 5000); do
  wscat -c "ws://localhost:3100/api/companies/$CID/events/ws" \
        -H "Authorization: Bearer $TOKEN" &
done
# Monitor: watch -n1 "ss -s | grep estab"
```

## Recommendation

1. **Per-IP connection limit** — track open WS connections per IP in a shared `Map<ip, count>`. Reject upgrade when the count exceeds a threshold (e.g. 20).
2. **Per-user connection limit** — similarly cap connections per `actorId` (e.g. 5 simultaneous browser tabs is plenty).
3. **Per-company connection limit** — cap total connections per `companyId` to prevent a tenant from monopolizing server resources.
4. **Global connection ceiling** — reject new connections when `wss.clients.size` exceeds a configured global maximum.
5. **Consider `maxPayload`** — set `new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })` to cap individual message sizes.
