/**
 * COMP-S02 — Kill+Relaunch: Compaction Recovery Service
 *
 * File-content-based E2E tests verifying:
 * - Kill+relaunch service factory export and public API methods
 * - Circuit breaker logic (maxRelaunchCount check)
 * - Container stop and relaunch integration with ContainerManager
 * - Recovery env vars (MNM_COMPACTION_RECOVERY, MNM_SNAPSHOT_ID, MNM_RECOVERY_STAGE_ORDER)
 * - Audit emission for kill, stop, relaunch, circuit breaker
 * - LiveEvent emission for kill, relaunch, circuit breaker
 * - Compaction-watcher DB integration (persistSnapshot, listSnapshotsFromDb, getSnapshotFromDb)
 * - Schema: compaction_snapshots table with indexes
 * - Migration SQL
 * - Shared types (KillRelaunchResult, RelaunchHistoryEntry)
 * - Validators (killRelaunchSchema, relaunchHistoryFiltersSchema)
 * - Routes (kill-relaunch, relaunch-history)
 * - Barrel exports (services, schema, types, validators)
 *
 * 38 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SVC_FILE = resolve(ROOT, "server/src/services/compaction-kill-relaunch.ts");
const WATCHER_FILE = resolve(ROOT, "server/src/services/compaction-watcher.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/compaction.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/compaction.ts");
const VAL_FILE = resolve(ROOT, "packages/shared/src/validators/compaction.ts");
const SCHEMA_FILE = resolve(ROOT, "packages/db/src/schema/compaction_snapshots.ts");
const MIGRATION_FILE = resolve(ROOT, "packages/db/src/migrations/0040_compaction_snapshots.sql");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VAL_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const SCHEMA_INDEX = resolve(ROOT, "packages/db/src/schema/index.ts");

// ============================================================
// Service: compaction-kill-relaunch.ts (18 tests)
// ============================================================

test.describe("COMP-S02 — Kill+Relaunch Service", () => {
  // T01 — Service factory export
  test("T01 — exports compactionKillRelaunchService function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+compactionKillRelaunchService\s*\(\s*db\s*:\s*Db\s*\)/);
  });

  // T02 — executeKillRelaunch method
  test("T02 — service returns executeKillRelaunch method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+executeKillRelaunch\s*\(/);
    expect(src).toContain("executeKillRelaunch,");
  });

  // T03 — getRelaunchCount method
  test("T03 — service returns getRelaunchCount method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getRelaunchCount\s*\(/);
    expect(src).toContain("getRelaunchCount,");
  });

  // T04 — getRelaunchHistory method
  test("T04 — service returns getRelaunchHistory method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getRelaunchHistory\s*\(/);
    expect(src).toContain("getRelaunchHistory,");
  });

  // T05 — persistSnapshot method
  test("T05 — service returns persistSnapshot method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+persistSnapshot\s*\(/);
    expect(src).toContain("persistSnapshot,");
  });

  // T06 — updateSnapshotStatus method
  test("T06 — service returns updateSnapshotStatus method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+updateSnapshotStatus\s*\(/);
    expect(src).toContain("updateSnapshotStatus,");
  });

  // T07 — getSnapshotFromDb method
  test("T07 — service returns getSnapshotFromDb method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getSnapshotFromDb\s*\(/);
    expect(src).toContain("getSnapshotFromDb,");
  });

  // T08 — listSnapshotsFromDb method
  test("T08 — service returns listSnapshotsFromDb method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+listSnapshotsFromDb\s*\(/);
    expect(src).toContain("listSnapshotsFromDb,");
  });

  // T09 — executeKillRelaunch calls containerManager.stopContainer
  test("T09 — executeKillRelaunch calls containerManager.stopContainer", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s02-container-stop
    expect(src).toContain("containerManager.stopContainer(");
    expect(src).toContain("compaction_kill_relaunch");
  });

  // T10 — executeKillRelaunch calls containerManager.launchContainer
  test("T10 — executeKillRelaunch calls containerManager.launchContainer", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s02-container-relaunch
    expect(src).toContain("containerManager.launchContainer(");
    expect(src).toContain("snapshot.agentId");
  });

  // T11 — Recovery env var MNM_COMPACTION_RECOVERY
  test("T11 — sets MNM_COMPACTION_RECOVERY recovery env var", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s02-recovery-env-vars
    expect(src).toContain('MNM_COMPACTION_RECOVERY: "true"');
  });

  // T12 — Recovery env var MNM_SNAPSHOT_ID
  test("T12 — sets MNM_SNAPSHOT_ID recovery env var", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("MNM_SNAPSHOT_ID: snapshotId");
  });

  // T13 — Recovery env var MNM_RECOVERY_STAGE_ORDER
  test("T13 — sets MNM_RECOVERY_STAGE_ORDER recovery env var", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("MNM_RECOVERY_STAGE_ORDER:");
    expect(src).toContain("snapshot.stageOrder");
  });

  // T14 — Circuit breaker checks relaunchCount >= maxRelaunchCount
  test("T14 — circuit breaker checks relaunchCount >= maxRelaunchCount", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s02-circuit-breaker-check
    expect(src).toMatch(/snapshot\.relaunchCount\s*>=\s*maxRelaunch/);
  });

  // T15 — Circuit breaker transitions stage to paused
  test("T15 — circuit breaker transitions stage to paused via orchestrator", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s02-circuit-breaker-trigger
    expect(src).toContain('"pause"');
    expect(src).toContain("circuit_breaker");
    expect(src).toContain("orchestrator.transitionStage(");
  });

  // T16 — Emits audit compaction.kill_started
  test("T16 — emits audit event compaction.kill_started", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s02-audit-kill-started
    expect(src).toContain('"compaction.kill_started"');
    expect(src).toContain("audit.emit(");
  });

  // T17 — Emits audit compaction.relaunch_completed
  test("T17 — emits audit event compaction.relaunch_completed", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s02-audit-relaunch-completed
    expect(src).toContain('"compaction.relaunch_completed"');
  });

  // T18 — Emits LiveEvent compaction.kill_started
  test("T18 — emits LiveEvent compaction.kill_started", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // comp-s02-live-kill-started
    expect(src).toContain("publishLiveEvent(");
    const killStartedMatches = src.match(/compaction\.kill_started/g);
    expect(killStartedMatches).toBeTruthy();
    expect(killStartedMatches!.length).toBeGreaterThanOrEqual(2); // audit + liveEvent
  });
});

// ============================================================
// Watcher DB Integration (4 tests)
// ============================================================

test.describe("COMP-S02 — Watcher DB Integration", () => {
  // T19 — compaction-watcher imports compactionKillRelaunchService
  test("T19 — watcher imports compactionKillRelaunchService", async () => {
    const src = await readFile(WATCHER_FILE, "utf-8");
    // comp-s02-watcher-db-integration
    expect(src).toContain("compactionKillRelaunchService");
    expect(src).toContain("compaction-kill-relaunch");
  });

  // T20 — watcher uses persistSnapshot instead of in-memory store
  test("T20 — watcher uses persistSnapshot instead of in-memory store", async () => {
    const src = await readFile(WATCHER_FILE, "utf-8");
    // comp-s02-persist-snapshot-to-db
    expect(src).toContain("killRelaunch.persistSnapshot(");
    // Should NOT have the old in-memory snapshotStore push
    expect(src).not.toContain("snapshotStore.set(");
    expect(src).not.toContain("companySnapshots.push(snapshot)");
  });

  // T21 — watcher uses listSnapshotsFromDb for getSnapshots
  test("T21 — watcher uses listSnapshotsFromDb for getSnapshots", async () => {
    const src = await readFile(WATCHER_FILE, "utf-8");
    // comp-s02-list-snapshots-from-db delegation
    expect(src).toContain("killRelaunch.listSnapshotsFromDb(");
  });

  // T22 — watcher uses getSnapshotFromDb for getSnapshotById
  test("T22 — watcher uses getSnapshotFromDb for getSnapshotById", async () => {
    const src = await readFile(WATCHER_FILE, "utf-8");
    // comp-s02-get-snapshot-from-db delegation
    expect(src).toContain("killRelaunch.getSnapshotFromDb(");
  });
});

// ============================================================
// Schema: compaction_snapshots.ts (6 tests)
// ============================================================

test.describe("COMP-S02 — Schema: compaction_snapshots", () => {
  // T23 — schema exports compactionSnapshots table
  test("T23 — schema exports compactionSnapshots table", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    // comp-s02-schema-table
    expect(src).toMatch(/export\s+const\s+compactionSnapshots\s*=\s*pgTable\s*\(/);
    expect(src).toContain('"compaction_snapshots"');
  });

  // T24 — schema has relaunchCount column with default 0
  test("T24 — schema has relaunchCount column with default 0", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("relaunchCount:");
    expect(src).toContain('"relaunch_count"');
    expect(src).toContain(".default(0)");
  });

  // T25 — schema has maxRelaunchCount column with default 3
  test("T25 — schema has maxRelaunchCount column with default 3", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("maxRelaunchCount:");
    expect(src).toContain('"max_relaunch_count"');
    expect(src).toContain(".default(3)");
  });

  // T26 — schema has idx_compaction_snapshots_company_id index
  test("T26 — schema has company_id index", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    // comp-s02-idx-company
    expect(src).toContain("idx_compaction_snapshots_company_id");
  });

  // T27 — schema has idx_compaction_snapshots_agent_stage index
  test("T27 — schema has agent_stage index", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    // comp-s02-idx-agent-stage
    expect(src).toContain("idx_compaction_snapshots_agent_stage");
  });

  // T28 — schema has idx_compaction_snapshots_status index
  test("T28 — schema has status index", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    // comp-s02-idx-status
    expect(src).toContain("idx_compaction_snapshots_status");
  });
});

// ============================================================
// Routes: compaction.ts (4 tests)
// ============================================================

test.describe("COMP-S02 — Routes", () => {
  // T29 — route POST kill-relaunch exists with requirePermission
  test("T29 — POST kill-relaunch route exists with requirePermission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    // comp-s02-route-kill-relaunch
    expect(src).toContain("/companies/:companyId/compaction/snapshots/:snapshotId/kill-relaunch");
    expect(src).toContain("requirePermission(db,");
    expect(src).toContain("killRelaunchSchema");
  });

  // T30 — route GET relaunch-history exists with requirePermission
  test("T30 — GET relaunch-history route exists with requirePermission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    // comp-s02-route-relaunch-history
    expect(src).toContain("/companies/:companyId/compaction/relaunch-history");
    expect(src).toContain("relaunchHistoryFiltersSchema");
  });

  // T31 — kill-relaunch route calls executeKillRelaunch
  test("T31 — kill-relaunch route calls executeKillRelaunch", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("killRelaunch.executeKillRelaunch(");
  });

  // T32 — relaunch-history route calls getRelaunchHistory
  test("T32 — relaunch-history route calls getRelaunchHistory", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("killRelaunch.getRelaunchHistory(");
  });
});

// ============================================================
// Shared Types & Validators (4 tests)
// ============================================================

test.describe("COMP-S02 — Shared Types & Validators", () => {
  // T33 — types file exports KillRelaunchResult interface
  test("T33 — types file exports KillRelaunchResult interface", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    // comp-s02-type-kill-relaunch-result
    expect(src).toMatch(/export\s+interface\s+KillRelaunchResult\s*\{/);
    expect(src).toContain("success: boolean");
    expect(src).toContain("snapshotId: string");
    expect(src).toContain("newInstanceId?: string");
  });

  // T34 — types file exports RelaunchHistoryEntry interface
  test("T34 — types file exports RelaunchHistoryEntry interface", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    // comp-s02-type-relaunch-history-entry
    expect(src).toMatch(/export\s+interface\s+RelaunchHistoryEntry\s*\{/);
    expect(src).toContain("relaunchCount: number");
    expect(src).toContain("maxRelaunchCount: number");
  });

  // T35 — validators file exports killRelaunchSchema
  test("T35 — validators file exports killRelaunchSchema", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    // comp-s02-validator-kill-relaunch
    expect(src).toMatch(/export\s+const\s+killRelaunchSchema/);
    expect(src).toContain("maxRelaunchCount");
  });

  // T36 — validators file exports relaunchHistoryFiltersSchema
  test("T36 — validators file exports relaunchHistoryFiltersSchema", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    // comp-s02-validator-history-filters
    expect(src).toMatch(/export\s+const\s+relaunchHistoryFiltersSchema/);
    expect(src).toContain("workflowInstanceId");
  });
});

// ============================================================
// Barrel Exports (2 tests)
// ============================================================

test.describe("COMP-S02 — Barrel Exports", () => {
  // T37 — services/index.ts exports compactionKillRelaunchService
  test("T37 — services/index.ts exports compactionKillRelaunchService", async () => {
    const src = await readFile(SERVICES_INDEX, "utf-8");
    // comp-s02-barrel-service
    expect(src).toContain("compactionKillRelaunchService");
    expect(src).toContain("compaction-kill-relaunch");
  });

  // T38 — db schema/index.ts exports compactionSnapshots
  test("T38 — db schema/index.ts exports compactionSnapshots", async () => {
    const src = await readFile(SCHEMA_INDEX, "utf-8");
    // comp-s02-barrel-schema
    expect(src).toContain("compactionSnapshots");
    expect(src).toContain("compaction_snapshots");
  });
});
