import type { IngestionStatus } from "@mnm/shared";
import { cn } from "../../lib/utils";

interface DocumentStatusBadgeProps {
  status: IngestionStatus;
}

const STATUS_CONFIG: Record<
  IngestionStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Processing...",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  processing: {
    label: "Extracting...",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  completed: {
    label: "Ready",
    className:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  failed: {
    label: "Error",
    className:
      "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

export function DocumentStatusBadge({ status }: DocumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}
