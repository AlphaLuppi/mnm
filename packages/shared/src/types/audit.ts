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

// Non-exhaustive list — actions are extensible strings.
// OBS-S02 will define the full catalog when integrating into 22 route files.
export const AUDIT_ACTIONS = [
  // Member management
  "members.invite", "members.remove", "members.role_changed", "members.status_changed",
  // Access
  "access.denied", "access.scope_denied", "access.login", "access.logout",
  // Company config
  "company.config_change", "company.created",
  // Agent lifecycle
  "agent.created", "agent.launched", "agent.stopped", "agent.deleted",
  // Workflow
  "workflow.created", "workflow.transition", "workflow.transition_denied",
  // Project
  "project.member_added", "project.member_removed", "project.member_role_changed",
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
