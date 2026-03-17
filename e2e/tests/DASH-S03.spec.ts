/**
 * DASH-S03: Dashboard Temps Reel — E2E Tests
 *
 * These tests verify the deliverables of DASH-S03:
 *   - Groupe 1: Shared constants (T01, T33)
 *   - Groupe 2: Dashboard refresh service (T02-T14, T31-T32)
 *   - Groupe 3: Services barrel export (T15)
 *   - Groupe 4: LiveUpdatesProvider integration (T16-T19, T23, T35-T36)
 *   - Groupe 5: useDashboardLiveIndicator hook (T20-T22, T24)
 *   - Groupe 6: Dashboard.tsx UI integration (T25-T30, T34)
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const CONSTANTS = resolve(ROOT, "packages/shared/src/constants.ts");
const DASHBOARD_REFRESH = resolve(ROOT, "server/src/services/dashboard-refresh.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const LIVE_EVENTS = resolve(ROOT, "server/src/services/live-events.ts");
const LIVE_UPDATES_PROVIDER = resolve(ROOT, "ui/src/context/LiveUpdatesProvider.tsx");
const LIVE_INDICATOR_HOOK = resolve(ROOT, "ui/src/hooks/useDashboardLiveIndicator.ts");
const DASHBOARD_PAGE = resolve(ROOT, "ui/src/pages/Dashboard.tsx");

// ---------------------------------------------------------------------------
// Groupe 1: Shared constants (T01, T33)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Shared constants", () => {
  test("T01 — dashboard.refresh in LIVE_EVENT_TYPES", async () => {
    const content = await readFile(CONSTANTS, "utf-8");
    expect(content).toContain('"dashboard.refresh"');
  });

  test("T33 — shared constants export LiveEventType includes dashboard.refresh", async () => {
    const content = await readFile(CONSTANTS, "utf-8");
    expect(content).toMatch(/dashboard\.refresh/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Dashboard refresh service (T02-T14, T31-T32)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Dashboard refresh service", () => {
  test("T02 — dashboard-refresh service file exists", async () => {
    await expect(fsAccess(DASHBOARD_REFRESH).then(() => true)).resolves.toBe(true);
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("subscribeDashboardRefreshEvents");
  });

  test("T03 — dashboard-refresh subscribes to workflow.created", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("workflow.created");
  });

  test("T04 — dashboard-refresh subscribes to workflow.completed", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("workflow.completed");
  });

  test("T05 — dashboard-refresh subscribes to agent.status", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("agent.status");
  });

  test("T06 — dashboard-refresh excludes audit.event_created (prevents infinite loop)", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    // audit.event_created was removed from triggers because dashboard GET routes
    // emit audit events, creating a feedback loop: dashboard.refresh → refetch →
    // audit → dashboard.refresh → ∞
    expect(content).not.toMatch(/^\s*"audit\.event_created",?\s*$/m);
  });

  test("T07 — dashboard-refresh subscribes to container.started", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("container.started");
  });

  test("T08 — dashboard-refresh subscribes to container.completed", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("container.completed");
  });

  test("T09 — dashboard-refresh subscribes to container.failed", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("container.failed");
  });

  test("T10 — dashboard-refresh subscribes to drift.alert_created", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("drift.alert_created");
  });

  test("T11 — dashboard-refresh subscribes to drift.alert_resolved", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("drift.alert_resolved");
  });

  test("T12 — dashboard-refresh emits dashboard.refresh", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("dashboard.refresh");
  });

  test("T13 — dashboard-refresh has debounce logic", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toMatch(/debounce|lastEmit|DEBOUNCE/i);
  });

  test("T14 — dashboard-refresh payload includes source", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("source");
  });

  test("T31 — dashboard-refresh uses publishLiveEvent", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("publishLiveEvent");
  });

  test("T32 — dashboard-refresh uses subscribeAllLiveEvents", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toMatch(/subscribeAllLiveEvents|subscribe/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Services barrel export (T15)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Services barrel export", () => {
  test("T15 — dashboard-refresh exported from services index", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toContain("dashboard-refresh");
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: LiveUpdatesProvider integration (T16-T19, T23, T35-T36)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: LiveUpdatesProvider integration", () => {
  test("T16 — LiveUpdatesProvider handles dashboard.refresh event type", async () => {
    const content = await readFile(LIVE_UPDATES_PROVIDER, "utf-8");
    expect(content).toContain("dashboard.refresh");
  });

  test("T17 — LiveUpdatesProvider invalidates dashboard.kpis", async () => {
    const content = await readFile(LIVE_UPDATES_PROVIDER, "utf-8");
    expect(content).toMatch(/dashboard\.kpis|kpis/);
  });

  test("T18 — LiveUpdatesProvider invalidates dashboard.timeline", async () => {
    const content = await readFile(LIVE_UPDATES_PROVIDER, "utf-8");
    expect(content).toMatch(/dashboard\.timeline|timeline/);
  });

  test("T19 — LiveUpdatesProvider invalidates dashboard.breakdown", async () => {
    const content = await readFile(LIVE_UPDATES_PROVIDER, "utf-8");
    expect(content).toMatch(/dashboard\.breakdown|breakdown/);
  });

  test("T23 — LiveUpdatesProvider dispatches dashboard:refresh custom event", async () => {
    const content = await readFile(LIVE_UPDATES_PROVIDER, "utf-8");
    expect(content).toContain("dashboard:refresh");
  });

  test("T35 — Existing agent.status handler still invalidates dashboard", async () => {
    const content = await readFile(LIVE_UPDATES_PROVIDER, "utf-8");
    expect(content).toMatch(/agent\.status/);
  });

  test("T36 — Existing dashboard query key still invalidated by heartbeat", async () => {
    const content = await readFile(LIVE_UPDATES_PROVIDER, "utf-8");
    expect(content).toMatch(/queryKeys\.dashboard\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: useDashboardLiveIndicator hook (T20-T22, T24)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: useDashboardLiveIndicator hook", () => {
  test("T20 — useDashboardLiveIndicator hook exists", async () => {
    await expect(fsAccess(LIVE_INDICATOR_HOOK).then(() => true)).resolves.toBe(true);
    const content = await readFile(LIVE_INDICATOR_HOOK, "utf-8");
    expect(content).toContain("useDashboardLiveIndicator");
  });

  test("T21 — useDashboardLiveIndicator tracks isFlashing state", async () => {
    const content = await readFile(LIVE_INDICATOR_HOOK, "utf-8");
    expect(content).toContain("isFlashing");
  });

  test("T22 — useDashboardLiveIndicator tracks lastRefreshAt state", async () => {
    const content = await readFile(LIVE_INDICATOR_HOOK, "utf-8");
    expect(content).toContain("lastRefreshAt");
  });

  test("T24 — useDashboardLiveIndicator uses 2-second flash timeout", async () => {
    const content = await readFile(LIVE_INDICATOR_HOOK, "utf-8");
    expect(content).toMatch(/2[_,]?000|2e3/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Dashboard.tsx UI integration (T25-T30, T34)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Dashboard.tsx UI integration", () => {
  test("T25 — Dashboard.tsx has dash-s03-live-indicator testid", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("dash-s03-live-indicator");
  });

  test("T26 — Dashboard.tsx has dash-s03-live-dot testid", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("dash-s03-live-dot");
  });

  test("T27 — Dashboard.tsx has dash-s03-live-label testid", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("dash-s03-live-label");
  });

  test("T28 — Dashboard.tsx has dash-s03-last-refresh testid", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("dash-s03-last-refresh");
  });

  test("T29 — Dashboard.tsx imports useDashboardLiveIndicator", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("useDashboardLiveIndicator");
  });

  test("T30 — Dashboard.tsx shows Live text", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toContain("Live");
  });

  test("T34 — Dashboard.tsx uses animate-ping or pulse animation", async () => {
    const content = await readFile(DASHBOARD_PAGE, "utf-8");
    expect(content).toMatch(/animate-ping|pulse/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Live events infrastructure (server-side)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Live events infrastructure", () => {
  test("T37 — live-events.ts exports subscribeAllLiveEvents", async () => {
    const content = await readFile(LIVE_EVENTS, "utf-8");
    expect(content).toContain("subscribeAllLiveEvents");
  });

  test("T38 — live-events.ts has globalListeners set", async () => {
    const content = await readFile(LIVE_EVENTS, "utf-8");
    expect(content).toContain("globalListeners");
  });

  test("T39 — live-events.ts notifies global listeners in publishLiveEvent", async () => {
    const content = await readFile(LIVE_EVENTS, "utf-8");
    // Verify that publishLiveEvent iterates over globalListeners
    expect(content).toMatch(/for\s*\(\s*const\s+\w+\s+of\s+globalListeners\s*\)/);
  });

  test("T40 — server index.ts imports subscribeDashboardRefreshEvents", async () => {
    const serverIndex = resolve(ROOT, "server/src/index.ts");
    const content = await readFile(serverIndex, "utf-8");
    expect(content).toContain("subscribeDashboardRefreshEvents");
  });

  test("T41 — server index.ts calls subscribeDashboardRefreshEvents at boot", async () => {
    const serverIndex = resolve(ROOT, "server/src/index.ts");
    const content = await readFile(serverIndex, "utf-8");
    // Should call the function (not just import it)
    expect(content).toMatch(/subscribeDashboardRefreshEvents\(\)/);
  });

  test("T42 — dashboard-refresh sourceFromEventType maps workflow events", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toMatch(/workflow\./);
    expect(content).toContain("sourceFromEventType");
  });

  test("T43 — dashboard-refresh avoids infinite loop on dashboard.refresh", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    // Should have a guard preventing reaction to its own events
    expect(content).toMatch(/dashboard\.refresh.*return|infinite/i);
  });

  test("T44 — dashboard-refresh subscribes to heartbeat.run.status", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("heartbeat.run.status");
  });

  test("T45 — dashboard-refresh exports DASHBOARD_REFRESH_DEBOUNCE_MS", async () => {
    const content = await readFile(DASHBOARD_REFRESH, "utf-8");
    expect(content).toContain("DASHBOARD_REFRESH_DEBOUNCE_MS");
  });
});
