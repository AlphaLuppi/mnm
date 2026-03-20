export const AUDIT_ACTOR_TYPES = ["user", "agent", "system"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_SEVERITY_LEVELS = ["info", "warning", "error", "critical"] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITY_LEVELS)[number];

export const AUDIT_TARGET_TYPES = [
  "agent", "project", "workflow", "issue", "company",
  "member", "permission", "invite", "container", "secret",
  "stage", "approval", "chat_channel", "sso_config",
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

// Full catalog of audit actions (OBS-S02).
// Actions follow the pattern {domain}.{action}.
export const AUDIT_ACTIONS = [
  // Access & auth
  "access.denied", "access.scope_denied", "access.login", "access.logout",
  "access.invite_created", "access.invite_accepted",
  "access.join_request_approved", "access.join_request_rejected",
  "access.member_permissions_updated", "access.member_role_changed", "access.member_removed",
  // Agent lifecycle
  "agent.created", "agent.hired", "agent.updated", "agent.deleted",
  "agent.launched", "agent.stopped",
  "agent.woken", "agent.permissions_changed", "agent.instructions_changed",
  "agent.config_rollback", "agent.session_reset", "agent.key_created", "agent.claude_login",
  // Approval
  "approval.created", "approval.approved", "approval.rejected",
  "approval.revision_requested", "approval.resubmitted",
  // Asset
  "asset.uploaded",
  // Company
  "company.created", "company.updated", "company.archived", "company.deleted",
  "company.exported", "company.imported", "company.config_change",
  // Cost
  "cost.budget_updated", "cost.agent_budget_updated",
  // Goal
  "goal.created", "goal.updated", "goal.deleted",
  // Issue
  "issue.created", "issue.updated", "issue.deleted",
  "issue.checked_out", "issue.released",
  "issue.label_created", "issue.label_deleted",
  "issue.attachment_added", "issue.attachment_deleted",
  // Member management (legacy)
  "members.invite", "members.remove", "members.role_changed", "members.status_changed",
  // Orchestrator
  "orchestrator.stage_transitioned", "orchestrator.stage_approved", "orchestrator.stage_rejected",
  // Project
  "project.created", "project.updated", "project.deleted",
  "project.workspace_created", "project.workspace_updated", "project.workspace_deleted",
  "project.onboarded",
  "project.member_added", "project.member_removed", "project.member_role_changed",
  // Project membership
  "project_membership.added", "project_membership.updated", "project_membership.removed",
  // Secret
  "secret.created", "secret.rotated", "secret.updated", "secret.deleted",
  // Stage
  "stage.transitioned",
  // Workflow
  "workflow.template_created", "workflow.template_updated", "workflow.template_deleted",
  "workflow.instance_created", "workflow.instance_updated", "workflow.instance_deleted",
  "workflow.created", "workflow.transition", "workflow.transition_denied",
  // Container
  "container.created", "container.stopped", "container.killed",
  // Security
  "security.path_traversal", "security.credential_access", "security.rate_limited",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number] | string; // extensible

export interface AuditEventInput {
  companyId: string;
  actorId: string;
  actorType: AuditActorType;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: AuditSeverity;
}

export interface AuditEvent {
  id: string;
  companyId: string;
  actorId: string;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: string;
  prevHash: string | null;
  createdAt: Date;
}

export interface AuditListResult {
  data: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditVerifyResult {
  valid: boolean;
  eventsChecked: number;
  firstEventId: string | null;
  lastEventId: string | null;
  brokenAt?: string;
}

// OBS-S03: Audit summary types (obs-s03-types)

export const AUDIT_SUMMARY_PERIODS = ["1h", "6h", "12h", "24h", "7d", "30d"] as const;
export type AuditSummaryPeriod = (typeof AUDIT_SUMMARY_PERIODS)[number];

export const AUDIT_SUMMARY_SOURCES = ["llm", "fallback"] as const;
export type AuditSummarySource = (typeof AUDIT_SUMMARY_SOURCES)[number];

export interface AuditSummaryStats {
  totalEvents: number;
  topActions: Array<{ action: string; count: number }>;
  eventsByDomain: Record<string, number>;
  eventsBySeverity: Record<string, number>;
}

export interface AuditSummary {
  id: string;
  companyId: string;
  title: string;
  body: string;
  stats: AuditSummaryStats;
  period: AuditSummaryPeriod;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  source: AuditSummarySource;
}
