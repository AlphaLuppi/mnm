import { useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Clock,
  DollarSign,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Wrench,
  CheckCircle,
  Hourglass,
} from "lucide-react";
import {
  useProjectLiveTraces,
  type LiveAgentTrace,
} from "../../hooks/useProjectLiveTraces";
import { tracesApi, type Trace } from "../../api/traces";
import { queryKeys } from "../../lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { cn, formatTokens } from "../../lib/utils";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function elapsedMs(startedAt: string): number {
  return Date.now() - new Date(startedAt).getTime();
}

interface LiveAgentCardProps {
  liveAgent: LiveAgentTrace;
  companyId: string;
}

function LiveAgentCard({ liveAgent, companyId }: LiveAgentCardProps) {
  const { trace, agentName } = liveAgent;

  // Fetch trace detail for current observation
  const { data: traceDetail } = useQuery({
    queryKey: queryKeys.traces.detail(companyId, trace.id),
    queryFn: () => tracesApi.detail(companyId, trace.id),
    enabled: !!companyId && trace.status === "running",
    refetchInterval: 3_000,
  });

  // Find the most recent / currently running observation
  const currentObs = useMemo(() => {
    if (!traceDetail?.observations) return null;
    const obs = traceDetail.observations;
    // Find running observations first
    const running = obs.filter((o) => !o.completedAt);
    if (running.length > 0) {
      return running[running.length - 1];
    }
    // Otherwise, most recent completed
    const sorted = [...obs].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    return sorted[0] ?? null;
  }, [traceDetail]);

  const observationCount = traceDetail?.observations?.length ?? 0;

  return (
    <div
      data-testid={`trace-13-agent-${trace.agentId}`}
      className="rounded-md border border-border bg-card px-3 py-2.5 space-y-2"
    >
      {/* Agent header */}
      <Link
        to={`/traces/${trace.id}`}
        className="flex items-center justify-between gap-2 no-underline text-inherit hover:text-foreground"
        data-testid={`trace-13-agent-link-${trace.agentId}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{agentName}</span>
          <Badge variant="default" className="text-[10px] h-5">
            <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
            Running
          </Badge>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </Link>

      {/* Current observation */}
      {currentObs && (
        <div
          data-testid={`trace-13-current-obs-${trace.agentId}`}
          className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-sm px-2 py-1.5"
        >
          <Wrench className="h-3 w-3 shrink-0" />
          <span className="font-mono truncate flex-1">
            {currentObs.name}
          </span>
          {!currentObs.completedAt && (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          )}
        </div>
      )}

      {/* Live counters */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Wrench className="h-3 w-3" />
          {observationCount} obs
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(elapsedMs(trace.startedAt))}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          {formatCost(trace.totalCostUsd)}
        </span>
      </div>
    </div>
  );
}

function CompletedAgentCard({ trace, agentName }: { trace: Trace; agentName: string }) {
  return (
    <div
      data-testid={`trace-13-completed-${trace.agentId}`}
      className="rounded-md border border-border bg-card/50 px-3 py-2 space-y-1"
    >
      <Link
        to={`/traces/${trace.id}`}
        className="flex items-center justify-between gap-2 no-underline text-inherit hover:text-foreground"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium truncate">{agentName}</span>
          <Badge
            variant={trace.status === "failed" ? "destructive" : "secondary"}
            className="text-[10px] h-5"
          >
            {trace.status === "completed" && <CheckCircle className="h-2.5 w-2.5 mr-0.5" />}
            {trace.status.charAt(0).toUpperCase() + trace.status.slice(1)}
          </Badge>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </Link>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>{formatDuration(trace.totalDurationMs ?? 0)}</span>
        <span>{formatCost(trace.totalCostUsd)}</span>
        <span>{formatTokens(trace.totalTokensIn + trace.totalTokensOut)} tok</span>
      </div>
    </div>
  );
}

interface WaitingAgentProps {
  agentName: string;
  waitingFor: string;
}

function WaitingAgentCard({ agentName, waitingFor }: WaitingAgentProps) {
  return (
    <div
      data-testid={`trace-13-waiting-${agentName}`}
      className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 flex items-center gap-2"
    >
      <Hourglass className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
      <span className="text-xs text-muted-foreground">
        <span className="font-medium">{agentName}</span> waiting for{" "}
        <span className="font-medium">{waitingFor}</span>
      </span>
    </div>
  );
}

interface MultiAgentLivePanelProps {
  companyId: string;
}

export function MultiAgentLivePanel({ companyId }: MultiAgentLivePanelProps) {
  const { liveTraces, liveCount, fileConflicts } =
    useProjectLiveTraces(companyId);

  // Also fetch recent completed traces for context
  const { data: recentData } = useQuery({
    queryKey: queryKeys.traces.list(companyId, {
      status: "completed",
      limit: 3,
    } as Record<string, unknown>),
    queryFn: () =>
      tracesApi.list(companyId, { status: "completed", limit: 3 }),
    enabled: !!companyId && liveCount > 0,
  });

  if (liveCount === 0) return null;

  const recentCompleted = recentData?.data ?? [];

  return (
    <div data-testid="trace-13-panel" className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Active Agents ({liveCount})
        </h3>
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
        </span>
      </div>

      {/* File conflict warnings */}
      {fileConflicts.length > 0 && (
        <div data-testid="trace-13-conflicts" className="space-y-1">
          {fileConflicts.map((conflict) => (
            <div
              key={conflict.file}
              className="flex items-center gap-2 text-xs rounded-sm border border-amber-300/30 bg-amber-50/50 dark:bg-amber-950/30 px-2 py-1.5"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-amber-700 dark:text-amber-300">
                Potential conflict: <span className="font-mono">{conflict.file}</span>{" "}
                ({conflict.agents.join(", ")})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Live agent cards */}
      <div className="space-y-2">
        {liveTraces.map((lt) => (
          <LiveAgentCard
            key={lt.trace.id}
            liveAgent={lt}
            companyId={companyId}
          />
        ))}
      </div>

      {/* Mini timeline — shows live bars */}
      {liveCount > 1 && (
        <div data-testid="trace-13-mini-timeline" className="space-y-1">
          <h4 className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Timeline
          </h4>
          {liveTraces.map((lt) => {
            const elapsed = elapsedMs(lt.trace.startedAt);
            const maxElapsed = Math.max(
              ...liveTraces.map((t) => elapsedMs(t.trace.startedAt)),
              1,
            );
            const widthPct = Math.max((elapsed / maxElapsed) * 100, 5);
            return (
              <div
                key={lt.trace.id}
                className="flex items-center gap-2 h-5"
              >
                <span className="w-[80px] text-[10px] truncate text-muted-foreground">
                  {lt.agentName}
                </span>
                <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-sm animate-pulse"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recently completed */}
      {recentCompleted.length > 0 && (
        <div data-testid="trace-13-recent" className="space-y-1.5 pt-2 border-t border-border">
          <h4 className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Recently Completed
          </h4>
          {recentCompleted.map((trace) => (
            <CompletedAgentCard
              key={trace.id}
              trace={trace}
              agentName={trace.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
