import { useState, useEffect, useMemo } from "react";
import { useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  Clock,
  DollarSign,
  Loader2,
  Eye,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  Wrench,
  Brain,
  Circle,
  CheckCircle,
  XCircle,
  BookOpen,
  Code,
  Search,
  MessageSquare,
  Play,
  Trophy,
  HelpCircle,
} from "lucide-react";
import { Link } from "@/lib/router";
import { tracesApi } from "../api/traces";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { LensSelector } from "../components/traces/LensSelector";
import { LensAnalysisResult } from "../components/traces/LensAnalysisResult";
import { RawObservationTree } from "../components/traces/RawObservationTree";
import { GoldVerdictBanner } from "../components/traces/GoldVerdictBanner";
import { GoldPhaseCard } from "../components/traces/GoldPhaseCard";
import { TraceTimeline, MOCK_OBSERVATIONS, MOCK_PHASES, MOCK_GOLD } from "../components/traces/TraceTimeline";
import { TraceLayout } from "../components/traces/TraceLayout";
import { TraceTreeView } from "../components/traces/TraceTreeView";
import { TraceDetailPanel } from "../components/traces/TraceDetailPanel";
import { TraceDataProvider } from "../context/TraceDataContext";
import { TraceSelectionProvider } from "../context/TraceSelectionContext";
import { TraceViewPrefsProvider } from "../context/TraceViewPrefsContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTokens, relativeTime, formatDuration, formatCost, cn } from "../lib/utils";
import type { TraceStatus, TracePhase, TraceObservation, TraceDetail as TraceDetailType } from "../api/traces";

// Mock trace detail for demo mode (reuses MOCK_* from TraceTimeline)
const mockTraceDetail: TraceDetailType = {
  id: "mock-trace-001",
  companyId: "c1",
  heartbeatRunId: null,
  workflowInstanceId: null,
  stageInstanceId: null,
  agentId: "agent-mock",
  parentTraceId: null,
  name: "Demo: Fix auth bug",
  status: "completed",
  startedAt: "2026-03-18T10:00:00Z",
  completedAt: "2026-03-18T10:00:36Z",
  totalDurationMs: 36000,
  totalTokensIn: 18500,
  totalTokensOut: 4200,
  totalCostUsd: "0.34",
  metadata: null,
  tags: ["demo"],
  phases: MOCK_PHASES,
  gold: MOCK_GOLD,
  observations: MOCK_OBSERVATIONS,
  createdAt: "2026-03-18T10:00:00Z",
  updatedAt: "2026-03-18T10:00:36Z",
};

function statusVariant(status: TraceStatus): "secondary" | "outline" | "destructive" | "default" {
  switch (status) {
    case "running":
      return "default";
    case "completed":
      return "secondary";
    case "failed":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
}

export function TraceDetail() {
  const { traceId } = useParams<{ traceId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [showRaw, setShowRaw] = useState(false);
  const [showMock, setShowMock] = useState(false);
  const [selectedLensId, setSelectedLensId] = useState<string | null>(null);

  const { data: trace, isLoading, error } = useQuery({
    queryKey: queryKeys.traces.detail(selectedCompanyId!, traceId!),
    queryFn: () => tracesApi.detail(selectedCompanyId!, traceId!),
    enabled: !!selectedCompanyId && !!traceId,
    refetchInterval: (query) => {
      const d = query.state.data;
      return d && d.status === "running" ? 5000 : false;
    },
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentName = useMemo(() => {
    if (!trace || !agents) return null;
    return agents.find((a) => a.id === trace.agentId)?.name ?? null;
  }, [trace, agents]);

  // Map gold phases to silver phases by order
  const goldSilverMap = useMemo(() => {
    if (!trace?.gold?.phases || !trace?.phases) return new Map<number, TracePhase>();
    const silverByOrder = new Map(trace.phases.map((p) => [p.order, p]));
    return silverByOrder;
  }, [trace]);

  useEffect(() => {
    if (trace) {
      setBreadcrumbs([
        { label: "Traces", href: "/traces" },
        { label: trace.name || `Trace ${trace.id.slice(0, 8)}` },
      ]);
    }
    return () => setBreadcrumbs([]);
  }, [trace, setBreadcrumbs]);

  if (isLoading) {
    return (
      <div data-testid="trace-09-detail-loading">
        <PageSkeleton variant="list" />
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div data-testid="trace-09-detail-error" className="p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Trace not found"}
      </div>
    );
  }

  const isRunning = trace.status === "running";
  const totalTokens = trace.totalTokensIn + trace.totalTokensOut;
  const observationCount = trace.observations?.length ?? 0;
  const hasGold = !!trace.gold && trace.gold.phases.length > 0;
  const hasPhases = !!trace.phases && trace.phases.length > 0;

  return (
    <div data-testid="trace-09-detail" className="space-y-6">
      {/* Back link */}
      <Link
        to="/traces"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline"
        data-testid="trace-09-back"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Traces
      </Link>

      {/* Header */}
      <div data-testid="trace-09-detail-header" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">
              {trace.name || `Trace ${trace.id.slice(0, 8)}`}
            </h1>
            <Badge variant={statusVariant(trace.status)}>
              {isRunning && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {trace.status.charAt(0).toUpperCase() + trace.status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span data-testid="trace-09-agent" className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            {agentName ?? trace.agentId.slice(0, 8)}
          </span>
          <span data-testid="trace-09-duration" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(trace.totalDurationMs)}
          </span>
          <span data-testid="trace-09-cost" className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            {formatCost(trace.totalCostUsd)}
          </span>
          <span data-testid="trace-09-tokens">
            {formatTokens(totalTokens)} tokens
          </span>
          <span data-testid="trace-09-date">
            {relativeTime(trace.startedAt)}
          </span>
          {hasGold && (
            <span
              data-testid="trace-gold-indicator"
              className="flex items-center gap-1.5 text-amber-400/80 font-medium"
            >
              <Layers className="h-3.5 w-3.5" />
              Gold Analysis
            </span>
          )}
          {isRunning && (
            <span
              data-testid="trace-09-live-indicator"
              className="flex items-center gap-1.5 text-agent font-medium"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-agent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-agent" />
              </span>
              In progress...
            </span>
          )}
        </div>
      </div>

      {/* Gold Verdict Banner */}
      {hasGold && <GoldVerdictBanner gold={trace.gold!} />}

      {/* OBS-05: Tree View + Detail Panel (split layout) */}
      {(hasGold || hasPhases || observationCount > 0) && (
        <div data-testid="trace-tree-section" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Execution Tree
            </h2>
            {/* Demo toggle for mock rich data */}
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-6 text-muted-foreground"
              onClick={() => setShowMock(!showMock)}
              data-testid="trace-toggle-mock"
            >
              {showMock ? "Show real data" : "Demo: rich trace"}
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-background/60 h-[500px]">
            <TraceDataProvider
              trace={showMock ? mockTraceDetail : trace}
              isLoading={false}
            >
              <TraceSelectionProvider>
                <TraceViewPrefsProvider>
                  <TraceLayout
                    leftPanel={<TraceTreeView />}
                    rightPanel={<TraceDetailPanel />}
                  />
                </TraceViewPrefsProvider>
              </TraceSelectionProvider>
            </TraceDataProvider>
          </div>
        </div>
      )}

      {/* Legacy Timeline View (Langfuse-style horizontal bars) */}
      {(hasGold || hasPhases) && (
        <div data-testid="trace-timeline-section" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Timeline View
            </h2>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <TraceTimeline
              observations={showMock ? MOCK_OBSERVATIONS : (trace.observations ?? [])}
              phases={showMock ? MOCK_PHASES : trace.phases}
              gold={showMock ? MOCK_GOLD : trace.gold}
              totalDurationMs={showMock ? 36000 : trace.totalDurationMs}
            />
          </div>
        </div>
      )}

      {/* Lens selector + Analysis zone */}
      {!isRunning && (
        <div data-testid="trace-09-analysis-zone" className="space-y-4">
          <LensSelector
            companyId={selectedCompanyId!}
            traceId={trace.id}
            selectedLensId={selectedLensId}
            onSelectLens={setSelectedLensId}
          />

          {selectedLensId && (
            <LensAnalysisResult
              companyId={selectedCompanyId!}
              traceId={trace.id}
              lensId={selectedLensId}
            />
          )}
        </div>
      )}

      {isRunning && (
        <div
          data-testid="trace-09-analysis-disabled"
          className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Lens analysis will be available when the trace completes.
        </div>
      )}

      {/* Raw observations drill-down */}
      <div data-testid="trace-09-raw-section">
        <Button
          data-testid="trace-09-raw-toggle"
          variant="ghost"
          size="sm"
          onClick={() => setShowRaw((v) => !v)}
          className="flex items-center gap-2"
        >
          {showRaw ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Eye className="h-4 w-4" />
          View raw observations ({observationCount})
        </Button>

        {showRaw && trace.observations && (
          <div className="mt-3">
            <RawObservationTree observations={trace.observations} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Silver-only phase card (fallback when no gold) ----------

const silverPhaseTypeConfig: Record<
  string,
  { label: string; color: string; borderColor: string; icon: React.ElementType }
> = {
  COMPREHENSION: { label: "Comprehension", color: "text-blue-400", borderColor: "border-blue-500/20", icon: BookOpen },
  IMPLEMENTATION: { label: "Implementation", color: "text-emerald-400", borderColor: "border-emerald-500/20", icon: Code },
  VERIFICATION: { label: "Verification", color: "text-amber-400", borderColor: "border-amber-500/20", icon: Search },
  COMMUNICATION: { label: "Communication", color: "text-purple-400", borderColor: "border-purple-500/20", icon: MessageSquare },
  INITIALIZATION: { label: "Initialization", color: "text-gray-400", borderColor: "border-gray-500/20", icon: Play },
  RESULT: { label: "Result", color: "text-cyan-400", borderColor: "border-cyan-500/20", icon: Trophy },
  UNKNOWN: { label: "Unknown", color: "text-muted-foreground", borderColor: "border-border", icon: HelpCircle },
};

function SilverPhaseCard({
  phase,
  observations,
  index,
}: {
  phase: TracePhase;
  observations: TraceObservation[];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = silverPhaseTypeConfig[phase.type] ?? silverPhaseTypeConfig.UNKNOWN;
  const Icon = config.icon;

  const phaseObs = useMemo(() => {
    const flat = flattenObservationsLocal(observations);
    return flat.slice(phase.startIdx, phase.endIdx + 1);
  }, [observations, phase]);

  return (
    <div
      data-testid={`trace-silver-card-${index}`}
      className={cn("rounded-lg border bg-card hover:bg-accent/20 transition-colors", config.borderColor)}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <Badge variant="outline" className={cn("text-[10px] gap-1 shrink-0", config.color, config.borderColor)}>
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
        <span className="text-sm flex-1 truncate text-foreground/90">{phase.summary}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">{phase.observationCount} obs</span>
      </button>

      {expanded && phaseObs.length > 0 && (
        <div className="border-t border-border/50 px-4 py-3">
          <div className="rounded-md border border-border/50 bg-card/50 p-1 space-y-0.5">
            {phaseObs.map((obs) => (
              <SilverObsRow key={obs.id} observation={obs} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SilverObsRow({ observation }: { observation: TraceObservation }) {
  const [showRawLocal, setShowRawLocal] = useState(false);
  const hasDetails = observation.input != null || observation.output != null;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 text-xs hover:bg-accent/30 transition-colors rounded-sm",
          hasDetails && "cursor-pointer",
        )}
        onClick={() => hasDetails && setShowRawLocal((v) => !v)}
        role={hasDetails ? "button" : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        onKeyDown={
          hasDetails
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowRawLocal((v) => !v);
                }
              }
            : undefined
        }
      >
        <span className="w-4 shrink-0">
          {hasDetails &&
            (showRawLocal ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ))}
        </span>
        {typeIconLocal(observation.type)}
        {statusIconLocal(observation.status)}
        <span className="font-mono font-medium truncate flex-1">{observation.name}</span>
        {observation.durationMs != null && (
          <span className="text-muted-foreground shrink-0">{formatDurationLocal(observation.durationMs)}</span>
        )}
      </div>
      {showRawLocal && (
        <div className="ml-6 mb-2 space-y-2">
          {observation.input != null && (
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Input</span>
              <pre className="mt-0.5 text-[11px] bg-muted/40 rounded-sm p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto font-mono">
                {truncateJsonLocal(observation.input)}
              </pre>
            </div>
          )}
          {observation.output != null && (
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Output</span>
              <pre className="mt-0.5 text-[11px] bg-muted/40 rounded-sm p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto font-mono">
                {truncateJsonLocal(observation.output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Local helpers ----------

function flattenObservationsLocal(observations: TraceObservation[]): TraceObservation[] {
  const result: TraceObservation[] = [];
  function walk(obs: TraceObservation[]) {
    for (const o of obs) {
      result.push(o);
      if (o.children && o.children.length > 0) walk(o.children);
    }
  }
  walk(observations);
  return result;
}

function typeIconLocal(type: string) {
  switch (type) {
    case "span":
      return <Wrench className="h-3.5 w-3.5 text-info" />;
    case "generation":
      return <Brain className="h-3.5 w-3.5 text-agent" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function statusIconLocal(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-3 w-3 text-success" />;
    case "failed":
    case "error":
      return <XCircle className="h-3 w-3 text-error" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
}

function formatDurationLocal(ms: number | null): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateJsonLocal(value: unknown, maxLen = 500): string {
  if (value == null) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...[truncated]";
}
