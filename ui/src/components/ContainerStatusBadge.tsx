import type { ContainerStatus } from "@mnm/shared";
import { CheckCircle2, Clock, Loader2, Square, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

// cont-s06-status-colors
const STATUS_CONFIG: Record<
  ContainerStatus,
  { classes: string; icon: typeof Loader2; label: string }
> = {
  running: {
    classes: "bg-success-bg text-success",
    icon: Loader2,
    label: "Running",
  },
  stopped: {
    classes: "bg-role-viewer-bg text-role-viewer",
    icon: Square,
    label: "Stopped",
  },
  exited: {
    classes: "bg-role-viewer-bg text-role-viewer",
    icon: CheckCircle2,
    label: "Exited",
  },
  failed: {
    classes: "bg-error-bg text-error",
    icon: XCircle,
    label: "Failed",
  },
  creating: {
    classes: "bg-warning-bg text-warning",
    icon: Clock,
    label: "Creating",
  },
  pending: {
    classes: "bg-warning-bg text-warning",
    icon: Clock,
    label: "Pending",
  },
  stopping: {
    classes: "bg-warning-bg text-warning",
    icon: Loader2,
    label: "Stopping",
  },
};

interface ContainerStatusBadgeProps {
  status: ContainerStatus;
  className?: string;
}

export function ContainerStatusBadge({
  status,
  className,
}: ContainerStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;
  const isAnimated = status === "running" || status === "stopping";

  return (
    <span
      data-testid="cont-s06-status-badge"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        config.classes,
        className,
      )}
    >
      <Icon
        className={cn("h-3 w-3", isAnimated && "animate-spin")}
      />
      {config.label}
    </span>
  );
}
