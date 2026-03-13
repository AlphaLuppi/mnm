"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bot,
  Activity,
  GitCompare,
  Clock,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTasks } from "@/hooks/use-tasks";
import { useAgents } from "@/hooks/use-agents";
import { useDashboard } from "@/hooks/use-dashboard";
import { ActivityDetailPanel } from "@/components/layout/activity-detail-panel";
import type { TaskEntry } from "@/lib/tasks/types";
import type { Agent } from "@/lib/core/types";

type Layer = "collapsed" | "expanded" | "detail";

interface ActivityBarProps {
  onToggleChat?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function LiveTimer({ startMs }: { startMs: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - startMs;
  const totalSec = Math.floor(elapsed / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;

  return (
    <span className="tabular-nums text-muted-foreground">
      {m > 0 ? `${m}m ${s}s` : `${s}s`}
    </span>
  );
}

function statusIcon(status: string) {
  switch (status) {
    case "running":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case "pending":
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "failed":
    case "error":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case "cancelled":
      return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "running":
      return "default" as const;
    case "completed":
      return "secondary" as const;
    case "failed":
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

// ---------------------------------------------------------------------------
// Collapsed Bar (Layer 1)
// ---------------------------------------------------------------------------

function CollapsedBar({
  tasksRunning,
  agentsRunning,
  driftsPending,
  onExpand,
  onToggleChat,
}: {
  tasksRunning: number;
  agentsRunning: number;
  driftsPending: number;
  onExpand: () => void;
  onToggleChat?: () => void;
}) {
  return (
    <div
      className="flex h-8 shrink-0 cursor-pointer items-center gap-4 border-t bg-background px-4 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onExpand();
      }}
    >
      {tasksRunning > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span>
            {tasksRunning} task{tasksRunning !== 1 ? "s" : ""} running
          </span>
        </div>
      )}

      {agentsRunning > 0 && (
        <div className="flex items-center gap-1.5">
          <Bot className="h-3 w-3" />
          <span>
            {agentsRunning} agent{agentsRunning !== 1 ? "s" : ""} active
          </span>
        </div>
      )}

      {driftsPending > 0 && (
        <div className="flex items-center gap-1.5">
          <GitCompare className="h-3 w-3" />
          <span>
            {driftsPending} drift{driftsPending !== 1 ? "s" : ""} pending
          </span>
        </div>
      )}

      {tasksRunning === 0 && agentsRunning === 0 && driftsPending === 0 && (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3" />
          <span>All clear</span>
        </div>
      )}

      <ChevronUp className="ml-auto h-3 w-3 opacity-50" />

      {/* Spacer before chat button */}
      <div className="flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onToggleChat?.();
              }}
              className="gap-1.5"
            >
              <Sparkles className="h-3 w-3" />
              <span className="hidden sm:inline">Ask Claude</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Toggle Claude Assistant (Ctrl+Shift+C)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded List Item
// ---------------------------------------------------------------------------

function ActivityListItem({
  icon,
  label,
  status,
  typeBadge,
  startedAt,
  completedAt,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  typeBadge: string;
  startedAt?: number | null;
  completedAt?: number | null;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{label}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {startedAt && !completedAt && (
          <div className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <LiveTimer startMs={startedAt} />
          </div>
        )}
        <Badge variant={statusBadgeVariant(status)} className="text-xs capitalize">
          {status}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {typeBadge}
        </Badge>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Expanded Panel (Layer 2)
// ---------------------------------------------------------------------------

function ExpandedPanel({
  tasks,
  agents,
  onCollapse,
  onSelectItem,
}: {
  tasks: TaskEntry[];
  agents: Agent[];
  onCollapse: () => void;
  onSelectItem: (type: "task" | "agent", id: string) => void;
}) {
  const hasCompleted =
    tasks.some((t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled") ||
    agents.some((a) => a.status === "completed" || a.status === "error");

  // Sort: active first, then by startedAt desc
  const sortedTasks = [...tasks].sort((a, b) => {
    const aActive = a.status === "running" || a.status === "pending" ? 0 : 1;
    const bActive = b.status === "running" || b.status === "pending" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return b.startedAt - a.startedAt;
  });

  const sortedAgents = [...agents].sort((a, b) => {
    const aActive = a.status === "running" || a.status === "pending" ? 0 : 1;
    const bActive = b.status === "running" || b.status === "pending" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt);
  });

  const [cleared, setCleared] = useState(false);

  const visibleTasks = cleared
    ? sortedTasks.filter((t) => t.status === "running" || t.status === "pending")
    : sortedTasks;

  const visibleAgents = cleared
    ? sortedAgents.filter((a) => a.status === "running" || a.status === "pending")
    : sortedAgents;

  const isEmpty = visibleTasks.length === 0 && visibleAgents.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs font-medium">Activity</span>
        <div className="flex items-center gap-2">
          {hasCompleted && !cleared && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setCleared(true)}
              className="text-xs text-muted-foreground"
            >
              Clear completed
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={onCollapse}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isEmpty && (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            No activity to show
          </div>
        )}

        {visibleTasks.length > 0 && (
          <div>
            <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
              Tasks
            </div>
            {visibleTasks.map((task) => (
              <ActivityListItem
                key={task.id}
                icon={statusIcon(task.status)}
                label={task.label}
                status={task.status}
                typeBadge={task.type}
                startedAt={task.startedAt}
                completedAt={task.completedAt}
                onClick={() => onSelectItem("task", task.id)}
              />
            ))}
          </div>
        )}

        {visibleTasks.length > 0 && visibleAgents.length > 0 && (
          <Separator />
        )}

        {visibleAgents.length > 0 && (
          <div>
            <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
              Agents
            </div>
            {visibleAgents.map((agent) => (
              <ActivityListItem
                key={agent.id}
                icon={statusIcon(agent.status)}
                label={agent.name}
                status={agent.status}
                typeBadge="agent"
                startedAt={agent.startedAt}
                completedAt={agent.completedAt}
                onClick={() => onSelectItem("agent", agent.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ActivityBar
// ---------------------------------------------------------------------------

const LAYER_HEIGHTS: Record<Layer, string> = {
  collapsed: "h-8",
  expanded: "h-[250px]",
  detail: "h-[50vh]",
};

export function ActivityBar({ onToggleChat }: ActivityBarProps) {
  const [layer, setLayer] = useState<Layer>("collapsed");
  const [selectedItem, setSelectedItem] = useState<{
    type: "task" | "agent";
    id: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const { tasks, running: tasksRunning } = useTasks();
  const { agents } = useAgents();
  const { dashboard } = useDashboard();

  const runningAgents = agents.filter(
    (a) => a.status === "running" || a.status === "pending"
  ).length;
  const driftsPending = dashboard?.drift?.pending ?? 0;

  const handleExpand = useCallback(() => {
    setLayer("expanded");
  }, []);

  const handleCollapse = useCallback(() => {
    setLayer("collapsed");
    setSelectedItem(null);
  }, []);

  const handleSelectItem = useCallback(
    (type: "task" | "agent", id: string) => {
      setSelectedItem({ type, id });
      setLayer("detail");
    },
    []
  );

  const handleBack = useCallback(() => {
    setSelectedItem(null);
    setLayer("expanded");
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${LAYER_HEIGHTS[layer]} shrink-0 border-t bg-background transition-all duration-200 overflow-hidden`}
    >
      {layer === "collapsed" && (
        <CollapsedBar
          tasksRunning={tasksRunning}
          agentsRunning={runningAgents}
          driftsPending={driftsPending}
          onExpand={handleExpand}
          onToggleChat={onToggleChat}
        />
      )}

      {layer === "expanded" && (
        <ExpandedPanel
          tasks={tasks}
          agents={agents}
          onCollapse={handleCollapse}
          onSelectItem={handleSelectItem}
        />
      )}

      {layer === "detail" && selectedItem && (
        <ActivityDetailPanel
          type={selectedItem.type}
          id={selectedItem.id}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
