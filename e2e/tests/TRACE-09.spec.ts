/**
 * TRACE-09 to TRACE-13: Trace Vision UI — E2E Tests
 *
 * These tests verify the Trace Vision UI deliverables:
 *   - Groupe 1: Navigation & Routes (T01-T09)
 *   - Groupe 2: API clients traces + lenses (T10-T24)
 *   - Groupe 3: Query keys (T25-T32)
 *   - Groupe 4: TRACE-09 — Trace List Page structure (T33-T48)
 *   - Groupe 5: TRACE-09 — Trace Detail Page structure (T49-T68)
 *   - Groupe 6: TRACE-09 — Lens Selector component (T69-T82)
 *   - Groupe 7: TRACE-09 — Lens Analysis Result component (T83-T94)
 *   - Groupe 8: TRACE-09 — Raw Observation Tree (T95-T108)
 *   - Groupe 9: TRACE-10 — Trace Settings / Lens CRUD (T109-T130)
 *   - Groupe 10: TRACE-10 — Context Trace Section (T131-T140)
 *   - Groupe 11: TRACE-12 — Workflow Traces page (T141-T156)
 *   - Groupe 12: TRACE-12 — AgentTimelineBar + WorkflowTimeline (T157-T170)
 *   - Groupe 13: TRACE-13 — Multi-Agent Live Panel (T171-T188)
 *   - Groupe 14: TRACE-13 — useProjectLiveTraces hook (T189-T195)
 *   - Groupe 15: LiveEvents trace integration (T196-T200)
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const APP_FILE = resolve(ROOT, "ui/src/App.tsx");
const SIDEBAR_FILE = resolve(ROOT, "ui/src/components/Sidebar.tsx");
const QUERY_KEYS_FILE = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const LIVE_UPDATES_FILE = resolve(ROOT, "ui/src/context/LiveUpdatesProvider.tsx");

// API clients
const API_TRACES_FILE = resolve(ROOT, "ui/src/api/traces.ts");
const API_LENSES_FILE = resolve(ROOT, "ui/src/api/lenses.ts");

// Pages
const TRACES_PAGE = resolve(ROOT, "ui/src/pages/Traces.tsx");
const TRACE_DETAIL_PAGE = resolve(ROOT, "ui/src/pages/TraceDetail.tsx");
const TRACE_SETTINGS_PAGE = resolve(ROOT, "ui/src/pages/TraceSettings.tsx");
const WORKFLOW_TRACES_PAGE = resolve(ROOT, "ui/src/pages/WorkflowTraces.tsx");

// Components
const LENS_SELECTOR = resolve(ROOT, "ui/src/components/traces/LensSelector.tsx");
const LENS_ANALYSIS_RESULT = resolve(ROOT, "ui/src/components/traces/LensAnalysisResult.tsx");
const RAW_OBSERVATION_TREE = resolve(ROOT, "ui/src/components/traces/RawObservationTree.tsx");
const CONTEXT_TRACE_SECTION = resolve(ROOT, "ui/src/components/traces/ContextTraceSection.tsx");
const WORKFLOW_TIMELINE = resolve(ROOT, "ui/src/components/traces/WorkflowTimeline.tsx");
const AGENT_TIMELINE_BAR = resolve(ROOT, "ui/src/components/traces/AgentTimelineBar.tsx");
const MULTI_AGENT_LIVE_PANEL = resolve(ROOT, "ui/src/components/traces/MultiAgentLivePanel.tsx");

// Hooks
const USE_PROJECT_LIVE_TRACES = resolve(ROOT, "ui/src/hooks/useProjectLiveTraces.ts");

// ---------------------------------------------------------------------------
// Groupe 1: Navigation & Routes (T01-T09)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Navigation & Routes", () => {
  test("T01 — Traces page file exists and exports Traces", async () => {
    await expect(fsAccess(TRACES_PAGE).then(() => true)).resolves.toBe(true);
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toMatch(/export\s+function\s+Traces\s*\(/);
  });

  test("T02 — TraceDetail page file exists and exports TraceDetail", async () => {
    await expect(fsAccess(TRACE_DETAIL_PAGE).then(() => true)).resolves.toBe(true);
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toMatch(/export\s+function\s+TraceDetail\s*\(/);
  });

  test("T03 — TraceSettings page file exists and exports TraceSettings", async () => {
    await expect(fsAccess(TRACE_SETTINGS_PAGE).then(() => true)).resolves.toBe(true);
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toMatch(/export\s+function\s+TraceSettings\s*\(/);
  });

  test("T04 — WorkflowTraces page file exists and exports WorkflowTraces", async () => {
    await expect(fsAccess(WORKFLOW_TRACES_PAGE).then(() => true)).resolves.toBe(true);
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toMatch(/export\s+function\s+WorkflowTraces\s*\(/);
  });

  test("T05 — Route /traces declared in App.tsx with RequirePermission audit:read", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/path=["']traces["']/);
    expect(content).toContain('permission="audit:read"');
  });

  test("T06 — Route /traces/:traceId declared in App.tsx", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/path=["']traces\/:traceId["']/);
  });

  test("T07 — Route /settings/trace-lenses declared in App.tsx", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/path=["']settings\/trace-lenses["']/);
  });

  test("T08 — Route /workflows/:workflowId/traces declared in App.tsx", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/path=["']workflows\/:workflowId\/traces["']/);
  });

  test("T09 — Sidebar contains trace-09-nav-traces link to /traces with Scan icon", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain('data-testid="trace-09-nav-traces"');
    expect(content).toContain('to="/traces"');
    expect(content).toMatch(/import\s*\{[^}]*Scan[^}]*\}\s*from\s*["']lucide-react["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: API clients traces + lenses (T10-T24)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: API clients traces + lenses", () => {
  test("T10 — api/traces.ts file exists and exports tracesApi", async () => {
    await expect(fsAccess(API_TRACES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(API_TRACES_FILE, "utf-8");
    expect(content).toMatch(/export\s+const\s+tracesApi\s*=/);
  });

  test("T11 — tracesApi.list calls /companies/${companyId}/traces", async () => {
    const content = await readFile(API_TRACES_FILE, "utf-8");
    expect(content).toContain("/companies/${companyId}/traces");
    expect(content).toMatch(/list\s*:/);
  });

  test("T12 — tracesApi.detail calls /companies/${companyId}/traces/${traceId}", async () => {
    const content = await readFile(API_TRACES_FILE, "utf-8");
    expect(content).toContain("/companies/${companyId}/traces/${traceId}");
    expect(content).toMatch(/detail\s*:/);
  });

  test("T13 — Trace type exported with required fields", async () => {
    const content = await readFile(API_TRACES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+Trace\s*\{/);
    expect(content).toContain("agentId: string");
    expect(content).toContain("status: TraceStatus");
    expect(content).toContain("totalCostUsd: number");
    expect(content).toContain("totalTokensIn: number");
    expect(content).toContain("totalTokensOut: number");
    expect(content).toContain("totalDurationMs: number");
  });

  test("T14 — TraceStatus type covers running/completed/failed/cancelled", async () => {
    const content = await readFile(API_TRACES_FILE, "utf-8");
    expect(content).toMatch(/export\s+type\s+TraceStatus\s*=/);
    expect(content).toContain('"running"');
    expect(content).toContain('"completed"');
    expect(content).toContain('"failed"');
    expect(content).toContain('"cancelled"');
  });

  test("T15 — TraceObservation type exported with tree fields", async () => {
    const content = await readFile(API_TRACES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+TraceObservation\s*\{/);
    expect(content).toContain("parentObservationId: string | null");
    expect(content).toContain("type: ObservationType");
    expect(content).toContain("input: unknown");
    expect(content).toContain("output: unknown");
  });

  test("T16 — TraceFilters interface exported with filter fields", async () => {
    const content = await readFile(API_TRACES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+TraceFilters\s*\{/);
    expect(content).toContain("agentId?: string");
    expect(content).toContain("status?: TraceStatus");
    expect(content).toContain("workflowInstanceId?: string");
    expect(content).toContain("cursor?: string");
    expect(content).toContain("limit?: number");
  });

  test("T17 — buildQuery in traces.ts filters undefined/null/empty", async () => {
    const content = await readFile(API_TRACES_FILE, "utf-8");
    expect(content).toMatch(/function\s+buildQuery/);
    expect(content).toContain("undefined");
    expect(content).toContain("null");
    expect(content).toContain('""');
  });

  test("T18 — api/lenses.ts file exists and exports lensesApi", async () => {
    await expect(fsAccess(API_LENSES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(API_LENSES_FILE, "utf-8");
    expect(content).toMatch(/export\s+const\s+lensesApi\s*=/);
  });

  test("T19 — lensesApi.list calls /companies/${companyId}/trace-lenses", async () => {
    const content = await readFile(API_LENSES_FILE, "utf-8");
    expect(content).toContain("/companies/${companyId}/trace-lenses");
    expect(content).toMatch(/list\s*:/);
  });

  test("T20 — lensesApi.create calls POST /companies/${companyId}/trace-lenses", async () => {
    const content = await readFile(API_LENSES_FILE, "utf-8");
    expect(content).toMatch(/create\s*:/);
    expect(content).toContain("api.post");
  });

  test("T21 — lensesApi.update calls PUT /trace-lenses/${lensId}", async () => {
    const content = await readFile(API_LENSES_FILE, "utf-8");
    expect(content).toMatch(/update\s*:/);
    expect(content).toContain("/trace-lenses/${lensId}");
    expect(content).toContain("api.put");
  });

  test("T22 — lensesApi.delete calls DELETE /trace-lenses/${lensId}", async () => {
    const content = await readFile(API_LENSES_FILE, "utf-8");
    expect(content).toMatch(/delete\s*:/);
    expect(content).toContain("api.delete");
  });

  test("T23 — lensesApi.analyze calls POST /analyze/${traceId}", async () => {
    const content = await readFile(API_LENSES_FILE, "utf-8");
    expect(content).toMatch(/analyze\s*:/);
    expect(content).toContain("/analyze/${traceId}");
  });

  test("T24 — lensesApi.getResult and estimateCost methods exist", async () => {
    const content = await readFile(API_LENSES_FILE, "utf-8");
    expect(content).toMatch(/getResult\s*:/);
    expect(content).toContain("/results/${traceId}");
    expect(content).toMatch(/estimateCost\s*:/);
    expect(content).toContain("/analysis-cost");
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Query keys (T25-T32)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Query keys", () => {
  test("T25 — traces.list query key includes [traces, companyId, list, filters]", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const tracesBlock = content.slice(content.indexOf("traces:"));
    expect(tracesBlock).toContain('"traces"');
    expect(tracesBlock).toContain('"list"');
    expect(tracesBlock).toContain("companyId");
    expect(tracesBlock).toContain("filters");
  });

  test("T26 — traces.detail query key includes [traces, companyId, detail, traceId]", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const tracesBlock = content.slice(content.indexOf("traces:"));
    expect(tracesBlock).toContain('"detail"');
    expect(tracesBlock).toContain("traceId");
  });

  test("T27 — traces.byWorkflow query key includes [traces, companyId, workflow, workflowInstanceId]", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const tracesBlock = content.slice(content.indexOf("traces:"));
    expect(tracesBlock).toContain('"workflow"');
    expect(tracesBlock).toContain("workflowInstanceId");
  });

  test("T28 — lenses.list query key exists", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const lensesBlock = content.slice(content.indexOf("lenses:"));
    expect(lensesBlock).toContain('"lenses"');
    expect(lensesBlock).toContain('"list"');
  });

  test("T29 — lenses.result query key includes lensId and traceId", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const lensesBlock = content.slice(content.indexOf("lenses:"));
    expect(lensesBlock).toContain('"result"');
    expect(lensesBlock).toContain("lensId");
    expect(lensesBlock).toContain("traceId");
  });

  test("T30 — lenses.costEstimate query key exists", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const lensesBlock = content.slice(content.indexOf("lenses:"));
    expect(lensesBlock).toContain('"cost-estimate"');
  });

  test("T31 — All query key factories use 'as const'", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const tracesBlock = content.slice(content.indexOf("traces:"), content.indexOf("lenses:"));
    expect(tracesBlock).toContain("as const");
    const lensesBlock = content.slice(content.indexOf("lenses:"));
    expect(lensesBlock).toContain("as const");
  });

  test("T32 — App.tsx imports all 4 page components", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{?\s*Traces\s*\}?\s*from\s*["'].\/pages\/Traces["']/);
    expect(content).toMatch(/import\s*\{?\s*TraceDetail\s*\}?\s*from\s*["'].\/pages\/TraceDetail["']/);
    expect(content).toMatch(/import\s*\{?\s*TraceSettings\s*\}?\s*from\s*["'].\/pages\/TraceSettings["']/);
    expect(content).toMatch(/import\s*\{?\s*WorkflowTraces\s*\}?\s*from\s*["'].\/pages\/WorkflowTraces["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: TRACE-09 — Trace List Page structure (T33-T48)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: TRACE-09 — Trace List Page", () => {
  test("T33 — data-testid trace-09-page wrapper present", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-page"');
  });

  test("T34 — data-testid trace-09-header present", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-header"');
  });

  test("T35 — data-testid trace-09-title present with Traces text", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-title"');
    const idx = content.indexOf('trace-09-title');
    const nearby = content.slice(idx, idx + 200);
    expect(nearby).toContain("Traces");
  });

  test("T36 — data-testid trace-09-filters container present", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-filters"');
  });

  test("T37 — data-testid trace-09-filter-search present as Input", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-filter-search"');
    const idx = content.indexOf('trace-09-filter-search');
    const lineContext = content.slice(Math.max(0, idx - 200), idx + 50);
    expect(lineContext).toMatch(/Input/i);
  });

  test("T38 — data-testid trace-09-filter-status present as SelectTrigger", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-filter-status"');
    const idx = content.indexOf('trace-09-filter-status');
    const lineContext = content.slice(Math.max(0, idx - 100), idx + 50);
    expect(lineContext).toContain("SelectTrigger");
  });

  test("T39 — data-testid trace-09-filter-agent present as SelectTrigger", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-filter-agent"');
    const idx = content.indexOf('trace-09-filter-agent');
    const lineContext = content.slice(Math.max(0, idx - 100), idx + 50);
    expect(lineContext).toContain("SelectTrigger");
  });

  test("T40 — data-testid trace-09-filter-clear present as Button", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-filter-clear"');
    const idx = content.indexOf('trace-09-filter-clear');
    const lineContext = content.slice(Math.max(0, idx - 100), idx + 50);
    expect(lineContext).toMatch(/Button/);
  });

  test("T41 — Status filter options include Running, Completed, Failed, Cancelled", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain("All status");
    expect(content).toContain("Running");
    expect(content).toContain("Completed");
    expect(content).toContain("Failed");
    expect(content).toContain("Cancelled");
  });

  test("T42 — data-testid trace-09-table present", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-table"');
  });

  test("T43 — Table headers include Agent, Name, Status, Duration, Cost, Tokens, Date", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain("Agent");
    expect(content).toContain("Name");
    expect(content).toContain("Status");
    expect(content).toContain("Duration");
    expect(content).toContain("Cost");
    expect(content).toContain("Tokens");
    expect(content).toContain("Date");
  });

  test("T44 — Row data-testid pattern trace-09-row-${trace.id}", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-09-row-\$\{trace\.id\}`\}/);
  });

  test("T45 — Row link data-testid pattern trace-09-link-${trace.id}", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-09-link-\$\{trace\.id\}`\}/);
  });

  test("T46 — data-testid trace-09-pagination present", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-pagination"');
  });

  test("T47 — Pagination prev/next buttons with disabled conditions", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-pagination-prev"');
    expect(content).toContain('data-testid="trace-09-pagination-next"');
    expect(content).toContain("disabled={page === 0}");
    expect(content).toMatch(/disabled=\{\(page \+ 1\) \* PAGE_SIZE >= total\}/);
  });

  test("T48 — Loading, error and empty states present", async () => {
    const content = await readFile(TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-loading"');
    expect(content).toContain('data-testid="trace-09-error"');
    expect(content).toContain('data-testid="trace-09-empty"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: TRACE-09 — Trace Detail Page structure (T49-T68)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: TRACE-09 — Trace Detail Page", () => {
  test("T49 — data-testid trace-09-detail wrapper present", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-detail"');
  });

  test("T50 — data-testid trace-09-back link to /traces", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-back"');
    expect(content).toContain('to="/traces"');
  });

  test("T51 — data-testid trace-09-detail-header present", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-detail-header"');
  });

  test("T52 — data-testid trace-09-agent displays agent name", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-agent"');
    const idx = content.indexOf('trace-09-agent');
    const nearby = content.slice(idx, idx + 200);
    expect(nearby).toContain("agentName");
  });

  test("T53 — data-testid trace-09-duration present", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-duration"');
  });

  test("T54 — data-testid trace-09-cost present", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-cost"');
  });

  test("T55 — data-testid trace-09-tokens present", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-tokens"');
  });

  test("T56 — data-testid trace-09-date present", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-date"');
  });

  test("T57 — data-testid trace-09-live-indicator for running traces", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-live-indicator"');
    expect(content).toContain("In progress...");
    expect(content).toContain("animate-ping");
  });

  test("T58 — data-testid trace-09-analysis-zone for completed traces", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-analysis-zone"');
    // Zone should only show when not running
    expect(content).toContain("{!isRunning &&");
  });

  test("T59 — data-testid trace-09-analysis-disabled for running traces", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-analysis-disabled"');
    expect(content).toContain("Lens analysis will be available when the trace completes");
  });

  test("T60 — LensSelector component rendered in analysis zone", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain("<LensSelector");
    expect(content).toContain("selectedLensId={selectedLensId}");
    expect(content).toContain("onSelectLens={setSelectedLensId}");
  });

  test("T61 — LensAnalysisResult component rendered when lens selected", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain("<LensAnalysisResult");
    expect(content).toContain("lensId={selectedLensId}");
  });

  test("T62 — data-testid trace-09-raw-section present", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-raw-section"');
  });

  test("T63 — data-testid trace-09-raw-toggle button for expanding observations", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-raw-toggle"');
    expect(content).toContain("View raw observations");
  });

  test("T64 — RawObservationTree rendered when showRaw is true", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain("<RawObservationTree");
    expect(content).toContain("showRaw && trace.observations");
  });

  test("T65 — TraceDetail auto-refreshes running traces at 5s interval", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain("refetchInterval:");
    expect(content).toContain("5000");
  });

  test("T66 — TraceDetail loading/error states present", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-09-detail-loading"');
    expect(content).toContain('data-testid="trace-09-detail-error"');
  });

  test("T67 — TraceDetail sets breadcrumbs with Traces + trace name", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toContain("setBreadcrumbs");
    expect(content).toContain('label: "Traces"');
    expect(content).toContain('href: "/traces"');
  });

  test("T68 — Status badge rendered with statusVariant function", async () => {
    const content = await readFile(TRACE_DETAIL_PAGE, "utf-8");
    expect(content).toMatch(/function\s+statusVariant/);
    expect(content).toContain('"destructive"');
    expect(content).toContain("Badge");
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: TRACE-09 — Lens Selector component (T69-T82)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: TRACE-09 — Lens Selector", () => {
  test("T69 — LensSelector file exists and exports LensSelector", async () => {
    await expect(fsAccess(LENS_SELECTOR).then(() => true)).resolves.toBe(true);
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toMatch(/export\s+function\s+LensSelector\s*\(/);
  });

  test("T70 — data-testid trace-09-lens-selector wrapper present", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain('data-testid="trace-09-lens-selector"');
  });

  test("T71 — data-testid trace-09-lens-dropdown button present", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain('data-testid="trace-09-lens-dropdown"');
  });

  test("T72 — DropdownMenu with user lenses and template lenses sections", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain("DropdownMenu");
    expect(content).toContain("DropdownMenuContent");
    expect(content).toContain("DropdownMenuItem");
    expect(content).toContain("DropdownMenuSeparator");
    expect(content).toContain("userLenses");
    expect(content).toContain("templateLenses");
  });

  test("T73 — Lens option data-testid pattern trace-09-lens-option-${lens.id}", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-09-lens-option-\$\{lens\.id\}`\}/);
  });

  test("T74 — Template option data-testid pattern trace-09-lens-template-${lens.id}", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-09-lens-template-\$\{lens\.id\}`\}/);
  });

  test("T75 — Custom analysis option present with trace-09-lens-custom", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain('data-testid="trace-09-lens-custom"');
    expect(content).toContain("Write a custom analysis...");
  });

  test("T76 — data-testid trace-09-lens-clear button present", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain('data-testid="trace-09-lens-clear"');
  });

  test("T77 — data-testid trace-09-custom-analysis container for custom input", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain('data-testid="trace-09-custom-analysis"');
  });

  test("T78 — data-testid trace-09-custom-name Input present", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain('data-testid="trace-09-custom-name"');
    expect(content).toContain("Analysis name (optional)");
  });

  test("T79 — data-testid trace-09-custom-prompt Textarea present", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain('data-testid="trace-09-custom-prompt"');
    expect(content).toContain("Textarea");
  });

  test("T80 — data-testid trace-09-custom-submit Button present", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain('data-testid="trace-09-custom-submit"');
    expect(content).toContain("Create & Analyze");
  });

  test("T81 — data-testid trace-09-custom-cancel Button present", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain('data-testid="trace-09-custom-cancel"');
  });

  test("T82 — createLensMutation uses lensesApi.create", async () => {
    const content = await readFile(LENS_SELECTOR, "utf-8");
    expect(content).toContain("useMutation");
    expect(content).toContain("lensesApi.create");
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: TRACE-09 — Lens Analysis Result component (T83-T94)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: TRACE-09 — Lens Analysis Result", () => {
  test("T83 — LensAnalysisResult file exists and exports LensAnalysisResult", async () => {
    await expect(fsAccess(LENS_ANALYSIS_RESULT).then(() => true)).resolves.toBe(true);
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toMatch(/export\s+function\s+LensAnalysisResult\s*\(/);
  });

  test("T84 — data-testid trace-09-analysis-result for cached result", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain('data-testid="trace-09-analysis-result"');
  });

  test("T85 — data-testid trace-09-analysis-markdown with MarkdownBody", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain('data-testid="trace-09-analysis-markdown"');
    expect(content).toContain("MarkdownBody");
    expect(content).toContain("result.resultMarkdown");
  });

  test("T86 — data-testid trace-09-analysis-refresh re-analyze button", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain('data-testid="trace-09-analysis-refresh"');
    expect(content).toContain("Re-analyze");
  });

  test("T87 — data-testid trace-09-analysis-loading state", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain('data-testid="trace-09-analysis-loading"');
    expect(content).toContain("Checking for cached analysis");
  });

  test("T88 — data-testid trace-09-analysis-running state", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain('data-testid="trace-09-analysis-running"');
    expect(content).toContain("Analyzing trace through your lens");
  });

  test("T89 — data-testid trace-09-analysis-error state with retry", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain('data-testid="trace-09-analysis-error"');
    expect(content).toContain("Analysis failed");
    expect(content).toContain("Retry");
  });

  test("T90 — data-testid trace-09-analysis-prompt for launching analysis", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain('data-testid="trace-09-analysis-prompt"');
    expect(content).toContain("Ready to analyze");
  });

  test("T91 — data-testid trace-09-launch-analysis button present", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain('data-testid="trace-09-launch-analysis"');
    expect(content).toContain("Run Analysis");
  });

  test("T92 — Cost estimate displayed before analysis", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain("costEstimate");
    expect(content).toContain("estimatedCostUsd");
    expect(content).toContain("observationCount");
  });

  test("T93 — 404 detection triggers needsAnalysis state", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain("is404");
    expect(content).toContain("status === 404");
    expect(content).toContain("needsAnalysis");
  });

  test("T94 — data-testid trace-09-result-error for unexpected errors", async () => {
    const content = await readFile(LENS_ANALYSIS_RESULT, "utf-8");
    expect(content).toContain('data-testid="trace-09-result-error"');
    expect(content).toContain("Failed to load analysis result");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: TRACE-09 — Raw Observation Tree (T95-T108)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: TRACE-09 — Raw Observation Tree", () => {
  test("T95 — RawObservationTree file exists and exports RawObservationTree", async () => {
    await expect(fsAccess(RAW_OBSERVATION_TREE).then(() => true)).resolves.toBe(true);
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toMatch(/export\s+function\s+RawObservationTree\s*\(/);
  });

  test("T96 — data-testid trace-09-raw-tree container present", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toContain('data-testid="trace-09-raw-tree"');
  });

  test("T97 — data-testid trace-09-raw-empty for no observations", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toContain('data-testid="trace-09-raw-empty"');
    expect(content).toContain("No observations recorded");
  });

  test("T98 — Observation node data-testid pattern trace-09-obs-${observation.id}", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-09-obs-\$\{observation\.id\}`\}/);
  });

  test("T99 — typeIcon function returns Wrench for span, Brain for generation, Circle for event", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toMatch(/function\s+typeIcon/);
    expect(content).toContain("Wrench");
    expect(content).toContain("Brain");
    expect(content).toContain("Circle");
    expect(content).toContain('"span"');
    expect(content).toContain('"generation"');
    expect(content).toContain('"event"');
  });

  test("T100 — statusIcon function returns CheckCircle, XCircle, Clock", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toMatch(/function\s+statusIcon/);
    expect(content).toContain("CheckCircle");
    expect(content).toContain("XCircle");
    expect(content).toContain("Clock");
  });

  test("T101 — Input/Output expandable sections with truncation", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-09-obs-input-\$\{observation\.id\}`\}/);
    expect(content).toMatch(/data-testid=\{`trace-09-obs-output-\$\{observation\.id\}`\}/);
    expect(content).toContain("truncateJson");
    expect(content).toContain("[truncated]");
  });

  test("T102 — buildTree function constructs tree from flat list", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toMatch(/function\s+buildTree/);
    expect(content).toContain("parentObservationId");
    expect(content).toContain("roots");
  });

  test("T103 — ObservationNode component renders recursively", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toMatch(/function\s+ObservationNode/);
    expect(content).toContain("<ObservationNode");
    expect(content).toContain("depth={depth + 1}");
  });

  test("T104 — Node is clickable with role=button and keyboard support", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toContain('role="button"');
    expect(content).toContain("onKeyDown");
    expect(content).toContain("Enter");
  });

  test("T105 — Expand/collapse chevron icons present", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toContain("ChevronRight");
    expect(content).toContain("ChevronDown");
  });

  test("T106 — Duration and token count displayed per observation", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toContain("observation.durationMs");
    expect(content).toContain("observation.totalTokens");
    expect(content).toContain("tok");
  });

  test("T107 — Children indentation via ml-5 class", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toContain("ml-5");
    expect(content).toContain("depth > 0");
  });

  test("T108 — Imports ObservationType from traces API", async () => {
    const content = await readFile(RAW_OBSERVATION_TREE, "utf-8");
    expect(content).toMatch(/import\s+type\s*\{[^}]*ObservationType[^}]*\}\s*from\s*["']\.\.\/\.\.\/api\/traces["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: TRACE-10 — Trace Settings / Lens CRUD (T109-T130)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: TRACE-10 — Trace Settings / Lens CRUD", () => {
  test("T109 — data-testid trace-10-page wrapper present", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-page"');
  });

  test("T110 — data-testid trace-10-title with Trace Lenses text", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-title"');
    const idx = content.indexOf('trace-10-title');
    const nearby = content.slice(idx, idx + 200);
    expect(nearby).toContain("Trace Lenses");
  });

  test("T111 — data-testid trace-10-create-btn New Lens button", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-create-btn"');
    expect(content).toContain("New Lens");
  });

  test("T112 — data-testid trace-10-user-lenses section present", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-user-lenses"');
    expect(content).toContain("Your Lenses");
  });

  test("T113 — data-testid trace-10-no-lenses empty state", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-no-lenses"');
    expect(content).toContain("No custom lenses yet");
  });

  test("T114 — data-testid trace-10-templates section present", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-templates"');
    expect(content).toContain("Suggested Templates");
  });

  test("T115 — LensCard data-testid pattern trace-10-lens-${lens.id}", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-10-lens-\$\{lens\.id\}`\}/);
  });

  test("T116 — LensCard shows name, prompt preview, badges", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain("{lens.name}");
    expect(content).toContain("{lens.prompt}");
    expect(content).toContain("Template");
    expect(content).toContain("Default");
    expect(content).toContain("Inactive");
  });

  test("T117 — Edit button data-testid trace-10-edit-${lens.id}", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-10-edit-\$\{lens\.id\}`\}/);
  });

  test("T118 — Delete button data-testid trace-10-delete-${lens.id}", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-10-delete-\$\{lens\.id\}`\}/);
  });

  test("T119 — Create dialog with Dialog component", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain("Dialog");
    expect(content).toContain("DialogContent");
    expect(content).toContain("Create Lens");
  });

  test("T120 — Edit dialog with Dialog component", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain("Edit Lens");
  });

  test("T121 — Delete confirmation dialog with destructive button", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain("Delete Lens");
    expect(content).toContain('variant="destructive"');
    expect(content).toContain("This cannot be undone");
  });

  test("T122 — data-testid trace-10-create-submit button", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-create-submit"');
  });

  test("T123 — data-testid trace-10-edit-submit button", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-edit-submit"');
  });

  test("T124 — data-testid trace-10-delete-confirm button", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-delete-confirm"');
  });

  test("T125 — LensForm with name Input, prompt Textarea, default Switch", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-form-name"');
    expect(content).toContain('data-testid="trace-10-form-prompt"');
    expect(content).toContain('data-testid="trace-10-form-default"');
    expect(content).toContain("Switch");
    expect(content).toContain("Textarea");
    expect(content).toContain("Input");
  });

  test("T126 — Create mutation invalidates lenses list", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain("createMutation");
    expect(content).toContain("queryKeys.lenses.list");
    expect(content).toContain("invalidateQueries");
  });

  test("T127 — Update mutation invalidates lenses list", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain("updateMutation");
    expect(content).toContain("lensesApi.update");
  });

  test("T128 — Delete mutation calls lensesApi.delete", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain("deleteMutation");
    expect(content).toContain("lensesApi.delete");
  });

  test("T129 — Loading state with trace-10-loading", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-10-loading"');
  });

  test("T130 — Breadcrumbs set to Settings > Trace Lenses", async () => {
    const content = await readFile(TRACE_SETTINGS_PAGE, "utf-8");
    expect(content).toContain('label: "Settings"');
    expect(content).toContain('label: "Trace Lenses"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: TRACE-10 — Context Trace Section (T131-T140)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: TRACE-10 — Context Trace Section", () => {
  test("T131 — ContextTraceSection file exists and exports ContextTraceSection", async () => {
    await expect(fsAccess(CONTEXT_TRACE_SECTION).then(() => true)).resolves.toBe(true);
    const content = await readFile(CONTEXT_TRACE_SECTION, "utf-8");
    expect(content).toMatch(/export\s+function\s+ContextTraceSection\s*\(/);
  });

  test("T132 — data-testid trace-10-context-section wrapper present", async () => {
    const content = await readFile(CONTEXT_TRACE_SECTION, "utf-8");
    expect(content).toContain('data-testid="trace-10-context-section"');
  });

  test("T133 — Displays Active Agents count or Recent Traces header", async () => {
    const content = await readFile(CONTEXT_TRACE_SECTION, "utf-8");
    expect(content).toContain("Active Agents");
    expect(content).toContain("Recent Traces");
  });

  test("T134 — Agent trace summary data-testid pattern trace-10-context-agent-${trace.agentId}", async () => {
    const content = await readFile(CONTEXT_TRACE_SECTION, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-10-context-agent-\$\{trace\.agentId\}`\}/);
  });

  test("T135 — Links to trace detail page from agent summary", async () => {
    const content = await readFile(CONTEXT_TRACE_SECTION, "utf-8");
    expect(content).toContain("to={`/traces/${trace.id}`}");
  });

  test("T136 — Shows mini stats (duration, cost, tokens)", async () => {
    const content = await readFile(CONTEXT_TRACE_SECTION, "utf-8");
    expect(content).toContain("formatDuration");
    expect(content).toContain("formatCost");
    expect(content).toContain("formatTokens");
  });

  test("T137 — Auto-loads default lens result for completed traces", async () => {
    const content = await readFile(CONTEXT_TRACE_SECTION, "utf-8");
    expect(content).toContain("defaultLens");
    expect(content).toContain("isDefault");
    expect(content).toContain("lensResult");
    expect(content).toContain("lensesApi.getResult");
  });

  test("T138 — Renders MarkdownBody for lens result preview", async () => {
    const content = await readFile(CONTEXT_TRACE_SECTION, "utf-8");
    expect(content).toContain("MarkdownBody");
    expect(content).toContain("resultMarkdown");
  });

  test("T139 — Polls for live trace updates at 10s interval", async () => {
    const content = await readFile(CONTEXT_TRACE_SECTION, "utf-8");
    expect(content).toContain("refetchInterval: 10_000");
  });

  test("T140 — Returns null when no traces to display", async () => {
    const content = await readFile(CONTEXT_TRACE_SECTION, "utf-8");
    expect(content).toContain("if (displayTraces.length === 0) return null");
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: TRACE-12 — Workflow Traces page (T141-T156)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: TRACE-12 — Workflow Traces page", () => {
  test("T141 — data-testid trace-12-page wrapper present", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-12-page"');
  });

  test("T142 — data-testid trace-12-back link to workflow", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-12-back"');
    expect(content).toContain("Back to Workflow");
  });

  test("T143 — data-testid trace-12-header present", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-12-header"');
  });

  test("T144 — data-testid trace-12-total-duration aggregate stat", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-12-total-duration"');
  });

  test("T145 — data-testid trace-12-total-cost aggregate stat", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-12-total-cost"');
  });

  test("T146 — data-testid trace-12-total-tokens aggregate stat", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-12-total-tokens"');
  });

  test("T147 — data-testid trace-12-agent-count aggregate stat", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-12-agent-count"');
    expect(content).toContain("uniqueAgents");
  });

  test("T148 — WorkflowTimeline component rendered", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain("<WorkflowTimeline");
    expect(content).toContain("traces={traces}");
    expect(content).toContain("agentMap={agentMap}");
  });

  test("T149 — data-testid trace-12-empty for no traces", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-12-empty"');
    expect(content).toContain("No traces recorded for this workflow");
  });

  test("T150 — data-testid trace-12-lens-section for workflow analysis", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-12-lens-section"');
    expect(content).toContain("Workflow Analysis");
  });

  test("T151 — LensSelector rendered for workflow-level analysis", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain("<LensSelector");
  });

  test("T152 — Uses queryKeys.traces.byWorkflow for fetching", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain("queryKeys.traces.byWorkflow");
  });

  test("T153 — Loading state with trace-12-loading", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('data-testid="trace-12-loading"');
  });

  test("T154 — Auto-refreshes at 10s interval", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain("refetchInterval: 10_000");
  });

  test("T155 — Breadcrumbs set to Workflows > name > Traces", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain('label: "Workflows"');
    expect(content).toContain('label: "Traces"');
  });

  test("T156 — Total duration computed from earliest start to latest end", async () => {
    const content = await readFile(WORKFLOW_TRACES_PAGE, "utf-8");
    expect(content).toContain("Math.min(...starts)");
    expect(content).toContain("Math.max(...ends)");
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: TRACE-12 — AgentTimelineBar + WorkflowTimeline (T157-T170)
// ---------------------------------------------------------------------------

test.describe("Groupe 12: TRACE-12 — AgentTimelineBar + WorkflowTimeline", () => {
  test("T157 — AgentTimelineBar file exists and exports AgentTimelineBar", async () => {
    await expect(fsAccess(AGENT_TIMELINE_BAR).then(() => true)).resolves.toBe(true);
    const content = await readFile(AGENT_TIMELINE_BAR, "utf-8");
    expect(content).toMatch(/export\s+function\s+AgentTimelineBar\s*\(/);
  });

  test("T158 — Bar data-testid pattern trace-12-bar-${trace.id}", async () => {
    const content = await readFile(AGENT_TIMELINE_BAR, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-12-bar-\$\{trace\.id\}`\}/);
  });

  test("T159 — Bar link data-testid pattern trace-12-bar-link-${trace.id}", async () => {
    const content = await readFile(AGENT_TIMELINE_BAR, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-12-bar-link-\$\{trace\.id\}`\}/);
  });

  test("T160 — statusColor function returns correct colors per status", async () => {
    const content = await readFile(AGENT_TIMELINE_BAR, "utf-8");
    expect(content).toMatch(/function\s+statusColor/);
    expect(content).toContain('"running"');
    expect(content).toContain('"completed"');
    expect(content).toContain('"failed"');
    expect(content).toContain('"cancelled"');
    // Each status maps to a bg- class
    const statusBlock = content.slice(content.indexOf("function statusColor"), content.indexOf("function statusColor") + 400);
    const bgMatches = statusBlock.match(/bg-/g);
    expect(bgMatches).not.toBeNull();
    expect(bgMatches!.length).toBeGreaterThanOrEqual(4);
  });

  test("T161 — Running bars have animate-pulse class", async () => {
    const content = await readFile(AGENT_TIMELINE_BAR, "utf-8");
    expect(content).toContain("animate-pulse");
    expect(content).toContain("isRunning");
  });

  test("T162 — Minimum 1% width for visibility", async () => {
    const content = await readFile(AGENT_TIMELINE_BAR, "utf-8");
    expect(content).toContain("Math.max");
    expect(content).toContain(", 1)");
  });

  test("T163 — Sub-trace indentation with ml-4", async () => {
    const content = await readFile(AGENT_TIMELINE_BAR, "utf-8");
    expect(content).toContain("isSubTrace");
    expect(content).toContain("ml-4");
  });

  test("T164 — Tooltip with agent name, trace name, duration, cost, status", async () => {
    const content = await readFile(AGENT_TIMELINE_BAR, "utf-8");
    expect(content).toContain("Tooltip");
    expect(content).toContain("TooltipContent");
    expect(content).toContain("{agentName}");
    expect(content).toContain("{trace.name}");
    expect(content).toContain("formatDuration");
    expect(content).toContain("formatCost");
  });

  test("T165 — WorkflowTimeline file exists and exports WorkflowTimeline", async () => {
    await expect(fsAccess(WORKFLOW_TIMELINE).then(() => true)).resolves.toBe(true);
    const content = await readFile(WORKFLOW_TIMELINE, "utf-8");
    expect(content).toMatch(/export\s+function\s+WorkflowTimeline\s*\(/);
  });

  test("T166 — data-testid trace-12-timeline wrapper present", async () => {
    const content = await readFile(WORKFLOW_TIMELINE, "utf-8");
    expect(content).toContain('data-testid="trace-12-timeline"');
  });

  test("T167 — data-testid trace-12-time-axis present", async () => {
    const content = await readFile(WORKFLOW_TIMELINE, "utf-8");
    expect(content).toContain('data-testid="trace-12-time-axis"');
  });

  test("T168 — data-testid trace-12-handoffs for stage handoff indicators", async () => {
    const content = await readFile(WORKFLOW_TIMELINE, "utf-8");
    expect(content).toContain('data-testid="trace-12-handoffs"');
  });

  test("T169 — Builds TimelineRow array with parent/child/orphan traces", async () => {
    const content = await readFile(WORKFLOW_TIMELINE, "utf-8");
    expect(content).toContain("parentTraces");
    expect(content).toContain("subTraces");
    expect(content).toContain("orphanSubs");
    expect(content).toContain("isSubTrace");
  });

  test("T170 — Time axis markers with formatTimeLabel helper", async () => {
    const content = await readFile(WORKFLOW_TIMELINE, "utf-8");
    expect(content).toMatch(/function\s+formatTimeLabel/);
    expect(content).toContain("markers");
    expect(content).toContain("marker.label");
  });
});

// ---------------------------------------------------------------------------
// Groupe 13: TRACE-13 — Multi-Agent Live Panel (T171-T188)
// ---------------------------------------------------------------------------

test.describe("Groupe 13: TRACE-13 — Multi-Agent Live Panel", () => {
  test("T171 — MultiAgentLivePanel file exists and exports MultiAgentLivePanel", async () => {
    await expect(fsAccess(MULTI_AGENT_LIVE_PANEL).then(() => true)).resolves.toBe(true);
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toMatch(/export\s+function\s+MultiAgentLivePanel\s*\(/);
  });

  test("T172 — data-testid trace-13-panel wrapper present", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain('data-testid="trace-13-panel"');
  });

  test("T173 — Active Agents header with live count", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain("Active Agents");
    expect(content).toContain("{liveCount}");
  });

  test("T174 — Pulsing live indicator dot present", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain("animate-ping");
    // Uses bg-agent (design-system token) for the pulsing dot
    expect(content).toContain("bg-agent");
  });

  test("T175 — LiveAgentCard data-testid trace-13-agent-${trace.agentId}", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-13-agent-\$\{trace\.agentId\}`\}/);
  });

  test("T176 — Agent link data-testid trace-13-agent-link-${trace.agentId}", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-13-agent-link-\$\{trace\.agentId\}`\}/);
  });

  test("T177 — Current observation display trace-13-current-obs-${trace.agentId}", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-13-current-obs-\$\{trace\.agentId\}`\}/);
  });

  test("T178 — Live counters show observation count, duration, cost", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain("observationCount");
    expect(content).toContain("formatDuration");
    expect(content).toContain("formatCost");
    expect(content).toContain("obs");
  });

  test("T179 — Fetches trace detail every 3s for current observation", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain("refetchInterval: 3_000");
  });

  test("T180 — CompletedAgentCard data-testid trace-13-completed-${trace.agentId}", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-13-completed-\$\{trace\.agentId\}`\}/);
  });

  test("T181 — WaitingAgentCard data-testid trace-13-waiting-${agentName}", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toMatch(/data-testid=\{`trace-13-waiting-\$\{agentName\}`\}/);
  });

  test("T182 — File conflict warnings with trace-13-conflicts", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain('data-testid="trace-13-conflicts"');
    expect(content).toContain("Potential conflict");
    expect(content).toContain("fileConflicts");
  });

  test("T183 — Mini timeline data-testid trace-13-mini-timeline", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain('data-testid="trace-13-mini-timeline"');
  });

  test("T184 — Mini timeline shows pulsing bars for live traces", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain("animate-pulse");
    expect(content).toContain("widthPct");
  });

  test("T185 — Recently completed section with trace-13-recent", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain('data-testid="trace-13-recent"');
    expect(content).toContain("Recently Completed");
  });

  test("T186 — Panel returns null when liveCount is 0", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain("if (liveCount === 0) return null");
  });

  test("T187 — Uses useProjectLiveTraces hook", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain("useProjectLiveTraces");
    expect(content).toContain("liveTraces");
    expect(content).toContain("liveCount");
    expect(content).toContain("fileConflicts");
  });

  test("T188 — Current observation detection finds running or most recent", async () => {
    const content = await readFile(MULTI_AGENT_LIVE_PANEL, "utf-8");
    expect(content).toContain("currentObs");
    expect(content).toContain("!o.completedAt");
  });
});

// ---------------------------------------------------------------------------
// Groupe 14: TRACE-13 — useProjectLiveTraces hook (T189-T195)
// ---------------------------------------------------------------------------

test.describe("Groupe 14: TRACE-13 — useProjectLiveTraces hook", () => {
  test("T189 — useProjectLiveTraces file exists and exports hook", async () => {
    await expect(fsAccess(USE_PROJECT_LIVE_TRACES).then(() => true)).resolves.toBe(true);
    const content = await readFile(USE_PROJECT_LIVE_TRACES, "utf-8");
    expect(content).toMatch(/export\s+function\s+useProjectLiveTraces\s*\(/);
  });

  test("T190 — LiveAgentTrace interface exported", async () => {
    const content = await readFile(USE_PROJECT_LIVE_TRACES, "utf-8");
    expect(content).toMatch(/export\s+interface\s+LiveAgentTrace/);
    expect(content).toContain("trace: Trace");
    expect(content).toContain("agentName: string");
  });

  test("T191 — Polls running traces every 5s", async () => {
    const content = await readFile(USE_PROJECT_LIVE_TRACES, "utf-8");
    expect(content).toContain("refetchInterval: 5_000");
    expect(content).toContain('status: "running"');
  });

  test("T192 — Builds agentMap from agents list", async () => {
    const content = await readFile(USE_PROJECT_LIVE_TRACES, "utf-8");
    expect(content).toContain("agentMap");
    expect(content).toContain("agentsApi.list");
  });

  test("T193 — Returns liveTraces, liveCount, fileConflicts, isLoading", async () => {
    const content = await readFile(USE_PROJECT_LIVE_TRACES, "utf-8");
    expect(content).toContain("liveTraces");
    expect(content).toContain("liveCount: liveTraces.length");
    expect(content).toContain("fileConflicts");
    expect(content).toContain("isLoading");
  });

  test("T194 — fileConflicts placeholder returns empty array", async () => {
    const content = await readFile(USE_PROJECT_LIVE_TRACES, "utf-8");
    expect(content).toContain("return [] as Array<{ file: string; agents: string[] }>");
  });

  test("T195 — Limits running traces query to 20", async () => {
    const content = await readFile(USE_PROJECT_LIVE_TRACES, "utf-8");
    expect(content).toContain("limit: 20");
  });
});

// ---------------------------------------------------------------------------
// Groupe 15: LiveEvents trace integration (T196-T200)
// ---------------------------------------------------------------------------

test.describe("Groupe 15: LiveEvents trace integration", () => {
  test("T196 — LiveUpdatesProvider handles trace.created event", async () => {
    const content = await readFile(LIVE_UPDATES_FILE, "utf-8");
    expect(content).toContain('event.type === "trace.created"');
  });

  test("T197 — LiveUpdatesProvider handles trace.observation_created event", async () => {
    const content = await readFile(LIVE_UPDATES_FILE, "utf-8");
    expect(content).toContain('event.type === "trace.observation_created"');
  });

  test("T198 — LiveUpdatesProvider handles trace.observation_completed event", async () => {
    const content = await readFile(LIVE_UPDATES_FILE, "utf-8");
    expect(content).toContain('event.type === "trace.observation_completed"');
  });

  test("T199 — LiveUpdatesProvider handles trace.completed event", async () => {
    const content = await readFile(LIVE_UPDATES_FILE, "utf-8");
    expect(content).toContain('event.type === "trace.completed"');
  });

  test("T200 — Trace events invalidate both list and detail queries", async () => {
    const content = await readFile(LIVE_UPDATES_FILE, "utf-8");
    // Should invalidate trace list queries
    expect(content).toContain('queryKey: ["traces"');
    // Should invalidate specific trace detail
    expect(content).toContain("queryKeys.traces.detail");
  });
});
