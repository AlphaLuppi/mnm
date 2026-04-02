import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ConfigLayerItem, ConfigLayerItemType } from "@mnm/shared";
import { configLayersApi } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";
import { McpItemEditor } from "./McpItemEditor";
import { HookItemEditor } from "./HookItemEditor";
import { SkillItemEditor } from "./SkillItemEditor";
import { SettingItemEditor } from "./SettingItemEditor";

type Props = {
  layerId: string;
  items: ConfigLayerItem[];
  itemType: ConfigLayerItemType;
  readOnly?: boolean;
};

const NEW_ID = "__new__";

function ItemEditor({
  itemType,
  item,
  onSave,
  onCancel,
}: {
  itemType: ConfigLayerItemType;
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  switch (itemType) {
    case "mcp":
      return <McpItemEditor item={item} onSave={onSave} onCancel={onCancel} />;
    case "hook":
      return <HookItemEditor item={item} onSave={onSave} onCancel={onCancel} />;
    case "skill":
      return <SkillItemEditor item={item} onSave={onSave} onCancel={onCancel} />;
    case "setting":
      return <SettingItemEditor item={item} onSave={onSave} onCancel={onCancel} />;
  }
}

const ITEM_TYPE_LABELS: Record<ConfigLayerItemType, string> = {
  mcp: "MCP Server",
  hook: "Hook",
  skill: "Skill",
  setting: "Setting",
};

export function LayerItemList({ layerId, items, itemType, readOnly }: Props) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = items.filter((it) => it.itemType === itemType);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.configLayers.detail(layerId) });
  };

  const addMutation = useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      configLayersApi.addItem(layerId, {
        itemType,
        name: (config.name as string) ?? itemType,
        configJson: config,
        enabled: true,
      }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, config }: { itemId: string; config: Record<string, unknown> }) =>
      configLayersApi.updateItem(layerId, itemId, {
        name: (config.name as string) ?? undefined,
        configJson: config,
      }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => configLayersApi.removeItem(layerId, itemId),
    onSuccess: () => invalidate(),
  });

  function handleSave(config: Record<string, unknown>) {
    if (editingId === NEW_ID) {
      addMutation.mutate(config);
    } else if (editingId) {
      updateMutation.mutate({ itemId: editingId, config });
    }
  }

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditingId(NEW_ID)}
            disabled={editingId === NEW_ID}
            className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add {ITEM_TYPE_LABELS[itemType]}
          </Button>
        </div>
      )}

      {editingId === NEW_ID && (
        <ItemEditor
          itemType={itemType}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
        />
      )}

      {filtered.length === 0 && editingId !== NEW_ID && (
        <p className="text-gray-500 text-sm py-4 text-center">
          No {ITEM_TYPE_LABELS[itemType].toLowerCase()}s configured.
        </p>
      )}

      {filtered.map((it) => (
        <div key={it.id}>
          {editingId === it.id ? (
            <ItemEditor
              itemType={itemType}
              item={it}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">
              <div className="flex-1 min-w-0">
                <span className="text-gray-200 text-sm font-medium truncate block">
                  {it.displayName ?? it.name}
                </span>
                {it.description && (
                  <span className="text-gray-500 text-xs truncate block">{it.description}</span>
                )}
              </div>
              <Badge
                variant={it.enabled ? "default" : "secondary"}
                className={it.enabled
                  ? "bg-green-900 text-green-300 border-green-700 text-xs"
                  : "bg-gray-700 text-gray-400 border-gray-600 text-xs"}
              >
                {it.enabled ? "enabled" : "disabled"}
              </Badge>
              {!readOnly && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-gray-400 hover:text-gray-200"
                    onClick={() => setEditingId(it.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-gray-400 hover:text-red-400"
                    onClick={() => removeMutation.mutate(it.id)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
