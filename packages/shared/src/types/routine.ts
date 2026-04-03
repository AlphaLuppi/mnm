export const ROUTINE_STATUSES = ["active", "paused", "archived"] as const;
export type RoutineStatus = (typeof ROUTINE_STATUSES)[number];

export const ROUTINE_CONCURRENCY_POLICIES = ["coalesce_if_active", "skip_if_active", "always_enqueue"] as const;
export type RoutineConcurrencyPolicy = (typeof ROUTINE_CONCURRENCY_POLICIES)[number];

export const ROUTINE_CATCH_UP_POLICIES = ["skip_missed", "enqueue_missed_with_cap"] as const;
export type RoutineCatchUpPolicy = (typeof ROUTINE_CATCH_UP_POLICIES)[number];

export const ROUTINE_VARIABLE_TYPES = ["text", "textarea", "number", "boolean", "select"] as const;
export type RoutineVariableType = (typeof ROUTINE_VARIABLE_TYPES)[number];

export const ROUTINE_TRIGGER_KINDS = ["schedule", "webhook", "api"] as const;
export type RoutineTriggerKind = (typeof ROUTINE_TRIGGER_KINDS)[number];

export const ROUTINE_TRIGGER_SIGNING_MODES = ["bearer", "hmac_sha256"] as const;
export type RoutineTriggerSigningMode = (typeof ROUTINE_TRIGGER_SIGNING_MODES)[number];

export const ROUTINE_RUN_SOURCES = ["schedule", "manual", "api", "webhook"] as const;
export type RoutineRunSource = (typeof ROUTINE_RUN_SOURCES)[number];

export const ROUTINE_RUN_STATUSES = ["received", "issue_created", "skipped", "coalesced", "completed", "failed"] as const;
export type RoutineRunStatus = (typeof ROUTINE_RUN_STATUSES)[number];

export interface RoutineVariable {
  name: string;
  label: string | null;
  type: RoutineVariableType;
  defaultValue: string | number | boolean | null;
  required: boolean;
  options: string[];
}

export interface Routine {
  id: string;
  companyId: string;
  projectId: string | null;
  goalId: string | null;
  parentIssueId: string | null;
  title: string;
  description: string | null;
  assigneeAgentId: string;
  priority: string;
  status: RoutineStatus;
  concurrencyPolicy: RoutineConcurrencyPolicy;
  catchUpPolicy: RoutineCatchUpPolicy;
  variables: RoutineVariable[];
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  lastTriggeredAt: string | null;
  lastEnqueuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineTrigger {
  id: string;
  companyId: string;
  routineId: string;
  kind: RoutineTriggerKind;
  label: string | null;
  enabled: boolean;
  cronExpression: string | null;
  timezone: string | null;
  nextRunAt: string | null;
  publicId: string | null;
  signingMode: RoutineTriggerSigningMode | null;
  replayWindowSec: number | null;
  lastFiredAt: string | null;
  lastResult: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineRun {
  id: string;
  companyId: string;
  routineId: string;
  triggerId: string | null;
  source: RoutineRunSource;
  status: RoutineRunStatus;
  triggeredAt: string;
  idempotencyKey: string | null;
  triggerPayload: Record<string, unknown>;
  linkedIssueId: string | null;
  coalescedIntoRunId: string | null;
  failureReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineListItem extends Routine {
  triggers: RoutineTrigger[];
  lastRun: RoutineRun | null;
  activeIssueId: string | null;
}

export interface RoutineDetail extends Routine {
  triggers: RoutineTrigger[];
  recentRuns: RoutineRun[];
  activeIssueId: string | null;
}
