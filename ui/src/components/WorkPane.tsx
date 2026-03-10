import { useState, useMemo } from "react";
import { FileText, BookOpen, ChevronRight, CheckCircle2, Circle, Rocket, Bot, GitCompare, Loader2, ChevronDown, ChevronUp, ScanSearch } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { useProjectNavigation } from "../context/ProjectNavigationContext";
import { useWorkspaceContext, useWorkspaceFile } from "../hooks/useWorkspaceContext";
import { projectsApi } from "../api/projects";
import { agentsApi } from "../api/agents";
import { useToast } from "../context/ToastContext";
import { heartbeatsApi } from "../api/heartbeats";
import { workspaceContextApi } from "../api/workspaceContext";
import { WorkspaceAgentSync } from "./WorkspaceAgentSync";
import { DriftAlertCard } from "./DriftAlertCard";
import { queryKeys } from "../lib/queryKeys";
import { MarkdownBody } from "./MarkdownBody";
import { LiveRunWidget } from "./LiveRunWidget";
import { LaunchAgentDialog } from "./LaunchAgentDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "../lib/utils";
import type { ReactNode } from "react";
import type { WorkspaceEpic, WorkspaceStory, AcceptanceCriterion, DriftReport } from "@mnm/shared";

/* ── Status badge (reused from ContextPane conventions) ── */

const wsCtxStatusBadge: Record<string, string> = {
  backlog: "bg-muted text-muted-foreground",
  "ready-for-dev": "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "in-progress": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  review: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
};

function StatusBadgeInline({ status }: { status: string | null }) {
  if (!status) return null;
  const colors = wsCtxStatusBadge[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", colors)}>
      {status.replace(/-/g, " ")}
    </span>
  );
}

/* ── Breadcrumb ── */

function Breadcrumb({ segments }: { segments: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          {seg.onClick ? (
            <button onClick={seg.onClick} className="hover:text-foreground transition-colors cursor-pointer">
              {seg.label}
            </button>
          ) : (
            <span>{seg.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ── Artifact type → default prompt ── */

const ARTIFACT_PROMPTS: Record<string, string> = {
  prd: "Lis ce PRD et génère les epics correspondantes dans `_bmad-output/implementation-artifacts/`.",
  "product-brief": "Lis ce product brief et génère un PRD détaillé dans `_bmad-output/planning-artifacts/`.",
  architecture: "Lis ce document d'architecture et identifie les stories techniques à implémenter.",
  epics: "Lis ce document epics et génère les stories détaillées pour chaque epic.",
};

function artifactType(path: string): string {
  const base = path.split(/[/\\]/).pop()?.replace(/\.md$/i, "").toLowerCase() ?? "";
  if (base.includes("prd") && !base.includes("brief")) return "prd";
  if (base.includes("product-brief") || base.includes("brief")) return "product-brief";
  if (base.includes("architecture") || base.includes("arch")) return "architecture";
  if (base.includes("epics")) return "epics";
  return "document";
}

/* ── Spec Viewer (artifact markdown) ── */

function SpecViewer({ projectId, path, companyId }: { projectId: string; path: string; companyId?: string }) {
  const { data: content, isLoading, error } = useWorkspaceFile(projectId, path, companyId);
  const { data: wsCtx } = useWorkspaceContext(projectId, companyId);
  const { clearSelection } = useProjectNavigation();
  const [launchOpen, setLaunchOpen] = useState(false);
  const [driftOpen, setDriftOpen] = useState(false);
  const [driftTarget, setDriftTarget] = useState("");
  const [driftReport, setDriftReport] = useState<DriftReport | null>(null);
  const [driftResultsOpen, setDriftResultsOpen] = useState(true);

  const driftMutation = useMutation({
    mutationFn: (targetDoc: string) =>
      workspaceContextApi.driftCheck(projectId, path, targetDoc, companyId),
    onSuccess: (report) => {
      setDriftReport(report);
      setDriftOpen(false);
      setDriftResultsOpen(true);
    },
  });

  const parts = path.split(/[/\\]/);
  const fileName = parts.pop()?.replace(/\.md$/i, "") ?? path;
  const folder = parts.length > 1 ? parts[parts.length - 1] : null;
  const type = artifactType(path);
  const defaultPrompt = ARTIFACT_PROMPTS[type] ?? "";

  // Other planning artifacts to compare against
  const otherArtifacts = (wsCtx?.planningArtifacts ?? []).filter((a) => a.filePath !== path);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive p-4">Failed to load: {(error as Error).message}</p>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        <Breadcrumb segments={[
          { label: "Project", onClick: clearSelection },
          ...(folder ? [{ label: folder }] : []),
          { label: fileName },
        ]} />
        <div className="flex items-center gap-3 mt-1">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold flex-1 truncate">{fileName}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
            {type}
          </span>
          {companyId && otherArtifacts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setDriftOpen((v) => !v); setDriftReport(null); }}
              className={cn("gap-1.5 shrink-0", driftOpen && "bg-accent")}
            >
              <GitCompare className="h-3.5 w-3.5" />
              Check drift
            </Button>
          )}
          {companyId && (
            <Button variant="outline" size="sm" onClick={() => setLaunchOpen(true)} className="gap-1.5 shrink-0">
              <Rocket className="h-3.5 w-3.5" />
              Lancer un agent
            </Button>
          )}
        </div>
      </div>

      {/* Drift check panel */}
      {driftOpen && (
        <div className="shrink-0 border-b border-border bg-muted/30 px-5 py-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Comparer avec :</p>
          <div className="flex flex-wrap gap-1.5">
            {otherArtifacts.map((a) => (
              <button
                key={a.filePath}
                type="button"
                onClick={() => setDriftTarget(a.filePath)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  driftTarget === a.filePath
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground/40 hover:bg-accent/50",
                )}
              >
                {a.filePath.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? a.filePath}
              </button>
            ))}
          </div>
          {driftTarget === "" && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Ou saisir un chemin relatif :</p>
              <input
                type="text"
                placeholder="e.g. planning-artifacts/architecture.md"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                onChange={(e) => setDriftTarget(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              disabled={!driftTarget.trim() || driftMutation.isPending}
              onClick={() => driftMutation.mutate(driftTarget.trim())}
              className="gap-1.5"
            >
              {driftMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitCompare className="h-3.5 w-3.5" />
              )}
              {driftMutation.isPending ? "Analyse en cours…" : "Analyser"}
            </Button>
            {driftMutation.isError && (
              <p className="text-xs text-destructive">
                {(driftMutation.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Drift results */}
      {driftReport && (
        <div className="shrink-0 border-b border-border">
          <button
            type="button"
            onClick={() => setDriftResultsOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-medium hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-left">
              Drift — {driftReport.drifts.length} issue{driftReport.drifts.length !== 1 ? "s" : ""} vs{" "}
              <span className="font-mono">{driftReport.targetDoc.split(/[/\\]/).pop()}</span>
            </span>
            {driftResultsOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
          {driftResultsOpen && (
            <div className="px-5 pb-3 space-y-2 max-h-64 overflow-y-auto">
              {driftReport.drifts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Aucun drift détecté.</p>
              ) : (
                driftReport.drifts.map((drift) => (
                  <DriftAlertCard key={drift.id} drift={drift} />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4">
          <MarkdownBody>{content ?? ""}</MarkdownBody>
        </div>
      </ScrollArea>

      {companyId && (
        <LaunchAgentDialog
          open={launchOpen}
          onOpenChange={setLaunchOpen}
          companyId={companyId}
          projectId={projectId}
          storyTitle={fileName}
          storyContent={content ?? ""}
          defaultPrompt={defaultPrompt}
        />
      )}
    </div>
  );
}

/* ── AC Card (for StoryViewer) ── */

function ACCard({ ac }: { ac: AcceptanceCriterion }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">{ac.id}</span>
        <span className="text-sm font-medium">{ac.title}</span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {ac.given && (
          <p><span className="font-semibold text-foreground">Given</span> {ac.given}</p>
        )}
        {ac.when && (
          <p><span className="font-semibold text-foreground">When</span> {ac.when}</p>
        )}
        {ac.then && ac.then.length > 0 && (
          <div>
            <span className="font-semibold text-foreground">Then</span>
            {ac.then.map((t, i) => (
              <p key={i} className="ml-3">{t}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Story Viewer ── */

function StoryViewer({ story, epicNumber, companyId, projectId }: { story: WorkspaceStory; epicNumber: number; companyId?: string; projectId?: string }) {
  const { selectEpic, clearSelection } = useProjectNavigation();
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
  const [justCreatedIssueId, setJustCreatedIssueId] = useState<string | null>(null);

  // Build story content for issue body
  const storyTitle = `${story.epicNumber}.${story.storyNumber} ${story.title}`;
  const storyContent = [
    `# ${storyTitle}`,
    ...story.acceptanceCriteria.map((ac) =>
      `## ${ac.id}: ${ac.title}\n**Given** ${ac.given ?? ""}\n**When** ${ac.when ?? ""}\n**Then** ${(ac.then ?? []).join(", ")}`,
    ),
    story.tasks.length > 0
      ? `## Tasks\n${story.tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.label}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n");

  // Find issues that match this story to show LiveRunWidget
  const { data: issues = [] } = useQuery({
    queryKey: [...queryKeys.issues.list(companyId ?? ""), "story-match", storyTitle],
    queryFn: () =>
      import("../api/issues").then((mod) =>
        mod.issuesApi.list(companyId!, { q: storyTitle }),
      ),
    enabled: !!companyId,
    refetchInterval: 10000,
  });

  const matchedIssueId = useMemo(() => {
    // Prefer just-created issue, then fall back to search results
    if (justCreatedIssueId) return justCreatedIssueId;
    const found = issues.find((issue) => issue.title?.includes(storyTitle));
    return found?.id ?? null;
  }, [issues, storyTitle, justCreatedIssueId]);

  return (
    <div>
      <Breadcrumb segments={[
        { label: "Project", onClick: clearSelection },
        { label: `Epic ${epicNumber}`, onClick: () => selectEpic(String(epicNumber)) },
        { label: `Story ${story.epicNumber}.${story.storyNumber}` },
      ]} />

      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold">
          {story.epicNumber}.{story.storyNumber} {story.title}
        </h3>
        <StatusBadgeInline status={story.status} />
        <div className="ml-auto">
          {companyId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLaunchDialogOpen(true)}
              className="gap-1.5"
            >
              <Rocket className="h-4 w-4" />
              Lancer un agent
            </Button>
          )}
        </div>
      </div>

      {/* Live Agent Output (Story 2-2) */}
      {matchedIssueId && companyId && (
        <div className="mb-6">
          <LiveRunWidget issueId={matchedIssueId} companyId={companyId} />
        </div>
      )}

      {/* Acceptance Criteria */}
      {story.acceptanceCriteria.length > 0 && (
        <div className="space-y-2 mb-6">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Acceptance Criteria
          </h4>
          {story.acceptanceCriteria.map((ac) => (
            <ACCard key={ac.id} ac={ac} />
          ))}
        </div>
      )}

      {/* Task Checklist */}
      {story.tasks.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Tasks
          </h4>
          {story.tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {task.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={cn(task.done && "line-through text-muted-foreground")}>{task.label}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-2">
            {story.taskProgress.done}/{story.taskProgress.total} completed
          </p>
        </div>
      )}

      {/* Launch Agent Dialog (Story 2-1) */}
      {companyId && (
        <LaunchAgentDialog
          open={launchDialogOpen}
          onOpenChange={setLaunchDialogOpen}
          companyId={companyId}
          projectId={projectId}
          storyTitle={storyTitle}
          storyContent={storyContent}
          onIssueCreated={setJustCreatedIssueId}
        />
      )}
    </div>
  );
}

/* ── Epic Overview ── */

function EpicOverview({ epic, companyId, projectId }: { epic: WorkspaceEpic; companyId?: string; projectId?: string }) {
  const { selectStory, clearSelection } = useProjectNavigation();
  const [launchOpen, setLaunchOpen] = useState(false);
  const epicLabel = `Epic ${epic.number}${epic.title ? `: ${epic.title}` : ""}`;
  const epicSummary = epic.stories.map((s) => `- Story ${s.epicNumber}.${s.storyNumber}: ${s.title}`).join("\n");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        <Breadcrumb segments={[
          { label: "Project", onClick: clearSelection },
          { label: epicLabel },
        ]} />
        <div className="flex items-center gap-3 mt-1">
          <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold flex-1">{epicLabel}</h2>
          <span className="text-xs text-muted-foreground shrink-0">
            {epic.progress.done}/{epic.progress.total} stories
          </span>
          {companyId && (
            <Button variant="outline" size="sm" onClick={() => setLaunchOpen(true)} className="gap-1.5 shrink-0">
              <Rocket className="h-3.5 w-3.5" />
              Lancer un agent
            </Button>
          )}
        </div>
      </div>

      {/* Stories list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4 space-y-3">
          {epic.stories.map((story) => {
            const pct = story.taskProgress.total > 0
              ? Math.round((story.taskProgress.done / story.taskProgress.total) * 100)
              : 0;
            return (
              <button
                key={story.id}
                onClick={() => selectStory(String(epic.number), story.id, story.filePath)}
                className="w-full text-left rounded-lg border border-border bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">
                    {story.epicNumber}.{story.storyNumber} {story.title}
                  </span>
                  <StatusBadgeInline status={story.status} />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {story.taskProgress.done}/{story.taskProgress.total}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {companyId && (
        <LaunchAgentDialog
          open={launchOpen}
          onOpenChange={setLaunchOpen}
          companyId={companyId}
          projectId={projectId}
          storyTitle={epicLabel}
          storyContent={epicSummary}
          defaultPrompt={`Lis cette epic et génère les stories détaillées (format BMAD) dans \`_bmad-output/implementation-artifacts/\`.\n\n${epicSummary}`}
        />
      )}
    </div>
  );
}

/* ── Onboard banner (shown when no workspace structure detected) ── */

function OnboardBanner({ projectId, companyId, hasWorkspace }: { projectId?: string; companyId?: string; hasWorkspace?: boolean }) {
  const navigate = useNavigate();
  const { pushToast } = useToast();

  // Fetch agents to auto-assign the discovery issue
  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId ?? ""),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });
  const defaultAgent = useMemo(() => {
    const active = agents.filter((a) => a.status !== "terminated");
    return active.find((a) => a.role === "ceo") ?? active[0] ?? null;
  }, [agents]);

  // Check for an existing discovery issue
  const { data: discoveryIssues = [] } = useQuery({
    queryKey: [...queryKeys.issues.listByProject(companyId ?? "", projectId ?? ""), "discovery"],
    queryFn: () =>
      import("../api/issues").then((m) =>
        m.issuesApi.list(companyId!, { projectId, q: "Workspace discovery" }),
      ),
    enabled: !!companyId && !!projectId && hasWorkspace,
  });
  const discoveryIssue = discoveryIssues.find((i) => i.title?.startsWith("Workspace discovery"));

  const onboardMutation = useMutation({
    mutationFn: (agentId: string | null) =>
      projectsApi.onboard(projectId!, agentId ? { agentId } : {}, companyId),
    onSuccess: (data) => {
      navigate(`/issues/${data.identifier ?? data.issueId}`);
    },
    onError: (err) => {
      pushToast({ title: (err as Error).message, tone: "error" });
    },
  });

  if (!hasWorkspace) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center space-y-2">
        <ScanSearch className="h-6 w-6 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">No workspace configured</p>
        <p className="text-xs text-muted-foreground">
          Open the Properties panel to configure a workspace path, then discover its structure.
        </p>
      </div>
    );
  }

  // Discovery already launched — show link to the report
  if (discoveryIssue) {
    const ref = discoveryIssue.identifier ?? discoveryIssue.id;
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <ScanSearch className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Discovery in progress</p>
            <p className="text-xs text-muted-foreground">
              An agent is exploring your workspace. Check the report and reply via the issue inbox.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/issues/${ref}`)}>
            View report → {ref}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            disabled={onboardMutation.isPending}
            onClick={() => onboardMutation.mutate(defaultAgent?.id ?? null)}
            title="Launch a new discovery"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            Re-run
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
      <div className="flex items-start gap-2">
        <ScanSearch className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Workspace ready</p>
          <p className="text-xs text-muted-foreground">
            No structure detected yet. Launch an agent to explore and onboard this workspace.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={onboardMutation.isPending || !projectId || !companyId}
        onClick={() => onboardMutation.mutate(defaultAgent?.id ?? null)}
      >
        {onboardMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ScanSearch className="h-3.5 w-3.5" />
        )}
        {onboardMutation.isPending ? "Creating task…" : "Discover workspace"}
      </Button>
      {defaultAgent && (
        <p className="text-xs text-muted-foreground">Assigned to {defaultAgent.name}</p>
      )}
    </div>
  );
}

/* ── Empty state ── */

function WorkPaneEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-16">
      <FileText className="h-8 w-8" />
      <p className="text-sm font-medium">Select a document from the Context pane</p>
    </div>
  );
}

/* ── Default: active agents dashboard for this project ── */

function ProjectAgentsDashboard({ projectId, companyId }: { projectId?: string; companyId?: string }) {
  const { data: liveRuns = [] } = useQuery({
    queryKey: queryKeys.liveRuns(companyId ?? ""),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId!),
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  const { data: issues = [] } = useQuery({
    queryKey: queryKeys.issues.listByProject(companyId ?? "", projectId ?? ""),
    queryFn: () =>
      import("../api/issues").then((m) => m.issuesApi.list(companyId!, { projectId })),
    enabled: !!companyId && !!projectId,
    refetchInterval: 10000,
  });

  const runningIssueIds = useMemo(() => {
    const liveIds = new Set(
      liveRuns.filter((r) => r.issueId && r.status === "running").map((r) => r.issueId!),
    );
    return issues.filter((i) => liveIds.has(i.id)).map((i) => i.id);
  }, [liveRuns, issues]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {runningIssueIds.length > 0 ? (
          <>
            <p className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
              Active agents — {runningIssueIds.length} running
            </p>
            {runningIssueIds.map((issueId) => (
              <LiveRunWidget key={issueId} issueId={issueId} companyId={companyId} />
            ))}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <Bot className="h-8 w-8" />
            <p className="text-sm font-medium">No active agents</p>
            <p className="text-xs text-center max-w-48">Select a document or story from the Context pane to view it</p>
          </div>
        )}

        {projectId && companyId && (
          <WorkspaceAgentSync projectId={projectId} companyId={companyId} />
        )}
      </div>
    </ScrollArea>
  );
}

/* ── Main WorkPane ── */

interface WorkPaneProps {
  projectId?: string;
  companyId?: string;
  hasWorkspace?: boolean;
  children: ReactNode;
}

export function WorkPane({ projectId, companyId, hasWorkspace, children }: WorkPaneProps) {
  const { selectedItem } = useProjectNavigation();
  const { data: wsCtx, isLoading: wsCtxLoading } = useWorkspaceContext(projectId, companyId);

  // No selection → agent dashboard if workspace context detected, otherwise fall back to children
  if (!selectedItem) {
    if (wsCtx?.detected) {
      return <ProjectAgentsDashboard projectId={projectId} companyId={companyId} />;
    }
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {!wsCtxLoading && (
            <OnboardBanner projectId={projectId} companyId={companyId} hasWorkspace={hasWorkspace} />
          )}
          {children}
        </div>
      </ScrollArea>
    );
  }

  // Artifact selected → SpecViewer
  if (selectedItem.type === "artifact" && projectId && selectedItem.path) {
    return <SpecViewer projectId={projectId} path={selectedItem.path} companyId={companyId} />;
  }

  // Epic selected → Epic overview
  if (selectedItem.type === "epic" && wsCtx?.detected) {
    const epic = wsCtx.epics.find((e) => String(e.number) === selectedItem.id);
    if (epic) {
      return <EpicOverview epic={epic} companyId={companyId} projectId={projectId} />;
    }
  }

  // Story selected → Story detail
  if (selectedItem.type === "story" && wsCtx?.detected) {
    const [epicId] = selectedItem.id.split("/");
    const epic = wsCtx.epics.find((e) => String(e.number) === epicId);
    const storyId = selectedItem.id.split("/").slice(1).join("/");
    const story = epic?.stories.find((s) => s.id === storyId);
    if (story && epic) {
      return (
        <ScrollArea className="h-full">
          <div className="p-1">
            <StoryViewer story={story} epicNumber={epic.number} companyId={companyId} projectId={projectId} />
          </div>
        </ScrollArea>
      );
    }
  }

  return <WorkPaneEmpty />;
}
