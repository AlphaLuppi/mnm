import type { SsoConfiguration } from "@mnm/shared";
import {
  Pencil,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "verified":
      return "default";
    case "error":
      return "destructive";
    default:
      return "secondary";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "error":
      return "Error";
    default:
      return "Draft";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface SsoProviderCardProps {
  config: SsoConfiguration;
  onEdit: (config: SsoConfiguration) => void;
  onToggle: (config: SsoConfiguration) => void;
  onVerify: (config: SsoConfiguration) => void;
  onSync: (config: SsoConfiguration) => void;
  onDelete: (config: SsoConfiguration) => void;
  toggleLoading?: boolean;
  verifyLoading?: boolean;
  syncLoading?: boolean;
}

export function SsoProviderCard({
  config,
  onEdit,
  onToggle,
  onVerify,
  onSync,
  onDelete,
  toggleLoading,
  verifyLoading,
  syncLoading,
}: SsoProviderCardProps) {
  return (
    <div
      data-testid="sso-s03-provider-card"
      className="rounded-lg border bg-card p-5 space-y-4"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            data-testid="sso-s03-provider-name"
            className="font-medium text-foreground text-sm"
          >
            {config.displayName ?? config.provider.toUpperCase()}
          </span>
          <Badge
            data-testid="sso-s03-provider-type"
            variant="outline"
            className="text-xs"
          >
            {config.provider.toUpperCase()}
          </Badge>
          <Badge
            data-testid="sso-s03-provider-status"
            variant={statusVariant(config.status)}
            className="text-xs"
          >
            {config.status === "verified" && (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            )}
            {statusLabel(config.status)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground">
              {config.enabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              data-testid="sso-s03-provider-enabled"
              checked={config.enabled}
              disabled={toggleLoading}
              onCheckedChange={() => onToggle(config)}
            />
          </label>
        </div>
      </div>

      {/* Details row */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        {config.emailDomain && (
          <span data-testid="sso-s03-provider-domain">
            Domain: <span className="text-foreground">{config.emailDomain}</span>
          </span>
        )}
        {config.verifiedAt && (
          <span data-testid="sso-s03-provider-verified-at">
            Verified: <span className="text-foreground">{timeAgo(config.verifiedAt)}</span>
          </span>
        )}
        {config.lastSyncAt && (
          <span data-testid="sso-s03-provider-last-sync">
            Last sync: <span className="text-foreground">{timeAgo(config.lastSyncAt)}</span>
          </span>
        )}
      </div>

      {/* Sync error */}
      {config.lastSyncError && (
        <div
          data-testid="sso-s03-provider-sync-error"
          className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-3 py-2"
        >
          Sync error: {config.lastSyncError}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-1 pt-1 border-t">
        <Button
          data-testid="sso-s03-btn-edit"
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => onEdit(config)}
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          data-testid="sso-s03-btn-verify"
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2"
          disabled={verifyLoading}
          onClick={() => onVerify(config)}
        >
          {verifyLoading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          )}
          Verify
        </Button>
        {config.metadataUrl && (
          <Button
            data-testid="sso-s03-btn-sync"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            disabled={syncLoading}
            onClick={() => onSync(config)}
          >
            {syncLoading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Sync Metadata
          </Button>
        )}
        <Button
          data-testid="sso-s03-btn-delete"
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2 text-red-600 hover:text-red-700 dark:text-red-400"
          onClick={() => onDelete(config)}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}
