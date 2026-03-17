import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Wrench,
  Brain,
  Circle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import type { TraceObservation, ObservationType } from "../../api/traces";
import { cn } from "../../lib/utils";

function typeIcon(type: ObservationType) {
  switch (type) {
    case "span":
      return <Wrench className="h-3.5 w-3.5 text-info" />;
    case "generation":
      return <Brain className="h-3.5 w-3.5 text-agent" />;
    case "event":
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-3 w-3 text-success" />;
    case "failed":
    case "error":
      return <XCircle className="h-3 w-3 text-error" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateJson(value: unknown, maxLen: number = 200): string {
  if (value == null) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...[truncated]";
}

/** Build tree from flat observations list */
function buildTree(observations: TraceObservation[]): TraceObservation[] {
  // If observations already have children populated, use them directly
  if (observations.some((o) => o.children && o.children.length > 0)) {
    return observations.filter((o) => !o.parentObservationId);
  }

  const map = new Map<string, TraceObservation & { children: TraceObservation[] }>();
  const roots: (TraceObservation & { children: TraceObservation[] })[] = [];

  for (const obs of observations) {
    map.set(obs.id, { ...obs, children: [] });
  }

  for (const obs of observations) {
    const node = map.get(obs.id)!;
    if (obs.parentObservationId && map.has(obs.parentObservationId)) {
      map.get(obs.parentObservationId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

interface ObservationNodeProps {
  observation: TraceObservation;
  depth: number;
}

function ObservationNode({ observation, depth }: ObservationNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const children = observation.children ?? [];
  const hasChildren = children.length > 0;
  const hasDetails = observation.input != null || observation.output != null;

  return (
    <div data-testid={`trace-09-obs-${observation.id}`}>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 text-xs hover:bg-accent/30 transition-colors cursor-pointer rounded-sm",
          depth > 0 && "ml-5",
        )}
        onClick={() => {
          if (hasChildren) setExpanded((v) => !v);
          else if (hasDetails) setShowDetails((v) => !v);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (hasChildren) setExpanded((v) => !v);
            else if (hasDetails) setShowDetails((v) => !v);
          }
        }}
      >
        {/* Expand icon */}
        <span className="w-4 shrink-0">
          {(hasChildren || hasDetails) ? (
            expanded || showDetails ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : null}
        </span>

        {/* Type icon */}
        {typeIcon(observation.type)}

        {/* Status icon */}
        {statusIcon(observation.status)}

        {/* Name */}
        <span className="font-mono font-medium truncate flex-1">
          {observation.name}
        </span>

        {/* Duration */}
        {observation.durationMs != null && (
          <span className="text-muted-foreground shrink-0">
            {formatDuration(observation.durationMs)}
          </span>
        )}

        {/* Tokens */}
        {observation.totalTokens != null && observation.totalTokens > 0 && (
          <span className="text-muted-foreground shrink-0">
            {observation.totalTokens} tok
          </span>
        )}
      </div>

      {/* Expanded details */}
      {showDetails && (
        <div className={cn("ml-11 mb-2 space-y-2", depth > 0 && "ml-16")}>
          {observation.input != null && (
            <div data-testid={`trace-09-obs-input-${observation.id}`}>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Input</span>
              <pre className="mt-0.5 text-[11px] bg-muted/40 rounded-sm p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {truncateJson(observation.input)}
              </pre>
            </div>
          )}
          {observation.output != null && (
            <div data-testid={`trace-09-obs-output-${observation.id}`}>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Output</span>
              <pre className="mt-0.5 text-[11px] bg-muted/40 rounded-sm p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {truncateJson(observation.output)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Children */}
      {expanded &&
        children.map((child) => (
          <ObservationNode key={child.id} observation={child} depth={depth + 1} />
        ))}
    </div>
  );
}

interface RawObservationTreeProps {
  observations: TraceObservation[];
}

export function RawObservationTree({ observations }: RawObservationTreeProps) {
  const tree = buildTree(observations);

  if (tree.length === 0) {
    return (
      <div
        data-testid="trace-09-raw-empty"
        className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
      >
        No observations recorded.
      </div>
    );
  }

  return (
    <div
      data-testid="trace-09-raw-tree"
      className="rounded-md border border-border bg-card p-2 space-y-0.5"
    >
      {tree.map((obs) => (
        <ObservationNode key={obs.id} observation={obs} depth={0} />
      ))}
    </div>
  );
}
