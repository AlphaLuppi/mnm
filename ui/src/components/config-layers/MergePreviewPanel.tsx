import { useQuery } from "@tanstack/react-query";
import { Loader2, Layers, Cpu, Wrench, Webhook, Settings2 } from "lucide-react";
import { configLayersApi, type MergePreviewItem } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";

const ITEM_TYPE_LABELS: Record<string, string> = {
  mcp: "MCP",
  skill: "Skill",
  hook: "Hook",
  setting: "Setting",
};

const ITEM_TYPE_ICONS: Record<string, typeof Cpu> = {
  mcp: Cpu,
  skill: Wrench,
  hook: Webhook,
  setting: Settings2,
};

function priorityBadgeClass(priority: number): string {
  if (priority >= 100) return "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300";
  if (priority >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

function ItemRow({ item }: { item: MergePreviewItem }) {
  const Icon = ITEM_TYPE_ICONS[item.itemType] ?? Settings2;
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 truncate font-mono text-xs">{item.name}</span>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
          priorityBadgeClass(item.priority),
        )}
      >
        P{item.priority}
      </span>
      <span className="text-[10px] text-muted-foreground truncate max-w-[80px]" title={item.layerName}>
        {item.layerName}
      </span>
    </div>
  );
}

export function MergePreviewPanel({
  companyId,
  agentId,
}: {
  companyId: string;
  agentId: string;
}) {
  const { data: preview, isLoading, error } = useQuery({
    queryKey: queryKeys.configLayers.mergePreview(companyId, agentId),
    queryFn: () => configLayersApi.mergePreview(companyId, agentId),
    enabled: !!companyId && !!agentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading preview…</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive py-4">
        Failed to load merge preview.
      </p>
    );
  }

  if (!preview || preview.items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No config items attached.</p>
      </div>
    );
  }

  // Group items by type
  const grouped = preview.items.reduce<Record<string, MergePreviewItem[]>>((acc, item) => {
    (acc[item.itemType] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Merged Config Preview
        </h4>
        <p className="text-xs text-muted-foreground">
          {preview.items.length} item{preview.items.length !== 1 ? "s" : ""} from{" "}
          {preview.layerSources.length} layer{preview.layerSources.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Items by type */}
      {(["mcp", "skill", "hook", "setting"] as const).map((type) => {
        const items = grouped[type];
        if (!items || items.length === 0) return null;
        return (
          <div key={type} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2">
              {ITEM_TYPE_LABELS[type]} ({items.length})
            </p>
            <div className="border border-border rounded-md">
              {items.map((item) => (
                <ItemRow key={item.itemId} item={item} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Layer sources summary */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground px-2">Layer Sources</p>
        <div className="space-y-1">
          {preview.layerSources.map((source) => (
            <div
              key={source.layerId}
              className="flex items-center justify-between px-2 py-1 rounded text-xs"
            >
              <span className="truncate font-medium">{source.layerName}</span>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {source.enforced && (
                  <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                    enforced
                  </span>
                )}
                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                  {source.scope}
                </span>
                <span className="text-muted-foreground">{source.itemCount} items</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
