export type DriftSeverity = "critical" | "moderate" | "minor";
export type DriftType = "scope_expansion" | "approach_change" | "design_deviation";
export type DriftRecommendation = "update_spec" | "recenter_code";
export type DriftDecision = "accepted" | "rejected" | "pending";

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
}

export interface DriftReport {
  id: string;
  projectId: string;
  sourceDoc: string;
  targetDoc: string;
  drifts: DriftItem[];
  checkedAt: string;
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
