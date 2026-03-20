/**
 * DRIFT-S03: UI Diff Visuel Drift -- Page de visualisation des alertes drift avec diff attendu/observe -- E2E Tests
 *
 * These tests verify the deliverables of DRIFT-S03:
 *   - Groupe 1: API Client drift alerts (T01-T05)
 *   - Groupe 2: Hooks useDriftAlerts (T06-T10)
 *   - Groupe 3: Query keys and React Query integration (T11-T15)
 *   - Groupe 4: Composant DriftAlertPanel (T16-T25)
 *   - Groupe 5: Composant DriftMonitorToggle (T26-T30)
 *   - Groupe 6: Integration page Drift.tsx (T31-T40)
 *   - Groupe 7: Labels et affichage types d'alertes (T41-T45)
 *   - Groupe 8: Severite, couleurs, accessibilite (T46-T55)
 *   - Groupe 9: Integration imports et wiring (T56-T60)
 *   - Groupe 10: Resolution et etats (T61-T65)
 *   - Groupe 11: Edge cases et robustesse (T66-T70)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const API_DRIFT_FILE = resolve(ROOT, "ui/src/api/drift.ts");
const HOOKS_FILE = resolve(ROOT, "ui/src/hooks/useDriftAlerts.ts");
const QUERY_KEYS_FILE = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const PANEL_FILE = resolve(ROOT, "ui/src/components/DriftAlertPanel.tsx");
const TOGGLE_FILE = resolve(ROOT, "ui/src/components/DriftMonitorToggle.tsx");
const DRIFT_PAGE_FILE = resolve(ROOT, "ui/src/pages/Drift.tsx");

// ---------------------------------------------------------------------------
// Groupe 1: API Client drift alerts (T01-T05)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: API Client drift alerts", () => {
  test("T01 -- drift.ts enrichi with driftAlertsApi export", async () => {
    const content = await readFile(API_DRIFT_FILE, "utf-8");
    expect(content).toMatch(/export\s+const\s+driftAlertsApi\s*=/);
  });

  test("T02 -- Fn listAlerts present with /alerts path on companyDriftPath", async () => {
    const content = await readFile(API_DRIFT_FILE, "utf-8");
    expect(content).toContain("listAlerts");
    // Path built via template literal: `${companyDriftPath(companyId)}/alerts`
    expect(content).toMatch(/\/alerts/);
  });

  test("T03 -- Fn resolveAlert present with /resolve path", async () => {
    const content = await readFile(API_DRIFT_FILE, "utf-8");
    expect(content).toContain("resolveAlert");
    expect(content).toMatch(/\/alerts\/.*\/resolve/);
  });

  test("T04 -- Fn getMonitoringStatus present with /monitoring/status path", async () => {
    const content = await readFile(API_DRIFT_FILE, "utf-8");
    expect(content).toContain("getMonitoringStatus");
    expect(content).toContain("/monitoring/status");
  });

  test("T05 -- Fn startMonitoring and stopMonitoring present", async () => {
    const content = await readFile(API_DRIFT_FILE, "utf-8");
    expect(content).toContain("startMonitoring");
    expect(content).toContain("stopMonitoring");
    expect(content).toContain("/monitoring/start");
    expect(content).toContain("/monitoring/stop");
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Hooks useDriftAlerts (T06-T10)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Hooks useDriftAlerts", () => {
  test("T06 -- File useDriftAlerts.ts exists", async () => {
    await expect(fsAccess(HOOKS_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T07 -- Hook useDriftAlerts exported", async () => {
    const content = await readFile(HOOKS_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+useDriftAlerts\s*\(/);
  });

  test("T08 -- Hook useDriftAlertResolve exported", async () => {
    const content = await readFile(HOOKS_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+useDriftAlertResolve\s*\(/);
  });

  test("T09 -- Hook useDriftMonitoringStatus exported", async () => {
    const content = await readFile(HOOKS_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+useDriftMonitoringStatus\s*\(/);
  });

  test("T10 -- Hook useDriftMonitoringToggle exported", async () => {
    const content = await readFile(HOOKS_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+useDriftMonitoringToggle\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Query keys and React Query integration (T11-T15)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Query keys and React Query integration", () => {
  test("T11 -- Query key drift.alerts added", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    expect(content).toMatch(/drift:\s*\{[\s\S]*alerts\s*:/);
  });

  test("T12 -- Query key drift.monitoringStatus added", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    expect(content).toMatch(/drift:\s*\{[\s\S]*monitoringStatus\s*:/);
  });

  test("T13 -- useQuery in useDriftAlerts", async () => {
    const content = await readFile(HOOKS_FILE, "utf-8");
    expect(content).toContain("useQuery");
    expect(content).toMatch(/import\s*\{[^}]*useQuery[^}]*\}\s*from\s*["']@tanstack\/react-query["']/);
  });

  test("T14 -- useMutation in useDriftAlertResolve", async () => {
    const content = await readFile(HOOKS_FILE, "utf-8");
    expect(content).toContain("useMutation");
    expect(content).toMatch(/import\s*\{[^}]*useMutation[^}]*\}\s*from\s*["']@tanstack\/react-query["']/);
  });

  test("T15 -- invalidateQueries in mutation onSuccess", async () => {
    const content = await readFile(HOOKS_FILE, "utf-8");
    expect(content).toContain("invalidateQueries");
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Composant DriftAlertPanel (T16-T25)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Composant DriftAlertPanel", () => {
  test("T16 -- File DriftAlertPanel.tsx exists", async () => {
    await expect(fsAccess(PANEL_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T17 -- Export DriftAlertPanel", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+DriftAlertPanel\s*\(/);
  });

  test("T18 -- data-testid severity badge", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain("drift-s03-alert-");
    expect(content).toContain("-severity");
  });

  test("T19 -- data-testid type badge", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain("-type");
    // Verify it's a data-testid for the alert type badge
    expect(content).toMatch(/data-testid=\{?[`"]drift-s03-alert-.*-type[`"]\}?/);
  });

  test("T20 -- data-testid diff expected", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]drift-s03-alert-.*-diff-expected[`"]\}?/);
  });

  test("T21 -- data-testid diff observed", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]drift-s03-alert-.*-diff-observed[`"]\}?/);
  });

  test("T22 -- data-testid action acknowledge", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]drift-s03-alert-.*-action-acknowledge[`"]\}?/);
  });

  test("T23 -- data-testid action ignore", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]drift-s03-alert-.*-action-ignore[`"]\}?/);
  });

  test("T24 -- data-testid action remediate", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]drift-s03-alert-.*-action-remediate[`"]\}?/);
  });

  test("T25 -- data-testid metadata", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]drift-s03-alert-.*-metadata[`"]\}?/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Composant DriftMonitorToggle (T26-T30)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Composant DriftMonitorToggle", () => {
  test("T26 -- File DriftMonitorToggle.tsx exists", async () => {
    await expect(fsAccess(TOGGLE_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T27 -- Export DriftMonitorToggle", async () => {
    const content = await readFile(TOGGLE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+DriftMonitorToggle\s*\(/);
  });

  test("T28 -- data-testid monitor toggle", async () => {
    const content = await readFile(TOGGLE_FILE, "utf-8");
    expect(content).toContain('drift-s03-monitor-toggle');
  });

  test("T29 -- data-testid monitor toggle button", async () => {
    const content = await readFile(TOGGLE_FILE, "utf-8");
    expect(content).toContain('drift-s03-monitor-toggle-btn');
  });

  test("T30 -- usePermissions used for workflows:enforce gate", async () => {
    const content = await readFile(TOGGLE_FILE, "utf-8");
    expect(content).toMatch(/import.*usePermissions/);
    expect(content).toContain("workflows:enforce");
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Integration page Drift.tsx (T31-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Integration page Drift.tsx", () => {
  test("T31 -- Onglet Documents data-testid", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-tab-documents');
  });

  test("T32 -- Onglet Execution Alerts data-testid", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-tab-execution');
  });

  test("T33 -- Badge count onglet data-testid", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-tab-execution-count');
  });

  test("T34 -- Liste alertes container data-testid", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-alerts-list');
  });

  test("T35 -- Filtres container data-testid", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-filters');
  });

  test("T36 -- Filtre severity data-testid", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-filter-severity');
  });

  test("T37 -- Filtre type data-testid", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-filter-type');
  });

  test("T38 -- Filtre status data-testid", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-filter-status');
  });

  test("T39 -- Empty state monitoring off data-testid", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-empty-monitoring-off');
  });

  test("T40 -- Empty state no alerts data-testid", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-empty-no-alerts');
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Labels et affichage types d'alertes (T41-T45)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Labels et affichage types d'alertes", () => {
  test("T41 -- Label 'Time Exceeded' for time_exceeded", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain("Time Exceeded");
    expect(content).toContain("time_exceeded");
  });

  test("T42 -- Label 'Stagnation' for stagnation", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain("Stagnation");
    expect(content).toContain("stagnation");
  });

  test("T43 -- Label 'Excessive Retries' for retry_excessive", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain("Excessive Retries");
    expect(content).toContain("retry_excessive");
  });

  test("T44 -- Label 'Stage Skipped' for stage_skipped", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain("Stage Skipped");
    expect(content).toContain("stage_skipped");
  });

  test("T45 -- Label 'Sequence Violation' for sequence_violation", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain("Sequence Violation");
    expect(content).toContain("sequence_violation");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Severite, couleurs, accessibilite (T46-T55)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Severite, couleurs, accessibilite", () => {
  test("T46 -- Couleur critical rouge (bg-red- or text-red-)", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/bg-red-/);
    expect(content).toMatch(/text-red-/);
  });

  test("T47 -- Couleur moderate orange/amber (bg-amber- or text-amber-)", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/bg-amber-/);
    expect(content).toMatch(/text-amber-/);
  });

  test("T48 -- Couleur minor vert (bg-green- or text-green-)", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/bg-green-/);
    expect(content).toMatch(/text-green-/);
  });

  test("T49 -- Icone AlertTriangle for critical", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*AlertTriangle[^}]*\}/);
    // Verify it's mapped to critical in severityConfig
    expect(content).toMatch(/critical[\s\S]*?icon:\s*AlertTriangle/);
  });

  test("T50 -- Icone AlertCircle for moderate", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*AlertCircle[^}]*\}/);
    // Verify it's mapped to moderate in severityConfig
    expect(content).toMatch(/moderate[\s\S]*?icon:\s*AlertCircle/);
  });

  test("T51 -- aria-label on action buttons", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/aria-label=\{?[`"].*[Aa]cknowledge/);
    expect(content).toMatch(/aria-label=\{?[`"].*[Ii]gnore/);
    expect(content).toMatch(/aria-label=\{?[`"].*[Rr]emediate/);
  });

  test("T52 -- Responsive grid diff (grid-cols-1 or md:grid-cols-2)", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain("grid-cols-1");
    expect(content).toContain("md:grid-cols-2");
  });

  test("T53 -- Import DriftAlert type from @mnm/shared", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/import.*DriftAlert.*from\s*["']@mnm\/shared["']/);
  });

  test("T54 -- Import DriftMonitorStatus type from @mnm/shared", async () => {
    const content = await readFile(API_DRIFT_FILE, "utf-8");
    expect(content).toMatch(/import.*DriftMonitorStatus.*from\s*["']@mnm\/shared["']/);
  });

  test("T55 -- Import DriftAlertType type from @mnm/shared", async () => {
    // Check in DriftAlertPanel or Drift.tsx
    const panelContent = await readFile(PANEL_FILE, "utf-8");
    const pageContent = await readFile(DRIFT_PAGE_FILE, "utf-8");
    const hasImport =
      /import.*DriftAlertType.*from\s*["']@mnm\/shared["']/.test(panelContent) ||
      /import.*DriftAlertType.*from\s*["']@mnm\/shared["']/.test(pageContent);
    expect(hasImport).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Integration imports et wiring (T56-T60)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Integration imports et wiring", () => {
  test("T56 -- DriftAlertPanel imported in Drift.tsx", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toMatch(/import.*DriftAlertPanel/);
  });

  test("T57 -- DriftMonitorToggle imported in Drift.tsx", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toMatch(/import.*DriftMonitorToggle/);
  });

  test("T58 -- useDriftAlerts imported in Drift.tsx", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    // May be on a separate line in a destructured multiline import
    expect(content).toContain("useDriftAlerts");
    // Verify it comes from the hooks module (import path without extension)
    expect(content).toContain('from "../hooks/useDriftAlerts"');
  });

  test("T59 -- useDriftMonitoringStatus or toggle imported in Drift.tsx", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    // May be on a separate line in a destructured multiline import
    expect(content).toContain("useDriftMonitoringStatus");
  });

  test("T60 -- driftAlertsApi imported in hooks", async () => {
    const content = await readFile(HOOKS_FILE, "utf-8");
    expect(content).toMatch(/import.*driftAlertsApi/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Resolution et etats (T61-T65)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Resolution et etats", () => {
  test("T61 -- Resolution 'acknowledged' string present", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain('"acknowledged"');
  });

  test("T62 -- Resolution 'ignored' string present", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain('"ignored"');
  });

  test("T63 -- Resolution 'remediated' string present", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toContain('"remediated"');
  });

  test("T64 -- Note de resolution textarea data-testid", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]drift-s03-alert-.*-note[`"]\}?/);
    // Verify it's a textarea element
    expect(content).toMatch(/<textarea[\s\S]*?drift-s03-alert-[\s\S]*?-note/);
  });

  test("T65 -- Resolved state shows resolution info", async () => {
    const content = await readFile(PANEL_FILE, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]drift-s03-alert-.*-resolution[`"]\}?/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Edge cases et robustesse (T66-T70)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Edge cases et robustesse", () => {
  test("T66 -- Guard companyId in hooks (enabled: !!companyId)", async () => {
    const content = await readFile(HOOKS_FILE, "utf-8");
    expect(content).toContain("enabled: !!companyId");
  });

  test("T67 -- Drift alerts rely on WebSocket for near-realtime (no polling)", async () => {
    const content = await readFile(HOOKS_FILE, "utf-8");
    // RT-S01: polling removed, drift.* WS events trigger invalidation via LiveUpdatesProvider
    expect(content).not.toMatch(/refetchInterval:\s*\d+/);
  });

  test("T68 -- Error boundary in Drift.tsx (drift-s03-error data-testid)", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-error');
  });

  test("T69 -- Loading state in Drift.tsx (drift-s03-loading data-testid)", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toContain('drift-s03-loading');
  });

  test("T70 -- useCompany used for selectedCompanyId", async () => {
    const content = await readFile(DRIFT_PAGE_FILE, "utf-8");
    expect(content).toMatch(/import.*useCompany/);
    expect(content).toContain("selectedCompanyId");
  });
});
