---
id: SEC-T3-9
severity: critical
category: OWASP A01 / CWE-284
title: MCP tool handlers call setTenantContext() but NEVER call clearTenantContext() — guaranteed RLS context leak on pooled connections
file: server/src/mcp/tools/governed-workflows.tool.ts:119,153,192,236,280,317,354,386,417,446,483,564,651,742,789,878,906,944 (18 call sites)
status: open
---

## Description

Every MCP tool handler in `governed-workflows.tool.ts` calls `setTenantContext(services.db, actor.companyId)` (using `is_local=false`, session scope) but **`clearTenantContext` is never called** in any non-test MCP production code.

```ts
// governed-workflows.tool.ts:119 (and 17 more identical call sites)
await setTenantContext(services.db, actor.companyId);
const rows = await services.governedWorkflows.listDefinitions(...);
// ← NO clearTenantContext() call. Context remains on connection.
```

The documentation in `tenant-context.ts` is explicit:
```
// Callers MUST guarantee a matching `clearTenantContext(db)` call in a `finally` block
// to prevent the value from leaking when the connection is returned to the pool.
```

This guarantee is violated for **all 18 MCP tool handlers** in governed-workflows.tool.ts.

### Confirmation of missing cleanup

Running `grep -rn "clearTenantContext" server/src/mcp/` (excluding tests) returns NO results in production files. The `setTenantContext` export is used 18 times in `governed-workflows.tool.ts` and zero times with a corresponding `clearTenantContext`.

### MCP session architecture amplifies the risk

MCP tool invocations share long-lived connections. When tool A for company X sets the context and returns without cleaning, the SAME connection (returned to the pool) is reused by tool B for company Y. Tool B's queries will execute under company X's RLS context.

The `wrap()` function (lines 71-105) that wraps every handler catches errors but does not call `clearTenantContext` in a finally block.

## Impact

- **CRITICAL: Cross-tenant data leakage via RLS context pollution** — MCP requests from company Y could read/write company X's data.
- Since MCP is authenticated (agents and board users), this is exploitable by any legitimate MCP user.
- The window of exposure: any MCP request after a previous MCP request by a DIFFERENT company that hit the same connection.
- With 40 pooled connections and multiple concurrent tenants, this will happen in production under normal load.
- Tables affected: ALL 41 RLS-protected tables accessible via governed-workflow service calls.

## Reproduction (conceptual PoC)

1. Agent A (company X) calls `list_governed_workflows`. Sets `app.current_company_id = UUID-X`. Connection returned to pool with UUID-X set.
2. Agent B (company Y) calls `list_governed_workflows` on the SAME pooled connection. `setTenantContext(UUID-Y)` is called, overwriting — but if step 1 fails between `setTenantContext` and the DB call (timeout, etc.), UUID-X leaks.
3. More critically: if Agent A's request succeeds and returns without clearing, and Agent B's first DB query runs before `setTenantContext` fires, Agent B sees Agent A's data.

The timing window exists because `setTenantContext` is called INSIDE the handler, not as a connection-checkout hook.

## Recommendation

**Immediate fix**: Wrap all `setTenantContext` calls with `try/finally`:

```ts
// In the wrap() function, or in each handler:
try {
  await setTenantContext(services.db, actor.companyId);
  const result = await fn();
  return result;
} finally {
  await clearTenantContext(services.db).catch((err) => {
    logger.error({ err }, "Failed to clear MCP tenant context — RLS leak risk");
  });
}
```

**Better fix**: Move `setTenantContext`/`clearTenantContext` into the `wrap()` function itself so it's automatic for all handlers:

```ts
async function wrap<T>(
  db: Db,
  actor: { companyId: string },
  fn: () => Promise<T>,
): Promise<T> {
  await setTenantContext(db, actor.companyId);
  try {
    return await fn();
  } finally {
    await clearTenantContext(db).catch(() => {});
  }
}
```

**Best fix**: Use `is_local=true` (transaction-scoped) so the context auto-clears when the transaction ends, eliminating the need for manual cleanup.

## References

- `server/src/middleware/tenant-context.ts:90-100` — explicit documentation of the cleanup requirement
- CWE-284: Improper Access Control
- CWE-272: Least Privilege Violation
- OWASP A01:2021 — Broken Access Control
