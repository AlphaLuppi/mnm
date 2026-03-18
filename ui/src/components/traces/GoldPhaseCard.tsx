import { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Wrench,
  Brain,
  Circle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Clock,
  Eye,
  BookOpen,
  Code,
  MessageSquare,
  Play,
  Trophy,
  HelpCircle,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  TraceGoldPhase,
  TracePhase,
  TracePhaseType,
  GoldVerdict,
  TraceObservation,
  ObservationType,
} from "../../api/traces";
import { cn } from "../../lib/utils";

// ---------- Phase type configuration ----------

const phaseTypeConfig: Record<
  TracePhaseType,
  { label: string; color: string; bgColor: string; borderColor: string; icon: React.ElementType }
> = {
  COMPREHENSION: {
    label: "Comprehension",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    icon: BookOpen,
  },
  IMPLEMENTATION: {
    label: "Implementation",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    icon: Code,
  },
  VERIFICATION: {
    label: "Verification",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    icon: Search,
  },
  COMMUNICATION: {
    label: "Communication",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    icon: MessageSquare,
  },
  INITIALIZATION: {
    label: "Initialization",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/20",
    icon: Play,
  },
  RESULT: {
    label: "Result",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    icon: Trophy,
  },
  UNKNOWN: {
    label: "Unknown",
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    borderColor: "border-border",
    icon: HelpCircle,
  },
};

const verdictConfig: Record<
  GoldVerdict,
  { label: string; color: string; icon: React.ElementType }
> = {
  success: { label: "Success", color: "text-emerald-400", icon: CheckCircle },
  partial: { label: "Partial", color: "text-amber-400", icon: AlertTriangle },
  failure: { label: "Failure", color: "text-red-400", icon: XCircle },
  neutral: { label: "Neutral", color: "text-muted-foreground", icon: MinusCircle },
};

// ---------- Observation type helpers ----------

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

function formatDurationMs(ms: number | null): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateJson(value: unknown, maxLen = 500): string {
  if (value == null) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...[truncated]";
}

// ---------- RelevanceBar ----------

function RelevanceBar({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-emerald-500"
      : score >= 40
        ? "bg-amber-500"
        : "bg-muted-foreground";

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{score}</span>
    </div>
  );
}

// ---------- Bronze observation row ----------

interface BronzeObservationRowProps {
  observation: TraceObservation;
  isKey: boolean;
}

function BronzeObservationRow({ observation, isKey }: BronzeObservationRowProps) {
  const [showRaw, setShowRaw] = useState(false);
  const hasDetails = observation.input != null || observation.output != null;

  return (
    <div data-testid={`trace-silver-obs-${observation.id}`}>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 text-xs hover:bg-accent/30 transition-colors rounded-sm",
          hasDetails && "cursor-pointer",
          isKey && "ring-1 ring-amber-500/30 bg-amber-500/5",
        )}
        onClick={() => hasDetails && setShowRaw((v) => !v)}
        role={hasDetails ? "button" : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        onKeyDown={
          hasDetails
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowRaw((v) => !v);
                }
              }
            : undefined
        }
      >
        {/* Expand icon for raw */}
        <span className="w-4 shrink-0">
          {hasDetails &&
            (showRaw ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ))}
        </span>

        {typeIcon(observation.type)}
        {statusIcon(observation.status)}

        <span className="font-mono font-medium truncate flex-1">
          {observation.name}
        </span>

        {isKey && (
          <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30">
            key
          </Badge>
        )}

        {observation.durationMs != null && (
          <span className="text-muted-foreground shrink-0">
            {formatDurationMs(observation.durationMs)}
          </span>
        )}

        {observation.totalTokens != null && observation.totalTokens > 0 && (
          <span className="text-muted-foreground shrink-0">
            {observation.totalTokens} tok
          </span>
        )}
      </div>

      {/* Bronze raw JSON details */}
      {showRaw && (
        <div
          data-testid={`trace-bronze-raw-${observation.id}`}
          className="ml-6 mb-2 space-y-2"
        >
          {observation.input != null && (
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                Input
              </span>
              <pre className="mt-0.5 text-[11px] bg-muted/40 rounded-sm p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto font-mono">
                {truncateJson(observation.input)}
              </pre>
            </div>
          )}
          {observation.output != null && (
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                Output
              </span>
              <pre className="mt-0.5 text-[11px] bg-muted/40 rounded-sm p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto font-mono">
                {truncateJson(observation.output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- GoldPhaseCard ----------

interface GoldPhaseCardProps {
  goldPhase: TraceGoldPhase;
  silverPhase: TracePhase | undefined;
  /** Flat list of all observations for this trace */
  allObservations: TraceObservation[];
  phaseIndex: number;
}

export function GoldPhaseCard({
  goldPhase,
  silverPhase,
  allObservations,
  phaseIndex,
}: GoldPhaseCardProps) {
  const [expanded, setExpanded] = useState(false);

  const phaseType = silverPhase?.type ?? "UNKNOWN";
  const ptConfig = phaseTypeConfig[phaseType];
  const vConfig = verdictConfig[goldPhase.verdict];
  const PhaseIcon = ptConfig.icon;
  const VerdictIcon = vConfig.icon;

  // Compute phase observations from silver startIdx/endIdx
  const phaseObservations = useMemo(() => {
    if (!silverPhase) return [];
    // Flatten tree observations to get by index
    const flatObs = flattenObservations(allObservations);
    return flatObs.slice(silverPhase.startIdx, silverPhase.endIdx + 1);
  }, [silverPhase, allObservations]);

  const keyObsSet = useMemo(
    () => new Set(goldPhase.keyObservationIds),
    [goldPhase.keyObservationIds],
  );

  return (
    <div
      data-testid={`trace-gold-phase-${phaseIndex}`}
      className={cn(
        "rounded-lg border transition-colors",
        ptConfig.borderColor,
        expanded ? ptConfig.bgColor : "bg-card hover:bg-accent/20",
      )}
    >
      {/* Gold header (always visible) */}
      <button
        data-testid={`trace-gold-phase-toggle-${phaseIndex}`}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Expand icon */}
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        {/* Phase type badge */}
        <Badge
          variant="outline"
          className={cn("text-[10px] gap-1 shrink-0", ptConfig.color, ptConfig.borderColor)}
        >
          <PhaseIcon className="h-3 w-3" />
          {ptConfig.label}
        </Badge>

        {/* Gold annotation */}
        <span className="text-sm flex-1 truncate text-foreground/90">
          {goldPhase.annotation}
        </span>

        {/* Relevance score */}
        <RelevanceBar score={goldPhase.relevanceScore} />

        {/* Verdict badge */}
        <Badge
          variant="outline"
          className={cn("text-[10px] gap-1 shrink-0", vConfig.color)}
        >
          <VerdictIcon className="h-3 w-3" />
          {vConfig.label}
        </Badge>

        {/* Observation count */}
        <span className="text-[10px] text-muted-foreground shrink-0">
          {silverPhase?.observationCount ?? 0} obs
        </span>
      </button>

      {/* Silver + Bronze expanded content */}
      {expanded && (
        <div
          data-testid={`trace-silver-phase-${phaseIndex}`}
          className="border-t border-border/50 px-4 py-3 space-y-3"
        >
          {/* Silver summary */}
          {silverPhase && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Silver Summary
              </span>
              <p className="text-xs text-foreground/70 leading-relaxed pl-4">
                {silverPhase.summary}
              </p>
            </div>
          )}

          {/* Observation list */}
          {phaseObservations.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Observations ({phaseObservations.length})
              </span>
              <div className="rounded-md border border-border/50 bg-card/50 p-1 space-y-0.5">
                {phaseObservations.map((obs) => (
                  <BronzeObservationRow
                    key={obs.id}
                    observation={obs}
                    isKey={keyObsSet.has(obs.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {phaseObservations.length === 0 && !silverPhase && (
            <p className="text-xs text-muted-foreground italic">
              No silver phase data available for this gold annotation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Helpers ----------

/** Flatten nested observation tree into a flat array (depth-first) */
function flattenObservations(observations: TraceObservation[]): TraceObservation[] {
  const result: TraceObservation[] = [];
  function walk(obs: TraceObservation[]) {
    for (const o of obs) {
      result.push(o);
      if (o.children && o.children.length > 0) {
        walk(o.children);
      }
    }
  }
  walk(observations);
  return result;
}
