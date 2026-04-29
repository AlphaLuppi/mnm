---
id: SEC-T3-3
severity: medium
category: OWASP A03 / CWE-89
title: Unvalidated Number() conversion for limit/offset — NaN passed to Drizzle .limit()/.offset()
file: server/src/routes/chat.ts:72-73, server/src/routes/agents.ts:1643-1644, multiple routes
status: open
---

## Description

Multiple route handlers convert query parameters to numbers using `Number()` without NaN validation:

```ts
// chat.ts:72-73
const limit = req.query.limit ? Number(req.query.limit) : undefined;
const offset = req.query.offset ? Number(req.query.offset) : undefined;

// agents.ts:1643-1644
const afterSeq = Number(req.query.afterSeq ?? 0);
const limit = Number(req.query.limit ?? 200);
```

The service-layer calls then pass these directly to Drizzle:
```ts
db.select().from(chatChannels).limit(limit).offset(offset)
```

If `req.query.limit = "abc"`, then `Number("abc") === NaN`. Drizzle's `.limit(NaN)` and `.offset(NaN)` behavior with NaN:
- Drizzle may emit `LIMIT NaN` which PostgreSQL interprets as `LIMIT NULL` (no limit) or throws an error depending on pg version.
- `LIMIT NULL` in PostgreSQL means **no limit** — returns the entire result set.

**Affected routes:**
- `GET /companies/:companyId/chat/channels` (chat.ts:72-73)
- `GET /companies/:companyId/heartbeat-runs/:id/events` (agents.ts:1643-1644 — uses `Number.isFinite` check, partially mitigated)
- `GET /companies/:companyId/artifacts` (artifacts.ts:55-56)
- `GET /companies/:companyId/folders` (folders.ts:76-77)
- `GET /companies/:companyId/documents` (documents.ts:134-135 — uses `parseInt` which also returns NaN)
- `GET /companies/:companyId/drift/*` (drift.ts multiple)

**Partially mitigated case**: `agents.ts:1644` has `Number.isFinite(limit) ? limit : 200` fallback — this is the CORRECT pattern. But many other callers lack this guard.

Note: `chat.ts:72` uses the ternary `req.query.limit ? Number(...) : undefined` which only guards against absent parameter, not `"abc"` or `"0"` (falsy but valid).

## Impact

- **DoS / resource exhaustion**: `LIMIT NaN` → no limit → full table scan returned to client. For high-volume tables (heartbeat_runs, traces, activity_log), this could return millions of rows.
- **Information disclosure**: An attacker could bypass intended pagination to retrieve more data than authorized.
- **Memory pressure**: Large result sets could cause the Node.js server to OOM.

The attack requires an authenticated user (all routes are behind auth middleware), reducing severity from critical to medium.

## Reproduction (conceptual PoC)

```
GET /api/companies/{id}/chat/channels?limit=abc&offset=abc
```
Results in `LIMIT NaN OFFSET NaN` → PostgreSQL returns all rows / error.

```
GET /api/companies/{id}/chat/channels?limit=99999999
```
Results in 99 million rows queried (no upper bound enforcement).

## Recommendation

Apply a consistent guard pattern at all query param extraction points:

```ts
function parseQueryInt(value: unknown, defaultValue: number, maxValue?: number): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : defaultValue;
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return maxValue !== undefined ? Math.min(n, maxValue) : n;
}

const limit = parseQueryInt(req.query.limit, 50, 500);
const offset = parseQueryInt(req.query.offset, 0);
```

Or use a Zod schema for all query params. The pattern in `agents.ts:1644` with `Number.isFinite` is the correct approach and should be applied universally.

## References

- PostgreSQL docs: LIMIT NULL behavior
- CWE-20: Improper Input Validation
- OWASP A03:2021 — Injection (indirect)
