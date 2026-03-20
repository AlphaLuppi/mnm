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
// DASH-S01: Dashboard API types
export {
  DASHBOARD_PERIODS,
  DASHBOARD_BREAKDOWN_CATEGORIES,
  K_ANONYMITY_THRESHOLD,
} from "./dashboard.js";
export type {
  DashboardPeriod,
  DashboardBreakdownCategory,
  DashboardKpis,
  DashboardTimelinePoint,
  DashboardTimeline,
  DashboardBreakdownItem,
  DashboardBreakdown,
} from "./dashboard.js";
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
  DriftReportStatus,
  DriftItem,
  DriftReport,
  DriftCheckRequest,
  DriftResolveRequest,
  DriftScanRequest,
  DriftScanStatus,
  DriftReportFilters,
  DriftItemFilters,
  // DRIFT-S02: Drift monitor types
  DriftAlertType,
  DriftAlert,
  DriftMonitorConfig,
  DriftMonitorStatus,
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
  RequiredFileDef,
  FileCheckResult,
  EnforcementResult,
  StageArtifact,
  PrePromptPayload,
  HitlDecision,
  HitlValidationRequest,
  PendingValidation,
} from "./orchestrator.js";
export {
  AUDIT_ACTOR_TYPES,
  AUDIT_SEVERITY_LEVELS,
  AUDIT_TARGET_TYPES,
  AUDIT_ACTIONS,
  // obs-s03-barrel-types
  AUDIT_SUMMARY_PERIODS,
  AUDIT_SUMMARY_SOURCES,
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
  // obs-s03-barrel-types
  AuditSummaryPeriod,
  AuditSummarySource,
  AuditSummaryStats,
  AuditSummary,
} from "./audit.js";
export {
  CONTAINER_STATUSES,
  CONTAINER_PROFILE_PRESETS,
  CONTAINER_EVENT_TYPES,
  // cont-s05-export-types
  CONTAINER_NETWORK_MODES,
  CONTAINER_HEALTH_CHECK_STATUSES,
} from "./container.js";
export type {
  ContainerStatus,
  ContainerProfilePreset,
  ContainerResourceUsage,
  ContainerLaunchOptions,
  ContainerLaunchResult,
  ContainerInfo,
  ContainerStopOptions,
  ContainerEventType,
  // cont-s05-export-types
  ContainerNetworkMode,
  ContainerHealthCheckStatus,
  ContainerProfileInfo,
  ContainerInfoFull,
  ContainerProfileUpdate,
  // cont-s04-export-types
  NetworkInfo,
  NetworkCleanupResult,
} from "./container.js";
export type {
  CredentialProxyRule,
  CredentialProxyConfig,
  CredentialProxySecretMapping,
  CredentialProxyStatus,
  CredentialProxyAccessEvent,
  CreateCredentialProxyRuleInput,
  UpdateCredentialProxyRuleInput,
  CredentialProxyTestResult,
} from "./credential-proxy.js";
// cont-s03-barrel-types
export {
  MOUNT_VIOLATION_CODES,
} from "./mount-allowlist.js";
export type {
  MountViolationCode,
  MountViolation,
  MountValidationResult,
  MountValidationBatchResult,
  MountAllowlistUpdatePayload,
  MountValidateRequest,
  MountValidateResponse,
} from "./mount-allowlist.js";
// COMP-S01: Compaction types
// comp-s01-barrel-types
export {
  COMPACTION_STRATEGIES,
  COMPACTION_SNAPSHOT_STATUSES,
} from "./compaction.js";
export type {
  CompactionStrategy,
  CompactionSnapshotStatus,
  CompactionSnapshot,
  CompactionWatcherConfig,
  CompactionWatcherStatus,
  CompactionSnapshotFilters,
  // comp-s02-barrel-types
  KillRelaunchResult,
  RelaunchHistoryEntry,
  RelaunchHistoryFilters,
  // comp-s03-barrel-types
  ReinjectionResult,
  ReinjectionHistoryEntry,
  ReinjectionHistoryFilters,
  RecoveryPrompt,
} from "./compaction.js";
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
  // chat-s03-barrel-types
  ContainerPipeStatus,
  ChatPipeStatus,
  ChatPipeAttachRequest,
} from "./chat-ws.js";
// DUAL-S01: Automation cursor types
// dual-s01-barrel-types
export {
  AUTOMATION_CURSOR_POSITIONS,
  AUTOMATION_CURSOR_LEVELS,
} from "./automation-cursor.js";
export type {
  AutomationCursorPosition,
  AutomationCursorLevel,
  AutomationCursor,
  EffectiveCursor,
  // dual-s03-barrel-types
  CursorEnforcementResult,
} from "./automation-cursor.js";
// A2A-S01: A2A Bus types
// a2a-s01-barrel-types
export {
  A2A_MESSAGE_TYPES,
  A2A_MESSAGE_STATUSES,
  // A2A-S02: Permission types
  // a2a-s02-barrel-types
  A2A_DEFAULT_POLICIES,
  // A2A-S03: Audit A2A
  // a2a-s03-barrel-types
  A2A_AUDIT_ACTIONS,
} from "./a2a.js";
export type {
  A2AMessageType,
  A2AMessageStatus,
  A2AMessage,
  A2AChainInfo,
  A2AStats,
  A2AMessageFilters,
  // A2A-S02: Permission types
  A2ADefaultPolicy,
  A2APermissionRule,
  A2APermissionCheckResult,
  // A2A-S03: Audit A2A type
  A2AAuditAction,
  // A2A-S04: MCP Connector types
  // a2a-s04-barrel-types
  MCP_TRANSPORT_TYPES,
  MCP_AUTH_TYPES,
  MCP_CONNECTOR_STATUSES,
} from "./a2a.js";
export type {
  McpTransportType,
  McpAuthType,
  McpConnectorStatus,
  McpConnector,
  McpTool,
  McpToolInvocationResult,
  McpConnectorTestResult,
  McpConnectorStats,
  McpConnectorFilters,
} from "./a2a.js";
// TRACE-01: Trace types + TRACE-07: Lens types
export {
  TRACE_STATUSES,
  TRACE_OBSERVATION_TYPES,
  TRACE_OBSERVATION_STATUSES,
  // PIPE-03: Gold prompt constants
  GOLD_PROMPT_SCOPES,
} from "./trace.js";
export type {
  TraceStatus,
  TraceObservationType,
  TraceObservationStatus,
  Trace,
  TraceObservation,
  TraceObservationNode,
  TraceWithTree,
  TraceListResult,
  TraceLensScope,
  TraceLens,
  TraceLensResult,
  // PIPE-02: Silver phase types
  TracePhaseType,
  TracePhase,
  // PIPE-03: Gold analysis types
  GoldVerdict,
  TraceGoldPhase,
  TraceGold,
  GoldPromptScope,
  GoldPrompt,
} from "./trace.js";
// SSO-S01: SSO configuration types
// sso-s01-barrel-types
export {
  SSO_PROVIDERS,
  SSO_CONFIG_STATUSES,
} from "./sso.js";
export type {
  SsoProvider,
  SsoConfigStatus,
  SsoConfiguration,
  CreateSsoConfigurationInput,
  UpdateSsoConfigurationInput,
  // sso-s02-barrel-types
  SsoLoginInitiation,
  SsoDiscoverResult,
  SsoAuthResult,
  SsoSamlConfig,
  SsoOidcConfig,
  SsoMetadataSyncResult,
} from "./sso.js";
