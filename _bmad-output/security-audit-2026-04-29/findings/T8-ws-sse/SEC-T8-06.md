---
id: SEC-T8-06
severity: medium
category: CWE-400 Uncontrolled Resource Consumption / OWASP A05 - Security Misconfiguration
title: No maxPayload limit on WebSocket servers — large message DoS
file: server/src/realtime/live-events-ws.ts:223 / server/src/realtime/chat-ws.ts:283
status: open
---

## Description

Both WebSocket servers are instantiated with only `{ noServer: true }`:

```ts
// live-events-ws.ts:223
const wss = new WebSocketServer({ noServer: true });

// chat-ws.ts:283
const wss = new WebSocketServer({ noServer: true });
```

The `ws` library's `WebSocketServer` accepts a `maxPayload` option (default: 100 MiB in older versions; actually 100 * 1024 * 1024 bytes = 104,857,600 bytes for `ws` >= 7.x). The default is effectively unlimited for practical purposes.

For the **chat WS server**, the application-level `chatClientPayloadSchema` caps `content` at 4096 characters, but a malicious client can send a frame with a gigantic outer JSON object (deeply nested, large metadata, etc.) before Zod parsing occurs. The raw JSON is parsed via `JSON.parse(raw)` first, which allocates memory proportional to the payload size.

For the **live-events WS server**, the server only sends to clients — it never expects messages from clients. However, the `ws.on("message")` handler is not registered, so any inbound frame is silently consumed by the library and must still be allocated and decoded from the wire buffer before being discarded.

## Impact

A single authenticated connection can:
1. Send a 100 MiB frame → Node.js allocates a 100 MiB Buffer during frame decode.
2. Repeat at wire speed → memory pressure → GC thrashing → latency spikes for all users.
3. With ~10 connections (within the unrestricted connection count, see SEC-T8-03), send concurrent 100 MiB frames → potential OOM.

The chat WS server is more exposed because it genuinely processes inbound messages and the JSON parse happens before any size check.

## Reproduction

```js
const ws = new WebSocket('ws://localhost:3100/ws/chat/<channelId>');
ws.onopen = () => {
  // 50 MB JSON string
  ws.send(JSON.stringify({ type: 'chat_message', content: 'x', extra: 'A'.repeat(50_000_000) }));
};
```

Monitor server RSS before/after with `process.memoryUsage()`.

## Recommendation

1. **Set `maxPayload` on both WebSocketServer instances**:
   ```ts
   new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 }) // 64 KiB
   ```
   The chat validator caps content at 4096 bytes; 64 KiB leaves room for metadata overhead while preventing large-frame attacks.
2. For the live-events server (receive-only), a lower limit like 4 KiB is appropriate since no legitimate client message is expected.
3. Consider also limiting raw string length **before** `JSON.parse` in the chat message handler:
   ```ts
   if (raw.length > 65_536) { socket.send(JSON.stringify({type:'error',code:'MESSAGE_TOO_LONG'})); return; }
   ```
