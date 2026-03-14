export type { Company } from "./company.js";
export type {
  Agent,
  AgentPermissions,
  AgentKeyCreated,
  AgentConfigRevision,
  AdapterEnvironmentCheckLevel,
  AdapterEnvironmentTestStatus,
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestResult,
} from "./agent.js";
export type { AssetImage } from "./asset.js";
export type { Project, ProjectGoalRef, ProjectWorkspace } from "./project.js";
export type {
  Issue,
  IssueAssigneeAdapterOverrides,
  IssueComment,
  IssueAncestor,
  IssueAncestorProject,
  IssueAncestorGoal,
  IssueAttachment,
  IssueLabel,
} from "./issue.js";
export type { Goal } from "./goal.js";
export type { Approval, ApprovalComment } from "./approval.js";
export type {
  SecretProvider,
  SecretVersionSelector,
  EnvPlainBinding,
  EnvSecretRefBinding,
  EnvBinding,
  AgentEnvConfig,
  CompanySecret,
  SecretProviderDescriptor,
} from "./secrets.js";
export type { CostEvent, CostSummary, CostByAgent } from "./cost.js";
export type {
  HeartbeatRun,
  HeartbeatRunEvent,
  AgentRuntimeState,
  AgentTaskSession,
  AgentWakeupRequest,
} from "./heartbeat.js";
export type { LiveEvent } from "./live.js";
export type { DashboardSummary } from "./dashboard.js";
export type { ActivityEvent } from "./activity.js";
export type { SidebarBadges } from "./sidebar-badges.js";
export type {
  CompanyMembership,
  PrincipalPermissionGrant,
  Invite,
  JoinRequest,
  InstanceUserRoleGrant,
} from "./access.js";
export type {
  WorkspaceTask,
  AcceptanceCriterion,
  ContextNodeDetail,
  ContextNode,
  WorkspaceStory,
  WorkspaceEpic,
  WorkspaceStep,
  PlanningArtifact,
  SprintStatus,
  WorkspaceContext,
} from "./workspace-context.js";

// Legacy aliases — kept for backward compatibility during migration
export type {
  WorkspaceTask as BmadTask,
  AcceptanceCriterion as BmadAcceptanceCriterion,
  WorkspaceStory as BmadStory,
  WorkspaceEpic as BmadEpic,
  PlanningArtifact as BmadPlanningArtifact,
  SprintStatus as BmadSprintStatus,
  WorkspaceContext as BmadProject,
} from "./workspace-context.js";
export type {
  CompanyPortabilityInclude,
  CompanyPortabilitySecretRequirement,
  CompanyPortabilityCompanyManifestEntry,
  CompanyPortabilityAgentManifestEntry,
  CompanyPortabilityManifest,
  CompanyPortabilityExportResult,
  CompanyPortabilitySource,
  CompanyPortabilityImportTarget,
  CompanyPortabilityAgentSelection,
  CompanyPortabilityCollisionStrategy,
  CompanyPortabilityPreviewRequest,
  CompanyPortabilityPreviewAgentPlan,
  CompanyPortabilityPreviewResult,
  CompanyPortabilityImportRequest,
  CompanyPortabilityImportResult,
  CompanyPortabilityExportRequest,
} from "./company-portability.js";
export type {
  DriftSeverity,
  DriftType,
  DriftRecommendation,
  DriftDecision,
  DriftItem,
  DriftReport,
  DriftCheckRequest,
  DriftResolveRequest,
  DriftScanRequest,
  DriftScanStatus,
} from "./drift.js";
export {
  STAGE_STATES,
  WORKFLOW_STATES,
  STAGE_EVENTS,
} from "./orchestrator.js";
export type {
  StageState,
  WorkflowState,
  StageEvent,
  StageContext,
  TransitionRecord,
  OrchestratorEvent,
} from "./orchestrator.js";
export {
  AUDIT_ACTOR_TYPES,
  AUDIT_SEVERITY_LEVELS,
  AUDIT_TARGET_TYPES,
  AUDIT_ACTIONS,
} from "./audit.js";
export type {
  AuditActorType,
  AuditSeverity,
  AuditTargetType,
  AuditAction,
  AuditEventInput,
  AuditEvent,
  AuditListResult,
  AuditVerifyResult,
} from "./audit.js";
export type {
  ChatChannelStatus,
  ChatSenderType,
  ChatMessageType,
  ChatClientMessage,
  ChatClientTyping,
  ChatClientSync,
  ChatClientPing,
  ChatClientPayload,
  ChatServerMessage,
  ChatServerAck,
  ChatServerTyping,
  ChatServerSync,
  ChatServerError,
  ChatServerPong,
  ChatServerChannelClosed,
  ChatServerPayload,
} from "./chat-ws.js";
