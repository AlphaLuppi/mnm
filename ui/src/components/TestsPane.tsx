import { useState, useCallback, useMemo } from "react";
import { FlaskConical, ChevronRight, Circle, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useProjectNavigation } from "../context/ProjectNavigationContext";
import { useBmadProject } from "../hooks/useBmadProject";
import { useDriftResults } from "../hooks/useDriftResults";
import { DriftAlertCard } from "./DriftAlertCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "../lib/utils";
import type { BmadEpic, BmadStory, BmadAcceptanceCriterion, DriftItem } from "@mnm/shared";

/* ── AC status type (all pending for now, extensible later) ── */

type ACStatus = "pending" | "pass" | "fail";

const statusIcon: Record<ACStatus, typeof Circle> = {
  pending: Circle,
  pass: CheckCircle2,
  fail: XCircle,
};

const statusColor: Record<ACStatus, string> = {
  pending: "text-muted-foreground",
  pass: "text-green-500",
  fail: "text-red-500",
};

/* ── Test Card ── */

function TestCard({
  ac,
  epicNumber,
  storyId,
  status = "pending",
}: {
  ac: BmadAcceptanceCriterion;
  epicNumber: number;
  storyId: string;
  status?: ACStatus;
}) {
  const { selectStory } = useProjectNavigation();
  const Icon = statusIcon[status];

  return (
    <button
      onClick={() => selectStory(String(epicNumber), storyId)}
      className="w-full text-left rounded-md border border-border bg-card p-2.5 hover:bg-accent/50 transition-colors cursor-pointer space-y-1.5"
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", statusColor[status])} />
        <span className="text-[10px] font-mono text-muted-foreground">{ac.id}</span>
        <span className="text-xs font-medium flex-1 truncate">{ac.title}</span>
      </div>
      <div className="space-y-0.5 text-[11px] text-muted-foreground pl-5">
        {ac.given && (
          <p><span className="font-semibold text-foreground/80">Given</span> {ac.given}</p>
        )}
        {ac.when && (
          <p><span className="font-semibold text-foreground/80">When</span> {ac.when}</p>
        )}
        {ac.then && ac.then.length > 0 && (
          <div>
            <span className="font-semibold text-foreground/80">Then</span>
            {ac.then.map((t, i) => (
              <p key={i} className="ml-2">{t}</p>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

/* ── Summary counts ── */

function SummaryCounts({ total, pending, pass, fail }: { total: number; pending: number; pass: number; fail: number }) {
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums">
      {total} AC{total !== 1 ? "s" : ""}
      {pass > 0 && <span className="text-green-500 ml-1">{pass} pass</span>}
      {fail > 0 && <span className="text-red-500 ml-1">{fail} fail</span>}
      {pending > 0 && <span className="ml-1">{pending} pending</span>}
    </span>
  );
}

/* ── Story AC group ── */

function StoryACGroup({ story, epicNumber, defaultOpen = false }: { story: BmadStory; epicNumber: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const total = story.acceptanceCriteria.length;
  if (total === 0) return null;

  // All pending for now
  const pending = total;
  const pass = 0;
  const fail = 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium hover:bg-accent/50 rounded transition-colors cursor-pointer">
        <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")} />
        <span className="flex-1 truncate text-left">
          {story.epicNumber}.{story.storyNumber} {story.title}
        </span>
        <SummaryCounts total={total} pending={pending} pass={pass} fail={fail} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-1.5 pl-4 pr-1 py-1">
          {story.acceptanceCriteria.map((ac) => (
            <TestCard key={ac.id} ac={ac} epicNumber={epicNumber} storyId={story.id} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Epic AC group ── */

function EpicACGroup({ epic, filterStoryId, defaultOpen = false }: { epic: BmadEpic; filterStoryId?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const stories = filterStoryId
    ? epic.stories.filter((s) => s.id === filterStoryId)
    : epic.stories;
  const totalACs = stories.reduce((sum, s) => sum + s.acceptanceCriteria.length, 0);
  if (totalACs === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors cursor-pointer">
        <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")} />
        <span className="flex-1 truncate text-left">
          Epic {epic.number}{epic.title ? `: ${epic.title}` : ""}
        </span>
        <SummaryCounts total={totalACs} pending={totalACs} pass={0} fail={0} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 pl-2">
          {stories.map((story) => (
            <StoryACGroup
              key={story.id}
              story={story}
              epicNumber={epic.number}
              defaultOpen={!!filterStoryId}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Empty state ── */

function TestsPaneEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
      <FlaskConical className="h-8 w-8" />
      <p className="text-sm font-medium">Tests & Validation</p>
      <p className="text-xs text-center max-w-[200px]">{message}</p>
    </div>
  );
}

/* ── Ignored drift IDs (localStorage) ── */

const IGNORED_DRIFTS_KEY = "mnm:ignored-drifts";

function getIgnoredDriftIds(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORED_DRIFTS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function addIgnoredDriftId(id: string) {
  const ids = getIgnoredDriftIds();
  ids.add(id);
  localStorage.setItem(IGNORED_DRIFTS_KEY, JSON.stringify([...ids]));
}

/* ── Drift Alerts Section ── */

function DriftAlertsSection({ projectId, companyId }: { projectId?: string; companyId?: string }) {
  const { data: reports = [] } = useDriftResults(projectId, companyId);
  const [ignoredIds, setIgnoredIds] = useState(() => getIgnoredDriftIds());

  const allDrifts = useMemo(() => {
    const drifts: DriftItem[] = [];
    for (const report of reports) {
      for (const d of report.drifts) {
        if (!ignoredIds.has(d.id)) drifts.push(d);
      }
    }
    return drifts;
  }, [reports, ignoredIds]);

  const handleIgnore = useCallback((drift: DriftItem) => {
    addIgnoredDriftId(drift.id);
    setIgnoredIds((prev) => new Set([...prev, drift.id]));
  }, []);

  const handleFixSource = useCallback((_drift: DriftItem) => {
    // Navigate to source doc — for now just log
    // In a full implementation this would use selectArtifact + open LaunchAgentDialog
  }, []);

  const handleFixTarget = useCallback((_drift: DriftItem) => {
    // Navigate to target doc — for now just log
  }, []);

  if (allDrifts.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      <div className="flex items-center gap-1.5 px-2">
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Drift Alerts
        </span>
        <span className="ml-auto rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
          {allDrifts.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 px-2">
        {allDrifts.map((drift) => (
          <DriftAlertCard
            key={drift.id}
            drift={drift}
            onFixSource={handleFixSource}
            onFixTarget={handleFixTarget}
            onIgnore={handleIgnore}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Main TestsPane ── */

interface TestsPaneProps {
  projectId?: string;
  companyId?: string;
}

export function TestsPane({ projectId, companyId }: TestsPaneProps) {
  const { selectedItem } = useProjectNavigation();
  const { data: bmad, isLoading } = useBmadProject(projectId, companyId);

  if (isLoading) {
    return <TestsPaneEmpty message="Loading..." />;
  }

  const driftSection = <DriftAlertsSection projectId={projectId} companyId={companyId} />;

  if (!bmad?.detected || bmad.epics.length === 0) {
    return (
      <ScrollArea className="h-full">
        <div className="p-2">
          {driftSection}
          <TestsPaneEmpty message="No BMAD acceptance criteria found." />
        </div>
      </ScrollArea>
    );
  }

  // Story selected → show only that story's ACs
  if (selectedItem?.type === "story") {
    const [epicId, ...rest] = selectedItem.id.split("/");
    const storyId = rest.join("/");
    const epic = bmad.epics.find((e) => String(e.number) === epicId);
    if (epic) {
      const story = epic.stories.find((s) => s.id === storyId);
      if (story && story.acceptanceCriteria.length > 0) {
        return (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {driftSection}
              <EpicACGroup epic={epic} filterStoryId={storyId} defaultOpen />
            </div>
          </ScrollArea>
        );
      }
      return (
        <ScrollArea className="h-full">
          <div className="p-2">
            {driftSection}
            <TestsPaneEmpty message="This story has no acceptance criteria." />
          </div>
        </ScrollArea>
      );
    }
  }

  // Epic selected → show that epic's ACs
  if (selectedItem?.type === "epic") {
    const epic = bmad.epics.find((e) => String(e.number) === selectedItem.id);
    if (epic) {
      const totalACs = epic.stories.reduce((sum, s) => sum + s.acceptanceCriteria.length, 0);
      if (totalACs > 0) {
        return (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {driftSection}
              <EpicACGroup epic={epic} defaultOpen />
            </div>
          </ScrollArea>
        );
      }
      return (
        <ScrollArea className="h-full">
          <div className="p-2">
            {driftSection}
            <TestsPaneEmpty message="This epic has no acceptance criteria." />
          </div>
        </ScrollArea>
      );
    }
  }

  // Artifact selected → show drift alerts only
  if (selectedItem?.type === "artifact") {
    return (
      <ScrollArea className="h-full">
        <div className="p-2">
          {driftSection}
          <TestsPaneEmpty message="Select a story or epic to view acceptance criteria." />
        </div>
      </ScrollArea>
    );
  }

  // No selection → show all ACs grouped by Epic → Story
  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {driftSection}
        {bmad.epics.map((epic) => (
          <EpicACGroup key={epic.number} epic={epic} defaultOpen />
        ))}
      </div>
    </ScrollArea>
  );
}
