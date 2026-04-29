---
id: SEC-T6-13
severity: info
category: OWASP A02 / Defense-in-Depth
title: Two separate encryption keyrings (MNM_SECRETS_KEY vs MNM_SECRETS_MASTER_KEY) — potential operator confusion
file: server/src/services/credential.ts + server/src/secrets/local-encrypted-provider.ts
status: open
---

## Description

MnM uses two distinct AES-256-GCM encryption systems with separate keys:

| Keyring | Env var | Key file | Protects |
|---|---|---|---|
| **Credential service** | `MNM_SECRETS_KEY` | None (ephemeral in dev) | Per-user OAuth tokens (`user_credentials` table) |
| **Local encrypted provider** | `MNM_SECRETS_MASTER_KEY` | `data/secrets/master.key` | Company-level secret versions (`company_secret_versions.material`) |

Both use AES-256-GCM with random 12-byte IVs. Both store ciphertext + IV + auth tag in the DB. The implementations are functionally identical but independently maintained, doubling the surface area for cryptographic bugs.

Key differences that create operational friction:
- `MNM_SECRETS_MASTER_KEY` has a file-based fallback with proper persistence.
- `MNM_SECRETS_KEY` has no file fallback — ephemeral in dev.
- Neither shares key material nor documentation about their relationship.
- `secretsMasterKeyFilePath` appears in the startup config struct but `MNM_SECRETS_KEY` does not.

## Impact

Informational. The dual-keyring architecture is not inherently insecure, but increases operator burden and the risk that one keyring is secured while the other is not.

## Recommendation

- Consolidate into a single key hierarchy: use `MNM_SECRETS_MASTER_KEY` (with file-backed fallback) for both credential service and local encrypted provider.
- Or clearly document both keyrings in `.env.example` and operator docs, with the distinction between them explicit.
- Add both to the startup-banner config display.

## References

- `server/src/services/credential.ts:16-37`
- `server/src/secrets/local-encrypted-provider.ts:41-73`
- `server/src/config.ts:52-53` — only `secretsMasterKeyFilePath` appears in Config interface
