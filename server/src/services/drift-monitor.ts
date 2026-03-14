/**
 * DRIFT-S02: Drift Monitor Service
 *
 * Active drift monitor that observes orchestrator stage transitions in real-time
 * via LiveEvents, detects deviations (time exceeded, stagnation, retry excessive,
 * stage skipped, sequence violation), creates persistent alerts via drift-persistence,
 * and emits WebSocket notifications.
 *
 * Event-driven: stage_skipped, sequence_violation, retry_excessive are detected
 * on transition events. time_exceeded and stagnation use a periodic check (60s).
 */

import type { Db } from "@mnm/db";
import { stageInstances } from "@mnm/db";
import { eq, and, asc } from "drizzle-orm";
import type {
  DriftAlertType,
  DriftAlert,
  DriftMonitorConfig,
  DriftMonitorStatus,
  DriftSeverity,
  OrchestratorEvent,
  LiveEvent,
} from "@mnm/shared";
import { publishLiveEvent, subscribeCompanyLiveEvents } from "./live-events.js";
import { driftPersistenceService } from "./drift-persistence.js";
import { auditService } from "./audit.js";
import { logger } from "../middleware/logger.js";

// --- Default configuration ---

const DEFAULT_CONFIG: DriftMonitorConfig = {
  defaultStageTimeoutMs: 15 * 60 * 1000,  // 15 min
  stagnationTimeoutMs: 30 * 60 * 1000,    // 30 min
  retryAlertThreshold: 2,
  checkIntervalMs: 60 * 1000,             // 1 min
  enabled: true,
};

// --- In-memory state ---

/** Deduplication: stageId -> Set<alertType> to prevent duplicate alerts */
const activeAlertTracker = new Map<string, Set<string>>();

/** Active monitoring subscriptions by companyId */
const monitors = new Map<string, {
  unsubscribe: () => void;
  intervalId: ReturnType<typeof setInterval>;
  startedAt: string;
  lastCheckAt: string | null;
  config: DriftMonitorConfig;
}>();

// --- Helpers ---

function dedupKey(stageId: string, alertType: DriftAlertType): boolean {
  const existing = activeAlertTracker.get(stageId);
  if (existing?.has(alertType)) return true; // already alerted
  return false;
}

function markAlerted(stageId: string, alertType: DriftAlertType): void {
  let set = activeAlertTracker.get(stageId);
  if (!set) {
    set = new Set();
    activeAlertTracker.set(stageId, set);
  }
  set.add(alertType);
}

function clearStageAlerts(stageId: string): void {
  activeAlertTracker.delete(stageId);
}

/** Map severity from drift alert to audit severity */
function toAuditSeverity(severity: DriftSeverity): "warning" | "error" {
  return severity === "critical" ? "error" : "warning";
}

// --- Service factory ---

export function driftMonitorService(db: Db) {
  const persistence = driftPersistenceService(db);
  const audit = auditService(db);

  // ========================================================
  // startMonitoring
  // ========================================================
  async function startMonitoring(
    companyId: string,
    config?: Partial<DriftMonitorConfig>,
  ): Promise<DriftMonitorStatus> {
    // If already monitoring, stop first
    if (monitors.has(companyId)) {
      await stopMonitoring(companyId);
    }

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Subscribe to stage events via LiveEvents (non-blocking, event-driven)
    const unsubscribe = subscribeCompanyLiveEvents(companyId, (event: LiveEvent) => {
      if (event.type.startsWith("stage.")) {
        onStageEvent(companyId, event).catch((err) => {
          logger.error({ err, companyId }, "Drift monitor: error processing stage event");
        });
      }
    });

    // Start periodic time drift check (for time_exceeded and stagnation)
    const intervalId = setInterval(() => {
      checkWorkflowTimeDrift(companyId, mergedConfig).catch((err) => {
        logger.error({ err, companyId }, "Drift monitor: error in periodic check");
      });
    }, mergedConfig.checkIntervalMs);

    const now = new Date().toISOString();
    monitors.set(companyId, {
      unsubscribe,
      intervalId,
      startedAt: now,
      lastCheckAt: null,
      config: mergedConfig,
    });

    publishLiveEvent({
      companyId,
      type: "drift.monitoring_started",
      payload: { companyId, config: mergedConfig },
    });

    logger.info({ companyId }, "Drift monitoring started");

    return getMonitoringStatus(companyId);
  }

  // ========================================================
  // stopMonitoring
  // ========================================================
  async function stopMonitoring(companyId: string): Promise<void> {
    const monitor = monitors.get(companyId);
    if (!monitor) return;

    monitor.unsubscribe();
    clearInterval(monitor.intervalId);
    monitors.delete(companyId);

    publishLiveEvent({
      companyId,
      type: "drift.monitoring_stopped",
      payload: { companyId },
    });

    logger.info({ companyId }, "Drift monitoring stopped");
  }

  // ========================================================
  // getMonitoringStatus
  // ========================================================
  function getMonitoringStatus(companyId: string): DriftMonitorStatus {
    const monitor = monitors.get(companyId);

    // Count active (non-resolved) alerts for the company from the dedup tracker
    let activeAlertCount = 0;
    for (const set of activeAlertTracker.values()) {
      activeAlertCount += set.size;
    }

    if (!monitor) {
      return {
        active: false,
        activeAlertCount,
        startedAt: null,
        lastCheckAt: null,
        config: DEFAULT_CONFIG,
      };
    }

    return {
      active: true,
      activeAlertCount,
      startedAt: monitor.startedAt,
      lastCheckAt: monitor.lastCheckAt,
      config: monitor.config,
    };
  }

  // ========================================================
  // onStageEvent — handler for stage.* LiveEvents
  // ========================================================
  async function onStageEvent(
    companyId: string,
    event: LiveEvent,
  ): Promise<void> {
    const payload = event.payload as unknown as OrchestratorEvent;
    if (!payload?.stageId || !payload?.workflowInstanceId) return;

    const monitor = monitors.get(companyId);
    if (!monitor) return;

    // Clean up alerts for stages reaching terminal states
    const terminalStates = ["completed", "terminated", "skipped"];
    if (terminalStates.includes(payload.toState) && payload.toState !== "skipped") {
      clearStageAlerts(payload.stageId);
    }

    await checkStageDrift(companyId, payload, monitor.config);
  }

  // ========================================================
  // checkStageDrift — evaluate a single transition for drift
  // ========================================================
  async function checkStageDrift(
    companyId: string,
    event: OrchestratorEvent,
    config: DriftMonitorConfig,
  ): Promise<void> {
    // 1. stage_skipped: stage goes directly to skipped without in_progress
    if (event.toState === "skipped" && event.fromState === "created") {
      await createDriftAlert({
        companyId,
        workflowInstanceId: event.workflowInstanceId,
        stageId: event.stageId,
        alertType: "stage_skipped",
        severity: "minor",
        message: `Stage ${event.stageId} was skipped without being attempted`,
        metadata: { fromState: event.fromState, toState: event.toState, event: event.event },
      });
    }

    // 2. sequence_violation: stage starts while previous not completed
    if (event.event === "start" && event.toState === "in_progress") {
      await checkSequenceViolation(companyId, event);
    }

    // 3. retry_excessive: too many retries
    if (event.event === "retry") {
      await checkRetryExcessive(companyId, event, config);
    }
  }

  // ========================================================
  // checkSequenceViolation
  // ========================================================
  async function checkSequenceViolation(
    companyId: string,
    event: OrchestratorEvent,
  ): Promise<void> {
    // Load all stages for this workflow, ordered by stageOrder
    const stages = await db
      .select()
      .from(stageInstances)
      .where(
        and(
          eq(stageInstances.workflowInstanceId, event.workflowInstanceId),
          eq(stageInstances.companyId, companyId),
        ),
      )
      .orderBy(asc(stageInstances.stageOrder));

    const currentStage = stages.find((s) => s.id === event.stageId);
    if (!currentStage || currentStage.stageOrder === 0) return; // first stage cannot violate

    const previousStage = stages.find((s) => s.stageOrder === currentStage.stageOrder - 1);
    if (!previousStage) return;

    const completedStates = ["completed", "skipped"];
    if (!completedStates.includes(previousStage.machineState)) {
      await createDriftAlert({
        companyId,
        workflowInstanceId: event.workflowInstanceId,
        stageId: event.stageId,
        alertType: "sequence_violation",
        severity: "critical",
        message: `Stage ${currentStage.name} (order ${currentStage.stageOrder}) started while previous stage ${previousStage.name} (order ${previousStage.stageOrder}) is in state "${previousStage.machineState}" (not completed)`,
        metadata: {
          previousStageId: previousStage.id,
          previousStageName: previousStage.name,
          previousStageState: previousStage.machineState,
          currentStageOrder: currentStage.stageOrder,
        },
      });
    }
  }

  // ========================================================
  // checkRetryExcessive
  // ========================================================
  async function checkRetryExcessive(
    companyId: string,
    event: OrchestratorEvent,
    config: DriftMonitorConfig,
  ): Promise<void> {
    // Load the stage to get retryCount
    const stages = await db
      .select()
      .from(stageInstances)
      .where(
        and(
          eq(stageInstances.id, event.stageId),
          eq(stageInstances.companyId, companyId),
        ),
      );

    const stage = stages[0];
    if (!stage) return;

    // retryCount is post-retry (already incremented by orchestrator)
    if (stage.retryCount >= config.retryAlertThreshold) {
      await createDriftAlert({
        companyId,
        workflowInstanceId: event.workflowInstanceId,
        stageId: event.stageId,
        alertType: "retry_excessive",
        severity: "moderate",
        message: `Stage ${stage.name} has retried ${stage.retryCount} times (threshold: ${config.retryAlertThreshold}, max: ${stage.maxRetries})`,
        metadata: {
          retryCount: stage.retryCount,
          maxRetries: stage.maxRetries,
          retryAlertThreshold: config.retryAlertThreshold,
        },
      });
    }
  }

  // ========================================================
  // checkWorkflowTimeDrift — periodic check for time-based drifts
  // ========================================================
  async function checkWorkflowTimeDrift(
    companyId: string,
    config: DriftMonitorConfig,
  ): Promise<void> {
    const monitor = monitors.get(companyId);
    if (monitor) {
      monitor.lastCheckAt = new Date().toISOString();
    }

    // Find all stages in "in_progress" state for this company
    const inProgressStages = await db
      .select()
      .from(stageInstances)
      .where(
        and(
          eq(stageInstances.companyId, companyId),
          eq(stageInstances.machineState, "in_progress"),
        ),
      );

    const now = Date.now();

    for (const stage of inProgressStages) {
      // 1. time_exceeded check
      if (stage.startedAt) {
        const elapsed = now - new Date(stage.startedAt).getTime();
        if (elapsed > config.defaultStageTimeoutMs) {
          await createDriftAlert({
            companyId,
            workflowInstanceId: stage.workflowInstanceId,
            stageId: stage.id,
            alertType: "time_exceeded",
            severity: "moderate",
            message: `Stage ${stage.name} has been in progress for ${Math.round(elapsed / 60_000)} minutes (threshold: ${Math.round(config.defaultStageTimeoutMs / 60_000)} min)`,
            metadata: {
              elapsedMs: elapsed,
              thresholdMs: config.defaultStageTimeoutMs,
              startedAt: stage.startedAt.toISOString(),
            },
          });
        }
      }

      // 2. stagnation check — no transition for too long
      const history = stage.transitionHistory as Array<{ timestamp: string }> | null;
      if (history && history.length > 0) {
        const lastTransition = history[history.length - 1];
        if (lastTransition?.timestamp) {
          const silent = now - new Date(lastTransition.timestamp).getTime();
          if (silent > config.stagnationTimeoutMs) {
            await createDriftAlert({
              companyId,
              workflowInstanceId: stage.workflowInstanceId,
              stageId: stage.id,
              alertType: "stagnation",
              severity: "critical",
              message: `Stage ${stage.name} has had no activity for ${Math.round(silent / 60_000)} minutes (threshold: ${Math.round(config.stagnationTimeoutMs / 60_000)} min)`,
              metadata: {
                silentMs: silent,
                thresholdMs: config.stagnationTimeoutMs,
                lastTransitionAt: lastTransition.timestamp,
              },
            });
          }
        }
      }
    }
  }

  // ========================================================
  // createDriftAlert — create a drift alert with deduplication
  // ========================================================
  async function createDriftAlert(params: {
    companyId: string;
    workflowInstanceId: string;
    stageId: string;
    alertType: DriftAlertType;
    severity: DriftSeverity;
    message: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const { companyId, workflowInstanceId, stageId, alertType, severity, message, metadata } = params;

    // Deduplication: skip if already alerted for this stageId + alertType
    if (dedupKey(stageId, alertType)) {
      return;
    }

    // Look up the stage to get projectId from the workflow instance
    let projectId = "unknown";
    try {
      const stageRows = await db
        .select({ id: stageInstances.id })
        .from(stageInstances)
        .where(eq(stageInstances.id, stageId));
      if (stageRows[0]) {
        // projectId is not directly on stageInstances, derive from workflowInstances
        // For simplicity, use workflowInstanceId as the project context identifier
        projectId = workflowInstanceId;
      }
    } catch {
      // non-critical, continue with default
    }

    // Persist via drift-persistence service
    const report = await persistence.createReport({
      companyId,
      projectId,
      sourceDoc: `workflow:${workflowInstanceId}`,
      targetDoc: `stage:${stageId}`,
      scanScope: "execution_monitor",
      items: [
        {
          severity,
          driftType: alertType,
          confidence: 1.0,
          description: message,
          recommendation: `Review stage ${stageId} for ${alertType} drift`,
          sourceDoc: `workflow:${workflowInstanceId}`,
          targetDoc: `stage:${stageId}`,
        },
      ],
    });

    // Mark as alerted for deduplication
    markAlerted(stageId, alertType);

    const alertPayload = {
      alertId: report.id,
      alertType,
      stageId,
      workflowInstanceId,
      severity,
      companyId,
      message,
    };

    // Emit WebSocket notification
    publishLiveEvent({
      companyId,
      type: "drift.alert_created",
      payload: alertPayload,
    });

    // Emit audit event (non-blocking)
    audit.emit({
      companyId,
      actorId: "drift-monitor",
      actorType: "system",
      action: "drift.alert_created",
      targetType: "stage",
      targetId: stageId,
      metadata: { alertType, severity, workflowInstanceId, stageId, message },
      ipAddress: null,
      userAgent: null,
      severity: toAuditSeverity(severity),
    }).catch((err) => {
      logger.warn({ err }, "Drift monitor: failed to emit audit event for alert creation");
    });

    logger.info(
      { companyId, stageId, alertType, severity, reportId: report.id },
      `Drift alert created: ${alertType}`,
    );
  }

  // ========================================================
  // getDriftAlerts — list alerts for a company
  // ========================================================
  async function getDriftAlerts(
    companyId: string,
    filters?: { severity?: DriftSeverity; limit?: number; offset?: number },
  ): Promise<{ data: DriftAlert[]; total: number }> {
    const result = await persistence.listReports({
      companyId,
      status: "completed",
      limit: filters?.limit,
      offset: filters?.offset,
    });

    // Filter to only execution_monitor reports and map to DriftAlert
    const alerts: DriftAlert[] = [];
    for (const report of result.data) {
      if (report.scanScope !== "execution_monitor") continue;

      const item = report.drifts[0]; // each alert report has exactly 1 item
      if (!item) continue;

      // Filter by severity if requested
      if (filters?.severity && item.severity !== filters.severity) continue;

      const alert: DriftAlert = {
        id: report.id,
        companyId: report.companyId ?? companyId,
        projectId: report.projectId,
        workflowInstanceId: report.sourceDoc.replace("workflow:", ""),
        stageId: report.targetDoc.replace("stage:", ""),
        alertType: item.driftType as DriftAlertType,
        severity: item.severity,
        message: item.description,
        metadata: {
          confidence: item.confidence,
          sourceExcerpt: item.sourceExcerpt,
          targetExcerpt: item.targetExcerpt,
        },
        resolved: item.decision !== "pending",
        resolvedAt: item.decidedAt,
        resolvedBy: item.decidedBy,
        resolution: item.decision === "accepted" ? "acknowledged"
          : item.decision === "rejected" ? "remediated"
          : undefined,
        resolutionNote: item.remediationNote,
        createdAt: report.createdAt ?? report.checkedAt,
      };

      alerts.push(alert);
    }

    return { data: alerts, total: alerts.length };
  }

  // ========================================================
  // resolveAlert — resolve a drift alert
  // ========================================================
  async function resolveAlert(
    companyId: string,
    alertId: string,
    actorId: string,
    resolution: "acknowledged" | "ignored" | "remediated",
    note?: string,
  ): Promise<DriftAlert | null> {
    // Get the report to find the item
    const report = await persistence.getReportById(companyId, alertId);
    if (!report || report.scanScope !== "execution_monitor") return null;

    const item = report.drifts[0];
    if (!item) return null;

    // Map resolution to DriftDecision
    const decision = resolution === "acknowledged" ? "accepted" as const
      : "rejected" as const;

    const updated = await persistence.resolveItem(
      companyId,
      item.id,
      decision,
      actorId,
      note,
    );

    if (!updated) return null;

    // Clear dedup tracker for this stage+alertType
    const stageId = report.targetDoc.replace("stage:", "");
    const alertType = item.driftType as DriftAlertType;
    const stageAlerts = activeAlertTracker.get(stageId);
    if (stageAlerts) {
      stageAlerts.delete(alertType);
      if (stageAlerts.size === 0) {
        activeAlertTracker.delete(stageId);
      }
    }

    // Emit WebSocket notification
    publishLiveEvent({
      companyId,
      type: "drift.alert_resolved",
      payload: {
        alertId,
        stageId,
        alertType,
        resolution,
        actorId,
      },
    });

    // Emit audit event (non-blocking)
    audit.emit({
      companyId,
      actorId,
      actorType: "user",
      action: "drift.alert_resolved",
      targetType: "stage",
      targetId: stageId,
      metadata: { alertType, resolution, note, alertId },
      ipAddress: null,
      userAgent: null,
      severity: "info",
    }).catch((err) => {
      logger.warn({ err }, "Drift monitor: failed to emit audit event for alert resolution");
    });

    logger.info(
      { companyId, alertId, stageId, resolution, actorId },
      "Drift alert resolved",
    );

    // Return the resolved alert
    return {
      id: report.id,
      companyId: report.companyId ?? companyId,
      projectId: report.projectId,
      workflowInstanceId: report.sourceDoc.replace("workflow:", ""),
      stageId,
      alertType,
      severity: updated.severity,
      message: updated.description,
      metadata: {},
      resolved: true,
      resolvedAt: updated.decidedAt,
      resolvedBy: updated.decidedBy,
      resolution,
      resolutionNote: note,
      createdAt: report.createdAt ?? report.checkedAt,
    };
  }

  // --- Public API ---
  return {
    startMonitoring,
    stopMonitoring,
    getMonitoringStatus,
    onStageEvent,
    checkStageDrift,
    checkWorkflowTimeDrift,
    createDriftAlert,
    getDriftAlerts,
    resolveAlert,
  };
}
