/**
 * DASH-S02: DashboardCards UI — E2E Tests
 *
 * These tests verify the deliverables of DASH-S02:
 *   - Groupe 1: API client (T01-T06)
 *   - Groupe 2: Query keys (T07-T10)
 *   - Groupe 3: DashboardKpiCards component (T11-T18)
 *   - Groupe 4: DashboardTimeline component (T19-T24)
 *   - Groupe 5: DashboardBreakdownPanel component (T25-T32)
 *   - Groupe 6: Dashboard page integration (T33-T40)
 *   - Groupe 7: Type imports and safety (T41-T45)
 *   - Groupe 8: Data-testid coverage (T46-T52)
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const API_CLIENT = resolve(ROOT, "ui/src/api/dashboard.ts");
const QUERY_KEYS = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const KPI_CARDS = resolve(ROOT, "ui/src/components/DashboardKpiCards.tsx");
const TIMELINE = resolve(ROOT, "ui/src/components/DashboardTimeline.tsx");
const BREAKDOWN = resolve(ROOT, "ui/src/components/DashboardBreakdownPanel.tsx");
const DASHBOARD_PAGE = resolve(ROOT, "ui/src/pages/Dashboard.tsx");

// ---------------------------------------------------------------------------
// Groupe 1: API client (T01-T06)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: API client", () => {
  test("T01 — API client file exports dashboardApi with kpis function", async () => {
    await expect(fsAccess(API_CLIENT).then(() => true)).resolves.toBe(true);
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toContain("dashboardApi");
    expect(content).toContain("kpis:");
  });

  test("T02 — API client kpis function calls GET /companies/:companyId/dashboard/kpis", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(/\/companies\/.*\/dashboard\/kpis/);
  });

  test("T03 — API client timeline function calls GET with period param", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toContain("timeline:");
    expect(content).toMatch(/\/dashboard\/timeline\?period=/);
  });

  test("T04 — API client breakdown function calls GET /dashboard/breakdown/:category", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toContain("breakdown:");
    expect(content).toMatch(/\/dashboard\/breakdown\//);
  });

  test("T05 — API client preserves legacy summary function", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toContain("summary:");
    expect(content).toMatch(/\/companies\/.*\/dashboard`/);
  });

  test("T06 — API client imports DashboardKpis, DashboardTimeline, DashboardBreakdown types", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toContain("DashboardKpis");
    expect(content).toContain("DashboardTimeline");
    expect(content).toContain("DashboardBreakdown");
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Query keys (T07-T10)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Query keys", () => {
  test("T07 — queryKeys.dashboard has kpis function returning namespaced key", async () => {
    const content = await readFile(QUERY_KEYS, "utf-8");
    expect(content).toMatch(/kpis:\s*\(/);
    expect(content).toMatch(/\["dashboard",\s*companyId,\s*"kpis"\]/);
  });

  test("T08 — queryKeys.dashboard has timeline function returning namespaced key with period", async () => {
    const content = await readFile(QUERY_KEYS, "utf-8");
    expect(content).toMatch(/timeline:\s*\(/);
    expect(content).toMatch(/\["dashboard",\s*companyId,\s*"timeline",\s*period\]/);
  });

  test("T09 — queryKeys.dashboard has breakdown function returning namespaced key with category", async () => {
    const content = await readFile(QUERY_KEYS, "utf-8");
    expect(content).toMatch(/breakdown:\s*\(/);
    expect(content).toMatch(/\["dashboard",\s*companyId,\s*"breakdown",\s*category\]/);
  });

  test("T10 — Legacy queryKeys.dashboard function still exists for backward compatibility", async () => {
    const content = await readFile(QUERY_KEYS, "utf-8");
    // The legacy function is preserved via Object.assign pattern
    expect(content).toMatch(/dashboard:\s*Object\.assign/);
    expect(content).toMatch(/\(companyId:\s*string\)\s*=>\s*\["dashboard",\s*companyId\]/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: DashboardKpiCards component (T11-T18)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: DashboardKpiCards component", () => {
  test("T11 — DashboardKpiCards file exists and exports named function", async () => {
    await expect(fsAccess(KPI_CARDS).then(() => true)).resolves.toBe(true);
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toMatch(/export\s+function\s+DashboardKpiCards\s*\(/);
  });

  test("T12 — Component renders dash-s02-kpi-cards container with data-testid", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain('data-testid="dash-s02-kpi-cards"');
  });

  test("T13 — Component renders dash-s02-kpi-workflows card with data-testid", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain('data-testid="dash-s02-kpi-workflows"');
  });

  test("T14 — Component renders dash-s02-kpi-audit card with data-testid", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain('data-testid="dash-s02-kpi-audit"');
  });

  test("T15 — Component renders dash-s02-kpi-containers card with data-testid", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain('data-testid="dash-s02-kpi-containers"');
  });

  test("T16 — Component renders dash-s02-kpi-drift card with data-testid", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain('data-testid="dash-s02-kpi-drift"');
  });

  test("T17 — Component imports DashboardKpis type from @mnm/shared", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain("DashboardKpis");
    expect(content).toContain("@mnm/shared");
  });

  test("T18 — Component uses MetricCard pattern", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain("MetricCard");
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: DashboardTimeline component (T19-T24)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: DashboardTimeline component", () => {
  test("T19 — DashboardTimeline file exists and exports named function", async () => {
    await expect(fsAccess(TIMELINE).then(() => true)).resolves.toBe(true);
    const content = await readFile(TIMELINE, "utf-8");
    expect(content).toMatch(/export\s+function\s+DashboardTimeline\s*\(/);
  });

  test("T20 — Component renders dash-s02-timeline container with data-testid", async () => {
    const content = await readFile(TIMELINE, "utf-8");
    expect(content).toContain('data-testid="dash-s02-timeline"');
  });

  test("T21 — Component renders dash-s02-timeline-select period selector with data-testid", async () => {
    const content = await readFile(TIMELINE, "utf-8");
    expect(content).toContain('data-testid="dash-s02-timeline-select"');
  });

  test("T22 — Component renders dash-s02-timeline-chart area with data-testid", async () => {
    const content = await readFile(TIMELINE, "utf-8");
    expect(content).toContain('data-testid="dash-s02-timeline-chart"');
  });

  test("T23 — Component imports DashboardTimeline type from @mnm/shared", async () => {
    const content = await readFile(TIMELINE, "utf-8");
    expect(content).toMatch(/DashboardTimeline\b/);
    expect(content).toContain("@mnm/shared");
  });

  test("T24 — Component supports DASHBOARD_PERIODS values (7d, 30d, 90d)", async () => {
    const content = await readFile(TIMELINE, "utf-8");
    expect(content).toContain("DASHBOARD_PERIODS");
    expect(content).toContain("7d");
    expect(content).toContain("30d");
    expect(content).toContain("90d");
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: DashboardBreakdownPanel component (T25-T32)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: DashboardBreakdownPanel component", () => {
  test("T25 — DashboardBreakdownPanel file exists and exports named function", async () => {
    await expect(fsAccess(BREAKDOWN).then(() => true)).resolves.toBe(true);
    const content = await readFile(BREAKDOWN, "utf-8");
    expect(content).toMatch(/export\s+function\s+DashboardBreakdownPanel\s*\(/);
  });

  test("T26 — Component renders dash-s02-breakdown container with data-testid", async () => {
    const content = await readFile(BREAKDOWN, "utf-8");
    expect(content).toContain('data-testid="dash-s02-breakdown"');
  });

  test("T27 — Component renders dash-s02-breakdown-select category selector with data-testid", async () => {
    const content = await readFile(BREAKDOWN, "utf-8");
    expect(content).toContain('data-testid="dash-s02-breakdown-select"');
  });

  test("T28 — Component renders dash-s02-breakdown-list items container with data-testid", async () => {
    const content = await readFile(BREAKDOWN, "utf-8");
    expect(content).toContain('data-testid="dash-s02-breakdown-list"');
  });

  test("T29 — Component renders dash-s02-breakdown-item for each item with data-testid", async () => {
    const content = await readFile(BREAKDOWN, "utf-8");
    expect(content).toContain('data-testid="dash-s02-breakdown-item"');
  });

  test("T30 — Component imports DashboardBreakdown type from @mnm/shared", async () => {
    const content = await readFile(BREAKDOWN, "utf-8");
    expect(content).toContain("DashboardBreakdown");
    expect(content).toContain("@mnm/shared");
  });

  test("T31 — Component supports DASHBOARD_BREAKDOWN_CATEGORIES values", async () => {
    const content = await readFile(BREAKDOWN, "utf-8");
    expect(content).toContain("DASHBOARD_BREAKDOWN_CATEGORIES");
    expect(content).toContain("agents");
    expect(content).toContain("workflows");
    expect(content).toContain("audit");
    expect(content).toContain("costs");
    expect(content).toContain("containers");
  });

  test("T32 — Component renders bar widths based on percentage of total", async () => {
    const content = await readFile(BREAKDOWN, "utf-8");
    // Verify percentage-based width calculation
    expect(content).toMatch(/item\.count\s*\/\s*total/);
    expect(content).toMatch(/width:.*%/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Dashboard page integration (T33-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Dashboard page integration", () => {
  test("T33 — Dashboard.tsx imports DashboardKpiCards component", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("DashboardKpiCards");
    expect(content).toMatch(/import\s*\{.*DashboardKpiCards.*\}\s*from/);
  });

  test("T34 — Dashboard.tsx imports DashboardTimeline component", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("DashboardTimeline");
    expect(content).toMatch(/import\s*\{.*DashboardTimeline.*\}\s*from/);
  });

  test("T35 — Dashboard.tsx imports DashboardBreakdownPanel component", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("DashboardBreakdownPanel");
    expect(content).toMatch(/import\s*\{.*DashboardBreakdownPanel.*\}\s*from/);
  });

  test("T36 — Dashboard.tsx uses queryKeys.dashboard.kpis for useQuery", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("queryKeys.dashboard.kpis");
  });

  test("T37 — Dashboard.tsx calls dashboardApi.kpis for fetching", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("dashboardApi.kpis");
  });

  test("T38 — Dashboard.tsx renders DashboardTimeline with companyId", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toMatch(/<DashboardTimeline\s+companyId=/);
  });

  test("T39 — Dashboard.tsx renders DashboardBreakdownPanel with companyId", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toMatch(/<DashboardBreakdownPanel\s+companyId=/);
  });

  test("T40 — Dashboard.tsx preserves legacy summary useQuery call", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("dashboardApi.summary");
    expect(content).toContain("queryKeys.dashboard(selectedCompanyId!)");
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Type imports and safety (T41-T45)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Type imports and safety", () => {
  test("T41 — DashboardKpiCards accepts DashboardKpis or undefined as prop", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toMatch(/DashboardKpis\s*\|\s*undefined/);
  });

  test("T42 — DashboardTimeline accepts companyId as prop", async () => {
    const content = await readFile(TIMELINE, "utf-8");
    expect(content).toContain("companyId: string");
  });

  test("T43 — DashboardBreakdownPanel accepts companyId as prop", async () => {
    const content = await readFile(BREAKDOWN, "utf-8");
    expect(content).toContain("companyId: string");
  });

  test("T44 — API dashboard.ts imports from @mnm/shared for type safety", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toContain("@mnm/shared");
    expect(content).toContain("DashboardPeriod");
    expect(content).toContain("DashboardBreakdownCategory");
  });

  test("T45 — All three components handle loading states", async () => {
    const kpiContent = await readFile(KPI_CARDS, "utf-8");
    const timelineContent = await readFile(TIMELINE, "utf-8");
    const breakdownContent = await readFile(BREAKDOWN, "utf-8");
    // KpiCards checks for undefined data and returns null
    expect(kpiContent).toMatch(/if\s*\(\s*!data\s*\)/);
    // Timeline has isLoading check
    expect(timelineContent).toContain("isLoading");
    // Breakdown has isLoading check
    expect(breakdownContent).toContain("isLoading");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Data-testid coverage (T46-T52)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Data-testid coverage", () => {
  test("T46 — DashboardKpiCards contains data-testid='dash-s02-kpi-cards'", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain('data-testid="dash-s02-kpi-cards"');
  });

  test("T47 — DashboardKpiCards contains data-testid='dash-s02-kpi-workflows'", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain('data-testid="dash-s02-kpi-workflows"');
  });

  test("T48 — DashboardKpiCards contains data-testid='dash-s02-kpi-audit'", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain('data-testid="dash-s02-kpi-audit"');
  });

  test("T49 — DashboardKpiCards contains data-testid='dash-s02-kpi-containers'", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain('data-testid="dash-s02-kpi-containers"');
  });

  test("T50 — DashboardKpiCards contains data-testid='dash-s02-kpi-drift'", async () => {
    const content = await readFile(KPI_CARDS, "utf-8");
    expect(content).toContain('data-testid="dash-s02-kpi-drift"');
  });

  test("T51 — DashboardTimeline contains data-testid='dash-s02-timeline'", async () => {
    const content = await readFile(TIMELINE, "utf-8");
    expect(content).toContain('data-testid="dash-s02-timeline"');
  });

  test("T52 — DashboardBreakdownPanel contains data-testid='dash-s02-breakdown'", async () => {
    const content = await readFile(BREAKDOWN, "utf-8");
    expect(content).toContain('data-testid="dash-s02-breakdown"');
  });
});
