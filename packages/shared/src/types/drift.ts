export type DriftSeverity = "critical" | "moderate" | "minor";
export type DriftType = "scope_expansion" | "approach_change" | "design_deviation";
export type DriftRecommendation = "update_spec" | "recenter_code";

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
