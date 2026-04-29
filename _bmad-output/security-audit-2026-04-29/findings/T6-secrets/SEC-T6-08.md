---
id: SEC-T6-08
severity: medium
category: CWE-321 / OWASP A02
title: MNM_SECRETS_KEY loaded at module-level as singleton — ephemeral dev key silently breaks credential persistence
file: server/src/services/credential.ts:37
status: open
---

## Description

```typescript
// credential.ts:37
const ENCRYPTION_KEY = loadEncryptionKey();
```

`loadEncryptionKey()` is called once at module import. If `MNM_SECRETS_KEY` is unset and `NODE_ENV !== "production"`, a fresh `randomBytes(32)` is generated. This means:

1. **Every process restart** uses a different encryption key.
2. All existing `userCredentials` rows (OAuth tokens, etc.) become **permanently unreadable** after a restart.
3. `credential.ts:32` logs only a `warn` — no crash, no clear user-facing error.

In practice, an operator running in staging (NODE_ENV=staging or undefined) with credentials stored will silently lose all OAuth credential data on every deployment.

This is distinct from `local-encrypted-provider.ts` which generates a key file on disk and reuses it across restarts (`data/secrets/master.key`). The credential service has no equivalent persistence.

## Impact

- OAuth credentials stored via `storeCredential()` become inaccessible after restart without `MNM_SECRETS_KEY`.
- Users must re-authenticate all connected services after every server restart in staging environments.
- Silent data loss — operators may not notice until users report broken integrations.

## Recommendation

1. Extend the key file fallback from `local-encrypted-provider.ts` to `credential.ts`: if `MNM_SECRETS_KEY` is unset, generate a file-backed key (e.g., `data/secrets/credential.key`) so the key persists across restarts.
2. Alternatively, reuse the same key material as `MNM_SECRETS_MASTER_KEY` for consistency (single key hierarchy).
3. Add the key file path to `.gitignore` and the startup banner display.
4. Escalate the `warn` to a structured startup check with remediation hint.

## References

- `server/src/services/credential.ts:16-37`
- `server/src/secrets/local-encrypted-provider.ts:41-73` (model for file-backed key)
- CWE-321: Use of Hard-coded Cryptographic Key
