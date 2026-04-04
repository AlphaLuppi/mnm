import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConfigLayerItem, ConfigLayerItemType } from "@mnm/shared";
import {
  configLayersApi,
  type UserMcpCredential,
  type McpCredentialStatus,
} from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, KeyRound, Link2Off } from "lucide-react";
import { McpItemEditor } from "./McpItemEditor";
import { HookItemEditor } from "./HookItemEditor";
import { SkillItemEditor } from "./SkillItemEditor";
import { SettingItemEditor } from "./SettingItemEditor";
import { McpOAuthConnectButton } from "./McpOAuthConnectButton";
import { ApiKeyCredentialDialog } from "./ApiKeyCredentialDialog";
import { cn } from "../../lib/utils";

type Props = {
  layerId: string;
  companyId?: string;
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
      return (
        <SkillItemEditor item={item} onSave={onSave} onCancel={onCancel} />
      );
    case "setting":
      return (
        <SettingItemEditor item={item} onSave={onSave} onCancel={onCancel} />
      );
  }
}

const ITEM_TYPE_LABELS: Record<ConfigLayerItemType, string> = {
  mcp: "MCP Server",
  hook: "Hook",
  skill: "Skill",
  setting: "Setting",
};

// ── Credential status helpers ─────────────────────────────────────────────────

const STATUS_STYLE: Record<
  McpCredentialStatus,
  { dotClass: string; label: string }
> = {
  connected: { dotClass: "bg-green-500", label: "Connected" },
  pending: { dotClass: "bg-amber-500", label: "Pending" },
  expired: { dotClass: "bg-amber-500", label: "Expired" },
  revoked: { dotClass: "bg-red-500", label: "Revoked" },
  error: { dotClass: "bg-red-500", label: "Error" },
  disconnected: { dotClass: "bg-neutral-400", label: "No secrets" },
};

function CredentialStatusBadge({ status }: { status: McpCredentialStatus }) {
  const cfg = STATUS_STYLE[status] ?? STATUS_STYLE.disconnected;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", cfg.dotClass)}
      />
      {cfg.label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LayerItemList({
  layerId,
  companyId,
  items,
  itemType,
  readOnly,
}: Props) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [apiKeyItemId, setApiKeyItemId] = useState<string | null>(null);
  const [apiKeyItemName, setApiKeyItemName] = useState("");

  const filtered = items.filter((it) => it.itemType === itemType);

  // Load credentials for MCP items (only when viewing MCP tab with companyId)
  const isMcp = itemType === "mcp";
  const { data: credentials } = useQuery({
    queryKey: queryKeys.configLayers.credentials(companyId!),
    queryFn: () => configLayersApi.listCredentials(companyId!),
    enabled: isMcp && !!companyId,
  });

  // Build a map of itemId → credential for quick lookup
  const credByItemId = new Map<string, UserMcpCredential>();
  if (credentials) {
    for (const c of credentials) {
      credByItemId.set(c.itemId, c);
    }
  }

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.configLayers.detail(layerId),
    });
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
    mutationFn: ({
      itemId,
      config,
    }: {
      itemId: string;
      config: Record<string, unknown>;
    }) =>
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
    mutationFn: (itemId: string) =>
      configLayersApi.removeItem(layerId, itemId),
    onSuccess: () => invalidate(),
  });

  const revokeMutation = useMutation({
    mutationFn: (credentialId: string) =>
      configLayersApi.revokeCredential(credentialId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configLayers.credentials(companyId!),
      });
    },
  });

  function handleSave(config: Record<string, unknown>) {
    if (editingId === NEW_ID) {
      addMutation.mutate(config);
    } else if (editingId) {
      updateMutation.mutate({ itemId: editingId, config });
    }
  }

  function getCredentialStatus(itemId: string): McpCredentialStatus {
    const cred = credByItemId.get(itemId);
    if (!cred) return "disconnected";
    return cred.status as McpCredentialStatus;
  }

  function hasOAuthConfig(item: ConfigLayerItem): boolean {
    const cfg = item.configJson as Record<string, unknown> | undefined;
    return !!(cfg?.oauth && typeof cfg.oauth === "object");
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
        <p className="text-muted-foreground text-sm py-4 text-center">
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
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/50">
              <div className="flex-1 min-w-0">
                <span className="text-foreground text-sm font-medium truncate block">
                  {it.displayName ?? it.name}
                </span>
                {it.description && (
                  <span className="text-muted-foreground text-xs truncate block">
                    {it.description}
                  </span>
                )}
              </div>

              {/* Credential status for MCP items */}
              {isMcp && companyId && (
                <div className="flex items-center gap-2 shrink-0">
                  <CredentialStatusBadge
                    status={getCredentialStatus(it.id)}
                  />

                  {/* API Key button */}
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant={
                        getCredentialStatus(it.id) === "connected"
                          ? "outline"
                          : "secondary"
                      }
                      className="h-7 text-xs"
                      onClick={() => {
                        setApiKeyItemId(it.id);
                        setApiKeyItemName(it.displayName ?? it.name);
                      }}
                    >
                      <KeyRound className="h-3 w-3 mr-1" />
                      {getCredentialStatus(it.id) === "connected"
                        ? "Update secrets"
                        : "Add secrets"}
                    </Button>
                  )}

                  {/* OAuth connect button (only if item has oauth config) */}
                  {!readOnly && hasOAuthConfig(it) && (
                    <McpOAuthConnectButton
                      itemId={it.id}
                      companyId={companyId}
                      status={getCredentialStatus(it.id)}
                    />
                  )}

                  {/* Revoke button (only if connected) */}
                  {!readOnly &&
                    getCredentialStatus(it.id) === "connected" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          const cred = credByItemId.get(it.id);
                          if (cred) revokeMutation.mutate(cred.id);
                        }}
                        disabled={revokeMutation.isPending}
                      >
                        <Link2Off className="h-3 w-3 mr-1" />
                        Revoke
                      </Button>
                    )}
                </div>
              )}

              <Badge
                variant={it.enabled ? "default" : "secondary"}
                className="text-xs"
              >
                {it.enabled ? "enabled" : "disabled"}
              </Badge>
              {!readOnly && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingId(it.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
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

      {/* API Key credential dialog */}
      {apiKeyItemId && companyId && (
        <ApiKeyCredentialDialog
          open={!!apiKeyItemId}
          onOpenChange={(open) => {
            if (!open) setApiKeyItemId(null);
          }}
          itemId={apiKeyItemId}
          itemName={apiKeyItemName}
          companyId={companyId}
        />
      )}
    </div>
  );
}
