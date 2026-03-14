import { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Check,
  EyeOff,
  Wrench,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import type { DriftAlert, DriftAlertType, DriftSeverity } from "@mnm/shared";

// --- Human labels for alert types ---

const alertTypeLabels: Record<DriftAlertType, string> = {
  time_exceeded: "Time Exceeded",
  stagnation: "Stagnation",
  retry_excessive: "Excessive Retries",
  stage_skipped: "Stage Skipped",
  sequence_violation: "Sequence Violation",
};

// --- Severity visual config ---

const severityConfig: Record<
  DriftSeverity,
  {
    icon: typeof AlertTriangle;
    color: string;
    bg: string;
    badge: string;
  }
> = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
  moderate: {
    icon: AlertCircle,
    color: "text-amber-500",
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  minor: {
    icon: Info,
    color: "text-green-500",
    bg: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900",
    badge:
      "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  },
};

// --- Diff text helpers by alert type ---

function getExpectedText(alert: DriftAlert): string {
  const meta = alert.metadata ?? {};
  switch (alert.alertType) {
    case "time_exceeded": {
      const thresholdMs = (meta.thresholdMs as number) ?? 900_000;
      return `Stage should complete in < ${Math.round(thresholdMs / 60_000)} min`;
    }
    case "stagnation": {
      const thresholdMs = (meta.thresholdMs as number) ?? 1_800_000;
      return `Activity expected within ${Math.round(thresholdMs / 60_000)} min`;
    }
    case "retry_excessive": {
      const maxRetries = (meta.maxRetries as number) ?? "?";
      const threshold = (meta.retryAlertThreshold as number) ?? "?";
      return `Max ${maxRetries} retries, alert at ${threshold}`;
    }
    case "stage_skipped":
      return "Stage should be attempted (in_progress)";
    case "sequence_violation": {
      const prevName = (meta.previousStageName as string) ?? "previous stage";
      return `Previous stage "${prevName}" should be completed`;
    }
    default:
      return "Expected execution";
  }
}

function getObservedText(alert: DriftAlert): string {
  const meta = alert.metadata ?? {};
  switch (alert.alertType) {
    case "time_exceeded": {
      const elapsedMs = (meta.elapsedMs as number) ?? 0;
      return `Stage has been running for ${Math.round(elapsedMs / 60_000)} min`;
    }
    case "stagnation": {
      const silentMs = (meta.silentMs as number) ?? 0;
      return `No activity for ${Math.round(silentMs / 60_000)} min`;
    }
    case "retry_excessive": {
      const retryCount = (meta.retryCount as number) ?? "?";
      return `${retryCount} retries attempted`;
    }
    case "stage_skipped":
      return "Stage skipped without execution";
    case "sequence_violation": {
      const prevName = (meta.previousStageName as string) ?? "previous stage";
      const prevState = (meta.previousStageState as string) ?? "unknown";
      return `Previous stage "${prevName}" is "${prevState}"`;
    }
    default:
      return "Observed deviation";
  }
}

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

// --- Component ---

interface DriftAlertPanelProps {
  alert: DriftAlert;
  onResolve?: (
    alertId: string,
    resolution: "acknowledged" | "ignored" | "remediated",
    note?: string,
  ) => void;
  isResolving?: boolean;
}

export function DriftAlertPanel({
  alert,
  onResolve,
  isResolving,
}: DriftAlertPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");

  const config = severityConfig[alert.severity];
  const Icon = config.icon;
  const isResolved = alert.resolved;

  function handleResolve(
    resolution: "acknowledged" | "ignored" | "remediated",
  ) {
    if (resolution === "remediated" && !showNoteInput) {
      setShowNoteInput(true);
      return;
    }
    onResolve?.(alert.id, resolution, note || undefined);
    setShowNoteInput(false);
    setNote("");
  }

  return (
    <div
      data-testid={`drift-s03-alert-${alert.id}`}
      role={alert.severity === "critical" ? "alert" : "article"}
      className={cn(
        "rounded-lg border p-3 space-y-2",
        isResolved ? "opacity-60 border-muted" : config.bg,
      )}
    >
      {/* Header - clickable to expand */}
      <button
        data-testid={`drift-s03-alert-${alert.id}-toggle`}
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-2 w-full text-left cursor-pointer"
        aria-expanded={expanded}
        aria-label={`${alert.severity} ${alertTypeLabels[alert.alertType]} alert: ${alert.message}`}
      >
        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              data-testid={`drift-s03-alert-${alert.id}-severity`}
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase",
                config.badge,
              )}
            >
              {alert.severity}
            </span>
            <span
              data-testid={`drift-s03-alert-${alert.id}-type`}
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground"
            >
              {alertTypeLabels[alert.alertType]}
            </span>
            {isResolved && alert.resolution && (
              <span
                data-testid={`drift-s03-alert-${alert.id}-resolution`}
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              >
                {alert.resolution}
              </span>
            )}
          </div>
          <p
            data-testid={`drift-s03-alert-${alert.id}-message`}
            className="text-xs mt-1 leading-relaxed"
          >
            {alert.message}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            data-testid={`drift-s03-alert-${alert.id}-timestamp`}
            className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-1"
          >
            <Clock className="h-3 w-3" />
            {timeAgo(alert.createdAt)}
          </span>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-3 pt-1">
          {/* Diff: Expected vs Observed */}
          <div
            data-testid={`drift-s03-alert-${alert.id}-diff`}
            className="grid grid-cols-1 md:grid-cols-2 gap-2"
          >
            <div
              data-testid={`drift-s03-alert-${alert.id}-diff-expected`}
              className="rounded-md bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-900/50 p-2.5 text-[11px] space-y-1"
            >
              <p className="font-semibold text-green-700 dark:text-green-400">
                Expected Execution
              </p>
              <p className="leading-relaxed text-green-900 dark:text-green-200">
                {getExpectedText(alert)}
              </p>
            </div>
            <div
              data-testid={`drift-s03-alert-${alert.id}-diff-observed`}
              className="rounded-md bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/50 p-2.5 text-[11px] space-y-1"
            >
              <p className="font-semibold text-red-700 dark:text-red-400">
                Observed Execution
              </p>
              <p className="leading-relaxed text-red-900 dark:text-red-200">
                {getObservedText(alert)}
              </p>
            </div>
          </div>

          {/* Metadata */}
          <div
            data-testid={`drift-s03-alert-${alert.id}-metadata`}
            className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground"
          >
            <span
              data-testid={`drift-s03-alert-${alert.id}-metadata-workflow`}
            >
              <span className="font-medium">Workflow:</span>{" "}
              <code className="font-mono">
                {alert.workflowInstanceId.slice(0, 12)}...
              </code>
            </span>
            <span data-testid={`drift-s03-alert-${alert.id}-metadata-stage`}>
              <span className="font-medium">Stage:</span>{" "}
              <code className="font-mono">
                {alert.stageId.slice(0, 12)}...
              </code>
            </span>
          </div>

          {/* Resolved info */}
          {isResolved && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
              {alert.resolvedBy && (
                <span data-testid={`drift-s03-alert-${alert.id}-resolved-by`}>
                  Resolved by:{" "}
                  <span className="font-medium">{alert.resolvedBy}</span>
                </span>
              )}
              {alert.resolvedAt && (
                <span data-testid={`drift-s03-alert-${alert.id}-resolved-at`}>
                  at {timeAgo(alert.resolvedAt)}
                </span>
              )}
              {alert.resolutionNote && (
                <span
                  data-testid={`drift-s03-alert-${alert.id}-resolution-note`}
                  className="w-full mt-1 italic"
                >
                  Note: {alert.resolutionNote}
                </span>
              )}
            </div>
          )}

          {/* Resolution actions */}
          {!isResolved && onResolve && (
            <div className="space-y-2 pt-1">
              {showNoteInput && (
                <textarea
                  data-testid={`drift-s03-alert-${alert.id}-note`}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Add a remediation note..."
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
              <div className="flex items-center gap-1.5">
                <Button
                  data-testid={`drift-s03-alert-${alert.id}-action-acknowledge`}
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  disabled={isResolving}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResolve("acknowledged");
                  }}
                  aria-label={`Acknowledge alert ${alert.id}`}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Acknowledge
                </Button>
                <Button
                  data-testid={`drift-s03-alert-${alert.id}-action-ignore`}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2 text-muted-foreground"
                  disabled={isResolving}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResolve("ignored");
                  }}
                  aria-label={`Ignore alert ${alert.id}`}
                >
                  <EyeOff className="h-3 w-3 mr-1" />
                  Ignore
                </Button>
                <Button
                  data-testid={`drift-s03-alert-${alert.id}-action-remediate`}
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  disabled={isResolving}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResolve("remediated");
                  }}
                  aria-label={`Remediate alert ${alert.id}`}
                >
                  <Wrench className="h-3 w-3 mr-1" />
                  Remediate
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
