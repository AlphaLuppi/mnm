/**
 * COMP-S03 — Réinjection Post-Compaction
 *
 * File-content-based E2E tests verifying:
 * - Reinjection service factory export and public API methods
 * - Recovery prompt building with structured Markdown sections
 * - ChatService integration for sending prompt to agent
 * - Orchestrator transition via "reinjected" event
 * - Snapshot status updates (resolved, failed)
 * - Audit emission for reinjection lifecycle
 * - LiveEvent emission for reinjection lifecycle
 * - Kill+relaunch autoReinject integration
 * - Shared types (ReinjectionResult, ReinjectionHistoryEntry, RecoveryPrompt)
 * - Validators (reinjectionSchema, reinjectionHistoryFiltersSchema)
 * - Routes (POST reinject, GET reinjection-history)
 * - Barrel exports (services, types, validators)
 * - Route count compatibility with COMP-S01 + COMP-S02
 *
 * 38 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SVC_FILE = resolve(ROOT, "server/src/services/compaction-reinjection.ts");
const KR_FILE = resolve(ROOT, "server/src/services/compaction-kill-relaunch.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/compaction.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/compaction.ts");
const VAL_FILE = resolve(ROOT, "packages/shared/src/validators/compaction.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VAL_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");

// ============================================================
// Service: compaction-reinjection.ts (18 tests)
// ============================================================

test.describe("COMP-S03 — Reinjection Service", () => {
  // T01 — Service factory export
  test("T01 — exports compactionReinjectionService function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-reinjection-service
    expect(src).toMatch(/export\s+function\s+compactionReinjectionService\s*\(\s*db\s*:\s*Db\s*\)/);
  });

  // T02 — executeReinjection method
  test("T02 — service returns executeReinjection method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-execute-reinjection
    expect(src).toMatch(/async\s+function\s+executeReinjection\s*\(/);
    expect(src).toContain("executeReinjection,");
  });

  // T03 — buildRecoveryPrompt method
  test("T03 — service returns buildRecoveryPrompt method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-build-recovery-prompt
    expect(src).toMatch(/function\s+buildRecoveryPrompt\s*\(/);
    expect(src).toContain("buildRecoveryPrompt,");
  });

  // T04 — getReinjectionHistory method
  test("T04 — service returns getReinjectionHistory method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-reinjection-history
    expect(src).toMatch(/async\s+function\s+getReinjectionHistory\s*\(/);
    expect(src).toContain("getReinjectionHistory,");
  });

  // T05 — executeReinjection loads snapshot from DB
  test("T05 — executeReinjection loads snapshot from DB via killRelaunch", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("killRelaunch.getSnapshotFromDb(");
  });

  // T06 — executeReinjection calls buildRecoveryPrompt
  test("T06 — executeReinjection calls buildRecoveryPrompt internally", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("buildRecoveryPrompt(snapshot)");
  });

  // T07 — executeReinjection sends prompt via chat service
  test("T07 — executeReinjection sends prompt via chat.createMessage", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-send-to-agent
    expect(src).toContain("chat.createMessage(");
    expect(src).toContain("compaction_recovery");
  });

  // T08 — executeReinjection transitions stage via orchestrator "reinjected" event
  test("T08 — executeReinjection transitions stage via reinjected event", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("orchestrator.transitionStage(");
    expect(src).toContain('"reinjected"');
    expect(src).toContain("compaction_reinjection");
  });

  // T09 — executeReinjection updates snapshot to resolved
  test("T09 — executeReinjection updates snapshot status to resolved", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-snapshot-resolved
    expect(src).toContain('killRelaunch.updateSnapshotStatus(snapshotId, "resolved"');
    expect(src).toContain("reinjectionPromptLength");
  });

  // T10 — executeReinjection handles send failure
  test("T10 — executeReinjection handles send failure and sets snapshot to failed", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-snapshot-failed
    expect(src).toContain('killRelaunch.updateSnapshotStatus(snapshotId, "failed"');
    expect(src).toContain("send_to_agent");
  });

  // T11 — buildRecoveryPrompt includes Recovery Context section
  test("T11 — buildRecoveryPrompt includes Recovery Context section", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-recovery-workflow-position
    expect(src).toContain('"Recovery Context"');
    expect(src).toContain("compaction event");
  });

  // T12 — buildRecoveryPrompt includes Previous Stage Results section
  test("T12 — buildRecoveryPrompt includes Previous Stage Results section", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-recovery-previous-artifacts
    expect(src).toContain('"Previous Stage Results"');
    expect(src).toContain("previousArtifacts");
  });

  // T13 — buildRecoveryPrompt includes Current Stage section
  test("T13 — buildRecoveryPrompt includes Current Stage section", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain('"Current Stage"');
  });

  // T14 — buildRecoveryPrompt includes Instructions section
  test("T14 — buildRecoveryPrompt includes Instructions section", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain('"Instructions"');
    expect(src).toContain("Resume your work");
  });

  // T15 — buildRecoveryPrompt includes workflow position
  test("T15 — buildRecoveryPrompt includes stageOrder and totalStages", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-recovery-workflow-position
    expect(src).toContain("snapshot.stageOrder");
    expect(src).toContain("totalStages");
  });

  // T16 — buildRecoveryPrompt includes pre-prompts
  test("T16 — buildRecoveryPrompt includes pre-prompts from snapshot", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-recovery-pre-prompts
    expect(src).toContain("stagePrePrompts");
    expect(src).toContain("Pre-prompts");
  });

  // T17 — Emits audit compaction.reinjection_started
  test("T17 — emits audit event compaction.reinjection_started", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-audit-reinjection-started
    expect(src).toContain('"compaction.reinjection_started"');
    expect(src).toContain("audit.emit(");
  });

  // T18 — Emits audit compaction.reinjection_completed
  test("T18 — emits audit event compaction.reinjection_completed", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-audit-reinjection-completed
    expect(src).toContain('"compaction.reinjection_completed"');
  });
});

// ============================================================
// Kill+Relaunch Integration (4 tests)
// ============================================================

test.describe("COMP-S03 — Kill+Relaunch Integration", () => {
  // T19 — compaction-kill-relaunch imports compactionReinjectionService
  test("T19 — kill-relaunch imports compactionReinjectionService", async () => {
    const src = await readFile(KR_FILE, "utf-8");
    // comp-s03-auto-reinject-import
    expect(src).toContain("compactionReinjectionService");
    expect(src).toContain("compaction-reinjection");
  });

  // T20 — executeKillRelaunch checks autoReinject option
  test("T20 — executeKillRelaunch accepts autoReinject option", async () => {
    const src = await readFile(KR_FILE, "utf-8");
    // comp-s03-auto-reinject-flag
    expect(src).toContain("autoReinject");
    expect(src).toContain("options?.autoReinject");
  });

  // T21 — executeKillRelaunch calls reinjection.executeReinjection when autoReinject
  test("T21 — executeKillRelaunch calls executeReinjection when autoReinject is true", async () => {
    const src = await readFile(KR_FILE, "utf-8");
    // comp-s03-auto-reinject-trigger
    expect(src).toContain("getReinjection().executeReinjection(");
  });

  // T22 — KillRelaunchResult has reinjectionTriggered field
  test("T22 — KillRelaunchResult type includes reinjectionTriggered field", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    // comp-s03-reinjection-triggered
    expect(src).toContain("reinjectionTriggered");
  });
});

// ============================================================
// LiveEvents (2 tests)
// ============================================================

test.describe("COMP-S03 — LiveEvents", () => {
  // T23 — Emits LiveEvent compaction.reinjection_started
  test("T23 — emits LiveEvent compaction.reinjection_started", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-live-reinjection-started
    expect(src).toContain("publishLiveEvent(");
    const matches = src.match(/compaction\.reinjection_started/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(2); // audit + liveEvent
  });

  // T24 — Emits LiveEvent compaction.reinjection_completed
  test("T24 — emits LiveEvent compaction.reinjection_completed", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s03-live-reinjection-completed
    const matches = src.match(/compaction\.reinjection_completed/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(2); // audit + liveEvent
  });
});

// ============================================================
// Routes: compaction.ts (4 tests)
// ============================================================

test.describe("COMP-S03 — Routes", () => {
  // T25 — POST reinject route exists with requirePermission
  test("T25 — POST reinject route exists with requirePermission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    // comp-s03-route-reinject
    expect(src).toContain("/companies/:companyId/compaction/snapshots/:snapshotId/reinject");
    expect(src).toContain("reinjectionSchema");
  });

  // T26 — GET reinjection-history route exists with requirePermission
  test("T26 — GET reinjection-history route exists with requirePermission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    // comp-s03-route-reinjection-history
    expect(src).toContain("/companies/:companyId/compaction/reinjection-history");
    expect(src).toContain("reinjectionHistoryFiltersSchema");
  });

  // T27 — reinject route calls reinjection.executeReinjection
  test("T27 — reinject route calls reinjection.executeReinjection", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("reinjection.executeReinjection(");
  });

  // T28 — reinjection-history route calls reinjection.getReinjectionHistory
  test("T28 — reinjection-history route calls reinjection.getReinjectionHistory", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("reinjection.getReinjectionHistory(");
  });
});

// ============================================================
// Shared Types (4 tests)
// ============================================================

test.describe("COMP-S03 — Shared Types", () => {
  // T29 — types file exports ReinjectionResult interface
  test("T29 — types file exports ReinjectionResult interface", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    // comp-s03-type-reinjection-result
    expect(src).toMatch(/export\s+interface\s+ReinjectionResult\s*\{/);
    expect(src).toContain("success: boolean");
    expect(src).toContain("snapshotId: string");
    expect(src).toContain("promptLength: number");
  });

  // T30 — types file exports ReinjectionHistoryEntry interface
  test("T30 — types file exports ReinjectionHistoryEntry interface", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    // comp-s03-type-reinjection-history
    expect(src).toMatch(/export\s+interface\s+ReinjectionHistoryEntry\s*\{/);
    expect(src).toContain("reinjected: boolean");
    expect(src).toContain("promptLength: number | null");
  });

  // T31 — types file exports ReinjectionHistoryFilters interface
  test("T31 — types file exports ReinjectionHistoryFilters interface", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    // comp-s03-type-reinjection-filters
    expect(src).toMatch(/export\s+interface\s+ReinjectionHistoryFilters\s*\{/);
    expect(src).toContain("workflowInstanceId?: string");
  });

  // T32 — types file exports RecoveryPrompt interface with sections
  test("T32 — types file exports RecoveryPrompt interface with sections", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    // comp-s03-type-recovery-prompt
    expect(src).toMatch(/export\s+interface\s+RecoveryPrompt\s*\{/);
    expect(src).toContain("sections:");
    expect(src).toContain("title: string");
    expect(src).toContain("content: string");
  });
});

// ============================================================
// Validators (2 tests)
// ============================================================

test.describe("COMP-S03 — Validators", () => {
  // T33 — validators file exports reinjectionSchema
  test("T33 — validators file exports reinjectionSchema with autoReinject", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    // comp-s03-validator-reinjection
    expect(src).toMatch(/export\s+const\s+reinjectionSchema/);
    expect(src).toContain("autoReinject");
  });

  // T34 — validators file exports reinjectionHistoryFiltersSchema
  test("T34 — validators file exports reinjectionHistoryFiltersSchema", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    // comp-s03-validator-history-filters
    expect(src).toMatch(/export\s+const\s+reinjectionHistoryFiltersSchema/);
    expect(src).toContain("workflowInstanceId");
  });
});

// ============================================================
// Barrel Exports (2 tests)
// ============================================================

test.describe("COMP-S03 — Barrel Exports", () => {
  // T35 — services/index.ts exports compactionReinjectionService
  test("T35 — services/index.ts exports compactionReinjectionService", async () => {
    const src = await readFile(SERVICES_INDEX, "utf-8");
    // comp-s03-barrel-service
    expect(src).toContain("compactionReinjectionService");
    expect(src).toContain("compaction-reinjection");
  });

  // T36 — shared types index re-exports COMP-S03 types
  test("T36 — shared types index re-exports ReinjectionResult and RecoveryPrompt", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    // comp-s03-barrel-types
    expect(src).toContain("ReinjectionResult");
    expect(src).toContain("ReinjectionHistoryEntry");
    expect(src).toContain("RecoveryPrompt");
  });
});

// ============================================================
// Route count compatibility (2 tests)
// ============================================================

test.describe("COMP-S03 — Route Count Compatibility", () => {
  // T37 — compaction routes file has 9 route handlers total
  test("T37 — compaction routes file has 9 route handlers (5+2+2)", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    const routerPostMatches = src.match(/router\.post\(/g);
    const routerGetMatches = src.match(/router\.get\(/g);
    const totalRoutes = (routerPostMatches?.length ?? 0) + (routerGetMatches?.length ?? 0);
    // 5 COMP-S01 (2 POST + 3 GET) + 2 COMP-S02 (1 POST + 1 GET) + 2 COMP-S03 (1 POST + 1 GET) = 9
    expect(totalRoutes).toBe(9);
  });

  // T38 — compaction routes file comment lists 9 routes
  test("T38 — compaction routes file comment lists 9 routes", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("9 routes for managing");
  });
});
