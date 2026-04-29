---
id: SEC-T3-6
severity: high
category: OWASP A03 / CWE-89
title: RLS context uses session-scope (is_local=false) — tenant context leak risk on pooled connections
file: server/src/middleware/tenant-context.ts:64, 99
status: open
---

## Description

The RLS tenant context is set using `is_local=false` (session scope, not transaction-local):

```ts
// tenant-context.ts:64
await db.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, false)`);

// tenant-context.ts:99  
await db.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, false)`);
```

The `false` parameter means the setting persists for the **entire session** (connection), not just the current transaction. With a connection pool (`max: 40` in client.ts), this creates a risk that:

1. **Cleanup race**: The cleanup runs on `res.on('close')` and `res.on('finish')`. If there is any exception that prevents these events from firing, or if the cleanup itself fails (logged at WARN level, not fatal), the next request using the same pooled connection will inherit the previous tenant's RLS context.

2. **Background jobs**: The `setTenantContext()` export is called from background services (WebSocket handlers, trace capture, etc.). If these callers fail to call `clearTenantContext()` in a `finally` block, cross-tenant data leakage occurs silently.

3. **The `bronze-trace-capture.ts` uses `is_local=true`** (transaction scope):
```ts
await tx.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, true)`);
```
This is **correct** for transaction-scoped context. But the HTTP middleware path uses `false` — a discrepancy.

### Why is_local=true is safer

With `is_local=true` (transaction-local), the setting automatically resets when the transaction ends. With `is_local=false`, a cleanup call is REQUIRED and failure is a security bug, not a correctness bug.

The code comments acknowledge this risk ("possible RLS leak risk") but the design is inherently fragile.

## Impact

- **Cross-tenant data leakage**: If cleanup fails, requests from tenant B execute with tenant A's RLS context, potentially exposing or modifying tenant A's data to tenant B.
- The risk is mitigated by PostgreSQL's `FORCE ROW LEVEL SECURITY` and the `RESTRICTIVE` policy type, but only partially: if the previous context had a valid UUID, PostgreSQL will enforce that UUID's RLS — showing tenant A's data to tenant B rather than showing no data (fail-open scenario for cross-tenant reads).
- This is not a SQL injection per se, but a critical RLS bypass vector.

## Reproduction (conceptual PoC)

1. Company A request sets `app.current_company_id = UUID-A`.
2. Connection returned to pool. Cleanup fires, clears to `''`.
3. Company B request picked up on same connection — but if step 2 fails (network error during cleanup async call), the connection has `UUID-A` set.
4. Company B queries now see Company A's data.

## Recommendation

1. **Switch HTTP middleware to `is_local=true`** (transaction-scoped). Wrap every request in a transaction to ensure the RLS context is auto-cleaned:
```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, true)`);
  // all DB operations in the request happen here
});
```
2. Alternatively, implement connection validation on pool checkout that verifies `current_setting('app.current_company_id', true)` is `''` before use.
3. Make cleanup failure a **fatal** event (crash the request with 500 + log) rather than a WARN.
4. Add a pre-request assertion: if `current_setting('app.current_company_id', true) != ''`, reject the connection and log a security alert.

## References

- PostgreSQL: `set_config()` documentation — is_local parameter
- CWE-284: Improper Access Control
- OWASP A01:2021 — Broken Access Control
