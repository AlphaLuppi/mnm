export type GovernedRunStatus = "draft" | "active" | "completed" | "failed";
export type GovernedStepState =
  | "pending"
  | "running"
  | "gate_eval"
  | "succeeded"
  | "failed"
  | "cancelled";
export type GateKind = "entry" | "exit" | string;

export interface GovernedWorkflowDefinitionRow {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  latestGitTag: string | null;
  enabled: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GovernedRunRow {
  id: string;
  companyId: string;
  workflowDefId: string;
  workflowGitTag: string;
  workflowGitSha: string;
  initiatedByActorType: "user" | "agent" | "system";
  initiatedByActorId: string;
  status: GovernedRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  paramsJson: Record<string, unknown>;
  cancelledAt: string | null;
  cancelledByActorId: string | null;
  cancelledByActorType: "user" | "agent" | "system" | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GovernedStepExecutionRow {
  id: string;
  companyId: string;
  runId: string;
  stepIdInJson: string;
  state: GovernedStepState;
  startedAt: string | null;
  completedAt: string | null;
  artifactsJson: Record<string, unknown> | null;
  launchedByActorType: "user" | "agent" | "system" | null;
  launchedByActorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GateResultRow {
  id: string;
  companyId: string;
  runId: string;
  stepExecId: string;
  gateIdInJson: string;
  kind: GateKind;
  pass: boolean;
  report: string;
  errorCode: string | null;
  hints: string[];
  gateGitSha: string;
  evaluatedAt: string;
}
