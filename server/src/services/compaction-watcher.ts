/**
 * COMP-S01: CompactionWatcher — Compaction Detection Service
 * COMP-S02: Updated to use DB persistence via compactionKillRelaunchService
 *
 * Monitors heartbeat run events in real-time via LiveEvents, detects patterns
 * indicating an AI agent is compacting/summarizing its context, creates
 * snapshots of the pre-compaction state, and triggers the orchestrator
 * "compact_detected" transition.
 *
 * Pattern: Same event-driven architecture as drift-monitor.ts
 * - Subscribes to company LiveEvents (heartbeat.run.event, heartbeat.run.log)
 * - Analyzes messages for compaction patterns (regex-based)
 * - Deduplicates detections via cooldown per agent
 * - Creates CompactionSnapshot with recovery artifacts (persisted to DB via COMP-S02)
 * - Triggers orchestrator transition compact_detected
 * - Emits audit events and WebSocket notifications
 */

import { randomUUID } from "node:crypto";
import type { Db } from "@mnm/db";
import { stageInstances } from "@mnm/db";
import { eq, and } from "drizzle-orm";
import type {
  CompactionSnapshot,
  CompactionWatcherConfig,
  CompactionWatcherStatus,
  CompactionSnapshotFilters,
  LiveEvent,
  LiveEventType,
} from "@mnm/shared";
import { publishLiveEvent, subscribeCompanyLiveEvents } from "./live-events.js";
import { orchestratorService } from "./orchestrator.js";
import { workflowEnforcerService } from "./workflow-enforcer.js";
import { auditService } from "./audit.js";
// comp-s02-watcher-db-integration
import { compactionKillRelaunchService } from "./compaction-kill-relaunch.js";
import { logger } from "../middleware/logger.js";

// --- comp-s01-default-patterns ---
const DEFAULT_COMPACTION_PATTERNS: string[] = [
  "I'll now summarize",
  "Let me summarize",
  "context window",
  "token limit",
  "compacting",
  "compaction",
  "memory summary",
  "context summary",
  "truncating context",
  "trimming context",
  "conversation too long",
  "context too large",
  "summarizing the conversation",
  "context has been condensed",
  "reducing context",
];

// --- comp-s01-default-config ---
const DEFAULT_CONFIG: CompactionWatcherConfig = {
  enabled: true,
  cooldownMs: 60_000, // 1 minute cooldown between detections per agent
  patterns: DEFAULT_COMPACTION_PATTERNS,
};

// --- comp-s01-dedup-tracker ---
/** Cooldown deduplication: agentId -> last detection timestamp */
const cooldownTracker = new Map<string, number>();

// --- Active monitoring subscriptions by companyId ---
// comp-s01-monitors-map
const monitors = new Map<string, {
  unsubscribe: () => void;
  startedAt: string;
  lastCheckAt: string | null;
  config: CompactionWatcherConfig;
}>();

// --- Service factory ---
// comp-s01-watcher-service
export function compactionWatcherService(db: Db) {
  const orchestrator = orchestratorService(db);
  const enforcer = workflowEnforcerService(db);
  const audit = auditService(db);
  // comp-s02-snapshot-db-persist
  const killRelaunch = compactionKillRelaunchService(db);

  // ========================================================
  // comp-s01-start-watching
  // ========================================================
  async function startWatching(
    companyId: string,
    config?: Partial<CompactionWatcherConfig>,
  ): Promise<CompactionWatcherStatus> {
    // If already watching, stop first
    if (monitors.has(companyId)) {
      await stopWatching(companyId);
    }

    const mergedConfig: CompactionWatcherConfig = { ...DEFAULT_CONFIG, ...config };

    // Subscribe to heartbeat events via LiveEvents (non-blocking, event-driven)
    const unsubscribe = subscribeCompanyLiveEvents(companyId, (event: LiveEvent) => {
      // comp-s01-event-filter: only process heartbeat run events/logs
      if (event.type === "heartbeat.run.event" || event.type === "heartbeat.run.log") {
        onHeartbeatEvent(companyId, event).catch((err) => {
          logger.error({ err, companyId }, "CompactionWatcher: error processing heartbeat event");
        });
      }
    });

    const now = new Date().toISOString();
    monitors.set(companyId, {
      unsubscribe,
      startedAt: now,
      lastCheckAt: null,
      config: mergedConfig,
    });

    // Emit LiveEvent
    publishLiveEvent({
      companyId,
      type: "compaction.watching_started" as LiveEventType,
      payload: { companyId, config: mergedConfig },
    });

    logger.info({ companyId }, "CompactionWatcher: watching started");

    return getWatcherStatus(companyId);
  }

  // ========================================================
  // comp-s01-stop-watching
  // ========================================================
  async function stopWatching(companyId: string): Promise<void> {
    const monitor = monitors.get(companyId);
    if (!monitor) return;

    monitor.unsubscribe();
    monitors.delete(companyId);

    publishLiveEvent({
      companyId,
      type: "compaction.watching_stopped" as LiveEventType,
      payload: { companyId },
    });

    logger.info({ companyId }, "CompactionWatcher: watching stopped");
  }

  // ========================================================
  // comp-s01-get-status
  // ========================================================
  async function getWatcherStatus(companyId: string): Promise<CompactionWatcherStatus> {
    const monitor = monitors.get(companyId);
    // comp-s02-watcher-db-active-count: count active snapshots from DB
    const snapshots = await killRelaunch.listSnapshotsFromDb(companyId, { status: "pending" });
    const processingSnapshots = await killRelaunch.listSnapshotsFromDb(companyId, { status: "processing" });
    const activeSnapshotCount = snapshots.length + processingSnapshots.length;

    if (!monitor) {
      return {
        active: false,
        activeSnapshotCount,
        startedAt: null,
        lastCheckAt: null,
        config: DEFAULT_CONFIG,
      };
    }

    return {
      active: true,
      activeSnapshotCount,
      startedAt: monitor.startedAt,
      lastCheckAt: monitor.lastCheckAt,
      config: monitor.config,
    };
  }

  // ========================================================
  // comp-s01-get-snapshots (now uses DB via COMP-S02)
  // ========================================================
  async function getSnapshots(
    companyId: string,
    filters?: CompactionSnapshotFilters,
  ): Promise<CompactionSnapshot[]> {
    // comp-s02-list-snapshots-from-db delegation
    return killRelaunch.listSnapshotsFromDb(companyId, filters);
  }

  // ========================================================
  // comp-s01-get-snapshot-by-id (now uses DB via COMP-S02)
  // ========================================================
  async function getSnapshotById(
    companyId: string,
    snapshotId: string,
  ): Promise<CompactionSnapshot | null> {
    // comp-s02-get-snapshot-from-db delegation
    return killRelaunch.getSnapshotFromDb(companyId, snapshotId);
  }

  // ========================================================
  // comp-s01-on-heartbeat-event
  // ========================================================
  async function onHeartbeatEvent(
    companyId: string,
    event: LiveEvent,
  ): Promise<void> {
    const monitor = monitors.get(companyId);
    if (!monitor || !monitor.config.enabled) return;

    // Update lastCheckAt
    monitor.lastCheckAt = new Date().toISOString();

    const payload = event.payload as Record<string, unknown>;
    const message = (payload.message as string) ?? "";
    if (!message) return;

    // comp-s01-detect-compaction
    const detectionResult = detectCompaction(message, monitor.config.patterns);
    if (!detectionResult) return;

    // Extract agentId from event payload
    const agentId = (payload.agentId as string) ?? null;
    if (!agentId) return;

    // Check cooldown deduplication
    const now = Date.now();
    const lastDetection = cooldownTracker.get(agentId);
    if (lastDetection && (now - lastDetection) < monitor.config.cooldownMs) {
      return; // cooldown active, skip duplicate detection
    }

    // Mark detection for cooldown
    cooldownTracker.set(agentId, now);

    // Find the active stage for this agent (in_progress)
    const activeStages = await db
      .select()
      .from(stageInstances)
      .where(
        and(
          eq(stageInstances.companyId, companyId),
          eq(stageInstances.machineState, "in_progress"),
        ),
      );

    // Filter to find stage associated with this agent (via workflowInstanceId context)
    // For now, pick any in_progress stage for this company.
    // In a full implementation, agent-to-stage mapping would be more precise.
    const targetStage = activeStages[0];
    if (!targetStage) return;

    // comp-s01-create-snapshot
    const snapshot = await createSnapshot(
      companyId,
      targetStage,
      agentId,
      detectionResult.pattern,
      detectionResult.message,
    );

    // comp-s01-trigger-transition
    try {
      await orchestrator.transitionStage(
        targetStage.id,
        "compact_detected",
        {
          actorId: "compaction-watcher",
          actorType: "system",
          companyId,
        },
        {
          metadata: {
            snapshotId: snapshot.id,
            detectionPattern: detectionResult.pattern,
            detectionMessage: detectionResult.message,
          },
        },
      );
    } catch (err) {
      logger.error(
        { err, companyId, stageId: targetStage.id },
        "CompactionWatcher: failed to transition stage to compacting",
      );
      // Update snapshot status to failed via DB
      await killRelaunch.updateSnapshotStatus(snapshot.id, "failed", {
        transitionError: String(err),
      });
    }

    // Emit audit event
    audit.emit({
      companyId,
      actorId: "compaction-watcher",
      actorType: "system",
      action: "compaction.detected",
      targetType: "stage",
      targetId: targetStage.id,
      metadata: {
        snapshotId: snapshot.id,
        agentId,
        detectionPattern: detectionResult.pattern,
        stageOrder: targetStage.stageOrder,
        workflowInstanceId: targetStage.workflowInstanceId,
      },
      ipAddress: null,
      userAgent: null,
      severity: "warning",
    }).catch((err) => {
      logger.warn({ err }, "CompactionWatcher: failed to emit audit event");
    });

    // Emit LiveEvent
    publishLiveEvent({
      companyId,
      type: "compaction.detected" as LiveEventType,
      payload: {
        snapshotId: snapshot.id,
        stageId: targetStage.id,
        agentId,
        workflowInstanceId: targetStage.workflowInstanceId,
        detectionPattern: detectionResult.pattern,
      },
    });

    publishLiveEvent({
      companyId,
      type: "compaction.snapshot_created" as LiveEventType,
      payload: { snapshotId: snapshot.id, stageId: targetStage.id, agentId },
    });

    logger.info(
      { companyId, stageId: targetStage.id, agentId, pattern: detectionResult.pattern, snapshotId: snapshot.id },
      "CompactionWatcher: compaction detected, snapshot created",
    );
  }

  // ========================================================
  // detectCompaction — pattern matching
  // ========================================================
  function detectCompaction(
    message: string,
    patterns: string[],
  ): { pattern: string; message: string } | null {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, "i");
      if (regex.test(message)) {
        return { pattern, message };
      }
    }
    return null;
  }

  // ========================================================
  // createSnapshot — build and persist a compaction snapshot to DB
  // ========================================================
  async function createSnapshot(
    companyId: string,
    stage: typeof stageInstances.$inferSelect,
    agentId: string,
    detectionPattern: string,
    detectionMessage: string,
  ): Promise<CompactionSnapshot> {
    // Get recovery artifacts from previous completed stages
    const previousArtifacts = await enforcer.getStageArtifacts(stage.workflowInstanceId);
    const completedArtifacts = previousArtifacts.filter(
      (a) => a.stageOrder < stage.stageOrder,
    );

    // Read prePromptsInjected from stage
    const prePromptsInjected = stage.prePromptsInjected as import("@mnm/shared").PrePromptPayload | null;

    const snapshot: CompactionSnapshot = {
      id: randomUUID(),
      companyId,
      workflowInstanceId: stage.workflowInstanceId,
      stageId: stage.id,
      agentId,
      stageOrder: stage.stageOrder,
      detectedAt: new Date().toISOString(),
      detectionPattern,
      detectionMessage,
      previousArtifacts: completedArtifacts,
      prePromptsInjected: prePromptsInjected ?? null,
      outputArtifactsSoFar: (stage.outputArtifacts as string[]) ?? [],
      strategy: "kill_relaunch", // default strategy
      status: "pending",
      resolvedAt: null,
      relaunchCount: 0,
      maxRelaunchCount: 3,
      metadata: {},
    };

    // comp-s02-persist-snapshot-to-db: persist to DB instead of in-memory
    await killRelaunch.persistSnapshot(companyId, snapshot);

    return snapshot;
  }

  // --- Public API ---
  return {
    startWatching,
    stopWatching,
    getWatcherStatus,
    getSnapshots,
    getSnapshotById,
    onHeartbeatEvent,
  };
}
