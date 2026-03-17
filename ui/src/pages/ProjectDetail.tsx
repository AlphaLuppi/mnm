import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Navigate, Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isUuidLike } from "@mnm/shared";
import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { assetsApi } from "../api/assets";
import { workspaceContextApi, type WorkspaceWorkflow } from "../api/workspaceContext";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ProjectProperties, DeleteProjectFooter } from "../components/ProjectProperties";
import { InlineEditor } from "../components/InlineEditor";
import { StatusBadge } from "../components/StatusBadge";
import { IssuesList } from "../components/IssuesList";
import { WorkspaceAgentSync } from "../components/WorkspaceAgentSync";
import { LaunchAgentDialog } from "../components/LaunchAgentDialog";
import { Identity } from "../components/Identity";
import { PageSkeleton } from "../components/PageSkeleton";
import { projectRouteRef, cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, GitBranch } from "lucide-react";
import { ThreePaneLayout } from "../components/ThreePaneLayout";
import { ContextPane } from "../components/ContextPane";
import { WorkPane } from "../components/WorkPane";
import { TestsPane } from "../components/TestsPane";
import { TimelineBar } from "../components/TimelineBar";
import { ProjectNavigationProvider } from "../context/ProjectNavigationContext";
import { Drift } from "./Drift";
import { ProjectAccessTab } from "../components/ProjectAccessTab";
import { usePermissions } from "../hooks/usePermissions";

/* ── Top-level tab types ── */

type ProjectTab = "cockpit" | "agents" | "workflows" | "drift" | "access" | "settings";

function resolveProjectTab(pathname: string, projectId: string): ProjectTab | null {
  const segments = pathname.split("/").filter(Boolean);
  const projectsIdx = segments.indexOf("projects");
  if (projectsIdx === -1 || segments[projectsIdx + 1] !== projectId) return null;
  const tab = segments[projectsIdx + 2];
  if (tab === "issues" || tab === "cockpit") return "cockpit"; // backward compat
  if (tab === "overview" || tab === "settings") return "settings"; // backward compat
  if (tab === "drift") return "drift";
  if (tab === "access") return "access";
  if (tab === "agents") return "agents";
  if (tab === "workflows") return "workflows";
  return null;
}

/* ── Settings tab ── */

function ProjectSettingsTab({
  project,
  onUpdate,
  imageUploadHandler,
}: {
  project: Parameters<typeof ProjectProperties>[0]["project"];
  onUpdate: (data: Record<string, unknown>) => void;
  imageUploadHandler?: (file: File) => Promise<string>;
}) {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60 mb-2">
          Description
        </p>
        <InlineEditor
          value={project.description ?? ""}
          onSave={(description) => onUpdate({ description })}
          as="p"
          className="text-sm text-muted-foreground"
          placeholder="Add a description..."
          multiline
          imageUploadHandler={imageUploadHandler}
        />
      </div>
      <ProjectProperties project={project} onUpdate={onUpdate} />
      <DeleteProjectFooter project={project} />
    </div>
  );
}

/* ── List (issues) tab content ── */

function ProjectIssuesList({ projectId, companyId }: { projectId: string; companyId: string }) {
  const queryClient = useQueryClient();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(companyId),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId),
    enabled: !!companyId,
  });

  const liveIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of liveRuns ?? []) {
      if (run.issueId) ids.add(run.issueId);
    }
    return ids;
  }, [liveRuns]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: queryKeys.issues.listByProject(companyId, projectId),
    queryFn: () => issuesApi.list(companyId, { projectId }),
    enabled: !!companyId,
  });

  const updateIssue = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.listByProject(companyId, projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId) });
    },
  });

  return (
    <IssuesList
      issues={issues ?? []}
      isLoading={isLoading}
      error={error as Error | null}
      agents={agents}
      liveIssueIds={liveIssueIds}
      projectId={projectId}
      viewStateKey={`mnm:project-view:${projectId}`}
      onUpdateIssue={(id, data) => updateIssue.mutate({ id, data })}
    />
  );
}

/* ── Agents tab ── */

function ProjectAgentsTab({ projectId, companyId }: { projectId: string; companyId: string }) {
  const [launchAgentId, setLaunchAgentId] = useState<string | null>(null);

  const { data: assignmentsData } = useQuery({
    queryKey: ["workspace-assignments", projectId],
    queryFn: () => workspaceContextApi.getAssignments(projectId, companyId),
  });
  const workspaceId = assignmentsData?.workspaceId ?? null;
  const savedAssignments = assignmentsData?.assignments ?? {};
  const assignedAgentIds = useMemo(() => new Set(Object.values(savedAssignments)), [savedAssignments]);

  const { data: agents = [] } = useQuery({
    queryKey: workspaceId
      ? queryKeys.agents.listForWorkspace(companyId, workspaceId)
      : queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId, workspaceId ? { workspaceId } : undefined),
    enabled: !!companyId,
  });

  const { data: liveRuns = [] } = useQuery({
    queryKey: queryKeys.liveRuns(companyId),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId),
  });

  const relevantAgents = useMemo(
    () => agents.filter(
      (a) => a.status !== "terminated" &&
        (a.scopedToWorkspaceId === workspaceId || assignedAgentIds.has(a.id)),
    ),
    [agents, workspaceId, assignedAgentIds],
  );

  const activeAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of liveRuns) {
      if (run.status === "running" || run.status === "queued") ids.add(run.agentId);
    }
    return ids;
  }, [liveRuns]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left — agent list */}
      <section className="space-y-3">
        <p className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
          Workspace agents
        </p>
        {relevantAgents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No agents configured for this workspace yet. Use the panel on the right to set them up.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {relevantAgents.map((agent) => {
              const isActive = activeAgentIds.has(agent.id);
              return (
                <div key={agent.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 min-w-0">
                    {isActive ? (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                      </span>
                    ) : (
                      <span className="flex h-2 w-2 shrink-0">
                        <span className="inline-flex rounded-full h-2 w-2 bg-muted-foreground/30" />
                      </span>
                    )}
                    <Identity name={agent.name} size="sm" />
                    {agent.role && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{agent.role}</span>
                    )}
                    <span className={cn(
                      "text-[9px] font-mono shrink-0",
                      agent.scopedToWorkspaceId ? "text-violet-500/70" : "text-muted-foreground/50",
                    )}>
                      {agent.scopedToWorkspaceId ? "workspace" : "global"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setLaunchAgentId(agent.id)}>
                      Launch
                    </Button>
                    <Link to={`/agents/${agent.id}`}>
                      <Button size="sm" variant="ghost" className="px-2">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Right — workspace agent sync */}
      <div>
        <WorkspaceAgentSync projectId={projectId} companyId={companyId} />
      </div>

      <LaunchAgentDialog
        open={launchAgentId !== null}
        onOpenChange={(open) => { if (!open) setLaunchAgentId(null); }}
        companyId={companyId}
        projectId={projectId}
        storyTitle=""
        storyContent=""
        defaultAgentId={launchAgentId ?? undefined}
      />
    </div>
  );
}

/* ── Workflows tab ── */

function ProjectWorkflowsTab({ projectId, companyId }: { projectId: string; companyId: string }) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkspaceWorkflow | null>(null);
  const [search, setSearch] = useState("");

  const { data: workflowsData } = useQuery({
    queryKey: ["workspace-workflows", projectId],
    queryFn: () => workspaceContextApi.getWorkflows(projectId, companyId),
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ["workspace-assignments", projectId],
    queryFn: () => workspaceContextApi.getAssignments(projectId, companyId),
  });

  const workflows = workflowsData?.workflows ?? [];
  const assignments = assignmentsData?.assignments ?? {};

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter(
      (wf) =>
        wf.name.toLowerCase().includes(q) ||
        wf.description?.toLowerCase().includes(q) ||
        wf.agentRole?.toLowerCase().includes(q) ||
        wf.phase?.toLowerCase().includes(q),
    );
  }, [workflows, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, WorkspaceWorkflow[]>();
    for (const wf of filtered) {
      const key = wf.agentRole ?? "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(wf);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (workflows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <GitBranch className="h-8 w-8" />
        <p className="text-sm font-medium">No workflows detected</p>
        <p className="text-xs text-center max-w-64">
          Add workflow files (e.g. <code className="font-mono text-xs">bmad-*.md</code>) to your workspace IDE directory to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60 shrink-0">
          {filtered.length}/{workflows.length} workflow{workflows.length > 1 ? "s" : ""}
        </p>
        <input
          type="search"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 w-52 rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {grouped.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun workflow ne correspond à la recherche.</p>
      )}

      {grouped.map(([role, wfs]) => {
        const assignedAgentId = assignments[role];
        return (
          <section key={role} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold text-muted-foreground/80 uppercase tracking-widest">
                {role}
              </span>
              {assignedAgentId && (
                <span className="text-[9px] text-green-600 dark:text-green-400 font-mono">assigned</span>
              )}
              <div className="flex-1 h-px bg-border" />
              <span className="text-[9px] text-muted-foreground/50 font-mono">{wfs.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {wfs.map((wf) => (
                <div
                  key={wf.name}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-card"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium truncate">{wf.name}</p>
                    {wf.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{wf.description}</p>
                    )}
                    {wf.phase && (
                      <span className="text-[10px] font-mono text-muted-foreground/60">phase: {wf.phase}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setSelectedWorkflow(wf)}
                  >
                    Launch
                  </Button>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <LaunchAgentDialog
        open={selectedWorkflow !== null}
        onOpenChange={(open) => { if (!open) setSelectedWorkflow(null); }}
        companyId={companyId}
        projectId={projectId}
        storyTitle={selectedWorkflow?.name ?? ""}
        storyContent={selectedWorkflow?.description ?? ""}
        defaultAgentId={selectedWorkflow?.agentRole ? assignments[selectedWorkflow.agentRole] : undefined}
      />
    </div>
  );
}

/* ── Main project page ── */

export function ProjectDetail() {
  const { companyPrefix, projectId } = useParams<{
    companyPrefix?: string;
    projectId: string;
  }>();
  const { companies, selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { hasPermission } = usePermissions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const routeProjectRef = projectId ?? "";
  const routeCompanyId = useMemo(() => {
    if (!companyPrefix) return null;
    const requestedPrefix = companyPrefix.toUpperCase();
    return companies.find((company) => company.issuePrefix.toUpperCase() === requestedPrefix)?.id ?? null;
  }, [companies, companyPrefix]);
  const lookupCompanyId = routeCompanyId ?? selectedCompanyId ?? undefined;
  const canFetchProject = routeProjectRef.length > 0 && (isUuidLike(routeProjectRef) || Boolean(lookupCompanyId));

  const activeTab = routeProjectRef ? resolveProjectTab(location.pathname, routeProjectRef) : null;

  const { data: project, isLoading, error } = useQuery({
    queryKey: [...queryKeys.projects.detail(routeProjectRef), lookupCompanyId ?? null],
    queryFn: () => projectsApi.get(routeProjectRef, lookupCompanyId),
    enabled: canFetchProject,
  });
  const canonicalProjectRef = project ? projectRouteRef(project) : routeProjectRef;
  const projectLookupRef = project?.id ?? routeProjectRef;
  const resolvedCompanyId = project?.companyId ?? selectedCompanyId;

  useEffect(() => {
    if (!project?.companyId || project.companyId === selectedCompanyId) return;
    setSelectedCompanyId(project.companyId, { source: "route_sync" });
  }, [project?.companyId, selectedCompanyId, setSelectedCompanyId]);

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(routeProjectRef) });
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectLookupRef) });
    if (resolvedCompanyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(resolvedCompanyId) });
    }
  };

  const updateProject = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      projectsApi.update(projectLookupRef, data, resolvedCompanyId ?? lookupCompanyId),
    onSuccess: invalidateProject,
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!resolvedCompanyId) throw new Error("No company selected");
      return assetsApi.uploadImage(resolvedCompanyId, file, `projects/${projectLookupRef || "draft"}`);
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Projects", href: "/projects" },
      { label: project?.name ?? routeProjectRef ?? "Project" },
    ]);
  }, [setBreadcrumbs, project, routeProjectRef]);

  useEffect(() => {
    if (!project) return;
    if (routeProjectRef === canonicalProjectRef) return;
    if (activeTab === "settings") {
      navigate(`/projects/${canonicalProjectRef}/settings`, { replace: true });
      return;
    }
    if (activeTab === "cockpit") {
      navigate(`/projects/${canonicalProjectRef}/cockpit`, { replace: true });
      return;
    }
    if (activeTab === "agents") {
      navigate(`/projects/${canonicalProjectRef}/agents`, { replace: true });
      return;
    }
    if (activeTab === "workflows") {
      navigate(`/projects/${canonicalProjectRef}/workflows`, { replace: true });
      return;
    }
    if (activeTab === "drift") {
      navigate(`/projects/${canonicalProjectRef}/drift`, { replace: true });
      return;
    }
    if (activeTab === "access") {
      navigate(`/projects/${canonicalProjectRef}/access`, { replace: true });
      return;
    }
    navigate(`/projects/${canonicalProjectRef}`, { replace: true });
  }, [project, routeProjectRef, canonicalProjectRef, activeTab, navigate]);

  // Redirect bare /projects/:id to /projects/:id/cockpit
  if (routeProjectRef && activeTab === null) {
    return <Navigate to={`/projects/${canonicalProjectRef}/cockpit`} replace />;
  }

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!project) return null;

  const handleTabChange = (tab: ProjectTab) => {
    navigate(`/projects/${canonicalProjectRef}/${tab}`);
  };

  const workContent = project?.id && resolvedCompanyId ? (
    <ProjectIssuesList projectId={project.id} companyId={resolvedCompanyId} />
  ) : null;

  return (
    <div className="h-full -m-4 md:-m-6 flex flex-col">
      {/* Project-level tab bar */}
      <div className="shrink-0 flex items-center gap-1 border-b border-border px-4 md:px-6 overflow-x-auto scrollbar-none">
        {(
          [
            "cockpit",
            "agents",
            "workflows",
            "drift",
            ...(hasPermission("projects:manage_members") ? ["access" as const] : []),
            "settings",
          ] as ProjectTab[]
        ).map((tab) => (
          <button
            key={tab}
            data-testid={tab === "access" ? "proj-s04-tab-access" : undefined}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => handleTabChange(tab)}
          >
            {tab === "cockpit" ? "Cockpit"
              : tab === "agents" ? "Agents"
              : tab === "workflows" ? "Workflows"
              : tab === "drift" ? "Drift"
              : tab === "access" ? "Access"
              : "Settings"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === "cockpit" ? (
          <ProjectNavigationProvider>
            <ThreePaneLayout
              left={<ContextPane projectId={projectLookupRef} companyId={resolvedCompanyId ?? undefined} />}
              center={
                <WorkPane projectId={projectLookupRef} companyId={resolvedCompanyId ?? undefined} hasWorkspace={Boolean(project?.primaryWorkspace)}>
                  {workContent}
                </WorkPane>
              }
              right={<TestsPane projectId={projectLookupRef} companyId={resolvedCompanyId ?? undefined} />}
              bottom={<TimelineBar />}
            />
          </ProjectNavigationProvider>
        ) : activeTab === "agents" && project?.id && resolvedCompanyId ? (
          <ScrollArea className="h-full">
            <div className="p-6">
              <ProjectAgentsTab projectId={project.id} companyId={resolvedCompanyId} />
            </div>
          </ScrollArea>
        ) : activeTab === "workflows" && project?.id && resolvedCompanyId ? (
          <ScrollArea className="h-full">
            <div className="p-6">
              <ProjectWorkflowsTab projectId={project.id} companyId={resolvedCompanyId} />
            </div>
          </ScrollArea>
        ) : activeTab === "drift" ? (
          <div className="p-6 h-full overflow-auto">
            <Drift />
          </div>
        ) : activeTab === "access" && project?.id && resolvedCompanyId ? (
          <ScrollArea className="h-full">
            <div className="p-6">
              <ProjectAccessTab projectId={project.id} companyId={resolvedCompanyId} />
            </div>
          </ScrollArea>
        ) : activeTab === "settings" ? (
          <ScrollArea className="h-full">
            <div className="p-6">
              <ProjectSettingsTab
                project={project}
                onUpdate={(data) => updateProject.mutate(data)}
                imageUploadHandler={async (file) => {
                  const asset = await uploadImage.mutateAsync(file);
                  return asset.contentPath;
                }}
              />
            </div>
          </ScrollArea>
        ) : null}
      </div>
    </div>
  );
}
