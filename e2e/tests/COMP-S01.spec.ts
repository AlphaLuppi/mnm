/**
 * COMP-S01 — CompactionWatcher: Compaction Detection Service
 *
 * File-content-based E2E tests verifying:
 * - Service factory export and public API methods
 * - Default compaction patterns and configuration
 * - LiveEvent subscription and heartbeat processing
 * - Orchestrator and enforcer integration for transitions and recovery
 * - Audit service integration with correct severity
 * - Cooldown deduplication tracker
 * - Shared types, constants, validators, and barrel exports
 * - API routes with permission guards and validation
 *
 * 50 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SVC_FILE = resolve(ROOT, "server/src/services/compaction-watcher.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/compaction.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/compaction.ts");
const VAL_FILE = resolve(ROOT, "packages/shared/src/validators/compaction.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VAL_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const CONSTANTS_FILE = resolve(ROOT, "packages/shared/src/constants.ts");
const ROUTES_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");

// ============================================================
// Service: compaction-watcher.ts
// ============================================================

test.describe("COMP-S01 — CompactionWatcher Service", () => {
  // T01 — Service factory export
  test("T01 — exports compactionWatcherService function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+compactionWatcherService\s*\(\s*db\s*:\s*Db\s*\)/);
  });

  // T02 — startWatching function
  test("T02 — service returns object with startWatching method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+startWatching\s*\(/);
    expect(src).toContain("startWatching,");
  });

  // T03 — stopWatching function
  test("T03 — service returns object with stopWatching method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+stopWatching\s*\(/);
    expect(src).toContain("stopWatching,");
  });

  // T04 — getWatcherStatus function
  test("T04 — service returns object with getWatcherStatus method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/function\s+getWatcherStatus\s*\(/);
    expect(src).toContain("getWatcherStatus,");
  });

  // T05 — getSnapshots function
  test("T05 — service returns object with getSnapshots method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getSnapshots\s*\(/);
    expect(src).toContain("getSnapshots,");
  });

  // T06 — getSnapshotById function
  test("T06 — service returns object with getSnapshotById method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getSnapshotById\s*\(/);
    expect(src).toContain("getSnapshotById,");
  });

  // T07 — onHeartbeatEvent function
  test("T07 — service returns object with onHeartbeatEvent method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+onHeartbeatEvent\s*\(/);
    expect(src).toContain("onHeartbeatEvent,");
  });

  // T08 — Default compaction patterns include key phrases
  test("T08 — DEFAULT_COMPACTION_PATTERNS includes key detection phrases", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("DEFAULT_COMPACTION_PATTERNS");
    expect(src).toContain("summarize");
    expect(src).toContain("context window");
    expect(src).toContain("token limit");
    expect(src).toContain("compacting");
    expect(src).toContain("compaction");
    expect(src).toContain("memory summary");
    expect(src).toContain("context summary");
    expect(src).toContain("truncating context");
    expect(src).toContain("trimming context");
    expect(src).toContain("conversation too long");
    expect(src).toContain("context too large");
  });

  // T09 — Default config has correct shape
  test("T09 — DEFAULT_CONFIG includes enabled, cooldownMs, patterns", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/const\s+DEFAULT_CONFIG\s*:\s*CompactionWatcherConfig\s*=/);
    expect(src).toMatch(/enabled\s*:\s*true/);
    expect(src).toMatch(/cooldownMs\s*:\s*60[_,]?000/);
    expect(src).toContain("patterns: DEFAULT_COMPACTION_PATTERNS");
  });

  // T10 — Subscribes to heartbeat events via LiveEvents
  test("T10 — imports and uses subscribeCompanyLiveEvents in startWatching", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("subscribeCompanyLiveEvents");
    expect(src).toMatch(/import\s*\{[^}]*subscribeCompanyLiveEvents[^}]*\}\s*from\s*["']\.\/live-events/);
  });

  // T11 — Uses orchestratorService for transitions
  test("T11 — imports orchestratorService and calls compact_detected transition", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*orchestratorService[^}]*\}\s*from\s*["']\.\/orchestrator/);
    expect(src).toContain("orchestrator.transitionStage");
    expect(src).toContain('"compact_detected"');
  });

  // T12 — Uses workflowEnforcerService for recovery artifacts
  test("T12 — imports workflowEnforcerService and calls getStageArtifacts", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*workflowEnforcerService[^}]*\}\s*from\s*["']\.\/workflow-enforcer/);
    expect(src).toContain("enforcer.getStageArtifacts");
  });

  // T13 — Uses auditService for event emission
  test("T13 — imports auditService and calls audit.emit for compaction.detected", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*auditService[^}]*\}\s*from\s*["']\.\/audit/);
    expect(src).toContain("audit.emit");
    expect(src).toContain('"compaction.detected"');
  });

  // T14 — Uses publishLiveEvent for WebSocket
  test("T14 — imports publishLiveEvent and emits compaction events", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*publishLiveEvent[^}]*\}\s*from\s*["']\.\/live-events/);
    const publishCalls = src.match(/publishLiveEvent\s*\(/g);
    expect(publishCalls).not.toBeNull();
    expect(publishCalls!.length).toBeGreaterThanOrEqual(3);
  });

  // T15 — Deduplication tracker (cooldown Map)
  test("T15 — cooldown tracker Map for dedup by agent", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("cooldownTracker");
    expect(src).toMatch(/const\s+cooldownTracker\s*=\s*new\s+Map/);
    expect(src).toContain("cooldownTracker.get(agentId)");
    expect(src).toContain("cooldownTracker.set(agentId");
  });

  // T36 — Pattern matching logic uses regex
  test("T36 — detectCompaction creates RegExp for case-insensitive matching", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/function\s+detectCompaction\s*\(/);
    expect(src).toMatch(/new\s+RegExp\s*\(\s*pattern\s*,\s*["']i["']\s*\)/);
    expect(src).toContain("regex.test(message)");
  });

  // T37 — Snapshot includes previousArtifacts
  test("T37 — createSnapshot calls getStageArtifacts for previousArtifacts", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+createSnapshot\s*\(/);
    expect(src).toContain("enforcer.getStageArtifacts(stage.workflowInstanceId)");
    expect(src).toContain("previousArtifacts:");
  });

  // T38 — Snapshot includes prePromptsInjected
  test("T38 — createSnapshot reads prePromptsInjected from stage", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("prePromptsInjected");
    expect(src).toContain("stage.prePromptsInjected");
  });

  // T39 — Audit emit uses severity "warning"
  test("T39 — audit.emit call includes severity warning", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/audit\.emit\s*\(\s*\{[\s\S]*?severity\s*:\s*["']warning["']/);
  });

  // T40 — Logger usage
  test("T40 — imports logger from middleware", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*logger[^}]*\}\s*from\s*["']\.\.\/middleware\/logger/);
    expect(src).toContain("logger.info");
    expect(src).toContain("logger.error");
  });

  // T46 — Monitors map uses companyId as key
  test("T46 — in-memory monitors Map keyed by companyId", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/const\s+monitors\s*=\s*new\s+Map/);
    expect(src).toContain("monitors.has(companyId)");
    expect(src).toContain("monitors.set(companyId");
    expect(src).toContain("monitors.get(companyId)");
  });

  // T47 — stopWatching calls unsubscribe and deletes monitor
  test("T47 — stopWatching calls unsubscribe and deletes monitor", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("monitor.unsubscribe()");
    expect(src).toContain("monitors.delete(companyId)");
  });

  // T48 — Event filter: only heartbeat events processed
  test("T48 — onHeartbeatEvent filters for heartbeat.run.event and heartbeat.run.log", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain('"heartbeat.run.event"');
    expect(src).toContain('"heartbeat.run.log"');
  });

  // T49 — Stage lookup before snapshot
  test("T49 — service loads stageInstances from DB before creating snapshot", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import[^;]*stageInstances[^;]*from\s*["']@mnm\/db/);
    expect(src).toContain("stageInstances.machineState");
    expect(src).toContain('"in_progress"');
  });

  // T50 — CompactionSnapshot has id field (UUID generation)
  test("T50 — snapshot creation generates UUID via randomUUID", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*randomUUID[^}]*\}\s*from\s*["']node:crypto/);
    expect(src).toContain("id: randomUUID()");
  });
});

// ============================================================
// Types: packages/shared/src/types/compaction.ts
// ============================================================

test.describe("COMP-S01 — Shared Types", () => {
  // T16 — CompactionSnapshot type definition
  test("T16 — CompactionSnapshot interface with required fields", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+CompactionSnapshot\s*\{/);
    expect(src).toContain("id: string");
    expect(src).toContain("companyId: string");
    expect(src).toContain("workflowInstanceId: string");
    expect(src).toContain("stageId: string");
    expect(src).toContain("agentId: string");
    expect(src).toContain("stageOrder: number");
    expect(src).toContain("detectedAt: string");
    expect(src).toContain("detectionPattern: string");
    expect(src).toContain("detectionMessage: string");
    expect(src).toContain("previousArtifacts: StageArtifact[]");
    expect(src).toContain("prePromptsInjected: PrePromptPayload | null");
    expect(src).toContain("outputArtifactsSoFar: string[]");
    expect(src).toContain("strategy: CompactionStrategy");
    expect(src).toContain("status: CompactionSnapshotStatus");
    expect(src).toContain("resolvedAt: string | null");
    expect(src).toContain("metadata: Record<string, unknown>");
  });

  // T17 — CompactionWatcherConfig type definition
  test("T17 — CompactionWatcherConfig interface with config fields", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+CompactionWatcherConfig\s*\{/);
    expect(src).toContain("enabled: boolean");
    expect(src).toContain("cooldownMs: number");
    expect(src).toContain("patterns: string[]");
  });

  // T18 — CompactionWatcherStatus type definition
  test("T18 — CompactionWatcherStatus interface with status fields", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+CompactionWatcherStatus\s*\{/);
    expect(src).toContain("active: boolean");
    expect(src).toContain("activeSnapshotCount: number");
    expect(src).toContain("startedAt: string | null");
    expect(src).toContain("lastCheckAt: string | null");
    expect(src).toContain("config: CompactionWatcherConfig");
  });

  // T19 — COMPACTION_STRATEGIES constant
  test("T19 — COMPACTION_STRATEGIES includes kill_relaunch and reinjection", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+COMPACTION_STRATEGIES\s*=/);
    expect(src).toContain('"kill_relaunch"');
    expect(src).toContain('"reinjection"');
  });

  // T20 — COMPACTION_SNAPSHOT_STATUSES constant
  test("T20 — COMPACTION_SNAPSHOT_STATUSES includes pending, processing, resolved, failed", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+COMPACTION_SNAPSHOT_STATUSES\s*=/);
    expect(src).toContain('"pending"');
    expect(src).toContain('"processing"');
    expect(src).toContain('"resolved"');
    expect(src).toContain('"failed"');
  });

  // T21 — CompactionSnapshotFilters type
  test("T21 — CompactionSnapshotFilters with filter fields", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+CompactionSnapshotFilters\s*\{/);
    expect(src).toContain("stageId?: string");
    expect(src).toContain("agentId?: string");
    expect(src).toContain("status?: CompactionSnapshotStatus");
    expect(src).toContain("limit?: number");
    expect(src).toContain("offset?: number");
  });

  // T45 — CompactionStrategy type export
  test("T45 — CompactionStrategy type exported", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+type\s+CompactionStrategy\s*=/);
  });
});

// ============================================================
// Validators: packages/shared/src/validators/compaction.ts
// ============================================================

test.describe("COMP-S01 — Validators", () => {
  // T22 — startCompactionWatcherSchema
  test("T22 — exports startCompactionWatcherSchema", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+startCompactionWatcherSchema\s*=/);
    expect(src).toContain("enabled:");
    expect(src).toContain("cooldownMs:");
    expect(src).toContain("patterns:");
  });

  // T23 — compactionSnapshotFiltersSchema
  test("T23 — exports compactionSnapshotFiltersSchema", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+compactionSnapshotFiltersSchema\s*=/);
    expect(src).toContain("stageId:");
    expect(src).toContain("agentId:");
    expect(src).toContain("status:");
    expect(src).toContain("limit:");
    expect(src).toContain("offset:");
  });
});

// ============================================================
// Barrel Exports
// ============================================================

test.describe("COMP-S01 — Barrel Exports", () => {
  // T24 — Types barrel export
  test("T24 — types/index.ts exports compaction types", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("CompactionSnapshot");
    expect(src).toContain("CompactionWatcherConfig");
    expect(src).toContain("CompactionWatcherStatus");
    expect(src).toContain("CompactionStrategy");
    expect(src).toContain("CompactionSnapshotStatus");
    expect(src).toContain("CompactionSnapshotFilters");
    expect(src).toContain("COMPACTION_STRATEGIES");
    expect(src).toContain("COMPACTION_SNAPSHOT_STATUSES");
    expect(src).toMatch(/from\s*["']\.\/compaction\.js["']/);
  });

  // T25 — Validators barrel export
  test("T25 — validators/index.ts exports compaction validators", async () => {
    const src = await readFile(VAL_INDEX, "utf-8");
    expect(src).toContain("startCompactionWatcherSchema");
    expect(src).toContain("compactionSnapshotFiltersSchema");
    expect(src).toMatch(/from\s*["']\.\/compaction\.js["']/);
  });

  // T26 — Shared index barrel export types
  test("T26 — shared/src/index.ts exports compaction types", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("CompactionSnapshot");
    expect(src).toContain("CompactionWatcherConfig");
    expect(src).toContain("CompactionWatcherStatus");
    expect(src).toContain("CompactionSnapshotFilters");
    expect(src).toContain("COMPACTION_STRATEGIES");
    expect(src).toContain("COMPACTION_SNAPSHOT_STATUSES");
  });

  // T27 — Shared index barrel export validators
  test("T27 — shared/src/index.ts exports compaction validators", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("startCompactionWatcherSchema");
    expect(src).toContain("compactionSnapshotFiltersSchema");
  });

  // T28 — LiveEventType includes compaction events
  test("T28 — LIVE_EVENT_TYPES includes compaction events", async () => {
    const src = await readFile(CONSTANTS_FILE, "utf-8");
    expect(src).toContain('"compaction.detected"');
    expect(src).toContain('"compaction.snapshot_created"');
    expect(src).toContain('"compaction.watching_started"');
    expect(src).toContain('"compaction.watching_stopped"');
  });

  // T34 — Routes barrel export
  test("T34 — routes/index.ts exports compactionRoutes", async () => {
    const src = await readFile(ROUTES_INDEX, "utf-8");
    expect(src).toContain("compactionRoutes");
    expect(src).toMatch(/export\s*\{[^}]*compactionRoutes[^}]*\}\s*from\s*["']\.\/compaction\.js["']/);
  });

  // T35 — Service barrel export
  test("T35 — services/index.ts exports compactionWatcherService", async () => {
    const src = await readFile(SERVICES_INDEX, "utf-8");
    expect(src).toContain("compactionWatcherService");
    expect(src).toMatch(/export\s*\{[^}]*compactionWatcherService[^}]*\}\s*from\s*["']\.\/compaction-watcher\.js["']/);
  });
});

// ============================================================
// Routes: server/src/routes/compaction.ts
// ============================================================

test.describe("COMP-S01 — API Routes", () => {
  // T29 — POST compaction/start
  test("T29 — POST compaction/start route with requirePermission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\s*\(\s*["']\/companies\/:companyId\/compaction\/start["']/);
    expect(src).toContain('requirePermission(db, "workflows:enforce")');
    expect(src).toContain("validate(startCompactionWatcherSchema)");
    expect(src).toContain("watcher.startWatching");
  });

  // T30 — POST compaction/stop
  test("T30 — POST compaction/stop route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\s*\(\s*["']\/companies\/:companyId\/compaction\/stop["']/);
    expect(src).toContain("watcher.stopWatching");
  });

  // T31 — GET compaction/status
  test("T31 — GET compaction/status route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*["']\/companies\/:companyId\/compaction\/status["']/);
    expect(src).toContain("watcher.getWatcherStatus");
  });

  // T32 — GET compaction/snapshots
  test("T32 — GET compaction/snapshots route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*["']\/companies\/:companyId\/compaction\/snapshots["']/);
    expect(src).toContain("compactionSnapshotFiltersSchema.parse");
    expect(src).toContain("watcher.getSnapshots");
  });

  // T33 — GET compaction/snapshots/:snapshotId
  test("T33 — GET compaction/snapshots/:snapshotId route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*["']\/companies\/:companyId\/compaction\/snapshots\/:snapshotId["']/);
    expect(src).toContain("watcher.getSnapshotById");
    expect(src).toContain('notFound("Compaction snapshot not found")');
  });

  // T41 — assertCompanyAccess in routes
  test("T41 — routes use assertCompanyAccess", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("assertCompanyAccess(req, companyId");
    const calls = src.match(/assertCompanyAccess\s*\(/g);
    expect(calls).not.toBeNull();
    expect(calls!.length).toBeGreaterThanOrEqual(5);
  });

  // T42 — getActorInfo in routes
  test("T42 — routes use getActorInfo for actor extraction", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("getActorInfo(req)");
    expect(src).toMatch(/import\s*\{[^}]*getActorInfo[^}]*\}\s*from\s*["']\.\/authz/);
  });

  // T43 — emitAudit in routes
  test("T43 — routes call emitAudit for auditing", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("emitAudit(");
    expect(src).toMatch(/import\s*\{[^}]*emitAudit[^}]*\}/);
  });

  // T44 — Route uses validate middleware
  test("T44 — POST routes use validate() middleware", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("validate(startCompactionWatcherSchema)");
    expect(src).toMatch(/import\s*\{[^}]*validate[^}]*\}\s*from\s*["']\.\.\/middleware\/validate/);
  });
});
