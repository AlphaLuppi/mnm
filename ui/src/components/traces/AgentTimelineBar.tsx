import { Link } from "@/lib/router";
import { Bot, Loader2 } from "lucide-react";
import type { Trace, TraceStatus } from "../../api/traces";
import { cn, formatDuration, formatCost } from "../../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function statusColor(status: TraceStatus): string {
  switch (status) {
    case "running":
      return "bg-agent";
    case "completed":
      return "bg-success";
    case "failed":
      return "bg-error";
    case "cancelled":
      return "bg-muted-foreground";
    default:
      return "bg-muted-foreground/50";
  }
}

interface AgentTimelineBarProps {
  trace: Trace;
  agentName: string;
  startOffset: number;
  duration: number;
  totalDuration: number;
  isSubTrace: boolean;
}

export function AgentTimelineBar({
  trace,
  agentName,
  startOffset,
  duration,
  totalDuration,
  isSubTrace,
}: AgentTimelineBarProps) {
  const leftPct = (startOffset / totalDuration) * 100;
  const widthPct = Math.max((duration / totalDuration) * 100, 1); // min 1% for visibility
  const isRunning = trace.status === "running";

  return (
    <div
      data-testid={`trace-12-bar-${trace.id}`}
      className={cn(
        "flex items-center gap-2 h-8",
        isSubTrace && "ml-4",
      )}
    >
      {/* Agent label */}
      <div className="w-[140px] shrink-0 flex items-center gap-1.5 pr-2">
        {isSubTrace ? (
          <span className="text-muted-foreground/40 text-xs ml-2">|_</span>
        ) : (
          <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-medium truncate">
          {agentName}
        </span>
      </div>

      {/* Bar track */}
      <div className="flex-1 relative h-6 bg-muted/30 rounded-sm overflow-hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={`/traces/${trace.id}`}
              className="absolute h-full rounded-sm transition-colors hover:opacity-80 no-underline flex items-center"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
              }}
              data-testid={`trace-12-bar-link-${trace.id}`}
            >
              <div
                className={cn(
                  "h-full w-full rounded-sm",
                  statusColor(trace.status),
                  isRunning && "animate-pulse",
                )}
              />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="space-y-0.5">
              <div className="font-medium">{agentName}</div>
              <div>{trace.name}</div>
              <div>{formatDuration(duration)} | {formatCost(trace.totalCostUsd)}</div>
              <div className="capitalize">{trace.status}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Duration + Cost label */}
      <div className="w-[100px] shrink-0 text-right">
        <span className="text-[11px] text-muted-foreground">
          {formatDuration(duration)}
        </span>
        <span className="text-[11px] text-muted-foreground/60 ml-1.5">
          {formatCost(trace.totalCostUsd)}
        </span>
      </div>
    </div>
  );
}
