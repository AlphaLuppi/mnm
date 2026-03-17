import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Building2,
  LayoutList,
  BookOpen,
  ChevronRight,
  FolderOpen,
  Folder,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ContextNode, PlanningArtifact } from "@mnm/shared";
import { useWorkspaceContext } from "../hooks/useWorkspaceContext";
import { useDriftResults } from "../hooks/useDriftResults";
import { useProjectNavigation } from "../context/ProjectNavigationContext";
import type { BreadcrumbEntry } from "../context/ProjectNavigationContext";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { cn } from "../lib/utils";

/* ── Artifact type → icon mapping ── */

const artifactIcon: Record<string, LucideIcon> = {
  "product-brief": FileText,
  prd: LayoutList,
  architecture: Building2,
  epic: BookOpen,
};

function getArtifactIcon(type: string): LucideIcon {
  return artifactIcon[type] ?? FileText;
}

/* ── Status dot ── */

const statusDotColor: Record<string, string> = {
  "ready-for-dev": "bg-blue-400",
  "in-progress": "bg-amber-400",
  review: "bg-violet-400",
  done: "bg-green-500",
};

function StatusDot({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const color = statusDotColor[status];
  if (!color) return null;
  return <span className={cn("shrink-0 h-1.5 w-1.5 rounded-full", color)} />;
}

function ProgressText({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  return (
    <span className="shrink-0 text-[10px] tabular-nums font-mono text-muted-foreground/50">
      {done}/{total}
    </span>
  );
}

function RunningDot() {
  return (
    <span className="relative flex h-1.5 w-1.5 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
    </span>
  );
}

/* ── Drift badge ── */

function DriftBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="shrink-0 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white tabular-nums">
      {count}
    </span>
  );
}

function GuideContent({ children, ml }: { children: React.ReactNode; ml: number }) {
  return (
    <div className="border-l border-border/20" style={{ marginLeft: ml }}>
      {children}
    </div>
  );
}

/* ── Section header (top-level collapsible label, non-selectable) ── */

function SectionHeader({
  label,
  defaultOpen = true,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors select-none cursor-pointer">
        <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")} />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <GuideContent ml={12}>
          <div className="flex flex-col py-0.5">{children}</div>
        </GuideContent>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Artifact item ── */

function ArtifactItem({ artifact, driftCount }: { artifact: PlanningArtifact; driftCount: number }) {
  const { selectedItem, selectArtifact } = useProjectNavigation();
  const Icon = getArtifactIcon(artifact.type);
  const isSelected = selectedItem?.type === "artifact" && selectedItem.id === artifact.filePath;
  return (
    <button
      onClick={() => selectArtifact(artifact.filePath, artifact.title)}
      className={cn(
        "group flex items-center gap-1.5 w-full h-6 text-xs transition-colors text-left",
        isSelected
          ? "bg-accent text-foreground font-medium"
          : "text-foreground/65 hover:bg-accent/50 hover:text-foreground",
      )}
      style={{ paddingLeft: 10, paddingRight: 6 }}
    >
      <span className="w-3 shrink-0" />
      <Icon className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-foreground/70" : "text-muted-foreground/55")} />
      <span className="flex-1 truncate min-w-0">{artifact.title}</span>
      <DriftBadge count={driftCount} />
    </button>
  );
}

/* ── Planning folder ── */

function PlanningFolderSection({ name, artifacts, driftCounts }: { name: string; artifacts: PlanningArtifact[]; driftCounts: Map<string, number> }) {
  const [open, setOpen] = useState(false);
  const { selectedItem } = useProjectNavigation();
  const hasSelected = artifacts.some(
    (a) => selectedItem?.type === "artifact" && selectedItem.id === a.filePath,
  );
  useEffect(() => {
    if (hasSelected) setOpen(true);
  }, [hasSelected]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "group flex items-center gap-1.5 w-full h-6 text-xs text-left transition-colors",
          "text-foreground/65 hover:bg-accent/50 hover:text-foreground",
        )}
        style={{ paddingLeft: 10, paddingRight: 6 }}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform text-muted-foreground/40 group-hover:text-muted-foreground/70",
            open && "rotate-90",
          )}
        />
        {open ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55" />
        )}
        <span className="flex-1 truncate">{name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <GuideContent ml={22}>
          <div className="flex flex-col py-0.5">
            {artifacts.map((artifact) => (
              <ArtifactItem key={artifact.filePath} artifact={artifact} driftCount={driftCounts.get(artifact.filePath) ?? 0} />
            ))}
          </div>
        </GuideContent>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Planning section ── */

function PlanningSection({ artifacts, driftCounts }: { artifacts: PlanningArtifact[]; driftCounts: Map<string, number> }) {
  const { rootArtifacts, folders } = useMemo(() => {
    const map = new Map<string, PlanningArtifact[]>();
    const root: PlanningArtifact[] = [];
    for (const artifact of artifacts) {
      const parts = artifact.filePath.split(/[/\\]/);
      const folder = parts.length > 2 ? parts[1] : null;
      if (!folder) {
        root.push(artifact);
      } else {
        if (!map.has(folder)) map.set(folder, []);
        map.get(folder)!.push(artifact);
      }
    }
    return { rootArtifacts: root, folders: map };
  }, [artifacts]);

  return (
    <SectionHeader label="Planning">
      {rootArtifacts.map((artifact) => (
        <ArtifactItem key={artifact.filePath} artifact={artifact} driftCount={driftCounts.get(artifact.filePath) ?? 0} />
      ))}
      {[...folders.entries()].map(([name, items]) => (
        <PlanningFolderSection key={name} name={name} artifacts={items} driftCounts={driftCounts} />
      ))}
    </SectionHeader>
  );
}

/* ── Recursive tree node ── */

const BASE_PL = 10;
const DEPTH_INDENT = 10;

function ContextNodeItem({
  node,
  depth,
  ancestors,
  runningTitles,
  driftCounts,
}: {
  node: ContextNode;
  depth: number;
  ancestors: BreadcrumbEntry[];
  runningTitles: Set<string>;
  driftCounts: Map<string, number>;
}) {
  const { selectedItem, selectNode } = useProjectNavigation();
  const [open, setOpen] = useState(false);

  const isSelected = selectedItem?.type === "node" && selectedItem.id === node.id;
  const isInPath =
    selectedItem?.type === "node" &&
    !isSelected &&
    selectedItem.breadcrumb.slice(0, -1).some((b) => b.id === node.id);

  useEffect(() => {
    if (isInPath && !open) setOpen(true);
  }, [isInPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const entry: BreadcrumbEntry = { id: node.id, title: node.title, filePath: node.path };
  const isLeaf = node.children.length === 0;
  const isRunning = runningTitles.has(node.title);
  const nodeDriftCount = node.path ? (driftCounts.get(node.path) ?? 0) : 0;
  const pl = BASE_PL + depth * DEPTH_INDENT;

  if (isLeaf) {
    const Icon = node.path ? FileText : Layers;
    return (
      <button
        onClick={() => selectNode(node.id, node.title, node.path, ancestors)}
        className={cn(
          "group flex items-center gap-1.5 w-full h-6 text-xs transition-colors text-left",
          isSelected
            ? "bg-accent text-foreground font-medium"
            : "text-foreground/65 hover:bg-accent/50 hover:text-foreground",
        )}
        style={{ paddingLeft: pl, paddingRight: 6 }}
      >
        <span className="w-3 shrink-0" />
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isSelected ? "text-foreground/70" : "text-muted-foreground/55",
          )}
        />
        <span className="flex-1 truncate min-w-0">{node.title}</span>
        <span className="flex items-center gap-1 ml-auto pl-1 shrink-0">
          <DriftBadge count={nodeDriftCount} />
          {isRunning && <RunningDot />}
          <StatusDot status={node.status} />
        </span>
      </button>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          onClick={(e) => {
            e.preventDefault();
            selectNode(node.id, node.title, undefined, ancestors);
            setOpen((prev) => !prev);
          }}
          className={cn(
            "group flex items-center gap-1.5 w-full h-6 text-xs text-left transition-colors",
            isSelected
              ? "bg-accent text-foreground font-medium"
              : "text-foreground/65 hover:bg-accent/50 hover:text-foreground",
          )}
          style={{ paddingLeft: pl, paddingRight: 6 }}
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 transition-transform text-muted-foreground/40 group-hover:text-muted-foreground/70",
              open && "rotate-90",
            )}
          />
          <BookOpen
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              isSelected ? "text-foreground/70" : "text-muted-foreground/55",
            )}
          />
          <span className="flex-1 truncate">{node.title}</span>
          <ProgressText done={node.progress.done} total={node.progress.total} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <GuideContent ml={pl + 12}>
          <div className="flex flex-col py-0.5">
            {node.children.map((child) => (
              <ContextNodeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                ancestors={[...ancestors, entry]}
                runningTitles={runningTitles}
                driftCounts={driftCounts}
              />
            ))}
          </div>
        </GuideContent>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Workspace tree section ── */

function WorkspaceTreeSection({
  nodes,
  runningTitles,
  driftCounts,
}: {
  nodes: ContextNode[];
  runningTitles: Set<string>;
  driftCounts: Map<string, number>;
}) {
  return (
    <SectionHeader label="Workspace">
      {nodes.map((node) => (
        <ContextNodeItem
          key={node.id}
          node={node}
          depth={0}
          ancestors={[]}
          runningTitles={runningTitles}
          driftCounts={driftCounts}
        />
      ))}
    </SectionHeader>
  );
}

/* ── Loading skeleton ── */

function ContextPaneSkeleton() {
  return (
    <div className="p-3 space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    </div>
  );
}

/* ── Main component ── */

interface ContextPaneProps {
  projectId?: string;
  companyId?: string;
}

export function ContextPane({ projectId, companyId }: ContextPaneProps) {
  const { data: wsCtx, isLoading, error } = useWorkspaceContext(projectId, companyId);

  const { data: liveRuns = [] } = useQuery({
    queryKey: queryKeys.liveRuns(companyId ?? ""),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId!),
    enabled: !!companyId,
  });

  const { data: activeIssues = [] } = useQuery({
    queryKey: [...queryKeys.issues.list(companyId ?? ""), "in_progress"],
    queryFn: () =>
      import("../api/issues").then((mod) =>
        mod.issuesApi.list(companyId!, { status: "in_progress" }),
      ),
    enabled: !!companyId && liveRuns.length > 0,
  });

  const { data: driftReports = [] } = useDriftResults(projectId, companyId);

  const runningTitles = useMemo(() => {
    const titles = new Set<string>();
    if (!wsCtx?.detected || liveRuns.length === 0) return titles;
    const runningIssueIds = new Set(
      liveRuns.filter((r) => r.status === "running" && r.issueId).map((r) => r.issueId),
    );
    for (const issue of activeIssues) {
      if (!runningIssueIds.has(issue.id)) continue;
      const match = issue.title?.match(/^\[[\w-]+\]\s*(.+)$/);
      if (match) titles.add(match[1]);
    }
    return titles;
  }, [wsCtx, liveRuns, activeIssues]);

  // Compute drift counts per document path (only count pending drifts)
  const driftCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const report of driftReports) {
      for (const drift of report.drifts) {
        if (drift.decision !== "pending") continue;
        const inc = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
        inc(report.sourceDoc);
        inc(report.targetDoc);
      }
    }
    return counts;
  }, [driftReports]);

  if (isLoading) return <ContextPaneSkeleton />;

  if (error || !wsCtx || !wsCtx.detected) {
    return <EmptyState icon={FolderOpen} message="No context" />;
  }

  const hasPlanning = wsCtx.planningArtifacts.length > 0;
  const hasTree = wsCtx.tree.length > 0;

  if (!hasPlanning && !hasTree) {
    return <EmptyState icon={FolderOpen} message="No workspace structure detected" />;
  }

  return (
    <ScrollArea className="h-full">
      <div className="py-2 space-y-1">
        {hasPlanning && <PlanningSection artifacts={wsCtx.planningArtifacts} driftCounts={driftCounts} />}
        {hasTree && <WorkspaceTreeSection nodes={wsCtx.tree} runningTitles={runningTitles} driftCounts={driftCounts} />}
      </div>
    </ScrollArea>
  );
}
