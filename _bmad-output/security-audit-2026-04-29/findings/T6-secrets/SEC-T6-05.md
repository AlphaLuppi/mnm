---
id: SEC-T6-05
severity: medium
category: CWE-798 / OWASP A02
title: Three undocumented production secrets missing from .env.example
file: .env.example + server/src/services/credential.ts + server/src/mcp/auth/mcp-auth-config.ts
status: open
---

## Description

Three secrets that are **required in production** are absent from `.env.example`:

| Variable | Where used | Consequence if missing |
|---|---|---|
| `MNM_SECRETS_KEY` | `server/src/services/credential.ts:17` | In production (`NODE_ENV=production`) throws a fatal error. In dev, uses an ephemeral random key (credentials lost on restart). |
| `MNM_MCP_JWT_SECRET` | `server/src/mcp/auth/mcp-auth-config.ts:4` | In authenticated mode, throws. In local_trusted, uses well-known fallback. |
| `MNM_AGENT_JWT_SECRET` | `server/src/agent-auth-jwt.ts:31` | In non-local deployments, throws. In local_trusted, uses well-known fallback `"mnm-dev-secret"`. |

`.env.example` documents `BETTER_AUTH_SECRET` (line 46) but mentions it as commented-out with `change-me-to-a-random-string` — which is a reasonable pattern. The three variables above are not mentioned at all.

Additionally, `MNM_SECRETS_KEY` vs `MNM_SECRETS_MASTER_KEY` creates a namespace confusion: `credential.ts` uses `MNM_SECRETS_KEY` (for OAuth credential encryption), while `local-encrypted-provider.ts` uses `MNM_SECRETS_MASTER_KEY` (for company secrets). These serve different encryption keyrings — but neither distinction nor relationship is documented.

## Impact

Operators following the `.env.example` documentation will deploy authenticated instances missing `MNM_SECRETS_KEY` and `MNM_MCP_JWT_SECRET`. While the code throws errors in many cases, the risk is:
- A developer testing `NODE_ENV` not set to `"production"` unknowingly runs with the ephemeral key and loses all stored OAuth credentials on restart.
- The startup-banner check only checks `MNM_AGENT_JWT_SECRET`, not `MNM_SECRETS_KEY` or `MNM_MCP_JWT_SECRET`.

## Recommendation

Add the following to `.env.example`:

```dotenv
# --- Encryption keys (authenticated mode) ------------------------------------
# REQUIRED in production — generate with: openssl rand -hex 32
# MNM_SECRETS_KEY=<64-char hex>         # OAuth credential encryption
# MNM_SECRETS_MASTER_KEY=<64-char hex>  # Company secret encryption (alternative to key file)
# MNM_AGENT_JWT_SECRET=<random string>  # Agent JWT signing
# MNM_MCP_JWT_SECRET=<random string>    # MCP JWT signing
```

Add startup-time validation (fail-fast) checking all four secrets are set when `MNM_DEPLOYMENT_MODE=authenticated`.

## References

- `server/src/services/credential.ts:16-33`
- `server/src/secrets/local-encrypted-provider.ts:41-73`
- `.env.example:46` (only BETTER_AUTH_SECRET documented)
- CWE-798
