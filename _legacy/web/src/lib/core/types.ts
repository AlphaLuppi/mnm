// ── Enums ────────────────────────────────────────────────────

export const AgentStatus = {
  Idle: "idle",
  Pending: "pending",
  Running: "running",
  Paused: "paused",
  Completed: "completed",
  Error: "error",
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const SpecType = {
  ProductBrief: "product_brief",
  Prd: "prd",
  Story: "story",
  Architecture: "architecture",
  Config: "config",
} as const;
export type SpecType = (typeof SpecType)[keyof typeof SpecType];

export const DriftSeverity = {
  Minor: "minor",
  Moderate: "moderate",
  Critical: "critical",
} as const;
export type DriftSeverity = (typeof DriftSeverity)[keyof typeof DriftSeverity];

export const DriftType = {
  ScopeExpansion: "scope_expansion",
  ApproachChange: "approach_change",
  DesignDeviation: "design_deviation",
} as const;
export type DriftType = (typeof DriftType)[keyof typeof DriftType];

export const LockType = {
  Read: "read",
  Write: "write",
} as const;
export type LockType = (typeof LockType)[keyof typeof LockType];

export const UserDecision = {
  Accepted: "accepted",
  Rejected: "rejected",
  Pending: "pending",
} as const;
export type UserDecision = (typeof UserDecision)[keyof typeof UserDecision];

export const WorkflowStage = {
  Prd: "prd",
  Stories: "stories",
  Architecture: "architecture",
  Dev: "dev",
  Test: "test",
  Deploy: "deploy",
} as const;
export type WorkflowStage = (typeof WorkflowStage)[keyof typeof WorkflowStage];

// ── Domain Models ────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  specId: string | null;
  scope: string | null;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Spec {
  id: string;
  filePath: string;
  specType: SpecType;
  title: string | null;
  lastModified: number;
  gitCommitSha: string | null;
  contentHash: string;
  workflowStage: WorkflowStage | null;
  createdAt: number;
  updatedAt: number;
}

export interface DriftDetection {
  id: string;
  agentId: string;
  specId: string;
  severity: DriftSeverity;
  driftType: DriftType;
  summary: string;
  recommendation: string;
  diffContent: string | null;
  userDecision: UserDecision | null;
  decidedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface FileLock {
  id: string;
  filePath: string;
  agentId: string;
  lockType: LockType;
  acquiredAt: number;
  releasedAt: number | null;
}

export interface ImportantFile {
  id: string;
  filePath: string;
  fileType: string;
  detectedAt: number;
  userConfirmed: number;
  createdAt: number;
  updatedAt: number;
}

export interface SpecChange {
  id: string;
  filePath: string;
  oldCommitSha: string | null;
  newCommitSha: string;
  changeSummary: string;
  detectedAt: number;
  userViewed: number;
  createdAt: number;
}
