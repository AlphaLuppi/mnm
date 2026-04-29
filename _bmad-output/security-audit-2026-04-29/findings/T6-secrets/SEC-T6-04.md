---
id: SEC-T6-04
severity: high
category: CWE-532 / OWASP A09
title: WebSocket auth token exposed in URL query string — logged by all HTTP access logs
file: server/src/realtime/live-events-ws.ts:113-115 + server/src/realtime/chat-ws.ts:148-150
status: open
---

## Description

Both the live-events WebSocket and the chat WebSocket accept authentication tokens as a URL query parameter:

```typescript
// live-events-ws.ts:113-115
const queryToken = url.searchParams.get("token")?.trim() ?? "";
const authToken = parseBearerToken(req.headers.authorization);
const token = authToken ?? (queryToken.length > 0 ? queryToken : null);
```

When the browser connects to `wss://host/api/companies/:id/events/ws?token=<JWT>`, the full URL including the token is:

1. **Written to server access logs** by `pino-http` (the Upgrade request URL is logged).
2. **Stored in browser history** and potentially cached by intermediaries.
3. **Visible in `Referer` headers** if the page subsequently navigates or loads external resources.
4. **Captured in reverse proxy logs** (nginx, Caddy, etc.) which are often retained longer than application logs.

The `Authorization: Bearer <token>` header path is not exposed to logs and is the secure alternative.

## Impact

Long-lived tokens (the MNM_API_KEY JWT has a 2h TTL by default, configurable via `MNM_AGENT_JWT_TTL_SECONDS`) appearing in logs create a wide exploitation window. Any user with access to server or proxy logs can steal active sessions and impersonate agents or board users.

## Reproduction (conceptual)

1. Open the MnM UI in a browser with developer tools network tab open.
2. Observe the WebSocket upgrade URL includes `?token=eyJ...`.
3. Check server log for the corresponding `GET /api/companies/.../events/ws?token=eyJ...` access log entry.

## Recommendation

**Short-term**: Remove the `?token=` query parameter fallback entirely. Require `Authorization: Bearer` header exclusively. Update the UI client to use headers only.

**If query param cannot be removed** (e.g., browser WebSocket API limitations):
- Use a **short-lived one-time token** exchanged via a pre-authentication endpoint (`POST /auth/ws-token`) that returns a token valid for ~30 seconds, preventing log replay attacks.
- Ensure server logs sanitize query parameters matching `token=` before writing.

## References

- `server/src/realtime/live-events-ws.ts:113-115`
- `server/src/realtime/chat-ws.ts:148-150`
- OWASP WSTG-SESS-04: Testing for Exposed Session Variables
- CWE-598: Use of GET Request Method With Sensitive Query Strings
