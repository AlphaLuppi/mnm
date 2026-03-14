import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { usePermissions } from "../hooks/usePermissions";
import {
  useDriftMonitoringStatus,
  useDriftMonitoringToggle,
} from "../hooks/useDriftAlerts";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface DriftMonitorToggleProps {
  companyId: string | undefined;
}

export function DriftMonitorToggle({ companyId }: DriftMonitorToggleProps) {
  const { hasPermission } = usePermissions();
  const { data: status } = useDriftMonitoringStatus(companyId);
  const toggleMutation = useDriftMonitoringToggle(companyId);

  // Permission gate: workflows:enforce required
  if (!hasPermission("workflows:enforce")) {
    return null;
  }

  const isActive = status?.active ?? false;

  function handleToggle() {
    toggleMutation.mutate(isActive ? "stop" : "start");
  }

  return (
    <div
      data-testid="drift-s03-monitor-toggle"
      className="flex items-center gap-3 rounded-lg border bg-card p-3"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            isActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30",
          )}
        />
        <span className="text-xs font-medium">Monitoring:</span>
        <span
          data-testid="drift-s03-monitor-status"
          className={cn(
            "text-xs font-semibold",
            isActive
              ? "text-green-600 dark:text-green-400"
              : "text-muted-foreground",
          )}
        >
          {isActive ? "Active" : "Inactive"}
        </span>

        {isActive && status && (
          <>
            {status.activeAlertCount > 0 && (
              <span
                data-testid="drift-s03-monitor-alert-count"
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
              >
                {status.activeAlertCount} alert
                {status.activeAlertCount !== 1 ? "s" : ""}
              </span>
            )}
            {status.lastCheckAt && (
              <span
                data-testid="drift-s03-monitor-last-check"
                className="text-[10px] text-muted-foreground"
              >
                Last check: {timeAgo(status.lastCheckAt)}
              </span>
            )}
          </>
        )}
      </div>

      <Button
        data-testid="drift-s03-monitor-toggle-btn"
        variant={isActive ? "destructive" : "default"}
        size="sm"
        className="h-7 text-xs px-3"
        onClick={handleToggle}
        disabled={toggleMutation.isPending}
        aria-label={
          isActive ? "Stop drift monitoring" : "Start drift monitoring"
        }
      >
        {toggleMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <Activity className="h-3 w-3 mr-1" />
        )}
        {isActive ? "Stop" : "Start"}
      </Button>
    </div>
  );
}
