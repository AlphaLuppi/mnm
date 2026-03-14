import type { ContainerStatus } from "@mnm/shared";
import { CheckCircle2, Clock, Loader2, Square, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

// cont-s06-status-colors
const STATUS_CONFIG: Record<
  ContainerStatus,
  { classes: string; icon: typeof Loader2; label: string }
> = {
  running: {
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    icon: Loader2,
    label: "Running",
  },
  stopped: {
    classes:
      "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
    icon: Square,
    label: "Stopped",
  },
  exited: {
    classes:
      "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
    icon: CheckCircle2,
    label: "Exited",
  },
  failed: {
    classes:
      "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    icon: XCircle,
    label: "Failed",
  },
  creating: {
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    icon: Clock,
    label: "Creating",
  },
  pending: {
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    icon: Clock,
    label: "Pending",
  },
  stopping: {
    classes:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
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
