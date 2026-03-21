/**
 * COMP-S02: Kill+Relaunch — Compaction Recovery Service
 *
 * When a compaction is detected (COMP-S01), this service can:
 * 1. Kill the compacted agent's container
 * 2. Relaunch a fresh container with recovery context (previous artifacts + pre-prompts)
 * 3. Track relaunch count with a circuit breaker (max 3 relaunches per snapshot)
 * 4. Persist compaction snapshots to DB (replaces COMP-S01 in-memory store)
 *
 * Dependencies: COMP-S01 (CompactionWatcher), CONT-S01 (ContainerManager)
 */

import type { Db } from "@mnm/db";
import { compactionSnapshots } from "@mnm/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import type {
  CompactionSnapshot,
  CompactionSnapshotStatus,
  KillRelaunchResult,
  RelaunchHistoryEntry,
  RelaunchHistoryFilters,
  LiveEventType,
  ReinjectionResult,
} from "@mnm/shared";
import { orchestratorService } from "./orchestrator.js";
import { auditService } from "./audit.js";
import { publishLiveEvent } from "./live-events.js";
import { logger } from "../middleware/logger.js";
// comp-s03-auto-reinject-import
import { compactionReinjectionService } from "./compaction-reinjection.js";

// comp-s02-kill-relaunch-service
export function compactionKillRelaunchService(db: Db) {
  const orchestrator = orchestratorService(db);
  const audit = auditService(db);
  // comp-s03-auto-reinject-flag
  let reinjection: ReturnType<typeof compactionReinjectionService> | null = null;
  function getReinjection() {
    if (!reinjection) {
      reinjection = compactionReinjectionService(db);
    }
    return reinjection;
  }

  // ========================================================
  // comp-s02-execute-kill-relaunch
  // Main kill+relaunch orchestration
  // ========================================================
  async function executeKillRelaunch(
    companyId: string,
    snapshotId: string,
    actorId: string,
    // comp-s03-auto-reinject-flag
    options?: { maxRelaunchCount?: number; autoReinject?: boolean },
  ): Promise<KillRelaunchResult> {
    // 1. Load snapshot from DB
    const snapshot = await getSnapshotFromDb(companyId, snapshotId);
    if (!snapshot) {
      return { success: false, snapshotId, reason: "snapshot_not_found" };
    }

    // comp-s02-circuit-breaker-check
    // 2. Check circuit breaker
    const maxRelaunch = options?.maxRelaunchCount ?? snapshot.maxRelaunchCount;
    if (snapshot.relaunchCount >= maxRelaunch) {
      // comp-s02-circuit-breaker-trigger
      logger.warn(
        { companyId, snapshotId, relaunchCount: snapshot.relaunchCount, maxRelaunch },
        "CompactionKillRelaunch: circuit breaker triggered",
      );

      // Transition stage to paused
      try {
        await orchestrator.transitionStage(
          snapshot.stageId,
          "pause",
          { actorId: "compaction-kill-relaunch", actorType: "system", companyId },
          { metadata: { reason: "circuit_breaker", snapshotId, relaunchCount: snapshot.relaunchCount } },
        );
      } catch (err) {
        logger.error({ err, snapshotId }, "CompactionKillRelaunch: failed to pause stage on circuit breaker");
      }

      // Update snapshot to failed
      await updateSnapshotStatus(snapshotId, "failed", {
        circuitBreakerTriggered: true,
        relaunchCount: snapshot.relaunchCount,
        maxRelaunchCount: maxRelaunch,
      });

      // Emit audit
      audit.emit({
        companyId,
        actorId: "compaction-kill-relaunch",
        actorType: "system",
        action: "compaction.circuit_breaker_triggered",
        targetType: "stage",
        targetId: snapshot.stageId,
        metadata: { snapshotId, relaunchCount: snapshot.relaunchCount, maxRelaunch },
        ipAddress: null,
        userAgent: null,
        severity: "critical",
      }).catch((err) => {
        logger.warn({ err }, "CompactionKillRelaunch: failed to emit circuit breaker audit");
      });

      // comp-s02-live-circuit-breaker
      publishLiveEvent({
        companyId,
        type: "compaction.circuit_breaker_triggered" as LiveEventType,
        payload: { snapshotId, stageId: snapshot.stageId, agentId: snapshot.agentId, relaunchCount: snapshot.relaunchCount },
      });

      return { success: false, snapshotId, reason: "circuit_breaker", relaunchCount: snapshot.relaunchCount };
    }

    // 3. Update snapshot to processing
    await updateSnapshotStatus(snapshotId, "processing");

    // comp-s02-audit-kill-started
    audit.emit({
      companyId,
      actorId,
      actorType: "system",
      action: "compaction.kill_started",
      targetType: "stage",
      targetId: snapshot.stageId,
      metadata: { snapshotId, agentId: snapshot.agentId },
      ipAddress: null,
      userAgent: null,
      severity: "warning",
    }).catch((err) => {
      logger.warn({ err }, "CompactionKillRelaunch: failed to emit kill_started audit");
    });

    // comp-s02-live-kill-started
    publishLiveEvent({
      companyId,
      type: "compaction.kill_started" as LiveEventType,
      payload: { snapshotId, stageId: snapshot.stageId, agentId: snapshot.agentId },
    });

    // comp-s02-container-stop (legacy container system removed — no-op)
    logger.info({ companyId, snapshotId }, "CompactionKillRelaunch: container stop skipped (legacy container system removed)");

    // comp-s02-container-relaunch (legacy container system removed — stub)
    // The old container manager is no longer available. Mark the snapshot as failed
    // since we cannot relaunch without the legacy container system.
    logger.warn({ companyId, snapshotId }, "CompactionKillRelaunch: relaunch skipped (legacy container system removed)");
    await updateSnapshotStatus(snapshotId, "failed", { reason: "legacy_container_system_removed" });
    return { success: false, snapshotId, reason: "relaunch_failed" };
  }

  // ========================================================
  // comp-s02-get-relaunch-count
  // ========================================================
  async function getRelaunchCount(
    companyId: string,
    agentId: string,
    workflowInstanceId: string,
  ): Promise<number> {
    const rows = await db
      .select({ relaunchCount: compactionSnapshots.relaunchCount })
      .from(compactionSnapshots)
      .where(
        and(
          eq(compactionSnapshots.companyId, companyId),
          eq(compactionSnapshots.agentId, agentId),
          eq(compactionSnapshots.workflowInstanceId, workflowInstanceId),
        ),
      )
      .orderBy(desc(compactionSnapshots.createdAt))
      .limit(1);

    return rows[0]?.relaunchCount ?? 0;
  }

  // ========================================================
  // comp-s02-get-relaunch-history
  // ========================================================
  async function getRelaunchHistory(
    companyId: string,
    filters?: RelaunchHistoryFilters,
  ): Promise<RelaunchHistoryEntry[]> {
    const conditions = [eq(compactionSnapshots.companyId, companyId)];

    if (filters?.agentId) {
      conditions.push(eq(compactionSnapshots.agentId, filters.agentId));
    }
    if (filters?.workflowInstanceId) {
      conditions.push(eq(compactionSnapshots.workflowInstanceId, filters.workflowInstanceId));
    }
    if (filters?.status) {
      conditions.push(eq(compactionSnapshots.status, filters.status));
    }

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;

    const rows = await db
      .select()
      .from(compactionSnapshots)
      .where(and(...conditions))
      .orderBy(desc(compactionSnapshots.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      snapshotId: row.id,
      companyId: row.companyId,
      workflowInstanceId: row.workflowInstanceId,
      stageId: row.stageId,
      agentId: row.agentId,
      stageOrder: row.stageOrder,
      strategy: row.strategy as CompactionSnapshot["strategy"],
      status: row.status as CompactionSnapshotStatus,
      relaunchCount: row.relaunchCount,
      maxRelaunchCount: row.maxRelaunchCount,
      detectedAt: row.detectedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    }));
  }

  // ========================================================
  // comp-s02-persist-snapshot
  // Save a CompactionSnapshot to the database
  // ========================================================
  async function persistSnapshot(
    companyId: string,
    snapshot: CompactionSnapshot,
  ): Promise<void> {
    await db.insert(compactionSnapshots).values({
      id: snapshot.id,
      companyId,
      workflowInstanceId: snapshot.workflowInstanceId,
      stageId: snapshot.stageId,
      agentId: snapshot.agentId,
      stageOrder: snapshot.stageOrder,
      detectedAt: new Date(snapshot.detectedAt),
      detectionPattern: snapshot.detectionPattern,
      detectionMessage: snapshot.detectionMessage,
      previousArtifacts: snapshot.previousArtifacts as unknown as Record<string, unknown>,
      prePromptsInjected: snapshot.prePromptsInjected as unknown as Record<string, unknown> | null,
      outputArtifactsSoFar: snapshot.outputArtifactsSoFar as unknown as Record<string, unknown>,
      strategy: snapshot.strategy,
      status: snapshot.status,
      resolvedAt: snapshot.resolvedAt ? new Date(snapshot.resolvedAt) : null,
      relaunchCount: snapshot.relaunchCount ?? 0,
      maxRelaunchCount: snapshot.maxRelaunchCount ?? 3,
      metadata: (snapshot.metadata ?? {}) as Record<string, unknown>,
    });
  }

  // ========================================================
  // comp-s02-update-snapshot-status
  // ========================================================
  async function updateSnapshotStatus(
    snapshotId: string,
    status: CompactionSnapshotStatus,
    additionalMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "resolved") {
      updates.resolvedAt = new Date();
    }

    if (additionalMetadata) {
      // Merge with existing metadata
      const [existing] = await db
        .select({ metadata: compactionSnapshots.metadata })
        .from(compactionSnapshots)
        .where(eq(compactionSnapshots.id, snapshotId));

      const existingMeta = (existing?.metadata ?? {}) as Record<string, unknown>;
      updates.metadata = { ...existingMeta, ...additionalMetadata };
    }

    await db
      .update(compactionSnapshots)
      .set(updates)
      .where(eq(compactionSnapshots.id, snapshotId));
  }

  // ========================================================
  // comp-s02-get-snapshot-from-db
  // ========================================================
  async function getSnapshotFromDb(
    companyId: string,
    snapshotId: string,
  ): Promise<CompactionSnapshot | null> {
    const [row] = await db
      .select()
      .from(compactionSnapshots)
      .where(
        and(
          eq(compactionSnapshots.id, snapshotId),
          eq(compactionSnapshots.companyId, companyId),
        ),
      );

    if (!row) return null;

    return dbRowToSnapshot(row);
  }

  // ========================================================
  // comp-s02-list-snapshots-from-db
  // ========================================================
  async function listSnapshotsFromDb(
    companyId: string,
    filters?: {
      stageId?: string;
      agentId?: string;
      status?: CompactionSnapshotStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<CompactionSnapshot[]> {
    const conditions = [eq(compactionSnapshots.companyId, companyId)];

    if (filters?.stageId) {
      conditions.push(eq(compactionSnapshots.stageId, filters.stageId));
    }
    if (filters?.agentId) {
      conditions.push(eq(compactionSnapshots.agentId, filters.agentId));
    }
    if (filters?.status) {
      conditions.push(eq(compactionSnapshots.status, filters.status));
    }

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;

    const rows = await db
      .select()
      .from(compactionSnapshots)
      .where(and(...conditions))
      .orderBy(desc(compactionSnapshots.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map(dbRowToSnapshot);
  }

  // ---- Helper: convert DB row to CompactionSnapshot ----
  function dbRowToSnapshot(row: typeof compactionSnapshots.$inferSelect): CompactionSnapshot {
    return {
      id: row.id,
      companyId: row.companyId,
      workflowInstanceId: row.workflowInstanceId,
      stageId: row.stageId,
      agentId: row.agentId,
      stageOrder: row.stageOrder,
      detectedAt: row.detectedAt.toISOString(),
      detectionPattern: row.detectionPattern,
      detectionMessage: row.detectionMessage,
      previousArtifacts: (row.previousArtifacts ?? []) as CompactionSnapshot["previousArtifacts"],
      prePromptsInjected: (row.prePromptsInjected ?? null) as CompactionSnapshot["prePromptsInjected"],
      outputArtifactsSoFar: (row.outputArtifactsSoFar ?? []) as string[],
      strategy: row.strategy as CompactionSnapshot["strategy"],
      status: row.status as CompactionSnapshotStatus,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      relaunchCount: row.relaunchCount,
      maxRelaunchCount: row.maxRelaunchCount,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    };
  }

  // --- Public API ---
  return {
    executeKillRelaunch,
    getRelaunchCount,
    getRelaunchHistory,
    persistSnapshot,
    updateSnapshotStatus,
    getSnapshotFromDb,
    listSnapshotsFromDb,
  };
}
