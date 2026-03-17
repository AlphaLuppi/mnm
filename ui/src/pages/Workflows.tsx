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
import {
  Workflow,
  Plus,
  CheckCircle2,
  Pause,
  AlertTriangle,
  Clock,
  ChevronRight,
  Pencil,
  Play,
} from "lucide-react";

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

  if (isLoading || !workflows) {
    return <PageSkeleton variant="list" />;
  }

  const hasWorkflows = workflows.length > 0;
  const hasTemplates = templates && templates.length > 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {/* ── Active Workflows ── */}
      {hasWorkflows && (
        <section className="space-y-3">
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
              const doneCount = wf.stages?.filter((s) => s.status === "completed" || s.status === "skipped").length ?? 0;
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
        </section>
      )}

      {/* ── Templates ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Templates
          </h2>
          <Button size="sm" variant="outline" onClick={() => navigate("/workflow-editor/new")}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Template
          </Button>
        </div>

        {!hasTemplates ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Workflow className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No templates yet. Create one to start launching workflows.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{t.name}</span>
                    {t.isDefault && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {t.stages.map((s, i) => (
                      <span key={i} className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        {s.name}
                        {i < t.stages.length - 1 && <ChevronRight className="h-2.5 w-2.5" />}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => navigate(`/workflow-editor/${t.id}`)}
                    title="Edit template"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => navigate("/workflows/new")}
                    title="Launch workflow"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
