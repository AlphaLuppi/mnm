import { useEffect, useState } from "react";
import { useParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { workflowTemplatesApi, type WorkflowTemplate } from "../api/workflows";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { StageEditorCard, type StageDef } from "../components/StageEditorCard";
import { WorkflowEditorPreview } from "../components/WorkflowEditorPreview";
import { Button } from "@/components/ui/button";
import { Plus, Save, Eye, EyeOff, ArrowLeft } from "lucide-react";

function makeDefaultStage(order: number): StageDef {
  return {
    order,
    name: "New Stage",
    description: "",
    agentRole: undefined,
    autoTransition: false,
    acceptanceCriteria: [],
    requiredFiles: [],
    prePrompts: [],
    expectedOutputs: [],
    hitlRequired: false,
    hitlRoles: [],
  };
}

export function WorkflowEditor() {
  const { templateId } = useParams<{ templateId: string }>();
  const isNew = templateId === "new";
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [stages, setStages] = useState<StageDef[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load existing template
  const { data: existingTemplate, isLoading } = useQuery({
    queryKey: queryKeys.workflows.templates(selectedCompanyId!),
    queryFn: () => workflowTemplatesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && !isNew,
    select: (templates: WorkflowTemplate[]) =>
      templates.find((t) => t.id === templateId),
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Workflows", href: "/workflows" },
      { label: isNew ? "New Template" : "Edit Template" },
    ]);
  }, [setBreadcrumbs, isNew]);

  // Initialize state from existing template
  useEffect(() => {
    if (initialized) return;
    if (isNew) {
      setStages([makeDefaultStage(1)]);
      setInitialized(true);
      return;
    }
    if (existingTemplate) {
      setTemplateName(existingTemplate.name);
      setTemplateDescription(existingTemplate.description ?? "");
      setStages(
        existingTemplate.stages.map((s, i) => ({
          order: i + 1,
          name: s.name,
          description: s.description,
          agentRole: s.agentRole,
          autoTransition: s.autoTransition,
          acceptanceCriteria: s.acceptanceCriteria ?? [],
          requiredFiles: (s as StageDef).requiredFiles ?? [],
          prePrompts: (s as StageDef).prePrompts ?? [],
          expectedOutputs: (s as StageDef).expectedOutputs ?? [],
          hitlRequired: (s as StageDef).hitlRequired ?? false,
          hitlRoles: (s as StageDef).hitlRoles ?? [],
        })),
      );
      setInitialized(true);
    }
  }, [isNew, existingTemplate, initialized]);

  // Create template
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; stages: StageDef[] }) =>
      workflowTemplatesApi.create(selectedCompanyId!, {
        name: data.name,
        description: data.description || null,
        stages: data.stages.map((s, i) => ({ ...s, order: i + 1 })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.templates(selectedCompanyId!) });
      navigate("/workflows");
    },
  });

  // Update template
  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description: string; stages: StageDef[] }) =>
      workflowTemplatesApi.update(templateId!, {
        name: data.name,
        description: data.description || null,
        stages: data.stages.map((s, i) => ({ ...s, order: i + 1 })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.templates(selectedCompanyId!) });
      navigate("/workflows");
    },
  });

  const saveMutation = isNew ? createMutation : updateMutation;
  const isSaving = saveMutation.isPending;

  function handleSave() {
    if (!templateName.trim() || stages.length === 0) return;
    saveMutation.mutate({
      name: templateName.trim(),
      description: templateDescription.trim(),
      stages,
    });
  }

  function addStage() {
    setStages((prev) => [...prev, makeDefaultStage(prev.length + 1)]);
  }

  function updateStage(index: number, updated: StageDef) {
    setStages((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }

  function deleteStage(index: number) {
    setStages((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStageUp(index: number) {
    if (index === 0) return;
    setStages((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveStageDown(index: number) {
    if (index >= stages.length - 1) return;
    setStages((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  if (!isNew && isLoading) return <PageSkeleton variant="detail" />;

  if (!isNew && !existingTemplate && !isLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">Template not found.</p>
        <Button variant="ghost" className="mt-2" onClick={() => navigate("/workflows")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Workflows
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="orch-s05-editor-page" className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {isNew ? "Create Workflow Template" : "Edit Workflow Template"}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            data-testid="orch-s05-preview-btn"
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <>
                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                Hide Preview
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Preview
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Template meta */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium" htmlFor="template-name">
            Template Name
          </label>
          <input
            id="template-name"
            data-testid="orch-s05-template-name-input"
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. BMAD Full Pipeline"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="template-desc">
            Description
          </label>
          <textarea
            id="template-desc"
            data-testid="orch-s05-template-description-input"
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.target.value)}
            placeholder="Describe the workflow template..."
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
      </div>

      {/* Preview panel (toggleable) */}
      {showPreview && (
        <WorkflowEditorPreview stages={stages} templateName={templateName} />
      )}

      {/* Stages header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Stages</h2>
          <span
            data-testid="orch-s05-stage-count"
            className="text-xs text-muted-foreground"
          >
            ({stages.length} stage{stages.length !== 1 ? "s" : ""})
          </span>
        </div>
        <Button
          data-testid="orch-s05-add-stage-btn"
          variant="outline"
          size="sm"
          onClick={addStage}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Stage
        </Button>
      </div>

      {/* Stage cards */}
      <div className="space-y-3">
        {stages.map((stage, index) => (
          <StageEditorCard
            key={index}
            stage={stage}
            index={index}
            isFirst={index === 0}
            isLast={index === stages.length - 1}
            isOnly={stages.length === 1}
            onChange={(updated) => updateStage(index, updated)}
            onMoveUp={() => moveStageUp(index)}
            onMoveDown={() => moveStageDown(index)}
            onDelete={() => deleteStage(index)}
          />
        ))}
      </div>

      {/* Error */}
      {saveMutation.error && (
        <p data-testid="orch-s05-error-message" className="text-sm text-destructive">
          {saveMutation.error instanceof Error
            ? saveMutation.error.message
            : "Failed to save template"}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          data-testid="orch-s05-save-btn"
          onClick={handleSave}
          disabled={!templateName.trim() || stages.length === 0 || isSaving}
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {isSaving ? "Saving..." : "Save Template"}
        </Button>
        <Button
          data-testid="orch-s05-cancel-btn"
          variant="ghost"
          onClick={() => navigate("/workflows")}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
