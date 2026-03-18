# Adversarial Review — Bronze/Silver/Gold Trace Pipeline

> **Reviewer**: Adversarial Agent | **Date**: 2026-03-18
> **Files reviewed**: tech-spec, bronze-trace-capture.ts, heartbeat.ts, traces.ts (schema), 0045_trace_vision.sql, traces.ts (UI API), Traces.tsx, trace-service.ts, lens-analysis.ts, traces.ts (routes), tenant-context.ts

---

## CRITICAL (will break in production)

### C1. RLS bypass — bronze-trace-capture inserts WITHOUT setting `app.current_company_id`

**File**: `server/src/services/bronze-trace-capture.ts:82-90` (startCapture), `:292-307` (persistBronzeObservation)
**File**: `server/src/services/heartbeat.ts:1233` (instantiation)

The `bronzeTraceCapture(db)` receives the raw `db` handle from heartbeat. The heartbeat service **never calls `setTenantContext(db, companyId)`** before bronze operations. The tenant-context middleware only runs for HTTP requests (`tenant-context.ts:11-28`), but heartbeat's `executeRun()` is a background process triggered by polling, not an HTTP request handler.

The RLS policies on `traces` and `trace_observations` use:
```sql
USING (company_id::text = current_setting('app.current_company_id', true))
```

The `true` parameter means "missing_ok" — if the setting is unset, `current_setting` returns empty string. Since the bronze inserts include `companyId` in the VALUES but RLS checks the **session variable**, one of two things happens:
1. **If RLS policy is `FOR ALL`** (which it is — no `WITH CHECK` clause specified separately): INSERT succeeds because the default policy created with just `USING` applies the check to both SELECT and INSERT. The INSERT will **fail silently or throw** because the USING clause is applied as a WITH CHECK on insert, and `company_id::text != ''`.
2. **If PostgreSQL applies USING to INSERT as WITH CHECK**: The row's `company_id` won't match the empty `app.current_company_id`, so **every INSERT will be rejected by RLS**.

**Severity**: Every bronze trace INSERT will fail. The try/catch in heartbeat:1265 swallows the error silently. **Zero traces will ever be recorded.**

**Fix**: Call `setTenantContext(db, run.companyId)` before `bronze.startCapture()` in heartbeat.ts. Or, better: have `bronzeTraceCapture` call `setTenantContext` internally at `startCapture` time and before each `persistBronzeObservation`. But beware — `set_config(..., true)` is transaction-local. Without an explicit transaction, the setting may apply to the current statement only (Drizzle's default is autocommit per query). Each `db.insert()` is a separate transaction, so you need to set the context before **every** insert, not just once.

---

### C2. `SUM(cost_usd)` on text column without cast — will return wrong type or error

**File**: `server/src/services/bronze-trace-capture.ts:164`

```typescript
totalCostUsd: sql`COALESCE((SELECT SUM(cost_usd) FROM trace_observations WHERE trace_id = ${state.traceId}), 0)`,
```

The `cost_usd` column in `trace_observations` is declared as:
- **Drizzle schema** (`traces.ts:74`): `text("cost_usd")` — a TEXT column
- **SQL migration** (`0045_trace_vision.sql:44`): `"cost_usd" numeric(10, 6)` — a NUMERIC column

**This is a schema mismatch** (see C4 below). But assuming the migration wins (it runs first), `SUM(cost_usd)` on a numeric column works fine. However, the Drizzle schema says `text`, so Drizzle will expect a string back. The `totalCostUsd` field on `traces` is also `text` in Drizzle but `numeric(10,6)` in the migration. The `SUM()` returns numeric, assigned to a text column — PostgreSQL will auto-cast, but the Drizzle ORM layer may be confused.

Compare with `trace-service.ts:188` which does the cast explicitly:
```typescript
totalCostUsd: sql`COALESCE((SELECT SUM("cost_usd"::numeric) FROM "trace_observations" WHERE "trace_id" = ${traceId}), 0)::text`
```

The bronze version omits both the `::numeric` cast and the `::text` output cast. If the actual DB column is `text` (matching Drizzle), then `SUM(cost_usd)` on a text column will **fail with a PostgreSQL error**: `function sum(text) does not exist`.

**Fix**: Use the same pattern as trace-service.ts: `SUM("cost_usd"::numeric)...::text`.

---

### C3. `totalDurationMs` SQL produces float, assigned to integer column

**File**: `server/src/services/bronze-trace-capture.ts:161`

```typescript
totalDurationMs: sql`EXTRACT(EPOCH FROM (NOW() - ${traces.startedAt})) * 1000`,
```

`EXTRACT(EPOCH FROM interval) * 1000` returns `double precision` (float). The column `total_duration_ms` is `integer` in both the Drizzle schema and migration. PostgreSQL will auto-truncate the float to integer on assignment, so this won't crash, but you lose sub-millisecond precision and the implicit cast may cause issues with Drizzle's type system expecting an integer.

**Fix**: Wrap in `ROUND(...)::integer` or `::integer` cast.

---

### C4. Drizzle schema vs SQL migration — multiple type mismatches

**Files**: `packages/db/src/schema/traces.ts` vs `packages/db/src/migrations/0045_trace_vision.sql`

| Column | Drizzle Schema | SQL Migration | Impact |
|--------|---------------|---------------|--------|
| `traces.total_cost_usd` | `text` (line 37) | `numeric(10,6)` (line 19) | Type mismatch — Drizzle reads as string, DB stores as numeric |
| `traces.tags` | `jsonb.$type<string[]>()` (line 39) | `text[]` (line 21) | **CRITICAL**: jsonb vs text array are completely different types. Drizzle will generate `::jsonb` casts, DB expects `text[]`. INSERTs with tags will fail. |
| `traces.agent_id` | `notNull()` (line 28) | no NOT NULL constraint (line 11) | Drizzle will never send null, but DB allows it — minor |
| `trace_observations.level` | `text("level")` (line 67) | `integer DEFAULT 0 NOT NULL` (line 37) | **CRITICAL**: Drizzle sends strings like `"1"`, `"2"` to an integer column. The bronze code does `level: String(state.observationCount)` (line 299). PostgreSQL may auto-cast `'1'` to integer, but the NOT NULL + DEFAULT 0 in migration vs nullable text in Drizzle is a mismatch. |
| `trace_observations.status` default | `default("started")` (line 63) | `DEFAULT 'running'` (line 32) | Different default values |
| `trace_lens_results.trace_id` | nullable (line 115, no `.notNull()`) | `NOT NULL` (line 67) | Drizzle allows null trace_id, but DB rejects it |
| `trace_lens_results.workflow_instance_id` | has reference (line 116) | column not in migration | Drizzle schema has a column the migration doesn't create |

The `tags` mismatch is the most dangerous — any write to `traces.tags` through Drizzle will use jsonb serialization on a text[] column, which will throw a PostgreSQL type error.

**Fix**: Align the migration to match Drizzle schema (or vice versa). One must be the source of truth. Given the migration runs first, update the Drizzle schema to match, or regenerate the migration from the Drizzle schema.

---

## HIGH (will cause problems)

### H1. Memory leak — `activeRuns` Map never cleaned on server crash/restart

**File**: `server/src/services/bronze-trace-capture.ts:64`

```typescript
const activeRuns = new Map<string, RunTraceState>();
```

`activeRuns` is a module-level Map. It only gets cleaned up in `completeCapture()` (line 175: `activeRuns.delete(runId)`). If:
- The server crashes mid-run
- The server restarts (deploy, OOM kill)
- `completeCapture` throws before the `delete` call
- The adapter process hangs indefinitely

...the entry stays in memory forever. Each entry contains a `pendingToolCalls` Map and a string `buffer`, so memory grows unboundedly.

**Additionally**: After server restart, any in-progress traces remain `status: 'running'` forever in the DB. There's no cleanup job to mark orphaned running traces as failed.

**Fix**:
1. Add a TTL-based cleanup sweep (e.g., every 5 minutes, delete entries older than 30 minutes)
2. Add a startup job that marks all `status='running'` traces as `failed` with a note "server restarted"
3. Add a `finally` block in heartbeat.ts to ensure `completeCapture` runs even on unexpected errors

---

### H2. `await` in the hot path — `ingestChunk` blocks the agent run

**File**: `server/src/services/heartbeat.ts:1263-1264`

```typescript
await bronze.ingestChunk(runId, chunk);
```

The `onLog` callback is called for every stdout chunk from the adapter. The `ingestChunk` method does `await persistBronzeObservation(db, state, event)` for **every parsed JSON line** (line 140). Each `persistBronzeObservation` does a `db.insert()` — a full round-trip to PostgreSQL.

For a typical Claude agent run with 200+ observations, that's 200+ sequential DB INSERT round-trips in the hot path of the agent's stdout processing. Each insert takes 1-5ms, so that's 200ms-1s of added latency to the run, **blocking the log pipeline**.

The tech spec (section 7, NFR) explicitly says: "l'insertion bronze ne doit pas ralentir l'agent run (async, fire-and-forget avec catch)". The current code uses `await`, not fire-and-forget.

**Fix**: Remove the `await` and use fire-and-forget:
```typescript
if (stream === "stdout" && bronzeTraceId) {
  bronze.ingestChunk(runId, chunk).catch(() => {});
}
```
Or batch observations and flush periodically instead of per-line.

---

### H3. `pendingToolCalls` Map — tool_use_id may be missing or duplicated

**File**: `server/src/services/bronze-trace-capture.ts:310-312`

```typescript
if (event.type === "tool_use" && event.tool_use_id) {
  state.pendingToolCalls.set(event.tool_use_id, row.id);
}
```

And the matching logic (line 216-217):
```typescript
const toolUseId = event.tool_use_id_ref ?? event.tool_use_id;
if (toolUseId && state.pendingToolCalls.has(toolUseId)) {
```

Issues:
1. **Claude's actual stream format**: The stream JSON from `claude-local` adapter may use different field names than assumed here. The code assumes `tool_use_id` on tool_use events and `tool_use_id_ref` on tool_result events. This hasn't been verified against actual adapter output.
2. **Parallel tool calls**: Claude can execute multiple tool calls in one response turn. If tool results come back in a different order than the tool_use events, the matching still works (Map lookup by ID). But if two tool_use events have the same `tool_use_id` (shouldn't happen, but defensive programming), the second overwrites the first.
3. **Missing tool_result**: If a tool call never gets a result (adapter crash, timeout), the pending entry stays in the Map forever (part of H1).

**Fix**: Add logging when orphan tool_results are encountered. Add a cleanup mechanism for pending entries older than N minutes.

---

### H4. No `workflowInstanceId` column in `trace_lens_results` migration

**File**: `packages/db/src/schema/traces.ts:116` vs `packages/db/src/migrations/0045_trace_vision.sql:64-68`

Drizzle schema defines:
```typescript
workflowInstanceId: uuid("workflow_instance_id").references(() => workflowInstances.id),
```

But the SQL migration for `trace_lens_results` does NOT include a `workflow_instance_id` column. The migration creates:
```sql
CREATE TABLE IF NOT EXISTS "trace_lens_results" (
  "id" uuid PRIMARY KEY ...
  "lens_id" uuid NOT NULL,
  "trace_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  ...
);
```

No `workflow_instance_id` column exists. Any Drizzle query that tries to read/write this column will fail at runtime.

Similarly, the index `lens_results_lens_workflow_idx` in Drizzle (line 131) references this non-existent column.

**Fix**: Add the column to the migration, or remove it from the Drizzle schema.

---

### H5. `level` column used as observation sequence counter, but semantics differ

**File**: `server/src/services/bronze-trace-capture.ts:299`

```typescript
level: String(state.observationCount),
```

The `level` field is being used to store the observation sequence number (1, 2, 3, ...). But:
- In the migration, `level` is `integer DEFAULT 0 NOT NULL` — so it should be a number, not a string
- In the Drizzle schema, `level` is `text` — suggesting it's meant for something like "info", "warn", "error" (log levels)
- In the UI types (`ui/src/api/traces.ts:42`), it's `level: string | null`
- The `trace-service.ts` likely uses it differently

This semantic confusion means the silver phase detection (which reads observations) will see `level: "1"`, `level: "2"` etc. instead of log-level semantics. Not a crash, but data quality issue.

**Fix**: Decide what `level` means. If it's an ordering sequence, rename to `sequence` or `order_index`. If it's a log level, use "info"/"warn"/"error".

---

## MEDIUM (should fix)

### M1. `truncateOutput` silently destroys data structure

**File**: `server/src/services/bronze-trace-capture.ts:327-331`

```typescript
function truncateOutput(data: Record<string, unknown>): Record<string, unknown> {
  const str = JSON.stringify(data);
  if (str.length <= 10_000) return data;
  return { _truncated: true, _preview: str.slice(0, 500) + "...[truncated]" };
}
```

When truncation happens, the entire structured data is replaced with a flat `{ _truncated, _preview }` object. Any downstream code (silver enrichment, gold analysis) that expects specific keys in the observation's `input`/`output` (e.g., `file_path` for Read operations, `command` for Bash operations) will find only `_truncated` and `_preview`. This breaks:
- Silver phase detection that inspects tool inputs to determine phase type
- Gold analysis that formats observations with `obs.input.file_path`
- `lens-analysis.ts:203` specifically accesses `(o.input as Record<string, unknown>).file_path`

**Fix**: Keep a structured summary with key fields preserved:
```typescript
return { _truncated: true, _preview: str.slice(0, 500), ...extractKeyFields(data) };
```

---

### M2. Bronze `ingestChunk` parses ALL stdout as JSON — assumes one JSON object per line

**File**: `server/src/services/bronze-trace-capture.ts:123-141`

The code splits on `\n` and tries `JSON.parse` on each line. This assumes the adapter outputs one complete JSON object per line (NDJSON format). But:

1. **Multi-line JSON**: If the adapter outputs pretty-printed JSON (with newlines inside objects), the line split will produce partial JSON fragments that fail to parse. These are silently skipped.
2. **Non-JSON output**: Build output, test results, error messages from tools are plain text. Every non-JSON line is silently discarded. This means the bronze layer captures only structured events, not the full stdout — which contradicts the comment "captures ALL agent stream data".
3. **Partial chunks**: The buffer mechanism (lines 123-125) handles partial lines at chunk boundaries correctly. But if a single line exceeds the chunk size, the buffer will grow unboundedly until it finds a newline.

**Fix**: Document that bronze only captures structured stream-JSON events, not raw text output. Consider also capturing non-JSON lines as `raw:text` events with the content.

---

### M3. `completeCapture` aggregation subqueries bypass RLS

**File**: `server/src/services/bronze-trace-capture.ts:162-164`

```typescript
totalTokensIn: sql`COALESCE((SELECT SUM(input_tokens) FROM trace_observations WHERE trace_id = ${state.traceId}), 0)`,
```

These subqueries reference `trace_observations` without a `company_id` filter. If RLS is active (which it is), the subquery's access to `trace_observations` is also subject to RLS. If the `app.current_company_id` is not set (see C1), the subquery returns 0 even if observations exist — because RLS filters them all out. This means totals will always be 0.

This is a consequence of C1 but worth noting separately: even if the INSERT issue (C1) is somehow worked around, the aggregation will still return wrong results.

**Fix**: Either ensure RLS context is set, or add explicit `WHERE company_id = ${state.companyId}` to the subqueries as belt-and-suspenders.

---

### M4. Duplicate index creation in migration

**File**: `packages/db/src/migrations/0045_trace_vision.sql:96-98`

```sql
CREATE INDEX IF NOT EXISTS "lens_results_lens_trace_idx" ON "trace_lens_results" ("lens_id", "trace_id");
...
CREATE UNIQUE INDEX IF NOT EXISTS "lens_results_unique_idx" ON "trace_lens_results" ("lens_id", "trace_id");
```

Two indexes on the exact same columns `(lens_id, trace_id)` — one regular, one unique. The unique index already serves as a regular index. The regular index is wasteful (doubles the index storage and write overhead for that table).

Meanwhile, the Drizzle schema defines `lensTraceUniqueIdx: uniqueIndex("trace_lens_results_lens_trace_idx")` — a unique index with the name of the regular index in the migration. Name collision.

**Fix**: Remove the regular index `lens_results_lens_trace_idx` from the migration. Keep only the unique index.

---

### M5. Missing `phases` column — tech spec requires it, neither schema nor migration has it

**File**: Tech spec section 4 ("Data Model Updates")

The tech spec says:
```sql
ALTER TABLE traces ADD COLUMN phases JSONB;
```

But:
- `packages/db/src/schema/traces.ts` — no `phases` column
- `packages/db/src/migrations/0045_trace_vision.sql` — no `phases` column

The silver enrichment service (PIPE-02) will need to write `phases` to the traces table. This column doesn't exist yet. When PIPE-02 is implemented, it will need a new migration AND a schema update.

**Impact**: Not a current bug, but PIPE-02 will be blocked until this is added. The tech spec implies it already exists.

**Fix**: Add the column to both the Drizzle schema and create a new migration (0046 or amend 0045 if not yet deployed).

---

### M6. `lens-analysis.ts` hardcodes Haiku pricing, doesn't match model config

**File**: `server/src/services/lens-analysis.ts:128-133`

```typescript
// Haiku pricing: ~$0.25/1M input, ~$1.25/1M output
const costUsd = (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;
```

And line 298:
```typescript
costUsd: ((llmResult.inputTokens * 0.25 + llmResult.outputTokens * 1.25) / 1_000_000).toFixed(6),
```

The model is configurable via `MNM_LLM_LENS_MODEL` env var (line 142), but the cost calculation always uses Haiku pricing. If someone configures Sonnet ($3/$15 per 1M), the reported cost will be 12x too low.

**Fix**: Use a pricing lookup table keyed by model name, like `trace-emitter.ts` does with `MODEL_PRICING`.

---

## LOW (nice to fix)

### L1. `bronzeTraceCapture(db)` creates a new closure on every run

**File**: `server/src/services/heartbeat.ts:1233`

```typescript
const bronze = bronzeTraceCapture(db);
```

This is called inside `executeRun()` for every agent run. It creates new function closures each time. The `activeRuns` Map is module-level (shared), so this works, but it's wasteful. A singleton pattern would be cleaner.

**Fix**: Create the bronze capture instance once at service initialization, not per-run.

---

### L2. No index on `trace_observations.trace_id + started_at` for ordered retrieval

**File**: `packages/db/src/migrations/0045_trace_vision.sql:88`

The migration creates `obs_trace_idx ON trace_observations (trace_id)` but trace detail queries load observations ordered by `started_at` (`trace-service.ts:163`: `.orderBy(traceObservations.startedAt)`). Without a composite index on `(trace_id, started_at)`, PostgreSQL will do an index scan + sort for every trace detail page load.

**Fix**: Replace `obs_trace_idx` with a composite index `ON trace_observations (trace_id, started_at)`.

---

### L3. Frontend `Trace.tags` typed as `string[]` but DB has divergent types

**File**: `ui/src/api/traces.ts:25`

```typescript
tags: string[];
```

Non-nullable in the frontend type. The Drizzle schema has it as `jsonb` (nullable), the migration has it as `text[]`. The frontend will crash if `tags` is null from the API (which it will be for most traces, since bronze capture never sets tags).

**Fix**: Type as `tags: string[] | null` or default to `[]` in the API response serialization.

---

### L4. `console.warn` used in lens-analysis instead of structured logger

**File**: `server/src/services/lens-analysis.ts:166, 185`

```typescript
console.warn(`[lens-analysis] LLM call failed with status ${response.status}`);
console.warn("[lens-analysis] LLM call error:", err);
```

The rest of the codebase uses `logger.warn()` from the pino logger. Using `console.warn` bypasses structured logging, log levels, and log aggregation.

**Fix**: Import and use `logger` from middleware/logger.js.

---

### L5. `set_config('app.current_company_id', ..., true)` — the `true` means transaction-local

**File**: `server/src/middleware/tenant-context.ts:21, 38`

The third parameter `true` in `set_config` means the setting is local to the current transaction. In autocommit mode (default for Drizzle without explicit `.transaction()`), each statement is its own transaction. This means:

1. Statement 1: `SELECT set_config(...)` — sets the variable for this transaction (which ends immediately)
2. Statement 2: `INSERT INTO traces ...` — new transaction, variable is **unset**

This means the RLS context set by `tenantContextMiddleware` only persists across statements if the entire request runs in a single transaction. For most Express routes using Drizzle without explicit transactions, each query is a separate transaction, and the RLS context may not persist.

**This affects the entire application, not just traces.** But it's especially visible here because the bronze capture does multiple sequential inserts.

**Note**: This may work if the connection pool reuses the same connection for the same request AND PostgreSQL retains the setting. The behavior depends on the pool implementation. This needs investigation.

**Fix**: Investigate whether the Drizzle connection pool preserves session-level settings across statements. If not, either use `false` (session-level) for the `set_config` or wrap multi-statement operations in explicit transactions.

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| CRITICAL | 4 | RLS bypass, schema mismatches, type errors |
| HIGH | 5 | Memory leak, hot-path blocking, missing columns |
| MEDIUM | 6 | Data loss, duplicate indexes, missing schema |
| LOW | 5 | Performance, typing, logging |

**Top 3 things to fix before any testing**:
1. **C1 + L5**: RLS context for bronze inserts — without this, zero traces will be recorded
2. **C4**: Align Drizzle schema with SQL migration (especially `tags` jsonb vs text[], `level` text vs integer)
3. **H2**: Remove `await` from ingestChunk in the onLog hot path
