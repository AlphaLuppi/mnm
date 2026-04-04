import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ConfigLayerItemType } from "@mnm/shared";
import { configLayersApi } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { LayerItemList } from "./LayerItemList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Lock, Globe } from "lucide-react";
import { cn } from "../../lib/utils";

type Tab = ConfigLayerItemType;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "mcp", label: "MCP Servers" },
  { id: "skill", label: "Skills" },
  { id: "hook", label: "Hooks" },
  { id: "setting", label: "Settings" },
];

const SCOPE_LABELS: Record<string, string> = {
  company: "Company",
  shared: "Shared",
  private: "Private",
};

type Props = {
  companyId?: string;
  layerId: string;
  readOnly?: boolean;
  onClose?: () => void;
};

export function LayerEditor({ companyId, layerId, readOnly, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("mcp");

  const { data: layer, isLoading } = useQuery({
    queryKey: queryKeys.configLayers.detail(layerId),
    queryFn: () => configLayersApi.get(layerId),
    enabled: !!layerId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Loading layer...
      </div>
    );
  }

  if (!layer) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Layer not found.
      </div>
    );
  }

  const countByType = (type: Tab) =>
    layer.items.filter((it) => it.itemType === type).length;

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-foreground font-semibold text-base truncate">
              {layer.name}
            </h2>
            <Badge variant="outline" className="text-xs shrink-0">
              <Globe className="h-3 w-3 mr-1" />
              {SCOPE_LABELS[layer.scope] ?? layer.scope}
            </Badge>
            {layer.enforced && (
              <Badge variant="destructive" className="text-xs shrink-0">
                <Lock className="h-3 w-3 mr-1" />
                Enforced
              </Badge>
            )}
            {readOnly && (
              <Badge variant="secondary" className="text-xs shrink-0">
                Read-only
              </Badge>
            )}
          </div>
          {layer.description && (
            <p className="text-muted-foreground text-sm mt-0.5 truncate">{layer.description}</p>
          )}
        </div>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border px-2 sm:px-4 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const count = countByType(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-2.5 sm:px-3 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 -mb-px whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <LayerItemList
          layerId={layerId}
          companyId={companyId}
          items={layer.items}
          itemType={activeTab}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
