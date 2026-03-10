import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Building2,
  LayoutList,
  BookOpen,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { BmadProject, BmadEpic, BmadStory, BmadPlanningArtifact } from "@mnm/shared";
import { useBmadProject } from "../hooks/useBmadProject";
import { useProjectNavigation } from "../context/ProjectNavigationContext";
import { heartbeatsApi, type LiveRunForIssue } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

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

/* ── Story status → badge mapping (BMAD uses kebab-case) ── */

const bmadStatusBadge: Record<string, string> = {
  backlog: "bg-muted text-muted-foreground",
  "ready-for-dev": "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "in-progress": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  review: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
};

function StoryStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const colors = bmadStatusBadge[status] ?? statusBadge[status] ?? statusBadgeDefault;
  return (
    <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium", colors)}>
      {status.replace(/-/g, " ")}
    </span>
  );
}

/* ── Progress indicator ── */

function ProgressText({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums">
      {done}/{total}
    </span>
  );
}

/* ── Section header (collapsible) ── */

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
      <CollapsibleTrigger className="flex items-center gap-1 w-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer">
        <ChevronRight
          className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
        />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 mt-0.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Tree item (artifact or story row) ── */

function TreeItem({
  icon: Icon,
  label,
  selected,
  onClick,
  indent = 0,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onClick: () => void;
  indent?: number;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-1.5 text-[13px] font-medium transition-colors text-left cursor-pointer",
        selected
          ? "bg-accent text-foreground"
          : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
      )}
      style={{ paddingLeft: `${0.75 + indent * 1}rem` }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

/* ── Epic section (collapsible with stories) ── */

function EpicSection({ epic, runningStoryTitles }: { epic: BmadEpic; runningStoryTitles: Set<string> }) {
  const [open, setOpen] = useState(false);
  const { selectedItem, selectEpic, selectStory } = useProjectNavigation();
  const epicId = String(epic.number);
  const isEpicSelected = selectedItem?.type === "epic" && selectedItem.id === epicId;

  // Auto-expand when a child story is selected (e.g. from TestsPane click)
  const hasSelectedChild = selectedItem?.type === "story" && selectedItem.id.startsWith(`${epicId}/`);
  useEffect(() => {
    if (hasSelectedChild && !open) setOpen(true);
  }, [hasSelectedChild]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          onClick={(e) => {
            e.preventDefault();
            selectEpic(epicId);
            setOpen((prev) => !prev);
          }}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-1.5 text-[13px] font-medium transition-colors text-left cursor-pointer",
            isEpicSelected
              ? "bg-accent text-foreground"
              : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
          )}
          style={{ paddingLeft: "0.75rem" }}
        >
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")}
          />
          <BookOpen className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">
            Epic {epic.number}{epic.title ? `: ${epic.title}` : ""}
          </span>
          <ProgressText done={epic.progress.done} total={epic.progress.total} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-0.5">
          {epic.stories.map((story) => {
            const storyTitle = `${story.epicNumber}.${story.storyNumber} ${story.title}`;
            return (
              <StoryRow
                key={story.id}
                story={story}
                epicId={epicId}
                isRunning={runningStoryTitles.has(storyTitle)}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Running indicator dot ── */

function RunningDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
  );
}

function StoryRow({ story, epicId, isRunning }: { story: BmadStory; epicId: string; isRunning?: boolean }) {
  const { selectedItem, selectStory } = useProjectNavigation();
  const storyItemId = `${epicId}/${story.id}`;
  const isSelected = selectedItem?.type === "story" && selectedItem.id === storyItemId;

  return (
    <TreeItem
      icon={FileText}
      label={`${story.epicNumber}.${story.storyNumber} ${story.title}`}
      selected={isSelected}
      onClick={() => selectStory(epicId, story.id, story.filePath)}
      indent={2}
      trailing={
        <span className="flex items-center gap-1.5">
          {isRunning && <RunningDot />}
          <StoryStatusBadge status={story.status} />
        </span>
      }
    />
  );
}

/* ── Planning artifacts section ── */

function ArtifactItem({ artifact, indent = 0 }: { artifact: BmadPlanningArtifact; indent?: number }) {
  const { selectedItem, selectArtifact } = useProjectNavigation();
  const Icon = getArtifactIcon(artifact.type);
  const isSelected = selectedItem?.type === "artifact" && selectedItem.id === artifact.filePath;
  return (
    <TreeItem
      icon={Icon}
      label={artifact.title}
      selected={isSelected}
      onClick={() => selectArtifact(artifact.filePath)}
      indent={indent}
    />
  );
}

function PlanningFolderSection({ name, artifacts }: { name: string; artifacts: BmadPlanningArtifact[] }) {
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
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-1.5 text-[13px] font-medium transition-colors text-left cursor-pointer text-foreground/80 hover:bg-accent/50 hover:text-foreground">
        <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")} />
        <FolderOpen className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-0.5">
          {artifacts.map((artifact) => (
            <ArtifactItem key={artifact.filePath} artifact={artifact} indent={1} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PlanningSection({ artifacts }: { artifacts: BmadPlanningArtifact[] }) {
  // Group by subfolder: "planning-artifacts/etape-1/prd.md" → folder "etape-1"
  const { rootArtifacts, folders } = useMemo(() => {
    const map = new Map<string, BmadPlanningArtifact[]>();
    const root: BmadPlanningArtifact[] = [];
    for (const artifact of artifacts) {
      const parts = artifact.filePath.split(/[/\\]/);
      // parts[0] = "planning-artifacts", parts[1] = subfolder or filename
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
        <ArtifactItem key={artifact.filePath} artifact={artifact} />
      ))}
      {[...folders.entries()].map(([name, items]) => (
        <PlanningFolderSection key={name} name={name} artifacts={items} />
      ))}
    </SectionHeader>
  );
}

/* ── Epics section ── */

function EpicsSection({ epics, runningStoryTitles }: { epics: BmadEpic[]; runningStoryTitles: Set<string> }) {
  return (
    <SectionHeader label="Epics">
      {epics.map((epic) => (
        <EpicSection key={epic.number} epic={epic} runningStoryTitles={runningStoryTitles} />
      ))}
    </SectionHeader>
  );
}

/* ── Loading skeleton ── */

function ContextPaneSkeleton() {
  return (
    <div className="p-3 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-3/4" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
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
  const { data: bmad, isLoading, error } = useBmadProject(projectId, companyId);

  // Fetch live runs to detect running stories (Story 2-2)
  const { data: liveRuns = [] } = useQuery({
    queryKey: queryKeys.liveRuns(companyId ?? ""),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId!),
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  // Fetch in-progress issues to match running agents to story titles
  const { data: activeIssues = [] } = useQuery({
    queryKey: [...queryKeys.issues.list(companyId ?? ""), "in_progress"],
    queryFn: () =>
      import("../api/issues").then((mod) =>
        mod.issuesApi.list(companyId!, { status: "in_progress" }),
      ),
    enabled: !!companyId && liveRuns.length > 0,
    refetchInterval: 10000,
  });

  // Build a set of story titles that have running agents
  const runningStoryTitles = useMemo(() => {
    const titles = new Set<string>();
    if (!bmad?.detected || liveRuns.length === 0) return titles;
    const runningIssueIds = new Set(
      liveRuns.filter((r) => r.status === "running" && r.issueId).map((r) => r.issueId),
    );
    for (const issue of activeIssues) {
      if (!runningIssueIds.has(issue.id)) continue;
      // Issue titles are formatted as "[workflow-type] X.Y Title"
      // Extract story title by removing the workflow prefix
      const match = issue.title?.match(/^\[[\w-]+\]\s*(.+)$/);
      if (match) titles.add(match[1]);
    }
    return titles;
  }, [bmad, liveRuns, activeIssues]);

  if (isLoading) return <ContextPaneSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-4">
        <p className="text-sm text-destructive">Failed to load BMAD data</p>
        <p className="text-xs text-center">{(error as Error).message}</p>
      </div>
    );
  }

  if (!bmad || !bmad.detected) {
    return <EmptyState icon={FolderOpen} message="No BMAD structure detected" />;
  }

  const hasPlanning = bmad.planningArtifacts.length > 0;
  const hasEpics = bmad.epics.length > 0;

  if (!hasPlanning && !hasEpics) {
    return <EmptyState icon={FolderOpen} message="No BMAD structure detected" />;
  }

  return (
    <ScrollArea className="h-full">
      <div className="py-2 space-y-1">
        {hasPlanning && <PlanningSection artifacts={bmad.planningArtifacts} />}
        {hasEpics && <EpicsSection epics={bmad.epics} runningStoryTitles={runningStoryTitles} />}
      </div>
    </ScrollArea>
  );
}
