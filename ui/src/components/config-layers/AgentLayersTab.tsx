import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Unlink, Pencil, Loader2, Layers, Shield } from "lucide-react";
import {
  configLayersApi,
  type ConfigLayer,
  type ConflictCheckResult,
} from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MergePreviewPanel } from "./MergePreviewPanel";
import { ConflictResolutionDialog } from "./ConflictResolutionDialog";
// LayerEditor is created by parallel agent — import optimistically
import { LayerEditor } from "./LayerEditor";
import { cn } from "../../lib/utils";

function ScopeBadge({ scope }: { scope: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        scope === "company" && "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
        scope === "shared" && "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
        scope === "private" && "bg-muted text-muted-foreground",
      )}
    >
      {scope}
    </span>
  );
}

function LayerCard({
  layer,
  isBase,
  onDetach,
  onEdit,
}: {
  layer: ConfigLayer;
  isBase: boolean;
  onDetach?: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2.5">
      <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{layer.name}</span>
          {isBase && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300">
              base
            </span>
          )}
          {layer.enforced && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
              <Shield className="h-2.5 w-2.5 mr-0.5" />
              enforced
            </span>
          )}
          {layer.pendingReview && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              review
            </span>
          )}
          <ScopeBadge scope={layer.scope} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {layer.items.length} item{layer.items.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <Button variant="ghost" size="icon-xs" onClick={onEdit} title="Edit layer">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {onDetach && !isBase && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onDetach}
            title="Detach layer"
            className="text-muted-foreground hover:text-destructive"
          >
            <Unlink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function AgentLayersTab({
  companyId,
  agentId,
  baseLayerId,
}: {
  companyId: string;
  agentId: string;
  baseLayerId: string | null;
}) {
  const queryClient = useQueryClient();

  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [editLayer, setEditLayer] = useState<ConfigLayer | null>(null);
  const [pendingAttach, setPendingAttach] = useState<{
    layer: ConfigLayer;
    result: ConflictCheckResult;
  } | null>(null);

  // Layers attached to this agent
  const { data: attachedLayers, isLoading: loadingAttached } = useQuery({
    queryKey: queryKeys.configLayers.forAgent(companyId, agentId),
    queryFn: () => configLayersApi.listForAgent(companyId, agentId),
    enabled: !!companyId && !!agentId,
  });

  // All available layers (for attach dialog)
  const { data: allLayers, isLoading: loadingAll } = useQuery({
    queryKey: queryKeys.configLayers.list(companyId),
    queryFn: () => configLayersApi.list(companyId),
    enabled: attachDialogOpen && !!companyId,
  });

  const attachedIds = new Set((attachedLayers ?? []).map((l) => l.id));
  const availableLayers = (allLayers ?? []).filter(
    (l) => !attachedIds.has(l.id) && !l.archivedAt,
  );

  const attachMutation = useMutation({
    mutationFn: (layerId: string) =>
      configLayersApi.attachToAgent(companyId, agentId, layerId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configLayers.forAgent(companyId, agentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.configLayers.mergePreview(companyId, agentId),
      });
      setAttachDialogOpen(false);
      setPendingAttach(null);
    },
  });

  const detachMutation = useMutation({
    mutationFn: (layerId: string) =>
      configLayersApi.detachFromAgent(companyId, agentId, layerId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configLayers.forAgent(companyId, agentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.configLayers.mergePreview(companyId, agentId),
      });
    },
  });

  async function handleLayerSelect(layer: ConfigLayer) {
    // Run conflict check first
    try {
      const result = await configLayersApi.checkConflicts(companyId, agentId, layer.id);
      if (result.conflicts.length > 0) {
        setPendingAttach({ layer, result });
        setAttachDialogOpen(false);
      } else {
        attachMutation.mutate(layer.id);
      }
    } catch {
      attachMutation.mutate(layer.id);
    }
  }

  const baseLayer = (attachedLayers ?? []).find((l) => l.id === baseLayerId);
  const additionalLayers = (attachedLayers ?? []).filter((l) => l.id !== baseLayerId);

  return (
    <div className="flex gap-6">
      {/* Left panel — 2/3 */}
      <div className="flex-[2] min-w-0 space-y-5">
        {/* Base layer */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Base Layer</h3>
          {loadingAttached ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : baseLayer ? (
            <LayerCard
              layer={baseLayer}
              isBase
              onEdit={() => setEditLayer(baseLayer)}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-3">
              No base layer assigned.
            </p>
          )}
        </div>

        {/* Additional layers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Additional Layers</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAttachDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Attach Layer
            </Button>
          </div>

          {loadingAttached ? null : additionalLayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No additional layers attached.
            </p>
          ) : (
            <div className="space-y-2">
              {additionalLayers.map((layer) => (
                <LayerCard
                  key={layer.id}
                  layer={layer}
                  isBase={false}
                  onDetach={() => detachMutation.mutate(layer.id)}
                  onEdit={() => setEditLayer(layer)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — 1/3 */}
      <div className="flex-1 min-w-0 border-l border-border pl-6">
        <MergePreviewPanel companyId={companyId} agentId={agentId} />
      </div>

      {/* Attach layer dialog */}
      <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach a Layer</DialogTitle>
          </DialogHeader>
          {loadingAll ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading layers…</span>
            </div>
          ) : availableLayers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No available layers to attach.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto py-1">
              {availableLayers.map((layer) => (
                <button
                  key={layer.id}
                  className="w-full text-left border border-border rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors"
                  onClick={() => handleLayerSelect(layer)}
                  disabled={attachMutation.isPending}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{layer.name}</span>
                    {layer.enforced && (
                      <Badge variant="destructive" className="text-[10px]">enforced</Badge>
                    )}
                    {layer.pendingReview && (
                      <Badge variant="outline" className="text-[10px]">review</Badge>
                    )}
                    <ScopeBadge scope={layer.scope} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {layer.items.length} item{layer.items.length !== 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conflict resolution dialog */}
      {pendingAttach && (
        <ConflictResolutionDialog
          result={pendingAttach.result}
          onProceed={() => attachMutation.mutate(pendingAttach.layer.id)}
          onCancel={() => setPendingAttach(null)}
        />
      )}

      {/* Layer editor dialog */}
      {editLayer && (
        <LayerEditor
          companyId={companyId}
          layerId={editLayer.id}
          onClose={() => setEditLayer(null)}
        />
      )}
    </div>
  );
}
