import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Archive, Layers, Shield } from "lucide-react";
import {
  configLayersApi,
  type ConfigLayer,
  type LayerScope,
  type CreateLayerInput,
} from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { PageSkeleton } from "../../components/PageSkeleton";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
// LayerEditor is created by parallel agent — import optimistically
import { LayerEditor } from "../../components/config-layers/LayerEditor";
import { cn } from "../../lib/utils";

const SCOPE_OPTIONS: { value: LayerScope; label: string }[] = [
  { value: "company", label: "Company" },
  { value: "shared", label: "Shared" },
  { value: "private", label: "Private" },
];

function ScopeFilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
      )}
    >
      {children}
    </button>
  );
}

function LayerRow({
  layer,
  onClick,
  onArchive,
}: {
  layer: ConfigLayer;
  onClick: () => void;
  onArchive: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/40 cursor-pointer"
      onClick={onClick}
    >
      <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium">{layer.name}</span>
          {layer.enforced && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
              <Shield className="h-2.5 w-2.5" />
              enforced
            </span>
          )}
          {layer.pendingReview && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              pending review
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              layer.scope === "company" &&
                "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
              layer.scope === "shared" &&
                "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
              layer.scope === "private" && "bg-muted text-muted-foreground",
            )}
          >
            {layer.scope}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {layer.items.length} item{layer.items.length !== 1 ? "s" : ""}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        title="Archive layer"
        onClick={(e) => {
          e.stopPropagation();
          onArchive();
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Archive className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function ConfigLayersPage() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [scopeFilter, setScopeFilter] = useState<LayerScope | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editLayer, setEditLayer] = useState<ConfigLayer | null>(null);
  const [createForm, setCreateForm] = useState<CreateLayerInput>({
    name: "",
    scope: "company",
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Admin" }, { label: "Config Layers" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const { data: layers, isLoading, error } = useQuery({
    queryKey: queryKeys.configLayers.list(selectedCompanyId!, scopeFilter),
    queryFn: () => configLayersApi.list(selectedCompanyId!, scopeFilter),
    enabled: !!selectedCompanyId,
  });

  const activeLayers = (layers ?? []).filter((l) => !l.archivedAt);

  const createMutation = useMutation({
    mutationFn: (input: CreateLayerInput) =>
      configLayersApi.create(selectedCompanyId!, input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configLayers.list(selectedCompanyId!, scopeFilter),
      });
      setCreateOpen(false);
      setCreateForm({ name: "", scope: "company" });
      // Open editor for the newly created layer
      setEditLayer(created);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (layerId: string) =>
      configLayersApi.archive(selectedCompanyId!, layerId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configLayers.list(selectedCompanyId!, scopeFilter),
      });
    },
  });

  if (isLoading) return <PageSkeleton variant="list" />;
  if (error)
    return (
      <p className="text-sm text-destructive">Failed to load config layers.</p>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Config Layers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage reusable configuration layers for agents.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Layer
        </Button>
      </div>

      {/* Scope filter */}
      <div className="flex items-center gap-1.5">
        <ScopeFilterButton active={!scopeFilter} onClick={() => setScopeFilter(undefined)}>
          All
        </ScopeFilterButton>
        {SCOPE_OPTIONS.map((opt) => (
          <ScopeFilterButton
            key={opt.value}
            active={scopeFilter === opt.value}
            onClick={() => setScopeFilter(opt.value)}
          >
            {opt.label}
          </ScopeFilterButton>
        ))}
      </div>

      {/* Layer list */}
      {activeLayers.length === 0 ? (
        <EmptyState
          icon={Layers}
          message="Create a layer to start managing reusable agent configuration."
          action="New Layer"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          {activeLayers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              onClick={() => setEditLayer(layer)}
              onArchive={() => archiveMutation.mutate(layer.id)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Config Layer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="layer-name">Name</Label>
              <Input
                id="layer-name"
                placeholder="e.g. Global MCP Servers"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <div className="flex gap-2">
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setCreateForm((f) => ({ ...f, scope: opt.value }))
                    }
                    className={cn(
                      "flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors",
                      createForm.scope === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={!createForm.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Layer editor */}
      {editLayer && (
        <LayerEditor
          companyId={selectedCompanyId!}
          layerId={editLayer.id}
          onClose={() => setEditLayer(null)}
        />
      )}
    </div>
  );
}
