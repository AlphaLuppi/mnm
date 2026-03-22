export const queryKeys = {
  companies: {
    all: ["companies"] as const,
    detail: (id: string) => ["companies", id] as const,
    stats: ["companies", "stats"] as const,
  },
  agents: {
    list: (companyId: string) => ["agents", companyId] as const,
    listForWorkspace: (companyId: string, workspaceId: string) =>
      ["agents", companyId, "workspace", workspaceId] as const,
    listAll: (companyId: string) => ["agents", companyId, "all"] as const,
    detail: (id: string) => ["agents", "detail", id] as const,
    runtimeState: (id: string) => ["agents", "runtime-state", id] as const,
    taskSessions: (id: string) => ["agents", "task-sessions", id] as const,
    keys: (agentId: string) => ["agents", "keys", agentId] as const,
    configRevisions: (agentId: string) => ["agents", "config-revisions", agentId] as const,
    adapterModels: (companyId: string, adapterType: string) =>
      ["agents", companyId, "adapter-models", adapterType] as const,
  },
  issues: {
    list: (companyId: string) => ["issues", companyId] as const,
    search: (companyId: string, q: string, projectId?: string) =>
      ["issues", companyId, "search", q, projectId ?? "__all-projects__"] as const,
    listAssignedToMe: (companyId: string) => ["issues", companyId, "assigned-to-me"] as const,
    listTouchedByMe: (companyId: string) => ["issues", companyId, "touched-by-me"] as const,
    listUnreadTouchedByMe: (companyId: string) => ["issues", companyId, "unread-touched-by-me"] as const,
    labels: (companyId: string) => ["issues", companyId, "labels"] as const,
    listByProject: (companyId: string, projectId: string) =>
      ["issues", companyId, "project", projectId] as const,
    detail: (id: string) => ["issues", "detail", id] as const,
    comments: (issueId: string) => ["issues", "comments", issueId] as const,
    attachments: (issueId: string) => ["issues", "attachments", issueId] as const,
    activity: (issueId: string) => ["issues", "activity", issueId] as const,
    runs: (issueId: string) => ["issues", "runs", issueId] as const,
    approvals: (issueId: string) => ["issues", "approvals", issueId] as const,
    liveRuns: (issueId: string) => ["issues", "live-runs", issueId] as const,
    activeRun: (issueId: string) => ["issues", "active-run", issueId] as const,
  },
  projects: {
    list: (companyId: string) => ["projects", companyId] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
  },
  goals: {
    list: (companyId: string) => ["goals", companyId] as const,
    detail: (id: string) => ["goals", "detail", id] as const,
  },
  workflows: {
    list: (companyId: string) => ["workflows", companyId] as const,
    detail: (id: string) => ["workflows", "detail", id] as const,
    templates: (companyId: string) => ["workflow-templates", companyId] as const,
  },
  approvals: {
    list: (companyId: string, status?: string) =>
      ["approvals", companyId, status] as const,
    detail: (approvalId: string) => ["approvals", "detail", approvalId] as const,
    comments: (approvalId: string) => ["approvals", "comments", approvalId] as const,
    issues: (approvalId: string) => ["approvals", "issues", approvalId] as const,
  },
  access: {
    joinRequests: (companyId: string, status: string = "pending_approval") =>
      ["access", "join-requests", companyId, status] as const,
    invite: (token: string) => ["access", "invite", token] as const,
    members: (companyId: string) => ["access", "members", companyId] as const,
    myPermissions: (companyId: string) =>
      ["access", "my-permissions", companyId] as const,
    rbacPresets: (companyId: string) =>
      ["access", "rbac-presets", companyId] as const,
  },
  auth: {
    session: ["auth", "session"] as const,
  },
  health: ["health"] as const,
  secrets: {
    list: (companyId: string) => ["secrets", companyId] as const,
    providers: (companyId: string) => ["secret-providers", companyId] as const,
  },
  dashboard: Object.assign(
    (companyId: string) => ["dashboard", companyId] as const,
    {
      // DASH-S02: Enriched dashboard query keys
      kpis: (companyId: string) =>
        ["dashboard", companyId, "kpis"] as const,
      timeline: (companyId: string, period?: string) =>
        ["dashboard", companyId, "timeline", period] as const,
      breakdown: (companyId: string, category?: string) =>
        ["dashboard", companyId, "breakdown", category] as const,
    },
  ),
  sidebarBadges: (companyId: string) => ["sidebar-badges", companyId] as const,
  activity: (companyId: string) => ["activity", companyId] as const,
  costs: (companyId: string, from?: string, to?: string) =>
    ["costs", companyId, from, to] as const,
  heartbeats: (companyId: string, agentId?: string) =>
    ["heartbeats", companyId, agentId] as const,
  liveRuns: (companyId: string) => ["live-runs", companyId] as const,
  runIssues: (runId: string) => ["run-issues", runId] as const,
  workspaceContext: {
    project: (projectId: string) => ["workspace-context", "project", projectId] as const,
    file: (projectId: string, filePath: string) => ["workspace-context", "file", projectId, filePath] as const,
  },
  drift: {
    results: (projectId: string) => ["drift", "results", projectId] as const,
    check: (projectId: string) => ["drift", "check", projectId] as const,
    status: (projectId: string) => ["drift", "status", projectId] as const,
    // DRIFT-S03: execution alerts
    alerts: (companyId: string, filters?: Record<string, unknown>) =>
      ["drift", "alerts", companyId, filters] as const,
    monitoringStatus: (companyId: string) =>
      ["drift", "monitoring-status", companyId] as const,
  },
  org: (companyId: string) => ["org", companyId] as const,
  projectMemberships: {
    list: (companyId: string, projectId: string) =>
      ["project-memberships", companyId, projectId] as const,
  },
  audit: {
    list: (companyId: string, filters?: Record<string, unknown>) =>
      ["audit", companyId, "list", filters] as const,
    detail: (companyId: string, eventId: string) =>
      ["audit", companyId, "detail", eventId] as const,
    count: (companyId: string, filters?: Record<string, unknown>) =>
      ["audit", companyId, "count", filters] as const,
    verify: (companyId: string) =>
      ["audit", companyId, "verify"] as const,
  },
  // CHAT-S04: chat UI
  chat: {
    channels: (companyId: string, filters?: Record<string, unknown>) =>
      ["chat", companyId, "channels", filters] as const,
    detail: (companyId: string, channelId: string) =>
      ["chat", companyId, "detail", channelId] as const,
    messages: (companyId: string, channelId: string) =>
      ["chat", companyId, "messages", channelId] as const,
    pipeStatus: (companyId: string, channelId: string) =>
      ["chat", companyId, "pipe-status", channelId] as const,
  },
  // DUAL-S02: automation cursors UI
  automationCursors: {
    list: (companyId: string, filters?: Record<string, unknown>) =>
      ["automation-cursors", companyId, "list", filters] as const,
    detail: (companyId: string, cursorId: string) =>
      ["automation-cursors", companyId, "detail", cursorId] as const,
    resolve: (companyId: string, body?: Record<string, unknown>) =>
      ["automation-cursors", companyId, "resolve", body] as const,
  },
  // SSO-S03: SSO configuration UI
  sso: {
    list: (companyId: string) =>
      ["sso", companyId, "list"] as const,
    detail: (companyId: string, configId: string) =>
      ["sso", companyId, "detail", configId] as const,
  },
  roles: {
    list: (companyId: string) => ["roles", companyId] as const,
    detail: (companyId: string, roleId: string) =>
      ["roles", companyId, "detail", roleId] as const,
  },
  tags: {
    list: (companyId: string, includeArchived?: boolean) =>
      ["tags", companyId, "list", includeArchived] as const,
    detail: (companyId: string, tagId: string) =>
      ["tags", companyId, "detail", tagId] as const,
  },
  // ONB-S01: onboarding tracking
  onboarding: {
    status: (companyId: string) =>
      ["onboarding", companyId, "status"] as const,
  },
  // ONB-S03: jira import
  jiraImport: {
    jobs: (companyId: string) =>
      ["jiraImport", companyId, "jobs"] as const,
    jobDetail: (companyId: string, jobId: string) =>
      ["jiraImport", companyId, "detail", jobId] as const,
  },
  // TRACE-09: Trace Vision UI
  traces: {
    list: (companyId: string, filters?: Record<string, unknown>) =>
      ["traces", companyId, "list", filters] as const,
    detail: (companyId: string, traceId: string) =>
      ["traces", companyId, "detail", traceId] as const,
    byRunId: (companyId: string, runId: string) =>
      ["traces", companyId, "by-run", runId] as const,
    byWorkflow: (companyId: string, workflowInstanceId: string) =>
      ["traces", companyId, "workflow", workflowInstanceId] as const,
  },
  // POD-06: Per-User Sandboxes UI (renamed from pods)
  sandboxes: {
    my: (companyId: string) =>
      ["sandboxes", companyId, "my"] as const,
    list: (companyId: string) =>
      ["sandboxes", companyId, "list"] as const,
  },
  // DEPLOY-06: Artifact Deployments UI
  deployments: {
    list: (companyId: string, filters?: Record<string, unknown>) =>
      ["deployments", companyId, "list", filters] as const,
    detail: (companyId: string, deploymentId: string) =>
      ["deployments", companyId, "detail", deploymentId] as const,
    byIssue: (companyId: string, issueId: string) =>
      ["deployments", companyId, "by-issue", issueId] as const,
  },
  // TRACE-09: Lens analysis
  lenses: {
    list: (companyId: string) =>
      ["lenses", companyId, "list"] as const,
    result: (companyId: string, lensId: string, traceId: string) =>
      ["lenses", companyId, "result", lensId, traceId] as const,
    costEstimate: (companyId: string, traceId: string) =>
      ["lenses", companyId, "cost-estimate", traceId] as const,
  },
};
