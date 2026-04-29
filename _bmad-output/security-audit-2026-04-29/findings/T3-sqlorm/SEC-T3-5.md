---
id: SEC-T3-5
severity: medium
category: OWASP A03 / CWE-89
title: client.ts sql.unsafe() used throughout migration engine without input sanitization
file: packages/db/src/client.ts:120, 138, 159, 182, 218, 290, 423, 461, etc.
status: open
---

## Description

The migration engine in `packages/db/src/client.ts` extensively uses `postgres.js`'s `sql.unsafe()` method, which executes raw SQL strings **without parameterization**:

```ts
// Line 120 — runInTransaction
await sql.unsafe("BEGIN");
await sql.unsafe("COMMIT");
await sql.unsafe("ROLLBACK");

// Line 138 — latestMigrationCreatedAt
const rows = await sql.unsafe<...>(
  `SELECT created_at FROM ${qualifiedTable} ORDER BY created_at DESC NULLS LAST LIMIT 1`,
);

// Line 159 — ensureMigrationJournalTable  
await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${drizzleSchema}`);
await sql.unsafe(
  `CREATE TABLE IF NOT EXISTS ${drizzleSchema}.${migrationTable} (...)`,
);

// Line 182 — migrationHistoryEntryExists
const rows = await sql.unsafe<...>(
  `SELECT 1 AS one FROM ${qualifiedTable} WHERE ${predicates.join(" OR ")} LIMIT 1`,
);

// Line 218 — recordMigrationHistoryEntry
await sql.unsafe(
  `INSERT INTO ${qualifiedTable} (${insertColumns.join(", ")}) VALUES (${insertValues.join(", ")})`,
);
```

### Why this matters

The `qualifiedTable` identifier is constructed using `quoteIdentifier()` which performs whitelist validation (`/^[A-Za-z_][A-Za-z0-9_]*$/`). This is a mitigation. However:

1. **`predicates.join(" OR ")`** at line 182: The predicates array is built from `quoteLiteral(hash)` and `quoteLiteral(migrationFile)` — safe because `quoteLiteral` escapes single quotes. BUT `hash` is a SHA-256 hex string (safe) and `migrationFile` is a filename from the filesystem — potentially unsafe if migration filenames contain special characters.

2. **`insertColumns.join(", ")`** — columns are hardcoded identifiers via `quoteIdentifier()` — safe.

3. **`insertValues.join(", ")`** — values are via `quoteLiteral()` — safe.

4. **Migration content execution** at line 253:
```ts
for (const statement of splitMigrationStatements(migrationContent)) {
  await sql.unsafe(statement);
}
```
This executes raw SQL from migration FILES. The migration files are on-disk application code and not user-controlled, so this is expected behavior. However, if an attacker can write files to the migration directory (path traversal, supply chain compromise), they can execute arbitrary SQL.

5. **`latestMigrationCreatedAt` uses `${qualifiedTable}` string interpolation** inside a template string passed to `unsafe()`. Since `qualifiedTable` is properly quoted, this is functionally safe but violates the principle of never concatenating into `unsafe()`.

## Impact

- **Migration engine context**: This code runs at server startup and requires filesystem access to the migrations folder. Not directly exploitable by end-users.
- **Defense-in-depth gap**: If any of the identifier quoting logic has a bug (e.g., edge case in `isSafeIdentifier`), the `unsafe()` calls become injection vectors.
- **Migration file execution**: A compromised migration file achieves RCE via `COPY ... FROM PROGRAM` or stored procedure creation.

## Reproduction (conceptual PoC)

If a migration filename somehow contains: `'; DROP TABLE agents; --` and bypasses the SHA-256 hash check, it would be injected into `quoteLiteral()` calls. `quoteLiteral` escapes `'` → `''`, so this is mitigated, but the defense is on a narrow implementation.

## Recommendation

1. Replace `sql.unsafe()` with parameterized `sql\`\`` wherever possible — especially for the history entry queries.
2. Add an explicit check: migration filenames must match `/^\d{4}_[a-z0-9_]+\.sql$/` before use.
3. Add a checksum of the migrations folder at startup and alert on unexpected files.
4. The `sql.unsafe("BEGIN/COMMIT/ROLLBACK")` calls are acceptable constants but could be replaced with postgres.js transaction API.

## References

- postgres.js docs: `sql.unsafe()` — explicit unsafe query execution
- CWE-89, CWE-78
