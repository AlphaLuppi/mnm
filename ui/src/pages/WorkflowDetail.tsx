import { useEffect } from "react";
import { useParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workflowsApi, stagesApi, type StageInstance } from "../api/workflows";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import {
  Circle,
  CheckCircle2,
  Loader2,
  XCircle,
  SkipForward,
  Clock,
  Play,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

const STAGE_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: typeof Circle }
> = {
  pending: { label: "Pending", color: "text-muted-foreground", bg: "bg-muted", icon: Clock },
  running: { label: "Running", color: "text-blue-500", bg: "bg-blue-500/10", icon: Loader2 },
  review: { label: "Review", color: "text-amber-500", bg: "bg-amber-500/10", icon: Circle },
  done: { label: "Done", color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-500", bg: "bg-red-500/10", icon: XCircle },
  skipped: { label: "Skipped", color: "text-muted-foreground", bg: "bg-muted", icon: SkipForward },
};

function StageNode({ stage, onTransition }: { stage: StageInstance; onTransition: (id: string, status: string) => void }) {
  const cfg = STAGE_STATUS_CONFIG[stage.status] ?? STAGE_STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const isRunning = stage.status === "running";

  return (
    <div className={`rounded-lg border border-border p-4 min-w-[200px] ${cfg.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <StatusIcon className={`h-4 w-4 ${cfg.color} ${isRunning ? "animate-spin" : ""}`} />
        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
      </div>
      <h3 className="text-sm font-semibold">{stage.name}</h3>
      {stage.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{stage.description}</p>
      )}
      {stage.agentRole && (
        <p className="text-xs text-muted-foreground mt-1">
          Role: <span className="font-medium">{stage.agentRole}</span>
        </p>
      )}
      {stage.startedAt && (
        <p className="text-[10px] text-muted-foreground mt-2">
          Started {new Date(stage.startedAt).toLocaleString()}
        </p>
      )}
      {stage.completedAt && (
        <p className="text-[10px] text-muted-foreground">
          Completed {new Date(stage.completedAt).toLocaleString()}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-1 mt-3">
        {stage.status === "pending" && (
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => onTransition(stage.id, "running")}>
            <Play className="h-3 w-3 mr-1" />
            Start
          </Button>
        )}
        {stage.status === "pending" && (
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => onTransition(stage.id, "skipped")}>
            <SkipForward className="h-3 w-3 mr-1" />
            Skip
          </Button>
        )}
        {stage.status === "running" && (
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => onTransition(stage.id, "done")}>
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Done
          </Button>
        )}
        {stage.status === "running" && (
          <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => onTransition(stage.id, "failed")}>
            <XCircle className="h-3 w-3 mr-1" />
            Fail
          </Button>
        )}
        {stage.status === "failed" && (
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => onTransition(stage.id, "running")}>
            <Play className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

function PipelineView({ stages, onTransition }: { stages: StageInstance[]; onTransition: (id: string, status: string) => void }) {
  const sorted = [...stages].sort((a, b) => a.stageOrder - b.stageOrder);

  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-4">
      {sorted.map((stage, i) => (
        <div key={stage.id} className="flex items-center gap-2 shrink-0">
          <StageNode stage={stage} onTransition={onTransition} />
          {i < sorted.length - 1 && (
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

function PipelineProgress({ stages }: { stages: StageInstance[] }) {
  const total = stages.length;
  const done = stages.filter((s) => s.status === "done" || s.status === "skipped").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{done}/{total} stages</span>
    </div>
  );
}

export function WorkflowDetail() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const { data: workflow, isLoading, error } = useQuery({
    queryKey: queryKeys.workflows.detail(workflowId!),
    queryFn: () => workflowsApi.get(workflowId!),
    enabled: !!workflowId,
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Workflows", href: "/workflows" },
      { label: workflow?.name ?? "..." },
    ]);
  }, [setBreadcrumbs, workflow?.name]);

  const transitionMutation = useMutation({
    mutationFn: ({ stageId, status }: { stageId: string; status: string }) =>
      stagesApi.transition(stageId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(workflowId!) });
      if (selectedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list(selectedCompanyId) });
      }
    },
  });

  function handleTransition(stageId: string, status: string) {
    transitionMutation.mutate({ stageId, status });
  }

  if (isLoading) return <PageSkeleton variant="detail" />;

  if (error) {
    return <p className="text-sm text-destructive p-4">{error.message}</p>;
  }

  if (!workflow) {
    return <p className="text-sm text-muted-foreground p-4">Workflow not found.</p>;
  }

  const stages = workflow.stages ?? [];
  const STATUS_LABELS: Record<string, string> = {
    active: "Active",
    paused: "Paused",
    completed: "Completed",
    failed: "Failed",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{workflow.name}</h1>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            workflow.status === "completed"
              ? "bg-green-500/10 text-green-500"
              : workflow.status === "failed"
                ? "bg-red-500/10 text-red-500"
                : workflow.status === "paused"
                  ? "bg-yellow-500/10 text-yellow-500"
                  : "bg-blue-500/10 text-blue-500"
          }`}>
            {STATUS_LABELS[workflow.status] ?? workflow.status}
          </span>
        </div>
        {workflow.description && (
          <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
        )}
      </div>

      {/* Progress bar */}
      {stages.length > 0 && <PipelineProgress stages={stages} />}

      {/* Pipeline visualization */}
      {stages.length > 0 ? (
        <PipelineView stages={stages} onTransition={handleTransition} />
      ) : (
        <p className="text-sm text-muted-foreground">No stages found.</p>
      )}

      {transitionMutation.error && (
        <p className="text-sm text-destructive">
          {transitionMutation.error instanceof Error
            ? transitionMutation.error.message
            : "Failed to transition stage"}
        </p>
      )}

      {/* Metadata */}
      <div className="border-t border-border pt-4 text-xs text-muted-foreground space-y-1">
        <p>Created: {new Date(workflow.createdAt).toLocaleString()}</p>
        {workflow.completedAt && <p>Completed: {new Date(workflow.completedAt).toLocaleString()}</p>}
      </div>
    </div>
  );
}
