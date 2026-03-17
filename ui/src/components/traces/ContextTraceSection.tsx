import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { Bot, Clock, DollarSign, Loader2, Sparkles, ChevronRight } from "lucide-react";
import { tracesApi, type Trace } from "../../api/traces";
import { lensesApi } from "../../api/lenses";
import { agentsApi } from "../../api/agents";
import { queryKeys } from "../../lib/queryKeys";
import { MarkdownBody } from "../MarkdownBody";
import { Badge } from "@/components/ui/badge";
import { formatTokens, formatDuration, formatCost } from "../../lib/utils";

interface AgentTraceSummaryProps {
  trace: Trace;
  agentName: string | null;
  companyId: string;
}

function AgentTraceSummary({ trace, agentName, companyId }: AgentTraceSummaryProps) {
  const isRunning = trace.status === "running";

  // Auto-load default lens result for completed traces
  const { data: lenses } = useQuery({
    queryKey: queryKeys.lenses.list(companyId),
    queryFn: () => lensesApi.list(companyId),
    enabled: !!companyId && !isRunning,
  });

  const defaultLens = useMemo(
    () => (lenses ?? []).find((l) => l.isDefault && !l.isTemplate),
    [lenses],
  );

  const { data: lensResult } = useQuery({
    queryKey: defaultLens
      ? queryKeys.lenses.result(companyId, defaultLens.id, trace.id)
      : ["noop"],
    queryFn: () =>
      defaultLens
        ? lensesApi.getResult(companyId, defaultLens.id, trace.id)
        : Promise.reject(),
    enabled: !!defaultLens && !isRunning,
    retry: false,
  });

  return (
    <div
      data-testid={`trace-10-context-agent-${trace.agentId}`}
      className="space-y-2"
    >
      {/* Agent header */}
      <Link
        to={`/traces/${trace.id}`}
        className="flex items-center justify-between gap-2 no-underline text-inherit hover:bg-accent/30 rounded-sm px-2 py-1.5 -mx-2 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium truncate">
            {agentName ?? trace.agentId.slice(0, 8)}
          </span>
          {isRunning ? (
            <Badge variant="default" className="text-[10px] h-5">
              <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
              Running
            </Badge>
          ) : (
            <Badge
              variant={trace.status === "failed" ? "destructive" : "secondary"}
              className="text-[10px] h-5"
            >
              {trace.status.charAt(0).toUpperCase() + trace.status.slice(1)}
            </Badge>
          )}
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </Link>

      {/* Mini stats */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-2">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(trace.totalDurationMs)}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          {formatCost(trace.totalCostUsd)}
        </span>
        <span>
          {formatTokens(trace.totalTokensIn + trace.totalTokensOut)} tok
        </span>
      </div>

      {/* Default lens result (if completed and result exists) */}
      {lensResult && (
        <div className="px-2">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
            <Sparkles className="h-3 w-3" />
            {defaultLens?.name ?? "Analysis"}
          </div>
          <div className="text-xs prose prose-sm dark:prose-invert max-w-none line-clamp-4">
            <MarkdownBody className="text-xs">
              {lensResult.resultMarkdown.slice(0, 500)}
            </MarkdownBody>
          </div>
        </div>
      )}
    </div>
  );
}

interface ContextTraceSectionProps {
  companyId: string;
  projectId?: string;
}

export function ContextTraceSection({ companyId, projectId }: ContextTraceSectionProps) {
  // Fetch recent/active traces
  const { data: tracesData } = useQuery({
    queryKey: queryKeys.traces.list(companyId, { limit: 5 } as Record<string, unknown>),
    queryFn: () => tracesApi.list(companyId, { limit: 5 }),
    enabled: !!companyId,
    refetchInterval: 10_000, // poll for live trace updates
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents ?? []) map.set(a.id, a.name);
    return map;
  }, [agents]);

  const traces = tracesData?.data ?? [];
  const activeTraces = traces.filter((t) => t.status === "running");
  const recentCompleted = traces.filter((t) => t.status !== "running").slice(0, 3);
  const displayTraces = activeTraces.length > 0 ? activeTraces : recentCompleted;

  if (displayTraces.length === 0) return null;

  return (
    <div data-testid="trace-10-context-section" className="space-y-3">
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-2">
        {activeTraces.length > 0
          ? `Active Agents (${activeTraces.length})`
          : "Recent Traces"}
      </h3>
      <div className="space-y-3 divide-y divide-border">
        {displayTraces.map((trace) => (
          <AgentTraceSummary
            key={trace.id}
            trace={trace}
            agentName={agentMap.get(trace.agentId) ?? null}
            companyId={companyId}
          />
        ))}
      </div>
    </div>
  );
}
