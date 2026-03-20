import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Star,
  StarOff,
  Loader2,
} from "lucide-react";
import {
  lensesApi,
  type TraceLens,
  type CreateLensInput,
  type UpdateLensInput,
} from "../api/lenses";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface LensFormState {
  name: string;
  prompt: string;
  isDefault: boolean;
}

const EMPTY_FORM: LensFormState = { name: "", prompt: "", isDefault: false };

export function TraceSettings() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [editingLens, setEditingLens] = useState<TraceLens | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TraceLens | null>(null);
  const [form, setForm] = useState<LensFormState>(EMPTY_FORM);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Settings", href: "/company/settings" },
      { label: "Trace Lenses" },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const { data: lenses, isLoading } = useQuery({
    queryKey: queryKeys.lenses.list(selectedCompanyId!),
    queryFn: () => lensesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateLensInput) =>
      lensesApi.create(selectedCompanyId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lenses.list(selectedCompanyId!) });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ lensId, body }: { lensId: string; body: UpdateLensInput }) =>
      lensesApi.update(selectedCompanyId!, lensId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lenses.list(selectedCompanyId!) });
      setEditingLens(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (lensId: string) =>
      lensesApi.delete(selectedCompanyId!, lensId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lenses.list(selectedCompanyId!) });
      setDeleteTarget(null);
    },
  });

  const userLenses = (lenses ?? []).filter((l) => !l.isTemplate);
  const templateLenses = (lenses ?? []).filter((l) => l.isTemplate);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const openEdit = (lens: TraceLens) => {
    setForm({
      name: lens.name,
      prompt: lens.prompt,
      isDefault: lens.isDefault ?? false,
    });
    setEditingLens(lens);
  };

  const handleCreate = () => {
    if (!form.name.trim() || !form.prompt.trim()) return;
    createMutation.mutate({
      name: form.name.trim(),
      prompt: form.prompt.trim(),
      isDefault: form.isDefault,
    });
  };

  const handleUpdate = () => {
    if (!editingLens || !form.name.trim() || !form.prompt.trim()) return;
    updateMutation.mutate({
      lensId: editingLens.id,
      body: {
        name: form.name.trim(),
        prompt: form.prompt.trim(),
        isDefault: form.isDefault,
      },
    });
  };

  if (isLoading) {
    return (
      <div data-testid="trace-10-loading">
        <PageSkeleton variant="list" />
      </div>
    );
  }

  return (
    <div data-testid="trace-10-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 data-testid="trace-10-title" className="text-lg font-semibold">
            Trace Lenses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define how you want agent traces analyzed. Each lens uses your prompt to produce a personalized analysis.
          </p>
        </div>
        <Button
          data-testid="trace-10-create-btn"
          size="sm"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Lens
        </Button>
      </div>

      {/* User lenses */}
      <div data-testid="trace-10-user-lenses" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Your Lenses
        </h2>
        {userLenses.length === 0 ? (
          <div data-testid="trace-10-no-lenses">
            <EmptyState
              icon={Sparkles}
              message="No custom lenses yet. Create one to get personalized trace analysis."
              action="Create Lens"
              onAction={openCreate}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {userLenses.map((lens) => (
              <LensCard
                key={lens.id}
                lens={lens}
                onEdit={() => openEdit(lens)}
                onDelete={() => setDeleteTarget(lens)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Template lenses */}
      {templateLenses.length > 0 && (
        <div data-testid="trace-10-templates" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Suggested Templates
          </h2>
          <div className="space-y-2">
            {templateLenses.map((lens) => (
              <LensCard key={lens.id} lens={lens} isTemplate />
            ))}
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Lens</DialogTitle>
          </DialogHeader>
          <LensForm form={form} onChange={setForm} />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="trace-10-create-submit"
              onClick={handleCreate}
              disabled={!form.name.trim() || !form.prompt.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingLens} onOpenChange={(open) => { if (!open) setEditingLens(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lens</DialogTitle>
          </DialogHeader>
          <LensForm form={form} onChange={setForm} />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditingLens(null)}
            >
              Cancel
            </Button>
            <Button
              data-testid="trace-10-edit-submit"
              onClick={handleUpdate}
              disabled={!form.name.trim() || !form.prompt.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lens</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete "{deleteTarget?.name}"? All cached analysis results for this lens will also be deleted. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              data-testid="trace-10-delete-confirm"
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Sub-components ----------

function LensForm({
  form,
  onChange,
}: {
  form: LensFormState;
  onChange: (f: LensFormState) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="lens-name">Name</Label>
        <Input
          id="lens-name"
          data-testid="trace-10-form-name"
          placeholder="e.g., Security Review"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lens-prompt">Analysis Prompt</Label>
        <Textarea
          id="lens-prompt"
          data-testid="trace-10-form-prompt"
          placeholder="Describe what you want to understand... e.g., 'What sensitive files were touched? Are there any security concerns?'"
          value={form.prompt}
          onChange={(e) => onChange({ ...form, prompt: e.target.value })}
          rows={4}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="lens-default"
          data-testid="trace-10-form-default"
          checked={form.isDefault}
          onCheckedChange={(checked) => onChange({ ...form, isDefault: checked })}
        />
        <Label htmlFor="lens-default" className="text-sm">
          Auto-apply when opening traces
        </Label>
      </div>
    </div>
  );
}

function LensCard({
  lens,
  isTemplate = false,
  onEdit,
  onDelete,
}: {
  lens: TraceLens;
  isTemplate?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      data-testid={`trace-10-lens-${lens.id}`}
      className="rounded-md border border-border bg-card px-4 py-3 flex items-start justify-between gap-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{lens.name}</span>
          {isTemplate && (
            <Badge variant="outline" className="text-[10px]">
              Template
            </Badge>
          )}
          {lens.isDefault && (
            <Badge variant="secondary" className="text-[10px]">
              <Star className="h-3 w-3 mr-0.5" />
              Default
            </Badge>
          )}
          {!lens.isActive && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Inactive
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {lens.prompt}
        </p>
      </div>
      {!isTemplate && (
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <Button
              data-testid={`trace-10-edit-${lens.id}`}
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              data-testid={`trace-10-delete-${lens.id}`}
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
