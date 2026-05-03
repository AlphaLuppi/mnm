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
  /** Set when the step launched a client-mode heartbeat_run (session-bundle path). */
  heartbeatRunId: string | null;
  /**
   * T5 — composite (meta-workflow) linkage. Null for non-composite (leaf
   * agent) steps and for composite steps that have not yet expanded.
   *
   * - `parentStepExecutionId` — the step in the PARENT run that triggered
   *   this expansion (set on every step inside a composite sub-run).
   * - `compositeRunId` — set on the composite parent step itself, points
   *   to the sub-run launched by it. The UI uses this to navigate
   *   parent → child and to lazy-load the tree.
   * - `rootRunId` — top-most run in the chain (= the run launched by the
   *   human actor). Propagated downward for O(1) fan-out cap lookups.
   */
  parentStepExecutionId: string | null;
  compositeRunId: string | null;
  rootRunId: string | null;
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
