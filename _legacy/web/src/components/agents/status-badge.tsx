"use client";

import { Badge } from "@/components/ui/badge";
import type { AgentStatus } from "@/lib/core/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  idle: "secondary",
  pending: "outline",
  running: "default",
  paused: "outline",
  completed: "secondary",
  error: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  pending: "Pending",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  error: "Error",
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
      {status === "running" && (
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
      )}
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
