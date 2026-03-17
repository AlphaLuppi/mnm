import { useEffect, useMemo } from "react";
import { useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { ArrowLeft, Bot, Clock, DollarSign, Workflow } from "lucide-react";
import { tracesApi, type Trace } from "../api/traces";
import { workflowsApi } from "../api/workflows";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { WorkflowTimeline } from "../components/traces/WorkflowTimeline";
import { LensSelector } from "../components/traces/LensSelector";
import { Badge } from "@/components/ui/badge";
import { formatTokens, formatDuration, formatCost } from "../lib/utils";
import { useState } from "react";

export function WorkflowTraces() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [selectedLensId, setSelectedLensId] = useState<string | null>(null);

  const { data: workflow } = useQuery({
    queryKey: queryKeys.workflows.detail(workflowId!),
    queryFn: () => workflowsApi.get(workflowId!),
    enabled: !!workflowId,
  });

  const { data: tracesData, isLoading } = useQuery({
    queryKey: queryKeys.traces.byWorkflow(selectedCompanyId!, workflowId!),
    queryFn: () =>
      tracesApi.list(selectedCompanyId!, { workflowInstanceId: workflowId, limit: 100 }),
    enabled: !!selectedCompanyId && !!workflowId,
    refetchInterval: 10_000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents ?? []) map.set(a.id, a.name);
    return map;
  }, [agents]);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Workflows", href: "/workflows" },
      { label: workflow?.name ?? "Workflow" },
      { label: "Traces" },
    ]);
    return () => setBreadcrumbs([]);
  }, [workflow, setBreadcrumbs]);

  const traces = tracesData?.data ?? [];

  // Aggregated stats
  const totalDuration = useMemo(() => {
    if (traces.length === 0) return 0;
    const starts = traces.map((t) => new Date(t.startedAt).getTime());
    const ends = traces
      .filter((t) => t.completedAt)
      .map((t) => new Date(t.completedAt!).getTime());
    if (starts.length === 0) return 0;
    const earliest = Math.min(...starts);
    const latest = ends.length > 0 ? Math.max(...ends) : Date.now();
    return latest - earliest;
  }, [traces]);

  const totalCost = traces.reduce((sum, t) => sum + t.totalCostUsd, 0);
  const totalTokens = traces.reduce(
    (sum, t) => sum + t.totalTokensIn + t.totalTokensOut,
    0,
  );
  const uniqueAgents = new Set(traces.map((t) => t.agentId)).size;
  const isRunning = traces.some((t) => t.status === "running");

  if (isLoading) {
    return (
      <div data-testid="trace-12-loading">
        <PageSkeleton variant="list" />
      </div>
    );
  }

  return (
    <div data-testid="trace-12-page" className="space-y-6">
      {/* Back link */}
      <Link
        to={`/workflows/${workflowId}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline"
        data-testid="trace-12-back"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Workflow
      </Link>

      {/* Header */}
      <div data-testid="trace-12-header" className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            {workflow?.name ?? "Workflow"} — Trace Timeline
          </h1>
          <Badge variant={isRunning ? "default" : "secondary"}>
            {isRunning ? "Running" : workflow?.status ?? "Unknown"}
          </Badge>
        </div>

        {/* Aggregate stats */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span data-testid="trace-12-total-duration" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Total: {formatDuration(totalDuration)}
          </span>
          <span data-testid="trace-12-total-cost" className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            {formatCost(totalCost)}
          </span>
          <span data-testid="trace-12-total-tokens">
            {formatTokens(totalTokens)} tokens
          </span>
          <span data-testid="trace-12-agent-count" className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            {uniqueAgents} agent{uniqueAgents !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Timeline */}
      {traces.length === 0 ? (
        <div data-testid="trace-12-empty">
          <EmptyState
            icon={Workflow}
            message="No traces recorded for this workflow yet."
          />
        </div>
      ) : (
        <WorkflowTimeline
          traces={traces}
          stages={workflow?.stages ?? []}
          agentMap={agentMap}
        />
      )}

      {/* Workflow-level lens analysis */}
      {traces.length > 0 && !isRunning && (
        <div data-testid="trace-12-lens-section" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Workflow Analysis
          </h2>
          <LensSelector
            companyId={selectedCompanyId!}
            traceId={workflowId!}
            selectedLensId={selectedLensId}
            onSelectLens={setSelectedLensId}
          />
        </div>
      )}
    </div>
  );
}
