---
id: SEC-T8-04
severity: high
category: CWE-613 Insufficient Session Expiration / CWE-672 Operation on a Resource after Expiration or Release
title: WS sessions survive after token revocation — no mid-session auth revalidation
file: server/src/realtime/live-events-ws.ts:175-202 / server/src/realtime/chat-ws.ts:237-269
status: open
---

## Description

Authentication for WebSocket connections is performed only at connection establishment (upgrade time). Once a connection is established, no periodic re-check occurs. This affects both token-based (agent API key) and session-cookie-based (board user) authentication.

**Agent API keys**: The `agentApiKeys` table has a `revokedAt` column. When an admin revokes an agent's key, existing open WS connections receive no notification and remain subscribed until the client disconnects or the ping/pong timeout fires (up to 30s after a network drop — actually indefinitely if the OS keepalive keeps the TCP connection alive).

**Board sessions (authenticated mode)**: BetterAuth sessions have an expiry and can be invalidated server-side (e.g. logout, admin revocation). Existing WS connections re-use the resolved session from upgrade time and are never re-verified.

**Agent API keys have no `expiresAt` column** (confirmed from `packages/db/src/schema/agent_api_keys.ts`). There is no mechanism for keys to auto-expire. Combined with the query-string token leak (SEC-T8-02), a compromised key provides indefinite WS access.

## Impact

- **Post-revocation access**: A revoked agent key or expired session continues to receive live events until the WS connection is closed. In the worst case (persistent client with TCP keepalive and no application-level ping timeout failure), this is unbounded.
- **Insider threat / offboarding gap**: When an agent is terminated or an employee is offboarded, their WS streams stay open.
- **Key compromise window**: An attacker who steals a key and opens a WS connection retains access even after the key is revoked in the DB.

The ping/pong mechanism (30s interval) only detects dead TCP connections — it has no connection to auth validation.

## Reproduction

1. Agent opens WS connection with valid key.
2. Admin revokes the key in DB (`UPDATE agent_api_keys SET revoked_at = NOW() WHERE id = $1`).
3. Agent's WS connection continues to receive events.
4. Verify: wait 60s (past the 30s ping cycle) — connection is still alive and receiving events.

## Recommendation

1. **Periodic session re-validation**: add a per-connection timer (e.g. every 5 minutes) that re-checks the key/session validity. If invalid → close the socket with code 4401.
2. **Revocation push**: on key revocation (route `DELETE /api/keys/:id`), trigger an in-process notification that terminates all WS connections authenticated with that key. This requires a registry of `keyHash → Set<WsSocket>`.
3. **Add `expiresAt` to `agent_api_keys`**: issue short-lived keys (e.g. 24h) and require clients to refresh. The WS client should reconnect with a new token before expiry.
4. **BetterAuth session invalidation hook**: subscribe to session deletion events to forcibly close associated WS connections.
