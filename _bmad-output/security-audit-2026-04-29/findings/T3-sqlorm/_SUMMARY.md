# T3 — SQL/ORM Injection Audit Summary

**Date**: 2026-04-29  
**Auditors**: Team T3 (whitebox, redhat+blackhat+whitehat perspective)  
**Scope**: `server/src/`, `packages/db/src/`, `packages/adapters/`, `packages/gate-runner/`, migrations  
**ORM**: Drizzle ORM (tagged template parameterization) + postgres.js (direct driver)

---

## Stats by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 2 | SEC-T3-2, SEC-T3-9 |
| High | 2 | SEC-T3-1, SEC-T3-6 |
| Medium | 2 | SEC-T3-3, SEC-T3-5 |
| Low | 1 | SEC-T3-7 |
| Info | 2 | SEC-T3-4, SEC-T3-8 |
| **Total** | **9** | |

---

## All sql``, sql.raw(), db.execute(), and concat patterns Found

### Safe patterns (parameterized via Drizzle template literals)
| File | Pattern | Safe? |
|------|---------|-------|
| `server/src/middleware/tenant-context.ts:64` | `sql\`SELECT set_config(..., ${companyId}, false)\`` | YES — bound param |
| `server/src/services/bronze-trace-capture.ts:25` | `sql\`SELECT set_config(..., ${companyId}, true)\`` | YES — transaction-local |
| `server/src/services/gold-trace-enrichment.ts:63` | `sql\`SELECT set_config(..., ${companyId}, true)\`` | YES — transaction-local |
| `server/src/services/silver-trace-enrichment.ts:304` | `sql\`SELECT set_config(..., ${companyId}, true)\`` | YES — transaction-local |
| `server/src/services/heartbeat.ts:1536,1637` | `sql\`SET config + UPDATE traces\`` | YES — transaction-local |
| `server/src/services/activity.ts:104` | `sql\`... ->> 'issueId' = ${issueId}\`` | YES — bound param, static key |
| `server/src/routes/agents.ts:1706` | `sql\`... ->> 'issueId' = ${issue.id}\`` | YES — bound param, static key |
| `server/src/services/chat.ts:101,153` | `sql\`${chatChannels.lastMessageAt} DESC NULLS LAST\`` | YES — column ref only |
| `server/src/services/chat.ts:142` | `sql\`${chatChannels.agentId}::text IN (...)\`` | YES — bound params via sql.join |
| `server/src/services/issues.ts:434-445` | `sql\`... ILIKE ${pattern} ESCAPE '\\\\'\`` | YES — bound, escaped |
| `server/src/services/issues.ts:488` | `sql\`... IN (${sql.join(...)})\`` | YES — Drizzle parameterized join |
| `server/src/services/tag-filter.ts:39,109,118` | `sql\`... = ${userId}\`` | YES — bound params |
| `server/src/services/folder.ts:108-116` | `sql\`SELECT ... WHERE ... = ${folderId}::text\`` | YES — bound params |
| `server/src/services/a2a-bus.ts:563-567` | `sql\`CASE WHEN status = 'pending'\`` | YES — static literals |
| `server/src/services/bronze-trace-capture.ts:265-275` | `sql\`UPDATE traces SET ...\`` | YES — bound params |
| `server/src/routes/health.ts:39,42,91` | `sql\`SELECT 1\`, \`SHOW server_version\`, pg_tables query\`` | YES — static |
| `server/src/auth/better-auth.ts:249` | `sql\`INSERT INTO instance_user_roles ... ${user.id}\`` | YES — bound param |

### Suspicious/Unsafe patterns requiring attention
| File | Pattern | Risk |
|------|---------|------|
| `packages/db/src/backup-lib.ts:257,272,299` | `sql(tablename)`, `sql(seq.sequence_name)` | HIGH — postgres.js identifier quoting, no whitelist |
| `packages/db/src/client.ts:120,138,159,182,218,etc.` | `sql.unsafe(...)` throughout migration engine | MEDIUM — mitigated by quoteIdentifier/quoteLiteral helpers |
| `server/src/services/rag.ts:26,36,41` | `vectorStr = \`[${embedding.join(",")}]\`` interpolated in sql`` | HIGH — float array from external API, no validation |
| Multiple routes | `Number(req.query.limit)` → `.limit(NaN)` | MEDIUM — no NaN guard |

### No sql.raw() found
No occurrences of `sql.raw(` were found anywhere in the production codebase. This is good.

---

## Top 5 Risks

### 1. [CRITICAL] SEC-T3-9 — MCP tools never call clearTenantContext()
`server/src/mcp/tools/governed-workflows.tool.ts` — 18 handlers call `setTenantContext()` with `is_local=false` but never call `clearTenantContext()`. This guarantees RLS context leakage between tenants via pooled connections. Any multi-tenant MCP session is vulnerable.

### 2. [CRITICAL] SEC-T3-2 — Backup utility uses dynamic table names from catalog
`packages/db/src/backup-lib.ts` — `sql(tablename)` from `pg_class` query, no whitelist against Drizzle schema. The backup connection is also RLS-bypassing (no tenant context), meaning a successful injection returns cross-tenant data.

### 3. [HIGH] SEC-T3-6 — HTTP tenant context uses is_local=false, cleanup failure is silent
`server/src/middleware/tenant-context.ts` — cleanup fires on `res.on('close')` which is async and can silently fail. Failure is logged at WARN level only. Background services (`setTenantContext` export) have no cleanup mechanism.

### 4. [HIGH] SEC-T3-1 — RAG vector embedding string built without numeric validation
`server/src/services/rag.ts` — `queryEmbedding.join(",")` used in sql template literal cast. No validation that all elements are finite numbers. Future code paths accepting user-provided vectors would be injectable.

### 5. [MEDIUM] SEC-T3-5 — Migration engine uses sql.unsafe() extensively
`packages/db/src/client.ts` — 15+ calls to `sql.unsafe()` with string-concatenated SQL. Protected by `quoteIdentifier`/`quoteLiteral` helpers, but defense-in-depth is thin. Migration files themselves are executed as raw SQL.

---

## Overall Security Assessment

### What's Good
- **No `sql.raw()` usage** anywhere in production code — the most dangerous Drizzle escape hatch is absent.
- **Drizzle tagged template literals** are used correctly throughout for query parameterization.
- **RLS is comprehensive**: 41 tables covered with `FORCE ROW LEVEL SECURITY` and `RESTRICTIVE` policies.
- **ILIKE search** correctly uses `ESCAPE` clause and escapes metacharacters.
- **UUID validation** in tenant context middleware prevents non-UUID values from reaching `set_config`.
- **Background services** (bronze/gold/silver trace, heartbeat) correctly use `is_local=true` (transaction-scoped) — the right pattern.
- **sortBy injection is non-existent**: sort parameters are validated against enum values before use.
- **No dynamic column names** in `orderBy` — all column references are Drizzle table column objects.

### What's Broken
- **MCP tool cleanup** (SEC-T3-9) is a production bug with real cross-tenant leakage risk, not theoretical.
- **Backup utility** (SEC-T3-2) is an admin-only path but its combination of dynamic identifiers + RLS bypass is architecturally dangerous.
- **NaN limit handling** (SEC-T3-3) affects multiple routes and could cause unbounded result sets.

---

## Global Recommendation

1. **Immediate**: Fix SEC-T3-9 — add `clearTenantContext` to `wrap()` in governed-workflows.tool.ts.
2. **Short-term**: Add a `parseQueryInt(value, default, max)` utility and apply universally to all limit/offset params.
3. **Medium-term**: Refactor backup-lib to use a whitelist of known tables from the Drizzle schema.
4. **Linter rule**: Consider an ESLint rule that flags `setTenantContext` calls not followed by `clearTenantContext` in a `finally` block within the same function scope.
5. **Architecture**: Migrate all `is_local=false` uses to `is_local=true` with transaction wrappers — eliminates the entire class of connection leak risk.
6. **Forbid `sql.raw(` in linter**: Add an ESLint no-restricted-syntax rule for `sql.raw(` to prevent its future introduction.

---

## Inventory of All sql`` Template Usages (for complete audit record)

### server/src/services/ (all uses verified safe by dataflow)
- `activity.ts` — JSONB operators with bound params
- `a2a-bus.ts` — CASE expressions with static literals
- `automation-cursors.ts` — column references only
- `bronze-trace-capture.ts` — UPDATE with bound params, transaction-local context
- `chat.ts` — ORDER BY column ref, tag filter with sql.join
- `config-layer-conflict.ts` — advisory lock with bound params
- `config-layer-runtime.ts` — advisory lock with bound params
- `config-layer.ts` — advisory lock with bound params
- `costs.ts` — aggregations with bound params
- `dashboard.ts` — aggregations with bound params
- `feedback.ts` — aggregations with bound params
- `folder.ts` — visibility conditions with bound params
- `gold-trace-enrichment.ts` — transaction-local context set
- `governed-workflows.ts` — all standard Drizzle ORM calls
- `governed-workflows-extensions.ts` — standard Drizzle calls
- `governed-workflows-helpers.ts` — standard Drizzle calls
- `heartbeat.ts` — UPDATE with bound params, transaction-local context
- `issues.ts` — ILIKE with escape, sql.join for IN clauses
- `jira-import.ts` — no raw SQL
- `project-memberships.ts` — standard Drizzle calls
- `rag.ts` — **SUSPICIOUS**: vectorStr concatenation (SEC-T3-1)
- `routines.ts` — standard Drizzle calls
- `silver-trace-enrichment.ts` — transaction-local context set
- `tag-filter.ts` — visibility conditions with bound params
- `trace-service.ts` — standard Drizzle calls

### server/src/routes/ (verified safe)
- `agents.ts` — JSONB operator with bound params
- `folders.ts` — tag JOIN with bound params
- `health.ts` — static queries only
- Chat/governed-workflows routes — standard Drizzle or validated params

### packages/db/src/
- `backup-lib.ts` — **SUSPICIOUS** `sql(tablename)` (SEC-T3-2)
- `client.ts` — **SUSPICIOUS** `sql.unsafe()` migration engine (SEC-T3-5)
- `schema/*.ts` — safe schema definitions only
