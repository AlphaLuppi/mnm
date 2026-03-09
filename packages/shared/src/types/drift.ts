export type DriftSeverity = "critical" | "moderate" | "minor";

export interface DriftItem {
  id: string;
  severity: DriftSeverity;
  confidence: number;
  description: string;
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
