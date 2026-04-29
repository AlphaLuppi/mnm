---
id: SEC-T8-02
severity: high
category: CWE-522 Insufficiently Protected Credentials / CWE-598 Use of GET Request Method with Sensitive Query Strings
title: Agent API token accepted via query string — logged in HTTP access logs and browser history
file: server/src/realtime/live-events-ws.ts:113-115 / server/src/realtime/chat-ws.ts:148-150
status: open
---

## Description

Both WS upgrade handlers accept the agent API key as a URL query parameter `?token=<key>`:

```ts
// live-events-ws.ts:113-115
const queryToken = url.searchParams.get("token")?.trim() ?? "";
const authToken = parseBearerToken(req.headers.authorization);
const token = authToken ?? (queryToken.length > 0 ? queryToken : null);
```

The full URL (including the query string) is logged by `httpLogger` (Pino-HTTP) on every HTTP request, and is also stored in:
- Proxy/CDN access logs (nginx, Cloudflare, AWS ALB, etc.)
- Node.js `http.IncomingMessage` event logs
- Browser history (if the URL is ever typed or navigated to directly)
- Server-side structured logs (Pino emits `req.url`)

The query-string path was clearly intended as a fallback for environments where headers cannot be set (e.g. native WebSocket API from a browser). However the `Authorization: Bearer` header path is the preferred and secure channel.

## Impact

Token leakage via logs and history allows:
- **Server-side log exfiltration** → attacker with read access to logs obtains valid agent API keys.
- **Cross-tenant lateral movement** → a leaked agent key grants access to the agent's company live events stream.
- **Persistent access** — `agentApiKeys` has no `expiresAt` column (see SEC-T8-07), so a leaked token stays valid indefinitely until manually revoked.

In a SaaS multi-tenant deployment with centralized log aggregation (Datadog, Loki, etc.) a single log storage breach would expose all active agent tokens.

## Reproduction

1. Agent connects to `/api/companies/<cid>/events/ws?token=mnm_ak_<secret>`.
2. Pino-HTTP middleware logs the full URL with the token in plaintext.
3. `grep 'token=' server.log` reveals every active agent token.

## Recommendation

1. **Remove the query-string token path entirely** — require `Authorization: Bearer` for agent-authenticated upgrades. Browser-side agent connections should use the header too.
2. If the fallback must be kept for legacy clients, **redact** `?token=...` from the logged URL in `httpLogger`.
3. Add an `expiresAt` column to `agent_api_keys` and enforce short-lived tokens (see SEC-T8-07).

## References

- OWASP Top 10 A02:2021 – Cryptographic Failures
- RFC 6750 §2.3 — Bearer Token in URI Query Parameter (discouraged)
