# Architecture Review — Bronze/Silver/Gold Trace Pipeline

**Reviewer**: Architect Agent
**Date**: 2026-03-18
**Spec reviewed**: `_bmad-output/planning-artifacts/tech-spec-bronze-silver-gold-2026-03-18.md`
**Code reviewed**: bronze-trace-capture.ts, trace-service.ts, lens-analysis.ts, heartbeat.ts, traces.ts (schema), AgentDetail.tsx, migration 0045

## Score: 6/10

The pipeline design is sound conceptually — Bronze/Silver/Gold is the right layering. But there are several critical issues in the existing code that will cause runtime failures, and the spec underestimates the RLS and schema mismatch risks.

---

## Critical Issues (must fix)

### C1. RLS will silently block ALL bronze writes — no `set_config` in heartbeat context

**Files**: `server/src/services/heartbeat.ts:1232-1246`, `server/src/services/bronze-trace-capture.ts:82-110`, `packages/db/src/migrations/0045_trace_vision.sql:108-116`

The trace tables have RLS enabled with policies that check `current_setting('app.current_company_id', true)`. The tenant context middleware (`tenant-context.ts:21`) sets this via `set_config()` — but only for HTTP request handlers.

The heartbeat `executeRun()` function runs in a background async context (not an HTTP request). It never calls `setTenantContext()`. Therefore `current_setting('app.current_company_id', true)` returns empty string, and the RLS policy `company_id::text = ''` matches nothing.

**However**, migration 0045 uses `ENABLE ROW LEVEL SECURITY` but **not** `FORCE ROW LEVEL SECURITY`. The main migration 0030 uses both `ENABLE` and `FORCE`. If the DB role is the table owner, RLS is not enforced without `FORCE`. This means:
- If the app connects as the table owner: RLS is bypassed, writes succeed, but there's **no tenant isolation** on traces — a security gap.
- If the app connects as a non-owner role: writes will silently return 0 rows or fail.

**Fix**: Either:
1. Add `FORCE ROW LEVEL SECURITY` to migration 0045 for all 4 tables AND call `setTenantContext(db, companyId)` before bronze operations in heartbeat.ts, OR
2. Add `FORCE ROW LEVEL SECURITY` and wrap bronze capture in a transaction that starts with `set_config('app.current_company_id', companyId, true)`.

### C2. Schema/migration type mismatches — 3 columns will fail at runtime

**Files**: `packages/db/src/schema/traces.ts:67`, `packages/db/src/migrations/0045_trace_vision.sql:37,19,21`

| Column | Drizzle schema | Migration SQL | Impact |
|--------|---------------|---------------|--------|
| `trace_observations.level` | `text("level")` | `integer DEFAULT 0` | `bronze-trace-capture.ts:299` writes `String(state.observationCount)` — will insert string into integer column, may fail or implicitly cast |
| `traces.total_cost_usd` | `text("total_cost_usd")` | `numeric(10, 6)` | `trace-service.ts:188` casts to `::text` in SQL, but Drizzle thinks it's text. `bronze-trace-capture.ts:164` writes raw SQL `SUM(cost_usd)` which returns numeric — type confusion |
| `traces.tags` | `jsonb("tags").$type<string[]>()` | `text[]` (array) | JSONB and text[] are incompatible PostgreSQL types. Any write to `tags` via Drizzle will fail |

**Fix**: Align the Drizzle schema to match the actual migration SQL, or vice versa. The migration is the source of truth for what's in the DB.

### C3. Unique constraint violation on re-analysis of running traces

**Files**: `server/src/services/lens-analysis.ts:252-259`, `server/src/services/trace-service.ts:470-483`, `packages/db/src/migrations/0045_trace_vision.sql:98`

The `analyze()` function in lens-analysis.ts checks for a cached result and re-analyzes if the trace is still running (line 256-258). But `saveLensResult()` does a plain `INSERT` into `trace_lens_results`, which has a `UNIQUE INDEX` on `(lens_id, trace_id)`.

The second analysis of the same lens+trace will throw a unique constraint violation.

**Fix**: Use `ON CONFLICT (lens_id, trace_id) DO UPDATE` (upsert) in `saveLensResult`, or delete the existing result before inserting.

---

## Recommendations (should fix)

### R1. `await` in onLog blocks the stream pipeline

**File**: `server/src/services/heartbeat.ts:1264`

```typescript
await bronze.ingestChunk(runId, chunk);
```

Each chunk triggers `ingestChunk`, which iterates through parsed lines and calls `await persistBronzeObservation()` — a DB INSERT — for each event. For a typical agent run producing 200+ events, this means 200+ sequential awaited INSERTs inside the `onLog` callback.

While the outer try/catch prevents failures from killing the run, the `await` means each chunk must complete all its DB writes before the next chunk can be processed. This creates backpressure on the stdout stream.

**Recommendation**: Buffer events and batch-insert them periodically (e.g., every 500ms or every 10 events), or use a fire-and-forget pattern where `ingestChunk` pushes to an in-memory queue and a background loop drains it with batch inserts. The `addObservationsBatch` method in trace-service.ts already exists for this purpose.

### R2. Connection pool pressure from bronze writes

**File**: `packages/db/src/client.ts:45-46`

Pool is `max: 20`. Each `onLog` call holds a connection for the duration of all its `persistBronzeObservation` calls. With multiple concurrent agent runs (up to `HEARTBEAT_MAX_CONCURRENT_RUNS_MAX = 10`), and each run doing sequential INSERT per event, this could exhaust the pool under load.

**Recommendation**: Batch inserts (see R1) and/or use a dedicated smaller pool for trace writes to prevent them from starving HTTP request connections.

### R3. `phases JSONB` column not in Drizzle schema

**File**: `packages/db/src/schema/traces.ts` (missing), tech spec section 4 "Data Model Updates"

The spec proposes adding `phases JSONB` to the `traces` table, but it's not in the Drizzle schema yet. This is expected (it's future work for PIPE-02), but the migration must be created via Drizzle's migration workflow, not raw SQL, to keep schema and migrations in sync — especially given the existing type mismatches in C2.

**Recommendation**: When implementing PIPE-02, add the column to the Drizzle schema first, then generate the migration with `bun run db:generate`.

### R4. Silver enrichment inline at completion — timing concern

**File**: tech spec section 4, PIPE-02 description

The spec says silver enrichment runs "inline a la completion de la trace" (no BullMQ). For 200+ observations, the enrichment must:
1. Load all observations (1 query)
2. Run the deterministic phase grouping (CPU, fast)
3. Optionally call Haiku for naming (network, ~1-3s)
4. UPDATE trace with phases (1 query)

Steps 1-2-4 are fast (~50ms). Step 3 is the risk — if enabled, it adds 1-3s to the run completion path. Since this happens after `completeCapture` in heartbeat.ts (line 1421-1431), it delays the `finalizedRun` events and `releaseIssueExecutionAndPromote`.

**Recommendation**: Silver enrichment should fire-and-forget after `completeCapture` returns, not block the completion flow. Use `void enrichTrace(traceId).catch(err => logger.warn(...))` pattern.

### R5. `completeCapture` subquery ignores RLS for aggregation

**File**: `server/src/services/bronze-trace-capture.ts:162-164`

```typescript
totalTokensIn: sql`COALESCE((SELECT SUM(input_tokens) FROM trace_observations WHERE trace_id = ${state.traceId}), 0)`,
```

This raw SQL subquery references `trace_observations` directly. If RLS is active and the session context is not set (see C1), this subquery will return 0 even if observations exist. The trace will show 0 tokens and $0 cost despite having data.

**Fix**: Ensure RLS context is set before this query executes, or use a CTE/join through Drizzle's query builder.

### R6. No `phases` column in the spec's data model migration

**File**: tech spec section 4

The spec says:
```sql
ALTER TABLE traces ADD COLUMN phases JSONB;
```

But this ALTER is not in any existing migration. It needs its own migration (or be part of the PIPE-02 story migration). The spec should explicitly state which story creates this migration.

---

## Enrichments (nice to have)

### E1. Phase detection: Bash classification is too simplistic

**File**: tech spec section 4 "Phase Detection Algorithm"

The spec maps `tool:Bash` to VERIFICATION if the command "contains test/build/lint", else IMPLEMENTATION. But Bash commands are extremely varied:
- `git` commands → could be COMPREHENSION or IMPLEMENTATION
- `cd`, `ls`, `pwd` → COMPREHENSION
- `mkdir`, `rm` → IMPLEMENTATION
- `docker` commands → VERIFICATION or IMPLEMENTATION
- `curl` → could be anything

**Recommendation**: Expand the keyword matching to a broader set, or classify Bash as UNKNOWN by default and let the optional Haiku step reclassify it.

### E2. Truncation at 10KB loses tool results for gold analysis

**File**: `server/src/services/bronze-trace-capture.ts:327-331`

The `truncateOutput` function caps at 10KB. For large tool results (e.g., Read of a 500-line file), the gold layer will analyze truncated data, potentially missing important context.

**Recommendation**: Store a separate `output_full` or increase the limit for key observation types (tool results), while keeping the 10KB limit for live event payloads.

### E3. UI integration in RunDetail — tab vs inline

**File**: `ui/src/pages/AgentDetail.tsx:1375-1430`

The RunDetail component already has a rich transcript view. Adding a "Trace" tab/section (PIPE-05) should be a sibling to the existing transcript, not a replacement. The transcript shows raw stdout parsing; the trace view shows structured phases.

**Recommendation**: Add a tab component (e.g., "Transcript | Trace | Raw") above the current content area, defaulting to Transcript for running traces and Trace for completed traces.

### E4. `pendingToolCalls` Map leaks on crash

**File**: `server/src/services/bronze-trace-capture.ts:61-62,310-312`

If the server crashes mid-run, the in-memory `activeRuns` Map and its `pendingToolCalls` are lost. Traces will remain in `status: "running"` forever.

**Recommendation**: Add a startup cleanup job that sets all `status = 'running'` traces older than X minutes to `status = 'failed'` with a note like "server restart".

### E5. Cost estimation in lens-analysis uses Haiku pricing, but model is configurable

**File**: `server/src/services/lens-analysis.ts:128-133,298`

The `estimateCost` function hardcodes Haiku pricing ($0.25/1M input, $1.25/1M output), but the model is configurable via `MNM_LLM_LENS_MODEL` env var. If someone configures Sonnet or Opus, the cost estimate will be wildly inaccurate.

**Recommendation**: Add a pricing lookup table by model name, or at minimum document that the estimate assumes Haiku pricing.

---

## Summary

The Bronze/Silver/Gold architecture is well-structured and the right approach. The critical issues (C1-C3) are all fixable before PIPE-01 begins — they are implementation bugs, not design problems. The recommendations (R1-R6) address performance and correctness concerns that should be addressed during PIPE-01 and PIPE-02 to avoid technical debt.

Priority order for fixes:
1. **C2** (schema mismatches) — blocks all trace writes
2. **C1** (RLS context) — security gap or silent failures
3. **C3** (unique violation) — blocks re-analysis
4. **R1+R2** (batching) — performance under load
5. **R4** (silver timing) — prevents blocking completion flow
