---
id: SEC-T3-2
severity: critical
category: OWASP A03 / CWE-89
title: Backup utility uses sql(tablename) — dynamic table name injection in postgres.js
file: packages/db/src/backup-lib.ts:257,272,299
status: open
---

## Description

The backup library (`backup-lib.ts`) uses the `postgres` driver (`postgres-js`) directly (not Drizzle ORM). It queries table names from `pg_class`/`information_schema` and then uses those names as **dynamic SQL identifiers** via the `sql()` tag helper from postgres.js:

```ts
// Line 257: Count query
const count = await sql<{ n: number }[]>`
  SELECT count(*)::int AS n FROM ${sql(tablename)}
`;

// Line 272: Full table SELECT
const rows = await sql`SELECT * FROM ${sql(tablename)}`.values();

// Line 299: Sequence query  
const val = await sql<{ last_value: string }[]>`
  SELECT last_value::text FROM ${sql(seq.sequence_name)}
`;
```

In postgres.js, `sql(identifier)` is the **identifier quoting** mechanism (not parameterization). However, `tablename` is sourced from `pg_class.relname` and `seq.sequence_name` from `information_schema.sequences` — these are system catalog values. The critical risk is:

1. **postgres.js `sql()` helper for identifiers does NOT prevent all injection** — it provides limited quoting but depends on whether the identifier contains special characters.
2. **Information schema as attack surface**: If PostgreSQL catalog names contain embedded quotes or special characters from a compromised migration or from a malicious superuser creating tables with adversarial names, these could break the quoting.
3. **No whitelist of expected table names** — any table in the `public` schema is queried, including tables that may have been added by an attacker who gained DDL access.

More critically, the backup function is called with the **full postgres connection** (not scoped to RLS), and does `SELECT * FROM ${sql(tablename)}` which bypasses RLS entirely since RLS is not enforced on superuser connections.

## Impact

- **RLS bypass**: The backup operation runs without `app.current_company_id` being set, so it reads ALL rows across ALL tenants from ALL tables. This is by design for backup, but it means this code path has access to ALL tenant data. A successful injection here would exfiltrate cross-tenant data.
- **Cross-tenant data exposure**: If an attacker can trigger the backup endpoint with a crafted tablename, they could potentially redirect the `SELECT *` to a different table or inject subqueries.
- **No authorization check visible on the call site** — need to verify who can trigger backup (see SEC-T3-2 recommendation).

## Reproduction (conceptual PoC)

If a table named `"agents"; SELECT pg_sleep(5); --` existed in the public schema, the query:
```sql
SELECT * FROM "agents"; SELECT pg_sleep(5); --
```
...would execute two statements. The postgres.js driver may or may not support multi-statement depending on configuration.

Realistically: tablenames come from the system catalog and are controlled by DDL access. But the combination of no RLS + dynamic identifiers creates a defense-in-depth gap.

## Recommendation

1. **Whitelist tables from the Drizzle schema** instead of querying `pg_class` dynamically:
```ts
import * as schema from './schema/index.js';
const KNOWN_TABLES = Object.keys(schema).filter(k => schema[k]?.[Symbol.for('drizzle:Name')]);
```
2. Add an explicit allowlist check: `if (!KNOWN_TABLES.includes(tablename)) continue;`
3. Verify that the backup endpoint is protected by an admin-only permission check and cannot be triggered by regular users.
4. Consider using `pg_dump` subprocess instead of custom SQL iteration for the backup.

## References

- postgres.js docs: identifier quoting with `sql(name)` 
- CWE-89, OWASP A03:2021 — Injection
