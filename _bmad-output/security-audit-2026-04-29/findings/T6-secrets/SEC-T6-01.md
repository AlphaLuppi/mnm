---
id: SEC-T6-01
severity: high
category: CWE-798 / OWASP A02
title: Hardcoded fallback secret "mnm-dev-secret" used for BetterAuth in authenticated mode
file: server/src/auth/better-auth.ts:180
status: open
---

## Description

`createBetterAuthInstance()` resolves the BetterAuth secret via:

```
const secret = process.env.BETTER_AUTH_SECRET ?? process.env.MNM_AGENT_JWT_SECRET ?? "mnm-dev-secret";
```

The final fallback is the well-known literal `"mnm-dev-secret"`. Unlike `agent-auth-jwt.ts` which gates the fallback on `deploymentMode === "local_trusted"`, this fallback is unconditional — it applies even when `MNM_DEPLOYMENT_MODE=authenticated`.

Historical note: commit `b7a7dacf` (Apr 8 2026) attempted to remove this pattern, but a subsequent commit (`b2496c80`) reintroduced it — the current code still has the `"mnm-dev-secret"` fallback on line 180.

## Impact

If a production operator forgets to set `BETTER_AUTH_SECRET` and `MNM_AGENT_JWT_SECRET`, all BetterAuth sessions (JWT signing + cookie encryption) are derived from a publicly known constant. An attacker can forge valid session cookies for any user account, bypassing authentication entirely.

## Reproduction (conceptual)

1. Deploy with `MNM_DEPLOYMENT_MODE=authenticated` but without setting `BETTER_AUTH_SECRET`.
2. Sign a BetterAuth session JWT using the known secret `"mnm-dev-secret"`.
3. Present the forged cookie to any authenticated endpoint and observe successful access.

## Recommendation

Add a deployment-mode guard identical to the one in `agent-auth-jwt.ts`:

```typescript
const secret = process.env.BETTER_AUTH_SECRET ?? process.env.MNM_AGENT_JWT_SECRET;
if (!secret) {
  const mode = process.env.MNM_DEPLOYMENT_MODE ?? "local_trusted";
  if (mode !== "local_trusted") {
    throw new Error("BETTER_AUTH_SECRET must be set in authenticated mode");
  }
  // safe dev fallback for local_trusted only
}
```

Alternatively, remove the hardcoded fallback entirely and rely on the startup-banner/check system to surface missing secrets before the server accepts traffic.

## References

- Previous partial fix: commit `b7a7dacf` — "fix: remove hardcoded JWT secret fallback from createBetterAuthInstance"
- Reintroduction: commit `b2496c80`
- CWE-798: Use of Hard-coded Credentials

## Status
**Fixed** : 2026-04-29
**Commit** : 00ee0f9a8100e9cfa632bab2d326d1358d04a724
**Fix description** : `createBetterAuthInstance` in `server/src/auth/better-auth.ts` now gates the `"mnm-dev-secret"` fallback on `MNM_DEPLOYMENT_MODE !== "authenticated"`. In `authenticated` mode with no secret set, it throws `FATAL: BETTER_AUTH_SECRET (or MNM_AGENT_JWT_SECRET) is required in authenticated mode`. Identical to the guard that already existed in `agent-auth-jwt.ts`.
