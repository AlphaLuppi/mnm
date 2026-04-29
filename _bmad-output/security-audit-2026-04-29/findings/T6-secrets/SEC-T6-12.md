---
id: SEC-T6-12
severity: info
category: OWASP A02 / Defense-in-Depth
title: No JWT rotation / multi-version key support (kid header) for session or agent tokens
file: server/src/agent-auth-jwt.ts + server/src/auth/better-auth.ts
status: open
---

## Description

The agent JWT signing (`agent-auth-jwt.ts`) uses HMAC-SHA256 with a single symmetric key (`MNM_AGENT_JWT_SECRET`). There is no:

1. **Key ID (`kid`) header** in issued tokens — impossible to identify which key version signed a token.
2. **Multi-version key support** — rotating `MNM_AGENT_JWT_SECRET` immediately invalidates all outstanding tokens (up to 2h TTL by default), causing all running agents to fail authentication.
3. **Graceful rotation period** — no mechanism to accept tokens signed with either the old or new key during a transition window.

Same pattern applies to MCP JWT (`MNM_MCP_JWT_SECRET`).

BetterAuth handles its own session management separately and likely has its own rotation semantics, but the custom JWT implementations do not.

## Impact

Secret rotation is currently a **disruptive event**: rotating `MNM_AGENT_JWT_SECRET` kills all active agent runs. This discourages operators from rotating secrets regularly, increasing the window of exposure if a secret is compromised.

## Recommendation

Add `kid` (key ID) to JWT headers:
```typescript
const header = { alg: "HS256", typ: "JWT", kid: "v1" };
```

Support a transition key registry:
```typescript
const keys = {
  current: { id: "v2", secret: process.env.MNM_AGENT_JWT_SECRET },
  previous: process.env.MNM_AGENT_JWT_SECRET_PREV
    ? { id: "v1", secret: process.env.MNM_AGENT_JWT_SECRET_PREV }
    : null,
};
```

During verification, accept tokens signed by either current or previous key. After the previous key's TTL window expires, remove it.

## References

- `server/src/agent-auth-jwt.ts`
- `server/src/mcp/auth/mcp-auth-config.ts`
- RFC 7517: JSON Web Key (JWK) — `kid` parameter
- OWASP: Key Management Cheat Sheet
