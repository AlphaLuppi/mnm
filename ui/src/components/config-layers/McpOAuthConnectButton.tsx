import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, Link2Off, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type McpCredentialStatus } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";

const STATUS_CONFIG: Record<
  McpCredentialStatus,
  { label: string; dotClass: string; icon: typeof Link2 }
> = {
  connected: {
    label: "Connected",
    dotClass: "bg-green-500",
    icon: Link2,
  },
  pending: {
    label: "Pending",
    dotClass: "bg-amber-500",
    icon: RefreshCw,
  },
  expired: {
    label: "Expired",
    dotClass: "bg-amber-500",
    icon: RefreshCw,
  },
  revoked: {
    label: "Revoked",
    dotClass: "bg-red-500",
    icon: Link2Off,
  },
  error: {
    label: "Error",
    dotClass: "bg-red-500",
    icon: AlertCircle,
  },
  disconnected: {
    label: "Connect",
    dotClass: "bg-neutral-400",
    icon: Link2Off,
  },
};

export function McpOAuthConnectButton({
  itemId,
  companyId,
  status = "disconnected",
}: {
  itemId: string;
  companyId: string;
  status?: McpCredentialStatus;
}) {
  const queryClient = useQueryClient();
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  const { icon: Icon } = config;

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "mcp-oauth-result" && event.data?.itemId === itemId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.configLayers.credentials(companyId),
        });
        popupRef.current?.close();
        popupRef.current = null;
      }
    },
    [queryClient, companyId, itemId],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [handleMessage]);

  function openOAuthPopup() {
    const url = `/api/oauth/authorize/${itemId}`;
    const popup = window.open(
      url,
      `oauth-${itemId}`,
      "width=600,height=700,left=200,top=100,resizable=yes,scrollbars=yes",
    );
    if (!popup) return;
    popupRef.current = popup;

    // Fallback polling in case postMessage doesn't fire (e.g., cross-origin redirect)
    pollRef.current = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        // Refresh credential status after popup closes
        queryClient.invalidateQueries({
          queryKey: queryKeys.configLayers.credentials(companyId),
        });
      }
    }, 500);
  }

  const isConnected = status === "connected";
  const buttonLabel =
    status === "connected"
      ? "Reconnect"
      : status === "expired"
        ? "Refresh"
        : status === "error"
          ? "Retry"
          : "Connect";

  return (
    <div className="flex items-center gap-2">
      {/* Status badge */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn("inline-block h-2 w-2 rounded-full shrink-0", config.dotClass)}
        />
        <span
          className={cn(
            "text-xs font-medium",
            status === "connected" && "text-green-600 dark:text-green-400",
            status === "expired" && "text-amber-600 dark:text-amber-400",
            status === "error" && "text-red-600 dark:text-red-400",
            status === "disconnected" && "text-muted-foreground",
          )}
        >
          {config.label}
        </span>
      </div>

      <Button
        variant={isConnected ? "outline" : "default"}
        size="sm"
        onClick={openOAuthPopup}
        className="h-7 text-xs"
      >
        <Icon className="h-3 w-3 mr-1.5" />
        {buttonLabel}
      </Button>
    </div>
  );
}
