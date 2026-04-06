import { Navigate, Outlet, Route, Routes, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { authApi } from "./api/auth";
import { healthApi } from "./api/health";
import { useViewPreset } from "./hooks/useViewPreset";
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
import { ConfigLayersPage } from "./pages/config-layers/ConfigLayersPage";
import { AuditLog } from "./pages/AuditLog";
import { Containers } from "./pages/Containers";
import { Chat } from "./pages/Chat";
import { Folders } from "./pages/Folders";
import { FolderDetail } from "./pages/FolderDetail";
import { FolderWorkspace } from "./pages/FolderWorkspace";
import { SharedChat } from "./pages/SharedChat";
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
// Routines
import { Routines } from "./pages/Routines";
import { RoutineDetail } from "./pages/RoutineDetail";
// Feedback dashboard
import { FeedbackDashboard } from "./pages/FeedbackDashboard";
import { AuthPage } from "./pages/Auth";
import { BoardClaimPage } from "./pages/BoardClaim";
import { InviteLandingPage } from "./pages/InviteLanding";
import { RequirePermission } from "./components/RequirePermission";
import { FullPageLoader } from "./components/FullPageLoader";
import { Button } from "./components/ui/button";
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
    return <FullPageLoader />;
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
      <Route index element={<BoardIndexRedirect />} />
      <Route path="dashboard" element={<RequirePermission permission="dashboard:view" showForbidden><Dashboard /></RequirePermission>} />
      <Route path="companies" element={<Companies />} />
      <Route path="members" element={<RequirePermission permission="users:read" showForbidden><Members /></RequirePermission>} />
      <Route path="admin/roles" element={<RequirePermission permission="roles:read" showForbidden><AdminRoles /></RequirePermission>} />
      <Route path="admin/tags" element={<RequirePermission permission="tags:read" showForbidden><AdminTags /></RequirePermission>} />
      <Route path="admin/sso" element={<RequirePermission permission="company:manage_sso" showForbidden><SsoConfig /></RequirePermission>} />
      <Route path="admin/config-layers" element={<RequirePermission permission="config_layers:read" showForbidden><ConfigLayersPage /></RequirePermission>} />
      <Route path="company/settings" element={<RequirePermission permission="company:manage_settings" showForbidden><CompanySettings /></RequirePermission>} />
      <Route path="org" element={<RequirePermission permission="org:view" showForbidden><OrgChart /></RequirePermission>} />
      <Route path="agents" element={<RequirePermission permission="agents:read" showForbidden><Navigate to="/agents/all" replace /></RequirePermission>} />
      <Route path="agents/all" element={<RequirePermission permission="agents:read" showForbidden><Agents /></RequirePermission>} />
      <Route path="agents/active" element={<RequirePermission permission="agents:read" showForbidden><Agents /></RequirePermission>} />
      <Route path="agents/paused" element={<RequirePermission permission="agents:read" showForbidden><Agents /></RequirePermission>} />
      <Route path="agents/error" element={<RequirePermission permission="agents:read" showForbidden><Agents /></RequirePermission>} />
      <Route path="agents/new" element={<RequirePermission permission="agents:create" showForbidden><NewAgent /></RequirePermission>} />
      <Route path="agents/:agentId" element={<RequirePermission permission="agents:read" showForbidden><AgentDetail /></RequirePermission>} />
      <Route path="agents/:agentId/:tab" element={<RequirePermission permission="agents:read" showForbidden><AgentDetail /></RequirePermission>} />
      <Route path="agents/:agentId/runs/:runId" element={<RequirePermission permission="agents:read" showForbidden><AgentDetail /></RequirePermission>} />
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
      <Route path="issues" element={<RequirePermission permission="issues:read" showForbidden><Issues /></RequirePermission>} />
      <Route path="issues/all" element={<RequirePermission permission="issues:read" showForbidden><Navigate to="/issues" replace /></RequirePermission>} />
      <Route path="issues/active" element={<RequirePermission permission="issues:read" showForbidden><Navigate to="/issues" replace /></RequirePermission>} />
      <Route path="issues/backlog" element={<RequirePermission permission="issues:read" showForbidden><Navigate to="/issues" replace /></RequirePermission>} />
      <Route path="issues/done" element={<RequirePermission permission="issues:read" showForbidden><Navigate to="/issues" replace /></RequirePermission>} />
      <Route path="issues/recent" element={<RequirePermission permission="issues:read" showForbidden><Navigate to="/issues" replace /></RequirePermission>} />
      <Route path="issues/:issueId" element={<RequirePermission permission="issues:read" showForbidden><IssueDetail /></RequirePermission>} />
      <Route path="workflows" element={<RequirePermission permission="workflows:read" showForbidden><Workflows /></RequirePermission>} />
      <Route path="workflows/new" element={<RequirePermission permission="workflows:create" showForbidden><NewWorkflow /></RequirePermission>} />
      <Route path="workflows/:workflowId" element={<RequirePermission permission="workflows:read" showForbidden><WorkflowDetail /></RequirePermission>} />
      <Route path="workflow-editor/:templateId" element={<RequirePermission permission="workflows:create" showForbidden><WorkflowEditor /></RequirePermission>} />
      <Route path="goals" element={<RequirePermission permission="projects:read" showForbidden><Goals /></RequirePermission>} />
      <Route path="goals/:goalId" element={<RequirePermission permission="projects:read" showForbidden><GoalDetail /></RequirePermission>} />
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
      <Route path="chat" element={<RequirePermission permission="chat:read" showForbidden><Chat /></RequirePermission>} />
      <Route path="chat/:channelId" element={<RequirePermission permission="chat:read" showForbidden><Chat /></RequirePermission>} />
      <Route path="folders" element={<RequirePermission permission="folders:read" showForbidden><Folders /></RequirePermission>} />
      <Route path="folders/:folderId" element={<RequirePermission permission="folders:read" showForbidden><FolderDetail /></RequirePermission>} />
      <Route path="folders/:folderId/chat/:channelId" element={<RequirePermission permission="folders:read" showForbidden><FolderWorkspace /></RequirePermission>} />
      <Route path="shared/chat/:token" element={<SharedChat />} />
      <Route path="automation-cursors" element={<RequirePermission permission="workflows:enforce" showForbidden><AutomationCursors /></RequirePermission>} />
      <Route path="import/jira" element={<RequirePermission permission="projects:manage" showForbidden><JiraImport /></RequirePermission>} />
      <Route path="traces" element={<RequirePermission permission="traces:read" showForbidden><Traces /></RequirePermission>} />
      <Route path="traces/demo" element={<TraceTimelineDemo />} />
      <Route path="traces/:traceId" element={<RequirePermission permission="traces:read" showForbidden><TraceDetail /></RequirePermission>} />
      <Route path="settings/trace-lenses" element={<RequirePermission permission="traces:manage" showForbidden><TraceSettings /></RequirePermission>} />
      <Route path="workflows/:workflowId/traces" element={<RequirePermission permission="traces:read" showForbidden><WorkflowTraces /></RequirePermission>} />
      <Route path="routines" element={<RequirePermission permission="routines:read" showForbidden><Routines /></RequirePermission>} />
      <Route path="routines/:id" element={<RequirePermission permission="routines:read" showForbidden><RoutineDetail /></RequirePermission>} />
      <Route path="feedback" element={<RequirePermission permission="feedback:read" showForbidden><FeedbackDashboard /></RequirePermission>} />
      <Route path="inbox" element={<RequirePermission permission="issues:read" showForbidden><Navigate to="/inbox/new" replace /></RequirePermission>} />
      <Route path="inbox/new" element={<RequirePermission permission="issues:read" showForbidden><Inbox /></RequirePermission>} />
      <Route path="inbox/all" element={<RequirePermission permission="issues:read" showForbidden><Inbox /></RequirePermission>} />
      <Route path="design-guide" element={<DesignGuide />} />
    </>
  );
}

function NoCompanyAccessPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="max-w-md text-center px-8">
        <h1 className="text-xl font-semibold">Accès en attente</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Votre compte a bien été créé, mais vous n'avez pas encore été ajouté à une organisation sur cette instance.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Demandez à un administrateur de vous envoyer une invitation.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={async () => {
            await authApi.signOut();
            window.location.href = "/auth";
          }}
        >
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}

function CompanyRootRedirect() {
  const { companies, selectedCompany, loading } = useCompany();
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  if (loading || healthQuery.isLoading) {
    return <FullPageLoader />;
  }

  if (companies.length === 0) {
    // If a company already exists on this server, the user needs an invitation — don't show onboarding
    if (healthQuery.data?.hasCompany) {
      return <NoCompanyAccessPage />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    if (healthQuery.data?.hasCompany) {
      return <NoCompanyAccessPage />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  // VIEW-PRESETS: Use the preset's landing page (resolved by useViewPreset)
  return <CompanyLandingRedirect companyPrefix={targetCompany.issuePrefix} />;
}

/** Inner component that uses useViewPreset (requires CompanyContext to be set) */
function CompanyLandingRedirect({ companyPrefix }: { companyPrefix: string }) {
  const { layout } = useViewPreset();
  return <Navigate to={`/${companyPrefix}${layout.landingPage}`} replace />;
}

/** Redirect within a board layout — uses the preset landing page (relative path) */
function BoardIndexRedirect() {
  const { layout } = useViewPreset();
  // Strip leading slash for relative navigation within the board prefix
  const target = layout.landingPage.startsWith("/") ? layout.landingPage.slice(1) : layout.landingPage;
  return <Navigate to={target} replace />;
}

function UnprefixedBoardRedirect() {
  const location = useLocation();
  const { companies, selectedCompany, loading } = useCompany();
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  if (loading || healthQuery.isLoading) {
    return <FullPageLoader />;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    if (healthQuery.data?.hasCompany) {
      return <NoCompanyAccessPage />;
    }
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
          <Route path="admin/config-layers" element={<UnprefixedBoardRedirect />} />
          <Route path="company/settings" element={<UnprefixedBoardRedirect />} />
          <Route path="audit" element={<UnprefixedBoardRedirect />} />
          <Route path="containers" element={<UnprefixedBoardRedirect />} />
          <Route path="approvals" element={<UnprefixedBoardRedirect />} />
          <Route path="approvals/pending" element={<UnprefixedBoardRedirect />} />
          <Route path="approvals/all" element={<UnprefixedBoardRedirect />} />
          <Route path="approvals/:approvalId" element={<UnprefixedBoardRedirect />} />
          <Route path="chat" element={<UnprefixedBoardRedirect />} />
          <Route path="chat/:channelId" element={<UnprefixedBoardRedirect />} />
          <Route path="folders" element={<UnprefixedBoardRedirect />} />
          <Route path="folders/:folderId" element={<UnprefixedBoardRedirect />} />
          <Route path="folders/:folderId/chat/:channelId" element={<UnprefixedBoardRedirect />} />
          <Route path="shared/chat/:token" element={<UnprefixedBoardRedirect />} />
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
          <Route path="routines" element={<UnprefixedBoardRedirect />} />
          <Route path="routines/:id" element={<UnprefixedBoardRedirect />} />
          <Route path="feedback" element={<UnprefixedBoardRedirect />} />
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
