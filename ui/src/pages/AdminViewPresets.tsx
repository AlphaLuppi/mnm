import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Plus, Pencil, Trash2, Star } from "lucide-react";
import { viewPresetsApi } from "../api/view-presets";
import { DEFAULT_LAYOUT, type ViewPreset } from "@mnm/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ViewPresetEditor } from "../components/ViewPresetEditor";

type CreateFormData = {
  name: string;
  slug: string;
  description: string;
  color: string;
};

const emptyForm: CreateFormData = {
  name: "",
  slug: "",
  description: "",
  color: "",
};

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
  "#10b981", "#06b6d4", "#f59e0b", "#6366f1",
];

export default function AdminViewPresets() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ViewPreset | null>(null);
  const [editTarget, setEditTarget] = useState<ViewPreset | null>(null);
  const [formData, setFormData] = useState<CreateFormData>(emptyForm);

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

  const createMutation = useMutation({
    mutationFn: (data: Partial<ViewPreset>) =>
      viewPresetsApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.viewPresets.list(selectedCompanyId!),
      });
      setCreateOpen(false);
      setFormData(emptyForm);
      pushToast({ title: "Preset created", tone: "success" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (presetId: string) =>
      viewPresetsApi.delete(selectedCompanyId!, presetId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.viewPresets.list(selectedCompanyId!),
      });
      setDeleteTarget(null);
      pushToast({ title: "Preset deleted", tone: "success" });
    },
  });

  function openCreate() {
    setFormData(emptyForm);
    setCreateOpen(true);
  }

  function handleSlugFromName(name: string) {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    }));
  }

  function handleSubmitCreate() {
    createMutation.mutate({
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      description: formData.description.trim() || undefined,
      color: formData.color || undefined,
      layout: DEFAULT_LAYOUT,
    } as Partial<ViewPreset>);
  }

  // If editing a preset, show the editor instead
  if (editTarget) {
    return (
      <ViewPresetEditor
        preset={editTarget}
        onBack={() => {
          setEditTarget(null);
          queryClient.invalidateQueries({
            queryKey: queryKeys.viewPresets.list(selectedCompanyId!),
          });
        }}
      />
    );
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

      {/* Grid */}
      {!presets || presets.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          message="No view presets defined yet. Create one to get started."
          action="Create Preset"
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onEdit={() => setEditTarget(preset)}
              onDelete={() => setDeleteTarget(preset)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-muted-foreground">
        {presets?.length ?? 0} preset{(presets?.length ?? 0) !== 1 ? "s" : ""}
      </div>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFormData(emptyForm);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create View Preset</DialogTitle>
            <DialogDescription>
              Define a new view preset with a name and optional color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="preset-name">Name</Label>
              <Input
                id="preset-name"
                placeholder="e.g. Product Manager"
                value={formData.name}
                onChange={(e) => handleSlugFromName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="preset-slug">Slug</Label>
              <Input
                id="preset-slug"
                placeholder="e.g. product-manager"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="preset-desc">Description</Label>
              <Textarea
                id="preset-desc"
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-2 mt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-6 w-6 rounded-full transition-all ${
                      formData.color === c
                        ? "ring-2 ring-offset-2 ring-primary"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setFormData((prev) => ({ ...prev, color: c }))}
                  />
                ))}
                {formData.color && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setFormData((prev) => ({ ...prev, color: "" }))}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
          {createMutation.error && (
            <p className="text-xs text-destructive">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create preset"}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setFormData(emptyForm);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitCreate}
              disabled={
                !formData.name.trim() ||
                !formData.slug.trim() ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              Roles using this preset will lose their assignment.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget?.isDefault && (
            <p className="text-xs text-destructive">
              Cannot delete the default preset. Set another preset as default first.
            </p>
          )}
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
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={
                deleteMutation.isPending || !!deleteTarget?.isDefault
              }
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
  return (
    <div
      className="border border-border rounded-lg p-5 bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: preset.color
                ? `${preset.color}15`
                : "hsl(var(--primary) / 0.1)",
            }}
          >
            <LayoutGrid
              className="h-4 w-4"
              style={{ color: preset.color || "hsl(var(--primary))" }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">{preset.name}</div>
            {preset.description && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {preset.description}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{preset.slug}</code>
            </div>
          </div>
        </div>
        {preset.isDefault && (
          <Badge variant="secondary" className="shrink-0">
            <Star className="h-3 w-3 mr-1" />
            Default
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={preset.isDefault}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
