// Stage states (machine_state column)
export const STAGE_STATES = [
  "created",
  "ready",
  "in_progress",
  "validating",
  "paused",
  "failed",
  "compacting",
  "completed",
  "terminated",
  "skipped",
] as const;
export type StageState = (typeof STAGE_STATES)[number];

// Workflow-level states
export const WORKFLOW_STATES = [
  "draft",
  "active",
  "paused",
  "completed",
  "failed",
  "terminated",
] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];

// Stage events (sent to the state machine)
export const STAGE_EVENTS = [
  "initialize",
  "start",
  "request_validation",
  "complete",
  "pause",
  "fail",
  "compact_detected",
  "approve",
  "reject_with_feedback",
  "resume",
  "retry",
  "terminate",
  "reinjected",
  "compaction_failed",
  "skip",
] as const;
export type StageEvent = (typeof STAGE_EVENTS)[number];

// Context for each stage machine instance
export interface StageContext {
  stageId: string;
  workflowInstanceId: string;
  companyId: string;
  stageOrder: number;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  lastActorId: string | null;
  lastActorType: "user" | "agent" | "system" | null;
  feedback: string | null;
  outputArtifacts: string[];
  transitionHistory: TransitionRecord[];
}

export interface TransitionRecord {
  from: StageState;
  to: StageState;
  event: StageEvent;
  actorId: string | null;
  actorType: "user" | "agent" | "system" | null;
  timestamp: string; // ISO 8601
  metadata?: Record<string, unknown>;
}

// Orchestrator event emitted for audit
export interface OrchestratorEvent {
  type: string; // "stage.started", "stage.completed", etc.
  companyId: string;
  workflowInstanceId: string;
  stageId: string;
  fromState: StageState;
  toState: StageState;
  event: StageEvent;
  actorId: string | null;
  actorType: "user" | "agent" | "system" | null;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ORCH-S03: HITL (Human-In-The-Loop) types

/** Decision record for a HITL approval or rejection */
export interface HitlDecision {
  decision: "approved" | "rejected";
  actorId: string;
  actorType: "user" | "agent" | "system";
  comment?: string;    // optional comment (approve)
  feedback?: string;   // mandatory feedback (reject)
  decidedAt: string;   // ISO 8601
}

/** Request emitted when a stage enters the validating state */
export interface HitlValidationRequest {
  stageId: string;
  workflowInstanceId: string;
  stageName: string;
  workflowName: string;
  hitlRoles: string[];
  requestedAt: string;     // ISO 8601
  requestedBy: {
    actorId: string | null;
    actorType: "user" | "agent" | "system";
  };
  outputArtifacts: string[];
}

/** Pending validation returned by listPendingValidations() */
export interface PendingValidation {
  stageId: string;
  stageName: string;
  workflowInstanceId: string;
  workflowName: string;
  requestedAt: string;     // ISO 8601
  hitlRoles: string[];
  outputArtifacts: string[];
  hitlHistory: HitlDecision[];
  rejectCount: number;
}

// ORCH-S02: WorkflowEnforcer types

/** Definition of a required file that must exist before a stage transition */
export interface RequiredFileDef {
  /** Glob pattern or relative path of the required file */
  path: string;
  /** Human-readable description of the expected file */
  description: string;
  /** Verification mode */
  checkMode: "artifact" | "filesystem" | "both";
  /** If true, missing file blocks the transition. If false, warning only */
  blocking: boolean;
}

/** Result of checking a single required file */
export interface FileCheckResult {
  path: string;
  description: string;
  found: boolean;
  checkMode: "artifact" | "filesystem" | "both";
  blocking: boolean;
}

/** Result of an enforcement check on a stage transition */
export interface EnforcementResult {
  /** Timestamp of the check */
  checkedAt: string; // ISO 8601
  /** Overall result */
  passed: boolean;
  /** Individual file check results */
  fileChecks: FileCheckResult[];
  /** Missing blocking files */
  missingFiles: string[];
  /** Warnings for non-blocking missing files */
  warnings: string[];
  /** Actor who triggered the check */
  triggeredBy: {
    actorId: string | null;
    actorType: "user" | "agent" | "system";
  };
}

/** Artifacts produced by a completed stage */
export interface StageArtifact {
  stageId: string;
  stageName: string;
  stageOrder: number;
  outputArtifacts: string[];
  completedAt: string | null; // ISO 8601
}

/** Pre-prompt payload injected when a stage starts */
export interface PrePromptPayload {
  /** Pre-prompts defined in the template for this stage */
  stagePrePrompts: string[];
  /** Artifacts from previous completed stages */
  previousArtifacts: StageArtifact[];
  /** Acceptance criteria for this stage */
  acceptanceCriteria: string[];
  /** Stage name for reference */
  stageName: string;
  /** Workflow name for reference */
  workflowName: string;
  /** Stage order (0-based) */
  stageOrder: number;
  /** Total number of stages in the workflow */
  totalStages: number;
}
