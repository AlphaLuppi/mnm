/**
 * DRIFT-S02: Drift Monitor Service -- Comparison Attendu vs Observe + Alertes WebSocket -- E2E Tests
 *
 * These tests verify the deliverables of DRIFT-S02:
 *   - Groupe 1: Service drift-monitor.ts existence and structure (T01-T05)
 *   - Groupe 2: Additional functions (T06-T10)
 *   - Groupe 3: Configuration and thresholds (T11-T15)
 *   - Groupe 4: Shared types (T16-T20)
 *   - Groupe 5: LiveEventTypes (T21-T24)
 *   - Groupe 6: Integration events and persistence (T25-T30)
 *   - Groupe 7: Deviation detection (T31-T35)
 *   - Groupe 8: API Routes (T36-T40)
 *   - Groupe 9: Barrel exports and audit (T41-T45)
 *   - Groupe 10: Edge cases and robustness (T46-T50)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SERVICE_FILE = resolve(ROOT, "server/src/services/drift-monitor.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/drift.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/drift.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const CONSTANTS_FILE = resolve(ROOT, "packages/shared/src/constants.ts");
const SERVICE_INDEX = resolve(ROOT, "server/src/services/index.ts");

// ---------------------------------------------------------------------------
// Groupe 1: Service drift-monitor.ts existence and structure (T01-T05)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Service drift-monitor.ts existence and structure", () => {
  test("T01 -- File drift-monitor.ts exists and exports driftMonitorService", async () => {
    await expect(fsAccess(SERVICE_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+driftMonitorService\s*\(/);
  });

  test("T02 -- Function startMonitoring present", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+startMonitoring\s*\(/);
  });

  test("T03 -- Function stopMonitoring present", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+stopMonitoring\s*\(/);
  });

  test("T04 -- Function onStageEvent present", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+onStageEvent\s*\(/);
  });

  test("T05 -- Function checkStageDrift present", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+checkStageDrift\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Additional functions (T06-T10)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Additional functions", () => {
  test("T06 -- Function checkWorkflowTimeDrift present", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+checkWorkflowTimeDrift\s*\(/);
  });

  test("T07 -- Function createDriftAlert present", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+createDriftAlert\s*\(/);
  });

  test("T08 -- Function getDriftAlerts present", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+getDriftAlerts\s*\(/);
  });

  test("T09 -- Function resolveAlert present", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+resolveAlert\s*\(/);
  });

  test("T10 -- Function getMonitoringStatus present", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/function\s+getMonitoringStatus\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Configuration and thresholds (T11-T15)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Configuration and thresholds", () => {
  test("T11 -- Time exceeded threshold = 15 min (900_000 ms)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Accept various forms: 15 * 60 * 1000, 900_000, 900000
    expect(content).toMatch(/15\s*\*\s*60\s*\*\s*1000|900[_]?000/);
  });

  test("T12 -- Stagnation threshold = 30 min (1_800_000 ms)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Accept various forms: 30 * 60 * 1000, 1_800_000, 1800000
    expect(content).toMatch(/30\s*\*\s*60\s*\*\s*1000|1[_]?800[_]?000/);
  });

  test("T13 -- Retry alert threshold default = 2", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/retryAlertThreshold\s*:\s*2/);
  });

  test("T14 -- Check interval = 60s (60_000 ms)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Accept various forms: 60 * 1000, 60_000, 60000
    expect(content).toMatch(/checkIntervalMs\s*:\s*(60\s*\*\s*1000|60[_]?000)/);
  });

  test("T15 -- DriftMonitorConfig interface has 5 fields", async () => {
    const typesContent = await readFile(TYPES_FILE, "utf-8");
    expect(typesContent).toMatch(/interface\s+DriftMonitorConfig/);
    // Verify all 5 fields present
    expect(typesContent).toMatch(/defaultStageTimeoutMs\s*:\s*number/);
    expect(typesContent).toMatch(/stagnationTimeoutMs\s*:\s*number/);
    expect(typesContent).toMatch(/retryAlertThreshold\s*:\s*number/);
    expect(typesContent).toMatch(/checkIntervalMs\s*:\s*number/);
    expect(typesContent).toMatch(/enabled\s*:\s*boolean/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Shared types (T16-T20)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Shared types", () => {
  test("T16 -- DriftAlertType exported with 5 values", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+type\s+DriftAlertType\s*=/);
    expect(content).toContain('"time_exceeded"');
    expect(content).toContain('"stagnation"');
    expect(content).toContain('"retry_excessive"');
    expect(content).toContain('"stage_skipped"');
    expect(content).toContain('"sequence_violation"');
  });

  test("T17 -- DriftAlert interface with required fields", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+DriftAlert/);
    // Check key fields
    const alertBlock = content.slice(content.indexOf("interface DriftAlert"));
    expect(alertBlock).toContain("id: string");
    expect(alertBlock).toContain("companyId: string");
    expect(alertBlock).toContain("stageId: string");
    expect(alertBlock).toContain("alertType: DriftAlertType");
    expect(alertBlock).toContain("severity: DriftSeverity");
    expect(alertBlock).toMatch(/message\s*:\s*string/);
  });

  test("T18 -- DriftMonitorConfig exported from shared types", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+DriftMonitorConfig/);
  });

  test("T19 -- DriftMonitorStatus exported from shared types", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+DriftMonitorStatus/);
    // Verify key fields
    expect(content).toMatch(/active\s*:\s*boolean/);
    expect(content).toMatch(/activeAlertCount\s*:\s*number/);
    expect(content).toMatch(/startedAt\s*:\s*string\s*\|\s*null/);
    expect(content).toMatch(/lastCheckAt\s*:\s*string\s*\|\s*null/);
    expect(content).toMatch(/config\s*:\s*DriftMonitorConfig/);
  });

  test("T20 -- All 4 types re-exported in types/index.ts", async () => {
    const content = await readFile(TYPES_INDEX, "utf-8");
    expect(content).toContain("DriftAlertType");
    expect(content).toContain("DriftAlert");
    expect(content).toContain("DriftMonitorConfig");
    expect(content).toContain("DriftMonitorStatus");
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: LiveEventTypes (T21-T24)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: LiveEventTypes", () => {
  test("T21 -- drift.alert_created in LIVE_EVENT_TYPES", async () => {
    const content = await readFile(CONSTANTS_FILE, "utf-8");
    expect(content).toContain('"drift.alert_created"');
  });

  test("T22 -- drift.alert_resolved in LIVE_EVENT_TYPES", async () => {
    const content = await readFile(CONSTANTS_FILE, "utf-8");
    expect(content).toContain('"drift.alert_resolved"');
  });

  test("T23 -- drift.monitoring_started in LIVE_EVENT_TYPES", async () => {
    const content = await readFile(CONSTANTS_FILE, "utf-8");
    expect(content).toContain('"drift.monitoring_started"');
  });

  test("T24 -- drift.monitoring_stopped in LIVE_EVENT_TYPES", async () => {
    const content = await readFile(CONSTANTS_FILE, "utf-8");
    expect(content).toContain('"drift.monitoring_stopped"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Integration events and persistence (T25-T30)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Integration events and persistence", () => {
  test("T25 -- subscribeCompanyLiveEvents imported and used", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*subscribeCompanyLiveEvents[^}]*\}\s*from/);
    // Also actually called
    expect(content).toMatch(/subscribeCompanyLiveEvents\s*\(/);
  });

  test("T26 -- publishLiveEvent imported and used", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*publishLiveEvent[^}]*\}\s*from/);
    // Called for multiple event types
    const publishCalls = content.match(/publishLiveEvent\s*\(\s*\{/g);
    expect(publishCalls).not.toBeNull();
    expect(publishCalls!.length).toBeGreaterThanOrEqual(4);
  });

  test("T27 -- driftPersistenceService imported and used", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*driftPersistenceService[^}]*\}\s*from/);
    expect(content).toMatch(/driftPersistenceService\s*\(\s*db\s*\)/);
  });

  test("T28 -- setInterval used for periodic check", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/setInterval\s*\(/);
  });

  test("T29 -- clearInterval used for cleanup", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/clearInterval\s*\(/);
  });

  test("T30 -- Dedup Map/Set for tracking active alerts by stage", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Should have a Map<string, Set<string>> pattern for deduplication
    expect(content).toMatch(/new\s+Map\s*<\s*string\s*,\s*Set\s*<\s*string\s*>\s*>/);
    // Should have dedup logic checking for existing alerts
    expect(content).toMatch(/activeAlertTracker|dedupKey|markAlerted/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Deviation detection (T31-T35)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Deviation detection", () => {
  test("T31 -- Detection time_exceeded type used", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain('"time_exceeded"');
    // Used in createDriftAlert call
    expect(content).toMatch(/alertType\s*:\s*"time_exceeded"/);
  });

  test("T32 -- Detection stagnation type used", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain('"stagnation"');
    expect(content).toMatch(/alertType\s*:\s*"stagnation"/);
  });

  test("T33 -- Detection retry_excessive type used", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain('"retry_excessive"');
    expect(content).toMatch(/alertType\s*:\s*"retry_excessive"/);
  });

  test("T34 -- Detection stage_skipped type used", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain('"stage_skipped"');
    expect(content).toMatch(/alertType\s*:\s*"stage_skipped"/);
  });

  test("T35 -- Detection sequence_violation type used", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain('"sequence_violation"');
    expect(content).toMatch(/alertType\s*:\s*"sequence_violation"/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: API Routes (T36-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: API Routes", () => {
  test("T36 -- Route GET for drift alerts listing", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Route GET with path containing /drift/alerts
    expect(content).toMatch(/router\.get\s*\(\s*"[^"]*\/drift\/alerts"/);
  });

  test("T37 -- Route POST for resolving drift alert", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Route POST with path containing /drift/alerts/ and /resolve
    expect(content).toMatch(/router\.post\s*\(\s*"[^"]*\/drift\/alerts\/[^"]*\/resolve"/);
  });

  test("T38 -- Route GET for monitoring status", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Route GET with path containing /drift/monitor or /drift/monitoring and /status
    expect(content).toMatch(/router\.get\s*\(\s*"[^"]*\/drift\/monitor(?:ing)?\/status"/);
  });

  test("T39 -- Route POST for starting monitoring", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Route POST with path containing /drift/monitor or /drift/monitoring and /start
    expect(content).toMatch(/router\.post\s*\(\s*\n?\s*"[^"]*\/drift\/monitor(?:ing)?\/start"/);
  });

  test("T40 -- Route POST for stopping monitoring", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Route POST with path containing /drift/monitor or /drift/monitoring and /stop
    expect(content).toMatch(/router\.post\s*\(\s*\n?\s*"[^"]*\/drift\/monitor(?:ing)?\/stop"/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Barrel exports and audit (T41-T45)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Barrel exports and audit", () => {
  test("T41 -- driftMonitorService exported in services/index.ts", async () => {
    const content = await readFile(SERVICE_INDEX, "utf-8");
    expect(content).toContain("driftMonitorService");
    expect(content).toMatch(/export\s*\{[^}]*driftMonitorService[^}]*\}\s*from/);
  });

  test("T42 -- Audit emit for alert created (drift.alert_created)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // The service should emit audit with action "drift.alert_created"
    expect(content).toContain('"drift.alert_created"');
    // Should call audit.emit or emitAudit with this action
    expect(content).toMatch(/audit\.emit\s*\(\s*\{[\s\S]*?action\s*:\s*"drift\.alert_created"/);
  });

  test("T43 -- Audit emit for alert resolved (drift.alert_resolved)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // The service should emit audit with action "drift.alert_resolved"
    expect(content).toContain('"drift.alert_resolved"');
    // Should call audit.emit with this action
    expect(content).toMatch(/audit\.emit\s*\(\s*\{[\s\S]*?action\s*:\s*"drift\.alert_resolved"/);
  });

  test("T44 -- Actor type 'system' with actorId 'drift-monitor' for automatic alerts", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // For alert creation, actor should be system/drift-monitor
    expect(content).toContain('"drift-monitor"');
    expect(content).toContain('"system"');
    // Verify the audit call has actorType: "system"
    expect(content).toMatch(/actorType\s*:\s*"system"/);
    expect(content).toMatch(/actorId\s*:\s*"drift-monitor"/);
  });

  test("T45 -- Non-blocking async pattern (.catch() for monitoring calls)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Non-blocking event processing with .catch()
    const catchCalls = content.match(/\.catch\s*\(\s*\(?err\)?/g);
    expect(catchCalls).not.toBeNull();
    expect(catchCalls!.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Edge cases and robustness (T46-T50)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Edge cases and robustness", () => {
  test("T46 -- Filtering events by type stage.* (startsWith check)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Should filter for stage.* events
    expect(content).toMatch(/event\.type\.startsWith\s*\(\s*"stage\."\s*\)/);
  });

  test("T47 -- Logger for monitoring errors (logger.error or logger.warn)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/logger\.error\s*\(/);
    expect(content).toMatch(/logger\.warn\s*\(/);
  });

  test("T48 -- Guard for invalid payload (check stageId and workflowInstanceId)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Should check payload validity before processing
    expect(content).toMatch(/payload\?\.\s*stageId/);
    expect(content).toMatch(/payload\?\.\s*workflowInstanceId/);
  });

  test("T49 -- Monitor cleanup on stop (unsubscribe + clearInterval + delete)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // stopMonitoring should call unsubscribe, clearInterval, and delete from monitors map
    const stopBlock = content.slice(
      content.indexOf("async function stopMonitoring"),
      content.indexOf("async function stopMonitoring") + 500,
    );
    expect(stopBlock).toMatch(/monitor\.unsubscribe\s*\(\s*\)/);
    expect(stopBlock).toMatch(/clearInterval\s*\(\s*monitor\.intervalId\s*\)/);
    expect(stopBlock).toMatch(/monitors\.delete\s*\(\s*companyId\s*\)/);
  });

  test("T50 -- Sequence check loads stages with stageOrder", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Should query stageInstances by workflowInstanceId and order by stageOrder
    expect(content).toMatch(/stageInstances/);
    expect(content).toMatch(/stageOrder/);
    expect(content).toMatch(/asc\s*\(\s*stageInstances\.stageOrder\s*\)/);
  });
});
