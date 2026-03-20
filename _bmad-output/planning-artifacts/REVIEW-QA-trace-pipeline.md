# QA Review — Bronze/Silver/Gold Trace Pipeline

> **Reviewer** : QA Engineer (BMAD QA Review)
> **Date** : 2026-03-18
> **Spec reviewed** : `tech-spec-bronze-silver-gold-2026-03-18.md`
> **Verdict** : APPROVE with enrichments below

---

## 1. Enriched Acceptance Criteria per PIPE Story

### PIPE-01 — Fix Bronze E2E

**Original**: "Tester bronze-trace-capture avec un vrai agent run"

**Enriched criteria (Given/When/Then)**:

| # | Criterion | Format |
|---|-----------|--------|
| AC-01.1 | **Given** a registered agent with adapterType `claude_local`, **When** a heartbeat run is started via the API, **Then** a new row appears in `traces` with `status = 'running'` and `heartbeat_run_id` matching the run | DB assertion |
| AC-01.2 | **Given** the agent emits stdout chunks containing valid stream-JSON lines (tool_use, text, result, init), **When** `ingestChunk` processes them, **Then** corresponding rows appear in `trace_observations` with correct `type`, `name`, `input`, `output` | DB assertion |
| AC-01.3 | **Given** a tool_use event followed by a tool_result event with matching `tool_use_id`, **When** both are ingested, **Then** only ONE observation row exists (the tool_use row gets updated with output + status, no orphan tool_result row) | DB assertion |
| AC-01.4 | **Given** a stream chunk that is not valid JSON, **When** `ingestChunk` processes it, **Then** it is silently skipped (no error thrown, no observation created) | Unit test |
| AC-01.5 | **Given** a partial JSON line split across two chunks, **When** both chunks are ingested in order, **Then** the complete line is parsed after the second chunk (buffer behavior) | Unit test |
| AC-01.6 | **Given** the agent run completes (outcome = "succeeded"), **When** `completeCapture` is called, **Then** the trace row is updated with `status = 'completed'`, `completed_at` set, and `total_tokens_in/out/cost_usd` computed from observations | DB assertion |
| AC-01.7 | **Given** the agent run fails, **When** `completeCapture(runId, 'failed')` is called, **Then** the trace status = 'failed' | DB assertion |
| AC-01.8 | **Given** a completed trace, **When** navigating to `/traces` in the UI, **Then** the trace appears in the list with correct agent name, status badge, duration, cost, and token count | E2E screenshot |
| AC-01.9 | **Given** bronze capture encounters a DB insert error, **When** `ingestChunk` catches the error, **Then** the agent run is NOT interrupted (fire-and-forget isolation) | Unit test |
| AC-01.10 | **Given** a trace observation with `output` > 10KB, **When** persisted, **Then** the output is truncated with `_truncated: true` marker | Unit test |

**QC Proof**: Screenshot of `/traces` showing at least one real trace (not seed data) with non-zero observations. DB query showing `trace_observations` rows for that trace.

---

### PIPE-02 — Silver Enrichment Service

**Original**: "Creer silver-trace-enrichment.ts. Phase detection deterministe."

**Enriched criteria (Given/When/Then)**:

| # | Criterion | Format |
|---|-----------|--------|
| AC-02.1 | **Given** a completed trace with 10+ bronze observations containing tool:Read, tool:Edit, tool:Bash events, **When** `enrichTrace(traceId)` is called, **Then** the `traces.phases` JSONB column is populated with an array of phase objects | DB assertion |
| AC-02.2 | **Given** 5 consecutive tool:Read observations, **When** phase detection runs, **Then** they are grouped into a single COMPREHENSION phase with `observationCount = 5` | Unit test |
| AC-02.3 | **Given** a tool:Read followed by a tool:Edit, **When** phase detection runs, **Then** two separate phases are created (COMPREHENSION, then IMPLEMENTATION) | Unit test |
| AC-02.4 | **Given** two tool:Read observations with a gap > 30s between them, **When** phase detection runs, **Then** they are in separate phases (gap-based splitting) | Unit test |
| AC-02.5 | **Given** a tool:Bash observation whose input.command contains "test", **When** phase detection runs, **Then** it is classified as VERIFICATION (not IMPLEMENTATION) | Unit test |
| AC-02.6 | **Given** a tool:Bash observation whose input.command is "mkdir -p src/", **When** phase detection runs, **Then** it is classified as IMPLEMENTATION | Unit test |
| AC-02.7 | **Given** each phase, **Then** the deterministic summary matches the format: "Read 14 files (src/auth/, src/middleware/)" or "Modified 3 files (+47/-12 lines)" or "Ran tests: 42 passed, 0 failed" | Unit test |
| AC-02.8 | **Given** a trace with 0 observations, **When** `enrichTrace` is called, **Then** `phases = []` (empty array, no error) | Unit test |
| AC-02.9 | **Given** the silver enrichment is triggered inline after `completeCapture`, **When** the trace completes, **Then** `phases` is populated before the `trace.completed` live event fires | Integration test |
| AC-02.10 | **Given** an observation with type "generation" and name "thinking", **When** phase detection runs, **Then** it is classified as COMMUNICATION | Unit test |
| AC-02.11 | **Given** an observation with type "event" and name "init", **When** phase detection runs, **Then** it is classified as INITIALIZATION | Unit test |

**QC Proof**: DB query showing `traces.phases` populated for a real trace. JSON printout of the phases array showing correct phase types and summaries.

---

### PIPE-03 — Silver UI (Phases in TraceDetail)

**Original**: "Afficher les phases silver dans TraceDetail.tsx"

**Enriched criteria (Given/When/Then)**:

| # | Criterion | Format |
|---|-----------|--------|
| AC-03.1 | **Given** a trace with `phases` populated (silver-enriched), **When** the user navigates to `/traces/:traceId`, **Then** each phase is displayed as a collapsible card with a type badge (COMPREHENSION, IMPLEMENTATION, etc.) and deterministic summary | E2E screenshot |
| AC-03.2 | **Given** a phase card is collapsed (default state), **When** the user clicks it, **Then** it expands to show the individual observations within that phase | E2E interaction |
| AC-03.3 | **Given** a trace without phases (pre-silver, or silver failed), **When** the user navigates to TraceDetail, **Then** only the raw observations toggle is shown (no empty phases section, no error) | E2E screenshot |
| AC-03.4 | **Given** phase badges, **Then** each phase type has a distinct visual color: COMPREHENSION (blue), IMPLEMENTATION (green), VERIFICATION (yellow), COMMUNICATION (purple), INITIALIZATION (gray) | E2E visual |
| AC-03.5 | **Given** the raw observations toggle, **When** phases are shown, **Then** the "View raw observations" toggle still works and shows the full bronze tree | E2E interaction |
| AC-03.6 | **Given** a trace with 50+ observations across 8 phases, **When** the page loads, **Then** all phases render within 2 seconds (no performance degradation) | E2E performance |
| AC-03.7 | **Given** a phase of type VERIFICATION with summary "Ran tests: 42 passed, 0 failed", **Then** the summary is displayed in the phase card header | E2E assertion |

**QC Proof**: Screenshot of TraceDetail showing phase cards. Screenshot of expanded phase showing individual observations. Screenshot of trace without phases showing graceful fallback.

---

### PIPE-04 — Gold (Connect Lens Analysis)

**Original**: "Brancher le LensSelector dans TraceDetail au backend lens-analysis.ts"

**Enriched criteria (Given/When/Then)**:

| # | Criterion | Format |
|---|-----------|--------|
| AC-04.1 | **Given** a completed trace and at least one lens defined, **When** the user selects a lens in the LensSelector, **Then** a POST to `/trace-lenses/:lensId/analyze/:traceId` is fired | E2E network assertion |
| AC-04.2 | **Given** the LLM endpoint is configured (env vars set), **When** the analysis completes, **Then** the result markdown is rendered in LensAnalysisResult component | E2E screenshot |
| AC-04.3 | **Given** the LLM endpoint is NOT configured, **When** analysis is triggered, **Then** a fallback factual summary is returned (starting with "Analyse LLM non disponible") | Unit test + E2E |
| AC-04.4 | **Given** a previous analysis exists for this lens+trace combo, **When** the user selects the same lens again, **Then** the cached result is returned (no new LLM call) | Unit test with mock |
| AC-04.5 | **Given** a running trace, **When** the user views TraceDetail, **Then** the LensSelector is disabled with message "Lens analysis will be available when the trace completes" | E2E assertion |
| AC-04.6 | **Given** the analysis endpoint, **When** `estimateCost` is called with 50 observations, **Then** it returns a cost estimate with `estimatedCostUsd` and `estimatedTokens` fields | Unit test |
| AC-04.7 | **Given** a trace with > 200 observations, **When** analysis runs, **Then** observations are pre-filtered (sampled) to fit within MAX_OBSERVATIONS_FOR_LLM limit | Unit test |
| AC-04.8 | **Given** the LLM call takes > 30 seconds, **When** the AbortSignal fires, **Then** the call fails gracefully and falls back to factual summary (no crash) | Unit test with timeout mock |
| AC-04.9 | **Given** the cost estimate is computed, **When** the analysis UI shows the estimate, **Then** the user sees both estimated token count and estimated cost in USD before launching | E2E screenshot |

**QC Proof**: Screenshot of LensSelector with a lens selected. Screenshot of the analysis result (markdown rendered). Screenshot showing cost estimate before launch. Screenshot of fallback mode (no LLM).

---

### PIPE-05 — Integration RunDetail

**Original**: "Dans AgentDetail.tsx, ajouter un onglet/section Trace"

**Enriched criteria (Given/When/Then)**:

| # | Criterion | Format |
|---|-----------|--------|
| AC-05.1 | **Given** an agent with a completed heartbeat run that has a linked trace (via `heartbeat_run_id`), **When** the user opens the RunDetail panel, **Then** a "Trace" section/tab is visible | E2E screenshot |
| AC-05.2 | **Given** the Trace section is displayed, **When** the user clicks it, **Then** the silver phases and observation summary for that run's trace are shown inline | E2E interaction |
| AC-05.3 | **Given** a heartbeat run with NO linked trace, **When** RunDetail loads, **Then** no Trace section is shown (graceful absence, not error) | E2E assertion |
| AC-05.4 | **Given** the Trace section shows phase cards, **Then** clicking a "View full trace" link navigates to `/traces/:traceId` | E2E navigation |
| AC-05.5 | **Given** a running trace linked to a running heartbeat run, **When** RunDetail is shown, **Then** a "Live trace" indicator is displayed with observation count updating | E2E assertion |

**QC Proof**: Screenshot of RunDetail with Trace tab/section visible. Screenshot of expanded trace phases within RunDetail. Screenshot of RunDetail without trace (no error).

---

### PIPE-06 — Silver Haiku Naming (Optional)

**Original**: "Appeler Haiku pour nommer les phases en langage naturel"

**Enriched criteria (Given/When/Then)**:

| # | Criterion | Format |
|---|-----------|--------|
| AC-06.1 | **Given** `MNM_LLM_SUMMARY_ENDPOINT` is set, **When** silver enrichment runs, **Then** phase names are replaced with natural language (e.g., "Understanding the auth system" instead of "COMPREHENSION") | DB assertion |
| AC-06.2 | **Given** `MNM_LLM_SUMMARY_ENDPOINT` is NOT set, **When** silver enrichment runs, **Then** deterministic phase names are used (no LLM call, no error) | Unit test |
| AC-06.3 | **Given** the Haiku call fails (network error), **When** silver enrichment catches the error, **Then** it falls back to deterministic names (no crash, no incomplete phases) | Unit test |
| AC-06.4 | **Given** the Haiku naming adds cost, **Then** the cost per phase naming call is < $0.01 and the total per enrichment is < $0.05 | Cost assertion in logs |

**QC Proof**: DB query showing `phases[].name` with natural language names vs deterministic fallback names.

---

### PIPE-07 — QC Verification End-to-End

**Original**: "Lancer un agent, verifier bronze -> silver -> gold, screenshot de chaque etape"

**Enriched criteria (Given/When/Then)**:

| # | Criterion | Format |
|---|-----------|--------|
| AC-07.1 | **Given** a full E2E flow (start agent run -> capture bronze -> silver enrichment -> gold analysis), **When** verified in sequence, **Then** each stage produces correct data | Sequential E2E |
| AC-07.2 | Screenshot proof: `/traces` list showing the test trace | Screenshot |
| AC-07.3 | Screenshot proof: TraceDetail showing bronze observations | Screenshot |
| AC-07.4 | Screenshot proof: TraceDetail showing silver phases | Screenshot |
| AC-07.5 | Screenshot proof: LensSelector + Gold analysis result | Screenshot |
| AC-07.6 | Screenshot proof: RunDetail with Trace section | Screenshot |
| AC-07.7 | **Given** the E2E test suite runs, **Then** all PIPE-related tests pass with no regressions on existing tests | CI assertion |

---

## 2. E2E Test Plan

### 2.1 Mock Strategy for Testing Without a Real LLM

The pipeline is designed to be testable without an LLM:

| Layer | Mock Strategy |
|-------|---------------|
| **Bronze** | No LLM involved. Test with real or simulated adapter stdout. Use existing seed data traces (TRACE_COMPLETED has 10 observations). |
| **Silver** | 100% deterministic. No mocking needed. Phase detection is pure function based on observation types + timestamps. |
| **Gold (LLM path)** | Mock `MNM_LLM_SUMMARY_ENDPOINT` with a test HTTP server that returns canned responses. Or simply leave env vars unset to test the fallback path. |
| **Gold (fallback)** | Ensure `MNM_LLM_SUMMARY_ENDPOINT` is NOT set. The `buildFallbackAnalysis` function returns a deterministic markdown summary. |

**Recommendation**: For E2E, test the fallback path (no LLM env var). For unit tests, mock the `fetch` call in `callLlm()` to test both the LLM success and timeout paths.

### 2.2 Test Files to Create

#### `e2e/tests/PIPE-01.spec.ts` — Bronze Capture E2E

```
Test: "Bronze trace appears in /traces after agent run"
  1. Navigate to /traces
  2. Assert seed trace TRACE_COMPLETED visible (agent: Marcus, status: Completed)
  3. Assert trace row shows correct duration, cost, tokens
  4. Click trace row -> navigate to /traces/:traceId
  5. Assert TraceDetail header shows correct metadata

Test: "Bronze observations visible in raw drill-down"
  1. Navigate to /traces/{TRACE_COMPLETED}
  2. Click "View raw observations" toggle
  3. Assert 10 observation rows visible
  4. Assert observation types: event, span, generation present
  5. Assert parent-child nesting (OBS_TOOL_GREP under OBS_ANALYZE_CODE)

Test: "Running trace shows live indicator"
  1. Navigate to /traces/{TRACE_RUNNING}
  2. Assert "In progress..." live indicator visible
  3. Assert LensSelector is disabled (analysis-disabled message)

Test: "Trace list filters work"
  1. Navigate to /traces
  2. Filter by status=completed -> assert only completed traces shown
  3. Filter by agent=Marcus -> assert only Marcus traces shown
  4. Search "Code Review" -> assert matching trace appears
  5. Clear filters -> all traces return
```

#### `e2e/tests/PIPE-02.spec.ts` — Silver Phases (DB-level, can be unit test)

```
Test: "Silver phases appear on enriched trace"
  - This requires either:
    a) Seed data with pre-populated phases JSONB, OR
    b) A silver enrichment call during global-setup
  - Recommended: Add phases to TRACES seed data for TRACE_COMPLETED

Test: "Phase types are correctly assigned"
  - Verify via seed data phases array that:
    - OBS_INIT + OBS_READ_SPEC → INITIALIZATION + COMPREHENSION
    - OBS_TOOL_GREP + OBS_TOOL_READ_FILE → COMPREHENSION
    - OBS_TOOL_WRITE_FILE → IMPLEMENTATION
    - OBS_TOOL_RUN_TESTS → VERIFICATION
    - OBS_GENERATION_PLAN + OBS_GENERATION_REVIEW → COMMUNICATION
```

#### `e2e/tests/PIPE-03.spec.ts` — Silver UI

```
Test: "Phase cards displayed in TraceDetail"
  1. Navigate to /traces/{TRACE_COMPLETED}
  2. Assert phase cards visible (data-testid="trace-phase-card")
  3. Assert each phase has type badge + summary text
  4. Assert phases are collapsible (click to expand/collapse)

Test: "Phase card shows observations when expanded"
  1. Click on COMPREHENSION phase card
  2. Assert child observations listed (Read spec, Analyze code, Grep, Read file)
  3. Assert observation icons match their type

Test: "Trace without phases shows only raw toggle"
  1. Navigate to /traces/{TRACE_RUNNING} (no phases since running)
  2. Assert no phase cards visible
  3. Assert raw observations toggle still works
```

#### `e2e/tests/PIPE-04.spec.ts` — Gold Lens Analysis

```
Test: "LensSelector shows available lenses"
  1. Navigate to /traces/{TRACE_COMPLETED}
  2. Assert LensSelector component visible (data-testid="trace-09-analysis-zone")
  3. Assert seed lenses "Performance Bottleneck Analysis" and "Error & Failure Pattern Detection" shown

Test: "Selecting lens triggers analysis (fallback mode)"
  1. Select "Performance Bottleneck Analysis" lens
  2. Assert analysis result appears (may be cached from seed data)
  3. Assert markdown content is rendered
  4. Assert result contains trace name and observation count

Test: "Running trace disables lens analysis"
  1. Navigate to /traces/{TRACE_RUNNING}
  2. Assert analysis-disabled message visible
  3. Assert no LensSelector shown

Test: "Cached result is shown immediately"
  1. Navigate to /traces/{TRACE_COMPLETED}
  2. Select Performance lens (LENS_PERFORMANCE)
  3. Assert LENS_RESULT_PERF_COMPLETED content shown without loading spinner
```

#### `e2e/tests/PIPE-05.spec.ts` — RunDetail Integration

```
Test: "Trace tab visible in RunDetail for traced run"
  - Requires: a heartbeat run linked to a trace via heartbeat_run_id
  - Navigate to agent detail -> select run with linked trace
  - Assert Trace section/tab visible
  - Assert phases summary shown inline

Test: "No trace section for run without trace"
  - Navigate to agent detail -> select run without linked trace
  - Assert no Trace section visible (no error)
```

#### `e2e/tests/PIPE-07.spec.ts` — QC Verification

```
Test: "Full pipeline verification"
  1. Screenshot: /traces list
  2. Screenshot: /traces/{TRACE_COMPLETED} (detail with phases if available)
  3. Screenshot: /traces/{TRACE_COMPLETED} with raw observations expanded
  4. Screenshot: /traces/{TRACE_COMPLETED} with lens analysis result
  5. Screenshot: /traces/{TRACE_RUNNING} showing live indicator
  6. Screenshot: parent/child trace navigation
  7. All screenshots saved with descriptive names for QC proof
```

### 2.3 Unit Tests to Create

#### `server/src/services/__tests__/bronze-trace-capture.test.ts`

```
- JSON parsing of valid stream-JSON lines
- Buffer handling for partial lines across chunks
- tool_use + tool_result matching (pending tool calls map)
- Orphan tool_result creates standalone observation
- Non-JSON lines silently skipped
- Output truncation at 10KB threshold
- Fire-and-forget: DB error does not throw
- costUsd string parsing from result events
- Unknown event types captured as raw:TYPE
```

#### `server/src/services/__tests__/silver-trace-enrichment.test.ts`

```
- Phase grouping: consecutive same-type → one phase
- Phase splitting: different type → new phase
- Phase splitting: gap > 30s → new phase
- Tool classification:
  - tool:Read, tool:Grep, tool:Glob → COMPREHENSION
  - tool:Edit, tool:Write → IMPLEMENTATION
  - tool:Bash + "test" → VERIFICATION
  - tool:Bash + other → IMPLEMENTATION
  - response, thinking → COMMUNICATION
  - init, run-result → INITIALIZATION
- Deterministic summary format:
  - "Read N files (dir1/, dir2/)"
  - "Modified N files (+X/-Y lines)"
  - "Ran tests: X passed, Y failed"
- Empty observations → empty phases array
- Single observation → one phase
- Phase order matches chronological order
```

#### `server/src/services/__tests__/lens-analysis.test.ts`

```
- LLM call returns valid response → analysis saved
- LLM call returns null (endpoint not configured) → fallback summary
- LLM timeout (30s) → fallback
- LLM HTTP error → fallback
- Pre-filtering: >200 observations sampled correctly
  - All errors kept
  - Every 3rd consecutive same-name kept
- Cache hit → no new LLM call
- Running trace → cache bypassed (re-analyze)
- Cost estimation formula correct
- buildTraceContext formats correctly
- buildFallbackAnalysis includes observation counts, tools, files, errors
```

---

## 3. QC Checklist (Screenshot Proof per Story)

| Story | QC Check | Screenshot Name | What Must Be Visible |
|-------|----------|-----------------|---------------------|
| **PIPE-01** | Trace list with real trace | `pipe-01-traces-list.png` | At least 1 trace row with agent name, status badge, duration, cost |
| **PIPE-01** | Trace detail with observations | `pipe-01-trace-detail-raw.png` | Trace header + expanded raw observations tree (10+ items) |
| **PIPE-01** | DB proof | `pipe-01-db-observations.png` | SQL query result showing trace_observations rows with correct types |
| **PIPE-02** | Silver phases in DB | `pipe-02-db-phases.png` | SQL query showing `traces.phases` JSONB array with typed phases |
| **PIPE-02** | Phase types correct | `pipe-02-phase-types.png` | JSON showing COMPREHENSION, IMPLEMENTATION, VERIFICATION phases |
| **PIPE-03** | Phase cards in UI | `pipe-03-phase-cards.png` | TraceDetail with collapsible phase cards, type badges, summaries |
| **PIPE-03** | Expanded phase | `pipe-03-phase-expanded.png` | One phase card expanded showing child observations |
| **PIPE-03** | Graceful fallback | `pipe-03-no-phases.png` | Running trace detail showing no phases section, only raw toggle |
| **PIPE-04** | Lens selector | `pipe-04-lens-selector.png` | LensSelector dropdown with available lenses listed |
| **PIPE-04** | Gold analysis result | `pipe-04-gold-result.png` | Rendered markdown analysis result below the selector |
| **PIPE-04** | Cost estimate | `pipe-04-cost-estimate.png` | Cost estimate shown before launching analysis |
| **PIPE-04** | Fallback mode | `pipe-04-fallback.png` | "Analyse LLM non disponible" factual summary |
| **PIPE-05** | RunDetail trace section | `pipe-05-rundetail-trace.png` | AgentDetail → RunDetail with Trace section visible |
| **PIPE-05** | No trace graceful | `pipe-05-rundetail-no-trace.png` | RunDetail without trace section (no error) |
| **PIPE-06** | Haiku names | `pipe-06-haiku-names.png` | Phase names in natural language (if LLM configured) |
| **PIPE-06** | Deterministic fallback | `pipe-06-deterministic-names.png` | Phase names as "COMPREHENSION — 14 reads" |
| **PIPE-07** | Full pipeline | `pipe-07-full-pipeline.png` | /traces → detail → phases → gold result → RunDetail |

**Rule**: No PIPE story is marked DONE without its corresponding screenshots committed to the repo or attached to the PR.

---

## 4. Risk Matrix

### 4.1 Regression Risks

| What Could Break | Risk Level | How It Breaks | Mitigation |
|-----------------|------------|---------------|------------|
| **Heartbeat agent runs** | HIGH | Bronze `startCapture`/`ingestChunk` errors could throw in `onLog` callback, blocking the adapter. Current code has try/catch but ONLY around `ingestChunk`, not around the `await bronze.startCapture` in heartbeat.ts | Verify: heartbeat.ts line ~1236 wraps `startCapture` in try/catch. Add E2E test: agent run succeeds even if trace DB is unreachable |
| **Existing /traces page** | MEDIUM | Silver phases JSONB column added to traces — if the frontend reads `trace.phases` before migration runs, it gets `undefined`. Any `.length` or `.map()` call crashes | Ensure UI uses optional chaining: `trace.phases?.length ?? 0`. E2E test with trace that has no phases |
| **TraceDetail raw observations** | LOW | Adding phase cards above the raw toggle could change scroll position or layout. Raw observations toggle should still work | E2E test: raw observations toggle works on both phased and non-phased traces |
| **LensSelector/LensAnalysisResult** | MEDIUM | Currently wired in UI but backend returns 404/500. PIPE-04 connects them — if the analyze endpoint throws, the UI could show unhandled error | Ensure error boundary or try/catch in LensAnalysisResult. E2E test: analysis returns fallback on LLM failure |
| **Dashboard agent stats** | LOW | Dashboard queries `traces` table for stats. Adding `phases` column is additive, no existing queries affected | Run existing DASH E2E tests after migration |
| **Live events (SSE)** | LOW | Bronze adds `trace.created`, `trace.completed`, `trace.observation_created` events. If the SSE handler doesn't know these types, they're ignored | Verify LiveUpdatesProvider handles unknown event types gracefully |
| **Performance: high observation count** | MEDIUM | A long agent run (1000+ observations) could slow down `completeCapture` due to the aggregate subqueries | Add index on `trace_observations(trace_id)` (already exists). Test with 500+ observations |

### 4.2 Security Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cross-company trace leak | HIGH | RLS is on `traces` and `trace_observations` via `company_id`. Silver enrichment runs server-side with the correct companyId. Gold analysis uses `assertCompanyAccess`. Verify: no raw SQL bypasses RLS |
| LLM prompt injection via observations | MEDIUM | User-controlled content in observations (tool output, file contents) is passed to the LLM in gold analysis. The `preFilterObservations` function truncates but doesn't sanitize | Acceptable risk: the LLM is analyzing the user's own data. Add a note that gold results should not be treated as trusted HTML (markdown only) |
| Env var leakage | LOW | `MNM_LLM_SUMMARY_API_KEY` is used in `callLlm`. If error logging exposes the key... | Verify: `console.warn` in callLlm does NOT log the API key or request headers |

### 4.3 Data Integrity Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `phases` column not in schema yet | HIGH | Tech spec says "ALTER TABLE traces ADD COLUMN phases JSONB" but the Drizzle schema (`packages/db/src/schema/traces.ts`) does NOT have a `phases` column. The migration must be created AND the schema updated | PIPE-02 must add: 1) migration SQL, 2) Drizzle schema update, 3) `db:generate` + `db:migrate` |
| Silver enrichment partial failure | MEDIUM | If enrichment crashes midway, `phases` could be partially written. No transaction wrapping mentioned | Recommendation: write phases atomically in a single UPDATE (not incremental) |
| Gold lens_results unique constraint | LOW | `trace_lens_results` has a unique index on `(lens_id, trace_id)`. If the same analysis is triggered twice concurrently, the second INSERT fails | Current code checks cache first, but race condition possible. Use UPSERT (ON CONFLICT UPDATE) |

---

## 5. Test Data Strategy

### 5.1 Existing Seed Data (Sufficient for Most Tests)

The existing `e2e/fixtures/seed-data.ts` already provides:

- **5 traces**: completed, running, parent, child1, child2
- **19 observations** across those traces (10 for completed, 3 for running, 2+2+2 for parent/children)
- **2 lenses**: Performance + Error Analysis
- **1 lens result**: cached performance analysis for completed trace

This is sufficient for PIPE-01, PIPE-04 (cached result), and PIPE-07 E2E tests.

### 5.2 New Seed Data Needed

For PIPE-02 (silver) and PIPE-03 (phase UI), we need to **add pre-computed phases** to the TRACE_COMPLETED seed:

```typescript
// Add to TRACES[0] (TRACE_COMPLETED):
phases: [
  { order: 0, type: "INITIALIZATION", name: "INITIALIZATION", startIdx: 0, endIdx: 0, observationCount: 1, summary: "Session initialized" },
  { order: 1, type: "COMPREHENSION", name: "COMPREHENSION", startIdx: 1, endIdx: 2, observationCount: 2, summary: "Read 2 files (docs/, server/)" },
  { order: 2, type: "COMMUNICATION", name: "COMMUNICATION", startIdx: 3, endIdx: 3, observationCount: 1, summary: "Generated review plan" },
  { order: 3, type: "COMPREHENSION", name: "COMPREHENSION", startIdx: 4, endIdx: 5, observationCount: 2, summary: "Searched and read 2 files" },
  { order: 4, type: "COMMUNICATION", name: "COMMUNICATION", startIdx: 6, endIdx: 6, observationCount: 1, summary: "Generated code review feedback" },
  { order: 5, type: "IMPLEMENTATION", name: "IMPLEMENTATION", startIdx: 7, endIdx: 7, observationCount: 1, summary: "Modified 1 file (review-report.md)" },
  { order: 6, type: "VERIFICATION", name: "VERIFICATION", startIdx: 8, endIdx: 8, observationCount: 1, summary: "Ran tests: 42 passed, 0 failed" },
  { order: 7, type: "COMMUNICATION", name: "COMMUNICATION", startIdx: 9, endIdx: 9, observationCount: 1, summary: "Generated final summary" },
]
```

This requires:
1. Adding `phases` column to the `traces` schema (PIPE-02 prerequisite)
2. Adding phases to the seed data insert (global-setup.ts)

### 5.3 For PIPE-05 (RunDetail Integration)

Need a heartbeat run linked to a trace. Currently, seed data creates traces with `heartbeatRunId` set, but we need to verify that the heartbeat_runs table also has matching rows in the seed. If not, add a seeded heartbeat run.

---

## 6. Error Scenario Coverage

| Scenario | Expected Behavior | Test Type |
|----------|-------------------|-----------|
| DB unreachable during bronze capture | `startCapture` throws, caught in heartbeat.ts try/catch; agent run continues without trace | Unit + integration |
| DB unreachable during `ingestChunk` | Caught in heartbeat.ts try/catch; observation lost but run continues | Unit |
| DB unreachable during `completeCapture` | Trace stays in "running" status forever. Need manual cleanup strategy | Documented risk |
| LLM endpoint returns 500 | `callLlm` returns null, fallback analysis generated | Unit |
| LLM endpoint returns malformed JSON | `response.json()` parsing caught, returns null, fallback | Unit |
| LLM endpoint unreachable (network) | `fetch` throws, caught, returns null, fallback | Unit |
| LLM endpoint slow (>30s) | `AbortSignal.timeout(30_000)` fires, caught, fallback | Unit |
| Concurrent gold analysis requests | `trace_lens_results` UNIQUE constraint may cause 2nd INSERT to fail. Need UPSERT | Unit + race condition test |
| Agent crashes mid-run | `completeCapture(runId, 'failed')` called by heartbeat error handler; trace marked failed | Integration |
| Silver enrichment on trace with 0 observations | Returns empty phases array, no error | Unit |
| Silver enrichment on trace with 1000+ observations | Performance test: should complete in < 5 seconds (deterministic, no LLM) | Performance unit test |
| Phases column missing (migration not run) | UI must handle `trace.phases === undefined/null` gracefully | E2E |
| Orphan tool_result (no matching tool_use) | Created as standalone "event" type observation | Unit (already implemented) |

---

## 7. Spec Testability Assessment

### Well-Specified (Testable as-is)

- Phase detection algorithm (Section 4) is fully deterministic with clear type mappings
- API endpoints (Section 4) use existing routes, no new endpoints
- Data model (Section 4) is clear: one new JSONB column
- Acceptance criteria 1-7 (Section 6) are measurable

### Needs Clarification

| Question | Impact | Recommendation |
|----------|--------|----------------|
| When exactly does silver enrichment trigger? "inline a la completion" — before or after the `trace.completed` live event? | Affects E2E test timing. If after the event, the UI may show the trace as completed before phases are ready | Trigger BEFORE the live event. Enrich synchronously, then emit. |
| What is the `gap threshold` for splitting phases? Spec says 30s but also says "parametrable" | Unit tests need a fixed number to assert against | Default to 30s, make it configurable via `TRACE_SILVER_GAP_THRESHOLD_MS` env var. Test with default. |
| How are `tool:Bash` commands classified? Spec says "test/build/lint" → VERIFICATION, "sinon" → IMPLEMENTATION. But what about `git`, `npm install`, `docker`? | Phase classification edge cases | Define a regex-based classification: `/test|build|lint|check|typecheck/i` → VERIFICATION. Everything else → IMPLEMENTATION. Document and unit test. |
| Does PIPE-05 (RunDetail integration) fetch trace data via a new API call or reuse existing? | Architecture decision affects test setup | Spec says "le frontend fait un query supplementaire" — use existing `GET /traces?heartbeatRunId=X` or add a query param filter. |
| What happens to `activeRuns` Map if the server restarts mid-run? | In-memory state is lost. Trace stays "running" forever | Document: server restart during active run = orphaned trace. Add a cleanup job or startup recovery (check for stale "running" traces). |

---

## 8. Summary & Recommendations

### Priority Fixes Before Implementation

1. **Add `phases` column to Drizzle schema** (currently missing from `packages/db/src/schema/traces.ts`). This is a blocker for PIPE-02.
2. **Clarify silver enrichment timing** relative to `trace.completed` live event. Recommend: enrich first, then emit.
3. **Add UPSERT logic** to `saveLensResult` in trace-service to handle concurrent gold analysis requests.

### Test Execution Order

```
1. Unit tests for bronze-trace-capture (existing code, verify parsing)
2. Unit tests for silver-trace-enrichment (new code, verify phase detection)
3. Unit tests for lens-analysis (existing code, verify fallback + mock LLM)
4. E2E: PIPE-01 (bronze visible in UI using seed data)
5. E2E: PIPE-03 (phase cards in UI using seed data with pre-populated phases)
6. E2E: PIPE-04 (lens selector + fallback analysis)
7. E2E: PIPE-05 (RunDetail integration)
8. E2E: PIPE-07 (full pipeline QC with screenshots)
```

### Estimated Test Effort

| Category | Count | Effort |
|----------|-------|--------|
| Unit tests (bronze) | ~10 | 2h |
| Unit tests (silver) | ~12 | 3h |
| Unit tests (gold/lens) | ~10 | 2h |
| E2E tests (PIPE-01 to PIPE-07) | ~20 | 6h |
| Seed data updates | 1 | 1h |
| **Total** | **~53 tests** | **~14h** |

---

*QA Review generated by BMAD QA workflow. Ready for implementation sprint.*
