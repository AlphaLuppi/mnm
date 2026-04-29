# T8 — WebSocket / SSE Security Audit Summary
**Date**: 2026-04-29  
**Team**: T8 (whitebox — whitehat + redhat + blackhat)  
**Scope**: live-events WS, chat WS, SSE AI assistant, UI hooks

---

## Stats by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 0 | — |
| High | 4 | SEC-T8-01, SEC-T8-02, SEC-T8-03, SEC-T8-04 |
| Medium | 5 | SEC-T8-05, SEC-T8-06, SEC-T8-07, SEC-T8-08, SEC-T8-09, SEC-T8-10, SEC-T8-11 |
| Low | 3 | SEC-T8-12, SEC-T8-13, SEC-T8-14 |
| Info | 1 | SEC-T8-15 |
| **Total** | **13 open + 1 info** | |

---

## Auth Surface Check Matrix

| Check point | live-events WS | chat WS | SSE /ai/chat |
|-------------|---------------|---------|-------------|
| **Origin header validated** | NO (SEC-T8-01) | NO (SEC-T8-01) | N/A (HTTP POST, CORS applies) |
| **Token in header (not query string)** | Optional (SEC-T8-02) | Optional (SEC-T8-02) | N/A — session cookie |
| **Token revocation enforced mid-session** | NO (SEC-T8-04) | NO (SEC-T8-04) | Re-checked per request |
| **Session expiry enforced mid-session** | NO (SEC-T8-04) | NO (SEC-T8-04) | Re-checked per request |
| **Company membership verified** | YES | YES | YES (requirePermission middleware) |
| **Tag-based filtering server-side** | YES (SEC-T8-15) | N/A (channel-scoped) | N/A |
| **Connection limit per user** | NO (SEC-T8-03) | NO (SEC-T8-03) | Rate limited (but see SEC-T8-05/09) |
| **Message size cap** | NO (SEC-T8-06) | Partial — content only (SEC-T8-06) | YES — Zod 10k per message |
| **Message rate limit** | NO (SEC-T8-11) | Partial — chat_message only (SEC-T8-11) | YES — 3 concurrent per user |
| **Inbound message validation (Zod)** | N/A (receive-only) | YES | YES |

---

## Top 5 Risks (Prioritized)

### 1. CSWSH — No Origin validation on both WS endpoints (SEC-T8-01) — HIGH
Any web page running in the victim's browser can subscribe to all real-time events and chat messages. In `authenticated` mode this fully bypasses WS auth because session cookies are browser-attached. **Fix first.**

### 2. Token in query string — URL log poisoning (SEC-T8-02) — HIGH
Agent API keys appear in HTTP logs, CDN logs, and browser history. With no key expiry (SEC-T8-07), a single log breach compromises all agent connections permanently. **Fix second, tied to SEC-T8-07.**

### 3. No connection limit — WS flood DoS (SEC-T8-03) — HIGH
Zero limit on connections per IP/user/company. A single authenticated attacker can exhaust server memory and block all real-time features for all tenants.

### 4. Indirect prompt injection in SSE AI assistant (SEC-T8-08) — MEDIUM
Workflow JSON content is embedded verbatim in the Claude system prompt. Attacker with workflow write access can inject instructions that cause the AI to propose malicious file changes or exfiltrate conversation history.

### 5. WS sessions survive after token revocation / no key TTL (SEC-T8-04 + SEC-T8-07) — HIGH + MEDIUM
Once a WS connection is established with a compromised or subsequently-revoked key, it persists indefinitely. Agent API keys have no expiry column — a leaked key is valid forever.

---

## Recommendations (Prioritized Action List)

### Immediate (High severity)
1. **Add Origin validation** to both WS upgrade handlers — compare against `BETTER_AUTH_TRUSTED_ORIGINS`; in `local_trusted` allow only `http://localhost:<port>`. **(SEC-T8-01)**
2. **Remove query-string token fallback** or redact `?token=...` from access logs. **(SEC-T8-02)**
3. **Implement per-IP and per-user connection limits** (e.g. 20/IP, 5/user) in WS upgrade handlers. **(SEC-T8-03)**
4. **Add periodic auth revalidation** (every 5 min) on existing WS connections. **(SEC-T8-04)**

### Short term (Medium severity)
5. **Add `expiresAt` column to `agent_api_keys`**, default 90-day TTL. **(SEC-T8-07)**
6. **Fix rate limiter key for non-board actors** — use agent ID, not `"anon"`. **(SEC-T8-05)**
7. **Set `maxPayload: 65536`** on both `WebSocketServer` instances. **(SEC-T8-06)**
8. **Sanitize workflow JSON before injecting into system prompt** — wrap in a clearly delimited data block with explicit instruction boundary. **(SEC-T8-08)**
9. **Move AI concurrency counter to Redis** for multi-instance safety. **(SEC-T8-09)**
10. **Rate-limit typing indicators** (max 1/2s per actor per channel). **(SEC-T8-11)**

### Low severity / Housekeeping
11. **Sanitize Anthropic error messages** before forwarding to client. **(SEC-T8-12)**
12. **Add UUID validation** to `mention_agent` payload schema. **(SEC-T8-13)**
13. **Document local_trusted threat model** and consider Origin check even on loopback. **(SEC-T8-14)**

---

## What is Working Correctly (SEC-T8-15)

- Tag-based filtering is 100% server-side — no client-side trust
- `visibility` field is stripped before sending to clients
- Cross-tenant isolation via EventEmitter channel keys is correct
- Chat WS has Zod validation on all inbound message types
- SSE endpoint has `requirePermission(WORKFLOWS_CREATE)` guard
- Abort propagation to Anthropic API on client disconnect is implemented
- Reconnection backoff (exponential, 15s cap) is correctly implemented in the UI
- Ping/pong heartbeat with 30s timeout is implemented on both WS servers
