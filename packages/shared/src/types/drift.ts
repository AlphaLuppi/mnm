export type DriftSeverity = "critical" | "moderate" | "minor";
export type DriftType = "scope_expansion" | "approach_change" | "design_deviation";
export type DriftRecommendation = "update_spec" | "recenter_code";
export type DriftDecision = "accepted" | "rejected" | "pending";
export type DriftReportStatus = "in_progress" | "completed" | "failed" | "cancelled";

// DRIFT-S02: Drift monitor types

/** Types of deviations detected by the drift monitor */
export type DriftAlertType =
  | "time_exceeded"       // stage exceeds max duration
  | "stagnation"          // no activity for too long
  | "retry_excessive"     // too many retries
  | "stage_skipped"       // stage skipped without execution
  | "sequence_violation"; // stage started out of sequence

/** Enriched drift alert (API view) */
export interface DriftAlert {
  id: string;
  companyId: string;
  projectId: string;
  workflowInstanceId: string;
  stageId: string;
  alertType: DriftAlertType;
  severity: DriftSeverity;
  message: string;
  /** Additional metadata (duration, retryCount, etc.) */
  metadata: Record<string, unknown>;
  /** Resolution status */
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: "acknowledged" | "ignored" | "remediated";
  resolutionNote?: string;
  createdAt: string;
}

/** Drift monitor configuration */
export interface DriftMonitorConfig {
  /** Max duration per stage before alert (ms). Default: 900_000 (15 min) */
  defaultStageTimeoutMs: number;
  /** Duration without activity before stagnation (ms). Default: 1_800_000 (30 min) */
  stagnationTimeoutMs: number;
  /** Retry threshold before alert. Default: 2 */
  retryAlertThreshold: number;
  /** Periodic check interval (ms). Default: 60_000 (1 min) */
  checkIntervalMs: number;
  /** Monitoring active. Default: true */
  enabled: boolean;
}

/** Monitoring status for a company */
export interface DriftMonitorStatus {
  /** Monitoring active for this company */
  active: boolean;
  /** Number of active unresolved alerts */
  activeAlertCount: number;
  /** Monitoring start time */
  startedAt: string | null;
  /** Last check time */
  lastCheckAt: string | null;
  /** Current configuration */
  config: DriftMonitorConfig;
}

export interface DriftItem {
  id: string;
  severity: DriftSeverity;
  driftType: DriftType;
  confidence: number;
  description: string;
  recommendation: DriftRecommendation;
  sourceExcerpt: string;
  targetExcerpt: string;
  sourceDoc: string;
  targetDoc: string;
  decision: DriftDecision;
  decidedAt?: string;
  remediationNote?: string;
  // New fields (DRIFT-S01)
  reportId?: string;
  companyId?: string;
  decidedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriftReport {
  id: string;
  projectId: string;
  sourceDoc: string;
  targetDoc: string;
  drifts: DriftItem[];
  checkedAt: string;
  // New fields (DRIFT-S01)
  companyId?: string;
  driftCount?: number;
  status?: DriftReportStatus;
  scanScope?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface DriftCheckRequest {
  sourceDoc: string;
  targetDoc: string;
}

export interface DriftResolveRequest {
  decision: "accepted" | "rejected";
  remediationNote?: string;
}

/** Request to trigger a full drift scan across planning artifacts */
export interface DriftScanRequest {
  /** Specific artifact path to scan, or "all" for full scan */
  scope: string;
}

/** Status of an ongoing or completed drift scan */
export interface DriftScanStatus {
  /** Whether a scan is currently running */
  scanning: boolean;
  /** Current progress message (e.g., "Analyzing spec 3/5") */
  progress: string | null;
  /** Number of artifact pairs completed */
  completed: number;
  /** Total number of artifact pairs to scan */
  total: number;
  /** ISO timestamp of last completed scan */
  lastScanAt: string | null;
  /** Number of drift issues found in last scan */
  lastScanIssueCount: number | null;
}

/** Filters for listing drift reports with pagination */
export interface DriftReportFilters {
  companyId: string;
  projectId?: string;
  status?: string;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

/** Filters for listing drift items with pagination */
export interface DriftItemFilters {
  companyId: string;
  reportId?: string;
  severity?: DriftSeverity;
  decision?: DriftDecision;
  driftType?: DriftType;
  limit?: number;
  offset?: number;
}
