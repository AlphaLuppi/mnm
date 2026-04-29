---
id: SEC-T8-11
severity: medium
category: CWE-400 Uncontrolled Resource Consumption
title: No per-user WS message rate limit on the live-events server (receive path is unbounded)
file: server/src/realtime/live-events-ws.ts
status: open
---

## Description

The live-events WebSocket server (`/api/companies/:companyId/events/ws`) only sends events to clients — it does not register a `message` event handler. However, the `ws` library still **receives and buffers** all frames sent by the client before discarding them. There is no rate limit on the number of frames a client can send.

The chat WS server (`/ws/chat/:channelId`) has a rate limit (`RATE_LIMIT_MAX = 10` messages/minute per actor per channel), but only for `chat_message` type payloads — typing indicator frames (`typing_start`, `typing_stop`) and `ping` frames are NOT counted against this limit.

A client can send `typing_start` events in a tight loop:
- Each `typing_start` sets a `setTimeout` timer (`TYPING_AUTO_CLEAR_MS = 15,000ms`).
- The old timer is cleared and a new one is set on each `typing_start`.
- The broadcast call `broadcastLocal(channelId, indicator, socket)` goes to all other channel participants on every frame, potentially flooding their connections.

## Impact

- **Live-events server**: A connected client can flood the server's receive buffer by sending frames at wire speed. While the frames are discarded at the application level, they still consume:
  - Network bandwidth (inbound)
  - Node.js event loop time for the `ws` library's frame parsing
  - Memory for the frame buffer before the library drops it (depends on `maxPayload`, see SEC-T8-06)

- **Chat server typing flood**: A user can broadcast `typing_start` to all channel participants at ~1000 fps (no rate limit on typing events). With 50 participants in a channel, each frame triggers 50 `broadcastLocal` sends.

## Reproduction

```js
// Typing flood on chat:
const ws = new WebSocket('ws://localhost:3100/ws/chat/<channelId>');
ws.onopen = () => {
  setInterval(() => {
    ws.send(JSON.stringify({ type: 'typing_start' }));
  }, 1); // 1ms interval = 1000 fps
};
```

Monitor broadcast calls in the chat manager.

## Recommendation

1. **Live-events server**: register a `message` handler that immediately drops the frame with a rate-limited warning:
   ```ts
   socket.on("message", () => { /* discard all client messages */ });
   ```
   This is semantically correct (the server is receive-only) and also makes the intent explicit.
2. **Chat server typing events**: include `typing_start` and `typing_stop` in the rate limiter, or apply a separate debounce (e.g. max 1 typing event per 2 seconds per actor per channel).
3. **General message rate limiting**: add a per-connection message rate counter (e.g. max 100 frames/second) across all message types, enforced in the WS `message` handler before dispatching to the type-specific handlers.
