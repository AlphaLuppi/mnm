---
id: SEC-T6-02
severity: high
category: CWE-798 / OWASP A02
title: Hardcoded fallback "mnm-mcp-dev-secret" for MCP JWT in authenticated mode
file: server/src/mcp/auth/mcp-auth-config.ts:7
status: open
---

## Description

`getMcpJwtSecret()` falls back to the well-known literal `"mnm-mcp-dev-secret"` when `MNM_MCP_JWT_SECRET` is unset:

```typescript
export function getMcpJwtSecret(): string {
  const secret = process.env.MNM_MCP_JWT_SECRET;
  if (secret) return secret;
  const deploymentMode = process.env.MNM_DEPLOYMENT_MODE ?? "local_trusted";
  if (deploymentMode === "local_trusted") return "mnm-mcp-dev-secret";
  throw new Error("MNM_MCP_JWT_SECRET is required in non-local deployments");
}
```

The logic for throwing on non-local deployments is correct. However:

1. `MNM_MCP_JWT_SECRET` is **not documented** in `.env.example` — operators have no inventory signal that this variable needs to be set.
2. `docker-compose.yml` references `MNM_MCP_JWT_SECRET` with a mandatory fail-fast pattern (`${MNM_MCP_JWT_SECRET:?...}`), which is good, but the server code does not enforce this at startup for all deployment paths.

## Impact

An operator deploying via a mechanism other than the provided `docker-compose.yml` (e.g., manual Docker run, Kubernetes, raw systemd) may forget this variable. The server silently falls back to the known literal secret, and attackers with knowledge of the codebase can mint valid MCP JWTs to impersonate arbitrary agents.

## Reproduction (conceptual)

1. Deploy with `MNM_DEPLOYMENT_MODE=authenticated`, omit `MNM_MCP_JWT_SECRET` from the environment.
2. The server code path for local_trusted is NOT taken, so the `throw` fires — this actually protects non-local. **The bug is documentation-only for non-local**, but persists silently for any case where a future code change or misconfiguration ends up using the fallback path.

## Recommendation

- Add `MNM_MCP_JWT_SECRET` to `.env.example` with a clear note that it is mandatory in authenticated mode.
- Add a startup-time check in the server's boot sequence (alongside BETTER_AUTH_SECRET checks) that validates this var is set when in authenticated mode, before the HTTP server begins accepting connections.

## References

- `docker-compose.yml:76` — correct mandatory enforcement via compose syntax
- `.env.example` — variable is absent
- CWE-798, OWASP A02

## Status
**Fixed** : 2026-04-29
**Commit** : TBD
**Fix description** : Added `MNM_MCP_JWT_SECRET`, `MNM_AGENT_JWT_SECRET`, `MNM_SECRETS_KEY`, and `MNM_SECRETS_MASTER_KEY` to `.env.example` under a new "Secrets & signing keys" section, each with a comment explaining they are required in `authenticated` mode and how to generate them. The server-side throw on missing `MNM_MCP_JWT_SECRET` in authenticated mode already existed in `mcp-auth-config.ts` — documentation gap is now closed.
