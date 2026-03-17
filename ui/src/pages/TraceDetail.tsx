import { useState, useEffect, useMemo } from "react";
import { useParams } from "@/lib/router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTokens, relativeTime, formatDuration, formatCost } from "../lib/utils";
import type { TraceStatus } from "../api/traces";

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
  const [selectedLensId, setSelectedLensId] = useState<string | null>(null);

  const { data: trace, isLoading, error } = useQuery({
    queryKey: queryKeys.traces.detail(selectedCompanyId!, traceId!),
    queryFn: () => tracesApi.detail(selectedCompanyId!, traceId!),
    enabled: !!selectedCompanyId && !!traceId,
    refetchInterval: (query) => {
      // Auto-refresh for running traces
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
