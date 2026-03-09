import { useState, useMemo } from "react";
import { FileText, BookOpen, ChevronRight, CheckCircle2, Circle, Rocket, Search, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useProjectNavigation } from "../context/ProjectNavigationContext";
import { useBmadProject, useBmadFile } from "../hooks/useBmadProject";
import { useDriftCheck } from "../hooks/useDriftResults";
import { queryKeys } from "../lib/queryKeys";
import { MarkdownBody } from "./MarkdownBody";
import { LiveRunWidget } from "./LiveRunWidget";
import { LaunchAgentDialog } from "./LaunchAgentDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "../lib/utils";
import type { ReactNode } from "react";
import type { BmadEpic, BmadStory, BmadAcceptanceCriterion } from "@mnm/shared";

/* ── Status badge (reused from ContextPane conventions) ── */

const bmadStatusBadge: Record<string, string> = {
  backlog: "bg-muted text-muted-foreground",
  "ready-for-dev": "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "in-progress": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  review: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
};

function StatusBadgeInline({ status }: { status: string | null }) {
  if (!status) return null;
  const colors = bmadStatusBadge[status] ?? "bg-muted text-muted-foreground";
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

/* ── Spec Viewer (artifact markdown) ── */

function SpecViewer({ projectId, path, companyId }: { projectId: string; path: string; companyId?: string }) {
  const { data: content, isLoading, error } = useBmadFile(projectId, path, companyId);
  const { clearSelection } = useProjectNavigation();
  const driftCheck = useDriftCheck(projectId, companyId);

  const fileName = path.split("/").pop()?.replace(/\.md$/, "") ?? path;

  const handleDriftCheck = () => {
    // Compare this artifact against a related document (mock: use path itself)
    driftCheck.mutate({ sourceDoc: path, targetDoc: path });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load: {(error as Error).message}</p>;
  }

  return (
    <div>
      <Breadcrumb segments={[
        { label: "Project", onClick: clearSelection },
        { label: fileName },
      ]} />
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">{fileName}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          artifact
        </span>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDriftCheck}
            disabled={driftCheck.isPending}
            className="gap-1.5"
          >
            {driftCheck.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Vérifier le drift
          </Button>
        </div>
      </div>
      <MarkdownBody>{content ?? ""}</MarkdownBody>
    </div>
  );
}

/* ── AC Card (for StoryViewer) ── */

function ACCard({ ac }: { ac: BmadAcceptanceCriterion }) {
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

function StoryViewer({ story, epicNumber, companyId, projectId }: { story: BmadStory; epicNumber: number; companyId?: string; projectId?: string }) {
  const { selectEpic, clearSelection } = useProjectNavigation();
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
  const [justCreatedIssueId, setJustCreatedIssueId] = useState<string | null>(null);
  const driftCheck = useDriftCheck(projectId, companyId);

  const handleDriftCheck = () => {
    const storyPath = story.filePath ?? `story-${story.epicNumber}-${story.storyNumber}`;
    driftCheck.mutate({ sourceDoc: storyPath, targetDoc: storyPath });
  };

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
        <div className="ml-auto flex items-center gap-2">
          {projectId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDriftCheck}
              disabled={driftCheck.isPending}
              className="gap-1.5"
            >
              {driftCheck.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Vérifier le drift
            </Button>
          )}
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

function EpicOverview({ epic }: { epic: BmadEpic }) {
  const { selectStory, clearSelection } = useProjectNavigation();

  return (
    <div>
      <Breadcrumb segments={[
        { label: "Project", onClick: clearSelection },
        { label: `Epic ${epic.number}` },
      ]} />

      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">
          Epic {epic.number}{epic.title ? `: ${epic.title}` : ""}
        </h3>
      </div>

      <div className="space-y-3">
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

/* ── Main WorkPane ── */

interface WorkPaneProps {
  projectId?: string;
  companyId?: string;
  children: ReactNode;
}

export function WorkPane({ projectId, companyId, children }: WorkPaneProps) {
  const { selectedItem } = useProjectNavigation();
  const { data: bmad } = useBmadProject(projectId, companyId);

  // No selection → show default project content (children)
  if (!selectedItem) {
    return <div className="space-y-6">{children}</div>;
  }

  // Artifact selected → SpecViewer
  if (selectedItem.type === "artifact" && projectId && selectedItem.path) {
    return (
      <ScrollArea className="h-full">
        <div className="p-1">
          <SpecViewer projectId={projectId} path={selectedItem.path} companyId={companyId} />
        </div>
      </ScrollArea>
    );
  }

  // Epic selected → Epic overview
  if (selectedItem.type === "epic" && bmad?.detected) {
    const epic = bmad.epics.find((e) => String(e.number) === selectedItem.id);
    if (epic) {
      return (
        <ScrollArea className="h-full">
          <div className="p-1">
            <EpicOverview epic={epic} />
          </div>
        </ScrollArea>
      );
    }
  }

  // Story selected → Story detail
  if (selectedItem.type === "story" && bmad?.detected) {
    const [epicId] = selectedItem.id.split("/");
    const epic = bmad.epics.find((e) => String(e.number) === epicId);
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
