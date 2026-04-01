import { Navigate, Outlet, Route, Routes, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { authApi } from "./api/auth";
import { healthApi } from "./api/health";
import { Dashboard } from "./pages/Dashboard";
import { Drift } from "./pages/Drift";
import { Companies } from "./pages/Companies";
import { Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Issues } from "./pages/Issues";
import { IssueDetail } from "./pages/IssueDetail";
import { Goals } from "./pages/Goals";
import { GoalDetail } from "./pages/GoalDetail";
import { Approvals } from "./pages/Approvals";
import { ApprovalDetail } from "./pages/ApprovalDetail";
import { Costs } from "./pages/Costs";
import { Activity } from "./pages/Activity";
import { Inbox } from "./pages/Inbox";
import { CompanySettings } from "./pages/CompanySettings";
import { DesignGuide } from "./pages/DesignGuide";
import { OrgChart } from "./pages/OrgChart";
import { NewAgent } from "./pages/NewAgent";
import { Workflows } from "./pages/Workflows";
import { WorkflowDetail } from "./pages/WorkflowDetail";
import { NewWorkflow } from "./pages/NewWorkflow";
import { WorkflowEditor } from "./pages/WorkflowEditor";
import { Members } from "./pages/Members";
import AdminRoles from "./pages/AdminRoles";
import { AdminTags } from "./pages/AdminTags";
import { AuditLog } from "./pages/AuditLog";
import { Containers } from "./pages/Containers";
import { Chat } from "./pages/Chat";
import { AutomationCursors } from "./pages/AutomationCursors";
import { SsoConfig } from "./pages/SsoConfig";
import { JiraImport } from "./pages/JiraImport";
import { Traces } from "./pages/Traces";
import { TraceDetail } from "./pages/TraceDetail";
import { TraceTimelineDemo } from "./pages/TraceTimelineDemo";
import { TraceSettings } from "./pages/TraceSettings";
import { WorkflowTraces } from "./pages/WorkflowTraces";
// POD-06: Workspace page (deprecated — auth moved to Settings > Claude)
// import { Workspace } from "./pages/Workspace";
// DEPLOY-06: Deployments page
import { Deployments } from "./pages/Deployments";
import { AuthPage } from "./pages/Auth";
import { BoardClaimPage } from "./pages/BoardClaim";
import { InviteLandingPage } from "./pages/InviteLanding";
import { RequirePermission } from "./components/RequirePermission";
import { queryKeys } from "./lib/queryKeys";
import { useCompany } from "./context/CompanyContext";

// SANDBOX-AUTH-AUTOBOOTSTRAP: no more CLI bootstrap page
// First user signup auto-promotes to instance_admin via Better Auth databaseHooks

function CloudAccessGate() {
  const location = useLocation();
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  const isAuthenticatedMode = healthQuery.data?.deploymentMode === "authenticated";
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: isAuthenticatedMode,
    retry: false,
  });

  if (healthQuery.isLoading || (isAuthenticatedMode && sessionQuery.isLoading)) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  if (healthQuery.error) {
    return (
      <div className="mx-auto max-w-xl py-10 text-sm text-destructive">
        {healthQuery.error instanceof Error ? healthQuery.error.message : "Failed to load app state"}
      </div>
    );
  }

  // SANDBOX-AUTH-AUTOBOOTSTRAP: bootstrap_pending → redirect to signup (first user auto-promoted)
  if (isAuthenticatedMode && healthQuery.data?.bootstrapStatus === "bootstrap_pending") {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  if (isAuthenticatedMode && !sessionQuery.data) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <Outlet />;
}

function boardRoutes() {
  return (
    <>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="companies" element={<Companies />} />
      <Route path="members" element={<RequirePermission permission="users:invite" showForbidden><Members /></RequirePermission>} />
      <Route path="admin/roles" element={<RequirePermission permission="users:manage_permissions" showForbidden><AdminRoles /></RequirePermission>} />
      <Route path="admin/tags" element={<RequirePermission permission="users:manage_permissions" showForbidden><AdminTags /></RequirePermission>} />
      <Route path="admin/sso" element={<RequirePermission permission="company:manage_sso" showForbidden><SsoConfig /></RequirePermission>} />
      <Route path="company/settings" element={<RequirePermission permission="company:manage_settings" showForbidden><CompanySettings /></RequirePermission>} />
      <Route path="org" element={<OrgChart />} />
      <Route path="agents" element={<Navigate to="/agents/all" replace />} />
      <Route path="agents/all" element={<Agents />} />
      <Route path="agents/active" element={<Agents />} />
      <Route path="agents/paused" element={<Agents />} />
      <Route path="agents/error" element={<Agents />} />
      <Route path="agents/new" element={<RequirePermission permission="agents:create" showForbidden><NewAgent /></RequirePermission>} />
      <Route path="agents/:agentId" element={<AgentDetail />} />
      <Route path="agents/:agentId/:tab" element={<AgentDetail />} />
      <Route path="agents/:agentId/runs/:runId" element={<AgentDetail />} />
      <Route path="projects" element={<Projects />} />
      <Route path="projects/:projectId" element={<ProjectDetail />} />
      <Route path="projects/:projectId/overview" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues/:filter" element={<ProjectDetail />} />
      <Route path="projects/:projectId/cockpit" element={<ProjectDetail />} />
      <Route path="projects/:projectId/agents" element={<ProjectDetail />} />
      <Route path="projects/:projectId/workflows" element={<ProjectDetail />} />
      <Route path="projects/:projectId/settings" element={<ProjectDetail />} />
      <Route path="projects/:projectId/drift" element={<ProjectDetail />} />
      <Route path="projects/:projectId/access" element={<ProjectDetail />} />
      <Route path="issues" element={<Issues />} />
      <Route path="issues/all" element={<Navigate to="/issues" replace />} />
      <Route path="issues/active" element={<Navigate to="/issues" replace />} />
      <Route path="issues/backlog" element={<Navigate to="/issues" replace />} />
      <Route path="issues/done" element={<Navigate to="/issues" replace />} />
      <Route path="issues/recent" element={<Navigate to="/issues" replace />} />
      <Route path="issues/:issueId" element={<IssueDetail />} />
      <Route path="workflows" element={<RequirePermission permission="workflows:create" showForbidden><Workflows /></RequirePermission>} />
      <Route path="workflows/new" element={<RequirePermission permission="workflows:create" showForbidden><NewWorkflow /></RequirePermission>} />
      <Route path="workflows/:workflowId" element={<RequirePermission permission="workflows:create" showForbidden><WorkflowDetail /></RequirePermission>} />
      <Route path="workflow-editor/:templateId" element={<RequirePermission permission="workflows:create" showForbidden><WorkflowEditor /></RequirePermission>} />
      <Route path="goals" element={<RequirePermission permission="projects:create" showForbidden><Goals /></RequirePermission>} />
      <Route path="goals/:goalId" element={<RequirePermission permission="projects:create" showForbidden><GoalDetail /></RequirePermission>} />
      <Route path="approvals" element={<RequirePermission permission="joins:approve" showForbidden><Navigate to="/approvals/pending" replace /></RequirePermission>} />
      <Route path="approvals/pending" element={<RequirePermission permission="joins:approve" showForbidden><Approvals /></RequirePermission>} />
      <Route path="approvals/all" element={<RequirePermission permission="joins:approve" showForbidden><Approvals /></RequirePermission>} />
      <Route path="approvals/:approvalId" element={<RequirePermission permission="joins:approve" showForbidden><ApprovalDetail /></RequirePermission>} />
      <Route path="costs" element={<RequirePermission permission="dashboard:view" showForbidden><Costs /></RequirePermission>} />
      <Route path="activity" element={<RequirePermission permission="audit:read" showForbidden><Activity /></RequirePermission>} />
      <Route path="audit" element={<RequirePermission permission="audit:read" showForbidden><AuditLog /></RequirePermission>} />
      <Route path="containers" element={<RequirePermission permission="agents:manage_containers" showForbidden><Containers /></RequirePermission>} />
      {/* workspace route removed — auth via Settings > Claude */}
      <Route path="deployments" element={<RequirePermission permission="agents:launch" showForbidden><Deployments /></RequirePermission>} />
      <Route path="chat" element={<RequirePermission permission="chat:agent" showForbidden><Chat /></RequirePermission>} />
      <Route path="automation-cursors" element={<RequirePermission permission="workflows:enforce" showForbidden><AutomationCursors /></RequirePermission>} />
      <Route path="import/jira" element={<RequirePermission permission="projects:manage" showForbidden><JiraImport /></RequirePermission>} />
      <Route path="traces" element={<RequirePermission permission="audit:read" showForbidden><Traces /></RequirePermission>} />
      <Route path="traces/demo" element={<TraceTimelineDemo />} />
      <Route path="traces/:traceId" element={<RequirePermission permission="audit:read" showForbidden><TraceDetail /></RequirePermission>} />
      <Route path="settings/trace-lenses" element={<RequirePermission permission="audit:read" showForbidden><TraceSettings /></RequirePermission>} />
      <Route path="workflows/:workflowId/traces" element={<RequirePermission permission="audit:read" showForbidden><WorkflowTraces /></RequirePermission>} />
      <Route path="inbox" element={<Navigate to="/inbox/new" replace />} />
      <Route path="inbox/new" element={<Inbox />} />
      <Route path="inbox/all" element={<Inbox />} />
      <Route path="design-guide" element={<DesignGuide />} />
    </>
  );
}

function CompanyRootRedirect() {
  const { companies, selectedCompany, loading } = useCompany();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  if (companies.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to={`/${targetCompany.issuePrefix}/dashboard`} replace />;
}

function UnprefixedBoardRedirect() {
  const location = useLocation();
  const { companies, selectedCompany, loading } = useCompany();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <Navigate
      to={`/${targetCompany.issuePrefix}${location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="auth" element={<AuthPage />} />
        <Route path="board-claim/:token" element={<BoardClaimPage />} />
        <Route path="invite/:token" element={<InviteLandingPage />} />

        <Route element={<CloudAccessGate />}>
          <Route index element={<CompanyRootRedirect />} />
          <Route path="dashboard" element={<UnprefixedBoardRedirect />} />
          <Route path="companies" element={<UnprefixedBoardRedirect />} />
          <Route path="issues" element={<UnprefixedBoardRedirect />} />
          <Route path="issues/:issueId" element={<UnprefixedBoardRedirect />} />
          <Route path="agents" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/new" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/:tab" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/runs/:runId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/overview" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/cockpit" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/agents" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/workflows" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/settings" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/access" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/issues" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/issues/:filter" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/drift" element={<UnprefixedBoardRedirect />} />
          <Route path="members" element={<UnprefixedBoardRedirect />} />
          <Route path="admin/roles" element={<UnprefixedBoardRedirect />} />
          <Route path="admin/tags" element={<UnprefixedBoardRedirect />} />
          <Route path="admin/sso" element={<UnprefixedBoardRedirect />} />
          <Route path="company/settings" element={<UnprefixedBoardRedirect />} />
          <Route path="audit" element={<UnprefixedBoardRedirect />} />
          <Route path="containers" element={<UnprefixedBoardRedirect />} />
          <Route path="approvals" element={<UnprefixedBoardRedirect />} />
          <Route path="approvals/pending" element={<UnprefixedBoardRedirect />} />
          <Route path="approvals/all" element={<UnprefixedBoardRedirect />} />
          <Route path="approvals/:approvalId" element={<UnprefixedBoardRedirect />} />
          <Route path="chat" element={<UnprefixedBoardRedirect />} />
          <Route path="workflows" element={<UnprefixedBoardRedirect />} />
          <Route path="workflows/new" element={<UnprefixedBoardRedirect />} />
          <Route path="workflows/:workflowId" element={<UnprefixedBoardRedirect />} />
          <Route path="workflow-editor/:templateId" element={<UnprefixedBoardRedirect />} />
          <Route path="goals" element={<UnprefixedBoardRedirect />} />
          <Route path="goals/:goalId" element={<UnprefixedBoardRedirect />} />
          <Route path="automation-cursors" element={<UnprefixedBoardRedirect />} />
          <Route path="inbox" element={<UnprefixedBoardRedirect />} />
          <Route path="inbox/:tab" element={<UnprefixedBoardRedirect />} />
          <Route path="org" element={<UnprefixedBoardRedirect />} />
          <Route path="traces" element={<UnprefixedBoardRedirect />} />
          <Route path="traces/:traceId" element={<UnprefixedBoardRedirect />} />
          <Route path="settings/trace-lenses" element={<UnprefixedBoardRedirect />} />
          <Route path="design-guide" element={<UnprefixedBoardRedirect />} />
          <Route path="onboarding" element={<OnboardingWizard />} />
          <Route path=":companyPrefix" element={<Layout />}>
            {boardRoutes()}
          </Route>
        </Route>
      </Routes>
    </>
  );
}
