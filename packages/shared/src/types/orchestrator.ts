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
