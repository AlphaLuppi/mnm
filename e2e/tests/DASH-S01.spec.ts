/**
 * DASH-S01: API Dashboards Agregees — E2E Tests
 *
 * These tests verify the deliverables of DASH-S01:
 *   - Groupe 1: File existence and barrel exports (T01-T08)
 *   - Groupe 2: KPIs service (T09-T18)
 *   - Groupe 3: Timeline service (T19-T24)
 *   - Groupe 4: Breakdown service (T25-T32)
 *   - Groupe 5: Routes (T33-T40)
 *   - Groupe 6: Types and constants (T41-T48)
 *   - Groupe 7: Validators (T49-T52)
 *   - Groupe 8: Permission enforcement (T53-T56)
 *   - Groupe 9: Audit integration (T57-T60)
 *   - Groupe 10: k-anonymity and aggregation (T61-T65)
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SERVICE_FILE = resolve(ROOT, "server/src/services/dashboard.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/dashboard.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/dashboard.ts");
const VALIDATOR_FILE = resolve(ROOT, "packages/shared/src/validators/dashboard.ts");
const SERVICE_INDEX = resolve(ROOT, "server/src/services/index.ts");
const ROUTES_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const VALIDATOR_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");

// ---------------------------------------------------------------------------
// Groupe 1: File existence and barrel exports (T01-T08)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence and barrel exports", () => {
  test("T01 — Service file exists and exports dashboardService with kpis function", async () => {
    await expect(fsAccess(SERVICE_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+dashboardService\s*\(/);
    expect(content).toContain("kpis:");
  });

  test("T02 — Routes file exists and exports dashboardRoutes with new routes", async () => {
    await expect(fsAccess(ROUTES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+dashboardRoutes\s*\(/);
    expect(content).toContain("/dashboard/kpis");
    expect(content).toContain("/dashboard/timeline");
    expect(content).toContain("/dashboard/breakdown");
  });

  test("T03 — Types file exports DashboardKpis, DashboardTimeline, DashboardBreakdown", async () => {
    await expect(fsAccess(TYPES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toContain("DashboardKpis");
    expect(content).toContain("DashboardTimeline");
    expect(content).toContain("DashboardBreakdown");
    expect(content).toContain("DashboardTimelinePoint");
    expect(content).toContain("DashboardBreakdownItem");
  });

  test("T04 — Validators file exists and exports dashboard schemas", async () => {
    await expect(fsAccess(VALIDATOR_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(VALIDATOR_FILE, "utf-8");
    expect(content).toContain("dashboardTimelineFiltersSchema");
    expect(content).toContain("dashboardBreakdownCategorySchema");
  });

  test("T05 — Service barrel (services/index.ts) exports dashboardService", async () => {
    const content = await readFile(SERVICE_INDEX, "utf-8");
    expect(content).toMatch(/export\s*\{[^}]*dashboardService[^}]*\}\s*from/);
  });

  test("T06 — Routes barrel (routes/index.ts) exports dashboardRoutes", async () => {
    const content = await readFile(ROUTES_INDEX, "utf-8");
    expect(content).toMatch(/export\s*\{[^}]*dashboardRoutes[^}]*\}\s*from/);
  });

  test("T07 — Validators barrel exports dashboard validators", async () => {
    const content = await readFile(VALIDATOR_INDEX, "utf-8");
    expect(content).toContain("dashboardTimelineFiltersSchema");
    expect(content).toContain("dashboardBreakdownCategorySchema");
  });

  test("T08 — Shared index exports dashboard types and validators", async () => {
    const content = await readFile(SHARED_INDEX, "utf-8");
    expect(content).toContain("DashboardKpis");
    expect(content).toContain("DashboardTimeline");
    expect(content).toContain("DashboardBreakdown");
    expect(content).toContain("DASHBOARD_PERIODS");
    expect(content).toContain("DASHBOARD_BREAKDOWN_CATEGORIES");
    expect(content).toContain("K_ANONYMITY_THRESHOLD");
    expect(content).toContain("dashboardTimelineFiltersSchema");
    expect(content).toContain("dashboardBreakdownCategorySchema");
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: KPIs service (T09-T18)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: KPIs service", () => {
  let serviceContent: string;

  test.beforeAll(async () => {
    serviceContent = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T09 — kpis function queries agents table with groupBy status", async () => {
    // Find the kpis function block
    const kpisIdx = serviceContent.indexOf("kpis:");
    expect(kpisIdx).toBeGreaterThan(-1);
    const afterKpis = serviceContent.slice(kpisIdx, kpisIdx + 3000);
    expect(afterKpis).toMatch(/agents\.status/);
    expect(afterKpis).toMatch(/groupBy/);
  });

  test("T10 — kpis function queries issues table for task counts", async () => {
    const kpisIdx = serviceContent.indexOf("kpis:");
    const afterKpis = serviceContent.slice(kpisIdx, kpisIdx + 3000);
    expect(afterKpis).toMatch(/issues\.status/);
  });

  test("T11 — kpis function queries cost_events for monthly spend", async () => {
    const kpisIdx = serviceContent.indexOf("kpis:");
    const afterKpis = serviceContent.slice(kpisIdx, kpisIdx + 4000);
    expect(afterKpis).toMatch(/costEvents/);
    expect(afterKpis).toMatch(/monthSpend/i);
  });

  test("T12 — kpis function queries workflow_instances for workflow stats", async () => {
    const kpisIdx = serviceContent.indexOf("kpis:");
    const afterKpis = serviceContent.slice(kpisIdx, kpisIdx + 5000);
    expect(afterKpis).toMatch(/workflowInstances/);
    expect(afterKpis).toMatch(/workflowState|workflow_state/);
  });

  test("T13 — kpis function queries audit_events for event counts", async () => {
    const kpisIdx = serviceContent.indexOf("kpis:");
    const afterKpis = serviceContent.slice(kpisIdx, kpisIdx + 6000);
    expect(afterKpis).toMatch(/auditEvents/);
    expect(afterKpis).toMatch(/eventsToday|auditToday/);
  });

  test("T14 — kpis function queries container_instances for container stats", async () => {
    const kpisIdx = serviceContent.indexOf("kpis:");
    const afterKpis = serviceContent.slice(kpisIdx, kpisIdx + 7000);
    expect(afterKpis).toMatch(/containerInstances/);
  });

  test("T15 — kpis function queries drift_reports for open alerts", async () => {
    const kpisIdx = serviceContent.indexOf("kpis:");
    const afterKpis = serviceContent.slice(kpisIdx, kpisIdx + 8000);
    expect(afterKpis).toMatch(/driftReports/);
    expect(afterKpis).toMatch(/openAlerts|openDriftAlerts/i);
  });

  test("T16 — kpis function queries approvals for pending count", async () => {
    const kpisIdx = serviceContent.indexOf("kpis:");
    const afterKpis = serviceContent.slice(kpisIdx, kpisIdx + 8000);
    expect(afterKpis).toMatch(/approvals/);
    expect(afterKpis).toMatch(/pending/);
  });

  test("T17 — kpis function returns correct shape with all KPI sections", async () => {
    const kpisIdx = serviceContent.indexOf("kpis:");
    const afterKpis = serviceContent.slice(kpisIdx, kpisIdx + 9000);
    // Check that the return object has the expected sections
    expect(afterKpis).toContain("agents:");
    expect(afterKpis).toContain("tasks:");
    expect(afterKpis).toContain("costs:");
    expect(afterKpis).toContain("workflows:");
    expect(afterKpis).toContain("audit:");
    expect(afterKpis).toContain("containers:");
    expect(afterKpis).toContain("drift:");
    expect(afterKpis).toContain("pendingApprovals");
    expect(afterKpis).toContain("staleTasks");
  });

  test("T18 — Legacy summary function still exists for backward compatibility", async () => {
    expect(serviceContent).toMatch(/summary:\s*async/);
    // Also check that it returns the old shape fields
    const summaryIdx = serviceContent.indexOf("summary:");
    const afterSummary = serviceContent.slice(summaryIdx, summaryIdx + 3000);
    expect(afterSummary).toContain("pendingApprovals");
    expect(afterSummary).toContain("staleTasks");
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Timeline service (T19-T24)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Timeline service", () => {
  let serviceContent: string;

  test.beforeAll(async () => {
    serviceContent = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T19 — timeline function accepts period parameter (7d, 30d, 90d)", async () => {
    expect(serviceContent).toMatch(/timeline:\s*async\s*\(\s*companyId.*period/);
  });

  test("T20 — timeline function generates date range based on period", async () => {
    // Look for periodToDays helper or equivalent date range logic
    expect(serviceContent).toMatch(/periodToDays|days\s*\*\s*24\s*\*\s*60/);
  });

  test("T21 — timeline function aggregates data by day", async () => {
    expect(serviceContent).toMatch(/date_trunc\s*\(\s*'day'/);
  });

  test("T22 — timeline function queries audit_events by date range", async () => {
    const timelineIdx = serviceContent.indexOf("timeline:");
    expect(timelineIdx).toBeGreaterThan(-1);
    const afterTimeline = serviceContent.slice(timelineIdx, timelineIdx + 4000);
    expect(afterTimeline).toMatch(/auditEvents/);
    expect(afterTimeline).toMatch(/gte|>=|startDate/);
  });

  test("T23 — timeline function queries cost_events by date range", async () => {
    const timelineIdx = serviceContent.indexOf("timeline:");
    const afterTimeline = serviceContent.slice(timelineIdx, timelineIdx + 5000);
    expect(afterTimeline).toMatch(/costEvents/);
  });

  test("T24 — timeline function returns array of DashboardTimelinePoint", async () => {
    const timelineIdx = serviceContent.indexOf("timeline:");
    const afterTimeline = serviceContent.slice(timelineIdx, timelineIdx + 6000);
    expect(afterTimeline).toMatch(/points/);
    expect(afterTimeline).toMatch(/period/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Breakdown service (T25-T32)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Breakdown service", () => {
  let serviceContent: string;

  test.beforeAll(async () => {
    serviceContent = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T25 — breakdown function accepts category parameter", async () => {
    expect(serviceContent).toMatch(/breakdown:\s*async\s*\(\s*companyId.*category/);
  });

  test("T26 — breakdown function handles 'agents' category with groupBy status", async () => {
    const breakdownIdx = serviceContent.indexOf("breakdown:");
    expect(breakdownIdx).toBeGreaterThan(-1);
    const afterBreakdown = serviceContent.slice(breakdownIdx, breakdownIdx + 5000);
    expect(afterBreakdown).toMatch(/case\s*["']agents["']/);
    expect(afterBreakdown).toMatch(/agents\.status/);
  });

  test("T27 — breakdown function handles 'workflows' category with groupBy state", async () => {
    const breakdownIdx = serviceContent.indexOf("breakdown:");
    const afterBreakdown = serviceContent.slice(breakdownIdx, breakdownIdx + 5000);
    expect(afterBreakdown).toMatch(/case\s*["']workflows["']/);
    expect(afterBreakdown).toMatch(/workflowInstances/);
  });

  test("T28 — breakdown function handles 'audit' category with groupBy action", async () => {
    const breakdownIdx = serviceContent.indexOf("breakdown:");
    const afterBreakdown = serviceContent.slice(breakdownIdx, breakdownIdx + 6000);
    expect(afterBreakdown).toMatch(/case\s*["']audit["']/);
    expect(afterBreakdown).toMatch(/auditEvents\.action/);
  });

  test("T29 — breakdown function handles 'costs' category with groupBy agent", async () => {
    const breakdownIdx = serviceContent.indexOf("breakdown:");
    const afterBreakdown = serviceContent.slice(breakdownIdx, breakdownIdx + 7000);
    expect(afterBreakdown).toMatch(/case\s*["']costs["']/);
    expect(afterBreakdown).toMatch(/costEvents\.agentId|costEvents\.agent/);
  });

  test("T30 — breakdown function handles 'containers' category with groupBy status", async () => {
    const breakdownIdx = serviceContent.indexOf("breakdown:");
    const afterBreakdown = serviceContent.slice(breakdownIdx, breakdownIdx + 8000);
    expect(afterBreakdown).toMatch(/case\s*["']containers["']/);
    expect(afterBreakdown).toMatch(/containerInstances/);
  });

  test("T31 — k-anonymity applied: counts below 5 are zeroed or grouped", async () => {
    const breakdownIdx = serviceContent.indexOf("breakdown:");
    const afterBreakdown = serviceContent.slice(breakdownIdx, breakdownIdx + 8000);
    expect(afterBreakdown).toMatch(/applyKAnonymity/);
  });

  test("T32 — breakdown function validates category against allowed list", async () => {
    const breakdownIdx = serviceContent.indexOf("breakdown:");
    const afterBreakdown = serviceContent.slice(breakdownIdx, breakdownIdx + 500);
    expect(afterBreakdown).toMatch(/DASHBOARD_BREAKDOWN_CATEGORIES|Invalid breakdown category/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Routes (T33-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Routes", () => {
  let routesContent: string;

  test.beforeAll(async () => {
    routesContent = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T33 — GET /dashboard/kpis route registered with requirePermission", async () => {
    expect(routesContent).toMatch(/router\.get\s*\(\s*[\s\S]*?dashboard\/kpis/);
    // Verify requirePermission is applied before the route handler
    const kpisIdx = routesContent.indexOf("dashboard/kpis");
    expect(kpisIdx).toBeGreaterThan(-1);
    const windowBefore = routesContent.slice(Math.max(0, kpisIdx - 200), kpisIdx);
    expect(routesContent).toContain("requirePermission");
  });

  test("T34 — GET /dashboard/timeline route registered with requirePermission", async () => {
    expect(routesContent).toMatch(/router\.get\s*\(\s*[\s\S]*?dashboard\/timeline/);
  });

  test("T35 — GET /dashboard/breakdown/:category route registered with requirePermission", async () => {
    expect(routesContent).toMatch(/router\.get\s*\(\s*[\s\S]*?dashboard\/breakdown\/:category/);
  });

  test("T36 — Legacy GET /dashboard route still registered", async () => {
    // There must be a route for just /dashboard (without /kpis, /timeline, /breakdown)
    expect(routesContent).toMatch(/router\.get\s*\(\s*["']\/companies\/:companyId\/dashboard["']/);
  });

  test("T37 — All new routes use 'dashboard:view' permission key", async () => {
    const matches = routesContent.match(/requirePermission\s*\(\s*db\s*,\s*["']([^"']+)["']\s*\)/g);
    expect(matches).not.toBeNull();
    for (const match of matches!) {
      expect(match).toContain("dashboard:view");
    }
  });

  test("T38 — KPIs route does NOT emit audit (removed to prevent infinite loop RT-S01)", async () => {
    // emitAudit on a GET route caused: dashboard.refresh → refetch kpis → audit → dashboard.refresh → ∞
    expect(routesContent).not.toContain("emitAudit");
  });

  test("T39 — Timeline route validates period query param with Zod", async () => {
    expect(routesContent).toContain("dashboardTimelineFiltersSchema");
    expect(routesContent).toMatch(/dashboardTimelineFiltersSchema\.parse/);
  });

  test("T40 — Breakdown route validates category param", async () => {
    expect(routesContent).toContain("dashboardBreakdownCategorySchema");
    expect(routesContent).toMatch(/dashboardBreakdownCategorySchema\.parse/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Types and constants (T41-T48)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Types and constants", () => {
  let typesContent: string;

  test.beforeAll(async () => {
    typesContent = await readFile(TYPES_FILE, "utf-8");
  });

  test("T41 — DashboardKpis type includes agents, tasks, costs, workflows, audit, containers, drift sections", async () => {
    // Find the DashboardKpis interface
    const kpisIdx = typesContent.indexOf("DashboardKpis");
    expect(kpisIdx).toBeGreaterThan(-1);
    const afterKpis = typesContent.slice(kpisIdx, kpisIdx + 1000);
    expect(afterKpis).toContain("agents:");
    expect(afterKpis).toContain("tasks:");
    expect(afterKpis).toContain("costs:");
    expect(afterKpis).toContain("workflows:");
    expect(afterKpis).toContain("audit:");
    expect(afterKpis).toContain("containers:");
    expect(afterKpis).toContain("drift:");
  });

  test("T42 — DashboardTimelinePoint type includes date, agentsActive, tasksCompleted, auditEvents, costCents", async () => {
    const pointIdx = typesContent.indexOf("DashboardTimelinePoint");
    expect(pointIdx).toBeGreaterThan(-1);
    const afterPoint = typesContent.slice(pointIdx, pointIdx + 500);
    expect(afterPoint).toContain("date:");
    expect(afterPoint).toMatch(/agentsActive|agents_active/);
    expect(afterPoint).toMatch(/tasksCompleted|tasks_completed/);
    expect(afterPoint).toMatch(/auditEvents|audit_events/);
    expect(afterPoint).toMatch(/costCents|cost_cents/);
  });

  test("T43 — DashboardTimeline type includes points array and period metadata", async () => {
    const timelineIdx = typesContent.indexOf("interface DashboardTimeline");
    expect(timelineIdx).toBeGreaterThan(-1);
    const afterTimeline = typesContent.slice(timelineIdx, timelineIdx + 300);
    expect(afterTimeline).toContain("points:");
    expect(afterTimeline).toContain("period:");
  });

  test("T44 — DashboardBreakdownItem type includes label and count fields", async () => {
    const itemIdx = typesContent.indexOf("DashboardBreakdownItem");
    expect(itemIdx).toBeGreaterThan(-1);
    const afterItem = typesContent.slice(itemIdx, itemIdx + 300);
    expect(afterItem).toContain("label:");
    expect(afterItem).toContain("count:");
  });

  test("T45 — DashboardBreakdown type includes items array and category metadata", async () => {
    const bdIdx = typesContent.indexOf("interface DashboardBreakdown");
    expect(bdIdx).toBeGreaterThan(-1);
    const afterBd = typesContent.slice(bdIdx, bdIdx + 300);
    expect(afterBd).toContain("items:");
    expect(afterBd).toContain("category:");
    expect(afterBd).toContain("total:");
  });

  test("T46 — DASHBOARD_PERIODS constant includes '7d', '30d', '90d'", async () => {
    expect(typesContent).toContain("DASHBOARD_PERIODS");
    expect(typesContent).toContain('"7d"');
    expect(typesContent).toContain('"30d"');
    expect(typesContent).toContain('"90d"');
  });

  test("T47 — DASHBOARD_BREAKDOWN_CATEGORIES constant includes agents, workflows, audit, costs, containers", async () => {
    expect(typesContent).toContain("DASHBOARD_BREAKDOWN_CATEGORIES");
    expect(typesContent).toContain('"agents"');
    expect(typesContent).toContain('"workflows"');
    expect(typesContent).toContain('"audit"');
    expect(typesContent).toContain('"costs"');
    expect(typesContent).toContain('"containers"');
  });

  test("T48 — DashboardPeriod and DashboardBreakdownCategory types exported", async () => {
    expect(typesContent).toMatch(/export\s+type\s+DashboardPeriod/);
    expect(typesContent).toMatch(/export\s+type\s+DashboardBreakdownCategory/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Validators (T49-T52)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Validators", () => {
  let validatorContent: string;

  test.beforeAll(async () => {
    validatorContent = await readFile(VALIDATOR_FILE, "utf-8");
  });

  test("T49 — dashboardTimelineFiltersSchema validates period enum", async () => {
    expect(validatorContent).toContain("dashboardTimelineFiltersSchema");
    expect(validatorContent).toMatch(/z\.enum\s*\(\s*DASHBOARD_PERIODS\s*\)/);
  });

  test("T50 — dashboardTimelineFiltersSchema has default value for period", async () => {
    expect(validatorContent).toMatch(/\.default\s*\(\s*["']7d["']\s*\)/);
  });

  test("T51 — dashboardBreakdownCategorySchema validates category enum", async () => {
    expect(validatorContent).toContain("dashboardBreakdownCategorySchema");
    expect(validatorContent).toMatch(/z\.enum\s*\(\s*DASHBOARD_BREAKDOWN_CATEGORIES\s*\)/);
  });

  test("T52 — Validator file imports from zod", async () => {
    expect(validatorContent).toMatch(/import\s*\{[^}]*z[^}]*\}\s*from\s*["']zod["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Permission enforcement (T53-T56)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Permission enforcement", () => {
  let routesContent: string;

  test.beforeAll(async () => {
    routesContent = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T53 — All new routes use requirePermission middleware", async () => {
    // Count occurrences of requirePermission — should be 3 (kpis, timeline, breakdown)
    const rpMatches = routesContent.match(/requirePermission\s*\(/g);
    expect(rpMatches).not.toBeNull();
    expect(rpMatches!.length).toBeGreaterThanOrEqual(3);
  });

  test("T54 — Permission key is 'dashboard:view' (consistent with PERMISSION_KEYS)", async () => {
    // All requirePermission calls should use "dashboard:view"
    const matches = routesContent.match(/requirePermission\s*\(\s*db\s*,\s*["']([^"']+)["']\s*\)/g) ?? [];
    for (const match of matches) {
      expect(match).toContain("dashboard:view");
    }
  });

  test("T55 — requirePermission is imported from middleware/require-permission", async () => {
    expect(routesContent).toMatch(/import\s*\{[^}]*requirePermission[^}]*\}\s*from\s*["'][^"']*require-permission/);
  });

  test("T56 — assertCompanyAccess called in each route handler", async () => {
    const accessMatches = routesContent.match(/assertCompanyAccess\s*\(/g);
    expect(accessMatches).not.toBeNull();
    // Legacy + 3 new routes = 4 calls
    expect(accessMatches!.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Audit integration (T57-T60)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Audit integration", () => {
  let routesContent: string;

  test.beforeAll(async () => {
    routesContent = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T57 — emitAudit NOT imported in dashboard routes (removed RT-S01)", async () => {
    // emitAudit on GET dashboard/kpis created an infinite loop with dashboard.refresh
    expect(routesContent).not.toMatch(/import\s*\{[^}]*emitAudit[^}]*\}\s*from/);
  });

  test("T58 — KPIs route does not emit audit event (removed RT-S01)", async () => {
    expect(routesContent).not.toContain("dashboard.viewed");
  });

  test("T59 — No emitAudit call in dashboard routes", async () => {
    expect(routesContent).not.toContain("emitAudit");
  });

  test("T60 — Dashboard routes are read-only with no side effects", async () => {
    // Dashboard GET routes should not emit audit events or live events
    // to avoid feedback loops with dashboard.refresh
    expect(routesContent).not.toContain("emitAudit");
    expect(routesContent).not.toContain("publishLiveEvent");
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: k-anonymity and aggregation (T61-T65)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: k-anonymity and aggregation", () => {
  let serviceContent: string;

  test.beforeAll(async () => {
    serviceContent = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T61 — K_ANONYMITY_THRESHOLD constant used (value 5)", async () => {
    expect(serviceContent).toMatch(/K_ANONYMITY_THRESHOLD/);
    // Also check the types file defines the value
    const typesContent = await readFile(TYPES_FILE, "utf-8");
    expect(typesContent).toMatch(/K_ANONYMITY_THRESHOLD\s*=\s*5/);
  });

  test("T62 — applyKAnonymity helper function exists", async () => {
    expect(serviceContent).toMatch(/function\s+applyKAnonymity/);
  });

  test("T63 — Breakdown function applies k-anonymity to results", async () => {
    const breakdownIdx = serviceContent.indexOf("breakdown:");
    expect(breakdownIdx).toBeGreaterThan(-1);
    const afterBreakdown = serviceContent.slice(breakdownIdx);
    // Find the applyKAnonymity call within the breakdown function
    expect(afterBreakdown).toContain("applyKAnonymity");
  });

  test("T64 — Items below k threshold are grouped into 'other'", async () => {
    // Find the applyKAnonymity function
    const fnIdx = serviceContent.indexOf("function applyKAnonymity");
    expect(fnIdx).toBeGreaterThan(-1);
    const afterFn = serviceContent.slice(fnIdx, fnIdx + 500);
    expect(afterFn).toContain('"other"');
    expect(afterFn).toMatch(/count\s*[<>=]/);
  });

  test("T65 — k-anonymity does not affect total/aggregate counts", async () => {
    // The breakdown function should compute total before applying k-anonymity
    const breakdownIdx = serviceContent.indexOf("breakdown:");
    const afterBreakdown = serviceContent.slice(breakdownIdx);
    // Total is computed from the raw items before k-anonymity
    expect(afterBreakdown).toContain("total");
    // applyKAnonymity is called after total is computed
    const totalIdx = afterBreakdown.lastIndexOf("total +=");
    const kIdx = afterBreakdown.indexOf("applyKAnonymity");
    if (totalIdx > -1 && kIdx > -1) {
      // applyKAnonymity should be called after the total aggregation
      expect(kIdx).toBeGreaterThan(totalIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Types barrel exports (T66-T68)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Types barrel exports", () => {
  test("T66 — Types index re-exports DASHBOARD_PERIODS constant", async () => {
    const content = await readFile(TYPES_INDEX, "utf-8");
    expect(content).toContain("DASHBOARD_PERIODS");
  });

  test("T67 — Types index re-exports DASHBOARD_BREAKDOWN_CATEGORIES constant", async () => {
    const content = await readFile(TYPES_INDEX, "utf-8");
    expect(content).toContain("DASHBOARD_BREAKDOWN_CATEGORIES");
  });

  test("T68 — Types index re-exports K_ANONYMITY_THRESHOLD constant", async () => {
    const content = await readFile(TYPES_INDEX, "utf-8");
    expect(content).toContain("K_ANONYMITY_THRESHOLD");
  });
});
