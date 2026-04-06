import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Pencil, Trash2 } from "lucide-react";
import { viewPresetsApi } from "../api/view-presets";
import type { ViewPreset } from "@mnm/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ViewPresetEditor } from "../components/ViewPresetEditor";

export function AdminViewPresets() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ViewPreset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ViewPreset | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Admin" }, { label: "View Presets" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const {
    data: presets,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.viewPresets.list(selectedCompanyId!),
    queryFn: () => viewPresetsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const deleteMutation = useMutation({
    mutationFn: (presetId: string) =>
      viewPresetsApi.delete(selectedCompanyId!, presetId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.viewPresets.list(selectedCompanyId!),
      });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditTarget(null);
    setEditorOpen(true);
  }

  function openEdit(preset: ViewPreset) {
    setEditTarget(preset);
    setEditorOpen(true);
  }

  function handleEditorClose() {
    setEditorOpen(false);
    setEditTarget(null);
  }

  function handleEditorSaved() {
    queryClient.invalidateQueries({
      queryKey: queryKeys.viewPresets.list(selectedCompanyId!),
    });
    handleEditorClose();
  }

  if (isLoading) return <PageSkeleton variant="list" />;

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load view presets:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">View Presets</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Preset
        </Button>
      </div>

      {/* Preset cards */}
      {!presets || presets.length === 0 ? (
        <EmptyState
          icon={Eye}
          message="No view presets defined yet. Create one to customize navigation per role."
          action="Create Preset"
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onEdit={() => openEdit(preset)}
              onDelete={() => setDeleteTarget(preset)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-muted-foreground">
        {presets?.length ?? 0} preset{(presets?.length ?? 0) !== 1 ? "s" : ""}
      </div>

      {/* Editor (Sheet) */}
      {editorOpen && (
        <ViewPresetEditor
          preset={editTarget}
          open={editorOpen}
          onClose={handleEditorClose}
          onSaved={handleEditorSaved}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Preset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the preset &quot;{deleteTarget?.name}&quot;?
              Roles assigned to this preset will lose their view configuration.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.error && (
            <p className="text-xs text-destructive">
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : "Failed to delete preset"}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PresetCard({
  preset,
  onEdit,
  onDelete,
}: {
  preset: ViewPreset;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sectionCount = preset.layout?.sidebar?.sections?.length ?? 0;
  const widgetCount = preset.layout?.dashboard?.widgets?.length ?? 0;

  return (
    <div
      className="border border-border rounded-lg p-5 bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-md flex items-center justify-center"
            style={{
              backgroundColor: preset.color ? `${preset.color}20` : undefined,
              color: preset.color ?? undefined,
            }}
          >
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{preset.name}</div>
            <code className="text-[11px] text-muted-foreground">{preset.slug}</code>
          </div>
        </div>
        {preset.isDefault && (
          <Badge variant="secondary" className="text-xs shrink-0">Default</Badge>
        )}
      </div>

      {preset.description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {preset.description}
        </p>
      )}

      <div className="text-xs text-muted-foreground mt-3">
        {sectionCount} section{sectionCount !== 1 ? "s" : ""} &middot;{" "}
        {widgetCount} widget{widgetCount !== 1 ? "s" : ""} &middot;{" "}
        Landing: <code className="text-[11px]">{preset.layout?.landingPage ?? "/dashboard"}</code>
      </div>

      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
