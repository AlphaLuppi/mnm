import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { workflowsApi, workflowTemplatesApi } from "../api/workflows";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Workflow, ChevronRight } from "lucide-react";

export function NewWorkflow() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Workflows", href: "/workflows" },
      { label: "New Workflow" },
    ]);
  }, [setBreadcrumbs]);

  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.workflows.templates(selectedCompanyId!),
    queryFn: () => workflowTemplatesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Auto-ensure BMAD template exists
  const ensureBmad = useMutation({
    mutationFn: () => workflowTemplatesApi.ensureBmad(selectedCompanyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.templates(selectedCompanyId!) });
    },
  });

  useEffect(() => {
    if (templates && templates.length === 0 && selectedCompanyId && !ensureBmad.isPending) {
      ensureBmad.mutate();
    }
  }, [templates, selectedCompanyId]);

  const createWorkflow = useMutation({
    mutationFn: (data: { templateId: string; name: string }) =>
      workflowsApi.create(selectedCompanyId!, data),
    onSuccess: (wf) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list(selectedCompanyId!) });
      navigate(`/workflows/${wf.id}`);
    },
  });

  function handleCreate() {
    if (!selectedTemplateId || !name.trim()) return;
    createWorkflow.mutate({ templateId: selectedTemplateId, name: name.trim() });
  }

  if (isLoading || ensureBmad.isPending) return <PageSkeleton variant="detail" />;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-bold">Create Workflow</h1>

      {/* Name */}
      <div>
        <label className="text-sm font-medium" htmlFor="wf-name">Workflow name</label>
        <input
          id="wf-name"
          type="text"
          placeholder="e.g. Feature: Dark Mode"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Template selection */}
      <div>
        <label className="text-sm font-medium">Select template</label>
        <div className="mt-2 space-y-2">
          {templates?.map((t) => (
            <button
              key={t.id}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                selectedTemplateId === t.id
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-border hover:bg-accent/50"
              }`}
              onClick={() => setSelectedTemplateId(t.id)}
            >
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t.name}</span>
                {t.isDefault && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                    Default
                  </span>
                )}
              </div>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-1 ml-6">{t.description}</p>
              )}
              <div className="flex items-center gap-1 mt-2 ml-6">
                {t.stages.map((s, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {s.name}
                    {i < t.stages.length - 1 && <ChevronRight className="h-3 w-3" />}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {createWorkflow.error && (
        <p className="text-sm text-destructive">
          {createWorkflow.error instanceof Error ? createWorkflow.error.message : "Failed to create workflow"}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleCreate}
          disabled={!selectedTemplateId || !name.trim() || createWorkflow.isPending}
        >
          {createWorkflow.isPending ? "Creating..." : "Create Workflow"}
        </Button>
        <Button variant="ghost" onClick={() => navigate("/workflows")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
