---
id: SEC-T6-11
severity: low
category: CWE-200 / OWASP A09
title: Backup script logs connection string path but uses postgres client — connection string in postgres process env
file: packages/db/src/backup.ts:98-100 + packages/db/src/backup-lib.ts:54
status: open
---

## Description

The database backup script logs the config file path and backup directory to stdout but **does not log the connection string directly**. However, the backup uses `postgres(opts.connectionString, ...)` which initializes a native postgres client. On Linux/macOS, the connection string (containing username and password) becomes visible in `/proc/<pid>/environ` or via `ps aux` output if any debugging or monitoring tool enumerates the process environment.

Additionally, `backup.ts` uses `console.log` to display the config path which could expose the MNM_HOME directory structure. This is informational, not directly a secret leak.

The more significant issue is that backup files are SQL dumps stored in plaintext at `MNM_DB_BACKUP_DIR`. These SQL files include all data including encrypted credential materials (`user_credentials.material` columns). While these are AES-256-GCM encrypted, the encryption key (`MNM_SECRETS_KEY`) is stored separately — but if an attacker has filesystem access, they typically have access to both.

## Impact

- Backup SQL files in plaintext contain encrypted credential blobs — access to both backup files and the encryption key allows full credential recovery.
- No backup encryption at rest.

## Recommendation

- Consider encrypting backup files at rest using `gpg --symmetric` or similar before writing to disk.
- Validate that the backup directory permissions are restricted (0700 or equivalent).
- The `loadEncryptionKey()` function already generates a key file at `data/secrets/master.key` with mode `0600` — document that backup files should be stored with equivalent protection.

## References

- `packages/db/src/backup.ts:91-120`
- `packages/db/src/backup-lib.ts:54`
- CWE-200: Exposure of Sensitive Information
