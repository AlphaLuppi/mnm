import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { workflowsApi, workflowTemplatesApi } from "../api/workflows";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Workflow, Plus, CheckCircle2, Pause, AlertTriangle, Clock } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: "Active", color: "text-blue-500", icon: Clock },
  paused: { label: "Paused", color: "text-yellow-500", icon: Pause },
  completed: { label: "Completed", color: "text-green-500", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-500", icon: AlertTriangle },
};

export function Workflows() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  useEffect(() => {
    setBreadcrumbs([{ label: "Workflows" }]);
  }, [setBreadcrumbs]);

  const { data: workflows, isLoading, error } = useQuery({
    queryKey: queryKeys.workflows.list(selectedCompanyId!),
    queryFn: () => workflowsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: templates } = useQuery({
    queryKey: queryKeys.workflows.templates(selectedCompanyId!),
    queryFn: () => workflowTemplatesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Workflow} message="Select a company to view workflows." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {workflows && workflows.length === 0 && (
        <EmptyState
          icon={Workflow}
          message="No workflows yet. Create one from a template to get started."
          action={templates && templates.length > 0 ? "Create Workflow" : undefined}
          onAction={templates && templates.length > 0 ? () => navigate("/workflows/new") : undefined}
        />
      )}

      {workflows && workflows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}
            </h2>
            <Button size="sm" variant="outline" onClick={() => navigate("/workflows/new")}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Workflow
            </Button>
          </div>

          <div className="border border-border rounded-lg divide-y divide-border">
            {workflows.map((wf) => {
              const cfg = STATUS_CONFIG[wf.status] ?? STATUS_CONFIG.active;
              const StatusIcon = cfg.icon;
              const stageCount = wf.stages?.length ?? 0;
              const doneCount = wf.stages?.filter((s) => s.status === "done" || s.status === "skipped").length ?? 0;
              const runningStage = wf.stages?.find((s) => s.status === "running");

              return (
                <button
                  key={wf.id}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/workflows/${wf.id}`)}
                >
                  <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{wf.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {runningStage
                        ? `Stage: ${runningStage.name}`
                        : wf.status === "completed"
                          ? "All stages complete"
                          : `${doneCount}/${stageCount} stages done`}
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
