/**
 * OBS-10: TraceGraphView — Simple CSS-based agent workflow graph
 *
 * Renders silver phases as sequential flow nodes connected by arrows.
 * For single-agent traces: phase sequence as a horizontal flow.
 * For multi-agent (future): parallel lanes per agent.
 *
 * Layout:
 *   [INIT] → [COMPREHENSION] → [COMMUNICATION] → [IMPLEMENTATION] → [VERIFICATION] → [RESULT]
 *
 * Each node shows:
 *   - Phase type icon + name
 *   - Observation count
 *   - Gold score + verdict badge (if available)
 *
 * Click a node to select it in the shared SelectionProvider.
 * Uses pure CSS flexbox — no heavy graph library needed.
 */

import { useMemo } from "react";
import {
  BookOpen,
  Code,
  Terminal,
  MessageSquare,
  Play,
  Trophy,
  HelpCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MinusCircle,
  ArrowRight,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useTraceData, type TreeNode } from "../../context/TraceDataContext";
import { useTraceSelection } from "../../context/TraceSelectionContext";
import type { TracePhaseType, GoldVerdict } from "../../api/traces";

// ─── Phase configuration ─────────────────────────────────────────────────────

interface PhaseGraphConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  barColor: string;
  icon: React.ElementType;
}

const PHASE_CONFIG: Record<string, PhaseGraphConfig> = {
  INITIALIZATION: {
    label: "Init",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/40",
    barColor: "bg-slate-500",
    icon: Play,
  },
  COMPREHENSION: {
    label: "Comprehension",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/40",
    barColor: "bg-blue-500",
    icon: BookOpen,
  },
  COMMUNICATION: {
    label: "Communication",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/40",
    barColor: "bg-purple-400",
    icon: MessageSquare,
  },
  IMPLEMENTATION: {
    label: "Implementation",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/40",
    barColor: "bg-emerald-500",
    icon: Code,
  },
  VERIFICATION: {
    label: "Verification",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/40",
    barColor: "bg-amber-500",
    icon: Terminal,
  },
  RESULT: {
    label: "Result",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/40",
    barColor: "bg-cyan-500",
    icon: Trophy,
  },
  UNKNOWN: {
    label: "Unknown",
    color: "text-muted-foreground",
    bgColor: "bg-muted/20",
    borderColor: "border-muted-foreground/40",
    barColor: "bg-muted-foreground",
    icon: HelpCircle,
  },
};

const VERDICT_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  success: { icon: CheckCircle, color: "text-emerald-400", label: "Success" },
  partial: { icon: AlertTriangle, color: "text-amber-400", label: "Partial" },
  failure: { icon: XCircle, color: "text-red-400", label: "Failure" },
  neutral: { icon: MinusCircle, color: "text-muted-foreground", label: "Neutral" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || ms === 0) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}m${sec}s` : `${min}m`;
}

// ─── Phase Node Card ──────────────────────────────────────────────────────────

interface PhaseNodeProps {
  node: TreeNode;
  isSelected: boolean;
  onSelect: () => void;
}

function PhaseNode({ node, isSelected, onSelect }: PhaseNodeProps) {
  const phaseType = (node.phaseType ?? "UNKNOWN") as string;
  const config = PHASE_CONFIG[phaseType] ?? PHASE_CONFIG.UNKNOWN;
  const Icon = config.icon;
  const goldPhase = node.goldPhase;
  const verdictCfg = goldPhase
    ? VERDICT_CONFIG[goldPhase.verdict] ?? VERDICT_CONFIG.neutral
    : null;
  const VerdictIcon = verdictCfg?.icon;

  return (
    <button
      className={cn(
        "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-150 cursor-pointer min-w-[120px] max-w-[150px]",
        config.bgColor,
        config.borderColor,
        "hover:scale-105 hover:shadow-lg hover:shadow-black/20",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105",
      )}
      onClick={onSelect}
      data-testid={`graph-node-${node.id}`}
    >
      {/* Icon */}
      <div className={cn("p-2 rounded-full", config.bgColor)}>
        <Icon className={cn("h-5 w-5", config.color)} />
      </div>

      {/* Phase name */}
      <span className={cn("text-xs font-semibold text-center leading-tight", config.color)}>
        {config.label}
      </span>

      {/* Observation count */}
      <span className="text-[10px] text-muted-foreground">
        {node.observationCount} obs
      </span>

      {/* Duration */}
      {node.totalDurationMs > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {formatDurationMs(node.totalDurationMs)}
        </span>
      )}

      {/* Gold score + verdict */}
      {goldPhase && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {/* Relevance score bar */}
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-10 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", config.barColor)}
                style={{ width: `${Math.min(100, Math.max(0, goldPhase.relevanceScore))}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {goldPhase.relevanceScore}
            </span>
          </div>
          {/* Verdict icon */}
          {VerdictIcon && (
            <VerdictIcon className={cn("h-3.5 w-3.5", verdictCfg!.color)} />
          )}
        </div>
      )}

      {/* Gold annotation (truncated) */}
      {goldPhase?.annotation && (
        <span className="text-[9px] text-muted-foreground/70 text-center leading-tight line-clamp-2 mt-0.5">
          {goldPhase.annotation}
        </span>
      )}
    </button>
  );
}

// ─── Arrow connector ──────────────────────────────────────────────────────────

function ArrowConnector() {
  return (
    <div className="flex items-center px-1 shrink-0" aria-hidden="true">
      <div className="w-6 h-px bg-border" />
      <ArrowRight className="h-3.5 w-3.5 text-border -ml-0.5" />
    </div>
  );
}

// ─── Observation-only node (when no phases) ───────────────────────────────────

interface ObsNodeProps {
  node: TreeNode;
  isSelected: boolean;
  onSelect: () => void;
}

function ObsNode({ node, isSelected, onSelect }: ObsNodeProps) {
  const obs = node.observation;
  if (!obs) return null;

  const isError = obs.status === "failed" || obs.status === "error";

  return (
    <button
      className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-md border transition-all duration-150 cursor-pointer min-w-[80px]",
        "bg-card border-border/50",
        "hover:scale-105 hover:shadow-md",
        isError && "border-red-500/40 bg-red-500/5",
        isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
      onClick={onSelect}
      data-testid={`graph-obs-node-${node.id}`}
    >
      <span className={cn(
        "text-[10px] font-mono font-medium truncate max-w-[100px]",
        isError ? "text-red-400" : "text-foreground/80",
      )}>
        {obs.name}
      </span>
      {obs.durationMs != null && obs.durationMs > 0 && (
        <span className="text-[9px] text-muted-foreground tabular-nums">
          {formatDurationMs(obs.durationMs)}
        </span>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TraceGraphView() {
  const { roots, trace } = useTraceData();
  const { selectedNodeId, setSelectedNodeId } = useTraceSelection();

  // Determine if this is a phase-based or flat-observation view
  const phaseNodes = useMemo(
    () => roots.filter((r) => r.type === "phase"),
    [roots],
  );
  const obsNodes = useMemo(
    () => roots.filter((r) => r.type === "observation"),
    [roots],
  );

  const handleSelect = (id: string) => {
    setSelectedNodeId(selectedNodeId === id ? null : id);
  };

  if (roots.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm text-muted-foreground"
        data-testid="graph-view-empty"
      >
        No observations to display
      </div>
    );
  }

  const hasPhases = phaseNodes.length > 0;
  const gold = trace?.gold;

  return (
    <div data-testid="trace-graph-view" className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50 shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Graph
        </span>
        <span className="text-[10px] text-muted-foreground">
          ({hasPhases ? `${phaseNodes.length} phases` : `${obsNodes.length} observations`})
        </span>
        <div className="flex-1" />
        {gold && (
          <span className="text-[10px] text-amber-400/80 font-medium">
            Gold: {gold.verdict} ({gold.modelUsed})
          </span>
        )}
      </div>

      {/* Gold verdict reason */}
      {gold?.verdictReason && (
        <div className="px-3 py-1.5 bg-amber-500/5 border-b border-border/50 shrink-0">
          <p className="text-[11px] text-muted-foreground italic">
            {gold.verdictReason}
          </p>
        </div>
      )}

      {/* Scrollable graph area */}
      <div className="flex-1 overflow-auto p-4">
        {hasPhases ? (
          /* Phase-based flow graph */
          <div className="flex items-center gap-0 min-w-max">
            {phaseNodes.map((node, index) => (
              <div key={node.id} className="flex items-center">
                <PhaseNode
                  node={node}
                  isSelected={selectedNodeId === node.id}
                  onSelect={() => handleSelect(node.id)}
                />
                {index < phaseNodes.length - 1 && <ArrowConnector />}
              </div>
            ))}
          </div>
        ) : (
          /* Flat observation flow (no phases) */
          <div className="flex flex-wrap items-center gap-2">
            {obsNodes.map((node, index) => (
              <div key={node.id} className="flex items-center">
                <ObsNode
                  node={node}
                  isSelected={selectedNodeId === node.id}
                  onSelect={() => handleSelect(node.id)}
                />
                {index < obsNodes.length - 1 && <ArrowConnector />}
              </div>
            ))}
          </div>
        )}

        {/* Issue AC Status (from gold) */}
        {gold?.issueAcStatus && gold.issueAcStatus.length > 0 && (
          <div className="mt-6 space-y-2" data-testid="graph-ac-status">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Acceptance Criteria
            </h3>
            <div className="flex flex-wrap gap-2">
              {gold.issueAcStatus.map((ac) => {
                const statusCfg = {
                  met: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle },
                  partial: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: AlertTriangle },
                  not_met: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: XCircle },
                  unknown: { color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border", icon: HelpCircle },
                }[ac.status] ?? { color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border", icon: HelpCircle };
                const StatusIcon = statusCfg.icon;

                return (
                  <div
                    key={ac.acId}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs",
                      statusCfg.bg,
                      statusCfg.border,
                    )}
                  >
                    <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", statusCfg.color)} />
                    <span className="text-foreground/80">{ac.label}</span>
                    <span className={cn("font-medium capitalize", statusCfg.color)}>
                      {ac.status.replace(/_/g, " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
