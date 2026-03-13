import { useState, useMemo } from "react";
import { FileText, BookOpen, ChevronRight, CheckCircle2, Circle, Rocket, GitCompare, Loader2, ChevronDown, ChevronUp, ScanSearch } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { useProjectNavigation } from "../context/ProjectNavigationContext";
import type { BreadcrumbEntry, SelectedItem } from "../context/ProjectNavigationContext";
import { useWorkspaceContext, useWorkspaceFile } from "../hooks/useWorkspaceContext";
import { projectsApi } from "../api/projects";
import { agentsApi } from "../api/agents";
import { useToast } from "../context/ToastContext";
import { heartbeatsApi } from "../api/heartbeats";
import { workspaceContextApi } from "../api/workspaceContext";
import { IssuesList } from "./IssuesList";
import { Identity } from "./Identity";
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
import type { ContextNode, AcceptanceCriterion, DriftReport } from "@mnm/shared";

/* ── Tree lookup ── */

function findNode(nodes: ContextNode[], id: string): ContextNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/* ── Breadcrumb builder for WorkPane ── */

function useWorkPaneBreadcrumb(selectedItem: SelectedItem) {
  const { selectNode, clearSelection } = useProjectNavigation();
  return [
    { label: "Project", onClick: clearSelection },
    ...selectedItem.breadcrumb.slice(0, -1).map((entry: BreadcrumbEntry, i: number) => ({
      label: entry.title,
      onClick: () =>
        selectNode(entry.id, entry.title, entry.filePath, selectedItem.breadcrumb.slice(0, i)),
    })),
    { label: selectedItem.breadcrumb.at(-1)!.title },
  ];
}

/* ── Status badge ── */

const wsCtxStatusBadge: Record<string, string> = {
  backlog: "bg-muted text-muted-foreground",
  "ready-for-dev": "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "in-progress": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  review: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
};

function StatusBadgeInline({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const colors = wsCtxStatusBadge[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", colors)}>
      {status.replace(/-/g, " ")}
    </span>
  );
}

/* ── Segment colors for global progress bar ── */

const SEGMENT_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-orange-500",
  "bg-emerald-500",
  "bg-pink-500",
  "bg-cyan-500",
] as const;

/* ── Global Progress Bar ── */

function GlobalProgressBar({ tree }: { tree: ContextNode[] }) {
  if (tree.length === 0) return null;

  const grandTotal = tree.reduce((sum, n) => sum + n.progress.total, 0);
  if (grandTotal === 0) return null;

  const grandDone = tree.reduce((sum, n) => sum + n.progress.done, 0);
  const globalPct = Math.round((grandDone / grandTotal) * 100);

  const segments = tree.map((node, i) => ({
    node,
    weight: node.progress.total / grandTotal,
    pct: node.progress.total > 0
      ? Math.round((node.progress.done / node.progress.total) * 100)
      : 0,
    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
          Progress
        </span>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {globalPct}%
        </span>
      </div>
      <div
        className="flex h-3 w-full rounded-full bg-muted overflow-hidden gap-[2px]"
        role="progressbar"
        aria-valuenow={globalPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Project progress: ${globalPct}%`}
      >
        {segments.map(({ node, weight, pct, color }) => (
          <div
            key={node.id}
            className="h-full overflow-hidden first:rounded-l-full last:rounded-r-full"
            style={{ width: `${weight * 100}%` }}
            title={`${node.title} — ${pct}%`}
          >
            <div
              className={cn("h-full transition-all", color)}
              style={{ width: `${pct}%` }}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {segments.map(({ node, pct, color }) => (
          <div key={node.id} className="flex items-center gap-1.5 min-w-0">
            <span className={cn("h-2 w-2 rounded-full shrink-0", color)} />
            <span
              className="text-[10px] text-muted-foreground truncate"
              title={node.title}
            >
              {node.title}
            </span>
            <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0 ml-auto">
              {pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
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

function SpecViewer({
  projectId,
  path,
  companyId,
  breadcrumbSegments,
}: {
  projectId: string;
  path: string;
  companyId?: string;
  /** If provided, overrides the default path-based breadcrumb */
  breadcrumbSegments?: { label: string; onClick?: () => void }[];
}) {
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

  const otherArtifacts = (wsCtx?.planningArtifacts ?? []).filter((a) => a.filePath !== path);

  const crumbs = breadcrumbSegments ?? [
    { label: "Project", onClick: clearSelection },
    ...(folder ? [{ label: folder }] : []),
    { label: fileName },
  ];

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
        <Breadcrumb segments={crumbs} />
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
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
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

/* ── AC Card ── */

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

/* ── Story Detail (leaf node with structured AC + tasks) ── */

function StoryDetail({
  node,
  selectedItem,
  companyId,
  projectId,
}: {
  node: ContextNode;
  selectedItem: SelectedItem;
  companyId?: string;
  projectId?: string;
}) {
  const breadcrumbSegments = useWorkPaneBreadcrumb(selectedItem);
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
  const [justCreatedIssueId, setJustCreatedIssueId] = useState<string | null>(null);
  const detail = node.detail!;

  const storyContent = [
    `# ${node.title}`,
    ...detail.acceptanceCriteria.map((ac) =>
      `## ${ac.id}: ${ac.title}\n**Given** ${ac.given ?? ""}\n**When** ${ac.when ?? ""}\n**Then** ${(ac.then ?? []).join(", ")}`,
    ),
    detail.tasks.length > 0
      ? `## Tasks\n${detail.tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.label}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n");

  const { data: issues = [] } = useQuery({
    queryKey: [...queryKeys.issues.list(companyId ?? ""), "story-match", node.title],
    queryFn: () =>
      import("../api/issues").then((mod) =>
        mod.issuesApi.list(companyId!, { q: node.title }),
      ),
    enabled: !!companyId,
    refetchInterval: 10000,
  });

  const matchedIssueId = useMemo(() => {
    if (justCreatedIssueId) return justCreatedIssueId;
    const found = issues.find((issue) => issue.title?.includes(node.title));
    return found?.id ?? null;
  }, [issues, node.title, justCreatedIssueId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        <Breadcrumb segments={breadcrumbSegments} />
        <div className="flex items-center gap-3 mt-1">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold flex-1 truncate">{node.title}</h2>
          <StatusBadgeInline status={node.status} />
          {companyId && (
            <Button variant="outline" size="sm" onClick={() => setLaunchDialogOpen(true)} className="gap-1.5 shrink-0">
              <Rocket className="h-3.5 w-3.5" />
              Lancer un agent
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4 space-y-6">
          {matchedIssueId && companyId && (
            <LiveRunWidget issueId={matchedIssueId} companyId={companyId} />
          )}

          {detail.acceptanceCriteria.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Acceptance Criteria
              </h4>
              {detail.acceptanceCriteria.map((ac) => (
                <ACCard key={ac.id} ac={ac} />
              ))}
            </div>
          )}

          {detail.tasks.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Tasks
              </h4>
              {detail.tasks.map((task, i) => (
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
                {detail.taskProgress.done}/{detail.taskProgress.total} completed
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {companyId && (
        <LaunchAgentDialog
          open={launchDialogOpen}
          onOpenChange={setLaunchDialogOpen}
          companyId={companyId}
          projectId={projectId}
          storyTitle={node.title}
          storyContent={storyContent}
          onIssueCreated={setJustCreatedIssueId}
        />
      )}
    </div>
  );
}

/* ── Node Group Viewer (internal node → list its children) ── */

function NodeGroupViewer({
  node,
  selectedItem,
  companyId,
  projectId,
}: {
  node: ContextNode;
  selectedItem: SelectedItem;
  companyId?: string;
  projectId?: string;
}) {
  const { selectNode } = useProjectNavigation();
  const breadcrumbSegments = useWorkPaneBreadcrumb(selectedItem);
  const [launchOpen, setLaunchOpen] = useState(false);
  const childrenSummary = node.children
    .map((c) => `- ${c.title} (${c.progress.done}/${c.progress.total})`)
    .join("\n");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        <Breadcrumb segments={breadcrumbSegments} />
        <div className="flex items-center gap-3 mt-1">
          <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold flex-1">{node.title}</h2>
          <span className="text-xs text-muted-foreground shrink-0">
            {node.progress.done}/{node.progress.total}
          </span>
          {companyId && (
            <Button variant="outline" size="sm" onClick={() => setLaunchOpen(true)} className="gap-1.5 shrink-0">
              <Rocket className="h-3.5 w-3.5" />
              Lancer un agent
            </Button>
          )}
        </div>
      </div>

      {/* Children list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4 space-y-3">
          {node.children.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun élément dans ce groupe.</p>
          ) : (
            node.children.map((child) => {
              const pct = child.progress.total > 0
                ? Math.round((child.progress.done / child.progress.total) * 100)
                : 0;
              const currentEntry = selectedItem.breadcrumb.at(-1)!;
              return (
                <button
                  key={child.id}
                  onClick={() =>
                    selectNode(child.id, child.title, child.path, [
                      ...selectedItem.breadcrumb.slice(0, -1),
                      currentEntry,
                    ])
                  }
                  className="w-full text-left rounded-lg border border-border bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{child.title}</span>
                    <StatusBadgeInline status={child.status} />
                  </div>
                  {child.progress.total > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {child.progress.done}/{child.progress.total}
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      {companyId && (
        <LaunchAgentDialog
          open={launchOpen}
          onOpenChange={setLaunchOpen}
          companyId={companyId}
          projectId={projectId}
          storyTitle={node.title}
          storyContent={childrenSummary}
          defaultPrompt={`Lis ce groupe "${node.title}" et génère les stories détaillées pour chaque élément.\n\n${childrenSummary}`}
        />
      )}
    </div>
  );
}

/* ── Node Viewer (dispatch based on node type) ── */

function NodeViewer({
  node,
  selectedItem,
  companyId,
  projectId,
}: {
  node: ContextNode;
  selectedItem: SelectedItem;
  companyId?: string;
  projectId?: string;
}) {
  const breadcrumbSegments = useWorkPaneBreadcrumb(selectedItem);

  // Leaf with structured story detail
  if (node.detail) {
    return <StoryDetail node={node} selectedItem={selectedItem} companyId={companyId} projectId={projectId} />;
  }

  // Leaf with a markdown path (generic document)
  if (node.path && projectId) {
    return <SpecViewer projectId={projectId} path={node.path} companyId={companyId} breadcrumbSegments={breadcrumbSegments} />;
  }

  // Internal node → show children
  return <NodeGroupViewer node={node} selectedItem={selectedItem} companyId={companyId} projectId={projectId} />;
}

/* ── Onboard banner ── */

function OnboardBanner({ projectId, companyId, hasWorkspace }: { projectId?: string; companyId?: string; hasWorkspace?: boolean }) {
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId ?? ""),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });
  const defaultAgent = useMemo(() => {
    const active = agents.filter((a) => a.status !== "terminated");
    return active.find((a) => a.role === "ceo") ?? active[0] ?? null;
  }, [agents]);

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
  const [launchAgentId, setLaunchAgentId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: wsCtx } = useWorkspaceContext(projectId, companyId);

  const { data: liveRuns = [] } = useQuery({
    queryKey: queryKeys.liveRuns(companyId ?? ""),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId!),
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ["workspace-assignments", projectId ?? ""],
    queryFn: () => workspaceContextApi.getAssignments(projectId!, companyId!),
    enabled: !!projectId && !!companyId,
  });
  const workspaceId = assignmentsData?.workspaceId ?? null;
  const savedAssignments = assignmentsData?.assignments ?? {};
  const assignedAgentIds = useMemo(() => new Set(Object.values(savedAssignments)), [savedAssignments]);

  const { data: issues = [], isLoading: issuesLoading, error: issuesError } = useQuery({
    queryKey: queryKeys.issues.listByProject(companyId ?? "", projectId ?? ""),
    queryFn: () =>
      import("../api/issues").then((m) => m.issuesApi.list(companyId!, { projectId })),
    enabled: !!companyId && !!projectId,
    refetchInterval: 10000,
  });

  const { data: workspaceAgents = [] } = useQuery({
    queryKey: workspaceId
      ? queryKeys.agents.listForWorkspace(companyId ?? "", workspaceId)
      : queryKeys.agents.list(companyId ?? ""),
    queryFn: () => agentsApi.list(companyId!, workspaceId ? { workspaceId } : undefined),
    enabled: !!companyId,
  });

  const projectIssueIds = useMemo(() => new Set(issues.map((i) => i.id)), [issues]);

  const runningIssueIds = useMemo(() => {
    const liveIds = new Set(
      liveRuns
        .filter((r) => r.issueId && (r.status === "running" || r.status === "queued") && projectIssueIds.has(r.issueId))
        .map((r) => r.issueId!),
    );
    return issues.filter((i) => liveIds.has(i.id)).map((i) => i.id);
  }, [liveRuns, issues, projectIssueIds]);

  const activeAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of liveRuns) {
      if (run.issueId && projectIssueIds.has(run.issueId) && (run.status === "running" || run.status === "queued")) {
        ids.add(run.agentId);
      }
    }
    return ids;
  }, [liveRuns, projectIssueIds]);

  const relevantAgents = useMemo(
    () => workspaceAgents.filter(
      (a) => a.status !== "terminated" &&
        (a.scopedToWorkspaceId === null || a.scopedToWorkspaceId === workspaceId || assignedAgentIds.has(a.id)),
    ),
    [workspaceAgents, workspaceId, assignedAgentIds],
  );

  const idleAgents = useMemo(
    () => relevantAgents.filter((a) => !activeAgentIds.has(a.id)),
    [relevantAgents, activeAgentIds],
  );

  const liveIssueIds = useMemo(() => new Set(runningIssueIds), [runningIssueIds]);

  const updateIssue = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      import("../api/issues").then((m) => m.issuesApi.update(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.listByProject(companyId ?? "", projectId ?? "") });
    },
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">

        {/* Global progress */}
        {wsCtx?.detected && wsCtx.tree.length > 0 && (
          <GlobalProgressBar tree={wsCtx.tree} />
        )}

        {/* Active agents */}
        <section className="space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
            Active agents{runningIssueIds.length > 0 ? ` — ${runningIssueIds.length} running` : ""}
          </p>
          {runningIssueIds.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {runningIssueIds.map((issueId) => (
                <LiveRunWidget key={issueId} issueId={issueId} companyId={companyId} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No active runs for this project.</p>
          )}
        </section>

        {/* Issues list */}
        <section className="space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
            Issues
          </p>
          <IssuesList
            issues={issues}
            isLoading={issuesLoading}
            error={issuesError as Error | null}
            agents={workspaceAgents}
            liveIssueIds={liveIssueIds}
            projectId={projectId}
            viewStateKey={`mnm:project-view:${projectId}`}
            onUpdateIssue={(id, data) => updateIssue.mutate({ id, data })}
          />
        </section>

        {/* Available agents */}
        {idleAgents.length > 0 && (
          <section className="space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
              Available agents
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {idleAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/50 bg-muted/20"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-2 w-2 shrink-0">
                      <span className="inline-flex rounded-full h-2 w-2 bg-muted-foreground/30" />
                    </span>
                    <Identity name={agent.name} size="sm" />
                    {agent.role && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{agent.role}</span>
                    )}
                    <span className={cn(
                      "text-[9px] font-mono shrink-0",
                      agent.scopedToWorkspaceId ? "text-violet-500/70" : "text-muted-foreground/40",
                    )}>
                      {agent.scopedToWorkspaceId ? "projet" : "global"}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setLaunchAgentId(agent.id)}>
                    Launch
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {companyId && (
        <LaunchAgentDialog
          open={launchAgentId !== null}
          onOpenChange={(open) => { if (!open) setLaunchAgentId(null); }}
          companyId={companyId}
          projectId={projectId}
          storyTitle=""
          storyContent=""
          defaultAgentId={launchAgentId ?? undefined}
          onIssueCreated={() => {
            setLaunchAgentId(null);
            queryClient.invalidateQueries({ queryKey: queryKeys.issues.listByProject(companyId, projectId ?? "") });
          }}
        />
      )}
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

  // No selection → agent dashboard or onboarding
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

  // Artifact selected (planning artifact) → SpecViewer with path-based breadcrumb
  if (selectedItem.type === "artifact" && projectId && selectedItem.filePath) {
    return <SpecViewer projectId={projectId} path={selectedItem.filePath} companyId={companyId} />;
  }

  // Tree node selected → find node and dispatch
  if (selectedItem.type === "node" && wsCtx?.detected) {
    const node = findNode(wsCtx.tree, selectedItem.id);
    if (node) {
      return <NodeViewer node={node} selectedItem={selectedItem} companyId={companyId} projectId={projectId} />;
    }
  }

  return <WorkPaneEmpty />;
}
