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
// Stage-based drift checks removed (legacy workflows nuked in U1).
// Only getDriftAlerts and resolveAlert remain functional.
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
      visibility: { scope: "company-wide" },
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
      visibility: { scope: "company-wide" },
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
  // onStageEvent — no-op after legacy workflow nuke (U1)
  // ========================================================
  async function onStageEvent(
    _companyId: string,
    _event: LiveEvent,
  ): Promise<void> {
    // Legacy stage-based drift detection removed.
  }

  // ========================================================
  // checkStageDrift — no-op after legacy workflow nuke (U1)
  // ========================================================
  async function checkStageDrift(
    _companyId: string,
    _event: OrchestratorEvent,
    _config: DriftMonitorConfig,
  ): Promise<void> {
    // Legacy stage-based drift detection removed.
  }

  // ========================================================
  // checkWorkflowTimeDrift — no-op after legacy workflow nuke (U1)
  // ========================================================
  async function checkWorkflowTimeDrift(
    companyId: string,
    _config: DriftMonitorConfig,
  ): Promise<void> {
    const monitor = monitors.get(companyId);
    if (monitor) {
      monitor.lastCheckAt = new Date().toISOString();
    }
    // Legacy stage-based time drift detection removed.
  }

  // ========================================================
  // createDriftAlert — no-op after legacy workflow nuke (U1)
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
    void params;
    // Legacy stage-based alert creation removed (U1 nuke).
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
      visibility: { scope: "company-wide" },
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
