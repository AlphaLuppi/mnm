import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConfigLayerItem, ConfigLayerItemType } from "@mnm/shared";
import {
  configLayersApi,
  type UserCredential,
  type CredentialStatus,
} from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, KeyRound, Link2Off } from "lucide-react";
import { McpItemEditor } from "./McpItemEditor";
import { HookItemEditor } from "./HookItemEditor";
import { SkillItemEditor } from "./SkillItemEditor";
import { SettingItemEditor } from "./SettingItemEditor";
import { GitProviderItemEditor } from "./GitProviderItemEditor";
import { CredentialItemEditor } from "./CredentialItemEditor";
import { OAuthConnectButton } from "./OAuthConnectButton";
import { CredentialDialog } from "./CredentialDialog";
import { GitProviderIcon } from "../GitProviderIcon";
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
    case "git_provider":
      return (
        <GitProviderItemEditor item={item} onSave={onSave} onCancel={onCancel} />
      );
    case "credential":
      return (
        <CredentialItemEditor item={item} onSave={onSave} onCancel={onCancel} />
      );
  }
}

const ITEM_TYPE_LABELS: Record<ConfigLayerItemType, string> = {
  mcp: "MCP Server",
  git_provider: "Git Provider",
  credential: "Credential",
  hook: "Hook",
  skill: "Skill",
  setting: "Setting",
};

// ── Credential status helpers ─────────────────────────────────────────────────

const STATUS_STYLE: Record<
  CredentialStatus,
  { dotClass: string; label: string }
> = {
  connected: { dotClass: "bg-green-500", label: "Connected" },
  pending: { dotClass: "bg-amber-500", label: "Pending" },
  expired: { dotClass: "bg-amber-500", label: "Expired" },
  revoked: { dotClass: "bg-red-500", label: "Revoked" },
  error: { dotClass: "bg-red-500", label: "Error" },
  disconnected: { dotClass: "bg-neutral-400", label: "No secrets" },
};

function CredentialStatusBadge({ status }: { status: CredentialStatus }) {
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
  const [apiKeyMode, setApiKeyMode] = useState<"env" | "pat" | "credential">("env");
  const [apiKeyEnvVar, setApiKeyEnvVar] = useState<string | undefined>();

  const filtered = items.filter((it) => it.itemType === itemType);

  // Load credentials for credentialed items (MCP + git_provider + credential)
  const isMcp = itemType === "mcp";
  const isGitProvider = itemType === "git_provider";
  const isCredential = itemType === "credential";
  const needsCredentials = isMcp || isGitProvider || isCredential;
  const { data: credentials } = useQuery({
    queryKey: queryKeys.configLayers.credentials(companyId!),
    queryFn: () => configLayersApi.listCredentials(companyId!),
    enabled: needsCredentials && !!companyId,
  });

  // Build a map of itemId → credential for quick lookup
  const credByItemId = new Map<string, UserCredential>();
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

  // Helper to store a credential secret after item create/update
  async function storeSecretIfNeeded(
    itemId: string,
    config: Record<string, unknown>,
  ) {
    const secret = config.__secretValue as string | undefined;
    if (!secret || !companyId) return;
    const envVarKey =
      (config.envVar as string) ||
      ((config.name as string) ?? "SECRET").replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
    await configLayersApi.storeApiKey(companyId, itemId, {
      env: { [envVarKey]: secret },
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.configLayers.credentials(companyId),
    });
  }

  // Strip internal fields before sending to API
  function cleanConfig(config: Record<string, unknown>) {
    const { __secretValue, ...rest } = config;
    return rest;
  }

  const addMutation = useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      const item = await configLayersApi.addItem(layerId, {
        itemType,
        name: (config.name as string) ?? itemType,
        configJson: cleanConfig(config),
        enabled: true,
      });
      await storeSecretIfNeeded(item.id, config);
      return item;
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      itemId,
      config,
    }: {
      itemId: string;
      config: Record<string, unknown>;
    }) => {
      const item = await configLayersApi.updateItem(layerId, itemId, {
        name: (config.name as string) ?? undefined,
        configJson: cleanConfig(config),
      });
      await storeSecretIfNeeded(itemId, config);
      return item;
    },
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
      configLayersApi.revokeCredential(companyId!, credentialId),
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

  function getCredentialStatus(itemId: string): CredentialStatus {
    const cred = credByItemId.get(itemId);
    if (!cred) return "disconnected";
    return cred.status as CredentialStatus;
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2 rounded-lg border border-border bg-muted/50">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {it.itemType === "git_provider" && (
                  <GitProviderIcon
                    provider={(it.configJson as any).providerType ?? "generic"}
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                  />
                )}
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
                <Badge
                  variant={it.enabled ? "default" : "secondary"}
                  className="text-xs shrink-0 sm:hidden"
                >
                  {it.enabled ? "enabled" : "disabled"}
                </Badge>
                {!readOnly && (
                  <div className="flex gap-1 shrink-0 sm:hidden">
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

              {/* Credential status for credentialed items */}
              {needsCredentials && companyId && (
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <CredentialStatusBadge
                    status={getCredentialStatus(it.id)}
                  />

                  {/* Secret / Token button */}
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
                        if (isCredential) {
                          setApiKeyMode("credential");
                          setApiKeyEnvVar((it.configJson as any)?.envVar);
                        } else if (isGitProvider) {
                          setApiKeyMode("pat");
                          setApiKeyEnvVar(undefined);
                        } else {
                          setApiKeyMode("env");
                          setApiKeyEnvVar(undefined);
                        }
                      }}
                    >
                      <KeyRound className="h-3 w-3 mr-1" />
                      {isGitProvider
                        ? getCredentialStatus(it.id) === "connected"
                          ? "Update token"
                          : "Add token"
                        : getCredentialStatus(it.id) === "connected"
                          ? "Update secrets"
                          : "Add secrets"}
                    </Button>
                  )}

                  {/* OAuth connect button (only for MCP items with oauth config) */}
                  {!readOnly && isMcp && hasOAuthConfig(it) && (
                    <OAuthConnectButton
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
                className="text-xs hidden sm:inline-flex shrink-0"
              >
                {it.enabled ? "enabled" : "disabled"}
              </Badge>
              {!readOnly && (
                <div className="hidden sm:flex gap-1 shrink-0">
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

      {/* Credential dialog (env mode for MCP, pat mode for git_provider) */}
      {apiKeyItemId && companyId && (
        <CredentialDialog
          open={!!apiKeyItemId}
          onOpenChange={(open) => {
            if (!open) setApiKeyItemId(null);
          }}
          itemId={apiKeyItemId}
          itemName={apiKeyItemName}
          companyId={companyId}
          mode={apiKeyMode}
          envVarName={apiKeyEnvVar}
        />
      )}
    </div>
  );
}
